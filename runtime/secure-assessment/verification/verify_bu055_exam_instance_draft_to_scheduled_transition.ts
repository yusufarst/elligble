import { Client, Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import {
  transitionExamInstanceDraftToScheduled,
  type ExamInstanceSchedulingCapabilityDecision,
  type ExamInstanceSchedulingCapabilityEvaluator,
} from '../src/exam-instance-draft-to-scheduled-transition.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assertStrict(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function log(message: string) {
  console.log(`- PASS: ${message}`);
}

async function runVerification() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('FAIL: DATABASE_URL not set');
    process.exitCode = 1;
    return;
  }

  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const TEST_DB = `elligble_bu055_${runId}`;

  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = '/postgres';

  const testUrl = new URL(dbUrl);
  testUrl.pathname = `/${TEST_DB}`;

  let databaseCreated = false;
  let setupClient: Client | null = null;
  let mainClient: Client | null = null;
  let pool: Pool | null = null;
  let caughtError: Error | null = null;
  let cleanupFailed = false;

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
    const allMigrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    // 1. CANONICAL MIGRATION CHAIN PROOF 1..26
    assertStrict(
      allMigrationFiles.length >= 26,
      `Expected at least 26 canonical migrations, found ${allMigrationFiles.length}`
    );
    for (let i = 1; i <= 26; i++) {
      const prefix = String(i).padStart(4, '0') + '_';
      const matches = allMigrationFiles.filter((f) => f.startsWith(prefix));
      assertStrict(matches.length === 1, `Exactly one migration file exists for prefix ${prefix}`);
      const sql = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
      await mainClient.query(sql);
    }

    const historyRows = (
      await mainClient.query(
        `SELECT migration_id FROM elligble_migration_history ORDER BY migration_id`
      )
    ).rows;
    assertStrict(
      historyRows.length === 26,
      `Migration history count exactly 26, got ${historyRows.length}`
    );

    for (let i = 1; i <= 26; i++) {
      const prefix = String(i).padStart(4, '0') + '_';
      const filename = allMigrationFiles.find((f) => f.startsWith(prefix))!;
      const expectedId = filename.replace('.sql', '');
      assertStrict(
        historyRows[i - 1].migration_id === expectedId,
        `History migration_id equals filename for ${expectedId}`
      );
    }
    log('Strict canonical migration chain 1..26 applied and proven');

    pool = new Pool({ connectionString: testUrl.toString() });

    // 2. Set up valid Academic Core, Tenant, Identity fixtures
    const t1 = (
      await mainClient.query(
        `INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`
      )
    ).rows[0].id;
    const p1 = (
      await mainClient.query(
        `INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`
      )
    ).rows[0].id;
    const m1 = (
      await mainClient.query(
        `INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
        [t1, p1]
      )
    ).rows[0].id;
    const tc1 = (
      await mainClient.query(
        `INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`,
        [t1, m1]
      )
    ).rows[0].id;
    const y1 = (
      await mainClient.query(
        `INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`,
        [t1]
      )
    ).rows[0].id;
    const per1 = (
      await mainClient.query(
        `INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem A', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`,
        [t1, y1]
      )
    ).rows[0].id;
    const gl1 = (
      await mainClient.query(
        `INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`,
        [t1]
      )
    ).rows[0].id;
    const ag1 = (
      await mainClient.query(
        `INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`,
        [t1, y1, gl1]
      )
    ).rows[0].id;
    const s1 = (
      await mainClient.query(
        `INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics') RETURNING id`,
        [t1]
      )
    ).rows[0].id;
    const so1 = (
      await mainClient.query(
        `INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [t1, s1, per1, gl1]
      )
    ).rows[0].id;
    const ta1 = (
      await mainClient.query(
        `INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [t1, tc1, so1, ag1]
      )
    ).rows[0].id;

    // Second isolated tenant for tenant-boundary tests
    const t2 = (
      await mainClient.query(
        `INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`
      )
    ).rows[0].id;

    // Academic Core data snapshot
    const getAcademicCoreSnapshot = async () => {
      const q = async (table: string) => {
        return (await mainClient!.query(`SELECT * FROM public.${table} ORDER BY id`)).rows;
      };
      return {
        years: await q('academic_core_academic_years'),
        periods: await q('academic_core_academic_periods'),
        grades: await q('academic_core_grade_levels'),
        groups: await q('academic_core_academic_groups'),
        subjects: await q('academic_core_subjects'),
        offerings: await q('academic_core_subject_offerings'),
        teachingAssignments: await q('academic_core_teaching_assignments'),
      };
    };

    const academicCoreBefore = await getAcademicCoreSnapshot();

    const grantEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
      async (): Promise<ExamInstanceSchedulingCapabilityDecision> => 'granted';
    const deniedEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
      async (): Promise<ExamInstanceSchedulingCapabilityDecision> => 'denied';
    const unavailableEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
      async (): Promise<ExamInstanceSchedulingCapabilityDecision> => 'unavailable';
    const throwingEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
      async (): Promise<ExamInstanceSchedulingCapabilityDecision> => {
        throw new Error('Service down');
      };

    // 3. Prove DRAFT -> SCHEDULED with valid operational window
    const windowStart = new Date('2026-09-10T08:00:00.000Z');
    const windowEnd = new Date('2026-09-10T10:00:00.000Z');

    const exam1 = (
      await mainClient.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at
        ) VALUES ($1, $2, 'DRAFT', $3, $4)
        RETURNING id
      `,
        [t1, ta1, windowStart.toISOString(), windowEnd.toISOString()]
      )
    ).rows[0].id;

    const transitionResult1 = await transitionExamInstanceDraftToScheduled(
      pool,
      { tenantId: t1, examInstanceId: exam1 },
      grantEvaluator
    );

    assertStrict(
      transitionResult1.type === 'scheduled',
      `Expected result type 'scheduled', got ${transitionResult1.type}`
    );
    if (transitionResult1.type === 'scheduled') {
      assertStrict(transitionResult1.examInstanceId === exam1, 'Exam Instance ID matches');
      assertStrict(transitionResult1.tenantId === t1, 'Tenant ID matches');
      assertStrict(transitionResult1.lifecycleState === 'SCHEDULED', 'Lifecycle state is SCHEDULED');
      assertStrict(
        transitionResult1.teachingAssignmentId === ta1,
        'Teaching Assignment ID unchanged'
      );
      assertStrict(
        transitionResult1.windowStartsAt.getTime() === windowStart.getTime(),
        'windowStartsAt matches'
      );
      assertStrict(
        transitionResult1.windowEndsAt.getTime() === windowEnd.getTime(),
        'windowEndsAt matches'
      );
    }

    // Verify row in database
    const dbRow1 = (
      await mainClient.query(
        `SELECT id, tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [exam1]
      )
    ).rows[0];

    assertStrict(
      dbRow1.lifecycle_state === 'SCHEDULED',
      `Physical lifecycle_state must be SCHEDULED, got ${dbRow1.lifecycle_state}`
    );
    assertStrict(dbRow1.tenant_id === t1, 'tenant_id physically unchanged');
    assertStrict(
      dbRow1.teaching_assignment_id === ta1,
      'teaching_assignment_id physically unchanged'
    );
    assertStrict(
      new Date(dbRow1.window_starts_at).getTime() === windowStart.getTime(),
      'window_starts_at physically unchanged'
    );
    assertStrict(
      new Date(dbRow1.window_ends_at).getTime() === windowEnd.getTime(),
      'window_ends_at physically unchanged'
    );
    log('DRAFT -> SCHEDULED transition proven with exact state and unchanged metadata');

    // 4. Prove repeat/retry after success does not produce a second transition
    const retryResult = await transitionExamInstanceDraftToScheduled(
      pool,
      { tenantId: t1, examInstanceId: exam1 },
      grantEvaluator
    );
    assertStrict(
      retryResult.type === 'invalid_state',
      `Retry must return invalid_state, got ${retryResult.type}`
    );
    if (retryResult.type === 'invalid_state') {
      assertStrict(
        retryResult.currentState === 'SCHEDULED',
        `Current state reported must be SCHEDULED, got ${retryResult.currentState}`
      );
    }

    const dbRowRetry = (
      await mainClient.query(
        `SELECT lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [exam1]
      )
    ).rows[0];
    assertStrict(
      dbRowRetry.lifecycle_state === 'SCHEDULED',
      'Row remains SCHEDULED and uncorrupted after retry'
    );
    log('Repeat/retry after success safely rejected as invalid_state without mutation');

    // 5. Prove DRAFT + NULL/NULL window cannot schedule
    const examNullWindow = (
      await mainClient.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at
        ) VALUES ($1, $2, 'DRAFT', NULL, NULL)
        RETURNING id
      `,
        [t1, ta1]
      )
    ).rows[0].id;

    const nullWindowResult = await transitionExamInstanceDraftToScheduled(
      pool,
      { tenantId: t1, examInstanceId: examNullWindow },
      grantEvaluator
    );
    assertStrict(
      nullWindowResult.type === 'invalid_window',
      `Expected invalid_window for NULL operational window, got ${nullWindowResult.type}`
    );

    const dbRowNull = (
      await mainClient.query(
        `SELECT lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [examNullWindow]
      )
    ).rows[0];
    assertStrict(
      dbRowNull.lifecycle_state === 'DRAFT',
      'Instance with NULL window remains in DRAFT'
    );
    log('NULL operational window rejection proven; instance remains DRAFT');

    // 6. Prove non-DRAFT states cannot transition to SCHEDULED
    const nonDraftStates = ['READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED'];
    for (const stateName of nonDraftStates) {
      const examNonDraft = (
        await mainClient.query(
          `
          INSERT INTO public.secure_assessment_exam_instances (
            tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
          [t1, ta1, stateName, windowStart.toISOString(), windowEnd.toISOString()]
        )
      ).rows[0].id;

      const nonDraftResult = await transitionExamInstanceDraftToScheduled(
        pool,
        { tenantId: t1, examInstanceId: examNonDraft },
        grantEvaluator
      );
      assertStrict(
        nonDraftResult.type === 'invalid_state',
        `Expected invalid_state for state ${stateName}, got ${nonDraftResult.type}`
      );

      const dbRowNonDraft = (
        await mainClient.query(
          `SELECT lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`,
          [examNonDraft]
        )
      ).rows[0];
      assertStrict(
        dbRowNonDraft.lifecycle_state === stateName,
        `State ${stateName} must remain unmutated`
      );
    }
    log('Non-DRAFT states rejection proven across all lifecycle states');

    // 7. Prove tenant mismatch cannot mutate another tenant's row
    const examTenant2 = (
      await mainClient.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, lifecycle_state, window_starts_at, window_ends_at
        ) VALUES ($1, 'DRAFT', $2, $3)
        RETURNING id
      `,
        [t2, windowStart.toISOString(), windowEnd.toISOString()]
      )
    ).rows[0].id;

    const crossTenantResult = await transitionExamInstanceDraftToScheduled(
      pool,
      { tenantId: t1, examInstanceId: examTenant2 },
      grantEvaluator
    );
    assertStrict(
      crossTenantResult.type === 'denied',
      `Cross-tenant transition attempt must return denied, got ${crossTenantResult.type}`
    );

    const dbRowT2 = (
      await mainClient.query(
        `SELECT tenant_id, lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [examTenant2]
      )
    ).rows[0];
    assertStrict(dbRowT2.tenant_id === t2, 'Row remains owned by t2');
    assertStrict(dbRowT2.lifecycle_state === 'DRAFT', 'Row remains DRAFT without mutation');
    log('Cross-tenant mutation prevention proven');

    // 8. Prove authorization capability hook decisions
    const examAuthDenied = (
      await mainClient.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at
        ) VALUES ($1, $2, 'DRAFT', $3, $4)
        RETURNING id
      `,
        [t1, ta1, windowStart.toISOString(), windowEnd.toISOString()]
      )
    ).rows[0].id;

    const authDeniedResult = await transitionExamInstanceDraftToScheduled(
      pool,
      { tenantId: t1, examInstanceId: examAuthDenied },
      deniedEvaluator
    );
    assertStrict(
      authDeniedResult.type === 'denied',
      `Expected denied from denied capability evaluator, got ${authDeniedResult.type}`
    );

    const dbRowAuthDenied = (
      await mainClient.query(
        `SELECT lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [examAuthDenied]
      )
    ).rows[0];
    assertStrict(
      dbRowAuthDenied.lifecycle_state === 'DRAFT',
      'Denied authorization leaves instance in DRAFT'
    );

    const authUnavailableResult = await transitionExamInstanceDraftToScheduled(
      pool,
      { tenantId: t1, examInstanceId: examAuthDenied },
      unavailableEvaluator
    );
    assertStrict(
      authUnavailableResult.type === 'unavailable',
      `Expected unavailable from unavailable evaluator, got ${authUnavailableResult.type}`
    );

    const authThrowingResult = await transitionExamInstanceDraftToScheduled(
      pool,
      { tenantId: t1, examInstanceId: examAuthDenied },
      throwingEvaluator
    );
    assertStrict(
      authThrowingResult.type === 'unavailable',
      `Expected unavailable from throwing evaluator, got ${authThrowingResult.type}`
    );
    log('Authorization capability evaluator hook decisions (denied/unavailable) proven');

    // 9. Prove concurrent requests converge safely
    const examConcurrent = (
      await mainClient.query(
        `
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, lifecycle_state, window_starts_at, window_ends_at
        ) VALUES ($1, $2, 'DRAFT', $3, $4)
        RETURNING id
      `,
        [t1, ta1, windowStart.toISOString(), windowEnd.toISOString()]
      )
    ).rows[0].id;

    const concurrentResults = await Promise.all([
      transitionExamInstanceDraftToScheduled(pool, { tenantId: t1, examInstanceId: examConcurrent }, grantEvaluator),
      transitionExamInstanceDraftToScheduled(pool, { tenantId: t1, examInstanceId: examConcurrent }, grantEvaluator),
      transitionExamInstanceDraftToScheduled(pool, { tenantId: t1, examInstanceId: examConcurrent }, grantEvaluator),
      transitionExamInstanceDraftToScheduled(pool, { tenantId: t1, examInstanceId: examConcurrent }, grantEvaluator),
      transitionExamInstanceDraftToScheduled(pool, { tenantId: t1, examInstanceId: examConcurrent }, grantEvaluator),
    ]);

    const scheduledCount = concurrentResults.filter((r) => r.type === 'scheduled').length;
    const invalidStateCount = concurrentResults.filter((r) => r.type === 'invalid_state').length;

    assertStrict(
      scheduledCount === 1,
      `Exactly one concurrent transition must succeed as 'scheduled', got ${scheduledCount}`
    );
    assertStrict(
      invalidStateCount === 4,
      `Exactly 4 concurrent transitions must resolve to 'invalid_state', got ${invalidStateCount}`
    );

    const dbRowConcurrent = (
      await mainClient.query(
        `SELECT lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`,
        [examConcurrent]
      )
    ).rows[0];
    assertStrict(
      dbRowConcurrent.lifecycle_state === 'SCHEDULED',
      'Concurrent execution converged to exactly SCHEDULED'
    );
    log('Concurrent execution safe convergence proven');

    // 10. Prove constraint preservation (BU-053 and BU-054)
    const constraints = (
      await mainClient.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.secure_assessment_exam_instances'::regclass
    `)
    ).rows.map((r) => r.conname);

    assertStrict(
      constraints.includes('ck_sa_exam_instances_lifecycle_state'),
      'ck_sa_exam_instances_lifecycle_state constraint preserved'
    );
    assertStrict(
      constraints.includes('ck_sa_exam_instances_window_pair'),
      'ck_sa_exam_instances_window_pair constraint preserved'
    );
    assertStrict(
      constraints.includes('ck_sa_exam_instances_window_order'),
      'ck_sa_exam_instances_window_order constraint preserved'
    );
    log('BU-053 lifecycle and BU-054 operational window constraints preserved');

    // 11. Prove NO Academic Core schema or data mutation
    const academicCoreAfter = await getAcademicCoreSnapshot();
    assertStrict(
      JSON.stringify(academicCoreBefore) === JSON.stringify(academicCoreAfter),
      'Academic Core data must remain completely unmutated'
    );
    log('Zero Academic Core schema or data mutation proven');

    // 12. Prove NO Participant / Attempt / Session schema mutation
    const verifyTableColumns = async (table: string, expected: number | string[]) => {
      const res = await mainClient!.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      const expectedCount = Array.isArray(expected) ? expected.length : expected;
      assertStrict(
        res.rows.length === expectedCount,
        `Expected ${expectedCount} columns on ${table}, got ${res.rows.length}`
      );
      if (Array.isArray(expected)) {
        const actualNames = res.rows.map((r) => r.column_name);
        for (const name of expected) {
          assertStrict(actualNames.includes(name), `Expected column ${name} on ${table}`);
        }
      }
    };

    await verifyTableColumns('secure_assessment_exam_participants', 6);
    await verifyTableColumns('secure_assessment_exam_attempts', 4);
    await verifyTableColumns('secure_assessment_exam_sessions', [
      'id',
      'tenant_id',
      'exam_attempt_id',
      'created_at',
      'activated_at',
      'ended_at',
      'superseded_by_session_id',
    ]);
    log('Participant, Attempt, and Session schemas preserved with zero mutation');

  } catch (err) {
    console.error('FAIL: Verification encountered error', err);
    caughtError = err as Error;
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        console.error('FAIL: Pool closing error', e);
      }
    }
    if (mainClient) {
      try {
        await mainClient.end();
      } catch (e) {
        console.error('FAIL: Main client closing error', e);
      }
    }

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
        const dbExists = (
          await teardownClient.query(
            `SELECT count(*) FROM pg_database WHERE datname = '${TEST_DB}'`
          )
        ).rows[0].count;
        assertStrict(Number(dbExists) === 0, 'Disposable DB explicitly dropped');
        log('Disposable DB cleanup successfully verified in teardown path');
      } catch (e) {
        console.error('FAIL: DB Teardown Error', e);
        cleanupFailed = true;
        if (!caughtError) caughtError = e as Error;
      } finally {
        try {
          await teardownClient.end();
        } catch (e) {
          console.error('FAIL: Teardown Client Close Error', e);
        }
      }
    }

    if (caughtError || cleanupFailed) {
      process.exitCode = 1;
    } else {
      log('BU-055 VERIFIER PASS');
      process.exitCode = 0;
    }
  }
}

runVerification().catch((e) => {
  console.error('FATAL ERROR', e);
  process.exitCode = 1;
});
