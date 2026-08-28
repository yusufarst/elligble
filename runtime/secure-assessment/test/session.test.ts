import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { handleSessionActivate } from '../src/session.ts';

function createMockReq(method: string, bodyObj?: any) {
    const req: any = { method };
    req.on = (event: string, callback: any) => {
        if (event === 'data' && bodyObj) {
            callback(Buffer.from(JSON.stringify(bodyObj)));
        }
        if (event === 'end') {
            callback();
        }
    };
    return req;
}

function createMockRes() {
    let statusCode = 200;
    let endedData = '';
    return {
        writeHead: (code: number, headers: any) => {
            statusCode = code;
        },
        end: (data: string) => {
            endedData = data;
        },
        getStatusCode: () => statusCode,
        getEndedData: () => endedData
    } as any;
}

function createMockPool(queries: any[]): any {
    return {
        connect: async () => {
            let qIndex = 0;
            let transactionState = 0;
            return {
                query: async (q: string, params?: any[]) => {
                    if (q === 'BEGIN') {
                        transactionState = 1;
                        return;
                    }
                    if (q === 'COMMIT' || q === 'ROLLBACK') {
                        transactionState = 0;
                        return;
                    }
                    const def = queries[qIndex++];
                    if (def && def.error) {
                        throw new Error('db error');
                    }
                    return def ? def.result : { rows: [] };
                },
                release: () => {
                    if (transactionState !== 0) throw new Error('Transaction leaked');
                }
            };
        }
    };
}

