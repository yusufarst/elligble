import { Client, Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { handleTeacherReadinessGet, type TeacherReadinessContext, type TeacherReadinessResponse } from '../src/teacher-readiness.ts';

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

    // Create disposable database
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu087_${runId}`;
    console.log(`DISPOSABLE DATABASE CREATION: ${dbName}`);
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

    // Assume 34 migrations as of now based on previous verifier
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

    // -------------------------------------------------------------
    // FIXTURES: TENANT A
    // -------------------------------------------------------------
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    // Persons in Tenant A
    const personTeacherA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id; // multiple scheduled exams
    const personTeacherZero = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id; // zero scheduled exams
    const personTeacherRevokedTA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personTeacherRevokedTeaching = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personWrongTeacher = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    // Academic Structure Tenant A
    const academicYearA = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const academicPeriodA = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester Ganjil', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, academicYearA])).rows[0].id;
    const gradeLevelA = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Kelas 10') RETURNING id`, [tenantA])).rows[0].id;
    const academicGroupA = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'X-MIPA-1') RETURNING id`, [tenantA, academicYearA, gradeLevelA])).rows[0].id;

    const subjectMath = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Matematika') RETURNING id`, [tenantA])).rows[0].id;
    const offeringMath = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subjectMath, academicPeriodA, gradeLevelA])).rows[0].id;
    
    // Teacher A setup
    const teacherMemberA = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, personTeacherA])).rows[0].id;
    const teacherAssignmentA = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, teacherMemberA])).rows[0].id;
    const teachingMathA = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacherAssignmentA, offeringMath, academicGroupA])).rows[0].id;

    // Teacher Zero Setup
    const teacherMemberZero = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, personTeacherZero])).rows[0].id;
    const teacherAssignmentZero = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, teacherMemberZero])).rows[0].id;
    const teachingMathZero = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacherAssignmentZero, offeringMath, academicGroupA])).rows[0].id;

    // Teacher Revoked TA
    const teacherMemberRevTA = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, personTeacherRevokedTA])).rows[0].id;
    const teacherAssignmentRevTA = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id, revoked_at) VALUES ($1, $2, NOW()) RETURNING id`, [tenantA, teacherMemberRevTA])).rows[0].id;
    const teachingMathRevTA = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacherAssignmentRevTA, offeringMath, academicGroupA])).rows[0].id;

    // Teacher Revoked Teaching
    const teacherMemberRevTeaching = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, personTeacherRevokedTeaching])).rows[0].id;
    const teacherAssignmentRevTeaching = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, teacherMemberRevTeaching])).rows[0].id;
    const teachingMathRevTeaching = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id, revoked_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id`, [tenantA, teacherAssignmentRevTeaching, offeringMath, academicGroupA])).rows[0].id;

    // Assessment Type
    const assessmentTypeA = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMATIF_AKHIR') RETURNING id`, [tenantA])).rows[0].id;

    // Exam Instances
    // 1. Ready Instance (baseline pass, room not applicable) -> SCHEDULED
    const instanceReady = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
        room_based_operations_enabled, proctor_per_room_required
      ) VALUES ($1, $2, $3, 'SCHEDULED', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW', false, false)
      RETURNING id
    `, [tenantA, teachingMathA, assessmentTypeA])).rows[0].id;

    // Baseline pass requires snapshot with content
    const validSnapshotContent = JSON.stringify({
      schemaVersion: 1,
      questionType: 'MULTIPLE_CHOICE_SINGLE',
      prompt: 'Test',
      options: [{id:'1',content:'A'},{id:'2',content:'B'},{id:'3',content:'C'},{id:'4',content:'D'},{id:'5',content:'E'}],
      correctOptionId: '1',
      maxScore: 10
    });
    const qbItemReady = (await testClient.query(`INSERT INTO public.secure_assessment_question_bank_items (tenant_id) VALUES ($1) RETURNING id`, [tenantA])).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, source_question_bank_item_id, frozen_content) VALUES ($1, $2, $3, $4::jsonb)`, [tenantA, instanceReady, qbItemReady, validSnapshotContent]);

    // Add a participant to avoid participant_empty
    const personPart1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3)`, [tenantA, instanceReady, personPart1]);

    // 2. Baseline Blocker Instance -> SCHEDULED
    const instanceBaselineBlocker = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
        room_based_operations_enabled, proctor_per_room_required
      ) VALUES ($1, $2, $3, 'SCHEDULED', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW', false, false)
      RETURNING id
    `, [tenantA, teachingMathA, assessmentTypeA])).rows[0].id;
    // Missing active_question_snapshot_id

    // 3. Room/Proctor Blocker Instance -> SCHEDULED
    const instanceRoomBlocker = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
        room_based_operations_enabled, proctor_per_room_required
      ) VALUES ($1, $2, $3, 'SCHEDULED', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW', true, true)
      RETURNING id
    `, [tenantA, teachingMathA, assessmentTypeA])).rows[0].id;

    // Room pass prep for RoomBlocker instance (to pass baseline)
    const qbItemRoom = (await testClient.query(`INSERT INTO public.secure_assessment_question_bank_items (tenant_id) VALUES ($1) RETURNING id`, [tenantA])).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, source_question_bank_item_id, frozen_content) VALUES ($1, $2, $3, $4::jsonb)`, [tenantA, instanceRoomBlocker, qbItemRoom, validSnapshotContent]);
    // Leave it without participants/rooms to trigger Room Proctor blocker "participant_empty"

    // 4. Non-SCHEDULED Instance (DRAFT) -> should be excluded
    const instanceDraft = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'DRAFT', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingMathA, assessmentTypeA])).rows[0].id;

    // Instances for other teachers
    // Teacher Zero -> non-scheduled only
    const instanceZeroDraft = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state
      ) VALUES ($1, $2, $3, 'DRAFT')
      RETURNING id
    `, [tenantA, teachingMathZero, assessmentTypeA])).rows[0].id;

    // Teacher Revoked TA -> scheduled (but shouldn't be accessible)
    const instanceRevTA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state
      ) VALUES ($1, $2, $3, 'SCHEDULED')
      RETURNING id
    `, [tenantA, teachingMathRevTA, assessmentTypeA])).rows[0].id;

    // Teacher Revoked Teaching -> scheduled (but shouldn't be accessible)
    const instanceRevTeaching = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state
      ) VALUES ($1, $2, $3, 'SCHEDULED')
      RETURNING id
    `, [tenantA, teachingMathRevTeaching, assessmentTypeA])).rows[0].id;


    // -------------------------------------------------------------
    // FIXTURES: TENANT B (ISOLATION)
    // -------------------------------------------------------------
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personTeacherB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherMemberB = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantB, personTeacherB])).rows[0].id;
    const teacherAssignmentB = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantB, teacherMemberB])).rows[0].id;
    
    // Academic structural minimal for B
    const academicYearB = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantB])).rows[0].id;
    const academicPeriodB = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester Ganjil', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantB, academicYearB])).rows[0].id;
    const gradeLevelB = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Kelas 10') RETURNING id`, [tenantB])).rows[0].id;
    const academicGroupB = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'X-MIPA-1') RETURNING id`, [tenantB, academicYearB, gradeLevelB])).rows[0].id;
    const subjectB = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Biologi') RETURNING id`, [tenantB])).rows[0].id;
    const offeringB = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, subjectB, academicPeriodB, gradeLevelB])).rows[0].id;
    const teachingB = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, teacherAssignmentB, offeringB, academicGroupB])).rows[0].id;
    const assessmentTypeB = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMATIF_AKHIR') RETURNING id`, [tenantB])).rows[0].id;

    const instanceB = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state
      ) VALUES ($1, $2, $3, 'SCHEDULED')
      RETURNING id
    `, [tenantB, teachingB, assessmentTypeB])).rows[0].id;


    console.log('TEST FIXTURES SETUP: PASS');

    // -------------------------------------------------------------
    // PRE-EXECUTION SNAPSHOTS FOR ZERO MUTATION PROOF
    // -------------------------------------------------------------
    const tablesToTrack = [
      'tenant_tenants',
      'identity_persons',
      'tenant_memberships',
      'tenant_teacher_assignments',
      'academic_core_academic_years',
      'academic_core_academic_periods',
      'academic_core_grade_levels',
      'academic_core_academic_groups',
      'academic_core_subjects',
      'academic_core_subject_offerings',
      'academic_core_teaching_assignments',
      'secure_assessment_assessment_types',
      'secure_assessment_exam_instances',
      'secure_assessment_exam_rooms',
      'secure_assessment_exam_participants',
      'secure_assessment_exam_participant_room_assignments',
      'secure_assessment_exam_attempts',
      'secure_assessment_exam_sessions'
    ];
    const preSnapshots: Record<string, { count: number; rows: string }> = {};
    for (const t of tablesToTrack) {
      preSnapshots[t] = await snapshotTable(testClient, t);
    }
    console.log('PRE-EXECUTION TABLE SNAPSHOTS: TAKEN');

    async function executeApi(
      context: TeacherReadinessContext | null,
    ): Promise<{ status: number; body: any }> {
      const req = new MockReq('GET', '/api/v1/assessment/teacher-readiness');
      const res = new MockRes(req);
      await handleTeacherReadinessGet(req, res, {
        pool: testPool!,
        getTeacherReadinessContext: () => context
      });
      await res.endPromise;
      return {
        status: res.statusCode,
        body: JSON.parse(res.body)
      };
    }

    // -------------------------------------------------------------
    // SCENARIO VERIFICATIONS
    // -------------------------------------------------------------

    // 1. AUTHORIZED SAME-TENANT TEACHER (MULTIPLE EXAMS)
    const pMultiRes = await executeApi({ tenantId: tenantA, personId: personTeacherA });
    if (pMultiRes.status !== 200) throw new Error(`Expected 200, got ${pMultiRes.status}`);
    const exams: TeacherReadinessResponse['exams'] = pMultiRes.body.exams;
    if (exams.length !== 3) throw new Error(`Expected 3 scheduled exams, got ${exams.length}`);
    console.log('AUTHORIZED SAME-TENANT TEACHER (MULTIPLE EXAMS): PASS');

    // 2. NON-SCHEDULED EXCLUSION
    const draftInstance = exams.find(e => e.examInstanceId === instanceDraft);
    if (draftInstance) throw new Error('DRAFT instance leaked into scheduled projection');
    console.log('NON-SCHEDULED EXCLUSION: PASS');

    // 3. BASELINE READINESS PASS & ROOM/PROCTOR NOT APPLICABLE PROJECTION
    const eReady = exams.find(e => e.examInstanceId === instanceReady);
    if (!eReady) throw new Error('Ready instance missing');
    if (eReady.baseline.type !== 'baseline_readiness_checks_pass') throw new Error(`Expected baseline pass, got ${eReady.baseline.type}`);
    if (eReady.roomProctor.type !== 'room_proctor_readiness_not_applicable') throw new Error(`Expected room/proctor not applicable, got ${eReady.roomProctor.type}`);
    console.log('BASELINE READINESS PASS & ROOM/PROCTOR NOT APPLICABLE PROJECTION: PASS');

    // 4. BASELINE READINESS BLOCKER PROJECTION
    const eBaselineBlocker = exams.find(e => e.examInstanceId === instanceBaselineBlocker);
    if (!eBaselineBlocker) throw new Error('Baseline blocker instance missing');
    if (eBaselineBlocker.baseline.type !== 'not_ready') throw new Error(`Expected baseline not_ready, got ${eBaselineBlocker.baseline.type}`);
    console.log('BASELINE READINESS BLOCKER PROJECTION: PASS');

    // 5. ROOM/PROCTOR BLOCKER PROJECTION
    const eRoomBlocker = exams.find(e => e.examInstanceId === instanceRoomBlocker);
    if (!eRoomBlocker) throw new Error('Room blocker instance missing');
    if (eRoomBlocker.roomProctor.type !== 'not_ready') throw new Error(`Expected roomProctor not_ready, got ${eRoomBlocker.roomProctor.type}`);
    if (eRoomBlocker.roomProctor.blocker !== 'participant_empty') throw new Error(`Expected participant_empty blocker, got ${eRoomBlocker.roomProctor.blocker}`);
    console.log('ROOM/PROCTOR BLOCKER PROJECTION: PASS');

    // 6. VALID TEACHER WITH ZERO SCHEDULED EXAMS
    const pZeroRes = await executeApi({ tenantId: tenantA, personId: personTeacherZero });
    if (pZeroRes.status !== 200) throw new Error(`Expected 200, got ${pZeroRes.status}`);
    if (pZeroRes.body.exams.length !== 0) throw new Error(`Expected 0 exams, got ${pZeroRes.body.exams.length}`);
    console.log('VALID TEACHER WITH ZERO SCHEDULED EXAMS: PASS');

    // 7. WRONG SAME-TENANT TEACHER / NO LEAK
    const pWrongRes = await executeApi({ tenantId: tenantA, personId: personWrongTeacher });
    if (pWrongRes.status !== 200) throw new Error(`Expected 200, got ${pWrongRes.status}`);
    if (pWrongRes.body.exams.length !== 0) throw new Error(`Expected 0 exams for unassigned person`);
    console.log('WRONG SAME-TENANT TEACHER: PASS / NO LEAK');

    // 8. REVOKED TEACHER ASSIGNMENT / NO ACCESS
    const pRevTARes = await executeApi({ tenantId: tenantA, personId: personTeacherRevokedTA });
    if (pRevTARes.status !== 200) throw new Error(`Expected 200, got ${pRevTARes.status}`);
    if (pRevTARes.body.exams.length !== 0) throw new Error('Revoked TA must not see assignments');
    console.log('REVOKED TEACHER ASSIGNMENT: PASS / NO ACCESS');

    // 9. REVOKED TEACHING ASSIGNMENT / NO ACCESS
    const pRevTeachingRes = await executeApi({ tenantId: tenantA, personId: personTeacherRevokedTeaching });
    if (pRevTeachingRes.status !== 200) throw new Error(`Expected 200, got ${pRevTeachingRes.status}`);
    if (pRevTeachingRes.body.exams.length !== 0) throw new Error('Revoked Teaching Assignment must not see assignments');
    console.log('REVOKED TEACHING ASSIGNMENT: PASS / NO ACCESS');

    // 10. CROSS-TENANT ISOLATION
    const pCrossA = await executeApi({ tenantId: tenantB, personId: personTeacherA });
    if (pCrossA.status !== 200) throw new Error(`Expected 200, got ${pCrossA.status}`);
    if (pCrossA.body.exams.length !== 0) throw new Error('Cross-tenant leak: Tenant B saw Tenant A teacher assignments');

    const pCrossB = await executeApi({ tenantId: tenantA, personId: personTeacherB });
    if (pCrossB.status !== 200) throw new Error(`Expected 200, got ${pCrossB.status}`);
    if (pCrossB.body.exams.length !== 0) throw new Error('Cross-tenant leak: Tenant A saw Tenant B teacher assignments');
    
    const pValidB = await executeApi({ tenantId: tenantB, personId: personTeacherB });
    if (pValidB.body.exams.length !== 1) throw new Error('Tenant B teacher did not see their own exam');
    console.log('CROSS-TENANT ISOLATION: PASS / NO LEAK');

    // 11. MISSING TRUSTED CONTEXT: FAIL CLOSED
    const pMissNull = await executeApi(null);
    if (pMissNull.status !== 403) throw new Error(`Expected 403, got ${pMissNull.status}`);

    const pMissInvalid = await executeApi({ tenantId: 'invalid-uuid', personId: personTeacherA });
    if (pMissInvalid.status !== 403) throw new Error(`Expected 403, got ${pMissInvalid.status}`);
    console.log('MISSING TRUSTED CONTEXT: FAIL CLOSED');

    // 12. ZERO MUTATION: PASS
    for (const t of tablesToTrack) {
      const postSnap = await snapshotTable(testClient, t);
      if (postSnap.count !== preSnapshots[t].count || postSnap.rows !== preSnapshots[t].rows) {
        throw new Error(`ZERO MUTATION VIOLATION: Table ${t} mutated! Pre: ${preSnapshots[t].count}, Post: ${postSnap.count}`);
      }
    }
    console.log('ZERO MUTATION: PASS');

    await testPool.end();
    testPool = null;
    await testClient.end();
    testClient = null;

    // 13. DISPOSABLE DATABASE CLEANUP: PASS
    if (rootClient && dbName) {
      await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      dbCleanedUp = true;
    }
    console.log('DISPOSABLE DATABASE CLEANUP: PASS');
    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (err) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', err);
    process.exitCode = 1;
  } finally {
    if (testPool) { try { await testPool.end(); } catch {} }
    if (testClient) { try { await testClient.end(); } catch {} }
    if (rootClient) {
      if (dbName && !dbCleanedUp) { try { await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`); } catch {} }
      try { await rootClient.end(); } catch {}
    }
  }
}

runVerification();
