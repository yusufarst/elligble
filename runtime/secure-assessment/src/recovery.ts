import type { IncomingMessage } from 'node:http';
import type { Pool, PoolClient } from 'pg';
import { checkNewPassword, IdentityRuntime, type Clock, type RecoveryResult } from '../../identity-access/src/index.ts';
import { findAccountByElligbleId } from '../../identity-access/src/provisioning.ts';
import { isNeverActivated, lockCanonicalCredential, readCanonicalUsername } from '../../identity-access/src/claims.ts';
import { findRecoveryReceipt, issueRecoveryCode, recoveryDigest, recoveryRequestLockKey, resolveRecoveryRoute } from '../../identity-access/src/recovery.ts';
import { findMembership } from '../../tenant-access/src/provisioning.ts';
import { schoolOperatorAssignment } from '../../tenant-access/src/school-operator.ts';
import { activeHomeroomResponsibilities, homeroomCovers } from '../../academic-core/src/homeroom.ts';
import { readRosterIdentity, readRosterVerification, rosterRecordsBoundToPerson, type RosterIdentity } from '../../academic-core/src/student-identity.ts';
import { buildAuthenticatedContext } from './http/authenticated-context.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import { normalizePermissionReason } from './permission-action-audit.ts';
import { ClaimRefusal, hasStaffRole, verifierAuthority } from './claims.ts';

// AUTH-003 in-person school-assisted recovery coordinator (record §6/§6A). Owner R1–R4: scoped
// verifier, Student Accounts bound to the school roster only, fifteen-minute single-use code
// handed over in person, completion replaces the password and revokes every session and open
// code. One caller-owned READ COMMITTED transaction per request; no lock is taken out of order.

