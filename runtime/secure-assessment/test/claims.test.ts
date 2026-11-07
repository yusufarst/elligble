import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { claimError, ClaimRefusal, schoolLocalDate, validateClaimSubmission, validateDecision } from '../src/claims.ts';
import { AuthenticationError } from '../src/http/authenticated-context.ts';

// AUTH-002 transport-shape units (record §7): exact keys, no caller-supplied authority,
// adjudication rules, bounded error projection and school-local enrollment dates.

const ID = '11111111-1111-4111-8111-111111111111';
const submission: Record<string, unknown> = { tenantId: ID, fullName: 'Siti', nisn: '0012', birthDate: '2010-01-02', requestKey: ID };
const refusal = (fn: () => unknown, status: number) => assert.throws(fn, (e: unknown) => e instanceof ClaimRefusal && e.status === status);

test('public submission accepts exactly the bounded non-trusted fields', () => {
    assert.deepEqual(validateClaimSubmission({ ...submission, tenantId: ID.toUpperCase(), fullName: '  Siti ' }),
        { tenantId: ID, requestKey: ID, name: 'Siti', nisn: '0012', birth: '2010-01-02' });
    for (const extra of ['personId', 'accountId', 'membershipId', 'rosterId', 'state', 'capability']) refusal(() => validateClaimSubmission({ ...submission, [extra]: ID }), 400);
    for (const key of Object.keys(submission)) {
        const rest = { ...submission };
        delete rest[key];
        refusal(() => validateClaimSubmission(rest), 400);
    }
    refusal(() => validateClaimSubmission({ ...submission, nisn: 12 }), 400);
    refusal(() => validateClaimSubmission({ ...submission, birthDate: '2010-13-01' }), 400);
});

test('decisions need reason, confirmation and exactly one adjudication for approval', () => {
    const base: Record<string, unknown> = { claimId: ID, expectedRevision: 1, decision: 'REJECT', reason: 'Data tidak cocok', confirmed: true, requestKey: ID };
    assert.equal(validateDecision(base).decision, 'REJECT');
    refusal(() => validateDecision({ ...base, confirmed: 'true' }), 400);
    refusal(() => validateDecision({ ...base, reason: ' ' }), 400);
    refusal(() => validateDecision({ ...base, expectedRevision: 0 }), 400);
    refusal(() => validateDecision({ ...base, adjudication: 'EXISTING_BINDING' }), 400);
    refusal(() => validateDecision({ ...base, actorPersonId: ID }), 400);
    const approve = { ...base, decision: 'APPROVE', expectedRosterRevision: 1 };
    assert.equal(validateDecision({ ...approve, adjudication: 'EXISTING_BINDING' }).adjudication, 'EXISTING_BINDING');
    assert.equal(validateDecision({ ...approve, adjudication: 'EXISTING_ACCOUNT_CONTINUITY', elligbleId: ' elg-abcd-efgh-jkmn ' }).elligbleId, 'elg-abcd-efgh-jkmn');
    assert.equal(validateDecision({ ...approve, adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true }).noExistingAccountConfirmed, true);
    refusal(() => validateDecision(approve), 400);
    refusal(() => validateDecision({ ...approve, adjudication: 'MERGE' }), 400);
    refusal(() => validateDecision({ ...approve, adjudication: 'EXISTING_ACCOUNT_CONTINUITY' }), 400);
    refusal(() => validateDecision({ ...approve, adjudication: 'NEW_IDENTITY_REVIEWED' }), 400);
    refusal(() => validateDecision({ ...approve, adjudication: 'EXISTING_BINDING', elligbleId: 'x' }), 400);
    refusal(() => validateDecision({ ...approve, adjudication: 'EXISTING_BINDING', expectedRosterRevision: null }), 400);
});

test('errors project to bounded codes; unknown failures are persistence_unavailable', () => {
    assert.deepEqual(claimError(new ClaimRefusal(409, 'review_required')), { status: 409, code: 'review_required' });
    assert.deepEqual(claimError(new AuthenticationError(401, 'unauthorized')), { status: 401, code: 'unauthorized' });
    assert.deepEqual(claimError(new Error('duplicate key value violates unique constraint (nisn=0012)')), { status: 503, code: 'persistence_unavailable' });
});

test('enrollment start date is the school-local calendar date', () => {
    const instant = new Date('2026-11-06T18:30:00Z');
    assert.equal(schoolLocalDate(instant, 'Asia/Jakarta'), '2026-11-07');
    assert.equal(schoolLocalDate(instant, 'UTC'), '2026-11-06');
    assert.equal(schoolLocalDate(instant, 'Asia/Jayapura'), '2026-11-07');
});
