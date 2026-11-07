import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateAuthorize } from '../src/recovery.ts';
import { ClaimRefusal } from '../src/claims.ts';

// AUTH-003 transport-shape units (record §7): exact keys, in-person confirmation, no
// caller-supplied authority, bounded preview and issue shapes.

const ID = '11111111-1111-4111-8111-111111111111';
const refusal = (fn: () => unknown) => assert.throws(fn, (e: unknown) => e instanceof ClaimRefusal && e.status === 400);

test('preview accepts only the ELLIGBLE ID and confirmed:false', () => {
    assert.deepEqual(validateAuthorize({ elligbleId: ' elg-abcd-efgh-jkmn ', confirmed: false }),
        { elligbleId: 'elg-abcd-efgh-jkmn', confirmed: false, expectedRosterRevision: null, reason: null, requestKey: null });
    refusal(() => validateAuthorize({ elligbleId: 'x', confirmed: false, reason: 'r' }));
    refusal(() => validateAuthorize({ elligbleId: '', confirmed: false }));
    refusal(() => validateAuthorize({ elligbleId: 'x', confirmed: 'false' }));
});

test('issue needs roster revision, reason, request key and in-person confirmation, nothing else', () => {
    const issue = { elligbleId: 'elg-abcd-efgh-jkmn', confirmed: true, expectedRosterRevision: 2, reason: 'Lupa kata sandi', requestKey: ID.toUpperCase(), inPersonVerified: true };
    assert.deepEqual(validateAuthorize(issue), { elligbleId: 'elg-abcd-efgh-jkmn', confirmed: true, expectedRosterRevision: 2, reason: 'Lupa kata sandi', requestKey: ID });
    for (const extra of ['personId', 'tenantId', 'userAccountId', 'recoveryCode']) refusal(() => validateAuthorize({ ...issue, [extra]: ID }));
    refusal(() => validateAuthorize({ ...issue, inPersonVerified: false }));
    refusal(() => validateAuthorize({ ...issue, reason: ' ' }));
    refusal(() => validateAuthorize({ ...issue, expectedRosterRevision: 0 }));
    refusal(() => validateAuthorize({ ...issue, requestKey: 'abc' }));
    const { inPersonVerified: _omit, ...missing } = issue;
    refusal(() => validateAuthorize(missing));
});
