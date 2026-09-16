import { Client, Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { handleAssignedExamsGet, type AssignedExamDiscoveryContext, type AssignedExamsResponse } from '../src/assigned-exams.ts';

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

class MockReq extends http.IncomingMessage {
  headers: Record<string, string> = {};

  constructor(method: string, url: string, headers: Record<string, string> = {}) {
    super(null as any);
    this.method = method;
    this.url = url;
    this.headers = headers;
  }
}

class MockRes extends http.ServerResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = '';
  onEnd: () => void = () => {};
  endPromise = new Promise<void>(resolve => { this.onEnd = resolve; });

  constructor(req: http.IncomingMessage) {
    super(req);
  }

  writeHead(status: number, headers?: any): this {
    this.statusCode = status;
    if (headers) {
      this.headers = headers;
    }
    return this;
  }

  end(chunk?: any): this {
    if (chunk) {
      this.body = chunk.toString();
    }
    this.onEnd();
    return this;
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

    // 0. Pre-run leak check: verify zero elligble_bu085_ databases exist
    const preRunLeakRes = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu085_%'`
    );
    if (preRunLeakRes.rowCount !== null && preRunLeakRes.rowCount > 0) {
      throw new Error(`PRE-RUN LEAK DETECTED: Found ${preRunLeakRes.rowCount} dangling database(s) matching elligble_bu085_%`);
    }
    console.log('PRE-RUN ZERO-LEAK: PASS');

    // Create disposable database
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu085_${runId}`;
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

    // 2. Discover and apply canonical migrations 0001..0034
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

    // 3. Prove migration history is exactly 34
    const migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 34) {
      throw new Error(`Expected exactly 34 migrations applied, got ${migrationHistory.rows[0].count}`);
    }
    console.log('MIGRATION HISTORY: 34 APPLIED');

    // 4. Setup Test Fixtures in Real PostgreSQL
    // Tenant A
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    // Persons in Tenant A
    const personStudent1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personStudent2 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personStudentZero = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personTeacherA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    // Academic Structure Tenant A
    const teacherMemberA = (await testClient.query(
      `INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
      [tenantA, personTeacherA]
    )).rows[0].id;
    const teacherAssignmentA = (await testClient.query(
      `INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`,
      [tenantA, teacherMemberA]
    )).rows[0].id;

    const academicYearA = (await testClient.query(
      `INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`,
      [tenantA]
    )).rows[0].id;
    const academicPeriodA = (await testClient.query(
      `INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester Ganjil', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`,
      [tenantA, academicYearA]
    )).rows[0].id;
    const gradeLevelA = (await testClient.query(
      `INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Kelas 10') RETURNING id`,
      [tenantA]
    )).rows[0].id;
    const academicGroupA = (await testClient.query(
      `INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'X-MIPA-1') RETURNING id`,
      [tenantA, academicYearA, gradeLevelA]
    )).rows[0].id;

    // Subjects
    const subjectMath = (await testClient.query(
      `INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Matematika Wajib') RETURNING id`,
      [tenantA]
    )).rows[0].id;
    const subjectPhysics = (await testClient.query(
      `INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Fisika') RETURNING id`,
      [tenantA]
    )).rows[0].id;
    const subjectIndonesian = (await testClient.query(
      `INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Bahasa Indonesia') RETURNING id`,
      [tenantA]
    )).rows[0].id;

    const offeringMath = (await testClient.query(
      `INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantA, subjectMath, academicPeriodA, gradeLevelA]
    )).rows[0].id;
    const offeringPhysics = (await testClient.query(
      `INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantA, subjectPhysics, academicPeriodA, gradeLevelA]
    )).rows[0].id;
    const offeringIndonesian = (await testClient.query(
      `INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantA, subjectIndonesian, academicPeriodA, gradeLevelA]
    )).rows[0].id;

    const teachingMath = (await testClient.query(
      `INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantA, teacherAssignmentA, offeringMath, academicGroupA]
    )).rows[0].id;
    const teachingPhysics = (await testClient.query(
      `INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantA, teacherAssignmentA, offeringPhysics, academicGroupA]
    )).rows[0].id;
    const teachingIndonesian = (await testClient.query(
      `INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantA, teacherAssignmentA, offeringIndonesian, academicGroupA]
    )).rows[0].id;

    const assessmentTypeA = (await testClient.query(
      `INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMATIF_AKHIR') RETURNING id`,
      [tenantA]
    )).rows[0].id;

    // Exam Instances Tenant A
    // Instance 1: Math
    const instanceMath = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'ACTIVE', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingMath, assessmentTypeA])).rows[0].id;

    // Instance 2: Physics
    const instancePhysics = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'ACTIVE', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingPhysics, assessmentTypeA])).rows[0].id;

    // Instance 3: Indonesian
    const instanceIndonesian = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'ACTIVE', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingIndonesian, assessmentTypeA])).rows[0].id;

    // Instance 4: Math for Student 2 only
    const instanceStudent2 = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'ACTIVE', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingMath, assessmentTypeA])).rows[0].id;

    // Exam Rooms in Tenant A
    const roomLab1 = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Lab Komputer 1') RETURNING id`,
      [tenantA, instanceMath]
    )).rows[0].id;
    const room204 = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Ruang 204') RETURNING id`,
      [tenantA, instancePhysics]
    )).rows[0].id;

    // Participants for Student 1
    const participantS1_Math = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`,
      [tenantA, instanceMath, personStudent1]
    )).rows[0].id;
    const participantS1_Physics = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`,
      [tenantA, instancePhysics, personStudent1]
    )).rows[0].id;
    const participantS1_Indonesian = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`,
      [tenantA, instanceIndonesian, personStudent1]
    )).rows[0].id;

    // Room assignments for Student 1
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, instanceMath, participantS1_Math, roomLab1]);

    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, instancePhysics, participantS1_Physics, room204]);

    // Student 1 Indonesian: NO room assignment (participant without room assignment)

    // Attempts for Student 1:
    // 1. Math: exactly 1 unsubmitted attempt
    const attemptMath = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`,
      [tenantA, participantS1_Math]
    )).rows[0].id;

    // 2. Physics: multiple attempts (one submitted, one unsubmitted)
    const attemptPhysics1 = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id, created_at) VALUES ($1, $2, NOW() - INTERVAL '2 hours') RETURNING id`,
      [tenantA, participantS1_Physics]
    )).rows[0].id;
    const submissionPhysics1 = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_submissions (tenant_id, exam_attempt_id, submitted_at) VALUES ($1, $2, NOW() - INTERVAL '1 hour') RETURNING id, submitted_at`,
      [tenantA, attemptPhysics1]
    )).rows[0];

    const attemptPhysics2 = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id, created_at) VALUES ($1, $2, NOW()) RETURNING id`,
      [tenantA, participantS1_Physics]
    )).rows[0].id;

    // 3. Indonesian: ZERO attempts (assignment without attempt)

    // Student 2: Participant in Instance 4 with 1 unsubmitted attempt
    const participantS2 = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`,
      [tenantA, instanceStudent2, personStudent2]
    )).rows[0].id;
    const attemptS2 = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`,
      [tenantA, participantS2]
    )).rows[0].id;

    // Tenant B Setup (Cross-Tenant Verification)
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personStudentB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const instanceB = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, lifecycle_state
      ) VALUES ($1, 'ACTIVE') RETURNING id
    `, [tenantB])).rows[0].id;
    const participantB = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`,
      [tenantB, instanceB, personStudentB]
    )).rows[0].id;
    const attemptB = (await testClient.query(
      `INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`,
      [tenantB, participantB]
    )).rows[0].id;

    console.log('TEST FIXTURES SETUP: PASS');

    // 5. Take Pre-Execution Table Snapshots for Zero Mutation Verification
    const tablesToTrack = [
      'secure_assessment_exam_instances',
      'secure_assessment_exam_participants',
      'secure_assessment_exam_attempts',
      'secure_assessment_exam_submissions',
      'secure_assessment_exam_participant_room_assignments',
      'secure_assessment_exam_rooms'
    ];
    const preSnapshots: Record<string, { count: number; rows: string }> = {};
    for (const t of tablesToTrack) {
      preSnapshots[t] = await snapshotTable(testClient, t);
    }
    console.log('PRE-EXECUTION TABLE SNAPSHOTS: TAKEN');

    // Helper to invoke handleAssignedExamsGet
    async function executeDiscovery(
      context: AssignedExamDiscoveryContext | null,
      requestUrl = '/api/v1/assessment/assigned-exams',
      requestHeaders: Record<string, string> = {}
    ): Promise<{ status: number; body: any }> {
      const req = new MockReq('GET', requestUrl, requestHeaders);
      const res = new MockRes(req);
      await handleAssignedExamsGet(req, res, {
        pool: testPool!,
        getAssignedExamDiscoveryContext: () => context
      });
      await res.endPromise;
      return {
        status: res.statusCode,
        body: JSON.parse(res.body)
      };
    }

    // -------------------------------------------------------------
    // Test 1: Student 1 (Tenant A, Person 1) - Correct Discovery
    // -------------------------------------------------------------
    const s1Res = await executeDiscovery({ tenantId: tenantA, personId: personStudent1 });
    if (s1Res.status !== 200) {
      throw new Error(`Expected 200 for Student 1, got ${s1Res.status}`);
    }
    const assignments: AssignedExamsResponse['assignments'] = s1Res.body.assignments;
    if (assignments.length !== 3) {
      throw new Error(`Expected exactly 3 assignments for Student 1, got ${assignments.length}`);
    }

    // Assignment 1: Math
    const mathAssignment = assignments.find(a => a.examInstanceId === instanceMath);
    if (!mathAssignment) throw new Error('Math assignment missing for Student 1');
    if (mathAssignment.subjectLabel !== 'Matematika Wajib') {
      throw new Error(`Expected subjectLabel 'Matematika Wajib', got '${mathAssignment.subjectLabel}'`);
    }
    if (mathAssignment.roomLabel !== 'Lab Komputer 1') {
      throw new Error(`Expected roomLabel 'Lab Komputer 1', got '${mathAssignment.roomLabel}'`);
    }
    if (mathAssignment.attempts.length !== 1) {
      throw new Error(`Expected exactly 1 attempt for Math, got ${mathAssignment.attempts.length}`);
    }
    if (mathAssignment.attempts[0].attemptId !== attemptMath) {
      throw new Error(`Attempt ID mismatch: expected ${attemptMath}, got ${mathAssignment.attempts[0].attemptId}`);
    }
    if (mathAssignment.attempts[0].submittedAt !== null) {
      throw new Error(`Unsubmitted attempt submittedAt must be null, got ${mathAssignment.attempts[0].submittedAt}`);
    }
    console.log('STUDENT 1 MATH ASSIGNMENT (1 unsubmitted attempt): PASS');

    // Assignment 2: Physics (Multiple attempts: 1 submitted, 1 unsubmitted)
    const physicsAssignment = assignments.find(a => a.examInstanceId === instancePhysics);
    if (!physicsAssignment) throw new Error('Physics assignment missing for Student 1');
    if (physicsAssignment.subjectLabel !== 'Fisika') {
      throw new Error(`Expected subjectLabel 'Fisika', got '${physicsAssignment.subjectLabel}'`);
    }
    if (physicsAssignment.roomLabel !== 'Ruang 204') {
      throw new Error(`Expected roomLabel 'Ruang 204', got '${physicsAssignment.roomLabel}'`);
    }
    if (physicsAssignment.attempts.length !== 2) {
      throw new Error(`Expected exactly 2 attempts for Physics, got ${physicsAssignment.attempts.length}`);
    }
    // Attempt 1: submitted
    const att1 = physicsAssignment.attempts[0];
    if (att1.attemptId !== attemptPhysics1) {
      throw new Error(`Expected first attempt to be ${attemptPhysics1}, got ${att1.attemptId}`);
    }
    if (!att1.submittedAt) {
      throw new Error('Expected submittedAt ISO timestamp on submitted attempt');
    }
    // Attempt 2: unsubmitted
    const att2 = physicsAssignment.attempts[1];
    if (att2.attemptId !== attemptPhysics2) {
      throw new Error(`Expected second attempt to be ${attemptPhysics2}, got ${att2.attemptId}`);
    }
    if (att2.submittedAt !== null) {
      throw new Error(`Expected null submittedAt on second unsubmitted attempt, got ${att2.submittedAt}`);
    }
    console.log('STUDENT 1 PHYSICS ASSIGNMENT (multiple attempts: 1 submitted, 1 unsubmitted): PASS');

    // Assignment 3: Indonesian (0 attempts)
    const indonesianAssignment = assignments.find(a => a.examInstanceId === instanceIndonesian);
    if (!indonesianAssignment) throw new Error('Indonesian assignment missing for Student 1');
    if (indonesianAssignment.subjectLabel !== 'Bahasa Indonesia') {
      throw new Error(`Expected subjectLabel 'Bahasa Indonesia', got '${indonesianAssignment.subjectLabel}'`);
    }
    if (indonesianAssignment.roomLabel !== null) {
      throw new Error(`Expected null roomLabel for Indonesian, got '${indonesianAssignment.roomLabel}'`);
    }
    if (indonesianAssignment.attempts.length !== 0) {
      throw new Error(`Expected 0 attempts for Indonesian, got ${indonesianAssignment.attempts.length}`);
    }
    console.log('STUDENT 1 INDONESIAN ASSIGNMENT (zero attempts): PASS');

    // -------------------------------------------------------------
    // Test 2: Cross-Tenant Isolation
    // -------------------------------------------------------------
    // Querying Tenant B with Student 1 (from Tenant A) -> []
    const crossTenant1 = await executeDiscovery({ tenantId: tenantB, personId: personStudent1 });
    if (crossTenant1.status !== 200 || crossTenant1.body.assignments.length !== 0) {
      throw new Error(`Cross-tenant breach: Student 1 in Tenant B returned assignments! Count: ${crossTenant1.body.assignments.length}`);
    }

    // Querying Tenant B with Student B -> only Tenant B assignment
    const tenantBStudent = await executeDiscovery({ tenantId: tenantB, personId: personStudentB });
    if (tenantBStudent.status !== 200 || tenantBStudent.body.assignments.length !== 1) {
      throw new Error(`Expected 1 assignment for Student B in Tenant B, got ${tenantBStudent.body.assignments.length}`);
    }
    if (tenantBStudent.body.assignments[0].examInstanceId !== instanceB) {
      throw new Error('Tenant B instance ID mismatch');
    }
    if (tenantBStudent.body.assignments[0].attempts[0].attemptId !== attemptB) {
      throw new Error('Tenant B attempt ID mismatch');
    }

    // Querying Tenant A with Student B (from Tenant B) -> []
    const crossTenant2 = await executeDiscovery({ tenantId: tenantA, personId: personStudentB });
    if (crossTenant2.status !== 200 || crossTenant2.body.assignments.length !== 0) {
      throw new Error(`Cross-tenant breach: Student B in Tenant A returned assignments! Count: ${crossTenant2.body.assignments.length}`);
    }
    console.log('CROSS-TENANT ISOLATION: PASS');

    // -------------------------------------------------------------
    // Test 3: Wrong-Person Isolation
    // -------------------------------------------------------------
    // Student 2 only sees Instance 4
    const s2Res = await executeDiscovery({ tenantId: tenantA, personId: personStudent2 });
    if (s2Res.status !== 200 || s2Res.body.assignments.length !== 1) {
      throw new Error(`Expected exactly 1 assignment for Student 2, got ${s2Res.body.assignments.length}`);
    }
    if (s2Res.body.assignments[0].examInstanceId !== instanceStudent2) {
      throw new Error('Student 2 saw wrong instance');
    }
    if (s2Res.body.assignments[0].attempts[0].attemptId !== attemptS2) {
      throw new Error('Student 2 saw wrong attempt');
    }

    // Student with zero assignments
    const sZeroRes = await executeDiscovery({ tenantId: tenantA, personId: personStudentZero });
    if (sZeroRes.status !== 200 || sZeroRes.body.assignments.length !== 0) {
      throw new Error(`Expected 0 assignments for student with no enrollments, got ${sZeroRes.body.assignments.length}`);
    }
    console.log('WRONG-PERSON ISOLATION & ZERO-ASSIGNMENT: PASS');

    // -------------------------------------------------------------
    // Test 4: Request Input Cannot Control Identity
    // -------------------------------------------------------------
    // Attacker tries to inject Tenant B / Student B via query params & headers
    const spoofAttempt = await executeDiscovery(
      { tenantId: tenantA, personId: personStudent1 },
      `/api/v1/assessment/assigned-exams?tenantId=${tenantB}&personId=${personStudentB}`,
      {
        'x-tenant-id': tenantB,
        'x-person-id': personStudentB
      }
    );
    if (spoofAttempt.status !== 200 || spoofAttempt.body.assignments.length !== 3) {
      throw new Error('Request input hijacked query authority');
    }
    if (spoofAttempt.body.assignments.some((a: any) => a.examInstanceId === instanceB)) {
      throw new Error('Request-supplied parameters leaked Tenant B instance');
    }
    console.log('REQUEST-SUPPLIED IDENTITY REJECTION: PASS');

    // -------------------------------------------------------------
    // Test 5: Missing / Invalid Context -> 403
    // -------------------------------------------------------------
    const missingCtx = await executeDiscovery(null);
    if (missingCtx.status !== 403) {
      throw new Error(`Expected 403 for null context, got ${missingCtx.status}`);
    }
    const invalidUuidCtx = await executeDiscovery({ tenantId: 'not-a-uuid', personId: personStudent1 });
    if (invalidUuidCtx.status !== 403) {
      throw new Error(`Expected 403 for invalid UUID context, got ${invalidUuidCtx.status}`);
    }
    console.log('FAIL-CLOSED MISSING/INVALID CONTEXT: PASS');

    // -------------------------------------------------------------
    // Test 6: Zero Mutation Proof
    // -------------------------------------------------------------
    for (const t of tablesToTrack) {
      const postSnap = await snapshotTable(testClient, t);
      if (postSnap.count !== preSnapshots[t].count) {
        throw new Error(`ZERO MUTATION VIOLATION: Table public.${t} count changed from ${preSnapshots[t].count} to ${postSnap.count}`);
      }
      if (postSnap.rows !== preSnapshots[t].rows) {
        throw new Error(`ZERO MUTATION VIOLATION: Table public.${t} row content modified!`);
      }
    }
    console.log('ZERO MUTATION VERIFICATION: PASS (all tables 100% unchanged)');

    // 8. Cleanup disposable database
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
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu085_%'`
    );
    if (postRunLeakRes.rowCount !== null && postRunLeakRes.rowCount > 0) {
      throw new Error(`POST-RUN LEAK DETECTED: Found ${postRunLeakRes.rowCount} dangling database(s) matching elligble_bu085_%`);
    }
    console.log('POST-RUN ZERO-LEAK: PASS');
    console.log('DISPOSABLE DATABASE CLEANUP: PASS');
    console.log('REAL POSTGRESQL BU-085 VERIFICATION: PASS');
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
