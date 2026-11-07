import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import type { SessionCookieConfig } from './session-credentials.ts';
import { HttpError, readJsonObject, sendError, sendJson } from './http-utils.ts';
import { claimError, decideClaim, listClaimReview, submitClaim, validateReviewOffset } from '../claims.ts';

// AUTH-002 F02 transport (record §7). Public submission is a non-trusted entry with a uniform
// 202 receipt; review and decision require an authenticated scoped verifier. Responses are
// never cached and never echo matched roster data on the public route.

const CLAIM_BODY_LIMIT_BYTES = 8 * 1024;

export async function handleClaimSubmit(req: IncomingMessage, res: ServerResponse, pool: Pool): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { req.resume(); sendError(res, 405, 'method_not_allowed'); return; }
    try {
        const body = await readJsonObject(req, CLAIM_BODY_LIMIT_BYTES);
        sendJson(res, 202, await submitClaim(pool, body));
    } catch (e) {
        if (e instanceof HttpError) { sendError(res, e.statusCode, e.message); return; }
        const error = claimError(e);
        sendError(res, error.status, error.code);
    }
}

export async function handleClaimReview(req: IncomingMessage, res: ServerResponse, pool: Pool, cookie: SessionCookieConfig): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { req.resume(); sendError(res, 405, 'method_not_allowed'); return; }
    try {
        const offset = validateReviewOffset(new URL(req.url ?? '/', 'http://local').searchParams.get('offset'));
        sendJson(res, 200, await listClaimReview(pool, req, cookie, offset));
    } catch (e) {
        const error = claimError(e);
        sendError(res, error.status, error.code);
    }
}

export async function handleClaimDecision(req: IncomingMessage, res: ServerResponse, pool: Pool, cookie: SessionCookieConfig): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { req.resume(); sendError(res, 405, 'method_not_allowed'); return; }
    try {
        const body = await readJsonObject(req, CLAIM_BODY_LIMIT_BYTES);
        sendJson(res, 200, await decideClaim(pool, req, cookie, body));
    } catch (e) {
        if (e instanceof HttpError) { sendError(res, e.statusCode, e.message); return; }
        const error = claimError(e);
        sendError(res, error.status, error.code);
    }
}
