import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type pg from 'pg';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTeachingContext, createTenant } from '../support/fixtures.ts';
import { setSchoolOperator } from '../../../tenant-access/src/school-operator.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { randomUUID } from 'node:crypto';
import { allocateStudentIdentity } from '../../../identity-access/src/student-identity.ts';

// Account activation through HTTP with real PostgreSQL: provisioned accounts cannot sign in
// until the person sets their own password with a single-use, expiring activation code
// (D02.3-09/10, D02.5-04/05, D02.7-37..41, DEC-041).

async function issue(pool: pg.Pool, accountId: string, options: { validForMs?: number; rotatePassword?: boolean } = {}) {
    const client = await pool.connect();
    try {
        return await new IdentityRuntime(client as unknown as pg.Client).issueActivation(accountId, options);
    } finally {
        client.release();
    }
}

test('AUTH-001 generated ID activates and resets the same Account with session revocation', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase(); t.after(() => db.close());
    const tenantId = await createTenant(db.pool), personId = randomUUID();
    await db.pool.query('INSERT INTO identity_persons(id) VALUES($1)',[personId]);
    const c = await db.pool.connect();
    try {
        await c.query('BEGIN');
        const allocated = await allocateStudentIdentity(c, { personId, tenantId }, randomUUID(), {
            authorize: async (_client, scope) => scope.personId === personId && scope.tenantId === tenantId
                ? { kind: 'platform_operator', ref: 'synthetic-activation-operator' } : null,
            audit: async () => {},
        });
        await c.query('COMMIT');
        const runtime = new IdentityRuntime(c as unknown as pg.Client);
        const code = await runtime.issueActivation(allocated.userAccountId);
        assert.ok(code);
        const first = await runtime.activate(allocated.elligbleId.toUpperCase(), code.code, 'ApprovedStudentPassword2026!');
        assert.equal(first.success,true); if (!first.success) throw new Error('Activation refused');
        assert.equal(first.personId,personId); assert.equal(first.userAccountId,allocated.userAccountId);
        const reset = await runtime.issueActivation(allocated.userAccountId); assert.ok(reset);
        assert.equal(await runtime.resolveSession(first.session.sessionId,first.session.secret),null);
        const recovered = await runtime.activate(allocated.elligbleId,reset.code,'DifferentStudentPassword2026!');
        assert.equal(recovered.success,true); if (!recovered.success) throw new Error('Reissue refused');
        assert.equal(recovered.personId,personId); assert.equal(recovered.userAccountId,allocated.userAccountId);
        assert.equal((await c.query('SELECT count(*)::int AS n FROM identity_user_accounts WHERE person_id=$1',[personId])).rows[0].n,1);
        assert.equal((await runtime.activate(allocated.elligbleId,reset.code,'ThirdStudentPassword2026!')).success,false);
    } finally { await c.query('ROLLBACK'); c.release(); }
});

// C09 barriers hold locks obtained by the real runtime query. Observers confirm actual
// PostgreSQL blocking, not just that a query was called. Each operation executes once.
function c09Barrier() {
    let acquired!: () => void, release!: () => void;
    return { reached: new Promise<void>(r => { acquired = r; }),
        proceed: new Promise<void>(r => { release = r; }), acquired: () => acquired(), release: () => release() };
}
function c09Client(client: pg.PoolClient, matches: (sql: string) => boolean, barrier: ReturnType<typeof c09Barrier>): pg.Client {
    let held = false;
    return new Proxy(client, { get(target, key) {
        if (key === 'query') return async (...args: unknown[]) => {
            const result = await Reflect.apply(target.query, target, args);
            if (!held && typeof args[0] === 'string' && matches(args[0])) {
                held = true; barrier.acquired(); await barrier.proceed;
            }
            return result;
        };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
    } }) as unknown as pg.Client;
}
function c09Observe<T>(operation: Promise<T>) {
    return operation.then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
}
async function c09Blocked<T>(observer: pg.PoolClient, blocked: number, blocker: number, pending: ReturnType<typeof c09Observe<T>>) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        const result = await Promise.race([
            observer.query('SELECT pg_blocking_pids($1::int) AS blockers', [blocked]),
            pending.then(outcome => { throw outcome.ok ? new Error('Operation finished before real lock contention') : outcome.error; }),
        ]);
        if ((result.rows[0].blockers as number[]).includes(blocker)) return;
    }
    throw new Error('Expected PostgreSQL blocker was not observed');
}

