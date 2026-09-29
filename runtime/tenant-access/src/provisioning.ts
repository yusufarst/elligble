import type { ClientBase } from 'pg';
import { randomUUID } from 'node:crypto';

// Tenant & Access provisioning for operator imports (D02.2-27/28, D02.7-01/20/21). Every
// function runs inside the caller's open transaction. Memberships and teacher assignments are
// ensured idempotently under a transaction-scoped advisory lock, because the schema does not
// forbid duplicates and duplicates would make membership resolution fail closed.

const MAX_LABEL_LENGTH = 200;

export function isValidTenantLabel(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_LABEL_LENGTH;
}

export async function createTenant(client: ClientBase, displayLabel: string): Promise<string> {
    if (!isValidTenantLabel(displayLabel)) throw new Error('Invalid school display label.');
    const id = randomUUID();
    await client.query('INSERT INTO tenant_tenants (id, display_label) VALUES ($1, $2)', [id, displayLabel.trim()]);
    return id;
}

export async function findTenant(client: ClientBase, tenantId: string): Promise<{ id: string; displayLabel: string | null } | null> {
    const res = await client.query('SELECT id, display_label FROM tenant_tenants WHERE id = $1', [tenantId]);
    return res.rowCount === 1 ? { id: res.rows[0].id, displayLabel: res.rows[0].display_label } : null;
}

async function lock(client: ClientBase, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
}

export async function findMembership(client: ClientBase, tenantId: string, personId: string): Promise<string | null> {
    const res = await client.query('SELECT id FROM tenant_memberships WHERE tenant_id = $1 AND person_id = $2', [tenantId, personId]);
    if (res.rowCount && res.rowCount > 1) throw new Error('Ambiguous membership: more than one for the same person and school.');
    return res.rowCount === 1 ? res.rows[0].id : null;
}

export async function ensureMembership(client: ClientBase, tenantId: string, personId: string): Promise<{ membershipId: string; created: boolean }> {
    await lock(client, `tenant_membership:${tenantId}:${personId}`);
    const existing = await findMembership(client, tenantId, personId);
    if (existing) return { membershipId: existing, created: false };
    const res = await client.query(
        'INSERT INTO tenant_memberships (id, tenant_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id',
        [tenantId, personId]
    );
    return { membershipId: res.rows[0].id, created: true };
}

export async function ensureTeacherAssignment(
    client: ClientBase,
    tenantId: string,
    membershipId: string
): Promise<{ teacherAssignmentId: string; created: boolean }> {
    await lock(client, `tenant_teacher_assignment:${tenantId}:${membershipId}`);
    const existing = await client.query(
        'SELECT id FROM tenant_teacher_assignments WHERE tenant_id = $1 AND membership_id = $2 AND revoked_at IS NULL',
        [tenantId, membershipId]
    );
    if (existing.rowCount === 1) return { teacherAssignmentId: existing.rows[0].id, created: false };
    const res = await client.query(
        'INSERT INTO tenant_teacher_assignments (tenant_id, membership_id) VALUES ($1, $2) RETURNING id',
        [tenantId, membershipId]
    );
    return { teacherAssignmentId: res.rows[0].id, created: true };
}

export async function findActiveTeacherAssignment(client: ClientBase, tenantId: string, personId: string): Promise<string | null> {
    const res = await client.query(
        `SELECT tta.id FROM tenant_teacher_assignments tta
         JOIN tenant_memberships m ON m.id = tta.membership_id AND m.tenant_id = tta.tenant_id
         WHERE tta.tenant_id = $1 AND m.person_id = $2 AND tta.revoked_at IS NULL`,
        [tenantId, personId]
    );
    return res.rowCount === 1 ? res.rows[0].id : null;
}
