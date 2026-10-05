import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { finalizeExpiredAttempts } from '../../src/expiry-finalization.ts';

// Add time for one participant against real PostgreSQL (ASSESS-PROCTOR-004; D04.6-41,
// D04.2-78/79, D04.5-31, D04.6-63/64, D04.4-67): only the managing teacher adds it, to one
// participant who still has time, while the exam runs or is paused; it is recorded with the
// minutes, reason, actor and time, never changed afterwards; every time computation follows
// it; a retried request adds nothing twice.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('add time for one participant (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool, 'guru.waktu');
    const otherTeacher = await createPersonWithAccount(pool);
    const proctor = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Sejarah');
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Geografi');
    await addMembership(pool, tenant, proctor.personId);

    const loggedIn = async (person: { username: string; password: string }) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const addTime = (c: BrowserLikeClient, body: Record<string, unknown>) =>
        c.request('/api/v1/assessment/exam-monitoring/add-time', { method: 'POST', body });
    const monitoring = async (c: BrowserLikeClient, examId: string) =>
        (await c.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${examId}`)).body;
    const transition = (examInstanceId: string, action: string) =>
        teacherClient.request('/api/v1/assessment/teacher-exams/transition', { method: 'POST', body: { examInstanceId, action } });
    const adjustments = async (attemptId: string) => (await pool.query(
        `SELECT adj.adjustment_seconds, adj.reason, adj.actor_person_id, adj.action_key, adj.created_at
         FROM secure_assessment_timer_adjustments adj JOIN secure_assessment_timer_state t ON t.id = adj.timer_state_id
         WHERE t.exam_attempt_id = $1 ORDER BY adj.created_at`,
        [attemptId]
    )).rows;

    async function student(exam: string, options: { startTimer?: boolean; start?: boolean } = {}) {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        const participantId = await addParticipant(pool, tenant, exam, person.personId);
        const client = await loggedIn(person);
        const s = {
            person, client, participantId, attemptId: '', sessionId: randomUUID(),
            save: (snapshotId: string, option: string) =>
                client.request('/api/v1/assessment/answer/save', {
                    method: 'POST',
                    body: { attemptId: s.attemptId, sessionId: s.sessionId, snapshotId, answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion: null },
                }),
            timer: async () => (await client.request(`/api/v1/assessment/timer?attemptId=${s.attemptId}`)).body,
            /** Moves the timer start so that `seconds` of working time are left. */
            leave: (seconds: number) => pool.query(
                `UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - make_interval(secs => configured_duration_seconds - $2) WHERE exam_attempt_id = $1`,
                [s.attemptId, seconds]
            ),
        };
        if (options.start === false) return s;
        s.attemptId = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId: s.attemptId, sessionId: s.sessionId } })).status, 200);
        if (options.startTimer !== false) assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        return s;
    }

    const exam = await createExamInstance(pool, tenant, teaching);
    const snapshots = await addQuestionSnapshots(pool, tenant, exam, 2);

    await t.test('the managing teacher adds time for one participant: recorded, followed by the timer and the list, others untouched', async () => {
        const s = await student(exam);
        const neighbour = await student(exam);
        const before = await s.timer();
        const actionKey = randomUUID();
        const res = await addTime(teacherClient, { examInstanceId: exam, participantId: s.participantId, minutes: 10, reason: '  Gangguan\nlistrik  ', actionKey });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.addedSeconds, 600);
        assert.equal(res.body.totalAddedSeconds, 600);
        assert.equal(res.body.replayed, false);
        assert.ok(res.body.remainingSeconds > before.effectiveRemainingSeconds + 590 && res.body.remainingSeconds <= before.effectiveRemainingSeconds + 600);

        const rows = await adjustments(s.attemptId);
        assert.equal(rows.length, 1);
        assert.deepEqual(
            { ...rows[0], created_at: rows[0].created_at.toISOString() },
            { adjustment_seconds: 600, reason: 'Gangguan listrik', actor_person_id: teacher.personId, action_key: actionKey, created_at: res.body.addedAt }
        );

        // The student's server timer follows at once; the configured duration stays as it was.
        const after = await s.timer();
        assert.equal(after.configuredDurationSeconds, before.configuredDurationSeconds);
        assert.equal(after.effectiveDurationSeconds, before.effectiveDurationSeconds + 600);
        assert.ok(after.effectiveRemainingSeconds > before.effectiveRemainingSeconds + 590);
        assert.equal((await neighbour.timer()).effectiveDurationSeconds, before.effectiveDurationSeconds, 'only this participant');

        // A retry finds the addition; the key never serves another one.
        const retry = await addTime(teacherClient, { examInstanceId: exam, participantId: s.participantId, minutes: 10, reason: 'Gangguan listrik', actionKey });
        assert.equal(retry.status, 200);
        assert.deepEqual({ ...retry.body, remainingSeconds: undefined }, { ...res.body, remainingSeconds: undefined, replayed: true });
        assert.equal((await addTime(teacherClient, { examInstanceId: exam, participantId: s.participantId, minutes: 15, reason: 'Gangguan listrik', actionKey })).body.error, 'action_key_reused');
        assert.equal((await addTime(teacherClient, { examInstanceId: exam, participantId: neighbour.participantId, minutes: 10, reason: 'Gangguan listrik', actionKey })).body.error, 'action_key_reused');
        assert.equal((await adjustments(s.attemptId)).length, 1);
        assert.equal((await adjustments(neighbour.attemptId)).length, 0);

        // A second addition adds up.
        const more = await addTime(teacherClient, { examInstanceId: exam, participantId: s.participantId, minutes: 5, reason: 'Perangkat diganti', actionKey: randomUUID() });
        assert.equal(more.status, 201);
        assert.equal(more.body.totalAddedSeconds, 900);

        const list = await monitoring(teacherClient, exam);
        assert.equal(list.canAddTime, true);
        const listed = list.participants.find((p: { participantId: string }) => p.participantId === s.participantId);
        assert.equal(listed.addedSeconds, 900);
        assert.deepEqual(listed.timeAdditions.map((a: { seconds: number; reason: string; by: unknown }) => [a.seconds, a.reason, a.by]), [
            [600, 'Gangguan listrik', { elligbleId: 'guru.waktu', you: true }],
            [300, 'Perangkat diganti', { elligbleId: 'guru.waktu', you: true }],
        ]);
        assert.equal(listed.timeAdditions[0].addedAt, res.body.addedAt);
        const other = list.participants.find((p: { participantId: string }) => p.participantId === neighbour.participantId);
        assert.deepEqual([other.addedSeconds, other.timeAdditions], [0, []]);

        // The ledger is append-only, and nothing enters it without an actor.
        await assert.rejects(pool.query('UPDATE secure_assessment_timer_adjustments SET adjustment_seconds = 6000'), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_timer_adjustments'), /append-only/);
        const timerId = (await pool.query('SELECT id FROM secure_assessment_timer_state WHERE exam_attempt_id = $1', [s.attemptId])).rows[0].id;
        await assert.rejects(
            pool.query(`INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason) VALUES ($1, $2, 60, 'tanpa pelaku')`, [tenant, timerId]),
            /ck_sa_timer_adj_actor/
        );
        await assert.rejects(
            pool.query(
                `INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason, actor_person_id, action_key) VALUES ($1, $2, 60, 'kunci sama', $3, $4)`,
                [tenant, timerId, teacher.personId, actionKey]
            ),
            /uq_sa_timer_adj_action_key/
        );
    });

    await t.test('added time carries the attempt past its old deadline; an attempt whose time ran out is not reopened', async () => {
        const s = await student(exam);
        await s.leave(2);
        assert.equal((await addTime(teacherClient, { examInstanceId: exam, participantId: s.participantId, minutes: 1, reason: 'Listrik padam', actionKey: randomUUID() })).status, 201);
        await sleep(2500);
        assert.equal((await s.save(snapshots[0], 'A')).status, 200, 'saves continue after the old deadline');
        assert.deepEqual(await finalizeExpiredAttempts(pool), { finalized: 0 });
        assert.equal((await s.timer()).status, 'active');

        const late = await student(exam);
        await late.leave(-5);
        const refused = await addTime(teacherClient, { examInstanceId: exam, participantId: late.participantId, minutes: 10, reason: 'Terlambat', actionKey: randomUUID() });
        assert.equal(refused.status, 409);
        assert.equal(refused.body.error, 'time_up');
        assert.equal((await adjustments(late.attemptId)).length, 0);
        assert.deepEqual(await finalizeExpiredAttempts(pool), { finalized: 1 });
        const submitted = await pool.query('SELECT finalization_source FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [late.attemptId]);
        assert.equal(submitted.rows[0].finalization_source, 'EXPIRY_SERVER');
        assert.equal((await addTime(teacherClient, { examInstanceId: exam, participantId: late.participantId, minutes: 10, reason: 'Terlambat', actionKey: randomUUID() })).body.error, 'no_active_attempt');
    });

    await t.test('while paused the addition waits in the frozen time; before a start, after submission or after END it is refused', async () => {
        const pausedExam = await createExamInstance(pool, tenant, teaching);
        await addQuestionSnapshots(pool, tenant, pausedExam, 1);
        const s = await student(pausedExam);
        const notStarted = await student(pausedExam, { startTimer: false });
        const absent = await student(pausedExam, { start: false });
        const done = await student(pausedExam);
        assert.equal((await done.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: done.attemptId } })).status, 200);

        assert.equal((await transition(pausedExam, 'pause')).status, 200);
        const frozen = (await s.timer()).effectiveRemainingSeconds;
        const res = await addTime(teacherClient, { examInstanceId: pausedExam, participantId: s.participantId, minutes: 3, reason: 'Kompensasi', actionKey: randomUUID() });
        assert.equal(res.status, 201);
        assert.equal(res.body.remainingSeconds, frozen + 180);
        await sleep(1100);
        assert.equal((await s.timer()).effectiveRemainingSeconds, frozen + 180, 'still frozen, with the addition');
        assert.equal((await transition(pausedExam, 'resume')).status, 200);

        const add = (participantId: string) => addTime(teacherClient, { examInstanceId: pausedExam, participantId, minutes: 3, reason: 'Kompensasi', actionKey: randomUUID() });
        assert.equal((await add(notStarted.participantId)).body.error, 'not_started');
        assert.equal((await add(absent.participantId)).body.error, 'no_active_attempt');
        assert.equal((await add(done.participantId)).body.error, 'no_active_attempt');

        assert.equal((await transition(pausedExam, 'end')).status, 200);
        const ended = await add(s.participantId);
        assert.equal(ended.status, 409);
        assert.deepEqual(ended.body, { error: 'invalid_state', currentState: 'ENDED' });
        assert.equal((await adjustments(s.attemptId)).length, 1);
    });

    await t.test('a retry that overtakes the original waits for it and adds nothing twice', async () => {
        const s = await student(exam);
        const body = { examInstanceId: exam, participantId: s.participantId, minutes: 7, reason: 'Jaringan terputus', actionKey: randomUUID() };
        // A save in flight holds the attempt, so the original and both retries are all under way
        // at once when it ends.
        const holder = await pool.connect();
        let results: Awaited<ReturnType<typeof addTime>>[];
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 FOR UPDATE', [s.attemptId]);
            const pending = Promise.all([addTime(teacherClient, body), addTime(teacherClient, body), addTime(teacherClient, body)]);
            await sleep(400);
            await holder.query('COMMIT');
            results = await pending;
        } finally {
            holder.release();
        }
        assert.deepEqual(results.map(r => r.status).sort(), [200, 200, 201], JSON.stringify(results.map(r => r.body)));
        assert.equal((await adjustments(s.attemptId)).length, 1);
        assert.equal(new Set(results.map(r => r.body.addedAt)).size, 1);
    });

    await t.test('a submission in flight lands first: no time is added to a submitted attempt', async () => {
        const s = await student(exam);
        const holder = await pool.connect();
        let res: Awaited<ReturnType<typeof addTime>>;
        try {
            // The student's submit holds the attempt and has written its submission.
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 FOR UPDATE', [s.attemptId]);
            await holder.query(`INSERT INTO secure_assessment_exam_submissions (tenant_id, exam_attempt_id, finalization_source) VALUES ($1, $2, 'STUDENT_SUBMIT')`, [tenant, s.attemptId]);
            const pending = addTime(teacherClient, { examInstanceId: exam, participantId: s.participantId, minutes: 5, reason: 'Terlambat masuk', actionKey: randomUUID() });
            await sleep(400);
            await holder.query('COMMIT');
            res = await pending;
        } finally {
            holder.release();
        }
        assert.equal(res.status, 409);
        assert.equal(res.body.error, 'no_active_attempt');
        assert.equal((await adjustments(s.attemptId)).length, 0);
    });

    await t.test('only the managing teacher adds time, with a valid amount and reason', async () => {
        const s = await student(exam);
        const valid = { examInstanceId: exam, participantId: s.participantId, minutes: 5, reason: 'Gangguan listrik' };
        const refusedBy = async (c: BrowserLikeClient) => (await addTime(c, { ...valid, actionKey: randomUUID() })).status;

        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        const proctorClient = await loggedIn(proctor);
        assert.equal(await refusedBy(proctorClient), 403, 'an assigned proctor does not add time');
        const proctorView = await monitoring(proctorClient, exam);
        assert.equal(proctorView.canAddTime, false);
        assert.ok(proctorView.participants.some((p: { addedSeconds: number; timeAdditions?: unknown }) => p.addedSeconds > 0 && p.timeAdditions === undefined),
            'a proctor sees that time was added, not by whom or why');
        assert.equal(await refusedBy(await loggedIn(otherTeacher)), 403);
        assert.equal(await refusedBy(s.client), 403);
        assert.equal((await addTime(teacherClient, { ...valid, participantId: randomUUID(), actionKey: randomUUID() })).status, 403);
        const elsewhere = await createExamInstance(pool, tenant, teaching);
        assert.equal((await addTime(teacherClient, { ...valid, examInstanceId: elsewhere, actionKey: randomUUID() })).status, 403, 'a participant of another exam');

        for (const bad of [
            { minutes: 0 }, { minutes: 121 }, { minutes: 1.5 }, { minutes: '10' }, { minutes: undefined },
            { reason: '' }, { reason: ' \n ' }, { reason: 'x'.repeat(201) }, { reason: 42 },
            { actionKey: 'bukan-kunci' }, { actionKey: undefined }, { examInstanceId: 'bukan-id' },
        ]) {
            const res = await addTime(teacherClient, { ...valid, actionKey: randomUUID(), ...bad });
            assert.equal(res.status, 400, JSON.stringify(bad));
        }
        assert.equal((await addTime(teacherClient, { ...valid, actionKey: randomUUID(), minutes: 120, reason: 'y'.repeat(200) })).status, 201, 'the limits themselves are accepted');
        assert.equal((await teacherClient.request('/api/v1/assessment/exam-monitoring/add-time')).status, 405);

        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = now() WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.equal(await refusedBy(teacherClient), 403, 'a revoked teaching assignment adds no time');
        assert.equal((await adjustments(s.attemptId)).length, 1, 'refused requests write nothing');
    });
});