test('AUTH-001 C09 real PostgreSQL credential/session writer interleavings', { skip: skipWithoutDatabase, timeout: 120_000 }, async t => {
    const db = await createDisposableDatabase(); t.after(() => db.close());
    type Action = 'authenticate' | 'activate' | 'reissue' | 'mutation';
    type Result =
        | { kind: 'authenticate'; value: Awaited<ReturnType<IdentityRuntime['authenticate']>> }
        | { kind: 'activate'; value: Awaited<ReturnType<IdentityRuntime['activate']>> }
        | { kind: 'reissue'; value: Awaited<ReturnType<IdentityRuntime['issueActivation']>> }
        | { kind: 'mutation'; value: Awaited<ReturnType<IdentityRuntime['resolveSessionForMutation']>> };
    const scenarios: { first: Action; second: Action; hold: 'credential' | 'session' | 'revocation' }[] = [
        { first: 'authenticate', second: 'reissue', hold: 'credential' },
        { first: 'reissue', second: 'authenticate', hold: 'credential' },
        { first: 'activate', second: 'reissue', hold: 'credential' },
        { first: 'reissue', second: 'activate', hold: 'credential' },
        { first: 'mutation', second: 'reissue', hold: 'session' },
        { first: 'reissue', second: 'mutation', hold: 'revocation' },
    ];
    for (const scenario of scenarios) await t.test(`${scenario.first} wins before ${scenario.second}`, async () => {
        const person = await createPersonWithAccount(db.pool);
        const [a, b, observer, identityHolder] = await Promise.all(Array.from({ length: 4 }, () => db.pool.connect()));
        const barrier = c09Barrier();
        let first: ReturnType<typeof c09Observe<Result>> | undefined;
        let second: ReturnType<typeof c09Observe<Result>> | undefined;
        try {
            for (const c of [a, b, observer, identityHolder]) await c.query("SET statement_timeout = '15s'");
            const runtime = new IdentityRuntime(observer as unknown as pg.Client);
            const login = await runtime.authenticate(person.username, person.password);
            assert.ok(login.success); if (!login.success) throw new Error('Initial login failed');
            const initialSession = login.session;
            const activation = await runtime.issueActivation(person.accountId, { rotatePassword: false }); assert.ok(activation);
            const originalActivationId = (await observer.query('SELECT id FROM identity_account_activations WHERE user_account_id=$1',[person.accountId])).rows[0].id;
            const identity = async () => {
                const snapshot: Record<string, unknown> = {};
                for (const table of ['identity_persons','identity_user_accounts','identity_person_account_bindings','identity_login_identifiers'])
                    snapshot[table] = (await observer.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
                return snapshot;
            };
            const beforeIdentity = await identity();
            const beforeActivity = (await observer.query('SELECT last_activity_at FROM identity_sessions WHERE id=$1',[login.session.sessionId])).rows[0].last_activity_at;
            // These are real locks. Unchanged credential/session writers must finish
            // without acquiring Person/binding locks behind their credential locks.
            await identityHolder.query('BEGIN');
            await identityHolder.query('SELECT id FROM identity_persons WHERE id=$1 FOR UPDATE',[person.personId]);
            await identityHolder.query('SELECT person_id FROM identity_person_account_bindings WHERE person_id=$1 FOR UPDATE',[person.personId]);
            const [aPid, bPid] = await Promise.all([a.query('SELECT pg_backend_pid() AS pid'), b.query('SELECT pg_backend_pid() AS pid')]);
            async function execute(action: Action, client: pg.Client): Promise<Result> {
                const r = new IdentityRuntime(client);
                if (action === 'authenticate') return { kind: action, value: await r.authenticate(person.username,person.password) };
                if (action === 'activate') return { kind: action, value: await r.activate(person.username,activation!.code,'langit-tenang-2027!') };
                if (action === 'reissue') return { kind: action, value: await r.issueActivation(person.accountId) };
                await client.query('BEGIN');
                try {
                    const value = await r.resolveSessionForMutation(initialSession.sessionId,initialSession.secret);
                    await client.query('COMMIT'); return { kind: 'mutation', value };
                } catch (error) { await client.query('ROLLBACK'); throw error; }
            }
            const matches = (sql: string) => scenario.hold === 'session' ? sql.includes('FOR UPDATE OF s FOR SHARE OF a')
                : scenario.hold === 'revocation' ? sql.includes('UPDATE identity_sessions SET is_revoked = TRUE')
                : sql.includes('identity_account_credentials') && sql.includes('FOR UPDATE');
            first = c09Observe(execute(scenario.first,c09Client(a,matches,barrier)));
            await Promise.race([barrier.reached,first.then(outcome => { throw outcome.ok ? new Error('Lock barrier not reached') : outcome.error; })]);
            second = c09Observe(execute(scenario.second,b as unknown as pg.Client));
            await c09Blocked(observer,bPid.rows[0].pid,aPid.rows[0].pid,second);
            barrier.release();
            const [one,two] = await Promise.all([first,second]);
            if (!one.ok) throw one.error; if (!two.ok) throw two.error;
            // Completion while identityHolder still owns Person/binding locks proves
            // the preserved lock order; a deadlock/timeout cannot become a PASS.
            const leading = one.value, following = two.value;
            if (leading.kind === 'authenticate' || leading.kind === 'activate') {
                assert.ok(leading.value.success); if (!leading.value.success) throw new Error('Leading credential operation failed');
                assert.equal(leading.value.personId,person.personId); assert.equal(leading.value.userAccountId,person.accountId);
                assert.equal(await runtime.resolveSession(leading.value.session.sessionId,leading.value.session.secret),null);
                if (leading.kind === 'activate') assert.equal((await runtime.authenticate(person.username,'langit-tenang-2027!')).success,false,'reset invalidates the concurrently activated password');
            } else if (leading.kind === 'mutation') {
                assert.ok(leading.value); assert.equal(leading.value.personId,person.personId);
            } else assert.ok(leading.value);
            if (following.kind === 'authenticate') assert.deepEqual(following.value,{ success:false,error:'INVALID_CREDENTIALS' });
            else if (following.kind === 'activate') assert.deepEqual(following.value,{ success:false,error:'INVALID_ACTIVATION' });
            else if (following.kind === 'mutation') {
                assert.equal(following.value,null);
                assert.deepEqual((await observer.query('SELECT last_activity_at FROM identity_sessions WHERE id=$1',[login.session.sessionId])).rows[0].last_activity_at,beforeActivity);
            } else assert.ok(following.value);
            assert.equal(await runtime.resolveSession(login.session.sessionId,login.session.secret),null);
            assert.equal((await observer.query('SELECT count(*)::int AS n FROM identity_sessions WHERE user_account_id=$1 AND NOT is_revoked',[person.accountId])).rows[0].n,0);
            assert.equal((await runtime.authenticate(person.username,person.password)).success,false);
            assert.deepEqual(await identity(),beforeIdentity);
            assert.equal((await observer.query('SELECT count(*)::int AS n FROM identity_user_accounts WHERE person_id=$1',[person.personId])).rows[0].n,1);
            const reset = leading.kind === 'reissue' ? leading.value : following.kind === 'reissue' ? following.value : null;
            assert.ok(reset);
            assert.equal((await runtime.activate(person.username,activation.code,'awan-tenang-2028!')).success,false,'superseded code never works after reset commit');
            const ledger = await observer.query('SELECT id,consumed_at,revoked_at FROM identity_account_activations WHERE user_account_id=$1',[person.accountId]);
            assert.equal(ledger.rows.length,2);
            const original = ledger.rows.find(r => r.id === originalActivationId);
            const replacement = ledger.rows.find(r => r.id !== originalActivationId);
            assert.ok(original); assert.ok(replacement); assert.ok(original.consumed_at || original.revoked_at);
            assert.equal(replacement.consumed_at,null); assert.equal(replacement.revoked_at,null);
        } finally {
            barrier.release(); await identityHolder.query('ROLLBACK').catch(() => {});
            await Promise.all([first,second].filter(p => p !== undefined));
            for (const c of [a,b,observer,identityHolder]) { await c.query('ROLLBACK').catch(() => {}); c.release(); }
        }
    });
});

test('AUTH-001 C09 activation expires during real credential/activation lock contention', { skip: skipWithoutDatabase, timeout: 60_000 }, async t => {
    const db = await createDisposableDatabase(); t.after(() => db.close());
    for (const held of ['credential','activation'] as const) await t.test(`expiry while waiting for ${held} lock`,async () => {
        const person = await createPersonWithAccount(db.pool);
        const issued = await issue(db.pool,person.accountId); assert.ok(issued);
        const [holder,waiter,observer] = await Promise.all(Array.from({ length:3 },() => db.pool.connect()));
        let pending: ReturnType<typeof c09Observe<Awaited<ReturnType<IdentityRuntime['activate']>>>> | undefined;
        try {
            for (const c of [holder,waiter,observer]) await c.query("SET statement_timeout = '15s'");
            const credentialBefore = (await observer.query('SELECT * FROM identity_account_credentials WHERE user_account_id=$1',[person.accountId])).rows;
            const sessionsBefore = (await observer.query('SELECT * FROM identity_sessions WHERE user_account_id=$1 ORDER BY id',[person.accountId])).rows;
            const codeBefore = (await observer.query('SELECT id,code_verifier,failed_attempts,consumed_at,revoked_at FROM identity_account_activations WHERE user_account_id=$1',[person.accountId])).rows;
            await holder.query('BEGIN');
            if (held === 'credential') await holder.query('SELECT user_account_id FROM identity_account_credentials WHERE user_account_id=$1 FOR UPDATE',[person.accountId]);
            else await holder.query('SELECT id FROM identity_account_activations WHERE user_account_id=$1 FOR UPDATE',[person.accountId]);
            assert.equal((await observer.query('SELECT expires_at > clock_timestamp() AS valid FROM identity_account_activations WHERE user_account_id=$1',[person.accountId])).rows[0].valid,true);
            const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
            const waiterPid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
            pending = c09Observe(new IdentityRuntime(waiter as unknown as pg.Client).activate(person.username,issued.code,'waktu-tenang-2029!'));
            await c09Blocked(observer,waiterPid,holderPid,pending);
            // Shorten only this synthetic fixture's deadline AFTER proven blocking.
            // The real server and process clocks must both cross it before release.
            const expiry = await holder.query(`UPDATE identity_account_activations SET issued_at=clock_timestamp()-interval '2 hours',
                expires_at=clock_timestamp()+interval '100 milliseconds' WHERE user_account_id=$1 RETURNING expires_at`,[person.accountId]);
            const expiresAt = new Date(expiry.rows[0].expires_at).getTime();
            const deadline = Date.now()+10_000; let expired = false;
            while (Date.now()<deadline) {
                const server = await holder.query('SELECT clock_timestamp() >= $1::timestamptz AS expired',[expiry.rows[0].expires_at]);
                if (server.rows[0].expired && Date.now()>expiresAt) { expired=true; break; }
            }
            assert.equal(expired,true,'actual clocks crossed the expiry while the operation remained blocked');
            await holder.query('COMMIT');
            const result = await pending; if (!result.ok) throw result.error;
            assert.deepEqual(result.value,{ success:false,error:'INVALID_ACTIVATION' });
            assert.deepEqual((await observer.query('SELECT * FROM identity_account_credentials WHERE user_account_id=$1',[person.accountId])).rows,credentialBefore);
            assert.deepEqual((await observer.query('SELECT * FROM identity_sessions WHERE user_account_id=$1 ORDER BY id',[person.accountId])).rows,sessionsBefore);
            assert.deepEqual((await observer.query('SELECT id,code_verifier,failed_attempts,consumed_at,revoked_at FROM identity_account_activations WHERE user_account_id=$1',[person.accountId])).rows,codeBefore);
            assert.equal((await observer.query('SELECT person_id FROM identity_user_accounts WHERE id=$1',[person.accountId])).rows[0].person_id,person.personId);
        } finally {
            await holder.query('ROLLBACK').catch(() => {}); if (pending) await pending;
            for (const c of [holder,waiter,observer]) { await c.query('ROLLBACK').catch(() => {}); c.release(); }
        }
    });
});

test('account activation (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 1 Contoh');
    const NEW_PASSWORD = 'matahari-pagi-2026';

    async function provisioned() {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        const issued = await issue(pool, person.accountId);
        assert.ok(issued);
        return { person, code: issued.code, client: new BrowserLikeClient(app.baseUrl) };
    }
    const activate = (client: BrowserLikeClient, username: string, activationCode: string, newPassword = NEW_PASSWORD) =>
        client.request('/api/v1/auth/activate', { method: 'POST', body: { username, activationCode, newPassword } });

    await t.test('an activation-required account cannot sign in with any password', async () => {
        const { person, client } = await provisioned();
        assert.equal((await client.login(person.username, person.password)).status, 401, 'the pre-provisioning password is gone');
    });

    await t.test('activation signs the person in once, with their own password, and the code dies', async () => {
        const { person, code, client } = await provisioned();
        const res = await activate(client, person.username, code.toLowerCase().replace(/-/g, ' '));
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'authenticated');
        assert.deepEqual(res.body.memberships, [{ tenantId: tenant, displayLabel: 'SMA Negeri 1 Contoh' }]);
        assert.ok(client.cookie);
        assert.equal((await client.request('/api/v1/auth/session')).status, 200);

        const again = await activate(new BrowserLikeClient(app.baseUrl), person.username, code);
        assert.equal(again.status, 401);
        assert.deepEqual(again.body, { error: 'invalid_activation' });

        const login = new BrowserLikeClient(app.baseUrl);
        assert.equal((await login.login(person.username, NEW_PASSWORD)).status, 200);
        const stored = await pool.query('SELECT code_verifier FROM identity_account_activations WHERE user_account_id = $1', [person.accountId]);
        assert.doesNotMatch(stored.rows[0].code_verifier, new RegExp(code.replace(/-/g, '')), 'only a verifier is stored');
    });

    await t.test('weak passwords are refused before the code is checked or counted', async () => {
        const { person, code, client } = await provisioned();
        for (const [password, reason] of [['1234567', 'too_short'], ['katasandi', 'too_common'], [`${person.username}99`, 'contains_username']] as const) {
            const res = await activate(client, person.username, code, password);
            assert.equal(res.status, 400);
            assert.deepEqual(res.body, { error: 'password_rejected', reason });
        }
        const row = await pool.query('SELECT failed_attempts FROM identity_account_activations WHERE user_account_id = $1', [person.accountId]);
        assert.equal(row.rows[0].failed_attempts, 0);
        assert.equal((await activate(client, person.username, code)).status, 200);
    });

    await t.test('wrong code, unknown account and malformed code are indistinguishable', async () => {
        const { person, client } = await provisioned();
        const responses = [
            await activate(client, person.username, 'ABCD-EFGH-JKMN'),
            await activate(client, 'tidak.ada.akun', 'ABCD-EFGH-JKMN'),
            await activate(client, person.username, 'bukan-kode'),
        ];
        for (const res of responses) {
            assert.equal(res.status, 401);
            assert.deepEqual(res.body, { error: 'invalid_activation' });
        }
    });

    await t.test('ten wrong codes revoke the activation; the right code then fails too', async () => {
        const { person, code, client } = await provisioned();
        for (let i = 0; i < 10; i++) assert.equal((await activate(client, person.username, 'ABCD-EFGH-JKMN')).status, 401);
        assert.equal((await activate(client, person.username, code)).status, 401);
        const row = await pool.query('SELECT failed_attempts, revoked_at FROM identity_account_activations WHERE user_account_id = $1', [person.accountId]);
        assert.equal(row.rows[0].failed_attempts, 10);
        assert.ok(row.rows[0].revoked_at);
    });

    await t.test('an expired code is refused', async () => {
        const { person, code, client } = await provisioned();
        await pool.query(
            `UPDATE identity_account_activations SET issued_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' WHERE user_account_id = $1`,
            [person.accountId]
        );
        assert.equal((await activate(client, person.username, code)).status, 401);
    });

    await t.test('a reissue (administrative reset) stops the old password, revokes sessions and replaces the code', async () => {
        const { person, code, client } = await provisioned();
        assert.equal((await activate(client, person.username, code)).status, 200);
        const reissued = await issue(pool, person.accountId);
        assert.ok(reissued);
        assert.equal((await client.request('/api/v1/auth/session')).status, 401, 'existing session revoked');
        assert.equal((await new BrowserLikeClient(app.baseUrl).login(person.username, NEW_PASSWORD)).status, 401, 'old password stopped');
        const fresh = new BrowserLikeClient(app.baseUrl);
        assert.equal((await activate(fresh, person.username, reissued.code, 'bintang-senja-2027')).status, 200);
    });

    await t.test('a login lockout does not block activation (recovery stays available, DEC-041)', async () => {
        const { person, code } = await provisioned();
        // As after 10 consecutive failures (DEC-041), the account is in its 15-minute lock.
        await pool.query(`UPDATE identity_account_credentials SET consecutive_failures_count = 10, locked_until = now() + interval '15 minutes' WHERE user_account_id = $1`, [person.accountId]);
        assert.equal((await new BrowserLikeClient(app.baseUrl).login(person.username, 'apa-saja-12345')).status, 429, 'login is locked');
        assert.equal((await activate(new BrowserLikeClient(app.baseUrl), person.username, code)).status, 200);
        const cleared = await pool.query('SELECT locked_until, consecutive_failures_count FROM identity_account_credentials WHERE user_account_id = $1', [person.accountId]);
        assert.equal(cleared.rows[0].locked_until, null, 'activation clears the lock');
        assert.equal(cleared.rows[0].consecutive_failures_count, 0);
    });

    await t.test('one open activation per account at a time', async () => {
        const { person } = await provisioned();
        await issue(pool, person.accountId, { rotatePassword: false });
        const open = await pool.query(
            'SELECT count(*)::int AS n FROM identity_account_activations WHERE user_account_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL',
            [person.accountId]
        );
        assert.equal(open.rows[0].n, 1);
    });
});

