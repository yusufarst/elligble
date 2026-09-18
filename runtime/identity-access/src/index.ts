import type { Client } from 'pg';
import { verifyPassword, hashPassword, generateSessionSecret, verifySessionSecret } from './crypto.ts';

export interface AuthenticationResult {
  success: boolean;
  userAccountId?: string;
  personId?: string;
  error?: 'INVALID_CREDENTIALS' | 'LOCKED' | 'REVOKED' | 'RATE_LIMITED';
}

export interface SessionData {
  sessionId: string;
  userAccountId: string;
  personId: string;
  authenticatedAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

export interface SessionCreationResult {
  sessionId: string;
  secret: string;
}

export interface Clock {
  now(): Date;
}

export const DefaultClock: Clock = {
  now: () => new Date()
};

const POLICY = {
  MAX_FAILED_ATTEMPTS: 5,
  FAILED_ATTEMPTS_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  MAX_CONSECUTIVE_FAILURES: 10,
  TEMP_LOCK_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  ABSOLUTE_EXPIRY_MS: 12 * 60 * 60 * 1000, // 12 hours
  IDLE_EXPIRY_MS: 60 * 60 * 1000 // 60 minutes
};

export class IdentityRuntime {
  pg: Client;
  clock: Clock;

  constructor(pg: Client, clock: Clock = DefaultClock) {
    this.pg = pg;
    this.clock = clock;
  }

  async authenticate(username: string, passwordAttempt: string): Promise<AuthenticationResult> {
    const now = this.clock.now();
    
    const res = await this.pg.query(`
      SELECT 
        c.user_account_id, c.password_verifier, c.is_valid, 
        c.failed_attempts_count, c.first_failed_attempt_at, 
        c.consecutive_failures_count, c.locked_until,
        a.person_id
      FROM identity_account_credentials c
      JOIN identity_user_accounts a ON a.id = c.user_account_id
      WHERE c.username = $1
    `, [username]);

    if (res.rowCount === 0) {
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const creds = res.rows[0];

    if (!creds.is_valid) {
      return { success: false, error: 'REVOKED' };
    }

    if (creds.locked_until && creds.locked_until > now) {
      return { success: false, error: 'LOCKED' };
    }

    // Rate Limit: Check if 5 failures in a rolling 5 minute window
    if (creds.failed_attempts_count >= POLICY.MAX_FAILED_ATTEMPTS) {
      if (creds.first_failed_attempt_at && (now.getTime() - creds.first_failed_attempt_at.getTime() < POLICY.FAILED_ATTEMPTS_WINDOW_MS)) {
         return { success: false, error: 'RATE_LIMITED' };
      }
    }

    const isCorrect = verifyPassword(passwordAttempt, creds.password_verifier);

    if (isCorrect) {
      await this.pg.query(`
        UPDATE identity_account_credentials 
        SET failed_attempts_count = 0,
            first_failed_attempt_at = NULL,
            consecutive_failures_count = 0,
            locked_until = NULL,
            last_successful_login_at = $1,
            updated_at = $1
        WHERE user_account_id = $2
      `, [now, creds.user_account_id]);

      return { 
        success: true, 
        userAccountId: creds.user_account_id,
        personId: creds.person_id
      };
    } else {
      let newFailedAttempts = creds.failed_attempts_count + 1;
      let newFirstFailed = creds.first_failed_attempt_at || now;
      let newConsecutive = creds.consecutive_failures_count + 1;
      let newLockedUntil = null;

      if (creds.first_failed_attempt_at && (now.getTime() - creds.first_failed_attempt_at.getTime() >= POLICY.FAILED_ATTEMPTS_WINDOW_MS)) {
        newFailedAttempts = 1;
        newFirstFailed = now;
      }

      if (newConsecutive >= POLICY.MAX_CONSECUTIVE_FAILURES) {
        newLockedUntil = new Date(now.getTime() + POLICY.TEMP_LOCK_DURATION_MS);
      }

      await this.pg.query(`
        UPDATE identity_account_credentials 
        SET failed_attempts_count = $1,
            first_failed_attempt_at = $2,
            consecutive_failures_count = $3,
            locked_until = $4,
            updated_at = $5
        WHERE user_account_id = $6
      `, [newFailedAttempts, newFirstFailed, newConsecutive, newLockedUntil, now, creds.user_account_id]);

      return { success: false, error: 'INVALID_CREDENTIALS' };
    }
  }

  async createSession(userAccountId: string): Promise<SessionCreationResult> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + POLICY.ABSOLUTE_EXPIRY_MS);
    const { secret, verifier } = generateSessionSecret();
    
    const resId = await this.pg.query(`SELECT gen_random_uuid() as id`);
    const sessionId = resId.rows[0].id;

    await this.pg.query(`
      INSERT INTO identity_sessions (
        id, user_account_id, session_secret_verifier, 
        authenticated_at, expires_at, last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [sessionId, userAccountId, verifier, now, expiresAt, now]);

    return { sessionId, secret };
  }

  async resolveSession(sessionId: string, secretAttempt: string): Promise<SessionData | null> {
    const now = this.clock.now();
    
    const res = await this.pg.query(`
      SELECT 
        s.user_account_id, s.session_secret_verifier, s.is_revoked,
        s.authenticated_at, s.expires_at, s.last_activity_at,
        a.person_id
      FROM identity_sessions s
      JOIN identity_user_accounts a ON a.id = s.user_account_id
      WHERE s.id = $1
    `, [sessionId]);

    if (res.rowCount === 0) return null;
    
    const session = res.rows[0];

    if (session.is_revoked) return null;
    if (now > session.expires_at) return null;
    if (now.getTime() - session.last_activity_at.getTime() > POLICY.IDLE_EXPIRY_MS) return null;

    if (!verifySessionSecret(secretAttempt, session.session_secret_verifier)) {
      return null;
    }

    const newActivity = now > session.expires_at ? session.expires_at : now;
    
    await this.pg.query(`
      UPDATE identity_sessions SET last_activity_at = $1 WHERE id = $2
    `, [newActivity, sessionId]);

    return {
      sessionId,
      userAccountId: session.user_account_id,
      personId: session.person_id,
      authenticatedAt: session.authenticated_at,
      expiresAt: session.expires_at,
      lastActivityAt: newActivity
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.pg.query(`
      UPDATE identity_sessions SET is_revoked = TRUE WHERE id = $1
    `, [sessionId]);
  }
}
