import { createHash } from 'node:crypto';
import type { ClientBase } from 'pg';
import { issueActivationInTransaction } from './provisioning.ts';

// AUTH-002 Identity-owned Student claim state (record §5/§6A). Every function runs inside the
// caller's READ COMMITTED transaction; the Secure Assessment coordinator owns lock order
// (§6A.3). Public submission never establishes trusted Person/Account/Membership; a claim
// stores no capability and no secret. Failure counting is the claim-issued activation row's
// existing ACTIVATION_POLICY counter (§6A.5).

export const CLAIM_OPEN_STATES = ['PENDING_REVIEW', 'REVIEW_REQUIRED', 'APPROVED_PENDING_ACTIVATION'] as const;
export type ClaimState = typeof CLAIM_OPEN_STATES[number]
    | 'APPROVED_EXISTING_ACCOUNT' | 'REJECTED' | 'CANCELLED' | 'ACTIVATED' | 'EXPIRED' | 'EXHAUSTED' | 'CLOSED_BY_REISSUE';
export type ClaimEvent = 'SUBMITTED' | 'APPROVED' | 'APPROVED_EXISTING_ACCOUNT' | 'REJECTED' | 'CANCELLED'
    | 'ACTIVATED' | 'EXPIRED' | 'EXHAUSTED' | 'CLOSED_BY_REISSUE';
export type ClaimActorKind = 'anonymous' | 'homeroom' | 'school_operator' | 'system' | 'student';
export type Adjudication = 'EXISTING_BINDING' | 'EXISTING_ACCOUNT_CONTINUITY' | 'NEW_IDENTITY_REVIEWED';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isClaimUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** Validated, canonical lowercase UUID or null; advisory keys and lookups use only this form. */
export function canonicalClaimUuid(value: unknown): string | null {
    return isClaimUuid(value) ? value.toLowerCase() : null;
}

function requireUuid(...values: string[]): void {
    if (!values.every(isClaimUuid)) throw new Error('Invalid claim scope');
}

export function claimRequestLockKey(tenantId: string, requestKey: string): string {
    requireUuid(tenantId, requestKey);
    return `claim-request:${tenantId.toLowerCase()}:${requestKey.toLowerCase()}`;
}

export function claimRosterLockKey(tenantId: string, rosterId: string): string {
    requireUuid(tenantId, rosterId);
    return `claim-roster:${tenantId.toLowerCase()}:${rosterId.toLowerCase()}`;
}

export const claimDigest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function isOpenClaimState(state: ClaimState): boolean {
    return (CLAIM_OPEN_STATES as readonly string[]).includes(state);
}

export interface ClaimRow {
    id: string;
    tenantId: string;
    state: ClaimState;
    revision: number;
    rosterId: string | null;
    rosterRevision: number | null;
    personId: string | null;
    submittedName: string;
    submittedNisn: string;
    submittedBirth: string;
    createdAt: Date;
    expiresAt: Date;
    closedAt: Date | null;
}

const CLAIM_COLUMNS = `id, tenant_id, state, revision, roster_id, roster_revision, person_id, submitted_name, submitted_nisn,
    to_char(submitted_birth, 'YYYY-MM-DD') AS submitted_birth, created_at, expires_at, closed_at`;

function toClaim(row: Record<string, unknown>): ClaimRow {
    return {
        id: row.id as string, tenantId: row.tenant_id as string, state: row.state as ClaimState, revision: Number(row.revision),
        rosterId: (row.roster_id as string | null) ?? null,
        rosterRevision: row.roster_revision === null || row.roster_revision === undefined ? null : Number(row.roster_revision),
        personId: (row.person_id as string | null) ?? null,
        submittedName: row.submitted_name as string, submittedNisn: row.submitted_nisn as string, submittedBirth: row.submitted_birth as string,
        createdAt: new Date(row.created_at as string), expiresAt: new Date(row.expires_at as string),
        closedAt: row.closed_at ? new Date(row.closed_at as string) : null,
    };
}

