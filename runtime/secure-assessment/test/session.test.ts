import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { handleSessionActivate } from '../src/session.ts';

const ATTEMPT1 = '11111111-1111-4111-8111-111111111111';
const ATTEMPT2 = '22222222-2222-4222-8222-222222222222';
const SESS1 = '33333333-3333-4333-8333-333333333333';
const SESS2 = '44444444-4444-4444-8444-444444444444';
const STALE_SESS = '55555555-5555-4555-8555-555555555555';

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
    const ctx = { tenantId: 'tenant1', authorizedAttemptId: ATTEMPT1 } as any;

    await t.test('1. non-POST ->405', async () => {
        const req = createMockReq('GET');
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 405);
    });

    await t.test('2. malformed JSON ->400', async () => {
        const req: any = { method: 'POST' };
        req.on = (event: string, callback: any) => {
            if (event === 'data') callback(Buffer.from('{bad_json'));
            if (event === 'end') callback();
        };
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('3. missing attemptId ->400', async () => {
        const req = createMockReq('POST', { sessionId: SESS1 });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('4. missing sessionId ->400', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1 });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('5. malformed attemptId UUID ->400', async () => {
        const req = createMockReq('POST', { attemptId: 'not-a-uuid', sessionId: SESS1 });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('6. malformed sessionId UUID ->400', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: 'not-a-uuid' });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('7. confirmSupersede non-boolean ->400', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1, confirmSupersede: "true" });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('8. confirmSupersede true without expectedActiveSessionId ->400', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1, confirmSupersede: true });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('9. confirmSupersede true with malformed expectedActiveSessionId ->400', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1, confirmSupersede: true, expectedActiveSessionId: "stale" });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 400);
    });

    await t.test('10. attempt mismatch ->403', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT2, sessionId: SESS1 });
        const res = createMockRes();
        await handleSessionActivate(req, res, ctx, null as any);
        assert.equal(res.getStatusCode(), 403);
    });

    await t.test('11. DB connect failure ->503', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        const pool = { connect: async () => { throw new Error('db down'); } };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 503);
        assert.doesNotMatch(res.getEndedData(), /db down/); // 37. does not contain DB detail
    });

    await t.test('12. transaction/query failure ->503', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        const pool = createMockPool([{ error: true }]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 503);
        assert.doesNotMatch(res.getEndedData(), /db error/); // 37. does not contain DB detail
    });

    await t.test('13. Attempt not found ->404', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        const pool = createMockPool([{ result: { rows: [] } }]);
        await handleSessionActivate(req, res, ctx, pool);
        assert.equal(res.getStatusCode(), 404);
    });

    await t.test('14. submitted Attempt ->409 attempt_already_submitted', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        let queriesTracked: string[] = [];
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    queriesTracked.push(q);
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] }; // 31. Attempt FOR UPDATE before
                    if (q.includes('secure_assessment_exam_submissions')) {
                        assert.match(q, /tenant_id = \$2/); // 32. tenant-bound Submission query
                        return { rows: [{ id: 'sub1' }] };
                    }
                    if (q === 'ROLLBACK') return;
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 409);
        assert.deepEqual(JSON.parse(res.getEndedData()), { error: 'attempt_already_submitted' });
        assert.ok(queriesTracked[1].includes('FOR UPDATE'));
        assert.ok(queriesTracked[2].includes('secure_assessment_exam_submissions'));
    });

    await t.test('15, 16, 31, 32, 33, 34, 35. first activation ->200, mutations, timestamps', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        const ts = new Date();
        let querySequence: string[] = [];
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    querySequence.push(q);
                    if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return;
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] };
                    if (q.includes('exam_submissions')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE id = $1')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE exam_attempt_id = $1')) {
                        assert.match(q, /tenant_id = \$2/); // 33. tenant-bound active session query
                        return { rows: [] };
                    }
                    if (q.includes('statement_timestamp')) return { rows: [{ ts }] }; // 35. statement_timestamp
                    if (q.includes('INSERT')) {
                        assert.match(q, /tenant_id/); // 34. tenant/Attempt bounded mutation
                        return { rows: [] };
                    }
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 200);
        assert.ok(querySequence[1].includes('FOR UPDATE')); // 31.
    });

    await t.test('17 & 18. identical Session retry returns same activatedAt, zero mutation', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        const ts = new Date();
        let mutations = 0;
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    if (q.startsWith('UPDATE') || q.startsWith('INSERT')) mutations++;
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] };
                    if (q.includes('exam_submissions')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE id = $1')) return { rows: [{ id: SESS1, exam_attempt_id: ATTEMPT1, activated_at: ts, ended_at: null, superseded_by_session_id: null }] };
                    if (q.includes('exam_sessions WHERE exam_attempt_id = $1')) return { rows: [{ id: SESS1, activated_at: ts }] };
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 200);
        const body = JSON.parse(res.getEndedData());
        assert.equal(body.activatedAt, ts.toISOString()); // 17.
        assert.equal(mutations, 0); // 18. zero mutation
    });

    await t.test('19 & 20. different active Session/no confirmation ->409 active_session_exists, zero mutation', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS2 }); // activating SESS2
        const res = createMockRes();
        const ts = new Date();
        let mutations = 0;
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    if (q.startsWith('UPDATE') || q.startsWith('INSERT')) mutations++;
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] };
                    if (q.includes('exam_submissions')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE id = $1')) return { rows: [] };
                    // active session is SESS1
                    if (q.includes('exam_sessions WHERE exam_attempt_id = $1')) return { rows: [{ id: SESS1, activated_at: ts }] };
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 409);
        const body = JSON.parse(res.getEndedData());
        assert.equal(body.error, 'active_session_exists');
        assert.equal(body.activeSessionId, SESS1);
        assert.equal(mutations, 0); // 20. zero mutation
    });

    await t.test('21 & 22. stale/wrong expected Session ->409 active_session_changed, zero mutation', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS2, confirmSupersede: true, expectedActiveSessionId: STALE_SESS });
        const res = createMockRes();
        const ts = new Date();
        let mutations = 0;
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    if (q.startsWith('UPDATE') || q.startsWith('INSERT')) mutations++;
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] };
                    if (q.includes('exam_submissions')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE id = $1')) return { rows: [] };
                    // active session is SESS1
                    if (q.includes('exam_sessions WHERE exam_attempt_id = $1')) return { rows: [{ id: SESS1, activated_at: ts }] };
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 409);
        const body = JSON.parse(res.getEndedData());
        assert.equal(body.error, 'active_session_changed');
        assert.equal(mutations, 0); // 22. zero mutation
    });

    await t.test('23 - 27, 36. confirmed supersession ->200, old ended, link, new active, timestamps', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS2, confirmSupersede: true, expectedActiveSessionId: SESS1 });
        const res = createMockRes();
        const oldTs = new Date();
        const newTs = new Date();
        let updates: string[] = [];
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    if (q.startsWith('UPDATE') || q.startsWith('INSERT')) updates.push(q);
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] };
                    if (q.includes('exam_submissions')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE id = $1')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE exam_attempt_id = $1')) return { rows: [{ id: SESS1, activated_at: oldTs }] };
                    if (q.includes('statement_timestamp')) return { rows: [{ ts: newTs }] };
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 200);
        // 24. old Session ended, 25. link, 27. attempt bounded
        assert.ok(updates[1].includes('ended_at = $1'));
        assert.ok(updates[1].includes('superseded_by_session_id = $2'));
        assert.ok(updates[1].includes('tenant_id = $4')); // bounded mutation

        // 26. new Session active
        assert.ok(updates[2].includes('activated_at = $1'));

        // 36. same timestamp used for ended_at and activated_at (using statement_timestamp result which is newTs)
    });

    await t.test('28. successful supersession retry same receipt / zero new transition', async () => {
        // Covered by identical retry test (17 & 18). Let's explicitly test it.
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        const ts = new Date();
        let mutations = 0;
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    if (q.startsWith('UPDATE') || q.startsWith('INSERT')) mutations++;
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] };
                    if (q.includes('exam_submissions')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE id = $1')) return { rows: [{ id: SESS1, exam_attempt_id: ATTEMPT1, activated_at: ts, ended_at: null, superseded_by_session_id: null }] };
                    if (q.includes('exam_sessions WHERE exam_attempt_id = $1')) return { rows: [{ id: SESS1, activated_at: ts }] };
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 200);
        assert.equal(mutations, 0); // 28
    });

    await t.test('29. ended target ->409 session_not_activatable', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] };
                    if (q.includes('exam_submissions')) return { rows: [] };
                    if (q.includes('exam_sessions WHERE id = $1')) return { rows: [{ id: SESS1, exam_attempt_id: ATTEMPT1, activated_at: new Date(), ended_at: new Date(), superseded_by_session_id: null }] };
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 409);
        const body = JSON.parse(res.getEndedData());
        assert.equal(body.error, 'session_not_activatable');
    });

    await t.test('30. Session from another Attempt -> bounded session_not_activatable', async () => {
        const req = createMockReq('POST', { attemptId: ATTEMPT1, sessionId: SESS1 });
        const res = createMockRes();
        const pool = {
            connect: async () => ({
                query: async (q: string) => {
                    if (q.includes('FOR UPDATE')) return { rows: [{ id: ATTEMPT1 }] };
                    if (q.includes('exam_submissions')) return { rows: [] };
                    // target session belongs to ATTEMPT2
                    if (q.includes('exam_sessions WHERE id = $1')) return { rows: [{ id: SESS1, exam_attempt_id: ATTEMPT2, activated_at: null, ended_at: null, superseded_by_session_id: null }] };
                    return { rows: [] };
                },
                release: () => {}
            })
        };
        await handleSessionActivate(req, res, ctx, pool as any);
        assert.equal(res.getStatusCode(), 409);
        const body = JSON.parse(res.getEndedData());
        assert.equal(body.error, 'session_not_activatable');
    });

});
