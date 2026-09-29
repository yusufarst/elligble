import * as http from 'node:http';
import * as pg from 'pg';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { TenantAccessRuntime, type MembershipContext } from '../../../tenant-access/src/index.ts';
import { readSessionCredential, type SessionCookieConfig } from './session-credentials.ts';

export class AuthenticationError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

export interface AuthenticatedContextOptions {
    /** When set, the HttpOnly session cookie is accepted in addition to the Authorization header. */
    cookie?: SessionCookieConfig | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the authenticated Membership Context for a tenant-scoped request.
 *
 * - missing / malformed / unknown / wrong-secret / expired / revoked / idle-expired credential -> 401
 * - missing / malformed tenant locator, or no Membership in the requested tenant -> 403
 * - persistence unavailable -> 503; unexpected failure -> bounded 500
 *
 * `X-Tenant-ID` is an untrusted locator: access comes only from a Membership held by the
 * Person of the resolved session (BU-089).
 */
export async function buildAuthenticatedContext(
    req: http.IncomingMessage,
    pool: pg.Pool,
    options: AuthenticatedContextOptions = {}
): Promise<MembershipContext | null> {
    const lookup = readSessionCredential(req, options.cookie ?? null);
    if (lookup.kind !== 'present') {
        throw new AuthenticationError(401, 'unauthorized');
    }
    const { sessionId, secret: sessionSecret } = lookup.credential;

    const tenantHeader = req.headers['x-tenant-id'];
    const tenantId = typeof tenantHeader === 'string' && UUID_REGEX.test(tenantHeader) ? tenantHeader : null;

    let client: pg.PoolClient | null = null;
    try {
        client = await pool.connect();
    } catch (err) {
        throw new AuthenticationError(503, 'persistence_unavailable');
    }

    try {
        const identityRuntime = new IdentityRuntime(client as unknown as pg.Client);
        const tenantAccessRuntime = new TenantAccessRuntime(client as unknown as pg.Client, identityRuntime);

        if (!tenantId) {
            // An invalid credential is 401 whatever the tenant locator says, so clients
            // re-authenticate instead of treating the request as forbidden.
            const session = await identityRuntime.resolveSession(sessionId, sessionSecret);
            throw session ? new AuthenticationError(403, 'forbidden') : new AuthenticationError(401, 'unauthorized');
        }

        const membership = await tenantAccessRuntime.resolveAuthenticatedMembershipContext(
            sessionId,
            sessionSecret,
            tenantId
        );

        if (!membership) {
            // Distinguish an invalid session (401) from a valid session without a
            // Membership in the requested tenant (403).
            const session = await identityRuntime.resolveSession(sessionId, sessionSecret);
            if (!session) {
                throw new AuthenticationError(401, 'unauthorized');
            }
            throw new AuthenticationError(403, 'forbidden');
        }

        return membership;
    } catch (err) {
        if (err instanceof AuthenticationError) {
            throw err;
        }
        throw new AuthenticationError(500, 'internal_error');
    } finally {
        if (client) {
            client.release();
        }
    }
}
