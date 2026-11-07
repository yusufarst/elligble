import type { Pool } from 'pg';
import { findAccountByElligbleId, revokeAccountSessionsInTransaction } from '../../../../identity-access/src/provisioning.ts';
import { findMembership } from '../../../../tenant-access/src/provisioning.ts';
import { recordProvisioningEvent, type OperatorContext } from './audit.ts';

// SEC-OPS-001 audited session intervention (record §6/§6A). The platform-operator CLI is the
// trusted boundary. One school and one Account per case: the target must be a member of the
// named school; its sessions are Account-wide, so every session ends and the other member
// schools are listed for the incident lead, who informs each principal. Revocation and audit
// are one transaction; the output never carries session ids, secrets or personal data.

export interface OtherSchool { tenantId: string; displayLabel: string | null }

export type SessionRevokeResult =
    | { ok: true; dryRun: false; revoked: number; otherSchools: OtherSchool[] }
    | { ok: true; dryRun: true; wouldRevoke: number; otherSchools: OtherSchool[] }
    | { ok: false; problem: string };

const NOT_IN_SCHOOL = 'no account with this ELLIGBLE ID in this school';

export async function revokeAccountSessions(pool: Pool, input: {
    tenantId: string; elligbleId: string; reason: string; context: OperatorContext; dryRun: boolean;
}): Promise<SessionRevokeResult> {
    const reason = input.reason.trim();
    if (!reason || reason.length > 200) throw new Error('Invalid reason');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const account = await findAccountByElligbleId(client, input.elligbleId.trim());
        let member: string | null = null;
        if (account) {
            try { member = await findMembership(client, input.tenantId, account.personId); } catch { member = null; }
        }
        if (!account || !member) {
            await client.query('ROLLBACK');
            return { ok: false, problem: NOT_IN_SCHOOL };
        }
        const others = (await client.query(`SELECT t.id, t.display_label FROM tenant_memberships m JOIN tenant_tenants t ON t.id = m.tenant_id
            WHERE m.person_id = $1 AND m.tenant_id <> $2 ORDER BY t.id`, [account.personId, input.tenantId])).rows
            .map(r => ({ tenantId: r.id as string, displayLabel: (r.display_label as string | null) ?? null }));
        if (input.dryRun) {
            const n = (await client.query('SELECT count(*)::int AS n FROM identity_sessions WHERE user_account_id = $1 AND is_revoked = FALSE', [account.userAccountId])).rows[0].n as number;
            await client.query('ROLLBACK');
            return { ok: true, dryRun: true, wouldRevoke: n, otherSchools: others };
        }
        await client.query('SELECT user_account_id FROM identity_account_credentials WHERE user_account_id = $1 FOR UPDATE', [account.userAccountId]);
        const revoked = await revokeAccountSessionsInTransaction(client, account.userAccountId);
        await recordProvisioningEvent(client, {
            tenantId: input.tenantId, action: 'sessions_revoked', context: input.context, inputSha256: null, reason,
            summary: { sessions: revoked, userAccountId: account.userAccountId, otherSchoolMemberships: others.length },
        });
        await client.query('COMMIT');
        return { ok: true, dryRun: false, revoked, otherSchools: others };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}
