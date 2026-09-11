const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

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

async function getAcademicCoreSchema(client) {
  const tables = [
    'academic_core_academic_years',
    'academic_core_academic_periods',
    'academic_core_subjects',
    'academic_core_grade_levels',
    'academic_core_academic_groups',
    'academic_core_subject_offerings',
    'academic_core_teaching_assignments',
    'academic_core_student_enrollments'
  ];
  const cols = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1)
    ORDER BY table_name, column_name
  `, [tables]);
  const constraints = await client.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public' AND tc.table_name = ANY($1)
    ORDER BY tc.table_name, tc.constraint_name
  `, [tables]);
  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY($1)
    ORDER BY tablename, indexname
  `, [tables]);
  return JSON.stringify({ cols: cols.rows, constraints: constraints.rows, indexes: indexes.rows });
}

async function getAcademicCoreData(client) {
  const tables = [
    'academic_core_academic_years',
    'academic_core_academic_periods',
    'academic_core_subjects',
    'academic_core_grade_levels',
    'academic_core_academic_groups',
    'academic_core_subject_offerings',
    'academic_core_teaching_assignments',
    'academic_core_student_enrollments'
  ];
  const data = {};
  for (const t of tables) {
    const res = await client.query(`SELECT * FROM public.${t} ORDER BY id`);
    data[t] = res.rows;
  }
  return JSON.stringify(data);
}

async function runVerification() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required');

  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = '/postgres';

  const rootClient = new Client(clientConfig(adminUrl.toString()));
  await rootClient.connect();

  const createdDatabases = [];
  const openClients = [];

  const createDisposableDb = async (suffix) => {
    const runId = crypto.randomBytes(4).toString('hex');
    const dbName = `elligble_bu076_${runId}_${suffix}`;
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
    // 0. Pre-run zero-leak check
    const preLeakCheck = await rootClient.query(
      `SELECT count(*) as count FROM pg_database WHERE datname LIKE 'elligble_bu076_%'`
    );
    const preLeakCount = parseInt(preLeakCheck.rows[0].count, 10);
    assertStrict(preLeakCount === 0, `Pre-run leak count must be 0, found ${preLeakCount}`);
    log(`Pre-run zero-leak proven: elligble_bu076_* count = 0`);

    // 1. Check migration files: migrations 0001..0033 exist, 0034 exists, 0035 absent
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    for (let i = 1; i <= 33; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFiles = allMigrationFiles.filter(f => f.startsWith(`${prefix}_`));
      assertStrict(matchingFiles.length === 1, `Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`);
    }
    log(`Item 1 PASS: Migrations 0001..0033 exist exactly as canonical prerequisite history`);

    const m34Files = allMigrationFiles.filter(f => f.startsWith('0034_'));
    assertStrict(m34Files.length === 1, `Expected exactly one migration for prefix 0034, found ${m34Files.length}`);
    const migration0034Sql = fs.readFileSync(path.join(migrationsDir, m34Files[0]), 'utf8');
    const exactMigration0034Id = '0034_bu076_secure_assessment_exam_instance_room_proctor_requirement_policy';

    // 5. Check migration 0035 absent in files
    const m35Files = allMigrationFiles.filter(f => f.startsWith('0035_'));
    assertStrict(m35Files.length === 0, `Expected zero migrations for prefix 0035, found ${m35Files.length}`);
    log(`Item 5 PASS: Migration 0035 absent in migration directory`);

    // Create main disposable test database
    const { testClient, dbName } = await createDisposableDb('main');

    // Apply migrations 0001..0033
    for (let i = 1; i <= 33; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFile = allMigrationFiles.find(f => f.startsWith(`${prefix}_`));
      const filePath = path.join(migrationsDir, matchingFile);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    // 2. Pre-0034 history = 33
    const preHistoryRes = await testClient.query('SELECT COUNT(*) as count FROM public.elligble_migration_history');
    const preHistoryCount = parseInt(preHistoryRes.rows[0].count, 10);
    assertStrict(preHistoryCount === 33, `Pre-0034 migration history count must be 33, got ${preHistoryCount}`);
    log(`Item 2 PASS: Pre-0034 migration history count = 33 exactly`);

    // Seed pre-0034 fixtures
    // Tenant A
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
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
    await testClient.query(`INSERT INTO public.academic_core_student_enrollments (tenant_id, membership_id, academic_year_id, academic_group_id, academic_period_id, start_date, status, source) VALUES ($1, $2, $3, $4, $5, DATE '2026-07-01', 'OPAQUE_STATUS_CURRENT', 'BU076_VERIFIER') RETURNING id`, [tenantA, studentMemberA, academicYearA, academicGroupA, academicPeriodA]);

    const assessmentTypeA = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE A') RETURNING id`, [tenantA])).rows[0].id;

    // Exam Instance created before 0034
    const examInstancePreA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0].id;

    // Room, Participant, Participant Room Assignment, Proctor Assignment, Proctor Room Assignment, Attempt, Session
    const roomPreA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label)
      VALUES ($1, $2, 'Room Pre-0034 A') RETURNING id
    `, [tenantA, examInstancePreA])).rows[0].id;

    const participantPreA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstancePreA, studentPersonA])).rows[0].id;

    const partRoomPreA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [tenantA, examInstancePreA, participantPreA, roomPreA])).rows[0].id;

    const proctorPersonA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorAssignmentPreA = (await testClient.query(`
      INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstancePreA, proctorPersonA])).rows[0].id;

    const proctorRoomPreA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [tenantA, examInstancePreA, proctorAssignmentPreA, roomPreA])).rows[0].id;

    const attemptPreA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id)
      VALUES ($1, $2) RETURNING id
    `, [tenantA, participantPreA])).rows[0].id;

    const sessionPreA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_sessions (tenant_id, exam_attempt_id)
      VALUES ($1, $2) RETURNING id
    `, [tenantA, attemptPreA])).rows[0].id;

    // Snapshot pre-0034 state
    const pre0034AcademicSchema = await getAcademicCoreSchema(testClient);
    const pre0034AcademicData = await getAcademicCoreData(testClient);

    const preTables = (await testClient.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)).rows.map(r => r.table_name);

    const preColsExamInstances = (await testClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances'
      ORDER BY column_name
    `)).rows.map(r => r.column_name);

    const preExamInstanceRow = (await testClient.query(`
      SELECT * FROM public.secure_assessment_exam_instances WHERE id = $1
    `, [examInstancePreA])).rows[0];

    const preRooms = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_rooms ORDER BY id`)).rows;
    const prePartRooms = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_participant_room_assignments ORDER BY id`)).rows;
    const preProctors = (await testClient.query(`SELECT * FROM public.secure_assessment_proctor_assignments ORDER BY id`)).rows;
    const preProctorRooms = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_proctor_room_assignments ORDER BY id`)).rows;
    const preAttempts = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_attempts ORDER BY id`)).rows;
    const preSessions = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_sessions ORDER BY id`)).rows;
    const preParticipants = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_participants ORDER BY id`)).rows;

    // 3. Apply migration 0034
    await testClient.query(migration0034Sql);
    log(`Item 3 PASS: Migration 0034 applies normally`);

    // 4. Post-0034 history = 34
    const postHistoryRes = await testClient.query('SELECT COUNT(*) as count FROM public.elligble_migration_history');
    const postHistoryCount = parseInt(postHistoryRes.rows[0].count, 10);
    assertStrict(postHistoryCount === 34, `Post-0034 migration history count must be 34, got ${postHistoryCount}`);
    const exactM34InDb = await testClient.query('SELECT 1 FROM public.elligble_migration_history WHERE migration_id = $1', [exactMigration0034Id]);
    assertStrict(exactM34InDb.rowCount === 1, `Exact migration ID ${exactMigration0034Id} must exist in migration history`);
    log(`Item 4 PASS: Post-0034 migration history = 34 exactly with correct migration_id`);

    // 5. Migration 0035 absent in history
    const m35InDb = await testClient.query("SELECT 1 FROM public.elligble_migration_history WHERE migration_id LIKE '0035_%'");
    assertStrict(m35InDb.rowCount === 0, `Migration 0035 must be absent from database history`);
    log(`Item 5 PASS: Migration 0035 absent from database history`);

    // 6, 7, 8, 9. Exact two new columns exist, type boolean, nullable YES, default NULL
    const colInspection = await testClient.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'secure_assessment_exam_instances'
        AND column_name IN ('room_based_operations_enabled', 'proctor_per_room_required')
      ORDER BY column_name
    `);
    assertStrict(colInspection.rows.length === 2, `Expected exactly 2 new columns, found ${colInspection.rows.length}`);

    const roomCol = colInspection.rows.find(r => r.column_name === 'room_based_operations_enabled');
    const proctorCol = colInspection.rows.find(r => r.column_name === 'proctor_per_room_required');

    assertStrict(roomCol !== undefined, `Column room_based_operations_enabled must exist`);
    assertStrict(roomCol.data_type === 'boolean', `room_based_operations_enabled type must be boolean, got ${roomCol.data_type}`);
    assertStrict(roomCol.is_nullable === 'YES', `room_based_operations_enabled nullable must be YES, got ${roomCol.is_nullable}`);
    assertStrict(roomCol.column_default === null, `room_based_operations_enabled default must be null, got ${roomCol.column_default}`);

    assertStrict(proctorCol !== undefined, `Column proctor_per_room_required must exist`);
    assertStrict(proctorCol.data_type === 'boolean', `proctor_per_room_required type must be boolean, got ${proctorCol.data_type}`);
    assertStrict(proctorCol.is_nullable === 'YES', `proctor_per_room_required nullable must be YES, got ${proctorCol.is_nullable}`);
    assertStrict(proctorCol.column_default === null, `proctor_per_room_required default must be null, got ${proctorCol.column_default}`);

    log(`Items 6, 7, 8, 9 PASS: Exactly two new columns exist, type = boolean, is_nullable = YES, column_default = NULL`);

    // 10. Existing Exam Instance created before 0034 becomes NULL / NULL
    const postExamInstanceRow = (await testClient.query(`
      SELECT * FROM public.secure_assessment_exam_instances WHERE id = $1
    `, [examInstancePreA])).rows[0];

    assertStrict(postExamInstanceRow.room_based_operations_enabled === null, `Existing exam instance room_based_operations_enabled must be null`);
    assertStrict(postExamInstanceRow.proctor_per_room_required === null, `Existing exam instance proctor_per_room_required must be null`);

    // Verify existing fields were not corrupted
    for (const key of Object.keys(preExamInstanceRow)) {
      if (key !== 'room_based_operations_enabled' && key !== 'proctor_per_room_required') {
        assertStrict(
          String(preExamInstanceRow[key]) === String(postExamInstanceRow[key]),
          `Pre-existing field ${key} mutated during migration`
        );
      }
    }
    log(`Item 10 PASS: Existing Exam Instance created before 0034 has NULL / NULL and other fields intact`);

    // 11, 12, 13, 14: Valid Policy States Matrix
    // 11: NULL / NULL valid
    const examNullNull = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        room_based_operations_enabled, proctor_per_room_required
      ) VALUES ($1, $2, $3, 'SCHEDULED', NULL, NULL)
      RETURNING id, room_based_operations_enabled, proctor_per_room_required
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0];
    assertStrict(examNullNull.room_based_operations_enabled === null && examNullNull.proctor_per_room_required === null, 'NULL / NULL persisted');
    log(`Item 11 PASS: NULL / NULL state valid`);

    // 12: FALSE / FALSE valid
    const examFalseFalse = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        room_based_operations_enabled, proctor_per_room_required
      ) VALUES ($1, $2, $3, 'SCHEDULED', FALSE, FALSE)
      RETURNING id, room_based_operations_enabled, proctor_per_room_required
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0];
    assertStrict(examFalseFalse.room_based_operations_enabled === false && examFalseFalse.proctor_per_room_required === false, 'FALSE / FALSE persisted');
    log(`Item 12 PASS: FALSE / FALSE state valid`);

    // 13: TRUE / FALSE valid
    const examTrueFalse = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        room_based_operations_enabled, proctor_per_room_required
      ) VALUES ($1, $2, $3, 'SCHEDULED', TRUE, FALSE)
      RETURNING id, room_based_operations_enabled, proctor_per_room_required
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0];
    assertStrict(examTrueFalse.room_based_operations_enabled === true && examTrueFalse.proctor_per_room_required === false, 'TRUE / FALSE persisted');
    log(`Item 13 PASS: TRUE / FALSE state valid`);

    // 14: TRUE / TRUE valid
    const examTrueTrue = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        room_based_operations_enabled, proctor_per_room_required
      ) VALUES ($1, $2, $3, 'SCHEDULED', TRUE, TRUE)
      RETURNING id, room_based_operations_enabled, proctor_per_room_required
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0];
    assertStrict(examTrueTrue.room_based_operations_enabled === true && examTrueTrue.proctor_per_room_required === true, 'TRUE / TRUE persisted');
    log(`Item 14 PASS: TRUE / TRUE state valid`);

    // Also verify UPDATE transitions between valid states
    await testClient.query(`
      UPDATE public.secure_assessment_exam_instances
      SET room_based_operations_enabled = TRUE, proctor_per_room_required = TRUE
      WHERE id = $1
    `, [examFalseFalse.id]);
    const updatedRow = (await testClient.query(`SELECT room_based_operations_enabled, proctor_per_room_required FROM public.secure_assessment_exam_instances WHERE id = $1`, [examFalseFalse.id])).rows[0];
    assertStrict(updatedRow.room_based_operations_enabled === true && updatedRow.proctor_per_room_required === true, 'Valid update succeeded');

    // Helper for invalid state checks
    const assertCheckViolation = async (roomVal, proctorVal, description, isUpdate = false, updateId = null) => {
      try {
        if (isUpdate) {
          await testClient.query(`
            UPDATE public.secure_assessment_exam_instances
            SET room_based_operations_enabled = $1, proctor_per_room_required = $2
            WHERE id = $3
          `, [roomVal, proctorVal, updateId]);
        } else {
          await testClient.query(`
            INSERT INTO public.secure_assessment_exam_instances (
              tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
              room_based_operations_enabled, proctor_per_room_required
            ) VALUES ($1, $2, $3, 'SCHEDULED', $4, $5)
          `, [tenantA, teachingAssignmentA, assessmentTypeA, roomVal, proctorVal]);
        }
        throw new Error(`Expected check constraint violation for ${description}, but query succeeded`);
      } catch (e) {
        if (e.message.includes('Expected check constraint violation')) throw e;
        assertStrict(e.code === '23514', `Expected SQLSTATE 23514 for ${description}, got ${e.code}: ${e.message}`);
        assertStrict(
          e.constraint === 'ck_sa_exam_instances_room_proctor_requirement_policy',
          `Expected constraint ck_sa_exam_instances_room_proctor_requirement_policy, got ${e.constraint}`
        );
      }
    };

    // 15: FALSE / TRUE rejected 23514
    await assertCheckViolation(false, true, 'INSERT FALSE / TRUE');
    await assertCheckViolation(false, true, 'UPDATE FALSE / TRUE', true, examTrueTrue.id);
    log(`Item 15 PASS: FALSE / TRUE rejected with exact check-constraint SQLSTATE 23514`);

    // 16: NULL / FALSE rejected 23514
    await assertCheckViolation(null, false, 'INSERT NULL / FALSE');
    await assertCheckViolation(null, false, 'UPDATE NULL / FALSE', true, examTrueTrue.id);
    log(`Item 16 PASS: NULL / FALSE rejected with exact check-constraint SQLSTATE 23514`);

    // 17: NULL / TRUE rejected 23514
    await assertCheckViolation(null, true, 'INSERT NULL / TRUE');
    await assertCheckViolation(null, true, 'UPDATE NULL / TRUE', true, examTrueTrue.id);
    log(`Item 17 PASS: NULL / TRUE rejected with exact check-constraint SQLSTATE 23514`);

    // 18: FALSE / NULL rejected 23514
    await assertCheckViolation(false, null, 'INSERT FALSE / NULL');
    await assertCheckViolation(false, null, 'UPDATE FALSE / NULL', true, examTrueTrue.id);
    log(`Item 18 PASS: FALSE / NULL rejected with exact check-constraint SQLSTATE 23514`);

    // 19: TRUE / NULL rejected 23514
    await assertCheckViolation(true, null, 'INSERT TRUE / NULL');
    await assertCheckViolation(true, null, 'UPDATE TRUE / NULL', true, examTrueTrue.id);
    log(`Item 19 PASS: TRUE / NULL rejected with exact check-constraint SQLSTATE 23514`);

    // 20. Repeated migration remains safe and history stays exactly 34
    await testClient.query(migration0034Sql);
    const repeatHistoryRes = await testClient.query('SELECT COUNT(*) as count FROM public.elligble_migration_history');
    const repeatHistoryCount = parseInt(repeatHistoryRes.rows[0].count, 10);
    assertStrict(repeatHistoryCount === 34, `Repeat migration history count must remain 34, got ${repeatHistoryCount}`);
    log(`Item 20 PASS: Repeated migration remains safe and history stays exactly 34`);

    // 21. No unexpected schema objects
    const postTables = (await testClient.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)).rows.map(r => r.table_name);
    assertStrict(JSON.stringify(preTables) === JSON.stringify(postTables), `No new or removed tables in public schema`);

    const postColsExamInstances = (await testClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_instances'
      ORDER BY column_name
    `)).rows.map(r => r.column_name);
    const addedCols = postColsExamInstances.filter(c => !preColsExamInstances.includes(c));
    assertStrict(
      addedCols.length === 2 && addedCols.includes('room_based_operations_enabled') && addedCols.includes('proctor_per_room_required'),
      `Only the exact two intended columns added to secure_assessment_exam_instances, got: ${JSON.stringify(addedCols)}`
    );
    log(`Item 21 PASS: No unexpected schema objects (no new tables, exactly 2 new columns)`);

    // 22. Protected Secure Assessment data unaffected except intended new nullable columns and migration history row
    // 23. Academic Core schema/data unchanged
    const post0034AcademicSchema = await getAcademicCoreSchema(testClient);
    assertStrict(pre0034AcademicSchema === post0034AcademicSchema, `Academic Core schema mutated during BU-076 migration`);
    const post0034AcademicData = await getAcademicCoreData(testClient);
    assertStrict(pre0034AcademicData === post0034AcademicData, `Academic Core data mutated during BU-076 migration`);
    log(`Item 23 PASS: Academic Core schema and data unchanged`);

    // 24. Zero mutation to Room, Participant Room Assignment, Proctor Assignment, Proctor Room Assignment, Attempt, Session
    const postRooms = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_rooms ORDER BY id`)).rows;
    assertStrict(JSON.stringify(preRooms) === JSON.stringify(postRooms), `Rooms mutated during BU-076 migration`);

    const postPartRooms = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_participant_room_assignments ORDER BY id`)).rows;
    assertStrict(JSON.stringify(prePartRooms) === JSON.stringify(postPartRooms), `Participant Room Assignments mutated during BU-076 migration`);

    const postProctors = (await testClient.query(`SELECT * FROM public.secure_assessment_proctor_assignments ORDER BY id`)).rows;
    assertStrict(JSON.stringify(preProctors) === JSON.stringify(postProctors), `Proctor Assignments mutated during BU-076 migration`);

    const postProctorRooms = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_proctor_room_assignments ORDER BY id`)).rows;
    assertStrict(JSON.stringify(preProctorRooms) === JSON.stringify(postProctorRooms), `Proctor Room Assignments mutated during BU-076 migration`);

    const postAttempts = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_attempts ORDER BY id`)).rows;
    assertStrict(JSON.stringify(preAttempts) === JSON.stringify(postAttempts), `Attempts mutated during BU-076 migration`);

    const postSessions = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_sessions ORDER BY id`)).rows;
    assertStrict(JSON.stringify(preSessions) === JSON.stringify(postSessions), `Sessions mutated during BU-076 migration`);

    const postParticipants = (await testClient.query(`SELECT * FROM public.secure_assessment_exam_participants ORDER BY id`)).rows;
    assertStrict(JSON.stringify(preParticipants) === JSON.stringify(postParticipants), `Participants mutated during BU-076 migration`);

    log(`Item 22, 24 PASS: Protected Secure Assessment data unaffected; zero mutation to Room, Participant Room Assignment, Proctor Assignment, Proctor Room Assignment, Attempt, Session`);

    // SCENARIO 2: Fail-closed on incompatible pre-existing column
    {
      const { testClient: clientIncompatCol, dbName: dbIncompatCol } = await createDisposableDb('incompat_col');
      for (let i = 1; i <= 33; i++) {
        const prefix = i.toString().padStart(4, '0');
        const matchingFile = allMigrationFiles.find(f => f.startsWith(`${prefix}_`));
        const filePath = path.join(migrationsDir, matchingFile);
        await clientIncompatCol.query(fs.readFileSync(filePath, 'utf8'));
      }
      // Pre-add incompatible text column
      await clientIncompatCol.query(`ALTER TABLE public.secure_assessment_exam_instances ADD COLUMN room_based_operations_enabled TEXT NULL`);
      try {
        await clientIncompatCol.query(migration0034Sql);
        throw new Error('Migration 0034 should have failed closed on incompatible column');
      } catch (e) {
        if (e.message.includes('should have failed closed')) throw e;
        assertStrict(e.message.includes('MIGRATION REJECTED: Column room_based_operations_enabled exists with incompatible contract'), `Expected incompatible column rejection message, got: ${e.message}`);
        log(`Fail-closed PASS: Incompatible column rejected`);
      }
    }

    // SCENARIO 3: Fail-closed on incompatible pre-existing constraint
    {
      const { testClient: clientIncompatCon, dbName: dbIncompatCon } = await createDisposableDb('incompat_con');
      for (let i = 1; i <= 33; i++) {
        const prefix = i.toString().padStart(4, '0');
        const matchingFile = allMigrationFiles.find(f => f.startsWith(`${prefix}_`));
        const filePath = path.join(migrationsDir, matchingFile);
        await clientIncompatCon.query(fs.readFileSync(filePath, 'utf8'));
      }
      // Pre-add columns and incompatible constraint
      await clientIncompatCon.query(`
        ALTER TABLE public.secure_assessment_exam_instances
        ADD COLUMN room_based_operations_enabled BOOLEAN NULL,
        ADD COLUMN proctor_per_room_required BOOLEAN NULL,
        ADD CONSTRAINT ck_sa_exam_instances_room_proctor_requirement_policy CHECK (room_based_operations_enabled = TRUE)
      `);
      try {
        await clientIncompatCon.query(migration0034Sql);
        throw new Error('Migration 0034 should have failed closed on incompatible constraint');
      } catch (e) {
        if (e.message.includes('should have failed closed')) throw e;
        assertStrict(e.message.includes('MIGRATION REJECTED: Constraint ck_sa_exam_instances_room_proctor_requirement_policy exists with incompatible target, type, or semantics'), `Expected incompatible constraint rejection message, got: ${e.message}`);
        log(`Fail-closed PASS: Incompatible constraint rejected`);
      }
    }

    // 25. Disposable database cleanup
    for (const c of openClients) {
      try { await c.end(); } catch {}
    }
    openClients.length = 0;

    for (const d of createdDatabases) {
      await rootClient.query(`DROP DATABASE IF EXISTS "${d}"`);
      const checkRes = await rootClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [d]);
      assertStrict(checkRes.rowCount === 0, `Database ${d} still exists after drop`);
    }

    log(`Item 25, 26 PASS: Cleanup fail-closed; post-cleanup proves disposable databases absent`);

    // Post-run zero-leak check
    const postLeakCheck = await rootClient.query(
      `SELECT count(*) as count FROM pg_database WHERE datname LIKE 'elligble_bu076_%'`
    );
    const postLeakCount = parseInt(postLeakCheck.rows[0].count, 10);
    assertStrict(postLeakCount === 0, `Post-run leak count must be 0, found ${postLeakCount}`);
    log(`Post-run zero-leak proven: elligble_bu076_* count = 0`);

    console.log('\n==================================================');
    console.log('REAL POSTGRESQL VERIFICATION: PASS');
    console.log('DISPOSABLE DATABASE CLEANUP: PASS');
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
