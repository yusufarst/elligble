import { Client, Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { createExamParticipantAcademicEnrollment } from '../src/exam-participant-academic-enrollment-creation.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function assertStrict(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

function log(message: string) {
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
    const TEST_DB = `elligble_bu052_${runId}`;

    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    const testUrl = new URL(dbUrl);
    testUrl.pathname = `/${TEST_DB}`;

    let databaseCreated = false;
    let setupClient: Client | null = null;
    let mainClient: Client | null = null;
    let pool: Pool | null = null;
    let caughtError: Error | null = null;

    try {
        setupClient = new Client({ connectionString: adminUrl.toString() });
        await setupClient.connect();
        await setupClient.query(`CREATE DATABASE "${TEST_DB}"`);
        databaseCreated = true;
        await setupClient.end();
        setupClient = null;

        mainClient = new Client({ connectionString: testUrl.toString() });
        await mainClient.connect();

        const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
        const allMigrationFiles = fs.readdirSync(migrationsDir)
            .filter(f => /^\d{4}_.*\.sql$/.test(f))
            .sort();

        // CANONICAL MIGRATION CHAIN PROOF 1..24
        for (let i = 1; i <= 24; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
            assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
            const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
            await mainClient.query(sql);
        }

        const historyRows = (await mainClient.query(`SELECT migration_id FROM elligble_migration_history ORDER BY migration_id`)).rows;
        assertStrict(historyRows.length === 24, "Migration history rows exactly 24 after applying 1-24");

        for (let i = 1; i <= 24; i++) {
            const prefix = String(i).padStart(4, '0') + '_';
            const filename = allMigrationFiles.find(f => f.startsWith(prefix))!;
            const expectedId = filename.replace('.sql', '');
            assertStrict(historyRows[i-1].migration_id === expectedId, `History migration_id exactly equals filename without .sql for ${expectedId}`);
        }
        log("Strict canonical migration chain 1..24 proven");

        pool = new Pool({ connectionString: testUrl.toString() });

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
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU052_VERIFIER')
            RETURNING id
        `, [t1, m1, year1, group1, period1])).rows[0].id;

        const exam1 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id`, [t1])).rows[0].id;

        // ACADEMIC CORE NO-MUTATION PROOF - BEFORE SNAPSHOT
        const getAcademicCoreSnapshot = async () => {
            const data: any = {};
            for (const table of ['academic_core_academic_years', 'academic_core_academic_periods', 'academic_core_grade_levels', 'academic_core_academic_groups', 'academic_core_student_enrollments']) {
                const schemaCols = (await mainClient!.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY column_name`, [table])).rows;
                const schemaConstraints = (await mainClient!.query(`SELECT conname, pg_get_constraintdef(c.oid) as def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE t.relname = $1 AND n.nspname = 'public' ORDER BY conname`, [table])).rows;
                const schemaIndexes = (await mainClient!.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 AND schemaname = 'public' ORDER BY indexname`, [table])).rows;
                const rows = (await mainClient!.query(`SELECT * FROM public.${table} ORDER BY id`)).rows;
                data[table] = { cols: schemaCols, constraints: schemaConstraints, indexes: schemaIndexes, rows: rows };
            }
            return data;
        };
        let acBefore = await getAcademicCoreSnapshot();

        // 1. Initial valid creation
        const res1 = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: enroll1 });
        assertStrict(res1.type === 'created', "Valid initial creation natively yields 'created'");

        // 2. Sequential duplicate remains denied
        const res2 = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: enroll1 });
        assertStrict(res2.type === 'denied', "Sequential duplicate natively yields 'denied'");
        log("Sequential duplicate remains denied");

        let acAfter = await getAcademicCoreSnapshot();
        assertStrict(JSON.stringify(acBefore) === JSON.stringify(acAfter), "Academic Core unmutated during initial creation and sequential duplicate check");
        log("Academic Core no-mutation proven around initial creation");

        // 3. True Concurrency Race
        const pRace = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const mRace = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, pRace])).rows[0].id;
        const enrollRace = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU052_VERIFIER')
            RETURNING id
        `, [t1, mRace, year1, group1, period1])).rows[0].id;

        acBefore = await getAcademicCoreSnapshot();

        const proxyPool = new Pool({ connectionString: testUrl.toString() });
        const originalQuery = proxyPool.query.bind(proxyPool);
        let insertCount = 0;
        let resolveBarrier: () => void;
        const barrierPromise = new Promise<void>(resolve => { resolveBarrier = resolve; });

        let loserGot23505 = false;
        let loserGotExactConstraint = false;

        (proxyPool as any).query = async (text: string, values?: any[]) => {
            if (text.match(/INSERT INTO secure_assessment_exam_participants/i)) {
                insertCount++;
                if (insertCount === 2) {
                    resolveBarrier();
                }
                await barrierPromise;
                try {
                    return await originalQuery(text, values);
                } catch (e: any) {
                    if (e.code === '23505') {
                        loserGot23505 = true;
                        if (e.constraint === 'uq_sa_exam_participants_tenant_instance_person') {
                            loserGotExactConstraint = true;
                        }
                    }
                    throw e;
                }
            }
            return originalQuery(text, values);
        };

        const results = await Promise.all([
            createExamParticipantAcademicEnrollment(proxyPool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: enrollRace }),
            createExamParticipantAcademicEnrollment(proxyPool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: enrollRace })
        ]);

        let createdCount = 0;
        let deniedCount = 0;
        for (const r of results) {
            if (r.type === 'created') createdCount++;
            if (r.type === 'denied') deniedCount++;
        }

        assertStrict(createdCount === 1, "Exactly 1 successful authoritative creation in race");
        assertStrict(deniedCount === 1, "Exactly 1 denial in race");
        assertStrict(loserGot23505, "Loser actually reached the DB and got 23505");
        assertStrict(loserGotExactConstraint, "Loser actually hit the exact constraint uq_sa_exam_participants_tenant_instance_person");

        const raceRows = (await mainClient.query(`SELECT count(*) FROM public.secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND person_id = $3`, [t1, exam1, pRace])).rows[0].count;
        assertStrict(Number(raceRows) === 1, "Final matching participant rows exactly 1 after race");
        log("True concurrent same logical creation proven");
        await proxyPool.end();

        acAfter = await getAcademicCoreSnapshot();
        assertStrict(JSON.stringify(acBefore) === JSON.stringify(acAfter), "Academic Core unmutated during true concurrency race");
        log("Academic Core no-mutation proven around true concurrency race");

        // 4. Different Person same Exam Instance remains allowed
        const pOther = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const mOther = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, pOther])).rows[0].id;
        const enrollOther = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU052_VERIFIER')
            RETURNING id
        `, [t1, mOther, year1, group1, period1])).rows[0].id;

        acBefore = await getAcademicCoreSnapshot();
        const resOther = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: enrollOther });
        assertStrict(resOther.type === 'created', "Different Person same Exam Instance remains allowed");
        acAfter = await getAcademicCoreSnapshot();
        assertStrict(JSON.stringify(acBefore) === JSON.stringify(acAfter), "Academic Core unmutated during different person enrollment check");
        log("Academic Core no-mutation proven around different person enrollment");

        // 5. Same Person different Exam Instance remains allowed
        const exam2 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id`, [t1])).rows[0].id;

        acBefore = await getAcademicCoreSnapshot();
        const resDiffExam = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam2, academicEnrollmentId: enroll1 });
        assertStrict(resDiffExam.type === 'created', "Same Person different Exam Instance remains allowed");
        log("Non-collision semantics proven");
        acAfter = await getAcademicCoreSnapshot();
        assertStrict(JSON.stringify(acBefore) === JSON.stringify(acAfter), "Academic Core unmutated during different exam enrollment check");
        log("Academic Core no-mutation proven around different exam enrollment");

        // 6. Tenant isolation preservation
        const t2 = (await mainClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const pT2 = (await mainClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
        const mT2 = (await mainClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t2, pT2])).rows[0].id;
        const yearT2 = (await mainClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t2])).rows[0].id;
        const periodT2 = (await mainClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem A', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t2, yearT2])).rows[0].id;
        const gradeT2 = (await mainClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade A') RETURNING id`, [t2])).rows[0].id;
        const groupT2 = (await mainClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'Group A') RETURNING id`, [t2, yearT2, gradeT2])).rows[0].id;
        const enrollT2 = (await mainClient.query(`
            INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source)
            VALUES ($1, $2, $3, $4, $5, '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU052_VERIFIER')
            RETURNING id
        `, [t2, mT2, yearT2, groupT2, periodT2])).rows[0].id;
        const examT2 = (await mainClient.query(`INSERT INTO public.secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id`, [t2])).rows[0].id;

        acBefore = await getAcademicCoreSnapshot();
        // cross tenant
        const resTenantLeak = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: enrollT2 });
        assertStrict(resTenantLeak.type === 'creation_unavailable' || resTenantLeak.type === 'denied', "Tenant isolation blocks cross-tenant usage");

        acAfter = await getAcademicCoreSnapshot();
        assertStrict(JSON.stringify(acBefore) === JSON.stringify(acAfter), "Academic Core unmutated during cross-tenant isolation check");
        log("Academic Core no-mutation proven around cross-tenant check");

        const attemptsCount = (await mainClient.query(`SELECT count(*) FROM pg_class WHERE relname = 'secure_assessment_exam_attempts'`)).rows[0].count;
        if (Number(attemptsCount) > 0) {
            const attemptData = (await mainClient.query(`SELECT count(*) FROM secure_assessment_exam_attempts`)).rows[0].count;
            assertStrict(Number(attemptData) === 0, "No Attempt creation");
        }

        const sessionsCount = (await mainClient.query(`SELECT count(*) FROM pg_class WHERE relname = 'secure_assessment_exam_sessions'`)).rows[0].count;
        if (Number(sessionsCount) > 0) {
            const sessionData = (await mainClient.query(`SELECT count(*) FROM secure_assessment_exam_sessions`)).rows[0].count;
            assertStrict(Number(sessionData) === 0, "No Exam Session creation");
        }
        log("no Exam Session creation");

    } catch (e: any) {
        caughtError = e;
        console.error("FAIL:", e);
    } finally {
        let cleanupFailed = false;

        const attemptClose = async (resource: any) => {
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
                if (!caughtError) caughtError = e as Error;
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
            log("BU-052 VERIFIER PASS");
            process.exitCode = 0;
        }
    }
}

runTest().catch(e => {
    console.error("FATAL ERROR", e);
    process.exitCode = 1;
});
