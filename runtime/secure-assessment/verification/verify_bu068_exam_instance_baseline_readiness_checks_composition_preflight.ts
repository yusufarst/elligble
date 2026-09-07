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

    // Tenant and Base Academic Core
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const person1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const person2 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const member1 = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, person1])).rows[0].id;
    const member2 = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, person2])).rows[0].id;
    const teacher1 = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, member1])).rows[0].id;
    const student1 = (await testClient.query(`INSERT INTO public.tenant_student_enrollments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, member2])).rows[0].id;
    
    const year1 = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const period1 = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, year1])).rows[0].id;
    const subject1 = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics') RETURNING id`, [tenantA])).rows[0].id;
    const grade1 = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantA])).rows[0].id;
    const group1 = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [tenantA, year1, grade1])).rows[0].id;
    const offering1 = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subject1, period1, grade1])).rows[0].id;
    const ta1 = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacher1, offering1, group1])).rows[0].id;
    
    const atId = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE') RETURNING id`, [tenantA])).rows[0].id;

    // Helper to create exam instances for different blocker states
    async function createExamFixture(opts: {
      lifecycle?: string,
      noAssessmentType?: boolean,
      noTiming?: boolean,
      invalidPolicy?: boolean,
      noParticipant?: boolean,
      noSnapshot?: boolean,
      invalidSnapshot?: boolean,
      multipleInvalidSnapshot?: boolean
    }) {
      const examInstId = (await testClient!.query(`
        INSERT INTO public.secure_assessment_exam_instances (
          tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        tenantA, 
        ta1, 
        opts.noAssessmentType ? null : atId,
        opts.lifecycle || 'SCHEDULED',
        opts.noTiming ? null : '2026-10-01 08:00:00Z',
        opts.noTiming ? null : '2026-10-01 10:00:00Z',
        opts.noTiming ? null : 3600,
        opts.invalidPolicy ? 'LATE_START_BLOCKED' : 'FULL_DURATION_BEYOND_WINDOW' // 'LATE_START_BLOCKED' with 3600 duration but maybe window is smaller? If we want a policy error, we can make duration > window.
      ])).rows[0].id;

      if (opts.invalidPolicy) {
         // To trigger attempt_duration_exceeds_window for LATE_START_BLOCKED: duration > window (2 hrs = 7200 sec, so duration = 8000)
         await testClient!.query(`UPDATE public.secure_assessment_exam_instances SET configured_attempt_duration_seconds = 8000 WHERE id = $1`, [examInstId]);
      }

      if (!opts.noParticipant) {
        await testClient!.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, student_enrollment_id) VALUES ($1, $2, $3)`, [tenantA, examInstId, student1]);
      }

      const validPayload = {
        schemaVersion: 1,
        questionType: 'MULTIPLE_CHOICE_SINGLE',
        prompt: { text: 'Q1' },
        options: [
          { id: '1', content: { text: 'A' } }, { id: '2', content: { text: 'B' } }, { id: '3', content: { text: 'C' } }, { id: '4', content: { text: 'D' } }, { id: '5', content: { text: 'E' } }
        ],
        correctOptionId: '1',
        maxScore: 5
      };

      if (!opts.noSnapshot) {
        if (opts.invalidSnapshot || opts.multipleInvalidSnapshot) {
          const inv1 = { ...validPayload, questionType: 'INVALID' };
          await testClient!.query(`INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`, [tenantA, examInstId, JSON.stringify(inv1)]);
          if (opts.multipleInvalidSnapshot) {
            const inv2 = { ...validPayload, schemaVersion: 99 };
            await testClient!.query(`INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`, [tenantA, examInstId, JSON.stringify(inv2)]);
          }
        } else {
          await testClient!.query(`INSERT INTO public.secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content) VALUES ($1, $2, $3::jsonb)`, [tenantA, examInstId, JSON.stringify(validPayload)]);
        }
      }

      return examInstId;
    }

    const poolClient = testClient as unknown as PoolClient;

    // 1. Fully valid SCHEDULED
    const validExamId = await createExamFixture({});
    const res1 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, validExamId, () => 'granted');
    if (res1.type !== 'baseline_readiness_checks_pass') throw new Error(`Expected pass, got: ${JSON.stringify(res1)}`);

    // 2. Assessment type blocker
    const assessmentExamId = await createExamFixture({ noAssessmentType: true });
    const res2 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, assessmentExamId, () => 'granted');
    if (res2.type !== 'not_ready' || res2.category !== 'assessment_type') throw new Error(`Expected assessment_type blocker, got: ${JSON.stringify(res2)}`);

    // 3. Snapshot presence blocker
    const snapPresenceExamId = await createExamFixture({ noSnapshot: true });
    const res3 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, snapPresenceExamId, () => 'granted');
    if (res3.type !== 'not_ready' || res3.category !== 'question_snapshot_presence') throw new Error(`Expected snapshot presence blocker, got: ${JSON.stringify(res3)}`);

    // 4. Participant presence blocker
    const participantExamId = await createExamFixture({ noParticipant: true });
    const res4 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, participantExamId, () => 'granted');
    if (res4.type !== 'not_ready' || res4.category !== 'participant_presence') throw new Error(`Expected participant presence blocker, got: ${JSON.stringify(res4)}`);

    // 5. Timing configuration blocker
    const timingExamId = await createExamFixture({ noTiming: true });
    const res5 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, timingExamId, () => 'granted');
    if (res5.type !== 'not_ready' || res5.category !== 'timing_configuration_presence') throw new Error(`Expected timing configuration blocker, got: ${JSON.stringify(res5)}`);

    // 6. Duration/window compatibility blocker
    const durationExamId = await createExamFixture({ invalidPolicy: true });
    const res6 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, durationExamId, () => 'granted');
    if (res6.type !== 'not_ready' || res6.category !== 'duration_window_policy_compatibility') throw new Error(`Expected duration compatibility blocker, got: ${JSON.stringify(res6)}`);

    // 7. BU-065 passes but content invalid
    const invalidContentExamId = await createExamFixture({ invalidSnapshot: true });
    const res7 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, invalidContentExamId, () => 'granted');
    if (res7.type !== 'not_ready' || res7.category !== 'question_snapshot_content' || res7.blocker !== 'question_snapshot_content_invalid') {
      throw new Error(`Expected question_snapshot_content_invalid, got: ${JSON.stringify(res7)}`);
    }

    // 8. Deterministic first invalid snapshot semantics
    const multInvalidExamId = await createExamFixture({ multipleInvalidSnapshot: true });
    const res8 = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(poolClient, tenantA, multInvalidExamId, () => 'granted');
    if (res8.type !== 'not_ready' || (res8 as any).contentBlocker !== 'question_type_invalid') {
      throw new Error(`Expected first invalid blocker question_type_invalid, got: ${JSON.stringify(res8)}`);
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

    // Prove no mutation
    const examCheck = await testClient.query(`SELECT COUNT(*) FROM public.secure_assessment_exam_instances WHERE lifecycle_state = 'READY'`);
    if (parseInt(examCheck.rows[0].count, 10) > 0) throw new Error('Exam transitioned to READY');

    const snapCheck = await testClient.query(`SELECT COUNT(*) FROM public.secure_assessment_exam_question_snapshots`);
    // initial insertions check
    if (parseInt(snapCheck.rows[0].count, 10) === 0) throw new Error('Snapshots missing');

    const qbCheck = await testClient.query(`SELECT COUNT(*) FROM public.secure_assessment_question_bank_items`);
    if (parseInt(qbCheck.rows[0].count, 10) !== 0) throw new Error('Question bank mutation');

    const participantCheck = await testClient.query(`SELECT COUNT(*) FROM public.secure_assessment_exam_participants`);
    if (parseInt(participantCheck.rows[0].count, 10) === 0) throw new Error('Participants missing');

    const attemptCheck = await testClient.query(`SELECT COUNT(*) FROM public.secure_assessment_exam_attempts`);
    if (parseInt(attemptCheck.rows[0].count, 10) !== 0) throw new Error('Attempts created');

    const sessionCheck = await testClient.query(`SELECT COUNT(*) FROM public.secure_assessment_exam_sessions`);
    if (parseInt(sessionCheck.rows[0].count, 10) !== 0) throw new Error('Sessions created');

    const migrationCheck = await testClient.query(`SELECT COUNT(*) FROM public.elligble_migration_history`);
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
