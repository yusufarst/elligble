import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { ClientBase, PoolClient } from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { createPersonWithAccount, createTenant } from '../support/fixtures.ts';
import { allocateStudentIdentity, reserveStudentIdentity, type IdentityAuthority } from '../../../identity-access/src/student-identity.ts';
import { identifierKey } from '../../../identity-access/src/elligble-id.ts';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { listElligbleIds } from '../../../identity-access/src/directory.ts';
import { findAccountByElligbleId } from '../../../identity-access/src/provisioning.ts';

test('AUTH-001 persistence, allocation, legacy INSERT and rollback', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase(); t.after(() => db.close());
    const tenantId = await createTenant(db.pool);
    const personId = randomUUID(); await db.pool.query('INSERT INTO identity_persons(id) VALUES($1)', [personId]);
    const scope = { personId, tenantId }, request = randomUUID();
    let deny = false, failAudit = false;
    const authority: IdentityAuthority = {
        authorize: async (client, s) => {
            // This synthetic owning adapter authorizes only its explicitly assigned test scope.
            const known = await client.query('SELECT id FROM tenant_tenants WHERE id = $1', [s.tenantId]);
            return !deny && known.rowCount === 1 && s.personId === personId && s.tenantId === tenantId
                ? { kind: 'platform_operator', ref: 'synthetic-test-operator' } : null;
        },
        audit: async () => { if (failAudit) throw new Error('audit unavailable'); },
    };
    async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
        const c = await db.pool.connect();
        try { await c.query('BEGIN'); const value = await fn(c); await c.query('COMMIT'); return value; }
        catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    }
    async function state() {
        const result: Record<string, unknown> = {};
        for (const table of ['identity_user_accounts','identity_account_credentials','identity_person_account_bindings','identity_login_identifiers','identity_student_claim_reservations','identity_id_allocation_events'])
            result[table] = (await db.pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
        return result;
    }
    await t.test('unchanged autocommit fixture adopts binding/registry; credential UPDATE keeps identity', async () => {
        const legacy = await createPersonWithAccount(db.pool, 'Legacy.Case');
        const binding = await db.pool.query('SELECT canonical_account_id FROM identity_person_account_bindings WHERE person_id = $1', [legacy.personId]);
        assert.equal(binding.rows[0].canonical_account_id, legacy.accountId);
        const c = await db.pool.connect(); try {
            assert.equal((await findAccountByElligbleId(c, 'Legacy.Case'))?.userAccountId, legacy.accountId);
            assert.equal(await findAccountByElligbleId(c, 'legacy.case'), null);
            const ids = await listElligbleIds(c, [legacy.personId]); assert.equal(ids.get(legacy.personId), 'Legacy.Case');
        } finally { c.release(); }
        await db.pool.query('UPDATE identity_account_credentials SET is_valid = FALSE WHERE user_account_id = $1', [legacy.accountId]);
        await db.pool.query('UPDATE identity_account_credentials SET is_valid = TRUE WHERE user_account_id = $1', [legacy.accountId]);
        await assert.rejects(db.pool.query('UPDATE identity_user_accounts SET person_id = $1 WHERE id = $2', [personId, legacy.accountId]));
    });
    await t.test('audit failure restores exact allocation/reservation state', async () => {
        await tx(c => reserveStudentIdentity(c, scope, authority));
        const before = await state();
        await assert.rejects(tx(c => reserveStudentIdentity(c, scope, authority)), /reservation conflict/);
        await assert.rejects(db.pool.query(`INSERT INTO identity_student_claim_reservations(person_id,tenant_id,expires_at)
            VALUES($1,$2,statement_timestamp()+interval '7 days')`,[personId,tenantId]));
        assert.deepEqual(await state(), before);
        failAudit = true;
        try { await assert.rejects(tx(c => allocateStudentIdentity(c, scope, request, authority)), /audit unavailable/); }
        finally { failAudit = false; }
        assert.deepEqual(await state(), before);
    });
    await t.test('concurrent same-key allocation/replay has one effect and no secret; casefold only GENERATED', async () => {
        const results = await Promise.all([tx(c => allocateStudentIdentity(c, scope, request, authority)), tx(c => allocateStudentIdentity(c, scope, request, authority))]);
        assert.equal(results[0].receiptId, results[1].receiptId); assert.equal(results.filter(r => !r.replayed).length, 1);
        assert.equal(results[0].userAccountId, results[1].userAccountId);
        assert.deepEqual(Object.keys(results[0]).sort(), ['elligbleId','outcome','personId','receiptId','replayed','userAccountId']);
        const c = await db.pool.connect(); try {
            assert.equal((await findAccountByElligbleId(c, results[0].elligbleId.toUpperCase()))?.personId, personId);
            assert.equal((await listElligbleIds(c, [personId])).get(personId), results[0].elligbleId);
            const runtime = new IdentityRuntime(c as never);
            assert.equal((await runtime.authenticate(results[0].elligbleId.toUpperCase(), 'not-the-unusable-secret')).success, false);
        } finally { c.release(); }
        assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_id_allocation_events')).rows[0].n, 1);
        assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_student_claim_reservations WHERE person_id=$1 AND closed_at IS NULL',[personId])).rows[0].n, 0);
        assert.equal(identifierKey(results[0].elligbleId.toUpperCase()), results[0].elligbleId);
    });
    await t.test('different request keys serialize at Person and cannot allocate two Accounts', async () => {
        const p = randomUUID(); await db.pool.query('INSERT INTO identity_persons(id) VALUES($1)',[p]);
        const scoped: IdentityAuthority = { ...authority, authorize: async (_c, s) => s.personId === p && s.tenantId === tenantId
            ? { kind: 'platform_operator', ref: 'synthetic-concurrent-operator' } : null };
        const results = await Promise.all([tx(c => allocateStudentIdentity(c,{ personId:p, tenantId },randomUUID(),scoped)),
            tx(c => allocateStudentIdentity(c,{ personId:p, tenantId },randomUUID(),scoped))]);
        assert.equal(results[0].userAccountId,results[1].userAccountId);
        assert.deepEqual(results.map(r => r.outcome).sort(),['allocated','existing']);
        assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_user_accounts WHERE person_id=$1',[p])).rows[0].n,1);
    });
    await t.test('authorization runs before replay; cross-tenant/ambiguous subject never allocates', async () => {
        const before = await state(); deny = true;
        try { await assert.rejects(tx(c => allocateStudentIdentity(c, scope, request, authority)), /refused/); }
        finally { deny = false; }
        await assert.rejects(tx(c => allocateStudentIdentity(c, { personId, tenantId: randomUUID() }, request, authority)), /refused/);
        assert.deepEqual(await state(), before);
        await assert.rejects(tx(c => reserveStudentIdentity(c, scope, authority)), /Canonical account/);
        const otherPerson = randomUUID(); await db.pool.query('INSERT INTO identity_persons(id) VALUES($1)',[otherPerson]);
        const assigned: IdentityAuthority = { ...authority, authorize: async (_client, s) =>
            s.tenantId === tenantId && [personId,otherPerson].some(id => id === s.personId)
                ? { kind: 'platform_operator', ref: 'synthetic-test-operator' } : null };
        const beforeConflict = await state();
        await assert.rejects(tx(c => allocateStudentIdentity(c, { personId: otherPerson, tenantId }, request, assigned)), /request conflict/);
        assert.deepEqual(await state(), beforeConflict);
    });
    await t.test('direct SQL conflicts/mismatch/skipped INSERT leave no partial binding or registry', async () => {
        const legacy = await createPersonWithAccount(db.pool);
        const p = randomUUID(), a = randomUUID();
        await db.pool.query('INSERT INTO identity_persons(id) VALUES($1)', [p]);
        await db.pool.query('INSERT INTO identity_user_accounts(id,person_id) VALUES($1,$2)', [a,p]);
        const before = await state();
        await assert.rejects(db.pool.query(`INSERT INTO identity_account_credentials(user_account_id,username,password_verifier)
            VALUES($1,'skipped-alias','unusable') ON CONFLICT DO NOTHING`,[legacy.accountId]), /Identifier without matching credential/);
        assert.deepEqual(await state(), before);
        await assert.rejects(db.pool.query(`INSERT INTO identity_account_credentials(user_account_id,username,password_verifier) VALUES($1,$2,'unusable') ON CONFLICT DO NOTHING`,[a,legacy.username]));
        assert.deepEqual(await state(), before);
        await assert.rejects(db.pool.query(`INSERT INTO identity_account_credentials(user_account_id,person_id,username,password_verifier) VALUES($1,$2,'mismatch','unusable')`,[a,legacy.personId]));
        assert.deepEqual(await state(), before);
        const other = randomUUID(); await db.pool.query('INSERT INTO identity_user_accounts(id,person_id) VALUES($1,$2)',[other,legacy.personId]);
        await assert.rejects(db.pool.query(`INSERT INTO identity_account_credentials(user_account_id,username,password_verifier) VALUES($1,'other-account','unusable')`,[other]));
        await assert.rejects(db.pool.query('DELETE FROM identity_login_identifiers WHERE user_account_id=$1',[legacy.accountId]));
    });
});

