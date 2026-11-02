import test from 'node:test';
import assert from 'node:assert/strict';
import { generateElligbleId, identifierKey, GENERATED_ID_PATTERN, ELLIGBLE_ID_ALPHABET } from '../src/elligble-id.ts';
import { allocateStudentIdentity, type IdentityAuthority } from '../src/student-identity.ts';
import type { ClientBase } from 'pg';

test('generated IDs use exact approved format and alphabet; legacy keys preserve case', () => {
    assert.equal(new Set(ELLIGBLE_ID_ALPHABET).size, 31);
    const ids = Array.from({ length: 1000 }, () => generateElligbleId());
    for (const id of ids) { assert.equal(id.length, 18); assert.match(id, GENERATED_ID_PATTERN); assert.equal(identifierKey(id.toUpperCase()), id); }
    assert.equal(identifierKey('Legacy.Name'), 'Legacy.Name');
    assert.equal(identifierKey('ELG-0000-0000-0000'), 'ELG-0000-0000-0000');
});

test('ten registry collisions exhaust allocation and roll back its complete savepoint', async () => {
    const queries: string[] = []; let collisions = 0; let audited = false;
    const client = { async query(sql: string) {
        queries.push(sql);
        if (sql.includes('transaction_isolation')) return { rowCount: 1, rows: [{ isolation: 'read committed' }] };
        if (sql.includes('INSERT INTO identity_login_identifiers')) { collisions++; throw Object.assign(new Error('collision'), { code: '23505' }); }
        if (sql.includes('FROM identity_persons')) return { rowCount: 1, rows: [{ id: 'person' }] };
        return { rowCount: 0, rows: [] };
    } } as unknown as ClientBase;
    const authority: IdentityAuthority = { authorize: async () => ({ kind: 'platform_operator', ref: 'synthetic-authorized-operator' }), audit: async () => { audited = true; } };
    await assert.rejects(allocateStudentIdentity(client, { personId: '11111111-1111-4111-8111-111111111111', tenantId: '22222222-2222-4222-8222-222222222222' },
        '33333333-3333-4333-8333-333333333333', authority), /collision limit/);
    assert.equal(collisions, 10); assert.equal(audited, false);
    assert.deepEqual(queries.slice(-2), ['ROLLBACK TO SAVEPOINT identity_allocation', 'RELEASE SAVEPOINT identity_allocation']);
});
