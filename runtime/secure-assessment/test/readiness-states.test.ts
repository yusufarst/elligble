import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { isReadinessEvaluableState } from '../src/readiness-states.ts';

test('readiness is evaluable only while SCHEDULED or READY', () => {
    assert.equal(isReadinessEvaluableState('SCHEDULED'), true);
    assert.equal(isReadinessEvaluableState('READY'), true);
    for (const state of ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED', '', null, undefined, 42]) {
        assert.equal(isReadinessEvaluableState(state), false, String(state));
    }
});
