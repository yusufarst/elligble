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

/**
 * The school's time zone (D04.2-36): an IANA name the runtime knows, such as Asia/Jakarta
 * (WIB), Asia/Makassar (WITA) or Asia/Jayapura (WIT).
 */
export function isValidTimeZone(value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
    if (!/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(value)) return false;
    try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

export async function createTenant(client: ClientBase, displayLabel: string, timeZone: string): Promise<string> {
    if (!isValidTenantLabel(displayLabel)) throw new Error('Invalid school display label.');
    if (!isValidTimeZone(timeZone)) throw new Error('Invalid school time zone.');
    const id = randomUUID();
    await client.query('INSERT INTO tenant_tenants (id, display_label, time_zone) VALUES ($1, $2, $3)', [id, displayLabel.trim(), timeZone]);
    return id;
}

export interface TenantSummary {
    id: string;
    displayLabel: string | null;
    /** Null for schools created before their zone was recorded (migration 0043). */
    timeZone: string | null;
}

export async function findTenant(client: ClientBase, tenantId: string): Promise<TenantSummary | null> {
    const res = await client.query('SELECT id, display_label, time_zone FROM tenant_tenants WHERE id = $1', [tenantId]);
    return res.rowCount === 1 ? { id: res.rows[0].id, displayLabel: res.rows[0].display_label, timeZone: res.rows[0].time_zone } : null;
}

/** Sets the school's time zone; false when the school does not exist. */
export async function setTenantTimeZone(client: ClientBase, tenantId: string, timeZone: string): Promise<boolean> {
    if (!isValidTimeZone(timeZone)) throw new Error('Invalid school time zone.');
    const res = await client.query('UPDATE tenant_tenants SET time_zone = $2 WHERE id = $1', [tenantId, timeZone]);
    return res.rowCount === 1;
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
