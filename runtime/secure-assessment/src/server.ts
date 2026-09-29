import * as http from 'node:http';
import { Readable } from 'node:stream';
import * as pg from 'pg';
import { handleSaveAnswer, type AuthorizedAssessmentContext } from './answer.ts';
import { handleTimerStart, handleTimerGet } from './timer.ts';
import { handleSubmit, handleSubmissionGet, handleExpiryFinalize } from './submission.ts';
import { handleResumeGet } from './resume.ts';
import { handleSessionActivate } from './session.ts';
import { handleQuestionDelivery } from './question-delivery.ts';
import { handleAssignedExamsGet, type AssignedExamDiscoveryContext } from './assigned-exams.ts';
import { handleProctorMonitoringGet } from './proctor-monitoring.ts';
import { handleTeacherReadinessGet, type TeacherReadinessContext } from './teacher-readiness.ts';
import { AuthenticationError, buildAuthenticatedContext } from './http/authenticated-context.ts';
import { handleLogin, handleLogout, handleSessionGet } from './http/auth-routes.ts';
import { handleMeContextGet } from './http/me-context.ts';
import { handleAttemptStart } from './attempt-start.ts';
import { performTeacherExamAction, type TeacherExamAction } from './exam-lifecycle-operations.ts';
import { HttpError, applySecurityHeaders, isOriginAllowed, readBody, readJsonObject, sendError, sendJson } from './http/http-utils.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import type { StaticSite } from './http/static-site.ts';
import { assignRequestId, classifyRequest, describeError, logRequestCompletion } from './http/request-log.ts';
import type { LogWriter } from './log.ts';

export interface ServerSecurityConfig {
    cookie: SessionCookieConfig;
    allowedOrigins: readonly string[];
    hsts: boolean;
}

/** Person-level context for tenant-scoped read models (assigned exams, proctor, teacher views). */
export interface PersonContext {
    tenantId: string;
    personId: string;
}

export interface ServerDependencies {
    checkReadiness: () => Promise<boolean>;
    pool: pg.Pool;
    /**
     * Production wiring: session, cookie and origin policy. When present, every protected
     * route resolves the caller from the session credential (header or HttpOnly cookie).
     */
    security?: ServerSecurityConfig;
    /** Production attempt authorization: session -> membership -> participant -> attempt. */
    authorizeAttempt?: (req: http.IncomingMessage, attemptId: string) => Promise<AuthorizedAssessmentContext | null>;
    /** Synchronous context injection used by focused handler tests. Fails closed when absent. */
    getAuthorizedContext?: (req: http.IncomingMessage) => AuthorizedAssessmentContext | null;
    getAssignedExamDiscoveryContext?: (req: http.IncomingMessage) => AssignedExamDiscoveryContext | null;
    getTeacherReadinessContext?: (req: http.IncomingMessage) => TeacherReadinessContext | null;
    /** Built web client served for every non-API path (single-origin deployment). */
    staticSite?: StaticSite;
    /** Access and error log; silent when absent (focused tests). */
    log?: LogWriter;
}

type AttemptRoute = { method: 'GET' | 'POST'; source: 'query' | 'body' };

const ATTEMPT_ROUTES: Record<string, AttemptRoute> = {
    '/api/v1/assessment/answer/save': { method: 'POST', source: 'body' },
    '/api/v1/assessment/timer/start': { method: 'POST', source: 'body' },
    '/api/v1/assessment/submit': { method: 'POST', source: 'body' },
    '/api/v1/assessment/expiry-finalize': { method: 'POST', source: 'body' },
    '/api/v1/assessment/session/activate': { method: 'POST', source: 'body' },
    '/api/v1/assessment/submission': { method: 'GET', source: 'query' },
    '/api/v1/assessment/timer': { method: 'GET', source: 'query' },
    '/api/v1/assessment/resume': { method: 'GET', source: 'query' },
    '/api/v1/assessment/questions': { method: 'GET', source: 'query' },
};

const ATTEMPT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function replayRequest(original: http.IncomingMessage, body: Buffer): http.IncomingMessage {
    const replay = Readable.from(body.length > 0 ? [body] : []) as unknown as http.IncomingMessage;
    Object.assign(replay, {
        method: original.method,
        url: original.url,
        headers: original.headers,
        socket: original.socket,
    });
    return replay;
}

function extractAttemptId(route: AttemptRoute, url: URL, body: Buffer | null): string | null {
    if (route.source === 'query') {
        return url.searchParams.get('attemptId');
    }
    try {
        const parsed = JSON.parse((body ?? Buffer.alloc(0)).toString('utf8'));
        return parsed && typeof parsed === 'object' && typeof parsed.attemptId === 'string' ? parsed.attemptId : null;
    } catch {
        return null;
    }
}

