import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTeachingContext, createTenant } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { completeRecovery } from '../../src/recovery.ts';

// AUTH-003 real PostgreSQL oracles (record §9/§6A C01–C10). Synthetic data, production
// wiring and real locks observed through pg_blocking_pids; teardown releases every barrier and
// held client first, so a failure can never hang the run.

const CLI = new URL('../../src/ops/provision-cli.ts', import.meta.url).pathname;
const NEW_PASSWORD = 'PulihSintetisAman2026!';
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
async function snapshot(pool: pg.Pool, tables: readonly string[]) {
    const result: Record<string, unknown> = {};
    for (const table of tables) result[table] = (await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    return result;
}
const TRUSTED = ['identity_account_credentials', 'identity_account_activations', 'identity_account_recovery_codes', 'identity_persons', 'tenant_memberships', 'tenant_school_operator_assignments'];

interface School { tenant: string; group: string; year: string; period: string }
async function school(pool: pg.Pool): Promise<School & { teacher: Awaited<ReturnType<typeof createPersonWithAccount>> }> {
    const tenant = await createTenant(pool), teacher = await createPersonWithAccount(pool), membership = await addMembership(pool, tenant, teacher.personId);
    const teaching = await createTeachingContext(pool, tenant, membership);
    const year = (await pool.query('SELECT academic_year_id FROM academic_core_academic_groups WHERE id=$1', [teaching.academicGroupId])).rows[0].academic_year_id as string;
    const period = (await pool.query(`SELECT o.academic_period_id FROM academic_core_subject_offerings o JOIN academic_core_teaching_assignments a ON a.subject_offering_id=o.id WHERE a.id=$1`, [teaching.teachingAssignmentId])).rows[0].academic_period_id as string;
    return { tenant, group: teaching.academicGroupId, year, period, teacher };
}
let seq = 0;
/** An activated Student: own password, one sign-in, membership and a bound roster record. */
async function student(pool: pg.Pool, s: School, baseUrl: string, group = s.group) {
    seq++;
    const account = await createPersonWithAccount(pool);
    await addMembership(pool, s.tenant, account.personId);
    const rosterId = (await pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id, source_student_key, full_name, nis, nisn, date_of_birth,
        academic_year_id, academic_period_id, academic_group_id, person_id) VALUES($1,$2,$3,$4,$5,'2010-05-05',$6,$7,$8,$9) RETURNING id`,
    [s.tenant, `rec-${seq}-${randomUUID().slice(0, 6)}`, `Siswa Pulih ${seq}`, `rn-${seq}-${randomUUID().slice(0, 4)}`, `07${String(seq).padStart(8, '0')}`, s.year, s.period, group, account.personId])).rows[0].id as string;
    const session = new BrowserLikeClient(baseUrl);
    assert.equal((await session.login(account.username, account.password)).status, 200);
    return { ...account, rosterId, session };
}
async function operator(pool: pg.Pool, s: School, personId: string, action: 'ASSIGN' | 'REVOKE' = 'ASSIGN') {
    const c = await pool.connect();
    try { await c.query('BEGIN'); await setSchoolOperator(c, { tenantId: s.tenant, personId, action, operator: 'Synthetic', caseReference: 'AUTH-003', reason: 'Synthetic' }); await c.query('COMMIT'); }
    catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
async function verifier(pool: pg.Pool, s: School, baseUrl: string) {
    const v = await createPersonWithAccount(pool); await addMembership(pool, s.tenant, v.personId); await operator(pool, s, v.personId);
    const c = new BrowserLikeClient(baseUrl); assert.equal((await c.login(v.username, v.password)).status, 200); c.tenantId = s.tenant;
    return { account: v, client: c };
}
const authorize = (c: BrowserLikeClient, body: Record<string, unknown>) => c.request('/api/v1/identity/recovery/authorize', { method: 'POST', body });
const complete = (baseUrl: string, username: string, recoveryCode: string, newPassword = NEW_PASSWORD) =>
    new BrowserLikeClient(baseUrl).request('/api/v1/identity/recovery/complete', { method: 'POST', body: { username, recoveryCode, newPassword } });
async function issue(c: BrowserLikeClient, username: string, extra: Record<string, unknown> = {}) {
    const p = await authorize(c, { elligbleId: username, confirmed: false });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    return authorize(c, { elligbleId: username, confirmed: true, expectedRosterRevision: p.body.roster.revision, reason: 'Lupa kata sandi, diverifikasi langsung', requestKey: randomUUID(), inPersonVerified: true, ...extra });
}
const openCode = async (pool: pg.Pool, accountId: string) => (await pool.query('SELECT * FROM identity_account_recovery_codes WHERE user_account_id=$1 ORDER BY issued_at DESC, id LIMIT 1', [accountId])).rows[0];

test('AUTH-003 C01/C02/C09 scoped preview and issue authority with one bounded refusal', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await disposable(); const app = await startProductionWiredServer(db.pool);
    t.after(() => teardown(app, db));
    const s = await school(db.pool), other = await school(db.pool);
    const { client: op, account: opAccount } = await verifier(db.pool, s, app.baseUrl);
    const target = await student(db.pool, s, app.baseUrl);
    const preview = await authorize(op, { elligbleId: target.username, confirmed: false });
    assert.equal(preview.status, 200); assert.equal(preview.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(preview.body.roster).sort(), ['birthDate', 'fullName', 'groupLabel', 'nisn', 'revision']);
    // Homeroom of the student's rombel may; Homeroom elsewhere and a plain Teacher may not.
    const grade = (await db.pool.query('SELECT grade_level_id FROM academic_core_academic_groups WHERE id=$1', [s.group])).rows[0].grade_level_id;
    const elsewhere = (await db.pool.query(`INSERT INTO academic_core_academic_groups (tenant_id, academic_year_id, grade_level_id, display_label) VALUES ($1,$2,$3,'X-Lain') RETURNING id`, [s.tenant, s.year, grade])).rows[0].id;
    const hr = await createPersonWithAccount(db.pool), wrong = await createPersonWithAccount(db.pool), plain = await createPersonWithAccount(db.pool);
    for (const p of [hr, wrong, plain]) await addMembership(db.pool, s.tenant, p.personId);
    const cli = (u: string, g: string) => execFileSync(process.execPath, [CLI, 'homeroom', 'assign', '--tenant', s.tenant, '--elligble-id', u, '--group', g, '--period', s.period, '--operator', 'Synthetic', '--case', 'AUTH-003', '--reason', 'Synthetic'], { env: { ...process.env, DATABASE_URL: db.url }, stdio: 'pipe' });
    cli(hr.username, s.group); cli(wrong.username, elsewhere);
    const login = async (a: typeof hr) => { const c = new BrowserLikeClient(app.baseUrl); await c.login(a.username, a.password); c.tenantId = s.tenant; return c; };
    assert.equal((await authorize(await login(hr), { elligbleId: target.username, confirmed: false })).status, 200);
    const before = await snapshot(db.pool, TRUSTED);
    assert.equal((await authorize(await login(wrong), { elligbleId: target.username, confirmed: false })).status, 404);
    assert.equal((await authorize(await login(plain), { elligbleId: target.username, confirmed: false })).status, 404);
    assert.equal((await authorize(new BrowserLikeClient(app.baseUrl), { elligbleId: target.username, confirmed: false })).status, 401);
    // Unknown, foreign, unbound, staff, self and never-activated targets: one bounded refusal, zero mutation.
    const foreign = await student(db.pool, other as unknown as School, app.baseUrl);
    const unbound = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, unbound.personId);
    const fresh = await createPersonWithAccount(db.pool); await addMembership(db.pool, s.tenant, fresh.personId);
    await db.pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id, source_student_key, full_name, nis, nisn, date_of_birth, academic_year_id, academic_period_id, academic_group_id, person_id)
        VALUES($1,'never','Belum Aktif','nv1','0799999999','2010-01-01',$2,$3,$4,$5)`, [s.tenant, s.year, s.period, s.group, fresh.personId]);
    for (const id of ['elg-zzzz-zzzz-zzzz', foreign.username, unbound.username, s.teacher.username, opAccount.username, fresh.username]) {
        const r = await authorize(op, { elligbleId: id, confirmed: false });
        assert.equal(r.status, 404, id); assert.equal(r.body.error, 'not_found_in_scope');
        const i = await authorize(op, { elligbleId: id, confirmed: true, expectedRosterRevision: 1, reason: 'Uji', requestKey: randomUUID(), inPersonVerified: true });
        assert.equal(i.status, 404, id);
    }
    for (const field of ['personId', 'tenantId', 'recoveryCode']) assert.equal((await authorize(op, { elligbleId: target.username, confirmed: false, [field]: randomUUID() })).status, 400);
    assert.equal((await authorize(op, { elligbleId: target.username, confirmed: true, expectedRosterRevision: 1, reason: 'Uji', requestKey: randomUUID(), inPersonVerified: false })).status, 400);
    assert.deepEqual(await snapshot(db.pool, TRUSTED), before);
});

