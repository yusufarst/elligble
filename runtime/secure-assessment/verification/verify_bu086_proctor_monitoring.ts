import { Client, Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { handleProctorMonitoringGet, type ProctorMonitoringContext, type ProctorMonitoringResponse } from '../src/proctor-monitoring.ts';

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
    dbName = `elligble_bu086_${runId}`;
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
    const personTeacherA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personProctorMulti = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personProctorSingle = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personProctorZeroRooms = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personProctorZeroExams = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personProctorRevoked = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personWrongProctor = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    // Academic Structure Tenant A
    const teacherMemberA = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, personTeacherA])).rows[0].id;
    const teacherAssignmentA = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, teacherMemberA])).rows[0].id;

    const academicYearA = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const academicPeriodA = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester Ganjil', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, academicYearA])).rows[0].id;
    const gradeLevelA = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Kelas 10') RETURNING id`, [tenantA])).rows[0].id;
    const academicGroupA = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'X-MIPA-1') RETURNING id`, [tenantA, academicYearA, gradeLevelA])).rows[0].id;

    const subjectMath = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Matematika') RETURNING id`, [tenantA])).rows[0].id;
    const offeringMath = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subjectMath, academicPeriodA, gradeLevelA])).rows[0].id;
    const teachingMath = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacherAssignmentA, offeringMath, academicGroupA])).rows[0].id;
    const assessmentTypeA = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMATIF_AKHIR') RETURNING id`, [tenantA])).rows[0].id;

    // Exam Instances
    // Instance 1: Multi-Room Exam
    const instanceMath = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'ACTIVE', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingMath, assessmentTypeA])).rows[0].id;

    // Instance 2: Single-Room Exam
    const instanceSingleRoom = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'ACTIVE', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingMath, assessmentTypeA])).rows[0].id;

    // Instance 3: Zero-Rooms Exam
    const instanceZeroRooms = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'ACTIVE', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingMath, assessmentTypeA])).rows[0].id;

    // Proctor Assignments
    const paMulti = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, instanceMath, personProctorMulti])).rows[0].id;
    const paSingle = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, instanceSingleRoom, personProctorSingle])).rows[0].id;
    const paZeroRooms = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, instanceZeroRooms, personProctorZeroRooms])).rows[0].id;
    const paRevoked = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id, revoked_at) VALUES ($1, $2, $3, NOW()) RETURNING id`, [tenantA, instanceMath, personProctorRevoked])).rows[0].id;

    // Rooms for Instance Math
    const roomActive0 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room Zero Active') RETURNING id`, [tenantA, instanceMath])).rows[0].id;
    const roomActive1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room One Active') RETURNING id`, [tenantA, instanceMath])).rows[0].id;
    const roomActive2 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room Two Active') RETURNING id`, [tenantA, instanceMath])).rows[0].id;
    const roomUnrelated = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room Unrelated To Proctor') RETURNING id`, [tenantA, instanceMath])).rows[0].id;

    // Room for Instance Single Room
    const roomSingle = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room Single Only') RETURNING id`, [tenantA, instanceSingleRoom])).rows[0].id;

    // Proctor Room Assignments (epra)
    // paMulti mapped to roomActive0, roomActive1, roomActive2 (roomUnrelated is NOT mapped)
    await testClient.query(`INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, paMulti, roomActive0]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, paMulti, roomActive1]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, paMulti, roomActive2]);

    // paSingle mapped to roomSingle
    await testClient.query(`INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceSingleRoom, paSingle, roomSingle]);

    // -------------------------------------------------------------
    // PARTICIPANTS, ATTEMPTS, SESSIONS
    // -------------------------------------------------------------

    // Helper to create participant
    async function createParticipant(examInstanceId: string) {
      const personId = (await testClient!.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
      const partId = (await testClient!.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceId, personId])).rows[0].id;
      return partId;
    }

    // Room 0 (Zero Active Sessions): 2 participants
    // Participant 0A: Attempt exists, but no active session (ended_at is NOT NULL)
    // Participant 0B: No attempt created
    const p0A = await createParticipant(instanceMath);
    const p0B = await createParticipant(instanceMath);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, p0A, roomActive0]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, p0B, roomActive0]);
    const att0A = (await testClient.query(`INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`, [tenantA, p0A])).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at, ended_at) VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour')`, [tenantA, att0A]);

    // Room 1 (One Active Session): 1 participant
    // Participant 1A: Attempt with 1 ended superseded session AND 1 active session (ended_at IS NULL)
    const p1A = await createParticipant(instanceMath);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, p1A, roomActive1]);
    const att1A = (await testClient.query(`INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`, [tenantA, p1A])).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at, ended_at) VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour')`, [tenantA, att1A]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at) VALUES (gen_random_uuid(), $1, $2, NOW())`, [tenantA, att1A]);

    // Room 2 (Multiple Active Sessions: 2): 3 participants
    // Participant 2A: Attempt with 1 active session
    // Participant 2B: Attempt with 1 active session (different attempt, different participant -> one active session per attempt respected!)
    // Participant 2C: Attempt with no session
    const p2A = await createParticipant(instanceMath);
    const p2B = await createParticipant(instanceMath);
    const p2C = await createParticipant(instanceMath);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, p2A, roomActive2]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, p2B, roomActive2]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, p2C, roomActive2]);
    const att2A = (await testClient.query(`INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`, [tenantA, p2A])).rows[0].id;
    const att2B = (await testClient.query(`INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`, [tenantA, p2B])).rows[0].id;
    const att2C = (await testClient.query(`INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`, [tenantA, p2C])).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at) VALUES (gen_random_uuid(), $1, $2, NOW())`, [tenantA, att2A]);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at) VALUES (gen_random_uuid(), $1, $2, NOW())`, [tenantA, att2B]);

    // Unrelated Room: 1 participant with an active session
    const pUnrelated = await createParticipant(instanceMath);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceMath, pUnrelated, roomUnrelated]);
    const attUnrelated = (await testClient.query(`INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`, [tenantA, pUnrelated])).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at) VALUES (gen_random_uuid(), $1, $2, NOW())`, [tenantA, attUnrelated]);

    // Single Room: 1 participant with 1 active session
    const pSingle1 = await createParticipant(instanceSingleRoom);
    await testClient.query(`INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantA, instanceSingleRoom, pSingle1, roomSingle]);
    const attSingle1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`, [tenantA, pSingle1])).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at) VALUES (gen_random_uuid(), $1, $2, NOW())`, [tenantA, attSingle1]);

    // -------------------------------------------------------------
    // FIXTURES: TENANT B (ISOLATION)
    // -------------------------------------------------------------
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personProctorB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const instanceB = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (tenant_id, lifecycle_state) VALUES ($1, 'ACTIVE') RETURNING id
    `, [tenantB])).rows[0].id;
    const proctorAssignmentB = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantB, instanceB, personProctorB])).rows[0].id;
    const roomB = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room B') RETURNING id`, [tenantB, instanceB])).rows[0].id;
    await testClient.query(`INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)`, [tenantB, instanceB, proctorAssignmentB, roomB]);

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
      'secure_assessment_proctor_assignments',
      'secure_assessment_exam_rooms',
      'secure_assessment_exam_proctor_room_assignments',
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
      context: ProctorMonitoringContext | null,
    ): Promise<{ status: number; body: any }> {
      const req = new MockReq('GET', '/api/v1/assessment/proctor-monitoring');
      const res = new MockRes(req);
      await handleProctorMonitoringGet(req, res, {
        pool: testPool!,
        getProctorMonitoringContext: () => context
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

    // 1. AUTHORIZED SAME-TENANT PROCTOR
    const pMultiRes = await executeApi({ tenantId: tenantA, personId: personProctorMulti });
    if (pMultiRes.status !== 200) throw new Error(`Expected 200, got ${pMultiRes.status}`);
    const assignments: ProctorMonitoringResponse['assignments'] = pMultiRes.body.assignments;
    if (assignments.length !== 1) throw new Error(`Expected 1 exam, got ${assignments.length}`);
    if (assignments[0].subjectLabel !== 'Matematika') throw new Error('Subject label mismatch');
    console.log('AUTHORIZED SAME-TENANT PROCTOR: PASS');

    // 2. MULTIPLE ASSIGNED ROOMS: independently preserved
    if (assignments[0].rooms.length !== 3) throw new Error(`Expected 3 rooms, got ${assignments[0].rooms.length}`);
    const r0 = assignments[0].rooms.find(r => r.roomId === roomActive0);
    const r1 = assignments[0].rooms.find(r => r.roomId === roomActive1);
    const r2 = assignments[0].rooms.find(r => r.roomId === roomActive2);
    if (!r0 || !r1 || !r2) throw new Error('One or more authorized rooms missing from projection');
    console.log('MULTIPLE ASSIGNED ROOMS: PASS / INDEPENDENTLY PRESERVED');

    // 3. PARTICIPANT COUNT PER ROOM
    if (r0.participantCount !== 2) throw new Error(`Expected roomActive0 participantCount 2, got ${r0.participantCount}`);
    if (r1.participantCount !== 1) throw new Error(`Expected roomActive1 participantCount 1, got ${r1.participantCount}`);
    if (r2.participantCount !== 3) throw new Error(`Expected roomActive2 participantCount 3, got ${r2.participantCount}`);
    console.log('PARTICIPANT COUNT PER ROOM: PASS');

    // 4. ZERO ACTIVE SESSIONS
    if (r0.activeSessionCount !== 0) throw new Error(`Expected roomActive0 activeSessionCount 0, got ${r0.activeSessionCount}`);
    console.log('ZERO ACTIVE SESSIONS: PASS');

    // 5. ONE ACTIVE SESSION
    if (r1.activeSessionCount !== 1) throw new Error(`Expected roomActive1 activeSessionCount 1, got ${r1.activeSessionCount}`);
    console.log('ONE ACTIVE SESSION: PASS');

    // 6. MULTIPLE ACTIVE SESSIONS
    if (r2.activeSessionCount !== 2) throw new Error(`Expected roomActive2 activeSessionCount 2, got ${r2.activeSessionCount}`);
    console.log('MULTIPLE ACTIVE SESSIONS: PASS');

    // 7. UNRELATED ROOM: EXCLUDED
    const rUnrelated = assignments[0].rooms.find(r => r.roomId === roomUnrelated);
    if (rUnrelated) throw new Error('Unrelated room leaked into authorized proctor monitoring projection');
    console.log('UNRELATED ROOM: EXCLUDED');

    // 8. UNRELATED ACTIVE SESSION: EXCLUDED / DOES NOT AFFECT AUTHORIZED COUNTS
    // Sum of active sessions across authorized rooms must be exactly 0 + 1 + 2 = 3 (excluding the active session in roomUnrelated)
    const totalAuthorizedActive = assignments[0].rooms.reduce((acc, r) => acc + r.activeSessionCount, 0);
    if (totalAuthorizedActive !== 3) throw new Error(`Total active sessions must be 3, got ${totalAuthorizedActive}`);
    console.log('UNRELATED ACTIVE SESSION: EXCLUDED / DOES NOT AFFECT AUTHORIZED COUNTS');

    // 9. ONE ASSIGNED ROOM
    const pSingleRes = await executeApi({ tenantId: tenantA, personId: personProctorSingle });
    if (pSingleRes.status !== 200) throw new Error(`Expected 200, got ${pSingleRes.status}`);
    if (pSingleRes.body.assignments.length !== 1) throw new Error(`Expected 1 exam, got ${pSingleRes.body.assignments.length}`);
    if (pSingleRes.body.assignments[0].rooms.length !== 1) throw new Error(`Expected 1 room, got ${pSingleRes.body.assignments[0].rooms.length}`);
    const rSingle = pSingleRes.body.assignments[0].rooms[0];
    if (rSingle.roomId !== roomSingle || rSingle.participantCount !== 1 || rSingle.activeSessionCount !== 1) {
      throw new Error('Single assigned room projection mismatch');
    }
    console.log('ONE ASSIGNED ROOM: PASS');

    // 10. ASSIGNED EXAM / ZERO ROOMS
    const pZeroRoomsRes = await executeApi({ tenantId: tenantA, personId: personProctorZeroRooms });
    if (pZeroRoomsRes.status !== 200) throw new Error(`Expected 200, got ${pZeroRoomsRes.status}`);
    if (pZeroRoomsRes.body.assignments.length !== 1) throw new Error(`Expected 1 exam, got ${pZeroRoomsRes.body.assignments.length}`);
    if (pZeroRoomsRes.body.assignments[0].rooms.length !== 0) throw new Error(`Expected 0 rooms, got ${pZeroRoomsRes.body.assignments[0].rooms.length}`);
    console.log('ASSIGNED EXAM / ZERO ROOMS: PASS');

    // 11. ZERO ASSIGNED EXAM
    const pZeroExamsRes = await executeApi({ tenantId: tenantA, personId: personProctorZeroExams });
    if (pZeroExamsRes.status !== 200) throw new Error(`Expected 200, got ${pZeroExamsRes.status}`);
    if (pZeroExamsRes.body.assignments.length !== 0) throw new Error(`Expected 0 exams, got ${pZeroExamsRes.body.assignments.length}`);
    console.log('ZERO ASSIGNED EXAM: PASS');

    // 12. WRONG SAME-TENANT PROCTOR / NO AUTHORIZED SCOPE
    const pWrongRes = await executeApi({ tenantId: tenantA, personId: personWrongProctor });
    if (pWrongRes.status !== 200) throw new Error(`Expected 200, got ${pWrongRes.status}`);
    if (pWrongRes.body.assignments.length !== 0) throw new Error(`Expected 0 exams for unassigned person`);
    console.log('WRONG SAME-TENANT PROCTOR / NO AUTHORIZED SCOPE: PASS / NO LEAK');

    // 13. REVOKED PROCTOR: PASS / NO MONITORING GRANT
    const pRevRes = await executeApi({ tenantId: tenantA, personId: personProctorRevoked });
    if (pRevRes.status !== 200) throw new Error(`Expected 200, got ${pRevRes.status}`);
    if (pRevRes.body.assignments.length !== 0) throw new Error('Revoked proctor must not see assignments');
    console.log('REVOKED PROCTOR: PASS / NO MONITORING GRANT');

    // 14. CROSS-TENANT: PASS / NO LEAK
    const pCrossA = await executeApi({ tenantId: tenantB, personId: personProctorMulti });
    if (pCrossA.status !== 200) throw new Error(`Expected 200, got ${pCrossA.status}`);
    if (pCrossA.body.assignments.length !== 0) throw new Error('Cross-tenant leak: Tenant B saw Tenant A proctor assignments');

    const pCrossB = await executeApi({ tenantId: tenantA, personId: personProctorB });
    if (pCrossB.status !== 200) throw new Error(`Expected 200, got ${pCrossB.status}`);
    if (pCrossB.body.assignments.length !== 0) throw new Error('Cross-tenant leak: Tenant A saw Tenant B proctor assignments');
    console.log('CROSS-TENANT: PASS / NO LEAK');

    // 15. MISSING TRUSTED CONTEXT: FAIL CLOSED
    const pMissNull = await executeApi(null);
    if (pMissNull.status !== 403) throw new Error(`Expected 403, got ${pMissNull.status}`);

    const pMissInvalid = await executeApi({ tenantId: 'invalid-uuid', personId: personProctorMulti });
    if (pMissInvalid.status !== 403) throw new Error(`Expected 403, got ${pMissInvalid.status}`);
    console.log('MISSING TRUSTED CONTEXT: FAIL CLOSED');

    // 16. ZERO MUTATION: PASS
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

    // 17. DISPOSABLE DATABASE CLEANUP: PASS
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
