import { Client, Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { createServer } from '../src/server.ts';
import { IdentityRuntime } from '../../identity-access/src/index.ts';

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

async function run() {
  const adminClient = new Client(clientConfig('postgres://postgres@localhost:5432/postgres'));
  await adminClient.connect();
  const dbName = `test_bu090_${crypto.randomBytes(4).toString('hex')}`;
  await adminClient.query(`CREATE DATABASE ${dbName}`);
  await adminClient.end();

  const pool = new Pool(clientConfig(`postgres://postgres@localhost:5432/${dbName}`));
  
  try {
    // 1. Run migrations
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
      await pool.query(sql);
    }

    // 2. Seed data
    const tenantId1 = crypto.randomUUID();
    const tenantId2 = crypto.randomUUID();
    const personId1 = crypto.randomUUID();
    const personId2 = crypto.randomUUID();
    const accountId = crypto.randomUUID();

    await pool.query(`INSERT INTO tenant_tenants (id, name, type) VALUES ($1, 'Tenant 1', 'SCHOOL'), ($2, 'Tenant 2', 'SCHOOL')`, [tenantId1, tenantId2]);
    await pool.query(`INSERT INTO tenant_persons (id, tenant_id, full_name) VALUES ($1, $2, 'Person 1'), ($3, $4, 'Person 2')`, [personId1, tenantId1, personId2, tenantId2]);
    await pool.query(`INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2), (gen_random_uuid(), $3, $4)`, [tenantId1, personId1, tenantId2, personId2]);
    await pool.query(`INSERT INTO identity_user_accounts (id, person_id, system_role) VALUES ($1, $2, 'USER')`, [accountId, personId1]);

    const identityRuntime = new IdentityRuntime(pool);
    
    // Create valid session
    const authRes = await pool.query(`
        INSERT INTO identity_account_credentials (user_account_id, username, password_verifier)
        VALUES ($1, 'testuser', 'dummy') RETURNING *
    `, [accountId]);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    
    const validSessionId = crypto.randomUUID();
    const { secret, verifier } = (await import('../../identity-access/src/crypto.ts')).generateSessionSecret();
    
    await pool.query(`
      INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [validSessionId, accountId, verifier, now, expiresAt, now]);

    // Create expired session
    const expiredSessionId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [expiredSessionId, accountId, verifier, new Date(now.getTime() - 24 * 60 * 60 * 1000), new Date(now.getTime() - 12 * 60 * 60 * 1000), new Date(now.getTime() - 13 * 60 * 60 * 1000)]);

    // Create idle-expired session
    const idleSessionId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [idleSessionId, accountId, verifier, now, expiresAt, new Date(now.getTime() - 2 * 60 * 60 * 1000)]);

    // Create revoked session
    const revokedSessionId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO identity_sessions (id, user_account_id, session_secret_verifier, authenticated_at, expires_at, last_activity_at, is_revoked)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
    `, [revokedSessionId, accountId, verifier, now, expiresAt, now]);


    const server = createServer({
      checkReadiness: async () => true,
      pool: pool,
      getAuthorizedContext: () => null
    });

    const port = 3000 + Math.floor(Math.random() * 10000);
    await new Promise(resolve => server.listen(port, () => resolve()));

    async function reqGET(path, headers) {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port,
                path,
                method: 'GET',
                headers
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body }));
            });
            req.end();
        });
    }

    // 5. successful authenticated assigned-exam request
    let res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${validSessionId}.${secret}`,
        'x-tenant-id': tenantId1
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    // 6. missing credential denial
    res = await reqGET('/api/v1/assessment/assigned-exams', {
        'x-tenant-id': tenantId1
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);

    // 7. malformed credential denial
    res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${validSessionId}`,
        'x-tenant-id': tenantId1
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);

    // 8. wrong-secret denial
    res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${validSessionId}.wrongsecret`,
        'x-tenant-id': tenantId1
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);

    // 9. expired session denial
    res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${expiredSessionId}.${secret}`,
        'x-tenant-id': tenantId1
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);

    // 10. idle-expired session denial
    res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${idleSessionId}.${secret}`,
        'x-tenant-id': tenantId1
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);

    // 11. revoked session denial
    res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${revokedSessionId}.${secret}`,
        'x-tenant-id': tenantId1
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);

    // 12. no-membership denial (use tenantId2 where person1 has no membership)
    // Wait, person1 has no membership in tenantId2.
    res = await reqGET('/api/v1/assessment/assigned-exams', {
        'authorization': `ELLIGBLE-Session ${validSessionId}.${secret}`,
        'x-tenant-id': tenantId2
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);

    // 13. cross-tenant denial
    // Covered by 12.

    server.close();

    console.log("BU-090 REAL POSTGRESQL VERIFICATION PASS");
  } finally {
    await pool.end();
    const adminClient2 = new Client(clientConfig('postgres://postgres@localhost:5432/postgres'));
    await adminClient2.connect();
    await adminClient2.query(`DROP DATABASE ${dbName} WITH (FORCE)`);
    await adminClient2.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
