import test from 'node:test';
import assert from 'node:assert';
import {
  hashPassword,
  verifyPassword,
  generateSessionSecret,
  verifySessionSecret,
  DEFAULT_SCRYPT_PARAMS
} from '../src/crypto.ts';

test('Password hashing - verifier format, explicit KDF parameters and distinctness from plaintext', () => {
  const password = 'SuperSecretPassword2026!';
  const hash = hashPassword(password);

  // Verifier must not equal plaintext password
  assert.notStrictEqual(hash, password);
  assert.strictEqual(hash.includes(password), false);

  // Self-describing format check
  assert.ok(hash.startsWith('scrypt$v=1$'));
  const parts = hash.split('$');
  assert.strictEqual(parts.length, 5);
  assert.strictEqual(parts[0], 'scrypt');
  assert.strictEqual(parts[1], 'v=1');
  assert.strictEqual(
    parts[2],
    `N=${DEFAULT_SCRYPT_PARAMS.N},r=${DEFAULT_SCRYPT_PARAMS.r},p=${DEFAULT_SCRYPT_PARAMS.p},keylen=${DEFAULT_SCRYPT_PARAMS.keylen}`
  );

  const salt = parts[3];
  const derivedKey = parts[4];
  assert.strictEqual(salt.length, 32); // 16 bytes in hex = 32 chars
  assert.strictEqual(derivedKey.length, 128); // 64 bytes in hex = 128 chars
});

test('Password verification - correct and incorrect passwords', () => {
  const password = 'CorrectPassword123#';
  const hash = hashPassword(password);

  assert.strictEqual(verifyPassword(password, hash), true);
  assert.strictEqual(verifyPassword('WrongPassword123#', hash), false);
  assert.strictEqual(verifyPassword('', hash), false);
  assert.strictEqual(verifyPassword('correctpassword123#', hash), false); // case sensitive
});

test('Password verification - malformed verifier and tampered parameters', () => {
  const password = 'ValidPassword888';
  const validHash = hashPassword(password);

  // Completely invalid strings
  assert.strictEqual(verifyPassword(password, ''), false);
  assert.strictEqual(verifyPassword(password, 'invalidHashFormat'), false);
  assert.strictEqual(verifyPassword(password, 'scrypt:salt:key'), false);
  assert.strictEqual(verifyPassword(password, 'scrypt$v=2$N=16384,r=8,p=1,keylen=64$salt$key'), false); // wrong version
  assert.strictEqual(verifyPassword(password, 'bcrypt$v=1$N=16384,r=8,p=1,keylen=64$salt$key'), false); // wrong algo

  // Tampered salt
  const parts = validHash.split('$');
  const tamperedSalt = parts[3].slice(0, -2) + 'aa';
  const tamperedHash = [parts[0], parts[1], parts[2], tamperedSalt, parts[4]].join('$');
  assert.strictEqual(verifyPassword(password, tamperedHash), false);

  // Tampered key
  const tamperedKey = parts[4].slice(0, -2) + '00';
  const tamperedKeyHash = [parts[0], parts[1], parts[2], parts[3], tamperedKey].join('$');
  assert.strictEqual(verifyPassword(password, tamperedKeyHash), false);
});

test('Session secrets - entropy, verification, and fail-closed behavior', () => {
  const { secret, verifier } = generateSessionSecret();

  // High entropy base64url string (32 bytes = 43 chars)
  assert.ok(secret.length >= 43);
  // SHA-256 verifier hex string (64 chars)
  assert.strictEqual(verifier.length, 64);
  // Verifier must not equal raw secret
  assert.notStrictEqual(secret, verifier);

  // Verification success
  assert.strictEqual(verifySessionSecret(secret, verifier), true);

  // Wrong secret
  assert.strictEqual(verifySessionSecret('wrongSecretBase64String123456789012345678', verifier), false);

  // Wrong verifier
  assert.strictEqual(verifySessionSecret(secret, '0'.repeat(64)), false);

  // Malformed inputs
  assert.strictEqual(verifySessionSecret('', verifier), false);
  assert.strictEqual(verifySessionSecret(secret, ''), false);
  assert.strictEqual(verifySessionSecret(null as any, verifier), false);
  assert.strictEqual(verifySessionSecret(secret, undefined as any), false);
});
