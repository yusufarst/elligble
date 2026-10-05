import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { finalizeExpiredAttempts } from '../../src/expiry-finalization.ts';

// Server finalization at time expiry against real PostgreSQL (D04.5-45/47/49): an attempt
// whose time ran out while the device was away is finalized from its last accepted answers,
// exactly once, and every other finalization path converges on the same submission.

test('server finalization of expired attempts (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 2 Contoh');
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));
    const exam = await createExamInstance(pool, tenant, teaching, { durationSeconds: 3600 });
    const snapshots = await addQuestionSnapshots(pool, tenant, exam, 3);

    /** A student who started the exam through HTTP: attempt, active session and running timer. */
    async function startedStudent(options: { startTimer?: boolean } = {}) {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        await addParticipant(pool, tenant, exam, person.personId);
        const client = new BrowserLikeClient(app.baseUrl);
        assert.equal((await client.login(person.username, person.password)).status, 200);
        client.tenantId = tenant;
        const start = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.equal(start.status, 201);
        const attemptId: string = start.body.attemptId;
        const sessionId = randomUUID();
        if (options.startTimer !== false) {
            assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
            assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        }
        const save = (index: number, option: string, expectedWriteVersion: number | null = null) =>
            client.request('/api/v1/assessment/answer/save', {
                method: 'POST',
                body: { attemptId, sessionId, snapshotId: snapshots[index], answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion },
            });
        return { client, attemptId, save };
    }

    /** Moves the attempt's start back so its server deadline lies `secondsAgo` in the past. */
    async function expire(attemptId: string, secondsAgo = 1) {
        await pool.query(
            `UPDATE secure_assessment_timer_state
             SET started_at = statement_timestamp() - (configured_duration_seconds + $3) * interval '1 second'
             WHERE tenant_id = $1 AND exam_attempt_id = $2`,
            [tenant, attemptId, secondsAgo]
        );
    }

    async function submission(attemptId: string) {
        const res = await pool.query(
            'SELECT id, finalization_source FROM secure_assessment_exam_submissions WHERE tenant_id = $1 AND exam_attempt_id = $2',
            [tenant, attemptId]
        );
        return res.rows[0] ?? null;
    }

    await t.test('an attempt whose time ran out while the device was away is finalized from its accepted answers', async () => {
        const away = await startedStudent();
        assert.equal((await away.save(0, 'B')).status, 200);
        assert.equal((await away.save(1, 'C')).status, 200);
        await expire(away.attemptId);

        const running = await startedStudent();
        const extended = await startedStudent();
        await expire(extended.attemptId);
        const timerId = (await pool.query('SELECT id FROM secure_assessment_timer_state WHERE tenant_id = $1 AND exam_attempt_id = $2', [tenant, extended.attemptId])).rows[0].id;
        await pool.query(
            `INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason, actor_person_id) VALUES ($1, $2, 600, 'Gangguan listrik', $3)`,
            [tenant, timerId, randomUUID()]
        );
        const notStarted = await startedStudent({ startTimer: false });
        const submitted = await startedStudent();
        assert.equal((await submitted.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: submitted.attemptId } })).status, 200);
        await expire(submitted.attemptId);

        assert.deepEqual(await finalizeExpiredAttempts(pool), { finalized: 1 });
        const finalized = await submission(away.attemptId);
        assert.equal(finalized.finalization_source, 'EXPIRY_SERVER');
        assert.equal(await submission(running.attemptId), null, 'time left: untouched');
        assert.equal(await submission(extended.attemptId), null, 'a time adjustment extends the deadline');
        assert.equal(await submission(notStarted.attemptId), null, 'never started: absent, not finalized');
        assert.equal((await submission(submitted.attemptId)).finalization_source, 'STUDENT_SUBMIT');

        const answers = await pool.query(
            `SELECT a.answer_payload->>'selectedOptionId' AS option
             FROM secure_assessment_exam_answers a
             JOIN secure_assessment_exam_question_snapshots s ON s.id = a.exam_question_snapshot_id AND s.tenant_id = a.tenant_id
             WHERE a.tenant_id = $1 AND a.exam_attempt_id = $2 ORDER BY s.display_order`,
            [tenant, away.attemptId]
        );
        assert.deepEqual(answers.rows.map(r => r.option), ['B', 'C'], 'the accepted answers are what the submission stands on');

        assert.deepEqual(await finalizeExpiredAttempts(pool), { finalized: 0 }, 'a second sweep changes nothing');

        // The device comes back: its own expiry finalization and a late submit converge on
        // the same submission, and nothing more can be written.
        const late = await away.client.request('/api/v1/assessment/expiry-finalize', { method: 'POST', body: { attemptId: away.attemptId } });
        assert.equal(late.status, 200);
        assert.equal(late.body.submissionId, finalized.id);
        const again = await away.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: away.attemptId } });
        assert.equal(again.body.submissionId, finalized.id);
        const refused = await away.save(2, 'A');
        assert.equal(refused.status, 409);
        assert.equal(refused.body.error, 'attempt_already_submitted');
        assert.equal((await submission(away.attemptId)).finalization_source, 'EXPIRY_SERVER', 'the first finalization is recorded');
    });

    await t.test('an attempt held by an in-flight save or submit is left to the next sweep', async () => {
        const busy = await startedStudent();
        await expire(busy.attemptId);
        const holder = await pool.connect();
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 FOR UPDATE', [busy.attemptId]);
            assert.deepEqual(await finalizeExpiredAttempts(pool), { finalized: 0 });
            await holder.query('COMMIT');
        } finally {
            holder.release();
        }
        assert.deepEqual(await finalizeExpiredAttempts(pool), { finalized: 1 });
    });

    await t.test('the device finalizing at expiry records its own source', async () => {
        const present = await startedStudent();
        await expire(present.attemptId);
        const res = await present.client.request('/api/v1/assessment/expiry-finalize', { method: 'POST', body: { attemptId: present.attemptId } });
        assert.equal(res.status, 200);
        assert.equal((await submission(present.attemptId)).finalization_source, 'EXPIRY_CLIENT');
        assert.deepEqual(await finalizeExpiredAttempts(pool), { finalized: 0 });
    });

    await t.test('large backlogs are finalized in bounded batches', async () => {
        const students = await Promise.all([1, 2, 3].map(() => startedStudent()));
        for (const s of students) await expire(s.attemptId);
        assert.deepEqual(await finalizeExpiredAttempts(pool, 2), { finalized: 2 });
        assert.deepEqual(await finalizeExpiredAttempts(pool, 2), { finalized: 1 });
        for (const s of students) assert.equal((await submission(s.attemptId)).finalization_source, 'EXPIRY_SERVER');
    });
});
