import test from 'node:test';
import assert from 'node:assert';
import { IdentityRuntime, POLICY, type Clock } from '../src/index.ts';
import { hashPassword, generateSessionSecret } from '../src/crypto.ts';

class ControllableClock implements Clock {
  private current: Date;

  constructor(initialIso = '2026-09-18T08:00:00.000Z') {
    this.current = new Date(initialIso);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(iso: string) {
    this.current = new Date(iso);
  }
}

interface CredentialRow {
  user_account_id: string;
  username: string;
  password_verifier: string;
  is_valid: boolean;
  consecutive_failures_count: number;
  failed_attempts_timeline: string[];
  locked_until: Date | null;
  last_successful_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface SessionRow {
  id: string;
  user_account_id: string;
  session_secret_verifier: string;
  is_revoked: boolean;
  authenticated_at: Date;
  expires_at: Date;
  last_activity_at: Date;
}

interface AccountRow {
  id: string;
  person_id: string;
}

class InMemoryPgClient {
  public accounts = new Map<string, AccountRow>();
  public credentials = new Map<string, CredentialRow>();
  public sessions = new Map<string, SessionRow>();
  public queries: { text: string; params?: any[] }[] = [];
  public inTransaction = false;

  async query(text: string, params: any[] = []): Promise<{ rowCount: number; rows: any[] }> {
    this.queries.push({ text, params });
    const trimmed = text.trim();

    if (trimmed === 'BEGIN') {
      this.inTransaction = true;
      return { rowCount: 0, rows: [] };
    }
    if (trimmed === 'COMMIT') {
      this.inTransaction = false;
      return { rowCount: 0, rows: [] };
    }
    if (trimmed === 'ROLLBACK') {
      this.inTransaction = false;
      return { rowCount: 0, rows: [] };
    }
    if (trimmed.includes('SELECT gen_random_uuid()')) {
      const crypto = await import('node:crypto');
      return { rowCount: 1, rows: [{ id: crypto.randomUUID() }] };
    }

    // SELECT credentials for authenticate
    if (trimmed.includes('FROM identity_account_credentials c')) {
      const username = params[0];
      for (const cred of this.credentials.values()) {
        if (cred.username === username) {
          const account = this.accounts.get(cred.user_account_id);
          return {
            rowCount: 1,
            rows: [{
              user_account_id: cred.user_account_id,
              password_verifier: cred.password_verifier,
              is_valid: cred.is_valid,
              consecutive_failures_count: cred.consecutive_failures_count,
              failed_attempts_timeline: cred.failed_attempts_timeline,
              locked_until: cred.locked_until,
              person_id: account?.person_id || 'default-person'
            }]
          };
        }
      }
      return { rowCount: 0, rows: [] };
    }

    // UPDATE credentials on success
    if (trimmed.includes('UPDATE identity_account_credentials') && trimmed.includes("failed_attempts_timeline = '[]'")) {
      const [now, userAccountId] = params;
      const cred = this.credentials.get(userAccountId);
      if (cred) {
        cred.failed_attempts_timeline = [];
        cred.consecutive_failures_count = 0;
        cred.locked_until = null;
        cred.last_successful_login_at = now;
        cred.updated_at = now;
      }
      return { rowCount: 1, rows: [] };
    }

    // UPDATE credentials on failure
    if (trimmed.includes('UPDATE identity_account_credentials') && trimmed.includes('failed_attempts_timeline = $1')) {
      const [timelineJson, consecutive, lockedUntil, now, userAccountId] = params;
      const cred = this.credentials.get(userAccountId);
      if (cred) {
        cred.failed_attempts_timeline = JSON.parse(timelineJson);
        cred.consecutive_failures_count = consecutive;
        cred.locked_until = lockedUntil;
        cred.updated_at = now;
      }
      return { rowCount: 1, rows: [] };
    }

    // INSERT session
    if (trimmed.includes('INSERT INTO identity_sessions')) {
      const [id, userAccountId, verifier, authAt, expAt, lastActAt] = params;
      this.sessions.set(id, {
        id,
        user_account_id: userAccountId,
        session_secret_verifier: verifier,
        is_revoked: false,
        authenticated_at: authAt,
        expires_at: expAt,
        last_activity_at: lastActAt
      });
      return { rowCount: 1, rows: [] };
    }

    // SELECT session for resolveSession
    if (trimmed.includes('FROM identity_sessions s')) {
      const sessionId = params[0];
      const session = this.sessions.get(sessionId);
      if (!session) {
        return { rowCount: 0, rows: [] };
      }
      const account = this.accounts.get(session.user_account_id);
      return {
        rowCount: 1,
        rows: [{
          id: session.id,
          user_account_id: session.user_account_id,
          session_secret_verifier: session.session_secret_verifier,
          is_revoked: session.is_revoked,
          authenticated_at: session.authenticated_at,
          expires_at: session.expires_at,
          last_activity_at: session.last_activity_at,
          person_id: account?.person_id || 'default-person'
        }]
      };
    }

    // UPDATE session last_activity_at
    if (trimmed.includes('UPDATE identity_sessions SET last_activity_at = $1')) {
      const [newActivityAt, sessionId] = params;
      const session = this.sessions.get(sessionId);
      if (session) {
        session.last_activity_at = newActivityAt;
      }
      return { rowCount: 1, rows: [] };
    }

    // UPDATE session is_revoked
    if (trimmed.includes('UPDATE identity_sessions SET is_revoked = TRUE')) {
      const [sessionId] = params;
      const session = this.sessions.get(sessionId);
      if (session) {
        session.is_revoked = true;
      }
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }
}

function setupHarness() {
  const pg = new InMemoryPgClient();
  const clock = new ControllableClock('2026-09-18T08:00:00.000Z');
  const runtime = new IdentityRuntime(pg as any, clock);

  const personId = 'person-test-1';
  const userAccountId = 'account-test-1';
  pg.accounts.set(userAccountId, { id: userAccountId, person_id: personId });

  const password = 'CorrectPassword2026!';
  const passwordVerifier = hashPassword(password);
  pg.credentials.set(userAccountId, {
    user_account_id: userAccountId,
    username: 'student.user',
    password_verifier: passwordVerifier,
    is_valid: true,
    consecutive_failures_count: 0,
    failed_attempts_timeline: [],
    locked_until: null,
    last_successful_login_at: null,
    created_at: clock.now(),
    updated_at: clock.now()
  });

  return { pg, clock, runtime, userAccountId, personId, password };
}

test('IdentityRuntime - authenticate success creates session directly tied to authentication event', async () => {
  const { runtime, userAccountId, personId, password } = setupHarness();

  const result = await runtime.authenticate('student.user', password);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.userAccountId, userAccountId);
    assert.strictEqual(result.personId, personId);
    assert.ok(result.session.sessionId);
    assert.ok(result.session.secret);
  }
});

test('IdentityRuntime - authenticate wrong password returns INVALID_CREDENTIALS', async () => {
  const { runtime } = setupHarness();

  const result = await runtime.authenticate('student.user', 'WrongPassword!');
  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.error, 'INVALID_CREDENTIALS');
  }
});

