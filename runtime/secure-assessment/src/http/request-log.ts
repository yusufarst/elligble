import { randomUUID } from 'node:crypto';
import type * as http from 'node:http';
import type { LogWriter } from '../log.ts';

// Access log and request correlation. One JSON line per request with method, path (never
// the query string: it carries attempt ids), status and duration. Cookies, credentials and
// bodies are never logged. Successful health probes are not logged (load balancers poll).

const INCOMING_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;
const MAX_LOGGED_PATH = 200;

export type RequestKind = 'api' | 'static' | 'health';

/** Reuses a well-formed X-Request-ID from the proxy, otherwise creates one; echoed back. */
export function assignRequestId(req: http.IncomingMessage, res: http.ServerResponse): string {
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && INCOMING_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-ID', requestId);
    return requestId;
}

export function classifyRequest(pathname: string): RequestKind {
    if (pathname === '/healthz' || pathname === '/readyz') return 'health';
    return pathname.startsWith('/api/') ? 'api' : 'static';
}

export function logRequestCompletion(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    details: { requestId: string; pathname: string; startedAt: bigint },
    write: LogWriter
): void {
    const kind = classifyRequest(details.pathname);
    let logged = false;
    const complete = (aborted: boolean) => {
        if (logged) return;
        logged = true;
        if (kind === 'health' && !aborted && res.statusCode < 500) return;
        const durationMs = Number(process.hrtime.bigint() - details.startedAt) / 1e6;
        write(res.statusCode >= 500 ? 'ERROR' : 'INFO', 'http_request', {
            requestId: details.requestId,
            kind,
            method: req.method,
            path: details.pathname.slice(0, MAX_LOGGED_PATH),
            status: res.statusCode,
            durationMs: Math.round(durationMs * 10) / 10,
            ...(aborted && { aborted: true }),
        });
    };
    res.once('finish', () => complete(false));
    res.once('close', () => complete(!res.writableFinished));
}

/** Error details safe to log: the error class and code, never messages that may echo input. */
export function describeError(err: unknown): Record<string, unknown> {
    if (!(err instanceof Error)) return { errorName: typeof err };
    const code = (err as { code?: unknown }).code;
    const frames = (err.stack ?? '').split('\n').slice(1, 6).map(line => line.trim());
    return {
        errorName: err.name,
        ...(typeof code === 'string' && { errorCode: code }),
        ...(frames.length > 0 && { stack: frames }),
    };
}
