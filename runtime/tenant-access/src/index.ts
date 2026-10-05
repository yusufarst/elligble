import type { Client } from 'pg';
import type { IdentityRuntime, SessionData } from '../../identity-access/src/index.ts';

export interface MembershipContext {
  tenantId: string;
  membershipId: string;
  personId: string;
}

export interface PersonMembershipSummary {
  tenantId: string;
  membershipId: string;
  tenantDisplayLabel: string | null;
}

export class TenantAccessRuntime {
  #pg: Client;
  #identityRuntime: IdentityRuntime;

  constructor(pg: Client, identityRuntime: IdentityRuntime) {
    this.#pg = pg;
    this.#identityRuntime = identityRuntime;
  }

  /**
   * Resolves an authenticated Organization/Tenant Membership Context.
   * Treats requestedTenantId as an UNTRUSTED locator.
   * Derives person_id ONLY from a successfully resolved Identity session.
   * Fails closed if multiple ambiguous memberships match.
   */
  async resolveAuthenticatedMembershipContext(
    sessionId: string,
    sessionSecretAttempt: string,
    requestedTenantId: string
  ): Promise<MembershipContext | null> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!sessionId || typeof sessionId !== 'string' || 
        !sessionSecretAttempt || typeof sessionSecretAttempt !== 'string' ||
        !requestedTenantId || typeof requestedTenantId !== 'string') {
      return null;
    }

    if (!UUID_REGEX.test(sessionId) || !UUID_REGEX.test(requestedTenantId)) {
      return null;
    }

    // 1. Resolve authentication through the real BU-088 IdentityRuntime contract
    const session = await this.#identityRuntime.resolveSession(sessionId, sessionSecretAttempt);
    if (!session) {
      return null; // Deny: invalid/revoked/expired/idle-expired session
    }

    // 2. Query Organization/Tenant-owned tenant_memberships
    // using tenant_id = requested tenant AND person_id = authenticated session Person
    // Join tenant_tenants to implicitly ensure the tenant actually exists, though FK implies it if membership exists.
    const res = await this.#pg.query(`
      SELECT m.id, m.tenant_id, m.person_id
      FROM tenant_memberships m
      JOIN tenant_tenants t ON t.id = m.tenant_id
      WHERE m.tenant_id = $1 AND m.person_id = $2
    `, [requestedTenantId, session.personId]);

    // 3. Fail closed if no membership or unknown tenant
    if (res.rowCount === 0) {
      return null;
    }

    // 4. Fail closed if ambiguous (multiple identical memberships)
    if (res.rowCount !== null && res.rowCount > 1) {
      return null;
    }

    const membership = res.rows[0];

    // 5. Return only bounded authenticated Membership Context
    return {
      tenantId: membership.tenant_id,
      membershipId: membership.id,
      personId: membership.person_id
    };
  }

  /**
   * Lists the tenants in which an already-authenticated Person holds a Membership.
   * The caller must pass a personId obtained from a resolved Identity session, never
   * from client input. Used only to offer explicit tenant selection (D02.2-20).
   */
  async listMembershipsForPerson(personId: string): Promise<PersonMembershipSummary[]> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!personId || typeof personId !== 'string' || !UUID_REGEX.test(personId)) {
      return [];
    }
    const res = await this.#pg.query(`
      SELECT m.id, m.tenant_id, t.display_label
      FROM tenant_memberships m
      JOIN tenant_tenants t ON t.id = m.tenant_id
      WHERE m.person_id = $1
      ORDER BY t.display_label ASC NULLS LAST, m.tenant_id ASC
    `, [personId]);
    return res.rows.map(row => ({
      tenantId: row.tenant_id,
      membershipId: row.id,
      tenantDisplayLabel: row.display_label ?? null,
    }));
  }
}