test('IdentityRuntime - authenticate unknown username returns INVALID_CREDENTIALS', async () => {
  const { runtime } = setupHarness();

  const result = await runtime.authenticate('nonexistent.user', 'AnyPassword123');
  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.error, 'INVALID_CREDENTIALS');
  }
});

test('IdentityRuntime - authenticate revoked credential returns REVOKED', async () => {
  const { runtime, pg, userAccountId } = setupHarness();
  pg.credentials.get(userAccountId)!.is_valid = false;

  const result = await runtime.authenticate('student.user', 'AnyPassword');
  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.error, 'REVOKED');
  }
});

test('IdentityRuntime - 5 failures in rolling 5 minutes triggers RATE_LIMITED', async () => {
  const { runtime, clock } = setupHarness();

  // Fail 5 times within 4 minutes
  for (let i = 0; i < 5; i++) {
    const res = await runtime.authenticate('student.user', 'WrongPwd');
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.error, 'INVALID_CREDENTIALS');
    }
    clock.advance(30 * 1000); // 30 seconds
  }

  // 6th attempt at T = 2.5 minutes is RATE_LIMITED
  const rateLimitedRes = await runtime.authenticate('student.user', 'WrongPwd');
  assert.strictEqual(rateLimitedRes.success, false);
  if (!rateLimitedRes.success) {
    assert.strictEqual(rateLimitedRes.error, 'RATE_LIMITED');
  }
});

