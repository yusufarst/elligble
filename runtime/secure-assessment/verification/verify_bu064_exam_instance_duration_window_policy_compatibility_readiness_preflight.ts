import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import { checkExamInstanceDurationWindowPolicyCompatibilityReadiness } from '../src/exam-instance-duration-window-policy-compatibility-readiness-preflight.ts';

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
    dbName = `elligble_bu064_${runId}`;

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
        throw new Error(
          `Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`
        );
      }
      const filePath = path.join(MIGRATIONS_DIR, matchingFiles[0]);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    // Proof 2: Migration history count = 30
    const migrationHistory = await testClient.query(
      'SELECT COUNT(migration_id) as count FROM public.elligble_migration_history'
    );
    if (parseInt(migrationHistory.rows[0].count, 10) !== 30) {
      throw new Error(
        `Expected exactly 30 migrations applied, got ${migrationHistory.rows[0].count}`
      );
    }

    // Proof 3: Create valid tenant / Academic Core / Teaching Assignment fixtures
    const tenantA = (
      await testClient.query(
        `INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`
      )
    ).rows[0].id;
    const tenantB = (
      await testClient.query(
        `INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`
      )
    ).rows[0].id;

    const person1 = (
      await testClient.query(
        `INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`
      )
    ).rows[0].id;
    const member1 = (
      await testClient.query(
        `INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
        [tenantA, person1]
      )
    ).rows[0].id;
    const teacher1 = (
      await testClient.query(
        `INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`,
        [tenantA, member1]
      )
    ).rows[0].id;
    const year1 = (
      await testClient.query(
        `INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`,
        [tenantA]
      )
    ).rows[0].id;
    const period1 = (
      await testClient.query(
        `INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`,
        [tenantA, year1]
      )
    ).rows[0].id;
    const subject1 = (
      await testClient.query(
        `INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics') RETURNING id`,
        [tenantA]
      )
    ).rows[0].id;
    const grade1 = (
      await testClient.query(
        `INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`,
        [tenantA]
      )
    ).rows[0].id;
    const group1 = (
      await testClient.query(
        `INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`,
        [tenantA, year1, grade1]
      )
    ).rows[0].id;
    const offering1 = (
      await testClient.query(
        `INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tenantA, subject1, period1, grade1]
      )
    ).rows[0].id;
    const ta1 = (
      await testClient.query(
        `INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [tenantA, teacher1, offering1, group1]
      )
    ).rows[0].id;

    const atId = (
      await testClient.query(
        `INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE') RETURNING id`,
        [tenantA]
      )
    ).rows[0].id;

    const genericGranted = async () => 'granted' as const;

    // Helper to create a SCHEDULED exam instance with 2-hour window (7200 seconds)
    // starts at 2026-10-01 08:00:00Z, ends at 2026-10-01 10:00:00Z
    async function createScheduledInstance(
      durationSeconds: number | null,
      latestPolicy: string | null
    ) {
      const res = await testClient!.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id,
          teaching_assignment_id,
          assessment_type_id,
          lifecycle_state,
          window_starts_at,
          window_ends_at,
          configured_attempt_duration_seconds,
          latest_start_policy
        ) VALUES (
          $1,
          $2,
          $3,
          'SCHEDULED',
          TIMESTAMPTZ '2026-10-01 08:00:00Z',
          TIMESTAMPTZ '2026-10-01 10:00:00Z',
          $4,
          $5
        ) RETURNING id
        `,
        [tenantA, ta1, atId, durationSeconds, latestPolicy]
      );
      return res.rows[0].id as string;
    }

    // Proof A: 2-hour window, 90-minute duration (5400s), FULL_DURATION_BEYOND_WINDOW => ready
    const instA = await createScheduledInstance(5400, 'FULL_DURATION_BEYOND_WINDOW');
    const resA = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instA,
      genericGranted
    );
    if (resA.type !== 'duration_window_compatibility_ready') {
      throw new Error(`Proof A failed: expected ready, got ${JSON.stringify(resA)}`);
    }
    if (resA.configuredAttemptDurationSeconds !== 5400 || resA.latestStartPolicy !== 'FULL_DURATION_BEYOND_WINDOW') {
      throw new Error(`Proof A failed: fields mismatch in ${JSON.stringify(resA)}`);
    }

    // Proof B: 2-hour window, 3-hour duration (10800s), FULL_DURATION_BEYOND_WINDOW => ready
    const instB = await createScheduledInstance(10800, 'FULL_DURATION_BEYOND_WINDOW');
    const resB = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instB,
      genericGranted
    );
    if (resB.type !== 'duration_window_compatibility_ready') {
      throw new Error(`Proof B failed: expected ready, got ${JSON.stringify(resB)}`);
    }

    // Proof C: 2-hour window, 3-hour duration (10800s), REMAINING_WINDOW_ONLY => ready
    const instC = await createScheduledInstance(10800, 'REMAINING_WINDOW_ONLY');
    const resC = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instC,
      genericGranted
    );
    if (resC.type !== 'duration_window_compatibility_ready') {
      throw new Error(`Proof C failed: expected ready, got ${JSON.stringify(resC)}`);
    }

    // Proof D: 2-hour window, 90-minute duration (5400s), LATE_START_BLOCKED => ready
    const instD = await createScheduledInstance(5400, 'LATE_START_BLOCKED');
    const resD = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instD,
      genericGranted
    );
    if (resD.type !== 'duration_window_compatibility_ready') {
      throw new Error(`Proof D failed: expected ready, got ${JSON.stringify(resD)}`);
    }

    // Proof E: 2-hour window, 2-hour duration (7200s), LATE_START_BLOCKED => ready
    const instE = await createScheduledInstance(7200, 'LATE_START_BLOCKED');
    const resE = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instE,
      genericGranted
    );
    if (resE.type !== 'duration_window_compatibility_ready') {
      throw new Error(`Proof E failed: expected ready, got ${JSON.stringify(resE)}`);
    }

    // Proof F: 2-hour window, 3-hour duration (10800s), LATE_START_BLOCKED => not_ready / attempt_duration_exceeds_window
    const instF = await createScheduledInstance(10800, 'LATE_START_BLOCKED');
    const resF = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instF,
      genericGranted
    );
    if (resF.type !== 'not_ready' || (resF as any).blocker !== 'attempt_duration_exceeds_window') {
      throw new Error(`Proof F failed: expected not_ready attempt_duration_exceeds_window, got ${JSON.stringify(resF)}`);
    }

    // Proof G: duration NULL => attempt_duration_missing
    const instG = await createScheduledInstance(null, 'FULL_DURATION_BEYOND_WINDOW');
    const resG = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instG,
      genericGranted
    );
    if (resG.type !== 'not_ready' || (resG as any).blocker !== 'attempt_duration_missing') {
      throw new Error(`Proof G failed: expected not_ready attempt_duration_missing, got ${JSON.stringify(resG)}`);
    }

    // Proof H: latest_start_policy NULL => latest_start_policy_missing
    const instH = await createScheduledInstance(3600, null);
    const resH = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instH,
      genericGranted
    );
    if (resH.type !== 'not_ready' || (resH as any).blocker !== 'latest_start_policy_missing') {
      throw new Error(`Proof H failed: expected not_ready latest_start_policy_missing, got ${JSON.stringify(resH)}`);
    }

    // Proof I: non-SCHEDULED => invalid_state
    const draftInstanceId = (
      await testClient.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id,
          teaching_assignment_id,
          assessment_type_id,
          lifecycle_state,
          window_starts_at,
          window_ends_at,
          configured_attempt_duration_seconds,
          latest_start_policy
        ) VALUES (
          $1,
          $2,
          $3,
          'DRAFT',
          TIMESTAMPTZ '2026-10-01 08:00:00Z',
          TIMESTAMPTZ '2026-10-01 10:00:00Z',
          3600,
          'FULL_DURATION_BEYOND_WINDOW'
        ) RETURNING id
        `,
        [tenantA, ta1, atId]
      )
    ).rows[0].id;

    const resI = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      draftInstanceId,
      genericGranted
    );
    if (resI.type !== 'invalid_state') {
      throw new Error(`Proof I failed: expected invalid_state, got ${JSON.stringify(resI)}`);
    }

    // Proof J: wrong tenant => denied
    const resJ = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantB,
      instA,
      genericGranted
    );
    if (resJ.type !== 'denied') {
      throw new Error(`Proof J failed: expected denied, got ${JSON.stringify(resJ)}`);
    }

    // Proof: no Exam Instance mutation
    const instanceSnapshotBefore = (
      await testClient.query(
        `SELECT xmin, * FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [instA]
      )
    ).rows[0];

    await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      testClient as any,
      tenantA,
      instA,
      genericGranted
    );

    const instanceSnapshotAfter = (
      await testClient.query(
        `SELECT xmin, * FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [instA]
      )
    ).rows[0];

    if (instanceSnapshotBefore.xmin !== instanceSnapshotAfter.xmin) {
      throw new Error('Proof failed: runtime mutated Exam Instance row');
    }

    // Proof: runtime creates no Exam Attempt
    const attemptCount = await testClient.query(
      `SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`
    );
    if (parseInt(attemptCount.rows[0].count, 10) !== 0) {
      throw new Error('Proof failed: unexpected attempt created');
    }

    // Proof: runtime creates no Exam Session
    const sessionCount = await testClient.query(
      `SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`
    );
    if (parseInt(sessionCount.rows[0].count, 10) !== 0) {
      throw new Error('Proof failed: unexpected session created');
    }

    // Proof: preserve BU-054 window columns/constraints
    const windowConstraints = await testClient.query(
      `
      SELECT conname FROM pg_constraint
      WHERE conname IN ('ck_sa_exam_instances_window_pair', 'ck_sa_exam_instances_window_order')
      `
    );
    if (windowConstraints.rows.length !== 2) {
      throw new Error('Proof failed: BU-054 window constraints missing');
    }

    // Proof: preserve BU-056 constraint: ck_sa_exam_instances_attempt_duration_positive
    const durationConstraint = await testClient.query(
      `
      SELECT conname FROM pg_constraint
      WHERE conname = 'ck_sa_exam_instances_attempt_duration_positive'
      `
    );
    if (durationConstraint.rows.length !== 1) {
      throw new Error('Proof failed: ck_sa_exam_instances_attempt_duration_positive missing');
    }

    let caughtNegativeDuration = false;
    try {
      await testClient.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id,
          lifecycle_state,
          configured_attempt_duration_seconds
        ) VALUES ($1, 'DRAFT', -10)
        `,
        [tenantA]
      );
    } catch (err: any) {
      if (err.message.includes('ck_sa_exam_instances_attempt_duration_positive')) {
        caughtNegativeDuration = true;
      }
    }
    if (!caughtNegativeDuration) {
      throw new Error('Proof failed: negative duration did not trigger ck_sa_exam_instances_attempt_duration_positive');
    }

    // Proof: preserve BU-057 constraint: ck_sa_exam_instances_latest_start_policy and all three allowed values physically
    const policyConstraint = await testClient.query(
      `
      SELECT conname FROM pg_constraint
      WHERE conname = 'ck_sa_exam_instances_latest_start_policy'
      `
    );
    if (policyConstraint.rows.length !== 1) {
      throw new Error('Proof failed: ck_sa_exam_instances_latest_start_policy missing');
    }

    for (const validPolicy of [
      'FULL_DURATION_BEYOND_WINDOW',
      'REMAINING_WINDOW_ONLY',
      'LATE_START_BLOCKED',
    ]) {
      await testClient.query(
        `
        UPDATE public.secure_assessment_exam_instances
        SET latest_start_policy = $1
        WHERE id = $2
        `,
        [validPolicy, instA]
      );
    }

    let caughtInvalidPolicy = false;
    try {
      await testClient.query(
        `
        UPDATE public.secure_assessment_exam_instances
        SET latest_start_policy = 'INVALID_ARBITRARY_POLICY'
        WHERE id = $1
        `,
        [instA]
      );
    } catch (err: any) {
      if (err.message.includes('ck_sa_exam_instances_latest_start_policy')) {
        caughtInvalidPolicy = true;
      }
    }
    if (!caughtInvalidPolicy) {
      throw new Error('Proof failed: invalid latest_start_policy did not trigger ck_sa_exam_instances_latest_start_policy');
    }

    // Proof: preserve Academic Core schema and fixture data
    const teachingAssignmentCount = await testClient.query(
      `SELECT COUNT(*) as count FROM public.academic_core_teaching_assignments WHERE id = $1`,
      [ta1]
    );
    if (parseInt(teachingAssignmentCount.rows[0].count, 10) !== 1) {
      throw new Error('Proof failed: Academic Core fixture data compromised');
    }

    // Proof: no migration/schema changes from BU-064
    const finalHistCount = await testClient.query(
      `SELECT COUNT(migration_id) as count FROM public.elligble_migration_history`
    );
    if (parseInt(finalHistCount.rows[0].count, 10) !== 30) {
      throw new Error('Proof failed: migration count changed from 30');
    }

    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
    // Disposable DB cleanup on PASS and FAIL, no leaked databases
    if (testClient) {
      try {
        await testClient.end();
      } catch {
        // ignore
      }
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
      } catch {
        // ignore
      }
    }
  }
}

runVerification();