/** Submit replay lookup by the anonymous request key; returns only its digest. */
export async function findClaimSubmission(client: ClientBase, tenantId: string, requestKey: string): Promise<{ digest: string } | null> {
    requireUuid(tenantId, requestKey);
    const r = await client.query('SELECT request_digest FROM identity_student_claims WHERE tenant_id = $1 AND request_key = $2',
        [tenantId.toLowerCase(), requestKey.toLowerCase()]);
    return r.rows.length ? { digest: r.rows[0].request_digest } : null;
}

/** Unlocked read; authority comes only from a later locked re-read. */
export async function readClaim(client: ClientBase, tenantId: string, claimId: string): Promise<ClaimRow | null> {
    requireUuid(tenantId, claimId);
    const r = await client.query(`SELECT ${CLAIM_COLUMNS} FROM identity_student_claims WHERE id = $1 AND tenant_id = $2`,
        [claimId.toLowerCase(), tenantId.toLowerCase()]);
    return r.rows.length ? toClaim(r.rows[0]) : null;
}

export async function lockClaim(client: ClientBase, tenantId: string, claimId: string): Promise<ClaimRow | null> {
    requireUuid(tenantId, claimId);
    const r = await client.query(`SELECT ${CLAIM_COLUMNS} FROM identity_student_claims WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [claimId.toLowerCase(), tenantId.toLowerCase()]);
    return r.rows.length ? toClaim(r.rows[0]) : null;
}

/** The open claim of one official roster identity, row-locked for observation or refusal. */
export async function lockOpenClaimForRoster(client: ClientBase, tenantId: string, rosterId: string | null): Promise<ClaimRow | null> {
    requireUuid(tenantId);
    const r = await client.query(`SELECT ${CLAIM_COLUMNS} FROM identity_student_claims
        WHERE tenant_id = $1 AND roster_id = $2 AND closed_at IS NULL FOR UPDATE`,
        [tenantId.toLowerCase(), rosterId === null ? null : rosterId.toLowerCase()]);
    return r.rows.length ? toClaim(r.rows[0]) : null;
}

export async function hasOtherOpenClaimForPerson(client: ClientBase, personId: string, claimId: string): Promise<boolean> {
    requireUuid(personId, claimId);
    const r = await client.query('SELECT 1 FROM identity_student_claims WHERE person_id = $1 AND closed_at IS NULL AND id <> $2',
        [personId.toLowerCase(), claimId.toLowerCase()]);
    return r.rows.length > 0;
}

export interface NewClaim {
    tenantId: string; requestKey: string; requestDigest: string;
    name: string; nisn: string; birth: string;
    rosterId: string | null; rosterRevision: number | null;
    state: 'PENDING_REVIEW' | 'REVIEW_REQUIRED';
}

/** Persists a non-trusted claim and its SUBMITTED event; never a Person, Account or Membership. */
export async function insertClaim(client: ClientBase, input: NewClaim): Promise<string> {
    requireUuid(input.tenantId, input.requestKey);
    const r = await client.query(`INSERT INTO identity_student_claims(tenant_id, request_key, request_digest, submitted_name, submitted_nisn,
            submitted_birth, roster_id, roster_revision, state, created_at, expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,statement_timestamp(),statement_timestamp() + interval '7 days') RETURNING id`,
        [input.tenantId.toLowerCase(), input.requestKey.toLowerCase(), input.requestDigest, input.name, input.nisn, input.birth,
            input.rosterId?.toLowerCase() ?? null, input.rosterRevision, input.state]);
    const id: string = r.rows[0].id;
    await client.query(`INSERT INTO identity_student_claim_events(claim_id, tenant_id, event, actor_kind, resulting_revision, roster_revision)
        VALUES($1,$2,'SUBMITTED','anonymous',1,$3)`, [id, input.tenantId.toLowerCase(), input.rosterRevision]);
    return id;
}

export interface ClaimTransition {
    state: ClaimState;
    event: ClaimEvent;
    actorKind: ClaimActorKind;
    actorPersonId?: string | null;
    requestKey?: string | null;
    requestDigest?: string | null;
    adjudication?: Adjudication | null;
    reason?: string | null;
    personId?: string | null;
    rosterRevision?: number | null;
}

/** Caller holds the claim row lock; optimistic revision guards against a lost update. */
export async function transitionClaim(client: ClientBase, claim: ClaimRow, next: ClaimTransition): Promise<{ eventId: string; revision: number }> {
    const closes = !isOpenClaimState(next.state);
    const updated = await client.query(`UPDATE identity_student_claims
        SET state = $3, revision = revision + 1, person_id = COALESCE($4, person_id),
            roster_revision = COALESCE($5, roster_revision), closed_at = CASE WHEN $6::boolean THEN statement_timestamp() ELSE NULL END
        WHERE id = $1 AND tenant_id = $2 AND revision = $7 AND closed_at IS NULL RETURNING revision, roster_revision`,
        [claim.id, claim.tenantId, next.state, next.personId?.toLowerCase() ?? null, next.rosterRevision ?? null, closes, claim.revision]);
    if (updated.rows.length !== 1) throw new Error('Claim revision conflict');
    const revision = Number(updated.rows[0].revision);
    const event = await client.query(`INSERT INTO identity_student_claim_events(claim_id, tenant_id, event, actor_kind, actor_person_id,
            previous_revision, resulting_revision, request_key, request_digest, adjudication, reason, roster_revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [claim.id, claim.tenantId, next.event, next.actorKind, next.actorPersonId?.toLowerCase() ?? null, claim.revision, revision,
            next.requestKey?.toLowerCase() ?? null, next.requestDigest ?? null, next.adjudication ?? null, next.reason ?? null,
            updated.rows[0].roster_revision ?? null]);
    claim.state = next.state; claim.revision = revision;
    if (next.personId) claim.personId = next.personId.toLowerCase();
    if (next.rosterRevision) claim.rosterRevision = next.rosterRevision;
    if (closes) claim.closedAt = new Date();
    return { eventId: event.rows[0].id, revision };
}

export interface DecisionReceipt {
    claimId: string; event: ClaimEvent; revision: number; requestDigest: string; occurredAt: Date;
}

/** Same verifier, same request key: the committed receipt, never a re-disclosed code. */
export async function findDecisionReceipt(client: ClientBase, tenantId: string, actorPersonId: string, requestKey: string): Promise<DecisionReceipt | null> {
    requireUuid(tenantId, actorPersonId, requestKey);
    const r = await client.query(`SELECT claim_id, event, resulting_revision, request_digest, occurred_at FROM identity_student_claim_events
        WHERE tenant_id = $1 AND actor_person_id = $2 AND request_key = $3`,
        [tenantId.toLowerCase(), actorPersonId.toLowerCase(), requestKey.toLowerCase()]);
    if (!r.rows.length) return null;
    const row = r.rows[0];
    return { claimId: row.claim_id, event: row.event, revision: Number(row.resulting_revision), requestDigest: row.request_digest, occurredAt: new Date(row.occurred_at) };
}

export interface ClaimActivationState {
    activationId: string; userAccountId: string;
    consumed: boolean; revoked: boolean; failedAttempts: number;
}

export async function readClaimActivation(client: ClientBase, claimId: string): Promise<ClaimActivationState | null> {
    requireUuid(claimId);
    const r = await client.query(`SELECT r.activation_id, r.user_account_id, a.consumed_at IS NOT NULL AS consumed, a.revoked_at IS NOT NULL AS revoked,
            a.failed_attempts FROM identity_student_claim_activations r JOIN identity_account_activations a ON a.id = r.activation_id
        WHERE r.claim_id = $1`, [claimId.toLowerCase()]);
    if (!r.rows.length) return null;
    const row = r.rows[0];
    return { activationId: row.activation_id, userAccountId: row.user_account_id, consumed: row.consumed, revoked: row.revoked, failedAttempts: Number(row.failed_attempts) };
}

/**
 * Revokes only the claim-issued code row, by id, while it is still open and unconsumed.
 * Credential then activation row locks keep the existing credential-first order; it never
 * uses the account-wide revoke of issueActivationInTransaction.
 */
export async function revokeClaimActivation(client: ClientBase, claimId: string, now: Date): Promise<boolean> {
    const state = await readClaimActivation(client, claimId);
    if (!state) return false;
    await client.query('SELECT user_account_id FROM identity_account_credentials WHERE user_account_id = $1 FOR UPDATE', [state.userAccountId]);
    const r = await client.query(`UPDATE identity_account_activations SET revoked_at = $2
        WHERE id = $1 AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id`, [state.activationId, now]);
    return r.rows.length === 1;
}

/**
 * Lazy observer under the claim row lock (§6A.5): records server expiry, and the
 * EXHAUSTED / CLOSED_BY_REISSUE / ACTIVATED outcome of the claim-issued code row that the
 * unchanged existing writers cannot record themselves. Returns the current claim.
 */
export async function observeClaim(client: ClientBase, claim: ClaimRow, now: Date, maxFailedAttempts: number): Promise<ClaimRow> {
    if (!isOpenClaimState(claim.state)) return claim;
    const system = { actorKind: 'system' as const };
    if (claim.state === 'APPROVED_PENDING_ACTIVATION') {
        const code = await readClaimActivation(client, claim.id);
        if (code?.consumed) { await transitionClaim(client, claim, { ...system, state: 'ACTIVATED', event: 'ACTIVATED' }); return claim; }
        if (code?.revoked) {
            const exhausted = code.failedAttempts >= maxFailedAttempts;
            await transitionClaim(client, claim, { ...system, state: exhausted ? 'EXHAUSTED' : 'CLOSED_BY_REISSUE', event: exhausted ? 'EXHAUSTED' : 'CLOSED_BY_REISSUE' });
            return claim;
        }
    }
    if (now.getTime() >= claim.expiresAt.getTime()) {
        if (claim.state === 'APPROVED_PENDING_ACTIVATION') await revokeClaimActivation(client, claim.id, now);
        await transitionClaim(client, claim, { ...system, state: 'EXPIRED', event: 'EXPIRED' });
    }
    return claim;
}

/** A new bare Person (NEW_IDENTITY_REVIEWED only); its Account comes from AUTH-001 allocation. */
export async function createReviewedPerson(client: ClientBase, personId: string): Promise<void> {
    requireUuid(personId);
    await client.query('INSERT INTO identity_persons(id) VALUES($1)', [personId.toLowerCase()]);
}

export interface CanonicalCredential { userAccountId: string; username: string; isValid: boolean }

/** Canonical Account credential of a Person, row-locked (credential before activation rows). */
export async function lockCanonicalCredential(client: ClientBase, personId: string): Promise<CanonicalCredential | null> {
    requireUuid(personId);
    const r = await client.query(`SELECT c.user_account_id, c.username, c.is_valid FROM identity_person_account_bindings b
        JOIN identity_account_credentials c ON c.user_account_id = b.canonical_account_id WHERE b.person_id = $1 FOR UPDATE OF c`,
        [personId.toLowerCase()]);
    return r.rows.length === 1 ? { userAccountId: r.rows[0].user_account_id, username: r.rows[0].username, isValid: r.rows[0].is_valid } : null;
}

/** Canonical Account of a Person without locks; for ordering advisory keys only. */
export async function readCanonicalUsername(client: ClientBase, personId: string): Promise<string | null> {
    requireUuid(personId);
    const r = await client.query(`SELECT c.username FROM identity_person_account_bindings b
        JOIN identity_account_credentials c ON c.user_account_id = b.canonical_account_id WHERE b.person_id = $1`, [personId.toLowerCase()]);
    return r.rows.length === 1 ? r.rows[0].username : null;
}

/**
 * §6A.2: a code may be issued only for a never-activated Account. Evaluated after the
 * credential FOR UPDATE; an Account ever activated or signed in counts as having a password.
 */
export async function isNeverActivated(client: ClientBase, userAccountId: string): Promise<boolean> {
    requireUuid(userAccountId);
    const r = await client.query(`SELECT c.is_valid AND c.last_successful_login_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM identity_account_activations a WHERE a.user_account_id = c.user_account_id AND a.consumed_at IS NOT NULL)
            AS never_activated
        FROM identity_account_credentials c WHERE c.user_account_id = $1`, [userAccountId.toLowerCase()]);
    return r.rows[0]?.never_activated === true;
}

/**
 * D1 handoff: the existing single-use code, issued in the approval transaction with
 * unusableVerifier null (no password reset, no session revocation), recorded as the claim's
 * code. The caller holds the credential row lock. The plain code is returned once.
 */
export async function issueClaimActivation(client: ClientBase, claim: ClaimRow, userAccountId: string, now: Date, validForMs: number): Promise<{ code: string; expiresAt: Date }> {
    const issued = await issueActivationInTransaction(client, userAccountId, { now, validForMs, unusableVerifier: null });
    const row = await client.query(`SELECT id FROM identity_account_activations
        WHERE user_account_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL FOR UPDATE`, [userAccountId]);
    if (row.rows.length !== 1) throw new Error('Activation issuance conflict');
    await client.query(`INSERT INTO identity_student_claim_activations(claim_id, tenant_id, activation_id, user_account_id) VALUES($1,$2,$3,$4)`,
        [claim.id, claim.tenantId, row.rows[0].id, userAccountId]);
    return issued;
}

/** Is this open activation row the claim-issued code of a claim? Identity-internal; no Academic read. */
export async function isClaimIssuedActivation(client: ClientBase, activationId: string): Promise<boolean> {
    const r = await client.query('SELECT 1 FROM identity_student_claim_activations WHERE activation_id = $1', [activationId]);
    return r.rows.length > 0;
}

export interface ClaimActivationRoute { claimId: string; tenantId: string; rosterId: string | null }

/**
 * Unlocked pre-resolution for /auth/activate (§6A.6): the claim behind the username's open
 * code, or null. One fixed query for every username, so the routing work does not depend on
 * whether a claim-issued code exists.
 */
export async function resolveClaimActivationRoute(client: ClientBase, username: string): Promise<ClaimActivationRoute | null> {
    const r = await client.query(`SELECT r.claim_id, s.tenant_id, s.roster_id
        FROM identity_account_credentials c
        JOIN identity_account_activations a ON a.user_account_id = c.user_account_id AND a.consumed_at IS NULL AND a.revoked_at IS NULL
        LEFT JOIN identity_student_claim_activations r ON r.activation_id = a.id
        LEFT JOIN identity_student_claims s ON s.id = r.claim_id
        WHERE c.username = $1 OR (NOT EXISTS (SELECT 1 FROM identity_account_credentials exact WHERE exact.username = $1)
            AND c.user_account_id = (SELECT l.user_account_id FROM identity_login_identifiers l
                WHERE l.origin = 'GENERATED' AND l.identifier_key = identity_identifier_key($1)))`, [username]);
    const row = r.rows.find(x => x.claim_id);
    return row ? { claimId: row.claim_id, tenantId: row.tenant_id, rosterId: row.roster_id ?? null } : null;
}

export interface ReviewClaim {
    id: string; revision: number; state: ClaimState; rosterId: string | null; rosterRevision: number | null;
    submittedName: string; submittedNisn: string; submittedBirth: string; createdAt: Date; expiresAt: Date;
}

/** Open claims of one tenant, oldest first; the coordinator narrows them to the verifier's scope. */
export async function listOpenClaims(client: ClientBase, tenantId: string, limit: number): Promise<ReviewClaim[]> {
    requireUuid(tenantId);
    const r = await client.query(`SELECT ${CLAIM_COLUMNS} FROM identity_student_claims
        WHERE tenant_id = $1 AND closed_at IS NULL ORDER BY created_at, id LIMIT $2`, [tenantId.toLowerCase(), Math.max(1, Math.min(limit, 1000))]);
    return r.rows.map(toClaim).map(c => ({ id: c.id, revision: c.revision, state: c.state, rosterId: c.rosterId, rosterRevision: c.rosterRevision,
        submittedName: c.submittedName, submittedNisn: c.submittedNisn, submittedBirth: c.submittedBirth, createdAt: c.createdAt, expiresAt: c.expiresAt }));
}
