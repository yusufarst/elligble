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

test('BU-020 active-session resume tests', async (t) => {
    const validAttemptId = '11111111-2222-4333-8444-555555555555';
    const tenantId = 'tenant-1';

    let simulateQueryError = false;

    let attempts: any[] = [{ id: validAttemptId, tenant_id: tenantId }];
    let sessions: any[] = [];
    let answers: any[] = [];
    let timers: any[] = [];
    let submissions: any[] = [];
    
    let transactionCount = 0;
    let queries: { text: string, params: any[] }[] = [];

    const mockClient = {
        query: async (queryText: string, params: any[] = []) => {
            if (simulateQueryError && queryText.includes('FROM secure_assessment_exam_sessions')) {
                throw new Error('Simulated query error for session');
            }

            queries.push({ text: queryText, params });

            if (queryText.startsWith('BEGIN')) {
                transactionCount++;
                return { rows: [] };
            }
            if (queryText.startsWith('COMMIT')) return { rows: [] };
            if (queryText.startsWith('ROLLBACK')) return { rows: [] };

            if (queryText.includes('FROM secure_assessment_exam_attempts')) {
                const id = params[0];
                const tid = params[1];
                const row = attempts.find(a => a.id === id && a.tenant_id === tid);
                return { rows: row ? [row] : [] };
            }

            if (queryText.includes('FROM secure_assessment_exam_sessions')) {
                const tid = params[0];
                const attemptId = params[1];
                const rows = sessions.filter(s => 
                    s.tenant_id === tid && 
                    s.exam_attempt_id === attemptId && 
                    s.activated_at !== null && 
                    s.ended_at === null
                );
                return { rows };
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
                return mockClient;
            }
        } as any,
        getAuthorizedContext: (req) => {
            return { tenantId, authorizedAttemptId: validAttemptId };
        }
    };

    const reset = () => {
        simulateQueryError = false;
        attempts = [{ id: validAttemptId, tenant_id: tenantId }];
        sessions = [];
        answers = [];
        timers = [{ tenant_id: tenantId, exam_attempt_id: validAttemptId, started_at: null }];
        submissions = [];
        transactionCount = 0;
        queries = [];
    };

    const getReq = (attemptIdParam?: string) => {
        const req = new MockReq();
        req.url = `/api/v1/assessment/resume?attemptId=${attemptIdParam || validAttemptId}`;
        return req;
    };

    await t.test('1. no active Session -> 200 session.status none', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.session.status, 'none');
    });

    await t.test('2. no-active response contains no sessionId', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const data = JSON.parse(res.body);
        assert.equal(data.session.sessionId, undefined);
        assert.equal(data.session.activatedAt, undefined);
    });

    await t.test('3. active Session -> 200 session.status active', async () => {
        reset();
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: null
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.session.status, 'active');
    });

    await t.test('4. active response returns authoritative sessionId', async () => {
        reset();
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: null
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const data = JSON.parse(res.body);
        assert.equal(data.session.sessionId, '99999999-9999-9999-9999-999999999999');
    });

    await t.test('5. active response returns activatedAt ISO timestamp', async () => {
        reset();
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: null
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const data = JSON.parse(res.body);
        assert.equal(data.session.activatedAt, '2026-08-28T12:00:00.000Z');
    });

    await t.test('6. active Session query is tenant-bound', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const sessionQuery = queries.find(q => q.text.includes('secure_assessment_exam_sessions'));
        assert.ok(sessionQuery);
        assert.ok(sessionQuery.text.includes('tenant_id = $1'));
        assert.equal(sessionQuery.params[0], tenantId);
    });

    await t.test('7. active Session query is Attempt-bound', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const sessionQuery = queries.find(q => q.text.includes('secure_assessment_exam_sessions'));
        assert.ok(sessionQuery);
        assert.ok(sessionQuery.text.includes('exam_attempt_id = $2'));
        assert.equal(sessionQuery.params[1], validAttemptId);
    });

    await t.test('8. active Session query uses activated_at IS NOT NULL', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const sessionQuery = queries.find(q => q.text.includes('secure_assessment_exam_sessions'));
        assert.ok(sessionQuery);
        assert.ok(sessionQuery.text.includes('activated_at IS NOT NULL'));
    });

    await t.test('9. active Session query uses ended_at IS NULL', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const sessionQuery = queries.find(q => q.text.includes('secure_assessment_exam_sessions'));
        assert.ok(sessionQuery);
        assert.ok(sessionQuery.text.includes('ended_at IS NULL'));
    });

    await t.test('10. Attempt existence query occurs before active Session query', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        
        let attemptIdx = -1;
        let sessionIdx = -1;
        
        queries.forEach((q, i) => {
            if (q.text.includes('secure_assessment_exam_attempts')) attemptIdx = i;
            if (q.text.includes('secure_assessment_exam_sessions')) sessionIdx = i;
        });
        
        assert.ok(attemptIdx > -1);
        assert.ok(sessionIdx > attemptIdx);
    });

    await t.test('11. Session query occurs inside Repeatable Read read-only transaction', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        
        assert.ok(queries[0].text.includes('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'));
        
        let sessionFound = false;
        let commitFound = false;
        
        queries.forEach(q => {
            if (q.text.includes('secure_assessment_exam_sessions')) sessionFound = true;
            if (q.text.startsWith('COMMIT') && sessionFound) commitFound = true;
        });
        
        assert.ok(sessionFound);
        assert.ok(commitFound);
    });

    await t.test('12. ended Session is not returned as active', async () => {
        reset();
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: new Date('2026-08-28T12:05:00Z')
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const data = JSON.parse(res.body);
        assert.equal(data.session.status, 'none');
    });

    await t.test('13. superseded old Session is not returned', async () => {
        reset();
        sessions.push({
            id: '88888888-8888-8888-8888-888888888888',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: new Date('2026-08-28T12:05:00Z'),
            superseded_by_session_id: '99999999-9999-9999-9999-999999999999'
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const data = JSON.parse(res.body);
        assert.equal(data.session.status, 'none');
    });

    await t.test('14. old ended A1 + active A2 -> A2 returned', async () => {
        reset();
        sessions.push({
            id: '88888888-8888-8888-8888-888888888888',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: new Date('2026-08-28T12:05:00Z'),
            superseded_by_session_id: '99999999-9999-9999-9999-999999999999'
        });
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:05:00Z'),
            ended_at: null
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const data = JSON.parse(res.body);
        assert.equal(data.session.status, 'active');
        assert.equal(data.session.sessionId, '99999999-9999-9999-9999-999999999999');
    });

    await t.test('15. foreign-Attempt active Session ignored', async () => {
        reset();
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: '77777777-7777-7777-7777-777777777777', // foreign
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: null
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const data = JSON.parse(res.body);
        assert.equal(data.session.status, 'none');
    });

    await t.test('16. foreign-tenant active Session ignored', async () => {
        reset();
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: 'tenant-2', // foreign
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: null
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        const data = JSON.parse(res.body);
        assert.equal(data.session.status, 'none');
    });

    await t.test('17. no active Session does not produce 409', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.statusCode, 200);
    });

    await t.test('18. Session query database error -> 503 persistence_unavailable', async () => {
        reset();
        simulateQueryError = true;
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.statusCode, 503);
        const data = JSON.parse(res.body);
        assert.equal(data.error, 'persistence_unavailable');
    });

    await t.test('19. multiple authoritative active rows -> 500 internal_error', async () => {
        reset();
        sessions.push({
            id: '88888888-8888-8888-8888-888888888888',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: null
        });
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:05:00Z'),
            ended_at: null
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.statusCode, 500);
        const data = JSON.parse(res.body);
        assert.equal(data.error, 'internal_error');
    });

    await t.test('20. multiple-active error does not disclose Session IDs', async () => {
        reset();
        sessions.push({
            id: '88888888-8888-8888-8888-888888888888',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: null
        });
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:05:00Z'),
            ended_at: null
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.body.includes('88888888'), false);
        assert.equal(res.body.includes('99999999'), false);
    });

    await t.test('21. existing Answer readback remains unchanged', async () => {
        reset();
        answers.push({
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            exam_question_snapshot_id: '12345678-1234-1234-1234-1234567890ab',
            answer_payload: { choice: 'B' },
            client_write_identity: 'cwi-1',
            write_version: 1,
            updated_at: new Date()
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.answers.length, 1);
        assert.equal(data.answers[0].snapshotId, '12345678-1234-1234-1234-1234567890ab');
    });

    await t.test('22. existing Timer readback remains unchanged', async () => {
        reset();
        timers = [{
            tenant_id: tenantId, 
            exam_attempt_id: validAttemptId, 
            started_at: new Date(),
            configured_duration_seconds: '3600',
            total_adjustment: '0',
            elapsed_seconds: 100
        }];
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.timer.status, 'active');
        assert.equal(data.timer.configuredDurationSeconds, 3600);
    });

    await t.test('23. existing Submission readback remains unchanged', async () => {
        reset();
        submissions.push({
            id: '77777777-7777-7777-7777-777777777777',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            submitted_at: new Date()
        });
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.submission.status, 'submitted');
        assert.equal(data.submission.submissionId, '77777777-7777-7777-7777-777777777777');
    });

    await t.test('24. Resume readback performs zero INSERT/UPDATE/DELETE', async () => {
        reset();
        const res = new MockRes();
        await handleResumeGet(getReq() as any, res as any, deps);
        queries.forEach(q => {
            assert.ok(!q.text.toUpperCase().includes('INSERT INTO'));
            assert.ok(!q.text.toUpperCase().includes('UPDATE secure_assessment_'));
            assert.ok(!q.text.toUpperCase().includes('DELETE FROM'));
        });
    });

    await t.test('25. repeated Resume returns stable authoritative active Session state', async () => {
        reset();
        sessions.push({
            id: '99999999-9999-9999-9999-999999999999',
            tenant_id: tenantId,
            exam_attempt_id: validAttemptId,
            activated_at: new Date('2026-08-28T12:00:00Z'),
            ended_at: null
        });
        
        const res1 = new MockRes();
        await handleResumeGet(getReq() as any, res1 as any, deps);
        const data1 = JSON.parse(res1.body);
        
        const res2 = new MockRes();
        await handleResumeGet(getReq() as any, res2 as any, deps);
        const data2 = JSON.parse(res2.body);
        
        assert.deepEqual(data1.session, data2.session);
        assert.equal(data1.session.sessionId, '99999999-9999-9999-9999-999999999999');
    });
});
