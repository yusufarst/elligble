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
    dbName = `elligble_bu073_${runId}`;

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

    // 1 & 2. require exactly one migration for every prefix 0001..0032
    for (let i = 1; i <= 32; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFiles = allMigrationFiles.filter(f => f.startsWith(`${prefix}_`));
      if (matchingFiles.length !== 1) {
        throw new Error(`Expected exactly one migration for prefix ${prefix}, found ${matchingFiles.length}`);
      }
    }

    // 3. apply canonical migrations 0001..0032 first
    for (let i = 1; i <= 32; i++) {
      const prefix = i.toString().padStart(4, '0');
      const matchingFile = allMigrationFiles.find(f => f.startsWith(`${prefix}_`));
      const filePath = path.join(migrationsDir, matchingFile);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    // 4. prove migration history exactly 32
    let migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 32) {
      throw new Error(`Expected exactly 32 migrations applied, got ${migrationHistory.rows[0].count}`);
    }

    // 5. create deterministic baseline fixtures before 0033
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

    const proctorPersonSeedA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorAssignmentSeedA = (await testClient.query(`
      INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstanceA1, proctorPersonSeedA])).rows[0].id;

    const studentPersonSeedA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantSeedA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantA, examInstanceA1, studentPersonSeedA])).rows[0].id;

    const roomSeedA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label)
      VALUES ($1, $2, 'Room Pre-0033 A') RETURNING id
    `, [tenantA, examInstanceA1])).rows[0].id;

    const participantRoomAssignmentSeedA = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [tenantA, examInstanceA1, participantSeedA, roomSeedA])).rows[0].id;

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

    const proctorPersonSeedB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorAssignmentSeedB = (await testClient.query(`
      INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantB, examInstanceB1, proctorPersonSeedB])).rows[0].id;

    const studentPersonSeedB = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const participantSeedB = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id)
      VALUES ($1, $2, $3) RETURNING id
    `, [tenantB, examInstanceB1, studentPersonSeedB])).rows[0].id;

    const roomSeedB = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label)
      VALUES ($1, $2, 'Room Pre-0033 B') RETURNING id
    `, [tenantB, examInstanceB1])).rows[0].id;

    const participantRoomAssignmentSeedB = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [tenantB, examInstanceB1, participantSeedB, roomSeedB])).rows[0].id;

    // 6. snapshot protected state before 0033
    const pre0033CoreSchema = await getAcademicCoreSchema(testClient);
    const pre0033CoreData = await getAcademicCoreData(testClient);
    const pre0033ProctorAssignments = await testClient.query(`SELECT * FROM public.secure_assessment_proctor_assignments ORDER BY id`);
    const pre0033Rooms = await testClient.query(`SELECT * FROM public.secure_assessment_exam_rooms ORDER BY id`);
    const pre0033PartRoomAssignments = await testClient.query(`SELECT * FROM public.secure_assessment_exam_participant_room_assignments ORDER BY id`);
    const pre0033Participants = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_participants`)).rows[0].count, 10);
    const pre0033Attempts = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    const pre0033Sessions = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);

    // 7. discover exactly one migration 0033
    const matchingFiles33 = allMigrationFiles.filter(f => f.startsWith('0033_'));
    if (matchingFiles33.length !== 1) {
      throw new Error(`Expected exactly one migration for prefix 0033, found ${matchingFiles33.length}`);
    }

    // 8. apply migration 0033
    const sql33 = fs.readFileSync(path.join(migrationsDir, matchingFiles33[0]), 'utf8');
    await testClient.query(sql33);

    // 9. prove migration history exactly 33
    migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 33) {
      throw new Error(`Expected exactly 33 migrations applied, got ${migrationHistory.rows[0].count}`);
    }

    // 10. invoke 0033 again and prove repeat safety / history remains 33
    await testClient.query(sql33);
    migrationHistory = await testClient.query('SELECT COUNT(migration_id) as count FROM public.elligble_migration_history');
    if (parseInt(migrationHistory.rows[0].count, 10) !== 33) {
      throw new Error(`Expected exactly 33 migrations applied after repeat invocation, got ${migrationHistory.rows[0].count}`);
    }

    // 33. prove Academic Core schema/data are not mutated by migration 0033
    const post0033CoreSchema = await getAcademicCoreSchema(testClient);
    const post0033CoreData = await getAcademicCoreData(testClient);
    if (pre0033CoreSchema !== post0033CoreSchema) throw new Error('Academic Core schema mutated by 0033 migration');
    if (pre0033CoreData !== post0033CoreData) throw new Error('Academic Core data mutated by 0033 migration');

    // 34. prove existing secure_assessment_proctor_assignments row data are unchanged by migration 0033
    const post0033ProctorAssignments = await testClient.query(`SELECT * FROM public.secure_assessment_proctor_assignments ORDER BY id`);
    if (JSON.stringify(pre0033ProctorAssignments.rows) !== JSON.stringify(post0033ProctorAssignments.rows)) {
      throw new Error('Existing secure_assessment_proctor_assignments data mutated by 0033 migration');
    }

    // 35. prove existing secure_assessment_exam_rooms row data are unchanged by migration 0033
    const post0033Rooms = await testClient.query(`SELECT * FROM public.secure_assessment_exam_rooms ORDER BY id`);
    if (JSON.stringify(pre0033Rooms.rows) !== JSON.stringify(post0033Rooms.rows)) {
      throw new Error('Existing secure_assessment_exam_rooms data mutated by 0033 migration');
    }

    // 36. prove existing secure_assessment_exam_participant_room_assignments data are unchanged by migration 0033
    const post0033PartRoomAssignments = await testClient.query(`SELECT * FROM public.secure_assessment_exam_participant_room_assignments ORDER BY id`);
    if (JSON.stringify(pre0033PartRoomAssignments.rows) !== JSON.stringify(post0033PartRoomAssignments.rows)) {
      throw new Error('Existing secure_assessment_exam_participant_room_assignments data mutated by 0033 migration');
    }

    // 37. prove no mutation of participants, attempts, sessions
    const post0033Participants = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_participants`)).rows[0].count, 10);
    const post0033Attempts = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    const post0033Sessions = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);
    if (pre0033Participants !== post0033Participants) throw new Error('Participants mutated by 0033');
    if (pre0033Attempts !== post0033Attempts) throw new Error('Attempts mutated by 0033');
    if (pre0033Sessions !== post0033Sessions) throw new Error('Sessions mutated by 0033');

    // 11. physically verify exact six new-table columns: names, types, nullability, defaults
    const cols = await testClient.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'secure_assessment_exam_proctor_room_assignments'
      ORDER BY ordinal_position
    `);
    const expectedCols = {
      id: { type: 'uuid', is_nullable: 'NO', default: 'gen_random_uuid()' },
      tenant_id: { type: 'uuid', is_nullable: 'NO', default: null },
      exam_instance_id: { type: 'uuid', is_nullable: 'NO', default: null },
      proctor_assignment_id: { type: 'uuid', is_nullable: 'NO', default: null },
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

    // 12. physically verify uq_sa_proctor_assignment_id_tenant_instance: exact ordered columns: id, tenant_id, exam_instance_id
    const proctorConstraints = await getTableConstraints(testClient, 'secure_assessment_proctor_assignments');
    const uqProctor = proctorConstraints.find(c => c.conname === 'uq_sa_proctor_assignment_id_tenant_instance');
    if (!uqProctor) throw new Error('Missing constraint uq_sa_proctor_assignment_id_tenant_instance');
    if (uqProctor.contype !== 'u') throw new Error(`uq_sa_proctor_assignment_id_tenant_instance type expected 'u', got ${uqProctor.contype}`);
    if (JSON.stringify(uqProctor.cols) !== JSON.stringify(['id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`uq_sa_proctor_assignment_id_tenant_instance cols mismatch: got ${JSON.stringify(uqProctor.cols)}`);
    }

    // 13. prove existing uq_sa_proctor_assignment_active still exists and semantics were not removed
    const activeIndexRes = await testClient.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'secure_assessment_proctor_assignments'
        AND indexname = 'uq_sa_proctor_assignment_active'
    `);
    if (activeIndexRes.rows.length !== 1) {
      throw new Error('Existing partial unique index uq_sa_proctor_assignment_active missing');
    }
    if (!activeIndexRes.rows[0].indexdef.includes('WHERE (revoked_at IS NULL)')) {
      throw new Error(`uq_sa_proctor_assignment_active predicate mismatch: ${activeIndexRes.rows[0].indexdef}`);
    }

    // 14. prove existing uq_sa_exam_room_id_tenant_instance still exists and exact ordered columns remain: id, tenant_id, exam_instance_id
    const roomConstraints = await getTableConstraints(testClient, 'secure_assessment_exam_rooms');
    const uqRoom = roomConstraints.find(c => c.conname === 'uq_sa_exam_room_id_tenant_instance');
    if (!uqRoom) throw new Error('Missing constraint uq_sa_exam_room_id_tenant_instance');
    if (uqRoom.contype !== 'u') throw new Error(`uq_sa_exam_room_id_tenant_instance type expected 'u', got ${uqRoom.contype}`);
    if (JSON.stringify(uqRoom.cols) !== JSON.stringify(['id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`uq_sa_exam_room_id_tenant_instance cols mismatch: got ${JSON.stringify(uqRoom.cols)}`);
    }

    // 15. physically verify uq_sa_exam_proctor_room_assignment_tenant: exact ordered columns: id, tenant_id
    const assignConstraints = await getTableConstraints(testClient, 'secure_assessment_exam_proctor_room_assignments');
    const uqAssignTenant = assignConstraints.find(c => c.conname === 'uq_sa_exam_proctor_room_assignment_tenant');
    if (!uqAssignTenant) throw new Error('Missing constraint uq_sa_exam_proctor_room_assignment_tenant');
    if (uqAssignTenant.contype !== 'u') throw new Error(`uq_sa_exam_proctor_room_assignment_tenant type expected 'u', got ${uqAssignTenant.contype}`);
    if (JSON.stringify(uqAssignTenant.cols) !== JSON.stringify(['id', 'tenant_id'])) {
      throw new Error(`uq_sa_exam_proctor_room_assignment_tenant cols mismatch: got ${JSON.stringify(uqAssignTenant.cols)}`);
    }

    // 16. physically verify uq_sa_exam_proctor_room_assignment_mapping: exact ordered columns: tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id
    const uqAssignMapping = assignConstraints.find(c => c.conname === 'uq_sa_exam_proctor_room_assignment_mapping');
    if (!uqAssignMapping) throw new Error('Missing constraint uq_sa_exam_proctor_room_assignment_mapping');
    if (uqAssignMapping.contype !== 'u') throw new Error(`uq_sa_exam_proctor_room_assignment_mapping type expected 'u', got ${uqAssignMapping.contype}`);
    if (JSON.stringify(uqAssignMapping.cols) !== JSON.stringify(['tenant_id', 'exam_instance_id', 'proctor_assignment_id', 'exam_room_id'])) {
      throw new Error(`uq_sa_exam_proctor_room_assignment_mapping cols mismatch: got ${JSON.stringify(uqAssignMapping.cols)}`);
    }

    // 17. physically verify both composite FKs and ON DELETE RESTRICT
    const fkProctor = assignConstraints.find(c => c.conname === 'fk_sa_exam_proctor_room_assignment_proctor');
    if (!fkProctor) throw new Error('Missing constraint fk_sa_exam_proctor_room_assignment_proctor');
    if (fkProctor.contype !== 'f') throw new Error(`fk_sa_exam_proctor_room_assignment_proctor contype expected 'f', got ${fkProctor.contype}`);
    if (fkProctor.confdeltype !== 'r') throw new Error(`fk_sa_exam_proctor_room_assignment_proctor confdeltype expected 'r', got ${fkProctor.confdeltype}`);
    if (fkProctor.confrelname !== 'secure_assessment_proctor_assignments') throw new Error(`fk_sa_exam_proctor_room_assignment_proctor referenced table expected 'secure_assessment_proctor_assignments', got ${fkProctor.confrelname}`);
    if (JSON.stringify(fkProctor.cols) !== JSON.stringify(['proctor_assignment_id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`fk_sa_exam_proctor_room_assignment_proctor cols mismatch: got ${JSON.stringify(fkProctor.cols)}`);
    }
    if (JSON.stringify(fkProctor.fcols) !== JSON.stringify(['id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`fk_sa_exam_proctor_room_assignment_proctor fcols mismatch: got ${JSON.stringify(fkProctor.fcols)}`);
    }

    const fkRoom = assignConstraints.find(c => c.conname === 'fk_sa_exam_proctor_room_assignment_room');
    if (!fkRoom) throw new Error('Missing constraint fk_sa_exam_proctor_room_assignment_room');
    if (fkRoom.contype !== 'f') throw new Error(`fk_sa_exam_proctor_room_assignment_room contype expected 'f', got ${fkRoom.contype}`);
    if (fkRoom.confdeltype !== 'r') throw new Error(`fk_sa_exam_proctor_room_assignment_room confdeltype expected 'r', got ${fkRoom.confdeltype}`);
    if (fkRoom.confrelname !== 'secure_assessment_exam_rooms') throw new Error(`fk_sa_exam_proctor_room_assignment_room referenced table expected 'secure_assessment_exam_rooms', got ${fkRoom.confrelname}`);
    if (JSON.stringify(fkRoom.cols) !== JSON.stringify(['exam_room_id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`fk_sa_exam_proctor_room_assignment_room cols mismatch: got ${JSON.stringify(fkRoom.cols)}`);
    }
    if (JSON.stringify(fkRoom.fcols) !== JSON.stringify(['id', 'tenant_id', 'exam_instance_id'])) {
      throw new Error(`fk_sa_exam_proctor_room_assignment_room fcols mismatch: got ${JSON.stringify(fkRoom.fcols)}`);
    }

    // Operational test fixtures setup
    const personA1_1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorA1_1 = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA1, personA1_1])).rows[0].id;

    const personA1_2 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorA1_2 = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA1, personA1_2])).rows[0].id;

    const personA1_unmapped = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorA1_unmapped = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA1, personA1_unmapped])).rows[0].id;

    const roomA1_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room A1-1') RETURNING id`, [tenantA, examInstanceA1])).rows[0].id;
    const roomA1_2 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room A1-2') RETURNING id`, [tenantA, examInstanceA1])).rows[0].id;

    const personA2_1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorA2_1 = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, examInstanceA2, personA2_1])).rows[0].id;
    const roomA2_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room A2-1') RETURNING id`, [tenantA, examInstanceA2])).rows[0].id;

    const personB1_1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const proctorB1_1 = (await testClient.query(`INSERT INTO public.secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantB, examInstanceB1, personB1_1])).rows[0].id;
    const roomB1_1 = (await testClient.query(`INSERT INTO public.secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Room B1-1') RETURNING id`, [tenantB, examInstanceB1])).rows[0].id;

    // 18. prove an explicit Proctor Assignment may have zero room mappings
    const unmappedCount = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_proctor_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2 AND proctor_assignment_id = $3
    `, [tenantA, examInstanceA1, proctorA1_unmapped])).rows[0].count, 10);
    if (unmappedCount !== 0) throw new Error(`Expected 0 mappings for proctorA1_unmapped, got ${unmappedCount}`);

    // 19. prove one valid same-tenant + same-exam mapping succeeds
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceA1, proctorA1_1, roomA1_1]);

    // 20. prove the same Proctor Assignment can map to a second room in the same Exam Instance
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceA1, proctorA1_1, roomA1_2]);

    const proctor1Mappings = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_proctor_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2 AND proctor_assignment_id = $3
    `, [tenantA, examInstanceA1, proctorA1_1])).rows[0].count, 10);
    if (proctor1Mappings !== 2) throw new Error(`Expected 2 room mappings for proctorA1_1, got ${proctor1Mappings}`);

    // 21. prove multiple different Proctor Assignments can map to the same Exam Room
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceA1, proctorA1_2, roomA1_1]);

    const room1Proctors = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_proctor_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2 AND exam_room_id = $3
    `, [tenantA, examInstanceA1, roomA1_1])).rows[0].count, 10);
    if (room1Proctors !== 2) throw new Error(`Expected 2 proctor mappings for roomA1_1, got ${room1Proctors}`);

    const examA1Total = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_proctor_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2
    `, [tenantA, examInstanceA1])).rows[0].count, 10);
    if (examA1Total !== 3) throw new Error(`Expected 3 total mappings in examInstanceA1, got ${examA1Total}`);

    // 22. prove another Exam Instance is isolated
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantA, examInstanceA2, proctorA2_1, roomA2_1]);

    const examA2Total = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_proctor_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2
    `, [tenantA, examInstanceA2])).rows[0].count, 10);
    if (examA2Total !== 1) throw new Error(`Expected 1 mapping in examInstanceA2, got ${examA2Total}`);

    // Verify examA1 total remains 3
    const examA1TotalAfter = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_proctor_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2
    `, [tenantA, examInstanceA1])).rows[0].count, 10);
    if (examA1TotalAfter !== 3) throw new Error(`Expected 3 mappings in examInstanceA1 after A2 insertion, got ${examA1TotalAfter}`);

    // 23. prove another tenant is isolated
    await testClient.query(`
      INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantB, examInstanceB1, proctorB1_1, roomB1_1]);

    const examB1Total = parseInt((await testClient.query(`
      SELECT COUNT(*) as count FROM public.secure_assessment_exam_proctor_room_assignments
      WHERE tenant_id = $1 AND exam_instance_id = $2
    `, [tenantB, examInstanceB1])).rows[0].count, 10);
    if (examB1Total !== 1) throw new Error(`Expected 1 mapping in examInstanceB1, got ${examB1Total}`);

    // 24. prove cross-tenant Proctor Assignment binding fails (SQLSTATE 23503)
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantB, examInstanceB1, proctorA1_unmapped, roomB1_1]);
      throw new Error('Cross-tenant Proctor Assignment reference unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for cross-tenant proctor, got ${e.code}: ${e.message}`);
    }

    // 25. prove cross-tenant Exam Room binding fails (SQLSTATE 23503)
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantA, examInstanceA1, proctorA1_unmapped, roomB1_1]);
      throw new Error('Cross-tenant Exam Room reference unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for cross-tenant room, got ${e.code}: ${e.message}`);
    }

    // 26. prove Proctor Assignment Exam A + Room Exam B mismatch fails (SQLSTATE 23503)
    // Case A: Assignment row declares exam_instance_id = examInstanceA1, but room belongs to examInstanceA2
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantA, examInstanceA1, proctorA1_unmapped, roomA2_1]);
      throw new Error('Proctor Exam A1 + Room Exam A2 mismatch (row=A1) unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for cross-exam room mismatch, got ${e.code}: ${e.message}`);
    }

    // Case B: Assignment row declares exam_instance_id = examInstanceA2, but proctor belongs to examInstanceA1
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantA, examInstanceA2, proctorA1_unmapped, roomA2_1]);
      throw new Error('Proctor Exam A1 + Room Exam A2 mismatch (row=A2) unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for cross-exam proctor mismatch, got ${e.code}: ${e.message}`);
    }

    // 27. prove nonexistent Proctor Assignment fails (SQLSTATE 23503)
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
        VALUES ($1, $2, gen_random_uuid(), $3)
      `, [tenantA, examInstanceA1, roomA1_1]);
      throw new Error('Nonexistent Proctor Assignment unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for nonexistent proctor assignment, got ${e.code}: ${e.message}`);
    }

    // 28. prove nonexistent Exam Room fails (SQLSTATE 23503)
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
        VALUES ($1, $2, $3, gen_random_uuid())
      `, [tenantA, examInstanceA1, proctorA1_unmapped]);
      throw new Error('Nonexistent Exam Room unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23503') throw new Error(`Expected FK violation 23503 for nonexistent exam room, got ${e.code}: ${e.message}`);
    }

    // 29. prove duplicate exact mapping fails (SQLSTATE 23505)
    // proctorA1_1 is already mapped to roomA1_1
    try {
      await testClient.query(`
        INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
        VALUES ($1, $2, $3, $4)
      `, [tenantA, examInstanceA1, proctorA1_1, roomA1_1]);
      throw new Error('Duplicate exact mapping unexpectedly succeeded');
    } catch (e) {
      if (e.message.includes('unexpectedly succeeded')) throw e;
      if (e.code !== '23505') throw new Error(`Expected UNIQUE violation 23505 for duplicate mapping, got ${e.code}: ${e.message}`);
      if (e.constraint !== 'uq_sa_exam_proctor_room_assignment_mapping') {
        throw new Error(`Expected constraint uq_sa_exam_proctor_room_assignment_mapping, got ${e.constraint}`);
      }
    }

    // 30. prove all required NULL cases fail (SQLSTATE 23502)
    const nullCases = [
      { t: null, e: examInstanceA1, p: proctorA1_unmapped, r: roomA1_1, name: 'tenant_id' },
      { t: tenantA, e: null, p: proctorA1_unmapped, r: roomA1_1, name: 'exam_instance_id' },
      { t: tenantA, e: examInstanceA1, p: null, r: roomA1_1, name: 'proctor_assignment_id' },
      { t: tenantA, e: examInstanceA1, p: proctorA1_unmapped, r: null, name: 'exam_room_id' }
    ];
    for (const c of nullCases) {
      try {
        await testClient.query(`
          INSERT INTO public.secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
          VALUES ($1, $2, $3, $4)
        `, [c.t, c.e, c.p, c.r]);
        throw new Error(`Null ${c.name} constraint failed to trigger`);
      } catch (e) {
        if (e.message.includes('constraint failed to trigger')) throw e;
        if (e.code !== '23502') throw new Error(`Expected NOT NULL violation 23502 for ${c.name}, got ${e.code}: ${e.message}`);
      }
    }

    // 31. prove referenced Proctor Assignment DELETE is RESTRICTed (SQLSTATE 23001)
    try {
      await testClient.query(`DELETE FROM public.secure_assessment_proctor_assignments WHERE id = $1`, [proctorA1_1]);
      throw new Error('Referenced Proctor Assignment delete restriction failed to trigger');
    } catch (e) {
      if (e.message.includes('failed to trigger')) throw e;
      if (e.code !== '23001') throw new Error(`Expected RESTRICT violation 23001 for proctor assignment delete, got ${e.code}: ${e.message}`);
    }

    // 32. prove referenced Exam Room DELETE is RESTRICTed (SQLSTATE 23001)
    try {
      await testClient.query(`DELETE FROM public.secure_assessment_exam_rooms WHERE id = $1`, [roomA1_1]);
      throw new Error('Referenced Exam Room delete restriction failed to trigger');
    } catch (e) {
      if (e.message.includes('failed to trigger')) throw e;
      if (e.code !== '23001') throw new Error(`Expected RESTRICT violation 23001 for room delete, got ${e.code}: ${e.message}`);
    }

    // Post-operations non-mutation assertions
    // Academic Core data unchanged
    const finalCoreData = await getAcademicCoreData(testClient);
    if (pre0033CoreData !== finalCoreData) {
      throw new Error('Academic Core data mutated during proctor room assignment operations');
    }

    // Participants, attempts, sessions unchanged
    const finalParticipants = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_participants`)).rows[0].count, 10);
    const finalAttempts = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_attempts`)).rows[0].count, 10);
    const finalSessions = parseInt((await testClient.query(`SELECT COUNT(*) as count FROM public.secure_assessment_exam_sessions`)).rows[0].count, 10);
    if (pre0033Participants !== finalParticipants) throw new Error('Participants mutated during proctor room assignment operations');
    if (pre0033Attempts !== finalAttempts) throw new Error('Attempts mutated during proctor room assignment operations');
    if (pre0033Sessions !== finalSessions) throw new Error('Sessions mutated during proctor room assignment operations');

    // 38. prove migration 0034 does not exist
    const m34 = allMigrationFiles.filter(f => f.startsWith('0034_'));
    if (m34.length > 0) throw new Error('Migration 0034 exists');

    // 39. fail-closed disposable database cleanup
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
