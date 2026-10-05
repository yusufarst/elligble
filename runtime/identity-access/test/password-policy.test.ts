import test from 'node:test';
import assert from 'node:assert';
import { checkNewPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../src/password-policy.ts';
import {
  ACTIVATION_CODE_ALPHABET, ACTIVATION_CODE_LENGTH, formatActivationCode, generateActivationCode, normalizeActivationCode,
} from '../src/crypto.ts';

test('password length follows DEC-022 and DEC-041 without composition rules', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.ok(PASSWORD_MAX_LENGTH >= 64);
  assert.equal(checkNewPassword('pendek7'), 'too_short');
  assert.equal(checkNewPassword('kucingoranye'), null, 'lower-case only is fine');
  assert.equal(checkNewPassword('x'.repeat(63) + 'y'), null, '64 characters are supported');
  assert.equal(checkNewPassword('ab'.repeat(65)), 'too_long');
  assert.equal(checkNewPassword('🙂🙂🙂🙂 kue'), null, 'length counts characters, not bytes');
  assert.equal(checkNewPassword(undefined), 'too_short');
});

test('common and trivially guessable passwords are refused (local blocklist)', () => {
  for (const weak of ['12345678', 'Password123', 'BISMILLAH', 'katasandi', 'aaaaaaaa', 'abcdefgh', '87654321', 'sekolah123']) {
    assert.equal(checkNewPassword(weak), 'too_common', weak);
  }
  assert.equal(checkNewPassword('matahari-terbit-7'), null);
});

test('a password containing the ELLIGBLE ID is refused', () => {
  assert.equal(checkNewPassword('siswa.demo2026', { username: 'siswa.demo' }), 'contains_username');
  assert.equal(checkNewPassword('bukan-akun-saya', { username: 'abc' }), null, 'very short ids are not matched');
});

test('activation codes are 12 unambiguous characters, formatted in groups, parsed leniently', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const code = generateActivationCode();
    assert.equal(code.length, ACTIVATION_CODE_LENGTH);
    for (const ch of code) assert.ok(ACTIVATION_CODE_ALPHABET.includes(ch));
    seen.add(code);
  }
  assert.equal(seen.size, 200);
  assert.ok(!/[IL O01]/.test(ACTIVATION_CODE_ALPHABET));
  const code = generateActivationCode();
  const formatted = formatActivationCode(code);
  assert.match(formatted, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normalizeActivationCode(formatted.toLowerCase()), code);
  assert.equal(normalizeActivationCode(` ${code.slice(0, 6)} ${code.slice(6)} `), code);
  assert.equal(normalizeActivationCode('ABCD-EFGH-IJK0'), null, 'ambiguous characters are not valid');
  assert.equal(normalizeActivationCode('ABCD'), null);
  assert.equal(normalizeActivationCode(42), null);
});
