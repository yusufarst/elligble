import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { handleSubmit, handleSubmissionGet, type SubmissionDependencies } from '../src/submission.ts';

// Mock request and response
class MockReq {
    method = 'POST';
    url = '/api/v1/assessment/submit';
    headers: any = {};
    dataCb: (chunk: string) => void = () => {};
    endCb: () => void = () => {};
    
    on(event: string, cb: any) {
        if (event === 'data') this.dataCb = cb;
        if (event === 'end') this.endCb = cb;
    }
    
    send(body: any) {
        if (body) {
            this.dataCb(JSON.stringify(body));
        } else if (body === '') {
            this.dataCb('');
        }
        this.endCb();
    }
    
    sendRaw(body: string) {
        this.dataCb(body);
        this.endCb();
    }
}

class MockRes {
    statusCode = 200;
    headers: any = {};
    body = '';
    onEnd: () => void = () => {};
    endPromise = new Promise<void>(resolve => { this.onEnd = resolve; });
    
    writeHead(status: number, headers: any) {
        this.statusCode = status;
        this.headers = headers;
    }
    
    end(chunk: string) {
        this.body = chunk;
        this.onEnd();
    }
}

test('submission tests', async (t) => {
    
    const validAttemptId = '11111111-2222-4333-8444-555555555555';
    const otherAttemptId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const tenantId = 'tenant-1';
    
    let mockPoolConnectError: Error | null = null;
    let queries: any[] = [];
    
    // In-memory state for mocks
    let attempts: any[] = [
        { id: validAttemptId, tenant_id: tenantId },
        { id: otherAttemptId, tenant_id: 'tenant-2' }
    ];
    let submissions: any[] = [];
    
    // Simulating specific error states
    let simulateConflict = false;
    let simulateImpossibleConflict = false;
    let simulateQueryError = false;
    let simulateRollbackError = false;

    const mockClient = {
        query: async (queryText: string, params: any[]) => {
            queries.push({ queryText, params });
            if (simulateQueryError) throw new Error('Simulated query error');
            
            if (queryText.startsWith('BEGIN')) return { rows: [] };
            if (queryText.startsWith('COMMIT')) return { rows: [] };
            if (queryText.startsWith('ROLLBACK')) {
                if (simulateRollbackError) throw new Error('Simulated rollback error');
                return { rows: [] };
            }
            
            if (queryText.includes('SELECT id FROM secure_assessment_exam_attempts')) {
                const id = params[0];
                const tid = params[1];
                const row = attempts.find(a => a.id === id && a.tenant_id === tid);
                return { rows: row ? [row] : [] };
            }
            
            if (queryText.includes('INSERT INTO secure_assessment_exam_submissions')) {
                if (simulateConflict || simulateImpossibleConflict) {
                    return { rows: [] }; // Simulate ON CONFLICT DO NOTHING trigger without returning row
                }
                const tid = params[0];
                const attemptId = params[1];
                const existing = submissions.find(s => s.tenant_id === tid && s.exam_attempt_id === attemptId);
                if (existing) {
                    return { rows: [] }; // DO NOTHING
                }
                const newSub = { id: 'sub-uuid', tenant_id: tid, exam_attempt_id: attemptId, submitted_at: new Date('2026-08-26T12:00:00Z') };
                submissions.push(newSub);
                return { rows: [newSub] };
            }
            
            if (queryText.includes('SELECT id, submitted_at FROM secure_assessment_exam_submissions')) {
                const tid = params[0];
                const attemptId = params[1];
                if (simulateImpossibleConflict) {
                    return { rows: [] };
                }
                if (simulateConflict) {
                    const fakeRow = { id: 'existing-sub-id', submitted_at: new Date('2026-01-01T00:00:00Z') };
                    return { rows: [fakeRow] };
                }
                const row = submissions.find(s => s.tenant_id === tid && s.exam_attempt_id === attemptId);
                return { rows: row ? [row] : [] };
            }
            
            return { rows: [] };
        },
        release: () => {}
    };

    const deps: SubmissionDependencies = {
        pool: {
            connect: async () => {
                if (mockPoolConnectError) throw mockPoolConnectError;
                return mockClient;
            }
        } as any,
        getAuthorizedContext: (req) => {
            const h = (req as any).headers || {};
            if (h['x-no-context']) return null;
            if (h['x-wrong-context']) return { tenantId: 'tenant-wrong', authorizedAttemptId: '00000000-0000-0000-0000-000000000000' };
            return { tenantId, authorizedAttemptId: validAttemptId };
        }
    };
    
    const reset = () => {
        queries = [];
        mockPoolConnectError = null;
        submissions = [];
        simulateConflict = false;
        simulateImpossibleConflict = false;
        simulateQueryError = false;
        simulateRollbackError = false;
    };

    await t.test('1. first submission -> 200 authoritative receipt, 2. returned id, 3. returned submitted_at', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId });
        await res.endPromise;
        
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'submitted');
        assert.equal(data.submissionId, 'sub-uuid');
        assert.equal(data.submittedAt, '2026-08-26T12:00:00.000Z');
        
        // tenant from context used (req 29)
        const insertQuery = queries.find(q => q.queryText.includes('INSERT'));
        assert.equal(insertQuery.params[0], tenantId);
    });

    await t.test('4. retry -> same submissionId, 5. retry -> same submittedAt, 6. no second logical submission', async () => {
        reset();
        submissions.push({ id: 'existing-sub', tenant_id: tenantId, exam_attempt_id: validAttemptId, submitted_at: new Date('2026-02-02T02:02:02Z') });
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId });
        await res.endPromise;
        
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.submissionId, 'existing-sub');
        assert.equal(data.submittedAt, '2026-02-02T02:02:02.000Z');
        assert.equal(submissions.length, 1);
    });

    await t.test('7. simulated uniqueness collision -> authoritative re-read, 8. equals existing row', async () => {
        reset();
        simulateConflict = true;
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId });
        await res.endPromise;
        
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.submissionId, 'existing-sub-id');
        assert.equal(data.submittedAt, '2026-01-01T00:00:00.000Z');
    });
    
    await t.test('9. different authorized Attempts can be logically independent', async () => {
        reset();
        submissions.push({ id: 'other-sub', tenant_id: 'tenant-2', exam_attempt_id: otherAttemptId, submitted_at: new Date('2026-03-03T03:03:03Z') });
        
        // This requires auth context to match otherAttemptId
        const deps2: SubmissionDependencies = {
            ...deps,
            getAuthorizedContext: () => ({ tenantId: 'tenant-2', authorizedAttemptId: otherAttemptId })
        };
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps2);
        req.send({ attemptId: otherAttemptId });
        await res.endPromise;
        
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.submissionId, 'other-sub');
    });

    await t.test('10. malformed JSON -> 400', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.sendRaw('{ malformed');
        await res.endPromise;
        assert.equal(res.statusCode, 400);
    });

    await t.test('10b. null JSON payload -> 400', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.sendRaw('null');
        await res.endPromise;
        assert.equal(res.statusCode, 400);
        assert.equal(queries.length, 0); // Proof no persistence invoked
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'invalid_request' });
    });

    await t.test('10c. array JSON payload -> 400', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.sendRaw('[]');
        await res.endPromise;
        assert.equal(res.statusCode, 400);
        assert.equal(queries.length, 0);
    });

    await t.test('10d. string JSON payload -> 400', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.sendRaw('"string"');
        await res.endPromise;
        assert.equal(res.statusCode, 400);
        assert.equal(queries.length, 0);
    });

    await t.test('10e. number JSON payload -> 400', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.sendRaw('123');
        await res.endPromise;
        assert.equal(res.statusCode, 400);
        assert.equal(queries.length, 0);
    });

    await t.test('11. invalid attemptId -> 400', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: 'not-a-uuid' });
        await res.endPromise;
        assert.equal(res.statusCode, 400);
    });

    await t.test('12. missing attemptId -> 400', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({});
        await res.endPromise;
        assert.equal(res.statusCode, 400);
    });

    await t.test('13. missing context -> 403', async () => {
        reset();
        const req = new MockReq();
        req.headers = { 'x-no-context': 'true' };
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId });
        await res.endPromise;
        assert.equal(res.statusCode, 403);
    });

    await t.test('14. Attempt/context mismatch -> 403', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: otherAttemptId }); // does not match context validAttemptId
        await res.endPromise;
        assert.equal(res.statusCode, 403);
    });

    await t.test('15. nonexistent tenant-bound Attempt -> 404', async () => {
        reset();
        const deps2: SubmissionDependencies = {
            ...deps,
            getAuthorizedContext: () => ({ tenantId: tenantId, authorizedAttemptId: '33333333-3333-4333-8333-333333333333' })
        };
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps2);
        req.send({ attemptId: '33333333-3333-4333-8333-333333333333' });
        await res.endPromise;
        assert.equal(res.statusCode, 404);
    });

    await t.test('16. inaccessible/cross-tenant Attempt -> 404', async () => {
        reset();
        const deps2: SubmissionDependencies = {
            ...deps,
            getAuthorizedContext: () => ({ tenantId: tenantId, authorizedAttemptId: otherAttemptId }) // otherAttemptId belongs to tenant-2
        };
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps2);
        req.send({ attemptId: otherAttemptId });
        await res.endPromise;
        assert.equal(res.statusCode, 404); // fails tenant check in DB
    });

    await t.test('17. pool connect failure -> 503', async () => {
        reset();
        mockPoolConnectError = new Error('db down');
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId });
        await res.endPromise;
        assert.equal(res.statusCode, 503);
    });

    await t.test('18. query/persistence failure -> 503', async () => {
        reset();
        simulateQueryError = true;
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId });
        await res.endPromise;
        assert.equal(res.statusCode, 503);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'persistence_unavailable' });
    });

    await t.test('19. impossible conflict re-read state -> 500', async () => {
        reset();
        simulateImpossibleConflict = true;
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId });
        await res.endPromise;
        assert.equal(res.statusCode, 500);
    });

    await t.test('20. POST unsupported method -> 405', async () => {
        reset();
        const req = new MockReq();
        req.method = 'GET';
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        await res.endPromise;
        assert.equal(res.statusCode, 405);
    });
    
    // GET Tests

    const getReq = (attemptIdParam?: string, noContext = false) => {
        const req = new MockReq();
        req.method = 'GET';
        let url = '/api/v1/assessment/submission';
        if (attemptIdParam) {
            url += `?attemptId=${attemptIdParam}`;
        }
        req.url = url;
        if (noContext) {
            req.headers = { 'x-no-context': 'true' };
        }
        return req;
    };

    await t.test('21. GET authorized existing Attempt + no row -> 200 not_submitted', async () => {
        reset();
        const req = getReq(validAttemptId);
        const res = new MockRes();
        const promise = handleSubmissionGet(req as any, res as any, deps);
        await res.endPromise;
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'not_submitted');
    });

    await t.test('22. GET existing Submission -> exact persisted receipt', async () => {
        reset();
        submissions.push({ id: 'my-get-sub', tenant_id: tenantId, exam_attempt_id: validAttemptId, submitted_at: new Date('2026-05-05T05:05:05Z') });
        const req = getReq(validAttemptId);
        const res = new MockRes();
        const promise = handleSubmissionGet(req as any, res as any, deps);
        await res.endPromise;
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'submitted');
        assert.equal(data.submissionId, 'my-get-sub');
        assert.equal(data.submittedAt, '2026-05-05T05:05:05.000Z');
    });

    await t.test('23. GET invalid/missing attemptId -> 400', async () => {
        reset();
        const req1 = getReq(); // missing
        const res1 = new MockRes();
        await handleSubmissionGet(req1 as any, res1 as any, deps);
        assert.equal(res1.statusCode, 400);

        const req2 = getReq('invalid'); // invalid
        const res2 = new MockRes();
        await handleSubmissionGet(req2 as any, res2 as any, deps);
        assert.equal(res2.statusCode, 400);
    });

    await t.test('24. GET missing context -> 403', async () => {
        reset();
        const req = getReq(validAttemptId, true);
        const res = new MockRes();
        await handleSubmissionGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 403);
    });

    await t.test('25. GET mismatch -> 403', async () => {
        reset();
        const req = getReq(otherAttemptId);
        const res = new MockRes();
        await handleSubmissionGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 403);
    });

    await t.test('26. GET nonexistent/inaccessible Attempt -> 404', async () => {
        reset();
        const missingId = '44444444-4444-4444-8444-444444444444';
        const deps2: SubmissionDependencies = {
            ...deps,
            getAuthorizedContext: () => ({ tenantId, authorizedAttemptId: missingId })
        };
        const req = getReq(missingId);
        const res = new MockRes();
        await handleSubmissionGet(req as any, res as any, deps2);
        assert.equal(res.statusCode, 404);
    });

    await t.test('27. GET persistence unavailable -> 503', async () => {
        reset();
        mockPoolConnectError = new Error('db down');
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleSubmissionGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 503);
    });

    await t.test('28. GET unsupported method -> 405', async () => {
        reset();
        const req = getReq(validAttemptId);
        req.method = 'POST';
        const res = new MockRes();
        await handleSubmissionGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 405);
    });
    
    await t.test('27b. GET query/persistence failure -> 503', async () => {
        reset();
        simulateQueryError = true;
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleSubmissionGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 503);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'persistence_unavailable' });
    });

    await t.test('A. NO CLIENT IDEMPOTENCY KEY REQUIRED', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId }); // Only attemptId
        await res.endPromise;
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'submitted');
    });

    await t.test('B. CLIENT submitted_at IS NOT AUTHORITATIVE', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId, submitted_at: '1999-01-01T00:00:00Z', submittedAt: '1999-01-01T00:00:00Z' });
        await res.endPromise;
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.submittedAt, '2026-08-26T12:00:00.000Z'); // The one generated by mock DB
        
        // Also check INSERT params do NOT contain the client value
        const insertQuery = queries.find(q => q.queryText.includes('INSERT INTO secure_assessment_exam_submissions'));
        assert.ok(insertQuery);
        assert.equal(insertQuery.params.length, 2); // only tenantId and attemptId
    });

    await t.test('C. CLIENT TENANT DATA IS NOT AUTHORITATIVE', async () => {
        reset();
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps);
        req.send({ attemptId: validAttemptId, tenantId: 'tenant-malicious', tenant_id: 'tenant-malicious' });
        await res.endPromise;
        assert.equal(res.statusCode, 200);
        
        const insertQuery = queries.find(q => q.queryText.includes('INSERT INTO secure_assessment_exam_submissions'));
        assert.equal(insertQuery.params[0], tenantId); // context.tenantId used
    });

    await t.test('TEST A: ROLLBACK FAILURE AFTER NOT-FOUND -> 503', async () => {
        reset();
        const deps2: SubmissionDependencies = {
            ...deps,
            getAuthorizedContext: () => ({ tenantId, authorizedAttemptId: '33333333-3333-4333-8333-333333333333' })
        };
        simulateRollbackError = true;
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, deps2);
        req.send({ attemptId: '33333333-3333-4333-8333-333333333333' });
        await res.endPromise;
        assert.equal(res.statusCode, 503);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'persistence_unavailable' });
    });

    await t.test('TEST B: POST CONTEXT PROVIDER THROWS -> 500 without details', async () => {
        reset();
        const depsThrow: SubmissionDependencies = {
            ...deps,
            getAuthorizedContext: () => { throw new Error('Secret internal DB failure'); }
        };
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, depsThrow);
        req.send({ attemptId: validAttemptId });
        await res.endPromise;
        assert.equal(res.statusCode, 500);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'internal_error' });
    });

    await t.test('TEST C: GET CONTEXT PROVIDER THROWS -> 500 without details', async () => {
        reset();
        const depsThrow: SubmissionDependencies = {
            ...deps,
            getAuthorizedContext: () => { throw new Error('Secret internal DB failure'); }
        };
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleSubmissionGet(req as any, res as any, depsThrow);
        assert.equal(res.statusCode, 500);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'internal_error' });
    });

    await t.test('TEST D: POST REQUEST VALIDATION OCCURS BEFORE CONTEXT ACQUISITION', async () => {
        reset();
        let contextCalls = 0;
        const depsProof: SubmissionDependencies = {
            ...deps,
            getAuthorizedContext: () => {
                contextCalls++;
                throw new Error('Should not be called');
            }
        };
        const req = new MockReq();
        const res = new MockRes();
        const promise = handleSubmit(req as any, res as any, depsProof);
        req.send({ attemptId: 'not-a-uuid' });
        await res.endPromise;
        assert.equal(res.statusCode, 400);
        assert.equal(contextCalls, 0);
        assert.equal(queries.length, 0);
        const data = JSON.parse(res.body);
        assert.deepEqual(data, { error: 'invalid_request' });
    });
});
