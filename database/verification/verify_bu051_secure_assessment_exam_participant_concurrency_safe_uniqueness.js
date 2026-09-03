const { Client, Pool } = require('../../runtime/secure-assessment/node_modules/pg');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    const TEST_DB = `elligble_bu051_${runId}`;

    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    const testUrl = new URL(dbUrl);
    testUrl.pathname = `/${TEST_DB}`;

    let databaseCreated = false;
    let setupClient = null;
    let mainClient = null;
    let raceClientA = null;
    let raceClientB = null;
    let pool = null;
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

        // A. STRICT CANONICAL MIGRATION CHAIN PROOF
        for (let i = 1; i <= 23; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await mainClient.query(sql);
        }

        const historyRows = (await mainClient.query(`SELECT migration_id FROM elligble_migration_history ORDER BY migration_id`)).rows;
        assertStrict(historyRows.length === 23, "Migration history rows exactly 23 after applying 1-23");

        for (let i = 1; i <= 23; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const filename = allMigrationFiles.find(f => f.startsWith(prefix));
            const expectedId = filename.replace('.sql', '');
            assertStrict(historyRows[i-1].migration_id === expectedId, `History migration_id exactly equals filename without .sql for ${expectedId}`);
        }

        const migration0024Files = allMigrationFiles.filter(f => f.startsWith('0024_'));
        assertStrict(migration0024Files.length === 1, "Exactly one intended 0024 migration file exists");
        assertStrict(migration0024Files[0] === '0024_bu051_secure_assessment_exam_participant_concurrency_safe_uniqueness.sql', "Exact BU-051 0024 filename");
        const migration0024Sql = fs.readFileSync(path.join(migrationsDir, migration0024Files[0]), 'utf8');
        log("Strict canonical migration chain and 0024 identity proven");

        // G. EXACT PREDECESSOR FK PRESERVATION & H. SCHEMA-QUALIFY
        const getParticipantSchemaSnapshot = async () => {
            const cols = await mainClient.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'secure_assessment_exam_participants' AND table_schema = 'public' ORDER BY column_name`);
            const trigs = await mainClient.query(`SELECT tgname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'secure_assessment_exam_participants' AND n.nspname = 'public' ORDER BY tgname`);
            const constraints = await mainClient.query(`SELECT conname, pg_get_constraintdef(c.oid) as def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE t.relname = 'secure_assessment_exam_participants' AND n.nspname = 'public' ORDER BY conname`);
            const indexes = await mainClient.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'secure_assessment_exam_participants' AND schemaname = 'public' ORDER BY indexname`);
            return { cols: cols.rows, trigs: trigs.rows, constraints: constraints.rows, indexes: indexes.rows };
        };
        const preSchema = await getParticipantSchemaSnapshot();
        const fkInstanceBefore = preSchema.constraints.find(c => c.conname === 'fk_sa_participant_instance');
        const fkEnrollmentBefore = preSchema.constraints.find(c => c.conname === 'fk_sa_exam_participants_academic_enrollment');

        // Data Setup
        const t1 = (await mainClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const p1 = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const m1 = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, p1])).rows[0].id;
        const year1 = (await mainClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t1])).rows[0].id;
        const period1 = (await mainClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem A', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t1, year1])).rows[0].id;
        const grade1 = (await mainClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade A') RETURNING id`, [t1])).rows[0].id;
        const group1 = (await mainClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'Group A') RETURNING id`, [t1, year1, grade1])).rows[0].id;

        const enroll1 = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU051_VERIFIER')
            RETURNING id
        `, [t1, m1, year1, group1, period1])).rows[0].id;

        const enroll2 = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU051_VERIFIER')
            RETURNING id
        `, [t1, m1, year1, group1, period1])).rows[0].id;

        const exam1 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id`, [t1])).rows[0].id;

        // PRE-EXISTING DUPLICATE FAIL-CLOSED PROOF
        await mainClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`, [t1, exam1, p1, enroll1]);
        await mainClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`, [t1, exam1, p1, enroll2]);

        const preRows = (await mainClient.query(`SELECT id, tenant_id, exam_instance_id, person_id, academic_enrollment_id FROM public.secure_assessment_exam_participants ORDER BY id`)).rows;
        assertStrict(preRows.length === 2, "Exact 2 pre-existing duplicate rows created");

        let migrationFailed = false;
        try {
            await mainClient.query(migration0024Sql);
        } catch (e) {
            migrationFailed = true;
            const intendedFailure = e.message.includes('MIGRATION REJECTED: Pre-existing duplicate exam participants found');
            await mainClient.query('ROLLBACK');
            assertStrict(intendedFailure, 'Failure is the intended BU-051 fail-closed rejection');
        }
        assertStrict(migrationFailed, "Migration 0024 must fail when duplicates exist");

        await mainClient.query('SELECT 1');

        const postRows = (await mainClient.query(`SELECT id, tenant_id, exam_instance_id, person_id, academic_enrollment_id FROM public.secure_assessment_exam_participants ORDER BY id`)).rows;
        assertStrict(postRows.length === 2, "Count remains 2 after failure");
        assertStrict(JSON.stringify(preRows) === JSON.stringify(postRows), "Exact participant rows after failure equal the exact pre-migration rows (no deletion/merge/rewrite)");

        const history0024 = (await mainClient.query(`SELECT count(*) FROM elligble_migration_history WHERE migration_id = '0024_bu051_secure_assessment_exam_participant_concurrency_safe_uniqueness'`)).rows[0].count;
        assertStrict(Number(history0024) === 0, "0024 migration-history count remains 0");
        log("Pre-existing duplicate fail-closed proven");

        // Clean up duplicates for successful application
        await mainClient.query(`DELETE FROM public.secure_assessment_exam_participants`);

        // I. ACADEMIC CORE NO-MUTATION PROOF - BEFORE SNAPSHOT
        const getAcademicCoreSnapshot = async () => {
            const data = {};
            for (const table of ['academic_core_academic_years', 'academic_core_academic_periods', 'academic_core_grade_levels', 'academic_core_academic_groups', 'academic_core_student_enrollments']) {
                const schemaCols = (await mainClient.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY column_name`, [table])).rows;
                const schemaConstraints = (await mainClient.query(`SELECT conname, pg_get_constraintdef(c.oid) as def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE t.relname = $1 AND n.nspname = 'public' ORDER BY conname`, [table])).rows;
                const schemaIndexes = (await mainClient.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 AND schemaname = 'public' ORDER BY indexname`, [table])).rows;
                const rows = (await mainClient.query(`SELECT * FROM public.${table} ORDER BY id`)).rows;
                data[table] = { cols: schemaCols, constraints: schemaConstraints, indexes: schemaIndexes, rows: rows };
            }
            return data;
        };
        const acSnapshotBefore = await getAcademicCoreSnapshot();

        // Apply 0024 successfully
        await mainClient.query(migration0024Sql);

        // I. ACADEMIC CORE NO-MUTATION PROOF - AFTER SNAPSHOT
        const acSnapshotAfter = await getAcademicCoreSnapshot();
        assertStrict(JSON.stringify(acSnapshotBefore) === JSON.stringify(acSnapshotAfter), "Academic Core schema/data completely unmutated by 0024");
        log("Academic Core no-mutation proven");

        // B. MIGRATION 0024 REPEAT SAFETY
        const historySuccess = (await mainClient.query(`SELECT count(*) FROM elligble_migration_history WHERE migration_id = '0024_bu051_secure_assessment_exam_participant_concurrency_safe_uniqueness'`)).rows[0].count;
        assertStrict(Number(historySuccess) === 1, "History count for exact 0024 migration ID = 1");

        await mainClient.query(migration0024Sql); // execute exact same migration again

        const historyAfterRepeat = (await mainClient.query(`SELECT count(*) FROM elligble_migration_history WHERE migration_id = '0024_bu051_secure_assessment_exam_participant_concurrency_safe_uniqueness'`)).rows[0].count;
        assertStrict(Number(historyAfterRepeat) === 1, "History count for 0024 remains exactly 1 after repeat");
        log("Migration 0024 repeat safety proven");

        // C. EXACT UNIQUE CONSTRAINT PHYSICAL PROOF
        const postSchema = await getParticipantSchemaSnapshot();

        const remainingConstraints = postSchema.constraints.filter(c => c.conname !== 'uq_sa_exam_participants_tenant_instance_person');
        assertStrict(JSON.stringify(preSchema.constraints) === JSON.stringify(remainingConstraints), "Every pre-existing participant constraint remained structurally identical");
        assertStrict(postSchema.constraints.length === preSchema.constraints.length + 1, "Exactly one constraint added");

        const cProof = await mainClient.query(`
            SELECT c.contype, array_to_string(array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum)), ',') as keys
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
            WHERE c.conname = 'uq_sa_exam_participants_tenant_instance_person'
              AND t.relname = 'secure_assessment_exam_participants'
              AND n.nspname = 'public'
            GROUP BY c.contype
        `);
        assertStrict(cProof.rows.length === 1, "Exact constraint exists on canonical target");
        assertStrict(cProof.rows[0].contype === 'u', "contype = 'u'");
        assertStrict(cProof.rows[0].keys === 'tenant_id,exam_instance_id,person_id', "ordered key columns exactly tenant_id, exam_instance_id, person_id");
        log("Exact UNIQUE constraint physical proof passed");

        // G. EXACT PREDECESSOR FK PRESERVATION
        const fkInstanceAfter = postSchema.constraints.find(c => c.conname === 'fk_sa_participant_instance');
        const fkEnrollmentAfter = postSchema.constraints.find(c => c.conname === 'fk_sa_exam_participants_academic_enrollment');
        assertStrict(JSON.stringify(fkInstanceBefore) === JSON.stringify(fkInstanceAfter), "fk_sa_participant_instance structurally identical");
        assertStrict(JSON.stringify(fkEnrollmentBefore) === JSON.stringify(fkEnrollmentAfter), "fk_sa_exam_participants_academic_enrollment structurally identical");

        assertStrict(JSON.stringify(preSchema.cols) === JSON.stringify(postSchema.cols), "Columns unchanged by 0024");
        assertStrict(JSON.stringify(preSchema.trigs) === JSON.stringify(postSchema.trigs), "Triggers unchanged by 0024");

        const remainingIndexes = postSchema.indexes.filter(i => i.indexname !== 'uq_sa_exam_participants_tenant_instance_person');
        assertStrict(JSON.stringify(preSchema.indexes) === JSON.stringify(remainingIndexes), "Every pre-existing participant index remained structurally identical");
        assertStrict(postSchema.indexes.length === preSchema.indexes.length + 1, "Exactly one index added");

        const addedIndexes = postSchema.indexes.filter(pi => !preSchema.indexes.find(i => i.indexname === pi.indexname));
        assertStrict(addedIndexes.length === 1 && addedIndexes[0].indexname === 'uq_sa_exam_participants_tenant_instance_person', "Only intended backing index added");
        log("Schema breadth and exact predecessor FK preservation proven");

        // D. DIRECT ORDINARY UNIQUENESS PROOF
        const pDirect = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const mDirect = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, pDirect])).rows[0].id;
        const enrollDirect = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU051_VERIFIER')
            RETURNING id
        `, [t1, mDirect, year1, group1, period1])).rows[0].id;

        await mainClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`, [t1, exam1, pDirect, enrollDirect]);

        let directDuplicateFail = false;
        let directDuplicateCode = null;
        try {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`, [t1, exam1, pDirect, enrollDirect]);
        } catch (e) {
            directDuplicateFail = true;
            directDuplicateCode = e.code;
        }
        assertStrict(directDuplicateFail, "Second direct INSERT using exact same keys is rejected");
        assertStrict(directDuplicateCode === '23505', "Loser SQLSTATE exactly 23505");

        const directCount = (await mainClient.query(`SELECT count(*) FROM public.secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND person_id = $3`, [t1, exam1, pDirect])).rows[0].count;
        assertStrict(Number(directCount) === 1, "Final logical-key row count exactly 1");
        log("Direct ordinary uniqueness proof passed");

        // E. ALLOWED NON-COLLISION SEMANTICS
        const pOther = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const mOther = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, pOther])).rows[0].id;
        const enrollOther = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU051_VERIFIER')
            RETURNING id
        `, [t1, mOther, year1, group1, period1])).rows[0].id;

        // 1. different Person, same tenant, same Exam Instance
        await mainClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`, [t1, exam1, pOther, enrollOther]);

        // 2. same Person, same tenant, different Exam Instance
        const exam2 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id`, [t1])).rows[0].id;
        await mainClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`, [t1, exam2, pDirect, enrollDirect]);
        log("Allowed non-collision semantics proven");

        // F. TENANT / FK INTEGRITY
        const t2 = (await mainClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const examT2 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id`, [t2])).rows[0].id;

        let crossTenantExamFail = false;
        try {
            await mainClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`, [t1, examT2, pOther, enrollOther]);
        } catch(e) {
            crossTenantExamFail = true;
            assertStrict(e.code === '23503', "Wrong-tenant Exam Instance rejected by existing FK");
        }
        assertStrict(crossTenantExamFail, "Wrong-tenant Exam Instance explicitly rejected");

        // Wrong-tenant Academic Enrollment negative proof
        const yearT2 = (await mainClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t2])).rows[0].id;
        const periodT2 = (await mainClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem A', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t2, yearT2])).rows[0].id;
        const gradeT2 = (await mainClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade A') RETURNING id`, [t2])).rows[0].id;
        const groupT2 = (await mainClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'Group A') RETURNING id`, [t2, yearT2, gradeT2])).rows[0].id;
        const pT2 = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const mT2 = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t2, pT2])).rows[0].id;
        const enrollT2 = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU051_VERIFIER')
            RETURNING id
        `, [t2, mT2, yearT2, groupT2, periodT2])).rows[0].id;

        let crossTenantEnrollFail = false;
        try {
            const preCheckWrongEnroll = (await mainClient.query(`SELECT count(*) FROM public.secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND person_id = $3`, [t1, exam2, pOther])).rows[0].count;
            assertStrict(Number(preCheckWrongEnroll) === 0, "Logical UNIQUE collision was impossible before the INSERT");

            await mainClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`, [t1, exam2, pOther, enrollT2]);
        } catch(e) {
            crossTenantEnrollFail = true;
            assertStrict(e.code === '23503', "Wrong-tenant Academic Enrollment rejected by existing FK");
        }
        assertStrict(crossTenantEnrollFail, "Wrong-tenant Academic Enrollment explicitly rejected");
        log("Tenant / FK integrity proven");

        // K. CONCURRENCY
        const pRace = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const mRace = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, pRace])).rows[0].id;
        const enrollRace = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU051_VERIFIER')
            RETURNING id
        `, [t1, mRace, year1, group1, period1])).rows[0].id;

        raceClientA = new Client({ connectionString: testUrl.toString() });
        raceClientB = new Client({ connectionString: testUrl.toString() });
        await raceClientA.connect();
        await raceClientB.connect();

        await raceClientA.query(`SET statement_timeout = '2s'`);
        await raceClientB.query(`SET statement_timeout = '2s'`);
        await raceClientA.query(`SET lock_timeout = '2s'`);
        await raceClientB.query(`SET lock_timeout = '2s'`);

        const queryText = `INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id) VALUES ($1, $2, $3, $4)`;
        const params = [t1, exam1, pRace, enrollRace];

        const results = await Promise.allSettled([
            raceClientA.query(queryText, params),
            raceClientB.query(queryText, params)
        ]);

        let successCount = 0;
        let rejectCount = 0;
        let rejectCode = null;

        for (const r of results) {
            if (r.status === 'fulfilled') successCount++;
            if (r.status === 'rejected') {
                rejectCount++;
                rejectCode = r.reason.code;
                if (r.reason.message.includes('timeout') || r.reason.message.includes('deadlock')) {
                    throw new Error(`ASSERTION FAILED: Concurrency race failed with timeout/deadlock: ${r.reason.message}`);
                }
            }
        }

        assertStrict(successCount === 1, "Exactly 1 successful authoritative write in race");
        assertStrict(rejectCount === 1, "Exactly 1 rejection in race");
        assertStrict(rejectCode === '23505', "Loser SQLSTATE is exactly 23505");

        const raceRows = (await mainClient.query(`SELECT count(*) FROM public.secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND person_id = $3`, [t1, exam1, pRace])).rows[0].count;
        assertStrict(Number(raceRows) === 1, "Final logical-key rows exactly 1 after race");
        log("True concurrency proof passed");

        // L. BU-050 COMPATIBILITY
        let runtimeModule = null;
        try {
            runtimeModule = await import('../../runtime/secure-assessment/src/exam-participant-academic-enrollment-creation.ts');
        } catch(e) {
            throw new Error(`Failed to dynamically import BU-050 TS runtime natively: ${e.message}`);
        }

        const createExamParticipantAcademicEnrollment = runtimeModule.createExamParticipantAcademicEnrollment;
        pool = new Pool({ connectionString: testUrl.toString() });

        const pComp = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const mComp = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, pComp])).rows[0].id;
        const enrollComp = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU051_VERIFIER')
            RETURNING id
        `, [t1, mComp, year1, group1, period1])).rows[0].id;

        const res1 = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: enrollComp });
        assertStrict(res1.type === 'created', "Valid BU-050 creation natively yields 'created'");

        const res2 = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: enrollComp });
        assertStrict(res2.type === 'denied', "Sequential duplicate natively yields 'denied'");
        log("BU-050 native compatibility explicitly proven");

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
        await attemptClose(raceClientA);
        await attemptClose(raceClientB);
        await attemptClose(pool);

        if (databaseCreated) {
            const teardownClient = new Client({ connectionString: adminUrl.toString() });
            try {
                await teardownClient.connect();
                await teardownClient.query(`
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = '${TEST_DB}' AND pid <> pg_backend_pid()
                `);
                await teardownClient.query(`DROP DATABASE "${TEST_DB}"`);
                const dbExists = (await teardownClient.query(`SELECT count(*) FROM pg_database WHERE datname = '${TEST_DB}'`)).rows[0].count;
                assertStrict(Number(dbExists) === 0, "Disposable DB explicitly dropped");
                log("Robust disposable DB cleanup proven");
            } catch(e) {
                console.error("FAIL: DB TEARDOWN ERROR", e);
                cleanupFailed = true;
                if (!caughtError) caughtError = e;
            } finally {
                try {
                    await teardownClient.end();
                } catch (e) {
                    console.error("FAIL: TEARDOWN CLIENT CLOSE ERROR", e);
                    cleanupFailed = true;
                }
            }
        }

        if (caughtError || cleanupFailed) {
            process.exitCode = 1;
        } else {
            log("BU-051 VERIFIER PASS");
            process.exitCode = 0;
        }
    }
}

runTest().catch(e => {
    console.error("FATAL ERROR", e);
    process.exitCode = 1;
});
