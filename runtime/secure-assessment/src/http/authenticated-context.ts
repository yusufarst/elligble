import * as http from 'node:http';
import * as pg from 'pg';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { TenantAccessRuntime, type MembershipContext } from '../../../tenant-access/src/index.ts';

export class AuthenticationError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

export async function buildAuthenticatedContext(
    req: http.IncomingMessage,
    pool: pg.Pool
): Promise<MembershipContext | null> {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('ELLIGBLE-Session ')) {
        // missing/malformed credential -> 401
        throw new AuthenticationError(401, 'unauthorized');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const token = authHeader.substring('ELLIGBLE-Session '.length).trim();
    const parts = token.split('.');
    if (parts.length !== 2 || !uuidRegex.test(parts[0])) {
        throw new AuthenticationError(401, 'unauthorized');
    }
    const [sessionId, sessionSecret] = parts;

    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId || typeof tenantId !== 'string' || !uuidRegex.test(tenantId)) {
        // missing/malformed tenant locator -> 403
        throw new AuthenticationError(403, 'forbidden');
    }

    let client: pg.PoolClient | null = null;
    try {
        client = await pool.connect();
    } catch (err) {
        throw new AuthenticationError(503, 'persistence_unavailable');
    }

    try {
        const identityRuntime = new IdentityRuntime(client as unknown as pg.Client);
        const tenantAccessRuntime = new TenantAccessRuntime(client as unknown as pg.Client, identityRuntime);
        
        const membership = await tenantAccessRuntime.resolveAuthenticatedMembershipContext(
            sessionId,
            sessionSecret,
            tenantId
        );

        if (!membership) {
            // unknown/wrong-secret/expired/revoked/idle-expired session -> 401
            // OR authenticated Person with no Membership / cross-tenant Membership failure -> 403
            // Since we can't easily distinguish from `resolveAuthenticatedMembershipContext` returning null, 
            // wait, the spec says:
            // "missing Authorization credential -> 401"
            // "malformed credential -> 401"
            // "unknown/wrong-secret/expired/revoked/idle-expired session -> 401"
            // "missing/malformed tenant locator -> 403"
            // "authenticated Person with no Membership / cross-tenant Membership failure -> 403"

            // To distinguish, we need to call identityRuntime.resolveSession first?
            // Yes! If we call identityRuntime.resolveSession, we can know if the session is valid (401 vs 403).
            // Actually, we can just do what resolveAuthenticatedMembershipContext does, but if we do it inside, we duplicate.
            // Let's call identityRuntime.resolveSession ourselves to return 401 vs 403!
            const session = await identityRuntime.resolveSession(sessionId, sessionSecret);
            if (!session) {
                throw new AuthenticationError(401, 'unauthorized');
            }

            // If session is valid but membership returns null, it's a membership error -> 403
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
