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

// Exam PAUSE, RESUME and END against real PostgreSQL (Owner decision 2026-09-30, D04.2-77/81):
// remaining time freezes at the authoritative pause boundary and continues from exactly
// there; nothing new is accepted while paused, but an answer chosen before the boundary is
// still saved; after a resume an answer chosen during the pause is refused; END stops new
// starts only, and running attempts finish on their own time. Idempotent and audited.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('exam pause, resume and end (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const otherTeacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Biologi');
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Kimia');

    const loggedIn = async (person: { username: string; password: string }) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const act = (examInstanceId: string, action: string, c: BrowserLikeClient = teacherClient) =>
        c.request('/api/v1/assessment/teacher-exams/transition', { method: 'POST', body: { examInstanceId, action } });

    async function activeExam(questions = 3) {
        const exam = await createExamInstance(pool, tenant, teaching);
        const snapshots = await addQuestionSnapshots(pool, tenant, exam, questions);
        return { exam, snapshots };
    }

    async function student(exam: string, options: { startTimer?: boolean } = {}) {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        await addParticipant(pool, tenant, exam, person.personId);
        const client = await loggedIn(person);
        const started = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.equal(started.status, 201);
        const attemptId: string = started.body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        if (options.startTimer !== false) {
            assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        }
        const s = {
            person, client, attemptId, sessionId,
            save: (snapshotId: string, option: string, extra: Record<string, unknown> = {}) =>
                client.request('/api/v1/assessment/answer/save', {
                    method: 'POST',
                    body: { attemptId, sessionId: s.sessionId, snapshotId, answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion: null, ...extra },
                }),
            timer: async () => (await client.request(`/api/v1/assessment/timer?attemptId=${attemptId}`)).body,
        };
        return s;
    }

    const storedAnswer = async (attemptId: string, snapshotId: string) =>
        (await pool.query(
            'SELECT answer_payload, write_version FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1 AND exam_question_snapshot_id = $2',
            [attemptId, snapshotId]
        )).rows[0] ?? null;
    const remainingAt = async (attemptId: string, at: Date) =>
        (await pool.query('SELECT secure_assessment_attempt_remaining_seconds($1, $2, $3) AS r', [tenant, attemptId, at])).rows[0].r as number;

    await t.test('the working-time rule subtracts exactly the paused part of each attempt', async () => {
        const { exam } = await activeExam(1);
        const person = await createPersonWithAccount(pool);
        const participant = await addParticipant(pool, tenant, exam, person.personId);
        const attempt = (await pool.query('INSERT INTO secure_assessment_exam_attempts (tenant_id, exam_participant_id) VALUES ($1, $2) RETURNING id', [tenant, participant])).rows[0].id;
        const timer = (await pool.query(
            `INSERT INTO secure_assessment_timer_state (tenant_id, exam_attempt_id, configured_duration_seconds, started_at)
             VALUES ($1, $2, 3600, '2026-01-01T10:00:00Z') RETURNING id`,
            [tenant, attempt]
        )).rows[0].id;
        await pool.query(`INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason, actor_person_id) VALUES ($1, $2, 60, 'uji', $3)`, [tenant, timer, randomUUID()]);
        const elapsed = async (at: string) =>
            (await pool.query('SELECT secure_assessment_attempt_elapsed_seconds($1, $2, $3) AS e', [tenant, attempt, at])).rows[0].e;
        const actor = randomUUID();
        const pause = (from: string, to: string | null) => pool.query(
            `INSERT INTO secure_assessment_exam_pauses (tenant_id, exam_instance_id, paused_at, paused_by_person_id, resumed_at, resumed_by_person_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenant, exam, from, actor, to, to ? actor : null]
        );

        assert.equal(await elapsed('2026-01-01T10:10:00.900Z'), 600, 'whole seconds, rounded down');
        await pause('2026-01-01T09:50:00Z', '2026-01-01T10:02:00Z'); // began before the start: only 120 s count
        await pause('2026-01-01T10:05:00Z', '2026-01-01T10:08:00Z'); // 180 s
        assert.equal(await elapsed('2026-01-01T10:10:00Z'), 300);
        await pause('2026-01-01T10:20:00Z', null); // open
        assert.equal(await elapsed('2026-01-01T10:25:00Z'), 1500 - 120 - 180 - 300);
        assert.equal(await elapsed('2026-01-01T11:40:00Z'), 900, 'frozen while the pause is open');
        assert.equal(await remainingAt(attempt, new Date('2026-01-01T11:40:00Z')), 3600 + 60 - 900);
        assert.equal(await elapsed('2026-01-01T10:01:00Z'), 0, 'inside a pause that began before the start');

        await assert.rejects(pause('2026-01-01T12:00:00Z', null), /uq_sa_exam_pauses_open/, 'one open pause per exam');
        await assert.rejects(
            pool.query(`UPDATE secure_assessment_exam_pauses SET paused_at = '2026-01-01T10:06:00Z' WHERE exam_instance_id = $1 AND paused_at = '2026-01-01T10:05:00Z'`, [exam]),
            /only closed once/
        );
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_pauses WHERE exam_instance_id = $1', [exam]), /never deleted/);
    });

    await t.test('PAUSE freezes time, refuses new work but keeps an answer chosen before the boundary; RESUME continues exactly', async () => {
        const { exam, snapshots } = await activeExam(3);
        const s = await student(exam);
        const waiting = await student(exam, { startTimer: false });
        assert.equal((await s.save(snapshots[0], 'A')).status, 200);
        const beforePause = new Date((await s.timer()).serverTime);

        const paused = await act(exam, 'pause');
        assert.equal(paused.status, 200);
        assert.deepEqual(paused.body, { examInstanceId: exam, lifecycleState: 'PAUSED', changed: true });
        const again = await act(exam, 'pause');
        assert.deepEqual(again.body, { examInstanceId: exam, lifecycleState: 'PAUSED', changed: false }, 'repeating a pause changes nothing');
        const pauseRow = (await pool.query('SELECT paused_at, paused_by_person_id, resumed_at FROM secure_assessment_exam_pauses WHERE exam_instance_id = $1', [exam])).rows;
        assert.equal(pauseRow.length, 1);
        assert.equal(pauseRow[0].paused_by_person_id, teacher.personId);
        assert.equal(pauseRow[0].resumed_at, null);
        const pausedAt: Date = pauseRow[0].paused_at;

        // Time is frozen at the boundary.
        const t1 = await s.timer();
        assert.equal(t1.examState, 'PAUSED');
        assert.equal(t1.pausedAt, pausedAt.toISOString());
        await sleep(1100);
        const t2 = await s.timer();
        assert.equal(t2.effectiveRemainingSeconds, t1.effectiveRemainingSeconds, 'no working time passes while paused');
        assert.ok(Date.parse(t2.serverTime) > Date.parse(t1.serverTime));

        // Nothing new starts.
        const lateStart = await (async () => {
            const person = await createPersonWithAccount(pool);
            await addMembership(pool, tenant, person.personId);
            await addParticipant(pool, tenant, exam, person.personId);
            return (await loggedIn(person)).request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        })();
        assert.equal(lateStart.status, 409);
        assert.equal(lateStart.body.error, 'exam_paused');
        const timerStart = await waiting.client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId: waiting.attemptId } });
        assert.equal(timerStart.status, 409);
        assert.equal(timerStart.body.error, 'exam_paused');

        // New work is refused; the student's own screen state and a replay stay intact.
        const unstamped = await s.save(snapshots[1], 'C');
        assert.equal(unstamped.status, 409);
        assert.equal(unstamped.body.error, 'exam_paused');
        assert.equal(unstamped.body.pausedAt, pausedAt.toISOString());
        const afterBoundary = await s.save(snapshots[1], 'C', { capturedAt: new Date(pausedAt.getTime() + 1).toISOString() });
        assert.equal(afterBoundary.status, 409);
        assert.equal(afterBoundary.body.error, 'exam_paused');
        assert.equal(await storedAnswer(s.attemptId, snapshots[1]), null);

        const chosenBefore = await s.save(snapshots[2], 'D', { capturedAt: new Date(pausedAt.getTime() - 1).toISOString() });
        assert.equal(chosenBefore.status, 200, 'an answer chosen before the boundary is not lost');
        assert.deepEqual((await storedAnswer(s.attemptId, snapshots[2])).answer_payload, { selectedOptionId: 'D' });

        const flag = await s.client.request('/api/v1/assessment/review-flag', { method: 'POST', body: { attemptId: s.attemptId, sessionId: s.sessionId, snapshotId: snapshots[0], flagged: true } });
        assert.equal(flag.status, 409);
        assert.equal(flag.body.error, 'exam_paused');
        const submit = await s.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } });
        assert.equal(submit.status, 409);
        assert.equal(submit.body.error, 'exam_paused');
        const questions = await s.client.request(`/api/v1/assessment/questions?attemptId=${s.attemptId}`);
        assert.equal(questions.status, 409);
        assert.equal(questions.body.error, 'exam_paused');
        const resumeView = (await s.client.request(`/api/v1/assessment/resume?attemptId=${s.attemptId}&examSessionId=${s.sessionId}`)).body;
        assert.deepEqual(resumeView.exam, { lifecycleState: 'PAUSED', pausedAt: pausedAt.toISOString() });
        assert.equal(resumeView.timer.effectiveRemainingSeconds, t1.effectiveRemainingSeconds);
        assert.ok(resumeView.serverTime);
        // A move to another device stays possible while paused (the new session then sees the pause).
        const newSession = randomUUID();
        const conflict = await s.client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId: s.attemptId, sessionId: newSession } });
        assert.equal(conflict.status, 409);
        const moved = await s.client.request('/api/v1/assessment/session/activate', {
            method: 'POST', body: { attemptId: s.attemptId, sessionId: newSession, confirmSupersede: true, expectedActiveSessionFingerprint: conflict.body.activeSessionFingerprint },
        });
        assert.equal(moved.status, 200);
        const back = await s.client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId: s.attemptId, sessionId: s.sessionId } });
        assert.equal(back.status, 409, 'the replaced session does not come back by itself');
        const returning = randomUUID();
        const again409 = await s.client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId: s.attemptId, sessionId: returning } });
        const takeBack = await s.client.request('/api/v1/assessment/session/activate', {
            method: 'POST', body: { attemptId: s.attemptId, sessionId: returning, confirmSupersede: true, expectedActiveSessionFingerprint: again409.body.activeSessionFingerprint },
        });
        assert.equal(takeBack.status, 200);
        s.sessionId = returning;

        // END needs a resume first (not decided by the Owner).
        const endWhilePaused = await act(exam, 'end');
        assert.equal(endWhilePaused.status, 409);
        assert.deepEqual(endWhilePaused.body, { error: 'invalid_state', currentState: 'PAUSED' });

        await sleep(1100);
        const resumed = await act(exam, 'resume');
        assert.deepEqual(resumed.body, { examInstanceId: exam, lifecycleState: 'ACTIVE', changed: true });
        assert.deepEqual((await act(exam, 'resume')).body, { examInstanceId: exam, lifecycleState: 'ACTIVE', changed: false });
        const closed = (await pool.query('SELECT paused_at, resumed_at, resumed_by_person_id FROM secure_assessment_exam_pauses WHERE exam_instance_id = $1', [exam])).rows;
        assert.equal(closed.length, 1);
        assert.equal(closed[0].resumed_by_person_id, teacher.personId);
        const resumedAt: Date = closed[0].resumed_at;
        assert.ok(resumedAt.getTime() - pausedAt.getTime() >= 2000);

        // Exactly the pre-pause remaining time continues.
        assert.equal(await remainingAt(s.attemptId, resumedAt), await remainingAt(s.attemptId, pausedAt));
        assert.ok(await remainingAt(s.attemptId, pausedAt) <= await remainingAt(s.attemptId, beforePause));

        // After the resume: chosen during the pause is refused, anything else is accepted.
        const duringPause = await s.save(snapshots[1], 'C', { capturedAt: new Date(pausedAt.getTime() + 500).toISOString() });
        assert.equal(duringPause.status, 409);
        assert.deepEqual(
            { error: duringPause.body.error, pausedAt: duringPause.body.pausedAt, resumedAt: duringPause.body.resumedAt },
            { error: 'captured_during_pause', pausedAt: pausedAt.toISOString(), resumedAt: resumedAt.toISOString() }
        );
        assert.equal((await s.save(snapshots[1], 'C', { capturedAt: new Date(pausedAt.getTime() - 1000).toISOString() })).status, 200);
        const ack = await s.save(snapshots[0], 'B', { capturedAt: new Date(resumedAt.getTime() + 10).toISOString(), expectedWriteVersion: 1 });
        assert.equal(ack.status, 200);
        assert.ok(Date.parse(ack.body.serverTime) >= resumedAt.getTime());
        assert.equal((await s.save(snapshots[1], 'E', { expectedWriteVersion: 1 })).status, 200, 'an undeclared capture time counts as now');
        assert.equal((await s.timer()).examState, 'ACTIVE');
        assert.equal((await waiting.client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId: waiting.attemptId } })).status, 200);

        const events = await pool.query(
            'SELECT from_state, to_state, actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 ORDER BY occurred_at',
            [exam]
        );
        assert.deepEqual(events.rows, [
            { from_state: 'ACTIVE', to_state: 'PAUSED', actor_person_id: teacher.personId },
            { from_state: 'PAUSED', to_state: 'ACTIVE', actor_person_id: teacher.personId },
        ], 'each effective change recorded once, with its actor');
    });

    await t.test('an attempt does not run out of time during a pause, and the sweep leaves it alone', async () => {
        const { exam } = await activeExam(1);
        const s = await student(exam);
        // Its wall-clock deadline passed 100 s ago, but 200 s of that were paused.
        await pool.query(`UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - interval '3700 seconds' WHERE exam_attempt_id = $1`, [s.attemptId]);
        await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'PAUSED' WHERE id = $1`, [exam]);
        await pool.query(
            `INSERT INTO secure_assessment_exam_pauses (tenant_id, exam_instance_id, paused_at, paused_by_person_id) VALUES ($1, $2, statement_timestamp() - interval '200 seconds', $3)`,
            [tenant, exam, teacher.personId]
        );
        await finalizeExpiredAttempts(pool);
        const open = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [s.attemptId]);
        assert.equal(open.rows[0].n, 0);
        const view = await s.timer();
        assert.equal(view.status, 'active');
        assert.equal(view.effectiveRemainingSeconds, 100);
        assert.equal((await act(exam, 'resume')).status, 200);
        assert.ok((await s.timer()).effectiveRemainingSeconds >= 99);
    });

    await t.test('the boundary is taken after writes in flight, and writes waiting on a pause see it', async () => {
        const { exam, snapshots } = await activeExam(2);
        const s = await student(exam);

        // A save holding the exam row (as every write does) delays the pause boundary.
        const holder = await pool.connect();
        let pauseDone = false;
        let pending: Promise<unknown>;
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR KEY SHARE', [exam]);
            pending = act(exam, 'pause').then(r => { pauseDone = true; return r; });
            await sleep(300);
            assert.equal(pauseDone, false, 'the pause waits for the write in flight');
            const lastWrite: Date = (await holder.query('SELECT statement_timestamp() AS t')).rows[0].t;
            await holder.query('COMMIT');
            assert.equal(((await pending) as { status: number }).status, 200);
            const pausedAt: Date = (await pool.query('SELECT paused_at FROM secure_assessment_exam_pauses WHERE exam_instance_id = $1', [exam])).rows[0].paused_at;
            assert.ok(pausedAt.getTime() > lastWrite.getTime(), 'the boundary comes after it');
        } finally {
            holder.release();
        }
        assert.equal((await act(exam, 'resume')).status, 200);

        // A save arriving while a pause is being recorded waits and then sees the pause.
        const pauser = await pool.connect();
        let saveDone = false;
        try {
            await pauser.query('BEGIN');
            await pauser.query('SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR UPDATE', [exam]);
            const save = s.save(snapshots[0], 'A').then(r => { saveDone = true; return r; });
            await sleep(300);
            assert.equal(saveDone, false, 'the save waits for the pause in progress');
            await pauser.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'PAUSED' WHERE id = $1`, [exam]);
            await pauser.query(
                'INSERT INTO secure_assessment_exam_pauses (tenant_id, exam_instance_id, paused_at, paused_by_person_id) VALUES ($1, $2, statement_timestamp(), $3)',
                [tenant, exam, teacher.personId]
            );
            await pauser.query('COMMIT');
            const res = await save;
            assert.equal(res.status, 409);
            assert.equal(res.body.error, 'exam_paused');
            assert.equal(await storedAnswer(s.attemptId, snapshots[0]), null);
        } finally {
            pauser.release();
        }
    });

    await t.test('concurrent pauses record one boundary and one event', async () => {
        const { exam } = await activeExam(1);
        const results = await Promise.all([act(exam, 'pause'), act(exam, 'pause'), act(exam, 'pause')]);
        assert.deepEqual(results.map(r => r.status), [200, 200, 200]);
        assert.equal(results.filter(r => r.body.changed).length, 1);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_pauses WHERE exam_instance_id = $1', [exam])).rows[0].n, 1);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1', [exam])).rows[0].n, 1);
    });

    await t.test('END stops new starts only: running attempts keep working and finish on their own time', async () => {
        const { exam, snapshots } = await activeExam(2);
        const running = await student(exam);
        const expiring = await student(exam);
        const waiting = await student(exam, { startTimer: false });

        const ended = await act(exam, 'end');
        assert.deepEqual(ended.body, { examInstanceId: exam, lifecycleState: 'ENDED', changed: true });
        assert.deepEqual((await act(exam, 'end')).body, { examInstanceId: exam, lifecycleState: 'ENDED', changed: false });
        assert.equal((await act(exam, 'pause')).status, 409, 'an ended exam is not paused');
        assert.equal((await act(exam, 'resume')).status, 409);

        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        await addParticipant(pool, tenant, exam, person.personId);
        const lateStart = await (await loggedIn(person)).request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.equal(lateStart.status, 409);
        assert.equal(lateStart.body.error, 'exam_ended');
        const timerStart = await waiting.client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId: waiting.attemptId } });
        assert.equal(timerStart.status, 409);
        assert.equal(timerStart.body.error, 'exam_ended');

        // Nothing is force-submitted.
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_submissions WHERE exam_attempt_id = ANY($1::uuid[])', [[running.attemptId, expiring.attemptId]])).rows[0].n, 0);
        assert.equal((await running.client.request(`/api/v1/assessment/questions?attemptId=${running.attemptId}`)).status, 200);
        assert.equal((await running.save(snapshots[0], 'B')).status, 200);
        assert.equal((await running.timer()).examState, 'ENDED');

        // Each attempt finishes on its own time: the sweep submits only the one that ran out.
        await pool.query(`UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - interval '3601 seconds' WHERE exam_attempt_id = $1`, [expiring.attemptId]);
        await finalizeExpiredAttempts(pool);
        const sources = await pool.query('SELECT exam_attempt_id, finalization_source FROM secure_assessment_exam_submissions WHERE exam_attempt_id = ANY($1::uuid[])', [[running.attemptId, expiring.attemptId]]);
        assert.deepEqual(sources.rows, [{ exam_attempt_id: expiring.attemptId, finalization_source: 'EXPIRY_SERVER' }]);
        const submitted = await running.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: running.attemptId } });
        assert.equal(submitted.status, 200);

        // The teacher sees the ended exam and who is still working; results stay provisional.
        const listed = (await teacherClient.request('/api/v1/assessment/teacher-readiness')).body.exams.find((e: { examInstanceId: string }) => e.examInstanceId === exam);
        assert.equal(listed.lifecycleState, 'ENDED');
        assert.deepEqual(listed.progress, { participants: 4, started: 2, submitted: 2, running: 0 });
    });

    await t.test('only the managing teacher pauses, resumes or ends; the views show the pause', async () => {
        const { exam } = await activeExam(1);
        const s = await student(exam);
        const other = await loggedIn(otherTeacher);
        assert.equal((await act(exam, 'pause', other)).status, 403);
        assert.equal((await act(exam, 'pause', s.client)).status, 403);
        assert.equal((await act(exam, 'end', other)).status, 403);
        assert.equal((await act(exam, 'stop')).status, 400);
        assert.equal((await act(exam, 'toString')).status, 400);

        assert.equal((await act(exam, 'pause')).status, 200);
        const pausedAt = (await pool.query('SELECT paused_at FROM secure_assessment_exam_pauses WHERE exam_instance_id = $1', [exam])).rows[0].paused_at.toISOString();
        const listed = (await teacherClient.request('/api/v1/assessment/teacher-readiness')).body.exams.find((e: { examInstanceId: string }) => e.examInstanceId === exam);
        assert.equal(listed.lifecycleState, 'PAUSED');
        assert.equal(listed.pausedAt, pausedAt);
        assert.deepEqual(listed.progress, { participants: 1, started: 1, submitted: 0, running: 1 });
        const monitoring = (await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`)).body;
        assert.equal(monitoring.exam.lifecycleState, 'PAUSED');
        assert.equal(monitoring.exam.pausedAt, pausedAt);
        const first = monitoring.participants[0].remainingSeconds;
        await sleep(1100);
        const later = (await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`)).body;
        assert.equal(later.participants[0].remainingSeconds, first, 'monitoring shows the frozen time');
    });
});
