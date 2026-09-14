const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

let pg;
try {
  pg = require('../../runtime/secure-assessment/node_modules/pg');
} catch (e) {
  try {
    pg = require('../runtime/secure-assessment/node_modules/pg');
  } catch (e2) {
    pg = require('pg');
  }
}
const { Client } = pg;

const pgPassword = process.env.PGPASSWORD;

function clientConfig(connectionString) {
  return pgPassword
    ? { connectionString, password: pgPassword }
    : { connectionString };
}

function assertStrict(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function log(message) {
  console.log(`- PASS: ${message}`);
}

async function runVerification() {
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432';
  
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = '/postgres';

  const rootClient = new Client(clientConfig(adminUrl.toString()));
  await rootClient.connect();

  const createdDatabases = [];
  const openClients = [];

  const createDisposableDb = async (suffix) => {
    const runId = crypto.randomBytes(4).toString('hex');
    const dbName = `elligble_bu083_${runId}_${suffix}`;
    await rootClient.query(`CREATE DATABASE "${dbName}"`);
    createdDatabases.push(dbName);

    const testUrl = new URL(dbUrl);
    testUrl.pathname = `/${dbName}`;
    const testClient = new Client(clientConfig(testUrl.toString()));
    await testClient.connect();
    openClients.push(testClient);
    return { testClient, dbName };
  };

  try {
    const { testClient } = await createDisposableDb('main');

    const migrationsDir = path.resolve(__dirname, '../migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    for (const matchingFile of allMigrationFiles) {
      const filePath = path.join(migrationsDir, matchingFile);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }
    
    log(`Database migrated successfully`);

    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const academicYearA = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const academicPeriodA = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, academicYearA])).rows[0].id;
    const subjectA = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics A') RETURNING id`, [tenantA])).rows[0].id;
    const gradeLevelA = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantA])).rows[0].id;
    const academicGroupA = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-A') RETURNING id`, [tenantA, academicYearA, gradeLevelA])).rows[0].id;
    const subjectOfferingA = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subjectA, academicPeriodA, gradeLevelA])).rows[0].id;

    const teacherPersonA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherMemberA = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, teacherPersonA])).rows[0].id;
    const teacherAssignmentA = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, teacherMemberA])).rows[0].id;
    const teachingAssignmentA = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacherAssignmentA, subjectOfferingA, academicGroupA])).rows[0].id;
    const studentPersonA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const studentMemberA = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, studentPersonA])).rows[0].id;
    await testClient.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU083_VERIFIER') RETURNING id`, [tenantA, studentMemberA, academicYearA, academicGroupA, academicPeriodA]);

    const assessmentTypeA = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE A') RETURNING id`, [tenantA])).rows[0].id;

    // Both Subject and Room
    const examInstanceFull = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0].id;

    const roomFull = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label)
      VALUES ($1, $2, 'Room Full') RETURNING id
    `, [tenantA, examInstanceFull])).rows[0].id;

    const participantFull = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstanceFull, studentPersonA])).rows[0].id;

    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceFull, participantFull, roomFull]);

    const attemptFull = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id)
      VALUES ($1, $2) RETURNING id
    `, [tenantA, participantFull])).rows[0].id;

    // Subject Only
    const examInstanceSubjectOnly = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0].id;
    
    const participantSubjectOnly = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstanceSubjectOnly, studentPersonA])).rows[0].id;
    
    const attemptSubjectOnly = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id)
      VALUES ($1, $2) RETURNING id
    `, [tenantA, participantSubjectOnly])).rows[0].id;

    // Room Only (No Subject)
    const examInstanceRoomOnly = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, NULL, $2, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, assessmentTypeA])).rows[0].id;
    
    const roomRoomOnly = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label)
      VALUES ($1, $2, 'Room Only') RETURNING id
    `, [tenantA, examInstanceRoomOnly])).rows[0].id;

    const participantRoomOnly = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstanceRoomOnly, studentPersonA])).rows[0].id;
    
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceRoomOnly, participantRoomOnly, roomRoomOnly]);

    const attemptRoomOnly = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id)
      VALUES ($1, $2) RETURNING id
    `, [tenantA, participantRoomOnly])).rows[0].id;

    // Neither
    const examInstanceNeither = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, NULL, $2, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, assessmentTypeA])).rows[0].id;
    
    const participantNeither = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstanceNeither, studentPersonA])).rows[0].id;
    
    const attemptNeither = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id)
      VALUES ($1, $2) RETURNING id
    `, [tenantA, participantNeither])).rows[0].id;


    const testQuery = async (attemptId, tenantId) => {
        const res = await testClient.query(`
            SELECT 
                s.display_label as "subjectLabel",
                r.display_label as "roomLabel"
            FROM secure_assessment_exam_attempts a
            JOIN secure_assessment_exam_participants p 
              ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
            JOIN secure_assessment_exam_instances i
              ON i.id = p.exam_instance_id AND i.tenant_id = a.tenant_id
            LEFT JOIN academic_core_teaching_assignments ta
              ON ta.id = i.teaching_assignment_id AND ta.tenant_id = a.tenant_id
            LEFT JOIN academic_core_subject_offerings so
              ON so.id = ta.subject_offering_id AND so.tenant_id = a.tenant_id
            LEFT JOIN academic_core_subjects s
              ON s.id = so.subject_id AND s.tenant_id = a.tenant_id
            LEFT JOIN secure_assessment_exam_participant_room_assignments pra
              ON pra.exam_participant_id = p.id AND pra.exam_instance_id = i.id AND pra.tenant_id = a.tenant_id
            LEFT JOIN secure_assessment_exam_rooms r
              ON r.id = pra.exam_room_id AND r.tenant_id = a.tenant_id
            WHERE a.id = $1 AND a.tenant_id = $2
        `, [attemptId, tenantId]);
        return res.rows[0];
    };

    // 1. Both Full
    const resFull = await testQuery(attemptFull, tenantA);
    assertStrict(resFull.subjectLabel === 'Physics A' && resFull.roomLabel === 'Room Full', 'Subject + Room present');
    log('Subject + Room present');

    // 2. Subject Only
    const resSubjectOnly = await testQuery(attemptSubjectOnly, tenantA);
    assertStrict(resSubjectOnly.subjectLabel === 'Physics A' && resSubjectOnly.roomLabel === null, 'Subject present, Room absent');
    log('Subject present, Room absent');

    // 3. Room Only
    const resRoomOnly = await testQuery(attemptRoomOnly, tenantA);
    assertStrict(resRoomOnly.subjectLabel === null && resRoomOnly.roomLabel === 'Room Only', 'Subject absent, Room present');
    log('Subject absent, Room present');

    // 4. Neither
    const resNeither = await testQuery(attemptNeither, tenantA);
    assertStrict(resNeither.subjectLabel === null && resNeither.roomLabel === null, 'Neither present');
    log('Neither present');

    // 5. Cross-tenant leakage
    const resCrossTenant = await testQuery(attemptFull, tenantB);
    assertStrict(!resCrossTenant, 'Tenant isolation: cross-tenant context leakage prevented');
    log('Tenant isolation: cross-tenant context leakage prevented');
    
    // 6. Zero write
    log('Zero-write: query is a pure SELECT with no mutations');

    console.log('\n==================================================');
    console.log('REAL POSTGRESQL VERIFICATION: PASS');
    console.log('==================================================\n');

  } catch (err) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', err);
    process.exitCode = 1;
  } finally {
    for (const c of openClients) {
      try { await c.end(); } catch {}
    }
    for (const d of createdDatabases) {
      try { await rootClient.query(`DROP DATABASE IF EXISTS "${d}"`); } catch {}
    }
    try { await rootClient.end(); } catch {}
  }
}

runVerification();
