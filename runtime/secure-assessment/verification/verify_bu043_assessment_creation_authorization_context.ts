import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { resolveTeacherManagedAssessmentCreationContext } from '../src/assessment-creation-authorization-context.ts';

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('DATABASE_URL must be provided');
  process.exit(1);
}

const runId =
  `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const TEST_DB = `elligble_bu043_${runId}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir =
  path.resolve(__dirname, '../../../database/migrations');

function assertStrict(
  condition: boolean,
  message: string
): asserts condition {
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

  const setupClient =
    new Client({ connectionString: adminUrl.toString() });

  let client: Client | undefined;
  let pool: Pool | undefined;
  let caughtError: unknown = null;
  let databaseCreated = false;

  try {
    await setupClient.connect();
    await setupClient.query(`CREATE DATABASE "${TEST_DB}"`);
    databaseCreated = true;
    await setupClient.end();

    client =
      new Client({ connectionString: testUrl.toString() });

    pool =
      new Pool({ connectionString: testUrl.toString() });

    await client.connect();

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => /^\d{4}_.*\.sql$/.test(file))
      .sort()
      .filter((file) => Number(file.slice(0, 4)) <= 19);

    assertStrict(
      migrationFiles.length === 19,
      `Expected exactly 19 migrations through 0019, got ${migrationFiles.length}`
    );

    for (let index = 0; index < 19; index++) {
      const prefix =
        String(index + 1).padStart(4, '0') + '_';

      assertStrict(
        migrationFiles[index].startsWith(prefix),
        `Migration sequence mismatch at ${prefix}`
      );

      const sql = fs.readFileSync(
        path.join(migrationsDir, migrationFiles[index]),
        'utf8'
      );

      await client.query(sql);
    }

    log('canonical migration chain 0001 through 0019 applied');

    const requiredTables = [
      'tenant_memberships',
      'tenant_teacher_assignments',
      'academic_core_academic_years',
      'academic_core_academic_periods',
      'academic_core_grade_levels',
      'academic_core_academic_groups',
      'academic_core_subjects',
      'academic_core_subject_offerings',
      'academic_core_teaching_assignments',
    ];

    for (const tableName of requiredTables) {
      const result = await client.query(
        `
          SELECT count(*)::int AS count
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        `,
        [tableName]
      );

      assertStrict(
        result.rows[0].count === 1,
        `Required predecessor table missing: ${tableName}`
      );
    }

    log('all required predecessor tables exist');

    const historyBefore = await client.query(
      `
        SELECT count(*)::int AS count
        FROM elligble_migration_history
        WHERE migration_id =
          '0019_bu042_academic_core_teaching_assignment_core_state'
      `
    );

    assertStrict(
      historyBefore.rows[0].count === 1,
      'Migration 0019 history count must be exactly 1'
    );

    const indexBefore = await client.query(
      `
        SELECT count(*)::int AS count
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'academic_core_teaching_assignments'
          AND indexname =
            'udx_academic_core_teaching_assignments_active'
      `
    );

    assertStrict(
      indexBefore.rows[0].count === 1,
      'BU-042 active Teaching Assignment unique index must exist'
    );

    log('BU-042 persistence baseline intact');

    const t1 =
      (await client.query(
        `INSERT INTO tenant_tenants (id)
         VALUES (gen_random_uuid())
         RETURNING id`
      )).rows[0].id;

    const t2 =
      (await client.query(
        `INSERT INTO tenant_tenants (id)
         VALUES (gen_random_uuid())
         RETURNING id`
      )).rows[0].id;

    const p1 =
      (await client.query(
        `INSERT INTO identity_persons (id)
         VALUES (gen_random_uuid())
         RETURNING id`
      )).rows[0].id;

    const p2 =
      (await client.query(
        `INSERT INTO identity_persons (id)
         VALUES (gen_random_uuid())
         RETURNING id`
      )).rows[0].id;

    const p3 =
      (await client.query(
        `INSERT INTO identity_persons (id)
         VALUES (gen_random_uuid())
         RETURNING id`
      )).rows[0].id;

    const p4 =
      (await client.query(
        `INSERT INTO identity_persons (id)
         VALUES (gen_random_uuid())
         RETURNING id`
      )).rows[0].id;

    const m1 =
      (await client.query(
        `
          INSERT INTO tenant_memberships (
            id,
            tenant_id,
            person_id
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2
          )
          RETURNING id
        `,
        [t1, p1]
      )).rows[0].id;

    const m2 =
      (await client.query(
        `
          INSERT INTO tenant_memberships (
            id,
            tenant_id,
            person_id
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2
          )
          RETURNING id
        `,
        [t2, p2]
      )).rows[0].id;

    const m3 =
      (await client.query(
        `
          INSERT INTO tenant_memberships (
            id,
            tenant_id,
            person_id
          )
          VALUES (
            gen_random_uuid(),
            $1,
            $2
          )
          RETURNING id
        `,
        [t1, p3]
      )).rows[0].id;

    const tta1 =
      (await client.query(
        `
          INSERT INTO tenant_teacher_assignments (
            tenant_id,
            membership_id
          )
          VALUES ($1, $2)
          RETURNING id
        `,
        [t1, m1]
      )).rows[0].id;

    const tta2 =
      (await client.query(
        `
          INSERT INTO tenant_teacher_assignments (
            tenant_id,
            membership_id
          )
          VALUES ($1, $2)
          RETURNING id
        `,
        [t2, m2]
      )).rows[0].id;

    const tta3 =
      (await client.query(
        `
          INSERT INTO tenant_teacher_assignments (
            tenant_id,
            membership_id
          )
          VALUES ($1, $2)
          RETURNING id
        `,
        [t1, m3]
      )).rows[0].id;

    const year1 =
      (await client.query(
        `
          INSERT INTO academic_core_academic_years (
            tenant_id,
            display_label,
            start_date,
            end_date
          )
          VALUES (
            $1,
            '2026/2027 A',
            DATE '2026-07-01',
            DATE '2027-06-30'
          )
          RETURNING id
        `,
        [t1]
      )).rows[0].id;

    const year2 =
      (await client.query(
        `
          INSERT INTO academic_core_academic_years (
            tenant_id,
            display_label,
            start_date,
            end_date
          )
          VALUES (
            $1,
            '2026/2027 B',
            DATE '2026-07-01',
            DATE '2027-06-30'
          )
          RETURNING id
        `,
        [t2]
      )).rows[0].id;

    const period1 =
      (await client.query(
        `
          INSERT INTO academic_core_academic_periods (
            tenant_id,
            academic_year_id,
            display_label,
            period_type,
            start_date,
            end_date
          )
          VALUES (
            $1,
            $2,
            'Semester A',
            'SEMESTER',
            DATE '2026-07-01',
            DATE '2026-12-31'
          )
          RETURNING id
        `,
        [t1, year1]
      )).rows[0].id;

    const period2 =
      (await client.query(
        `
          INSERT INTO academic_core_academic_periods (
            tenant_id,
            academic_year_id,
            display_label,
            period_type,
            start_date,
            end_date
          )
          VALUES (
            $1,
            $2,
            'Semester B',
            'SEMESTER',
            DATE '2026-07-01',
            DATE '2026-12-31'
          )
          RETURNING id
        `,
        [t2, year2]
      )).rows[0].id;

    const grade1 =
      (await client.query(
        `
          INSERT INTO academic_core_grade_levels (
            tenant_id,
            display_label
          )
          VALUES ($1, 'Grade A')
          RETURNING id
        `,
        [t1]
      )).rows[0].id;

    const grade2 =
      (await client.query(
        `
          INSERT INTO academic_core_grade_levels (
            tenant_id,
            display_label
          )
          VALUES ($1, 'Grade B')
          RETURNING id
        `,
        [t2]
      )).rows[0].id;

    const group1 =
      (await client.query(
        `
          INSERT INTO academic_core_academic_groups (
            tenant_id,
            academic_year_id,
            grade_level_id,
            display_label
          )
          VALUES ($1, $2, $3, 'Group A')
          RETURNING id
        `,
        [t1, year1, grade1]
      )).rows[0].id;

    const groupOther =
      (await client.query(
        `
          INSERT INTO academic_core_academic_groups (
            tenant_id,
            academic_year_id,
            grade_level_id,
            display_label
          )
          VALUES ($1, $2, $3, 'Group A2')
          RETURNING id
        `,
        [t1, year1, grade1]
      )).rows[0].id;

    const group2 =
      (await client.query(
        `
          INSERT INTO academic_core_academic_groups (
            tenant_id,
            academic_year_id,
            grade_level_id,
            display_label
          )
          VALUES ($1, $2, $3, 'Group B')
          RETURNING id
        `,
        [t2, year2, grade2]
      )).rows[0].id;

    const subject1 =
      (await client.query(
        `
          INSERT INTO academic_core_subjects (
            tenant_id,
            display_label
          )
          VALUES ($1, 'Subject A')
          RETURNING id
        `,
        [t1]
      )).rows[0].id;

    const subject2 =
      (await client.query(
        `
          INSERT INTO academic_core_subjects (
            tenant_id,
            display_label
          )
          VALUES ($1, 'Subject B')
          RETURNING id
        `,
        [t2]
      )).rows[0].id;

    const offering1 =
      (await client.query(
        `
          INSERT INTO academic_core_subject_offerings (
            tenant_id,
            subject_id,
            academic_period_id,
            grade_level_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [t1, subject1, period1, grade1]
      )).rows[0].id;

    const offeringNoAssignment =
      (await client.query(
        `
          INSERT INTO academic_core_subject_offerings (
            tenant_id,
            subject_id,
            academic_period_id,
            grade_level_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [t1, subject1, period1, grade1]
      )).rows[0].id;

    const offering2 =
      (await client.query(
        `
          INSERT INTO academic_core_subject_offerings (
            tenant_id,
            subject_id,
            academic_period_id,
            grade_level_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [t2, subject2, period2, grade2]
      )).rows[0].id;

    const ata1 =
      (await client.query(
        `
          INSERT INTO academic_core_teaching_assignments (
            tenant_id,
            teacher_assignment_id,
            subject_offering_id,
            academic_group_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [t1, tta1, offering1, group1]
      )).rows[0].id;

    let result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p1,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(
      result.type === 'context_resolved',
      'Exact active Teaching Assignment context must resolve'
    );

    if (result.type === 'context_resolved') {
      assertStrict(result.context.membershipId === m1, 'membershipId mismatch');
      assertStrict(result.context.teacherAssignmentId === tta1, 'teacherAssignmentId mismatch');
      assertStrict(result.context.teachingAssignmentId === ata1, 'teachingAssignmentId mismatch');
      assertStrict(result.context.subjectOfferingId === offering1, 'subjectOfferingId mismatch');
      assertStrict(result.context.academicGroupId === group1, 'academicGroupId mismatch');
    }

    log('exact active context resolves');

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p1,
          subjectOfferingId: offeringNoAssignment,
          academicGroupId: group1,
        }
      );

    assertStrict(
      result.type === 'denied',
      'Missing Teaching Assignment must deny'
    );

    log('missing Teaching Assignment denies');

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t2,
          personId: p1,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(result.type === 'denied', 'Wrong tenant must deny');

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p2,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(result.type === 'denied', 'Wrong Person must deny');

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p1,
          subjectOfferingId: offeringNoAssignment,
          academicGroupId: group1,
        }
      );

    assertStrict(result.type === 'denied', 'Wrong Subject Offering must deny');

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p1,
          subjectOfferingId: offering1,
          academicGroupId: groupOther,
        }
      );

    assertStrict(result.type === 'denied', 'Wrong Academic Group must deny');

    log('wrong tenant/person/offering/group all deny');

    const ata3 =
      (await client.query(
        `
          INSERT INTO academic_core_teaching_assignments (
            tenant_id,
            teacher_assignment_id,
            subject_offering_id,
            academic_group_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [t1, tta3, offering1, group1]
      )).rows[0].id;

    const coTeacher1 =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p1,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    const coTeacher2 =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p3,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(
      coTeacher1.type === 'context_resolved' &&
      coTeacher2.type === 'context_resolved',
      'Different Teachers must independently resolve co-teaching context'
    );

    if (coTeacher2.type === 'context_resolved') {
      assertStrict(
        coTeacher2.context.teachingAssignmentId === ata3,
        'Second Teacher Teaching Assignment mismatch'
      );
    }

    log('co-teaching resolves independently');

    await client.query(
      `
        UPDATE academic_core_teaching_assignments
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [ata1]
    );

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p1,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(
      result.type === 'denied',
      'Revoked Teaching Assignment must deny'
    );

    const replacementAta =
      (await client.query(
        `
          INSERT INTO academic_core_teaching_assignments (
            tenant_id,
            teacher_assignment_id,
            subject_offering_id,
            academic_group_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [t1, tta1, offering1, group1]
      )).rows[0].id;

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p1,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(
      result.type === 'context_resolved' &&
      result.context.teachingAssignmentId === replacementAta,
      'Replacement/current active Teaching Assignment must resolve'
    );

    log('revoke + replacement behavior verified');

    await client.query(
      `
        UPDATE tenant_teacher_assignments
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [tta1]
    );

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p1,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(
      result.type === 'denied',
      'Revoked TEACHER staff assignment must deny'
    );

    log('revoked TEACHER assignment denies');

    const p4MembershipA =
      (await client.query(
        `
          INSERT INTO tenant_memberships (
            id,
            tenant_id,
            person_id
          )
          VALUES (gen_random_uuid(), $1, $2)
          RETURNING id
        `,
        [t1, p4]
      )).rows[0].id;

    const p4MembershipB =
      (await client.query(
        `
          INSERT INTO tenant_memberships (
            id,
            tenant_id,
            person_id
          )
          VALUES (gen_random_uuid(), $1, $2)
          RETURNING id
        `,
        [t1, p4]
      )).rows[0].id;

    const p4TeacherA =
      (await client.query(
        `
          INSERT INTO tenant_teacher_assignments (
            tenant_id,
            membership_id
          )
          VALUES ($1, $2)
          RETURNING id
        `,
        [t1, p4MembershipA]
      )).rows[0].id;

    const p4TeacherB =
      (await client.query(
        `
          INSERT INTO tenant_teacher_assignments (
            tenant_id,
            membership_id
          )
          VALUES ($1, $2)
          RETURNING id
        `,
        [t1, p4MembershipB]
      )).rows[0].id;

    await client.query(
      `
        INSERT INTO academic_core_teaching_assignments (
          tenant_id,
          teacher_assignment_id,
          subject_offering_id,
          academic_group_id
        )
        VALUES
          ($1, $2, $3, $4),
          ($1, $5, $3, $4)
      `,
      [
        t1,
        p4TeacherA,
        offering1,
        group1,
        p4TeacherB,
      ]
    );

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p4,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(
      result.type === 'denied',
      'Ambiguous same-Person active context must fail closed'
    );

    log('ambiguous active Person context fails closed without schema mutation');

    const mutationBefore = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM tenant_memberships) AS memberships,
          (SELECT count(*)::int FROM tenant_teacher_assignments) AS teacher_assignments,
          (SELECT count(*)::int FROM academic_core_teaching_assignments) AS teaching_assignments
      `
    );

    result =
      await resolveTeacherManagedAssessmentCreationContext(
        pool,
        {
          tenantId: t1,
          personId: p3,
          subjectOfferingId: offering1,
          academicGroupId: group1,
        }
      );

    assertStrict(
      result.type === 'context_resolved',
      'No-mutation control lookup must resolve'
    );

    const mutationAfter = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM tenant_memberships) AS memberships,
          (SELECT count(*)::int FROM tenant_teacher_assignments) AS teacher_assignments,
          (SELECT count(*)::int FROM academic_core_teaching_assignments) AS teaching_assignments
      `
    );

    assertStrict(
      JSON.stringify(mutationBefore.rows[0]) ===
      JSON.stringify(mutationAfter.rows[0]),
      'Resolver must not mutate Membership/TEACHER/Teaching Assignment state'
    );

    log('resolver performs no mutation');

    const badUrl = new URL(DB_URL as string);
    badUrl.hostname = '127.0.0.1';
    badUrl.port = '1';
    badUrl.pathname = '/postgres';

    const badPool = new Pool({
      connectionString: badUrl.toString(),
      connectionTimeoutMillis: 500,
    });

    try {
      const unavailable =
        await resolveTeacherManagedAssessmentCreationContext(
          badPool,
          {
            tenantId: t1,
            personId: p3,
            subjectOfferingId: offering1,
            academicGroupId: group1,
          }
        );

      assertStrict(
        unavailable.type === 'context_unavailable',
        'Persistence failure must become context_unavailable'
      );
    } finally {
      await badPool.end();
    }

    log('persistence failure becomes context_unavailable');

    const historyAfter = await client.query(
      `
        SELECT count(*)::int AS count
        FROM elligble_migration_history
        WHERE migration_id =
          '0019_bu042_academic_core_teaching_assignment_core_state'
      `
    );

    assertStrict(
      historyAfter.rows[0].count === 1,
      'Migration 0019 history count changed unexpectedly'
    );

    const indexAfter = await client.query(
      `
        SELECT count(*)::int AS count
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'academic_core_teaching_assignments'
          AND indexname =
            'udx_academic_core_teaching_assignments_active'
      `
    );

    assertStrict(
      indexAfter.rows[0].count === 1,
      'BU-042 active unique index was mutated/dropped'
    );

    await client.query(
      `SELECT count(*) FROM academic_core_teaching_assignments`
    );

    log('BU-042 persistence remains intact');
    log('BU-043 REAL POSTGRESQL VERIFIER PASS');
  } catch (error) {
    caughtError = error;
  } finally {
    try {
      if (pool) {
        await pool.end();
      }
    } catch (cleanupError) {
      if (!caughtError) {
        caughtError = cleanupError;
      }
    }

    try {
      if (client) {
        await client.end();
      }
    } catch (cleanupError) {
      if (!caughtError) {
        caughtError = cleanupError;
      }
    }

    try {
      await setupClient.end();
    } catch {
      // setup client may already be closed
    }

    if (databaseCreated) {
      const cleanupClient =
        new Client({ connectionString: adminUrl.toString() });

      try {
        await cleanupClient.connect();
        await cleanupClient.query(
          `DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`
        );
        log('disposable database cleaned up');
      } catch (cleanupError) {
        if (!caughtError) {
          caughtError = cleanupError;
        }
      } finally {
        await cleanupClient.end().catch(() => undefined);
      }
    }
  }

  if (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : 'Unknown verification failure';

    console.error(`VERIFICATION FAILED: ${message}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : 'Unknown fatal verification failure';

  console.error(`VERIFICATION FAILED: ${message}`);
  process.exit(1);
});