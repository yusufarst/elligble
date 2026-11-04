import type { ClientBase } from 'pg';
import { findMembership } from './provisioning.ts';

export const operatorUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Membership and actor must originate in the authenticated owning context, never a request body. */
export async function schoolOperatorAssignment(client: Pick<ClientBase, 'query'>, tenantId: string, membershipId: string, lock = false): Promise<string | null> {
    if (!operatorUuid(tenantId) || !operatorUuid(membershipId)) return null;
    const r = await client.query(`SELECT id FROM tenant_school_operator_assignments
        WHERE tenant_id=$1 AND membership_id=$2 AND revoked_at IS NULL ${lock ? 'FOR SHARE' : ''}`, [tenantId,membershipId]);
    return r.rows.length === 1 ? r.rows[0].id as string : null;
}

/** Existing privileged platform provisioning caller owns BEGIN/COMMIT and database authority. */
export async function setSchoolOperator(client: ClientBase, input: {
    tenantId: string; personId: string; action: 'ASSIGN' | 'REVOKE'; operator: string; caseReference: string; reason: string;
}): Promise<{ assignmentId: string; changed: boolean }> {
    if (!operatorUuid(input.tenantId) || !operatorUuid(input.personId) || !['ASSIGN','REVOKE'].includes(input.action)
        || ![input.operator,input.caseReference,input.reason].every(v => typeof v === 'string' && v.trim().length>0 && v.trim().length<=200)) throw new Error('Invalid operator assignment');
    const tenant = input.tenantId.toLowerCase(), person = input.personId.toLowerCase();
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tenant_membership:${tenant}:${person}`]);
    const membership = await findMembership(client,tenant,person);
    if (!membership) throw new Error('Operator membership required');
    await client.query('SELECT id FROM tenant_memberships WHERE id=$1 AND tenant_id=$2 FOR SHARE',[membership,tenant]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`school_operator:${tenant}:${membership}`]);
    const existing = await client.query(`SELECT id FROM tenant_school_operator_assignments WHERE tenant_id=$1 AND membership_id=$2 AND revoked_at IS NULL FOR UPDATE`,[tenant,membership]);
    if (existing.rows.length>1) throw new Error('Ambiguous operator assignment');
    if (input.action==='REVOKE' && !existing.rows.length) throw new Error('Active assignment required');
    if (input.action==='ASSIGN' && existing.rows.length) return {assignmentId:existing.rows[0].id,changed:false};
    const row = input.action==='ASSIGN'
        ? await client.query('INSERT INTO tenant_school_operator_assignments(tenant_id,membership_id) VALUES($1,$2) RETURNING id',[tenant,membership])
        : await client.query('UPDATE tenant_school_operator_assignments SET revoked_at=clock_timestamp() WHERE id=$1 RETURNING id',[existing.rows[0].id]);
    const id: string = row.rows[0].id;
    await client.query(`INSERT INTO tenant_school_operator_events(tenant_id,assignment_id,operator_label,case_reference,reason,action) VALUES($1,$2,$3,$4,$5,$6)`,[tenant,id,input.operator.trim(),input.caseReference.trim(),input.reason.trim(),input.action]);
    return { assignmentId:id, changed:true };
}
