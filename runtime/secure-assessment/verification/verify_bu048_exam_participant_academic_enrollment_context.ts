import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { resolveExamParticipantAcademicEnrollmentContext } from '../src/exam-participant-academic-enrollment-context.ts';

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DATABASE_URL must be provided');
  process.exit(1);
}

const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const TEST_DB = `elligble_bu048_${runId}`;

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
  }

  try {
    await setupClient.end();
  } catch (err) {
    teardownError = teardownError || err;
    console.error('Failed to close setupClient:', err);
  }

  if (!caughtError) {
    try {
      client = new Client({ connectionString: testUrl.toString() });
      pool = new Pool({ connectionString: testUrl.toString() });

      await client.connect();

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => /^\d{4}_.*\.sql$/.test(file))
        .sort()
        .filter((file) => Number(file.slice(0, 4)) <= 23);

      assertStrict(
        migrationFiles.length === 23,
        `Expected exactly 23 migrations through 0023, got ${migrationFiles.length}`
      );

      for (let index = 0; index < 23; index++) {
        const prefix = String(index + 1).padStart(4, '0') + '_';
        assertStrict(
          migrationFiles[index].startsWith(prefix),
          `Migration sequence mismatch at ${prefix}`
        );
        const sql = fs.readFileSync(path.join(migrationsDir, migrationFiles[index]), 'utf8');
        await client.query(sql);
      }

      log('canonical migration chain 0001 through 0023 applied');

      const historyBefore = await client.query(
        `
          SELECT
            count(*)::int AS total_count,
            count(*) FILTER (WHERE migration_id = '0023_bu047_secure_assessment_exam_participant_academic_enrollment_context')::int AS m23_count
          FROM elligble_migration_history
        `
      );

      assertStrict(historyBefore.rows[0].m23_count === 1, 'migration 0023 history exactly 1');
      assertStrict(historyBefore.rows[0].total_count === 23, 'canonical chain history count sanity check');

      const columnsQuery = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'secure_assessment_exam_participants'
          AND column_name IN ('academic_enrollment_id', 'person_id')
      `);

      const acCol = columnsQuery.rows.find((r: any) => r.column_name === 'academic_enrollment_id');
      const personCol = columnsQuery.rows.find((r: any) => r.column_name === 'person_id');

      assertStrict(!!acCol, 'academic_enrollment_id exists in public.secure_assessment_exam_participants');
      assertStrict(acCol.data_type === 'uuid', 'UUID');
      assertStrict(acCol.is_nullable === 'YES', 'nullable');
      assertStrict(acCol.column_default === null, 'no default');
      assertStrict(!!personCol, 'person_id preserved in public.secure_assessment_exam_participants');

      const uqQuery = await client.query(`
        SELECT
          c.conname,
          a.attname AS col_name
        FROM pg_constraint c
        JOIN pg_class cl ON c.conrelid = cl.oid
        JOIN pg_namespace ns ON cl.relnamespace = ns.oid
        CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = k.attnum
        WHERE ns.nspname = 'public'
          AND cl.relname = 'academic_core_student_enrollments'
          AND c.conname = 'uq_ac_student_enrollments_id_tenant'
          AND c.contype = 'u'
        ORDER BY k.ord
      `);

      assertStrict(uqQuery.rows.length === 2, 'uq_ac_student_enrollments_id_tenant exact');
      assertStrict(uqQuery.rows[0].col_name === 'id', 'uq_ac_student_enrollments_id_tenant exact ordered col 1');
      assertStrict(uqQuery.rows[1].col_name === 'tenant_id', 'uq_ac_student_enrollments_id_tenant exact ordered col 2');

      const fkQuery = await client.query(`
        SELECT
          c.conname,
          c.confdeltype,
          a1.attname AS local_col,
          a2.attname AS ref_col,
          cl_ref.relname AS ref_table,
          ns_ref.nspname AS ref_namespace
        FROM pg_constraint c
        JOIN pg_class cl ON c.conrelid = cl.oid
        JOIN pg_namespace ns ON cl.relnamespace = ns.oid
        JOIN pg_class cl_ref ON c.confrelid = cl_ref.oid
        JOIN pg_namespace ns_ref ON cl_ref.relnamespace = ns_ref.oid
        CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a1 ON a1.attrelid = cl.oid AND a1.attnum = k.attnum
        JOIN pg_attribute a2 ON a2.attrelid = cl_ref.oid AND a2.attnum = c.confkey[k.ord]
        WHERE ns.nspname = 'public'
          AND cl.relname = 'secure_assessment_exam_participants'
          AND c.conname = 'fk_sa_exam_participants_academic_enrollment'
          AND c.contype = 'f'
        ORDER BY k.ord
      `);

      assertStrict(fkQuery.rows.length === 2, 'FK exact name in public schema');
      assertStrict(fkQuery.rows[0].local_col === 'academic_enrollment_id', 'FK exact ordered local columns');
      assertStrict(fkQuery.rows[1].local_col === 'tenant_id', 'FK exact ordered local columns');
      assertStrict(fkQuery.rows[0].ref_namespace === 'public', 'FK exact referenced namespace');
      assertStrict(fkQuery.rows[0].ref_table === 'academic_core_student_enrollments', 'FK exact referenced table');
      assertStrict(fkQuery.rows[0].ref_col === 'id', 'FK exact ordered referenced columns');
      assertStrict(fkQuery.rows[1].ref_col === 'tenant_id', 'FK exact ordered referenced columns');
      assertStrict(fkQuery.rows[0].confdeltype === 'r', 'ON DELETE RESTRICT');

      const idxQuery = await client.query(`
        SELECT
          i.indisunique,
          a.attname AS col_name
        FROM pg_index i
        JOIN pg_class cl ON i.indexrelid = cl.oid
        JOIN pg_namespace ns ON cl.relnamespace = ns.oid
        JOIN pg_class table_cl ON i.indrelid = table_cl.oid
        JOIN pg_namespace table_ns ON table_cl.relnamespace = table_ns.oid
        CROSS JOIN LATERAL unnest(string_to_array(i.indkey::text, ' ')::smallint[]) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = table_cl.oid AND a.attnum = k.attnum
        WHERE ns.nspname = 'public'
          AND cl.relname = 'idx_sa_exam_participants_tenant_academic_enrollment'
          AND table_ns.nspname = 'public'
          AND table_cl.relname = 'secure_assessment_exam_participants'
        ORDER BY k.ord
      `);

      assertStrict(idxQuery.rows.length === 2, 'index exact name/table/namespace');
      assertStrict(idxQuery.rows[0].indisunique === false, 'index NON-UNIQUE');
      assertStrict(idxQuery.rows[0].col_name === 'tenant_id', 'index ordered columns exactly (tenant_id)');
      assertStrict(idxQuery.rows[1].col_name === 'academic_enrollment_id', 'index ordered columns exactly (academic_enrollment_id)');

      log('N. BU-047 academic enrollment participant persistence/FK/index baseline intact');

      const t1 = (await client.query(`INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
      const t2 = (await client.query(`INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

      const p1 = (await client.query(`INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

      const m1 = (await client.query(
        `INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
        [t1, p1]
      )).rows[0].id;

      const year1 = (await client.query(
        `INSERT INTO academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`,
        [t1]
      )).rows[0].id;

      const period1 = (await client.query(
        `INSERT INTO academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem A', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`,
        [t1, year1]
      )).rows[0].id;

      const grade1 = (await client.query(
        `INSERT INTO academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade A') RETURNING id`,
        [t1]
      )).rows[0].id;

      const group1 = (await client.query(
        `INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'Group A') RETURNING id`,
        [t1, year1, grade1]
      )).rows[0].id;

      async function insertEnrollment(tenantId: string, membershipId: string, yearId: string, groupId: string, periodId: string, startDate: string, endDate: string | null, status: string, source: string) {
        return (await client!.query(
          `
            INSERT INTO academic_core_student_enrollments (
              tenant_id,
              membership_id,
              academic_year_id,
              academic_group_id,
              academic_period_id,
              start_date,
              end_date,
              status,
              source
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `,
          [tenantId, membershipId, yearId, groupId, periodId, startDate, endDate, status, source]
        )).rows[0].id;
      }

      const e_current_null = await insertEnrollment(t1, m1, year1, group1, period1, '2000-01-01', null, 'OPAQUE_STATUS_CURRENT_NULL', 'BU048_VERIFIER_FIXTURE');

      const enrollmentBefore = (await client.query(`SELECT * FROM academic_core_student_enrollments WHERE id = $1`, [e_current_null])).rows[0];
      const participantsBefore = (await client.query(`SELECT * FROM secure_assessment_exam_participants`)).rows;

      let res = await resolveExamParticipantAcademicEnrollmentContext(pool, { tenantId: t1, academicEnrollmentId: e_current_null });

      assertStrict(res.type === 'context_resolved', 'A. same-tenant temporally-current enrollment resolves');
      assertStrict(res.type === 'context_resolved', 'J. NULL end_date resolves');
      if (res.type === 'context_resolved') {
        assertStrict(res.context.membershipId === m1, 'B. canonical membershipId returned');
        assertStrict(res.context.personId === p1, 'C. canonical personId returned through tenant_memberships');
        assertStrict(res.context.academicYearId === year1, 'D. academicYearId / academicGroupId / academicPeriodId returned');
        assertStrict(res.context.academicGroupId === group1, 'D. academicYearId / academicGroupId / academicPeriodId returned');
        assertStrict(res.context.academicPeriodId === period1, 'D. academicYearId / academicGroupId / academicPeriodId returned');
      }

      const enrollmentAfter = (await client.query(`SELECT * FROM academic_core_student_enrollments WHERE id = $1`, [e_current_null])).rows[0];
      const participantsAfter = (await client.query(`SELECT * FROM secure_assessment_exam_participants`)).rows;

      assertStrict(JSON.stringify(enrollmentBefore) === JSON.stringify(enrollmentAfter), 'L. Academic Enrollment is not mutated by resolver');
      assertStrict(JSON.stringify(participantsBefore) === JSON.stringify(participantsAfter), 'M. Exam Participant table is not mutated by resolver');

      res = await resolveExamParticipantAcademicEnrollmentContext(pool, { tenantId: t2, academicEnrollmentId: e_current_null });
      assertStrict(res.type === 'denied', 'E. wrong tenant denies');

      res = await resolveExamParticipantAcademicEnrollmentContext(pool, { tenantId: t1, academicEnrollmentId: '00000000-0000-4000-a000-000000000000' });
      assertStrict(res.type === 'denied', 'F. nonexistent enrollment denies');

      const e_future = await insertEnrollment(t1, m1, year1, group1, period1, '2999-01-01', null, 'OPAQUE_STATUS_FUTURE', 'BU048_VERIFIER_FIXTURE');
      res = await resolveExamParticipantAcademicEnrollmentContext(pool, { tenantId: t1, academicEnrollmentId: e_future });
      assertStrict(res.type === 'denied', 'G. future start_date denies');

      const e_past = await insertEnrollment(t1, m1, year1, group1, period1, '2000-01-01', '2000-12-31', 'OPAQUE_STATUS_ENDED', 'BU048_VERIFIER_FIXTURE');
      res = await resolveExamParticipantAcademicEnrollmentContext(pool, { tenantId: t1, academicEnrollmentId: e_past });
      assertStrict(res.type === 'denied', 'H. end_date before CURRENT_DATE denies');

      const e_current_end = (await client.query(
        `
          INSERT INTO academic_core_student_enrollments (
            tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, end_date, status, source
          )
          VALUES ($1, $2, $3, $4, $5, '2000-01-01', CURRENT_DATE, 'OPAQUE_STATUS_CURRENT_END', 'BU048_VERIFIER_FIXTURE')
          RETURNING id
        `,
        [t1, m1, year1, group1, period1]
      )).rows[0].id;
      res = await resolveExamParticipantAcademicEnrollmentContext(pool, { tenantId: t1, academicEnrollmentId: e_current_end });
      assertStrict(res.type === 'context_resolved', 'I. end_date = CURRENT_DATE resolves');

      const e_current_opaque = await insertEnrollment(t1, m1, year1, group1, period1, '2000-01-01', null, 'OPAQUE_STATUS_ALTERNATE', 'BU048_VERIFIER_FIXTURE');
      res = await resolveExamParticipantAcademicEnrollmentContext(pool, { tenantId: t1, academicEnrollmentId: e_current_opaque });
      assertStrict(res.type === 'context_resolved', 'K. differing opaque status does not deny an otherwise current enrollment');
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
      log('O. disposable DB cleanup is attempted and proven');
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
    log('BU-048 VERIFIER PASS');
  }
}

main().catch((error) => {
  console.error('Unhandled fatal error:', error);
  process.exit(1);
});
