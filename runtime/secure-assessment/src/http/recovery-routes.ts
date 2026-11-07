import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool, PoolClient } from 'pg';
import { IdentityRuntime } from '../../../identity-access/src/index.ts';
import { TenantAccessRuntime } from '../../../tenant-access/src/index.ts';
import { buildSessionCookie, type SessionCookieConfig } from './session-credentials.ts';
import { HttpError, readJsonObject, sendError, sendJson } from './http-utils.ts';
import { authorizeRecovery, completeRecovery } from '../recovery.ts';
import { claimError } from '../claims.ts';

// AUTH-003 F03 transport (record §7). Authorize is a scoped verifier route; completion is a
// public route answered exactly like activation on success, with bounded neutral refusals.

const RECOVERY_BODY_LIMIT_BYTES = 8 * 1024;

export async function handleRecoveryAuthorize(req: IncomingMessage, res: ServerResponse, pool: Pool, cookie: SessionCookieConfig): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { req.resume(); sendError(res, 405, 'method_not_allowed'); return; }
    try {
        const body = await readJsonObject(req, RECOVERY_BODY_LIMIT_BYTES);
        sendJson(res, 200, await authorizeRecovery(pool, req, cookie, body));
    } catch (e) {
        if (e instanceof HttpError) { sendError(res, e.statusCode, e.message); return; }
        const error = claimError(e);
        sendError(res, error.status, error.code);
    }
}

export async function handleRecoveryComplete(req: IncomingMessage, res: ServerResponse, pool: Pool, cookie: SessionCookieConfig): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { req.resume(); sendError(res, 405, 'method_not_allowed'); return; }
    let body: Record<string, unknown>;
    try {
        body = await readJsonObject(req, RECOVERY_BODY_LIMIT_BYTES);
    } catch (e) {
        sendError(res, e instanceof HttpError ? e.statusCode : 400, e instanceof HttpError ? e.message : 'invalid_request');
        return;
    }
    const { username, recoveryCode, newPassword } = body;
    if (Object.keys(body).some(k => !['username', 'recoveryCode', 'newPassword'].includes(k))
        || typeof username !== 'string' || typeof recoveryCode !== 'string' || typeof newPassword !== 'string'
        || !username.trim() || username.length > 255 || !recoveryCode || recoveryCode.length > 64 || newPassword.length > 1024) {
        sendError(res, 400, 'invalid_request');
        return;
    }
    let client: PoolClient;
    try { client = await pool.connect(); } catch { sendError(res, 503, 'persistence_unavailable'); return; }
    try {
        const result = await completeRecovery(client, username, recoveryCode, newPassword);
        if (!result.success) {
            if (result.error === 'PASSWORD_REJECTED') sendJson(res, 400, { error: 'password_rejected', reason: result.reason });
            else if (result.error === 'ALREADY_COMPLETED') sendError(res, 409, 'recovery_already_completed');
            else sendError(res, 401, 'invalid_recovery');
            return;
        }
        const identity = new IdentityRuntime(client as never);
        const memberships = await new TenantAccessRuntime(client as never, identity).listMembershipsForPerson(result.personId);
        sendJson(res, 200, {
            status: 'authenticated',
            username: username.trim(),
            expiresAt: result.session.expiresAt.toISOString(),
            memberships: memberships.map(m => ({ tenantId: m.tenantId, displayLabel: m.tenantDisplayLabel })),
        }, {
            'Set-Cookie': buildSessionCookie(cookie, { sessionId: result.session.sessionId, secret: result.session.secret }, result.session.expiresAt),
        });
    } catch (e) {
        const error = claimError(e);
        sendError(res, error.status === 429 ? 429 : 503, error.status === 429 ? error.code : 'persistence_unavailable');
    } finally {
        client.release();
    }
}
