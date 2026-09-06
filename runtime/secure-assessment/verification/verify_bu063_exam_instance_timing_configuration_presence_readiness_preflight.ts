import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import { checkExamInstanceTimingConfigurationPresenceReadiness } from '../src/exam-instance-timing-configuration-presence-readiness-preflight.ts';

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
    dbName = `elligble_bu063_${runId}`;

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

    // Proof 4 & 5: Create same-tenant SCHEDULED Exam Instance with duration NULL and latest policy NULL -> attempt_duration_missing
    const examInstanceId = (
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
          'SCHEDULED',
          NOW(),
          NOW() + interval '2 hours',
          NULL,
          NULL
        ) RETURNING id
        `,
        [tenantA, ta1, atId]
      )
    ).rows[0].id;

    const resProof5 = await checkExamInstanceTimingConfigurationPresenceReadiness(
      testClient as any,
      tenantA,
      examInstanceId,
      genericGranted
    );
    if (
      resProof5.type !== 'not_ready' ||
      (resProof5 as any).blocker !== 'attempt_duration_missing'
    ) {
      throw new Error(
        `Proof 5 failed: expected not_ready attempt_duration_missing, got ${JSON.stringify(resProof5)}`
      );
    }

    // Proof 6: duration present + latest policy NULL -> latest_start_policy_missing
    await testClient.query(
      `
      UPDATE public.secure_assessment_exam_instances
      SET configured_attempt_duration_seconds = 3600
      WHERE id = $1
      `,
      [examInstanceId]
    );

    const resProof6 = await checkExamInstanceTimingConfigurationPresenceReadiness(
      testClient as any,
      tenantA,
      examInstanceId,
      genericGranted
    );
    if (
      resProof6.type !== 'not_ready' ||
      (resProof6 as any).blocker !== 'latest_start_policy_missing'
    ) {
      throw new Error(
        `Proof 6 failed: expected not_ready latest_start_policy_missing, got ${JSON.stringify(resProof6)}`
      );
    }

    // Proof 7, 8, 9: duration present + canonical latest policy present -> timing_configuration_presence_ready, duration and policy exact
    await testClient.query(
      `
      UPDATE public.secure_assessment_exam_instances
      SET latest_start_policy = 'REMAINING_WINDOW_ONLY'
      WHERE id = $1
      `,
      [examInstanceId]
    );

    const resProof7 = await checkExamInstanceTimingConfigurationPresenceReadiness(
      testClient as any,
      tenantA,
      examInstanceId,
      genericGranted
    );
    if (resProof7.type !== 'timing_configuration_presence_ready') {
      throw new Error(
        `Proof 7 failed: expected timing_configuration_presence_ready, got ${JSON.stringify(resProof7)}`
      );
    }
    if (resProof7.configuredAttemptDurationSeconds !== 3600) {
      throw new Error(
        `Proof 8 failed: expected duration 3600, got ${resProof7.configuredAttemptDurationSeconds}`
      );
    }
    if (resProof7.latestStartPolicy !== 'REMAINING_WINDOW_ONLY') {
      throw new Error(
        `Proof 9 failed: expected policy REMAINING_WINDOW_ONLY, got ${resProof7.latestStartPolicy}`
      );
    }

    // Proof 10: non-SCHEDULED Exam Instance -> invalid_state
    const draftInstanceId = (
      await testClient.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id,
          teaching_assignment_id,
          assessment_type_id,
          lifecycle_state,
          configured_attempt_duration_seconds,
          latest_start_policy
        ) VALUES (
          $1,
          $2,
          $3,
          'DRAFT',
          3600,
          'FULL_DURATION_BEYOND_WINDOW'
        ) RETURNING id
        `,
        [tenantA, ta1, atId]
      )
    ).rows[0].id;

    const resProof10 = await checkExamInstanceTimingConfigurationPresenceReadiness(
      testClient as any,
      tenantA,
      draftInstanceId,
      genericGranted
    );
    if (resProof10.type !== 'invalid_state') {
      throw new Error(
        `Proof 10 failed: expected invalid_state, got ${JSON.stringify(resProof10)}`
      );
    }

    // Proof 11: wrong-tenant / inaccessible -> denied
    const resProof11 = await checkExamInstanceTimingConfigurationPresenceReadiness(
      testClient as any,
      tenantB,
      examInstanceId,
      genericGranted
    );
    if (resProof11.type !== 'denied') {
      throw new Error(
        `Proof 11 failed: expected denied, got ${JSON.stringify(resProof11)}`
      );
    }

    // Proof 12: runtime does not mutate Exam Instance
    const instanceSnapshotBefore = (
      await testClient.query(
        `SELECT xmin, * FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [examInstanceId]
      )
    ).rows[0];

    await checkExamInstanceTimingConfigurationPresenceReadiness(
      testClient as any,
      tenantA,
      examInstanceId,
      genericGranted
    );

    const instanceSnapshotAfter = (
      await testClient.query(
        `SELECT xmin, * FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [examInstanceId]
      )
    ).rows[0];

    if (instanceSnapshotBefore.xmin !== instanceSnapshotAfter.xmin) {
      throw new Error('Proof 12 failed: runtime mutated Exam Instance row');
    }

    // Proof 13: runtime creates no Exam Attempt
    const attemptCount = await testClient.query(
      `SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`
    );
    if (parseInt(attemptCount.rows[0].count, 10) !== 0) {
      throw new Error('Proof 13 failed: unexpected attempt created');
    }

    // Proof 14: runtime creates no Exam Session
    const sessionCount = await testClient.query(
      `SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`
    );
    if (parseInt(sessionCount.rows[0].count, 10) !== 0) {
      throw new Error('Proof 14 failed: unexpected session created');
    }

    // Proof 15: preserve BU-054 window columns/constraints
    const windowConstraints = await testClient.query(
      `
      SELECT conname FROM pg_constraint
      WHERE conname IN ('ck_sa_exam_instances_window_pair', 'ck_sa_exam_instances_window_order')
      `
    );
    if (windowConstraints.rows.length !== 2) {
      throw new Error('Proof 15 failed: BU-054 window constraints missing');
    }

    // Proof 16: preserve BU-056 constraint: ck_sa_exam_instances_attempt_duration_positive
    const durationConstraint = await testClient.query(
      `
      SELECT conname FROM pg_constraint
      WHERE conname = 'ck_sa_exam_instances_attempt_duration_positive'
      `
    );
    if (durationConstraint.rows.length !== 1) {
      throw new Error(
        'Proof 16 failed: ck_sa_exam_instances_attempt_duration_positive missing'
      );
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
      throw new Error(
        'Proof 16 failed: negative duration did not trigger ck_sa_exam_instances_attempt_duration_positive'
      );
    }

    // Proof 17 & 18: preserve BU-057 constraint: ck_sa_exam_instances_latest_start_policy and exact latest-start allowed values physically
    const policyConstraint = await testClient.query(
      `
      SELECT conname FROM pg_constraint
      WHERE conname = 'ck_sa_exam_instances_latest_start_policy'
      `
    );
    if (policyConstraint.rows.length !== 1) {
      throw new Error(
        'Proof 17 failed: ck_sa_exam_instances_latest_start_policy missing'
      );
    }

    // Test all three allowed policy values physically
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
        [validPolicy, examInstanceId]
      );
    }

    // Test invalid policy value triggers constraint
    let caughtInvalidPolicy = false;
    try {
      await testClient.query(
        `
        UPDATE public.secure_assessment_exam_instances
        SET latest_start_policy = 'INVALID_ARBITRARY_POLICY'
        WHERE id = $1
        `,
        [examInstanceId]
      );
    } catch (err: any) {
      if (err.message.includes('ck_sa_exam_instances_latest_start_policy')) {
        caughtInvalidPolicy = true;
      }
    }
    if (!caughtInvalidPolicy) {
      throw new Error(
        'Proof 18 failed: invalid latest_start_policy did not trigger ck_sa_exam_instances_latest_start_policy'
      );
    }

    // Proof 19: preserve Academic Core schema and fixture data
    const teachingAssignmentCount = await testClient.query(
      `SELECT COUNT(*) as count FROM public.academic_core_teaching_assignments WHERE id = $1`,
      [ta1]
    );
    if (parseInt(teachingAssignmentCount.rows[0].count, 10) !== 1) {
      throw new Error('Proof 19 failed: Academic Core fixture data compromised');
    }

    // Proof 20: no migration/schema changes from BU-063
    const finalHistCount = await testClient.query(
      `SELECT COUNT(migration_id) as count FROM public.elligble_migration_history`
    );
    if (parseInt(finalHistCount.rows[0].count, 10) !== 30) {
      throw new Error('Proof 20 failed: migration count changed from 30');
    }

    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
    // Proof 21 & 22: disposable DB cleanup on PASS and FAIL, no leaked databases
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
