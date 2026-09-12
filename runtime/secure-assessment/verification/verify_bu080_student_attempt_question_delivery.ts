import { Client, Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { handleQuestionDelivery, type QuestionDeliveryDependencies } from '../src/question-delivery.ts';

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

class MockReq {
  method = 'GET';
  url = '';
  headers: Record<string, string> = {};
}

class MockRes {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = '';
  onEnd: () => void = () => {};
  endPromise = new Promise<void>(resolve => { this.onEnd = resolve; });

  writeHead(status: number, headers: Record<string, string>) {
    this.statusCode = status;
    this.headers = headers;
  }

  end(chunk: string) {
    this.body = chunk;
    this.onEnd();
  }
}

async function snapshotTable(client: Client, tableName: string) {
  const countRes = await client.query(`SELECT COUNT(*) as count FROM public.${tableName}`);
  const rowsRes = await client.query(`SELECT * FROM public.${tableName} ORDER BY id`);
  return {
    count: parseInt(countRes.rows[0].count, 10),
    rows: JSON.stringify(rowsRes.rows)
  };
}

async function runVerification() {
  let dbName = '';
  let rootClient: Client | null = null;
  let testClient: Client | null = null;
  let testPool: Pool | null = null;
  let dbCleanedUp = false;

  try {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    rootClient = new Client(clientConfig(adminUrl.toString()));
    await rootClient.connect();

    // 0. Pre-run leak check: verify zero elligble_bu080_ databases exist
    const preRunLeakRes = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu080_%'`
    );
    if (preRunLeakRes.rowCount !== null && preRunLeakRes.rowCount > 0) {
      throw new Error(`PRE-RUN LEAK DETECTED: Found ${preRunLeakRes.rowCount} dangling database(s) matching elligble_bu080_%`);
    }
    console.log('PRE-RUN ZERO-LEAK: PASS');

    // Create disposable database
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu080_${runId}`;
    await rootClient.query(`CREATE DATABASE "${dbName}"`);

    const testUrl = new URL(dbUrl);
    testUrl.pathname = `/${dbName}`;

    testClient = new Client(clientConfig(testUrl.toString()));
    await testClient.connect();

    testPool = new Pool(clientConfig(testUrl.toString()));

    // 1. Discover migrations
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const sqlFiles = files
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort((a, b) => a.localeCompare(b));

    // 2. Prove migration 0035 does NOT exist
    const migration0035 = sqlFiles.find((f) => f.startsWith('0035_'));
    if (migration0035) {
      throw new Error(`Migration 0035 must NOT exist, but found: ${migration0035}`);
    }
    console.log('MIGRATION 0035: ABSENT');

    // 3. Discover and apply canonical migrations 0001..0034
    for (let i = 1; i <= 34; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFiles = sqlFiles.filter((f) => f.startsWith(`${prefix}_`));
      if (matchingFiles.length !== 1) {
        throw new Error(`Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`);
      }
      const filePath = path.join(MIGRATIONS_DIR, matchingFiles[0]);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    // 4. Prove migration history is exactly 34
    const migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 34) {
      throw new Error(`Expected exactly 34 migrations applied, got ${migrationHistory.rows[0].count}`);
    }
    console.log('MIGRATION HISTORY: 34');

    // 5. Canonical Fixtures Setup
    // Tenant A
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherPersonA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const studentPersonA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherMemberA = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, teacherPersonA])).rows[0].id;
    const teacherAssignmentA = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, teacherMemberA])).rows[0].id;

    const academicYearA = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const academicPeriodA = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, academicYearA])).rows[0].id;
    const subjectA = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Mathematics') RETURNING id`, [tenantA])).rows[0].id;
    const gradeLevelA = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantA])).rows[0].id;
    const academicGroupA = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [tenantA, academicYearA, gradeLevelA])).rows[0].id;
    const subjectOfferingA = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subjectA, academicPeriodA, gradeLevelA])).rows[0].id;
    const teachingAssignmentA = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacherAssignmentA, subjectOfferingA, academicGroupA])).rows[0].id;
    const assessmentTypeA = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE') RETURNING id`, [tenantA])).rows[0].id;

    // Tenant B (for cross-tenant / isolation tests)
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    // Helper to create exam instance
    async function createExamInstance(tenant: string, lifecycle = 'ACTIVE') {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
          window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
        ) VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
        RETURNING id
      `, [tenant, teachingAssignmentA, assessmentTypeA, lifecycle]);
      return res.rows[0].id as string;
    }

    // Helper to create participant
    async function createParticipant(tenant: string, examInstanceId: string, personId: string) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [tenant, examInstanceId, personId]);
      return res.rows[0].id as string;
    }

    // Helper to create attempt
    async function createAttempt(tenant: string, participantId: string) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id)
        VALUES ($1, $2)
        RETURNING id
      `, [tenant, participantId]);
      return res.rows[0].id as string;
    }

    // Helper to create session
    async function createSession(tenant: string, attemptId: string, activated: boolean, ended: boolean) {
      const activatedAt = activated ? 'NOW()' : 'NULL';
      const endedAt = ended ? 'NOW()' : 'NULL';
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_sessions (tenant_id, exam_attempt_id, activated_at, ended_at)
        VALUES ($1, $2, ${activatedAt}, ${endedAt})
        RETURNING id
      `, [tenant, attemptId]);
      return res.rows[0].id as string;
    }

    // Helper to create timer state
    async function createTimerState(tenant: string, attemptId: string, started: boolean, expired: boolean) {
      let startedAt = 'NULL';
      if (started) {
        startedAt = expired ? "NOW() - INTERVAL '4000 seconds'" : "NOW() - INTERVAL '60 seconds'";
      }
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_timer_state (
          tenant_id, exam_attempt_id, configured_duration_seconds, started_at
        ) VALUES ($1, $2, 3600, ${startedAt})
        RETURNING id
      `, [tenant, attemptId]);
      return res.rows[0].id as string;
    }

    // Question Bank Item for snapshot source FK
    const qbItemRes = await testClient.query(`
      INSERT INTO public.secure_assessment_question_bank_items (tenant_id, content_payload)
      VALUES ($1, '{"prompt":"Source QB Item"}')
      RETURNING id
    `, [tenantA]);
    const qbItemId = qbItemRes.rows[0].id as string;

    // Helper to create valid frozen content
    function makeFrozenContent(promptText: string, correctOptionId = 'opt-1', maxScore = 10) {
      return {
        schemaVersion: 1,
        questionType: 'MULTIPLE_CHOICE_SINGLE',
        prompt: { text: promptText, hint: 'none' },
        options: [
          { id: 'opt-1', content: { text: 'Pilihan A' } },
          { id: 'opt-2', content: { text: 'Pilihan B' } },
          { id: 'opt-3', content: { text: 'Pilihan C' } },
          { id: 'opt-4', content: { text: 'Pilihan D' } },
          { id: 'opt-5', content: { text: 'Pilihan E' } }
        ],
        correctOptionId,
        maxScore
      };
    }

    // Question snapshot helper
    async function createQuestionSnapshot(tenant: string, examInstanceId: string, customId: string, content: any) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_question_snapshots (
          id, tenant_id, exam_instance_id, source_question_bank_item_id, frozen_content
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [customId, tenant, examInstanceId, qbItemId, JSON.stringify(content)]);
      return res.rows[0].id as string;
    }

    // --- FIXTURE SET A: Canonical Happy Path (Exam Instance ACTIVE, Session Active, Timer Active, 3 Snapshots) ---
    const exam1Id = await createExamInstance(tenantA, 'ACTIVE');
    const part1Id = await createParticipant(tenantA, exam1Id, studentPersonA);
    const attempt1Id = await createAttempt(tenantA, part1Id);
    await createSession(tenantA, attempt1Id, true, false);
    await createTimerState(tenantA, attempt1Id, true, false);

    // Insert 3 snapshots with specific IDs to verify deterministic ORDER BY id ASC
    const snapIdC = 'aaaaaaaa-1111-4111-8111-333333333333';
    const snapIdA = 'aaaaaaaa-1111-4111-8111-111111111111';
    const snapIdB = 'aaaaaaaa-1111-4111-8111-222222222222';
    // Insert out of sorted order
    await createQuestionSnapshot(tenantA, exam1Id, snapIdC, makeFrozenContent('Prompt C', 'opt-3', 15));
    await createQuestionSnapshot(tenantA, exam1Id, snapIdA, makeFrozenContent('Prompt A', 'opt-1', 10));
    await createQuestionSnapshot(tenantA, exam1Id, snapIdB, makeFrozenContent('Prompt B', 'opt-2', 5));

    // --- FIXTURE SET B: Non-ACTIVE Exam Instance (SCHEDULED) ---
    const examScheduledId = await createExamInstance(tenantA, 'SCHEDULED');
    const partScheduledId = await createParticipant(tenantA, examScheduledId, studentPersonA);
    const attemptScheduledId = await createAttempt(tenantA, partScheduledId);
    await createSession(tenantA, attemptScheduledId, true, false);
    await createTimerState(tenantA, attemptScheduledId, true, false);

    // --- FIXTURE SET C: No active Session (no session row) ---
    const examNoSessId = await createExamInstance(tenantA, 'ACTIVE');
    const partNoSessId = await createParticipant(tenantA, examNoSessId, studentPersonA);
    const attemptNoSessId = await createAttempt(tenantA, partNoSessId);
    await createTimerState(tenantA, attemptNoSessId, true, false);

    // --- FIXTURE SET D: Inactive Session (ended_at is NOT NULL) ---
    const examEndedSessId = await createExamInstance(tenantA, 'ACTIVE');
    const partEndedSessId = await createParticipant(tenantA, examEndedSessId, studentPersonA);
    const attemptEndedSessId = await createAttempt(tenantA, partEndedSessId);
    await createSession(tenantA, attemptEndedSessId, true, true);
    await createTimerState(tenantA, attemptEndedSessId, true, false);

    // --- FIXTURE SET E: Missing Timer ---
    const examNoTimerId = await createExamInstance(tenantA, 'ACTIVE');
    const partNoTimerId = await createParticipant(tenantA, examNoTimerId, studentPersonA);
    const attemptNoTimerId = await createAttempt(tenantA, partNoTimerId);
    await createSession(tenantA, attemptNoTimerId, true, false);

    // --- FIXTURE SET F: Timer Not Started ---
    const examTimerNotStartedId = await createExamInstance(tenantA, 'ACTIVE');
    const partTimerNotStartedId = await createParticipant(tenantA, examTimerNotStartedId, studentPersonA);
    const attemptTimerNotStartedId = await createAttempt(tenantA, partTimerNotStartedId);
    await createSession(tenantA, attemptTimerNotStartedId, true, false);
    await createTimerState(tenantA, attemptTimerNotStartedId, false, false);

    // --- FIXTURE SET G: Expired Timer ---
    const examExpiredTimerId = await createExamInstance(tenantA, 'ACTIVE');
    const partExpiredTimerId = await createParticipant(tenantA, examExpiredTimerId, studentPersonA);
    const attemptExpiredTimerId = await createAttempt(tenantA, partExpiredTimerId);
    await createSession(tenantA, attemptExpiredTimerId, true, false);
    await createTimerState(tenantA, attemptExpiredTimerId, true, true);

    // --- FIXTURE SET H: Submitted Attempt ---
    const examSubmittedId = await createExamInstance(tenantA, 'ACTIVE');
    const partSubmittedId = await createParticipant(tenantA, examSubmittedId, studentPersonA);
    const attemptSubmittedId = await createAttempt(tenantA, partSubmittedId);
    await createSession(tenantA, attemptSubmittedId, true, false);
    await createTimerState(tenantA, attemptSubmittedId, true, false);
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_submissions (tenant_id, exam_attempt_id)
      VALUES ($1, $2)
    `, [tenantA, attemptSubmittedId]);

    // --- FIXTURE SET I: Invalid BU-066 frozen content ---
    const examInvalidContentId = await createExamInstance(tenantA, 'ACTIVE');
    const partInvalidContentId = await createParticipant(tenantA, examInvalidContentId, studentPersonA);
    const attemptInvalidContentId = await createAttempt(tenantA, partInvalidContentId);
    await createSession(tenantA, attemptInvalidContentId, true, false);
    await createTimerState(tenantA, attemptInvalidContentId, true, false);
    await createQuestionSnapshot(tenantA, examInvalidContentId, 'bbbbbbbb-2222-4222-8222-111111111111', {
      schemaVersion: 1,
      questionType: 'INVALID_TYPE'
    });

    // 6. Before Snapshots for ZERO MUTATION proof
    const tablesToTrack = [
      'tenant_tenants',
      'identity_persons',
      'tenant_memberships',
      'tenant_teacher_assignments',
      'academic_core_academic_years',
      'academic_core_academic_periods',
      'academic_core_subjects',
      'academic_core_grade_levels',
      'academic_core_academic_groups',
      'academic_core_subject_offerings',
      'academic_core_teaching_assignments',
      'secure_assessment_assessment_types',
      'secure_assessment_exam_instances',
      'secure_assessment_exam_participants',
      'secure_assessment_exam_attempts',
      'secure_assessment_exam_sessions',
      'secure_assessment_timer_state',
      'secure_assessment_timer_adjustments',
      'secure_assessment_exam_submissions',
      'secure_assessment_question_bank_items',
      'secure_assessment_exam_question_snapshots'
    ];

    const beforeSnapshots: Record<string, { count: number; rows: string }> = {};
    for (const tbl of tablesToTrack) {
      beforeSnapshots[tbl] = await snapshotTable(testClient, tbl);
    }

    // Helper to invoke handleQuestionDelivery
    async function invokeDelivery(tenant: string, authorizedAttempt: string, url: string, pool: Pool = testPool!) {
      const req = new MockReq() as unknown as http.IncomingMessage;
      req.url = url;
      (req as any).method = 'GET';
      const res = new MockRes() as unknown as http.ServerResponse;
      const deps: QuestionDeliveryDependencies = {
        pool,
        getAuthorizedContext: () => ({ tenantId: tenant, authorizedAttemptId: authorizedAttempt })
      };
      await handleQuestionDelivery(req, res, deps);
      return {
        status: (res as any).statusCode,
        body: JSON.parse((res as any).body)
      };
    }

    // -------------------------------------------------------------
    // TEST 1: Tenant isolation & resolution
    // -------------------------------------------------------------
    // Call Attempt 1 with Tenant B context -> 404
    const resTenantB = await invokeDelivery(tenantB, attempt1Id, `/api/v1/assessment/questions?attemptId=${attempt1Id}`);
    if (resTenantB.status !== 404 || resTenantB.body.error !== 'assessment_context_not_found') {
      throw new Error(`Test 1 Failed: Expected 404 assessment_context_not_found for cross-tenant access, got ${resTenantB.status} ${JSON.stringify(resTenantB.body)}`);
    }
    console.log('TENANT ISOLATION: PASS');

    // Missing tenant-bound Attempt
    const nonExistentAttempt = '99999999-9999-4999-8999-999999999999';
    const resNonExistent = await invokeDelivery(tenantA, nonExistentAttempt, `/api/v1/assessment/questions?attemptId=${nonExistentAttempt}`);
    if (resNonExistent.status !== 404 || resNonExistent.body.error !== 'assessment_context_not_found') {
      throw new Error(`Test 1b Failed: Expected 404 for nonexistent attempt, got ${resNonExistent.status}`);
    }
    console.log('ATTEMPT RESOLUTION: PASS');

    // -------------------------------------------------------------
    // TEST 2: ACTIVE Exam Instance requirement
    // -------------------------------------------------------------
    const resScheduled = await invokeDelivery(tenantA, attemptScheduledId, `/api/v1/assessment/questions?attemptId=${attemptScheduledId}`);
    if (resScheduled.status !== 409 || resScheduled.body.error !== 'exam_not_active') {
      throw new Error(`Test 2 Failed: Expected 409 exam_not_active for SCHEDULED exam, got ${resScheduled.status} ${JSON.stringify(resScheduled.body)}`);
    }
    console.log('ACTIVE EXAM GATE: PASS');

    // -------------------------------------------------------------
    // TEST 3: Active Session requirement
    // -------------------------------------------------------------
    const resNoSess = await invokeDelivery(tenantA, attemptNoSessId, `/api/v1/assessment/questions?attemptId=${attemptNoSessId}`);
    if (resNoSess.status !== 409 || resNoSess.body.error !== 'session_not_active') {
      throw new Error(`Test 3a Failed: Expected 409 session_not_active when no session, got ${resNoSess.status}`);
    }

    const resEndedSess = await invokeDelivery(tenantA, attemptEndedSessId, `/api/v1/assessment/questions?attemptId=${attemptEndedSessId}`);
    if (resEndedSess.status !== 409 || resEndedSess.body.error !== 'session_not_active') {
      throw new Error(`Test 3b Failed: Expected 409 session_not_active when session ended, got ${resEndedSess.status}`);
    }
    console.log('ACTIVE SESSION GATE: PASS');

    // -------------------------------------------------------------
    // TEST 4: Authoritative Timer Gate
    // -------------------------------------------------------------
    // Missing timer state -> 404
    const resNoTimer = await invokeDelivery(tenantA, attemptNoTimerId, `/api/v1/assessment/questions?attemptId=${attemptNoTimerId}`);
    if (resNoTimer.status !== 404 || resNoTimer.body.error !== 'assessment_context_not_found') {
      throw new Error(`Test 4a Failed: Expected 404 when timer missing, got ${resNoTimer.status}`);
    }

    // Timer not started -> 409 timer_not_started
    const resTimerNotStarted = await invokeDelivery(tenantA, attemptTimerNotStartedId, `/api/v1/assessment/questions?attemptId=${attemptTimerNotStartedId}`);
    if (resTimerNotStarted.status !== 409 || resTimerNotStarted.body.error !== 'timer_not_started') {
      throw new Error(`Test 4b Failed: Expected 409 timer_not_started, got ${resTimerNotStarted.status}`);
    }

    // Expired timer -> 409 timer_expired
    const resExpiredTimer = await invokeDelivery(tenantA, attemptExpiredTimerId, `/api/v1/assessment/questions?attemptId=${attemptExpiredTimerId}`);
    if (resExpiredTimer.status !== 409 || resExpiredTimer.body.error !== 'timer_expired') {
      throw new Error(`Test 4c Failed: Expected 409 timer_expired, got ${resExpiredTimer.status}`);
    }
    console.log('AUTHORITATIVE TIMER GATE: PASS');

    // -------------------------------------------------------------
    // TEST 5: Submitted Attempt Gate
    // -------------------------------------------------------------
    const resSubmitted = await invokeDelivery(tenantA, attemptSubmittedId, `/api/v1/assessment/questions?attemptId=${attemptSubmittedId}`);
    if (resSubmitted.status !== 409 || resSubmitted.body.error !== 'attempt_already_submitted') {
      throw new Error(`Test 5 Failed: Expected 409 attempt_already_submitted, got ${resSubmitted.status}`);
    }
    console.log('SUBMITTED ATTEMPT GATE: PASS');

    // -------------------------------------------------------------
    // TEST 6: BU-066 Content Validation Failure
    // -------------------------------------------------------------
    const resInvalidContent = await invokeDelivery(tenantA, attemptInvalidContentId, `/api/v1/assessment/questions?attemptId=${attemptInvalidContentId}`);
    if (resInvalidContent.status !== 500 || resInvalidContent.body.error !== 'internal_error') {
      throw new Error(`Test 6 Failed: Expected 500 internal_error on invalid BU-066 content, got ${resInvalidContent.status}`);
    }
    // Verify blocker name is NOT leaked
    if (JSON.stringify(resInvalidContent.body).includes('question_type_invalid')) {
      throw new Error(`Test 6 Blocker Leak: Found blocker details in response`);
    }
    console.log('BU-066 CONTENT VALIDATION REUSED: YES');

    // -------------------------------------------------------------
    // TEST 7: Valid ACTIVE Runtime Happy Path & Student-Safe Projection
    // -------------------------------------------------------------
    const resHappy = await invokeDelivery(tenantA, attempt1Id, `/api/v1/assessment/questions?attemptId=${attempt1Id}`);
    if (resHappy.status !== 200) {
      throw new Error(`Test 7 Failed: Expected 200, got ${resHappy.status} ${JSON.stringify(resHappy.body)}`);
    }

    const data = resHappy.body;
    if (data.attemptId !== attempt1Id) {
      throw new Error(`Test 7 Failed: attemptId mismatch`);
    }
    if (!Array.isArray(data.questions) || data.questions.length !== 3) {
      throw new Error(`Test 7 Failed: Expected 3 questions, got ${data.questions?.length}`);
    }

    // Deterministic ordering: snapIdA < snapIdB < snapIdC
    if (
      data.questions[0].snapshotId !== snapIdA ||
      data.questions[1].snapshotId !== snapIdB ||
      data.questions[2].snapshotId !== snapIdC
    ) {
      throw new Error(`Test 7 Failed: Questions not in deterministic ORDER BY id ASC order`);
    }
    console.log('DETERMINISTIC QUESTION ORDER: PASS');

    // Question delivery projection integrity & non-disclosure
    for (const q of data.questions) {
      if (q.schemaVersion !== 1) throw new Error('schemaVersion !== 1');
      if (q.questionType !== 'MULTIPLE_CHOICE_SINGLE') throw new Error('questionType invalid');
      if (!q.prompt || typeof q.prompt !== 'object') throw new Error('prompt missing or not object');
      if (!Array.isArray(q.options) || q.options.length !== 5) throw new Error('options length !== 5');
      for (const opt of q.options) {
        if (!opt.id || !opt.content) throw new Error('option missing id or content');
      }

      // Non-disclosure checks
      if ('correctOptionId' in q) throw new Error('DISCLOSURE LEAK: correctOptionId present in response');
      if ('maxScore' in q) throw new Error('DISCLOSURE LEAK: maxScore present in response');
      if ('source_question_bank_item_id' in q) throw new Error('DISCLOSURE LEAK: source_question_bank_item_id present in response');
      if ('tenant_id' in q || 'tenantId' in q) throw new Error('DISCLOSURE LEAK: tenantId present in response');
      if ('person_id' in q || 'personId' in q) throw new Error('DISCLOSURE LEAK: personId present in response');
      if ('exam_participant_id' in q || 'participantId' in q) throw new Error('DISCLOSURE LEAK: participantId present in response');
      if ('exam_instance_id' in q || 'instanceId' in q) throw new Error('DISCLOSURE LEAK: examInstanceId present in response');
    }

    console.log('CORRECT ANSWER LEAK: NO');
    console.log('MAX SCORE LEAK: NO');
    console.log('INTERNAL ID LEAK: NO');
    console.log('STUDENT-SAFE PROJECTION: PASS');

    // -------------------------------------------------------------
    // TEST 8: Database failure fails closed
    // -------------------------------------------------------------
    const failingPool = {
      connect: async () => {
        throw new Error('Simulated pool connect failure');
      }
    } as unknown as Pool;

    const resFailClosed = await invokeDelivery(tenantA, attempt1Id, `/api/v1/assessment/questions?attemptId=${attempt1Id}`, failingPool);
    if (resFailClosed.status !== 503 || resFailClosed.body.error !== 'persistence_unavailable') {
      throw new Error(`Test 8 Failed: Expected 503 persistence_unavailable on DB error, got ${resFailClosed.status}`);
    }
    console.log('DATABASE FAILURE FAIL-CLOSED: PASS');

    // -------------------------------------------------------------
    // 7. Prove READ-ONLY runtime: verify zero mutation to all tables
    // -------------------------------------------------------------
    for (const tbl of tablesToTrack) {
      const afterSnap = await snapshotTable(testClient, tbl);
      const beforeSnap = beforeSnapshots[tbl];
      if (afterSnap.count !== beforeSnap.count) {
        throw new Error(`READ-ONLY VIOLATION: table ${tbl} count changed from ${beforeSnap.count} to ${afterSnap.count}`);
      }
      if (afterSnap.rows !== beforeSnap.rows) {
        throw new Error(`READ-ONLY VIOLATION: table ${tbl} rows content mutated`);
      }
    }
    console.log('ZERO MUTATION: PASS');

    // -------------------------------------------------------------
    // 8. Cleanup disposable database
    // -------------------------------------------------------------
    await testPool.end();
    testPool = null;

    await testClient.end();
    testClient = null;

    if (rootClient && dbName) {
      await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      const checkDb = await rootClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
      if (checkDb.rowCount !== null && checkDb.rowCount > 0) {
        throw new Error(`DATABASE CLEANUP FAILED: Database ${dbName} still exists.`);
      }
      dbCleanedUp = true;
    }

    // 9. Post-run zero leak verification
    const postRunLeakRes = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu080_%'`
    );
    if (postRunLeakRes.rowCount !== null && postRunLeakRes.rowCount > 0) {
      throw new Error(`POST-RUN LEAK DETECTED: Found ${postRunLeakRes.rowCount} dangling database(s) matching elligble_bu080_%`);
    }
    console.log('POST-RUN ZERO-LEAK: PASS');
    console.log('DISPOSABLE DATABASE CLEANUP: PASS');
    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
    if (testPool) {
      try { await testPool.end(); } catch {}
    }
    if (testClient) {
      try { await testClient.end(); } catch {}
    }
    if (rootClient) {
      if (dbName && !dbCleanedUp) {
        try { await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`); } catch {}
      }
      try { await rootClient.end(); } catch {}
    }
  }
}

runVerification();
