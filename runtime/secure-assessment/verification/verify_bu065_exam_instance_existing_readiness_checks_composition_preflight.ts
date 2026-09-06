import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import { checkExamInstanceExistingReadinessChecksCompositionPreflight } from '../src/exam-instance-existing-readiness-checks-composition-preflight.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'database', 'migrations');

const pgPassword = process.env.PGPASSWORD;

function clientConfig(connectionString: string) {
  return pgPassword
    ? { connectionString, password: pgPassword }
    : { connectionString };
}

async function runVerification() {
  let dbName = '';
  let rootClient: Client | null = null;
  let testClient: Client | null = null;

  try {
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu065_${runId}`;

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is required');

    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    rootClient = new Client(clientConfig(adminUrl.toString()));
    await rootClient.connect();
    await rootClient.query(`CREATE DATABASE "${dbName}"`);

    const testUrl = new URL(dbUrl);
    testUrl.pathname = `/${dbName}`;

    testClient = new Client(clientConfig(testUrl.toString()));
    await testClient.connect();

    // Proof 1: Canonical migrations 0001..0030 apply
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const sqlFiles = files
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort((a, b) => a.localeCompare(b));

    for (let i = 1; i <= 30; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFiles = sqlFiles.filter((f) => f.startsWith(`${prefix}_`));
      if (matchingFiles.length !== 1) {
        throw new Error(`Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`);
      }
      const filePath = path.join(MIGRATIONS_DIR, matchingFiles[0]);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    const migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 30) {
      throw new Error(`Expected exactly 30 migrations applied, got ${migrationHistory.rows[0].count}`);
    }

    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const person1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const member1 = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, person1])).rows[0].id;
    const teacher1 = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, member1])).rows[0].id;
    const year1 = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const period1 = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, year1])).rows[0].id;
    const subject1 = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics') RETURNING id`, [tenantA])).rows[0].id;
    const grade1 = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantA])).rows[0].id;
    const group1 = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [tenantA, year1, grade1])).rows[0].id;
    const offering1 = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subject1, period1, grade1])).rows[0].id;
    const ta1 = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacher1, offering1, group1])).rows[0].id;

    const atId = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE') RETURNING id`, [tenantA])).rows[0].id;
    const participantPersonId = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantMemberId = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, participantPersonId])).rows[0].id;
    const genericGranted = async () => 'granted' as const;

    async function createScheduledInstance(opts: {
      hasAssessmentType?: boolean;
      hasQuestionSnapshot?: boolean;
      hasParticipant?: boolean;
      duration?: number | null;
      policy?: string | null;
      lifecycle?: string;
    }) {
      const {
        hasAssessmentType = true,
        hasQuestionSnapshot = true,
        hasParticipant = true,
        duration = 3600,
        policy = 'FULL_DURATION_BEYOND_WINDOW',
        lifecycle = 'SCHEDULED'
      } = opts;

      const instId = (await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
        ) VALUES ($1, $2, $3, $4, TIMESTAMPTZ '2026-10-01 08:00:00Z', TIMESTAMPTZ '2026-10-01 10:00:00Z', $5, $6) RETURNING id
      `, [tenantA, ta1, hasAssessmentType ? atId : null, lifecycle, duration, policy])).rows[0].id;

      if (hasQuestionSnapshot) {
        await testClient!.query(`INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, '{}')`, [tenantA, instId]);
      }

      if (hasParticipant) {
        await testClient!.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, membership_id) VALUES ($1, $2, $3)`, [tenantA, instId, participantMemberId]);
      }

      return instId;
    }

    // 1. all five pass
    const inst1 = await createScheduledInstance({});
    const res1 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst1, genericGranted);
    if (res1.type !== 'existing_readiness_checks_pass') throw new Error(`Proof 1 failed: ${JSON.stringify(res1)}`);

    // 2. assessment type missing
    const inst2 = await createScheduledInstance({ hasAssessmentType: false });
    const res2 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst2, genericGranted);
    if (res2.type !== 'not_ready' || (res2 as any).blocker !== 'assessment_type_missing') throw new Error(`Proof 2 failed: ${JSON.stringify(res2)}`);

    // 3. question snapshot empty
    const inst3 = await createScheduledInstance({ hasQuestionSnapshot: false });
    const res3 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst3, genericGranted);
    if (res3.type !== 'not_ready' || (res3 as any).blocker !== 'question_snapshot_empty') throw new Error(`Proof 3 failed: ${JSON.stringify(res3)}`);

    // 4. participant empty
    const inst4 = await createScheduledInstance({ hasParticipant: false });
    const res4 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst4, genericGranted);
    if (res4.type !== 'not_ready' || (res4 as any).blocker !== 'participant_empty') throw new Error(`Proof 4 failed: ${JSON.stringify(res4)}`);

    // 5. attempt duration missing
    const inst5 = await createScheduledInstance({ duration: null });
    const res5 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst5, genericGranted);
    if (res5.type !== 'not_ready' || (res5 as any).blocker !== 'attempt_duration_missing') throw new Error(`Proof 5 failed: ${JSON.stringify(res5)}`);

    // 6. latest_start_policy missing
    const inst6 = await createScheduledInstance({ policy: null });
    const res6 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst6, genericGranted);
    if (res6.type !== 'not_ready' || (res6 as any).blocker !== 'latest_start_policy_missing') throw new Error(`Proof 6 failed: ${JSON.stringify(res6)}`);

    // 7. duration_window_policy_compatibility LATE_START_BLOCKED > window
    const inst7 = await createScheduledInstance({ duration: 10800, policy: 'LATE_START_BLOCKED' }); // 3 hours in a 2 hour window
    const res7 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst7, genericGranted);
    if (res7.type !== 'not_ready' || (res7 as any).blocker !== 'attempt_duration_exceeds_window') throw new Error(`Proof 7 failed: ${JSON.stringify(res7)}`);

    // 8. non-SCHEDULED
    const inst8 = await createScheduledInstance({ lifecycle: 'DRAFT' });
    const res8 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst8, genericGranted);
    if (res8.type !== 'invalid_state') throw new Error(`Proof 8 failed: ${JSON.stringify(res8)}`);

    // 9. wrong tenant
    const res9 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantB, inst1, genericGranted);
    if (res9.type !== 'denied') throw new Error(`Proof 9 failed: ${JSON.stringify(res9)}`);

    // 10. capability denied
    const res10 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst1, async () => 'denied');
    if (res10.type !== 'denied') throw new Error(`Proof 10 failed: ${JSON.stringify(res10)}`);

    // 11. capability unavailable
    const res11 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst1, async () => 'unavailable');
    if (res11.type !== 'unavailable') throw new Error(`Proof 11 failed: ${JSON.stringify(res11)}`);

    // Check no DB state mutated
    const beforeCheck = await testClient.query(`SELECT xmin, lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`, [inst1]);
    await checkExamInstanceExistingReadinessChecksCompositionPreflight(testClient as any, tenantA, inst1, genericGranted);
    const afterCheck = await testClient.query(`SELECT xmin, lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`, [inst1]);
    if (beforeCheck.rows[0].xmin !== afterCheck.rows[0].xmin) throw new Error('Proof failed: mutated xmin');
    if (beforeCheck.rows[0].lifecycle_state !== afterCheck.rows[0].lifecycle_state) throw new Error('Proof failed: mutated lifecycle_state');

    const attemptCount = await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`);
    if (parseInt(attemptCount.rows[0].count, 10) !== 0) throw new Error('Proof failed: unexpected attempt created');

    const sessionCount = await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`);
    if (parseInt(sessionCount.rows[0].count, 10) !== 0) throw new Error('Proof failed: unexpected session created');

    const academicCoreCheck = await testClient.query(`SELECT COUNT(*) as count FROM public.academic_core_teaching_assignments`);
    if (parseInt(academicCoreCheck.rows[0].count, 10) !== 1) throw new Error('Proof failed: academic core altered');

    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
    if (testClient) {
      try {
        await testClient.end();
      } catch {}
      testClient = null;
    }
    if (rootClient) {
      if (dbName) {
        try {
          await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        } catch (dropErr) {
          console.error(`Failed to drop database ${dbName}:`, dropErr);
        }
      }
      try {
        await rootClient.end();
      } catch {}
    }
  }
}

runVerification();
