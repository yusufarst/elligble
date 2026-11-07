import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Pool, PoolClient } from 'pg';
import { ACTIVATION_POLICY, checkNewPassword, IdentityRuntime, type ActivationResult, type Clock } from '../../identity-access/src/index.ts';
import {
    canonicalClaimUuid, claimDigest, claimRequestLockKey, claimRosterLockKey, createReviewedPerson, findClaimSubmission,
    findDecisionReceipt, hasOtherOpenClaimForPerson, insertClaim, isNeverActivated, isOpenClaimState, issueClaimActivation,
    listOpenClaims, lockCanonicalCredential, lockClaim, lockOpenClaimForRoster, observeClaim, readCanonicalUsername,
    readClaim, readClaimActivation, revokeClaimActivation, transitionClaim,
    type Adjudication, type ClaimActivationRoute, type ClaimEvent, type ClaimRow,
} from '../../identity-access/src/claims.ts';
import { allocateStudentIdentity, type IdentityAuthority } from '../../identity-access/src/student-identity.ts';
import { findAccountByElligbleId } from '../../identity-access/src/provisioning.ts';
import { ensureMembership, findMembership, findTenant, personHasTenantStaffRole } from '../../tenant-access/src/provisioning.ts';
import { schoolOperatorAssignment } from '../../tenant-access/src/school-operator.ts';
import { activeHomeroomResponsibilities, homeroomCovers } from '../../academic-core/src/homeroom.ts';
import {
    bindRosterIdentity, claimEnrollmentSlot, claimEnrollmentState, claimNamesMatch, ensureClaimEnrollment, isClaimBirthDate,
    isClaimName, isClaimNisn, matchRosterForClaim, personHasAcademicStaffRole, readRosterIdentity, rosterIdsInScope, rosterRecordsBoundToPerson,
    rosterStillMatches, type RosterIdentity,
} from '../../academic-core/src/student-identity.ts';
import { AuthenticationError, buildAuthenticatedContext } from './http/authenticated-context.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import { normalizePermissionReason } from './permission-action-audit.ts';

// AUTH-002 shared-transaction coordinator (record §6A). Composes the owning Identity,
// Tenant Access and Academic Core APIs in one caller-owned READ COMMITTED transaction and
// one total lock order:
// claim-request -> claim-roster -> roster-tenant -> session guard -> authority FOR SHARE ->
// claim FOR UPDATE -> sorted identity_identifier/tenant_membership -> allocation -> Person ->
// credential -> activation -> enrollment slot try-lock -> Academic rows.

export class ClaimRefusal extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string) {
        super(code);
        this.status = status;
        this.code = code;
    }
}

