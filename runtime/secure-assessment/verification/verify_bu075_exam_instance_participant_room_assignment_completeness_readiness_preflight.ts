import { Client } from 'pg';
import type { PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import {
  checkExamInstanceParticipantRoomAssignmentCompletenessReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-participant-room-assignment-completeness-readiness-preflight.ts';

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
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu075_${runId}`;

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

    // Helper to create exam instance
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

    // --- Scenario 1: Zero Participants ---
    const examZeroParticipants = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);

    // --- Scenario 2: Zero Rooms ---
    const examZeroRooms = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    await createParticipant(tenantA, examZeroRooms);
    await createParticipant(tenantA, examZeroRooms);

    // --- Scenario 3: One Room, Zero Assignments ---
    const examZeroAssignments = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    await createParticipant(tenantA, examZeroAssignments);
    await createParticipant(tenantA, examZeroAssignments);
    await createExamRoom(tenantA, examZeroAssignments, 'Room 1');

    // --- Scenario 4: Partial Assignments ---
    const examPartialAssignments = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const pa1 = await createParticipant(tenantA, examPartialAssignments);
    const pa2 = await createParticipant(tenantA, examPartialAssignments);
    const pa3 = await createParticipant(tenantA, examPartialAssignments);
    const roomPartial1 = await createExamRoom(tenantA, examPartialAssignments, 'Room P1');
    const roomPartial2 = await createExamRoom(tenantA, examPartialAssignments, 'Room P2');
    await createParticipantRoomAssignment(tenantA, examPartialAssignments, pa1, roomPartial1);

    // --- Scenario 5: Full Assignments (all assigned) ---
    const examFullAssignments = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const fa1 = await createParticipant(tenantA, examFullAssignments);
    const fa2 = await createParticipant(tenantA, examFullAssignments);
    const roomFull1 = await createExamRoom(tenantA, examFullAssignments, 'Room F1');
    const roomFull2 = await createExamRoom(tenantA, examFullAssignments, 'Room F2');
    await createParticipantRoomAssignment(tenantA, examFullAssignments, fa1, roomFull1);
    await createParticipantRoomAssignment(tenantA, examFullAssignments, fa2, roomFull2);

    // --- Scenario 6: Multiple Participants Same Room ---
    const examSameRoom = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const sr1 = await createParticipant(tenantA, examSameRoom);
    const sr2 = await createParticipant(tenantA, examSameRoom);
    const sr3 = await createParticipant(tenantA, examSameRoom);
    const roomSame = await createExamRoom(tenantA, examSameRoom, 'Room Same');
    await createParticipantRoomAssignment(tenantA, examSameRoom, sr1, roomSame);
    await createParticipantRoomAssignment(tenantA, examSameRoom, sr2, roomSame);
    await createParticipantRoomAssignment(tenantA, examSameRoom, sr3, roomSame);

    // --- Scenario 7: Other Exam Isolation ---
    const examOther = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA);
    const oa1 = await createParticipant(tenantA, examOther);
    const roomOther = await createExamRoom(tenantA, examOther, 'Room Other');
    await createParticipantRoomAssignment(tenantA, examOther, oa1, roomOther);

    // --- Scenario 8: Other Tenant Isolation ---
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

    const examTenantB = await createExamInstance(tenantB, teachingAssignmentB, assessmentTypeB);
    const tb1 = await createParticipant(tenantB, examTenantB);
    const roomTenantB = await createExamRoom(tenantB, examTenantB, 'Room Tenant B');
    await createParticipantRoomAssignment(tenantB, examTenantB, tb1, roomTenantB);

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

    // 7. Execute BU-075 preflight tests against real PostgreSQL

    // Test 1: Zero Participants -> not_ready: participant_empty
    const res1 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examZeroParticipants, grantedCapability);
    if (res1.type !== 'not_ready' || res1.blocker !== 'participant_empty') {
      throw new Error(`Test 1 Failed (Zero Participants): got ${JSON.stringify(res1)}`);
    }

    // Test 2: Zero Rooms -> no_exam_rooms
    const res2 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examZeroRooms, grantedCapability);
    if (
      res2.type !== 'no_exam_rooms' ||
      res2.tenantId !== tenantA ||
      res2.examInstanceId !== examZeroRooms ||
      res2.participantCount !== 2 ||
      res2.assignedParticipantCount !== 0 ||
      res2.unassignedParticipantCount !== 2
    ) {
      throw new Error(`Test 2 Failed (Zero Rooms): got ${JSON.stringify(res2)}`);
    }

    // Test 3: Zero Assignments -> not_ready: participant_room_assignment_incomplete
    const res3 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examZeroAssignments, grantedCapability);
    if (
      res3.type !== 'not_ready' ||
      res3.blocker !== 'participant_room_assignment_incomplete' ||
      res3.participantCount !== 2 ||
      res3.assignedParticipantCount !== 0 ||
      res3.unassignedParticipantCount !== 2
    ) {
      throw new Error(`Test 3 Failed (Zero Assignments): got ${JSON.stringify(res3)}`);
    }

    // Test 4: Partial Assignments -> participant_room_assignment_incomplete
    const res4 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examPartialAssignments, grantedCapability);
    if (
      res4.type !== 'not_ready' ||
      res4.blocker !== 'participant_room_assignment_incomplete' ||
      res4.participantCount !== 3 ||
      res4.assignedParticipantCount !== 1 ||
      res4.unassignedParticipantCount !== 2
    ) {
      throw new Error(`Test 4 Failed (Partial Assignments): got ${JSON.stringify(res4)}`);
    }

    // Test 5: Full Assignments -> participant_room_assignment_completeness_ready
    const res5 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examFullAssignments, grantedCapability);
    if (
      res5.type !== 'participant_room_assignment_completeness_ready' ||
      res5.tenantId !== tenantA ||
      res5.examInstanceId !== examFullAssignments ||
      res5.participantCount !== 2 ||
      res5.assignedParticipantCount !== 2 ||
      res5.unassignedParticipantCount !== 0
    ) {
      throw new Error(`Test 5 Failed (Full Assignments): got ${JSON.stringify(res5)}`);
    }

    // Test 6: Multiple Participants Same Room -> completeness_ready
    const res6 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examSameRoom, grantedCapability);
    if (
      res6.type !== 'participant_room_assignment_completeness_ready' ||
      res6.participantCount !== 3 ||
      res6.assignedParticipantCount !== 3 ||
      res6.unassignedParticipantCount !== 0
    ) {
      throw new Error(`Test 6 Failed (Same Room): got ${JSON.stringify(res6)}`);
    }

    // Test 7: Other Exam Isolation
    const res7 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examOther, grantedCapability);
    if (
      res7.type !== 'participant_room_assignment_completeness_ready' ||
      res7.participantCount !== 1 ||
      res7.assignedParticipantCount !== 1 ||
      res7.unassignedParticipantCount !== 0
    ) {
      throw new Error(`Test 7 Failed (Other Exam Isolation): got ${JSON.stringify(res7)}`);
    }

    // Test 8: Other Tenant Isolation
    const res8 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantB, examTenantB, grantedCapability);
    if (
      res8.type !== 'participant_room_assignment_completeness_ready' ||
      res8.tenantId !== tenantB ||
      res8.examInstanceId !== examTenantB ||
      res8.participantCount !== 1 ||
      res8.assignedParticipantCount !== 1 ||
      res8.unassignedParticipantCount !== 0
    ) {
      throw new Error(`Test 8 Failed (Other Tenant Isolation): got ${JSON.stringify(res8)}`);
    }

    // Test 9: DB query failure for BU-075-owned query -> unavailable
    const failingClient = new Proxy(poolClient, {
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
    const res9 = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(failingClient as unknown as PoolClient, tenantA, examFullAssignments, grantedCapability);
    if (res9.type !== 'unavailable') {
      throw new Error(`Test 9 Failed (DB failure): got ${JSON.stringify(res9)}`);
    }

    // Test 10: capability evaluator receives exact tenantId + examInstanceId
    let passedContext: any = null;
    const trackingCapability: CapabilityEvaluator = async (ctx) => {
      passedContext = ctx;
      return 'granted';
    };
    await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examFullAssignments, trackingCapability);
    if (!passedContext || passedContext.tenantId !== tenantA || passedContext.examInstanceId !== examFullAssignments) {
      throw new Error(`Test 10 Failed (Capability Context): got ${JSON.stringify(passedContext)}`);
    }

    // Test 11: capability evaluator invoked exactly once
    let evalCount = 0;
    const countingCapability: CapabilityEvaluator = async () => {
      evalCount++;
      return 'granted';
    };
    await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(poolClient, tenantA, examFullAssignments, countingCapability);
    if (evalCount !== 1) {
      throw new Error(`Test 11 Failed (Capability Invocation Count): expected 1, got ${evalCount}`);
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
