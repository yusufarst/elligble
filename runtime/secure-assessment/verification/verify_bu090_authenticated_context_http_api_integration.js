import { Client, Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { createServer } from '../src/server.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'database', 'migrations');

const pgPassword = process.env.PGPASSWORD;

function clientConfig(connectionString) {
  return pgPassword
    ? { connectionString, password: pgPassword }
    : { connectionString };
}

async function snapshotTable(client, tableName) {
  const countRes = await client.query(`SELECT COUNT(*) as count FROM public.${tableName}`);
  const rowsRes = await client.query(`SELECT * FROM public.${tableName}`);
  const rows = rowsRes.rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    count: parseInt(countRes.rows[0].count, 10),
    rows: JSON.stringify(rows)
  };
}

async function runVerification() {
  let dbName = '';
  let rootClient = null;
  let testClient = null;
  let testPool = null;
  let dbCleanedUp = false;

  try {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    rootClient = new Client(clientConfig(adminUrl.toString()));
    await rootClient.connect();

    // 0. Pre-run leak check: verify zero elligble_bu090_ databases exist
    const preRunLeakRes = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu090_%'`
    );
    if (preRunLeakRes.rowCount !== null && preRunLeakRes.rowCount > 0) {
      throw new Error(`PRE-RUN LEAK DETECTED: Found ${preRunLeakRes.rowCount} dangling database(s) matching elligble_bu090_%`);
    }
    console.log('PRE-RUN ZERO-LEAK: PASS');

    // Create disposable database
    const runId = crypto.randomBytes(4).toString('hex');
    dbName = `elligble_bu090_${runId}`;
    await rootClient.query(`CREATE DATABASE "${dbName}"`);

    const testUrl = new URL(dbUrl);
    testUrl.pathname = `/${dbName}`;

    testClient = new Client(clientConfig(testUrl.toString()));
    await testClient.connect();

    testPool = new Pool(clientConfig(testUrl.toString()));

    // 1. Discover and apply canonical migrations
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const sqlFiles = files
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort((a, b) => a.localeCompare(b));

    for (const f of sqlFiles) {
      const filePath = path.join(MIGRATIONS_DIR, f);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    // 2. Setup Test Fixtures in Real PostgreSQL
    const tenantA = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const tenantB = (await testClient.query(`INSERT INTO public.tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const personStudent1 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personStudent2 = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const personTeacherA = (await testClient.query(`INSERT INTO public.identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;

    const teacherMemberA = (await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`, [tenantA, personTeacherA])).rows[0].id;
    const teacherAssignmentA = (await testClient.query(`INSERT INTO public.tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id`, [tenantA, teacherMemberA])).rows[0].id;
    const academicYearA = (await testClient.query(`INSERT INTO public.academic_core_academic_years (tenant_id, display_label, start_date, end_date) VALUES ($1, '2026/2027', DATE '2026-07-01', DATE '2027-06-30') RETURNING id`, [tenantA])).rows[0].id;
    const gradeLevelA = (await testClient.query(`INSERT INTO public.academic_core_grade_levels (tenant_id, display_label) VALUES ($1, 'Kelas 10') RETURNING id`, [tenantA])).rows[0].id;
    const academicPeriodA = (await testClient.query(`INSERT INTO public.academic_core_academic_periods (tenant_id, academic_year_id, display_label, period_type, start_date, end_date) VALUES ($1, $2, 'Semester Ganjil', 'SEMESTER', DATE '2026-07-01', DATE '2026-12-31') RETURNING id`, [tenantA, academicYearA])).rows[0].id;
    const academicGroupA = (await testClient.query(`INSERT INTO public.academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1, $2, $3, 'X-MIPA-1') RETURNING id`, [tenantA, academicYearA, gradeLevelA])).rows[0].id;
    const subjectMath = (await testClient.query(`INSERT INTO public.academic_core_subjects (tenant_id, display_label) VALUES ($1, 'Matematika Wajib') RETURNING id`, [tenantA])).rows[0].id;
    const offeringMath = (await testClient.query(`INSERT INTO public.academic_core_subject_offerings (tenant_id, subject_id, academic_period_id, grade_level_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, subjectMath, academicPeriodA, gradeLevelA])).rows[0].id;
    const teachingMath = (await testClient.query(`INSERT INTO public.academic_core_teaching_assignments (tenant_id, teacher_assignment_id, subject_offering_id, academic_group_id) VALUES ($1, $2, $3, $4) RETURNING id`, [tenantA, teacherAssignmentA, offeringMath, academicGroupA])).rows[0].id;
    const assessmentTypeA = (await testClient.query(`INSERT INTO public.secure_assessment_assessment_types (tenant_id, display_label) VALUES ($1, 'SUMATIF_AKHIR') RETURNING id`, [tenantA])).rows[0].id;

    const instanceMath = (await testClient.query(`
      INSERT INTO public.secure_assessment_exam_instances (
        tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state,
        window_starts_at, window_ends_at, configured_attempt_duration_seconds, latest_start_policy
      ) VALUES ($1, $2, $3, 'ACTIVE', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3600, 'FULL_DURATION_BEYOND_WINDOW')
      RETURNING id
    `, [tenantA, teachingMath, assessmentTypeA])).rows[0].id;
    const participantS1_Math = (await testClient.query(`INSERT INTO public.secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`, [tenantA, instanceMath, personStudent1])).rows[0].id;
    const attemptMath = (await testClient.query(`INSERT INTO public.secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id`, [tenantA, participantS1_Math])).rows[0].id;

    // Accounts
    const accountS1 = crypto.randomUUID();
    const accountS2 = crypto.randomUUID();
    await testClient.query(`INSERT INTO identity_user_accounts (id, person_id) VALUES ($1, $2), ($3, $4)`, [accountS1, personStudent1, accountS2, personStudent2]);
    await testClient.query(`INSERT INTO identity_account_credentials (user_account_id, username, password_verifier) VALUES ($1, 's1', 'dummy'), ($2, 's2', 'dummy')`, [accountS1, accountS2]);

    const cryptoRuntime = await import('../../identity-access/src/crypto.ts');
    const { secret: secretS1, verifier: verifierS1 } = cryptoRuntime.generateSessionSecret();
    const { secret: secretS2, verifier: verifierS2 } = cryptoRuntime.generateSessionSecret();
    const now = new Date();
    const validSessionS1 = crypto.randomUUID();
    const validSessionS2 = crypto.randomUUID();
    const expiredSessionS1 = crypto.randomUUID();
    const idleSessionS1 = crypto.randomUUID();
    const revokedSessionS1 = crypto.randomUUID();

    // Valid sessions
    await testClient.query(`INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at) VALUES ($1, $2, $3, $4, $5, $6)`, [validSessionS1, accountS1, verifierS1, now, new Date(now.getTime() + 12 * 60 * 60 * 1000), now]);
    await testClient.query(`INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at) VALUES ($1, $2, $3, $4, $5, $6)`, [validSessionS2, accountS2, verifierS2, now, new Date(now.getTime() + 12 * 60 * 60 * 1000), now]);
    // Expired
    await testClient.query(`INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at) VALUES ($1, $2, $3, $4, $5, $6)`, [expiredSessionS1, accountS1, verifierS1, new Date(now.getTime() - 24 * 60 * 60 * 1000), new Date(now.getTime() - 1 * 60 * 60 * 1000), new Date(now.getTime() - 2 * 60 * 60 * 1000)]);
    // Idle-Expired (older than 30 mins)
    await testClient.query(`INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at) VALUES ($1, $2, $3, $4, $5, $6)`, [idleSessionS1, accountS1, verifierS1, now, new Date(now.getTime() + 12 * 60 * 60 * 1000), new Date(now.getTime() - 60 * 60 * 1000)]);
    // Revoked
    await testClient.query(`INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at, is_revoked) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`, [revokedSessionS1, accountS1, verifierS1, now, new Date(now.getTime() + 12 * 60 * 60 * 1000), now]);

    // Memberships: S1 is only in Tenant A. S2 is in Tenant A.
    await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2)`, [tenantA, personStudent1]);
    await testClient.query(`INSERT INTO public.tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2)`, [tenantA, personStudent2]);

    const tablesToTrack = [
      'identity_account_credentials',
      'identity_sessions',
      'tenant_memberships',
      'secure_assessment_exam_instances',
      'secure_assessment_exam_participants',
      'secure_assessment_exam_attempts'
    ];
    const preSnapshots = {};
    for (const t of tablesToTrack) {
      preSnapshots[t] = await snapshotTable(testClient, t);
    }

    const server = createServer({
      checkReadiness: async () => true,
      pool: testPool,
      getAuthorizedContext: () => null
    });

    await new Promise(resolve => server.listen(0, () => resolve()));
    const port = server.address().port;

    async function reqGET(path, headers) {
        return new Promise((resolve) => {
            const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body }));
            });
            req.end();
        });
    }

    // 2 & 3. Successful real authenticated assigned-exam discovery (ACTUAL_ASSIGNMENT_PROJECTION)
    let res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${validSessionS1}.${secretS1}`,
        'x-tenant-id': tenantA
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const body = JSON.parse(res.body);
    if (!body.assignments || body.assignments.length !== 1 || body.assignments[0].examInstanceId !== instanceMath) {
      throw new Error('ACTUAL_ASSIGNMENT_PROJECTION FAILED');
    }
    console.log('ACTUAL_ASSIGNMENT_PROJECTION: PASS');

    // 4. Another Person/Tenant's exam does NOT leak
    res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${validSessionS2}.${secretS2}`, // S2 has no math assignment
        'x-tenant-id': tenantA
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const bodyS2 = JSON.parse(res.body);
    if (bodyS2.assignments.length !== 0) throw new Error('TENANT_ISOLATION / NO_LEAK FAILED');
    console.log('TENANT_ISOLATION: PASS');

    // 5. missing credential
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'x-tenant-id': tenantA });
    if (res.status !== 401) throw new Error('Missing credential -> 401 FAILED');

    // 6. malformed credential
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session ${validSessionS1}`, 'x-tenant-id': tenantA });
    if (res.status !== 401) throw new Error('Malformed credential -> 401 FAILED');
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session invalid_uuid.secret`, 'x-tenant-id': tenantA });
    if (res.status !== 401) throw new Error('Malformed credential (UUID) -> 401 FAILED');

    // 7. wrong secret
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session ${validSessionS1}.wrongsecret`, 'x-tenant-id': tenantA });
    if (res.status !== 401) throw new Error('Wrong secret -> 401 FAILED');

    // 8. expired session
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session ${expiredSessionS1}.${secretS1}`, 'x-tenant-id': tenantA });
    if (res.status !== 401) throw new Error('Expired session -> 401 FAILED');

    // 9. exact idle-expired session
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session ${idleSessionS1}.${secretS1}`, 'x-tenant-id': tenantA });
    if (res.status !== 401) throw new Error('Idle-expired session -> 401 FAILED');

    // 10. revoked session
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session ${revokedSessionS1}.${secretS1}`, 'x-tenant-id': tenantA });
    if (res.status !== 401) throw new Error('Revoked session -> 401 FAILED');

    // 11. missing tenant
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session ${validSessionS1}.${secretS1}` });
    if (res.status !== 403) throw new Error('Missing tenant -> 403 FAILED');

    // 12. malformed tenant UUID
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session ${validSessionS1}.${secretS1}`, 'x-tenant-id': 'invalid-uuid' });
    if (res.status !== 403) throw new Error('Malformed tenant -> 403 FAILED');

    // 13. authenticated Person without Membership
    res = await reqGET('/api/v1/assessment/assigned-exams', { 'authorization': `ELLIGBLE-Session ${validSessionS1}.${secretS1}`, 'x-tenant-id': tenantB });
    if (res.status !== 403) throw new Error('No membership -> 403 FAILED');

    console.log('AUTH_FAILURE_MATRIX: PASS');

    // 15. forged/request-supplied Person identity cannot replace authenticated Person
    res = await reqGET(`/api/v1/assessment/assigned-exams?personId=${personStudent1}`, {
        'authorization': `ELLIGBLE-Session ${validSessionS2}.${secretS2}`,
        'x-tenant-id': tenantA,
        'x-person-id': personStudent1
    });
    const forgedBody = JSON.parse(res.body);
    if (forgedBody.assignments && forgedBody.assignments.length > 0) throw new Error('IDENTITY_SPOOF_RESISTANCE FAILED');
    console.log('IDENTITY_SPOOF_RESISTANCE: PASS');

    if (res.body.includes(secretS1) || res.body.includes(secretS2)) {
       throw new Error('ZERO_SECRET_LEAK FAILED');
    }
    console.log('ZERO_SECRET_LEAK: PASS');

    server.close();

    // Zero Mutation Proof
    let sessionLastActivityUpdated = false;
    for (const t of tablesToTrack) {
      const postSnap = await snapshotTable(testClient, t);

      if (t === 'identity_sessions') {
        const preRows = JSON.parse(preSnapshots[t].rows);
        const postRows = JSON.parse(postSnap.rows);
        for (let i = 0; i < preRows.length; i++) {
          const pr = preRows[i];
          const po = postRows[i];
          if (pr.id !== po.id || pr.user_account_id !== po.user_account_id || pr.session_secret_verifier !== po.session_secret_verifier) {
            throw new Error(`ZERO MUTATION VIOLATION: identity_sessions security state modified!`);
          }
          if (pr.id === validSessionS1 && new Date(po.last_activity_at).getTime() > new Date(pr.last_activity_at).getTime()) {
             sessionLastActivityUpdated = true;
          }
        }
      } else {
        if (postSnap.count !== preSnapshots[t].count) {
          throw new Error(`ZERO MUTATION VIOLATION: Table public.${t} count changed!`);
        }
        if (postSnap.rows !== preSnapshots[t].rows) {
          throw new Error(`ZERO MUTATION VIOLATION: Table public.${t} row content modified!`);
        }
      }
    }
    if (!sessionLastActivityUpdated) throw new Error('Session last_activity_at was NOT updated boundedly.');
    console.log('ZERO_UNAUTHORIZED_MUTATION: PASS');

    await testPool.end();
    testPool = null;
    await testClient.end();
    testClient = null;

    if (rootClient && dbName) {
      await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      const checkDb = await rootClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
      if (checkDb.rowCount !== null && checkDb.rowCount > 0) {
        throw new Error(`DATABASE CLEANUP FAILED: Database ${dbName} still exists.`);
      }
      dbCleanedUp = true;
    }

    const postRunLeakRes = await rootClient.query(`SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu090_%'`);
    if (postRunLeakRes.rowCount !== null && postRunLeakRes.rowCount > 0) {
      throw new Error(`POST-RUN LEAK DETECTED: Found ${postRunLeakRes.rowCount} dangling database(s) matching elligble_bu090_%`);
    }
    console.log('POST-RUN DB LEAK: ZERO_LEAK');
    console.log('BU-090 REAL POSTGRESQL VERIFICATION: PASS');
  } catch (error) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', error);
    process.exitCode = 1;
  } finally {
    if (testPool) {
      try { await testPool.end(); } catch {}
    }
    if (testClient) {
      try { await testClient.end(); } catch {}
    }
    if (rootClient) {
      if (dbName && !dbCleanedUp) {
        try { await rootClient.query(`DROP DATABASE IF EXISTS "${dbName}"`); } catch {}
      }
      try { await rootClient.end(); } catch {}
    }
  }
}

runVerification();