test('AUTH-002 legacy activation refuses a claim-issued code without counting; ordinary cards keep their semantics', { skip: skipWithoutDatabase, timeout: 60000 }, async t => {
    const db = await createDisposableDatabase(); const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const tenant = await createTenant(db.pool), verifier = await createPersonWithAccount(db.pool), membership = await addMembership(db.pool, tenant, verifier.personId);
    const teaching = await createTeachingContext(db.pool, tenant, membership);
    const { academic_year_id: year } = (await db.pool.query('SELECT academic_year_id FROM academic_core_academic_groups WHERE id=$1', [teaching.academicGroupId])).rows[0];
    const { academic_period_id: period } = (await db.pool.query('SELECT o.academic_period_id FROM academic_core_subject_offerings o JOIN academic_core_teaching_assignments a ON a.subject_offering_id=o.id WHERE a.id=$1', [teaching.teachingAssignmentId])).rows[0];
    const c0 = await db.pool.connect();
    try { await c0.query('BEGIN'); await setSchoolOperator(c0, { tenantId: tenant, personId: verifier.personId, action: 'ASSIGN', operator: 'Synthetic', caseReference: 'AUTH-002', reason: 'Compatibility' }); await c0.query('COMMIT'); } finally { c0.release(); }
    await db.pool.query(`INSERT INTO academic_core_student_roster_records(tenant_id, source_student_key, full_name, nis, nisn, date_of_birth, academic_year_id, academic_period_id, academic_group_id)
        VALUES($1,'compat','Siswa Kompatibel','c1','0101','2010-01-01',$2,$3,$4)`, [tenant, year, period, teaching.academicGroupId]);
    const anonymous = new BrowserLikeClient(app.baseUrl);
    assert.equal((await anonymous.request('/api/v1/identity/claims', { method: 'POST', body: { tenantId: tenant, fullName: 'Siswa Kompatibel', nisn: '0101', birthDate: '2010-01-01', requestKey: randomUUID() } })).status, 202);
    const op = new BrowserLikeClient(app.baseUrl); assert.equal((await op.login(verifier.username, verifier.password)).status, 200); op.tenantId = tenant;
    const claim = (await db.pool.query('SELECT id, revision FROM identity_student_claims')).rows[0];
    const approved = await op.request('/api/v1/identity/claims/decision', { method: 'POST', body: {
        claimId: claim.id, expectedRevision: claim.revision, expectedRosterRevision: 1, decision: 'APPROVE', adjudication: 'NEW_IDENTITY_REVIEWED',
        noExistingAccountConfirmed: true, reason: 'Kompatibilitas', confirmed: true, requestKey: randomUUID() } });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const elligbleId = approved.body.elligbleId as string, code = approved.body.activationCode as string;
    const counter = async () => (await db.pool.query('SELECT a.failed_attempts, a.consumed_at FROM identity_student_claim_activations r JOIN identity_account_activations a ON a.id = r.activation_id')).rows[0];
    const c = await db.pool.connect();
    try {
        const runtime = new IdentityRuntime(c as unknown as pg.Client);
        // The unchanged entry point, called directly (the race closure of §6A.6): refused, nothing counted or consumed.
        assert.equal((await runtime.activate(elligbleId, code, 'KompatibelAman2026!')).success, false);
        assert.equal((await runtime.activate(elligbleId, 'AAAA-BBBB-CCCC', 'KompatibelAman2026!')).success, false);
        assert.deepEqual(await counter(), { failed_attempts: 0, consumed_at: null });
        // Approval created no usable password.
        assert.equal((await runtime.authenticate(elligbleId, 'KompatibelAman2026!')).success, false);
        // An ordinary card of another Account still counts failures and activates as before.
        const other = await createPersonWithAccount(db.pool);
        const card = await runtime.issueActivation(other.accountId); assert.ok(card);
        assert.equal((await runtime.activate(other.username, 'AAAA-BBBB-CCCC', 'KompatibelAman2026!')).success, false);
        assert.equal((await c.query('SELECT failed_attempts FROM identity_account_activations WHERE user_account_id=$1 AND revoked_at IS NULL AND consumed_at IS NULL', [other.accountId])).rows[0].failed_attempts, 1);
        assert.equal((await runtime.activate(other.username, card.code, 'KompatibelAman2026!')).success, true);
    } finally { c.release(); }
    // Through HTTP the claim-issued code is routed to the claim-bound coordinator and activates.
    assert.equal((await new BrowserLikeClient(app.baseUrl).request('/api/v1/auth/activate', { method: 'POST', body: { username: elligbleId, activationCode: code, newPassword: 'KompatibelAman2026!' } })).status, 200);
    assert.notEqual((await counter()).consumed_at, null);
    assert.equal((await db.pool.query('SELECT state FROM identity_student_claims WHERE id=$1', [claim.id])).rows[0].state, 'ACTIVATED');
});
