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

  const state = {};
  for (const tbl of allTables) {
    const res = await client.query(`SELECT (row_to_json(t.*)::jsonb) as row_data FROM public.${tbl} t ORDER BY t::text`);
    state[tbl] = res.rows.map(r => r.row_data);
  }

  return JSON.stringify({ state });
}

async function getTenantMembershipsSnapshot(client) {
  const res = await client.query(`SELECT (row_to_json(t.*)::jsonb) as row_data FROM tenant_memberships t ORDER BY id::text`);
  return JSON.stringify(res.rows.map(r => r.row_data));
}

async function getIdentityCredentialsSnapshot(client) {
  const res = await client.query(`SELECT (row_to_json(t.*)::jsonb) as row_data FROM identity_account_credentials t ORDER BY user_account_id::text, username::text`);
  return JSON.stringify(res.rows.map(r => r.row_data));
}

async function getIdentitySessionsSnapshot(client) {
  const res = await client.query(`
    SELECT id, user_account_id, session_secret_verifier, is_revoked, authenticated_at, expires_at
    FROM identity_sessions
    ORDER BY id::text
  `);
  return JSON.stringify(res.rows);
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
    const dbName = `elligble_bu089_${runId}_${suffix}`;
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
    const preLeaks = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu089_%'`
    );
    assertStrict(preLeaks.rows.length === 0, `Pre-run leak check failed: found ${preLeaks.rows.length} dangling databases`);
    log('Pre-run zero-leak verification PASS');

    const { testClient } = await createDisposableDb('main');
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const allMigrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    for (const file of allMigrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      await testClient.query(sql);
    }

    const { IdentityRuntime, POLICY } = await import('../../runtime/identity-access/src/index.ts');
    const { hashPassword } = await import('../../runtime/identity-access/src/crypto.ts');
    const { TenantAccessRuntime } = await import('../../runtime/tenant-access/src/index.ts');

    const clock = new ControllableClock('2026-09-18T10:00:00.000Z');
    const identityRuntime = new IdentityRuntime(testClient, clock);
    const tenantRuntime = new TenantAccessRuntime(testClient, identityRuntime);

    // 1. Authenticated Person
    const personId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    // 2. User Account
    const accountId = (await testClient.query('INSERT INTO identity_user_accounts (id, person_id) VALUES (gen_random_uuid(), $1) RETURNING id', [personId])).rows[0].id;
    // 3. Primary Tenant
    const tenantId = (await testClient.query('INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    // 4. Valid primary Membership
    const membershipId = (await testClient.query('INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id', [tenantId, personId])).rows[0].id;

    // 5. secondary/no-membership Tenant
    const secondTenantId = (await testClient.query('INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;

    // 6. Second Person
    const secondPersonId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;

    // 7. cross-person Membership
    const crossPersonTenantId = (await testClient.query('INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    await testClient.query('INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2)', [crossPersonTenantId, secondPersonId]);

    // 8. Ambiguous Tenant
    const ambiguousTenantId = (await testClient.query('INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    // 9. Two ambiguous Membership rows for authenticated Person
    await testClient.query('INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2)', [ambiguousTenantId, personId]);
    await testClient.query('INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2)', [ambiguousTenantId, personId]);

    // 10. Synthetic credential
    const plainPassword = crypto.randomBytes(16).toString('base64');
    const verifier = hashPassword(plainPassword);
    await testClient.query(`
      INSERT INTO identity_account_credentials (
        user_account_id, username, password_verifier, is_valid, consecutive_failures_count, failed_attempts_timeline, created_at, updated_at
      ) VALUES ($1, $2, $3, TRUE, 0, '[]'::jsonb, current_timestamp, current_timestamp)
    `, [accountId, 'student.main', verifier]);

    // 11. primary valid BU-088 session
    const primaryLogin = await identityRuntime.authenticate('student.main', plainPassword);
    const primarySession = primaryLogin.session;

    // 12. dedicated revoked BU-088 session
    const revokedLogin = await identityRuntime.authenticate('student.main', plainPassword);
    const revokedSession = revokedLogin.session;
    // 13. revoke dedicated revoked session
    await identityRuntime.revokeSession(revokedSession.sessionId);

    // 14. dedicated idle-expiry BU-088 session
    const idleLogin = await identityRuntime.authenticate('student.main', plainPassword);
    const idleSession = idleLogin.session;

    // 15. dedicated absolute-expiry BU-088 session
    const absoluteLogin = await identityRuntime.authenticate('student.main', plainPassword);
    const absoluteSession = absoluteLogin.session;

    // CAPTURE PRE_SNAPSHOTS (All authentication calls that create sessions are finished)
    const preMembershipSnapshot = await getTenantMembershipsSnapshot(testClient);
    const preCredentialSnapshot = await getIdentityCredentialsSnapshot(testClient);
    const preSessionSnapshot = await getIdentitySessionsSnapshot(testClient);
    const PRE_PROTECTED_STATE = await getProtectedStateSnapshot(testClient);

    // RUN TENANT ACCESS CASES

    // Case 1: valid session + valid membership => PASS
    const ctx1 = await tenantRuntime.resolveAuthenticatedMembershipContext(primarySession.sessionId, primarySession.secret, tenantId);
    assertStrict(ctx1 !== null && ctx1.membershipId === membershipId, 'Valid session + valid membership resolves successfully');
    log('REAL BU-088 SESSION TO MEMBERSHIP CONTEXT PASS');

    // Case 2: no membership => deny
    const ctx2 = await tenantRuntime.resolveAuthenticatedMembershipContext(primarySession.sessionId, primarySession.secret, secondTenantId);
    assertStrict(ctx2 === null, 'No membership => deny');
    log('NO MEMBERSHIP DENIAL PASS');

    // Case 3: cross-tenant => deny
    const ctx3 = await tenantRuntime.resolveAuthenticatedMembershipContext(primarySession.sessionId, primarySession.secret, crossPersonTenantId);
    assertStrict(ctx3 === null, 'Cross tenant => deny');
    log('CROSS TENANT DENIAL PASS');

    // Case 4: cross-person => deny
    const ctx4 = await tenantRuntime.resolveAuthenticatedMembershipContext(primarySession.sessionId, primarySession.secret, crossPersonTenantId);
    assertStrict(ctx4 === null, 'Cross person => deny');
    log('CROSS PERSON DENIAL PASS');

    // Case 5: ambiguous duplicate membership => deny
    const ctx5 = await tenantRuntime.resolveAuthenticatedMembershipContext(primarySession.sessionId, primarySession.secret, ambiguousTenantId);
    assertStrict(ctx5 === null, 'Ambiguous membership => deny');
    log('AMBIGUOUS MEMBERSHIP DENIAL PASS');

    // Case 6: unknown tenant UUID => deny
    const randomTenantId = '00000000-0000-0000-0000-000000000000';
    const ctx6 = await tenantRuntime.resolveAuthenticatedMembershipContext(primarySession.sessionId, primarySession.secret, randomTenantId);
    assertStrict(ctx6 === null, 'Unknown tenant UUID => deny');
    log('UNKNOWN TENANT DENIAL PASS');

    // Case 7: malformed tenant ID => deny
    const ctx7 = await tenantRuntime.resolveAuthenticatedMembershipContext(primarySession.sessionId, primarySession.secret, 'not-a-uuid');
    assertStrict(ctx7 === null, 'Malformed tenant ID => deny');

    // Case 8: malformed session ID => deny
    const ctx8 = await tenantRuntime.resolveAuthenticatedMembershipContext('not-a-uuid', primarySession.secret, tenantId);
    assertStrict(ctx8 === null, 'Malformed session ID => deny');

    // Case 9: wrong session secret => deny
    const ctx9 = await tenantRuntime.resolveAuthenticatedMembershipContext(primarySession.sessionId, 'wrong-secret', tenantId);
    assertStrict(ctx9 === null, 'Wrong session secret => deny');

    // Case 10: revoked real session => deny
    const ctx10 = await tenantRuntime.resolveAuthenticatedMembershipContext(revokedSession.sessionId, revokedSession.secret, tenantId);
    assertStrict(ctx10 === null, 'Revoked real session => deny');

    // Case 11: isolated real idle expiry => deny
    clock.advance(POLICY.IDLE_EXPIRY_MS + 1000); // Advance clock past idle expiry
    const idleDbRow = (await testClient.query('SELECT authenticated_at FROM identity_sessions WHERE id = $1', [idleSession.sessionId])).rows[0];
    const authAgeIdle = clock.now().getTime() - new Date(idleDbRow.authenticated_at).getTime();
    assertStrict(authAgeIdle < POLICY.ABSOLUTE_EXPIRY_MS, 'Idle expiry proof: authenticated age < ABSOLUTE_EXPIRY_MS');

    const ctx11 = await tenantRuntime.resolveAuthenticatedMembershipContext(idleSession.sessionId, idleSession.secret, tenantId);
    assertStrict(ctx11 === null, 'Isolated real idle expiry => deny');
    log('REAL IDLE EXPIRY DENIAL PASS');

    // Case 12: isolated real absolute expiry => deny
    clock.advance(POLICY.ABSOLUTE_EXPIRY_MS - authAgeIdle + 1000); // Advance clock past absolute expiry

    // Refresh only dedicated absolute session last_activity_at as verifier fixture
    await testClient.query('UPDATE identity_sessions SET last_activity_at = $1 WHERE id = $2', [clock.now().toISOString(), absoluteSession.sessionId]);

    const absDbRow = (await testClient.query('SELECT authenticated_at, last_activity_at FROM identity_sessions WHERE id = $1', [absoluteSession.sessionId])).rows[0];
    const authAgeAbs = clock.now().getTime() - new Date(absDbRow.authenticated_at).getTime();
    const idleAgeAbs = clock.now().getTime() - new Date(absDbRow.last_activity_at).getTime();
    assertStrict(authAgeAbs >= POLICY.ABSOLUTE_EXPIRY_MS, 'Absolute expiry proof: authenticated age >= ABSOLUTE_EXPIRY_MS');
    assertStrict(idleAgeAbs < POLICY.IDLE_EXPIRY_MS, 'Absolute expiry proof: idle age < IDLE_EXPIRY_MS');

    const ctx12 = await tenantRuntime.resolveAuthenticatedMembershipContext(absoluteSession.sessionId, absoluteSession.secret, tenantId);
    assertStrict(ctx12 === null, 'Isolated real absolute expiry => deny');
    log('REAL ABSOLUTE EXPIRY DENIAL PASS');


    // CAPTURE POST SNAPSHOTS
    const postMembershipSnapshot = await getTenantMembershipsSnapshot(testClient);
    const postCredentialSnapshot = await getIdentityCredentialsSnapshot(testClient);
    const postSessionSnapshot = await getIdentitySessionsSnapshot(testClient);
    const POST_PROTECTED_STATE = await getProtectedStateSnapshot(testClient);

    // ASSERTIONS
    assertStrict(preMembershipSnapshot === postMembershipSnapshot, 'preMembershipSnapshot === postMembershipSnapshot');
    log('EXACT MEMBERSHIP NON-MUTATION PASS');

    assertStrict(preCredentialSnapshot === postCredentialSnapshot, 'preCredentialSnapshot === postCredentialSnapshot');
    log('IDENTITY CREDENTIAL NON-MUTATION PASS');

    assertStrict(preSessionSnapshot === postSessionSnapshot, 'preSessionSnapshot === postSessionSnapshot');
    log('IDENTITY SESSION BOUNDED MUTATION PASS');

    assertStrict(PRE_PROTECTED_STATE === POST_PROTECTED_STATE, 'PRE_PROTECTED_STATE == POST_PROTECTED_STATE');
    log('ACADEMIC CORE NON-MUTATION PASS');
    log('SECURE ASSESSMENT NON-MUTATION PASS');

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
    try {
      const postLeaks = await rootClient.query(
        `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu089_%'`
      );
      if (postLeaks.rows.length === 0) {
        log('POST-RUN ZERO-LEAK PASS');
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
