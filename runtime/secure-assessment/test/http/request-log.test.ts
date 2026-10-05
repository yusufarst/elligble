import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { createServer } from '../../src/server.ts';
import type { LogEvent, LogLevel } from '../../src/log.ts';

interface Line { level: LogLevel; event: LogEvent; metadata?: Record<string, unknown> }

async function withLoggedServer(run: (base: string, lines: Line[]) => Promise<void>) {
    const lines: Line[] = [];
    const server = createServer({
        checkReadiness: async () => true,
        pool: {} as never,
        getAuthorizedContext: () => { throw new Error('boom'); },
        log: (level, event, metadata) => lines.push({ level, event, metadata }),
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    try {
        await run(`http://127.0.0.1:${port}`, lines);
    } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('access log and request correlation', async (t) => {
    await withLoggedServer(async (base, lines) => {
        await t.test('one line per request with id, method, path, status and duration', async () => {
            const res = await fetch(`${base}/api/v1/assessment/resume?attemptId=11111111-1111-4111-8111-111111111111`, {
                headers: { Cookie: 'elligble_session=abc.def', Authorization: 'ELLIGBLE-Session secret-value' },
            });
            await res.arrayBuffer();
            await settle();
            const requestId = res.headers.get('x-request-id');
            assert.ok(requestId);
            const line = lines.find(l => l.event === 'http_request' && l.metadata?.['requestId'] === requestId);
            assert.ok(line);
            assert.equal(line.metadata?.['method'], 'GET');
            assert.equal(line.metadata?.['path'], '/api/v1/assessment/resume');
            assert.equal(line.metadata?.['status'], res.status);
            assert.equal(typeof line.metadata?.['durationMs'], 'number');
            const serialized = JSON.stringify(lines);
            assert.doesNotMatch(serialized, /attemptId|11111111-1111|abc\.def|secret-value|Cookie|Authorization/);
        });

        await t.test('a proxy request id is reused only when well formed', async () => {
            const good = await fetch(`${base}/api/v1/nope`, { headers: { 'X-Request-ID': 'edge-1234abcd' } });
            assert.equal(good.headers.get('x-request-id'), 'edge-1234abcd');
            const bad = await fetch(`${base}/api/v1/nope`, { headers: { 'X-Request-ID': 'short' } });
            assert.notEqual(bad.headers.get('x-request-id'), 'short');
            assert.match(bad.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
        });

        await t.test('successful health probes are not logged', async () => {
            const before = lines.length;
            await (await fetch(`${base}/healthz`)).arrayBuffer();
            await (await fetch(`${base}/readyz`)).arrayBuffer();
            await settle();
            assert.equal(lines.length, before);
        });

        await t.test('failures are logged at ERROR without echoing messages', async () => {
            const res = await fetch(`${base}/api/v1/assessment/resume?attemptId=11111111-1111-4111-8111-111111111111`);
            await res.arrayBuffer();
            await settle();
            assert.equal(res.status, 500);
            const line = lines.findLast(l => l.event === 'http_request');
            assert.equal(line?.level, 'ERROR');
            assert.doesNotMatch(JSON.stringify(lines), /boom/);
        });
    });
});
