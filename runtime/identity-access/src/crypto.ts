import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
  maxmem: number;
  keylen: number;
}

export const DEFAULT_SCRYPT_PARAMS: ScryptParams = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
  keylen: 64
};

/**
 * Generates a self-describing salted scrypt password verifier with explicit KDF parameters.
 * Format: scrypt$v=1$N=<N>,r=<r>,p=<p>,keylen=<keylen>$<saltHex>$<derivedKeyHex>
 */
export function hashPassword(password: string, params: ScryptParams = DEFAULT_SCRYPT_PARAMS): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, params.keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: params.maxmem
  }).toString('hex');
  return `scrypt$v=1$N=${params.N},r=${params.r},p=${params.p},keylen=${params.keylen}$${salt}$${derivedKey}`;
}

/**
 * Deterministically verifies a password against a self-describing scrypt verifier.
 */
export function verifyPassword(password: string, hash: string): boolean {
  if (!hash || typeof hash !== 'string' || !password || typeof password !== 'string') {
    return false;
  }
  const parts = hash.split('$');
  if (parts.length !== 5) return false;
  const [algo, version, paramStr, salt, storedKeyHex] = parts;
  if (algo !== 'scrypt' || version !== 'v=1') return false;

  const paramMap = new Map<string, number>();
  for (const item of paramStr.split(',')) {
    const [k, v] = item.split('=');
    if (!k || !v) return false;
    const num = parseInt(v, 10);
    if (isNaN(num)) return false;
    paramMap.set(k, num);
  }

  const N = paramMap.get('N');
  const r = paramMap.get('r');
  const p = paramMap.get('p');
  const keylen = paramMap.get('keylen') || 64;

  if (!N || !r || !p || !salt || !storedKeyHex) return false;

  try {
    const derivedKey = scryptSync(password, salt, keylen, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024
    });
    const storedBuffer = Buffer.from(storedKeyHex, 'hex');
    if (derivedKey.length !== storedBuffer.length) return false;
    return timingSafeEqual(derivedKey, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a high-entropy 32-byte session secret and its SHA-256 verifier.
 * Only the verifier is persisted; the raw secret is returned to the authenticated client.
 */
export function generateSessionSecret(): { secret: string; verifier: string } {
  const secret = randomBytes(32).toString('base64url');
  const verifier = createHash('sha256').update(secret).digest('hex');
  return { secret, verifier };
}

/**
 * Constant-time verification of a session secret against a SHA-256 verifier.
 */
export function verifySessionSecret(secret: string, verifier: string): boolean {
  if (!secret || typeof secret !== 'string' || !verifier || typeof verifier !== 'string') {
    return false;
  }
  try {
    const attemptVerifier = createHash('sha256').update(secret).digest('hex');
    const attemptBuffer = Buffer.from(attemptVerifier, 'hex');
    const verifierBuffer = Buffer.from(verifier, 'hex');
    if (attemptBuffer.length !== verifierBuffer.length) return false;
    return timingSafeEqual(attemptBuffer, verifierBuffer);
  } catch {
    return false;
  }
}
