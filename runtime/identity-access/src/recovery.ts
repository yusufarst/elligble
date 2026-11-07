import { createHash } from 'node:crypto';
import type { ClientBase } from 'pg';
import { formatActivationCode, generateActivationCode, hashPassword } from './crypto.ts';

// AUTH-003 Identity-owned single-use recovery codes (record §5/§6/§6A). Every function runs in
// the caller's READ COMMITTED transaction after the caller took the credential row lock where
// it changes a code row (credential → recovery code → activation → sessions). The plain code is
// returned once and never stored; the row is the attributable audit record.

export const RECOVERY_POLICY = { VALIDITY_MINUTES: 15, MAX_FAILED_ATTEMPTS: 10 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireUuid(...values: string[]): void {
    if (!values.every(v => typeof v === 'string' && UUID.test(v))) throw new Error('Invalid recovery scope');
}

export function recoveryRequestLockKey(tenantId: string, requestKey: string): string {
    requireUuid(tenantId, requestKey);
    return `recovery-request:${tenantId.toLowerCase()}:${requestKey.toLowerCase()}`;
}

export const recoveryDigest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export interface RecoveryReceipt { id: string; requestDigest: string; userAccountId: string; expiresAt: Date }

/** Same issuer, same request key: the committed receipt, never the code again. */
export async function findRecoveryReceipt(client: ClientBase, tenantId: string, issuerPersonId: string, requestKey: string): Promise<RecoveryReceipt | null> {
    requireUuid(tenantId, issuerPersonId, requestKey);
    const r = await client.query(`SELECT id, request_digest, user_account_id, expires_at FROM identity_account_recovery_codes
        WHERE tenant_id = $1 AND issuer_person_id = $2 AND request_key = $3`,
        [tenantId.toLowerCase(), issuerPersonId.toLowerCase(), requestKey.toLowerCase()]);
    if (!r.rows.length) return null;
    return { id: r.rows[0].id, requestDigest: r.rows[0].request_digest, userAccountId: r.rows[0].user_account_id, expiresAt: new Date(r.rows[0].expires_at) };
}

export type RecoveryRevokeKind = 'SUPERSEDED' | 'REPLACED_BY_ACTIVATION';

/** Closes the Account's open recovery code, if any; the caller holds the credential lock. */
export async function revokeOpenRecoveryCodes(client: ClientBase, userAccountId: string, now: Date, kind: RecoveryRevokeKind): Promise<number> {
    requireUuid(userAccountId);
    await client.query(`SELECT id FROM identity_account_recovery_codes
        WHERE user_account_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL FOR UPDATE`, [userAccountId.toLowerCase()]);
    const r = await client.query(`UPDATE identity_account_recovery_codes SET revoked_at = GREATEST($2::timestamptz, issued_at), revoke_kind = $3
        WHERE user_account_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`, [userAccountId.toLowerCase(), now, kind]);
    return r.rowCount ?? 0;
}

export interface NewRecoveryCode {
    tenantId: string; userAccountId: string; personId: string; rosterId: string;
    issuerPersonId: string; issuerKind: 'school_operator' | 'homeroom'; reason: string; requestKey: string; requestDigest: string;
}

/** Supersedes an older open code and issues a new one (R4); returns the code exactly once. */
export async function issueRecoveryCode(client: ClientBase, input: NewRecoveryCode, now: Date): Promise<{ id: string; code: string; expiresAt: Date }> {
    requireUuid(input.tenantId, input.userAccountId, input.personId, input.rosterId, input.issuerPersonId, input.requestKey);
    await revokeOpenRecoveryCodes(client, input.userAccountId, now, 'SUPERSEDED');
    const code = generateActivationCode();
    const r = await client.query(`INSERT INTO identity_account_recovery_codes(tenant_id, user_account_id, person_id, roster_id, issuer_person_id,
            issuer_kind, reason, request_key, request_digest, code_verifier, issued_at, expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,statement_timestamp(),statement_timestamp() + interval '15 minutes') RETURNING id, expires_at`,
        [input.tenantId.toLowerCase(), input.userAccountId.toLowerCase(), input.personId.toLowerCase(), input.rosterId.toLowerCase(),
            input.issuerPersonId.toLowerCase(), input.issuerKind, input.reason, input.requestKey.toLowerCase(), input.requestDigest, hashPassword(code)]);
    return { id: r.rows[0].id, code: formatActivationCode(code), expiresAt: new Date(r.rows[0].expires_at) };
}

export interface RecoveryRoute { id: string; tenantId: string; userAccountId: string; personId: string; rosterId: string; issuerPersonId: string; issuerKind: 'school_operator' | 'homeroom' }

/**
 * Unlocked pre-resolution for completion: the open recovery code behind a username, or null.
 * One fixed query for every username; authority comes only from the locked re-read.
 */
export async function resolveRecoveryRoute(client: ClientBase, username: string): Promise<RecoveryRoute | null> {
    const r = await client.query(`SELECT r.id, r.tenant_id, r.user_account_id, r.person_id, r.roster_id, r.issuer_person_id, r.issuer_kind
        FROM identity_account_credentials c
        LEFT JOIN identity_account_recovery_codes r ON r.user_account_id = c.user_account_id AND r.consumed_at IS NULL AND r.revoked_at IS NULL
        WHERE c.username = $1 OR (NOT EXISTS (SELECT 1 FROM identity_account_credentials exact WHERE exact.username = $1)
            AND c.user_account_id = (SELECT l.user_account_id FROM identity_login_identifiers l
                WHERE l.origin = 'GENERATED' AND l.identifier_key = identity_identifier_key($1)))`, [username]);
    const row = r.rows.find(x => x.id);
    return row ? { id: row.id, tenantId: row.tenant_id, userAccountId: row.user_account_id, personId: row.person_id, rosterId: row.roster_id,
        issuerPersonId: row.issuer_person_id, issuerKind: row.issuer_kind } : null;
}
