import test from 'node:test';
import assert from 'node:assert';
import { AcademicSetupConflict, isIsoDate, isLabel } from '../src/provisioning.ts';

test('calendar dates must be real ISO dates', () => {
  assert.equal(isIsoDate('2026-07-13'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('13-07-2026'), false);
  assert.equal(isIsoDate(20260713), false);
});

test('labels are non-blank and bounded', () => {
  assert.equal(isLabel('X-1'), true);
  assert.equal(isLabel('   '), false);
  assert.equal(isLabel('x'.repeat(256)), false);
});

test('conflicts name the entity', () => {
  const err = new AcademicSetupConflict('academic group', 'Group "X-1" exists in another grade.');
  assert.equal(err.entity, 'academic group');
  assert.ok(err instanceof Error);
});