const SYSTEM_CLOCK: Clock = { now: () => new Date() };
const lock = (c: PoolClient, key: string) => c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
const tryLock = async (c: PoolClient, key: string) =>
    (await c.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS held', [key])).rows[0]?.held === true;
const reviewRequired = () => new ClaimRefusal(409, 'review_required');
const stale = () => new ClaimRefusal(409, 'stale_conflict');

function exactKeys(body: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
    const allowed = [...required, ...optional];
    if (Object.keys(body).some(k => !allowed.includes(k)) || required.some(k => !(k in body))) throw new ClaimRefusal(400, 'invalid_request');
}

/** School-local calendar date of an instant; the zone is the tenant's recorded IANA zone. */
export function schoolLocalDate(now: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---------------------------------------------------------------------------------------
// Public, non-trusted submission (C01): uniform receipt, zero trusted effects.

export interface SubmitReceipt { status: 'received'; requestKey: string }

const SUBMIT_KEYS = ['tenantId', 'fullName', 'nisn', 'birthDate', 'requestKey'] as const;

export function validateClaimSubmission(body: Record<string, unknown>): { tenantId: string; requestKey: string; name: string; nisn: string; birth: string } {
    exactKeys(body, SUBMIT_KEYS);
    const tenantId = canonicalClaimUuid(body.tenantId), requestKey = canonicalClaimUuid(body.requestKey);
    if (!tenantId || !requestKey || !isClaimName(body.fullName) || !isClaimNisn(body.nisn) || !isClaimBirthDate(body.birthDate)) {
        throw new ClaimRefusal(400, 'invalid_request');
    }
    return { tenantId, requestKey, name: body.fullName.trim(), nisn: body.nisn, birth: body.birthDate };
}

export async function submitClaim(pool: Pool, body: Record<string, unknown>, clock: Clock = SYSTEM_CLOCK): Promise<SubmitReceipt> {
    const input = validateClaimSubmission(body);
    const digest = claimDigest({ v: 1, tenant: input.tenantId, name: input.name, nisn: input.nisn, birth: input.birth });
    const receipt: SubmitReceipt = { status: 'received', requestKey: input.requestKey };
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        await lock(c, claimRequestLockKey(input.tenantId, input.requestKey));
        const tenant = await findTenant(c, input.tenantId);
        // Every branch runs the same lookups so the work reveals neither a match nor a prior claim.
        const previous = await findClaimSubmission(c, input.tenantId, input.requestKey);
        const roster = await matchRosterForClaim(c, input.tenantId, input.nisn, input.birth);
        if (previous) {
            if (previous.digest !== digest) throw new ClaimRefusal(409, 'action_key_reused');
            await c.query('COMMIT');
            return receipt;
        }
        if (roster && !(await tryLock(c, claimRosterLockKey(input.tenantId, roster.id)))) throw new ClaimRefusal(429, 'busy');
        let open = await lockOpenClaimForRoster(c, input.tenantId, roster?.id ?? null);
        if (open) open = await observeClaim(c, open, clock.now(), ACTIVATION_POLICY.MAX_FAILED_ATTEMPTS);
        if (tenant && !(open && isOpenClaimState(open.state))) {
            await insertClaim(c, {
                tenantId: input.tenantId, requestKey: input.requestKey, requestDigest: digest,
                name: input.name, nisn: input.nisn, birth: input.birth,
                rosterId: roster?.id ?? null, rosterRevision: roster?.revision ?? null,
                state: roster && claimNamesMatch(input.name, roster.fullName) ? 'PENDING_REVIEW' : 'REVIEW_REQUIRED',
            });
        }
        await c.query('COMMIT');
        return receipt;
    } catch (error) {
        await c.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        c.release();
    }
}

// ---------------------------------------------------------------------------------------
// Scoped verifier authority (C03): own-tenant School Operator or own-current-rombel Homeroom.

type VerifierKind = 'school_operator' | 'homeroom';

async function verifierAuthority(c: PoolClient, tenant: string, membershipId: string, roster: RosterIdentity | null, now: Date, lockRows: boolean): Promise<VerifierKind | null> {
    if (await schoolOperatorAssignment(c, tenant, membershipId, lockRows)) return 'school_operator';
    if (!roster) return null;
    const homerooms = await activeHomeroomResponsibilities(c, tenant, membershipId, now, lockRows);
    return homeroomCovers(homerooms, roster) ? 'homeroom' : null;
}

export interface ReviewItem {
    claimId: string; revision: number; state: string; expired: boolean; createdAt: string; expiresAt: string;
    submitted: { fullName: string; nisn: string; birthDate: string };
    roster: { revision: number; fullName: string; groupLabel: string | null; bound: boolean; nameMatches: boolean } | null;
}

export const REVIEW_PAGE_SIZE = 100;
const MAX_REVIEW_OFFSET = 100_000;

export function validateReviewOffset(value: string | null): number {
    if (value === null) return 0;
    if (!/^\d{1,6}$/.test(value) || Number(value) > MAX_REVIEW_OFFSET) throw new ClaimRefusal(400, 'invalid_request');
    return Number(value);
}

export async function listClaimReview(pool: Pool, req: IncomingMessage, cookie: SessionCookieConfig, offset = 0, clock: Clock = SYSTEM_CLOCK) {
    const ctx = await buildAuthenticatedContext(req, pool, { cookie });
    if (!ctx) throw new ClaimRefusal(403, 'forbidden');
    const c = await pool.connect();
    try {
        await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        const tenant = ctx.tenantId.toLowerCase(), now = clock.now();
        const operator = !!(await schoolOperatorAssignment(c, tenant, ctx.membershipId));
        const homerooms = operator ? [] : await activeHomeroomResponsibilities(c, tenant, ctx.membershipId, now);
        if (!operator && !homerooms.length) throw new ClaimRefusal(403, 'forbidden');
        // Scope is applied in SQL before paging; unknown or ambiguous rombel goes to the School Operator only.
        const rosterIds = operator ? null : await rosterIdsInScope(c, tenant, homerooms);
        const page = await listOpenClaims(c, tenant, { now, rosterIds, limit: REVIEW_PAGE_SIZE, offset });
        const items: ReviewItem[] = [];
        for (const claim of page.claims) {
            const roster = claim.rosterId ? await readRosterIdentity(c, tenant, claim.rosterId) : null;
            if (!operator && !(roster && homeroomCovers(homerooms, roster))) continue;
            items.push({
                claimId: claim.id, revision: claim.revision, state: claim.state, expired: now.getTime() >= claim.expiresAt.getTime(),
                createdAt: claim.createdAt.toISOString(), expiresAt: claim.expiresAt.toISOString(),
                submitted: { fullName: claim.submittedName, nisn: claim.submittedNisn, birthDate: claim.submittedBirth },
                roster: roster && roster.revision ? {
                    revision: roster.revision, fullName: roster.fullName, groupLabel: roster.groupLabel,
                    bound: roster.personId !== null, nameMatches: claimNamesMatch(claim.submittedName, roster.fullName),
                } : null,
            });
        }
        await c.query('COMMIT');
        return { authority: operator ? 'school_operator' : 'homeroom', claims: items, offset, truncated: page.more };
    } catch (error) {
        await c.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        c.release();
    }
}

// ---------------------------------------------------------------------------------------
// Reasoned verifier decision (C03/C05–C10).

const DECISION_REQUIRED = ['claimId', 'expectedRevision', 'decision', 'reason', 'confirmed', 'requestKey'] as const;
const DECISION_OPTIONAL = ['expectedRosterRevision', 'adjudication', 'elligbleId', 'noExistingAccountConfirmed'] as const;
const ADJUDICATIONS: readonly Adjudication[] = ['EXISTING_BINDING', 'EXISTING_ACCOUNT_CONTINUITY', 'NEW_IDENTITY_REVIEWED'];

export interface DecisionInput {
    claimId: string; expectedRevision: number; expectedRosterRevision: number | null;
    decision: 'APPROVE' | 'REJECT' | 'CANCEL'; adjudication: Adjudication | null;
    elligbleId: string | null; noExistingAccountConfirmed: boolean; reason: string; requestKey: string;
}

export function validateDecision(body: Record<string, unknown>): DecisionInput {
    exactKeys(body, DECISION_REQUIRED, DECISION_OPTIONAL);
    const claimId = canonicalClaimUuid(body.claimId), requestKey = canonicalClaimUuid(body.requestKey);
    const reason = normalizePermissionReason(body.reason);
    const revision = body.expectedRevision, rosterRevision = body.expectedRosterRevision ?? null;
    const decision = body.decision;
    const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 2 ** 31;
    if (!claimId || !requestKey || !reason || body.confirmed !== true || !int(revision) || (rosterRevision !== null && !int(rosterRevision))
        || (decision !== 'APPROVE' && decision !== 'REJECT' && decision !== 'CANCEL')) throw new ClaimRefusal(400, 'invalid_request');
    const adjudication = body.adjudication ?? null, elligbleId = body.elligbleId ?? null, attested = body.noExistingAccountConfirmed ?? false;
    if (decision === 'APPROVE') {
        if (!ADJUDICATIONS.includes(adjudication as Adjudication) || rosterRevision === null) throw new ClaimRefusal(400, 'invalid_request');
        if ((adjudication === 'EXISTING_ACCOUNT_CONTINUITY') !== (elligbleId !== null)) throw new ClaimRefusal(400, 'invalid_request');
        if (elligbleId !== null && (typeof elligbleId !== 'string' || !elligbleId.trim() || elligbleId.length > 255)) throw new ClaimRefusal(400, 'invalid_request');
        if ((adjudication === 'NEW_IDENTITY_REVIEWED') !== (attested === true)) throw new ClaimRefusal(400, 'invalid_request');
    } else if (adjudication !== null || elligbleId !== null || attested !== false) throw new ClaimRefusal(400, 'invalid_request');
    return {
        claimId, requestKey, reason, decision, expectedRevision: revision as number, expectedRosterRevision: rosterRevision as number | null,
        adjudication: adjudication as Adjudication | null, elligbleId: elligbleId === null ? null : (elligbleId as string).trim(), noExistingAccountConfirmed: attested === true,
    };
}

export type DecisionResult =
    | { outcome: 'APPROVED'; claimId: string; revision: number; elligbleId: string; activationCode: string; activationExpiresAt: string; claimExpiresAt: string; replayed: false }
    | { outcome: 'APPROVED_EXISTING_ACCOUNT'; claimId: string; revision: number; elligbleId: string; replayed: false }
    | { outcome: 'REJECTED' | 'CANCELLED'; claimId: string; revision: number; replayed: false }
    | { outcome: ClaimEvent; claimId: string; revision: number; replayed: true };

/** Refusal after a committed lazy observation (the observation itself is kept). */
class ObservedRefusal extends Error {
    readonly refusal: ClaimRefusal;
    constructor(refusal: ClaimRefusal) { super(refusal.code); this.refusal = refusal; }
}

async function personHasProctorRole(c: PoolClient, personId: string): Promise<boolean> {
    const r = await c.query(`SELECT EXISTS (SELECT 1 FROM secure_assessment_proctor_assignments WHERE person_id = $1)
        OR EXISTS (SELECT 1 FROM secure_assessment_exam_proctor_room_assignments r JOIN secure_assessment_proctor_assignments p
            ON p.id = r.proctor_assignment_id AND p.tenant_id = r.tenant_id WHERE p.person_id = $1) AS staff`, [personId]);
    return r.rows[0]?.staff === true;
}

/** §6A.1 N1: any staff, Teacher, Proctor, Operator or Homeroom row in any tenant and state. */
async function hasStaffRole(c: PoolClient, personId: string): Promise<boolean> {
    return await personHasTenantStaffRole(c, personId) || await personHasAcademicStaffRole(c, personId) || await personHasProctorRole(c, personId);
}

export async function decideClaim(pool: Pool, req: IncomingMessage, cookie: SessionCookieConfig, body: Record<string, unknown>, clock: Clock = SYSTEM_CLOCK): Promise<DecisionResult> {
    const input = validateDecision(body);
    const initial = await buildAuthenticatedContext(req, pool, { cookie });
    if (!initial) throw new ClaimRefusal(403, 'forbidden');
    const tenant = initial.tenantId.toLowerCase(), actor = initial.personId.toLowerCase();
    const digest = claimDigest({ v: 1, tenant, actor, ...input, elligbleId: input.elligbleId?.toLowerCase() ?? null });
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        await lock(c, claimRequestLockKey(tenant, input.requestKey));
        const pre = await readClaim(c, tenant, input.claimId);
        if (pre?.rosterId) await lock(c, claimRosterLockKey(tenant, pre.rosterId));
        await lock(c, `roster-tenant:${tenant}`);
        const ctx = await buildAuthenticatedContext(req, pool, { cookie, client: c, mutation: true });
        if (!ctx || ctx.tenantId.toLowerCase() !== tenant || ctx.personId.toLowerCase() !== actor) throw new ClaimRefusal(403, 'forbidden');
        // Roster rows are fenced by roster-tenant; this read is authoritative until COMMIT.
        const roster = pre?.rosterId ? await readRosterIdentity(c, tenant, pre.rosterId) : null;
        const actorKind = await verifierAuthority(c, tenant, ctx.membershipId, roster, clock.now(), true);
        if (!actorKind) throw new ClaimRefusal(403, 'forbidden');
        const earlier = await findDecisionReceipt(c, tenant, actor, input.requestKey);
        if (earlier) {
            if (earlier.requestDigest !== digest || earlier.claimId !== input.claimId) throw new ClaimRefusal(409, 'action_key_reused');
            await c.query('COMMIT');
            return { outcome: earlier.event, claimId: earlier.claimId, revision: earlier.revision, replayed: true };
        }
        if (!pre) throw new ClaimRefusal(404, 'not_found');
        const claim = await lockClaim(c, tenant, input.claimId);
        if (!claim || claim.rosterId !== pre.rosterId) throw stale();
        await observeClaim(c, claim, clock.now(), ACTIVATION_POLICY.MAX_FAILED_ATTEMPTS);
        if (!isOpenClaimState(claim.state)) throw new ObservedRefusal(new ClaimRefusal(409, 'claim_closed'));
        if (claim.revision !== input.expectedRevision) throw stale();
        const shared = { actorKind, actorPersonId: actor, requestKey: input.requestKey, requestDigest: digest, reason: input.reason } as const;
        if (input.decision !== 'APPROVE') {
            if (input.decision === 'REJECT' && claim.state === 'APPROVED_PENDING_ACTIVATION') throw new ClaimRefusal(409, 'review_required');
            if (claim.state === 'APPROVED_PENDING_ACTIVATION') await revokeClaimActivation(c, claim.id, clock.now());
            const outcome = input.decision === 'REJECT' ? 'REJECTED' : 'CANCELLED';
            const { revision } = await transitionClaim(c, claim, { ...shared, state: outcome, event: outcome });
            await c.query('COMMIT');
            return { outcome, claimId: claim.id, revision, replayed: false };
        }
        const result = await approve(c, req, pool, cookie, clock, claim, roster, input, tenant, actor, ctx.personId.toLowerCase(), shared);
        await c.query('COMMIT');
        return result;
    } catch (error) {
        if (error instanceof ObservedRefusal) {
            await c.query('COMMIT').catch(() => {});
            throw error.refusal;
        }
        await c.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        c.release();
    }
}