test('IdentityRuntime - true rolling-window boundary crossing: expired failures roll out', async () => {
  const { runtime, clock, password } = setupHarness();

  // Fail 4 times at T = 08:00
  for (let i = 0; i < 4; i++) {
    await runtime.authenticate('student.user', 'WrongPwd');
  }

  // Advance clock by 4 minutes to 08:04
  clock.advance(4 * 60 * 1000);

  // 5th failure at 08:04 (now there are 5 failures in rolling window: 4 at 08:00, 1 at 08:04)
  await runtime.authenticate('student.user', 'WrongPwd');

  // At 08:04:30, check attempt: must be RATE_LIMITED (5 failures in rolling window)
  clock.advance(30 * 1000);
  const checkRateLimited = await runtime.authenticate('student.user', password);
  assert.strictEqual(checkRateLimited.success, false);
  if (!checkRateLimited.success) {
    assert.strictEqual(checkRateLimited.error, 'RATE_LIMITED');
  }

  // Advance clock past 08:05:01 (to 08:05:05)
  // The first 4 failures occurred at 08:00:00; now 08:05:05 - 08:00:00 = 5m05s > 5m!
  // In a TRUE rolling window, those 4 failures have rolled out! Only the 1 failure from 08:04 remains.
  // Prior fixed-window algorithm that stored single first_failed_attempt_at would have failed here.
  clock.set('2026-09-18T08:05:05.000Z');

  // Successful login should now be permitted!
  const loginRes = await runtime.authenticate('student.user', password);
  assert.strictEqual(loginRes.success, true);
});

test('IdentityRuntime - 10 consecutive failures triggers 15-minute temporary lockout', async () => {
  const { runtime, clock } = setupHarness();

  // Fail 10 times spacing them out so we don't hit the 5-in-5m rate limit:
  // or we can test lockout by triggering 10 failures.
  // Notice: 5 failures within 5m hits RATE_LIMITED. To reach 10 consecutive failures without rate-limit blocking,
  // we can fail 4 times, advance 5m1s, fail 4 times, advance 5m1s, fail 2 times = 10 consecutive failures!
  for (let i = 0; i < 4; i++) {
    await runtime.authenticate('student.user', 'WrongPwd');
  }
  clock.advance(5 * 60 * 1000 + 1000); // 5m1s

  for (let i = 0; i < 4; i++) {
    await runtime.authenticate('student.user', 'WrongPwd');
  }
  clock.advance(5 * 60 * 1000 + 1000); // 5m1s

  // 9th failure
  await runtime.authenticate('student.user', 'WrongPwd');
  clock.advance(1000);
  // 10th failure -> triggers 15m lock!
  const tenth = await runtime.authenticate('student.user', 'WrongPwd');
  assert.strictEqual(tenth.success, false);

  // Subsequent attempt is LOCKED
  const lockedRes = await runtime.authenticate('student.user', 'WrongPwd');
  assert.strictEqual(lockedRes.success, false);
  if (!lockedRes.success) {
    assert.strictEqual(lockedRes.error, 'LOCKED');
  }

  // Advance 14 minutes: still LOCKED
  clock.advance(14 * 60 * 1000);
  const stillLocked = await runtime.authenticate('student.user', 'WrongPwd');
  assert.strictEqual(stillLocked.success, false);
  if (!stillLocked.success) {
    assert.strictEqual(stillLocked.error, 'LOCKED');
  }

  // Advance 1 minute 1 second (total 15m1s since lock triggered): Lockout has expired!
  clock.advance(61 * 1000);
  const afterLockoutRes = await runtime.authenticate('student.user', 'WrongPwd');
  // Account is no longer LOCKED, returns INVALID_CREDENTIALS
  assert.strictEqual(afterLockoutRes.success, false);
  if (!afterLockoutRes.success) {
    assert.strictEqual(afterLockoutRes.error, 'INVALID_CREDENTIALS');
  }
});

