import { Client } from 'pg';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { checkExamInstanceAssessmentTypeReadiness } from '../src/exam-instance-assessment-type-readiness-preflight.ts';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runVerification() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("FAIL: DATABASE_URL not set");
    process.exitCode = 1;
    return;
  }

  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const dbName = `elligble_bu060_${runId}`;
  
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = '/postgres';

  const rootClient = new Client({ connectionString: adminUrl.toString() });
  await rootClient.connect();
  
  try {
    await rootClient.query(`CREATE DATABASE "${dbName}"`);
  } catch (error) {
    console.error('Failed to create disposable database:', error);
    await rootClient.end();
    process.exitCode = 1;
    return;
  }
  
  const targetUrl = new URL(dbUrl);
  targetUrl.pathname = `/${dbName}`;
  const client = new Client({ connectionString: targetUrl.toString() });
  await client.connect();

  try {
    const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => /^\d{4}_.*\.sql$/.test(f))
        .sort();

    // 4. prove exactly one canonical migration exists for every prefix 0001 through 0030
    for (let i = 1; i <= 30; i++) {
        const prefix = String(i).padStart(4, '0') + '_';
        const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
        if (matches.length !== 1) {
            throw new Error(`Expected exactly one migration file for prefix ${prefix}, found ${matches.length}`);
        }
    }

    // 5 & 6. apply canonical migrations 0001 through 0030 in order using raw/simple query execution
    for (let i = 1; i <= 30; i++) {
        const prefix = String(i).padStart(4, '0') + '_';
        const matches = allMigrationFiles.filter(f => f.startsWith(prefix));
        const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
        await client.query(sql); // raw/simple query execution
    }

    // 7. verify migration history reaches the canonical expected state through 0030
    const histCountRes = await client.query(`SELECT COUNT(*) as c FROM public.elligble_migration_history`);
    if (parseInt(histCountRes.rows[0].c, 10) !== 30) {
        throw new Error('Migration history count is not exactly 30');
    }

    // Create Tenant and Academic Core fixtures to get valid TA
    const tenantA = (await client.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const tenantB = (await client.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const p1 = (await client.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const m1 = (await client.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, p1])).rows[0].id;
    const teacher1 = (await client.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, m1])).rows[0].id;
    const year1 = (await client.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const period1 = (await client.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, year1])).rows[0].id;
    const subject1 = (await client.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Math') RETURNING id`, [tenantA])).rows[0].id;
    const grade1 = (await client.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'G1') RETURNING id`, [tenantA])).rows[0].id;
    const group1 = (await client.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '1A') RETURNING id`, [tenantA, year1, grade1])).rows[0].id;
    const offering1 = (await client.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subject1, period1, grade1])).rows[0].id;
    const ta1 = (await client.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacher1, offering1, group1])).rows[0].id;
    const enroll1 = (await client.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE', 'BU060') RETURNING id`, [tenantA, m1, year1, group1, period1])).rows[0].id;

    // Assessment Type
    const atId = (await client.query(`
      INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label)
      VALUES ($1, 'Test Assessment Type') RETURNING id;
    `, [tenantA])).rows[0].id;

    // Exam Instances
    const eiReady = (await client.query(`
      INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
      VALUES ($1, $2, 'SCHEDULED', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', $3) RETURNING id;
    `, [tenantA, ta1, atId])).rows[0].id;

    const eiNull = (await client.query(`
      INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
      VALUES ($1, $2, 'SCHEDULED', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', NULL) RETURNING id;
    `, [tenantA, ta1])).rows[0].id;

    const eiDraft = (await client.query(`
      INSERT INTO public.secure_assessment_exam_instances (tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy, assessment_type_id)
      VALUES ($1, $2, 'DRAFT', NOW(), NOW() + interval '1 hour', 3600, 'FULL_DURATION_BEYOND_WINDOW', $3) RETURNING id;
    `, [tenantA, ta1, atId])).rows[0].id;

    // Exam Participants, Attempts, Sessions
    const partId = (await client.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id)
      VALUES ($1, $2, $3, $4) RETURNING id;
    `, [tenantA, eiReady, p1, enroll1])).rows[0].id;

    const attemptId = (await client.query(`
      INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id)
      VALUES ($1, $2) RETURNING id;
    `, [tenantA, partId])).rows[0].id;

    await client.query(`
      INSERT INTO public.secure_assessment_exam_sessions (tenant_id, exam_attempt_id)
      VALUES ($1, $2);
    `, [tenantA, attemptId]);

    // Snapshot Function
    const getTableSnapshot = async (targetClient: Client, table: string) => {
        const rows = (await targetClient.query(`SELECT xmin, * FROM public.${table} ORDER BY id`)).rows;
        return rows;
    };

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

    const getAcademicCoreDataSnapshot = async (targetClient: Client) => {
        const data: any = {};
        for (const table of protectedAcademicCoreTables) {
            data[table] = await getTableSnapshot(targetClient, table);
        }
        return data;
    };

    // Track state to prove no mutation
    const beforeEi = await getTableSnapshot(client, 'secure_assessment_exam_instances');
    const beforeAt = await getTableSnapshot(client, 'secure_assessment_assessment_types');
    const beforePart = await getTableSnapshot(client, 'secure_assessment_exam_participants');
    const beforeAttempt = await getTableSnapshot(client, 'secure_assessment_exam_attempts');
    const beforeSession = await getTableSnapshot(client, 'secure_assessment_exam_sessions');
    const beforeAc = await getAcademicCoreDataSnapshot(client);

    // 10. Prove rules
    const resReady = await checkExamInstanceAssessmentTypeReadiness(client as any, tenantA, eiReady, async () => 'granted' as const);
    if (resReady.type !== 'assessment_type_ready') throw new Error('Expected assessment_type_ready');
    if (resReady.assessmentTypeId !== atId || resReady.assessmentTypeDisplayLabel !== 'Test Assessment Type') {
      throw new Error('Exact identity mismatch');
    }

    const resNull = await checkExamInstanceAssessmentTypeReadiness(client as any, tenantA, eiNull, async () => 'granted' as const);
    if (resNull.type !== 'not_ready' || resNull.blocker !== 'assessment_type_missing') {
      throw new Error('Expected not_ready / assessment_type_missing');
    }

    const resDraft = await checkExamInstanceAssessmentTypeReadiness(client as any, tenantA, eiDraft, async () => 'granted' as const);
    if (resDraft.type !== 'invalid_state') {
      throw new Error('Expected invalid_state');
    }

    const resWrong = await checkExamInstanceAssessmentTypeReadiness(client as any, tenantB, eiReady, async () => 'granted' as const);
    if (resWrong.type !== 'denied') {
      throw new Error('Expected denied for wrong tenant');
    }

    // Check no mutation
    const afterEi = await getTableSnapshot(client, 'secure_assessment_exam_instances');
    const afterAt = await getTableSnapshot(client, 'secure_assessment_assessment_types');
    const afterPart = await getTableSnapshot(client, 'secure_assessment_exam_participants');
    const afterAttempt = await getTableSnapshot(client, 'secure_assessment_exam_attempts');
    const afterSession = await getTableSnapshot(client, 'secure_assessment_exam_sessions');
    const afterAc = await getAcademicCoreDataSnapshot(client);

    if (JSON.stringify(beforeEi) !== JSON.stringify(afterEi)) throw new Error('Mutation detected on exam_instances');
    if (JSON.stringify(beforeAt) !== JSON.stringify(afterAt)) throw new Error('Mutation detected on assessment_types');
    if (JSON.stringify(beforePart) !== JSON.stringify(afterPart)) throw new Error('Mutation detected on exam_participants');
    if (JSON.stringify(beforeAttempt) !== JSON.stringify(afterAttempt)) throw new Error('Mutation detected on exam_attempts');
    if (JSON.stringify(beforeSession) !== JSON.stringify(afterSession)) throw new Error('Mutation detected on exam_sessions');
    if (JSON.stringify(beforeAc) !== JSON.stringify(afterAc)) throw new Error('Mutation detected on academic core');

    // 8, 17. Verify migration 0030 contract remains physically present
    const colRes = await client.query(`
        SELECT c.column_name, c.data_type, c.is_nullable
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'secure_assessment_exam_instances'
          AND c.column_name = 'assessment_type_id'
    `);
    if (colRes.rows.length !== 1 || colRes.rows[0].data_type !== 'uuid' || colRes.rows[0].is_nullable !== 'YES') {
        throw new Error('Migration 0030 contract (assessment_type_id) violated');
    }

    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
    // 12. cleanup occurs on PASS and FAIL.
    await client.end();

    // Leaked disposable databases check (preservation of precedent)
    let cleanupFailed = false;
    try {
      await rootClient.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [dbName]);
      await rootClient.query(`DROP DATABASE "${dbName}"`);

      const remRes = await rootClient.query(`SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu060_%'`);
      if (remRes.rows.length > 0) {
          console.error("FAIL: Leaked disposable databases remaining:", remRes.rows.map(r => r.datname));
          cleanupFailed = true;
      }
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
      cleanupFailed = true;
    }
    await rootClient.end();

    if (cleanupFailed) {
      process.exitCode = 1;
    }
  }
}

runVerification().catch((e) => {
  console.error('FATAL ERROR', e);
  process.exitCode = 1;
});