async function approve(
    c: PoolClient, req: IncomingMessage, pool: Pool, cookie: SessionCookieConfig, clock: Clock, claim: ClaimRow, roster: RosterIdentity | null,
    input: DecisionInput, tenant: string, actor: string, verifierPerson: string,
    shared: { actorKind: VerifierKind; actorPersonId: string; requestKey: string; requestDigest: string; reason: string },
): Promise<DecisionResult> {
    // Only an exact current match may be approved; anything else stays under review (C02).
    if (claim.state !== 'PENDING_REVIEW' || !roster) throw reviewRequired();
    if (roster.revision !== input.expectedRosterRevision) throw stale();
    if (!(await rosterStillMatches(c, roster, { nisn: claim.submittedNisn, birth: claim.submittedBirth, name: claim.submittedName }))) throw reviewRequired();
    const timeZone = (await findTenant(c, tenant))?.timeZone ?? null;
    if (!timeZone) throw new ClaimRefusal(409, 'school_time_zone_missing');

    let personId: string, newIdentity = false;
    if (input.adjudication === 'EXISTING_BINDING') {
        if (!roster.personId) throw reviewRequired();
        personId = roster.personId;
    } else if (input.adjudication === 'EXISTING_ACCOUNT_CONTINUITY') {
        if (roster.personId) throw reviewRequired();
        const account = await findAccountByElligbleId(c, input.elligbleId!);
        if (!account) throw reviewRequired();
        personId = account.personId.toLowerCase();
    } else {
        if (roster.personId) throw reviewRequired();
        personId = randomUUID();
        newIdentity = true;
    }
    // Self-target guard before the verifier could wait on its own membership key (§6A.7).
    if (personId === verifierPerson) throw reviewRequired();
    const username = newIdentity ? null : await readCanonicalUsername(c, personId);
    const keys = [`tenant_membership:${tenant}:${personId}`, ...(username ? [`identity_identifier:${username}`] : [])].sort();
    for (const key of keys) await lock(c, key);
    if (newIdentity) {
        await createReviewedPerson(c, personId);
        const authority: IdentityAuthority = {
            authorize: async (_client, scope) => scope.tenantId === tenant && scope.personId === personId ? { kind: 'authenticated_person', ref: actor } : null,
            audit: async () => {},
        };
        await allocateStudentIdentity(c, { tenantId: tenant, personId }, input.requestKey, authority);
    }
    await c.query('SELECT id FROM identity_persons WHERE id = $1 FOR NO KEY UPDATE', [personId]);
    // Eligibility, all again after the locks.
    if (personId === verifierPerson || await hasStaffRole(c, personId)) throw reviewRequired();
    if (!newIdentity) {
        let member: string | null;
        try { member = await findMembership(c, tenant, personId); } catch { throw reviewRequired(); }
        if (input.adjudication === 'EXISTING_ACCOUNT_CONTINUITY' && !member) throw reviewRequired();
        if ((await rosterRecordsBoundToPerson(c, tenant, personId)).some(id => id !== roster.id)) throw reviewRequired();
        if (await hasOtherOpenClaimForPerson(c, personId, claim.id)) throw reviewRequired();
    }
    const credential = await lockCanonicalCredential(c, personId);
    if (!credential || !credential.isValid) throw reviewRequired();
    const fresh = await isNeverActivated(c, credential.userAccountId);
    const { membershipId } = await ensureMembership(c, tenant, personId);
    if (!(await tryLock(c, claimEnrollmentSlot(roster, membershipId)))) throw stale();
    const enrollment = await claimEnrollmentState(c, roster, membershipId);
    if (!enrollment.compatible) throw reviewRequired();
    const locked = await readRosterIdentity(c, tenant, roster.id, true);
    if (!locked || locked.revision !== roster.revision || locked.personId !== roster.personId
        || locked.academicGroupId !== roster.academicGroupId || locked.academicPeriodId !== roster.academicPeriodId) throw stale();
    // Authoritative time and session immediately before any effect.
    if (!(await buildAuthenticatedContext(req, pool, { cookie, client: c, mutation: true }))) throw new ClaimRefusal(401, 'unauthorized');
    const now = clock.now();
    if (now.getTime() >= claim.expiresAt.getTime()) throw new ClaimRefusal(409, 'claim_closed');

    const state = fresh ? 'APPROVED_PENDING_ACTIVATION' : 'APPROVED_EXISTING_ACCOUNT';
    const { eventId, revision } = await transitionClaim(c, claim, {
        ...shared, state, event: fresh ? 'APPROVED' : 'APPROVED_EXISTING_ACCOUNT', adjudication: input.adjudication, personId, rosterRevision: roster.revision,
    });
    if (!roster.personId) {
        await bindRosterIdentity(c, { tenantId: tenant, rosterId: roster.id, personId, claimId: claim.id, decidedByPersonId: actor, decisionEventId: eventId });
    }
    await ensureClaimEnrollment(c, roster, membershipId, schoolLocalDate(now, timeZone));
    if (!fresh) return { outcome: 'APPROVED_EXISTING_ACCOUNT', claimId: claim.id, revision, elligbleId: credential.username, replayed: false };
    const issued = await issueClaimActivation(c, claim, credential.userAccountId, now, ACTIVATION_POLICY.DEFAULT_VALIDITY_MS);
    return {
        outcome: 'APPROVED', claimId: claim.id, revision, elligbleId: credential.username, activationCode: issued.code,
        activationExpiresAt: issued.expiresAt.toISOString(), claimExpiresAt: claim.expiresAt.toISOString(), replayed: false,
    };
}