export function createServer(deps: ServerDependencies): http.Server {
    const server = http.createServer();
    const security = deps.security;

    async function resolvePersonContext(req: http.IncomingMessage): Promise<PersonContext> {
        if (!security) {
            throw new AuthenticationError(401, 'unauthorized');
        }
        const membership = await buildAuthenticatedContext(req, deps.pool, { cookie: security.cookie });
        if (!membership) {
            throw new AuthenticationError(403, 'forbidden');
        }
        return { tenantId: membership.tenantId, personId: membership.personId };
    }

    async function withPersonContext(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        legacy: ((req: http.IncomingMessage) => PersonContext | null) | undefined,
        run: (getContext: () => PersonContext | null) => Promise<void>
    ): Promise<void> {
        if (!security) {
            await run(legacy ? () => legacy(req) : () => null);
            return;
        }
        let context: PersonContext;
        try {
            context = await resolvePersonContext(req);
        } catch (err) {
            if (err instanceof AuthenticationError) {
                sendError(res, err.statusCode, err.message);
                return;
            }
            sendError(res, 500, 'internal_error');
            return;
        }
        await run(() => context);
    }

    async function dispatchAttemptRoute(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, url: URL): Promise<void> {
        const route = ATTEMPT_ROUTES[pathname];

        let body: Buffer | null = null;
        let handlerReq = req;
        if (route.source === 'body' && req.method === 'POST') {
            try {
                body = await readBody(req);
            } catch (err) {
                const status = err instanceof HttpError ? err.statusCode : 400;
                sendError(res, status, err instanceof HttpError ? err.message : 'invalid_request');
                return;
            }
            handlerReq = replayRequest(req, body);
        }

        let getAuthorizedContext: (r: http.IncomingMessage) => AuthorizedAssessmentContext | null;
        if (deps.authorizeAttempt) {
            if (req.method !== route.method) {
                sendError(res, 405, 'method_not_allowed');
                return;
            }
            const attemptId = extractAttemptId(route, url, body);
            if (!attemptId || !ATTEMPT_ID_REGEX.test(attemptId)) {
                sendError(res, 400, 'invalid_request');
                return;
            }
            let context: AuthorizedAssessmentContext | null;
            try {
                context = await deps.authorizeAttempt(req, attemptId);
            } catch (err) {
                if (err instanceof AuthenticationError) {
                    sendError(res, err.statusCode, err.message);
                    return;
                }
                sendError(res, 500, 'internal_error');
                return;
            }
            getAuthorizedContext = () => context;
        } else {
            getAuthorizedContext = deps.getAuthorizedContext ?? (() => null);
        }

        const handlerDeps = { pool: deps.pool, getAuthorizedContext };
        switch (pathname) {
            case '/api/v1/assessment/answer/save':
                return handleSaveAnswer(handlerReq, res, handlerDeps);
            case '/api/v1/assessment/timer/start':
                return handleTimerStart(handlerReq, res, handlerDeps);
            case '/api/v1/assessment/submit':
                return handleSubmit(handlerReq, res, handlerDeps);
            case '/api/v1/assessment/expiry-finalize':
                return handleExpiryFinalize(handlerReq, res, handlerDeps);
            case '/api/v1/assessment/submission':
                return handleSubmissionGet(handlerReq, res, handlerDeps);
            case '/api/v1/assessment/timer':
                return handleTimerGet(handlerReq, res, handlerDeps);
            case '/api/v1/assessment/resume':
                return handleResumeGet(handlerReq, res, handlerDeps);
            case '/api/v1/assessment/questions':
                return handleQuestionDelivery(handlerReq, res, handlerDeps);
            case '/api/v1/assessment/session/activate': {
                let ctx;
                try {
                    ctx = getAuthorizedContext(handlerReq);
                } catch {
                    sendError(res, 500, 'internal_error');
                    return;
                }
                if (!ctx) {
                    sendError(res, 403, 'forbidden');
                    return;
                }
                return handleSessionActivate(handlerReq, res, ctx, deps.pool);
            }
        }
    }

    async function route(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
        const pathname = url.pathname;
        const kind = classifyRequest(pathname);
        const isApi = kind === 'api';

        // Static client files set their own caching; API and health responses are never cached.
        applySecurityHeaders(res, { hsts: security?.hsts ?? false, api: kind !== 'static' || !deps.staticSite });

        if (req.method === 'GET' && pathname === '/healthz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'alive' }));
            return;
        }

        if (req.method === 'GET' && pathname === '/readyz') {
            try {
                const isReady = await deps.checkReadiness();
                if (isReady) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ready' }));
                } else {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'unavailable' }));
                }
            } catch {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error' }));
            }
            return;
        }

        if (kind === 'static' && deps.staticSite) {
            deps.staticSite.handle(req, res, pathname);
            return;
        }

        if (isApi && security && !isOriginAllowed(req, security.allowedOrigins)) {
            req.resume();
            sendError(res, 403, 'origin_not_allowed');
            return;
        }

        if (pathname in ATTEMPT_ROUTES) {
            await dispatchAttemptRoute(req, res, pathname, url);
            return;
        }

        if (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/logout' || pathname === '/api/v1/auth/session') {
            if (!security) {
                sendError(res, 404, 'not found');
                return;
            }
            const authDeps = { pool: deps.pool, cookie: security.cookie };
            if (pathname === '/api/v1/auth/login') return handleLogin(req, res, authDeps);
            if (pathname === '/api/v1/auth/logout') return handleLogout(req, res, authDeps);
            return handleSessionGet(req, res, authDeps);
        }

        if (pathname === '/api/v1/me/context') {
            if (!security) {
                sendError(res, 404, 'not found');
                return;
            }
            return handleMeContextGet(req, res, { pool: deps.pool, cookie: security.cookie });
        }

        if (pathname === '/api/v1/assessment/attempts/start') {
            if (!security) {
                sendError(res, 404, 'not found');
                return;
            }
            if (req.method !== 'POST') {
                sendError(res, 405, 'method_not_allowed');
                return;
            }
            return withPersonContext(req, res, undefined, getContext =>
                handleAttemptStart(req, res, { pool: deps.pool, getContext: () => getContext()! }));
        }

        if (pathname === '/api/v1/assessment/teacher-exams/transition') {
            if (!security) {
                sendError(res, 404, 'not found');
                return;
            }
            if (req.method !== 'POST') {
                sendError(res, 405, 'method_not_allowed');
                return;
            }
            return withPersonContext(req, res, undefined, async getContext => {
                let body: Record<string, unknown>;
                try {
                    body = await readJsonObject(req);
                } catch (err) {
                    sendError(res, err instanceof HttpError ? err.statusCode : 400, err instanceof HttpError ? err.message : 'invalid_request');
                    return;
                }
                const examInstanceId = body['examInstanceId'];
                const action = body['action'];
                if (typeof examInstanceId !== 'string' || (action !== 'mark_ready' && action !== 'activate')) {
                    sendError(res, 400, 'invalid_request');
                    return;
                }
                const result = await performTeacherExamAction(deps.pool, getContext()!, examInstanceId, action as TeacherExamAction);
                switch (result.type) {
                    case 'transitioned':
                        sendJson(res, 200, { examInstanceId: result.examInstanceId, lifecycleState: result.lifecycleState });
                        return;
                    case 'forbidden':
                        sendError(res, 403, 'forbidden');
                        return;
                    case 'invalid_state':
                        sendJson(res, 409, { error: 'invalid_state', currentState: result.currentState });
                        return;
                    case 'not_ready':
                        sendJson(res, 409, { error: 'not_ready', readiness: result.readiness });
                        return;
                    case 'window_not_started':
                        sendJson(res, 409, { error: 'window_not_started', windowStartsAt: result.windowStartsAt });
                        return;
                    case 'window_closed':
                        sendError(res, 409, 'window_closed');
                        return;
                    case 'unavailable':
                        sendError(res, 503, 'persistence_unavailable');
                        return;
                }
            });
        }

        if (pathname === '/api/v1/assessment/assigned-exams') {
            if (req.method !== 'GET') {
                sendError(res, 405, 'method_not_allowed');
                return;
            }
            let authContext: AssignedExamDiscoveryContext | null = null;
            try {
                const membership = await buildAuthenticatedContext(req, deps.pool, { cookie: security?.cookie ?? null });
                if (membership) {
                    authContext = { tenantId: membership.tenantId, personId: membership.personId };
                }
            } catch (err) {
                if (err instanceof AuthenticationError) {
                    sendError(res, err.statusCode, err.message);
                    return;
                }
                sendError(res, 500, 'internal_error');
                return;
            }
            return handleAssignedExamsGet(req, res, {
                pool: deps.pool,
                getAssignedExamDiscoveryContext: () => authContext,
            });
        }

        if (pathname === '/api/v1/assessment/proctor-monitoring') {
            return withPersonContext(req, res, deps.getAssignedExamDiscoveryContext, getContext =>
                handleProctorMonitoringGet(req, res, { pool: deps.pool, getProctorMonitoringContext: getContext }));
        }

        if (pathname === '/api/v1/assessment/teacher-readiness') {
            return withPersonContext(req, res, deps.getTeacherReadinessContext, getContext =>
                handleTeacherReadinessGet(req, res, {
                    pool: deps.pool,
                    getTeacherReadinessContext: security || deps.getTeacherReadinessContext ? getContext : undefined,
                }));
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    }

    server.on('request', (req, res) => {
        const startedAt = process.hrtime.bigint();
        const requestId = assignRequestId(req, res);
        // Routing never depends on the Host header; a fixed base keeps parsing total.
        let url: URL;
        try {
            url = new URL(req.url || '/', 'http://localhost');
        } catch {
            url = new URL('http://localhost/');
        }
        if (deps.log) logRequestCompletion(req, res, { requestId, pathname: url.pathname, startedAt }, deps.log);
        route(req, res, url).catch(err => {
            deps.log?.('ERROR', 'request_failed', { requestId, ...describeError(err) });
            sendError(res, 500, 'internal_error');
        });
    });

    return server;
}
