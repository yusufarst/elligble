import { Client } from 'pg';
import type { PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import {
  checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight,
  type CapabilityEvaluator
} from '../src/exam-instance-conditional-room-proctor-readiness-composition-preflight.ts';

const grantedCapability: CapabilityEvaluator = async () => 'granted' as const;

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
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is required');

    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    rootClient = new Client(clientConfig(adminUrl.toString()));
    await rootClient.connect();

    // 0. Pre-run leak check: verify zero elligble_bu077_ databases exist
    const preRunLeakRes = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu077_%'`
    );
    if (preRunLeakRes.rowCount !== null && preRunLeakRes.rowCount > 0) {
      throw new Error(`PRE-RUN LEAK DETECTED: Found ${preRunLeakRes.rowCount} dangling database(s) matching elligble_bu077_%`);
    }
    console.log('PRE-RUN ZERO-LEAK: PASS');

    // Create disposable database
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu077_${runId}`;
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

    // 2. Prove migration 0035 does NOT exist
    const migration0035 = sqlFiles.find((f) => f.startsWith('0035_'));
    if (migration0035) {
      throw new Error(`Migration 0035 must NOT exist, but found: ${migration0035}`);
    }
    console.log('MIGRATION 0035 ABSENCE: PASS');

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
    console.log('MIGRATION HISTORY: 34 / PASS');

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

    // Helper to create exam instance with BU-076 policy columns
    async function createExamInstance(
      tenant: string,
      teachingAssign: string,
      assessType: string,
      lifecycle = 'SCHEDULED',
      roomBasedEnabled: boolean | null = null,
      proctorPerRoomReq: boolean | null = null
    ) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
          window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
          room_based_operations_enabled, proctor_per_room_required
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        tenant,
        teachingAssign,
        assessType,
        lifecycle,
        '2026-10-01 08:00:00Z',
        '2026-10-01 10:00:00Z',
        3600,
        'FULL_DURATION_BEYOND_WINDOW',
        roomBasedEnabled,
        proctorPerRoomReq
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

    // Helper to create participant
    async function createParticipant(tenant: string, examInstanceId: string) {
      const personId = (await testClient!.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [tenant, examInstanceId, personId]);
      return res.rows[0].id as string;
    }

    // Helper to create participant room assignment
    async function createParticipantRoomAssignment(tenant: string, examInstanceId: string, participantId: string, roomId: string) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [tenant, examInstanceId, participantId, roomId]);
      return res.rows[0].id as string;
    }

    // Helper to create proctor assignment
    async function createProctorAssignment(tenant: string, examInstanceId: string, isRevoked = false) {
      const personId = (await testClient!.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
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

    // --- Policy State 1: NULL / NULL (unconfigured policy) ---
    const examNullPolicy = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', null, null);
    await createParticipant(tenantA, examNullPolicy);
    await createExamRoom(tenantA, examNullPolicy, 'Room NP');

    // --- Policy State 2: FALSE / FALSE (room mode disabled) ---
    const examFalseFalse = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', false, false);
    // Even if participants or rooms exist, room mode is disabled
    await createParticipant(tenantA, examFalseFalse);
    await createExamRoom(tenantA, examFalseFalse, 'Room FF');

    // --- Policy State 3: TRUE / FALSE (rooms enabled, per-room proctor not required) ---
    // 3a. Zero rooms
    const examTrueFalseZeroRooms = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', true, false);
    await createParticipant(tenantA, examTrueFalseZeroRooms);

    // 3b. Incomplete participant room assignments
    const examTrueFalseIncomplete = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', true, false);
    const tfPart1 = await createParticipant(tenantA, examTrueFalseIncomplete);
    await createParticipant(tenantA, examTrueFalseIncomplete);
    const tfRoom1 = await createExamRoom(tenantA, examTrueFalseIncomplete, 'Room TF1');
    const tfRoom2 = await createExamRoom(tenantA, examTrueFalseIncomplete, 'Room TF2');
    await createParticipantRoomAssignment(tenantA, examTrueFalseIncomplete, tfPart1, tfRoom1);

    // 3c. Complete participant room assignments (no proctors required)
    const examTrueFalseComplete = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', true, false);
    const tfcPart1 = await createParticipant(tenantA, examTrueFalseComplete);
    const tfcPart2 = await createParticipant(tenantA, examTrueFalseComplete);
    const tfcRoom1 = await createExamRoom(tenantA, examTrueFalseComplete, 'Room TFC1');
    const tfcRoom2 = await createExamRoom(tenantA, examTrueFalseComplete, 'Room TFC2');
    await createParticipantRoomAssignment(tenantA, examTrueFalseComplete, tfcPart1, tfcRoom1);
    await createParticipantRoomAssignment(tenantA, examTrueFalseComplete, tfcPart2, tfcRoom2);

    // --- Policy State 4: TRUE / TRUE (rooms enabled, per-room proctor required) ---
    // 4a. Zero rooms
    const examTrueTrueZeroRooms = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', true, true);
    await createParticipant(tenantA, examTrueTrueZeroRooms);

    // 4b. Incomplete participant room assignment
    const examTrueTrueIncompleteParticipants = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', true, true);
    const ttPart1 = await createParticipant(tenantA, examTrueTrueIncompleteParticipants);
    await createParticipant(tenantA, examTrueTrueIncompleteParticipants);
    const ttRoom1 = await createExamRoom(tenantA, examTrueTrueIncompleteParticipants, 'Room TT1');
    await createParticipantRoomAssignment(tenantA, examTrueTrueIncompleteParticipants, ttPart1, ttRoom1);

    // 4c. Complete participants, but zero active proctors
    const examTrueTrueZeroProctors = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', true, true);
    const ttcPart1 = await createParticipant(tenantA, examTrueTrueZeroProctors);
    const ttcRoom1 = await createExamRoom(tenantA, examTrueTrueZeroProctors, 'Room TTZP1');
    await createParticipantRoomAssignment(tenantA, examTrueTrueZeroProctors, ttcPart1, ttcRoom1);

    // 4d. Complete participants, active proctor exists but incomplete room coverage (2 rooms, 1 covered)
    const examTrueTrueIncompleteProctors = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', true, true);
    const ttipPart1 = await createParticipant(tenantA, examTrueTrueIncompleteProctors);
    const ttipPart2 = await createParticipant(tenantA, examTrueTrueIncompleteProctors);
    const ttipRoom1 = await createExamRoom(tenantA, examTrueTrueIncompleteProctors, 'Room TTIP1');
    const ttipRoom2 = await createExamRoom(tenantA, examTrueTrueIncompleteProctors, 'Room TTIP2');
    await createParticipantRoomAssignment(tenantA, examTrueTrueIncompleteProctors, ttipPart1, ttipRoom1);
    await createParticipantRoomAssignment(tenantA, examTrueTrueIncompleteProctors, ttipPart2, ttipRoom2);
    const activeProc1 = await createProctorAssignment(tenantA, examTrueTrueIncompleteProctors);
    await createProctorRoomAssignment(tenantA, examTrueTrueIncompleteProctors, activeProc1, ttipRoom1);

    // 4e. Complete participants AND complete proctor room coverage
    const examTrueTrueComplete = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', true, true);
    const ttc2Part1 = await createParticipant(tenantA, examTrueTrueComplete);
    const ttc2Part2 = await createParticipant(tenantA, examTrueTrueComplete);
    const ttc2Room1 = await createExamRoom(tenantA, examTrueTrueComplete, 'Room TTC1');
    const ttc2Room2 = await createExamRoom(tenantA, examTrueTrueComplete, 'Room TTC2');
    await createParticipantRoomAssignment(tenantA, examTrueTrueComplete, ttc2Part1, ttc2Room1);
    await createParticipantRoomAssignment(tenantA, examTrueTrueComplete, ttc2Part2, ttc2Room2);
    const activeProcA = await createProctorAssignment(tenantA, examTrueTrueComplete);
    const activeProcB = await createProctorAssignment(tenantA, examTrueTrueComplete);
    await createProctorRoomAssignment(tenantA, examTrueTrueComplete, activeProcA, ttc2Room1);
    await createProctorRoomAssignment(tenantA, examTrueTrueComplete, activeProcB, ttc2Room2);

    // --- Scenario 5: Non-SCHEDULED Exam Instance (DRAFT) ---
    const examDraft = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'DRAFT', true, true);

    // --- Scenario 6: Other Tenant Isolation ---
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

    const examTenantB = await createExamInstance(tenantB, teachingAssignmentB, assessmentTypeB, 'SCHEDULED', false, false);

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

    // 7. Physical verification executions
    const poolClient = testClient as unknown as PoolClient;

    // Test 1: Policy NULL / NULL -> room_proctor_requirement_policy_unconfigured
    const res1 = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examNullPolicy,
      grantedCapability
    );
    if (res1.type !== 'not_ready' || res1.blocker !== 'room_proctor_requirement_policy_unconfigured') {
      throw new Error(`Test 1 Failed (NULL/NULL): expected room_proctor_requirement_policy_unconfigured, got ${JSON.stringify(res1)}`);
    }

    // Test 2: Policy FALSE / FALSE -> room_proctor_readiness_not_applicable
    const res2 = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examFalseFalse,
      grantedCapability
    );
    if (
      res2.type !== 'room_proctor_readiness_not_applicable' ||
      res2.tenantId !== tenantA ||
      res2.examInstanceId !== examFalseFalse ||
      res2.roomBasedOperationsEnabled !== false ||
      res2.proctorPerRoomRequired !== false
    ) {
      throw new Error(`Test 2 Failed (FALSE/FALSE): expected room_proctor_readiness_not_applicable, got ${JSON.stringify(res2)}`);
    }

    // Test 3a: Policy TRUE / FALSE with zero rooms -> exam_room_empty
    const res3a = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueFalseZeroRooms,
      grantedCapability
    );
    if (res3a.type !== 'not_ready' || res3a.blocker !== 'exam_room_empty') {
      throw new Error(`Test 3a Failed (TRUE/FALSE zero rooms): expected exam_room_empty, got ${JSON.stringify(res3a)}`);
    }

    // Test 3b: Policy TRUE / FALSE with incomplete participant room assignments -> participant_room_assignment_incomplete
    const res3b = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueFalseIncomplete,
      grantedCapability
    );
    if (
      res3b.type !== 'not_ready' ||
      res3b.blocker !== 'participant_room_assignment_incomplete' ||
      res3b.participantCount !== 2 ||
      res3b.assignedParticipantCount !== 1 ||
      res3b.unassignedParticipantCount !== 1
    ) {
      throw new Error(`Test 3b Failed (TRUE/FALSE incomplete): got ${JSON.stringify(res3b)}`);
    }

    // Test 3c: Policy TRUE / FALSE with complete participant room assignments -> room_proctor_readiness_ready
    const res3c = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueFalseComplete,
      grantedCapability
    );
    if (
      res3c.type !== 'room_proctor_readiness_ready' ||
      res3c.tenantId !== tenantA ||
      res3c.examInstanceId !== examTrueFalseComplete ||
      res3c.roomBasedOperationsEnabled !== true ||
      res3c.proctorPerRoomRequired !== false ||
      res3c.participantCount !== 2 ||
      res3c.assignedParticipantCount !== 2
    ) {
      throw new Error(`Test 3c Failed (TRUE/FALSE complete): got ${JSON.stringify(res3c)}`);
    }

    // Test 4a: Policy TRUE / TRUE with zero rooms -> exam_room_empty
    const res4a = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueTrueZeroRooms,
      grantedCapability
    );
    if (res4a.type !== 'not_ready' || res4a.blocker !== 'exam_room_empty') {
      throw new Error(`Test 4a Failed (TRUE/TRUE zero rooms): expected exam_room_empty, got ${JSON.stringify(res4a)}`);
    }

    // Test 4b: Policy TRUE / TRUE with incomplete participant room assignments -> participant_room_assignment_incomplete
    const res4b = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueTrueIncompleteParticipants,
      grantedCapability
    );
    if (
      res4b.type !== 'not_ready' ||
      res4b.blocker !== 'participant_room_assignment_incomplete' ||
      res4b.participantCount !== 2 ||
      res4b.assignedParticipantCount !== 1 ||
      res4b.unassignedParticipantCount !== 1
    ) {
      throw new Error(`Test 4b Failed (TRUE/TRUE incomplete participants): got ${JSON.stringify(res4b)}`);
    }

    // Test 4c: Policy TRUE / TRUE with zero active proctors -> active_proctor_assignment_empty
    const res4c = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueTrueZeroProctors,
      grantedCapability
    );
    if (res4c.type !== 'not_ready' || res4c.blocker !== 'active_proctor_assignment_empty') {
      throw new Error(`Test 4c Failed (TRUE/TRUE zero proctors): expected active_proctor_assignment_empty, got ${JSON.stringify(res4c)}`);
    }

    // Test 4d: Policy TRUE / TRUE with incomplete proctor room coverage -> active_proctor_room_coverage_incomplete
    const res4d = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueTrueIncompleteProctors,
      grantedCapability
    );
    if (
      res4d.type !== 'not_ready' ||
      res4d.blocker !== 'active_proctor_room_coverage_incomplete' ||
      res4d.examRoomCount !== 2 ||
      res4d.coveredExamRoomCount !== 1 ||
      res4d.uncoveredExamRoomCount !== 1
    ) {
      throw new Error(`Test 4d Failed (TRUE/TRUE incomplete proctor room coverage): got ${JSON.stringify(res4d)}`);
    }

    // Test 4e: Policy TRUE / TRUE with complete coverage -> room_proctor_readiness_ready
    const res4e = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueTrueComplete,
      grantedCapability
    );
    if (
      res4e.type !== 'room_proctor_readiness_ready' ||
      res4e.tenantId !== tenantA ||
      res4e.examInstanceId !== examTrueTrueComplete ||
      res4e.roomBasedOperationsEnabled !== true ||
      res4e.proctorPerRoomRequired !== true ||
      res4e.examRoomCount !== 2 ||
      res4e.coveredExamRoomCount !== 2 ||
      res4e.participantCount !== 2 ||
      res4e.assignedParticipantCount !== 2
    ) {
      throw new Error(`Test 4e Failed (TRUE/TRUE complete coverage): got ${JSON.stringify(res4e)}`);
    }

    console.log('POLICY STATE MATRIX: PASS');

    // Test 5: Non-SCHEDULED state -> invalid_state
    const res5 = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examDraft,
      grantedCapability
    );
    if (res5.type !== 'invalid_state') {
      throw new Error(`Test 5 Failed (DRAFT state): expected invalid_state, got ${JSON.stringify(res5)}`);
    }

    // Test 6: Other Tenant Isolation -> denied
    const res6 = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTenantB, // Belong to Tenant B, called with Tenant A
      grantedCapability
    );
    if (res6.type !== 'denied') {
      throw new Error(`Test 6 Failed (Tenant Isolation): expected denied, got ${JSON.stringify(res6)}`);
    }

    // Test 7: External Capability Evaluator called exactly once with exact context
    let capabilityContextReceived: any = null;
    let capabilityCallCount = 0;
    const trackingCapability: CapabilityEvaluator = async (ctx) => {
      capabilityCallCount++;
      capabilityContextReceived = ctx;
      return 'granted' as const;
    };
    await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      poolClient,
      tenantA,
      examTrueTrueComplete,
      trackingCapability
    );
    if (capabilityCallCount !== 1) {
      throw new Error(`Test 7 Failed: capability evaluator called ${capabilityCallCount} times (expected 1)`);
    }
    if (
      !capabilityContextReceived ||
      capabilityContextReceived.tenantId !== tenantA ||
      capabilityContextReceived.examInstanceId !== examTrueTrueComplete
    ) {
      throw new Error(`Test 7 Failed: capability context mismatch: ${JSON.stringify(capabilityContextReceived)}`);
    }
    console.log('CAPABILITY EVALUATOR EXACTLY ONCE: PASS');

    // Test 8: DB failure in BU-077 query -> unavailable
    const failingClientBU077 = new Proxy(poolClient, {
      get(target, prop) {
        if (prop === 'query') {
          return async (text: string, values?: any[]) => {
            if (typeof text === 'string' && text.includes('room_based_operations_enabled')) {
              throw new Error('Simulated DB failure for BU-077 instance query');
            }
            return (target.query as any)(text, values);
          };
        }
        return target[prop as keyof typeof target];
      }
    });
    const res8 = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      failingClientBU077 as unknown as PoolClient,
      tenantA,
      examTrueTrueComplete,
      grantedCapability
    );
    if (res8.type !== 'unavailable') {
      throw new Error(`Test 8 Failed (BU-077 query failure): expected unavailable, got ${JSON.stringify(res8)}`);
    }

    // Test 9: Sub-call query failure in BU-075 -> unavailable
    const failingClientBU075 = new Proxy(poolClient, {
      get(target, prop) {
        if (prop === 'query') {
          return async (text: string, values?: any[]) => {
            if (typeof text === 'string' && text.includes('secure_assessment_exam_participant_room_assignments')) {
              throw new Error('Simulated DB failure for BU-075 query');
            }
            return (target.query as any)(text, values);
          };
        }
        return target[prop as keyof typeof target];
      }
    });
    const res9 = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      failingClientBU075 as unknown as PoolClient,
      tenantA,
      examTrueTrueComplete,
      grantedCapability
    );
    if (res9.type !== 'unavailable') {
      throw new Error(`Test 9 Failed (BU-075 query failure): expected unavailable, got ${JSON.stringify(res9)}`);
    }

    // Test 10: Sub-call query failure in BU-074 -> unavailable
    const failingClientBU074 = new Proxy(poolClient, {
      get(target, prop) {
        if (prop === 'query') {
          return async (text: string, values?: any[]) => {
            if (typeof text === 'string' && text.includes('covered_exam_room_count')) {
              throw new Error('Simulated DB failure for BU-074 query');
            }
            return (target.query as any)(text, values);
          };
        }
        return target[prop as keyof typeof target];
      }
    });
    const res10 = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      failingClientBU074 as unknown as PoolClient,
      tenantA,
      examTrueTrueComplete,
      grantedCapability
    );
    if (res10.type !== 'unavailable') {
      throw new Error(`Test 10 Failed (BU-074 query failure): expected unavailable, got ${JSON.stringify(res10)}`);
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
    console.log('ZERO MUTATION: PASS');

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

    // 10. Post-run zero leak verification
    const postRunLeakRes = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu077_%'`
    );
    if (postRunLeakRes.rowCount !== null && postRunLeakRes.rowCount > 0) {
      throw new Error(`POST-RUN LEAK DETECTED: Found ${postRunLeakRes.rowCount} dangling database(s) matching elligble_bu077_%`);
    }
    console.log('POST-RUN ZERO-LEAK: PASS');
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
