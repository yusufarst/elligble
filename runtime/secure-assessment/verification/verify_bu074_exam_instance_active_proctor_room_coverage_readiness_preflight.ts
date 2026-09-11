import { Client } from 'pg';
import type { PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import {
  checkExamInstanceActiveProctorRoomCoverageReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-active-proctor-room-coverage-readiness-preflight.ts';

const grantedCapability: CapabilityEvaluator = async () => 'granted' as const;
const deniedCapability: CapabilityEvaluator = async () => 'denied' as const;
const unavailableCapability: CapabilityEvaluator = async () => 'unavailable' as const;

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
  let dbCleanedUp = false;

  try {
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu074_${runId}`;

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

    // 1. Discover migrations
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const sqlFiles = files
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort((a, b) => a.localeCompare(b));

    // 2. Prove migration 0034 does NOT exist
    const migration0034 = sqlFiles.find((f) => f.startsWith('0034_'));
    if (migration0034) {
      throw new Error(`Migration 0034 must NOT exist, but found: ${migration0034}`);
    }

    // 3. Discover and apply canonical migrations 0001..0033 only
    for (let i = 1; i <= 33; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFiles = sqlFiles.filter((f) => f.startsWith(`${prefix}_`));
      if (matchingFiles.length !== 1) {
        throw new Error(`Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`);
      }
      const filePath = path.join(MIGRATIONS_DIR, matchingFiles[0]);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    // 4. Prove migration history is exactly 33
    const migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 33) {
      throw new Error(`Expected exactly 33 migrations applied, got ${migrationHistory.rows[0].count}`);
    }

    // 5. Canonical fixture chains setup
    // Tenant A
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherPersonA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
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

    // Proctor Persons
    const proctorPerson1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorPerson2 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorPerson3 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    // Helper to create exam instances
    async function createExamInstance(tenant: string, teachingAssign: string, assessType: string, lifecycle = 'SCHEDULED') {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
          window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        tenant,
        teachingAssign,
        assessType,
        lifecycle,
        '2026-10-01 08:00:00Z',
        '2026-10-01 10:00:00Z',
        3600,
        'FULL_DURATION_BEYOND_WINDOW'
      ]);
      return res.rows[0].id as string;
    }

    // Helper to create exam room
    async function createExamRoom(tenant: string, examInstanceId: string, label: string) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [tenant, examInstanceId, label]);
      return res.rows[0].id as string;
    }

    // Helper to create proctor assignment
    async function createProctorAssignment(tenant: string, examInstanceId: string, personId: string, isRevoked = false) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id, revoked_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [tenant, examInstanceId, personId, isRevoked ? '2026-10-01 09:00:00Z' : null]);
      return res.rows[0].id as string;
    }

    // Helper to create proctor room assignment mapping
    async function createProctorRoomAssignment(tenant: string, examInstanceId: string, proctorAssignmentId: string, roomId: string) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [tenant, examInstanceId, proctorAssignmentId, roomId]);
      return res.rows[0].id as string;
    }

    // --- Scenario 1: Zero Rooms ---
    // 1 active proctor assignment, 0 rooms
    const examZeroRooms = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    await createProctorAssignment(tenantA, examZeroRooms, proctorPerson1);

    // --- Scenario 2: Uncovered Room ---
    // 1 active proctor, 1 room, 0 mappings
    const examUncoveredRoom = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    await createProctorAssignment(tenantA, examUncoveredRoom, proctorPerson1);
    const roomUncovered1 = await createExamRoom(tenantA, examUncoveredRoom, 'Room Uncovered 1');

    // --- Scenario 3: Active-Covered Room ---
    // 1 active proctor, 1 room, mapped
    const examActiveCovered = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const proctorActiveCovered1 = await createProctorAssignment(tenantA, examActiveCovered, proctorPerson1);
    const roomActiveCovered1 = await createExamRoom(tenantA, examActiveCovered, 'Room Active 1');
    await createProctorRoomAssignment(tenantA, examActiveCovered, proctorActiveCovered1, roomActiveCovered1);

    // --- Scenario 4: Revoked-Only Room ---
    // 1 active proctor (for BU-070 presence), 1 revoked proctor mapped to room
    const examRevokedOnly = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    await createProctorAssignment(tenantA, examRevokedOnly, proctorPerson1, false);
    const proctorRevoked = await createProctorAssignment(tenantA, examRevokedOnly, proctorPerson2, true);
    const roomRevokedOnly = await createExamRoom(tenantA, examRevokedOnly, 'Room Revoked Only');
    await createProctorRoomAssignment(tenantA, examRevokedOnly, proctorRevoked, roomRevokedOnly);

    // --- Scenario 5: Active + Revoked Mapping on Same Room ---
    // 1 active proctor mapped + 1 revoked proctor mapped to same room -> covered exactly once
    const examActivePlusRevoked = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const proctorARActive = await createProctorAssignment(tenantA, examActivePlusRevoked, proctorPerson1, false);
    const proctorARRevoked = await createProctorAssignment(tenantA, examActivePlusRevoked, proctorPerson2, true);
    const roomAR = await createExamRoom(tenantA, examActivePlusRevoked, 'Room AR');
    await createProctorRoomAssignment(tenantA, examActivePlusRevoked, proctorARActive, roomAR);
    await createProctorRoomAssignment(tenantA, examActivePlusRevoked, proctorARRevoked, roomAR);

    // --- Scenario 6: Multi-Room Same Active Proctor ---
    // 1 active proctor mapped to 2 rooms -> both covered
    const examMultiRoomSameProctor = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const proctorMR = await createProctorAssignment(tenantA, examMultiRoomSameProctor, proctorPerson1);
    const roomMR1 = await createExamRoom(tenantA, examMultiRoomSameProctor, 'Room MR 1');
    const roomMR2 = await createExamRoom(tenantA, examMultiRoomSameProctor, 'Room MR 2');
    await createProctorRoomAssignment(tenantA, examMultiRoomSameProctor, proctorMR, roomMR1);
    await createProctorRoomAssignment(tenantA, examMultiRoomSameProctor, proctorMR, roomMR2);

    // --- Scenario 7: Multi-Proctor Same Room (No Inflation) ---
    // 2 active proctors mapped to 1 room -> covered count remains 1
    const examMultiProctorSameRoom = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const proctorMP1 = await createProctorAssignment(tenantA, examMultiProctorSameRoom, proctorPerson1);
    const proctorMP2 = await createProctorAssignment(tenantA, examMultiProctorSameRoom, proctorPerson2);
    const roomMP = await createExamRoom(tenantA, examMultiProctorSameRoom, 'Room MP');
    await createProctorRoomAssignment(tenantA, examMultiProctorSameRoom, proctorMP1, roomMP);
    await createProctorRoomAssignment(tenantA, examMultiProctorSameRoom, proctorMP2, roomMP);

    // --- Scenario 8: Exact Count Semantics (Multi-Room Partial Coverage) ---
    // 3 rooms: Room 1 (2 active proctors), Room 2 (1 active proctor), Room 3 (0 proctors) -> 3 rooms, 2 covered, 1 uncovered
    const examPartialCoverage = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const proctorPC1 = await createProctorAssignment(tenantA, examPartialCoverage, proctorPerson1);
    const proctorPC2 = await createProctorAssignment(tenantA, examPartialCoverage, proctorPerson2);
    const roomPC1 = await createExamRoom(tenantA, examPartialCoverage, 'Room PC 1');
    const roomPC2 = await createExamRoom(tenantA, examPartialCoverage, 'Room PC 2');
    const roomPC3 = await createExamRoom(tenantA, examPartialCoverage, 'Room PC 3');
    await createProctorRoomAssignment(tenantA, examPartialCoverage, proctorPC1, roomPC1);
    await createProctorRoomAssignment(tenantA, examPartialCoverage, proctorPC2, roomPC1);
    await createProctorRoomAssignment(tenantA, examPartialCoverage, proctorPC1, roomPC2);

    // --- Scenario 9: Other Exam Instance Isolation ---
    // An independent exam in tenant A
    const examOtherA = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const proctorOtherA = await createProctorAssignment(tenantA, examOtherA, proctorPerson3);
    const roomOtherA1 = await createExamRoom(tenantA, examOtherA, 'Room Other A 1');
    const roomOtherA2 = await createExamRoom(tenantA, examOtherA, 'Room Other A 2');
    await createProctorRoomAssignment(tenantA, examOtherA, proctorOtherA, roomOtherA1);

    // --- Scenario 10: Other Tenant Isolation ---
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherPersonB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherMemberB = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantB, teacherPersonB])).rows[0].id;
    const teacherAssignmentB = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantB, teacherMemberB])).rows[0].id;

    const academicYearB = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantB])).rows[0].id;
    const academicPeriodB = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantB, academicYearB])).rows[0].id;
    const subjectB = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics B') RETURNING id`, [tenantB])).rows[0].id;
    const gradeLevelB = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantB])).rows[0].id;
    const academicGroupB = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-B') RETURNING id`, [tenantB, academicYearB, gradeLevelB])).rows[0].id;
    const subjectOfferingB = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, subjectB, academicPeriodB, gradeLevelB])).rows[0].id;
    const teachingAssignmentB = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, teacherAssignmentB, subjectOfferingB, academicGroupB])).rows[0].id;
    const assessmentTypeB = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE B') RETURNING id`, [tenantB])).rows[0].id;

    const examB1 = await createExamInstance(tenantB, teachingAssignmentB, assessmentTypeB);
    const proctorPersonB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorB1 = await createProctorAssignment(tenantB, examB1, proctorPersonB);
    const roomB1 = await createExamRoom(tenantB, examB1, 'Room B 1');
    await createProctorRoomAssignment(tenantB, examB1, proctorB1, roomB1);

    // --- Additional Scenarios: BU-070 Composed Behaviors ---
    // Zero proctors in scheduled exam
    const examZeroProctors = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    await createExamRoom(tenantA, examZeroProctors, 'Room In Zero Proctors');

    // DRAFT exam instance
    const examDraft = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'DRAFT');
    await createProctorAssignment(tenantA, examDraft, proctorPerson1);
    await createExamRoom(tenantA, examDraft, 'Room In Draft');

    // Seed student participant and participant room assignment (to establish non-mutation baseline)
    const studentPersonA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantA1 = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examActiveCovered, studentPersonA])).rows[0].id;
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examActiveCovered, participantA1, roomActiveCovered1]);

    // 6. Record BEFORE-state snapshot of all protected tables and academic core
    const tablesToTrack = [
      'secure_assessment_exam_instances',
      'secure_assessment_proctor_assignments',
      'secure_assessment_exam_rooms',
      'secure_assessment_exam_proctor_room_assignments',
      'secure_assessment_exam_participant_room_assignments',
      'secure_assessment_exam_participants',
      'secure_assessment_exam_attempts',
      'secure_assessment_exam_sessions',
      'academic_core_academic_years',
      'academic_core_academic_periods',
      'academic_core_subjects',
      'academic_core_grade_levels',
      'academic_core_academic_groups',
      'academic_core_subject_offerings',
      'academic_core_teaching_assignments',
      'elligble_migration_history'
    ];

    const beforeSnapshots: Record<string, { count: number; rows: string }> = {};
    for (const tbl of tablesToTrack) {
      beforeSnapshots[tbl] = await snapshotTable(testClient, tbl);
    }

    const poolClient = testClient as unknown as PoolClient;

    // 7. Execute BU-074 preflight tests against real PostgreSQL

    // Test 1: Zero Rooms -> no_exam_rooms
    const resZero = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examZeroRooms, grantedCapability);
    if (
      resZero.type !== 'no_exam_rooms' ||
      resZero.tenantId !== tenantA ||
      resZero.examInstanceId !== examZeroRooms ||
      resZero.examRoomCount !== 0
    ) {
      throw new Error(`Test 1 Failed (Zero Rooms): got ${JSON.stringify(resZero)}`);
    }

    // Test 2: Uncovered Room -> not_ready: active_proctor_room_coverage_incomplete (1/0/1)
    const resUncovered = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examUncoveredRoom, grantedCapability);
    if (
      resUncovered.type !== 'not_ready' ||
      resUncovered.blocker !== 'active_proctor_room_coverage_incomplete' ||
      resUncovered.examRoomCount !== 1 ||
      resUncovered.coveredExamRoomCount !== 0 ||
      resUncovered.uncoveredExamRoomCount !== 1
    ) {
      throw new Error(`Test 2 Failed (Uncovered Room): got ${JSON.stringify(resUncovered)}`);
    }

    // Test 3: Active-Covered Room -> active_proctor_room_coverage_ready (1/1/0)
    const resActiveCovered = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examActiveCovered, grantedCapability);
    if (
      resActiveCovered.type !== 'active_proctor_room_coverage_ready' ||
      resActiveCovered.tenantId !== tenantA ||
      resActiveCovered.examInstanceId !== examActiveCovered ||
      resActiveCovered.examRoomCount !== 1 ||
      resActiveCovered.coveredExamRoomCount !== 1 ||
      resActiveCovered.uncoveredExamRoomCount !== 0
    ) {
      throw new Error(`Test 3 Failed (Active-Covered Room): got ${JSON.stringify(resActiveCovered)}`);
    }

    // Test 4: Revoked-Only Room -> not_ready: active_proctor_room_coverage_incomplete (1/0/1)
    const resRevokedOnly = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examRevokedOnly, grantedCapability);
    if (
      resRevokedOnly.type !== 'not_ready' ||
      resRevokedOnly.blocker !== 'active_proctor_room_coverage_incomplete' ||
      resRevokedOnly.examRoomCount !== 1 ||
      resRevokedOnly.coveredExamRoomCount !== 0 ||
      resRevokedOnly.uncoveredExamRoomCount !== 1
    ) {
      throw new Error(`Test 4 Failed (Revoked-Only Room): got ${JSON.stringify(resRevokedOnly)}`);
    }

    // Test 5: Active + Revoked Mapping on Same Room -> ready (1/1/0)
    const resActivePlusRevoked = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examActivePlusRevoked, grantedCapability);
    if (
      resActivePlusRevoked.type !== 'active_proctor_room_coverage_ready' ||
      resActivePlusRevoked.tenantId !== tenantA ||
      resActivePlusRevoked.examInstanceId !== examActivePlusRevoked ||
      resActivePlusRevoked.examRoomCount !== 1 ||
      resActivePlusRevoked.coveredExamRoomCount !== 1 ||
      resActivePlusRevoked.uncoveredExamRoomCount !== 0
    ) {
      throw new Error(`Test 5 Failed (Active + Revoked Mapping): got ${JSON.stringify(resActivePlusRevoked)}`);
    }

    // Test 6: Multi-Room Same Active Proctor -> ready (2/2/0)
    const resMultiRoomSameProctor = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examMultiRoomSameProctor, grantedCapability);
    if (
      resMultiRoomSameProctor.type !== 'active_proctor_room_coverage_ready' ||
      resMultiRoomSameProctor.tenantId !== tenantA ||
      resMultiRoomSameProctor.examInstanceId !== examMultiRoomSameProctor ||
      resMultiRoomSameProctor.examRoomCount !== 2 ||
      resMultiRoomSameProctor.coveredExamRoomCount !== 2 ||
      resMultiRoomSameProctor.uncoveredExamRoomCount !== 0
    ) {
      throw new Error(`Test 6 Failed (Multi-Room Same Proctor): got ${JSON.stringify(resMultiRoomSameProctor)}`);
    }

    // Test 7: Multi-Proctor Same Room (No Inflation) -> ready (1/1/0)
    const resMultiProctorSameRoom = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examMultiProctorSameRoom, grantedCapability);
    if (
      resMultiProctorSameRoom.type !== 'active_proctor_room_coverage_ready' ||
      resMultiProctorSameRoom.tenantId !== tenantA ||
      resMultiProctorSameRoom.examInstanceId !== examMultiProctorSameRoom ||
      resMultiProctorSameRoom.examRoomCount !== 1 ||
      resMultiProctorSameRoom.coveredExamRoomCount !== 1 ||
      resMultiProctorSameRoom.uncoveredExamRoomCount !== 0
    ) {
      throw new Error(`Test 7 Failed (Multi-Proctor Same Room): got ${JSON.stringify(resMultiProctorSameRoom)}`);
    }

    // Test 8: Multi-Room Partial Coverage Exact Counts (3/2/1)
    const resPartialCoverage = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examPartialCoverage, grantedCapability);
    if (
      resPartialCoverage.type !== 'not_ready' ||
      resPartialCoverage.blocker !== 'active_proctor_room_coverage_incomplete' ||
      resPartialCoverage.examRoomCount !== 3 ||
      resPartialCoverage.coveredExamRoomCount !== 2 ||
      resPartialCoverage.uncoveredExamRoomCount !== 1
    ) {
      throw new Error(`Test 8 Failed (Partial Coverage Exact Counts): got ${JSON.stringify(resPartialCoverage)}`);
    }

    // Test 9: Same-Tenant Other-Exam Isolation
    // Calling for examActiveCovered ignores examOtherA
    const resIsoActiveCovered = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examActiveCovered, grantedCapability);
    if (
      resIsoActiveCovered.type !== 'active_proctor_room_coverage_ready' ||
      resIsoActiveCovered.examRoomCount !== 1 ||
      resIsoActiveCovered.coveredExamRoomCount !== 1 ||
      resIsoActiveCovered.uncoveredExamRoomCount !== 0
    ) {
      throw new Error(`Test 9a Failed (Other-Exam Isolation on Covered): got ${JSON.stringify(resIsoActiveCovered)}`);
    }

    // Calling for examOtherA ignores examActiveCovered (examOtherA has 2 rooms, 1 mapped)
    const resIsoOtherA = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examOtherA, grantedCapability);
    if (
      resIsoOtherA.type !== 'not_ready' ||
      resIsoOtherA.blocker !== 'active_proctor_room_coverage_incomplete' ||
      resIsoOtherA.examRoomCount !== 2 ||
      resIsoOtherA.coveredExamRoomCount !== 1 ||
      resIsoOtherA.uncoveredExamRoomCount !== 1
    ) {
      throw new Error(`Test 9b Failed (Other-Exam Isolation on Other): got ${JSON.stringify(resIsoOtherA)}`);
    }

    // Test 10: Other-Tenant Isolation
    // Calling for tenantA ignores tenantB
    const resIsoTenantA = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examActiveCovered, grantedCapability);
    if (
      resIsoTenantA.type !== 'active_proctor_room_coverage_ready' ||
      resIsoTenantA.examRoomCount !== 1
    ) {
      throw new Error(`Test 10a Failed (Other-Tenant Isolation on Tenant A): got ${JSON.stringify(resIsoTenantA)}`);
    }

    // Cross-tenant call (tenantB requesting tenantA's exam) -> denied
    const resCrossTenant = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantB, examActiveCovered, grantedCapability);
    if (resCrossTenant.type !== 'denied') {
      throw new Error(`Test 10b Failed (Cross-tenant access must be denied): got ${JSON.stringify(resCrossTenant)}`);
    }

    // Calling for tenantB on examB1 -> ready (1/1/0)
    const resTenantB = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantB, examB1, grantedCapability);
    if (
      resTenantB.type !== 'active_proctor_room_coverage_ready' ||
      resTenantB.tenantId !== tenantB ||
      resTenantB.examInstanceId !== examB1 ||
      resTenantB.examRoomCount !== 1 ||
      resTenantB.coveredExamRoomCount !== 1 ||
      resTenantB.uncoveredExamRoomCount !== 0
    ) {
      throw new Error(`Test 10c Failed (Tenant B Exam Readiness): got ${JSON.stringify(resTenantB)}`);
    }

    // Test 11: Composed BU-070 zero proctors -> not_ready: active_proctor_assignment_empty
    const resZeroProctors = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examZeroProctors, grantedCapability);
    if (
      resZeroProctors.type !== 'not_ready' ||
      resZeroProctors.blocker !== 'active_proctor_assignment_empty'
    ) {
      throw new Error(`Test 11 Failed (Zero Proctors Composed): got ${JSON.stringify(resZeroProctors)}`);
    }

    // Test 12: Composed BU-070 DRAFT state -> invalid_state
    const resDraft = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examDraft, grantedCapability);
    if (resDraft.type !== 'invalid_state') {
      throw new Error(`Test 12 Failed (Draft State Composed): got ${JSON.stringify(resDraft)}`);
    }

    // Test 13: Composed BU-070 capability denied -> denied
    const resCapDenied = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examActiveCovered, deniedCapability);
    if (resCapDenied.type !== 'denied') {
      throw new Error(`Test 13 Failed (Capability Denied Composed): got ${JSON.stringify(resCapDenied)}`);
    }

    // Test 14: Composed BU-070 capability unavailable -> unavailable
    const resCapUnavail = await checkExamInstanceActiveProctorRoomCoverageReadiness(poolClient, tenantA, examActiveCovered, unavailableCapability);
    if (resCapUnavail.type !== 'unavailable') {
      throw new Error(`Test 14 Failed (Capability Unavailable Composed): got ${JSON.stringify(resCapUnavail)}`);
    }

    // 8. Prove READ-ONLY runtime: verify zero mutation to all protected tables and academic core
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

    // 9. Fail-closed cleanup: close target connection -> drop disposable DB -> prove pg_database does not contain it
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

    console.log('DISPOSABLE DATABASE CLEANUP: PASS');
    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
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