test('AUTH-003 C03/C05/C06 issue changes nothing else; completion replaces password, revokes sessions and codes; replay is bounded', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await disposable(); const app = await startProductionWiredServer(db.pool);
    t.after(() => teardown(app, db));
    const s = await school(db.pool);
    const { client: op } = await verifier(db.pool, s, app.baseUrl);
    const target = await student(db.pool, s, app.baseUrl);
    const c = await db.pool.connect();
    let card: { code: string } | null;
    try { card = await new IdentityRuntime(c as unknown as pg.Client).issueActivation(target.accountId, { rotatePassword: false }); } finally { c.release(); }
    assert.ok(card);
    const before = await snapshot(db.pool, ['identity_account_credentials', 'identity_account_activations', 'identity_sessions']);
    const first = await issue(op, target.username);
    assert.equal(first.status, 200, JSON.stringify(first.body)); assert.match(first.body.recoveryCode, /^[A-Z0-9-]+$/);
    const row = await openCode(db.pool, target.accountId);
    assert.equal(new Date(row.expires_at).getTime() - new Date(row.issued_at).getTime(), 15 * 60 * 1000);
    assert.ok(!JSON.stringify(row).includes(first.body.recoveryCode.replace(/-/g, '')));
    assert.deepEqual(await snapshot(db.pool, ['identity_account_credentials', 'identity_account_activations']), { identity_account_credentials: before.identity_account_credentials, identity_account_activations: before.identity_account_activations });
    assert.equal((await target.session.request('/api/v1/auth/session')).status, 200);
    // Replay and supersede.
    const p = await authorize(op, { elligbleId: target.username, confirmed: false });
    const body = { elligbleId: target.username, confirmed: true, expectedRosterRevision: p.body.roster.revision, reason: 'Ulang', requestKey: randomUUID(), inPersonVerified: true };
    const second = await authorize(op, body);
    assert.equal(second.status, 200);
    const replay = await authorize(op, body);
    assert.equal(replay.body.replayed, true); assert.equal(replay.body.recoveryCode, undefined);
    assert.equal((await authorize(op, { ...body, reason: 'Diubah' })).status, 409);
    assert.equal((await db.pool.query(`SELECT revoke_kind FROM identity_account_recovery_codes WHERE id=$1`, [row.id])).rows[0].revoke_kind, 'SUPERSEDED');
    assert.equal((await complete(app.baseUrl, target.username, first.body.recoveryCode)).status, 401);
    // Completion.
    const done = await complete(app.baseUrl, target.username, second.body.recoveryCode);
    assert.equal(done.status, 200, JSON.stringify(done.body)); assert.ok(done.headers.get('set-cookie'));
    assert.equal((await target.session.request('/api/v1/auth/session')).status, 401);
    assert.equal((await new BrowserLikeClient(app.baseUrl).login(target.username, target.password)).status, 401);
    assert.equal((await new BrowserLikeClient(app.baseUrl).login(target.username, NEW_PASSWORD)).status, 200);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_account_activations WHERE user_account_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL', [target.accountId])).rows[0].n, 0);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_user_accounts WHERE person_id=$1', [target.personId])).rows[0].n, 1);
    // A lost response: the same code is answered as already completed, without a session.
    const retry = await complete(app.baseUrl, target.username, second.body.recoveryCode, 'LainSandiAman2026!');
    assert.equal(retry.status, 409); assert.equal(retry.body.error, 'recovery_already_completed'); assert.equal(retry.headers.get('set-cookie'), null);
    assert.equal((await complete(app.baseUrl, target.username, card!.code)).status, 401);
    await assert.rejects(db.pool.query('DELETE FROM identity_account_recovery_codes'));
    await assert.rejects(db.pool.query('UPDATE identity_account_recovery_codes SET expires_at = expires_at + interval \'1 hour\''));
});

