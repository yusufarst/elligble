const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const pgPassword = process.env.PGPASSWORD;

function clientConfig(connectionString) {
  return pgPassword
    ? { connectionString, password: pgPassword }
    : { connectionString };
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

async function getTableConstraints(client, tableName) {
  const query = `
    SELECT c.conname, c.contype, c.confdeltype,
           f.relname as confrelname,
           (SELECT array_agg(attname::text ORDER BY array_position(c.conkey, attnum))
            FROM pg_attribute WHERE attrelid = t.oid AND attnum = ANY(c.conkey)) as cols,
           (SELECT array_agg(attname::text ORDER BY array_position(c.confkey, attnum))
            FROM pg_attribute WHERE attrelid = f.oid AND attnum = ANY(c.confkey)) as fcols
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    LEFT JOIN pg_class f ON c.confrelid = f.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = $1 AND n.nspname = 'public'
    ORDER BY c.conname
  `;
  const res = await client.query(query, [tableName]);
  return res.rows;
}

async function runVerification() {
  let dbName = '';
  let rootClient = null;
  let testClient = null;

  try {
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu072_${runId}`;

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

    const migrationsDir = path.resolve(__dirname, '../migrations');

    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    // 1 & 2. require exactly one migration for each prefix 0001..0031
    for (let i = 1; i <= 31; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFiles = allMigrationFiles.filter(f => f.startsWith(`${prefix}_`));
      if (matchingFiles.length !== 1) {
        throw new Error(`Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`);
      }
    }

    // 3. apply canonical migrations 0001..0031 first
    for (let i = 1; i <= 31; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFile = allMigrationFiles.find(f => f.startsWith(`${prefix}_`));
      const filePath = path.join(migrationsDir, matchingFile);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    // 4. prove migration history exactly 31
    let migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 31) {
      throw new Error(`Expected exactly 31 migrations applied, got ${migrationHistory.rows[0].count}`);
    }

    // Baseline fixtures setup BEFORE 0032
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
    const assessmentTypeA = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE A') RETURNING id`, [tenantA])).rows[0].id;

    const examInstanceA1 = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0].id;

    const examInstanceA2 = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingAssignmentA, assessmentTypeA])).rows[0].id;

    const studentPersonSeedA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantSeedA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstanceA1, studentPersonSeedA])).rows[0].id;

    const roomSeedA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label)
      VALUES ($1, $2, 'Room Pre-0032 A') RETURNING id
    `, [tenantA, examInstanceA1])).rows[0].id;

    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherPersonB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const teacherMemberB = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantB, teacherPersonB])).rows[0].id;
    const teacherAssignmentB = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantB, teacherMemberB])).rows[0].id;

    const academicYearB = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantB])).rows[0].id;
    const academicPeriodB = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Sem1', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantB, academicYearB])).rows[0].id;
    const subjectB = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Physics B') RETURNING id`, [tenantB])).rows[0].id;
    const gradeLevelB = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Grade 10') RETURNING id`, [tenantB])).rows[0].id;
    const academicGroupB = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, '10-B') RETURNING id`, [tenantB, academicYearB, gradeLevelB])).rows[0].id;
    const subjectOfferingB = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, subjectB, academicPeriodB, gradeLevelB])).rows[0].id;
    const teachingAssignmentB = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantB, teacherAssignmentB, subjectOfferingB, academicGroupB])).rows[0].id;
    const assessmentTypeB = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMMATIVE B') RETURNING id`, [tenantB])).rows[0].id;

    const examInstanceB1 = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'SCHEDULED', '2026-10-01 08:00:00Z', '2026-10-01 10:00:00Z', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantB, teachingAssignmentB, assessmentTypeB])).rows[0].id;

    const studentPersonSeedB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantSeedB = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantB, examInstanceB1, studentPersonSeedB])).rows[0].id;

    const roomSeedB = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label)
      VALUES ($1, $2, 'Room Pre-0032 B') RETURNING id
    `, [tenantB, examInstanceB1])).rows[0].id;

    // 5. capture protected data/schema state BEFORE 0032
    const pre0032CoreSchema = await getAcademicCoreSchema(testClient);
    const pre0032CoreData = await getAcademicCoreData(testClient);
    const pre0032Participants = await testClient.query(`SELECT * FROM public.secure_assessment_exam_participants ORDER BY id`);
    const pre0032Rooms = await testClient.query(`SELECT * FROM public.secure_assessment_exam_rooms ORDER BY id`);
    const pre0032Proctors = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_proctor_assignments`)).rows[0].count, 10);
    const pre0032Attempts = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    const pre0032Sessions = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);

    // 6. discover exactly one 0032 migration
    const matchingFiles32 = allMigrationFiles.filter(f => f.startsWith('0032_'));
    if (matchingFiles32.length !== 1) {
      throw new Error(`Expected exactly one migration for prefix 0032, found ${matchingFiles32.length}`);
    }

    // 7. apply 0032
    const sql32 = fs.readFileSync(path.join(migrationsDir, matchingFiles32[0]), 'utf8');
    await testClient.query(sql32);

    // 8. prove migration history exactly 32
    migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 32) {
      throw new Error(`Expected exactly 32 migrations applied, got ${migrationHistory.rows[0].count}`);
    }

    // 9. invoke 0032 again and prove repeat safety / history remains 32
    await testClient.query(sql32);
    migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 32) {
      throw new Error(`Expected exactly 32 migrations applied after repeat invocation, got ${migrationHistory.rows[0].count}`);
    }

    // 27. prove Academic Core schema/data are not mutated by 0032
    const post0032CoreSchema = await getAcademicCoreSchema(testClient);
    const post0032CoreData = await getAcademicCoreData(testClient);
    if (pre0032CoreSchema !== post0032CoreSchema) throw new Error('Academic Core schema mutated by 0032 migration');
    if (pre0032CoreData !== post0032CoreData) throw new Error('Academic Core data mutated by 0032 migration');

    // 28. prove existing Exam Participant data are unchanged by migration 0032
    const post0032Participants = await testClient.query(`SELECT * FROM public.secure_assessment_exam_participants ORDER BY id`);
    if (JSON.stringify(pre0032Participants.rows) !== JSON.stringify(post0032Participants.rows)) {
      throw new Error('Existing Exam Participant data mutated by 0032 migration');
    }

    // 29. prove existing Exam Room data are unchanged by migration 0032
    const post0032Rooms = await testClient.query(`SELECT * FROM public.secure_assessment_exam_rooms ORDER BY id`);
    if (JSON.stringify(pre0032Rooms.rows) !== JSON.stringify(post0032Rooms.rows)) {
      throw new Error('Existing Exam Room data mutated by 0032 migration');
    }

    // 30. prove no mutation of proctors, attempts, sessions
    const post0032Proctors = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_proctor_assignments`)).rows[0].count, 10);
    const post0032Attempts = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    const post0032Sessions = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);
    if (pre0032Proctors !== post0032Proctors) throw new Error('Proctors mutated by 0032');
    if (pre0032Attempts !== post0032Attempts) throw new Error('Attempts mutated by 0032');
    if (pre0032Sessions !== post0032Sessions) throw new Error('Sessions mutated by 0032');

    // 10. physically verify the exact six assignment-table columns: names, types, nullability, defaults
    const cols = await testClient.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_participant_room_assignments'
      ORDER BY ordinal_position
    `);
    const expectedCols = {
      id: { type: 'uuid', is_nullable: 'NO', default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', is_nullable: 'NO', default: null },
      exam_instance_id: { type: 'uuid', is_nullable: 'NO', default: null },
      exam_participant_id: { type: 'uuid', is_nullable: 'NO', default: null },
      exam_room_id: { type: 'uuid', is_nullable: 'NO', default: null },
      assigned_at: { type: 'timestamp with time zone', is_nullable: 'NO', default: 'CURRENT_TIMESTAMP' }
    };
    if (cols.rows.length !== 6) {
      throw new Error(`Expected exactly 6 columns, found ${cols.rows.length}`);
    }
    for (const col of cols.rows) {
      const exp = expectedCols[col.column_name];
      if (!exp) throw new Error(`Unexpected column ${col.column_name}`);
      if (col.data_type !== exp.type) throw new Error(`Column ${col.column_name} type mismatch: expected ${exp.type}, got ${col.data_type}`);
      if (col.is_nullable !== exp.is_nullable) throw new Error(`Column ${col.column_name} is_nullable mismatch: expected ${exp.is_nullable}, got ${col.is_nullable}`);
      if (exp.default && !col.column_default?.includes(exp.default)) throw new Error(`Column ${col.column_name} default mismatch`);
      if (exp.default === null && col.column_default !== null) throw new Error(`Column ${col.column_name} default should be null`);
    }

    // 11. physically verify both new reference-key UNIQUE constraints
    const partConstraints = await getTableConstraints(testClient, 'secure_assessment_exam_participants');
    const uqPart = partConstraints.find(c => c.conname === 'uq_sa_exam_participant_id_tenant_instance');
    if (!uqPart) throw new Error('Missing constraint uq_sa_exam_participant_id_tenant_instance');
    if (uqPart.contype !== 'u') throw new Error(`uq_sa_exam_participant_id_tenant_instance type expected 'u', got ${uqPart.contype}`);
    if (JSON.stringify(uqPart.cols) !== JSON.stringify(['id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`uq_sa_exam_participant_id_tenant_instance cols mismatch: got ${JSON.stringify(uqPart.cols)}`);
    }

    const roomConstraints = await getTableConstraints(testClient, 'secure_assessment_exam_rooms');
    const uqRoom = roomConstraints.find(c => c.conname === 'uq_sa_exam_room_id_tenant_instance');
    if (!uqRoom) throw new Error('Missing constraint uq_sa_exam_room_id_tenant_instance');
    if (uqRoom.contype !== 'u') throw new Error(`uq_sa_exam_room_id_tenant_instance type expected 'u', got ${uqRoom.contype}`);
    if (JSON.stringify(uqRoom.cols) !== JSON.stringify(['id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`uq_sa_exam_room_id_tenant_instance cols mismatch: got ${JSON.stringify(uqRoom.cols)}`);
    }

    // 12. physically verify both composite FKs and ON DELETE RESTRICT
    const assignConstraints = await getTableConstraints(testClient, 'secure_assessment_exam_participant_room_assignments');

    const uqAssignTenant = assignConstraints.find(c => c.conname === 'uq_sa_exam_participant_room_assignment_tenant');
    if (!uqAssignTenant || uqAssignTenant.contype !== 'u' || JSON.stringify(uqAssignTenant.cols) !== JSON.stringify(['id', 'tenant_id'])) {
      throw new Error('Missing or invalid uq_sa_exam_participant_room_assignment_tenant');
    }

    const uqAssignPart = assignConstraints.find(c => c.conname === 'uq_sa_exam_participant_room_assignment_participant');
    if (!uqAssignPart || uqAssignPart.contype !== 'u' || JSON.stringify(uqAssignPart.cols) !== JSON.stringify(['tenant_id', 'exam_instance_id', 'exam_participant_id'])) {
      throw new Error('Missing or invalid uq_sa_exam_participant_room_assignment_participant');
    }

    const fkPart = assignConstraints.find(c => c.conname === 'fk_sa_exam_participant_room_assignment_participant');
    if (!fkPart) throw new Error('Missing constraint fk_sa_exam_participant_room_assignment_participant');
    if (fkPart.contype !== 'f') throw new Error(`fk_sa_exam_participant_room_assignment_participant contype expected 'f', got ${fkPart.contype}`);
    if (fkPart.confdeltype !== 'r') throw new Error(`fk_sa_exam_participant_room_assignment_participant confdeltype expected 'r', got ${fkPart.confdeltype}`);
    if (fkPart.confrelname !== 'secure_assessment_exam_participants') throw new Error(`fk_sa_exam_participant_room_assignment_participant referenced table expected 'secure_assessment_exam_participants', got ${fkPart.confrelname}`);
    if (JSON.stringify(fkPart.cols) !== JSON.stringify(['exam_participant_id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`fk_sa_exam_participant_room_assignment_participant cols mismatch: got ${JSON.stringify(fkPart.cols)}`);
    }
    if (JSON.stringify(fkPart.fcols) !== JSON.stringify(['id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`fk_sa_exam_participant_room_assignment_participant fcols mismatch: got ${JSON.stringify(fkPart.fcols)}`);
    }

    const fkRoom = assignConstraints.find(c => c.conname === 'fk_sa_exam_participant_room_assignment_room');
    if (!fkRoom) throw new Error('Missing constraint fk_sa_exam_participant_room_assignment_room');
    if (fkRoom.contype !== 'f') throw new Error(`fk_sa_exam_participant_room_assignment_room contype expected 'f', got ${fkRoom.contype}`);
    if (fkRoom.confdeltype !== 'r') throw new Error(`fk_sa_exam_participant_room_assignment_room confdeltype expected 'r', got ${fkRoom.confdeltype}`);
    if (fkRoom.confrelname !== 'secure_assessment_exam_rooms') throw new Error(`fk_sa_exam_participant_room_assignment_room referenced table expected 'secure_assessment_exam_rooms', got ${fkRoom.confrelname}`);
    if (JSON.stringify(fkRoom.cols) !== JSON.stringify(['exam_room_id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`fk_sa_exam_participant_room_assignment_room cols mismatch: got ${JSON.stringify(fkRoom.cols)}`);
    }
    if (JSON.stringify(fkRoom.fcols) !== JSON.stringify(['id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`fk_sa_exam_participant_room_assignment_room fcols mismatch: got ${JSON.stringify(fkRoom.fcols)}`);
    }

    // Operational test fixtures setup
    const studentPersonA1_1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantA1_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA1, studentPersonA1_1])).rows[0].id;

    const studentPersonA1_2 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantA1_2 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA1, studentPersonA1_2])).rows[0].id;

    const studentPersonA1_3 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantA1_3 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA1, studentPersonA1_3])).rows[0].id;

    const studentPersonA1_4 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantA1_4 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA1, studentPersonA1_4])).rows[0].id;

    const roomA1_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room 1') RETURNING id`, [tenantA, examInstanceA1])).rows[0].id;
    const roomA1_2 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room 2') RETURNING id`, [tenantA, examInstanceA1])).rows[0].id;

    const studentPersonA2_1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantA2_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA2, studentPersonA2_1])).rows[0].id;
    const roomA2_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room A2') RETURNING id`, [tenantA, examInstanceA2])).rows[0].id;

    const studentPersonB1_1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantB1_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantB, examInstanceB1, studentPersonB1_1])).rows[0].id;
    const roomB1_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room B1') RETURNING id`, [tenantB, examInstanceB1])).rows[0].id;

    // Prove participant with no room assignment is allowed: participantA1_4 currently has 0 room assignments
    const unassignedCount = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_participant_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2 AND exam_participant_id = $3
    `, [tenantA, examInstanceA1, participantA1_4])).rows[0].count, 10);
    if (unassignedCount !== 0) throw new Error(`Expected 0 assignments for participantA1_4, got ${unassignedCount}`);

    // 13. prove valid same-tenant + same-exam assignment succeeds
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceA1, participantA1_1, roomA1_1]);

    // 14. prove multiple participants may share one room
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceA1, participantA1_2, roomA1_1]);

    const room1Participants = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_participant_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2 AND exam_room_id = $3
    `, [tenantA, examInstanceA1, roomA1_1])).rows[0].count, 10);
    if (room1Participants !== 2) throw new Error(`Expected 2 participants in roomA1_1, got ${room1Participants}`);

    // 15. prove another room in the same Exam Instance is independently usable
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceA1, participantA1_3, roomA1_2]);

    const room2Participants = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_participant_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2 AND exam_room_id = $3
    `, [tenantA, examInstanceA1, roomA1_2])).rows[0].count, 10);
    if (room2Participants !== 1) throw new Error(`Expected 1 participant in roomA1_2, got ${room2Participants}`);

    const examA1Total = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_participant_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2
    `, [tenantA, examInstanceA1])).rows[0].count, 10);
    if (examA1Total !== 3) throw new Error(`Expected 3 assignments in examInstanceA1, got ${examA1Total}`);

    // 16. prove another Exam Instance is isolated
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceA2, participantA2_1, roomA2_1]);

    const examA2Total = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_participant_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2
    `, [tenantA, examInstanceA2])).rows[0].count, 10);
    if (examA2Total !== 1) throw new Error(`Expected 1 assignment in examInstanceA2, got ${examA2Total}`);

    // Verify examA1 total remains 3
    const examA1TotalAfter = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_participant_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2
    `, [tenantA, examInstanceA1])).rows[0].count, 10);
    if (examA1TotalAfter !== 3) throw new Error(`Expected 3 assignments in examInstanceA1 after A2 insertion, got ${examA1TotalAfter}`);

    // 17. prove another tenant is isolated
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantB, examInstanceB1, participantB1_1, roomB1_1]);

    const examB1Total = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_participant_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2
    `, [tenantB, examInstanceB1])).rows[0].count, 10);
    if (examB1Total !== 1) throw new Error(`Expected 1 assignment in examInstanceB1, got ${examB1Total}`);

    // 18. prove cross-tenant Participant reference fails (SQLSTATE 23503)
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantB, examInstanceB1, participantA1_4, roomB1_1]);
      throw new Error('Cross-tenant Participant reference unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for cross-tenant participant, got ${e.code}: ${e.message}`);
    }

    // 19. prove cross-tenant Room reference fails (SQLSTATE 23503)
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantA, examInstanceA1, participantA1_4, roomB1_1]);
      throw new Error('Cross-tenant Room reference unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for cross-tenant room, got ${e.code}: ${e.message}`);
    }

    // 20. prove Participant Exam A + Room Exam B mismatch fails (SQLSTATE 23503)
    // Case A: Assignment row declares exam_instance_id = examInstanceA1, but room belongs to examInstanceA2
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantA, examInstanceA1, participantA1_4, roomA2_1]);
      throw new Error('Participant Exam A1 + Room Exam A2 mismatch (row=A1) unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for cross-exam room mismatch, got ${e.code}: ${e.message}`);
    }

    // Case B: Assignment row declares exam_instance_id = examInstanceA2, but participant belongs to examInstanceA1
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantA, examInstanceA2, participantA1_4, roomA2_1]);
      throw new Error('Participant Exam A1 + Room Exam A2 mismatch (row=A2) unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for cross-exam participant mismatch, got ${e.code}: ${e.message}`);
    }

    // 21. prove nonexistent Participant fails (SQLSTATE 23503)
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
        VALUES ($1, $2, gen_random_uuid(), $3)
      `, [tenantA, examInstanceA1, roomA1_1]);
      throw new Error('Nonexistent Participant unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for nonexistent participant, got ${e.code}: ${e.message}`);
    }

    // 22. prove nonexistent Room fails (SQLSTATE 23503)
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
        VALUES ($1, $2, $3, gen_random_uuid())
      `, [tenantA, examInstanceA1, participantA1_4]);
      throw new Error('Nonexistent Room unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for nonexistent room, got ${e.code}: ${e.message}`);
    }

    // 23. prove duplicate participant assignment fails (SQLSTATE 23505)
    // participantA1_1 is already assigned to roomA1_1. Attempt to assign to roomA1_2:
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantA, examInstanceA1, participantA1_1, roomA1_2]);
      throw new Error('Duplicate participant assignment unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23505') throw new Error(`Expected UNIQUE violation 23505 for duplicate participant assignment, got ${e.code}: ${e.message}`);
      if (e.constraint !== 'uq_sa_exam_participant_room_assignment_participant') {
        throw new Error(`Expected constraint uq_sa_exam_participant_room_assignment_participant, got ${e.constraint}`);
      }
    }

    // 24. prove required NULL cases fail (SQLSTATE 23502)
    const nullCases = [
      { t: null, e: examInstanceA1, p: participantA1_4, r: roomA1_1, name: 'tenant_id' },
      { t: tenantA, e: null, p: participantA1_4, r: roomA1_1, name: 'exam_instance_id' },
      { t: tenantA, e: examInstanceA1, p: null, r: roomA1_1, name: 'exam_participant_id' },
      { t: tenantA, e: examInstanceA1, p: participantA1_4, r: null, name: 'exam_room_id' }
    ];
    for (const c of nullCases) {
      try {
        await testClient.query(`
          INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
          VALUES ($1, $2, $3, $4)
        `, [c.t, c.e, c.p, c.r]);
        throw new Error(`Null ${c.name} constraint failed to trigger`);
      } catch (e) {
        if (e.message.includes('constraint failed to trigger')) throw e;
        if (e.code !== '23502') throw new Error(`Expected NOT NULL violation 23502 for ${c.name}, got ${e.code}: ${e.message}`);
      }
    }

    // 25. prove referenced Participant delete is RESTRICTed (SQLSTATE 23001)
    try {
      await testClient.query(`DELETE FROM public.secure_assessment_exam_participants WHERE id = $1`, [participantA1_1]);
      throw new Error('Referenced Participant delete restriction failed to trigger');
    } catch (e) {
      if (e.message.includes('failed to trigger')) throw e;
      if (e.code !== '23001') throw new Error(`Expected RESTRICT violation 23001 for participant delete, got ${e.code}: ${e.message}`);
    }

    // 26. prove referenced Room delete is RESTRICTed (SQLSTATE 23001)
    try {
      await testClient.query(`DELETE FROM public.secure_assessment_exam_rooms WHERE id = $1`, [roomA1_1]);
      throw new Error('Referenced Room delete restriction failed to trigger');
    } catch (e) {
      if (e.message.includes('failed to trigger')) throw e;
      if (e.code !== '23001') throw new Error(`Expected RESTRICT violation 23001 for room delete, got ${e.code}: ${e.message}`);
    }

    // Post-operations non-mutation assertions
    // Academic Core data unchanged
    const finalCoreData = await getAcademicCoreData(testClient);
    if (pre0032CoreData !== finalCoreData) {
      throw new Error('Academic Core data mutated during room assignment operations');
    }

    // Proctors, attempts, sessions unchanged
    const finalProctors = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_proctor_assignments`)).rows[0].count, 10);
    const finalAttempts = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    const finalSessions = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);
    if (pre0032Proctors !== finalProctors) throw new Error('Proctors mutated during room assignment operations');
    if (pre0032Attempts !== finalAttempts) throw new Error('Attempts mutated during room assignment operations');
    if (pre0032Sessions !== finalSessions) throw new Error('Sessions mutated during room assignment operations');

    // 31. prove migration 0033 does not exist
    const m33 = allMigrationFiles.filter(f => f.startsWith('0033_'));
    if (m33.length > 0) throw new Error('Migration 0033 exists');

    // 32. fail-closed disposable database cleanup
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
