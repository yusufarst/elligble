import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTeachingContext, createTenant } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { lockClaim, observeClaim } from '../../../identity-access/src/claims.ts';
import { revokeAccountSessions } from '../../src/ops/provisioning/sessions.ts';

// SEC-OPS-001 real PostgreSQL oracles (record §9/§6A, C01–C07). Synthetic data only. The CLI
// runs as a real process; contention uses the coordinator with a pausable pool and real locks
// observed through pg_blocking_pids. Teardown releases every barrier and held client first,
// so a failure can never hang the run.

const CLI = fileURLToPath(new URL('../../src/ops/provision-cli.ts', import.meta.url));
const LEASED = new Set<pg.PoolClient>();
const OPEN_GATES = new Set<{ release: () => void }>();
function tracked(pool: pg.Pool): pg.Pool {
    return new Proxy(pool, { get(target, property) {
        if (property === 'connect') return async () => {
            const client = await target.connect();
            LEASED.add(client);
            const release = client.release.bind(client);
            client.release = ((err?: Error | boolean) => { LEASED.delete(client); return release(err); }) as typeof client.release;
            return client;
        };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}
async function disposable(options: { migrate?: boolean } = {}) {
    const db = await createDisposableDatabase(options);
    return { ...db, pool: tracked(db.pool), close: () => db.close() };
}
async function teardown(app: { close(): Promise<void> } | null, db: { close(): Promise<void> }) {
    for (const g of OPEN_GATES) g.release();
    OPEN_GATES.clear();
    for (const client of [...LEASED]) { LEASED.delete(client); try { client.release(true); } catch { /* released */ } }
    if (app) await app.close();
    await db.close();
}

interface Gate { matches: (sql: string, params: unknown[]) => boolean; reached: Promise<void>; arrive: () => void; proceed: Promise<void>; release: () => void; pid: number }
function gate(matches: Gate['matches']): Gate {
    let arrive!: () => void, release!: () => void;
    const reached = new Promise<void>(r => { arrive = r; }), proceed = new Promise<void>(r => { release = r; });
    const g = { matches, reached, arrive, proceed, release, pid: 0 };
    OPEN_GATES.add(g);
    return g;
}
type GateRef = { current: Gate | null };
function gatedClient<T extends pg.ClientBase>(client: T, ref: GateRef): T {
    return new Proxy(client, { get(target, property) {
        if (property === 'query') return async (...args: unknown[]) => {
            const result = await Reflect.apply(target.query, target, args);
            const g = ref.current, sql = typeof args[0] === 'string' ? args[0] : '', params = Array.isArray(args[1]) ? args[1] : [];
            if (g && g.matches(sql, params)) {
                ref.current = null;
                g.pid = (await target.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
                g.arrive();
                await g.proceed;
            }
            return result;
        };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}
function gatedPool(pool: pg.Pool, ref: GateRef): pg.Pool {
    return new Proxy(pool, { get(target, property) {
        if (property === 'connect') return async () => gatedClient(await target.connect(), ref);
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}
function settled<T>(p: Promise<T>) { return p.then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error })); }
async function blockedBy(watch: pg.PoolClient, pid: number, pending: Promise<unknown>) {
    let finished = false; void pending.then(() => { finished = true; }, () => { finished = true; });
    const until = Date.now() + 15000;
    while (Date.now() < until) {
        if (finished) throw new Error('Writer finished before contention was observed');
        const r = await watch.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))`, [pid]);
        if (r.rows[0].n > 0) return;
    }
    throw new Error('No real PostgreSQL contention observed');
}
async function reached(g: Gate, pending: Promise<unknown>, label: string) {
    await Promise.race([g.reached, pending.then(() => { throw new Error(`${label} missed its barrier`); })]);
}
async function snapshot(pool: pg.Pool, tables: readonly string[]) {
    const result: Record<string, unknown> = {};
    for (const table of tables) result[table] = (await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    return result;
}
const STATE = ['identity_sessions', 'platform_provisioning_events', 'identity_account_credentials', 'identity_account_activations'];

interface School { tenant: string; group: string; year: string; period: string }
async function school(pool: pg.Pool, label: string | null = null): Promise<School> {
    const tenant = await createTenant(pool, label), staff = await createPersonWithAccount(pool), membership = await addMembership(pool, tenant, staff.personId);
    const teaching = await createTeachingContext(pool, tenant, membership);
    const year = (await pool.query('SELECT academic_year_id FROM academic_core_academic_groups WHERE id=$1', [teaching.academicGroupId])).rows[0].academic_year_id as string;
    const period = (await pool.query(`SELECT o.academic_period_id FROM academic_core_subject_offerings o JOIN academic_core_teaching_assignments a ON a.subject_offering_id=o.id WHERE a.id=$1`, [teaching.teachingAssignmentId])).rows[0].academic_period_id as string;
    return { tenant, group: teaching.academicGroupId, year, period };
}
let seq = 0;
/** An activated Student with a bound roster record (NISN and birth date are synthetic). */
async function student(pool: pg.Pool, s: School) {
    seq++;
    const account = await createPersonWithAccount(pool);
    await addMembership(pool, s.tenant, account.personId);
    const nisn = `08${String(seq).padStart(8, '0')}`;
    await pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id, source_student_key, full_name, nis, nisn, date_of_birth,
        academic_year_id, academic_period_id, academic_group_id, person_id) VALUES($1,$2,$3,$4,$5,'2010-07-17',$6,$7,$8,$9)`,
    [s.tenant, `sec-${seq}-${randomUUID().slice(0, 6)}`, `Siswa Insiden ${seq}`, `si-${seq}-${randomUUID().slice(0, 4)}`, nisn, s.year, s.period, s.group, account.personId]);
    return { ...account, nisn };
}
async function signIn(baseUrl: string, s: School, account: { username: string; password: string }) {
    const c = new BrowserLikeClient(baseUrl);
    assert.equal((await c.login(account.username, account.password)).status, 200);
    c.tenantId = s.tenant;
    return c;
}
async function verifier(pool: pg.Pool, s: School, baseUrl: string) {
    const v = await createPersonWithAccount(pool); await addMembership(pool, s.tenant, v.personId);
    const c = await pool.connect();
    try { await c.query('BEGIN'); await setSchoolOperator(c, { tenantId: s.tenant, personId: v.personId, action: 'ASSIGN', operator: 'Synthetic', caseReference: 'SEC-OPS-001', reason: 'Synthetic verifier' }); await c.query('COMMIT'); }
    catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    return { account: v, client: await signIn(baseUrl, s, v) };
}
const CONTEXT = { operator: 'Pemilik Platform', caseReference: 'INC-SINTETIS' };
const revoke = (pool: pg.Pool, tenantId: string, elligbleId: string, dryRun = false) =>
    revokeAccountSessions(pool, { tenantId, elligbleId, reason: 'Insiden sintetis', context: CONTEXT, dryRun });
const live = async (pool: pg.Pool, accountId: string) => (await pool.query('SELECT count(*)::int AS n FROM identity_sessions WHERE user_account_id=$1 AND is_revoked=FALSE', [accountId])).rows[0].n as number;
const audits = async (pool: pg.Pool, accountId: string) => (await pool.query(`SELECT * FROM platform_provisioning_events WHERE action='sessions_revoked' AND summary->>'userAccountId'=$1 ORDER BY occurred_at, id`, [accountId])).rows;
const atCredential = (accountId: string) => (sql: string, params: unknown[]) => sql.includes('FROM identity_account_credentials WHERE user_account_id = $1 FOR UPDATE') && params[0] === accountId;
const atSessionsUpdate = (sql: string) => sql.includes('UPDATE identity_sessions SET is_revoked = TRUE WHERE user_account_id = $1');
const atLogin = (sql: string) => sql.includes('c.password_verifier, c.is_valid') && sql.includes('FOR UPDATE OF c');
const atActorSession = (sql: string) => sql.includes('FROM identity_sessions s') && sql.includes('FOR UPDATE OF s');

test('SEC-OPS-001 C01/C02/C03/C06 the CLI revokes, refuses and dry-runs with exact audit and bounded output', { skip: skipWithoutDatabase, timeout: 180000 }, async t => {
    const db = await disposable(); const app = await startProductionWiredServer(db.pool);
    t.after(() => teardown(app, db));
    const cli = (...args: string[]) => {
        const r = spawnSync(process.execPath, [CLI, 'session', 'revoke', ...args], { env: { ...process.env, DATABASE_URL: db.url }, encoding: 'utf8' });
        return { code: r.status, out: r.stdout + r.stderr };
    };
    const audit = ['--operator', ' Pemilik Platform ', '--case', 'INC-2026-001'];
    const s = await school(db.pool, 'SMA Insiden Contoh'), other = await school(db.pool, 'SMA Lain Contoh'), third = await school(db.pool);
    const target = await student(db.pool, s);
    await addMembership(db.pool, other.tenant, target.personId);
    await addMembership(db.pool, third.tenant, target.personId);
    const first = await signIn(app.baseUrl, s, target), second = await signIn(app.baseUrl, other, target);
    const bystander = await student(db.pool, s), bystanderClient = await signIn(app.baseUrl, s, bystander);
    const foreign = await student(db.pool, other as School);
    const sessionIds = (await db.pool.query('SELECT id FROM identity_sessions WHERE user_account_id=$1', [target.accountId])).rows.map(r => r.id as string);
    assert.equal(sessionIds.length, 2);
    assert.equal((await first.request('/api/v1/auth/session')).status, 200);

    // C02 + C03: refusals and the dry run change nothing and write no audit row.
    const before = await snapshot(db.pool, STATE);
    const outputs: string[] = [];
    const refusals: Array<[string[], number, RegExp]> = [
        [['--tenant', s.tenant, '--elligble-id', 'elg-tidak-ada-sama-sekali', '--reason', 'Uji', ...audit], 1, /no account with this ELLIGBLE ID in this school/],
        [['--tenant', s.tenant, '--elligble-id', foreign.username, '--reason', 'Uji', ...audit], 1, /no account with this ELLIGBLE ID in this school/],
        [['--tenant', randomUUID(), '--elligble-id', target.username, '--reason', 'Uji', ...audit], 1, /no account with this ELLIGBLE ID in this school/],
        [['--tenant', s.tenant, '--elligble-id', target.username, ...audit], 2, /--reason is required/],
        [['--tenant', s.tenant, '--elligble-id', target.username, '--reason', 'Uji', '--dry-run'], 2, /--operator and --case are required/],
        [['--tenant', s.tenant, '--elligble-id', target.username, '--reason', 'Uji', '--operator', 'x'], 2, /--operator and --case are required/],
    ];
    for (const [args, code, message] of refusals) {
        const r = cli(...args); outputs.push(r.out);
        assert.equal(r.code, code, `${args.join(' ')} -> ${r.out}`);
        assert.match(r.out, message);
    }
    const dry = cli('--tenant', s.tenant, '--elligble-id', target.username, '--reason', 'Sesi dicurigai diambil alih', ...audit, '--dry-run');
    outputs.push(dry.out);
    assert.equal(dry.code, 0, dry.out);
    assert.deepEqual(JSON.parse(dry.out), { wouldRevoke: 2, otherSchools: [other, third].map(x => x.tenant).sort().map(id => ({ tenantId: id, displayLabel: id === other.tenant ? 'SMA Lain Contoh' : null })) });
    assert.deepEqual(await snapshot(db.pool, STATE), before, 'refusals and the dry run change nothing');

    // C01: every session of the Account ends with exactly one audit row; bystanders are untouched.
    const done = cli('--tenant', s.tenant, '--elligble-id', target.username, '--reason', '  Sesi dicurigai diambil alih  ', ...audit);
    outputs.push(done.out);
    assert.equal(done.code, 0, done.out);
    const printed = JSON.parse(done.out);
    assert.equal(printed.revoked, 2);
    assert.deepEqual(printed.otherSchools, JSON.parse(dry.out).otherSchools);
    assert.equal(await live(db.pool, target.accountId), 0);
    assert.equal((await first.request('/api/v1/auth/session')).status, 401);
    assert.equal((await second.request('/api/v1/auth/session')).status, 401);
    assert.equal((await bystanderClient.request('/api/v1/auth/session')).status, 200);
    const rows = await audits(db.pool, target.accountId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].tenant_id, s.tenant);
    assert.equal(rows[0].operator_label, 'Pemilik Platform');
    assert.equal(rows[0].case_reference, 'INC-2026-001');
    assert.equal(rows[0].reason, 'Sesi dicurigai diambil alih');
    assert.equal(rows[0].input_sha256, null);
    assert.deepEqual(rows[0].summary, { sessions: 2, userAccountId: target.accountId, otherSchoolMemberships: 2 });

    // C05 retry: idempotent, nothing more to revoke, still audited.
    const again = cli('--tenant', s.tenant, '--elligble-id', target.username, '--reason', 'Ulang kasus yang sama', ...audit);
    outputs.push(again.out);
    assert.equal(again.code, 0, again.out);
    assert.equal(JSON.parse(again.out).revoked, 0);
    assert.deepEqual((await audits(db.pool, target.accountId)).map(r => r.summary.sessions), [2, 0]);
    // A new sign-in after the intervention is a new session; the password is untouched.
    assert.equal((await new BrowserLikeClient(app.baseUrl).login(target.username, target.password)).status, 200);

    // C06: no session id, secret, credential, NISN or birth date in any output or summary.
    const summaries = (await audits(db.pool, target.accountId)).map(r => JSON.stringify(r.summary));
    const cookieSecrets = [first.cookie, second.cookie].map(c => String(c));
    for (const text of [...outputs, ...summaries]) {
        for (const secret of [...sessionIds, ...cookieSecrets, target.nisn, '2010-07-17', target.password, target.personId]) assert.ok(!text.includes(secret), `leak in ${text}`);
    }
    for (const r of await audits(db.pool, target.accountId)) assert.deepEqual(Object.keys(r.summary).sort(), ['otherSchoolMemberships', 'sessions', 'userAccountId']);
});

test('SEC-OPS-001 C04 an audit insert failure rolls back the revocation exactly', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await disposable(); const app = await startProductionWiredServer(db.pool);
    t.after(() => teardown(app, db));
    const s = await school(db.pool), target = await student(db.pool, s);
    await signIn(app.baseUrl, s, target);
    await db.pool.query(`CREATE FUNCTION synthetic_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
        CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON platform_provisioning_events FOR EACH ROW EXECUTE FUNCTION synthetic_audit_failure();`);
    const before = await snapshot(db.pool, STATE);
    await assert.rejects(revoke(db.pool, s.tenant, target.username), /synthetic audit failure/);
    assert.deepEqual(await snapshot(db.pool, STATE), before);
    assert.equal(await live(db.pool, target.accountId), 1);
    await db.pool.query('DROP TRIGGER synthetic_audit_failure ON platform_provisioning_events; DROP FUNCTION synthetic_audit_failure();');
    const r = await revoke(db.pool, s.tenant, target.username);
    assert.ok(r.ok && !r.dryRun && r.revoked === 1);
});

test('SEC-OPS-001 C05 real contention in both orders against login, session mutation, a paused verifier and claim cancel or expiry', { skip: skipWithoutDatabase, timeout: 300000 }, async t => {
    const db = await disposable();
    const ref: GateRef = { current: null };
    const app = await startProductionWiredServer(gatedPool(db.pool, ref));
    const watch = await db.pool.connect();
    t.after(() => teardown(app, db));
    const s = await school(db.pool);
    const cref: GateRef = { current: null };
    const coordinator = gatedPool(db.pool, cref);
    const pidOf = async (c: pg.PoolClient) => (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
    const directLogin = (username: string, password: string, lref: GateRef = { current: null }) => settled((async () => {
        const c = await db.pool.connect(); try { return await new IdentityRuntime(gatedClient(c, lref) as unknown as pg.Client).authenticate(username, password); } finally { c.release(); }
    })());
    const expectRevoked = async (pending: ReturnType<typeof revoke>, n: number) => { const r = await pending; assert.ok(r.ok && !r.dryRun && r.revoked === n, JSON.stringify(r)); };

    // Login (credential lock). Login first: the revoke waits, then also ends the new session.
    {
        const x = await student(db.pool, s); await signIn(app.baseUrl, s, x);
        const lref: GateRef = { current: null }, g = gate(atLogin); lref.current = g;
        const logging = directLogin(x.username, x.password, lref);
        await reached(g, logging, 'login first');
        const revoking = revoke(coordinator, s.tenant, x.username);
        await blockedBy(watch, g.pid, revoking);
        g.release();
        const logged = await logging; assert.ok(logged.ok && logged.value.success);
        await expectRevoked(revoking, 2);
        assert.equal(await live(db.pool, x.accountId), 0);
    }
    // Revoke first: the login waits on the credential and then opens a new session.
    {
        const x = await student(db.pool, s); await signIn(app.baseUrl, s, x);
        const g = gate(atCredential(x.accountId)); cref.current = g;
        const revoking = revoke(coordinator, s.tenant, x.username);
        await reached(g, revoking, 'revoke before login');
        const logging = directLogin(x.username, x.password);
        await blockedBy(watch, g.pid, logging);
        g.release();
        await expectRevoked(revoking, 1);
        const logged = await logging; assert.ok(logged.ok && logged.value.success);
        assert.equal(await live(db.pool, x.accountId), 1, 'only the post-intervention sign-in is live');
    }
    // Student session mutation (session row FOR UPDATE), both orders.
    const sessionOf = async (x: { username: string; password: string }) => {
        const r = await directLogin(x.username, x.password); assert.ok(r.ok && r.value.success); return r.value.session;
    };
    const mutate = (session: { sessionId: string; secret: string }) => {
        let held: pg.PoolClient | null = null;
        const pending = settled((async () => {
            const c = await db.pool.connect(); held = c; await c.query('BEGIN');
            return new IdentityRuntime(c as unknown as pg.Client).resolveSessionForMutation(session.sessionId, session.secret);
        })());
        return { pending, client: () => held!, finish: async () => { await held!.query('COMMIT'); held!.release(); } };
    };
    {
        const x = await student(db.pool, s), session = await sessionOf(x);
        const m = mutate(session); const resolved = await m.pending; assert.ok(resolved.ok && resolved.value !== null);
        const revoking = revoke(coordinator, s.tenant, x.username);
        await blockedBy(watch, await pidOf(m.client()), revoking);
        await m.finish();
        await expectRevoked(revoking, 1);
    }
    {
        const x = await student(db.pool, s), session = await sessionOf(x);
        const g = gate(atSessionsUpdate); cref.current = g;
        const revoking = revoke(coordinator, s.tenant, x.username);
        await reached(g, revoking, 'revoke before mutation');
        const m = mutate(session);
        await blockedBy(watch, g.pid, m.pending);
        g.release();
        await expectRevoked(revoking, 1);
        const resolved = await m.pending; assert.ok(resolved.ok && resolved.value === null, 'the waiting mutation sees the revoked session');
        await m.finish();
    }
    // A verifier's recovery issue paused after its own session lock, both orders.
    const issueBody = async (op: BrowserLikeClient, username: string) => {
        const p = await op.request('/api/v1/identity/recovery/authorize', { method: 'POST', body: { elligbleId: username, confirmed: false } });
        assert.equal(p.status, 200, JSON.stringify(p.body));
        return { elligbleId: username, confirmed: true, expectedRosterRevision: p.body.roster.revision, reason: 'Lupa kata sandi, diverifikasi langsung', requestKey: randomUUID(), inPersonVerified: true };
    };
    const codes = async (accountId: string) => (await db.pool.query('SELECT count(*)::int AS n FROM identity_account_recovery_codes WHERE user_account_id=$1', [accountId])).rows[0].n as number;
    {
        const { client: op, account } = await verifier(db.pool, s, app.baseUrl), x = await student(db.pool, s), body = await issueBody(op, x.username);
        const g = gate(atActorSession); ref.current = g;
        const issuing = op.request('/api/v1/identity/recovery/authorize', { method: 'POST', body });
        await reached(g, issuing, 'verifier first');
        const revoking = revoke(coordinator, s.tenant, account.username);
        await blockedBy(watch, g.pid, revoking);
        g.release();
        assert.equal((await issuing).status, 200);
        await expectRevoked(revoking, 1);
        assert.equal((await op.request('/api/v1/auth/session')).status, 401);
    }
    {
        const { client: op, account } = await verifier(db.pool, s, app.baseUrl), x = await student(db.pool, s), body = await issueBody(op, x.username);
        const g = gate(atSessionsUpdate); cref.current = g;
        const revoking = revoke(coordinator, s.tenant, account.username);
        await reached(g, revoking, 'revoke before verifier');
        const issuing = op.request('/api/v1/identity/recovery/authorize', { method: 'POST', body });
        await blockedBy(watch, g.pid, issuing);
        g.release();
        await expectRevoked(revoking, 1);
        assert.ok([401, 403].includes((await issuing).status));
        assert.equal(await codes(x.accountId), 0, 'the revoked verifier issued nothing');
    }
    // Claim CANCEL and expiry of an approved-pending claim on the revoked Account, both orders.
    const { client: op } = await verifier(db.pool, s, app.baseUrl);
    let n = 0;
    const approvedClaim = async () => {
        n++;
        const nisn = `009000000${n}`, name = `Siswa Klaim ${n}`;
        const rosterId = (await db.pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id, source_student_key, full_name, nis, nisn, date_of_birth,
            academic_year_id, academic_period_id, academic_group_id) VALUES($1,$2,$3,$4,$5,'2010-09-10',$6,$7,$8) RETURNING id`,
        [s.tenant, `claim-${n}-${randomUUID().slice(0, 6)}`, name, `kn-${n}-${randomUUID().slice(0, 4)}`, nisn, s.year, s.period, s.group])).rows[0].id as string;
        const submitted = await new BrowserLikeClient(app.baseUrl).request('/api/v1/identity/claims', { method: 'POST', body: { tenantId: s.tenant, fullName: name, nisn, birthDate: '2010-09-10', requestKey: randomUUID() } });
        assert.equal(submitted.status, 202);
        const claim = (await db.pool.query('SELECT * FROM identity_student_claims WHERE roster_id=$1', [rosterId])).rows[0];
        const revision = (await db.pool.query('SELECT revision FROM academic_core_student_roster_records WHERE id=$1', [rosterId])).rows[0].revision;
        const r = await op.request('/api/v1/identity/claims/decision', { method: 'POST', body: { claimId: claim.id, expectedRevision: claim.revision, expectedRosterRevision: revision, decision: 'APPROVE', reason: 'Diverifikasi langsung', confirmed: true, requestKey: randomUUID(), adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true } });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const open = (await db.pool.query('SELECT * FROM identity_student_claims WHERE id=$1', [claim.id])).rows[0];
        assert.equal(open.state, 'APPROVED_PENDING_ACTIVATION');
        const accountId = (await db.pool.query('SELECT user_account_id FROM identity_account_credentials WHERE username=$1', [r.body.elligbleId])).rows[0].user_account_id as string;
        const preview = await revoke(db.pool, s.tenant, r.body.elligbleId, true);
        assert.ok(preview.ok && preview.dryRun, 'the claimed Account is a member of the school');
        return { claim: open, elligbleId: r.body.elligbleId as string, accountId };
    };
    const cancel = (claim: { id: string; revision: number }) => op.request('/api/v1/identity/claims/decision', { method: 'POST', body: { claimId: claim.id, expectedRevision: claim.revision, decision: 'CANCEL', reason: 'Insiden sintetis', confirmed: true, requestKey: randomUUID() } });
    const stateOf = async (id: string) => (await db.pool.query('SELECT state FROM identity_student_claims WHERE id=$1', [id])).rows[0].state as string;
    {
        const c = await approvedClaim();
        const g = gate(atCredential(c.accountId)); ref.current = g;
        const cancelling = cancel(c.claim);
        await reached(g, cancelling, 'cancel first');
        const revoking = revoke(coordinator, s.tenant, c.elligbleId);
        await blockedBy(watch, g.pid, revoking);
        g.release();
        assert.equal((await cancelling).status, 200);
        await expectRevoked(revoking, 0);
        assert.equal(await stateOf(c.claim.id), 'CANCELLED');
    }
    {
        const c = await approvedClaim();
        const g = gate(atCredential(c.accountId)); cref.current = g;
        const revoking = revoke(coordinator, s.tenant, c.elligbleId);
        await reached(g, revoking, 'revoke before cancel');
        const cancelling = cancel(c.claim);
        await blockedBy(watch, g.pid, cancelling);
        g.release();
        await expectRevoked(revoking, 0);
        assert.equal((await cancelling).status, 200);
        assert.equal(await stateOf(c.claim.id), 'CANCELLED');
    }
    const observeExpiry = (claimId: string, oref: GateRef = { current: null }) => {
        const pending = settled((async () => {
            const raw = await db.pool.connect(); const c = gatedClient(raw, oref);
            await c.query('BEGIN');
            const claim = await lockClaim(c, s.tenant, claimId);
            const observed = await observeClaim(c, claim!, new Date(claim!.expiresAt.getTime()), 10);
            await c.query('COMMIT'); raw.release();
            return observed;
        })());
        return { pending };
    };
    {
        const c = await approvedClaim();
        const oref: GateRef = { current: null }, g = gate(atCredential(c.accountId)); oref.current = g;
        const o = observeExpiry(c.claim.id, oref);
        await reached(g, o.pending, 'expiry first');
        const revoking = revoke(coordinator, s.tenant, c.elligbleId);
        await blockedBy(watch, g.pid, revoking);
        g.release();
        assert.equal((await o.pending).ok, true);
        await expectRevoked(revoking, 0);
        assert.equal(await stateOf(c.claim.id), 'EXPIRED');
    }
    {
        const c = await approvedClaim();
        const g = gate(atCredential(c.accountId)); cref.current = g;
        const revoking = revoke(coordinator, s.tenant, c.elligbleId);
        await reached(g, revoking, 'revoke before expiry');
        const o = observeExpiry(c.claim.id);
        await blockedBy(watch, g.pid, o.pending);
        g.release();
        await expectRevoked(revoking, 0);
        assert.equal((await o.pending).ok, true);
        assert.equal(await stateOf(c.claim.id), 'EXPIRED');
    }
});

test('SEC-OPS-001 C05 a detected deadlock leaves zero partial state; the rerun of the case succeeds', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await disposable(); const app = await startProductionWiredServer(db.pool);
    const watch = await db.pool.connect();
    t.after(() => teardown(app, db));
    const s = await school(db.pool), x = await student(db.pool, s);
    await signIn(app.baseUrl, s, x);
    const before = await snapshot(db.pool, STATE);
    // A synthetic writer holds the target's session row, then waits on the credential the revoke holds.
    const d = await db.pool.connect();
    await d.query('BEGIN');
    await d.query('SELECT id FROM identity_sessions WHERE user_account_id=$1 FOR UPDATE', [x.accountId]);
    const dpid = (await d.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
    const revoking = settled(revoke(db.pool, s.tenant, x.username));
    await blockedBy(watch, dpid, revoking);
    const closing = settled(d.query('SELECT user_account_id FROM identity_account_credentials WHERE user_account_id=$1 FOR UPDATE', [x.accountId]));
    const outcome = await revoking;
    assert.equal(outcome.ok, false, 'the revoke, waiting first, is the detected deadlock victim');
    assert.equal((outcome as { error: { code?: string } }).error.code, '40P01');
    assert.equal((await closing).ok, true);
    await d.query('ROLLBACK'); d.release();
    assert.deepEqual(await snapshot(db.pool, STATE), before, 'no partial revocation and no partial audit');
    assert.equal((await audits(db.pool, x.accountId)).length, 0);
    const rerun = await revoke(db.pool, s.tenant, x.username);
    assert.ok(rerun.ok && !rerun.dryRun && rerun.revoked === 1);
    assert.equal((await audits(db.pool, x.accountId)).length, 1);
});

test('SEC-OPS-001 C07 migration 0059 rollback, repeat, unchanged rows and the reason rules', { skip: skipWithoutDatabase }, async t => {
    const db = await disposable({ migrate: false }); t.after(() => teardown(null, db));
    const c = await db.pool.connect();
    try {
        const dir = new URL('../../../../database/migrations/', import.meta.url);
        for (const file of (await readdir(dir)).filter(n => /^\d{4}.*\.sql$/.test(n) && n < '0059').sort()) await c.query(await readFile(new URL(file, dir), 'utf8'));
        const insert = (action: string, reason?: string | null) => reason === undefined
            ? c.query(`INSERT INTO platform_provisioning_events (batch_id, tenant_id, operator_label, case_reference, action, input_sha256, summary) VALUES (gen_random_uuid(), NULL, 'Lama', 'OLD-1', $1, NULL, '{"n":1}')`, [action])
            : c.query(`INSERT INTO platform_provisioning_events (batch_id, tenant_id, operator_label, case_reference, action, input_sha256, summary, reason) VALUES (gen_random_uuid(), NULL, 'Baru', 'NEW-1', $1, NULL, '{"n":1}', $2)`, [action, reason]);
        await insert('tenant_created'); await insert('people_imported');
        await assert.rejects(insert('sessions_revoked'), /ck_platform_provisioning_action/, 'the action does not exist before 0059');
        const before = (await c.query('SELECT to_jsonb(t) AS row FROM platform_provisioning_events t ORDER BY id')).rows.map(r => r.row);
        const sql = await readFile(new URL('0059_platform_session_intervention.sql', dir), 'utf8');
        const failing = sql.replace("INSERT INTO elligble_migration_history (migration_id) VALUES ('0059_platform_session_intervention');", "RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing, sql);
        await assert.rejects(c.query(failing), /synthetic migration rollback/); await c.query('ROLLBACK');
        const column = async () => (await c.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='platform_provisioning_events' AND column_name='reason'`)).rows[0].n;
        assert.equal(await column(), 0, 'the failed migration left nothing');
        await c.query(sql); await c.query(sql);
        assert.equal(await column(), 1);
        const after = (await c.query('SELECT to_jsonb(t) AS row FROM platform_provisioning_events t ORDER BY id')).rows.map(r => r.row);
        assert.deepEqual(after.map(({ reason, ...rest }) => { assert.equal(reason, null); return rest; }), before, 'existing rows are unchanged, no backfill');
        await assert.rejects(insert('sessions_revoked', null), /ck_platform_provisioning_reason_required/);
        await assert.rejects(insert('sessions_revoked', '   '), /"ck_platform_provisioning_reason"/);
        await assert.rejects(insert('sessions_revoked', 'x'.repeat(201)), /"ck_platform_provisioning_reason"/);
        await assert.rejects(insert('bukan_aksi', 'Uji'), /ck_platform_provisioning_action/);
        await insert('sessions_revoked', 'Insiden sintetis');
        for (const action of ['tenant_created', 'people_imported', 'activation_reissued', 'academic_imported', 'exam_imported', 'tenant_time_zone_set', 'assessment_types_added']) await insert(action);
        assert.equal((await c.query(`SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id='0059_platform_session_intervention'`)).rows[0].n, 1);
    } finally { c.release(); }
});
