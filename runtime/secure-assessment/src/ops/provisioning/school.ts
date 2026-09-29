import type pg from 'pg';
import { createTenant, isValidTenantLabel } from '../../../../tenant-access/src/provisioning.ts';
import { recordProvisioningEvent, type OperatorContext } from './audit.ts';

// School (tenant) creation by platform staff for the pilot (D02.2-27/28): audited and
// case-linked. A second school with the same label needs explicit confirmation.

export async function createSchool(
    pool: pg.Pool,
    input: { label: string; context: OperatorContext; allowDuplicateLabel: boolean }
): Promise<{ ok: true; tenantId: string } | { ok: false; problem: string }> {
    if (!isValidTenantLabel(input.label)) return { ok: false, problem: 'the school label must be 1 to 200 characters' };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tenant_label:${input.label.trim()}`]);
        const existing = await client.query('SELECT count(*)::int AS n FROM tenant_tenants WHERE display_label = $1', [input.label.trim()]);
        if (existing.rows[0].n > 0 && !input.allowDuplicateLabel) {
            await client.query('ROLLBACK');
            return { ok: false, problem: 'a school with this label already exists; re-run with --allow-duplicate-label if this is a different school' };
        }
        const tenantId = await createTenant(client, input.label);
        await recordProvisioningEvent(client, { tenantId, action: 'tenant_created', context: input.context, inputSha256: null, summary: { tenantId } });
        await client.query('COMMIT');
        return { ok: true, tenantId };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}
