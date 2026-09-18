import type { Client } from 'pg';
import { verifyPassword, hashPassword, generateSessionSecret, verifySessionSecret } from './crypto.ts';

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

export interface SessionCreationResult {
  sessionId: string;
  secret: string;
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
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }

      const creds = res.rows[0];

      if (!creds.is_valid) {
        await this.#pg.query('COMMIT');
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

    return { sessionId, secret };
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