const SYSTEM_CLOCK: Clock = { now: () => new Date() };
const lock = (c: PoolClient, key: string) => c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
const tryLock = async (c: PoolClient, key: string) =>
    (await c.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS held', [key])).rows[0]?.held === true;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notInScope = () => new ClaimRefusal(404, 'not_found_in_scope');

export interface AuthorizeInput {
    elligbleId: string; confirmed: boolean;
    expectedRosterRevision: number | null; reason: string | null; requestKey: string | null;
}

export function validateAuthorize(body: Record<string, unknown>): AuthorizeInput {
    const confirmed = body.confirmed;
    const required = confirmed === true ? ['elligbleId', 'confirmed', 'expectedRosterRevision', 'reason', 'requestKey', 'inPersonVerified'] : ['elligbleId', 'confirmed'];
    if (Object.keys(body).some(k => !required.includes(k)) || required.some(k => !(k in body))) throw new ClaimRefusal(400, 'invalid_request');
    const id = body.elligbleId;
    if (typeof id !== 'string' || !id.trim() || id.length > 255 || (confirmed !== true && confirmed !== false)) throw new ClaimRefusal(400, 'invalid_request');
    if (confirmed === false) return { elligbleId: id.trim(), confirmed: false, expectedRosterRevision: null, reason: null, requestKey: null };
    const revision = body.expectedRosterRevision, reason = normalizePermissionReason(body.reason), key = body.requestKey;
    if (!(typeof revision === 'number' && Number.isInteger(revision) && revision > 0 && revision < 2 ** 31) || !reason
        || typeof key !== 'string' || !UUID.test(key) || body.inPersonVerified !== true) throw new ClaimRefusal(400, 'invalid_request');
    return { elligbleId: id.trim(), confirmed: true, expectedRosterRevision: revision, reason, requestKey: key.toLowerCase() };
}

interface Target { userAccountId: string; personId: string; username: string; roster: RosterIdentity }

/** Resolves an eligible Student target inside the verifier's scope, or the one bounded refusal. */
async function resolveTarget(c: PoolClient, tenant: string, membershipId: string, verifierPerson: string, elligbleId: string, now: Date, lockRows: boolean): Promise<{ target: Target; kind: 'school_operator' | 'homeroom' }> {
    const account = await findAccountByElligbleId(c, elligbleId);
    if (!account) throw notInScope();
    const personId = account.personId.toLowerCase();
    if (personId === verifierPerson) throw notInScope();
    const bound = await rosterRecordsBoundToPerson(c, tenant, personId);
    if (bound.length !== 1) throw notInScope();
    const roster = await readRosterIdentity(c, tenant, bound[0]);
    if (!roster || roster.personId !== personId) throw notInScope();
    const kind = await verifierAuthority(c, tenant, membershipId, roster, now, lockRows);
    if (!kind) throw notInScope();
    const username = await readCanonicalUsername(c, personId);
    if (!username) throw notInScope();
    return { target: { userAccountId: account.userAccountId.toLowerCase(), personId, username, roster }, kind };
}

async function ineligible(c: PoolClient, tenant: string, target: Target): Promise<boolean> {
    let member: string | null = null;
    try { member = await findMembership(c, tenant, target.personId); } catch { return true; }
    return !member || await hasStaffRole(c, target.personId);
}

export type AuthorizeResult =
    | { phase: 'preview'; elligbleId: string; roster: { fullName: string; nisn: string; birthDate: string; groupLabel: string | null; revision: number } }
    | { phase: 'issued'; elligbleId: string; recoveryCode: string; expiresAt: string; replayed: false }
    | { phase: 'issued'; elligbleId: string; expiresAt: string; replayed: true };

export async function authorizeRecovery(pool: Pool, req: IncomingMessage, cookie: SessionCookieConfig, body: Record<string, unknown>, clock: Clock = SYSTEM_CLOCK): Promise<AuthorizeResult> {
    const input = validateAuthorize(body);
    const initial = await buildAuthenticatedContext(req, pool, { cookie });
    if (!initial) throw new ClaimRefusal(403, 'forbidden');
    const tenant = initial.tenantId.toLowerCase(), actor = initial.personId.toLowerCase();
    const c = await pool.connect();
    try {
        if (!input.confirmed) {
            // Read-only comparison step: no business mutation.
            await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
            const { target } = await resolveTarget(c, tenant, initial.membershipId, actor, input.elligbleId, clock.now(), false);
            const credential = await c.query('SELECT is_valid FROM identity_account_credentials WHERE user_account_id = $1', [target.userAccountId]);
            if (credential.rows[0]?.is_valid !== true || await isNeverActivated(c, target.userAccountId) || await ineligible(c, tenant, target)) throw notInScope();
            const roster = await readRosterVerification(c, tenant, target.roster.id);
            if (!roster) throw notInScope();
            await c.query('COMMIT');
            return { phase: 'preview', elligbleId: target.username, roster };
        }
        await c.query('BEGIN');
        await lock(c, recoveryRequestLockKey(tenant, input.requestKey!));
        await lock(c, `roster-tenant:${tenant}`);
        const ctx = await buildAuthenticatedContext(req, pool, { cookie, client: c, mutation: true });
        if (!ctx || ctx.tenantId.toLowerCase() !== tenant || ctx.personId.toLowerCase() !== actor) throw new ClaimRefusal(403, 'forbidden');
        const digest = recoveryDigest({ v: 1, tenant, actor, elligbleId: input.elligbleId.toLowerCase(), revision: input.expectedRosterRevision, reason: input.reason });
        // Authority (FOR SHARE) is evaluated before any replay disclosure.
        const { target, kind } = await resolveTarget(c, tenant, ctx.membershipId, actor, input.elligbleId, clock.now(), true);
        const earlier = await findRecoveryReceipt(c, tenant, actor, input.requestKey!);
        if (earlier) {
            if (earlier.requestDigest !== digest || earlier.userAccountId !== target.userAccountId) throw new ClaimRefusal(409, 'action_key_reused');
            await c.query('COMMIT');
            return { phase: 'issued', elligbleId: target.username, expiresAt: earlier.expiresAt.toISOString(), replayed: true };
        }
        for (const key of [`identity_identifier:${target.username}`, `tenant_membership:${tenant}:${target.personId}`].sort()) await lock(c, key);
        await c.query('SELECT id FROM identity_persons WHERE id = $1 FOR NO KEY UPDATE', [target.personId]);
        // Everything again after the locks.
        const again = await resolveTarget(c, tenant, ctx.membershipId, actor, input.elligbleId, clock.now(), true);
        if (again.target.personId !== target.personId || again.target.roster.id !== target.roster.id) throw new ClaimRefusal(409, 'stale_conflict');
        if (again.target.roster.revision !== input.expectedRosterRevision) throw new ClaimRefusal(409, 'stale_conflict');
        if (await ineligible(c, tenant, target)) throw notInScope();
        const credential = await lockCanonicalCredential(c, target.personId);
        if (!credential || !credential.isValid || credential.userAccountId !== target.userAccountId || await isNeverActivated(c, target.userAccountId)) throw notInScope();
        if (!(await buildAuthenticatedContext(req, pool, { cookie, client: c, mutation: true }))) throw new ClaimRefusal(401, 'unauthorized');
        const issued = await issueRecoveryCode(c, {
            tenantId: tenant, userAccountId: target.userAccountId, personId: target.personId, rosterId: target.roster.id,
            issuerPersonId: actor, issuerKind: again.kind, reason: input.reason!, requestKey: input.requestKey!, requestDigest: digest,
        }, clock.now());
        await c.query('COMMIT');
        void kind;
        return { phase: 'issued', elligbleId: target.username, recoveryCode: issued.code, expiresAt: issued.expiresAt.toISOString(), replayed: false };
    } catch (error) {
        await c.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        c.release();
    }
}

const IMPOSSIBLE_RECOVERY = '00000000-0000-4000-8000-000000000000';

/**
 * Public completion (§6A.2): roster-tenant (try) → issuer authority FOR SHARE → sorted
 * identifier/membership keys (try) → Person → credential → recovery → activation → sessions.
 * Any recheck failure refuses with the same answer and neither consumes nor counts.
 */
export async function completeRecovery(c: PoolClient, username: string, code: string, newPassword: string, clock: Clock = SYSTEM_CLOCK): Promise<RecoveryResult> {
    const identity = new IdentityRuntime(c as never, clock);
    const trimmed = typeof username === 'string' ? username.trim() : '';
    const rejection = checkNewPassword(newPassword, { username: trimmed });
    if (rejection) return { success: false, error: 'PASSWORD_REJECTED', reason: rejection };
    await c.query('BEGIN');
    try {
        const route = trimmed ? await resolveRecoveryRoute(c, trimmed) : null;
        let guard = IMPOSSIBLE_RECOVERY;
        if (route) {
            const tenant = route.tenantId.toLowerCase();
            if (!(await tryLock(c, `roster-tenant:${tenant}`))) throw new ClaimRefusal(429, 'busy');
            const roster = await readRosterIdentity(c, tenant, route.rosterId);
            const issuerMembership = await findMembership(c, tenant, route.issuerPersonId).catch(() => null);
            const authority = roster && issuerMembership ? await verifierAuthority(c, tenant, issuerMembership, roster, clock.now(), true) : null;
            const username = await readCanonicalUsername(c, route.personId);
            const keys = [`tenant_membership:${tenant}:${route.personId.toLowerCase()}`, ...(username ? [`identity_identifier:${username}`] : [])].sort();
            for (const key of keys) if (!(await tryLock(c, key))) throw new ClaimRefusal(429, 'busy');
            await c.query('SELECT id FROM identity_persons WHERE id = $1 FOR NO KEY UPDATE', [route.personId]);
            const bound = await rosterRecordsBoundToPerson(c, tenant, route.personId);
            const scopeHolds = !!authority && !!roster && roster.personId === route.personId.toLowerCase()
                && bound.length === 1 && bound[0] === route.rosterId;
            const member = await findMembership(c, tenant, route.personId).catch(() => null);
            if (scopeHolds && member && !(await hasStaffRole(c, route.personId))) guard = route.id;
        }
        // A refused route runs the same credential-locked check with a guard that cannot match.
        const result = await identity.completeRecoveryInTransaction(trimmed, code, newPassword, { recoveryId: guard });
        await c.query('COMMIT');
        return result;
    } catch (error) {
        await c.query('ROLLBACK').catch(() => {});
        throw error;
    }
}
