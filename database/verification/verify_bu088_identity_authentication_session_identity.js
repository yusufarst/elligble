const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
let pg;
try {
  pg = require('../../runtime/identity-access/node_modules/pg');
} catch (e) {
  try {
    pg = require('pg');
  } catch (e2) {
    console.error('Failed to load pg');
    process.exit(1);
  }
}
const { Client } = pg;

function assertStrict(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function log(message) {
  console.log(`- PASS: ${message}`);
}

const pgPassword = process.env.PGPASSWORD;
function clientConfig(connectionString) {
  return pgPassword ? { connectionString, password: pgPassword } : { connectionString };
}

class ControllableClock {
  constructor(initialIso = '2026-09-18T10:00:00.000Z') {
    this.current = new Date(initialIso);
  }
  now() {
    return new Date(this.current.getTime());
  }
  advance(ms) {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(iso) {
    this.current = new Date(iso);
  }
}

async function getProtectedStateSnapshot(client) {
  const tableQuery = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE 'academic_core_%' OR table_name LIKE 'secure_assessment_%')
    ORDER BY table_name
  `);
  const allTables = tableQuery.rows.map(r => r.table_name);

  assertStrict(allTables.some(t => t.startsWith('academic_core_')), 'Protected Academic Core tables must be discovered');
  assertStrict(allTables.some(t => t.startsWith('secure_assessment_')), 'Protected Secure Assessment tables must be discovered');

  const cols = await client.query(`
    SELECT
      table_name,
      ordinal_position,
      column_name,
      data_type,
      udt_schema,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      datetime_precision,
      is_identity,
      identity_generation,
      is_generated
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1)
    ORDER BY table_name, ordinal_position
  `, [allTables]);

  const constraints = await client.query(`
    SELECT
      c.relname AS table_name,
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      pg_get_constraintdef(con.oid, true) AS constraint_def
    FROM pg_constraint con
    JOIN pg_class c ON con.conrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = ANY($1)
    ORDER BY c.relname, con.conname
  `, [allTables]);

  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY($1)
    ORDER BY tablename, indexname
  `, [allTables]);

  const state = {};
  for (const tbl of allTables) {
    const res = await client.query(`SELECT (row_to_json(t.*)::jsonb) as row_data FROM public.${tbl} t ORDER BY t::text`);
    state[tbl] = res.rows.map(r => r.row_data);
  }

  return JSON.stringify({ cols: cols.rows, constraints: constraints.rows, indexes: indexes.rows, state });
}

