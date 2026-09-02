import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { createExamParticipantAcademicEnrollment } from '../src/exam-participant-academic-enrollment-creation.ts';

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DATABASE_URL must be provided');
  process.exit(1);
}

const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const TEST_DB = `elligble_bu050_${runId}`;

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

      const historyCheck = (await client.query(`SELECT migration_id FROM elligble_migration_history ORDER BY migration_id ASC`)).rows;
      assertStrict(historyCheck.length === 23, 'Exactly 23 rows exist for the applied 0001..0023 chain');

      for (let i = 0; i < 23; i++) {
        const expectedId = expectedFiles[i].replace('.sql', '');
        assertStrict(historyCheck[i].migration_id === expectedId, `Migration history exact ID match failed for ${expectedId}`);
      }

      log('canonical migration chain 0001 through 0023 applied and exactly proven');

      const t1 = (await client.query(`INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
      const t2 = (await client.query(`INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

      const p1 = (await client.query(`INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

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

      const e_current = await insertEnrollment(t1, m1, year1, group1, period1, '2000-01-01', null, 'OPAQUE_STATUS_CURRENT', 'BU050_VERIFIER_FIXTURE');
      const e_future = await insertEnrollment(t1, m1, year1, group1, period1, '2999-01-01', null, 'OPAQUE_STATUS_FUTURE', 'BU050_VERIFIER_FIXTURE');
      const e_past = await insertEnrollment(t1, m1, year1, group1, period1, '2000-01-01', '2000-12-31', 'OPAQUE_STATUS_ENDED', 'BU050_VERIFIER_FIXTURE');
      const e_t2_current = await insertEnrollment(t2, m2, year1_t2, group1_t2, period1_t2, '2000-01-01', null, 'OPAQUE_STATUS_CURRENT', 'BU050_VERIFIER_FIXTURE');

      // Snapshots for no-mutation proof
      const membershipsBefore = (await client.query(`SELECT * FROM tenant_memberships ORDER BY id`)).rows;
      const instancesBefore = (await client.query(`SELECT * FROM secure_assessment_exam_instances ORDER BY id`)).rows;
      const enrollmentsBefore = (await client.query(`SELECT * FROM academic_core_student_enrollments ORDER BY id`)).rows;
      const yearsBefore = (await client.query(`SELECT * FROM academic_core_academic_years ORDER BY id`)).rows;
      const periodsBefore = (await client.query(`SELECT * FROM academic_core_academic_periods ORDER BY id`)).rows;
      const gradesBefore = (await client.query(`SELECT * FROM academic_core_grade_levels ORDER BY id`)).rows;
      const groupsBefore = (await client.query(`SELECT * FROM academic_core_academic_groups ORDER BY id`)).rows;

      // 1. Wrong-tenant Exam Instance denied
      let res = await createExamParticipantAcademicEnrollment(pool, { tenantId: t2, examInstanceId: exam1, academicEnrollmentId: e_t2_current });
      assertStrict(res.type === 'denied', 'wrong-tenant Exam Instance denied');

      // 2. Missing Exam Instance denied
      res = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: '00000000-0000-4000-a000-000000000000', academicEnrollmentId: e_current });
      assertStrict(res.type === 'denied', 'missing Exam Instance denied');

      // 3. Wrong-tenant enrollment denied through BU-048
      res = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: e_t2_current });
      assertStrict(res.type === 'denied', 'wrong-tenant enrollment denied');

      // 4. Future enrollment denied through BU-048
      res = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: e_future });
      assertStrict(res.type === 'denied', 'future enrollment denied');

      // 5. Ended enrollment denied through BU-048
      res = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: e_past });
      assertStrict(res.type === 'denied', 'ended enrollment denied');

      // 6. Successful creation
      res = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: e_current });
      assertStrict(res.type === 'created', 'successful creation');
      const participantId = res.type === 'created' ? res.examParticipantId : '';

      const participantRow = (await client.query(`SELECT * FROM secure_assessment_exam_participants WHERE id = $1`, [participantId])).rows[0];
      assertStrict(participantRow.tenant_id === t1, 'correct tenant_id');
      assertStrict(participantRow.exam_instance_id === exam1, 'correct exam_instance_id');
      assertStrict(participantRow.person_id === p1, 'canonical person_id');
      assertStrict(participantRow.academic_enrollment_id === e_current, 'requested academic_enrollment_id');

      // 7. Sequential duplicate participant denied
      const resDup = await createExamParticipantAcademicEnrollment(pool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: e_current });
      assertStrict(resDup.type === 'denied', 'sequential duplicate participant denied');

      // 8. Raw DB Failure Proof
      const errorPool = new Pool({ connectionString: testUrl.toString() });
      await errorPool.end(); // force closed pool to cause query error
      const errRes = await createExamParticipantAcademicEnrollment(errorPool, { tenantId: t1, examInstanceId: exam1, academicEnrollmentId: e_current });
      assertStrict(errRes.type === 'creation_unavailable', 'raw db failure safely returns creation_unavailable');
      assertStrict(Object.keys(errRes).length === 1, 'raw db failure does not leak error details');

      // No-Mutation Assertions
      const membershipsAfter = (await client.query(`SELECT * FROM tenant_memberships ORDER BY id`)).rows;
      assertStrict(JSON.stringify(membershipsBefore) === JSON.stringify(membershipsAfter), 'tenant membership truth unchanged');

      const instancesAfter = (await client.query(`SELECT * FROM secure_assessment_exam_instances ORDER BY id`)).rows;
      assertStrict(JSON.stringify(instancesBefore) === JSON.stringify(instancesAfter), 'Exam Instance truth unchanged');

      const enrollmentsAfter = (await client.query(`SELECT * FROM academic_core_student_enrollments ORDER BY id`)).rows;
      assertStrict(JSON.stringify(enrollmentsBefore) === JSON.stringify(enrollmentsAfter), 'Academic Core student enrollments truth unchanged');

      const yearsAfter = (await client.query(`SELECT * FROM academic_core_academic_years ORDER BY id`)).rows;
      assertStrict(JSON.stringify(yearsBefore) === JSON.stringify(yearsAfter), 'Academic Core years truth unchanged');

      const periodsAfter = (await client.query(`SELECT * FROM academic_core_academic_periods ORDER BY id`)).rows;
      assertStrict(JSON.stringify(periodsBefore) === JSON.stringify(periodsAfter), 'Academic Core periods truth unchanged');

      const gradesAfter = (await client.query(`SELECT * FROM academic_core_grade_levels ORDER BY id`)).rows;
      assertStrict(JSON.stringify(gradesBefore) === JSON.stringify(gradesAfter), 'Academic Core grades truth unchanged');

      const groupsAfter = (await client.query(`SELECT * FROM academic_core_academic_groups ORDER BY id`)).rows;
      assertStrict(JSON.stringify(groupsBefore) === JSON.stringify(groupsAfter), 'Academic Core groups truth unchanged');

      const pCount = await client.query(`SELECT count(*) FROM secure_assessment_exam_participants`);
      assertStrict(Number(pCount.rows[0].count) === 1, 'duplicate-denial and negative cases leave row count exactly 1');

      const attemptCount = await client.query(`SELECT count(*) FROM secure_assessment_exam_attempts`);
      assertStrict(Number(attemptCount.rows[0].count) === 0, 'no Exam Attempt creation');

      const sessionCount = await client.query(`SELECT count(*) FROM secure_assessment_exam_sessions`);
      assertStrict(Number(sessionCount.rows[0].count) === 0, 'no Exam Session creation');

      log('BU-050 requirements verified');
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
    log('BU-050 VERIFIER PASS');
  }
}

main().catch((error) => {
  console.error('Unhandled fatal error:', error);
  process.exit(1);
});
