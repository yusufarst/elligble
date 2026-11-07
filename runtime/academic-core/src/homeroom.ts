import type { ClientBase } from 'pg';
import { findMembership } from '../../tenant-access/src/provisioning.ts';

// AUTH-002 Academic-owned explicit Homeroom responsibility (record §5, 00.07, D03.4-21..24).
// A responsibility binds one Tenant-owned membership to one own-tenant group, year and period
// for an explicit time window; a Teacher label or teaching assignment is never Homeroom
// authority. Ending or revoking a responsibility never changes any Student enrollment.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isHomeroomUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export interface HomeroomScope { academicGroupId: string; academicPeriodId: string }

export interface ActiveHomeroom extends HomeroomScope { id: string; academicYearId: string }

/**
 * Responsibilities of a membership effective at `now` (revoked_at null and inside the window).
 * `lock` takes them FOR SHARE so a concurrent revocation waits for the caller's commit.
 */
export async function activeHomeroomResponsibilities(client: Pick<ClientBase, 'query'>, tenantId: string, membershipId: string, now: Date, lock = false): Promise<ActiveHomeroom[]> {
    if (!isHomeroomUuid(tenantId) || !isHomeroomUuid(membershipId)) return [];
    const r = await client.query(`SELECT id, academic_year_id, academic_period_id, academic_group_id, effective_from, effective_until
        FROM academic_core_homeroom_responsibilities WHERE tenant_id = $1 AND membership_id = $2 AND revoked_at IS NULL ORDER BY id ${lock ? 'FOR SHARE' : ''}`,
        [tenantId.toLowerCase(), membershipId.toLowerCase()]);
    const at = now.getTime();
    return r.rows.filter(x => new Date(x.effective_from).getTime() <= at && (x.effective_until === null || at < new Date(x.effective_until).getTime()))
        .map(x => ({ id: x.id, academicYearId: x.academic_year_id, academicPeriodId: x.academic_period_id, academicGroupId: x.academic_group_id }));
}

/** Own-current-rombel authority: an effective responsibility for exactly this group and period. */
export function homeroomCovers(responsibilities: readonly ActiveHomeroom[], scope: HomeroomScope): boolean {
    return responsibilities.some(h => h.academicGroupId === scope.academicGroupId.toLowerCase() && h.academicPeriodId === scope.academicPeriodId.toLowerCase());
}

export interface HomeroomChange {
    tenantId: string; personId: string; action: 'ASSIGN' | 'REVOKE';
    academicGroupId: string; academicPeriodId: string; effectiveUntil?: string | null;
    operator: string; caseReference: string; reason: string;
}

const bounded = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 200;

export function validateHomeroomChange(input: HomeroomChange): void {
    if (![input.tenantId, input.personId, input.academicGroupId, input.academicPeriodId].every(isHomeroomUuid)
        || !['ASSIGN', 'REVOKE'].includes(input.action)
        || ![input.operator, input.caseReference, input.reason].every(bounded)
        || (input.effectiveUntil != null && (typeof input.effectiveUntil !== 'string' || Number.isNaN(Date.parse(input.effectiveUntil))))) {
        throw new Error('Invalid Homeroom responsibility');
    }
}

/**
 * Existing-authority privileged provisioning (named operator, case and reason); the caller
 * owns BEGIN/COMMIT. Lock order matches setSchoolOperator: tenant_membership, then the
 * responsibility key, then rows. No self-grant, no UI, no change to enrollment.
 */
export async function setHomeroomResponsibility(client: ClientBase, input: HomeroomChange): Promise<{ responsibilityId: string; changed: boolean }> {
    validateHomeroomChange(input);
    const tenant = input.tenantId.toLowerCase(), person = input.personId.toLowerCase();
    const group = input.academicGroupId.toLowerCase(), period = input.academicPeriodId.toLowerCase();
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tenant_membership:${tenant}:${person}`]);
    const membership = await findMembership(client, tenant, person);
    if (!membership) throw new Error('Homeroom membership required');
    await client.query('SELECT id FROM tenant_memberships WHERE id=$1 AND tenant_id=$2 FOR SHARE', [membership, tenant]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`homeroom:${tenant}:${membership}`]);
    const scope = await client.query(`SELECT g.academic_year_id FROM academic_core_academic_groups g
        JOIN academic_core_academic_periods p ON p.tenant_id = g.tenant_id AND p.academic_year_id = g.academic_year_id
        WHERE g.id = $1 AND p.id = $2 AND g.tenant_id = $3 FOR SHARE OF g, p`, [group, period, tenant]);
    if (scope.rows.length !== 1) throw new Error('Homeroom group and period must belong to the same school year');
    const existing = await client.query(`SELECT id, academic_group_id FROM academic_core_homeroom_responsibilities
        WHERE tenant_id = $1 AND membership_id = $2 AND academic_period_id = $3 AND revoked_at IS NULL FOR UPDATE`, [tenant, membership, period]);
    let id: string;
    if (input.action === 'ASSIGN') {
        if (existing.rows.length) {
            if (existing.rows[0].academic_group_id !== group) throw new Error('Another active Homeroom responsibility exists for this period');
            return { responsibilityId: existing.rows[0].id, changed: false };
        }
        const until = input.effectiveUntil ? new Date(input.effectiveUntil) : null;
        id = (await client.query(`INSERT INTO academic_core_homeroom_responsibilities(tenant_id, membership_id, academic_year_id, academic_period_id,
                academic_group_id, effective_from, effective_until) VALUES($1,$2,$3,$4,$5,statement_timestamp(),$6) RETURNING id`,
            [tenant, membership, scope.rows[0].academic_year_id, period, group, until])).rows[0].id;
    } else {
        if (!existing.rows.length || existing.rows[0].academic_group_id !== group) throw new Error('Active Homeroom responsibility required');
        id = (await client.query(`UPDATE academic_core_homeroom_responsibilities SET revoked_at = GREATEST(clock_timestamp(), effective_from)
            WHERE id = $1 RETURNING id`, [existing.rows[0].id])).rows[0].id;
    }
    await client.query(`INSERT INTO academic_core_homeroom_responsibility_events(tenant_id, responsibility_id, action, operator_label, case_reference, reason)
        VALUES($1,$2,$3,$4,$5,$6)`, [tenant, id, input.action, input.operator.trim(), input.caseReference.trim(), input.reason.trim()]);
    return { responsibilityId: id, changed: true };
}