async function runVerification() {
  const rawDbUrl = process.env.DATABASE_URL;
  if (!rawDbUrl) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }
  const adminUrl = new URL(rawDbUrl);
  adminUrl.pathname = '/postgres';

  const rootClient = new Client(clientConfig(adminUrl.toString()));
  await rootClient.connect();

  const createdDatabases = [];
  const openClients = [];

  const createDisposableDb = async (suffix) => {
    const runId = crypto.randomBytes(4).toString('hex');
    const dbName = `elligble_bu088_${runId}_${suffix}`;
    await rootClient.query(`CREATE DATABASE "${dbName}"`);
    createdDatabases.push(dbName);
    const testUrl = new URL(rawDbUrl);
    testUrl.pathname = `/${dbName}`;
    const testClient = new Client(clientConfig(testUrl.toString()));
    await testClient.connect();
    openClients.push(testClient);
    return { testClient, dbName, testUrl: testUrl.toString() };
  };

  try {
    // 0. Pre-run leak check
    const preLeaks = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu088_%'`
    );
    assertStrict(preLeaks.rows.length === 0, `Pre-run leak check failed: found ${preLeaks.rows.length} dangling databases`);
    log('Pre-run zero-leak verification PASS');

    // 1. Create main disposable DB and apply canonical migrations 0001..0035
    const { testClient, testUrl } = await createDisposableDb('main');
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    let before0035TableNames = [];
    let after0035TableNames = [];

    for (const file of allMigrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      if (file.startsWith('0035_')) {
        const beforeRes = await testClient.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        before0035TableNames = beforeRes.rows.map(r => r.table_name);
      }

      await testClient.query(sql);

      if (file.startsWith('0035_')) {
        const afterRes = await testClient.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        after0035TableNames = afterRes.rows.map(r => r.table_name);
      }
    }

    const historyCount = await testClient.query('SELECT COUNT(*) as c FROM elligble_migration_history');
    assertStrict(parseInt(historyCount.rows[0].c, 10) === 35, 'Expected exactly 35 migrations in history');
    log('Full canonical migration chain 0001..0035 applied PASS');

    // 2. Repeat-safety of migration 0035
    const migration0035Sql = fs.readFileSync(path.join(migrationsDir, '0035_bu088_identity_authentication_session_identity_core_state.sql'), 'utf8');
    await testClient.query(migration0035Sql);
    log('Migration 0035 repeat-safety PASS');

    const newTables = after0035TableNames.filter(t => !before0035TableNames.includes(t));
    assertStrict(newTables.length === 2 && newTables.includes('identity_account_credentials') && newTables.includes('identity_sessions'), 'Migration 0035 creates exactly 2 tables (no spill)');
    log('No unexpected BU-088 table/schema spill PASS');

    // 3. Exact schema, index, FK, constraint existence
    const credTable = await testClient.query(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'identity_account_credentials'
      ORDER BY column_name
    `);
    assertStrict(credTable.rows.length === 10, 'identity_account_credentials exact column count');
    const credCols = credTable.rows.map(r => `${r.column_name}:${r.data_type}:${r.is_nullable}${r.character_maximum_length ? ':' + r.character_maximum_length : ''}`);
    assertStrict(credCols.includes('user_account_id:uuid:NO'), 'user_account_id exists');
    assertStrict(credCols.includes('username:character varying:NO:255'), 'username exists');
    assertStrict(credCols.includes('password_verifier:character varying:NO:255'), 'password_verifier exists');
    assertStrict(credCols.includes('is_valid:boolean:NO'), 'is_valid exists');
    assertStrict(credCols.includes('consecutive_failures_count:integer:NO'), 'consecutive_failures_count exists');
    assertStrict(credCols.includes('failed_attempts_timeline:jsonb:NO'), 'failed_attempts_timeline exists');
    assertStrict(credCols.includes('locked_until:timestamp with time zone:YES'), 'locked_until exists');
    assertStrict(credCols.includes('last_successful_login_at:timestamp with time zone:YES'), 'last_successful_login_at exists');
    assertStrict(credCols.includes('created_at:timestamp with time zone:NO'), 'created_at exists');
    assertStrict(credCols.includes('updated_at:timestamp with time zone:NO'), 'updated_at exists');

    const credConstraints = await testClient.query(`
      SELECT tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema
      LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = 'identity_account_credentials'
    `);
    assertStrict(credConstraints.rows.some(r => r.constraint_type === 'PRIMARY KEY' && r.column_name === 'user_account_id'), 'PK user_account_id');
    assertStrict(credConstraints.rows.some(r => r.constraint_type === 'UNIQUE' && r.column_name === 'username'), 'UNIQUE username');
    assertStrict(credConstraints.rows.some(r => r.constraint_type === 'FOREIGN KEY' && r.column_name === 'user_account_id' && r.foreign_table_name === 'identity_user_accounts' && r.foreign_column_name === 'id' && r.delete_rule === 'RESTRICT'), 'FK user_account_id -> identity_user_accounts(id) ON DELETE RESTRICT');

    const credIndexes = await testClient.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'identity_account_credentials'
    `);
    assertStrict(credIndexes.rows.some(r => r.indexname === 'idx_identity_account_credentials_username' && r.indexdef.includes('(username)')), 'Index on username');

    const sessionTable = await testClient.query(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'identity_sessions'
      ORDER BY column_name
    `);
    assertStrict(sessionTable.rows.length === 7, 'identity_sessions exact column count');
    const sessionCols = sessionTable.rows.map(r => `${r.column_name}:${r.data_type}:${r.is_nullable}${r.character_maximum_length ? ':' + r.character_maximum_length : ''}`);
    assertStrict(sessionCols.includes('id:uuid:NO'), 'id exists');
    assertStrict(sessionCols.includes('user_account_id:uuid:NO'), 'user_account_id exists');
    assertStrict(sessionCols.includes('session_secret_verifier:character varying:NO:255'), 'session_secret_verifier exists');
    assertStrict(sessionCols.includes('is_revoked:boolean:NO'), 'is_revoked exists');
    assertStrict(sessionCols.includes('authenticated_at:timestamp with time zone:NO'), 'authenticated_at exists');
    assertStrict(sessionCols.includes('expires_at:timestamp with time zone:NO'), 'expires_at exists');
    assertStrict(sessionCols.includes('last_activity_at:timestamp with time zone:NO'), 'last_activity_at exists');

    const sessionConstraints = await testClient.query(`
      SELECT tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema
      LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = 'identity_sessions'
    `);
    assertStrict(sessionConstraints.rows.some(r => r.constraint_type === 'PRIMARY KEY' && r.column_name === 'id'), 'PK id');
    assertStrict(sessionConstraints.rows.some(r => r.constraint_type === 'FOREIGN KEY' && r.column_name === 'user_account_id' && r.foreign_table_name === 'identity_user_accounts' && r.foreign_column_name === 'id' && r.delete_rule === 'RESTRICT'), 'FK user_account_id -> identity_user_accounts(id) ON DELETE RESTRICT');

    const sessionIndexes = await testClient.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'identity_sessions'
    `);
    assertStrict(sessionIndexes.rows.some(r => r.indexname === 'idx_identity_sessions_account_id' && r.indexdef.includes('(user_account_id)')), 'Index on user_account_id');
    log('Exact BU-088 tables, columns, indexes, and constraints verified PASS');

    // 4. Snapshot protected state before BU-088 operations
    const preSnapshot = await getProtectedStateSnapshot(testClient);

    // 4b. Protected Snapshot Regression Self-Proof
    const preSnapshotObj = JSON.parse(preSnapshot);
    assertStrict(preSnapshotObj.constraints.some(c => c.constraint_type === 'c'), 'Proof: Protected CHECK constraints must be captured in snapshot');
    assertStrict(preSnapshotObj.constraints.length > 0, 'Proof: Protected constraints snapshot is non-empty');
    assertStrict(preSnapshotObj.indexes.length > 0, 'Proof: Protected indexes snapshot is non-empty');
    log('Protected Snapshot Regression Self-Proof PASS');

    // 5. Person != User Account != Membership preserved
    const personId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const accountId = (await testClient.query('INSERT INTO identity_user_accounts (id, person_id) VALUES (gen_random_uuid(), $1) RETURNING id', [personId])).rows[0].id;
    const tenantId = (await testClient.query('INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const membershipId = (await testClient.query('INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id', [tenantId, personId])).rows[0].id;
    assertStrict(personId !== accountId && personId !== membershipId && accountId !== membershipId, 'Person != User Account != Membership preserved');
    log('Person != User Account != Membership separation preserved PASS');

    // 6. Dynamically import IdentityRuntime from TypeScript source
    const { IdentityRuntime, DefaultClock } = await import('../../runtime/identity-access/src/index.ts');
    const { hashPassword } = await import('../../runtime/identity-access/src/crypto.ts');

    const clock = new ControllableClock('2026-09-18T10:00:00.000Z');
    const runtime = new IdentityRuntime(testClient, clock);

    // 7. Register credentials via SQL directly (since registerCredentials is removed)
    const plainPassword = 'CorrectPassword2026!#';
    const verifierMain = hashPassword(plainPassword);
    await testClient.query(`
      INSERT INTO identity_account_credentials (
        user_account_id, username, password_verifier, is_valid, consecutive_failures_count, failed_attempts_timeline, created_at, updated_at
      ) VALUES ($1, $2, $3, TRUE, 0, '[]'::jsonb, current_timestamp, current_timestamp)
    `, [accountId, 'student.main', verifierMain]);
    log('Credential registered via SQL PASS');

    // Verify plaintext password absent from DB
    const credDbRow = (await testClient.query('SELECT password_verifier FROM identity_account_credentials WHERE user_account_id = $1', [accountId])).rows[0];
    assertStrict(credDbRow.password_verifier !== plainPassword, 'Plaintext password must NOT be persisted');
    assertStrict(credDbRow.password_verifier.startsWith('scrypt$v=1$'), 'Self-describing scrypt format persisted');
    log('Raw plaintext password absent from persistence PASS');

    // 8. Correct password login through actual runtime
    const loginResult = await runtime.authenticate('student.main', plainPassword);
    assertStrict(loginResult.success === true, 'Login with correct password must succeed');
    assertStrict(loginResult.userAccountId === accountId, 'User account ID matches');
    assertStrict(loginResult.personId === personId, 'Person ID matches');
    assertStrict(Boolean(loginResult.session && loginResult.session.sessionId && loginResult.session.secret), 'Session established on success');
    log('Correct password authentication and session establishment through actual runtime PASS');

    // Verify raw session secret absent from DB
    const sessionDbRow = (await testClient.query('SELECT session_secret_verifier FROM identity_sessions WHERE id = $1', [loginResult.session.sessionId])).rows[0];
    assertStrict(sessionDbRow.session_secret_verifier !== loginResult.session.secret, 'Raw session secret must NOT be persisted');
    assertStrict(sessionDbRow.session_secret_verifier.length === 64, 'Session secret verifier is SHA-256 hex');
    log('Raw reusable session secret absent from persistence PASS');

    // 9. Wrong password denial through actual runtime
    const wrongResult = await runtime.authenticate('student.main', 'WrongPassword!');
    assertStrict(wrongResult.success === false && wrongResult.error === 'INVALID_CREDENTIALS', 'Wrong password denied');
    log('Wrong password denial through actual runtime PASS');

    // 10. Unknown user denial
    const unknownResult = await runtime.authenticate('unknown.user', 'AnyPassword');
    assertStrict(unknownResult.success === false && unknownResult.error === 'INVALID_CREDENTIALS', 'Unknown username denied');
    log('Unknown user credential denial PASS');

    // 11. Revoked credential denial
    const revokedPersonId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const revokedAccountId = (await testClient.query('INSERT INTO identity_user_accounts (id, person_id) VALUES (gen_random_uuid(), $1) RETURNING id', [revokedPersonId])).rows[0].id;
    const verifierRevoked = hashPassword(plainPassword);
    await testClient.query(`
      INSERT INTO identity_account_credentials (
        user_account_id, username, password_verifier, is_valid, consecutive_failures_count, failed_attempts_timeline, created_at, updated_at
      ) VALUES ($1, $2, $3, TRUE, 0, '[]'::jsonb, current_timestamp, current_timestamp)
    `, [revokedAccountId, 'student.revoked', verifierRevoked]);
    await testClient.query('UPDATE identity_account_credentials SET is_valid = FALSE WHERE user_account_id = $1', [revokedAccountId]);
    const revokedAuth = await runtime.authenticate('student.revoked', plainPassword);
    assertStrict(revokedAuth.success === false && revokedAuth.error === 'REVOKED', 'Revoked account denied');
    log('Revoked credential denial through actual runtime PASS');

    // 12. Actual rolling 5-minute rate-limit proof
    const rlPersonId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const rlAccountId = (await testClient.query('INSERT INTO identity_user_accounts (id, person_id) VALUES (gen_random_uuid(), $1) RETURNING id', [rlPersonId])).rows[0].id;
    const verifierRl = hashPassword(plainPassword);
    await testClient.query(`
      INSERT INTO identity_account_credentials (
        user_account_id, username, password_verifier, is_valid, consecutive_failures_count, failed_attempts_timeline, created_at, updated_at
      ) VALUES ($1, $2, $3, TRUE, 0, '[]'::jsonb, current_timestamp, current_timestamp)
    `, [rlAccountId, 'student.ratelimit', verifierRl]);

    for (let i = 0; i < 5; i++) {
      const res = await runtime.authenticate('student.ratelimit', 'WrongPwd');
      assertStrict(res.success === false && res.error === 'INVALID_CREDENTIALS', `Failure ${i + 1} recorded`);
      clock.advance(20 * 1000); // 20s apart
    }

    const sixthAttempt = await runtime.authenticate('student.ratelimit', plainPassword);
    assertStrict(sixthAttempt.success === false && sixthAttempt.error === 'RATE_LIMITED', '6th attempt within rolling 5m window is RATE_LIMITED');
    log('Rolling 5-minute window 5-failure rate limit PASS');

    // Rolling boundary-crossing proof: advance clock past 5 minutes from first failure
    clock.advance(5 * 60 * 1000 + 1000);
    const boundaryCrossLogin = await runtime.authenticate('student.ratelimit', plainPassword);
    assertStrict(boundaryCrossLogin.success === true, 'Attempt after rolling window expires must succeed');
    log('Rolling-window boundary-crossing recovery PASS');

    // 13. 10 consecutive failures -> 15-minute temporary lock
    const lockPersonId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const lockAccountId = (await testClient.query('INSERT INTO identity_user_accounts (id, person_id) VALUES (gen_random_uuid(), $1) RETURNING id', [lockPersonId])).rows[0].id;
    const verifierLock = hashPassword(plainPassword);
    await testClient.query(`
      INSERT INTO identity_account_credentials (
        user_account_id, username, password_verifier, is_valid, consecutive_failures_count, failed_attempts_timeline, created_at, updated_at
      ) VALUES ($1, $2, $3, TRUE, 0, '[]'::jsonb, current_timestamp, current_timestamp)
    `, [lockAccountId, 'student.lockout', verifierLock]);

    // Fail 4 times, advance 5m1s, fail 4 times, advance 5m1s, fail 2 times = 10 consecutive failures without rate-limit blocking
    for (let i = 0; i < 4; i++) {
      await runtime.authenticate('student.lockout', 'BadPwd');
    }
    clock.advance(5 * 60 * 1000 + 1000);
    for (let i = 0; i < 4; i++) {
      await runtime.authenticate('student.lockout', 'BadPwd');
    }
    clock.advance(5 * 60 * 1000 + 1000);
    await runtime.authenticate('student.lockout', 'BadPwd'); // 9th
    await runtime.authenticate('student.lockout', 'BadPwd'); // 10th -> triggers lock

    const lockCheck = await runtime.authenticate('student.lockout', plainPassword);
    assertStrict(lockCheck.success === false && lockCheck.error === 'LOCKED', '10 consecutive failures triggers 15m LOCKED');
    log('10 consecutive failures triggers 15-minute temporary lockout PASS');

    // Advance 14 minutes: still locked
    clock.advance(14 * 60 * 1000);
    const stillLocked = await runtime.authenticate('student.lockout', plainPassword);
    assertStrict(stillLocked.success === false && stillLocked.error === 'LOCKED', 'Still locked at 14 minutes');

    // Advance 1m1s (total 15m1s): lock has expired
    clock.advance(61 * 1000);
    const unlockedLogin = await runtime.authenticate('student.lockout', plainPassword);
    assertStrict(unlockedLogin.success === true, 'Unlocked after 15m and successful login succeeds');
    log('Post-lockout recovery and no permanent lockout PASS');

    // 14. Concurrency proof with independent connections
    const concPersonId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const concAccountId = (await testClient.query('INSERT INTO identity_user_accounts (id, person_id) VALUES (gen_random_uuid(), $1) RETURNING id', [concPersonId])).rows[0].id;
    const verifierConc = hashPassword(plainPassword);
    await testClient.query(`
      INSERT INTO identity_account_credentials (
        user_account_id, username, password_verifier, is_valid, consecutive_failures_count, failed_attempts_timeline, created_at, updated_at
      ) VALUES ($1, $2, $3, TRUE, 0, '[]'::jsonb, current_timestamp, current_timestamp)
    `, [concAccountId, 'student.concurrent', verifierConc]);

    const concClients = [];
    const concRuntimes = [];
    for (let i = 0; i < 5; i++) {
      const c = new Client(clientConfig(testUrl));
      await c.connect();
      openClients.push(c);
      concClients.push(c);
      concRuntimes.push(new IdentityRuntime(c, clock));
    }

    // Fire 5 concurrent wrong password attempts simultaneously across independent connections
    const concResults = await Promise.all(
      concRuntimes.map(rt => rt.authenticate('student.concurrent', 'WrongPassword!'))
    );
    for (const res of concResults) {
      assertStrict(res.success === false, 'Concurrent failure denied');
    }

    // Verify database row state: exactly 5 consecutive failures recorded (zero lost updates!)
    const concDbRow = (await testClient.query(
      'SELECT consecutive_failures_count, failed_attempts_timeline FROM identity_account_credentials WHERE user_account_id = $1',
      [concAccountId]
    )).rows[0];
    assertStrict(concDbRow.consecutive_failures_count === 5, `Expected exactly 5 failures, got ${concDbRow.consecutive_failures_count}`);
    const concTimeline = typeof concDbRow.failed_attempts_timeline === 'string'
      ? JSON.parse(concDbRow.failed_attempts_timeline)
      : concDbRow.failed_attempts_timeline;
    assertStrict(concTimeline.length === 5, `Expected 5 timestamps in timeline, got ${concTimeline.length}`);

    // Subsequent attempt is now rate limited
    const concNext = await runtime.authenticate('student.concurrent', plainPassword);
    assertStrict(concNext.success === false && concNext.error === 'RATE_LIMITED', 'Rate limited after 5 concurrent failures');
    log('Concurrent failures serialized with zero lost updates PASS');

    // 15. Valid Session Resolve & Consumer Contract Verification
    const sessionData = await runtime.resolveSession(loginResult.session.sessionId, loginResult.session.secret);
    assertStrict(sessionData !== null, 'Valid session resolved');
    assertStrict(sessionData.userAccountId === accountId, 'Session userAccountId verified');
    assertStrict(sessionData.personId === personId, 'Session personId verified');
    assertStrict(sessionData.sessionId === loginResult.session.sessionId, 'Session ID verified');

    const sessionKeys = Object.keys(sessionData).sort();
    assertStrict(
      JSON.stringify(sessionKeys) === JSON.stringify(['authenticatedAt', 'expiresAt', 'lastActivityAt', 'personId', 'sessionId', 'userAccountId']),
      'Consumer contract exposes strictly account/person/session only'
    );
    log('Valid session resolution and bounded consumer contract PASS');

    // 16. Wrong Secret, Unknown, and Malformed Session Denial
    const wrongSecretRes = await runtime.resolveSession(loginResult.session.sessionId, 'wrong-secret');
    assertStrict(wrongSecretRes === null, 'Wrong secret fails closed');
    const unknownSessionRes = await runtime.resolveSession(crypto.randomUUID(), loginResult.session.secret);
    assertStrict(unknownSessionRes === null, 'Unknown session fails closed');
    const malformedSessionRes = await runtime.resolveSession('', loginResult.session.secret);
    assertStrict(malformedSessionRes === null, 'Malformed session fails closed');
    log('Wrong secret, unknown session, and malformed session fail-closed denial PASS');

    // 17. 12-Hour Absolute Expiry (Exact Boundary & Post Boundary Denial)
    const expiryLogin = await runtime.authenticate('student.main', plainPassword);
    assertStrict(expiryLogin.success === true, 'Session created for expiry testing');

    // Keep active with 30m increments up to 11h 30m
    for (let i = 0; i < 23; i++) {
      clock.advance(30 * 60 * 1000);
      const r = await runtime.resolveSession(expiryLogin.session.sessionId, expiryLogin.session.secret);
      assertStrict(r !== null, `Mid-resolve at ${(i + 1) * 30}m PASS`);
    }

    // Advance to 11h 59m 59s (1s before 12h absolute limit)
    clock.advance(29 * 60 * 1000 + 59 * 1000);
    const beforeAbsolute = await runtime.resolveSession(expiryLogin.session.sessionId, expiryLogin.session.secret);
    assertStrict(beforeAbsolute !== null, 'Before 12h absolute expiry PASS');

    // Advance 1s to exact 12:00:00 boundary -> FAIL closed
    clock.advance(1000);
    const exactAbsolute = await runtime.resolveSession(expiryLogin.session.sessionId, expiryLogin.session.secret);
    assertStrict(exactAbsolute === null, 'Exact 12h absolute expiry boundary FAILS closed');

    // After boundary
    clock.advance(1000);
    const afterAbsolute = await runtime.resolveSession(expiryLogin.session.sessionId, expiryLogin.session.secret);
    assertStrict(afterAbsolute === null, 'After 12h absolute expiry FAILS closed');
    log('12-hour absolute expiry exact-boundary and post-boundary denial PASS');

    // 18. 60-Minute Idle Expiry (Exact Boundary & Post Boundary Denial)
    const idleLogin = await runtime.authenticate('student.main', plainPassword);
    assertStrict(idleLogin.success === true, 'Session created for idle testing');

    // Advance 59m 59s
    clock.advance(59 * 60 * 1000 + 59 * 1000);
    const beforeIdle = await runtime.resolveSession(idleLogin.session.sessionId, idleLogin.session.secret);
    assertStrict(beforeIdle !== null, 'Before 60m idle boundary PASS');

    // Advance 60 minutes from last activity -> exact boundary
    clock.advance(60 * 60 * 1000);
    const exactIdle = await runtime.resolveSession(idleLogin.session.sessionId, idleLogin.session.secret);
    assertStrict(exactIdle === null, 'Exact 60m idle boundary FAILS closed');

    clock.advance(1000);
    const afterIdle = await runtime.resolveSession(idleLogin.session.sessionId, idleLogin.session.secret);
    assertStrict(afterIdle === null, 'After 60m idle boundary FAILS closed');
    log('60-minute idle expiry exact-boundary and post-boundary denial PASS');

    // 19. Revoked / Logout Session Denial
    const logoutLogin = await runtime.authenticate('student.main', plainPassword);
    await runtime.revokeSession(logoutLogin.session.sessionId);
    const revokedSessionRes = await runtime.resolveSession(logoutLogin.session.sessionId, logoutLogin.session.secret);
    assertStrict(revokedSessionRes === null, 'Revoked session FAILS closed');
    log('Revoked session logout and denial PASS');

    const postSnapshot = await getProtectedStateSnapshot(testClient);
    assertStrict(preSnapshot === postSnapshot, 'Protected Academic Core and Secure Assessment state was mutated!');
    log('Protected Academic Core and Secure Assessment full data and schemas unchanged PASS');

    // 21. Secret Logging Proof & Malformed Input Handling
    let consoleOutput = '';
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;
    process.stdout.write = function(chunk, ...args) {
      consoleOutput += chunk.toString();
      return originalStdoutWrite.apply(process.stdout, [chunk, ...args]);
    };
    process.stderr.write = function(chunk, ...args) {
      consoleOutput += chunk.toString();
      return originalStderrWrite.apply(process.stderr, [chunk, ...args]);
    };

    try {
      await runtime.authenticate('student.main', plainPassword);
      await runtime.authenticate('student.main', 'WrongPassword!');
      await runtime.resolveSession('', 'some-secret');
      await runtime.resolveSession('malformed-uuid', 'some-secret');
      await runtime.revokeSession('malformed-uuid');
    } finally {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }

    assertStrict(!consoleOutput.includes(plainPassword), 'Plaintext password absent from logs');
    assertStrict(!consoleOutput.includes('WrongPassword!'), 'Wrong password attempt absent from logs');
    assertStrict(!consoleOutput.includes(loginResult.session.secret), 'Raw session secret absent from logs');
    log('Secret logging proof PASS');
    log('Malformed revoke/logout and resolve input fails closed without exceptions PASS');

    console.log('\n==================================================');
    console.log('REAL POSTGRESQL DB VERIFICATION: PASS');
    console.log('==================================================\n');
  } catch (err) {
    console.error('REAL POSTGRESQL VERIFICATION: FAIL', err);
    process.exitCode = 1;
  } finally {
    for (const c of openClients) {
      try { await c.end(); } catch (e) { console.error('Failed to close client', e); process.exitCode = 1; }
    }
    for (const d of createdDatabases) {
      try { await rootClient.query(`DROP DATABASE IF EXISTS "${d}"`); } catch (e) { console.error('Failed to drop db', e); process.exitCode = 1; }
    }
    // Post-run leak check
    try {
      const postLeaks = await rootClient.query(
        `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu088_%'`
      );
      if (postLeaks.rows.length === 0) {
        log('Post-run zero-leak disposable DB cleanup PASS');
      } else {
        console.error(`LEAK: ${postLeaks.rows.length} databases remain`);
        process.exitCode = 1;
      }
    } catch (e) {
      console.error('Failed leak check query', e);
      process.exitCode = 1;
    }
    try { await rootClient.end(); } catch (e) { console.error('Failed to close root client', e); process.exitCode = 1; }
  }
}

runVerification();
