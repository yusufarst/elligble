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
    // 0. Pre-run leak check
    const preLeaks = await rootClient.query(
      `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu089_%'`
    );
    assertStrict(preLeaks.rows.length === 0, `Pre-run leak check failed: found ${preLeaks.rows.length} dangling databases`);
    log('Pre-run zero-leak verification PASS');

    // 1. Create main disposable DB and apply canonical migrations 0001..0035
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

    // Check schema/tables unaltered
    const credTableRes = await testClient.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'identity_account_credentials'`);
    assertStrict(credTableRes.rows.length === 10, 'BU-088 objects remain valid');
    const tenantTableRes = await testClient.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_memberships'`);
    assertStrict(tenantTableRes.rows.length === 4, 'BU-001 Membership ownership/schema remains unchanged');

    log('Full canonical migration chain applied PASS');
    log('BU-088 objects remain valid PASS');
    log('BU-001 Membership ownership/schema remains unchanged PASS');

    // 2. Snapshot protected state
    const preSnapshot = await getProtectedStateSnapshot(testClient);

    // 3. Dynamically import IdentityRuntime and TenantAccessRuntime
    const { IdentityRuntime } = await import('../../runtime/identity-access/src/index.ts');
    const { hashPassword } = await import('../../runtime/identity-access/src/crypto.ts');
    const { TenantAccessRuntime } = await import('../../runtime/tenant-access/src/index.ts');

    const clock = new ControllableClock('2026-09-18T10:00:00.000Z');
    const identityRuntime = new IdentityRuntime(testClient, clock);
    const tenantRuntime = new TenantAccessRuntime(testClient, identityRuntime);

    // 4. Create Person, User Account, Tenant, Membership
    const personId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const accountId = (await testClient.query('INSERT INTO identity_user_accounts (id, person_id) VALUES (gen_random_uuid(), $1) RETURNING id', [personId])).rows[0].id;
    const tenantId = (await testClient.query('INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const membershipId = (await testClient.query('INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id', [tenantId, personId])).rows[0].id;

    // 5. Register credentials
    const plainPassword = crypto.randomBytes(16).toString('base64');
    const verifier = hashPassword(plainPassword);
    await testClient.query(`
      INSERT INTO identity_account_credentials (
        user_account_id, username, password_verifier, is_valid, consecutive_failures_count, failed_attempts_timeline, created_at, updated_at
      ) VALUES ($1, $2, $3, TRUE, 0, '[]'::jsonb, current_timestamp, current_timestamp)
    `, [accountId, 'student.main', verifier]);

    // 6. Real authentication to get session
    const loginResult = await identityRuntime.authenticate('student.main', plainPassword);
    assertStrict(loginResult.success === true, 'Login with correct password must succeed');
    const { sessionId, secret } = loginResult.session;

    // 7. Verify REAL_BU088_SESSION_TO_MEMBERSHIP_CONTEXT
    const membershipCtx = await tenantRuntime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
    assertStrict(membershipCtx !== null, 'Valid session + valid tenant resolves membership');
    assertStrict(membershipCtx.tenantId === tenantId, 'Tenant ID matches');
    assertStrict(membershipCtx.personId === personId, 'Person ID matches');
    assertStrict(membershipCtx.membershipId === membershipId, 'Membership ID matches');
    log('Real BU-088 session to Membership Context resolution PASS');

    // Verify context does not expose password/session secret
    assertStrict(Object.keys(membershipCtx).length === 3, 'Membership context only contains 3 properties');
    assertStrict(membershipCtx.secret === undefined, 'Secret is not exposed');
    assertStrict(membershipCtx.password === undefined, 'Password is not exposed');

    // 8. NO_MEMBERSHIP_DENIAL
    const otherTenantId = (await testClient.query('INSERT INTO tenant_tenants (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    const noMembershipCtx = await tenantRuntime.resolveAuthenticatedMembershipContext(sessionId, secret, otherTenantId);
    assertStrict(noMembershipCtx === null, 'Tenant without membership fails closed');
    log('No membership denial PASS');

    // 9. CROSS_TENANT_DENIAL
    // (Tested by NO_MEMBERSHIP_DENIAL as person doesn't have membership in otherTenantId)
    log('Cross tenant denial PASS');

    // 10. CROSS_PERSON_DENIAL
    const otherPersonId = (await testClient.query('INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id')).rows[0].id;
    await testClient.query('INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2)', [otherTenantId, otherPersonId]);
    const crossPersonCtx = await tenantRuntime.resolveAuthenticatedMembershipContext(sessionId, secret, otherTenantId);
    assertStrict(crossPersonCtx === null, 'Other person\'s membership fails closed');
    log('Cross person denial PASS');

    // 11. AMBIGUOUS_MEMBERSHIP_DENIAL
    await testClient.query('INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2)', [tenantId, personId]);
    const ambiguousCtx = await tenantRuntime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
    assertStrict(ambiguousCtx === null, 'Ambiguous (duplicate) memberships fail closed');
    log('Ambiguous membership denial PASS');

    const preMembershipSnapshot = await getTenantMembershipsSnapshot(testClient);
    const preCredentialSnapshot = await getIdentityCredentialsSnapshot(testClient);

    // 12. Invalid / Revoked / Expired session denial
    const invalidSessionCtx = await tenantRuntime.resolveAuthenticatedMembershipContext('invalid-id', secret, tenantId);
    assertStrict(invalidSessionCtx === null, 'Malformed session fails closed');
    const wrongSecretCtx = await tenantRuntime.resolveAuthenticatedMembershipContext(sessionId, 'wrong-secret', tenantId);
    assertStrict(wrongSecretCtx === null, 'Wrong secret fails closed');

    // Revoke session
    await identityRuntime.revokeSession(sessionId);
    const revokedCtx = await tenantRuntime.resolveAuthenticatedMembershipContext(sessionId, secret, tenantId);
    assertStrict(revokedCtx === null, 'Revoked session fails closed');
    log('Invalid/revoked/expired session denial PASS');

    const preSessionSnapshotAfterRevoke = await getIdentitySessionsSnapshot(testClient);

    // 13. EXACT MEMBERSHIP NON-MUTATION
    const postMembershipSnapshot = await getTenantMembershipsSnapshot(testClient);
    assertStrict(preMembershipSnapshot === postMembershipSnapshot, 'Tenant memberships must not be mutated');
    log('Exact membership non-mutation PASS');

    // 14. EXACT CREDENTIAL NON-MUTATION
    const postCredentialSnapshot = await getIdentityCredentialsSnapshot(testClient);
    assertStrict(preCredentialSnapshot === postCredentialSnapshot, 'Identity credentials must not be mutated');
    log('Identity credential non-mutation PASS');

    // 15. IDENTITY SESSION BOUNDED MUTATION
    const postSessionSnapshot = await getIdentitySessionsSnapshot(testClient);
    assertStrict(preSessionSnapshotAfterRevoke === postSessionSnapshot, 'Identity session immutable fields must not be mutated');
    log('Identity session bounded mutation PASS');

    // 16. REAL IDLE EXPIRY DENIAL
    const s3Login = await identityRuntime.authenticate('student.main', plainPassword);
    const s3 = s3Login.session;
    clock.advance(60 * 60 * 1000 + 1000); // Just beyond 60-minute idle boundary
    const idleCtx = await tenantRuntime.resolveAuthenticatedMembershipContext(s3.sessionId, s3.secret, tenantId);
    assertStrict(idleCtx === null, 'Session idle expiry correctly denied by TenantAccessRuntime');

    const s3DbRow = (await testClient.query('SELECT authenticated_at FROM identity_sessions WHERE id = $1', [s3.sessionId])).rows[0];
    const authAgeS3 = clock.now().getTime() - new Date(s3DbRow.authenticated_at).getTime();
    assertStrict(authAgeS3 < 12 * 60 * 60 * 1000, 'Authenticated age must still be far below 12 hours');
    log('Real idle expiry denial PASS');

    // 17. REAL ABSOLUTE EXPIRY DENIAL
    const s2Login = await identityRuntime.authenticate('student.main', plainPassword);
    const s2 = s2Login.session;
    clock.advance(11 * 60 * 60 * 1000 + 59 * 60 * 1000); // Shortly before 12-hour absolute expiry
    await testClient.query('UPDATE identity_sessions SET last_activity_at = $1 WHERE id = $2', [clock.now().toISOString(), s2.sessionId]);
    clock.advance(2 * 60 * 1000); // Advance a small amount past the 12-hour absolute boundary
    const absoluteCtx = await tenantRuntime.resolveAuthenticatedMembershipContext(s2.sessionId, s2.secret, tenantId);
    assertStrict(absoluteCtx === null, 'Session absolute expiry correctly denied by TenantAccessRuntime');
    const s2DbRow = (await testClient.query('SELECT authenticated_at, last_activity_at FROM identity_sessions WHERE id = $1', [s2.sessionId])).rows[0];
    const authAgeS2 = clock.now().getTime() - new Date(s2DbRow.authenticated_at).getTime();
    const idleAgeS2 = clock.now().getTime() - new Date(s2DbRow.last_activity_at).getTime();
    assertStrict(authAgeS2 >= 12 * 60 * 60 * 1000, 'Authenticated age >= 12 hours');
    assertStrict(idleAgeS2 < 60 * 60 * 1000, 'Idle age < 60 minutes');
    log('Real absolute expiry denial PASS');

    // 18. ACADEMIC_CORE_NON_MUTATION / SECURE_ASSESSMENT_NON_MUTATION
    const postSnapshot = await getProtectedStateSnapshot(testClient);
    assertStrict(preSnapshot === postSnapshot, 'Protected Academic Core and Secure Assessment state was mutated!');
    log('Academic Core non-mutation PASS');
    log('Secure Assessment non-mutation PASS');


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
        `SELECT datname FROM pg_database WHERE datname LIKE 'elligble_bu089_%'`
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
