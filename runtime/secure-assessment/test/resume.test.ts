import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { handleResumeGet, type ResumeDependencies } from '../src/resume.ts';

class MockReq {
    method = 'GET';
    url = '';
    headers: any = {};
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

test('resume tests', async (t) => {
    const validAttemptId = '11111111-2222-4333-8444-555555555555';
    const tenantId = 'tenant-1';

    let mockPoolConnectError: Error | null = null;
    let simulateQueryError = false;

    // Database state
    let attempts: any[] = [{ id: validAttemptId, tenant_id: tenantId }];
    let answers: any[] = [];
    let timers: any[] = [];
    let submissions: any[] = [];

    const mockClient = {
        query: async (queryText: string, params: any[]) => {
            if (simulateQueryError) throw new Error('Simulated query error');

            if (queryText.startsWith('BEGIN')) return { rows: [] };
            if (queryText.startsWith('COMMIT')) return { rows: [] };
            if (queryText.startsWith('ROLLBACK')) return { rows: [] };

            if (queryText.includes('SELECT id FROM secure_assessment_exam_attempts')) {
                const id = params[0];
                const tid = params[1];
                const row = attempts.find(a => a.id === id && a.tenant_id === tid);
                return { rows: row ? [row] : [] };
            }

            if (queryText.includes('FROM secure_assessment_exam_answers')) {
                const tid = params[0];
                const attemptId = params[1];
                const rows = answers.filter(a => a.tenant_id === tid && a.exam_attempt_id === attemptId);
                return {
                    rows: rows.map(r => ({
                        snapshotId: r.exam_question_snapshot_id,
                        answerPayload: r.answer_payload,
                        clientWriteIdentity: r.client_write_identity,
                        writeVersion: r.write_version.toString(),
                        updatedAt: r.updated_at
                    }))
                };
            }

            if (queryText.includes('FROM secure_assessment_timer_state')) {
                const tid = params[0];
                const attemptId = params[1];
                const row = timers.find(t => t.tenant_id === tid && t.exam_attempt_id === attemptId);
                return { rows: row ? [row] : [] };
            }

            if (queryText.includes('FROM secure_assessment_exam_submissions')) {
                const tid = params[0];
                const attemptId = params[1];
                const row = submissions.find(s => s.tenant_id === tid && s.exam_attempt_id === attemptId);
                return { rows: row ? [row] : [] };
            }

            return { rows: [] };
        },
        release: () => {}
    };

    const deps: ResumeDependencies = {
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
        mockPoolConnectError = null;
        simulateQueryError = false;
        attempts = [{ id: validAttemptId, tenant_id: tenantId }];
        answers = [];
        timers = [];
        submissions = [];
    };

    const getReq = (attemptIdParam?: string, noContext = false) => {
        const req = new MockReq();
        let url = '/api/v1/assessment/resume';
        if (attemptIdParam) {
            url += `?attemptId=${attemptIdParam}`;
        }
        req.url = url;
        if (noContext) {
            req.headers = { 'x-no-context': 'true' };
        }
        return req;
    };

    await t.test('1. Valid resume with no answers, not started timer, not submitted', async () => {
        reset();
        timers.push({ tenant_id: tenantId, exam_attempt_id: validAttemptId, started_at: null });
        
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.attemptId, validAttemptId);
        assert.deepEqual(data.answers, []);
        assert.deepEqual(data.timer, { status: 'not_started' });
        assert.deepEqual(data.submission, { status: 'not_submitted' });
    });

    await t.test('2. Valid resume with answers, active timer, submitted', async () => {
        reset();
        answers.push({
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            exam_question_snapshot_id: '11111111-2222-3333-4444-555555555555',
            answer_payload: { choice: 'A' },
            client_write_identity: 'identity-1',
            write_version: 1,
            updated_at: new Date('2026-08-26T12:00:00Z')
        });
        timers.push({
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            started_at: new Date('2026-08-26T11:00:00Z'),
            configured_duration_seconds: '3600',
            total_adjustment: '0',
            elapsed_seconds: 1800
        });
        submissions.push({
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            id: 'sub-id',
            submitted_at: new Date('2026-08-26T12:00:00Z')
        });

        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);

        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.answers.length, 1);
        assert.equal(data.answers[0].snapshotId, '11111111-2222-3333-4444-555555555555');
        assert.equal(data.answers[0].writeVersion, 1);
        
        assert.equal(data.timer.status, 'active');
        assert.equal(data.timer.effectiveDurationSeconds, 3600);
        assert.equal(data.timer.effectiveRemainingSeconds, 1800);

        assert.equal(data.submission.status, 'submitted');
        assert.equal(data.submission.submissionId, 'sub-id');
    });

    await t.test('3. Invalid attemptId -> 400', async () => {
        reset();
        const req = getReq('invalid');
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 400);
    });

    await t.test('4. Missing context -> 403', async () => {
        reset();
        const req = getReq(validAttemptId, true);
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 403);
    });

    await t.test('5. Attempt mismatch -> 403', async () => {
        reset();
        const req = getReq('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 403);
    });

    await t.test('6. Nonexistent Attempt -> 404', async () => {
        reset();
        attempts = []; // clear attempt
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 404);
    });

    await t.test('7. Missing timer state -> 404', async () => {
        reset();
        // timers is empty
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 404);
    });

    await t.test('8. DB Error -> 503', async () => {
        reset();
        simulateQueryError = true;
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 503);
    });

    await t.test('9. Pool Connect Error -> 503', async () => {
        reset();
        mockPoolConnectError = new Error('db down');
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 503);
    });

    await t.test('10. Context exception -> 500', async () => {
        reset();
        const depsThrow: ResumeDependencies = {
            ...deps,
            getAuthorizedContext: () => { throw new Error('Secret internal DB failure'); }
        };
        const req = getReq(validAttemptId);
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, depsThrow);
        assert.equal(res.statusCode, 500);
    });

    await t.test('11. Unsupported method -> 405', async () => {
        reset();
        const req = getReq(validAttemptId);
        req.method = 'POST';
        const res = new MockRes();
        await handleResumeGet(req as any, res as any, deps);
        assert.equal(res.statusCode, 405);
    });
});
