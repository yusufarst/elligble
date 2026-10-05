import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// Result finalization against real PostgreSQL (D04.8-17/18/19/20/56/57, D04.2-83; Owner
// decision 2026-09-30, ENDED point 5): only an ended exam with no attempt still running is
// finalized, by the teacher who manages it; the results are frozen as computed then, stay
// the same whatever changes later, record who finalized them and when, and publish nothing.

test('result finalization (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool, 'guru.final');
    const otherTeacher = await createPersonWithAccount(pool, 'guru.lain');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Fisika');
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
    const results = async (examInstanceId: string) => (await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examInstanceId}`)).body;

    async function student(exam: string, name: string, options: { startTimer?: boolean; start?: boolean } = {}) {
        const person = await createPersonWithAccount(pool, name);
        await addMembership(pool, tenant, person.personId);
        await addParticipant(pool, tenant, exam, person.personId);
        const client = await loggedIn(person);
        if (options.start === false) return { person, client, attemptId: null as string | null, save: async () => ({ status: 0, body: {} }) };
        const attemptId: string = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        if (options.startTimer !== false) assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const save = (snapshotId: string, option: string) => client.request('/api/v1/assessment/answer/save', {
            method: 'POST',
            body: { attemptId, sessionId, snapshotId, answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion: null },
        });
        return { person, client, attemptId: attemptId as string | null, save };
    }
    const expire = (attemptId: string) => pool.query(
        `UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - interval '3601 seconds' WHERE exam_attempt_id = $1`,
        [attemptId]
    );

    // Questions: correct answer B for each (fixtures.baselineQuestion).
    const { exam, snapshots } = await (async () => {
        const e = await createExamInstance(pool, tenant, teaching);
        return { exam: e, snapshots: await addQuestionSnapshots(pool, tenant, e, 3) };
    })();
    const done = await student(exam, 'siswa.final.a');
    const late = await student(exam, 'siswa.final.b');
    const waiting = await student(exam, 'siswa.final.c', { startTimer: false });
    await student(exam, 'siswa.final.d', { start: false });

    await t.test('only an ended exam whose attempts are all finished is finalized', async () => {
        assert.equal((await done.save(snapshots[0], 'B')).status, 200);
        assert.equal((await done.save(snapshots[1], 'B')).status, 200);
        assert.equal((await done.save(snapshots[2], 'A')).status, 200);
        assert.equal((await done.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: done.attemptId } })).status, 200);
        assert.equal((await late.save(snapshots[0], 'B')).status, 200);

        const early = await act(exam, 'finalize');
        assert.equal(early.status, 409);
        assert.deepEqual(early.body, { error: 'invalid_state', currentState: 'ACTIVE' });

        assert.equal((await act(exam, 'end')).status, 200);
        const running = await act(exam, 'finalize');
        assert.equal(running.status, 409);
        assert.deepEqual(running.body, { error: 'attempts_running', running: 1 });
        const nothing = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1', [exam]);
        assert.equal(nothing.rows[0].n, 0);
        assert.equal((await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [exam])).rows[0].lifecycle_state, 'ENDED');
    });

    await t.test('an attempt whose time ran out is finalized from its accepted answers, and the results are frozen', async () => {
        await expire(late.attemptId!);
        const finalized = await act(exam, 'finalize');
        assert.equal(finalized.status, 200);
        assert.deepEqual(finalized.body, { examInstanceId: exam, lifecycleState: 'FINALIZED', changed: true });

        const source = await pool.query('SELECT finalization_source FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [late.attemptId]);
        assert.equal(source.rows[0].finalization_source, 'EXPIRY_SERVER');

        const head = (await pool.query(
            'SELECT finalized_by_person_id, scoring_rule, question_count, max_score_micro::text AS max, pending_issues FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1',
            [exam]
        )).rows;
        assert.deepEqual(head, [{ finalized_by_person_id: teacher.personId, scoring_rule: 'BASELINE_SINGLE_CHOICE_V1', question_count: 3, max: '3000000', pending_issues: [] }]);
        const event = await pool.query(
            `SELECT from_state, to_state, actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND to_state = 'FINALIZED'`,
            [exam]
        );
        assert.deepEqual(event.rows, [{ from_state: 'ENDED', to_state: 'FINALIZED', actor_person_id: teacher.personId }]);

        const view = await results(exam);
        assert.equal(view.resultState, 'FINAL');
        assert.ok(view.finalizedAt);
        assert.equal(view.exam.lifecycleState, 'FINALIZED');
        assert.deepEqual(view.summary, { participants: 4, notStarted: 2, inProgress: 0, submitted: 2 });
        const byId = Object.fromEntries(view.participants.map((p: { elligbleId: string }) => [p.elligbleId, p]));
        assert.deepEqual(byId['siswa.final.a'].score, { correct: 2, incorrect: 1, unanswered: 0, rawScore: 2, maxScore: 3, scaledScore: 66.67 });
        assert.equal(byId['siswa.final.a'].finalizationSource, 'STUDENT_SUBMIT');
        assert.deepEqual(byId['siswa.final.b'].score, { correct: 1, incorrect: 0, unanswered: 2, rawScore: 1, maxScore: 3, scaledScore: 33.33 });
        assert.equal(byId['siswa.final.b'].finalizationSource, 'EXPIRY_SERVER');
        assert.equal(byId['siswa.final.c'].status, 'ABSENT', 'started the attempt but never the time: absent, not zero');
        assert.equal(byId['siswa.final.c'].score, null);
        assert.equal(byId['siswa.final.d'].status, 'ABSENT');
        assert.deepEqual(view.participants.map((p: { elligbleId: string }) => p.elligbleId), ['siswa.final.a', 'siswa.final.b', 'siswa.final.c', 'siswa.final.d']);

        const items = (await pool.query(
            `SELECT r.item_outcomes FROM secure_assessment_attempt_results r WHERE r.exam_attempt_id = $1`,
            [done.attemptId]
        )).rows[0].item_outcomes;
        assert.deepEqual(items, [
            { questionSnapshotId: snapshots[0], selectedOptionId: 'B', outcome: 'CORRECT', scoreMicro: 1000000, maxScoreMicro: 1000000 },
            { questionSnapshotId: snapshots[1], selectedOptionId: 'B', outcome: 'CORRECT', scoreMicro: 1000000, maxScoreMicro: 1000000 },
            { questionSnapshotId: snapshots[2], selectedOptionId: 'A', outcome: 'INCORRECT', scoreMicro: 0, maxScoreMicro: 1000000 },
        ]);
        void waiting;
    });

    await t.test('finalizing again changes nothing; the frozen results survive later edits and cannot be altered', async () => {
        const again = await act(exam, 'finalize');
        assert.deepEqual(again.body, { examInstanceId: exam, lifecycleState: 'FINALIZED', changed: false });
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1', [exam])).rows[0].n, 1);
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND to_state = 'FINALIZED'`, [exam])).rows[0].n, 1);

        const before = await results(exam);
        // Later edits to the sources: an answer and the answer key of a question. Recomputed,
        // siswa.final.a would score 3/3 on the answers alone and siswa.final.b 0/3 on the key.
        await pool.query(`UPDATE secure_assessment_exam_answers SET answer_payload = '{"selectedOptionId":"B"}' WHERE exam_attempt_id = $1 AND exam_question_snapshot_id = $2`, [done.attemptId, snapshots[2]]);
        await pool.query('ALTER TABLE secure_assessment_exam_question_snapshots DISABLE TRIGGER trg_prevent_snapshot_mutation');
        try {
            await pool.query(`UPDATE secure_assessment_exam_question_snapshots SET frozen_content = jsonb_set(frozen_content, '{correctOptionId}', '"C"') WHERE id = $1`, [snapshots[0]]);
        } finally {
            await pool.query('ALTER TABLE secure_assessment_exam_question_snapshots ENABLE TRIGGER trg_prevent_snapshot_mutation');
        }
        const after = await results(exam);
        assert.deepEqual(after.participants, before.participants, 'a finalized result does not follow later edits');

        await assert.rejects(pool.query(`UPDATE secure_assessment_attempt_results SET scaled_score = 100 WHERE exam_attempt_id = $1`, [done.attemptId]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_attempt_results WHERE exam_attempt_id = $1', [done.attemptId]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id = $1', [exam]), /append-only/);
        await assert.rejects(pool.query(
            `INSERT INTO secure_assessment_attempt_results (tenant_id, finalization_id, exam_participant_id, standing, correct_count)
             SELECT tenant_id, finalization_id, exam_participant_id, 'SUBMITTED', 1 FROM secure_assessment_attempt_results WHERE exam_attempt_id = $1`,
            [done.attemptId]
        ), /ck_sa_attempt_result_standing|uq_sa_attempt_result_participant/);

        const listed = (await teacherClient.request('/api/v1/assessment/teacher-readiness')).body.exams.find((e: { examInstanceId: string }) => e.examInstanceId === exam);
        assert.equal(listed.lifecycleState, 'FINALIZED');
        assert.equal(listed.finalizedAt, after.finalizedAt);
        assert.deepEqual(listed.progress, { participants: 4, started: 2, submitted: 2, running: 0 });

        // Nothing reaches the students: the exam list shows no score.
        const studentView = (await done.client.request('/api/v1/assessment/assigned-exams')).body;
        assert.doesNotMatch(JSON.stringify(studentView), /score|66\.67|scaled/i);
    });

    await t.test('only the managing teacher finalizes; content that cannot be scored blocks finalization', async () => {
        const ended = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'ENDED' });
        await addQuestionSnapshots(pool, tenant, ended, 2);
        const other = await loggedIn(otherTeacher);
        assert.equal((await act(ended, 'finalize', other)).status, 403);
        assert.equal((await act(ended, 'finalize', done.client)).status, 403);

        await pool.query(
            `INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, '{"schemaVersion":1}', 3)`,
            [tenant, ended]
        );
        const broken = await act(ended, 'finalize');
        assert.equal(broken.status, 409);
        assert.deepEqual(broken.body, { error: 'scoring_unavailable' });
        assert.equal((await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [ended])).rows[0].lifecycle_state, 'ENDED');
    });
});
