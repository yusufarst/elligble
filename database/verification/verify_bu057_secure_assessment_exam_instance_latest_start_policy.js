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

    const migration0028Files = allMigrationFiles.filter(f => f.startsWith('0028_'));
    assertStrict(migration0028Files.length === 1, "Exactly one 0028 migration file exists");
    const migration0028Sql = fs.readFileSync(path.join(migrationsDir, migration0028Files[0]), 'utf8');
    const exactMigrationId = '0028_bu057_secure_assessment_exam_instance_latest_start_policy';

    const createdDatabases = [];
    const openClients = [];
    let caughtError = null;

    const createDisposableDb = async (dbSuffix) => {
        const dbName = `elligble_bu057_${runId}_${dbSuffix}`;
        const setupClient = new Client({ connectionString: adminUrl.toString() });
        await setupClient.connect();
        await setupClient.query(`CREATE DATABASE "${dbName}"`);
        await setupClient.end();
        createdDatabases.push(dbName);

        const targetUrl = new URL(dbUrl);
        targetUrl.pathname = `/${dbName}`;
        const client = new Client({ connectionString: targetUrl.toString() });
        await client.connect();
        openClients.push(client);
        return { client, dbName };
    };

    const applyMigrations0001To0027 = async (client) => {
        for (let i = 1; i <= 27; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await client.query(sql);
        }
    };

    // Protected table definitions for schema snapshots
    const protectedSecureAssessmentSchemaTables = [
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
        // =========================================================================
        // SCENARIO 1 — CLEAN CANONICAL APPLY
        // =========================================================================
        console.log("\n--- EXECUTING SCENARIO 1: CLEAN CANONICAL APPLY ---");
        const { client: client1, dbName: db1 } = await createDisposableDb('s1');
        await applyMigrations0001To0027(client1);
        log("Scenario 1: Canonical migrations 0001-0027 applied");

        // Fixtures
        const t1 = (await client1.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const p1 = (await client1.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const m1 = (await client1.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, p1])).rows[0].id;
        const teacher1 = (await client1.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [t1, m1])).rows[0].id;

        const year1 = (await client1.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t1])).rows[0].id;
        const period1 = (await client1.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester 1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t1, year1])).rows[0].id;
        const subject1 = (await client1.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Mathematics') RETURNING id`, [t1])).rows[0].id;
        const grade1 = (await client1.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [t1])).rows[0].id;
        const group1 = (await client1.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [t1, year1, grade1])).rows[0].id;
        const offering1 = (await client1.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, subject1, period1, grade1])).rows[0].id;
        const ta1 = (await client1.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, teacher1, offering1, group1])).rows[0].id;
        await client1.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU057_VERIFIER') RETURNING id`, [t1, m1, year1, group1, period1]);

        // Pre-existing Exam Instance before 0028
        const preExamStarts = '2026-09-10T08:00:00Z';
        const preExamEnds = '2026-09-10T10:00:00Z';
        const exam1 = (await client1.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds)
            VALUES ($1, $2, 'DRAFT', $3, $4, 3600)
            RETURNING id, lifecycle_state, window_starts_at, window_ends_at, teaching_assignment_id, tenant_id, configured_attempt_duration_seconds
        `, [t1, ta1, preExamStarts, preExamEnds])).rows[0];

        // PRE snapshots
        const preSecureAssessmentSchema = await getSchemaSnapshot(client1, protectedSecureAssessmentSchemaTables);
        const preAcademicCoreSchema = await getSchemaSnapshot(client1, protectedAcademicCoreTables);
        const preAcademicCoreData = await getAcademicCoreDataSnapshot(client1, protectedAcademicCoreTables);

        // Apply corrected 0028
        await client1.query(migration0028Sql);
        log("Scenario 1: Corrected migration 0028 applied successfully");

        // Prove migration history = exactly 28 and exact ID
        const histRes1 = await client1.query(`SELECT migration_id FROM elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(histRes1.rows.length === 1, "Exact canonical migration ID exists exactly once");
        const countRes1 = await client1.query(`SELECT COUNT(*) as c FROM elligble_migration_history`);
        assertStrict(parseInt(countRes1.rows[0].c, 10) === 28, "Migration history count reaches exactly 28");
        log("Scenario 1: Migration history = exactly 28 with exact ID proven");

        // Physical column contract: TEXT NULL, no default
        const colRes1 = await client1.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'secure_assessment_exam_instances'
              AND column_name = 'latest_start_policy'
        `);
        assertStrict(colRes1.rows.length === 1, "Column latest_start_policy exists");
        const col1 = colRes1.rows[0];
        assertStrict(col1.data_type === 'text', "latest_start_policy physical type is text");
        assertStrict(col1.is_nullable === 'YES', "latest_start_policy is nullable YES");
        assertStrict(col1.column_default === null, "latest_start_policy has no default");
        log("Scenario 1: Column latest_start_policy (TEXT, nullable YES, no default) proven");

        // Exact constraint exists
        const conRes1 = await client1.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE t.relname = 'secure_assessment_exam_instances'
              AND n.nspname = 'public'
              AND c.conname = 'ck_sa_exam_instances_latest_start_policy'
        `);
        assertStrict(conRes1.rows.length === 1, "Constraint ck_sa_exam_instances_latest_start_policy exists");
        log("Scenario 1: Exact constraint ck_sa_exam_instances_latest_start_policy proven");

        // Pre-existing row policy is NULL and other fields intact
        const existingRow = (await client1.query(`
            SELECT id, tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
            FROM public.secure_assessment_exam_instances
            WHERE id = $1
        `, [exam1.id])).rows[0];
        assertStrict(existingRow.latest_start_policy === null, "Pre-existing Exam Instance policy is NULL");
        assertStrict(existingRow.configured_attempt_duration_seconds === 3600, "Pre-existing duration preserved");
        assertStrict(existingRow.lifecycle_state === 'DRAFT', "Pre-existing lifecycle_state preserved as DRAFT");
        log("Scenario 1: Pre-existing instance NULL policy and attribute preservation proven");

        // Policy values: NULL accepted
        const rowNull = (await client1.query(`
            INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', NULL)
            RETURNING id, latest_start_policy, lifecycle_state
        `, [t1, ta1])).rows[0];
        assertStrict(rowNull.latest_start_policy === null, "NULL policy accepted");

        // FULL_DURATION_BEYOND_WINDOW accepted
        const rowFull = (await client1.query(`
            INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 'FULL_DURATION_BEYOND_WINDOW')
            RETURNING id, latest_start_policy, lifecycle_state
        `, [t1, ta1])).rows[0];
        assertStrict(rowFull.latest_start_policy === 'FULL_DURATION_BEYOND_WINDOW', "FULL_DURATION_BEYOND_WINDOW policy accepted");

        // REMAINING_WINDOW_ONLY accepted
        const rowRem = (await client1.query(`
            INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 'REMAINING_WINDOW_ONLY')
            RETURNING id, latest_start_policy, lifecycle_state
        `, [t1, ta1])).rows[0];
        assertStrict(rowRem.latest_start_policy === 'REMAINING_WINDOW_ONLY', "REMAINING_WINDOW_ONLY policy accepted");

        // LATE_START_BLOCKED accepted
        const rowBlock = (await client1.query(`
            INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, latest_start_policy)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 'LATE_START_BLOCKED')
            RETURNING id, latest_start_policy, lifecycle_state
        `, [t1, ta1])).rows[0];
        assertStrict(rowBlock.latest_start_policy === 'LATE_START_BLOCKED', "LATE_START_BLOCKED policy accepted");
        log("Scenario 1: All three exact policy values and NULL accepted");

        // No lifecycle mutation on policy update
        const updatedRow = (await client1.query(`
            UPDATE public.secure_assessment_exam_instances
            SET latest_start_policy = 'FULL_DURATION_BEYOND_WINDOW'
            WHERE id = $1
            RETURNING id, latest_start_policy, lifecycle_state
        `, [rowNull.id])).rows[0];
        assertStrict(updatedRow.lifecycle_state === 'DRAFT', "Updating policy does not mutate lifecycle_state");
        log("Scenario 1: No lifecycle mutation on policy update proven");

        // Unsupported value rejected with 23514 and ck_sa_exam_instances_latest_start_policy
        let caughtUnsupported = false;
        try {
            await client1.query(`
                INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, latest_start_policy)
                VALUES ($1, $2, 'DRAFT', 'INVALID_POLICY')
            `, [t1, ta1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Unsupported policy rejected with 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_latest_start_policy', "Constraint name matches");
            caughtUnsupported = true;
        }
        assertStrict(caughtUnsupported, "Unsupported policy rejected");
        log("Scenario 1: Unsupported policy rejected with exact constraint proven");

        // BU-053 lifecycle preserved
        const allowedStates = ['DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED'];
        for (const state of allowedStates) {
            await client1.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, lifecycle_state) VALUES ($1, $2)`, [t1, state]);
        }
        log("Scenario 1: BU-053 lifecycle preserved across all 8 states");

        // BU-054 window pair preserved
        let caughtPair = false;
        try {
            await client1.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, window_starts_at, window_ends_at) VALUES ($1, NOW(), NULL)`, [t1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Partial window rejected with 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_window_pair', "ck_sa_exam_instances_window_pair enforced");
            caughtPair = true;
        }
        assertStrict(caughtPair, "Partial window rejected");
        log("Scenario 1: BU-054 window constraints preserved and enforced");

        // BU-056 regression: configured_attempt_duration_seconds: NULL accepted, positive accepted, zero rejected, negative rejected
        const durNull = (await client1.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, configured_attempt_duration_seconds) VALUES ($1, NULL) RETURNING id, configured_attempt_duration_seconds`, [t1])).rows[0];
        assertStrict(durNull.configured_attempt_duration_seconds === null, "NULL duration accepted");
        const durPos = (await client1.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, configured_attempt_duration_seconds) VALUES ($1, 7200) RETURNING id, configured_attempt_duration_seconds`, [t1])).rows[0];
        assertStrict(durPos.configured_attempt_duration_seconds === 7200, "Positive duration accepted");

        let caughtZero = false;
        try {
            await client1.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, configured_attempt_duration_seconds) VALUES ($1, 0)`, [t1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Zero duration rejected with 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_attempt_duration_positive', "ck_sa_exam_instances_attempt_duration_positive enforced");
            caughtZero = true;
        }
        assertStrict(caughtZero, "Zero duration rejected");

        let caughtNeg = false;
        try {
            await client1.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, configured_attempt_duration_seconds) VALUES ($1, -100)`, [t1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Negative duration rejected with 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_attempt_duration_positive', "ck_sa_exam_instances_attempt_duration_positive enforced");
            caughtNeg = true;
        }
        assertStrict(caughtNeg, "Negative duration rejected");
        log("Scenario 1: BU-056 regression passed (NULL/positive accepted, zero/negative rejected, constraint intact)");

        // Protected schema & data immutability
        const postSecureAssessmentSchema = await getSchemaSnapshot(client1, protectedSecureAssessmentSchemaTables);
        const postAcademicCoreSchema = await getSchemaSnapshot(client1, protectedAcademicCoreTables);
        const postAcademicCoreData = await getAcademicCoreDataSnapshot(client1, protectedAcademicCoreTables);

        for (const table of protectedSecureAssessmentSchemaTables) {
            assertStrict(JSON.stringify(preSecureAssessmentSchema[table]) === JSON.stringify(postSecureAssessmentSchema[table]), `Protected SA table schema mutated: ${table}`);
        }
        for (const table of protectedAcademicCoreTables) {
            assertStrict(JSON.stringify(preAcademicCoreSchema[table]) === JSON.stringify(postAcademicCoreSchema[table]), `Protected Academic Core schema mutated: ${table}`);
            assertStrict(JSON.stringify(preAcademicCoreData[table]) === JSON.stringify(postAcademicCoreData[table]), `Academic Core data mutated: ${table}`);
        }
        log("Scenario 1: Protected Secure Assessment and Academic Core schemas and data immutability proven");

        // =========================================================================
        // SCENARIO 2 — EXACT REPEAT
        // =========================================================================
        console.log("\n--- EXECUTING SCENARIO 2: EXACT REPEAT ---");
        // Run corrected 0028 again on client1
        await client1.query(migration0028Sql);

        const histRes2 = await client1.query(`SELECT migration_id FROM elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(histRes2.rows.length === 1, "Repeat execution did not duplicate migration history row");
        const countRes2 = await client1.query(`SELECT COUNT(*) as c FROM elligble_migration_history`);
        assertStrict(parseInt(countRes2.rows[0].c, 10) === 28, "Migration history count stays exactly 28");

        const colCountAfterRepeat = (await client1.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances' AND column_name = 'latest_start_policy'
        `)).rows.length;
        assertStrict(colCountAfterRepeat === 1, "latest_start_policy column not duplicated");

        const conCountAfterRepeat = (await client1.query(`
            SELECT conname FROM pg_constraint
            WHERE conname = 'ck_sa_exam_instances_latest_start_policy'
        `)).rows.length;
        assertStrict(conCountAfterRepeat === 1, "ck_sa_exam_instances_latest_start_policy constraint not duplicated");
        log("Scenario 2: Exact repeat safety proven (no duplication, history stays exactly 28)");

        // =========================================================================
        // SCENARIO 3 — COMPATIBLE PARTIAL STATE
        // =========================================================================
        console.log("\n--- EXECUTING SCENARIO 3: COMPATIBLE PARTIAL STATE ---");
        const { client: client3 } = await createDisposableDb('s3');
        await applyMigrations0001To0027(client3);

        // Manually create exact column, leave constraint absent, leave migration history absent
        await client3.query(`ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN latest_start_policy TEXT NULL`);
        const preConCount3 = (await client3.query(`SELECT 1 FROM pg_constraint WHERE conname = 'ck_sa_exam_instances_latest_start_policy'`)).rows.length;
        assertStrict(preConCount3 === 0, "Constraint absent initially in Scenario 3");
        const preHistCount3 = (await client3.query(`SELECT 1 FROM elligble_migration_history WHERE migration_id = $1`, [exactMigrationId])).rows.length;
        assertStrict(preHistCount3 === 0, "Migration history absent initially in Scenario 3");

        // Run corrected 0028
        await client3.query(migration0028Sql);

        // Prove converged successfully: constraint added, history registered once, total history = 28
        const postConCount3 = (await client3.query(`SELECT 1 FROM pg_constraint WHERE conname = 'ck_sa_exam_instances_latest_start_policy'`)).rows.length;
        assertStrict(postConCount3 === 1, "Constraint ck_sa_exam_instances_latest_start_policy successfully added during convergence");
        const postHist3 = await client3.query(`SELECT migration_id FROM elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(postHist3.rows.length === 1, "Exact migration history row registered once in Scenario 3");
        const totalHist3 = await client3.query(`SELECT COUNT(*) as c FROM elligble_migration_history`);
        assertStrict(parseInt(totalHist3.rows[0].c, 10) === 28, "Total history reaches 28 in Scenario 3");

        // Verify constraint actively enforces in converged state
        const t3 = (await client3.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        await client3.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, latest_start_policy) VALUES ($1, 'FULL_DURATION_BEYOND_WINDOW')`, [t3]);
        let caughtCon3 = false;
        try {
            await client3.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, latest_start_policy) VALUES ($1, 'INVALID_VALUE')`, [t3]);
        } catch (e) {
            assertStrict(e.code === '23514', "Converged constraint rejects invalid value with 23514");
            caughtCon3 = true;
        }
        assertStrict(caughtCon3, "Invalid value rejected in Scenario 3");
        log("Scenario 3: Compatible partial state converged successfully and registered history once");

        // =========================================================================
        // SCENARIO 4 — WRONG COLUMN TYPE
        // =========================================================================
        console.log("\n--- EXECUTING SCENARIO 4: WRONG COLUMN TYPE ---");
        const { client: client4 } = await createDisposableDb('s4');
        await applyMigrations0001To0027(client4);

        // Incompatible column type
        await client4.query(`ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN latest_start_policy VARCHAR(100) NULL`);

        let caughtErr4 = false;
        try {
            await client4.query(migration0028Sql);
        } catch (e) {
            assertStrict(e.message.includes('MIGRATION REJECTED'), `Exception must reject loudly: ${e.message}`);
            caughtErr4 = true;
        }
        assertStrict(caughtErr4, "Migration 0028 must FAIL LOUDLY on incompatible column type");

        // Verify history NOT registered
        const hist4 = await client4.query(`SELECT 1 FROM elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(hist4.rows.length === 0, "Migration history must NOT be registered on wrong column type");
        const totalHist4 = await client4.query(`SELECT COUNT(*) as c FROM elligble_migration_history`);
        assertStrict(parseInt(totalHist4.rows[0].c, 10) === 27, "Migration history count remains 27");
        log("Scenario 4: Wrong column type rejected loudly without recording history");

        // =========================================================================
        // SCENARIO 5 — WRONG NULLABILITY OR DEFAULT
        // =========================================================================
        console.log("\n--- EXECUTING SCENARIO 5: WRONG NULLABILITY OR DEFAULT ---");
        const { client: client5 } = await createDisposableDb('s5');
        await applyMigrations0001To0027(client5);

        // Incompatible physical contract: NOT NULL with default
        await client5.query(`ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN latest_start_policy TEXT NOT NULL DEFAULT 'REMAINING_WINDOW_ONLY'`);

        let caughtErr5 = false;
        try {
            await client5.query(migration0028Sql);
        } catch (e) {
            assertStrict(e.message.includes('MIGRATION REJECTED'), `Exception must reject loudly: ${e.message}`);
            caughtErr5 = true;
        }
        assertStrict(caughtErr5, "Migration 0028 must FAIL LOUDLY on incompatible nullability/default");

        const hist5 = await client5.query(`SELECT 1 FROM elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(hist5.rows.length === 0, "Migration history must NOT be registered on wrong nullability/default");
        const totalHist5 = await client5.query(`SELECT COUNT(*) as c FROM elligble_migration_history`);
        assertStrict(parseInt(totalHist5.rows[0].c, 10) === 27, "Migration history count remains 27");
        log("Scenario 5: Wrong nullability/default rejected loudly without recording history");

        // =========================================================================
        // SCENARIO 6 — WRONG SAME-NAME CONSTRAINT
        // =========================================================================
        console.log("\n--- EXECUTING SCENARIO 6: WRONG SAME-NAME CONSTRAINT ---");
        const { client: client6 } = await createDisposableDb('s6');
        await applyMigrations0001To0027(client6);

        // Create exact column, but create constraint with wrong allowed values
        await client6.query(`ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN latest_start_policy TEXT NULL`);
        await client6.query(`ALTER TABLE public.secure_assessment_exam_instances ADD CONSTRAINT ck_sa_exam_instances_latest_start_policy CHECK (latest_start_policy IN ('WRONG_VALUE_ONLY'))`);

        let caughtErr6 = false;
        try {
            await client6.query(migration0028Sql);
        } catch (e) {
            assertStrict(e.message.includes('MIGRATION REJECTED'), `Exception must reject loudly: ${e.message}`);
            caughtErr6 = true;
        }
        assertStrict(caughtErr6, "Migration 0028 must FAIL LOUDLY on wrong same-name constraint semantics");

        const hist6 = await client6.query(`SELECT 1 FROM elligble_migration_history WHERE migration_id = $1`, [exactMigrationId]);
        assertStrict(hist6.rows.length === 0, "Migration history must NOT be registered on wrong constraint semantics");
        const totalHist6 = await client6.query(`SELECT COUNT(*) as c FROM elligble_migration_history`);
        assertStrict(parseInt(totalHist6.rows[0].c, 10) === 27, "Migration history count remains 27");
        log("Scenario 6: Wrong same-name constraint rejected loudly without recording history");

        // =========================================================================
        // SCENARIO 7 — HISTORY CLAIMS APPLIED BUT SCHEMA INVALID
        // =========================================================================
        console.log("\n--- EXECUTING SCENARIO 7: HISTORY CLAIMS APPLIED BUT SCHEMA INVALID ---");
        const { client: client7 } = await createDisposableDb('s7');
        await applyMigrations0001To0027(client7);

        // Subcase 7a: History exists, but column and constraint absent
        await client7.query(`INSERT INTO public.elligble_migration_history (migration_id) VALUES ($1)`, [exactMigrationId]);

        let caughtErr7a = false;
        try {
            await client7.query(migration0028Sql);
        } catch (e) {
            assertStrict(e.message.includes('MIGRATION REJECTED'), `Exception must reject loudly: ${e.message}`);
            caughtErr7a = true;
        }
        assertStrict(caughtErr7a, "Migration 0028 must FAIL LOUDLY when history exists but schema is absent");
        log("Scenario 7a: False history with absent schema rejected loudly");

        // Subcase 7b: History exists, column exists, but constraint is missing
        await client7.query(`ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN latest_start_policy TEXT NULL`);
        let caughtErr7b = false;
        try {
            await client7.query(migration0028Sql);
        } catch (e) {
            assertStrict(e.message.includes('MIGRATION REJECTED'), `Exception must reject loudly: ${e.message}`);
            caughtErr7b = true;
        }
        assertStrict(caughtErr7b, "Migration 0028 must FAIL LOUDLY when history exists but constraint is missing");
        log("Scenario 7b: False history with missing constraint rejected loudly");

        // Subcase 7c: History exists, column has wrong type
        await client7.query(`ALTER TABLE public.secure_assessment_exam_instances DROP COLUMN latest_start_policy`);
        await client7.query(`ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN latest_start_policy VARCHAR(50) NULL`);
        let caughtErr7c = false;
        try {
            await client7.query(migration0028Sql);
        } catch (e) {
            assertStrict(e.message.includes('MIGRATION REJECTED'), `Exception must reject loudly: ${e.message}`);
            caughtErr7c = true;
        }
        assertStrict(caughtErr7c, "Migration 0028 must FAIL LOUDLY when history exists but column type is wrong");
        log("Scenario 7c: False history with incompatible column type rejected loudly");
        log("Scenario 7: All false history / invalid schema subcases rejected loudly");

    } catch (e) {
        caughtError = e;
        console.error("FAIL:", e);
    } finally {
        // Teardown: close all open clients
        for (const client of openClients) {
            try {
                await client.end();
            } catch (e) {
                console.error("Error closing client:", e);
            }
        }

        // Teardown: drop all created disposable databases
        let teardownClient = null;
        let cleanupFailed = false;
        let remainingDbs = [];

        try {
            teardownClient = new Client({ connectionString: adminUrl.toString() });
            await teardownClient.connect();

            for (const dbName of createdDatabases) {
                await teardownClient.query(`
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = $1 AND pid <> pg_backend_pid()
                `, [dbName]);
                await teardownClient.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
            }

            // Verify cleanup count
            const resRemaining = await teardownClient.query(`
                SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu057_%'
            `);
            remainingDbs = resRemaining.rows.map(r => r.datname);
            if (remainingDbs.length > 0) {
                console.error("FAIL: Leaked disposable databases remaining:", remainingDbs);
                cleanupFailed = true;
            } else {
                log("Disposable database cleanup complete: 0 remaining");
            }
        } catch (e) {
            console.error("FAIL during disposable DB teardown:", e);
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
            console.log("\nBU-057 LATEST START POLICY PERSISTENCE VERIFICATION PASS (ALL 7 SCENARIOS)");
        }
    }
}

runTest().catch(e => {
    console.error("UNHANDLED ROOT REJECTION:", e);
    process.exitCode = 1;
});
