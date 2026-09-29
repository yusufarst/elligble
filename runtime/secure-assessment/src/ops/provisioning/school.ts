import type pg from 'pg';
import { createTenant, isValidTenantLabel, isValidTimeZone, setTenantTimeZone } from '../../../../tenant-access/src/provisioning.ts';
import { recordProvisioningEvent, type OperatorContext } from './audit.ts';

// School (tenant) creation by platform staff for the pilot (D02.2-27/28): audited and
// case-linked. A second school with the same label needs explicit confirmation. Every
// school has an explicit time zone for showing exam times (D04.2-36).

export const TIME_ZONE_PROBLEM = 'the time zone must be an IANA name such as Asia/Jakarta (WIB), Asia/Makassar (WITA) or Asia/Jayapura (WIT)';

export async function createSchool(
    pool: pg.Pool,
    input: { label: string; timeZone: string; context: OperatorContext; allowDuplicateLabel: boolean }
): Promise<{ ok: true; tenantId: string } | { ok: false; problem: string }> {
    if (!isValidTenantLabel(input.label)) return { ok: false, problem: 'the school label must be 1 to 200 characters' };
    if (!isValidTimeZone(input.timeZone)) return { ok: false, problem: TIME_ZONE_PROBLEM };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tenant_label:${input.label.trim()}`]);
        const existing = await client.query('SELECT count(*)::int AS n FROM tenant_tenants WHERE display_label = $1', [input.label.trim()]);
        if (existing.rows[0].n > 0 && !input.allowDuplicateLabel) {
            await client.query('ROLLBACK');
            return { ok: false, problem: 'a school with this label already exists; re-run with --allow-duplicate-label if this is a different school' };
        }
        const tenantId = await createTenant(client, input.label, input.timeZone);
        await recordProvisioningEvent(client, { tenantId, action: 'tenant_created', context: input.context, inputSha256: null, summary: { tenantId, timeZone: input.timeZone } });
        await client.query('COMMIT');
        return { ok: true, tenantId };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

/** Sets or corrects the school's time zone; exam times already stored stay the same instants. */
export async function setSchoolTimeZone(
    pool: pg.Pool,
    input: { tenantId: string; timeZone: string; context: OperatorContext }
): Promise<{ ok: true; previous: string | null } | { ok: false; problem: string }> {
    if (!isValidTimeZone(input.timeZone)) return { ok: false, problem: TIME_ZONE_PROBLEM };
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const current = await client.query('SELECT time_zone FROM tenant_tenants WHERE id = $1 FOR UPDATE', [input.tenantId]);
        if (current.rowCount !== 1) {
            await client.query('ROLLBACK');
            return { ok: false, problem: 'school (tenant) not found' };
        }
        await setTenantTimeZone(client, input.tenantId, input.timeZone);
        await recordProvisioningEvent(client, {
            tenantId: input.tenantId, action: 'tenant_time_zone_set', context: input.context, inputSha256: null,
            summary: { timeZone: input.timeZone, previous: current.rows[0].time_zone ?? 'none' },
        });
        await client.query('COMMIT');
        return { ok: true, previous: current.rows[0].time_zone ?? null };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}
