import { Client } from 'pg';
import type { PoolClient } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import {
  checkExamInstanceActiveProctorAssignmentPresenceReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-active-proctor-assignment-presence-readiness-preflight.ts';

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

async function runVerification() {
  let dbName = '';
  let rootClient: Client | null = null;
  let testClient: Client | null = null;

  try {
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu070_${runId}`;

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

    const proctor1Person = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctor2Person = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    async function createExamFixture(opts: {
      lifecycle?: string;
      proctorSetup?: 'none' | 'one_active' | 'two_active' | 'one_revoked' | 'active_and_revoked';
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

      if (opts.proctorSetup === 'one_active') {
        await testClient!.query(`
          INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
          VALUES ($1, $2, $3)
        `, [tenantA, examInstId, proctor1Person]);
      } else if (opts.proctorSetup === 'two_active') {
        await testClient!.query(`
          INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
          VALUES ($1, $2, $3)
        `, [tenantA, examInstId, proctor1Person]);
        await testClient!.query(`
          INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
          VALUES ($1, $2, $3)
        `, [tenantA, examInstId, proctor2Person]);
      } else if (opts.proctorSetup === 'one_revoked') {
        await testClient!.query(`
          INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id, revoked_at)
          VALUES ($1, $2, $3, NOW())
        `, [tenantA, examInstId, proctor1Person]);
      } else if (opts.proctorSetup === 'active_and_revoked') {
        await testClient!.query(`
          INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
          VALUES ($1, $2, $3)
        `, [tenantA, examInstId, proctor1Person]);
        await testClient!.query(`
          INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id, revoked_at)
          VALUES ($1, $2, $3, NOW())
        `, [tenantA, examInstId, proctor2Person]);
      }

      return examInstId;
    }

    const poolClient = testClient as unknown as PoolClient;

    const validExamId = await createExamFixture({ proctorSetup: 'one_active' });
    const emptyExamId = await createExamFixture({ proctorSetup: 'none' });
    const twoActiveExamId = await createExamFixture({ proctorSetup: 'two_active' });
    const revokedExamId = await createExamFixture({ proctorSetup: 'one_revoked' });
    const mixedExamId = await createExamFixture({ proctorSetup: 'active_and_revoked' });
    const draftExamId = await createExamFixture({ lifecycle: 'DRAFT', proctorSetup: 'one_active' });
    const otherExamId = await createExamFixture({ proctorSetup: 'one_active' });

    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const academicYearB = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantB])).rows[0].id;
    const academicPeriodB = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantB, academicYearB])).rows[0].id;
    const subjectB = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics B') RETURNING id`, [tenantB])).rows[0].id;
    const gradeLevelB = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantB])).rows[0].id;
    const academicGroupB = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-B') RETURNING id`, [tenantB, academicYearB, gradeLevelB])).rows[0].id;
    const subjectOfferingB = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, subjectB, academicPeriodB, gradeLevelB])).rows[0].id;
    const teacherPersonB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherMemberB = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantB, teacherPersonB])).rows[0].id;
    const teacherAssignmentB = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantB, teacherMemberB])).rows[0].id;
    const teachingAssignmentB = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, teacherAssignmentB, subjectOfferingB, academicGroupB])).rows[0].id;
    const assessmentTypeIdB = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE B') RETURNING id`, [tenantB])).rows[0].id;

    const examInstBId = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [tenantB, teachingAssignmentB, assessmentTypeIdB, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW'])).rows[0].id;

    const proctorBPerson = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    await testClient.query(`
      INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3)
    `, [tenantB, examInstBId, proctorBPerson]);

    let uniquenessError: any;
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
        VALUES ($1, $2, $3)
      `, [tenantA, validExamId, proctor1Person]);
    } catch (err: any) {
      uniquenessError = err;
    }
    if (!uniquenessError || uniquenessError.code !== '23505' || !uniquenessError.message.includes('uq_sa_proctor_assignment_active')) {
       throw new Error(`Expected active uniqueness violation 23505 with uq_sa_proctor_assignment_active, got: ${uniquenessError?.message}`);
    }
    await testClient.query(`SELECT 1`); // ensure connection is still safe

    const beforeExamInstancesCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_instances`)).rows[0].count, 10);
    const beforeProctorAssignmentsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_proctor_assignments`)).rows[0].count, 10);

    const beforeAcademicCoreSum = parseInt((await testClient.query(`
      SELECT (
        (SELECT COUNT(*) FROM public.academic_core_academic_years) +
        (SELECT COUNT(*) FROM public.academic_core_academic_periods) +
        (SELECT COUNT(*) FROM public.academic_core_subjects) +
        (SELECT COUNT(*) FROM public.academic_core_grade_levels) +
        (SELECT COUNT(*) FROM public.academic_core_academic_groups) +
        (SELECT COUNT(*) FROM public.academic_core_subject_offerings) +
        (SELECT COUNT(*) FROM public.academic_core_teaching_assignments)
      ) as count
    `)).rows[0].count, 10);

    const beforeExamValidRow = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_instances WHERE id = $1`, [validExamId])).rows[0];
    const beforeProctorAssignmentsRows = (await testClient.query(`SELECT id, tenant_id, exam_instance_id, person_id, revoked_at FROM public.secure_assessment_proctor_assignments ORDER BY id`)).rows;

    // 1. SCHEDULED + zero active assignment -> active_proctor_assignment_empty
    const resEmpty = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantA, emptyExamId, grantedCapability);
    if (resEmpty.type !== 'not_ready' || resEmpty.blocker !== 'active_proctor_assignment_empty') {
      throw new Error(`Expected active_proctor_assignment_empty, got: ${JSON.stringify(resEmpty)}`);
    }

    // 2. one active assignment -> ready/count 1
    const resOne = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantA, validExamId, grantedCapability);
    if (resOne.type !== 'active_proctor_assignment_presence_ready' || resOne.activeProctorAssignmentCount !== 1) {
      throw new Error(`Expected active_proctor_assignment_presence_ready with count 1, got: ${JSON.stringify(resOne)}`);
    }

    // 3. two different active proctors -> ready/count 2
    const resTwo = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantA, twoActiveExamId, grantedCapability);
    if (resTwo.type !== 'active_proctor_assignment_presence_ready' || resTwo.activeProctorAssignmentCount !== 2) {
      throw new Error(`Expected active_proctor_assignment_presence_ready with count 2, got: ${JSON.stringify(resTwo)}`);
    }

    // 4. revoked assignment excluded
    const resRevoked = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantA, revokedExamId, grantedCapability);
    if (resRevoked.type !== 'not_ready' || resRevoked.blocker !== 'active_proctor_assignment_empty') {
      throw new Error(`Expected active_proctor_assignment_empty for revoked, got: ${JSON.stringify(resRevoked)}`);
    }

    // 5. active + revoked returns active-only count
    const resMixed = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantA, mixedExamId, grantedCapability);
    if (resMixed.type !== 'active_proctor_assignment_presence_ready' || resMixed.activeProctorAssignmentCount !== 1) {
      throw new Error(`Expected active_proctor_assignment_presence_ready with count 1 for mixed, got: ${JSON.stringify(resMixed)}`);
    }

    // 6. Same Tenant / Other Exam Instance Isolation
    const resOneAgain = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantA, validExamId, grantedCapability);
    if (resOneAgain.type !== 'active_proctor_assignment_presence_ready' || resOneAgain.activeProctorAssignmentCount !== 1) {
      throw new Error(`Expected count 1 unchanged after creating foreign-exam assignment, got: ${JSON.stringify(resOneAgain)}`);
    }

    // 7. Other Tenant Isolation
    const resOneAgainB = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantA, validExamId, grantedCapability);
    if (resOneAgainB.type !== 'active_proctor_assignment_presence_ready' || resOneAgainB.activeProctorAssignmentCount !== 1) {
      throw new Error(`Expected count 1 unchanged after creating tenant B assignment, got: ${JSON.stringify(resOneAgainB)}`);
    }

    // 6/7. wrong tenant denied
    const resCrossTenant = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantB, validExamId, grantedCapability);
    if (resCrossTenant.type !== 'denied') {
      throw new Error(`Expected denied cross-tenant, got: ${JSON.stringify(resCrossTenant)}`);
    }

    // 7b. invalid_state
    const resDraft = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(poolClient, tenantA, draftExamId, grantedCapability);
    if (resDraft.type !== 'invalid_state') {
      throw new Error(`Expected invalid_state, got: ${JSON.stringify(resDraft)}`);
    }

    const migrationCheck = await testClient.query(`SELECT COUNT(*) as count FROM public.elligble_migration_history`);
    if (parseInt(migrationCheck.rows[0].count, 10) !== 30) throw new Error('Migration mutated');

    const afterExamInstancesCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_instances`)).rows[0].count, 10);
    if (afterExamInstancesCount !== beforeExamInstancesCount) throw new Error('Exam instance count mutated unexpectedly');

    const afterProctorAssignmentsRows = (await testClient.query(`SELECT id, tenant_id, exam_instance_id, person_id, revoked_at FROM public.secure_assessment_proctor_assignments ORDER BY id`)).rows;
    if (JSON.stringify(beforeProctorAssignmentsRows) !== JSON.stringify(afterProctorAssignmentsRows)) {
        throw new Error('Proctor Assignment rows mutated (Immutability failed)');
    }
    const afterProctorAssignmentsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_proctor_assignments`)).rows[0].count, 10);
    if (afterProctorAssignmentsCount !== beforeProctorAssignmentsCount) throw new Error('Proctor Assignment count mutated unexpectedly');

    const afterAcademicCoreSum = parseInt((await testClient.query(`
      SELECT (
        (SELECT COUNT(*) FROM public.academic_core_academic_years) +
        (SELECT COUNT(*) FROM public.academic_core_academic_periods) +
        (SELECT COUNT(*) FROM public.academic_core_subjects) +
        (SELECT COUNT(*) FROM public.academic_core_grade_levels) +
        (SELECT COUNT(*) FROM public.academic_core_academic_groups) +
        (SELECT COUNT(*) FROM public.academic_core_subject_offerings) +
        (SELECT COUNT(*) FROM public.academic_core_teaching_assignments)
      ) as count
    `)).rows[0].count, 10);
    if (beforeAcademicCoreSum !== afterAcademicCoreSum) {
        throw new Error('Academic Core mutated');
    }

    const afterExamValidRow = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_instances WHERE id = $1`, [validExamId])).rows[0];
    if (beforeExamValidRow.lifecycle_state !== afterExamValidRow.lifecycle_state ||
        beforeExamValidRow.configured_attempt_duration_seconds !== afterExamValidRow.configured_attempt_duration_seconds ||
        beforeExamValidRow.latest_start_policy !== afterExamValidRow.latest_start_policy) {
        throw new Error('Exam Instance row mutated');
    }

    const attemptsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    if (attemptsCount !== 0) throw new Error('Attempts created');

    const sessionsCount = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);
    if (sessionsCount !== 0) throw new Error('Sessions created');

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
