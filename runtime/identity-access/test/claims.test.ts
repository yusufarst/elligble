import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalClaimUuid, claimDigest, claimRequestLockKey, claimRosterLockKey, isOpenClaimState, CLAIM_OPEN_STATES } from '../src/claims.ts';

// AUTH-002 Identity claim units (record §6A.3/§6A.4): canonical lowercase advisory keys, no
// capability secret, deterministic digests and the open-state set that drives uniqueness.

const T = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', K = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';

test('claim advisory keys use validated canonical lowercase UUIDs only', () => {
    assert.equal(claimRequestLockKey(T, K), `claim-request:${T.toLowerCase()}:${K.toLowerCase()}`);
    assert.equal(claimRosterLockKey(T, K), `claim-roster:${T.toLowerCase()}:${K.toLowerCase()}`);
    assert.equal(claimRequestLockKey(T.toLowerCase(), K), claimRequestLockKey(T, K.toLowerCase()));
    for (const bad of ['', 'x', `${T} `, '11111111-1111-1111-1111-11111111111', 'g1111111-1111-4111-8111-111111111111']) {
        assert.throws(() => claimRequestLockKey(bad, K), /Invalid claim scope/);
        assert.throws(() => claimRosterLockKey(T, bad), /Invalid claim scope/);
    }
    assert.equal(canonicalClaimUuid(T), T.toLowerCase());
    assert.equal(canonicalClaimUuid(42), null);
    assert.equal(canonicalClaimUuid(`${T}\n`), null);
});

test('claim digests are deterministic and sensitive to every field', () => {
    const base = { v: 1, tenant: T, name: 'Siti', nisn: '0012', birth: '2010-01-02' };
    assert.equal(claimDigest(base), claimDigest({ ...base }));
    assert.match(claimDigest(base), /^[0-9a-f]{64}$/);
    for (const [k, v] of Object.entries({ tenant: K, name: 'siti', nisn: '012', birth: '2010-01-03' })) {
        assert.notEqual(claimDigest({ ...base, [k]: v }), claimDigest(base));
    }
});

test('only review and pending-activation states are open', () => {
    assert.deepEqual([...CLAIM_OPEN_STATES], ['PENDING_REVIEW', 'REVIEW_REQUIRED', 'APPROVED_PENDING_ACTIVATION']);
    for (const s of ['APPROVED_EXISTING_ACCOUNT', 'REJECTED', 'CANCELLED', 'ACTIVATED', 'EXPIRED', 'EXHAUSTED', 'CLOSED_BY_REISSUE'] as const) {
        assert.equal(isOpenClaimState(s), false);
    }
});