test('IdentityRuntime - no permanent lockout and success resets failure state', async () => {
  const { runtime, clock, password, pg, userAccountId } = setupHarness();

  // Fail 4 times
  for (let i = 0; i < 4; i++) {
    await runtime.authenticate('student.user', 'WrongPwd');
  }
  assert.strictEqual(pg.credentials.get(userAccountId)!.consecutive_failures_count, 4);

  // Successful login resets consecutive failures and timeline
  const successRes = await runtime.authenticate('student.user', password);
  assert.strictEqual(successRes.success, true);
  assert.strictEqual(pg.credentials.get(userAccountId)!.consecutive_failures_count, 0);
  assert.strictEqual(pg.credentials.get(userAccountId)!.failed_attempts_timeline.length, 0);
});

test('IdentityRuntime - session establishment and infrastructure are strictly private', async () => {
  const { runtime } = setupHarness();

  // No public methods exist to forge or arbitrarily establish a session
  assert.strictEqual(typeof (runtime as any).createSession, 'undefined');
  assert.strictEqual(typeof (runtime as any).establishSession, 'undefined');
  assert.strictEqual(typeof (runtime as any)._createSessionInternal, 'undefined');
  assert.strictEqual(typeof (runtime as any).registerCredentials, 'undefined');

  // Infrastructure not exposed
  assert.strictEqual(typeof (runtime as any).pg, 'undefined');
  assert.strictEqual(typeof (runtime as any).clock, 'undefined');

  // Prototype contains no session-mint method
  const proto = Object.getPrototypeOf(runtime);
  const props = Object.getOwnPropertyNames(proto);
  assert.ok(!props.includes('createSession'));
  assert.ok(!props.includes('establishSession'));
  assert.ok(!props.includes('_createSessionInternal'));
});

test('IdentityRuntime - resolveSession for valid session', async () => {
  const { runtime, password, userAccountId, personId } = setupHarness();

  const auth = await runtime.authenticate('student.user', password);
  assert.strictEqual(auth.success, true);
  if (!auth.success) return;

  const session = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
  assert.ok(session);
  assert.strictEqual(session?.userAccountId, userAccountId);
  assert.strictEqual(session?.personId, personId);
  assert.strictEqual(session?.sessionId, auth.session.sessionId);

  // Consumer contract contains only account/person/session fields
  const keys = Object.keys(session!).sort();
  assert.deepStrictEqual(keys, [
    'authenticatedAt',
    'expiresAt',
    'lastActivityAt',
    'personId',
    'sessionId',
    'userAccountId'
  ]);
});

test('IdentityRuntime - resolveSession fails closed on wrong secret, unknown session, and malformed inputs', async () => {
  const { runtime, password, pg } = setupHarness();

  const auth = await runtime.authenticate('student.user', password);
  assert.strictEqual(auth.success, true);
  if (!auth.success) return;

  // Wrong secret
  const wrongSecretRes = await runtime.resolveSession(auth.session.sessionId, 'invalid-secret');
  assert.strictEqual(wrongSecretRes, null);

  // Unknown VALID session ID -> goes to bounded DB lookup
  pg.queries = [];
  const unknownRes = await runtime.resolveSession('00000000-0000-0000-0000-000000000000', auth.session.secret);
  assert.strictEqual(unknownRes, null);
  assert.strictEqual(pg.queries.length, 1);
  assert.ok(pg.queries[0].text.includes('SELECT'));

  // Malformed session ID (non-empty UUID) -> performs zero DB query
  pg.queries = [];
  assert.strictEqual(await runtime.resolveSession('malformed-not-uuid', auth.session.secret), null);
  assert.strictEqual(pg.queries.length, 0);

  pg.queries = [];
  assert.strictEqual(await runtime.resolveSession('', auth.session.secret), null);
  assert.strictEqual(await runtime.resolveSession(null as any, auth.session.secret), null);
  assert.strictEqual(await runtime.resolveSession(auth.session.sessionId, ''), null);
  assert.strictEqual(await runtime.resolveSession(auth.session.sessionId, null as any), null);
  assert.strictEqual(pg.queries.length, 0);
});

