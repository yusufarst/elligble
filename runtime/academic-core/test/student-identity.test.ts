import test from 'node:test';
import assert from 'node:assert/strict';
import { claimNamesMatch, isClaimBirthDate, isClaimName, isClaimNisn, normalizeClaimName } from '../src/student-identity.ts';

// AUTH-002 §6A.7 deterministic name confirmation and bounded claim matching fields.

test('name confirmation is NFC, trimmed, whitespace-collapsed, case-folded exact equality', () => {
    assert.equal(normalizeClaimName('  Siti   Rahmawati '), 'siti rahmawati');
    assert.equal(claimNamesMatch('SITI\tRAHMAWATI', 'Siti Rahmawati'), true);
    assert.equal(claimNamesMatch('René', 'René'), true);
    assert.equal(claimNamesMatch('Siti Rahmawat', 'Siti Rahmawati'), false);
    assert.equal(claimNamesMatch('Siti R.', 'Siti R'), false);
});

test('NISN keeps leading zeros and refuses padding, control characters and overlong values', () => {
    assert.equal(isClaimNisn('0012345678'), true);
    for (const bad of ['', ' 0012', '0012 ', '00\u000012', 'x'.repeat(65), 12345 as unknown]) assert.equal(isClaimNisn(bad), false);
});

test('names and birth dates are bounded and strictly valid', () => {
    assert.equal(isClaimName('Siti'), true);
    for (const bad of ['', '   ', 'a'.repeat(201), 'a\u0007b', null]) assert.equal(isClaimName(bad), false);
    assert.equal(isClaimBirthDate('2010-02-28'), true);
    for (const bad of ['2010-02-30', '2010-2-1', '20100201', '']) assert.equal(isClaimBirthDate(bad), false);
});
