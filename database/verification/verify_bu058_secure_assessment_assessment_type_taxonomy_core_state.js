let pg;
try {
    pg = require('../../runtime/secure-assessment/node_modules/pg');
} catch (e) {
    pg = require('pg');
}
const { Client } = pg;
const fs = require('fs');
const path = require('path');

function assertStrict(condition, message) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

function log(message) {
    console.log(`- PASS: ${message}`);
}

async function runTest() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("FAIL: DATABASE_URL not set");
        process.exitCode = 1;
        return;
    }

    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    const migrationsDir = path.resolve(__dirname, '../migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => /^\d{4}_.*\.sql$/.test(f))
        .sort();

    // Verification requirement 1: exactly one canonical migration exists for each prefix 0001-0029
    console.log("\n--- VERIFYING CANONICAL MIGRATIONS 0001-0029 ---");
    for (let i = 1; i <= 29; i++) {
        const prefix = String(i).padStart(4, '0') + '_';
        const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
        assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
    }
    log("1. Exactly one canonical migration exists for each prefix 0001-0029");

    const migration0029Files = allMigrationFiles.filter(f => f.startsWith('0029_'));
    assertStrict(migration0029Files.length === 1, "Exactly one 0029 migration file exists");
    const migration0029Sql = fs.readFileSync(path.join(migrationsDir, migration0029Files[0]), 'utf8');
    const exactMigrationId = '0029_bu058_secure_assessment_assessment_type_taxonomy_core_state';

    const disposableDbName = `elligble_bu058_${runId}`;
    const openClients = [];
    let caughtError = null;
    let cleanupFailed = false;

    // Protected table definitions for schema snapshots
    const protectedSecureAssessmentSchemaTables = [
        'secure_assessment_exam_instances',
        'secure_assessment_exam_participants',
        'secure_assessment_exam_attempts',
        'secure_assessment_exam_sessions',
        'secure_assessment_timer_state',
        'secure_assessment_timer_adjustments'
    ];

    const protectedAcademicCoreTables = [
        'academic_core_academic_years',
        'academic_core_academic_periods',
        'academic_core_subjects',
        'academic_core_grade_levels',
        'academic_core_academic_groups',
        'academic_core_subject_offerings',
        'academic_core_teaching_assignments',
        'academic_core_student_enrollments'
    ];

    const getSchemaSnapshot = async (client, tables) => {
        const data = {};
        for (const table of tables) {
            const schemaCols = (await client.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY column_name
            `, [table])).rows;

            const schemaConstraints = (await client.query(`
                SELECT c.conname, pg_get_constraintdef(c.oid) AS def
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE t.relname = $1 AND n.nspname = 'public'
                ORDER BY c.conname
            `, [table])).rows;

            const schemaIndexes = (await client.query(`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = $1
                ORDER BY indexname
            `, [table])).rows;

            data[table] = {
                cols: schemaCols,
                constraints: schemaConstraints,
                indexes: schemaIndexes
            };
        }
        return data;
    };

    const getAcademicCoreDataSnapshot = async (client, tables) => {
        const data = {};
        for (const table of tables) {
            const rows = (await client.query(`
                SELECT *
                FROM public.${table}
                ORDER BY id
            `)).rows;
            data[table] = rows;
        }
        return data;
    };

    try {
        // Create ONE disposable BU-058 database
        console.log(`\n--- CREATING DISPOSABLE DATABASE: ${disposableDbName} ---`);
        const setupClient = new Client({ connectionString: adminUrl.toString() });
        await setupClient.connect();
        await setupClient.query(`CREATE DATABASE "${disposableDbName}"`);
        await setupClient.end();
        log(`Disposable database created: ${disposableDbName}`);

        const targetUrl = new URL(dbUrl);
        targetUrl.pathname = `/${disposableDbName}`;
        const client = new Client({ connectionString: targetUrl.toString() });
        await client.connect();
        openClients.push(client);

        // Verification requirement 2: canonical migrations 0001-0028 apply before BU-058
        console.log("\n--- APPLYING CANONICAL MIGRATIONS 0001-0028 ---");
        for (let i = 1; i <= 28; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await client.query(sql);
        }
        const histPre29 = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
        assertStrict(parseInt(histPre29.rows[0].c, 10) === 28, "Migration history count reaches exactly 28 before 0029");
        log("2. Canonical migrations 0001-0028 apply before BU-058");

        // Fixtures for Academic Core and Secure Assessment
        const t1 = (await client.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const p1 = (await client.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const m1 = (await client.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, p1])).rows[0].id;
        const teacher1 = (await client.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [t1, m1])).rows[0].id;

        const year1 = (await client.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t1])).rows[0].id;
        const period1 = (await client.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester 1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t1, year1])).rows[0].id;
        const subject1 = (await client.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Mathematics') RETURNING id`, [t1])).rows[0].id;
        const grade1 = (await client.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [t1])).rows[0].id;
        const group1 = (await client.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [t1, year1, grade1])).rows[0].id;
        const offering1 = (await client.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, subject1, period1, grade1])).rows[0].id;
        const ta1 = (await client.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, teacher1, offering1, group1])).rows[0].id;
        await client.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU058_VERIFIER') RETURNING id`, [t1, m1, year1, group1, period1]);

        // Pre-existing Exam Instance before 0029
        const preExamStarts = '2026-09-10T08:00:00Z';
        const preExamEnds = '2026-09-10T10:00:00Z';
        const exam1 = (await client.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', $3, $4, 3600, 'FULL_DURATION_BEYOND_WINDOW')
            RETURNING id, lifecycle_state, window_starts_at, window_ends_at, teaching_assignment_id, tenant_id, configured_attempt_duration_seconds, latest_start_policy
        `, [t1, ta1, preExamStarts, preExamEnds])).rows[0];

        // Capture PRE snapshots for regression and immutability checks
        const preSecureAssessmentSchema = await getSchemaSnapshot(client, protectedSecureAssessmentSchemaTables);
        const preAcademicCoreSchema = await getSchemaSnapshot(client, protectedAcademicCoreTables);
        const preAcademicCoreData = await getAcademicCoreDataSnapshot(client, protectedAcademicCoreTables);

        // =========================================================================
        // SCENARIOS WITH TRANSACTIONS / ROLLBACK (PERFORMANCE REQUIREMENT)
        // =========================================================================

        // Scenario 21a: Incompatible pre-existing physical contract (wrong column type) rejected loudly
        console.log("\n--- TESTING SCENARIOS WITH TRANSACTION ROLLBACK ---");
        await client.query('BEGIN');
        let threw21a = false;
        try {
            await client.query(`
                CREATE TABLE public.secure_assessment_assessment_types (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL,
                    display_label INTEGER NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_sa_assessment_types_tenant UNIQUE (id, tenant_id)
                )
            `);
            try {
                await client.query(migration0029Sql);
            } catch (err) {
                threw21a = true;
                assertStrict(err.message.includes('MIGRATION REJECTED'), `Expected MIGRATION REJECTED, got: ${err.message}`);
            }
        } finally {
            await client.query('ROLLBACK');
        }
        assertStrict(threw21a, "Migration 0029 must fail loudly on incompatible column contract");
        const histCheck21a = await client.query(`SELECT 1 FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(histCheck21a.rows.length === 0, "Migration history remains absent on incompatible pre-existing table");
        log("21a. Incompatible pre-existing column contract rejected loudly and history remains absent");

        // Scenario 21b: Incompatible pre-existing same-name CHECK constraint rejected loudly
        await client.query('BEGIN');
        let threw21b = false;
        try {
            await client.query(`
                CREATE TABLE public.secure_assessment_assessment_types (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL,
                    display_label VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_sa_assessment_types_tenant UNIQUE (id, tenant_id),
                    CONSTRAINT ck_sa_assessment_types_display_label_non_blank CHECK (length(display_label) > 5)
                )
            `);
            try {
                await client.query(migration0029Sql);
            } catch (err) {
                threw21b = true;
                assertStrict(err.message.includes('MIGRATION REJECTED'), `Expected MIGRATION REJECTED, got: ${err.message}`);
            }
        } finally {
            await client.query('ROLLBACK');
        }
        assertStrict(threw21b, "Migration 0029 must fail loudly on incompatible same-name CHECK constraint");
        const histCheck21b = await client.query(`SELECT 1 FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(histCheck21b.rows.length === 0, "Migration history remains absent on incompatible check constraint");
        log("21b. Incompatible pre-existing same-name CHECK constraint rejected loudly and history remains absent");

        // Scenario 21c: Constraint name collision on another table rejected loudly
        await client.query('BEGIN');
        let threw21c = false;
        try {
            await client.query(`
                CREATE TABLE public.dummy_collision_test (
                    id UUID PRIMARY KEY,
                    tenant_id UUID,
                    CONSTRAINT uq_sa_assessment_types_tenant UNIQUE (id, tenant_id)
                )
            `);
            try {
                await client.query(migration0029Sql);
            } catch (err) {
                threw21c = true;
                assertStrict(err.message.includes('MIGRATION REJECTED'), `Expected MIGRATION REJECTED on constraint collision, got: ${err.message}`);
            }
        } finally {
            await client.query('ROLLBACK');
        }
        assertStrict(threw21c, "Migration 0029 must fail loudly on constraint collision");
        log("21c. Constraint name collision on another table rejected loudly");

        // Scenario 22a: Migration-history false claim with missing table rejected loudly
        await client.query('BEGIN');
        let threw22a = false;
        try {
            await client.query(`
                INSERT INTO public.elligble_migration_history (migration_id)
                VALUES ($1)
            `, [exactMigrationId]);
            try {
                await client.query(migration0029Sql);
            } catch (err) {
                threw22a = true;
                assertStrict(err.message.includes('MIGRATION REJECTED'), `Expected MIGRATION REJECTED on false history with missing table, got: ${err.message}`);
            }
        } finally {
            await client.query('ROLLBACK');
        }
        assertStrict(threw22a, "Migration 0029 must fail loudly when history exists but table is missing");
        log("22a. Migration-history false claim with missing physical table rejected loudly");

        // Scenario 22b: Migration-history false claim with incompatible physical schema rejected loudly
        await client.query('BEGIN');
        let threw22b = false;
        try {
            await client.query(`
                CREATE TABLE public.secure_assessment_assessment_types (
                    id UUID PRIMARY KEY,
                    tenant_id UUID,
                    display_label TEXT
                )
            `);
            await client.query(`
                INSERT INTO public.elligble_migration_history (migration_id)
                VALUES ($1)
            `, [exactMigrationId]);
            try {
                await client.query(migration0029Sql);
            } catch (err) {
                threw22b = true;
                assertStrict(err.message.includes('MIGRATION REJECTED'), `Expected MIGRATION REJECTED on false history with incompatible table, got: ${err.message}`);
            }
        } finally {
            await client.query('ROLLBACK');
        }
        assertStrict(threw22b, "Migration 0029 must fail loudly when history exists but schema is incompatible");
        log("22b. Migration-history false claim with incompatible physical schema rejected loudly");

        // Negative Scenario A: Incompatible id default (history absent) rejected loudly
        await client.query('BEGIN');
        let threwScenarioA = false;
        try {
            await client.query(`
                CREATE TABLE public.secure_assessment_assessment_types (
                    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
                    tenant_id UUID NOT NULL,
                    display_label VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_sa_assessment_types_tenant UNIQUE (id, tenant_id),
                    CONSTRAINT ck_sa_assessment_types_display_label_non_blank CHECK (btrim(display_label) <> '')
                )
            `);
            try {
                await client.query(migration0029Sql);
            } catch (err) {
                threwScenarioA = true;
                assertStrict(err.message.includes('MIGRATION REJECTED'), `Expected MIGRATION REJECTED, got: ${err.message}`);
            }
        } finally {
            await client.query('ROLLBACK');
        }
        assertStrict(threwScenarioA, "Migration 0029 must fail loudly on incompatible id default");
        const histCheckA = await client.query(`SELECT 1 FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(histCheckA.rows.length === 0, "Migration history remains absent on incompatible id default");
        log("Negative Scenario A: Wrong id default (history absent) rejected loudly and history remains absent");

        // Negative Scenario B: Incompatible created_at default (history absent) rejected loudly
        await client.query('BEGIN');
        let threwScenarioB = false;
        try {
            await client.query(`
                CREATE TABLE public.secure_assessment_assessment_types (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL,
                    display_label VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP - interval '1 day'),
                    CONSTRAINT uq_sa_assessment_types_tenant UNIQUE (id, tenant_id),
                    CONSTRAINT ck_sa_assessment_types_display_label_non_blank CHECK (btrim(display_label) <> '')
                )
            `);
            try {
                await client.query(migration0029Sql);
            } catch (err) {
                threwScenarioB = true;
                assertStrict(err.message.includes('MIGRATION REJECTED'), `Expected MIGRATION REJECTED, got: ${err.message}`);
            }
        } finally {
            await client.query('ROLLBACK');
        }
        assertStrict(threwScenarioB, "Migration 0029 must fail loudly on incompatible created_at default");
        const histCheckB = await client.query(`SELECT 1 FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(histCheckB.rows.length === 0, "Migration history remains absent on incompatible created_at default");
        log("Negative Scenario B: Wrong created_at default (history absent) rejected loudly and history remains absent");

        // Negative Scenario C: False history claim + incompatible required default rejected loudly
        await client.query('BEGIN');
        let threwScenarioC = false;
        try {
            await client.query(`
                CREATE TABLE public.secure_assessment_assessment_types (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL,
                    display_label VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT '2026-01-01 00:00:00+00'::timestamptz,
                    CONSTRAINT uq_sa_assessment_types_tenant UNIQUE (id, tenant_id),
                    CONSTRAINT ck_sa_assessment_types_display_label_non_blank CHECK (btrim(display_label) <> '')
                )
            `);
            await client.query(`
                INSERT INTO public.elligble_migration_history (migration_id)
                VALUES ($1)
            `, [exactMigrationId]);
            try {
                await client.query(migration0029Sql);
            } catch (err) {
                threwScenarioC = true;
                assertStrict(err.message.includes('MIGRATION REJECTED'), `Expected MIGRATION REJECTED, got: ${err.message}`);
            }
        } finally {
            await client.query('ROLLBACK');
        }
        assertStrict(threwScenarioC, "Migration 0029 must fail loudly on false history with incompatible default");
        log("Negative Scenario C: False history claim + wrong required default rejected loudly");

        // Scenario 20: Compatible pre-existing exact table with history absent is safely recognized and history registered once
        await client.query('BEGIN');
        try {
            await client.query(`
                CREATE TABLE public.secure_assessment_assessment_types (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL,
                    display_label VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_sa_assessment_types_tenant UNIQUE (id, tenant_id),
                    CONSTRAINT ck_sa_assessment_types_display_label_non_blank CHECK (btrim(display_label) <> '')
                )
            `);
            await client.query(migration0029Sql);
            const histRes = await client.query(`SELECT migration_id FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
            assertStrict(histRes.rows.length === 1, "Migration history registered exactly once for compatible pre-existing table");
        } finally {
            await client.query('ROLLBACK');
        }
        log("20. Compatible pre-existing exact table with history absent safely recognized and registered once");

        // =========================================================================
        // CANONICAL CLEAN APPLY OF MIGRATION 0029
        // =========================================================================
        console.log("\n--- CANONICAL APPLY OF MIGRATION 0029 ---");
        await client.query(migration0029Sql);
        log("3. Migration 0029 applies successfully");

        // Verification requirement 4: migration history count reaches exactly 29
        const histCountRes = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
        assertStrict(parseInt(histCountRes.rows[0].c, 10) === 29, "Migration history count reaches exactly 29");
        log("4. Migration history count reaches exactly 29");

        // Verification requirement 5: exact migration ID exists exactly once
        const histExactRes = await client.query(`SELECT migration_id FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(histExactRes.rows.length === 1, "Exact migration ID exists exactly once");
        log("5. Exact migration ID exists exactly once: 0029_bu058_secure_assessment_assessment_type_taxonomy_core_state");

        // Verification requirement 6: table exists as BASE TABLE in public schema
        const tableRes = await client.query(`
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'secure_assessment_assessment_types'
        `);
        assertStrict(tableRes.rows.length === 1, "Table secure_assessment_assessment_types exists in public schema");
        assertStrict(tableRes.rows[0].table_type === 'BASE TABLE', "Table is a BASE TABLE");
        log("6. Table exists as BASE TABLE: public.secure_assessment_assessment_types");

        // Verification requirement 7: id column UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()
        const idColRes = await client.query(`
            SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
                   pg_get_expr(d.adbin, d.adrelid) AS catalog_default
            FROM information_schema.columns c
            JOIN pg_class t ON t.relname = c.table_name
            JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = c.table_schema
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = c.column_name
            JOIN pg_attrdef d ON d.adrelid = t.oid AND d.adnum = a.attnum
            WHERE c.table_schema = 'public' AND c.table_name = 'secure_assessment_assessment_types' AND c.column_name = 'id'
        `);
        assertStrict(idColRes.rows.length === 1, "id column exists");
        const idCol = idColRes.rows[0];
        assertStrict(idCol.data_type === 'uuid', "id is uuid");
        assertStrict(idCol.is_nullable === 'NO', "id is NOT NULL");
        assertStrict(idCol.column_default === 'gen_random_uuid()', `id column_default is exact gen_random_uuid(), got: ${idCol.column_default}`);
        assertStrict(idCol.catalog_default === 'gen_random_uuid()', `id catalog_default is exact gen_random_uuid(), got: ${idCol.catalog_default}`);

        const pkRes = await client.query(`
            SELECT c.conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.contype = 'p'
        `);
        assertStrict(pkRes.rows.length === 1, "Primary key exists");
        assertStrict(pkRes.rows[0].def === 'PRIMARY KEY (id)', "Primary key is on id");
        log("7. id: UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid() (exact physical default expression)");

        // Verification requirement 8: tenant_id UUID NOT NULL NO DEFAULT
        const tenantColRes = await client.query(`
            SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
                   d.adbin IS NOT NULL AS has_catalog_default
            FROM information_schema.columns c
            JOIN pg_class t ON t.relname = c.table_name
            JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = c.table_schema
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = c.column_name
            LEFT JOIN pg_attrdef d ON d.adrelid = t.oid AND d.adnum = a.attnum
            WHERE c.table_schema = 'public' AND c.table_name = 'secure_assessment_assessment_types' AND c.column_name = 'tenant_id'
        `);
        assertStrict(tenantColRes.rows.length === 1, "tenant_id column exists");
        const tenantCol = tenantColRes.rows[0];
        assertStrict(tenantCol.data_type === 'uuid', "tenant_id is uuid");
        assertStrict(tenantCol.is_nullable === 'NO', "tenant_id is NOT NULL");
        assertStrict(tenantCol.column_default === null, "tenant_id has NO DEFAULT in information_schema");
        assertStrict(tenantCol.has_catalog_default === false, "tenant_id has NO DEFAULT in pg_attrdef");
        log("8. tenant_id: UUID NOT NULL NO DEFAULT");

        // Verification requirement 9: display_label VARCHAR(255) NOT NULL NO DEFAULT
        const labelColRes = await client.query(`
            SELECT c.column_name, c.data_type, c.character_maximum_length, c.is_nullable, c.column_default,
                   d.adbin IS NOT NULL AS has_catalog_default
            FROM information_schema.columns c
            JOIN pg_class t ON t.relname = c.table_name
            JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = c.table_schema
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = c.column_name
            LEFT JOIN pg_attrdef d ON d.adrelid = t.oid AND d.adnum = a.attnum
            WHERE c.table_schema = 'public' AND c.table_name = 'secure_assessment_assessment_types' AND c.column_name = 'display_label'
        `);
        assertStrict(labelColRes.rows.length === 1, "display_label column exists");
        const labelCol = labelColRes.rows[0];
        assertStrict(labelCol.data_type === 'character varying', "display_label is VARCHAR");
        assertStrict(labelCol.character_maximum_length === 255, "display_label max length is 255");
        assertStrict(labelCol.is_nullable === 'NO', "display_label is NOT NULL");
        assertStrict(labelCol.column_default === null, "display_label has NO DEFAULT in information_schema");
        assertStrict(labelCol.has_catalog_default === false, "display_label has NO DEFAULT in pg_attrdef");
        log("9. display_label: VARCHAR(255) NOT NULL NO DEFAULT");

        // Verification requirement 10: created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        const createdColRes = await client.query(`
            SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
                   pg_get_expr(d.adbin, d.adrelid) AS catalog_default
            FROM information_schema.columns c
            JOIN pg_class t ON t.relname = c.table_name
            JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = c.table_schema
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = c.column_name
            JOIN pg_attrdef d ON d.adrelid = t.oid AND d.adnum = a.attnum
            WHERE c.table_schema = 'public' AND c.table_name = 'secure_assessment_assessment_types' AND c.column_name = 'created_at'
        `);
        assertStrict(createdColRes.rows.length === 1, "created_at column exists");
        const createdCol = createdColRes.rows[0];
        assertStrict(createdCol.data_type === 'timestamp with time zone', "created_at is TIMESTAMPTZ");
        assertStrict(createdCol.is_nullable === 'NO', "created_at is NOT NULL");
        assertStrict(createdCol.column_default === 'CURRENT_TIMESTAMP', `created_at column_default is exact CURRENT_TIMESTAMP, got: ${createdCol.column_default}`);
        assertStrict(createdCol.catalog_default === 'CURRENT_TIMESTAMP', `created_at catalog_default is exact CURRENT_TIMESTAMP, got: ${createdCol.catalog_default}`);
        log("10. created_at: TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP (exact physical default expression)");

        // Verification requirement 11: exact composite unique constraint uq_sa_assessment_types_tenant UNIQUE (id, tenant_id)
        const uqRes = await client.query(`
            SELECT c.conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.conname = 'uq_sa_assessment_types_tenant'
        `);
        assertStrict(uqRes.rows.length === 1, "Constraint uq_sa_assessment_types_tenant exists");
        assertStrict(uqRes.rows[0].def === 'UNIQUE (id, tenant_id)', `uq_sa_assessment_types_tenant def is: ${uqRes.rows[0].def}`);
        log("11. Exact composite unique constraint exists: uq_sa_assessment_types_tenant UNIQUE (id, tenant_id)");

        // Verification requirement 12: exact CHECK exists ck_sa_assessment_types_display_label_non_blank
        const ckRes = await client.query(`
            SELECT c.conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.conname = 'ck_sa_assessment_types_display_label_non_blank'
        `);
        assertStrict(ckRes.rows.length === 1, "Constraint ck_sa_assessment_types_display_label_non_blank exists");
        assertStrict(ckRes.rows[0].def === "CHECK ((btrim((display_label)::text) <> ''::text))", `CHECK def is: ${ckRes.rows[0].def}`);
        log("12. Exact CHECK exists: ck_sa_assessment_types_display_label_non_blank with btrim non-blank semantics");

        // Verification requirement 17: migration creates ZERO seeded Assessment Type rows
        const countRowsInit = await client.query(`SELECT COUNT(*) as c FROM public.secure_assessment_assessment_types`);
        assertStrict(parseInt(countRowsInit.rows[0].c, 10) === 0, "Migration creates ZERO seeded rows");
        log("17. Migration creates ZERO seeded Assessment Type rows");

        // Verification requirement 16: table contains ZERO foreign keys
        const fkRes = await client.query(`
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.contype = 'f'
        `);
        assertStrict(fkRes.rows.length === 0, "Table must contain ZERO foreign keys");
        log("16. Table contains ZERO foreign keys");

        // Verification requirement 13: normal configurable labels are accepted
        console.log("\n--- TESTING ASSESSMENT TYPE INSERTIONS ---");
        const labelsToTest = [
            'Ulangan Harian / Quiz',
            'UTS / PTS',
            'UAS / PAS',
            'Try Out',
            'Diagnostic',
            'Practice',
            'Custom School Assessment'
        ];
        const insertedIds = [];
        for (const label of labelsToTest) {
            const insRes = await client.query(`
                INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label)
                VALUES ($1, $2)
                RETURNING id, tenant_id, display_label, created_at
            `, [t1, label]);
            assertStrict(insRes.rows.length === 1, `Inserted row for label ${label}`);
            assertStrict(insRes.rows[0].display_label === label, `Label stored matches ${label}`);
            assertStrict(insRes.rows[0].id !== null, "id generated");
            assertStrict(insRes.rows[0].created_at !== null, "created_at generated");
            insertedIds.push(insRes.rows[0].id);
        }
        log("13. Normal configurable labels are accepted (UTS / PTS, Diagnostic, Custom School Assessment, etc.)");

        // Verification requirement 14: empty string is rejected
        let emptyRejected = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label)
                VALUES ($1, '')
            `, [t1]);
        } catch (err) {
            emptyRejected = true;
            assertStrict(err.message.includes('ck_sa_assessment_types_display_label_non_blank'), `Expected check constraint violation, got: ${err.message}`);
        }
        assertStrict(emptyRejected, "Empty string display_label must be rejected by check constraint");
        log("14. Empty string is rejected");

        // Verification requirement 15: whitespace-only label is rejected
        let whitespaceRejected = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label)
                VALUES ($1, '      ')
            `, [t1]);
        } catch (err) {
            whitespaceRejected = true;
            assertStrict(err.message.includes('ck_sa_assessment_types_display_label_non_blank'), `Expected check constraint violation, got: ${err.message}`);
        }
        assertStrict(whitespaceRejected, "Whitespace-only display_label must be rejected by check constraint");
        log("15. Whitespace-only label is rejected");

        // Verify composite unique constraint uq_sa_assessment_types_tenant
        let duplicateUqRejected = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_assessment_types (id, tenant_id, display_label)
                VALUES ($1, $2, 'Duplicate Assessment Type')
            `, [insertedIds[0], t1]);
        } catch (err) {
            duplicateUqRejected = true;
            assertStrict(err.message.includes('uq_sa_assessment_types_tenant') || err.message.includes('unique constraint'), `Expected unique violation, got: ${err.message}`);
        }
        assertStrict(duplicateUqRejected, "Duplicate (id, tenant_id) must be rejected");
        log("Composite unique constraint uq_sa_assessment_types_tenant prevents duplicate (id, tenant_id)");

        // Verification requirement 18 & 19: exact repeat invocation is safe and does not duplicate table, constraints, or history
        console.log("\n--- TESTING SEMANTIC REPEAT SAFETY ---");
        await client.query(migration0029Sql);
        log("18. Exact repeat invocation is safe");

        const repeatHistCount = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
        assertStrict(parseInt(repeatHistCount.rows[0].c, 10) === 29, "Repeat invocation does not duplicate migration history");

        const repeatTableCount = await client.query(`
            SELECT COUNT(*) as c
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'secure_assessment_assessment_types'
        `);
        assertStrict(parseInt(repeatTableCount.rows[0].c, 10) === 1, "Repeat invocation does not duplicate table");

        const repeatUqCount = await client.query(`
            SELECT COUNT(*) as c
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.conname = 'uq_sa_assessment_types_tenant'
        `);
        assertStrict(parseInt(repeatUqCount.rows[0].c, 10) === 1, "Repeat invocation does not duplicate unique constraint");

        const repeatCkCount = await client.query(`
            SELECT COUNT(*) as c
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.conname = 'ck_sa_assessment_types_display_label_non_blank'
        `);
        assertStrict(parseInt(repeatCkCount.rows[0].c, 10) === 1, "Repeat invocation does not duplicate check constraint");
        log("19. Exact repeat does not duplicate table, constraints, or migration history");

        // Verification requirement 23 & 24: existing Secure Assessment predecessor schema is preserved and Exam Instance is unchanged
        console.log("\n--- VERIFYING EXAM INSTANCES & SECURE ASSESSMENT PREDECESSORS ---");
        const postSecureAssessmentSchema = await getSchemaSnapshot(client, protectedSecureAssessmentSchemaTables);
        for (const tbl of protectedSecureAssessmentSchemaTables) {
            const pre = preSecureAssessmentSchema[tbl];
            const post = postSecureAssessmentSchema[tbl];
            assertStrict(JSON.stringify(pre) === JSON.stringify(post), `Predecessor schema for table ${tbl} must remain identical`);
        }
        log("23. Existing Secure Assessment predecessor schema is preserved");

        // Check columns of secure_assessment_exam_instances specifically
        const examCols = (await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances'
        `)).rows.map(r => r.column_name);

        assertStrict(!examCols.includes('assessment_type_id'), "secure_assessment_exam_instances must NOT contain assessment_type_id");
        assertStrict(!examCols.includes('assessment_type_code'), "secure_assessment_exam_instances must NOT contain assessment_type_code");
        log("24. public.secure_assessment_exam_instances is unchanged (no assessment_type_id or assessment_type_code added)");

        // Verification requirement 25: BU-053 lifecycle_state semantics remain unchanged
        const validStates = ['DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED'];
        for (const st of validStates) {
            const res = await client.query(`
                INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at)
                VALUES ($1, $2, $3, NOW(), NOW() + interval '1 hour')
                RETURNING id, lifecycle_state
            `, [t1, ta1, st]);
            assertStrict(res.rows[0].lifecycle_state === st, `State ${st} supported`);
        }
        let invalidStateThrew = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at)
                VALUES ($1, $2, 'INVALID_STATE', NOW(), NOW() + interval '1 hour')
            `, [t1, ta1]);
        } catch (e) {
            invalidStateThrew = true;
        }
        assertStrict(invalidStateThrew, "Invalid lifecycle_state must be rejected");
        log("25. BU-053 lifecycle_state semantics remain unchanged");

        // Verification requirement 26: BU-054 window semantics remain unchanged
        let windowChronologyThrew = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at)
                VALUES ($1, $2, 'DRAFT', NOW() + interval '2 hours', NOW() + interval '1 hour')
            `, [t1, ta1]);
        } catch (e) {
            windowChronologyThrew = true;
        }
        assertStrict(windowChronologyThrew, "Window ends_at <= starts_at must be rejected");
        log("26. BU-054 window semantics remain unchanged");

        // Verification requirement 27: BU-056 configured_attempt_duration_seconds semantics remain unchanged
        let durationThrew = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds)
                VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 0)
            `, [t1, ta1]);
        } catch (e) {
            durationThrew = true;
        }
        assertStrict(durationThrew, "Attempt duration <= 0 must be rejected");
        log("27. BU-056 configured_attempt_duration_seconds semantics remain unchanged");

        // Verification requirement 28: BU-057 latest_start_policy semantics remain unchanged
        console.log("\n--- VERIFYING BU-057 REGRESSION (latest_start_policy) ---");
        // NULL accepted
        const rowNull = (await client.query(`
            INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', NULL)
            RETURNING id, latest_start_policy
        `, [t1, ta1])).rows[0];
        assertStrict(rowNull.latest_start_policy === null, "latest_start_policy NULL accepted");

        // FULL_DURATION_BEYOND_WINDOW accepted
        const rowFull = (await client.query(`
            INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 'FULL_DURATION_BEYOND_WINDOW')
            RETURNING id, latest_start_policy
        `, [t1, ta1])).rows[0];
        assertStrict(rowFull.latest_start_policy === 'FULL_DURATION_BEYOND_WINDOW', "FULL_DURATION_BEYOND_WINDOW accepted");

        // REMAINING_WINDOW_ONLY accepted
        const rowRem = (await client.query(`
            INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 'REMAINING_WINDOW_ONLY')
            RETURNING id, latest_start_policy
        `, [t1, ta1])).rows[0];
        assertStrict(rowRem.latest_start_policy === 'REMAINING_WINDOW_ONLY', "REMAINING_WINDOW_ONLY accepted");

        // LATE_START_BLOCKED accepted
        const rowBlock = (await client.query(`
            INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 'LATE_START_BLOCKED')
            RETURNING id, latest_start_policy
        `, [t1, ta1])).rows[0];
        assertStrict(rowBlock.latest_start_policy === 'LATE_START_BLOCKED', "LATE_START_BLOCKED accepted");

        // Unsupported policy rejected
        let invalidPolicyThrew = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
                VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 'INVALID_POLICY')
            `, [t1, ta1]);
        } catch (e) {
            invalidPolicyThrew = true;
            assertStrict(e.message.includes('ck_sa_exam_instances_latest_start_policy'), `Expected policy check constraint violation, got: ${e.message}`);
        }
        assertStrict(invalidPolicyThrew, "Invalid latest_start_policy must be rejected");

        // Constraint ck_sa_exam_instances_latest_start_policy exists
        const conLatestRes = await client.query(`
            SELECT c.conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE t.relname = 'secure_assessment_exam_instances'
              AND n.nspname = 'public'
              AND c.conname = 'ck_sa_exam_instances_latest_start_policy'
        `);
        assertStrict(conLatestRes.rows.length === 1, "Constraint ck_sa_exam_instances_latest_start_policy exists");
        log("28. BU-057 latest_start_policy semantics remain unchanged (NULL, FULL_DURATION_BEYOND_WINDOW, REMAINING_WINDOW_ONLY, LATE_START_BLOCKED accepted, unsupported rejected)");

        // Verification requirement 29 & 30: Academic Core protected schema and fixture data remain unchanged
        console.log("\n--- VERIFYING ACADEMIC CORE IMMUTABILITY ---");
        const postAcademicCoreSchema = await getSchemaSnapshot(client, protectedAcademicCoreTables);
        for (const tbl of protectedAcademicCoreTables) {
            const pre = preAcademicCoreSchema[tbl];
            const post = postAcademicCoreSchema[tbl];
            assertStrict(JSON.stringify(pre) === JSON.stringify(post), `Academic Core schema for ${tbl} must remain identical`);
        }
        log("29. Academic Core protected schema is unchanged");

        const postAcademicCoreData = await getAcademicCoreDataSnapshot(client, protectedAcademicCoreTables);
        for (const tbl of protectedAcademicCoreTables) {
            const pre = preAcademicCoreData[tbl];
            const post = postAcademicCoreData[tbl];
            assertStrict(JSON.stringify(pre) === JSON.stringify(post), `Academic Core fixture data for ${tbl} must remain identical`);
        }
        log("30. Academic Core fixture data is unchanged");

    } catch (err) {
        caughtError = err;
        console.error("FAIL: Verification failed with error:", err);
    } finally {
        // Teardown open clients
        for (const c of openClients) {
            try {
                await c.end();
            } catch (e) {
                console.error("Error closing client:", e);
            }
        }

        // Teardown disposable database
        console.log("\n--- CLEANING UP DISPOSABLE DATABASE ---");
        let teardownClient = null;
        try {
            teardownClient = new Client({ connectionString: adminUrl.toString() });
            await teardownClient.connect();

            await teardownClient.query(`
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = $1 AND pid <> pg_backend_pid()
            `, [disposableDbName]);
            await teardownClient.query(`DROP DATABASE IF EXISTS "${disposableDbName}" WITH (FORCE)`);

            // Verification requirement 31 & 32: Disposable DB cleanup PASS, no database matching elligble_bu058_% remains
            const remRes = await teardownClient.query(`
                SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu058_%'
            `);
            if (remRes.rows.length > 0) {
                console.error("FAIL: Leaked disposable databases remaining:", remRes.rows.map(r => r.datname));
                cleanupFailed = true;
            } else {
                log("31. Disposable database cleanup PASS");
                log("32. No database matching elligble_bu058_% remains after verification (0 remaining)");
            }
        } catch (e) {
            console.error("FAIL during teardown:", e);
            cleanupFailed = true;
        } finally {
            if (teardownClient) {
                try {
                    await teardownClient.end();
                } catch (e) {
                    console.error("Error closing teardown client:", e);
                }
            }
        }

        if (caughtError || cleanupFailed) {
            process.exitCode = 1;
        } else {
            console.log("\n==================================================");
            console.log("BU-058 SECURE ASSESSMENT ASSESSMENT TYPE TAXONOMY PERSISTENCE VERIFICATION PASS");
            console.log("==================================================");
        }
    }
}

runTest().catch(e => {
    console.error("UNHANDLED ROOT REJECTION:", e);
    process.exitCode = 1;
});
