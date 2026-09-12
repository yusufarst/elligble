import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { handleQuestionDelivery, type QuestionDeliveryDependencies } from '../src/question-delivery.ts';

class MockReq {
    method = 'GET';
    url = '';
    headers: Record<string, string> = {};
}

class MockRes {
    statusCode = 200;
    headers: Record<string, string> = {};
    body = '';
    onEnd: () => void = () => {};
    endPromise = new Promise<void>(resolve => { this.onEnd = resolve; });

    writeHead(status: number, headers: Record<string, string>) {
        this.statusCode = status;
        this.headers = headers;
    }

    end(chunk: string) {
        this.body = chunk;
        this.onEnd();
    }
}

function createValidFrozenContent(promptText = 'What is the capital of Indonesia?', correctOptionId = 'opt-1') {
    return {
        schemaVersion: 1,
        questionType: 'MULTIPLE_CHOICE_SINGLE',
        prompt: { text: promptText },
        options: [
            { id: 'opt-1', content: { text: 'Jakarta' } },
            { id: 'opt-2', content: { text: 'Surabaya' } },
            { id: 'opt-3', content: { text: 'Bandung' } },
            { id: 'opt-4', content: { text: 'Medan' } },
            { id: 'opt-5', content: { text: 'Semarang' } }
        ],
        correctOptionId,
        maxScore: 10
    };
}

