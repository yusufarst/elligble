import type { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import {
  verifyPassword, hashPassword, generateSessionSecret, verifySessionSecret,
  generateActivationCode, normalizeActivationCode, formatActivationCode,
} from './crypto.ts';
import { checkNewPassword, type PasswordRejection } from './password-policy.ts';

export { checkNewPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, type PasswordRejection } from './password-policy.ts';

// Verifier for a random, unknowable password. Unknown usernames are checked against it so that
// "no such account" costs the same key-derivation work as "wrong password" (no timing enumeration).
const UNKNOWN_ACCOUNT_VERIFIER = hashPassword(randomBytes(32).toString('hex'));

export interface Clock {
  now(): Date;
}

export const DefaultClock: Clock = {
  now: () => new Date()
};

export const POLICY = {
  MAX_FAILED_ATTEMPTS: 5,
  FAILED_ATTEMPTS_WINDOW_MS: 5 * 60 * 1000, // 5 minutes rolling window
  MAX_CONSECUTIVE_FAILURES: 10,
  TEMP_LOCK_DURATION_MS: 15 * 60 * 1000, // 15 minutes temporary lockout
  ABSOLUTE_EXPIRY_MS: 12 * 60 * 60 * 1000, // 12 hours
  IDLE_EXPIRY_MS: 60 * 60 * 1000 // 60 minutes
} as const;

export const ACTIVATION_POLICY = {
  MAX_FAILED_ATTEMPTS: 10, // then the code is revoked and a new one must be issued
  MIN_VALIDITY_MS: 60 * 60 * 1000,
  DEFAULT_VALIDITY_MS: 7 * 24 * 60 * 60 * 1000,
  MAX_VALIDITY_MS: 30 * 24 * 60 * 60 * 1000,
} as const;

export interface ActivationIssue {
  /** Shown once to the operator for the activation sheet; never stored in plain form. */
  code: string;
  expiresAt: Date;
}

export type ActivationResult =
  | { success: true; userAccountId: string; personId: string; session: SessionCreationResult }
  | { success: false; error: 'INVALID_ACTIVATION' }
  | { success: false; error: 'PASSWORD_REJECTED'; reason: PasswordRejection };

export interface SessionCreationResult {
  sessionId: string;
  secret: string;
  expiresAt: Date;
}

export interface AuthenticationSuccess {
  success: true;
  userAccountId: string;
  personId: string;
  session: SessionCreationResult;
}

export interface AuthenticationFailure {
  success: false;
  error: 'INVALID_CREDENTIALS' | 'LOCKED' | 'REVOKED' | 'RATE_LIMITED';
}

export type AuthenticationResult = AuthenticationSuccess | AuthenticationFailure;

export interface SessionData {
  sessionId: string;
  userAccountId: string;
  personId: string;
  authenticatedAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

export class IdentityRuntime {
  #pg: Client;
  #clock: Clock;

  constructor(pg: Client, clock: Clock = DefaultClock) {
    this.#pg = pg;
    this.#clock = clock;
  }



  /**
   * Concurrency-safe authentication verifying ELLIGBLE ID / username and password.
   * Enforces rolling 5-minute rate-limit, 15-minute temporary lockout on 10 consecutive failures,
   * and automatically establishes a server-authoritative session upon successful verification.
   */
  async authenticate(username: string, passwordAttempt: string): Promise<AuthenticationResult> {
    if (!username || typeof username !== 'string' || !passwordAttempt || typeof passwordAttempt !== 'string') {
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const now = this.#clock.now();
    const nowMs = now.getTime();

    await this.#pg.query('BEGIN');
    try {
      const res = await this.#pg.query(`
        SELECT
          c.user_account_id, c.password_verifier, c.is_valid,
          c.consecutive_failures_count, c.failed_attempts_timeline, c.locked_until,
          a.person_id
        FROM identity_account_credentials c
        JOIN identity_user_accounts a ON a.id = c.user_account_id
        WHERE c.username = $1
        FOR UPDATE OF c
      `, [username]);

      if (res.rowCount === 0) {
        await this.#pg.query('COMMIT');
        verifyPassword(passwordAttempt, UNKNOWN_ACCOUNT_VERIFIER);
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }

      const creds = res.rows[0];

      if (!creds.is_valid) {
        await this.#pg.query('COMMIT');
        verifyPassword(passwordAttempt, creds.password_verifier);
        return { success: false, error: 'REVOKED' };
      }

      // 1. Temporary Lockout Check
      if (creds.locked_until) {
        const lockedUntilMs = new Date(creds.locked_until).getTime();
        if (lockedUntilMs > nowMs) {
          await this.#pg.query('COMMIT');
          return { success: false, error: 'LOCKED' };
        }
      }

      // Parse rolling failed_attempts_timeline
      let rawTimeline: any[] = [];
      if (Array.isArray(creds.failed_attempts_timeline)) {
        rawTimeline = creds.failed_attempts_timeline;
      } else if (typeof creds.failed_attempts_timeline === 'string') {
        try { rawTimeline = JSON.parse(creds.failed_attempts_timeline); } catch {}
      }

      // Rolling 5-minute window filter: only keep failures where (nowMs - failureMs) < FAILED_ATTEMPTS_WINDOW_MS
      const windowStartMs = nowMs - POLICY.FAILED_ATTEMPTS_WINDOW_MS;
      const failuresInWindow = rawTimeline
        .map((t: any) => new Date(t).getTime())
        .filter((t: number) => !isNaN(t) && t >= windowStartMs && t <= nowMs);

      // 2. Rolling 5-Minute Rate Limit Check (5 failures in rolling window)
      if (failuresInWindow.length >= POLICY.MAX_FAILED_ATTEMPTS) {
        await this.#pg.query('COMMIT');
        return { success: false, error: 'RATE_LIMITED' };
      }

      // 3. Password Verification
      const isCorrect = verifyPassword(passwordAttempt, creds.password_verifier);

      if (isCorrect) {
        // Successful authentication resets consecutive failures, failure timeline, and lock status
        await this.#pg.query(`
          UPDATE identity_account_credentials
          SET failed_attempts_timeline = '[]'::jsonb,
              consecutive_failures_count = 0,
              locked_until = NULL,
              last_successful_login_at = $1,
              updated_at = $1
          WHERE user_account_id = $2
        `, [now, creds.user_account_id]);

        // Establish session directly tied to successful authentication
        const sessionResult = await this.#createSessionInternal(creds.user_account_id, now);
        await this.#pg.query('COMMIT');

        return {
          success: true,
          userAccountId: creds.user_account_id,
          personId: creds.person_id,
          session: sessionResult
        };
      } else {
        // Wrong password: record failure timestamp in rolling window
        const newFailures = [...failuresInWindow, nowMs];
        const newTimelineJson = JSON.stringify(newFailures.map(t => new Date(t).toISOString()));

        // Consecutive failure count calculation
        // If locked_until was previously active and has now expired, start new consecutive sequence at 1
        let newConsecutive: number;
        if (creds.locked_until && new Date(creds.locked_until).getTime() <= nowMs) {
          newConsecutive = 1;
        } else {
          newConsecutive = (creds.consecutive_failures_count || 0) + 1;
        }

        let newLockedUntil: Date | null = null;
        if (newConsecutive >= POLICY.MAX_CONSECUTIVE_FAILURES) {
          newLockedUntil = new Date(nowMs + POLICY.TEMP_LOCK_DURATION_MS);
        }

        await this.#pg.query(`
          UPDATE identity_account_credentials
          SET failed_attempts_timeline = $1::jsonb,
              consecutive_failures_count = $2,
              locked_until = $3,
              updated_at = $4
          WHERE user_account_id = $5
        `, [newTimelineJson, newConsecutive, newLockedUntil, now, creds.user_account_id]);

        await this.#pg.query('COMMIT');
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }
    } catch (err) {
      await this.#pg.query('ROLLBACK');
      throw err;
    }
  }

  /**
   * Issues a single-use activation code for an account (D02.3-09, D02.5-04/05, D02.7-37..41).
   * Any open code is revoked, and unless `rotatePassword` is false the current password stops
   * working and every session of the account is revoked (administrative reset, D02.3-17).
   * Returns null for an unknown account.
   */
  async issueActivation(
    userAccountId: string,
    options: { validForMs?: number; rotatePassword?: boolean } = {}
  ): Promise<ActivationIssue | null> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof userAccountId !== 'string' || !UUID_REGEX.test(userAccountId)) return null;
    const validForMs = options.validForMs ?? ACTIVATION_POLICY.DEFAULT_VALIDITY_MS;
    if (!Number.isFinite(validForMs) || validForMs < ACTIVATION_POLICY.MIN_VALIDITY_MS || validForMs > ACTIVATION_POLICY.MAX_VALIDITY_MS) {
      throw new RangeError('Activation validity must be between 1 hour and 30 days.');
    }
    const now = this.#clock.now();
    const expiresAt = new Date(now.getTime() + validForMs);
    const code = generateActivationCode();
    const codeVerifier = hashPassword(code);
    const unusableVerifier = options.rotatePassword === false ? null : hashPassword(randomBytes(32).toString('hex'));

    await this.#pg.query('BEGIN');
    try {
      const account = await this.#pg.query(
        'SELECT user_account_id FROM identity_account_credentials WHERE user_account_id = $1 FOR UPDATE',
        [userAccountId]
      );
      if (account.rowCount === 0) {
        await this.#pg.query('ROLLBACK');
        return null;
      }
      await this.#pg.query(
        `UPDATE identity_account_activations SET revoked_at = $2
         WHERE user_account_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [userAccountId, now]
      );
      if (unusableVerifier) {
        await this.#pg.query(
          `UPDATE identity_account_credentials
           SET password_verifier = $2, failed_attempts_timeline = '[]'::jsonb, consecutive_failures_count = 0,
               locked_until = NULL, updated_at = $3
           WHERE user_account_id = $1`,
          [userAccountId, unusableVerifier, now]
        );
        await this.#pg.query(
          'UPDATE identity_sessions SET is_revoked = TRUE WHERE user_account_id = $1 AND is_revoked = FALSE',
          [userAccountId]
        );
      }
      await this.#pg.query(
        `INSERT INTO identity_account_activations (user_account_id, code_verifier, issued_at, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userAccountId, codeVerifier, now, expiresAt]
      );
      await this.#pg.query('COMMIT');
      return { code: formatActivationCode(code), expiresAt };
    } catch (err) {
      await this.#pg.query('ROLLBACK');
      throw err;
    }
  }

  /**
   * Activates an account: the person proves the activation code and sets their own password,
   * which also signs them in. Every failure answers INVALID_ACTIVATION with the same cost,
   * except a refused new password, which is checked before any account lookup. A code dies
   * after use, on expiry, on reissue and after ACTIVATION_POLICY.MAX_FAILED_ATTEMPTS wrong
   * tries. The login lockout does not block activation (DEC-041: recovery stays available).
   */
  async activate(username: string, codeAttempt: string, newPassword: string): Promise<ActivationResult> {
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    const code = normalizeActivationCode(codeAttempt);
    const rejection = checkNewPassword(newPassword, { username: trimmedUsername });
    if (rejection) return { success: false, error: 'PASSWORD_REJECTED', reason: rejection };
    if (!trimmedUsername || !code) {
      verifyPassword('invalid-activation', UNKNOWN_ACCOUNT_VERIFIER);
      return { success: false, error: 'INVALID_ACTIVATION' };
    }

    const now = this.#clock.now();
    await this.#pg.query('BEGIN');
    try {
      const account = await this.#pg.query(`
        SELECT c.user_account_id, c.is_valid, a.person_id
        FROM identity_account_credentials c
        JOIN identity_user_accounts a ON a.id = c.user_account_id
        WHERE c.username = $1
        FOR UPDATE OF c
      `, [trimmedUsername]);
      const creds = account.rows[0];
      const activation = creds && creds.is_valid
        ? (await this.#pg.query(`
            SELECT id, code_verifier, expires_at, failed_attempts
            FROM identity_account_activations
            WHERE user_account_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL
            FOR UPDATE
          `, [creds.user_account_id])).rows[0]
        : undefined;

      if (!activation || new Date(activation.expires_at).getTime() <= now.getTime()) {
        await this.#pg.query('COMMIT');
        verifyPassword(code, UNKNOWN_ACCOUNT_VERIFIER);
        return { success: false, error: 'INVALID_ACTIVATION' };
      }

      if (!verifyPassword(code, activation.code_verifier)) {
        const failures = activation.failed_attempts + 1;
        await this.#pg.query(
          `UPDATE identity_account_activations
           SET failed_attempts = $2::int, revoked_at = CASE WHEN $2::int >= $3::int THEN $4::timestamptz ELSE NULL END
           WHERE id = $1`,
          [activation.id, failures, ACTIVATION_POLICY.MAX_FAILED_ATTEMPTS, now]
        );
        await this.#pg.query('COMMIT');
        return { success: false, error: 'INVALID_ACTIVATION' };
      }

      await this.#pg.query(
        `UPDATE identity_account_credentials
         SET password_verifier = $2, failed_attempts_timeline = '[]'::jsonb, consecutive_failures_count = 0,
             locked_until = NULL, last_successful_login_at = $3, updated_at = $3
         WHERE user_account_id = $1`,
        [creds.user_account_id, hashPassword(newPassword), now]
      );
      await this.#pg.query('UPDATE identity_account_activations SET consumed_at = $2 WHERE id = $1', [activation.id, now]);
      const session = await this.#createSessionInternal(creds.user_account_id, now);
      await this.#pg.query('COMMIT');
      return { success: true, userAccountId: creds.user_account_id, personId: creds.person_id, session };
    } catch (err) {
      await this.#pg.query('ROLLBACK');
      throw err;
    }
  }

  /**
   * Internal session creation routine. Only callable with verified authentication event.
   */
  async #createSessionInternal(userAccountId: string, authenticatedAt: Date): Promise<SessionCreationResult> {
    const expiresAt = new Date(authenticatedAt.getTime() + POLICY.ABSOLUTE_EXPIRY_MS);
    const { secret, verifier } = generateSessionSecret();

    const resId = await this.#pg.query(`SELECT gen_random_uuid() as id`);
    const sessionId = resId.rows[0].id;

    await this.#pg.query(`
      INSERT INTO identity_sessions (
        id, user_account_id, session_secret_verifier,
        authenticated_at, expires_at, last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [sessionId, userAccountId, verifier, authenticatedAt, expiresAt, authenticatedAt]);

    return { sessionId, secret, expiresAt };
  }


  /**
   * Resolves an authenticated Session Identity.
   * Enforces exact-boundary absolute expiry (12 hours) and idle expiry (60 minutes).
   * Bounded activity update can never extend absolute expiry.
   * Fails closed on wrong secret, malformed ID, unknown session, or revoked session.
   */
  async resolveSession(sessionId: string, secretAttempt: string): Promise<SessionData | null> {
    if (!sessionId || typeof sessionId !== 'string' || !secretAttempt || typeof secretAttempt !== 'string') {
      return null;
    }
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(sessionId)) {
      return null;
    }

    const now = this.#clock.now();
    const nowMs = now.getTime();

    const res = await this.#pg.query(`
      SELECT
        s.id, s.user_account_id, s.session_secret_verifier, s.is_revoked,
        s.authenticated_at, s.expires_at, s.last_activity_at,
        a.person_id
      FROM identity_sessions s
      JOIN identity_user_accounts a ON a.id = s.user_account_id
      WHERE s.id = $1
    `, [sessionId]);

    if (res.rowCount === 0) return null; // Unknown session

    const session = res.rows[0];

    if (session.is_revoked) return null; // Revoked session

    const expiresAtMs = new Date(session.expires_at).getTime();
    const lastActivityMs = new Date(session.last_activity_at).getTime();

    // 12-hour absolute expiry (exact boundary denial >=)
    if (nowMs >= expiresAtMs) return null;

    // 60-minute idle expiry (exact boundary denial >=)
    if (nowMs - lastActivityMs >= POLICY.IDLE_EXPIRY_MS) return null;

    // Verify secret against stored verifier
    if (!verifySessionSecret(secretAttempt, session.session_secret_verifier)) {
      return null; // Wrong secret / malformed
    }

    // Bounded last-activity update: can never extend beyond expires_at
    const newActivityMs = Math.min(nowMs, expiresAtMs);
    const newActivityAt = new Date(newActivityMs);

    await this.#pg.query(`
      UPDATE identity_sessions SET last_activity_at = $1 WHERE id = $2
    `, [newActivityAt, sessionId]);

    return {
      sessionId: session.id,
      userAccountId: session.user_account_id,
      personId: session.person_id,
      authenticatedAt: new Date(session.authenticated_at),
      expiresAt: new Date(session.expires_at),
      lastActivityAt: newActivityAt
    };
  }

  /**
   * Returns the login identifier (ELLIGBLE ID / username) of an account, for display to
   * its own authenticated owner. Callers must pass an account id from a resolved session.
   */
  async getLoginIdentifier(userAccountId: string): Promise<string | null> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userAccountId || typeof userAccountId !== 'string' || !UUID_REGEX.test(userAccountId)) {
      return null;
    }
    const res = await this.#pg.query(
      'SELECT username FROM identity_account_credentials WHERE user_account_id = $1',
      [userAccountId]
    );
    return res.rowCount === 1 ? res.rows[0].username : null;
  }

  /**
   * Revokes an active Session Identity. Subsequent resolutions fail closed.
   */
  async revokeSession(sessionId: string): Promise<void> {
    if (!sessionId || typeof sessionId !== 'string') return;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(sessionId)) return;
    await this.#pg.query(`
      UPDATE identity_sessions SET is_revoked = TRUE WHERE id = $1
    `, [sessionId]);
  }
}