test('AUTH-001 populated 0054 upgrade preserves legacy and repeat is no-op; ambiguity refuses atomically', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase({ migrate: false }); t.after(() => db.close());
    const dir = new URL('../../../../database/migrations/', import.meta.url);
    const files = (await readdir(dir)).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
    const c = await db.pool.connect();
    try {
        for (const file of files.filter(f => f < '0055')) await c.query(await readFile(new URL(file, dir), 'utf8'));
        const p = randomUUID(), a = randomUUID(), b = randomUUID();
        await c.query('INSERT INTO identity_persons(id) VALUES($1)',[p]);
        await c.query('INSERT INTO identity_user_accounts(id,person_id) VALUES($1,$3),($2,$3)',[a,b,p]);
        const sql = await readFile(new URL('0055_identity_student_identity_allocation.sql',dir),'utf8');
        await assert.rejects(c.query(sql), /Ambiguous/); await c.query('ROLLBACK');
        assert.equal((await c.query("SELECT to_regclass('identity_person_account_bindings') AS relation")).rows[0].relation,null);
        await c.query('DELETE FROM identity_user_accounts WHERE id=$1',[b]);
        await c.query(`INSERT INTO identity_account_credentials(user_account_id,username,password_verifier) VALUES($1,'Legacy.Upgrade','original-verifier')`,[a]);
        const before = (await c.query('SELECT username,password_verifier,is_valid FROM identity_account_credentials')).rows;
        await c.query('INSERT INTO identity_user_accounts(id,person_id) VALUES($1,$2)',[b,p]);
        await c.query(`INSERT INTO identity_account_credentials(user_account_id,username,password_verifier,is_valid) VALUES($1,'Historical.Invalid','old-verifier',FALSE)`,[b]);
        const allBefore = (await c.query('SELECT user_account_id,username,password_verifier,is_valid FROM identity_account_credentials ORDER BY username')).rows;
        await c.query(sql); await c.query(sql);
        assert.deepEqual((await c.query('SELECT username,password_verifier,is_valid FROM identity_account_credentials WHERE user_account_id=$1',[a])).rows,before);
        assert.deepEqual((await c.query('SELECT user_account_id,username,password_verifier,is_valid FROM identity_account_credentials ORDER BY username')).rows,allBefore);
        assert.equal((await c.query('SELECT canonical_account_id FROM identity_person_account_bindings WHERE person_id=$1',[p])).rows[0].canonical_account_id,a);
        assert.equal((await listElligbleIds(c,[p])).get(p),'Legacy.Upgrade');
        await assert.rejects(c.query('UPDATE identity_account_credentials SET is_valid=TRUE WHERE user_account_id=$1',[b]));
        assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id='0055_identity_student_identity_allocation'")).rows[0].n,1);
    } finally { c.release(); }
});
