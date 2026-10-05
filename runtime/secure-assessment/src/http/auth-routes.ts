import type * as http from 'node:http';
import type * as pg from 'pg';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { TenantAccessRuntime, type PersonMembershipSummary } from '../../../tenant-access/src/index.ts';
import { HttpError, readJsonObject, sendError, sendJson } from './http-utils.ts';
import {
    buildClearedSessionCookie,
    buildSessionCookie,
    readSessionCredential,
    type SessionCookieConfig,
} from './session-credentials.ts';

// Identity-owned HTTP surface: login, logout and current-session introspection.
// Policy (DEC-041 / D02.5-59): 12h absolute + 60 min idle expiry, 5 failures per rolling
// 5 minutes, 15 minute lock after 10 consecutive failures; enforced by IdentityRuntime.

export interface AuthRouteDependencies {
    pool: pg.Pool;
    cookie: SessionCookieConfig;
}

const LOGIN_BODY_LIMIT_BYTES = 8 * 1024;
const MAX_USERNAME_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 1024;

interface MembershipProjection {
    tenantId: string;
    displayLabel: string | null;
}

function projectMemberships(memberships: PersonMembershipSummary[]): MembershipProjection[] {
    return memberships.map(m => ({ tenantId: m.tenantId, displayLabel: m.tenantDisplayLabel }));
}

export async function handleLogin(req: http.IncomingMessage, res: http.ServerResponse, deps: AuthRouteDependencies): Promise<void> {
    if (req.method !== 'POST') {
        sendError(res, 405, 'method_not_allowed');
        return;
    }

    let username: unknown;
    let password: unknown;
    try {
        const body = await readJsonObject(req, LOGIN_BODY_LIMIT_BYTES);
        username = body['username'];
        password = body['password'];
    } catch (err) {
        if (err instanceof HttpError) {
            sendError(res, err.statusCode, err.message);
            return;
        }
        sendError(res, 400, 'invalid_request');
        return;
    }

    if (
        typeof username !== 'string' || typeof password !== 'string' ||
        username.trim().length === 0 || username.length > MAX_USERNAME_LENGTH ||
        password.length === 0 || password.length > MAX_PASSWORD_LENGTH
    ) {
        sendError(res, 400, 'invalid_request');
        return;
    }

    let client: pg.PoolClient;
    try {
        client = await deps.pool.connect();
    } catch {
        sendError(res, 503, 'persistence_unavailable');
        return;
    }

    try {
        const identity = new IdentityRuntime(client as unknown as pg.Client);
        const result = await identity.authenticate(username.trim(), password);

        if (!result.success) {
            if (result.error === 'RATE_LIMITED' || result.error === 'LOCKED') {
                sendError(res, 429, 'too_many_attempts');
            } else {
                // Unknown account, wrong password and revoked credentials are indistinguishable.
                sendError(res, 401, 'invalid_credentials');
            }
            return;
        }

        const tenantAccess = new TenantAccessRuntime(client as unknown as pg.Client, identity);
        const memberships = await tenantAccess.listMembershipsForPerson(result.personId);

        sendJson(res, 200, {
            status: 'authenticated',
            username: username.trim(),
            expiresAt: result.session.expiresAt.toISOString(),
            memberships: projectMemberships(memberships),
        }, {
            'Set-Cookie': buildSessionCookie(deps.cookie, { sessionId: result.session.sessionId, secret: result.session.secret }, result.session.expiresAt),
        });
    } catch {
        sendError(res, 503, 'persistence_unavailable');
    } finally {
        client.release();
    }
}

/**
 * First sign-in of a provisioned account (D02.3-09/10, D02.7-37..41): the ELLIGBLE ID, the
 * single-use activation code and the person's own new password. Success signs the person
 * in exactly like login. Any wrong, expired, used or revoked code is one indistinguishable
 * 401; a refused password is 400 with the reason, checked before any account lookup.
 */
