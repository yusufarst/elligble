import { Client } from 'pg';
import type { PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import { checkExamInstanceBaselineScoringReadiness } from '../src/exam-instance-baseline-scoring-readiness-preflight.ts';

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
    dbName = `elligble_bu069_${runId}`;

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
    const participantPersonId = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const FIRST_STABLE_SNAPSHOT_ID = '00000000-0000-4000-8000-000000069001';
    const SECOND_STABLE_SNAPSHOT_ID = '00000000-0000-4000-8000-000000069002';

    // Helper to create exam instances for different blocker states
    async function createExamFixture(opts: {
      lifecycle?: string;
      snapshotSetup?: 'none' | 'one_valid' | 'multi_valid' | 'one_invalid' | 'multi_invalid';
      snapshotIds?: {
        first: string;
        second: string;
      };
    }) {
      const examInstId = (await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
          window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        tenantA,
        teachingAssignment,
        assessmentTypeId,
        opts.lifecycle || 'SCHEDULED',
        '2026-10-01 08:00:00Z',
        '2026-10-01 10:00:00Z',
        3600,
        'FULL_DURATION_BEYOND_WINDOW'
      ])).rows[0].id;

      await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_participants (
          tenant_id, exam_instance_id, person_id
        ) VALUES ($1, $2, $3)
      `, [tenantA, examInstId, participantPersonId]);

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

      if (opts.snapshotSetup === 'one_valid') {
        await testClient!.query(
          `INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`,
          [tenantA, examInstId, JSON.stringify(validPayload)]
        );
      } else if (opts.snapshotSetup === 'multi_valid') {
        await testClient!.query(
          `INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`,
          [tenantA, examInstId, JSON.stringify(validPayload)]
        );
        await testClient!.query(
          `INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`,
          [tenantA, examInstId, JSON.stringify({ ...validPayload, maxScore: 10 })]
        );
      } else if (opts.snapshotSetup === 'one_invalid') {
        await testClient!.query(
          `INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`,
          [tenantA, examInstId, JSON.stringify({ ...validPayload, correctOptionId: '99' })]
        );
      } else if (opts.snapshotSetup === 'multi_invalid') {
        const firstId = opts.snapshotIds?.first || FIRST_STABLE_SNAPSHOT_ID;
        const secondId = opts.snapshotIds?.second || SECOND_STABLE_SNAPSHOT_ID;
        // First stable ID gets schema_version_invalid
        await testClient!.query(
          `INSERT INTO public.secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3, $4::jsonb)`,
          [firstId, tenantA, examInstId, JSON.stringify({ ...validPayload, schemaVersion: 2 })]
        );
        // Second stable ID gets question_type_invalid
        await testClient!.query(
          `INSERT INTO public.secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3, $4::jsonb)`,
          [secondId, tenantA, examInstId, JSON.stringify({ ...validPayload, questionType: 'INVALID' })]
        );
      }

      return examInstId;
    }

    const poolClient = testClient as unknown as PoolClient;

    // Zero-mutation proof setup: Around a valid call
    const validExamId = await createExamFixture({ snapshotSetup: 'one_valid' });

    // BEFORE runtime execution
    const beforeExamInstance = (await testClient.query(`
      SELECT id, tenant_id, lifecycle_state, xmin::text
      FROM public.secure_assessment_exam_instances
      WHERE id = $1
    `, [validExamId])).rows[0];

    const beforeSnapshots = (await testClient.query(`
      SELECT id, frozen_content::text, xmin::text
      FROM public.secure_assessment_exam_question_snapshots
      WHERE exam_instance_id = $1
      ORDER BY id ASC
    `, [validExamId])).rows;

    const beforeParticipants = (await testClient.query(`
      SELECT id, person_id, xmin::text
      FROM public.secure_assessment_exam_participants
      WHERE exam_instance_id = $1
      ORDER BY id ASC
    `, [validExamId])).rows;

    const beforeQbCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_question_bank_items`)).rows[0].count, 10);
    const beforeAttemptsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    const beforeSessionsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);

    const beforeAcademicCoreRows = {
      teachingAssignment: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_teaching_assignments WHERE id = $1`, [teachingAssignment])).rows[0],
    };

    // 1. One valid snapshot -> baseline_scoring_ready -> exact count -> exact totalMaxScore
    const res1 = await checkExamInstanceBaselineScoringReadiness(poolClient, tenantA, validExamId, async () => true);
    if (res1.type !== 'baseline_scoring_ready' || res1.questionSnapshotCount !== 1 || res1.totalMaxScore !== 5) {
      throw new Error(`Expected baseline_scoring_ready with count 1 and max score 5, got: ${JSON.stringify(res1)}`);
    }

    // AFTER runtime execution: assert zero-mutation
    const afterExamInstance = (await testClient.query(`
      SELECT id, tenant_id, lifecycle_state, xmin::text
      FROM public.secure_assessment_exam_instances
      WHERE id = $1
    `, [validExamId])).rows[0];

    if (afterExamInstance.xmin !== beforeExamInstance.xmin) throw new Error('Exam instance row mutated');
    if (JSON.stringify(afterExamInstance) !== JSON.stringify(beforeExamInstance)) throw new Error('Exam instance row attributes mutated');

    const afterSnapshots = (await testClient.query(`
      SELECT id, frozen_content::text, xmin::text
      FROM public.secure_assessment_exam_question_snapshots
      WHERE exam_instance_id = $1
      ORDER BY id ASC
    `, [validExamId])).rows;

    if (afterSnapshots.length !== beforeSnapshots.length) throw new Error('Snapshots count mutated');
    for (let i = 0; i < beforeSnapshots.length; i++) {
      if (afterSnapshots[i].xmin !== beforeSnapshots[i].xmin) throw new Error(`Snapshot xmin mutated at index ${i}`);
    }

    const afterParticipants = (await testClient.query(`
      SELECT id, person_id, xmin::text
      FROM public.secure_assessment_exam_participants
      WHERE exam_instance_id = $1
      ORDER BY id ASC
    `, [validExamId])).rows;

    if (afterParticipants.length !== beforeParticipants.length) throw new Error('Participants count mutated');
    for (let i = 0; i < beforeParticipants.length; i++) {
      if (afterParticipants[i].xmin !== beforeParticipants[i].xmin) throw new Error(`Participant xmin mutated at index ${i}`);
    }

    const afterQbCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_question_bank_items`)).rows[0].count, 10);
    if (afterQbCount !== beforeQbCount) throw new Error('Question bank items mutated');

    const afterAttemptsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    if (afterAttemptsCount !== beforeAttemptsCount || afterAttemptsCount !== 0) throw new Error('Exam attempts created');

    const afterSessionsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);
    if (afterSessionsCount !== beforeSessionsCount || afterSessionsCount !== 0) throw new Error('Exam sessions created');

    const afterAcademicCoreRows = {
      teachingAssignment: (await testClient.query(`SELECT id, xmin::text FROM public.academic_core_teaching_assignments WHERE id = $1`, [teachingAssignment])).rows[0],
    };
    if (afterAcademicCoreRows.teachingAssignment.xmin !== beforeAcademicCoreRows.teachingAssignment.xmin) throw new Error('Academic core row mutated');

    // 2. Multiple valid snapshots -> exact aggregate count -> exact aggregate score
    const multiValidExamId = await createExamFixture({ snapshotSetup: 'multi_valid' });
    const resMultiValid = await checkExamInstanceBaselineScoringReadiness(poolClient, tenantA, multiValidExamId, async () => true);
    if (resMultiValid.type !== 'baseline_scoring_ready' || resMultiValid.questionSnapshotCount !== 2 || resMultiValid.totalMaxScore !== 15) {
      throw new Error(`Expected baseline_scoring_ready with count 2 and max score 15, got: ${JSON.stringify(resMultiValid)}`);
    }

    // 3. Empty snapshot set -> question_snapshot_empty
    const emptySnapExamId = await createExamFixture({ snapshotSetup: 'none' });
    const resEmpty = await checkExamInstanceBaselineScoringReadiness(poolClient, tenantA, emptySnapExamId, async () => true);
    if (resEmpty.type !== 'not_ready' || resEmpty.blocker !== 'question_snapshot_empty') {
      throw new Error(`Expected question_snapshot_empty, got: ${JSON.stringify(resEmpty)}`);
    }

    // 4. Invalid scoring source -> scoring_snapshot_invalid -> exact snapshotId -> exact BU-066 contentBlocker
    const invalidSnapExamId = await createExamFixture({ snapshotSetup: 'one_invalid' });
    const expectedInvalidSnapshotId = (await testClient.query(
      `SELECT id FROM public.secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1`,
      [invalidSnapExamId]
    )).rows[0].id;
    const resInvalid = await checkExamInstanceBaselineScoringReadiness(poolClient, tenantA, invalidSnapExamId, async () => true);
    if (
      resInvalid.type !== 'not_ready' ||
      resInvalid.blocker !== 'scoring_snapshot_invalid' ||
      (resInvalid as any).snapshotId !== expectedInvalidSnapshotId ||
      (resInvalid as any).contentBlocker !== 'correct_option_invalid'
    ) {
      throw new Error(`Expected correct_option_invalid for ${expectedInvalidSnapshotId}, got: ${JSON.stringify(resInvalid)}`);
    }

    // 5. Two invalid snapshots with deterministic explicit IDs -> lowest stable ID wins
    const multiInvalidExamId = await createExamFixture({
      snapshotSetup: 'multi_invalid',
      snapshotIds: {
        first: FIRST_STABLE_SNAPSHOT_ID,
        second: SECOND_STABLE_SNAPSHOT_ID
      }
    });
    const resMultiInvalid = await checkExamInstanceBaselineScoringReadiness(poolClient, tenantA, multiInvalidExamId, async () => true);
    if (
      resMultiInvalid.type !== 'not_ready' ||
      resMultiInvalid.blocker !== 'scoring_snapshot_invalid' ||
      (resMultiInvalid as any).snapshotId !== FIRST_STABLE_SNAPSHOT_ID ||
      (resMultiInvalid as any).contentBlocker !== 'schema_version_invalid'
    ) {
      throw new Error(`Expected schema_version_invalid for ${FIRST_STABLE_SNAPSHOT_ID}, got: ${JSON.stringify(resMultiInvalid)}`);
    }

    // 6. non-SCHEDULED -> invalid_state
    const draftExamId = await createExamFixture({ lifecycle: 'DRAFT', snapshotSetup: 'one_valid' });
    const resDraft = await checkExamInstanceBaselineScoringReadiness(poolClient, tenantA, draftExamId, async () => true);
    if (resDraft.type !== 'invalid_state') {
      throw new Error(`Expected invalid_state, got: ${JSON.stringify(resDraft)}`);
    }

    // 7. cross-tenant -> denied
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const resCrossTenant = await checkExamInstanceBaselineScoringReadiness(poolClient, tenantB, validExamId, async () => true);
    if (resCrossTenant.type !== 'denied') {
      throw new Error(`Expected denied cross-tenant, got: ${JSON.stringify(resCrossTenant)}`);
    }

    // 8. nonexistent Exam Instance -> denied
    const nonexistent = '00000000-0000-0000-0000-000000000000';
    const resNonexistent = await checkExamInstanceBaselineScoringReadiness(poolClient, tenantA, nonexistent, async () => true);
    if (resNonexistent.type !== 'denied') {
      throw new Error(`Expected denied nonexistent, got: ${JSON.stringify(resNonexistent)}`);
    }

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
