import type * as http from 'node:http';

export const JSON_BODY_LIMIT_BYTES = 64 * 1024;

export class HttpError extends Error {
    readonly statusCode: number;
    constructor(statusCode: number, code: string) {
        super(code);
        this.statusCode = statusCode;
    }
}

export function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: http.OutgoingHttpHeaders = {}): void {
    if (res.headersSent) return;
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
}

export function sendError(res: http.ServerResponse, status: number, code: string, headers: http.OutgoingHttpHeaders = {}): void {
    sendJson(res, status, { error: code }, headers);
}

/** Reads the whole request body, rejecting with 413 once `limit` bytes are exceeded. */
export function readBody(req: http.IncomingMessage, limit: number = JSON_BODY_LIMIT_BYTES): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const declared = Number(req.headers['content-length']);
        if (Number.isFinite(declared) && declared > limit) {
            req.resume();
            reject(new HttpError(413, 'payload_too_large'));
            return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        req.on('data', (chunk: Buffer) => {
            if (settled) return;
            size += chunk.length;
            if (size > limit) {
                settled = true;
                req.resume();
                reject(new HttpError(413, 'payload_too_large'));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (settled) return;
            settled = true;
            resolve(Buffer.concat(chunks));
        });
        req.on('error', err => {
            if (settled) return;
            settled = true;
            reject(err);
        });
    });
}

export async function readJsonObject(req: http.IncomingMessage, limit?: number): Promise<Record<string, unknown>> {
    const raw = await readBody(req, limit);
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw.toString('utf8'));
    } catch {
        throw new HttpError(400, 'invalid_request');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new HttpError(400, 'invalid_request');
    }
    return parsed as Record<string, unknown>;
}

export function parseCookies(header: string | undefined): Map<string, string> {
    const cookies = new Map<string, string>();
    if (!header) return cookies;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq <= 0) continue;
        const name = part.slice(0, eq).trim();
        const value = part.slice(eq + 1).trim();
        if (name && !cookies.has(name)) cookies.set(name, value);
    }
    return cookies;
}

/** Headers applied to every response. API responses are never cacheable. */
export function applySecurityHeaders(res: http.ServerResponse, options: { hsts: boolean; api: boolean }): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
        "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    );
    if (options.hsts) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (options.api) {
        res.setHeader('Cache-Control', 'no-store');
    }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Cross-site request defence for state-changing API calls. Browsers send Origin on
 * cross-origin and on same-origin POST fetches; a present Origin must be this host or
 * an explicitly allowed origin. Requests without Origin (non-browser clients) must carry
 * their credential explicitly and are not affected by SameSite cookie behaviour.
 */
export function isOriginAllowed(req: http.IncomingMessage, allowedOrigins: readonly string[]): boolean {
    if (!req.method || !UNSAFE_METHODS.has(req.method)) return true;
    const origin = req.headers['origin'];
    if (origin === undefined) return true;
    if (typeof origin !== 'string' || origin === 'null') return false;
    let parsed: URL;
    try {
        parsed = new URL(origin);
    } catch {
        return false;
    }
    if (allowedOrigins.includes(parsed.origin)) return true;
    return typeof req.headers.host === 'string' && parsed.host === req.headers.host;
}
