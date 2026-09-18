import test from 'node:test';
import assert from 'node:assert';
import { hashPassword, verifyPassword, generateSessionSecret, verifySessionSecret } from '../src/crypto.ts';

test('Password hashing', () => {
  const password = 'mySecurePassword123';
  const hash = hashPassword(password);
  
  assert.ok(hash.startsWith('scrypt:'));
  assert.strictEqual(verifyPassword(password, hash), true);
  assert.strictEqual(verifyPassword('wrongPassword', hash), false);
  assert.strictEqual(verifyPassword(password, 'invalidHashFormat'), false);
  assert.strictEqual(verifyPassword(password, 'scrypt:salt:key'), false); // malformed
});

test('Session secrets', () => {
  const { secret, verifier } = generateSessionSecret();
  assert.ok(secret.length > 0);
  assert.ok(verifier.length > 0);

  assert.strictEqual(verifySessionSecret(secret, verifier), true);
  assert.strictEqual(verifySessionSecret('wrongSecret', verifier), false);
  assert.strictEqual(verifySessionSecret(secret, 'wrongVerifier'), false);
});
