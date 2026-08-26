import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { createServer } from '../src/server.ts';
import type * as pg from 'pg';

test('answer save capability tests', async (t) => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';
    const validSnapshotUUID = '123e4567-e89b-12d3-a456-426614174001';

    // In-memory mock DB state
    let attempts: any[] = [];
    let snapshots: any[] = [];
    let participants: any[] = [];
    let answers: any[] = [];
    let submissions: any[] = [];

    let mockPoolShouldFail = false;
    let mockQueryShouldFail = false;
    let poolConnectCount = 0;
    let insertCount = 0;
    let selectForUpdateCount = 0;
    let triggerInsertCollision: any = null;

    class MockClient {
        async query(sql: string, params?: any[]): Promise<any> {
            if (mockQueryShouldFail) throw new Error('database connection lost or query failed');
            const sqlLower = sql.toLowerCase();

            if (sqlLower === 'begin' || sqlLower === 'commit' || sqlLower === 'rollback') {
                return { rows: [] };
            }

            if (sqlLower.includes('from secure_assessment_exam_attempts')) {
                const tenantId = params![1];
                const id = params![0];
                const found = attempts.filter(a => a.id === id && a.tenant_id === tenantId);
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

            if (sqlLower.includes('from secure_assessment_exam_answers') && sqlLower.includes('for update')) {
                selectForUpdateCount++;
                const tenantId = params![0];
                const attemptId = params![1];
                const snapshotId = params![2];
                const found = answers.filter(a => a.tenant_id === tenantId && a.exam_attempt_id === attemptId && a.exam_question_snapshot_id === snapshotId);
                return { rows: found.map(a => ({ ...a, answer_payload: JSON.parse(a.answer_payload) })) };
            }

            if (sqlLower.includes('insert into secure_assessment_exam_answers')) {
                insertCount++;
                const tenantId = params![0];
                const attemptId = params![1];
                const snapshotId = params![2];
                const payload = params![3];
                const clientWriteIdentity = params![4];
                const writeVersion = params![5];

                if (triggerInsertCollision) {
                    answers.push(triggerInsertCollision);
                    triggerInsertCollision = null;
                }

                // Check conflict
                const existing = answers.find(a => a.tenant_id === tenantId && a.exam_attempt_id === attemptId && a.exam_question_snapshot_id === snapshotId);
                if (existing) {
                    if (sqlLower.includes('on conflict')) {
                        return { rows: [] }; // DO NOTHING
                    }
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

    async function sendPost(payload: any) {
        return fetch(`${baseUrl}/api/v1/assessment/answer/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    t.beforeEach(() => {
        mockPoolShouldFail = false;
        mockQueryShouldFail = false;
        poolConnectCount = 0;
        insertCount = 0;
        selectForUpdateCount = 0;
        triggerInsertCollision = null;
        attempts = [{ id: validUUID, tenant_id: validUUID, exam_participant_id: validUUID }];
        snapshots = [{ id: validSnapshotUUID, tenant_id: validUUID, exam_instance_id: validUUID }];
        participants = [{ id: validUUID, tenant_id: validUUID, exam_instance_id: validUUID }];
        answers = [];
        submissions = [];
        mockContext = { tenantId: validUUID, authorizedAttemptId: validUUID };
    });

    await t.test('missing authorization context -> 403', async () => {
        mockContext = null;
        const res = await sendPost({});
        assert.equal(res.status, 403);
        const data = await res.json();
        assert.deepEqual(data, { error: 'forbidden' });
    });

    await t.test('authorized tenant context but authorizedAttemptId != payload attemptId -> 403', async () => {
        const res = await sendPost({ attemptId: '456e4567-e89b-12d3-a456-426614174000', snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: 'abc' });
        assert.equal(res.status, 403);
        assert.equal(answers.length, 0); // persistence not invoked
        assert.equal(poolConnectCount, 0); // Proof persistence not invoked
    });

    await t.test('malformed JSON -> 400', async () => {
        const res = await fetch(`${baseUrl}/api/v1/assessment/answer/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{ bad_json: '
        });
        assert.equal(res.status, 400);
    });

    await t.test('invalid attemptId -> 400', async () => {
        mockContext.authorizedAttemptId = 'not-uuid';
        const res = await sendPost({ attemptId: 'not-uuid', snapshotId: validSnapshotUUID, answerPayload: { a: 1 }, clientWriteIdentity: 'abc' });
        assert.equal(res.status, 400);
    });

    await t.test('invalid snapshotId -> 400', async () => {
        const res = await sendPost({ attemptId: validUUID, snapshotId: 'not-uuid', answerPayload: { a: 1 }, clientWriteIdentity: 'abc' });
        assert.equal(res.status, 400);
    });

    await t.test('missing answerPayload -> 400', async () => {
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, clientWriteIdentity: 'abc' });
        assert.equal(res.status, 400);
    });

    await t.test('clientWriteIdentity length 0 -> 400', async () => {
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: '' });
        assert.equal(res.status, 400);
    });

    await t.test('clientWriteIdentity length 255 is accepted', async () => {
        const str255 = 'a'.repeat(255);
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: str255 });
        assert.equal(res.status, 200);
    });

    await t.test('clientWriteIdentity length 256 is rejected -> 400', async () => {
        const str256 = 'a'.repeat(256);
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: str256 });
        assert.equal(res.status, 400);
    });

    await t.test('expectedWriteVersion <= 0 -> 400', async () => {
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: 'abc', expectedWriteVersion: 0 });
        assert.equal(res.status, 400);

        const res2 = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: 'abc', expectedWriteVersion: -1 });
        assert.equal(res2.status, 400);
    });

    await t.test('expectedWriteVersion fractional -> 400', async () => {
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: 'abc', expectedWriteVersion: 1.5 });
        assert.equal(res.status, 400);
    });

    await t.test('expectedWriteVersion > 2147483647 -> 400', async () => {
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: 'abc', expectedWriteVersion: 2147483648 });
        assert.equal(res.status, 400);
    });

    await t.test('expectedWriteVersion 2147483647 -> accepted, enters standard flow', async () => {
        // Will fail because expectedWriteVersion is not matching the DB's current (which is non-existent)
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: 'abc', expectedWriteVersion: 2147483647 });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.deepEqual(data, { error: 'stale_write_version' });
    });

    await t.test('authorized Attempt/Snapshot not found -> 404', async () => {
        attempts = []; // Remove attempt from mock DB
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: 'abc' });
        assert.equal(res.status, 404);
        const data = await res.json();
        assert.equal(data.error, 'assessment_context_not_found');
    });

    await t.test('incompatible Attempt/Snapshot -> 409', async () => {
        snapshots[0].exam_instance_id = 'different-instance';
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: {}, clientWriteIdentity: 'abc' });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'assessment_context_conflict');
    });

    await t.test('successful initial write -> 200 acknowledged version 1', async () => {
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, 'acknowledged');
        assert.equal(data.writeVersion, 1);
        assert.equal(answers.length, 1);
        assert.equal(answers[0].write_version, 1);
    });

    await t.test('duplicate same logical write -> 200 same acknowledgement, no mutation, no increment', async () => {
        await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.writeVersion, 1);
        assert.equal(answers.length, 1); // no duplicate
        assert.equal(answers[0].write_version, 1); // no increment
    });

    await t.test('same identity + different payload -> 409 write_identity_reuse_conflict', async () => {
        await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'B' }, clientWriteIdentity: 'req1' });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'write_identity_reuse_conflict');
        assert.equal(answers[0].write_version, 1); // no mutation
    });

    await t.test('new identity + matching expected version -> 200, increment exactly once', async () => {
        await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'B' }, clientWriteIdentity: 'req2', expectedWriteVersion: 1 });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.writeVersion, 2);
        assert.equal(answers[0].write_version, 2);
    });

    await t.test('stale expected version -> 409 stale_write_version, no mutation', async () => {
        await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });
        await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'B' }, clientWriteIdentity: 'req2', expectedWriteVersion: 1 }); // now at v2

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'C' }, clientWriteIdentity: 'req3', expectedWriteVersion: 1 });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'stale_write_version');
        assert.equal(answers[0].write_version, 2); // no mutation
    });

    await t.test('delayed old retry cannot overwrite newer Answer', async () => {
        await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' }); // v1
        await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'B' }, clientWriteIdentity: 'req2', expectedWriteVersion: 1 }); // v2

        // Req1 retry comes in very late (expectedWriteVersion was null).
        // This is caught by concurrent initial same logical write collision or stale version.
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });
        assert.equal(res.status, 409); // write_identity_reuse_conflict (different payload A != B) OR if it was stale, but identity req1 != req2, so it falls into stale_write_version
        const data = await res.json();
        assert.equal(data.error, 'stale_write_version');
        assert.equal(answers[0].write_version, 2);
    });

    await t.test('concurrent initial same logical write collision -> converges to one authoritative Answer, existing acknowledgement returned', async () => {
        // Setup collision right as INSERT happens
        triggerInsertCollision = {
            tenant_id: validUUID,
            exam_attempt_id: validUUID,
            exam_question_snapshot_id: validSnapshotUUID,
            answer_payload: JSON.stringify({ text: 'A' }),
            client_write_identity: 'req_concurrent',
            write_version: 1
        };

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req_concurrent' });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.writeVersion, 1);
        assert.equal(answers.length, 1);
        assert.equal(insertCount, 1);
        assert.equal(selectForUpdateCount, 2); // Initial select + re-read
    });

    await t.test('concurrent initial conflicting logical write -> one authoritative row only, losing conflicting request does not overwrite winner', async () => {
        triggerInsertCollision = {
            tenant_id: validUUID,
            exam_attempt_id: validUUID,
            exam_question_snapshot_id: validSnapshotUUID,
            answer_payload: JSON.stringify({ text: 'Winner' }),
            client_write_identity: 'winner_req',
            write_version: 1
        };

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'Loser' }, clientWriteIdentity: 'loser_req' });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'stale_write_version');
        assert.equal(answers.length, 1);
        assert.equal(answers[0].client_write_identity, 'winner_req'); // Did not overwrite
        assert.equal(insertCount, 1);
        assert.equal(selectForUpdateCount, 2);
    });

    await t.test('concurrent initial collision with same identity but different payload -> 409 write_identity_reuse_conflict', async () => {
        triggerInsertCollision = {
            tenant_id: validUUID,
            exam_attempt_id: validUUID,
            exam_question_snapshot_id: validSnapshotUUID,
            answer_payload: JSON.stringify({ text: 'Old' }),
            client_write_identity: 'req_reuse',
            write_version: 1
        };

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'New' }, clientWriteIdentity: 'req_reuse' });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'write_identity_reuse_conflict');
        assert.equal(answers.length, 1);
        assert.equal(answers[0].answer_payload, '{"text":"Old"}');
        assert.equal(insertCount, 1);
        assert.equal(selectForUpdateCount, 2);
    });

    await t.test('persistence unavailable (pool fail) -> 503, no false acknowledgement', async () => {
        mockPoolShouldFail = true;
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { ok: true }, clientWriteIdentity: 'req-db-fail' });
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.equal(data.error, 'persistence_unavailable');
        assert.equal(answers.length, 0);
    });

    await t.test('post-connect database query failure -> 503, no false acknowledgement', async () => {
        mockQueryShouldFail = true; // Connection succeeds, query throws
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { ok: true }, clientWriteIdentity: 'req-db-fail-query' });
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.equal(data.error, 'persistence_unavailable');
        assert.equal(answers.length, 0);
    });

    await t.test('submitted Attempt + new Answer -> 409', async () => {
        submissions.push({ tenant_id: validUUID, exam_attempt_id: validUUID });
        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'attempt_already_submitted');
        assert.equal(answers.length, 0);
    });

    await t.test('submitted Attempt + update -> 409', async () => {
        answers.push({ tenant_id: validUUID, exam_attempt_id: validUUID, exam_question_snapshot_id: validSnapshotUUID, answer_payload: '{"text":"A"}', client_write_identity: 'req1', write_version: 1 });
        submissions.push({ tenant_id: validUUID, exam_attempt_id: validUUID });

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'B' }, clientWriteIdentity: 'req2', expectedWriteVersion: 1 });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'attempt_already_submitted');
        assert.equal(answers[0].write_version, 1); // no mutation
    });

    await t.test('submitted Attempt + same identity/same payload -> 200 acknowledged, preserves writeVersion, no mutation', async () => {
        answers.push({ tenant_id: validUUID, exam_attempt_id: validUUID, exam_question_snapshot_id: validSnapshotUUID, answer_payload: '{"text":"A"}', client_write_identity: 'req1', write_version: 1 });
        submissions.push({ tenant_id: validUUID, exam_attempt_id: validUUID });

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'A' }, clientWriteIdentity: 'req1' });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, 'acknowledged');
        assert.equal(data.writeVersion, 1);
        assert.equal(answers[0].write_version, 1);
        assert.equal(answers.length, 1);
    });

    await t.test('submitted Attempt + same identity/different payload -> 409', async () => {
        answers.push({ tenant_id: validUUID, exam_attempt_id: validUUID, exam_question_snapshot_id: validSnapshotUUID, answer_payload: '{"text":"A"}', client_write_identity: 'req1', write_version: 1 });
        submissions.push({ tenant_id: validUUID, exam_attempt_id: validUUID });

        const res = await sendPost({ attemptId: validUUID, snapshotId: validSnapshotUUID, answerPayload: { text: 'B' }, clientWriteIdentity: 'req1' });
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.error, 'attempt_already_submitted');
        assert.equal(answers[0].write_version, 1);
    });

    await t.test('cleanup server', async () => {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });
});
