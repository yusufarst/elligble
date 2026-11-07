import test from 'node:test';
import assert from 'node:assert/strict';
import { activeHomeroomResponsibilities, homeroomCovers, validateHomeroomChange, type ActiveHomeroom } from '../src/homeroom.ts';

// AUTH-002 Homeroom responsibility units: explicit own-rombel scope, effective-time window,
// and validation of the audited bootstrap input.

const G = '11111111-1111-4111-8111-111111111111', P = '22222222-2222-4222-8222-222222222222';
const T = '33333333-3333-4333-8333-333333333333', M = '44444444-4444-4444-8444-444444444444';

test('Homeroom covers exactly its own group and period', () => {
    const own: ActiveHomeroom[] = [{ id: 'r', academicYearId: 'y', academicGroupId: G, academicPeriodId: P }];
    assert.equal(homeroomCovers(own, { academicGroupId: G.toUpperCase(), academicPeriodId: P }), true);
    assert.equal(homeroomCovers(own, { academicGroupId: P, academicPeriodId: P }), false);
    assert.equal(homeroomCovers(own, { academicGroupId: G, academicPeriodId: G }), false);
    assert.equal(homeroomCovers([], { academicGroupId: G, academicPeriodId: P }), false);
});

test('effective time excludes future, ended and boundary-equal windows', async () => {
    const now = new Date('2026-11-07T00:00:00Z');
    const rows = [
        { id: 'a', academic_year_id: 'y', academic_period_id: P, academic_group_id: G, effective_from: '2026-11-01T00:00:00Z', effective_until: null },
        { id: 'b', academic_year_id: 'y', academic_period_id: P, academic_group_id: G, effective_from: '2026-11-08T00:00:00Z', effective_until: null },
        { id: 'c', academic_year_id: 'y', academic_period_id: P, academic_group_id: G, effective_from: '2026-11-01T00:00:00Z', effective_until: '2026-11-07T00:00:00Z' },
    ];
    const client = { query: async () => ({ rows }) } as never;
    assert.deepEqual((await activeHomeroomResponsibilities(client, T, M, now)).map(r => r.id), ['a']);
    assert.deepEqual(await activeHomeroomResponsibilities(client, 'bad', M, now), []);
});

test('bootstrap input requires UUID scope and named operator, case and reason', () => {
    const ok = { tenantId: T, personId: M, action: 'ASSIGN' as const, academicGroupId: G, academicPeriodId: P, operator: 'Operator', caseReference: 'Kasus', reason: 'Alasan' };
    assert.doesNotThrow(() => validateHomeroomChange(ok));
    for (const bad of [{ ...ok, tenantId: 'x' }, { ...ok, action: 'GRANT' as never }, { ...ok, operator: ' ' }, { ...ok, reason: 'x'.repeat(201) }, { ...ok, effectiveUntil: 'never' }]) {
        assert.throws(() => validateHomeroomChange(bad), /Invalid Homeroom/);
    }
});
