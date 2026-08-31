import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { createTeacherManagedExamInstance } from '../src/teacher-managed-exam-instance-creation.ts';
import type { AssessmentCreationCapabilityEvaluator } from '../src/teacher-managed-exam-instance-creation.ts';
import { resolveTeacherManagedAssessmentCreationContext } from '../src/assessment-creation-authorization-context.ts';
import type { AssessmentCreationContextInput } from '../src/assessment-creation-authorization-context.ts';

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DATABASE_URL must be provided');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

async function runVerification() {
  let verificationFailed = false;
  let databaseCreated = false;
  let poolAvailable = false;
  let pool: Pool | undefined;
  let adminClient: Client | undefined;

  const testDbName = `elligble_bu045_test_${Date.now()}`;
  const parsedAdmin = new URL(DB_URL as string);
  parsedAdmin.pathname = '/postgres';
  const adminUrl = parsedAdmin.toString();

  const parsedTest = new URL(DB_URL as string);
  parsedTest.pathname = `/${testDbName}`;
  const testDbUrl = parsedTest.toString();

  try {
    adminClient = new Client({ connectionString: adminUrl });
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE ${testDbName}`);
    databaseCreated = true;
    await adminClient.end();
    adminClient = undefined;

    pool = new Pool({ connectionString: testDbUrl });
    poolAvailable = true;

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    if (files.length !== 20) throw new Error('Expected exactly 20 canonical migrations');
    for (let i = 0; i < 20; i++) {
      const expectedPrefix = String(i + 1).padStart(4, '0') + '_';
      if (!files[i].startsWith(expectedPrefix)) {
        throw new Error(`Expected migration prefix ${expectedPrefix}, got ${files[i]}`);
      }
    }
    if (files.find(f => f.startsWith('0021'))) throw new Error('Migration 0021 must not exist');

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await pool.query(sql);
    }

    // Insert Real Academic Core + Identity/Tenant fixtures
    const fixtureResult = await pool.query(`
      WITH
      tenant AS (INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id),
      person AS (INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id),
      membership AS (INSERT INTO tenant_memberships (id, tenant_id, person_id) SELECT gen_random_uuid(), t.id, p.id FROM tenant t, person p RETURNING id),
      teacher AS (INSERT INTO tenant_teacher_assignments (tenant_id, membership_id) SELECT t.id, m.id FROM tenant t, membership m RETURNING id),
      year AS (INSERT INTO academic_core_academic_years (tenant_id, display_label, start_date, end_date) SELECT id, 'Year', '2026-07-01', '2027-06-30' FROM tenant RETURNING id),
      period AS (INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) SELECT t.id, y.id, 'P1', 'SEMESTER', '2026-07-01', '2026-12-31' FROM tenant t, year y RETURNING id),
      grade AS (INSERT INTO academic_core_grade_levels (tenant_id, display_label) SELECT id, 'Grade' FROM tenant RETURNING id),
      group_ag AS (INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) SELECT t.id, y.id, g.id, 'Group' FROM tenant t, year y, grade g RETURNING id),
      subject AS (INSERT INTO academic_core_subjects (tenant_id, display_label) SELECT id, 'Subj' FROM tenant RETURNING id),
      offering AS (INSERT INTO academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) SELECT t.id, s.id, p.id, g.id FROM tenant t, subject s, period p, grade g RETURNING id),
      teaching_assignment AS (INSERT INTO academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) SELECT t.id, tc.id, o.id, a.id FROM tenant t, teacher tc, offering o, group_ag a RETURNING id)
      SELECT
        (SELECT id FROM tenant) AS tenant_id,
        (SELECT id FROM person) AS person_id,
        (SELECT id FROM membership) AS membership_id,
        (SELECT id FROM offering) AS offering_id,
        (SELECT id FROM group_ag) AS group_id,
        (SELECT id FROM teaching_assignment) AS assignment_id,
        (SELECT id FROM teacher) AS teacher_assignment_id
    `);

    const fixtures = fixtureResult.rows[0];

    const validInput: AssessmentCreationContextInput = {
      tenantId: fixtures.tenant_id,
      personId: fixtures.person_id,
      subjectOfferingId: fixtures.offering_id,
      academicGroupId: fixtures.group_id
    };

    // A. Verify BU-043 resolver
    const resolutionResult = await resolveTeacherManagedAssessmentCreationContext(pool, validInput);
    if (resolutionResult.type !== 'context_resolved') throw new Error('Expected context_resolved from BU-043');
    if (resolutionResult.context.tenantId !== fixtures.tenant_id) throw new Error('BU-043 wrong tenant');
    if (resolutionResult.context.personId !== fixtures.person_id) throw new Error('BU-043 wrong person');
    if (resolutionResult.context.membershipId !== fixtures.membership_id) throw new Error('BU-043 wrong membership');
    if (resolutionResult.context.teacherAssignmentId !== fixtures.teacher_assignment_id) throw new Error('BU-043 wrong teacher assignment');
    if (resolutionResult.context.teachingAssignmentId !== fixtures.assignment_id) throw new Error('BU-043 wrong teaching assignment');
    if (resolutionResult.context.subjectOfferingId !== fixtures.offering_id) throw new Error('BU-043 wrong offering');
    if (resolutionResult.context.academicGroupId !== fixtures.group_id) throw new Error('BU-043 wrong group');

    // B. Verify BU-044 persistence contract
    // 4. BU-044 COLUMN CONTRACT IN VERIFIER
    const colRes = await pool.query(`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'secure_assessment_exam_instances'
        AND column_name = 'teaching_assignment_id'
    `);
    if (colRes.rows.length !== 1) throw new Error('Expected exactly 1 column teaching_assignment_id');
    if (colRes.rows[0].data_type !== 'uuid') throw new Error('Expected data_type uuid');
    if (colRes.rows[0].is_nullable !== 'YES') throw new Error('Expected is_nullable YES');
    if (colRes.rows[0].column_default !== null) throw new Error('Expected column_default IS NULL');

    const fkRes = await pool.query(`
      SELECT
        c.conname AS constraint_name,
        cl_ref.relname AS foreign_table_name,
        a_local.attname AS column_name,
        a_ref.attname AS foreign_column_name,
        c.confdeltype
      FROM pg_constraint c
      JOIN pg_class cl_local ON c.conrelid = cl_local.oid
      JOIN pg_class cl_ref ON c.confrelid = cl_ref.oid
      CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS loc(attnum, ord)
      JOIN pg_attribute a_local ON a_local.attrelid = c.conrelid AND a_local.attnum = loc.attnum
      JOIN pg_attribute a_ref ON a_ref.attrelid = c.confrelid AND a_ref.attnum = c.confkey[loc.ord]
      WHERE cl_local.relname = 'secure_assessment_exam_instances'
        AND c.contype = 'f'
        AND c.conname = 'fk_sa_exam_instances_teaching_assignment'
      ORDER BY loc.ord
    `);
    if (fkRes.rows.length !== 2) throw new Error('Expected 2 columns in fk_sa_exam_instances_teaching_assignment');
    if (fkRes.rows[0].confdeltype !== 'r') throw new Error('Expected RESTRICT on FK');
    if (fkRes.rows[0].foreign_table_name !== 'academic_core_teaching_assignments') throw new Error('Expected academic_core_teaching_assignments as ref table');
    if (fkRes.rows[0].column_name !== 'teaching_assignment_id' || fkRes.rows[0].foreign_column_name !== 'id') throw new Error('FK column mismatch 1');
    if (fkRes.rows[1].column_name !== 'tenant_id' || fkRes.rows[1].foreign_column_name !== 'tenant_id') throw new Error('FK column mismatch 2');

    const idxRes = await pool.query(`
      SELECT ix.relname as indexname, a.attname, i.indisunique
      FROM pg_class t, pg_class ix, pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE t.oid = i.indrelid AND ix.oid = i.indexrelid
        AND t.relname = 'secure_assessment_exam_instances'
        AND ix.relname = 'idx_sa_exam_instances_tenant_teaching_assignment'
        AND i.indpred IS NULL
      ORDER BY array_position(i.indkey, a.attnum)
    `);
    if (idxRes.rows.length !== 2) throw new Error('Missing idx_sa_exam_instances_tenant_teaching_assignment or wrong column count');
    if (idxRes.rows[0].attname !== 'tenant_id') throw new Error('Index column 1 mismatch');
    if (idxRes.rows[1].attname !== 'teaching_assignment_id') throw new Error('Index column 2 mismatch');
    if (idxRes.rows[0].indisunique !== false) throw new Error('Index must not be unique');

    // 1. Capability granted -> exactly one Exam Instance created
    const snapshotRes = await pool.query(`
      SELECT teacher_assignment_id, subject_offering_id, academic_group_id, assigned_at, revoked_at
      FROM academic_core_teaching_assignments
      WHERE id = $1
    `, [fixtures.assignment_id]);
    const taSnapshot = snapshotRes.rows[0];

    // Proctor check before creation
    const preProctor = await pool.query('SELECT COUNT(*) as count FROM secure_assessment_proctor_assignments');
    if (preProctor.rows[0].count !== '0') throw new Error('Expected 0 proctor assignments before creation');

    const grantEvaluator: AssessmentCreationCapabilityEvaluator = async () => 'granted';
    const res1 = await createTeacherManagedExamInstance(pool, validInput, grantEvaluator);
    if (res1.type !== 'created') throw new Error('Expected created');

    let res = await pool.query('SELECT * FROM secure_assessment_exam_instances WHERE id = $1', [res1.examInstanceId]);
    if (res.rows.length !== 1) throw new Error('Expected 1 instance');
    if (res.rows[0].tenant_id !== fixtures.tenant_id) throw new Error('Wrong tenant_id');
    if (res.rows[0].teaching_assignment_id !== fixtures.assignment_id) throw new Error('Wrong teaching_assignment_id');

    const assertCount = async () => {
      const { rows } = await pool!.query('SELECT COUNT(*) as count FROM secure_assessment_exam_instances');
      if (rows[0].count !== '1') throw new Error(`Expected exactly 1 exam instance in total, got ${rows[0].count}`);
    };

    // Proctor check after creation
    const postProctor = await pool.query('SELECT COUNT(*) as count FROM secure_assessment_proctor_assignments');
    if (postProctor.rows[0].count !== '0') throw new Error('Expected 0 proctor assignments after creation');

    // No Academic Core Mutation check
    const snapshotRes2 = await pool.query(`
      SELECT teacher_assignment_id, subject_offering_id, academic_group_id, assigned_at, revoked_at
      FROM academic_core_teaching_assignments
      WHERE id = $1
    `, [fixtures.assignment_id]);
    const taSnapshot2 = snapshotRes2.rows[0];
    if (
      taSnapshot.teacher_assignment_id !== taSnapshot2.teacher_assignment_id ||
      taSnapshot.subject_offering_id !== taSnapshot2.subject_offering_id ||
      taSnapshot.academic_group_id !== taSnapshot2.academic_group_id ||
      taSnapshot.assigned_at?.getTime() !== taSnapshot2.assigned_at?.getTime() ||
      taSnapshot.revoked_at?.getTime() !== taSnapshot2.revoked_at?.getTime()
    ) {
      throw new Error('Academic core was mutated during creation');
    }

    // 2. Capability denied -> zero Exam Instance
    const denyEvaluator: AssessmentCreationCapabilityEvaluator = async () => 'denied';
    const res2 = await createTeacherManagedExamInstance(pool, validInput, denyEvaluator);
    if (res2.type !== 'denied') throw new Error('Expected denied');
    await assertCount();

    // 3. Capability unavailable -> zero Exam Instance
    const unavEvaluator: AssessmentCreationCapabilityEvaluator = async () => 'unavailable';
    const res3 = await createTeacherManagedExamInstance(pool, validInput, unavEvaluator);
    if (res3.type !== 'unavailable') throw new Error('Expected unavailable');
    await assertCount();

    // 4. Wrong tenant -> zero Exam Instance
    const res4 = await createTeacherManagedExamInstance(pool, { ...validInput, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, grantEvaluator);
    if (res4.type !== 'denied') throw new Error('Expected denied for wrong tenant');
    await assertCount();

    // 5. Wrong person -> zero Exam Instance
    const res5 = await createTeacherManagedExamInstance(pool, { ...validInput, personId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, grantEvaluator);
    if (res5.type !== 'denied') throw new Error('Expected denied for wrong person');
    await assertCount();

    // 6. Wrong offering -> zero Exam Instance
    const res6 = await createTeacherManagedExamInstance(pool, { ...validInput, subjectOfferingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, grantEvaluator);
    if (res6.type !== 'denied') throw new Error('Expected denied for wrong offering');
    await assertCount();

    // 7. Wrong group -> zero Exam Instance
    const res7 = await createTeacherManagedExamInstance(pool, { ...validInput, academicGroupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }, grantEvaluator);
    if (res7.type !== 'denied') throw new Error('Expected denied for wrong group');
    await assertCount();

    // 8. Teaching Assignment revoked after initial resolution but before write -> zero Exam Instance
    const raceEvaluator: AssessmentCreationCapabilityEvaluator = async () => {
      await pool!.query('UPDATE academic_core_teaching_assignments SET revoked_at = NOW() WHERE id = $1', [fixtures.assignment_id]);
      return 'granted';
    };
    const res8 = await createTeacherManagedExamInstance(pool, validInput, raceEvaluator);
    if (res8.type !== 'denied') throw new Error('Expected denied on race (teaching_assignment_id)');
    await assertCount();

    // Un-revoke for the next race test
    await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = NULL WHERE id = $1', [fixtures.assignment_id]);

    // 9. TEACHER staff assignment revoked after initial resolution but before write -> zero Exam Instance
    const raceEvaluator2: AssessmentCreationCapabilityEvaluator = async () => {
      await pool!.query('UPDATE tenant_teacher_assignments SET revoked_at = NOW() WHERE id = $1', [fixtures.teacher_assignment_id]);
      return 'granted';
    };
    const res9 = await createTeacherManagedExamInstance(pool, validInput, raceEvaluator2);
    if (res9.type !== 'denied') throw new Error('Expected denied on race (teacher_assignment_id)');
    await assertCount();

    // 10. historical Exam Instance reference remains valid after later revocation
    await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = NOW() WHERE id = $1', [fixtures.assignment_id]);

    // Check that Exam Instance is still valid/there
    res = await pool!.query('SELECT teaching_assignment_id FROM secure_assessment_exam_instances WHERE id = $1', [res1.examInstanceId]);
    if (res.rows[0].teaching_assignment_id !== fixtures.assignment_id) throw new Error('Historical reference was mutated');

    // 11. No Academic Core mutation
    res = await pool.query('SELECT id FROM academic_core_teaching_assignments WHERE id = $1', [fixtures.assignment_id]);
    if (res.rows.length !== 1) throw new Error('Academic core row was deleted');

  } catch (err) {
    verificationFailed = true;
  } finally {
    if (adminClient) {
      try {
        await adminClient.end();
        adminClient = undefined;
      } catch {
        verificationFailed = true;
      }
    }

    if (poolAvailable && pool) {
      try {
        await pool.end();
      } catch (e) {
        verificationFailed = true;
      }
    }

    if (databaseCreated) {
      let dropClient: Client | undefined;
      try {
        dropClient = new Client({ connectionString: adminUrl });
        await dropClient.connect();
        await dropClient.query(`DROP DATABASE ${testDbName}`);
      } catch (e) {
        verificationFailed = true;
      } finally {
        if (dropClient) {
          try {
            await dropClient.end();
          } catch (e) {
            verificationFailed = true;
          }
        }
      }
    }
  }

  if (verificationFailed) {
    console.error('BU-045 Verifier: FAIL');
    process.exitCode = 1;
  } else {
    console.log('BU-045 Verifier: PASS');
  }
}

runVerification().catch(() => {
  console.error('BU-045 Verifier: FAIL');
  process.exitCode = 1;
});