test('AUTH-003 C04/C07/F1/F2 failures, expiry, replacement by activation, rechecks and rollback', { skip: skipWithoutDatabase, timeout: 120000 }, async t => {
    const db = await disposable(); const app = await startProductionWiredServer(db.pool);
    t.after(() => teardown(app, db));
    const s = await school(db.pool);
    const { client: op, account: opAccount } = await verifier(db.pool, s, app.baseUrl);
    // Ten wrong codes revoke; the right code then fails; no Account lockout.
    const a = await student(db.pool, s, app.baseUrl);
    const ia = await issue(op, a.username);
    for (let i = 0; i < 10; i++) assert.equal((await complete(app.baseUrl, a.username, 'AAAA-BBBB-CCCC')).status, 401);
    const ra = await openCode(db.pool, a.accountId);
    assert.equal(ra.failed_attempts, 10); assert.equal(ra.revoke_kind, 'FAILED_ATTEMPTS');
    assert.equal((await complete(app.baseUrl, a.username, ia.body.recoveryCode)).status, 401);
    assert.equal((await new BrowserLikeClient(app.baseUrl).login(a.username, a.password)).status, 200);
    // Expiry at the exact boundary, evaluated after the locks; not counted.
    const b = await student(db.pool, s, app.baseUrl);
    const ib = await issue(op, b.username), rb = await openCode(db.pool, b.accountId);
    const pc = await db.pool.connect();
    try { assert.equal((await completeRecovery(pc, b.username, ib.body.recoveryCode, NEW_PASSWORD, { now: () => new Date(rb.expires_at) })).success, false); } finally { pc.release(); }
    assert.equal((await openCode(db.pool, b.accountId)).failed_attempts, 0);
    // F1: activation issuance and activation consumption close an open recovery code.
    const cc = await student(db.pool, s, app.baseUrl);
    const ic = await issue(op, cc.username);
    const c1 = await db.pool.connect();
    try { await new IdentityRuntime(c1 as unknown as pg.Client).issueActivation(cc.accountId, { rotatePassword: false }); } finally { c1.release(); }
    assert.equal((await openCode(db.pool, cc.accountId)).revoke_kind, 'REPLACED_BY_ACTIVATION');
    assert.equal((await complete(app.baseUrl, cc.username, ic.body.recoveryCode)).status, 401);
    const d = await student(db.pool, s, app.baseUrl);
    const c2 = await db.pool.connect();
    let card: { code: string } | null;
    try { card = await new IdentityRuntime(c2 as unknown as pg.Client).issueActivation(d.accountId, { rotatePassword: false }); } finally { c2.release(); }
    const idd = await issue(op, d.username);
    assert.equal((await new BrowserLikeClient(app.baseUrl).request('/api/v1/auth/activate', { method: 'POST', body: { username: d.username, activationCode: card!.code, newPassword: NEW_PASSWORD } })).status, 200);
    assert.equal((await openCode(db.pool, d.accountId)).revoke_kind, 'REPLACED_BY_ACTIVATION');
    assert.equal((await complete(app.baseUrl, d.username, idd.body.recoveryCode)).status, 401);
    // F2: a staff grant to the target, or the issuer losing authority, stops completion without counting.
    const e = await student(db.pool, s, app.baseUrl);
    const ie = await issue(op, e.username);
    await operator(db.pool, s, e.personId);
    assert.equal((await complete(app.baseUrl, e.username, ie.body.recoveryCode)).status, 401);
    assert.equal((await openCode(db.pool, e.accountId)).failed_attempts, 0);
    const f = await student(db.pool, s, app.baseUrl);
    const iff = await issue(op, f.username);
    await operator(db.pool, s, opAccount.personId, 'REVOKE');
    assert.equal((await complete(app.baseUrl, f.username, iff.body.recoveryCode)).status, 401);
    const row = await openCode(db.pool, f.accountId);
    assert.equal(row.consumed_at, null); assert.equal(row.failed_attempts, 0);
    await operator(db.pool, s, opAccount.personId, 'ASSIGN');
    // C07: a failure at completion's session insert or at issue rolls back exactly.
    const g = await student(db.pool, s, app.baseUrl);
    const ig = await issue(op, g.username);
    const state = await snapshot(db.pool, [...TRUSTED, 'identity_sessions']);
    await db.pool.query(`CREATE FUNCTION synthetic_session_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$;
        CREATE TRIGGER synthetic_session_failure BEFORE INSERT ON identity_sessions FOR EACH ROW EXECUTE FUNCTION synthetic_session_failure()`);
    try {
        assert.equal((await complete(app.baseUrl, g.username, ig.body.recoveryCode)).status, 503);
        assert.deepEqual(await snapshot(db.pool, [...TRUSTED, 'identity_sessions']), state);
    } finally { await db.pool.query('DROP TRIGGER synthetic_session_failure ON identity_sessions; DROP FUNCTION synthetic_session_failure()'); }
    assert.equal((await complete(app.baseUrl, g.username, ig.body.recoveryCode)).status, 200);
    const h = await student(db.pool, s, app.baseUrl);
    const issueState = await snapshot(db.pool, TRUSTED);
    await db.pool.query(`CREATE FUNCTION synthetic_recovery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$;
        CREATE TRIGGER synthetic_recovery_failure BEFORE INSERT ON identity_account_recovery_codes FOR EACH ROW EXECUTE FUNCTION synthetic_recovery_failure()`);
    try { assert.equal((await issue(op, h.username)).status, 503); assert.deepEqual(await snapshot(db.pool, TRUSTED), issueState); }
    finally { await db.pool.query('DROP TRIGGER synthetic_recovery_failure ON identity_account_recovery_codes; DROP FUNCTION synthetic_recovery_failure()'); }
});

