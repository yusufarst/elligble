import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// "Ragu-ragu / Tandai" review flags against real PostgreSQL (D04.5-33/34/35): stored apart
// from answers, written only by the active exam session of an open attempt, returned on
// resume, and never visible to teachers' results or used for scoring.

test('review flags (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));
    const exam = await createExamInstance(pool, tenant, teaching);
    const otherExam = await createExamInstance(pool, tenant, teaching);
    const snapshots = await addQuestionSnapshots(pool, tenant, exam, 3);
    const [foreignSnapshot] = await addQuestionSnapshots(pool, tenant, otherExam, 1);

    async function startedStudent() {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        await addParticipant(pool, tenant, exam, person.personId);
        const client = new BrowserLikeClient(app.baseUrl);
        assert.equal((await client.login(person.username, person.password)).status, 200);
        client.tenantId = tenant;
        const attemptId: string = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const flag = (snapshotId: string, flagged: unknown, overrides: Record<string, unknown> = {}) =>
            client.request('/api/v1/assessment/review-flag', { method: 'POST', body: { attemptId, sessionId, snapshotId, flagged, ...overrides } });
        const resume = async () => (await client.request(`/api/v1/assessment/resume?attemptId=${attemptId}&examSessionId=${sessionId}`)).body;
        return { client, attemptId, sessionId, flag, resume };
    }

    await t.test('a flag is kept apart from the answer and survives a resume', async () => {
        const s = await startedStudent();
        const saved = await s.client.request('/api/v1/assessment/answer/save', {
            method: 'POST',
            body: { attemptId: s.attemptId, sessionId: s.sessionId, snapshotId: snapshots[0], answerPayload: { selectedOptionId: 'B' }, clientWriteIdentity: randomUUID(), expectedWriteVersion: null },
        });
        assert.equal(saved.status, 200);

        const res = await s.flag(snapshots[0], true);
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { snapshotId: snapshots[0], flagged: true });
        assert.equal((await s.flag(snapshots[2], true)).status, 200, 'an unanswered question can be flagged too');
        assert.equal((await s.flag(snapshots[2], true)).status, 200, 'repeating the desired state is harmless');

        let resumed = await s.resume();
        assert.deepEqual([...resumed.reviewFlags].sort(), [snapshots[0], snapshots[2]].sort());
        assert.equal(resumed.answers.length, 1);
        assert.deepEqual(resumed.answers[0].answerPayload, { selectedOptionId: 'B' }, 'flagging never changes the answer');
        assert.equal(resumed.answers[0].writeVersion, 1);

        assert.equal((await s.flag(snapshots[0], false)).status, 200);
        resumed = await s.resume();
        assert.deepEqual(resumed.reviewFlags, [snapshots[2]]);
    });

    await t.test('only the active session of an open attempt can flag, and only its own questions', async () => {
        const s = await startedStudent();
        assert.equal((await s.flag(snapshots[1], 'ya')).status, 400);
        assert.equal((await s.flag('bukan-uuid', true)).status, 400);
        const stale = await s.flag(snapshots[1], true, { sessionId: randomUUID() });
        assert.equal(stale.status, 409);
        assert.equal(stale.body.error, 'session_not_active');
        assert.equal((await s.flag(foreignSnapshot, true)).status, 404, 'a question of another exam');

        const other = await startedStudent();
        const intruder = await other.client.request('/api/v1/assessment/review-flag', {
            method: 'POST', body: { attemptId: s.attemptId, sessionId: s.sessionId, snapshotId: snapshots[1], flagged: true },
        });
        assert.equal(intruder.status, 403, "another student's attempt");

        await pool.query(
            `UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - interval '3601 seconds' WHERE exam_attempt_id = $1`,
            [s.attemptId]
        );
        const expired = await s.flag(snapshots[1], true);
        assert.equal(expired.status, 409);
        assert.equal(expired.body.error, 'timer_expired');

        assert.equal((await other.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: other.attemptId } })).status, 200);
        const submitted = await other.flag(snapshots[1], true);
        assert.equal(submitted.status, 409);
        assert.equal(submitted.body.error, 'attempt_already_submitted');

        const rows = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_review_flags WHERE exam_attempt_id = ANY($1::uuid[])', [[s.attemptId, other.attemptId]]);
        assert.equal(rows.rows[0].n, 0, 'nothing was written by a refused request');
    });
});
