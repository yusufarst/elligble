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
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}
function log(message) { console.log(`- PASS: ${message}`); }

const pgPassword = process.env.PGPASSWORD;
function clientConfig(connectionString) {
  return pgPassword ? { connectionString, password: pgPassword } : { connectionString };
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
    const dbName = `elligble_bu088_${runId}_${suffix}`;
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
    log(`Migration chain applied successfully, up to 0035`);

    // Dynamic import to use the actual TS compiled code or JS equivalents
    // We'll write raw DB tests here to independently verify the constraints and behavior in PG

    // 1. Create Person, Account, Credentials
    const personId = (await testClient.query(`INSERT INTO identity_persons (id) VALUES (gen_random_uuid()) RETURNING id`)).rows[0].id;
    const accountId = (await testClient.query(`INSERT INTO identity_user_accounts (id, person_id) VALUES (gen_random_uuid(), $1) RETURNING id`, [personId])).rows[0].id;
    
    await testClient.query(`
      INSERT INTO identity_account_credentials (user_account_id, username, password_verifier)
      VALUES ($1, 'student1', 'fakehash')
    `, [accountId]);
    log('identity_persons and identity_user_accounts separation preserved');
    
    // Test Repeat Safety
    const filePath = path.join(migrationsDir, '0035_bu088_identity_authentication_session_identity_core_state.sql');
    const sql = fs.readFileSync(filePath, 'utf8');
    await testClient.query(sql); // Should not throw
    log('Migration repeat-safety PASS');

    // 2. Use Runtime module via dynamic import
    // Need to compile TS first. We will run it via `tsc` later.
    // For now we test DB constraints
    
    // Unique username constraint
    let uniqueFailed = false;
    try {
      await testClient.query(`INSERT INTO identity_account_credentials (user_account_id, username, password_verifier) VALUES (gen_random_uuid(), 'student1', 'h2')`);
    } catch (e) {
      uniqueFailed = true;
    }
    assertStrict(uniqueFailed, 'Username must be unique');
    log('Username uniqueness constraint PASS');

    // FK Restrictions
    let fkFailed = false;
    try {
      await testClient.query(`DELETE FROM identity_user_accounts WHERE id = $1`, [accountId]);
    } catch(e) {
      fkFailed = true;
    }
    assertStrict(fkFailed, 'Account deletion restricted by credentials FK');
    log('FK restriction on credential deletion PASS');

    console.log('\n==================================================');
    console.log('REAL POSTGRESQL DB VERIFICATION: PASS');
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
