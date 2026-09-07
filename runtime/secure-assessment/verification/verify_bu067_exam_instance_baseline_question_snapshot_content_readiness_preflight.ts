import { Client } from 'pg';
import type { PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import { checkExamInstanceBaselineQuestionSnapshotContentReadiness } from '../src/exam-instance-baseline-question-snapshot-content-readiness-preflight.ts';

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
    dbName = `elligble_bu067_${runId}`;

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

    // 1. apply canonical migrations 0001..0030
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

    // 2. create minimum valid tenant / Exam Instance fixture
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const person1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const member1 = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, person1])).rows[0].id;
    const teacher1 = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, member1])).rows[0].id;
    const year1 = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const period1 = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, year1])).rows[0].id;
    const subject1 = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics') RETURNING id`, [tenantA])).rows[0].id;
    const grade1 = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantA])).rows[0].id;
    const group1 = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [tenantA, year1, grade1])).rows[0].id;
    const offering1 = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subject1, period1, grade1])).rows[0].id;
    const ta1 = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacher1, offering1, group1])).rows[0].id;
    const atId = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE') RETURNING id`, [tenantA])).rows[0].id;

    // Main SCHEDULED Exam Instance
    const examInstRow = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', TIMESTAMPTZ '2026-10-01 08:00:00Z', TIMESTAMPTZ '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id, xmin, lifecycle_state
    `, [tenantA, ta1, atId])).rows[0];
    const examInstId = examInstRow.id;
    const examInstXminBefore = examInstRow.xmin;

    // Empty SCHEDULED Exam Instance (for zero snapshots block)
    const emptyExamInstRow = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', TIMESTAMPTZ '2026-10-01 08:00:00Z', TIMESTAMPTZ '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, ta1, atId])).rows[0];
    const emptyExamId = emptyExamInstRow.id;

    // DRAFT Exam Instance
    const draftExamRow = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'DRAFT', TIMESTAMPTZ '2026-10-01 08:00:00Z', TIMESTAMPTZ '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, ta1, atId])).rows[0];
    const draftExamId = draftExamRow.id;

    // Different tenant
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    // 3. insert valid snapshots into Main SCHEDULED Exam Instance
    const validPayload = {
      schemaVersion: 1,
      questionType: 'MULTIPLE_CHOICE_SINGLE',
      prompt: { text: 'Q1' },
      options: [
        { id: 'opt1', content: { text: 'A' } },
        { id: 'opt2', content: { text: 'B' } },
        { id: 'opt3', content: { text: 'C' } },
        { id: 'opt4', content: { text: 'D' } },
        { id: 'opt5', content: { text: 'E' } }
      ],
      correctOptionId: 'opt1',
      maxScore: 5
    };

    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content)
      VALUES ($1, $2, $3::jsonb)
    `, [tenantA, examInstId, JSON.stringify(validPayload)]);

    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content)
      VALUES ($1, $2, $3::jsonb)
    `, [tenantA, examInstId, JSON.stringify(validPayload)]);

    let poolClient = testClient as unknown as PoolClient;

    // Check Question Bank non-mutation proof (Before)
    const qbCountBefore = await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_question_bank_items`);

    // Check Snapshot non-mutation proof (Before)
    const snapshotRowsBefore = (await testClient.query(`
      SELECT id, xmin, frozen_content FROM public.secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 ORDER BY id ASC
    `, [examInstId])).rows;

    // Check valid multiple snapshots
    const res1 = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      poolClient, tenantA, examInstId, () => 'granted'
    );
    if (res1.type !== 'baseline_question_snapshot_content_ready' || res1.questionSnapshotCount !== 2) {
      throw new Error(`Expected ready with 2 snapshots, got: ${JSON.stringify(res1)}`);
    }

    // Check Snapshot non-mutation proof (After)
    const snapshotRowsAfter = (await testClient.query(`
      SELECT id, xmin, frozen_content FROM public.secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 ORDER BY id ASC
    `, [examInstId])).rows;
    if (snapshotRowsBefore.length !== snapshotRowsAfter.length) {
      throw new Error('Snapshot count mutated by preflight');
    }
    for (let i = 0; i < snapshotRowsBefore.length; i++) {
      if (snapshotRowsBefore[i].id !== snapshotRowsAfter[i].id) throw new Error('Snapshot ID mutated by preflight');
      if (snapshotRowsBefore[i].xmin !== snapshotRowsAfter[i].xmin) throw new Error('Snapshot xmin mutated by preflight (UPDATE occurred)');
      if (JSON.stringify(snapshotRowsBefore[i].frozen_content) !== JSON.stringify(snapshotRowsAfter[i].frozen_content)) throw new Error('Snapshot frozen_content mutated by preflight');
    }

    // Exam with zero snapshots (Empty SCHEDULED)
    const res2 = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      poolClient, tenantA, emptyExamId, () => 'granted'
    );
    if (res2.type !== 'not_ready' || res2.blocker !== 'question_snapshot_empty') {
      throw new Error(`Expected zero snapshots blocker, got: ${JSON.stringify(res2)}`);
    }

    // Exam with DRAFT state
    const res3 = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      poolClient, tenantA, draftExamId, () => 'granted'
    );
    if (res3.type !== 'invalid_state') {
      throw new Error(`Expected invalid_state, got: ${JSON.stringify(res3)}`);
    }

    // Tenant isolation
    const res4 = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      poolClient, tenantB, examInstId, () => 'granted'
    );
    if (res4.type !== 'denied') {
      throw new Error(`Expected denied for cross tenant, got: ${JSON.stringify(res4)}`);
    }

    // Explicit Nonexistent Exam Proof
    const nonexistentExamId = '00000000-0000-0000-0000-000000000000';
    const resNonexistent = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      poolClient, tenantA, nonexistentExamId, () => 'granted'
    );
    if (resNonexistent.type !== 'denied') {
      throw new Error(`Expected denied for nonexistent exam, got: ${JSON.stringify(resNonexistent)}`);
    }

    // Insert an invalid snapshot to test exact BU-066 blocker propagation & deterministic first block
    const invalidPayload1 = { ...validPayload, questionType: 'INVALID' }; // -> question_type_invalid
    const invalidPayload2 = { ...validPayload, schemaVersion: 99 }; // -> schema_version_invalid

    const inv1Res = await testClient.query(`
      INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content)
      VALUES ($1, $2, $3::jsonb) RETURNING id
    `, [tenantA, examInstId, JSON.stringify(invalidPayload1)]);
    
    const inv2Res = await testClient.query(`
      INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content)
      VALUES ($1, $2, $3::jsonb) RETURNING id
    `, [tenantA, examInstId, JSON.stringify(invalidPayload2)]);
    
    const id1 = inv1Res.rows[0].id;
    const id2 = inv2Res.rows[0].id;
    const firstId = id1 < id2 ? id1 : id2;
    const firstBlocker = id1 < id2 ? 'question_type_invalid' : 'schema_version_invalid';

    const res5 = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      poolClient, tenantA, examInstId, () => 'granted'
    );
    if (res5.type !== 'not_ready' || res5.blocker !== 'question_snapshot_content_invalid' || res5.snapshotId !== firstId || res5.contentBlocker !== firstBlocker) {
      throw new Error(`Expected first invalid blocker ${firstBlocker} on ${firstId}, got: ${JSON.stringify(res5)}`);
    }

    // Verify Question Bank non-mutation proof (After)
    const qbCountAfter = await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_question_bank_items`);
    if (qbCountBefore.rows[0].count !== qbCountAfter.rows[0].count) {
      throw new Error('Question bank mutation detected');
    }
    if (parseInt(qbCountAfter.rows[0].count, 10) !== 0) {
      throw new Error('Question bank items were created');
    }

    // Verify mutations
    const recheckExamInst = await testClient.query(`SELECT xmin, lifecycle_state FROM public.secure_assessment_exam_instances WHERE id = $1`, [examInstId]);
    if (recheckExamInst.rows[0].xmin !== examInstXminBefore) {
      throw new Error('Exam Instance xmin changed');
    }

    const attemptCount = await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`);
    if (parseInt(attemptCount.rows[0].count, 10) !== 0) {
      throw new Error('Attempts were created');
    }

    const sessionCount = await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`);
    if (parseInt(sessionCount.rows[0].count, 10) !== 0) {
      throw new Error('Sessions were created');
    }

    const acCount = await testClient.query(`SELECT COUNT(*) as count FROM public.academic_core_teaching_assignments`);
    if (parseInt(acCount.rows[0].count, 10) !== 1) {
      throw new Error('Academic core mutation detected');
    }

    const migrationCheck = await testClient.query(`SELECT COUNT(migration_id) as count FROM public.elligble_migration_history`);
    if (parseInt(migrationCheck.rows[0].count, 10) !== 30) {
      throw new Error(`Expected 30 migrations, got ${migrationCheck.rows[0].count}`);
    }

    // Cleanup disposable database
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
