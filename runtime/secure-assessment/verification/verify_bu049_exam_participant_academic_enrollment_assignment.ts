import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { assignExamParticipantAcademicEnrollment } from '../src/exam-participant-academic-enrollment-assignment.ts';
import { resolveExamParticipantAcademicEnrollmentContext } from '../src/exam-participant-academic-enrollment-context.ts';

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DATABASE_URL must be provided');
  process.exit(1);
}

const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const TEST_DB = `elligble_bu049_${runId}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../../database/migrations');

function assertStrict(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function log(message: string): void {
  console.log(`- PASS: ${message}`);
}

async function main(): Promise<void> {
  const adminUrl = new URL(DB_URL as string);
  adminUrl.pathname = '/postgres';

  const testUrl = new URL(DB_URL as string);
  testUrl.pathname = `/${TEST_DB}`;

  const setupClient = new Client({ connectionString: adminUrl.toString() });

  let client: Client | undefined;
  let pool: Pool | undefined;
  let caughtError: unknown = null;
  let teardownError: unknown = null;
  let databaseCreated = false;

  try {
    await setupClient.connect();
    await setupClient.query(`CREATE DATABASE "${TEST_DB}"`);
    databaseCreated = true;
  } catch (error) {
    caughtError = error;
    console.error('VERIFICATION SETUP FAILED:', error);
  } finally {
    try {
      await setupClient.end();
    } catch (err) {
      teardownError = teardownError || err;
      console.error('Failed to close setupClient:', err);
    }
  }

  if (!caughtError && !teardownError) {
    try {
      client = new Client({ connectionString: testUrl.toString() });
      pool = new Pool({ connectionString: testUrl.toString() });

      await client.connect();

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => /^\d{4}_.*\.sql$/.test(file))
        .sort();

      const expectedFiles = migrationFiles.filter((file) => Number(file.slice(0, 4)) <= 23);
      assertStrict(expectedFiles.length === 23, `Expected exactly 23 migrations <= 0023, got ${expectedFiles.length}`);

      for (let i = 0; i < 23; i++) {
        const prefix = String(i + 1).padStart(4, '0') + '_';
        assertStrict(expectedFiles[i].startsWith(prefix), `Missing or duplicate migration prefix at expected index ${i}`);
      }

      for (const file of expectedFiles) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
      }

      const historyCheck = await client.query(`SELECT count(*) FROM elligble_migration_history`);
      assertStrict(Number(historyCheck.rows[0].count) === 23, 'Exactly 23 rows exist for the applied 0001..0023 chain');

      log('canonical migration chain 0001 through 0023 applied');

      const t1 = (await client.query(`INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
      const t2 = (await client.query(`INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

      const p1 = (await client.query(`INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
      const p2 = (await client.query(`INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

      const m1 = (await client.query(`INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t1, p1])).rows[0].id;
      const m2 = (await client.query(`INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [t2, p1])).rows[0].id;

      const year1 = (await client.query(`INSERT INTO academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t1])).rows[0].id;
      const period1 = (await client.query(`INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem A', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t1, year1])).rows[0].id;
      const grade1 = (await client.query(`INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade A') RETURNING id`, [t1])).rows[0].id;
      const group1 = (await client.query(`INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'Group A') RETURNING id`, [t1, year1, grade1])).rows[0].id;

      const year1_t2 = (await client.query(`INSERT INTO academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [t2])).rows[0].id;
      const period1_t2 = (await client.query(`INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem A', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [t2, year1_t2])).rows[0].id;
      const grade1_t2 = (await client.query(`INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade A') RETURNING id`, [t2])).rows[0].id;
      const group1_t2 = (await client.query(`INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'Group A') RETURNING id`, [t2, year1_t2, grade1_t2])).rows[0].id;

      const exam1 = (await client.query(`INSERT INTO secure_assessment_exam_instances (tenant_id) VALUES ($1) RETURNING id`, [t1])).rows[0].id;

      async function insertEnrollment(tenantId: string, membershipId: string, yearId: string, groupId: string, periodId: string, startDate: string, endDate: string | null, status: string, source: string) {
        return (await client!.query(
          `
            INSERT INTO academic_core_student_enrollments (
              tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, end_date, status, source
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `,
          [tenantId, membershipId, yearId, groupId, periodId, startDate, endDate, status, source]
        )).rows[0].id;
      }

      async function insertParticipant(tenantId: string, examInstanceId: string, personId: string, enrollmentId: string | null = null) {
        return (await client!.query(
          `
            INSERT INTO secure_assessment_exam_participants (
              tenant_id, exam_instance_id, person_id, academic_enrollment_id
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `,
          [tenantId, examInstanceId, personId, enrollmentId]
        )).rows[0].id;
      }

      const e_current = await insertEnrollment(t1, m1, year1, group1, period1, '2000-01-01', null, 'OPAQUE_STATUS_CURRENT', 'BU049_VERIFIER_FIXTURE');
      const e_future = await insertEnrollment(t1, m1, year1, group1, period1, '2999-01-01', null, 'OPAQUE_STATUS_FUTURE', 'BU049_VERIFIER_FIXTURE');
      const e_past = await insertEnrollment(t1, m1, year1, group1, period1, '2000-01-01', '2000-12-31', 'OPAQUE_STATUS_ENDED', 'BU049_VERIFIER_FIXTURE');
      const e_other = await insertEnrollment(t1, m1, year1, group1, period1, '2000-01-01', null, 'OPAQUE_STATUS_OTHER', 'BU049_VERIFIER_FIXTURE');
      const e_t2_current = await insertEnrollment(t2, m2, year1_t2, group1_t2, period1_t2, '2000-01-01', null, 'OPAQUE_STATUS_CURRENT', 'BU049_VERIFIER_FIXTURE');

      const p_unassigned = await insertParticipant(t1, exam1, p1);
      const p_assigned = await insertParticipant(t1, exam1, p1, e_current);
      const p_mismatch = await insertParticipant(t1, exam1, p2);

      const enrollmentsBefore = (await client.query(`SELECT * FROM academic_core_student_enrollments ORDER BY id`)).rows;
      const participantsBefore = (await client.query(`SELECT * FROM secure_assessment_exam_participants ORDER BY id`)).rows;

      let res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: 'invalid', examParticipantId: p_unassigned, academicEnrollmentId: e_current });
      assertStrict(res.type === 'denied', 'Invalid UUID -> denied');

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t1, examParticipantId: p_unassigned, academicEnrollmentId: e_future });
      assertStrict(res.type === 'denied', 'future enrollment denied');

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t1, examParticipantId: p_unassigned, academicEnrollmentId: e_past });
      assertStrict(res.type === 'denied', 'ended enrollment denied');

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t1, examParticipantId: '00000000-0000-4000-a000-000000000000', academicEnrollmentId: e_current });
      assertStrict(res.type === 'denied', 'missing participant denied');

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t2, examParticipantId: p_unassigned, academicEnrollmentId: e_current });
      assertStrict(res.type === 'denied', 'wrong tenant denied early');

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t1, examParticipantId: p_mismatch, academicEnrollmentId: e_current });
      assertStrict(res.type === 'denied', 'person mismatch denied');

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t1, examParticipantId: p_assigned, academicEnrollmentId: e_other });
      assertStrict(res.type === 'denied', 'conflicting different enrollment denied without overwrite');

      const t2ContextRes = await resolveExamParticipantAcademicEnrollmentContext(pool, { tenantId: t2, academicEnrollmentId: e_t2_current });
      assertStrict(t2ContextRes.type === 'context_resolved', 't2 enrollment context successfully resolves');
      if (t2ContextRes.type === 'context_resolved') {
        assertStrict(t2ContextRes.context.tenantId === t2, 'resolved tenantId === t2');
        assertStrict(t2ContextRes.context.personId === p1, 'resolved personId === p1');
        assertStrict(t2ContextRes.context.academicEnrollmentId === e_t2_current, 'resolved academicEnrollmentId === e_t2_current');
      }

      const p_unassigned_before_t2_attempt = (await client.query(`SELECT * FROM secure_assessment_exam_participants WHERE id = $1`, [p_unassigned])).rows[0];

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t2, examParticipantId: p_unassigned, academicEnrollmentId: e_t2_current });
      assertStrict(res.type === 'denied', 'wrong participant-tenant denied even if context succeeds');

      const p_unassigned_after_t2_attempt = (await client.query(`SELECT * FROM secure_assessment_exam_participants WHERE id = $1`, [p_unassigned])).rows[0];
      assertStrict(JSON.stringify(p_unassigned_before_t2_attempt) === JSON.stringify(p_unassigned_after_t2_attempt), 't1 participant row was unchanged by wrong-tenant attempt');

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t1, examParticipantId: p_unassigned, academicEnrollmentId: e_current });
      assertStrict(res.type === 'assigned', 'successful initial attachment');

      res = await assignExamParticipantAcademicEnrollment(pool, { tenantId: t1, examParticipantId: p_unassigned, academicEnrollmentId: e_current });
      assertStrict(res.type === 'assigned', 'idempotent same-enrollment attachment');

      const enrollmentsAfter = (await client.query(`SELECT * FROM academic_core_student_enrollments ORDER BY id`)).rows;
      assertStrict(JSON.stringify(enrollmentsBefore) === JSON.stringify(enrollmentsAfter), 'no Academic Core mutation');

      const participantsAfter = (await client.query(`SELECT * FROM secure_assessment_exam_participants ORDER BY id`)).rows;
      assertStrict(participantsBefore.length === participantsAfter.length, 'no Participant creation');

      const beforeMap = new Map(participantsBefore.map((r: any) => [r.id, r]));

      for (const afterRow of participantsAfter) {
        const beforeRow = beforeMap.get(afterRow.id);
        if (afterRow.id === p_unassigned) {
          assertStrict(beforeRow.academic_enrollment_id === null, 'p_unassigned initially null');
          assertStrict(afterRow.academic_enrollment_id === e_current, 'p_unassigned changed ONLY academic_enrollment_id to requested enrollment');
        } else {
          assertStrict(beforeRow.academic_enrollment_id === afterRow.academic_enrollment_id, 'academic_enrollment_id remains unchanged for other participants');
        }

        assertStrict(beforeRow.person_id === afterRow.person_id, 'person_id never changes');
        assertStrict(beforeRow.exam_instance_id === afterRow.exam_instance_id, 'exam_instance_id never changes');
        assertStrict(beforeRow.tenant_id === afterRow.tenant_id, 'tenant_id never changes');
      }

      log('BU-049 requirements verified');
    } catch (error) {
      caughtError = error;
      console.error('VERIFICATION FAILED:', error);
    }
  }

  try {
    if (pool) await pool.end();
  } catch (err) {
    teardownError = teardownError || err;
    console.error('Failed to close connections (pool):', err);
  }

  try {
    if (client) await client.end();
  } catch (err) {
    teardownError = teardownError || err;
    console.error('Failed to close connections (client):', err);
  }

  if (databaseCreated) {
    const teardownClient = new Client({ connectionString: adminUrl.toString() });
    try {
      await teardownClient.connect();
      await teardownClient.query(`DROP DATABASE "${TEST_DB}"`);
      const dbCheck = await teardownClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [TEST_DB]);
      assertStrict(dbCheck.rowCount === 0, 'database successfully absent');
      log('disposable DB cleanup is attempted and proven');
    } catch (err) {
      teardownError = teardownError || err;
      console.error(`Failed to drop test database ${TEST_DB}:`, err);
    } finally {
      try {
        await teardownClient.end();
      } catch (err) {
        teardownError = teardownError || err;
        console.error('Failed to close teardownClient:', err);
      }
    }
  }

  if (caughtError || teardownError) {
    process.exit(1);
  } else {
    log('BU-049 VERIFIER PASS');
  }
}

main().catch((error) => {
  console.error('Unhandled fatal error:', error);
  process.exit(1);
});
