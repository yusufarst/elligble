import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { createServer } from '../src/server.ts';

test('server tests', async (t) => {
    let checkReadinessResult: boolean | Error = true;
    let readinessCallCount = 0;

    const server = createServer({
        checkReadiness: async () => {
            readinessCallCount++;
            if (checkReadinessResult instanceof Error) {
                throw checkReadinessResult;
            }
            return checkReadinessResult;
        },
        pool: null as any,
        getAuthorizedContext: () => null
    });

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
        server.listen(0);
    });

    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    await t.test('GET /healthz -> 200 and no readiness invocation', async () => {
        readinessCallCount = 0;
        const res = await fetch(`${baseUrl}/healthz`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.deepEqual(data, { status: 'alive' });
        assert.equal(readinessCallCount, 0, 'checkReadiness should not be called by /healthz');
    });

    await t.test('GET /readyz with injected ready=true -> 200', async () => {
        checkReadinessResult = true;
        const res = await fetch(`${baseUrl}/readyz`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.deepEqual(data, { status: 'ready' });
    });

    await t.test('GET /readyz with injected ready=false -> 503', async () => {
        checkReadinessResult = false;
        const res = await fetch(`${baseUrl}/readyz`);
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.deepEqual(data, { status: 'unavailable' });
    });

    await t.test('injected readiness exception -> 503 without leaking internal detail', async () => {
        checkReadinessResult = new Error("DB Connection Failed");
        const res = await fetch(`${baseUrl}/readyz`);
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.deepEqual(data, { status: 'error' });
    });

    await t.test('unknown path -> 404', async () => {
        const res = await fetch(`${baseUrl}/unknown`);
        assert.equal(res.status, 404);
        const data = await res.json();
        assert.deepEqual(data, { error: 'not found' });
    });

    await t.test('POST /api/v1/assessment/submit -> reaches bounded Submission handler (403 missing context)', async () => {
        const res = await fetch(`${baseUrl}/api/v1/assessment/submit`, {
            method: 'POST',
            body: JSON.stringify({ attemptId: '11111111-2222-4333-8444-555555555555' })
        });
        assert.equal(res.status, 403);
    });

    await t.test('POST /api/v1/assessment/expiry-finalize -> reaches bounded Submission handler (403 missing context)', async () => {
        const res = await fetch(`${baseUrl}/api/v1/assessment/expiry-finalize`, {
            method: 'POST',
            body: JSON.stringify({ attemptId: '11111111-2222-4333-8444-555555555555' })
        });
        assert.equal(res.status, 403);
    });

    await t.test('GET /api/v1/assessment/submission?attemptId=uuid -> reaches bounded Submission handler (403 missing context)', async () => {
        const res = await fetch(`${baseUrl}/api/v1/assessment/submission?attemptId=11111111-2222-4333-8444-555555555555`);
        assert.equal(res.status, 403);
    });

    await t.test('GET /api/v1/assessment/resume?attemptId=uuid -> reaches bounded Resume handler (403 missing context)', async () => {
        const res = await fetch(`${baseUrl}/api/v1/assessment/resume?attemptId=11111111-2222-4333-8444-555555555555`);
        assert.equal(res.status, 403);
    });

    await t.test('POST /api/v1/assessment/session/activate -> reaches bounded Session handler (403 missing context)', async () => {
        const res = await fetch(`${baseUrl}/api/v1/assessment/session/activate`, {
            method: 'POST',
            body: JSON.stringify({ attemptId: '11111111-2222-4333-8444-555555555555', sessionId: '22222222-2222-4333-8444-555555555555' })
        });
        assert.equal(res.status, 403);
    });

    await t.test('unsupported method -> bounded not-found behavior', async () => {
        const res = await fetch(`${baseUrl}/healthz`, { method: 'POST' });
        assert.equal(res.status, 404);
    });

    await t.test('cleanup server', async () => {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });
});
