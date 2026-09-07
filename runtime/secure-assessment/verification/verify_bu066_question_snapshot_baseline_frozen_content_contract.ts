import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import { validateBaselineQuestionSnapshotFrozenContent } from '../src/question-snapshot-baseline-frozen-content-contract.ts';

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
    dbName = `elligble_bu066_${runId}`;

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

    const examInstRow = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', TIMESTAMPTZ '2026-10-01 08:00:00Z', TIMESTAMPTZ '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id, xmin, lifecycle_state
    `, [tenantA, ta1, atId])).rows[0];
    const examInstId = examInstRow.id;
    const examInstXminBefore = examInstRow.xmin;

    // 3. insert canonical valid baseline snapshot JSONB
    const validPayload = {
      schemaVersion: 1,
      questionType: 'MULTIPLE_CHOICE_SINGLE',
      prompt: { text: 'What is the SI unit of electric current?' },
      options: [
        { id: 'opt-ampere', content: { text: 'Ampere' } },
        { id: 'opt-volt', content: { text: 'Volt' } },
        { id: 'opt-ohm', content: { text: 'Ohm' } },
        { id: 'opt-watt', content: { text: 'Watt' } },
        { id: 'opt-joule', content: { text: 'Joule' } }
      ],
      correctOptionId: 'opt-ampere',
      maxScore: 5
    };

    const validSnapshotInsert = await testClient.query(`
      INSERT INTO public.secure_assessment_exam_question_snapshots (
        tenant_id, exam_instance_id, frozen_content
      ) VALUES ($1, $2, $3::jsonb)
      RETURNING id, xmin
    `, [tenantA, examInstId, JSON.stringify(validPayload)]);
    const validSnapshotId = validSnapshotInsert.rows[0].id;
    const validSnapshotXmin = validSnapshotInsert.rows[0].xmin;

    // 4. SELECT the JSONB back from PostgreSQL
    const selectValid = await testClient.query(`
      SELECT id, frozen_content, xmin
      FROM public.secure_assessment_exam_question_snapshots
      WHERE id = $1
    `, [validSnapshotId]);
    const readValidSnapshot = selectValid.rows[0];

    // 5. validate using the BU-066 runtime contract
    const contractResult = validateBaselineQuestionSnapshotFrozenContent(readValidSnapshot.frozen_content);

    // 6. prove VALID
    if (contractResult.type !== 'baseline_question_snapshot_content_valid') {
      throw new Error(`Expected baseline_question_snapshot_content_valid, got: ${JSON.stringify(contractResult)}`);
    }
    if (
      contractResult.schemaVersion !== 1 ||
      contractResult.questionType !== 'MULTIPLE_CHOICE_SINGLE' ||
      contractResult.optionCount !== 5 ||
      contractResult.correctOptionId !== 'opt-ampere' ||
      contractResult.maxScore !== 5
    ) {
      throw new Error(`Contract result fields mismatch: ${JSON.stringify(contractResult)}`);
    }

    // 7. insert/read representative invalid payloads
    const invalidTestCases: Array<{ name: string; payload: unknown; expectedBlocker: string }> = [
      {
        name: 'unsupported type',
        payload: {
          ...validPayload,
          questionType: 'MULTIPLE_CHOICE_MULTIPLE'
        },
        expectedBlocker: 'question_type_invalid'
      },
      {
        name: 'incorrect option count',
        payload: {
          ...validPayload,
          options: validPayload.options.slice(0, 4)
        },
        expectedBlocker: 'option_count_invalid'
      },
      {
        name: 'duplicate IDs',
        payload: {
          ...validPayload,
          options: [
            { id: 'opt-dup', content: { text: 'Option 1' } },
            { id: 'opt-dup', content: { text: 'Option 2' } },
            { id: 'opt-3', content: { text: 'Option 3' } },
            { id: 'opt-4', content: { text: 'Option 4' } },
            { id: 'opt-5', content: { text: 'Option 5' } }
          ],
          correctOptionId: 'opt-dup'
        },
        expectedBlocker: 'option_identity_duplicate'
      },
      {
        name: 'missing/invalid correct option',
        payload: {
          ...validPayload,
          correctOptionId: 'opt-nonexistent'
        },
        expectedBlocker: 'correct_option_invalid'
      },
      {
        name: 'invalid maxScore',
        payload: {
          ...validPayload,
          maxScore: 0
        },
        expectedBlocker: 'max_score_invalid'
      }
    ];

    // 8. prove exact blockers
    for (const tc of invalidTestCases) {
      const insertRes = await testClient.query(`
        INSERT INTO public.secure_assessment_exam_question_snapshots (
          tenant_id, exam_instance_id, frozen_content
        ) VALUES ($1, $2, $3::jsonb)
        RETURNING id
      `, [tenantA, examInstId, JSON.stringify(tc.payload)]);
      const invId = insertRes.rows[0].id;

      const readRes = await testClient.query(`
        SELECT frozen_content
        FROM public.secure_assessment_exam_question_snapshots
        WHERE id = $1
      `, [invId]);

      const res = validateBaselineQuestionSnapshotFrozenContent(readRes.rows[0].frozen_content);
      if (res.type !== 'invalid_content') {
        throw new Error(`Case ${tc.name} expected invalid_content, got: ${JSON.stringify(res)}`);
      }
      if (res.blocker !== tc.expectedBlocker) {
        throw new Error(`Case ${tc.name} expected blocker ${tc.expectedBlocker}, got: ${res.blocker}`);
      }
    }

    // 9. prove JSONB round trip does not change stable option identities
    const retrievedOptions = (readValidSnapshot.frozen_content as { options: Array<{ id: string }> }).options;
    const expectedIds = ['opt-ampere', 'opt-volt', 'opt-ohm', 'opt-watt', 'opt-joule'];
    if (retrievedOptions.length !== 5) {
      throw new Error(`Expected 5 options, got ${retrievedOptions.length}`);
    }
    for (let i = 0; i < 5; i++) {
      if (retrievedOptions[i].id !== expectedIds[i]) {
        throw new Error(`Option identity mismatch at index ${i}: expected ${expectedIds[i]}, got ${retrievedOptions[i].id}`);
      }
    }

    // 10. prove validator does not UPDATE the snapshot
    const recheckValidSnapshot = await testClient.query(`
      SELECT xmin, frozen_content
      FROM public.secure_assessment_exam_question_snapshots
      WHERE id = $1
    `, [validSnapshotId]);
    if (recheckValidSnapshot.rows[0].xmin !== validSnapshotXmin) {
      throw new Error(`Snapshot xmin changed from ${validSnapshotXmin} to ${recheckValidSnapshot.rows[0].xmin}`);
    }

    // 11. prove no Exam Instance lifecycle mutation
    const recheckExamInst = await testClient.query(`
      SELECT xmin, lifecycle_state
      FROM public.secure_assessment_exam_instances
      WHERE id = $1
    `, [examInstId]);
    if (recheckExamInst.rows[0].xmin !== examInstXminBefore) {
      throw new Error('Exam Instance xmin changed');
    }
    if (recheckExamInst.rows[0].lifecycle_state !== 'SCHEDULED') {
      throw new Error(`Exam Instance lifecycle changed to ${recheckExamInst.rows[0].lifecycle_state}`);
    }

    // 12. prove no Attempt creation
    const attemptCount = await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`);
    if (parseInt(attemptCount.rows[0].count, 10) !== 0) {
      throw new Error(`Expected 0 attempts, found ${attemptCount.rows[0].count}`);
    }

    // 13. prove no Session creation
    const sessionCount = await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`);
    if (parseInt(sessionCount.rows[0].count, 10) !== 0) {
      throw new Error(`Expected 0 sessions, found ${sessionCount.rows[0].count}`);
    }

    // 14. prove no Academic Core mutation
    const taCount = await testClient.query(`SELECT COUNT(*) as count FROM public.academic_core_teaching_assignments`);
    if (parseInt(taCount.rows[0].count, 10) !== 1) {
      throw new Error(`Expected exactly 1 teaching assignment, found ${taCount.rows[0].count}`);
    }

    // 15. prove no schema change
    const migrationCheck = await testClient.query(`SELECT COUNT(migration_id) as count FROM public.elligble_migration_history`);
    if (parseInt(migrationCheck.rows[0].count, 10) !== 30) {
      throw new Error(`Expected 30 migrations, got ${migrationCheck.rows[0].count}`);
    }

    // 16. cleanup disposable database
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

    console.log('REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
    if (testClient) {
      try {
        await testClient.end();
      } catch {}
    }
    if (rootClient) {
      if (dbName) {
        try {
          await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        } catch {}
      }
      try {
        await rootClient.end();
      } catch {}
    }
  }
}

runVerification();
