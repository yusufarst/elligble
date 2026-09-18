import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!hash.startsWith('scrypt:')) return false;
  const parts = hash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, key] = parts;
  try {
    const derivedKey = scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    if (derivedKey.length !== keyBuffer.length) return false;
    return timingSafeEqual(derivedKey, keyBuffer);
  } catch (e) {
    return false;
  }
}

export function generateSessionSecret(): { secret: string, verifier: string } {
  const secret = randomBytes(32).toString('base64url');
  const verifier = createHash('sha256').update(secret).digest('hex');
  return { secret, verifier };
}

export function verifySessionSecret(secret: string, verifier: string): boolean {
  const attemptVerifier = createHash('sha256').update(secret).digest('hex');
  const attemptBuffer = Buffer.from(attemptVerifier, 'hex');
  const verifierBuffer = Buffer.from(verifier, 'hex');
  if (attemptBuffer.length !== verifierBuffer.length) return false;
  return timingSafeEqual(attemptBuffer, verifierBuffer);
}
