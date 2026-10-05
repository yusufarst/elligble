// Per-tab binding of an attempt to this device's exam session (D04.4-32/35/37).
//
// The exam session id is the device's write capability for answers. It is created here,
// kept in sessionStorage (survives a reload, not shared with other tabs or windows) and is
// never learned from the server. "Duplicate tab" copies sessionStorage, so the id is also
// guarded with a Web Lock: a second tab of this browser that finds the id already held must
// not write with it and has to take the exam session over explicitly instead.

const STORAGE_PREFIX = 'elligble.examSession.';
const LOCK_PREFIX = 'elligble-exam-session:';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const memoryFallback = new Map<string, string>();
const tabClaims = new Map<string, Promise<boolean>>();

export function newExamSessionId(): string {
  return crypto.randomUUID();
}

export function readExamSessionId(attemptId: string): string | null {
  let value: string | null = null;
  try {
    value = window.sessionStorage.getItem(STORAGE_PREFIX + attemptId);
  } catch {
    value = memoryFallback.get(attemptId) ?? null;
  }
  return value && UUID_REGEX.test(value) ? value : null;
}

export function storeExamSessionId(attemptId: string, sessionId: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + attemptId, sessionId);
  } catch {
    memoryFallback.set(attemptId, sessionId);
  }
}

export function forgetExamSessionId(attemptId: string): void {
  try {
    window.sessionStorage.removeItem(STORAGE_PREFIX + attemptId);
  } catch {
    // Storage unavailable: only the in-memory fallback holds it.
  }
  memoryFallback.delete(attemptId);
}

function tryLock(locks: LockManager, name: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    locks
      .request(name, { ifAvailable: true }, lock => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        // Held for the lifetime of this page; the browser releases it on unload.
        return new Promise<void>(() => {});
      })
      .catch(() => resolve(true));
  });
}

/**
 * Claims the exam session id for this tab. Resolves false only when another tab of this
 * browser already holds it. Without Web Locks support the claim cannot be checked and is
 * granted (the server still enforces one active session per attempt).
 */
export function claimExamSessionForTab(sessionId: string, retryDelayMs = 400): Promise<boolean> {
  const existing = tabClaims.get(sessionId);
  if (existing) return existing;
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== 'function') return Promise.resolve(true);
  const name = LOCK_PREFIX + sessionId;
  const claim = (async () => {
    if (await tryLock(locks, name)) return true;
    // A reload can briefly overlap the previous document that still holds the lock.
    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    return tryLock(locks, name);
  })();
  tabClaims.set(sessionId, claim);
  claim.then(granted => {
    if (!granted) tabClaims.delete(sessionId);
  });
  return claim;
}