export async function handleActivate(req: http.IncomingMessage, res: http.ServerResponse, deps: AuthRouteDependencies): Promise<void> {
    if (req.method !== 'POST') {
        sendError(res, 405, 'method_not_allowed');
        return;
    }

    let username: unknown;
    let activationCode: unknown;
    let newPassword: unknown;
    try {
        const body = await readJsonObject(req, LOGIN_BODY_LIMIT_BYTES);
        username = body['username'];
        activationCode = body['activationCode'];
        newPassword = body['newPassword'];
    } catch (err) {
        if (err instanceof HttpError) {
            sendError(res, err.statusCode, err.message);
            return;
        }
        sendError(res, 400, 'invalid_request');
        return;
    }

    if (
        typeof username !== 'string' || typeof activationCode !== 'string' || typeof newPassword !== 'string' ||
        username.trim().length === 0 || username.length > MAX_USERNAME_LENGTH ||
        activationCode.length === 0 || activationCode.length > 64 || newPassword.length > MAX_PASSWORD_LENGTH
    ) {
        sendError(res, 400, 'invalid_request');
        return;
    }

    let client: pg.PoolClient;
    try {
        client = await deps.pool.connect();
    } catch {
        sendError(res, 503, 'persistence_unavailable');
        return;
    }

    try {
        const identity = new IdentityRuntime(client as unknown as pg.Client);
        const result = await identity.activate(username, activationCode, newPassword);
        if (!result.success) {
            if (result.error === 'PASSWORD_REJECTED') {
                sendJson(res, 400, { error: 'password_rejected', reason: result.reason });
            } else {
                sendError(res, 401, 'invalid_activation');
            }
            return;
        }

        const tenantAccess = new TenantAccessRuntime(client as unknown as pg.Client, identity);
        const memberships = await tenantAccess.listMembershipsForPerson(result.personId);
        sendJson(res, 200, {
            status: 'authenticated',
            username: username.trim(),
            expiresAt: result.session.expiresAt.toISOString(),
            memberships: projectMemberships(memberships),
        }, {
            'Set-Cookie': buildSessionCookie(deps.cookie, { sessionId: result.session.sessionId, secret: result.session.secret }, result.session.expiresAt),
        });
    } catch {
        sendError(res, 503, 'persistence_unavailable');
    } finally {
        client.release();
    }
}

export async function handleLogout(req: http.IncomingMessage, res: http.ServerResponse, deps: AuthRouteDependencies): Promise<void> {
    if (req.method !== 'POST') {
        sendError(res, 405, 'method_not_allowed');
        return;
    }
    // Drain any body; logout takes no input.
    req.resume();

    const lookup = readSessionCredential(req, deps.cookie);
    if (lookup.kind === 'present') {
        let client: pg.PoolClient;
        try {
            client = await deps.pool.connect();
        } catch {
            sendError(res, 503, 'persistence_unavailable');
            return;
        }
        try {
            const identity = new IdentityRuntime(client as unknown as pg.Client);
            // Only a caller who proves the secret can revoke the session.
            const session = await identity.resolveSession(lookup.credential.sessionId, lookup.credential.secret);
            if (session) {
                await identity.revokeSession(session.sessionId);
            }
        } catch {
            sendError(res, 503, 'persistence_unavailable');
            return;
        } finally {
            client.release();
        }
    }

    res.writeHead(204, { 'Set-Cookie': buildClearedSessionCookie(deps.cookie) });
    res.end();
}

export async function handleSessionGet(req: http.IncomingMessage, res: http.ServerResponse, deps: AuthRouteDependencies): Promise<void> {
    if (req.method !== 'GET') {
        sendError(res, 405, 'method_not_allowed');
        return;
    }

    const lookup = readSessionCredential(req, deps.cookie);
    if (lookup.kind !== 'present') {
        const headers = lookup.kind === 'malformed' ? { 'Set-Cookie': buildClearedSessionCookie(deps.cookie) } : {};
        sendError(res, 401, 'unauthorized', headers);
        return;
    }

    let client: pg.PoolClient;
    try {
        client = await deps.pool.connect();
    } catch {
        sendError(res, 503, 'persistence_unavailable');
        return;
    }

    try {
        const identity = new IdentityRuntime(client as unknown as pg.Client);
        const session = await identity.resolveSession(lookup.credential.sessionId, lookup.credential.secret);
        if (!session) {
            sendError(res, 401, 'unauthorized', lookup.source === 'cookie' ? { 'Set-Cookie': buildClearedSessionCookie(deps.cookie) } : {});
            return;
        }
        const tenantAccess = new TenantAccessRuntime(client as unknown as pg.Client, identity);
        const memberships = await tenantAccess.listMembershipsForPerson(session.personId);
        const username = await identity.getLoginIdentifier(session.userAccountId);
        sendJson(res, 200, {
            status: 'authenticated',
            username,
            expiresAt: session.expiresAt.toISOString(),
            memberships: projectMemberships(memberships),
        });
    } catch {
        sendError(res, 503, 'persistence_unavailable');
    } finally {
        client.release();
    }
}