test('Session Activate tests', async (t) => {
    const ctx = { tenantId: 'tenant1', authorizedAttemptId: 'attempt1' } as any;

    await t.test('1. non-POST -> 405', async () => {
        const req = createMockReq('GET');
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 405);
    });

    await t.test('2. malformed/invalid body -> 400', async () => {
        const req: any = { method: 'POST' };
        req.on = (event: string, callback: any) => {
            if (event === 'data') callback(Buffer.from('{bad_json'));
            if (event === 'end') callback();
        };
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('3. invalid attemptId/sessionId -> 400', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1' });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('4. confirmSupersede true without valid expectedActiveSessionId -> 400', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess1', confirmSupersede: true });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('6. attempt mismatch -> 403', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt2', sessionId: 'sess1' });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 403);
    });

    await t.test('7. DB connect failure -> 503', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess1' });
        const res = createMockRes();
        const pool = { connect: async () => { throw new Error('db down'); } };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 503);
    });

    await t.test('8. DB transaction/query failure -> 503', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess1' });
        const res = createMockRes();
        const pool = createMockPool([{ error: true }]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 503);
    });

    await t.test('9. Attempt not found -> 404', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess1' });
        const res = createMockRes();
        const pool = createMockPool([{ result: { rows: [] } }]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 404);
    });

    await t.test('10. already submitted Attempt -> 409', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess1' });
        const res = createMockRes();
        const pool = createMockPool([
            { result: { rows: [{ id: 'attempt1' }] } }, // Lock Attempt
            { result: { rows: [{ id: 'sub1' }] } } // Check Submission
        ]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 409);
        assert.deepEqual(JSON.parse(res.getEndedData()), { error: 'attempt_already_submitted' });
    });

    await t.test('11 & 12. first activation -> 200 active', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess1' });
        const res = createMockRes();
        const ts = new Date();
        const pool = createMockPool([
            { result: { rows: [{ id: 'attempt1' }] } },
            { result: { rows: [] } }, // submission
            { result: { rows: [] } }, // target session
            { result: { rows: [] } }, // current active
            { result: { rows: [{ ts }] } }, // ts
            { result: { rows: [] } }, // insert
        ]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 200);
        assert.deepEqual(JSON.parse(res.getEndedData()), {
            status: 'active',
            sessionId: 'sess1',
            activatedAt: ts.toISOString()
        });
    });

    await t.test('13. same session retry -> same activatedAt / zero mutation', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess1' });
        const res = createMockRes();
        const ts = new Date();
        const pool = createMockPool([
            { result: { rows: [{ id: 'attempt1' }] } },
            { result: { rows: [] } }, // submission
            { result: { rows: [{ id: 'sess1', exam_attempt_id: 'attempt1', activated_at: ts, ended_at: null, superseded_by_session_id: null }] } }, // target session
            { result: { rows: [{ id: 'sess1', activated_at: ts }] } }, // current active
        ]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 200);
        assert.deepEqual(JSON.parse(res.getEndedData()), {
            status: 'active',
            sessionId: 'sess1',
            activatedAt: ts.toISOString()
        });
    });

    await t.test('14. different active Session without confirmation -> 409', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess2' });
        const res = createMockRes();
        const ts = new Date();
        const pool = createMockPool([
            { result: { rows: [{ id: 'attempt1' }] } },
            { result: { rows: [] } }, // submission
            { result: { rows: [] } }, // target session
            { result: { rows: [{ id: 'sess1', activated_at: ts }] } }, // current active
        ]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 409);
        assert.deepEqual(JSON.parse(res.getEndedData()), {
            error: 'active_session_exists',
            activeSessionId: 'sess1'
        });
    });

    await t.test('16. stale/wrong expected active Session -> 409', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess2', confirmSupersede: true, expectedActiveSessionId: 'stale' });
        const res = createMockRes();
        const ts = new Date();
        const pool = createMockPool([
            { result: { rows: [{ id: 'attempt1' }] } },
            { result: { rows: [] } }, // submission
            { result: { rows: [] } }, // target session
            { result: { rows: [{ id: 'sess1', activated_at: ts }] } }, // current active
        ]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 409);
        assert.deepEqual(JSON.parse(res.getEndedData()), {
            error: 'active_session_changed'
        });
    });

    await t.test('17-22. confirmed supersession -> 200', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess2', confirmSupersede: true, expectedActiveSessionId: 'sess1' });
        const res = createMockRes();
        const ts = new Date();
        const tsNew = new Date(Date.now() + 1000);
        const pool = createMockPool([
            { result: { rows: [{ id: 'attempt1' }] } },
            { result: { rows: [] } }, // submission
            { result: { rows: [] } }, // target session
            { result: { rows: [{ id: 'sess1', activated_at: ts }] } }, // current active
            { result: { rows: [{ ts: tsNew }] } }, // ts
            { result: { rows: [] } }, // update old
            { result: { rows: [] } }, // insert new
        ]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 200);
        assert.deepEqual(JSON.parse(res.getEndedData()), {
            status: 'active',
            sessionId: 'sess2',
            activatedAt: tsNew.toISOString(),
            supersededSessionId: 'sess1'
        });
    });

    await t.test('24. ended target Session -> 409 session_not_activatable', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess2', confirmSupersede: true, expectedActiveSessionId: 'sess1' });
        const res = createMockRes();
        const pool = createMockPool([
            { result: { rows: [{ id: 'attempt1' }] } },
            { result: { rows: [] } }, // submission
            { result: { rows: [{ id: 'sess2', exam_attempt_id: 'attempt1', ended_at: new Date(), superseded_by_session_id: null }] } }, // target session
        ]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 409);
        assert.deepEqual(JSON.parse(res.getEndedData()), {
            error: 'session_not_activatable'
        });
    });

    await t.test('25. target Session from another Attempt -> bounded rejection', async () => {
        const req = createMockReq('POST', { attemptId: 'attempt1', sessionId: 'sess2', confirmSupersede: true, expectedActiveSessionId: 'sess1' });
        const res = createMockRes();
        const pool = createMockPool([
            { result: { rows: [{ id: 'attempt1' }] } },
            { result: { rows: [] } }, // submission
            { result: { rows: [{ id: 'sess2', exam_attempt_id: 'attempt2', ended_at: null, superseded_by_session_id: null }] } }, // target session
        ]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 409);
        assert.deepEqual(JSON.parse(res.getEndedData()), {
            error: 'session_not_activatable'
        });
    });
});
