import { Client } from 'pg';
import type { PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import { checkExamInstanceBaselineReadinessChecksCompositionPreflight } from '../src/exam-instance-baseline-readiness-checks-composition-preflight.ts';

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
    dbName = `elligble_bu068_${runId}`;

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

    // 1. Apply canonical migrations 0001..0030
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const sqlFiles = files
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort((a, b) => a.localeCompare(b));

    for (let i = 1; i <= 30; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFiles = sqlFiles.filter((f) => f.startsWith(`${prefix}_`));
      if (matchingFiles.length !== 1) {
        throw new Error(`Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`);
      }
      const filePath = path.join(MIGRATIONS_DIR, matchingFiles[0]);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    const migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 30) {
      throw new Error(`Expected exactly 30 migrations applied, got ${migrationHistory.rows[0].count}`);
    }

    // Tenant and Base Academic Core (minimum valid prerequisite chain)
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherPerson = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherMember = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, teacherPerson])).rows[0].id;
    const teacherAssignment = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, teacherMember])).rows[0].id;

    const academicYear = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const academicPeriod = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, academicYear])).rows[0].id;
    const subject = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics') RETURNING id`, [tenantA])).rows[0].id;
    const gradeLevel = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantA])).rows[0].id;
    const academicGroup = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [tenantA, academicYear, gradeLevel])).rows[0].id;
    const subjectOffering = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subject, academicPeriod, gradeLevel])).rows[0].id;
    const teachingAssignment = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacherAssignment, subjectOffering, academicGroup])).rows[0].id;

    const assessmentTypeId = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE') RETURNING id`, [tenantA])).rows[0].id;

    // Canonical participant person (no nonexistent tenant_student_enrollments)
    const participantPersonId = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    // Helper to create exam instances for different blocker states
    async function createExamFixture(opts: {
      lifecycle?: string;
      noAssessmentType?: boolean;
      noParticipant?: boolean;
      noTiming?: boolean;
      durationWindowIncompatible?: boolean;
      noSnapshot?: boolean;
      invalidSnapshot?: boolean;
      multipleInvalidSnapshot?: boolean;
    }) {
      let durationSeconds: number | null = 3600;
      let policy = 'FULL_DURATION_BEYOND_WINDOW';
      const windowStart = '2026-10-01 08:00:00Z';
      const windowEnd = '2026-10-01 10:00:00Z';

      if (opts.noTiming) {
        // Isolated timing blocker: duration null, valid window and valid latest_start_policy
        durationSeconds = null;
        policy = 'FULL_DURATION_BEYOND_WINDOW';
      } else if (opts.durationWindowIncompatible) {
        // Isolated duration/window blocker: duration > window (10800 > 7200), policy LATE_START_BLOCKED
        durationSeconds = 10800;
        policy = 'LATE_START_BLOCKED';
      }

      const examInstId = (await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
          window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        tenantA,
        teachingAssignment,
        opts.noAssessmentType ? null : assessmentTypeId,
        opts.lifecycle || 'SCHEDULED',
        windowStart,
        windowEnd,
        durationSeconds,
        policy
      ])).rows[0].id;

      if (!opts.noParticipant) {
        await testClient!.query(`
          INSERT INTO public.secure_assessment_exam_participants (
            tenant_id, exam_instance_id, person_id
          ) VALUES ($1, $2, $3)
        `, [tenantA, examInstId, participantPersonId]);
      }

      const validPayload = {
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

      if (!opts.noSnapshot) {
        if (opts.multipleInvalidSnapshot) {
          const firstSnapshotId = '00000000-0000-4000-8000-000000000001';
          const secondSnapshotId = '00000000-0000-4000-8000-000000000002';
          const inv1 = { ...validPayload, questionType: 'INVALID' };
          const inv2 = { ...validPayload, schemaVersion: 99 };
          await testClient!.query(
            `INSERT INTO public.secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3, $4::jsonb)`,
            [firstSnapshotId, tenantA, examInstId, JSON.stringify(inv1)]
          );
          await testClient!.query(
            `INSERT INTO public.secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3, $4::jsonb)`,
            [secondSnapshotId, tenantA, examInstId, JSON.stringify(inv2)]
          );
        } else if (opts.invalidSnapshot) {
          const inv1 = { ...validPayload, questionType: 'INVALID' };
          await testClient!.query(`INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`, [tenantA, examInstId, JSON.stringify(inv1)]);
        } else {
          await testClient!.query(`INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`, [tenantA, examInstId, JSON.stringify(validPayload)]);
        }
      }

      return examInstId;
    }

    const poolClient = testClient as unknown as PoolClient;

    // 1. Fully valid SCHEDULED baseline composition PASS with strengthened zero-mutation proof
    const validExamId = await createExamFixture({});

    // BEFORE runtime execution: capture deterministic state of target entities and tables
    const beforeExamInstance = (await testClient.query(`
      SELECT id, tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
             window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
             xmin::text
      FROM public.secure_assessment_exam_instances
      WHERE id = $1
    `, [validExamId])).rows[0];

    const beforeSnapshots = (await testClient.query(`
      SELECT id, tenant_id, exam_instance_id, frozen_content::text, xmin::text
      FROM public.secure_assessment_exam_question_snapshots
      WHERE exam_instance_id = $1
      ORDER BY id ASC
    `, [validExamId])).rows;

    const beforeParticipants = (await testClient.query(`
      SELECT id, tenant_id, exam_instance_id, person_id, xmin::text
      FROM public.secure_assessment_exam_participants
      WHERE exam_instance_id = $1
      ORDER BY id ASC
    `, [validExamId])).rows;

    const beforeQbCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_question_bank_items`)).rows[0].count, 10);
    const beforeAttemptsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    const beforeSessionsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);

    const beforeAcademicCoreRows = {
      teachingAssignment: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_teaching_assignments WHERE id = $1`, [teachingAssignment])).rows[0],
      subjectOffering: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_subject_offerings WHERE id = $1`, [subjectOffering])).rows[0],
      academicGroup: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_academic_groups WHERE id = $1`, [academicGroup])).rows[0],
      subject: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_subjects WHERE id = $1`, [subject])).rows[0],
      gradeLevel: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_grade_levels WHERE id = $1`, [gradeLevel])).rows[0],
      academicPeriod: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_academic_periods WHERE id = $1`, [academicPeriod])).rows[0],
      academicYear: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_academic_years WHERE id = $1`, [academicYear])).rows[0],
      teacherAssignment: (await testClient.query(`SELECT id, xmin::text FROM public.tenant_teacher_assignments WHERE id = $1`, [teacherAssignment])).rows[0],
      teacherMember: (await testClient.query(`SELECT id, xmin::text FROM public.tenant_memberships WHERE id = $1`, [teacherMember])).rows[0],
      teacherPerson: (await testClient.query(`SELECT id, xmin::text FROM public.identity_persons WHERE id = $1`, [teacherPerson])).rows[0],
      participantPerson: (await testClient.query(`SELECT id, xmin::text FROM public.identity_persons WHERE id = $1`, [participantPersonId])).rows[0],
      assessmentType: (await testClient.query(`SELECT id, xmin::text FROM public.secure_assessment_assessment_types WHERE id = $1`, [assessmentTypeId])).rows[0],
    };

    // Execute BU-068 runtime
    const res1 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, validExamId, () => 'granted');
    if (res1.type !== 'baseline_readiness_checks_pass') throw new Error(`Expected pass, got: ${JSON.stringify(res1)}`);

    // AFTER runtime execution: assert exact before/after equality
    const afterExamInstance = (await testClient.query(`
      SELECT id, tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
             window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy,
             xmin::text
      FROM public.secure_assessment_exam_instances
      WHERE id = $1
    `, [validExamId])).rows[0];

    if (afterExamInstance.lifecycle_state !== 'SCHEDULED' || afterExamInstance.lifecycle_state !== beforeExamInstance.lifecycle_state) {
      throw new Error(`Exam instance lifecycle_state mutated: was ${beforeExamInstance.lifecycle_state}, now ${afterExamInstance.lifecycle_state}`);
    }
    if (afterExamInstance.xmin !== beforeExamInstance.xmin) {
      throw new Error(`Exam instance row was mutated (xmin changed: ${beforeExamInstance.xmin} -> ${afterExamInstance.xmin})`);
    }
    if (JSON.stringify(afterExamInstance) !== JSON.stringify(beforeExamInstance)) {
      throw new Error('Exam instance row attributes mutated');
    }

    const afterSnapshots = (await testClient.query(`
      SELECT id, tenant_id, exam_instance_id, frozen_content::text, xmin::text
      FROM public.secure_assessment_exam_question_snapshots
      WHERE exam_instance_id = $1
      ORDER BY id ASC
    `, [validExamId])).rows;

    if (afterSnapshots.length !== beforeSnapshots.length) {
      throw new Error(`Snapshots count mutated: was ${beforeSnapshots.length}, now ${afterSnapshots.length}`);
    }
    for (let i = 0; i < beforeSnapshots.length; i++) {
      if (afterSnapshots[i].id !== beforeSnapshots[i].id) {
        throw new Error(`Snapshot ID mutated at index ${i}`);
      }
      if (afterSnapshots[i].frozen_content !== beforeSnapshots[i].frozen_content) {
        throw new Error(`Snapshot frozen_content mutated at index ${i}`);
      }
      if (afterSnapshots[i].xmin !== beforeSnapshots[i].xmin) {
        throw new Error(`Snapshot xmin mutated at index ${i}: ${beforeSnapshots[i].xmin} -> ${afterSnapshots[i].xmin}`);
      }
    }

    const afterParticipants = (await testClient.query(`
      SELECT id, tenant_id, exam_instance_id, person_id, xmin::text
      FROM public.secure_assessment_exam_participants
      WHERE exam_instance_id = $1
      ORDER BY id ASC
    `, [validExamId])).rows;

    if (afterParticipants.length !== beforeParticipants.length) {
      throw new Error(`Participants count mutated: was ${beforeParticipants.length}, now ${afterParticipants.length}`);
    }
    for (let i = 0; i < beforeParticipants.length; i++) {
      if (afterParticipants[i].id !== beforeParticipants[i].id) {
        throw new Error(`Participant ID mutated at index ${i}`);
      }
      if (afterParticipants[i].person_id !== beforeParticipants[i].person_id) {
        throw new Error(`Participant person_id mutated at index ${i}`);
      }
      if (afterParticipants[i].xmin !== beforeParticipants[i].xmin) {
        throw new Error(`Participant xmin mutated at index ${i}: ${beforeParticipants[i].xmin} -> ${afterParticipants[i].xmin}`);
      }
    }

    const afterQbCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_question_bank_items`)).rows[0].count, 10);
    if (afterQbCount !== beforeQbCount) {
      throw new Error(`Question bank items mutated: was ${beforeQbCount}, now ${afterQbCount}`);
    }

    const afterAttemptsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    if (afterAttemptsCount !== beforeAttemptsCount || afterAttemptsCount !== 0) {
      throw new Error(`Exam attempts created: was ${beforeAttemptsCount}, now ${afterAttemptsCount}`);
    }

    const afterSessionsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);
    if (afterSessionsCount !== beforeSessionsCount || afterSessionsCount !== 0) {
      throw new Error(`Exam sessions created: was ${beforeSessionsCount}, now ${afterSessionsCount}`);
    }

    const afterAcademicCoreRows = {
      teachingAssignment: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_teaching_assignments WHERE id = $1`, [teachingAssignment])).rows[0],
      subjectOffering: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_subject_offerings WHERE id = $1`, [subjectOffering])).rows[0],
      academicGroup: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_academic_groups WHERE id = $1`, [academicGroup])).rows[0],
      subject: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_subjects WHERE id = $1`, [subject])).rows[0],
      gradeLevel: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_grade_levels WHERE id = $1`, [gradeLevel])).rows[0],
      academicPeriod: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_academic_periods WHERE id = $1`, [academicPeriod])).rows[0],
      academicYear: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_academic_years WHERE id = $1`, [academicYear])).rows[0],
      teacherAssignment: (await testClient.query(`SELECT id, xmin::text FROM public.tenant_teacher_assignments WHERE id = $1`, [teacherAssignment])).rows[0],
      teacherMember: (await testClient.query(`SELECT id, xmin::text FROM public.tenant_memberships WHERE id = $1`, [teacherMember])).rows[0],
      teacherPerson: (await testClient.query(`SELECT id, xmin::text FROM public.identity_persons WHERE id = $1`, [teacherPerson])).rows[0],
      participantPerson: (await testClient.query(`SELECT id, xmin::text FROM public.identity_persons WHERE id = $1`, [participantPersonId])).rows[0],
      assessmentType: (await testClient.query(`SELECT id, xmin::text FROM public.secure_assessment_assessment_types WHERE id = $1`, [assessmentTypeId])).rows[0],
    };

    for (const [key, beforeRow] of Object.entries(beforeAcademicCoreRows)) {
      const afterRow = (afterAcademicCoreRows as any)[key];
      if (!afterRow || afterRow.id !== (beforeRow as any).id || afterRow.xmin !== (beforeRow as any).xmin) {
        throw new Error(`Academic Core fixture row mutated: ${key}`);
      }
    }

    // 2. Assessment type blocker
    const assessmentExamId = await createExamFixture({ noAssessmentType: true });
    const res2 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, assessmentExamId, () => 'granted');
    if (res2.type !== 'not_ready' || res2.category !== 'assessment_type' || res2.blocker !== 'assessment_type_missing') {
      throw new Error(`Expected assessment_type blocker, got: ${JSON.stringify(res2)}`);
    }

    // 3. Snapshot presence blocker
    const snapPresenceExamId = await createExamFixture({ noSnapshot: true });
    const res3 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, snapPresenceExamId, () => 'granted');
    if (res3.type !== 'not_ready' || res3.category !== 'question_snapshot_presence' || res3.blocker !== 'question_snapshot_empty') {
      throw new Error(`Expected snapshot presence blocker, got: ${JSON.stringify(res3)}`);
    }

    // 4. Participant presence blocker
    const participantExamId = await createExamFixture({ noParticipant: true });
    const res4 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, participantExamId, () => 'granted');
    if (res4.type !== 'not_ready' || res4.category !== 'participant_presence' || res4.blocker !== 'participant_empty') {
      throw new Error(`Expected participant presence blocker, got: ${JSON.stringify(res4)}`);
    }

    // 5. Timing configuration blocker (isolated fixture: duration null, valid window and policy)
    const timingExamId = await createExamFixture({ noTiming: true });
    const res5 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, timingExamId, () => 'granted');
    if (res5.type !== 'not_ready' || res5.category !== 'timing_configuration_presence' || res5.blocker !== 'attempt_duration_missing') {
      throw new Error(`Expected timing configuration blocker attempt_duration_missing, got: ${JSON.stringify(res5)}`);
    }

    // 6. Duration/window compatibility blocker (isolated fixture: duration > window, LATE_START_BLOCKED at INSERT)
    const durationExamId = await createExamFixture({ durationWindowIncompatible: true });
    const res6 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, durationExamId, () => 'granted');
    if (res6.type !== 'not_ready' || res6.category !== 'duration_window_policy_compatibility' || res6.blocker !== 'attempt_duration_exceeds_window') {
      throw new Error(`Expected duration compatibility blocker attempt_duration_exceeds_window, got: ${JSON.stringify(res6)}`);
    }

    // 7. BU-067 invalid content mapping
    const invalidContentExamId = await createExamFixture({ invalidSnapshot: true });
    const res7 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, invalidContentExamId, () => 'granted');
    if (res7.type !== 'not_ready' || res7.category !== 'question_snapshot_content' || res7.blocker !== 'question_snapshot_content_invalid') {
      throw new Error(`Expected question_snapshot_content_invalid, got: ${JSON.stringify(res7)}`);
    }

    // 8. Deterministic first invalid snapshot semantics
    const multInvalidExamId = await createExamFixture({ multipleInvalidSnapshot: true });
    const res8 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, multInvalidExamId, () => 'granted');
    if (
      res8.type !== 'not_ready' ||
      res8.category !== 'question_snapshot_content' ||
      res8.blocker !== 'question_snapshot_content_invalid' ||
      (res8 as any).snapshotId !== '00000000-0000-4000-8000-000000000001' ||
      (res8 as any).contentBlocker !== 'question_type_invalid'
    ) {
      throw new Error(`Expected first invalid blocker question_type_invalid for snapshot 00000000-0000-4000-8000-000000000001, got: ${JSON.stringify(res8)}`);
    }

    // 9. non-SCHEDULED -> invalid_state
    const draftExamId = await createExamFixture({ lifecycle: 'DRAFT' });
    const res9 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, draftExamId, () => 'granted');
    if (res9.type !== 'invalid_state') throw new Error(`Expected invalid_state, got: ${JSON.stringify(res9)}`);

    // 10. cross-tenant -> denied
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const res10 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantB, validExamId, () => 'granted');
    if (res10.type !== 'denied') throw new Error(`Expected denied cross-tenant, got: ${JSON.stringify(res10)}`);

    // 11. nonexistent Exam Instance -> denied
    const nonexistent = '00000000-0000-0000-0000-000000000000';
    const res11 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, nonexistent, () => 'granted');
    if (res11.type !== 'denied') throw new Error(`Expected denied nonexistent, got: ${JSON.stringify(res11)}`);

    // Verify migration history unchanged
    const migrationCheck = await testClient.query(`SELECT COUNT(*) as count FROM public.elligble_migration_history`);
    if (parseInt(migrationCheck.rows[0].count, 10) !== 30) throw new Error('Migration mutated');

    // Fail-closed cleanup
    if (testClient) {
      await testClient.end();
      testClient = null;
    }
    if (rootClient && dbName) {
      await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      const checkDb = await rootClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
      if (checkDb.rowCount !== null && checkDb.rowCount > 0) {
        throw new Error(`DATABASE CLEANUP FAILED: Database ${dbName} still exists.`);
      }
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
      if (dbName) {
        try { await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`); } catch {}
      }
      try { await rootClient.end(); } catch {}
    }
  }
}

runVerification();