test('IdentityRuntime - malformed revokeSession ID performs zero DB query', async () => {
  const { runtime, pg } = setupHarness();
  pg.queries = [];
  await runtime.revokeSession('malformed-id');
  assert.strictEqual(pg.queries.length, 0);
  await runtime.revokeSession('');
  assert.strictEqual(pg.queries.length, 0);
});

test('IdentityRuntime - resolveSession fails closed on revoked session', async () => {
  const { runtime, password } = setupHarness();

  const auth = await runtime.authenticate('student.user', password);
  assert.strictEqual(auth.success, true);
  if (!auth.success) return;

  // Revoke session
  await runtime.revokeSession(auth.session.sessionId);

  // Subsequent resolve fails closed
  const resolved = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
  assert.strictEqual(resolved, null);
});

test('IdentityRuntime - 12-hour absolute expiry: before boundary PASS, exact boundary FAIL, after boundary FAIL', async () => {
  const { runtime, clock, password } = setupHarness();

  const auth = await runtime.authenticate('student.user', password);
  assert.strictEqual(auth.success, true);
  if (!auth.success) return;

  // Keep last_activity fresh so idle expiry (60m) is not triggered
  // 12 hours = 43,200,000 ms
  // Advance in 30-minute intervals up to 11h 30m
  for (let i = 0; i < 23; i++) {
    clock.advance(30 * 60 * 1000);
    const midResolve = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
    assert.ok(midResolve, `Mid-resolve at ${(i + 1) * 30}m must PASS`);
  }

  // Now at 11h 30m. Advance 29 minutes and 59 seconds (to 11h 59m 59s: 1000ms before 12h absolute expiry)
  clock.advance(29 * 60 * 1000 + 59 * 1000);
  const beforeBoundary = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
  assert.ok(beforeBoundary, 'Before absolute expiry boundary must PASS');

  // Advance exactly 1000ms to reach exact 12:00:00 boundary
  clock.advance(1000);
  const exactBoundary = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
  assert.strictEqual(exactBoundary, null, 'Exact absolute expiry boundary must FAIL closed');

  // After boundary
  clock.advance(1000);
  const afterBoundary = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
  assert.strictEqual(afterBoundary, null, 'After absolute expiry boundary must FAIL closed');
});

test('IdentityRuntime - 60-minute idle expiry: before boundary PASS, exact boundary FAIL, after boundary FAIL', async () => {
  const { runtime, clock, password } = setupHarness();

  const auth = await runtime.authenticate('student.user', password);
  assert.strictEqual(auth.success, true);
  if (!auth.success) return;

  // 60 minutes = 3,600,000 ms
  // Advance 59 minutes 59 seconds (1000ms before idle expiry)
  clock.advance(59 * 60 * 1000 + 59 * 1000);
  const beforeIdle = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
  assert.ok(beforeIdle, 'Before idle boundary must PASS');

  // Advance exactly 60 minutes from last activity: exact boundary
  clock.advance(60 * 60 * 1000);
  const exactIdle = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
  assert.strictEqual(exactIdle, null, 'Exact idle boundary must FAIL closed');

  // After idle boundary
  clock.advance(1000);
  const afterIdle = await runtime.resolveSession(auth.session.sessionId, auth.session.secret);
  assert.strictEqual(afterIdle, null, 'After idle boundary must FAIL closed');
});

test('IdentityRuntime - bounded last-activity update cannot exceed absolute expiry', async () => {
  const { runtime, clock, password, pg } = setupHarness();

  const auth = await runtime.authenticate('student.user', password);
  assert.strictEqual(auth.success, true);
  if (!auth.success) return;

  // Resolve multiple times
  clock.advance(10 * 60 * 1000); // 10m
  await runtime.resolveSession(auth.session.sessionId, auth.session.secret);

  const sessionRow = pg.sessions.get(auth.session.sessionId)!;
  assert.ok(sessionRow.last_activity_at.getTime() <= sessionRow.expires_at.getTime());
});
