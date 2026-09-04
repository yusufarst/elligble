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

    console.log("\n--- SECTION A: BASELINE / MIGRATION VERIFICATION ---");
    // 1. exactly one migration for every prefix 0001-0030
    for (let i = 1; i <= 30; i++) {
        const prefix = String(i).padStart(4, '0') + '_';
        const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
        assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
    }
    log("1. Exactly one canonical migration exists for each prefix 0001-0030");

    const migration0030Files = allMigrationFiles.filter(f => f.startsWith('0030_'));
    const migration0030Sql = fs.readFileSync(path.join(migrationsDir, migration0030Files[0]), 'utf8');
    const exactMigrationId = '0030_bu059_secure_assessment_exam_instance_assessment_type_binding';

    const disposableDbName = `elligble_bu059_${runId}`;
    const openClients = [];
    let caughtError = null;
    let cleanupFailed = false;

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

    const getSchemaSnapshot = async (targetClient, tables) => {
        const data = {};
        for (const table of tables) {
            const schemaCols = (await targetClient.query(`
                SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY column_name
            `, [table])).rows;

            const schemaConstraints = (await targetClient.query(`
                SELECT c.conname, pg_get_constraintdef(c.oid) AS def
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE t.relname = $1 AND n.nspname = 'public'
                ORDER BY c.conname
            `, [table])).rows;

            const schemaIndexes = (await targetClient.query(`
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

    const getAcademicCoreDataSnapshot = async (targetClient, tables) => {
        const data = {};
        for (const table of tables) {
            const rows = (await targetClient.query(`
                SELECT *
                FROM public.${table}
                ORDER BY id
            `)).rows;
            data[table] = rows;
        }
        return data;
    };

    try {
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

        console.log("\n--- APPLYING CANONICAL MIGRATIONS 0001-0029 ---");
        for (let i = 1; i <= 29; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await client.query(sql);
        }
        const histPre0030 = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
        assertStrict(parseInt(histPre0030.rows[0].c, 10) === 29, "Migration history count reaches exactly 29 before 0030");
        log("2. Canonical migrations 0001-0029 apply before BU-059");

        // Set up test fixtures
        const t1 = (await client.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const t2 = (await client.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

        const p1 = (await client.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const m1 = (await client.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, p1])).rows[0].id;
        const teacher1 = (await client.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [t1, m1])).rows[0].id;
        const year1 = (await client.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t1])).rows[0].id;
        const period1 = (await client.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t1, year1])).rows[0].id;
        const subject1 = (await client.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Math') RETURNING id`, [t1])).rows[0].id;
        const grade1 = (await client.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'G1') RETURNING id`, [t1])).rows[0].id;
        const group1 = (await client.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '1A') RETURNING id`, [t1, year1, grade1])).rows[0].id;
        const offering1 = (await client.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, subject1, period1, grade1])).rows[0].id;
        const ta1 = (await client.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, teacher1, offering1, group1])).rows[0].id;
        await client.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE', 'BU059') RETURNING id`, [t1, m1, year1, group1, period1]);

        // Pre-existing Exam Instance before 0030
        const preStartsAt = new Date('2026-09-10T08:00:00Z');
        const preEndsAt = new Date('2026-09-10T10:00:00Z');
        const examIdPre = (await client.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', $3, $4, 3600, 'FULL_DURATION_BEYOND_WINDOW')
            RETURNING id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
        `, [t1, ta1, preStartsAt, preEndsAt])).rows[0].id;

        // Pre-existing Assessment Types
        const atT1 = (await client.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'Type T1') RETURNING id`, [t1])).rows[0].id;
        const atT2 = (await client.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'Type T2') RETURNING id`, [t2])).rows[0].id;

        // Take PRE snapshots of protected schemas and data
        const preAcademicCoreSchema = await getSchemaSnapshot(client, protectedAcademicCoreTables);
        const preAcademicCoreData = await getAcademicCoreDataSnapshot(client, protectedAcademicCoreTables);

        // =========================================================================
        // SECTION H: NEGATIVE MIGRATION-COMPATIBILITY SCENARIOS
        // =========================================================================
        console.log("\n--- SECTION H: NEGATIVE MIGRATION-COMPATIBILITY SCENARIOS ---");

        const testNegativeScenario = async (scenarioNum, description, setupSql, expectedErrorRegex) => {
            await client.query('BEGIN');
            let error = null;
            try {
                if (setupSql) {
                    await client.query(setupSql);
                }
                await client.query(migration0030Sql);
            } catch (err) {
                error = err;
            } finally {
                await client.query('ROLLBACK');
            }
            assertStrict(error !== null, `Scenario ${scenarioNum} (${description}) must fail loudly`);
            if (expectedErrorRegex) {
                assertStrict(expectedErrorRegex.test(error.message), `Scenario ${scenarioNum} error message "${error.message}" must match ${expectedErrorRegex}`);
            }
            log(`${scenarioNum}. ${description}`);
        };

        // 35. incompatible assessment_type_id type rejected
        await testNegativeScenario(
            35,
            "Incompatible assessment_type_id type rejected",
            "ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN assessment_type_id INTEGER NULL;",
            /MIGRATION REJECTED: Column assessment_type_id exists with incompatible contract/
        );

        // 36. incompatible nullability rejected
        await testNegativeScenario(
            36,
            "Incompatible assessment_type_id nullability rejected",
            `ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN assessment_type_id UUID;
             UPDATE public.secure_assessment_exam_instances SET assessment_type_id = gen_random_uuid();
             ALTER TABLE public.secure_assessment_exam_instances ALTER COLUMN assessment_type_id SET NOT NULL;`,
            /MIGRATION REJECTED: Column assessment_type_id exists with incompatible contract/
        );

        // 37. incompatible default rejected
        await testNegativeScenario(
            37,
            "Incompatible assessment_type_id default rejected",
            "ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN assessment_type_id UUID DEFAULT gen_random_uuid();",
            /MIGRATION REJECTED: Column assessment_type_id exists with incompatible contract/
        );

        // 38. incompatible same-name FK rejected
        await testNegativeScenario(
            38,
            "Incompatible same-name FK rejected",
            `ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN assessment_type_id UUID NULL;
             ALTER TABLE public.secure_assessment_exam_instances ADD CONSTRAINT fk_sa_exam_instances_assessment_type
                 FOREIGN KEY (assessment_type_id, tenant_id) REFERENCES public.secure_assessment_assessment_types (id, tenant_id) ON DELETE CASCADE;`,
            /MIGRATION REJECTED: Constraint fk_sa_exam_instances_assessment_type exists with incompatible target, type, or semantics/
        );

        // 39. incompatible same-name index wrong columns/order rejected
        await testNegativeScenario(
            39,
            "Incompatible same-name index wrong columns/order rejected",
            `ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN assessment_type_id UUID NULL;
             CREATE INDEX idx_sa_exam_instances_tenant_assessment_type ON public.secure_assessment_exam_instances (assessment_type_id, tenant_id);`,
            /MIGRATION REJECTED: Index idx_sa_exam_instances_tenant_assessment_type exists with incompatible target, columns, order, or uniqueness/
        );

        // 40. incompatible same-name UNIQUE index rejected
        await testNegativeScenario(
            40,
            "Incompatible same-name UNIQUE index rejected",
            `ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN assessment_type_id UUID NULL;
             CREATE UNIQUE INDEX idx_sa_exam_instances_tenant_assessment_type ON public.secure_assessment_exam_instances (tenant_id, assessment_type_id);`,
            /MIGRATION REJECTED: Index idx_sa_exam_instances_tenant_assessment_type exists with incompatible target, columns, order, or uniqueness/
        );

        // 41. false history + missing column/contract rejected
        await testNegativeScenario(
            41,
            "False history with missing column/contract rejected",
            `INSERT INTO public.elligble_migration_history (migration_id) VALUES ('${exactMigrationId}');`,
            /MIGRATION REJECTED: Migration 0030 history exists but physical schema is missing or incompatible/
        );

        // 42. false history + incompatible FK/index rejected
        await testNegativeScenario(
            42,
            "False history with incompatible FK/index rejected",
            `INSERT INTO public.elligble_migration_history (migration_id) VALUES ('${exactMigrationId}');
             ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN assessment_type_id UUID NULL;
             CREATE UNIQUE INDEX idx_sa_exam_instances_tenant_assessment_type ON public.secure_assessment_exam_instances (tenant_id, assessment_type_id);`,
            /MIGRATION REJECTED: Migration 0030 history exists but physical schema is missing or incompatible/
        );

        // 43. compatible exact pre-existing state + no history converges safely
        await client.query('BEGIN');
        try {
            await client.query(`
                ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN assessment_type_id UUID NULL;
                CREATE INDEX idx_sa_exam_instances_tenant_assessment_type ON public.secure_assessment_exam_instances (tenant_id, assessment_type_id);
                ALTER TABLE public.secure_assessment_exam_instances
                    ADD CONSTRAINT fk_sa_exam_instances_assessment_type
                    FOREIGN KEY (assessment_type_id, tenant_id)
                    REFERENCES public.secure_assessment_assessment_types (id, tenant_id)
                    ON DELETE RESTRICT;
            `);
            await client.query(migration0030Sql);
            const convHist = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
            assertStrict(parseInt(convHist.rows[0].c, 10) === 1, "Convergence registers migration history exactly once");
            log("43. Compatible exact pre-existing state with no history converges safely and registers history once");
        } finally {
            await client.query('ROLLBACK');
        }

        // =========================================================================
        // SECTION A (CONTINUED): CANONICAL APPLY OF MIGRATION 0030
        // =========================================================================
        console.log("\n--- CANONICAL APPLY OF MIGRATION 0030 ---");
        const preAtSchema = await getSchemaSnapshot(client, ['secure_assessment_assessment_types']);
        const preAtRowCount = parseInt((await client.query(`SELECT COUNT(*) as c FROM public.secure_assessment_assessment_types`)).rows[0].c, 10);

        await client.query(migration0030Sql);
        log("3. Corrected 0030 clean apply PASS");

        const histCountRes = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
        assertStrict(parseInt(histCountRes.rows[0].c, 10) === 30, "Migration history count reaches exactly 30");

        const exactHistRes = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(parseInt(exactHistRes.rows[0].c, 10) === 1, "Exact migration history record count is 1");
        log("4. Exact migration-history ID count = 1 (and total history = 30)");

        // 5. exact repeat safety PASS
        await client.query(migration0030Sql);
        const repeatCount = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(parseInt(repeatCount.rows[0].c, 10) === 1, "Repeat invocation does not duplicate migration history");
        const repeatTotal = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
        assertStrict(parseInt(repeatTotal.rows[0].c, 10) === 30, "Repeat invocation total history remains exactly 30");
        log("5. Exact repeat safety PASS");

        // 44. history count remains exactly one after convergence/repeat
        log("44. History count remains exactly one after convergence and repeat executions");

        // =========================================================================
        // SECTION B: COLUMN VERIFICATION
        // =========================================================================
        console.log("\n--- SECTION B: COLUMN VERIFICATION ---");
        const colRes = await client.query(`
            SELECT c.column_name, c.data_type, c.is_nullable, c.column_default
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = 'secure_assessment_exam_instances'
              AND c.column_name = 'assessment_type_id'
        `);
        assertStrict(colRes.rows.length === 1, "assessment_type_id column exists exactly once");
        log("6. assessment_type_id exists exactly once");

        assertStrict(colRes.rows[0].data_type === 'uuid', "assessment_type_id data type is uuid");
        log("7. assessment_type_id data type is UUID");

        assertStrict(colRes.rows[0].is_nullable === 'YES', "assessment_type_id is nullable");
        log("8. assessment_type_id is nullable");

        assertStrict(colRes.rows[0].column_default === null, "assessment_type_id has no default");
        log("9. assessment_type_id has NO DEFAULT");

        const preDataRes = await client.query(`SELECT assessment_type_id FROM public.secure_assessment_exam_instances WHERE id = $1`, [examIdPre]);
        assertStrict(preDataRes.rows[0].assessment_type_id === null, "Pre-existing exam instance assessment_type_id remains NULL");
        log("10. Pre-existing Exam Instance remains NULL after migration");

        // =========================================================================
        // SECTION C: FOREIGN KEY CONSTRAINT VERIFICATION
        // =========================================================================
        console.log("\n--- SECTION C: FOREIGN KEY CONSTRAINT VERIFICATION ---");
        const fkRes = await client.query(`
            SELECT
                c.conname,
                c.contype,
                c.confdeltype,
                t.relname AS tablename,
                ft.relname AS fktablename,
                pg_get_constraintdef(c.oid) as def,
                (
                    SELECT array_agg(a.attname::text ORDER BY k.ord)
                    FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
                ) AS source_columns,
                (
                    SELECT array_agg(fa.attname::text ORDER BY k.ord)
                    FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_attribute fa ON fa.attrelid = ft.oid AND fa.attnum = k.attnum
                ) AS target_columns
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_class ft ON c.confrelid = ft.oid
            JOIN pg_namespace fn ON fn.oid = ft.relnamespace
            WHERE n.nspname = 'public'
              AND c.conname = 'fk_sa_exam_instances_assessment_type'
        `);
        assertStrict(fkRes.rows.length === 1, "Constraint fk_sa_exam_instances_assessment_type exists");
        log("11. Exact FK name fk_sa_exam_instances_assessment_type exists");

        assertStrict(JSON.stringify(fkRes.rows[0].source_columns) === JSON.stringify(['assessment_type_id', 'tenant_id']), "Source columns must be (assessment_type_id, tenant_id)");
        log("12. Exact ordered source columns: assessment_type_id, tenant_id");

        assertStrict(fkRes.rows[0].fktablename === 'secure_assessment_assessment_types', "Target table is secure_assessment_assessment_types");
        assertStrict(JSON.stringify(fkRes.rows[0].target_columns) === JSON.stringify(['id', 'tenant_id']), "Target columns must be (id, tenant_id)");
        log("13. Exact target: secure_assessment_assessment_types(id, tenant_id)");

        assertStrict(fkRes.rows[0].confdeltype === 'r', "FK ON DELETE must be RESTRICT ('r')");
        assertStrict(fkRes.rows[0].def === 'FOREIGN KEY (assessment_type_id, tenant_id) REFERENCES secure_assessment_assessment_types(id, tenant_id) ON DELETE RESTRICT', "FK definition is structurally exact");
        log("14. ON DELETE RESTRICT structurally verified");

        // 15. nonexistent Assessment Type rejected
        let threwNonexistent = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
                VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', gen_random_uuid())
            `, [t1, ta1]);
        } catch (e) {
            threwNonexistent = true;
        }
        assertStrict(threwNonexistent, "Nonexistent assessment_type_id must be rejected");
        log("15. Nonexistent Assessment Type rejected");

        // 16. cross-tenant Assessment Type rejected
        let threwCrossTenant = false;
        try {
            await client.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
                VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', $3)
            `, [t1, ta1, atT2]);
        } catch (e) {
            threwCrossTenant = true;
        }
        assertStrict(threwCrossTenant, "Cross-tenant assessment_type_id must be rejected");
        log("16. Cross-tenant Assessment Type rejected");

        // 17. same-tenant valid binding accepted
        const validIns = await client.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', $3)
            RETURNING id, assessment_type_id
        `, [t1, ta1, atT1]);
        assertStrict(validIns.rows.length === 1, "Same-tenant valid binding must be accepted");
        assertStrict(validIns.rows[0].assessment_type_id === atT1, "Bound assessment_type_id matches");
        log("17. Same-tenant valid binding accepted");

        // 18. referenced Assessment Type DELETE is functionally rejected
        let threwDeleteRestrict = false;
        try {
            await client.query(`DELETE FROM public.secure_assessment_assessment_types WHERE id = $1`, [atT1]);
        } catch (e) {
            threwDeleteRestrict = true;
        }
        assertStrict(threwDeleteRestrict, "Referenced Assessment Type DELETE must be rejected by ON DELETE RESTRICT");
        log("18. Referenced Assessment Type DELETE is functionally rejected");

        // =========================================================================
        // SECTION D: INDEX VERIFICATION
        // =========================================================================
        console.log("\n--- SECTION D: INDEX VERIFICATION ---");
        const idxRes = await client.query(`
            SELECT
                tbl.relname AS tablename,
                idx_c.relname AS indexname,
                i.indisunique,
                (
                    SELECT array_agg(a.attname::text ORDER BY k.ord)
                    FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = k.attnum
                ) AS columns
            FROM pg_class idx_c
            JOIN pg_namespace idx_ns ON idx_ns.oid = idx_c.relnamespace
            JOIN pg_index i ON i.indexrelid = idx_c.oid
            JOIN pg_class tbl ON tbl.oid = i.indrelid
            JOIN pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace
            WHERE idx_ns.nspname = 'public'
              AND idx_c.relname = 'idx_sa_exam_instances_tenant_assessment_type'
        `);
        assertStrict(idxRes.rows.length === 1, "Index idx_sa_exam_instances_tenant_assessment_type exists");
        log("19. Exact name idx_sa_exam_instances_tenant_assessment_type exists");

        assertStrict(idxRes.rows[0].tablename === 'secure_assessment_exam_instances', "Target table is secure_assessment_exam_instances");
        log("20. Exact target table public.secure_assessment_exam_instances");

        assertStrict(JSON.stringify(idxRes.rows[0].columns) === JSON.stringify(['tenant_id', 'assessment_type_id']), "Index columns must be ordered (tenant_id, assessment_type_id)");
        log("21. Exact ordered columns: tenant_id, assessment_type_id");

        assertStrict(idxRes.rows[0].indisunique === false, "Index must be NON-UNIQUE");
        log("22. Index is non-unique");

        // Verify old incorrect index name does NOT exist
        const oldIdxRes = await client.query(`
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'idx_sa_exam_instances_assessment_type'
        `);
        assertStrict(oldIdxRes.rows.length === 0, "Old incorrect index name idx_sa_exam_instances_assessment_type must NOT exist");

        // =========================================================================
        // SECTION E: CARDINALITY / NULL VERIFICATION
        // =========================================================================
        console.log("\n--- SECTION E: CARDINALITY / NULL VERIFICATION ---");
        // 23. NULL binding accepted
        const nullIns = await client.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', NULL)
            RETURNING id, assessment_type_id
        `, [t1, ta1]);
        assertStrict(nullIns.rows[0].assessment_type_id === null, "NULL assessment_type_id is accepted");
        log("23. NULL binding accepted");

        // 24. multiple Exam Instances may reference the same Assessment Type
        const secondIns = await client.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', $3)
            RETURNING id, assessment_type_id
        `, [t1, ta1, atT1]);
        assertStrict(secondIns.rows[0].assessment_type_id === atT1, "Second Exam Instance bound to same assessment type");
        log("24. Multiple Exam Instances may reference the same Assessment Type");

        // =========================================================================
        // SECTION F: BU-058 STILL-APPLICABLE CONTRACT PRESERVATION
        // =========================================================================
        console.log("\n--- SECTION F: BU-058 CONTRACT PRESERVATION ---");
        const atCols = (await client.query(`
            SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'secure_assessment_assessment_types'
            ORDER BY column_name
        `)).rows;
        const colMap = {};
        for (const r of atCols) { colMap[r.column_name] = r; }

        assertStrict(colMap['id'] && colMap['id'].data_type === 'uuid' && colMap['id'].is_nullable === 'NO' && colMap['id'].column_default === 'gen_random_uuid()', "id is UUID NOT NULL DEFAULT gen_random_uuid()");
        assertStrict(colMap['tenant_id'] && colMap['tenant_id'].data_type === 'uuid' && colMap['tenant_id'].is_nullable === 'NO' && colMap['tenant_id'].column_default === null, "tenant_id is UUID NOT NULL NO DEFAULT");
        assertStrict(
            colMap['display_label'] &&
            colMap['display_label'].data_type === 'character varying' &&
            colMap['display_label'].character_maximum_length === 255 &&
            colMap['display_label'].is_nullable === 'NO' &&
            colMap['display_label'].column_default === null,
            "display_label is VARCHAR(255) NOT NULL NO DEFAULT"
        );
        assertStrict(colMap['created_at'] && colMap['created_at'].data_type === 'timestamp with time zone' && colMap['created_at'].is_nullable === 'NO' && colMap['created_at'].column_default === 'CURRENT_TIMESTAMP', "created_at is TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP");

        // Finding B: Physical query on pg_constraint / pg_class / pg_namespace for primary key
        const atPkRes = await client.query(`
            SELECT
                c.conname,
                c.contype,
                pg_get_constraintdef(c.oid) AS def,
                (
                    SELECT array_agg(a.attname::text ORDER BY k.ord)
                    FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
                ) AS columns
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'secure_assessment_assessment_types'
              AND c.contype = 'p'
        `);
        assertStrict(atPkRes.rows.length === 1, "Exactly one primary key constraint exists on secure_assessment_assessment_types");
        assertStrict(atPkRes.rows[0].def === 'PRIMARY KEY (id)', `Primary key definition must be exactly PRIMARY KEY (id), got: ${atPkRes.rows[0].def}`);
        assertStrict(JSON.stringify(atPkRes.rows[0].columns) === JSON.stringify(['id']), "Primary key ordered column must be exactly ['id']");

        log("25. secure_assessment_assessment_types still has id UUID PRIMARY KEY (id), tenant_id, display_label VARCHAR(255), created_at contracts exact");

        // 26. uq_sa_assessment_types_tenant remains exact
        const uqRes = await client.query(`
            SELECT pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.conname = 'uq_sa_assessment_types_tenant'
        `);
        assertStrict(uqRes.rows.length === 1 && uqRes.rows[0].def === 'UNIQUE (id, tenant_id)', "uq_sa_assessment_types_tenant remains exact");
        log("26. uq_sa_assessment_types_tenant remains exact");

        // Finding C: ck_sa_assessment_types_display_label_non_blank remains exact CHECK with btrim semantics
        const ckRes = await client.query(`
            SELECT c.contype, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.conname = 'ck_sa_assessment_types_display_label_non_blank'
        `);
        assertStrict(ckRes.rows.length === 1, "ck_sa_assessment_types_display_label_non_blank exists");
        assertStrict(ckRes.rows[0].contype === 'c', "ck_sa_assessment_types_display_label_non_blank must be a CHECK constraint (contype = 'c')");
        assertStrict(ckRes.rows[0].def === "CHECK ((btrim((display_label)::text) <> ''::text))", `ck_sa_assessment_types_display_label_non_blank must have exact semantics: btrim(display_label) <> '', got: ${ckRes.rows[0].def}`);
        log("27. ck_sa_assessment_types_display_label_non_blank remains exact with btrim non-blank semantics");

        // 28. Assessment Type table still has ZERO foreign keys
        const atFkCount = await client.query(`
            SELECT COUNT(*) as c
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'secure_assessment_assessment_types' AND c.contype = 'f'
        `);
        assertStrict(parseInt(atFkCount.rows[0].c, 10) === 0, "Assessment Type table has ZERO foreign keys");
        log("28. Assessment Type table still has ZERO foreign keys");

        // Finding D: migration 0030 introduces ZERO Assessment Type seed rows and preserves Assessment Type schema immutability
        const postAtSchema = await getSchemaSnapshot(client, ['secure_assessment_assessment_types']);
        const postAtRowCount = parseInt((await client.query(`SELECT COUNT(*) as c FROM public.secure_assessment_assessment_types`)).rows[0].c, 10);
        assertStrict(postAtRowCount === preAtRowCount, "Assessment Type row count immediately before and after migration 0030 must be identical");
        assertStrict(JSON.stringify(preAtSchema) === JSON.stringify(postAtSchema), "Assessment Type schema/constraints/indexes must be completely immutable across migration 0030");
        assertStrict(postAtRowCount === 2, "Only the 2 test fixtures exist, zero seeds introduced by 0030");
        log("29. Migration 0030 introduces ZERO Assessment Type seed rows and preserves Assessment Type schema immutability");

        // 30. assessment_type_code remains absent
        const codeColCheck = await client.query(`
            SELECT COUNT(*) as c
            FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'assessment_type_code'
        `);
        assertStrict(parseInt(codeColCheck.rows[0].c, 10) === 0, "assessment_type_code remains absent");
        log("30. assessment_type_code remains absent");

        // =========================================================================
        // SECTION G: PREDECESSOR / PROTECTED STATE VERIFICATION
        // =========================================================================
        console.log("\n--- SECTION G: PREDECESSOR / PROTECTED STATE VERIFICATION ---");
        // 31. preserve Exam Instance existing physical contracts
        const eiCols = (await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances'
        `)).rows;
        const eiColMap = {};
        for (const r of eiCols) { eiColMap[r.column_name] = r; }

        assertStrict(eiColMap['teaching_assignment_id'] && eiColMap['teaching_assignment_id'].data_type === 'uuid', "teaching_assignment_id preserved");
        assertStrict(eiColMap['lifecycle_state'] && eiColMap['lifecycle_state'].data_type === 'text', "lifecycle_state preserved");
        assertStrict(eiColMap['window_starts_at'] && eiColMap['window_starts_at'].data_type === 'timestamp with time zone', "window_starts_at preserved");
        assertStrict(eiColMap['window_ends_at'] && eiColMap['window_ends_at'].data_type === 'timestamp with time zone', "window_ends_at preserved");
        assertStrict(eiColMap['configured_attempt_duration_seconds'] && eiColMap['configured_attempt_duration_seconds'].data_type === 'integer', "configured_attempt_duration_seconds preserved");
        assertStrict(eiColMap['latest_start_policy'] && eiColMap['latest_start_policy'].data_type === 'text', "latest_start_policy preserved");
        log("31. Preserve Exam Instance existing physical contracts");

        // 32. migration does not perform lifecycle transition
        const preExamRow = (await client.query(`SELECT lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`, [examIdPre])).rows[0];
        assertStrict(preExamRow.lifecycle_state === 'DRAFT', "Pre-existing Exam Instance lifecycle_state is unchanged ('DRAFT')");
        log("32. Migration does not perform lifecycle transition");

        // 33. protected Academic Core schema unchanged
        const postAcademicCoreSchema = await getSchemaSnapshot(client, protectedAcademicCoreTables);
        assertStrict(JSON.stringify(preAcademicCoreSchema) === JSON.stringify(postAcademicCoreSchema), "Academic Core schema must be unchanged");
        log("33. Protected Academic Core schema unchanged");

        // 34. protected Academic Core fixture data unchanged
        const postAcademicCoreData = await getAcademicCoreDataSnapshot(client, protectedAcademicCoreTables);
        assertStrict(JSON.stringify(preAcademicCoreData) === JSON.stringify(postAcademicCoreData), "Academic Core fixture data must be unchanged");
        log("34. Protected Academic Core fixture data unchanged");

    } catch (err) {
        caughtError = err;
        console.error("FAIL: Verification failed with error:", err);
    } finally {
        for (const c of openClients) {
            try { await c.end(); } catch (e) { console.error("Error closing client:", e); }
        }
        console.log("\n--- SECTION I: CLEANUP DISPOSABLE DATABASE ---");
        let teardownClient = null;
        try {
            teardownClient = new Client({ connectionString: adminUrl.toString() });
            await teardownClient.connect();
            await teardownClient.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [disposableDbName]);
            await teardownClient.query(`DROP DATABASE IF EXISTS "${disposableDbName}" WITH (FORCE)`);
            log("45. Disposable database cleanup PASS");

            const remRes = await teardownClient.query(`SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu059_%'`);
            if (remRes.rows.length > 0) {
                console.error("FAIL: Leaked disposable databases remaining:", remRes.rows.map(r => r.datname));
                cleanupFailed = true;
            } else {
                log("46. Zero leaked elligble_bu059_* databases");
            }
        } catch (e) {
            console.error("FAIL during teardown:", e);
            cleanupFailed = true;
        } finally {
            if (teardownClient) {
                try { await teardownClient.end(); } catch (e) {}
            }
        }

        if (caughtError || cleanupFailed) {
            process.exitCode = 1;
        } else {
            console.log("\n==================================================");
            console.log("BU-059 SECURE ASSESSMENT EXAM INSTANCE ASSESSMENT TYPE BINDING VERIFICATION PASS");
            console.log("ALL 46 ASSERTIONS PASS");
            console.log("==================================================");
        }
    }
}

runTest().catch(e => {
    console.error("UNHANDLED ROOT REJECTION:", e);
    process.exitCode = 1;
});