// ---------------------------------------------------------------------------------------
// Claim-bound activation (§6A.6): claim-roster -> roster-tenant -> claim -> credential -> activation.

const IMPOSSIBLE_ACTIVATION = '00000000-0000-4000-8000-000000000000';

export async function activateClaimBound(
    c: PoolClient, route: ClaimActivationRoute, username: string, code: string, newPassword: string, clock: Clock = SYSTEM_CLOCK,
): Promise<ActivationResult> {
    const identity = new IdentityRuntime(c as never, clock);
    // A refused password is answered before any claim lock, exactly like ordinary activation.
    const rejection = checkNewPassword(newPassword, { username: typeof username === 'string' ? username.trim() : '' });
    if (rejection) return { success: false, error: 'PASSWORD_REJECTED', reason: rejection };
    await c.query('BEGIN');
    try {
        const tenant = route.tenantId.toLowerCase();
        if (route.rosterId) await lock(c, claimRosterLockKey(tenant, route.rosterId));
        await lock(c, `roster-tenant:${tenant}`);
        const claim = await lockClaim(c, tenant, route.claimId);
        if (claim) await observeClaim(c, claim, clock.now(), ACTIVATION_POLICY.MAX_FAILED_ATTEMPTS);
        let guard = IMPOSSIBLE_ACTIVATION;
        if (claim?.state === 'APPROVED_PENDING_ACTIVATION' && claim.rosterId === route.rosterId && claim.rosterId && claim.personId) {
            const roster = await readRosterIdentity(c, tenant, claim.rosterId);
            let member: string | null = null;
            try { member = await findMembership(c, tenant, claim.personId); } catch { member = null; }
            const enrollment = roster && member ? await claimEnrollmentState(c, roster, member) : null;
            const activation = await readClaimActivation(c, claim.id);
            // Current roster, binding and scope must still be the approved ones.
            if (roster && roster.revision === claim.rosterRevision && roster.personId === claim.personId
                && enrollment?.enrolled && enrollment.compatible && activation) guard = activation.activationId;
        }
        // A refused route still runs the same credential-locked check with a guard that cannot match.
        const { result, effect } = await identity.activateInTransaction(username, code, newPassword,
            { activationId: guard, ...(claim ? { notAfter: claim.expiresAt } : {}) });
        // The wait for the credential lock may have crossed the claim's expiry: record it now.
        if (claim?.state === 'APPROVED_PENDING_ACTIVATION' && effect === 'none') {
            await observeClaim(c, claim, clock.now(), ACTIVATION_POLICY.MAX_FAILED_ATTEMPTS);
        }
        if (claim && guard !== IMPOSSIBLE_ACTIVATION && (effect === 'consumed' || effect === 'exhausted')) {
            const outcome = effect === 'consumed' ? 'ACTIVATED' : 'EXHAUSTED';
            await transitionClaim(c, claim, { actorKind: effect === 'consumed' ? 'student' : 'system', state: outcome, event: outcome });
        }
        await c.query('COMMIT');
        return result;
    } catch (error) {
        await c.query('ROLLBACK').catch(() => {});
        throw error;
    }
}

export function claimError(error: unknown): { status: number; code: string } {
    if (error instanceof ClaimRefusal) return { status: error.status, code: error.code };
    if (error instanceof AuthenticationError) return { status: error.statusCode, code: error.message };
    return { status: 503, code: 'persistence_unavailable' };
}
