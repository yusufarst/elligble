import type { Pool } from 'pg';
import { findAccountByElligbleId } from '../../../../identity-access/src/provisioning.ts';
import { setHomeroomResponsibility } from '../../../../academic-core/src/homeroom.ts';
import type { OperatorContext } from './audit.ts';

/**
 * AUTH-002 audited Homeroom bootstrap: the same trusted CLI/database boundary as the School
 * Operator command. The Academic owning API records the named operator, case and reason.
 */
export async function provisionHomeroom(pool: Pool, input: {
    tenantId: string; elligbleId: string; action: 'ASSIGN' | 'REVOKE'; academicGroupId: string; academicPeriodId: string;
    effectiveUntil: string | null; context: OperatorContext; reason: string;
}) {
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        const account = await findAccountByElligbleId(c, input.elligbleId);
        if (!account) throw new Error('Homeroom account not found');
        const result = await setHomeroomResponsibility(c, {
            tenantId: input.tenantId, personId: account.personId, action: input.action,
            academicGroupId: input.academicGroupId, academicPeriodId: input.academicPeriodId, effectiveUntil: input.effectiveUntil,
            operator: input.context.operator, caseReference: input.context.caseReference, reason: input.reason,
        });
        await c.query('COMMIT');
        return result;
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
