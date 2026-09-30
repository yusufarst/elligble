import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type pg from 'pg';
import { createServer } from '../src/server.ts';
import { createAttemptAuthorizer } from '../src/http/attempt-authorization.ts';

// Client/server route parity. Every exported API function of the web client is called for
// real against the production-wired server; each request must reach an existing route with
// an allowed method (never the router's 404 or a 405). Every API route the server declares
// must be used by the client or be listed as intentionally server-only. A new client
// function must be added to CALLS, so parity cannot silently fall out of coverage.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, '../../../frontend/web/src');
const SERVER_SOURCE = path.resolve(HERE, '../src/server.ts');
const ID = '11111111-1111-4111-8111-111111111111';

/** Server routes with no web client caller, on purpose. */
const SERVER_ONLY_ROUTES = new Set([
    '/api/v1/assessment/submission', // submission receipt for non-browser clients
]);

type Module = Record<string, any>;
const IMPORT_INPUT = {
    teachingAssignmentId: ID, assessmentTypeId: ID, windowStartsAt: '2026-10-05T08:00', windowEndsAt: '2026-10-05T10:00',
    durationMinutes: 60, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', questionsCsv: 'no', sourceFileName: null, participantEnrollmentIds: null,
};
const CALLS: Record<string, Record<string, (m: Module) => Promise<unknown>>> = {
    'api/assessment-client.ts': {
        getResume: m => m.getResume(ID, ID),
        getQuestions: m => m.getQuestions(ID),
        getTimer: m => m.getTimer(ID),
        postSaveAnswer: m => m.postSaveAnswer({ attemptId: ID, sessionId: ID, snapshotId: ID, answerPayload: { selectedOptionId: 'A' }, clientWriteIdentity: 'w-1', expectedWriteVersion: null }),
        postSubmit: m => m.postSubmit(ID),
        postReviewFlag: m => m.postReviewFlag({ attemptId: ID, sessionId: ID, snapshotId: ID, flagged: true }),
        postExpiryFinalize: m => m.postExpiryFinalize(ID),
        postActivateSession: m => m.postActivateSession({ attemptId: ID, sessionId: ID }),
        postStartTimer: m => m.postStartTimer({ attemptId: ID }),
        postStartAttempt: m => m.postStartAttempt(ID),
        getAssignedExams: m => m.getAssignedExams(),
        getProctorMonitoring: m => m.getProctorMonitoring(),
        postTeacherExamTransition: m => m.postTeacherExamTransition(ID, 'mark_ready'),
        getTeacherReadiness: m => m.getTeacherReadiness(),
        getTeacherExamResults: m => m.getTeacherExamResults(ID),
        getExamMonitoring: m => m.getExamMonitoring(ID),
        postParticipantLock: m => m.postParticipantLock(ID, ID, 'lock'),
        postBroadcast: m => m.postBroadcast(ID, { scope: 'EXAM' }, 'Harap tetap di tempat duduk.'),
        postBroadcastInbox: m => m.postBroadcastInbox(ID, []),
        getTeacherExamSetup: m => m.getTeacherExamSetup(),
        postTeacherExamImportPreview: m => m.postTeacherExamImportPreview(IMPORT_INPUT),
        postTeacherExamImport: m => m.postTeacherExamImport(IMPORT_INPUT, { importKey: ID, expectedSha256: '0'.repeat(64) }),
    },
    'api/auth-client.ts': {
        login: m => m.login('pengguna.uji', 'kata-sandi-uji'),
        activate: m => m.activate('pengguna.uji', 'ABCD-EFGH-JKMN', 'matahari-pagi-2026'),
        getSession: m => m.getSession(),
        logout: m => m.logout(),
        getMeContext: m => m.getMeContext(),
    },
    'exam/answer-sync-api.ts': {
        createAnswerSyncApi: async m => {
            const api = m.createAnswerSyncApi(ID, ID);
            await api.save({ attemptId: ID, sessionId: ID, snapshotId: ID, optionId: 'A', clientWriteIdentity: 'w-2', expectedWriteVersion: null });
            await api.fetchServerAnswers();
        },
    },
};
/** Exports that never call the network. */
const PURE_EXPORTS = new Set(['ApiError', 'LoginError', 'ActivationError', 'selectedOptionOf', 'toServerAnswerState', 'classifySaveFailure', 'countUnreceivedLocalAnswers']);

const unavailablePool = {
    connect: async () => { throw new Error('database unavailable'); },
    query: async () => { throw new Error('database unavailable'); },
} as unknown as pg.Pool;

test('web client and server API routes stay in parity', async () => {
    const cookie = { secure: false };
    const server = createServer({
        checkReadiness: async () => false,
        pool: unavailablePool,
        security: { cookie, allowedOrigins: [], hsts: false },
        authorizeAttempt: createAttemptAuthorizer(unavailablePool, cookie),
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const calls: Array<{ fn: string; method: string; pathname: string; status: number; error: unknown }> = [];
    const realFetch = globalThis.fetch;
    let current = '';
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, base);
        const res = await realFetch(url, { method: init?.method, headers: init?.headers, body: init?.body });
        const text = await res.text();
        let error: unknown = null;
        try { error = JSON.parse(text)?.error ?? null; } catch { /* not JSON */ }
        calls.push({ fn: current, method: init?.method ?? 'GET', pathname: url.pathname, status: res.status, error });
        return new Response(text, { status: res.status, headers: res.headers });
    }) as typeof fetch;

    try {
        for (const [file, functions] of Object.entries(CALLS)) {
            const mod: Module = await import(pathToFileURL(path.join(WEB_SRC, file)).href);
            const uncovered = Object.keys(mod).filter(name => typeof mod[name] === 'function' && !(name in functions) && !PURE_EXPORTS.has(name));
            assert.deepEqual(uncovered, [], `${file}: add new API functions to CALLS`);
            for (const [name, call] of Object.entries(functions)) {
                current = name;
                const before = calls.length;
                await call(mod).catch(() => undefined);
                assert.ok(calls.length > before, `${name} made no request`);
            }
        }
    } finally {
        globalThis.fetch = realFetch;
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }

    for (const call of calls) {
        assert.ok(call.pathname.startsWith('/api/v1/'), `${call.fn} calls ${call.pathname}`);
        assert.notEqual(call.status, 405, `${call.fn}: ${call.method} ${call.pathname} method not allowed`);
        assert.ok(!(call.status === 404 && call.error === 'not found'), `${call.fn}: ${call.method} ${call.pathname} has no server route`);
    }

    const serverRoutes = new Set([...readFileSync(SERVER_SOURCE, 'utf8').matchAll(/'(\/api\/v1\/[a-z0-9/_-]+)'/g)].map(m => m[1]));
    const used = new Set(calls.map(c => c.pathname));
    const unused = [...serverRoutes].filter(route => !used.has(route) && !SERVER_ONLY_ROUTES.has(route)).sort();
    assert.deepEqual(unused, [], 'server routes without a client caller must be listed in SERVER_ONLY_ROUTES');
    for (const route of SERVER_ONLY_ROUTES) assert.ok(serverRoutes.has(route), `${route} is no longer a server route`);
});
