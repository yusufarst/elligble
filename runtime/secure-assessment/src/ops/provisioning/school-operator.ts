import type { Pool } from 'pg';
import { findAccountByElligbleId } from '../../../../identity-access/src/provisioning.ts';
import { setSchoolOperator } from '../../../../tenant-access/src/school-operator.ts';
import type { OperatorContext } from './audit.ts';

/** The same trusted CLI/database access boundary as existing school/people provisioning. */
export async function provisionSchoolOperator(pool: Pool, input: {tenantId:string; elligbleId:string; action:'ASSIGN'|'REVOKE'; context:OperatorContext; reason:string}) {
    const c = await pool.connect();
    try {
        await c.query('BEGIN');
        const account = await findAccountByElligbleId(c,input.elligbleId);
        if (!account) throw new Error('Operator account not found');
        const result = await setSchoolOperator(c,{tenantId:input.tenantId,personId:account.personId,action:input.action,...input.context,reason:input.reason});
        await c.query('COMMIT'); return result;
    } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
