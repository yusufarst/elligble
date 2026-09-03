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
    const TEST_DB = `elligble_bu054_${runId}`;

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

        // 1. Canonical migrations 0001 through 0025
        for (let i = 1; i <= 25; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await mainClient.query(sql);
        }
        log("Canonical migrations 0001-0025 applied");

        const getSchemaSnapshot = async (tables) => {
            const data = {};
            for (const table of tables) {
                const schemaCols = (await mainClient.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY column_name`, [table])).rows;
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
        const enroll1 = (await mainClient.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU054_VERIFIER') RETURNING id`, [t1, m1, year1, group1, period1])).rows[0].id;

        // 2 & 3. Create valid Exam Instance BEFORE migration 0026 and verify it is DRAFT under BU-053
        const exam1 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id) VALUES ($1, $2) RETURNING id, lifecycle_state`, [t1, ta1])).rows[0];
        assertStrict(exam1.lifecycle_state === 'DRAFT', "Pre-existing Exam Instance is DRAFT under BU-053");
        log("Pre-existing Exam Instance created before migration 0026 with lifecycle_state DRAFT");

        // Pre-migration schema and row-data snapshot of protected tables
        const preSchema = await getSchemaSnapshot(protectedTables);

        // 4. Apply migration 0026
        const migration0026Files = allMigrationFiles.filter(f => f.startsWith('0026_'));
        assertStrict(migration0026Files.length === 1, "Exactly one 0026 migration file exists");
        const migration0026Sql = fs.readFileSync(path.join(migrationsDir, migration0026Files[0]), 'utf8');
        await mainClient.query(migration0026Sql);
        log("Migration 0026 applied");

        // 5. Exact migration history count becomes 26
        const historyRows = (await mainClient.query(`SELECT migration_id FROM elligble_migration_history ORDER BY migration_id`)).rows;
        assertStrict(historyRows.length === 26, "Migration history count is exactly 26");
        log("Migration history count is exactly 26");

        // 6, 7, 8, 9. Physical column existence, types, nullability, defaults
        const colRows = (await mainClient.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances' AND column_name IN ('window_starts_at', 'window_ends_at') ORDER BY column_name`)).rows;
        assertStrict(colRows.length === 2, "Both window columns exist");

        const endsCol = colRows.find(c => c.column_name === 'window_ends_at');
        const startsCol = colRows.find(c => c.column_name === 'window_starts_at');

        assertStrict(startsCol.data_type === 'timestamp with time zone', "window_starts_at is TIMESTAMP WITH TIME ZONE");
        assertStrict(startsCol.is_nullable === 'YES', "window_starts_at is nullable");
        assertStrict(startsCol.column_default === null, "window_starts_at has no default");

        assertStrict(endsCol.data_type === 'timestamp with time zone', "window_ends_at is TIMESTAMP WITH TIME ZONE");
        assertStrict(endsCol.is_nullable === 'YES', "window_ends_at is nullable");
        assertStrict(endsCol.column_default === null, "window_ends_at has no default");
        log("Physical column definitions (timestamptz, nullable, no default) proven");

        // 10 & 11. Exact CHECK constraints exist: ck_sa_exam_instances_window_pair, ck_sa_exam_instances_window_order
        const constraints = (await mainClient.query(`SELECT conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE t.relname = 'secure_assessment_exam_instances' AND n.nspname = 'public' AND c.conname IN ('ck_sa_exam_instances_window_pair', 'ck_sa_exam_instances_window_order')`)).rows;
        assertStrict(constraints.some(c => c.conname === 'ck_sa_exam_instances_window_pair'), "ck_sa_exam_instances_window_pair constraint exists");
        assertStrict(constraints.some(c => c.conname === 'ck_sa_exam_instances_window_order'), "ck_sa_exam_instances_window_order constraint exists");
        log("Exact CHECK constraints (window_pair, window_order) proven");

        // 12. Pre-existing Exam Instance converges safely to NULL/NULL while lifecycle_state remains DRAFT
        const existingRow = (await mainClient.query(`SELECT window_starts_at, window_ends_at, lifecycle_state, teaching_assignment_id FROM public.secure_assessment_exam_instances WHERE id = $1`, [exam1.id])).rows[0];
        assertStrict(existingRow.window_starts_at === null, "Pre-existing Exam Instance window_starts_at is NULL");
        assertStrict(existingRow.window_ends_at === null, "Pre-existing Exam Instance window_ends_at is NULL");
        assertStrict(existingRow.lifecycle_state === 'DRAFT', "Pre-existing Exam Instance lifecycle_state remains DRAFT");
        assertStrict(existingRow.teaching_assignment_id === ta1, "Pre-existing Exam Instance teaching_assignment_id preserved");
        log("Pre-existing Exam Instance convergence to NULL/NULL with DRAFT state proven");

        // 13 & 14. New Exam Instance insertion omitting both window columns succeeds, receives NULL/NULL and DRAFT
        const exam2 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id, window_starts_at, window_ends_at, lifecycle_state`, [t1])).rows[0];
        assertStrict(exam2.window_starts_at === null, "New insertion omitting window receives NULL starts_at");
        assertStrict(exam2.window_ends_at === null, "New insertion omitting window receives NULL ends_at");
        assertStrict(exam2.lifecycle_state === 'DRAFT', "New insertion omitting window receives DRAFT");
        log("New Exam Instance insertion omitting window receives NULL/NULL and DRAFT proven");

        // 15 & 16. Valid configured window succeeds and MUST NOT implicitly change lifecycle_state
        const validStarts = '2026-09-10T08:00:00Z';
        const validEnds = '2026-09-10T10:00:00Z';
        const exam3 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, window_starts_at, window_ends_at) VALUES ($1, $2, $3) RETURNING id, window_starts_at, window_ends_at, lifecycle_state`, [t1, validStarts, validEnds])).rows[0];
        assertStrict(new Date(exam3.window_starts_at).toISOString() === '2026-09-10T08:00:00.000Z', "Configured window_starts_at matches");
        assertStrict(new Date(exam3.window_ends_at).toISOString() === '2026-09-10T10:00:00.000Z', "Configured window_ends_at matches");
        assertStrict(exam3.lifecycle_state === 'DRAFT', "Valid configured window does NOT change lifecycle_state (remains DRAFT)");

        // Explicit UPDATE test: setting window on pre-existing DRAFT row also leaves lifecycle_state as DRAFT
        const updatedExam1 = (await mainClient.query(`UPDATE public.secure_assessment_exam_instances SET window_starts_at = $1, window_ends_at = $2 WHERE id = $3 RETURNING window_starts_at, window_ends_at, lifecycle_state`, [validStarts, validEnds, exam1.id])).rows[0];
        assertStrict(updatedExam1.lifecycle_state === 'DRAFT', "Updated configured window leaves lifecycle_state as DRAFT");
        log("Valid configured window persistence and no implicit lifecycle transition proven");

        // 17. Start-only partial window is rejected by real PostgreSQL (SQLSTATE 23514 / ck_sa_exam_instances_window_pair)
        let startOnlyRejected = false;
        try {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, window_starts_at, window_ends_at) VALUES ($1, $2, NULL)`, [t1, validStarts]);
        } catch (e) {
            assertStrict(e.code === '23514', "Start-only rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_window_pair', "Start-only rejection yields exact constraint ck_sa_exam_instances_window_pair");
            startOnlyRejected = true;
        }
        assertStrict(startOnlyRejected, "Start-only partial window rejected");
        log("Start-only partial window 23514 rejection proven");

        // 18. End-only partial window is rejected by real PostgreSQL (SQLSTATE 23514 / ck_sa_exam_instances_window_pair)
        let endOnlyRejected = false;
        try {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, window_starts_at, window_ends_at) VALUES ($1, NULL, $2)`, [t1, validEnds]);
        } catch (e) {
            assertStrict(e.code === '23514', "End-only rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_window_pair', "End-only rejection yields exact constraint ck_sa_exam_instances_window_pair");
            endOnlyRejected = true;
        }
        assertStrict(endOnlyRejected, "End-only partial window rejected");
        log("End-only partial window 23514 rejection proven");

        // 19. Equal start/end is rejected by real PostgreSQL (SQLSTATE 23514 / ck_sa_exam_instances_window_order)
        let equalRejected = false;
        try {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, window_starts_at, window_ends_at) VALUES ($1, $2, $2)`, [t1, validStarts]);
        } catch (e) {
            assertStrict(e.code === '23514', "Equal window rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_window_order', "Equal window rejection yields exact constraint ck_sa_exam_instances_window_order");
            equalRejected = true;
        }
        assertStrict(equalRejected, "Equal start/end window rejected");
        log("Equal start/end window 23514 rejection proven");

        // 20. Start later than end is rejected by real PostgreSQL (SQLSTATE 23514 / ck_sa_exam_instances_window_order)
        let invertedRejected = false;
        try {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, window_starts_at, window_ends_at) VALUES ($1, $2, $3)`, [t1, validEnds, validStarts]);
        } catch (e) {
            assertStrict(e.code === '23514', "Inverted window rejection yields SQLSTATE 23514");
            assertStrict(e.constraint === 'ck_sa_exam_instances_window_order', "Inverted window rejection yields exact constraint ck_sa_exam_instances_window_order");
            invertedRejected = true;
        }
        assertStrict(invertedRejected, "Inverted start/end window rejected");
        log("Inverted start/end window 23514 rejection proven");

        // 21. Execute migration 0026 again and prove repeat safety
        await mainClient.query(migration0026Sql);
        const repeatHistory = (await mainClient.query(`SELECT count(*) as count FROM elligble_migration_history WHERE migration_id = '0026_bu054_secure_assessment_exam_instance_operational_window'`)).rows[0].count;
        assertStrict(Number(repeatHistory) === 1, "Migration history record not duplicated on repeat");

        const schemaAfterRepeat = await getSchemaSnapshot(['secure_assessment_exam_instances']);
        const startsColCount = schemaAfterRepeat['secure_assessment_exam_instances'].cols.filter(c => c.column_name === 'window_starts_at').length;
        const endsColCount = schemaAfterRepeat['secure_assessment_exam_instances'].cols.filter(c => c.column_name === 'window_ends_at').length;
        assertStrict(startsColCount === 1, "window_starts_at column not duplicated on repeat");
        assertStrict(endsColCount === 1, "window_ends_at column not duplicated on repeat");

        const pairConstraintCount = schemaAfterRepeat['secure_assessment_exam_instances'].constraints.filter(c => c.conname === 'ck_sa_exam_instances_window_pair').length;
        const orderConstraintCount = schemaAfterRepeat['secure_assessment_exam_instances'].constraints.filter(c => c.conname === 'ck_sa_exam_instances_window_order').length;
        assertStrict(pairConstraintCount === 1, "ck_sa_exam_instances_window_pair constraint not duplicated on repeat");
        assertStrict(orderConstraintCount === 1, "ck_sa_exam_instances_window_order constraint not duplicated on repeat");
        log("Migration 0026 repeat safety proven");

        // 22. Preserve BU-053 lifecycle persistence contract
        const instanceCols = schemaAfterRepeat['secure_assessment_exam_instances'].cols;
        const lifecycleCol = instanceCols.find(c => c.column_name === 'lifecycle_state');
        assertStrict(!!lifecycleCol, "lifecycle_state column preserved");
        assertStrict(lifecycleCol.data_type === 'text', "lifecycle_state is TEXT");
        assertStrict(lifecycleCol.is_nullable === 'NO', "lifecycle_state is NOT NULL");
        assertStrict(lifecycleCol.column_default === "'DRAFT'::text", "lifecycle_state default is DRAFT");

        const lifecycleConstraint = schemaAfterRepeat['secure_assessment_exam_instances'].constraints.find(c => c.conname === 'ck_sa_exam_instances_lifecycle_state');
        assertStrict(!!lifecycleConstraint, "ck_sa_exam_instances_lifecycle_state constraint preserved");

        const allowedStates = ['DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED'];
        for (const state of allowedStates) {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, lifecycle_state) VALUES ($1, $2)`, [t1, state]);
        }
        log("BU-053 lifecycle persistence contract preserved");

        // 23. Preserve Exam Instance tenant and Teaching Assignment structure (BU-002 / BU-044)
        const tenantCol = instanceCols.find(c => c.column_name === 'tenant_id');
        const taCol = instanceCols.find(c => c.column_name === 'teaching_assignment_id');
        assertStrict(!!tenantCol, "tenant_id column preserved");
        assertStrict(!!taCol, "teaching_assignment_id column preserved");

        const fkDef = schemaAfterRepeat['secure_assessment_exam_instances'].constraints.find(c => c.conname === 'fk_sa_exam_instances_teaching_assignment');
        assertStrict(!!fkDef, "fk_sa_exam_instances_teaching_assignment constraint preserved");

        const idxDef = schemaAfterRepeat['secure_assessment_exam_instances'].indexes.find(i => i.indexname === 'idx_sa_exam_instances_tenant_teaching_assignment');
        assertStrict(!!idxDef, "idx_sa_exam_instances_tenant_teaching_assignment index preserved");

        const examWithTa = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, window_starts_at, window_ends_at) VALUES ($1, $2, $3, $4) RETURNING id, lifecycle_state, teaching_assignment_id, window_starts_at, window_ends_at`, [t1, ta1, validStarts, validEnds])).rows[0];
        assertStrict(examWithTa.teaching_assignment_id === ta1, "Exam instance correctly references teaching assignment");
        assertStrict(examWithTa.lifecycle_state === 'DRAFT', "Exam instance with TA and window defaults to DRAFT");
        log("Exam Instance structure (BU-002 / BU-044) preserved");

        // 24, 25, 26. Prove no schema mutation to participants/attempts/sessions, and no Academic Core schema or data mutation
        const postSchema = await getSchemaSnapshot(protectedTables);
        assertStrict(JSON.stringify(preSchema) === JSON.stringify(postSchema), "No schema mutation to participants/attempts/sessions, and no schema or data mutation to Academic Core");
        log("Participant/Attempt/Session protection and Academic Core schema + data immutability proven");

    } catch (e) {
        caughtError = e;
        console.error("FAIL:", e);
    } finally {
        // 27. Disposable database cleanup must execute in PASS and FAIL paths
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
            console.log(`\nBU-054 OPERATIONAL WINDOW PERSISTENCE VERIFICATION PASS (${TEST_DB})`);
        }
    }
}

runTest().catch(e => {
    console.error("UNHANDLED ROOT REJECTION:", e);
    process.exitCode = 1;
});
