import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type pg from 'pg';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTenant } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

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
