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
    const TEST_DB = `elligble_bu056_${runId}`;

    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    const testUrl = new URL(dbUrl);
    testUrl.pathname = `/${TEST_DB}`;

    let databaseCreated = false;
    let setupClient = null;
    let mainClient = null;
    let caughtError = null;

    try {
        setupClient = new Client({ connectionString: adminUrl.toString() });
        await setupClient.connect();
        await setupClient.query(`CREATE DATABASE "${TEST_DB}"`);
        databaseCreated = true;
        await setupClient.end();
        setupClient = null;

        mainClient = new Client({ connectionString: testUrl.toString() });
        await mainClient.connect();

        const migrationsDir = path.resolve(__dirname, '../migrations');
        const allMigrationFiles = fs.readdirSync(migrationsDir)
            .filter(f => /^\d{4}_.*\.sql$/.test(f))
            .sort();

        // 1. Canonical migrations 0001 through 0026 applied first
        for (let i = 1; i <= 26; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await mainClient.query(sql);
        }
        log("Canonical migrations 0001-0026 applied");

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

        // Reusable deterministic schema snapshot helper
        const getSchemaSnapshot = async (tables) => {
            const data = {};
            for (const table of tables) {
                const schemaCols = (await mainClient.query(`
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = $1
                    ORDER BY column_name
                `, [table])).rows;

                const schemaConstraints = (await mainClient.query(`
                    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
                    FROM pg_constraint c
                    JOIN pg_class t ON c.conrelid = t.oid
                    JOIN pg_namespace n ON n.oid = t.relnamespace
                    WHERE t.relname = $1 AND n.nspname = 'public'
                    ORDER BY c.conname
                `, [table])).rows;

                const schemaIndexes = (await mainClient.query(`
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

        // Reusable deterministic row-data snapshot helper for Academic Core
        const getAcademicCoreDataSnapshot = async (tables) => {
            const data = {};
            for (const table of tables) {
                const rows = (await mainClient.query(`
                    SELECT *
                    FROM public.${table}
                    ORDER BY id
                `)).rows;
                data[table] = rows;
            }
            return data;
        };

        // 2. Create valid Academic Core fixture data BEFORE the PRE snapshot
        const t1 = (await mainClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const p1 = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const m1 = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, p1])).rows[0].id;
        const teacher1 = (await mainClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [t1, m1])).rows[0].id;

        const year1 = (await mainClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t1])).rows[0].id;
        const period1 = (await mainClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester 1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t1, year1])).rows[0].id;
        const subject1 = (await mainClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Mathematics') RETURNING id`, [t1])).rows[0].id;
        const grade1 = (await mainClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [t1])).rows[0].id;
        const group1 = (await mainClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [t1, year1, grade1])).rows[0].id;
        const offering1 = (await mainClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, subject1, period1, grade1])).rows[0].id;
        const ta1 = (await mainClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [t1, teacher1, offering1, group1])).rows[0].id;
        const enroll1 = (await mainClient.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU056_VERIFIER') RETURNING id`, [t1, m1, year1, group1, period1])).rows[0].id;
        log("Valid Academic Core fixture data created before PRE snapshot");

        // 3. Create valid pre-existing Exam Instance BEFORE migration 0027
        const preExamStarts = '2026-09-10T08:00:00Z';
        const preExamEnds = '2026-09-10T10:00:00Z';
        const exam1 = (await mainClient.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at)
            VALUES ($1, $2, 'DRAFT', $3, $4)
            RETURNING id, lifecycle_state, window_starts_at, window_ends_at, teaching_assignment_id, tenant_id
        `, [t1, ta1, preExamStarts, preExamEnds])).rows[0];
        assertStrict(exam1.lifecycle_state === 'DRAFT', "Pre-existing Exam Instance lifecycle_state is DRAFT");
        assertStrict(exam1.teaching_assignment_id === ta1, "Pre-existing Exam Instance teaching_assignment_id preserved");
        log("Pre-existing Exam Instance created before migration 0027 with lifecycle_state DRAFT");

        // 4. Capture PRE schema and row-data snapshots before migration 0027
        const preSecureAssessmentSchema = await getSchemaSnapshot(protectedSecureAssessmentSchemaTables);
        const preAcademicCoreSchema = await getSchemaSnapshot(protectedAcademicCoreTables);
        const preAcademicCoreData = await getAcademicCoreDataSnapshot(protectedAcademicCoreTables);
        log("PRE schema and row-data snapshots captured");

        // 5. Apply migration 0027
        const migration0027Files = allMigrationFiles.filter(f => f.startsWith('0027_'));
        assertStrict(migration0027Files.length === 1, "Exactly one 0027 migration file exists");
        const migration0027Sql = fs.readFileSync(path.join(migrationsDir, migration0027Files[0]), 'utf8');
        await mainClient.query(migration0027Sql);
        log("Migration 0027 applied");

        // 6. Verify exact canonical migration ID and history count reaches 27
        const exactMigrationId = '0027_bu056_secure_assessment_exam_instance_attempt_duration_configuration';
        const histRes1 = await mainClient.query(`
            SELECT migration_id
            FROM elligble_migration_history
            WHERE migration_id = $1
        `, [exactMigrationId]);
        assertStrict(histRes1.rows.length === 1, "Exact canonical migration ID exists exactly once in elligble_migration_history");

        const countRes1 = await mainClient.query(`
            SELECT COUNT(*) as c
            FROM elligble_migration_history
        `);
        assertStrict(parseInt(countRes1.rows[0].c, 10) === 27, "Migration history count reaches exactly 27");
        log("Exact canonical migration ID and history count = 27 proven");

        // 7. Column physical contract: configured_attempt_duration_seconds INTEGER NULL, no default
        const colRes = await mainClient.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'secure_assessment_exam_instances'
              AND column_name = 'configured_attempt_duration_seconds'
        `);
        assertStrict(colRes.rows.length === 1, "Column configured_attempt_duration_seconds exists");
        const col = colRes.rows[0];
        assertStrict(col.data_type === 'integer', "configured_attempt_duration_seconds physical type is integer");
        assertStrict(col.is_nullable === 'YES', "configured_attempt_duration_seconds is nullable YES");
        assertStrict(col.column_default === null, "configured_attempt_duration_seconds has no default");
        log("Physical column configured_attempt_duration_seconds (INTEGER, nullable, no default) proven");

        // 8. Exact constraint contract: ck_sa_exam_instances_attempt_duration_positive
        const conRes = await mainClient.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE t.relname = 'secure_assessment_exam_instances'
              AND n.nspname = 'public'
              AND c.conname = 'ck_sa_exam_instances_attempt_duration_positive'
        `);
        assertStrict(conRes.rows.length === 1, "Constraint ck_sa_exam_instances_attempt_duration_positive exists");
        log("Exact constraint ck_sa_exam_instances_attempt_duration_positive proven");

        // 9. Pre-existing Exam Instance duration becomes/remains NULL and attributes preserved
        const existingRow = (await mainClient.query(`
            SELECT id, tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds
            FROM public.secure_assessment_exam_instances
            WHERE id = $1
        `, [exam1.id])).rows[0];
        assertStrict(existingRow.configured_attempt_duration_seconds === null, "Pre-existing Exam Instance duration is NULL");
        assertStrict(existingRow.lifecycle_state === 'DRAFT', "Pre-existing Exam Instance lifecycle_state is preserved as DRAFT");
        assertStrict(new Date(existingRow.window_starts_at).toISOString() === new Date(preExamStarts).toISOString(), "Pre-existing Exam Instance window_starts_at preserved");
        assertStrict(new Date(existingRow.window_ends_at).toISOString() === new Date(preExamEnds).toISOString(), "Pre-existing Exam Instance window_ends_at preserved");
        assertStrict(existingRow.tenant_id === t1, "Pre-existing Exam Instance tenant_id preserved");
        assertStrict(existingRow.teaching_assignment_id === ta1, "Pre-existing Exam Instance teaching_assignment_id preserved");
        log("Pre-existing Exam Instance NULL duration and preservation of lifecycle/window/tenant/TA proven");

        // 10. Repeat execution safety: execute migration 0027 again
        await mainClient.query(migration0027Sql);
        const histRes2 = await mainClient.query(`
            SELECT 1
            FROM elligble_migration_history
            WHERE migration_id = $1
        `, [exactMigrationId]);
        assertStrict(histRes2.rows.length === 1, "Repeat execution did not duplicate migration history row for exact ID");

        const countRes2 = await mainClient.query(`
            SELECT COUNT(*) as c
            FROM elligble_migration_history
        `);
        assertStrict(parseInt(countRes2.rows[0].c, 10) === 27, "Migration history count remains exactly 27 after repeat");

        const colCountAfterRepeat = (await mainClient.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'secure_assessment_exam_instances'
              AND column_name = 'configured_attempt_duration_seconds'
        `)).rows.length;
        assertStrict(colCountAfterRepeat === 1, "configured_attempt_duration_seconds column exists only once after repeat");

        const conCountAfterRepeat = (await mainClient.query(`
            SELECT conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE t.relname = 'secure_assessment_exam_instances'
              AND n.nspname = 'public'
              AND c.conname = 'ck_sa_exam_instances_attempt_duration_positive'
        `)).rows.length;
        assertStrict(conCountAfterRepeat === 1, "ck_sa_exam_instances_attempt_duration_positive constraint exists only once after repeat");
        log("Migration 0027 repeat execution safety proven");

        // 11. Persistence verification: NULL duration is valid
        const examNull = (await mainClient.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', NULL)
            RETURNING id, configured_attempt_duration_seconds, lifecycle_state
        `, [t1, ta1])).rows[0];
        assertStrict(examNull.configured_attempt_duration_seconds === null, "NULL duration is valid on insertion");
        assertStrict(examNull.lifecycle_state === 'DRAFT', "NULL duration insertion preserves DRAFT lifecycle_state");
        log("NULL duration validity and lifecycle preservation proven");

        // 12. Persistence verification: Positive duration succeeds and does not alter lifecycle
        const examPos = (await mainClient.query(`
            INSERT INTO public.secure_assessment_exam_instances
                (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds)
            VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 3600)
            RETURNING id, configured_attempt_duration_seconds, lifecycle_state
        `, [t1, ta1])).rows[0];
        assertStrict(examPos.configured_attempt_duration_seconds === 3600, "Positive duration (3600) persisted correctly");
        assertStrict(examPos.lifecycle_state === 'DRAFT', "Positive duration insertion preserves DRAFT lifecycle_state");
        log("Positive duration persistence and lifecycle preservation proven");

        // 13. Persistence verification: Updating duration does not transition lifecycle
        const updatedDuration = (await mainClient.query(`
            UPDATE public.secure_assessment_exam_instances
            SET configured_attempt_duration_seconds = 7200
            WHERE id = $1
            RETURNING id, configured_attempt_duration_seconds, lifecycle_state
        `, [examNull.id])).rows[0];
        assertStrict(updatedDuration.configured_attempt_duration_seconds === 7200, "Updated duration persisted correctly");
        assertStrict(updatedDuration.lifecycle_state === 'DRAFT', "Updating duration does not automatically transition lifecycle_state (remains DRAFT)");
        log("Duration update does not automatically transition lifecycle proven");

        // 14. Persistence verification: Zero duration is rejected with SQLSTATE 23514 and ck_sa_exam_instances_attempt_duration_positive
        let caughtZero = false;
        try {
            await mainClient.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds)
                VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', 0)
            `, [t1, ta1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Zero duration rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_attempt_duration_positive', "Zero duration rejection yields exact constraint ck_sa_exam_instances_attempt_duration_positive");
            caughtZero = true;
        }
        assertStrict(caughtZero, "Zero duration rejected with SQLSTATE 23514 and ck_sa_exam_instances_attempt_duration_positive");
        log("Zero duration 23514 rejection with exact constraint proven");

        // 15. Persistence verification: Negative duration is rejected with SQLSTATE 23514 and ck_sa_exam_instances_attempt_duration_positive
        let caughtNeg = false;
        try {
            await mainClient.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds)
                VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '2 hours', -100)
            `, [t1, ta1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Negative duration rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_attempt_duration_positive', "Negative duration rejection yields exact constraint ck_sa_exam_instances_attempt_duration_positive");
            caughtNeg = true;
        }
        assertStrict(caughtNeg, "Negative duration rejected with SQLSTATE 23514 and ck_sa_exam_instances_attempt_duration_positive");
        log("Negative duration 23514 rejection with exact constraint proven");

        // 16. Preserve BU-053 lifecycle persistence contract and all 8 allowed states
        const instanceCols = (await mainClient.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'secure_assessment_exam_instances'
        `)).rows;

        const lifecycleCol = instanceCols.find(c => c.column_name === 'lifecycle_state');
        assertStrict(!!lifecycleCol, "lifecycle_state column preserved");
        assertStrict(lifecycleCol.data_type === 'text', "lifecycle_state is TEXT");
        assertStrict(lifecycleCol.is_nullable === 'NO', "lifecycle_state is NOT NULL");
        assertStrict(lifecycleCol.column_default === "'DRAFT'::text", "lifecycle_state default is 'DRAFT'::text");

        const instanceConstraints = (await mainClient.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE t.relname = 'secure_assessment_exam_instances'
              AND n.nspname = 'public'
        `)).rows;

        const lifecycleCon = instanceConstraints.find(c => c.conname === 'ck_sa_exam_instances_lifecycle_state');
        assertStrict(!!lifecycleCon, "ck_sa_exam_instances_lifecycle_state constraint preserved");

        const allowedStates = ['DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED'];
        for (const state of allowedStates) {
            await mainClient.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, lifecycle_state)
                VALUES ($1, $2)
            `, [t1, state]);
        }
        log("BU-053 lifecycle persistence contract and all 8 allowed states preserved");

        // 17. Preserve BU-054 window pair and window order constraints and active enforcement
        const pairCon = instanceConstraints.find(c => c.conname === 'ck_sa_exam_instances_window_pair');
        const orderCon = instanceConstraints.find(c => c.conname === 'ck_sa_exam_instances_window_order');
        assertStrict(!!pairCon, "ck_sa_exam_instances_window_pair constraint preserved");
        assertStrict(!!orderCon, "ck_sa_exam_instances_window_order constraint preserved");

        let windowPairRejected = false;
        try {
            await mainClient.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, window_starts_at, window_ends_at)
                VALUES ($1, NOW(), NULL)
            `, [t1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Partial window rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_window_pair', "Partial window rejection yields ck_sa_exam_instances_window_pair");
            windowPairRejected = true;
        }
        assertStrict(windowPairRejected, "BU-054 ck_sa_exam_instances_window_pair enforcement proven intact");

        let windowOrderRejected = false;
        try {
            await mainClient.query(`
                INSERT INTO public.secure_assessment_exam_instances
                    (tenant_id, window_starts_at, window_ends_at)
                VALUES ($1, NOW() + interval '2 hours', NOW())
            `, [t1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Inverted window rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_window_order', "Inverted window rejection yields ck_sa_exam_instances_window_order");
            windowOrderRejected = true;
        }
        assertStrict(windowOrderRejected, "BU-054 ck_sa_exam_instances_window_order enforcement proven intact");
        log("BU-054 window constraints preservation and enforcement proven");

        // 18. Capture POST schema snapshots and prove strict equality on protected tables
        const postSecureAssessmentSchema = await getSchemaSnapshot(protectedSecureAssessmentSchemaTables);
        const postAcademicCoreSchema = await getSchemaSnapshot(protectedAcademicCoreTables);

        for (const table of protectedSecureAssessmentSchemaTables) {
            assertStrict(
                JSON.stringify(preSecureAssessmentSchema[table]) === JSON.stringify(postSecureAssessmentSchema[table]),
                `Protected Secure Assessment table schema mutated: ${table}`
            );
        }
        log("Protected Secure Assessment schema immutability proven across all 5 tables");

        for (const table of protectedAcademicCoreTables) {
            assertStrict(
                JSON.stringify(preAcademicCoreSchema[table]) === JSON.stringify(postAcademicCoreSchema[table]),
                `Protected Academic Core table schema mutated: ${table}`
            );
        }
        log("Protected Academic Core schema immutability proven across all 8 tables");

        // 19. Capture POST row-data snapshot and prove strict equality for Academic Core tables
        const postAcademicCoreData = await getAcademicCoreDataSnapshot(protectedAcademicCoreTables);

        for (const table of protectedAcademicCoreTables) {
            assertStrict(
                JSON.stringify(preAcademicCoreData[table]) === JSON.stringify(postAcademicCoreData[table]),
                `Academic Core row-data mutated for table: ${table}`
            );
        }
        log("Academic Core row-data immutability proven across all 8 tables");

    } catch (e) {
        caughtError = e;
        console.error("FAIL:", e);
    } finally {
        let cleanupFailed = false;

        const attemptClose = async (resource) => {
            if (resource) {
                try {
                    await resource.end();
                } catch (e) {
                    console.error("FAIL: RESOURCE CLOSE ERROR", e);
                    cleanupFailed = true;
                }
            }
        };

        await attemptClose(setupClient);
        await attemptClose(mainClient);

        if (databaseCreated) {
            const teardownClient = new Client({ connectionString: adminUrl.toString() });
            try {
                await teardownClient.connect();
                await teardownClient.query(`
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = $1 AND pid <> pg_backend_pid()
                `, [TEST_DB]);
                await teardownClient.query(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`);
            } catch (e) {
                console.error("FAIL: DB CLEANUP ERROR", e);
                cleanupFailed = true;
            } finally {
                await attemptClose(teardownClient);
            }
        }

        if (caughtError || cleanupFailed) {
            process.exitCode = 1;
        } else {
            console.log(`\nBU-056 ATTEMPT DURATION CONFIGURATION PERSISTENCE VERIFICATION PASS (${TEST_DB})`);
        }
    }
}

runTest().catch(e => {
    console.error("UNHANDLED ROOT REJECTION:", e);
    process.exitCode = 1;
});
