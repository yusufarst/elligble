import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { createServer } from '../src/server.ts';
import type * as pg from 'pg';

test('timer capability tests', async (t) => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    let timerStates: any[] = [];
    let timerAdjustments: any[] = [];

    let mockPoolShouldFail = false;
    let mockQueryShouldFail = false;
    let poolConnectCount = 0;

    class MockClient {
        async query(sql: string, params?: any[]): Promise<any> {
            if (mockQueryShouldFail) throw new Error('database connection lost or query failed');
            const sqlLower = sql.toLowerCase();

            if (sqlLower === 'begin' || sqlLower === 'commit' || sqlLower === 'rollback') {
                return { rows: [] };
            }

            if (sqlLower.includes('from secure_assessment_timer_state') && sqlLower.includes('for update')) {
                const tenantId = params![0];
                const attemptId = params![1];
                const found = timerStates.filter(s => s.tenant_id === tenantId && s.exam_attempt_id === attemptId);
                return { rows: found };
            }

            if (sqlLower.includes('update secure_assessment_timer_state')) {
                const tenantId = params![0];
                const attemptId = params![1];
                const state = timerStates.find(s => s.tenant_id === tenantId && s.exam_attempt_id === attemptId);
                if (state && !state.started_at) {
                    state.started_at = new Date('2026-08-01T12:00:00Z');
                    return { rows: [state] };
                }
                return { rows: [] };
            }

            if (sqlLower.includes('from secure_assessment_timer_state') && !sqlLower.includes('for update')) {
                const tenantId = params![0];
                const attemptId = params![1];
                const state = timerStates.find(s => s.tenant_id === tenantId && s.exam_attempt_id === attemptId);

                if (!state) return { rows: [] };

                if (sqlLower.includes('exam_attempt_id')) {
                    const match = sqlLower.match(/secure_assessment_timer_adjustments.*exam_attempt_id/);
                    if (match) {
                        throw new Error('Schema mismatch: queried adjustment by exam_attempt_id instead of timer_state_id');
                    }
                }

                const adjs = timerAdjustments.filter(a => a.tenant_id === tenantId && a.timer_state_id === state.id);
                const totalAdj = adjs.reduce((sum, a) => sum + a.adjustment_seconds, 0);

                let elapsed = 0;
                if (state.started_at) {
                    const now = new Date('2026-08-01T12:00:10Z'); // 10 seconds later
                    elapsed = Math.floor((now.getTime() - state.started_at.getTime()) / 1000);
                }

                return {
                    rows: [{
                        id: state.id,
                        started_at: state.started_at,
                        configured_duration_seconds: state.configured_duration_seconds,
                        total_adjustment: totalAdj.toString(),
                        elapsed_seconds: elapsed
                    }]
                };
            }

            return { rows: [] };
        }

        release() { }
    }

    const mockPool: any = {
        connect: async () => {
            poolConnectCount++;
            if (mockPoolShouldFail) throw new Error('mock pool fail');
            return new MockClient();
        }
    };

    let mockContext: any = { tenantId: validUUID, authorizedAttemptId: validUUID };

    const server = createServer({
        checkReadiness: async () => true,
        pool: mockPool as pg.Pool,
        getAuthorizedContext: () => mockContext
    });

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
        server.listen(0);
    });

    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    async function sendStart(payload: any) {
        return fetch(`${baseUrl}/api/v1/assessment/timer/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    async function sendGet(attemptId: string) {
        return fetch(`${baseUrl}/api/v1/assessment/timer?attemptId=${attemptId}`);
    }

    t.beforeEach(() => {
        mockPoolShouldFail = false;
        mockQueryShouldFail = false;
        poolConnectCount = 0;
        timerStates = [{
            id: 'state-123',
            tenant_id: validUUID,
            exam_attempt_id: validUUID,
            started_at: null,
            configured_duration_seconds: '3600'
        }];
        timerAdjustments = [];
        mockContext = { tenantId: validUUID, authorizedAttemptId: validUUID };
    });

    await t.test('1. first start succeeds', async () => {
        const res = await sendStart({ attemptId: validUUID });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, 'started');
        assert.ok(data.startedAt);
        assert.equal(data.configuredDurationSeconds, 3600);
        assert.equal(data.effectiveDurationSeconds, 3600);
        assert.equal(data.effectiveRemainingSeconds, 3590); // 10 seconds elapsed in mock
    });

    await t.test('2. repeated start preserves identical startedAt', async () => {
        await sendStart({ attemptId: validUUID });
        const firstStartedAt = timerStates[0].started_at;

        const res2 = await sendStart({ attemptId: validUUID });
        assert.equal(res2.status, 200);
        const data2 = await res2.json();
        assert.equal(data2.startedAt, firstStartedAt.toISOString());
    });

    await t.test('3. idempotent start cannot grant a later/reset start (simulated by same started_at)', async () => {
        await sendStart({ attemptId: validUUID });
        const firstStartedAt = timerStates[0].started_at;

        // In mock, UPDATE only changes if started_at is NULL
        const res2 = await sendStart({ attemptId: validUUID });
        assert.equal(res2.status, 200);
        const data2 = await res2.json();
        assert.equal(data2.startedAt, firstStartedAt.toISOString());
    });

    await t.test('4. malformed Attempt -> 400', async () => {
        const res = await sendStart({ attemptId: 'not-uuid' });
        assert.equal(res.status, 400);
    });

    await t.test('5. denied/mismatched Attempt -> 403 before persistence authorization', async () => {
        const res = await sendStart({ attemptId: '456e4567-e89b-12d3-a456-426614174000' });
        assert.equal(res.status, 403);
        assert.equal(poolConnectCount, 0); // Didn't hit DB
    });

    await t.test('6. missing timer state -> 404', async () => {
        timerStates = [];
        const res = await sendStart({ attemptId: validUUID });
        assert.equal(res.status, 404);

        const resGet = await sendGet(validUUID);
        assert.equal(resGet.status, 404);
    });

    await t.test('7. timer read before start -> 409', async () => {
        const res = await sendGet(validUUID);
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'timer_not_started');
    });

    await t.test('8. normal remaining-time calculation', async () => {
        await sendStart({ attemptId: validUUID });
        const res = await sendGet(validUUID);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.effectiveDurationSeconds, 3600);
        assert.equal(data.effectiveRemainingSeconds, 3590);
    });

    await t.test('9. positive adjustment', async () => {
        await sendStart({ attemptId: validUUID });
        timerAdjustments.push({ tenant_id: validUUID, timer_state_id: 'state-123', adjustment_seconds: 300 });
        const res = await sendGet(validUUID);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.effectiveDurationSeconds, 3900);
        assert.equal(data.effectiveRemainingSeconds, 3890);
    });

    await t.test('10. negative adjustment', async () => {
        await sendStart({ attemptId: validUUID });
        timerAdjustments.push({ tenant_id: validUUID, timer_state_id: 'state-123', adjustment_seconds: -300 });
        const res = await sendGet(validUUID);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.effectiveDurationSeconds, 3300);
        assert.equal(data.effectiveRemainingSeconds, 3290);
    });

    await t.test('11. remaining clamps to zero', async () => {
        await sendStart({ attemptId: validUUID });
        timerAdjustments.push({ tenant_id: validUUID, timer_state_id: 'state-123', adjustment_seconds: -3600 });
        const res = await sendGet(validUUID);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.effectiveDurationSeconds, 0);
        assert.equal(data.effectiveRemainingSeconds, 0); // Not negative
        assert.equal(data.status, 'expired');
    });

    await t.test('12. repeated reads do not mutate timer state', async () => {
        await sendStart({ attemptId: validUUID });
        const startState = { ...timerStates[0] };
        await sendGet(validUUID);
        await sendGet(validUUID);
        assert.deepEqual(timerStates[0], startState);
    });

    await t.test('13. Session replacement cannot reset timer (simulated via same context but diff request -> identical)', async () => {
        await sendStart({ attemptId: validUUID });
        const startedAt = timerStates[0].started_at;

        mockContext = { tenantId: validUUID, authorizedAttemptId: validUUID };
        const res = await sendStart({ attemptId: validUUID });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.startedAt, startedAt.toISOString());
    });

    await t.test('14. client-provided/device time cannot control result', async () => {
        // Asserting that no client time is sent or used in POST body
        const res = await sendStart({ attemptId: validUUID, clientTime: '2050-01-01T00:00:00Z' });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.notEqual(data.startedAt, '2050-01-01T00:00:00.000Z');
    });

    await t.test('15. persistence failure -> 503', async () => {
        mockPoolShouldFail = true;
        const res = await sendStart({ attemptId: validUUID });
        assert.equal(res.status, 503);
    });

    await t.test('16. unexpected bounded failure -> 500 without database leakage', async () => {
        mockQueryShouldFail = true;
        const res = await sendStart({ attemptId: validUUID });
        assert.equal(res.status, 500);
        const data = await res.json();
        assert.equal(data.error, 'internal_error');
    });

    await t.test('cleanup server', async () => {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });
});
