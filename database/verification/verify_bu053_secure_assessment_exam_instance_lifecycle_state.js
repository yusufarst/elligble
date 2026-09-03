const { Client } = require('../../runtime/secure-assessment/node_modules/pg');
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
    const TEST_DB = `elligble_bu053_${runId}`;

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

        // 1. Canonical migrations 0001 through 0024
        for (let i = 1; i <= 24; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await mainClient.query(sql);
        }
        log("Canonical migrations 0001-0024 applied");

        const getSchemaSnapshot = async (tables) => {
            const data = {};
            for (const table of tables) {
                const schemaCols = (await mainClient.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY column_name`, [table])).rows;
                const schemaConstraints = (await mainClient.query(`SELECT conname, pg_get_constraintdef(c.oid) as def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE t.relname = $1 AND n.nspname = 'public' ORDER BY conname`, [table])).rows;
                const schemaIndexes = (await mainClient.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 AND schemaname = 'public' ORDER BY indexname`, [table])).rows;
                const rows = (await mainClient.query(`SELECT * FROM public.${table} ORDER BY id`)).rows;
                data[table] = { cols: schemaCols, constraints: schemaConstraints, indexes: schemaIndexes, rows: rows };
            }
            return data;
        };

        const protectedTables = [
            'secure_assessment_exam_participants',
            'secure_assessment_exam_attempts',
            'secure_assessment_exam_sessions',
            'academic_core_academic_years',
            'academic_core_academic_periods',
            'academic_core_subjects',
            'academic_core_grade_levels',
            'academic_core_academic_groups',
            'academic_core_subject_offerings',
            'academic_core_teaching_assignments',
            'academic_core_student_enrollments'
        ];

        // Create valid Academic Core fixture data BEFORE capturing the pre-migration snapshot
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

        const enroll1 = (await mainClient.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU053_VERIFIER') RETURNING id`, [t1, m1, year1, group1, period1])).rows[0].id;

        // 2. Create at least one valid Exam Instance BEFORE migration 0025
        const exam1 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id) VALUES ($1, $2) RETURNING id`, [t1, ta1])).rows[0].id;
        log("Pre-existing Exam Instance created before migration 0025");

        // 13 & 14 prep: Schema and row-data snapshot BEFORE migration 0025 to prove no mutation
        const preSchema = await getSchemaSnapshot(protectedTables);

        // 3. Apply migration 0025
        const migration0025Files = allMigrationFiles.filter(f => f.startsWith('0025_'));
        assertStrict(migration0025Files.length === 1, "Exactly one 0025 migration file exists");
        const migration0025Sql = fs.readFileSync(path.join(migrationsDir, migration0025Files[0]), 'utf8');
        await mainClient.query(migration0025Sql);
        log("Migration 0025 applied");

        // 4. Exact migration history count becomes 25
        const historyRows = (await mainClient.query(`SELECT migration_id FROM elligble_migration_history ORDER BY migration_id`)).rows;
        assertStrict(historyRows.length === 25, "Migration history count is exactly 25");
        log("Migration history count is 25");

        // 5. Pre-existing Exam Instance row is now lifecycle_state = 'DRAFT'
        const existingExam = (await mainClient.query(`SELECT lifecycle_state, teaching_assignment_id FROM public.secure_assessment_exam_instances WHERE id = $1`, [exam1])).rows[0];
        assertStrict(existingExam.lifecycle_state === 'DRAFT', "Pre-existing Exam Instance converged to DRAFT");
        assertStrict(existingExam.teaching_assignment_id === ta1, "Pre-existing Exam Instance teaching_assignment_id preserved");
        log("Existing row DRAFT convergence proven");

        // 6. lifecycle_state physically is: TEXT, NOT NULL, DEFAULT DRAFT
        const colDef = (await mainClient.query(`SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'secure_assessment_exam_instances' AND column_name = 'lifecycle_state'`)).rows[0];
        assertStrict(colDef.data_type === 'text', "Column type is TEXT");
        assertStrict(colDef.is_nullable === 'NO', "Column is NOT NULL");
        assertStrict(colDef.column_default === "'DRAFT'::text", "Column default is DRAFT");
        log("Column definition (TEXT, NOT NULL, DEFAULT DRAFT) proven");

        // 7. exact CHECK constraint exists: ck_sa_exam_instances_lifecycle_state
        const constraintDef = (await mainClient.query(`SELECT conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE c.conname = 'ck_sa_exam_instances_lifecycle_state' AND t.relname = 'secure_assessment_exam_instances'`)).rows;
        assertStrict(constraintDef.length === 1, "CHECK constraint ck_sa_exam_instances_lifecycle_state exists");
        log("Constraint existence proven");

        // 8. new Exam Instance insertion that omits lifecycle_state succeeds and receives DRAFT
        const exam2 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id`, [t1])).rows[0].id;
        const newExam = (await mainClient.query(`SELECT lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`, [exam2])).rows[0];
        assertStrict(newExam.lifecycle_state === 'DRAFT', "New insertion omitting state receives DRAFT");
        log("New insertion default DRAFT proven");

        // 9. every exact allowed state is accepted
        const allowedStates = ['DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED'];
        for (const state of allowedStates) {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, lifecycle_state) VALUES ($1, $2)`, [t1, state]);
        }
        log("All exact allowed states accepted");

        // 10. an invalid value is rejected by real PostgreSQL with 23514 and exact constraint
        let rejected = false;
        try {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, lifecycle_state) VALUES ($1, 'INVALID_STATE')`, [t1]);
        } catch (e) {
            assertStrict(e.code === '23514', "Invalid state rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_lifecycle_state', "Invalid state rejection yields exact constraint ck_sa_exam_instances_lifecycle_state");
            rejected = true;
        }
        assertStrict(rejected, "Invalid state is rejected");
        log("Invalid state 23514 rejection proven");

        // 11. execute migration 0025 again and prove repeat safety
        await mainClient.query(migration0025Sql);
        const repeatHistory = (await mainClient.query(`SELECT count(*) as count FROM elligble_migration_history WHERE migration_id = '0025_bu053_secure_assessment_exam_instance_lifecycle_state'`)).rows[0].count;
        assertStrict(Number(repeatHistory) === 1, "Migration history record not duplicated");

        const schemaAfterRepeat = await getSchemaSnapshot(['secure_assessment_exam_instances']);
        const colCount = schemaAfterRepeat['secure_assessment_exam_instances'].cols.filter(c => c.column_name === 'lifecycle_state').length;
        assertStrict(colCount === 1, "Column not duplicated on repeat");

        const constraintCount = schemaAfterRepeat['secure_assessment_exam_instances'].constraints.filter(c => c.conname === 'ck_sa_exam_instances_lifecycle_state').length;
        assertStrict(constraintCount === 1, "Constraint not duplicated on repeat");
        log("Migration repeat safety proven");

        // 12. preserve the current Exam Instance structure established by BU-002 / BU-044
        const instanceSchema = schemaAfterRepeat['secure_assessment_exam_instances'];
        const tenantCol = instanceSchema.cols.find(c => c.column_name === 'tenant_id');
        const taCol = instanceSchema.cols.find(c => c.column_name === 'teaching_assignment_id');
        assertStrict(!!tenantCol, "tenant_id column preserved");
        assertStrict(!!taCol, "teaching_assignment_id column preserved");

        const fkDef = instanceSchema.constraints.find(c => c.conname === 'fk_sa_exam_instances_teaching_assignment');
        assertStrict(!!fkDef, "fk_sa_exam_instances_teaching_assignment constraint preserved");

        const idxDef = instanceSchema.indexes.find(i => i.indexname === 'idx_sa_exam_instances_tenant_teaching_assignment');
        assertStrict(!!idxDef, "idx_sa_exam_instances_tenant_teaching_assignment index preserved");

        // Reuse existing valid pre-0025 Teaching Assignment fixture row (ta1) to prove functional referencing
        const examWithTa = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id) VALUES ($1, $2) RETURNING id, lifecycle_state, teaching_assignment_id`, [t1, ta1])).rows[0];
        assertStrict(examWithTa.lifecycle_state === 'DRAFT', "New exam instance with teaching assignment defaults to DRAFT");
        assertStrict(examWithTa.teaching_assignment_id === ta1, "New exam instance correctly references teaching assignment");
        log("Exam Instance structure (BU-002/BU-044) preserved");

        // 13 & 14. Prove no Academic Core mutation, and no schema mutation to participants/attempts/sessions
        const postSchema = await getSchemaSnapshot(protectedTables);
        assertStrict(JSON.stringify(preSchema) === JSON.stringify(postSchema), "No schema mutation to participants/attempts/sessions, and no schema mutation to academic core");
        log("No Participant/Attempt/Session schema change and No Academic Core mutation proven");

    } catch (e) {
        caughtError = e;
        console.error("FAIL:", e);
    } finally {
        let cleanupFailed = false;

        const attemptClose = async (resource) => {
            if (resource) {
                try {
                    await resource.end();
                } catch(e) {
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
                await teardownClient.query(`DROP DATABASE "${TEST_DB}" WITH (FORCE)`);
            } catch (e) {
                console.error("FAIL: DB CLEANUP ERROR", e);
                cleanupFailed = true;
            } finally {
                await teardownClient.end();
            }
        }

        if (caughtError || cleanupFailed) {
            process.exitCode = 1;
        } else {
            console.log(`\nBU-053 MIGRATION AND LIFECYCLE PERSISTENCE VERIFICATION PASS (${TEST_DB})`);
        }
    }
}

runTest().catch(e => {
    console.error("UNHANDLED ROOT REJECTION:", e);
    process.exitCode = 1;
});