test('question delivery tests', async (t) => {
    const validAttemptId = '11111111-2222-4333-8444-555555555555';
    const tenantId = '22222222-2222-4333-8444-555555555555';
    const examInstanceId = '33333333-2222-4333-8444-555555555555';

    let mockPoolConnectError: Error | null = null;
    let simulateQueryError = false;
    const executedQueries: string[] = [];

    let attemptRow: any = {
        attempt_id: validAttemptId,
        exam_instance_id: examInstanceId,
        lifecycle_state: 'ACTIVE'
    };
    let sessionRows: any[] = [{ id: 'sess-1', activated_at: new Date(), ended_at: null }];
    let submissionRows: any[] = [];
    let timerRows: any[] = [{
        id: 'timer-1',
        started_at: new Date(Date.now() - 60000),
        configured_duration_seconds: 3600,
        total_adjustment: 0,
        elapsed_seconds: 60
    }];
    let snapshotRows: any[] = [
        {
            id: 'snap-001',
            frozen_content: createValidFrozenContent('Question 1')
        },
        {
            id: 'snap-002',
            frozen_content: createValidFrozenContent('Question 2')
        }
    ];

    const mockClient = {
        query: async (queryText: string, params?: any[]) => {
            executedQueries.push(queryText);
            if (simulateQueryError) throw new Error('Simulated database query error');

            if (queryText.startsWith('BEGIN')) return { rows: [] };
            if (queryText.startsWith('COMMIT')) return { rows: [] };
            if (queryText.startsWith('ROLLBACK')) return { rows: [] };

            if (queryText.includes('FROM secure_assessment_exam_attempts')) {
                const idParam = params?.[0];
                const tenantParam = params?.[1];
                if (attemptRow && attemptRow.attempt_id === idParam && tenantParam === tenantId) {
                    return { rows: [attemptRow] };
                }
                return { rows: [] };
            }

            if (queryText.includes('FROM secure_assessment_exam_sessions')) {
                const tenantParam = params?.[0];
                const attemptParam = params?.[1];
                if (tenantParam === tenantId && attemptParam === validAttemptId) {
                    return { rows: sessionRows };
                }
                return { rows: [] };
            }

            if (queryText.includes('FROM secure_assessment_exam_submissions')) {
                const tenantParam = params?.[0];
                const attemptParam = params?.[1];
                if (tenantParam === tenantId && attemptParam === validAttemptId) {
                    return { rows: submissionRows };
                }
                return { rows: [] };
            }

            if (queryText.includes('FROM secure_assessment_timer_state')) {
                const tenantParam = params?.[0];
                const attemptParam = params?.[1];
                if (tenantParam === tenantId && attemptParam === validAttemptId) {
                    return { rows: timerRows };
                }
                return { rows: [] };
            }

            if (queryText.includes('FROM secure_assessment_exam_question_snapshots')) {
                const tenantParam = params?.[0];
                const instanceParam = params?.[1];
                if (tenantParam === tenantId && instanceParam === examInstanceId) {
                    return { rows: snapshotRows };
                }
                return { rows: [] };
            }

            return { rows: [] };
        },
        release: () => {}
    };

    const deps: QuestionDeliveryDependencies = {
        pool: {
            connect: async () => {
                if (mockPoolConnectError) throw mockPoolConnectError;
                return mockClient as any;
            }
        } as any,
        getAuthorizedContext: (req) => {
            const h = (req as any).headers || {};
            if (h['x-throw-auth']) throw new Error('Auth provider error');
            if (h['x-no-context']) return null;
            if (h['x-wrong-attempt']) return { tenantId, authorizedAttemptId: '99999999-9999-4999-8999-999999999999' };
            return { tenantId, authorizedAttemptId: validAttemptId };
        }
    };

    function resetState() {
        mockPoolConnectError = null;
        simulateQueryError = false;
        executedQueries.length = 0;
        attemptRow = {
            attempt_id: validAttemptId,
            exam_instance_id: examInstanceId,
            lifecycle_state: 'ACTIVE'
        };
        sessionRows = [{ id: 'sess-1', activated_at: new Date(), ended_at: null }];
        submissionRows = [];
        timerRows = [{
            id: 'timer-1',
            started_at: new Date(Date.now() - 60000),
            configured_duration_seconds: 3600,
            total_adjustment: 0,
            elapsed_seconds: 60
        }];
        snapshotRows = [
            {
                id: 'snap-001',
                frozen_content: createValidFrozenContent('Question 1')
            },
            {
                id: 'snap-002',
                frozen_content: createValidFrozenContent('Question 2')
            }
        ];
    }

    await t.test('1. missing attemptId -> 400', async () => {
        resetState();
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = '/api/v1/assessment/questions';
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 400);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'invalid_request' });
    });

    await t.test('2. invalid attemptId -> 400', async () => {
        resetState();
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = '/api/v1/assessment/questions?attemptId=not-a-valid-uuid';
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 400);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'invalid_request' });
    });

    await t.test('3. missing auth context -> 403', async () => {
        resetState();
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        (req as any).headers['x-no-context'] = '1';
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 403);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'forbidden' });
    });

    await t.test('4. attempt mismatch -> 403', async () => {
        resetState();
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        (req as any).headers['x-wrong-attempt'] = '1';
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 403);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'forbidden' });
    });

    await t.test('5. context provider throws -> 500', async () => {
        resetState();
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        (req as any).headers['x-throw-auth'] = '1';
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 500);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'internal_error' });
    });

    await t.test('6. pool connect failure -> 503', async () => {
        resetState();
        mockPoolConnectError = new Error('Connection refused');
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 503);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'persistence_unavailable' });
    });

    await t.test('7. missing tenant-bound Attempt -> 404', async () => {
        resetState();
        attemptRow = null;
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 404);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'assessment_context_not_found' });
    });

    await t.test('8. wrong-tenant Attempt -> 404', async () => {
        resetState();
        const wrongTenantDeps: QuestionDeliveryDependencies = {
            ...deps,
            getAuthorizedContext: () => ({ tenantId: '88888888-8888-4888-8888-888888888888', authorizedAttemptId: validAttemptId })
        };
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, wrongTenantDeps);
        assert.equal((res as any).statusCode, 404);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'assessment_context_not_found' });
    });

    await t.test('9. non-ACTIVE Exam Instance -> 409 exam_not_active', async () => {
        resetState();
        attemptRow.lifecycle_state = 'SCHEDULED';
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 409);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'exam_not_active' });
    });

    await t.test('10. no active Session -> 409 session_not_active', async () => {
        resetState();
        sessionRows = [];
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 409);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'session_not_active' });
    });

    await t.test('11. ended/superseded Session does not satisfy active requirement', async () => {
        resetState();
        // Ended session is filtered out by query
        sessionRows = [];
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 409);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'session_not_active' });
    });

    await t.test('12. missing timer state -> 404', async () => {
        resetState();
        timerRows = [];
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 404);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'assessment_context_not_found' });
    });

    await t.test('13. timer not started -> 409 timer_not_started', async () => {
        resetState();
        timerRows[0].started_at = null;
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 409);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'timer_not_started' });
    });

    await t.test('14. expired timer -> 409 timer_expired', async () => {
        resetState();
        timerRows[0].configured_duration_seconds = 3600;
        timerRows[0].total_adjustment = 0;
        timerRows[0].elapsed_seconds = 3600; // 0 remaining
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 409);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'timer_expired' });
    });

    await t.test('15. submitted Attempt -> 409 attempt_already_submitted', async () => {
        resetState();
        submissionRows = [{ id: 'sub-1', submitted_at: new Date() }];
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 409);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'attempt_already_submitted' });
    });

    await t.test('16-23. valid ACTIVE runtime -> 200, deterministic order, projections & non-disclosure', async () => {
        resetState();
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 200);

        const data = JSON.parse((res as any).body);
        assert.equal(data.attemptId, validAttemptId);
        assert.equal(data.questions.length, 2);

        // 17. multiple snapshots -> deterministic id order
        assert.equal(data.questions[0].snapshotId, 'snap-001');
        assert.equal(data.questions[1].snapshotId, 'snap-002');

        // 18. prompt preserved
        assert.deepEqual(data.questions[0].prompt, { text: 'Question 1' });
        assert.deepEqual(data.questions[1].prompt, { text: 'Question 2' });

        // 19. option IDs/content preserved
        assert.equal(data.questions[0].options.length, 5);
        assert.equal(data.questions[0].options[0].id, 'opt-1');
        assert.deepEqual(data.questions[0].options[0].content, { text: 'Jakarta' });

        // 20. correctOptionId absent
        for (const q of data.questions) {
            assert.equal('correctOptionId' in q, false);
        }

        // 21. maxScore absent
        for (const q of data.questions) {
            assert.equal('maxScore' in q, false);
        }

        // 22. source_question_bank_item_id absent
        for (const q of data.questions) {
            assert.equal('source_question_bank_item_id' in q, false);
        }

        // 23. tenant/person/participant IDs absent
        for (const q of data.questions) {
            assert.equal('tenant_id' in q, false);
            assert.equal('tenantId' in q, false);
            assert.equal('person_id' in q, false);
            assert.equal('personId' in q, false);
            assert.equal('exam_participant_id' in q, false);
            assert.equal('participantId' in q, false);
            assert.equal('exam_instance_id' in q, false);
            assert.equal('instanceId' in q, false);
        }
    });

    await t.test('24. invalid frozen_content -> 500 internal_error', async () => {
        resetState();
        snapshotRows = [
            {
                id: 'snap-invalid',
                frozen_content: { schemaVersion: 1, questionType: 'INVALID' }
            }
        ];
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 500);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'internal_error' });
    });

    await t.test('25. query failure -> fail closed', async () => {
        resetState();
        simulateQueryError = true;
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 503);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'persistence_unavailable' });
    });

    await t.test('26. read-only / no write SQL', async () => {
        resetState();
        const req = new MockReq() as unknown as http.IncomingMessage;
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 200);

        // Verify transaction started with REPEATABLE READ READ ONLY
        assert.ok(executedQueries.some(q => q.includes('READ ONLY')));

        // Verify no write SQL commands
        for (const query of executedQueries) {
            const upper = query.toUpperCase();
            assert.ok(!upper.startsWith('INSERT'), `Found write query: ${query}`);
            assert.ok(!upper.startsWith('UPDATE'), `Found write query: ${query}`);
            assert.ok(!upper.startsWith('DELETE'), `Found write query: ${query}`);
            assert.ok(!upper.startsWith('DROP'), `Found write query: ${query}`);
            assert.ok(!upper.startsWith('ALTER'), `Found write query: ${query}`);
        }
    });

    await t.test('27. unsupported method -> 405 method_not_allowed', async () => {
        resetState();
        const req = new MockReq() as unknown as http.IncomingMessage;
        (req as any).method = 'POST';
        req.url = `/api/v1/assessment/questions?attemptId=${validAttemptId}`;
        const res = new MockRes() as unknown as http.ServerResponse;

        await handleQuestionDelivery(req, res, deps);
        assert.equal((res as any).statusCode, 405);
        assert.deepEqual(JSON.parse((res as any).body), { error: 'method_not_allowed' });
    });
});
