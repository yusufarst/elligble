import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { createServer } from '../src/server.ts';
import type * as pg from 'pg';

test('active-session answer authority guard tests', async (t) => {
    const validTenantId = '123e4567-e89b-12d3-a456-426614174000';
    const validAttemptId = '123e4567-e89b-12d3-a456-426614174001';
    const validSnapshotId = '123e4567-e89b-12d3-a456-426614174002';
    const validSessionId = '123e4567-e89b-12d3-a456-426614174003';
    const otherSessionId = '123e4567-e89b-12d3-a456-426614174004';

    let attempts: any[] = [];
    let snapshots: any[] = [];
    let participants: any[] = [];
    let answers: any[] = [];
    let submissions: any[] = [];
    let timerStates: any[] = [];
    let sessions: any[] = [];

    let mockQueryShouldFail = false;
    let failQueryOnSession = false;
    let queryLog: string[] = [];
    let mutationCount = 0;

    class MockClient {
        async query(sql: string, params?: any[]): Promise<any> {
            if (mockQueryShouldFail) throw new Error('database connection lost or query failed');
            
            const sqlLower = sql.toLowerCase();
            queryLog.push(sqlLower);

            if (sqlLower === 'begin' || sqlLower === 'commit' || sqlLower === 'rollback') {
                return { rows: [] };
            }

            if (sqlLower.includes('from secure_assessment_exam_attempts')) {
                const tenantId = params![1];
                const id = params![0];
                const found = attempts.filter(a => a.id === id && a.tenant_id === tenantId);
                return { rows: found };
            }

            if (sqlLower.includes('from secure_assessment_exam_sessions')) {
                if (failQueryOnSession) throw new Error('mock session failure');
                const tenantId = params![0];
                const attemptId = params![1];
                
                // Track if tenant and attempt are bound correctly
                if (tenantId !== validTenantId && tenantId !== 'other-tenant-uuid') throw new Error('invalid tenant binding');

                const found = sessions.filter(s => s.tenant_id === tenantId && s.exam_attempt_id === attemptId && s.activated_at !== null && s.ended_at === null);
                return { rows: found };
            }

            if (sqlLower.includes('from secure_assessment_exam_submissions')) {
                const tenantId = params![0];
                const attemptId = params![1];
                const found = submissions.filter(s => s.exam_attempt_id === attemptId && s.tenant_id === tenantId);
                return { rows: found };
            }

            if (sqlLower.includes('from secure_assessment_exam_question_snapshots')) {
                const tenantId = params![1];
                const id = params![0];
                const found = snapshots.filter(s => s.id === id && s.tenant_id === tenantId);
                return { rows: found };
            }

            if (sqlLower.includes('from secure_assessment_exam_participants')) {
                const tenantId = params![1];
                const id = params![0];
                const found = participants.filter(p => p.id === id && p.tenant_id === tenantId);
                return { rows: found };
            }

            if (sqlLower.includes('from secure_assessment_timer_state')) {
                const tenantId = params![0];
                const attemptId = params![1];
                const found = timerStates.filter(t => t.tenant_id === tenantId && t.exam_attempt_id === attemptId);
                return { rows: found.map(t => ({
                    ...t,
                    total_adjustment: '0',
                    elapsed_seconds: t.elapsed_seconds || 0
                }))};
            }

            if (sqlLower.includes('from secure_assessment_exam_answers') && sqlLower.includes('for update')) {
                const tenantId = params![0];
                const attemptId = params![1];
                const snapshotId = params![2];
                const found = answers.filter(a => a.tenant_id === tenantId && a.exam_attempt_id === attemptId && a.exam_question_snapshot_id === snapshotId);
                return { rows: found.map(a => ({ ...a, answer_payload: JSON.parse(a.answer_payload) })) };
            }

            if (sqlLower.includes('insert into secure_assessment_exam_answers')) {
                mutationCount++;
                const tenantId = params![0];
                const attemptId = params![1];
                const snapshotId = params![2];
                const payload = params![3];
                const clientWriteIdentity = params![4];
                const writeVersion = params![5];

                const existing = answers.find(a => a.tenant_id === tenantId && a.exam_attempt_id === attemptId && a.exam_question_snapshot_id === snapshotId);
                if (existing) {
                    if (sqlLower.includes('on conflict')) return { rows: [] }; // DO NOTHING
                    throw Object.assign(new Error('duplicate key'), { code: '23505' });
                }

                answers.push({
                    tenant_id: tenantId,
                    exam_attempt_id: attemptId,
                    exam_question_snapshot_id: snapshotId,
                    answer_payload: payload,
                    client_write_identity: clientWriteIdentity,
                    write_version: writeVersion
                });
                return { rows: [{ write_version: writeVersion }] };
            }

            if (sqlLower.includes('update secure_assessment_exam_answers')) {
                mutationCount++;
                const payload = params![0];
                const clientWriteIdentity = params![1];
                const tenantId = params![2];
                const attemptId = params![3];
                const snapshotId = params![4];

                const existing = answers.find(a => a.tenant_id === tenantId && a.exam_attempt_id === attemptId && a.exam_question_snapshot_id === snapshotId);
                if (!existing) return { rows: [] };

                existing.answer_payload = payload;
                existing.client_write_identity = clientWriteIdentity;
                existing.write_version++;

                return { rows: [{ write_version: existing.write_version }] };
            }

            return { rows: [] };
        }
        release() {}
    }

    const mockPool: any = {
        connect: async () => new MockClient()
    };

    let mockContext: any = { tenantId: validTenantId, authorizedAttemptId: validAttemptId };

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

    async function sendPost(payload: any) {
        return fetch(`${baseUrl}/api/v1/assessment/answer/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    t.beforeEach(() => {
        mockQueryShouldFail = false;
        failQueryOnSession = false;
        queryLog = [];
        mutationCount = 0;
        
        attempts = [{ id: validAttemptId, tenant_id: validTenantId, exam_participant_id: validTenantId }];
        snapshots = [{ id: validSnapshotId, tenant_id: validTenantId, exam_instance_id: validTenantId }];
        participants = [{ id: validTenantId, tenant_id: validTenantId, exam_instance_id: validTenantId }];
        answers = [];
        submissions = [];
        timerStates = [];
        sessions = [{ id: validSessionId, tenant_id: validTenantId, exam_attempt_id: validAttemptId, activated_at: new Date(), ended_at: null }];
        
        mockContext = { tenantId: validTenantId, authorizedAttemptId: validAttemptId };
    });

    const getBasePayload = (): any => ({ attemptId: validAttemptId, sessionId: validSessionId, snapshotId: validSnapshotId, answerPayload: { a: 1 }, clientWriteIdentity: 'req1' });

    await t.test('missing sessionId -> 400 invalid_request', async () => {
        const payload = getBasePayload();
        delete (payload as any).sessionId;
        const res = await sendPost(payload);
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'invalid_request');
        assert.equal(mutationCount, 0);
    });

    await t.test('malformed sessionId -> 400 invalid_request', async () => {
        const payload = getBasePayload();
        payload.sessionId = 'not-a-uuid';
        const res = await sendPost(payload);
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'invalid_request');
        assert.equal(mutationCount, 0);
    });

    await t.test('valid active Session + valid Answer initial write -> 200', async () => {
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 200);
        assert.equal(mutationCount, 1);
        assert.equal(answers.length, 1);
        assert.equal(answers[0].write_version, 1);
    });

    await t.test('active Session query is tenant-bound and Attempt-bound', async () => {
        await sendPost(getBasePayload());
        const sessionQueryIndex = queryLog.findIndex(q => q.includes('from secure_assessment_exam_sessions'));
        assert.ok(sessionQueryIndex > -1);
        const sessionQuery = queryLog[sessionQueryIndex];
        assert.ok(sessionQuery.includes('tenant_id = $1'));
        assert.ok(sessionQuery.includes('exam_attempt_id = $2'));
    });

    await t.test('Attempt FOR UPDATE occurs before active Session query', async () => {
        await sendPost(getBasePayload());
        const attemptIndex = queryLog.findIndex(q => q.includes('from secure_assessment_exam_attempts') && q.includes('for update'));
        const sessionIndex = queryLog.findIndex(q => q.includes('from secure_assessment_exam_sessions'));
        assert.ok(attemptIndex > -1);
        assert.ok(sessionIndex > -1);
        assert.ok(attemptIndex < sessionIndex);
    });

    await t.test('active Session query occurs before Answer INSERT/UPDATE', async () => {
        await sendPost(getBasePayload());
        const sessionIndex = queryLog.findIndex(q => q.includes('from secure_assessment_exam_sessions'));
        const insertIndex = queryLog.findIndex(q => q.includes('insert into secure_assessment_exam_answers'));
        assert.ok(sessionIndex > -1);
        assert.ok(insertIndex > -1);
        assert.ok(sessionIndex < insertIndex);
    });

    await t.test('no active Session -> 409 session_not_active', async () => {
        sessions = [];
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'session_not_active');
    });

    await t.test('no-active rejection performs zero Answer mutation', async () => {
        sessions = [];
        await sendPost(getBasePayload());
        assert.equal(mutationCount, 0);
        assert.equal(answers.length, 0);
    });

    await t.test('different/non-active Session while another Session active -> 409 session_not_active', async () => {
        const payload = getBasePayload();
        payload.sessionId = otherSessionId;
        const res = await sendPost(payload);
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'session_not_active');
    });

    await t.test('mismatched Session rejection performs zero mutation', async () => {
        const payload = getBasePayload();
        payload.sessionId = otherSessionId;
        await sendPost(payload);
        assert.equal(mutationCount, 0);
        assert.equal(answers.length, 0);
    });

    await t.test('ended Session -> bounded 409 session_not_active', async () => {
        sessions[0].ended_at = new Date();
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'session_not_active');
    });

    await t.test('superseded old Session -> bounded 409 session_not_active', async () => {
        sessions[0].ended_at = new Date();
        sessions[0].superseded_by_session_id = otherSessionId;
        
        sessions.push({ id: otherSessionId, tenant_id: validTenantId, exam_attempt_id: validAttemptId, activated_at: new Date(), ended_at: null });

        const res = await sendPost(getBasePayload()); // Uses old session ID
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'session_not_active');
    });

    await t.test('Session belonging to another Attempt -> bounded 409 session_not_active', async () => {
        sessions[0].exam_attempt_id = 'other-attempt-uuid';
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'session_not_active');
    });

    await t.test('foreign-tenant Session -> bounded 409 session_not_active', async () => {
        sessions[0].tenant_id = 'other-tenant-uuid';
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'session_not_active');
    });

    await t.test('active replacement Session may write successfully', async () => {
        sessions[0].ended_at = new Date();
        sessions.push({ id: otherSessionId, tenant_id: validTenantId, exam_attempt_id: validAttemptId, activated_at: new Date(), ended_at: null });

        const payload = getBasePayload();
        payload.sessionId = otherSessionId;
        const res = await sendPost(payload);
        assert.equal(res.status, 200);
        assert.equal(mutationCount, 1);
    });

    await t.test('old Session cannot increment an existing Answer write_version', async () => {
        answers.push({ tenant_id: validTenantId, exam_attempt_id: validAttemptId, exam_question_snapshot_id: validSnapshotId, answer_payload: '{"a":1}', client_write_identity: 'req1', write_version: 1 });
        
        sessions[0].ended_at = new Date();
        const payload = getBasePayload();
        (payload as any).expectedWriteVersion = 1;
        payload.clientWriteIdentity = 'req2';
        
        const res = await sendPost(payload);
        assert.equal(res.status, 409);
        assert.equal(mutationCount, 0);
        assert.equal(answers[0].write_version, 1);
    });

    await t.test('old Session cannot change an existing Answer payload', async () => {
        answers.push({ tenant_id: validTenantId, exam_attempt_id: validAttemptId, exam_question_snapshot_id: validSnapshotId, answer_payload: '{"a":1}', client_write_identity: 'req1', write_version: 1 });
        
        sessions[0].ended_at = new Date();
        const payload = getBasePayload();
        (payload as any).expectedWriteVersion = 1;
        payload.answerPayload = { b: 2 };
        payload.clientWriteIdentity = 'req2';
        
        await sendPost(payload);
        assert.equal(answers[0].answer_payload, '{"a":1}');
        assert.equal(mutationCount, 0);
    });

    await t.test('current active Session can update with matching expectedWriteVersion', async () => {
        answers.push({ tenant_id: validTenantId, exam_attempt_id: validAttemptId, exam_question_snapshot_id: validSnapshotId, answer_payload: '{"a":1}', client_write_identity: 'req1', write_version: 1 });
        
        const payload = getBasePayload();
        (payload as any).expectedWriteVersion = 1;
        payload.answerPayload = { b: 2 };
        payload.clientWriteIdentity = 'req2';
        
        const res = await sendPost(payload);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.writeVersion, 2);
        assert.equal(answers[0].write_version, 2);
        assert.equal(mutationCount, 1); // 1 for the UPDATE
    });

    await t.test('exact active-Session Answer retry preserves existing idempotent receipt', async () => {
        answers.push({ tenant_id: validTenantId, exam_attempt_id: validAttemptId, exam_question_snapshot_id: validSnapshotId, answer_payload: '{"a":1}', client_write_identity: 'req1', write_version: 1 });
        
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.writeVersion, 1);
        assert.equal(mutationCount, 0);
    });

    await t.test('Submission guard still works for active Session', async () => {
        submissions.push({ tenant_id: validTenantId, exam_attempt_id: validAttemptId });
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'attempt_already_submitted');
        assert.equal(mutationCount, 0);
    });

    await t.test('Timer-expiry guard still works for active Session', async () => {
        timerStates.push({ tenant_id: validTenantId, exam_attempt_id: validAttemptId, started_at: new Date(), configured_duration_seconds: '3600', elapsed_seconds: 3601 });
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'timer_expired');
        assert.equal(mutationCount, 0);
    });

    await t.test('DB failure during Session authority query -> 503 persistence_unavailable', async () => {
        failQueryOnSession = true;
        const res = await sendPost(getBasePayload());
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.equal(data.error, 'persistence_unavailable');
    });

    await t.test('Session guard error response does not disclose current activeSessionId', async () => {
        const payload = getBasePayload();
        payload.sessionId = otherSessionId;
        const res = await sendPost(payload);
        const bodyText = await res.text();
        assert.ok(!bodyText.includes(validSessionId)); // Does not leak the real active session ID
    });

    await t.test('Session guard does not mutate Attempt/Timer/Submission/Session state', async () => {
        const payload = getBasePayload();
        payload.sessionId = otherSessionId;
        await sendPost(payload);
        assert.equal(mutationCount, 0);
        // Only SELECT queries, no UPDATEs or INSERTs in logs except answers if it reached there (which it didn't)
        const updates = queryLog.filter(q => q.includes('update '));
        const inserts = queryLog.filter(q => q.includes('insert '));
        assert.equal(updates.length, 0);
        assert.equal(inserts.length, 0);
    });

    await t.test('cleanup server', async () => {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });
});
