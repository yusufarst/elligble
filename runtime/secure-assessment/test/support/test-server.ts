import type * as http from 'node:http';
import type pg from 'pg';
import { createServer } from '../../src/server.ts';
import { createAttemptAuthorizer } from '../../src/http/attempt-authorization.ts';
import { checkDatabaseReadiness } from '../../src/db.ts';

// Starts the production-wired HTTP server (real session, cookie and origin policy) on an
// ephemeral port, backed by a disposable database pool.

export interface RunningServer {
    baseUrl: string;
    server: http.Server;
    close(): Promise<void>;
}

export async function startProductionWiredServer(pool: pg.Pool, options: { secureCookie?: boolean } = {}): Promise<RunningServer> {
    const cookie = { secure: options.secureCookie ?? false };
    const server = createServer({
        checkReadiness: () => checkDatabaseReadiness(pool),
        pool,
        security: { cookie, allowedOrigins: [], hsts: cookie.secure },
        authorizeAttempt: createAttemptAuthorizer(pool, cookie),
    });
    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
        server.listen(0, '127.0.0.1');
    });
    const port = (server.address() as { port: number }).port;
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        server,
        close: () => new Promise<void>(resolve => {
            server.closeAllConnections();
            server.close(() => resolve());
        }),
    };
}

export interface ClientResponse {
    status: number;
    headers: Headers;
    body: any;
}

/** Minimal cookie-keeping client that behaves like a same-origin browser tab. */
export class BrowserLikeClient {
    readonly baseUrl: string;
    cookie: string | null = null;
    tenantId: string | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async request(
        path: string,
        init: { method?: string; body?: unknown; rawBody?: string; headers?: Record<string, string>; origin?: string | null } = {}
    ): Promise<ClientResponse> {
        const headers: Record<string, string> = { ...(init.headers ?? {}) };
        if (this.cookie) headers['Cookie'] = this.cookie;
        if (this.tenantId) headers['X-Tenant-ID'] = this.tenantId;
        const method = init.method ?? 'GET';
        if (init.origin !== null && method !== 'GET') {
            headers['Origin'] = init.origin ?? this.baseUrl;
        }
        let body: string | undefined;
        if (init.rawBody !== undefined) {
            body = init.rawBody;
        } else if (init.body !== undefined) {
            body = JSON.stringify(init.body);
            headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(this.baseUrl + path, { method, headers, body });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            const pair = setCookie.split(';')[0];
            const value = pair.slice(pair.indexOf('=') + 1);
            this.cookie = value === '' ? null : pair;
        }
        const text = await res.text();
        let parsed: any = null;
        if (text) {
            try { parsed = JSON.parse(text); } catch { parsed = text; }
        }
        return { status: res.status, headers: res.headers, body: parsed };
    }

    async login(username: string, password: string): Promise<ClientResponse> {
        return this.request('/api/v1/auth/login', { method: 'POST', body: { username, password } });
    }
}
