import type { ClientBase } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { formatActivationCode, generateActivationCode, hashPassword } from './crypto.ts';
import { revokeOpenRecoveryCodes } from './recovery.ts';

// Identity provisioning for operator imports (D02.3-01/02/10, D02.7-01/37). Every function
// runs inside the caller's open transaction so a whole import commits or fails together.
// Accounts are created activation-required: their password verifier belongs to a random,
// discarded secret, so nobody can sign in until the person activates with their code.

/**
 * ELLIGBLE ID syntax accepted for provisioning: unique, non-secret, stable, not email-based
 * (D02.3-03, D02.5-01). Legacy CSV syntax remains compatible; generated IDs follow AUTH-001.
 */
export const ELLIGBLE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,62})[a-z0-9]$/;

export function isValidElligbleId(value: unknown): value is string {
    return typeof value === 'string' && ELLIGBLE_ID_PATTERN.test(value) && !/[._-]{2}/.test(value);
}

export interface ProvisionedAccount {
    personId: string;
    userAccountId: string;
}

/** A verifier for a random secret that is thrown away: shared by one import batch. */
export function createUnusableVerifier(): string {
    return hashPassword(randomBytes(32).toString('hex'));
}

export async function findAccountByElligbleId(client: ClientBase, elligbleId: string): Promise<ProvisionedAccount | null> {
    const res = await client.query(
        `SELECT c.user_account_id, a.person_id
         FROM identity_account_credentials c
         JOIN identity_user_accounts a ON a.id = c.user_account_id
         WHERE c.username = $1 OR (NOT EXISTS (SELECT 1 FROM identity_account_credentials exact WHERE exact.username = $1)
            AND c.user_account_id = (SELECT r.user_account_id FROM identity_login_identifiers r
                WHERE r.origin = 'GENERATED' AND r.identifier_key = identity_identifier_key($1)))`,
        [elligbleId]
    );
    return res.rowCount === 1 ? { userAccountId: res.rows[0].user_account_id, personId: res.rows[0].person_id } : null;
}

export async function createActivationRequiredAccount(
    client: ClientBase,
    elligbleId: string,
    unusableVerifier: string
): Promise<ProvisionedAccount> {
    if (!isValidElligbleId(elligbleId)) throw new Error('Invalid ELLIGBLE ID.');
    const personId = randomUUID();
    const userAccountId = randomUUID();
    await client.query('INSERT INTO identity_persons (id) VALUES ($1)', [personId]);
    await client.query('INSERT INTO identity_user_accounts (id, person_id) VALUES ($1, $2)', [userAccountId, personId]);
    await client.query(
        'INSERT INTO identity_account_credentials (user_account_id, username, password_verifier) VALUES ($1, $2, $3)',
        [userAccountId, elligbleId, unusableVerifier]
    );
    return { personId, userAccountId };
}

export interface IssuedActivation {
    code: string;
    expiresAt: Date;
}

/**
 * Issues a single-use activation code inside the caller's transaction. Any open code is
 * revoked. With `unusableVerifier` the current password stops working and all sessions of
 * the account are revoked (administrative reset, D02.3-17).
 */
export async function issueActivationInTransaction(
    client: ClientBase,
    userAccountId: string,
    options: { now: Date; validForMs: number; unusableVerifier: string | null }
): Promise<IssuedActivation> {
    const code = generateActivationCode();
    const expiresAt = new Date(options.now.getTime() + options.validForMs);
    await client.query(
        `UPDATE identity_account_activations SET revoked_at = $2
         WHERE user_account_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [userAccountId, options.now]
    );
    // AUTH-003 §6A.1: a new activation code closes an open recovery code of the Account.
    await revokeOpenRecoveryCodes(client, userAccountId, options.now, 'REPLACED_BY_ACTIVATION');
    if (options.unusableVerifier) {
        await client.query(
            `UPDATE identity_account_credentials
             SET password_verifier = $2, failed_attempts_timeline = '[]'::jsonb, consecutive_failures_count = 0,
                 locked_until = NULL, updated_at = $3
             WHERE user_account_id = $1`,
            [userAccountId, options.unusableVerifier, options.now]
        );
        await client.query('UPDATE identity_sessions SET is_revoked = TRUE WHERE user_account_id = $1 AND is_revoked = FALSE', [userAccountId]);
    }
    await client.query(
        'INSERT INTO identity_account_activations (user_account_id, code_verifier, issued_at, expires_at) VALUES ($1, $2, $3, $4)',
        [userAccountId, hashPassword(code), options.now, expiresAt]
    );
    return { code: formatActivationCode(code), expiresAt };
}

/**
 * SEC-OPS-001: revokes every non-revoked session of one Account inside the caller's
 * transaction. The caller holds the credential row lock first (credential → sessions, the
 * activation reissue order). Returns the number of session rows revoked.
 */
export async function revokeAccountSessionsInTransaction(client: ClientBase, userAccountId: string): Promise<number> {
    const r = await client.query('UPDATE identity_sessions SET is_revoked = TRUE WHERE user_account_id = $1 AND is_revoked = FALSE', [userAccountId]);
    return r.rowCount ?? 0;
}
