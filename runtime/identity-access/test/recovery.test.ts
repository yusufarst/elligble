import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOVERY_POLICY, recoveryDigest, recoveryRequestLockKey } from '../src/recovery.ts';

// AUTH-003 Identity recovery units (record §5/§6): O03 values, canonical advisory keys and
// deterministic request digests.

const T = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', K = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';

test('recovery policy is the approved O03 lifetime and failure bound', () => {
    assert.deepEqual(RECOVERY_POLICY, { VALIDITY_MINUTES: 15, MAX_FAILED_ATTEMPTS: 10 });
});

test('recovery request keys are validated canonical lowercase UUIDs', () => {
    assert.equal(recoveryRequestLockKey(T, K), `recovery-request:${T.toLowerCase()}:${K.toLowerCase()}`);
    for (const bad of ['', 'x', `${T} `]) assert.throws(() => recoveryRequestLockKey(bad, K), /Invalid recovery scope/);
});

test('recovery digests are deterministic and field-sensitive', () => {
    const base = { v: 1, tenant: T, actor: K, elligbleId: 'elg-abcd-efgh-jkmn', revision: 1, reason: 'Lupa kata sandi' };
    assert.equal(recoveryDigest(base), recoveryDigest({ ...base }));
    assert.match(recoveryDigest(base), /^[0-9a-f]{64}$/);
    assert.notEqual(recoveryDigest({ ...base, revision: 2 }), recoveryDigest(base));
    assert.notEqual(recoveryDigest({ ...base, reason: 'Lain' }), recoveryDigest(base));
});
