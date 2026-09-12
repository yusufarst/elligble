import { Client } from 'pg';
import type { PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import {
  checkExamInstanceParticipantProctorScheduleConflictReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-participant-proctor-schedule-conflict-readiness-preflight.ts';
import {
  checkExamInstanceBaselineReadinessChecksCompositionPreflight
} from '../src/exam-instance-baseline-readiness-checks-composition-preflight.ts';

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

    // 0. Pre-run leak check: verify zero elligble_bu079_ databases exist
    const preRunLeakRes = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu079_%'`
    );
    if (preRunLeakRes.rowCount !== null && preRunLeakRes.rowCount > 0) {
      throw new Error(`PRE-RUN LEAK DETECTED: Found ${preRunLeakRes.rowCount} dangling database(s) matching elligble_bu079_%`);
    }
    console.log('PRE-RUN ZERO-LEAK: PASS');

    // Create disposable database
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu079_${runId}`;
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

    // Helper to create exam instance
    async function createExamInstance(
      tenant: string,
      teachingAssign: string,
      assessType: string,
      lifecycle = 'SCHEDULED',
      startsAt: string | null = '2026-10-01 08:00:00Z',
      endsAt: string | null = '2026-10-01 10:00:00Z',
      roomBasedEnabled: boolean | null = false,
      proctorPerRoomReq: boolean | null = false,
      customId?: string
    ) {
      const idClause = customId ? `id, ` : '';
      const valPlaceholder = customId ? `$11, ` : '';
      const values: any[] = [
        tenant,
        teachingAssign,
        assessType,
        lifecycle,
        startsAt,
        endsAt,
        3600,
        'FULL_DURATION_BEYOND_WINDOW',
        roomBasedEnabled,
        proctorPerRoomReq
      ];
      if (customId) values.push(customId);

      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_instances (
          ${idClause}tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
          window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
          room_based_operations_enabled, proctor_per_room_required
        ) VALUES (${valPlaceholder}$1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, values);
      return res.rows[0].id as string;
    }

    // Helper to create participant with given personId
    async function createParticipant(tenant: string, examInstanceId: string, personId: string) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [tenant, examInstanceId, personId]);
      return res.rows[0].id as string;
    }

    // Helper to create proctor assignment with given personId
    async function createProctor(tenant: string, examInstanceId: string, personId: string, revokedAt: string | null = null) {
      const res = await testClient!.query(`
        INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id, revoked_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [tenant, examInstanceId, personId, revokedAt]);
      return res.rows[0].id as string;
    }

    // Helper to create question snapshot for BU-068 integration test
    async function createQuestionSnapshot(tenant: string, examInstanceId: string) {
      const validContent = {
        schemaVersion: 1,
        questionType: 'MULTIPLE_CHOICE_SINGLE',
        prompt: { text: 'Q1' },
        options: [
          { id: '1', content: { text: 'A' } },
          { id: '2', content: { text: 'B' } },
          { id: '3', content: { text: 'C' } },
          { id: '4', content: { text: 'D' } },
          { id: '5', content: { text: 'E' } }
        ],
        correctOptionId: '1',
        maxScore: 5
      };
      await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content)
        VALUES ($1, $2, $3::jsonb)
      `, [tenant, examInstanceId, JSON.stringify(validContent)]);
    }

    // --- Fixture 1: Participant Conflict Test ---
    const studentPart = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const targetExamPart = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    await createParticipant(tenantA, targetExamPart, studentPart);
    await createQuestionSnapshot(tenantA, targetExamPart);

    const otherExamPart = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, otherExamPart, studentPart);

    // --- Fixture 2: Proctor Conflict Test ---
    const studentProcUnique = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const studentOtherProcUnique = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorProc1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const targetExamProctor = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    await createParticipant(tenantA, targetExamProctor, studentProcUnique);
    await createProctor(tenantA, targetExamProctor, proctorProc1);
    await createQuestionSnapshot(tenantA, targetExamProctor);

    const otherExamProctor = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, otherExamProctor, studentOtherProcUnique);
    await createProctor(tenantA, otherExamProctor, proctorProc1);

    // --- Fixture 3: Priority Test (both participant and proctor conflict) ---
    const studentPrio = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorPrio = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const targetExamPriority = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    await createParticipant(tenantA, targetExamPriority, studentPrio);
    await createProctor(tenantA, targetExamPriority, proctorPrio);

    const otherExamPriority = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, otherExamPriority, studentPrio);
    await createProctor(tenantA, otherExamPriority, proctorPrio);

    // --- Fixture 4: Revoked Proctor Exam (SCHEDULED, 09:00 - 11:00, proctor assignment revoked) ---
    const studentRevoked = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorRev = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const targetRevokedExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    await createParticipant(tenantA, targetRevokedExam, studentRevoked);
    await createProctor(tenantA, targetRevokedExam, proctorRev);

    const otherRevokedExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createProctor(tenantA, otherRevokedExam, proctorRev, '2026-09-30 12:00:00Z'); // Revoked!

    // --- Fixture 5: Boundary Touch Exam (10:00 - 12:00, exact boundary touch with 08:00 - 10:00) ---
    const targetBoundaryExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    const studentBoundary = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    await createParticipant(tenantA, targetBoundaryExam, studentBoundary);
    const boundaryTouchExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 10:00:00Z', '2026-10-01 12:00:00Z');
    await createParticipant(tenantA, boundaryTouchExam, studentBoundary);

    // --- Fixture 6: Non-Overlapping Exam (11:00 - 13:00) ---
    const nonOverlapExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 11:00:00Z', '2026-10-01 13:00:00Z');
    await createParticipant(tenantA, nonOverlapExam, studentBoundary);

    // --- Fixture 7: Other Tenant Isolation ---
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherPersonB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherMemberB = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantB, teacherPersonB])).rows[0].id;
    const teacherAssignmentB = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantB, teacherMemberB])).rows[0].id;
    const academicYearB = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantB])).rows[0].id;
    const academicPeriodB = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantB, academicYearB])).rows[0].id;
    const subjectB = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics') RETURNING id`, [tenantB])).rows[0].id;
    const gradeLevelB = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantB])).rows[0].id;
    const academicGroupB = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-B') RETURNING id`, [tenantB, academicYearB, gradeLevelB])).rows[0].id;
    const subjectOfferingB = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, subjectB, academicPeriodB, gradeLevelB])).rows[0].id;
    const teachingAssignmentB = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, teacherAssignmentB, subjectOfferingB, academicGroupB])).rows[0].id;
    const assessmentTypeB = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE B') RETURNING id`, [tenantB])).rows[0].id;

    const studentCross = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorCross = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const targetExamCrossA = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    await createParticipant(tenantA, targetExamCrossA, studentCross);
    await createProctor(tenantA, targetExamCrossA, proctorCross);

    // Tenant B exam overlapping targetExamCrossA (08:00 - 10:00) with studentCross and proctorCross
    const examTenantB = await createExamInstance(tenantB, teachingAssignmentB, assessmentTypeB, 'SCHEDULED', '2026-10-01 08:30:00Z', '2026-10-01 09:30:00Z');
    await createParticipant(tenantB, examTenantB, studentCross); // Same person ID, different tenant
    await createProctor(tenantB, examTenantB, proctorCross); // Same person ID, different tenant

    // --- Fixture 8: Multiple Conflicting Exams for Deterministic Sorting ---
    const targetMulti = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    const multiStudent = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    await createParticipant(tenantA, targetMulti, multiStudent);

    const uuidAlpha = '00000000-0000-4000-8000-000000000010';
    const uuidBeta = '00000000-0000-4000-8000-000000000020';
    await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z', false, false, uuidAlpha);
    await createParticipant(tenantA, uuidAlpha, multiStudent);
    await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z', false, false, uuidBeta);
    await createParticipant(tenantA, uuidBeta, multiStudent);

    // --- Fixture 9: Operational vs Non-Operational Lifecycle States ---
    const targetLifecycleExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    const lifeStudent = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    await createParticipant(tenantA, targetLifecycleExam, lifeStudent);

    // Non-operational: DRAFT, ENDED, FINALIZED, ARCHIVED
    const examDraft = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'DRAFT', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, examDraft, lifeStudent);
    const examEnded = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'ENDED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, examEnded, lifeStudent);
    const examFinalized = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'FINALIZED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, examFinalized, lifeStudent);
    const examArchived = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'ARCHIVED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, examArchived, lifeStudent);

    // Operational: READY, ACTIVE, PAUSED
    const lifeStudentReady = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const targetReadyExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    await createParticipant(tenantA, targetReadyExam, lifeStudentReady);
    const examReady = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'READY', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, examReady, lifeStudentReady);

    const lifeStudentActive = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const targetActiveExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    await createParticipant(tenantA, targetActiveExam, lifeStudentActive);
    const examActive = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'ACTIVE', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, examActive, lifeStudentActive);

    const lifeStudentPaused = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const targetPausedExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z');
    await createParticipant(tenantA, targetPausedExam, lifeStudentPaused);
    const examPaused = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'PAUSED', '2026-10-01 09:00:00Z', '2026-10-01 11:00:00Z');
    await createParticipant(tenantA, examPaused, lifeStudentPaused);

    // --- Fixture 10: Clean Target Exam for Clean Baseline Composition ---
    const cleanStudent = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const targetCleanExam = await createExamInstance(tenantA, teachingAssignmentA, assessmentTypeA, 'SCHEDULED', '2026-10-05 08:00:00Z', '2026-10-05 10:00:00Z');
    await createParticipant(tenantA, targetCleanExam, cleanStudent);
    await createQuestionSnapshot(tenantA, targetCleanExam);

    // Record BEFORE-state snapshot of all protected tables and academic core
    const tablesToTrack = [
      'secure_assessment_exam_instances',
      'secure_assessment_proctor_assignments',
      'secure_assessment_exam_rooms',
      'secure_assessment_exam_proctor_room_assignments',
      'secure_assessment_exam_participant_room_assignments',
      'secure_assessment_exam_participants',
      'secure_assessment_exam_question_snapshots',
      'secure_assessment_exam_attempts',
      'secure_assessment_exam_sessions',
      'academic_core_academic_years',
      'academic_core_academic_periods',
      'academic_core_subjects',
      'academic_core_grade_levels',
      'academic_core_academic_groups',
      'academic_core_subject_offerings',
      'academic_core_teaching_assignments',
      'tenant_tenants',
      'tenant_memberships',
      'tenant_teacher_assignments',
      'identity_persons',
      'elligble_migration_history'
    ];

    const beforeSnapshots: Record<string, { count: number; rows: string }> = {};
    for (const tbl of tablesToTrack) {
      beforeSnapshots[tbl] = await snapshotTable(testClient, tbl);
    }

    const poolClient = testClient as unknown as PoolClient;

    // --- PHYSICAL VERIFICATION SUITE ---

    // Test 1: Same-tenant participant overlapping conflict detected
    const res1 = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetExamPart,
      grantedCapability
    );
    if (
      res1.type !== 'not_ready' ||
      res1.blocker !== 'participant_schedule_conflict' ||
      res1.conflictingExamInstanceId !== otherExamPart ||
      res1.conflictingParticipantCount !== 1
    ) {
      throw new Error(`Test 1 Failed (Participant Conflict): got ${JSON.stringify(res1)}`);
    }
    console.log('PARTICIPANT CONFLICT: PASS');

    // Test 2: Same-tenant active-Proctor overlapping conflict detected
    const res2 = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetExamProctor,
      grantedCapability
    );
    if (
      res2.type !== 'not_ready' ||
      res2.blocker !== 'proctor_schedule_conflict' ||
      res2.conflictingExamInstanceId !== otherExamProctor ||
      res2.conflictingProctorCount !== 1
    ) {
      throw new Error(`Test 2 Failed (Proctor Conflict): got ${JSON.stringify(res2)}`);
    }
    console.log('PROCTOR CONFLICT: PASS');

    // Test 3: Participant blocker priority over Proctor conflict
    const res3 = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetExamPriority,
      grantedCapability
    );
    if (
      res3.type !== 'not_ready' ||
      res3.blocker !== 'participant_schedule_conflict' ||
      res3.conflictingExamInstanceId !== otherExamPriority ||
      res3.conflictingParticipantCount !== 1
    ) {
      throw new Error(`Test 3 Failed (Blocker Priority): expected participant_schedule_conflict, got ${JSON.stringify(res3)}`);
    }
    console.log('DETERMINISTIC FIRST BLOCKER: PASS');

    // Test 4: Cross-tenant isolation
    const res4A = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetExamCrossA,
      grantedCapability
    );
    if (res4A.type !== 'schedule_conflict_ready') {
      throw new Error(`Test 4 Failed (Cross-Tenant Isolation A): expected schedule_conflict_ready, got ${JSON.stringify(res4A)}`);
    }

    const res4B = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantB,
      examTenantB,
      grantedCapability
    );
    if (res4B.type !== 'schedule_conflict_ready') {
      throw new Error(`Test 4 Failed (Cross-Tenant Isolation B): expected schedule_conflict_ready, got ${JSON.stringify(res4B)}`);
    }
    console.log('CROSS-TENANT ISOLATION: PASS');

    // Test 5: Revoked Proctor assignment ignored
    const res5 = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetRevokedExam,
      grantedCapability
    );
    if (res5.type !== 'schedule_conflict_ready') {
      throw new Error(`Test 5 Failed (Revoked Proctor Ignored): expected schedule_conflict_ready, got ${JSON.stringify(res5)}`);
    }
    console.log('REVOKED PROCTOR IGNORE: PASS');

    // Test 6: Boundary-touch non-overlap
    const res6 = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetBoundaryExam,
      grantedCapability
    );
    if (res6.type !== 'schedule_conflict_ready') {
      throw new Error(`Test 6 Failed (Boundary Touch): expected schedule_conflict_ready, got ${JSON.stringify(res6)}`);
    }
    console.log('HALF-OPEN WINDOW SEMANTICS: PASS');

    // Test 7: Non-operational lifecycle states ignored
    const res7 = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetLifecycleExam,
      grantedCapability
    );
    if (res7.type !== 'schedule_conflict_ready') {
      throw new Error(`Test 7 Failed (Non-Operational Lifecycle Ignored): expected schedule_conflict_ready, got ${JSON.stringify(res7)}`);
    }
    console.log('NON-OPERATIONAL LIFECYCLE IGNORE: PASS');

    // Test 8: Operational lifecycle states conflict
    const res8Ready = await checkExamInstanceParticipantProctorScheduleConflictReadiness(poolClient, tenantA, targetReadyExam, grantedCapability);
    if (res8Ready.type !== 'not_ready' || res8Ready.blocker !== 'participant_schedule_conflict') {
      throw new Error(`Test 8 Failed (READY Conflict): got ${JSON.stringify(res8Ready)}`);
    }
    const res8Active = await checkExamInstanceParticipantProctorScheduleConflictReadiness(poolClient, tenantA, targetActiveExam, grantedCapability);
    if (res8Active.type !== 'not_ready' || res8Active.blocker !== 'participant_schedule_conflict') {
      throw new Error(`Test 8 Failed (ACTIVE Conflict): got ${JSON.stringify(res8Active)}`);
    }
    const res8Paused = await checkExamInstanceParticipantProctorScheduleConflictReadiness(poolClient, tenantA, targetPausedExam, grantedCapability);
    if (res8Paused.type !== 'not_ready' || res8Paused.blocker !== 'participant_schedule_conflict') {
      throw new Error(`Test 8 Failed (PAUSED Conflict): got ${JSON.stringify(res8Paused)}`);
    }
    console.log('OPERATIONAL LIFECYCLE COVERAGE: PASS');

    // Test 9: Deterministic conflicting Exam Instance selection (id ASC)
    const res9 = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetMulti,
      grantedCapability
    );
    if (
      res9.type !== 'not_ready' ||
      res9.blocker !== 'participant_schedule_conflict' ||
      res9.conflictingExamInstanceId !== uuidAlpha ||
      res9.conflictingParticipantCount !== 1
    ) {
      throw new Error(`Test 9 Failed (Deterministic Sorting): expected ${uuidAlpha}, got ${JSON.stringify(res9)}`);
    }
    console.log('DETERMINISTIC CONFLICTING SELECTION: PASS');

    // Test 10: No person ID leak in result
    if ('personId' in (res1 as any) || 'person_id' in (res1 as any) || 'personIds' in (res1 as any)) {
      throw new Error('Test 10 Failed: Person ID leaked in result');
    }
    console.log('NO PERSON-ID RESULT LEAK: PASS');

    // Test 11: Capability evaluator called exactly once with exact context
    let capabilityCount = 0;
    let receivedCtx: any = null;
    const trackingCapability: CapabilityEvaluator = async (ctx) => {
      capabilityCount++;
      receivedCtx = ctx;
      return 'granted' as const;
    };
    await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      poolClient,
      tenantA,
      targetCleanExam,
      trackingCapability
    );
    if (capabilityCount !== 1 || receivedCtx?.tenantId !== tenantA || receivedCtx?.examInstanceId !== targetCleanExam) {
      throw new Error(`Test 11 Failed: capability evaluator contract violation: count=${capabilityCount}, ctx=${JSON.stringify(receivedCtx)}`);
    }
    console.log('CAPABILITY EVALUATOR EXACTLY ONCE: PASS');

    // Test 12: BU-068 integration mapping
    // 12a: participant conflict maps to category schedule_conflict
    const res12a = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      poolClient,
      tenantA,
      targetExamPart,
      grantedCapability
    );
    if (
      res12a.type !== 'not_ready' ||
      res12a.category !== 'schedule_conflict' ||
      res12a.blocker !== 'participant_schedule_conflict'
    ) {
      throw new Error(`Test 12a Failed (BU-068 integration participant conflict): got ${JSON.stringify(res12a)}`);
    }

    // 12b: proctor conflict maps to category schedule_conflict
    const res12b = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      poolClient,
      tenantA,
      targetExamProctor,
      grantedCapability
    );
    if (
      res12b.type !== 'not_ready' ||
      res12b.category !== 'schedule_conflict' ||
      res12b.blocker !== 'proctor_schedule_conflict'
    ) {
      throw new Error(`Test 12b Failed (BU-068 integration proctor conflict): got ${JSON.stringify(res12b)}`);
    }

    // 12c: clean exam passes baseline readiness composition
    const res12c = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
      poolClient,
      tenantA,
      targetCleanExam,
      grantedCapability
    );
    if (res12c.type !== 'baseline_readiness_checks_pass') {
      throw new Error(`Test 12c Failed (BU-068 integration clean pass): got ${JSON.stringify(res12c)}`);
    }
    console.log('BU-068 INTEGRATION: PASS');

    // Test 13: Database failure fails closed as unavailable
    const failingClient = new Proxy(poolClient, {
      get(target, prop) {
        if (prop === 'query') {
          return async (text: string, values?: any[]) => {
            if (typeof text === 'string' && text.includes('secure_assessment_exam_participants other_part')) {
              throw new Error('Simulated DB failure for participant conflict query');
            }
            return (target.query as any)(text, values);
          };
        }
        return target[prop as keyof typeof target];
      }
    });
    const res13 = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      failingClient as unknown as PoolClient,
      tenantA,
      targetCleanExam,
      grantedCapability
    );
    if (res13.type !== 'unavailable') {
      throw new Error(`Test 13 Failed (DB failure fails closed): expected unavailable, got ${JSON.stringify(res13)}`);
    }
    console.log('DATABASE FAILURE FAILS CLOSED: PASS');

    // 7. Prove READ-ONLY runtime: verify zero mutation to all protected tables and academic core
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

    // 8. Fail-closed cleanup: close target connection -> drop disposable DB -> prove pg_database does not contain it
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
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu079_%'`
    );
    if (postRunLeakRes.rowCount !== null && postRunLeakRes.rowCount > 0) {
      throw new Error(`POST-RUN LEAK DETECTED: Found ${postRunLeakRes.rowCount} dangling database(s) matching elligble_bu079_%`);
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