test('AUTH-003 C08 actual writers in both orders against issue and completion; post-wait expiry refuses', { skip: skipWithoutDatabase, timeout: 240000 }, async t => {
    const db = await disposable();
    const ref: GateRef = { current: null };
    const app = await startProductionWiredServer(gatedPool(db.pool, ref));
    const watch = await db.pool.connect();
    t.after(() => teardown(app, db));
    const s = await school(db.pool);
    const { client: op } = await verifier(db.pool, s, app.baseUrl);
    const atCredential = (sql: string) => sql.includes('FROM identity_person_account_bindings b') && sql.includes('FOR UPDATE OF c');
    const atRecoveryRow = (sql: string) => sql.includes('FROM identity_account_recovery_codes') && sql.includes('FOR UPDATE') && sql.includes('code_verifier');
    const inTx = async <T>(run: (c: pg.PoolClient) => Promise<T>) => { const c = await db.pool.connect(); await c.query('BEGIN'); return { c, pending: settled(run(c)) }; };
    const finish = async (c: pg.PoolClient) => { await c.query('COMMIT'); c.release(); };
    const pidOf = async (c: pg.PoolClient) => (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
    const assignTarget = (c: pg.PoolClient, personId: string) => setSchoolOperator(c, { tenantId: s.tenant, personId, action: 'ASSIGN', operator: 'Synthetic', caseReference: 'AUTH-003 C08', reason: 'Writer order' });

    // Issue vs staff grant on the target. Writer first: issue waits, then refuses. Issue first: the grant waits.
    {
        const x = await student(db.pool, s, app.baseUrl);
        const p = await authorize(op, { elligbleId: x.username, confirmed: false });
        const w = await inTx(c => assignTarget(c, x.personId)); await w.pending;
        const issuing = authorize(op, { elligbleId: x.username, confirmed: true, expectedRosterRevision: p.body.roster.revision, reason: 'Uji', requestKey: randomUUID(), inPersonVerified: true });
        await blockedBy(watch, await pidOf(w.c), issuing);
        await finish(w.c);
        assert.equal((await issuing).status, 404);
    }
    {
        const x = await student(db.pool, s, app.baseUrl);
        const p = await authorize(op, { elligbleId: x.username, confirmed: false });
        const g = gate(atCredential); ref.current = g;
        const issuing = authorize(op, { elligbleId: x.username, confirmed: true, expectedRosterRevision: p.body.roster.revision, reason: 'Uji', requestKey: randomUUID(), inPersonVerified: true });
        await Promise.race([g.reached, issuing.then(r => { throw new Error(`issue missed its barrier ${r.status}`); })]);
        const w = await inTx(c => assignTarget(c, x.personId));
        await blockedBy(watch, g.pid, w.pending);
        g.release();
        assert.equal((await issuing).status, 200);
        assert.equal((await w.pending).ok, true); await finish(w.c);
    }
    // Completion vs completion with the same code: exactly one success; a concurrent one is
    // refused busy (non-blocking tenant fence) or already completed, and a retry is already completed.
    {
        const x = await student(db.pool, s, app.baseUrl), i = await issue(op, x.username);
        const results = await Promise.all([complete(app.baseUrl, x.username, i.body.recoveryCode), complete(app.baseUrl, x.username, i.body.recoveryCode)]);
        assert.equal(results.filter(r => r.status === 200).length, 1);
        for (const r of results) assert.ok([200, 409, 429].includes(r.status), String(r.status));
        assert.equal((await complete(app.baseUrl, x.username, i.body.recoveryCode)).status, 409);
        assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_account_recovery_codes WHERE user_account_id=$1 AND consumed_at IS NOT NULL', [x.accountId])).rows[0].n, 1);
    }
    // Completion vs reissue (credential-first writer). Reissue first: completion waits, then refuses the replaced code.
    {
        const x = await student(db.pool, s, app.baseUrl), i = await issue(op, x.username);
        const cref: GateRef = { current: null };
        const g = gate(sql => sql.includes('FROM identity_account_credentials WHERE user_account_id = $1 FOR UPDATE')); cref.current = g;
        const reissuing = settled((async () => { const c = await db.pool.connect(); try { return await new IdentityRuntime(gatedClient(c, cref) as unknown as pg.Client).issueActivation(x.accountId, { rotatePassword: false }); } finally { c.release(); } })());
        await Promise.race([g.reached, reissuing.then(() => { throw new Error('reissue missed its barrier'); })]);
        const completing = complete(app.baseUrl, x.username, i.body.recoveryCode);
        await blockedBy(watch, g.pid, completing);
        g.release();
        assert.equal((await reissuing).ok, true);
        assert.equal((await completing).status, 401);
        assert.equal((await openCode(db.pool, x.accountId)).revoke_kind, 'REPLACED_BY_ACTIVATION');
    }
    {
        const x = await student(db.pool, s, app.baseUrl), i = await issue(op, x.username);
        const g = gate(atRecoveryRow); ref.current = g;
        const completing = complete(app.baseUrl, x.username, i.body.recoveryCode);
        await Promise.race([g.reached, completing.then(r => { throw new Error(`completion missed its barrier ${r.status}`); })]);
        const reissuing = settled((async () => { const c = await db.pool.connect(); try { return await new IdentityRuntime(c as unknown as pg.Client).issueActivation(x.accountId, { rotatePassword: false }); } finally { c.release(); } })());
        await blockedBy(watch, g.pid, reissuing);
        g.release();
        assert.equal((await completing).status, 200);
        assert.equal((await reissuing).ok, true);
    }
    // Completion vs a staff grant on the target. Grant holding its key first: completion answers 429 without waiting.
    {
        const x = await student(db.pool, s, app.baseUrl), i = await issue(op, x.username);
        const w = await inTx(c => c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tenant_membership:${s.tenant}:${x.personId}`]));
        await w.pending;
        assert.equal((await complete(app.baseUrl, x.username, i.body.recoveryCode)).status, 429);
        await finish(w.c);
        assert.equal((await openCode(db.pool, x.accountId)).failed_attempts, 0);
        const g = gate(atRecoveryRow); ref.current = g;
        const completing = complete(app.baseUrl, x.username, i.body.recoveryCode);
        await Promise.race([g.reached, completing.then(r => { throw new Error(`completion missed its barrier ${r.status}`); })]);
        const w2 = await inTx(c => assignTarget(c, x.personId));
        await blockedBy(watch, g.pid, w2.pending);
        g.release();
        assert.equal((await completing).status, 200);
        assert.equal((await w2.pending).ok, true); await finish(w2.c);
    }
    // Completion vs issuer revocation. Completion first (holding the issuer's assignment FOR SHARE): the revocation waits.
    {
        const v = await verifier(db.pool, s, app.baseUrl);
        const x = await student(db.pool, s, app.baseUrl), i = await issue(v.client, x.username);
        const g = gate(atRecoveryRow); ref.current = g;
        const completing = complete(app.baseUrl, x.username, i.body.recoveryCode);
        await Promise.race([g.reached, completing.then(r => { throw new Error(`completion missed its barrier ${r.status}`); })]);
        const w = await inTx(c => setSchoolOperator(c, { tenantId: s.tenant, personId: v.account.personId, action: 'REVOKE', operator: 'Synthetic', caseReference: 'AUTH-003 C08', reason: 'Revoke issuer' }));
        await blockedBy(watch, g.pid, w.pending);
        g.release();
        assert.equal((await completing).status, 200);
        assert.equal((await w.pending).ok, true); await finish(w.c);
    }
    // Completion vs roster import (roster-tenant): import holding the fence makes completion answer 429; reverse, import waits.
    {
        const x = await student(db.pool, s, app.baseUrl), i = await issue(op, x.username);
        const w = await inTx(c => c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`roster-tenant:${s.tenant}`]));
        await w.pending;
        assert.equal((await complete(app.baseUrl, x.username, i.body.recoveryCode)).status, 429);
        await finish(w.c);
        const header = 'source_student_key,full_name,nis,nisn,date_of_birth,academic_group_id\n';
        const input = { academicYearId: s.year, academicPeriodId: s.period, csv: header + `c08,Impor C08,nis-c08,nisn-c08,2010-01-01,${s.group}` };
        const preview = await op.request('/api/v1/identity/roster/preview', { method: 'POST', body: input });
        const g = gate(atRecoveryRow); ref.current = g;
        const completing = complete(app.baseUrl, x.username, i.body.recoveryCode);
        await Promise.race([g.reached, completing.then(r => { throw new Error(`completion missed its barrier ${r.status}`); })]);
        const importing = op.request('/api/v1/identity/roster/confirm', { method: 'POST', body: { ...input, inputDigest: preview.body.inputDigest, stateDigest: preview.body.stateDigest, requestKey: randomUUID(), reason: 'C08', confirmed: true } });
        await blockedBy(watch, g.pid, importing);
        g.release();
        assert.equal((await completing).status, 200);
        assert.equal((await importing).status, 200);
    }
    // Post-wait expiry: completion waits on the credential lock and the claim lifetime passes meanwhile.
    {
        const x = await student(db.pool, s, app.baseUrl), i = await issue(op, x.username), row = await openCode(db.pool, x.accountId);
        let crossed = false;
        const clock = { now: () => crossed ? new Date(row.expires_at) : new Date(new Date(row.expires_at).getTime() - 60_000) };
        const w = await inTx(c => c.query('SELECT 1 FROM identity_account_credentials WHERE user_account_id=$1 FOR UPDATE', [x.accountId]));
        await w.pending;
        const pc = await db.pool.connect();
        const pending = settled(completeRecovery(pc, x.username, i.body.recoveryCode, NEW_PASSWORD, clock));
        await blockedBy(watch, await pidOf(w.c), pending);
        crossed = true;
        await finish(w.c);
        const result = await pending; pc.release();
        assert.equal(result.ok && result.value.success, false);
        const after = await openCode(db.pool, x.accountId);
        assert.equal(after.consumed_at, null); assert.equal(after.failed_attempts, 0);
    }
});

test('AUTH-003 C10 migration 0058 upgrade, rollback and repeat with no backfill', { skip: skipWithoutDatabase }, async t => {
    const db = await disposable({ migrate: false }); t.after(() => teardown(null, db));
    const c = await db.pool.connect();
    try {
        const dir = new URL('../../../../database/migrations/', import.meta.url);
        for (const file of (await readdir(dir)).filter(n => /^\d{4}.*\.sql$/.test(n) && n < '0058').sort()) await c.query(await readFile(new URL(file, dir), 'utf8'));
        await createPersonWithAccount(db.pool);
        const tables = ['identity_account_credentials', 'identity_account_activations', 'identity_student_claims', 'identity_sessions'];
        const before = await snapshot(db.pool, tables);
        const sql = await readFile(new URL('0058_student_account_recovery.sql', dir), 'utf8');
        const failing = sql.replace("INSERT INTO elligble_migration_history(migration_id) VALUES('0058_student_account_recovery');", "RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing, sql);
        await assert.rejects(c.query(failing), /synthetic migration rollback/); await c.query('ROLLBACK');
        assert.equal((await c.query("SELECT to_regclass('identity_account_recovery_codes') AS r")).rows[0].r, null);
        await c.query(sql); await c.query(sql);
        assert.deepEqual(await snapshot(db.pool, tables), before);
        assert.equal((await c.query('SELECT count(*)::int AS n FROM identity_account_recovery_codes')).rows[0].n, 0);
    } finally { c.release(); }
});
