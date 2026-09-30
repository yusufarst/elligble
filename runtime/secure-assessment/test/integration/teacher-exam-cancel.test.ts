import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// Cancelling an exam before it opens against real PostgreSQL (ASSESS-TEACHER-003; D04.2-47,
// Owner decision 2026-09-30): SCHEDULED or READY to ARCHIVED, never an opened exam; a
// mandatory reason, the actor and the time in append-only history that tells a cancellation
// apart from an archive after completion; nothing deleted; safe to repeat; students no longer
// find or start it; its time slot is free again; teachers and proctors keep it as cancelled.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('cancelling an exam before it opens (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool, 'guru.batal');
    const otherTeacher = await createPersonWithAccount(pool);
    const proctor = await createPersonWithAccount(pool);
    const student = await createPersonWithAccount(pool, 'siswa.batal');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Seni Budaya');
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Prakarya');
    await addMembership(pool, tenant, proctor.personId);
    await addMembership(pool, tenant, student.personId);

    const loggedIn = async (person: { username: string; password: string }, tenantId = tenant) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenantId;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const cancel = (c: BrowserLikeClient, body: Record<string, unknown>) =>
        c.request('/api/v1/assessment/teacher-exams/cancel', { method: 'POST', body });
    const transition = (examInstanceId: string, action: string) =>
        teacherClient.request('/api/v1/assessment/teacher-exams/transition', { method: 'POST', body: { examInstanceId, action } });
    const cancellations = async (exam: string) => (await pool.query(
        `SELECT id, previous_lifecycle_state, reason, cancelled_by_person_id, action_key, cancelled_at
         FROM secure_assessment_exam_cancellations WHERE exam_instance_id = $1`,
        [exam]
    )).rows;
    const events = async (exam: string) => (await pool.query(
        `SELECT from_state, to_state, actor_person_id, occurred_at, cancellation_id
         FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 ORDER BY occurred_at`,
        [exam]
    )).rows;
    const stateOf = async (exam: string) => (await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = $1', [exam])).rows[0]?.lifecycle_state;
    const evidence = async (exam: string) => (await pool.query(
        `SELECT (SELECT count(*)::int FROM secure_assessment_exam_participants WHERE exam_instance_id = $1) AS participants,
                (SELECT count(*)::int FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1) AS questions,
                (SELECT count(*)::int FROM secure_assessment_proctor_assignments WHERE exam_instance_id = $1) AS proctors`,
        [exam]
    )).rows[0];

    /** A scheduled exam tomorrow, 2 questions, the student as participant. */
    async function plannedExam(lifecycleState = 'SCHEDULED', options: { startsInHours?: number } = {}) {
        const startsAt = new Date(Date.now() + (options.startsInHours ?? 24) * 3_600_000);
        const exam = await createExamInstance(pool, tenant, teaching, {
            lifecycleState, windowStartsAt: startsAt, windowEndsAt: new Date(startsAt.getTime() + 2 * 3_600_000), durationSeconds: 3600,
        });
        await addQuestionSnapshots(pool, tenant, exam, 2);
        await addParticipant(pool, tenant, exam, student.personId);
        return exam;
    }

    await t.test('a scheduled exam is cancelled: archived, never deleted, with reason, actor and time in append-only history', async () => {
        const exam = await plannedExam();
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        const before = await evidence(exam);
        const actionKey = randomUUID();
        const res = await cancel(teacherClient, { examInstanceId: exam, reason: '  Bentrok dengan\n  upacara sekolah  ', actionKey });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual({ ...res.body, cancelledAt: undefined }, {
            examInstanceId: exam, reason: 'Bentrok dengan upacara sekolah', changed: true, replayed: false, cancelledAt: undefined,
        });
        assert.equal(await stateOf(exam), 'ARCHIVED', 'kept, as ARCHIVED');
        const [record] = await cancellations(exam);
        assert.deepEqual({ ...record, id: undefined, cancelled_at: record.cancelled_at.toISOString() }, {
            id: undefined, previous_lifecycle_state: 'SCHEDULED', reason: 'Bentrok dengan upacara sekolah', cancelled_by_person_id: teacher.personId,
            action_key: actionKey, cancelled_at: res.body.cancelledAt,
        });
        const history = await events(exam);
        assert.equal(history.length, 1);
        assert.deepEqual({ ...history[0], occurred_at: history[0].occurred_at.toISOString() }, {
            from_state: 'SCHEDULED', to_state: 'ARCHIVED', actor_person_id: teacher.personId, occurred_at: res.body.cancelledAt, cancellation_id: record.id,
        });
        assert.deepEqual(await evidence(exam), before, 'participants, questions and proctors stay');

        // Append-only, and never physically deleted.
        await assert.rejects(pool.query(`UPDATE secure_assessment_exam_cancellations SET reason = 'lain' WHERE exam_instance_id = $1`, [exam]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_cancellations WHERE exam_instance_id = $1', [exam]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_instances WHERE id = $1', [exam]), /violates foreign key/);
        // One cancellation per exam, whatever the path.
        await assert.rejects(pool.query(
            `INSERT INTO secure_assessment_exam_cancellations (tenant_id, exam_instance_id, cancelled_by_person_id, reason, previous_lifecycle_state, action_key)
             VALUES ($1, $2, $3, 'lagi', 'SCHEDULED', $4)`,
            [tenant, exam, teacher.personId, randomUUID()]
        ), /uq_sa_exam_cancellation_exam/);
        // The database keeps the rule on every path: a cancelled exam stays cancelled, and an
        // exam that never opened is archived only through a recorded cancellation.
        await assert.rejects(pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'SCHEDULED' WHERE id = $1`, [exam]), /stays cancelled/);
        const untouched = await plannedExam();
        await assert.rejects(pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'ARCHIVED' WHERE id = $1`, [untouched]), /recorded cancellation/);
        await assert.rejects(pool.query(
            `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id) VALUES ($1, $2, 'READY', 'ARCHIVED', $3)`,
            [tenant, untouched, teacher.personId]
        ), /ck_sa_lifecycle_event_cancellation/);
        // An archive after completion carries no cancellation.
        await assert.rejects(pool.query(
            `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id, cancellation_id)
             VALUES ($1, $2, 'FINALIZED', 'ARCHIVED', $3, $4)`,
            [tenant, exam, teacher.personId, record.id]
        ), /ck_sa_lifecycle_event_cancellation/);
    });

    await t.test('a ready exam is cancelled too', async () => {
        const exam = await plannedExam('READY');
        const res = await cancel(teacherClient, { examInstanceId: exam, reason: 'Materi belum selesai', actionKey: randomUUID() });
        assert.equal(res.status, 200);
        assert.equal(await stateOf(exam), 'ARCHIVED');
        assert.equal((await cancellations(exam))[0].previous_lifecycle_state, 'READY');
        assert.deepEqual((await events(exam)).map(e => [e.from_state, e.to_state]), [['READY', 'ARCHIVED']]);
    });

    await t.test('an opened exam is never cancelled: its end stays END', async () => {
        for (const state of ['ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED']) {
            const exam = await plannedExam(state);
            const res = await cancel(teacherClient, { examInstanceId: exam, reason: 'Salah jadwal', actionKey: randomUUID() });
            assert.equal(res.status, 409, state);
            assert.deepEqual(res.body, { error: 'invalid_state', currentState: state });
            assert.equal(await stateOf(exam), state);
            assert.equal((await cancellations(exam)).length, 0);
            assert.equal((await events(exam)).length, 0);
        }
    });

    await t.test('a reason is required, and only the managing teacher cancels', async () => {
        const exam = await plannedExam();
        const body = { examInstanceId: exam, reason: 'Salah jadwal' };
        for (const bad of [{ reason: '' }, { reason: '   \n ' }, { reason: 'x'.repeat(201) }, { reason: 42 }, { reason: undefined }, { examInstanceId: 'bukan-id' }, { actionKey: 'bukan-kunci' }]) {
            assert.equal((await cancel(teacherClient, { ...body, actionKey: randomUUID(), ...bad })).status, 400, JSON.stringify(bad));
        }
        assert.equal((await cancel(await loggedIn(otherTeacher), { ...body, actionKey: randomUUID() })).status, 403, 'another teacher');
        assert.equal((await cancel(await loggedIn(student), { ...body, actionKey: randomUUID() })).status, 403, 'a student');
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        assert.equal((await cancel(await loggedIn(proctor), { ...body, actionKey: randomUUID() })).status, 403, 'an assigned proctor');
        assert.equal((await cancel(teacherClient, { ...body, examInstanceId: randomUUID(), actionKey: randomUUID() })).status, 403, 'an unknown exam');
        // Another school: the exam does not exist there.
        const otherSchool = await createTenant(pool);
        const outsider = await createPersonWithAccount(pool);
        await createTeachingContext(pool, otherSchool, await addMembership(pool, otherSchool, outsider.personId));
        assert.equal((await cancel(await loggedIn(outsider, otherSchool), { ...body, actionKey: randomUUID() })).status, 403, 'another school');
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/cancel')).status, 405);
        assert.equal(await stateOf(exam), 'SCHEDULED');
        assert.equal((await cancellations(exam)).length, 0, 'refused requests write nothing');
        // The reason at its limit is accepted.
        assert.equal((await cancel(teacherClient, { ...body, reason: 'y'.repeat(200), actionKey: randomUUID() })).status, 200);
    });

    await t.test('repeating a cancellation is safe', async () => {
        const exam = await plannedExam();
        const actionKey = randomUUID();
        const first = await cancel(teacherClient, { examInstanceId: exam, reason: 'Guru berhalangan', actionKey });
        const retry = await cancel(teacherClient, { examInstanceId: exam, reason: 'Guru berhalangan', actionKey });
        assert.equal(retry.status, 200);
        assert.deepEqual(retry.body, { ...first.body, replayed: true });
        const again = await cancel(teacherClient, { examInstanceId: exam, reason: 'Alasan lain', actionKey: randomUUID() });
        assert.equal(again.status, 200);
        assert.deepEqual(again.body, { ...first.body, changed: false, replayed: false }, 'already cancelled: the first reason stays');
        const other = await plannedExam();
        assert.equal((await cancel(teacherClient, { examInstanceId: other, reason: 'Guru berhalangan', actionKey })).body.error, 'action_key_reused');
        assert.equal(await stateOf(other), 'SCHEDULED');
        assert.equal((await cancellations(exam)).length, 1);
        assert.equal((await events(exam)).length, 1);

        // Requests racing each other while a transition holds the exam: one cancellation.
        const raced = await plannedExam();
        const holder = await pool.connect();
        let results: Awaited<ReturnType<typeof cancel>>[];
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR UPDATE', [raced]);
            const key = randomUUID();
            const pending = Promise.all([
                cancel(teacherClient, { examInstanceId: raced, reason: 'Ganti jadwal', actionKey: key }),
                cancel(teacherClient, { examInstanceId: raced, reason: 'Ganti jadwal', actionKey: key }),
                cancel(teacherClient, { examInstanceId: raced, reason: 'Ganti jadwal', actionKey: randomUUID() }),
            ]);
            await sleep(400);
            await holder.query('COMMIT');
            results = await pending;
        } finally {
            holder.release();
        }
        assert.ok(results.every(r => r.status === 200), JSON.stringify(results.map(r => r.body)));
        assert.equal(results.filter(r => r.body.changed && !r.body.replayed).length, 1, 'exactly one cancels');
        assert.equal((await cancellations(raced)).length, 1);
        assert.equal((await events(raced)).length, 1);
    });

    await t.test('students no longer find or start a cancelled exam, and its time is free for scheduling', async () => {
        const cancelled = await plannedExam('SCHEDULED', { startsInHours: 48 });
        const sameTime = await plannedExam('SCHEDULED', { startsInHours: 48 });
        const studentClient = await loggedIn(student);
        const listed = async () => (await studentClient.request('/api/v1/assessment/assigned-exams')).body.assignments.map((a: { examInstanceId: string }) => a.examInstanceId);
        assert.ok((await listed()).includes(cancelled));

        // The same student expected in both at the same time: the second cannot be made ready.
        const blocked = await transition(sameTime, 'mark_ready');
        assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
        assert.equal(blocked.body.readiness.baseline.blocker, 'participant_schedule_conflict');

        assert.equal((await cancel(teacherClient, { examInstanceId: cancelled, reason: 'Diganti ujian lain', actionKey: randomUUID() })).status, 200);
        const after = await listed();
        assert.ok(!after.includes(cancelled), 'gone from student discovery');
        assert.ok(after.includes(sameTime), 'other exams stay');
        const start = await studentClient.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: cancelled } });
        assert.equal(start.status, 409);
        assert.equal(start.body.error, 'exam_cancelled');
        const attempts = await pool.query(
            'SELECT count(*)::int AS n FROM secure_assessment_exam_attempts a JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id WHERE p.exam_instance_id = $1',
            [cancelled]
        );
        assert.equal(attempts.rows[0].n, 0);

        const ready = await transition(sameTime, 'mark_ready');
        assert.equal(ready.status, 200, `the slot is free again: ${JSON.stringify(ready.body)}`);
    });

    await t.test('teachers keep the cancelled exam as history, proctors see it cancelled', async () => {
        const exam = await plannedExam();
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        const res = await cancel(teacherClient, { examInstanceId: exam, reason: 'Libur mendadak', actionKey: randomUUID() });
        const readiness = (await teacherClient.request('/api/v1/assessment/teacher-readiness')).body.exams
            .find((e: { examInstanceId: string }) => e.examInstanceId === exam);
        assert.deepEqual(
            { state: readiness.lifecycleState, cancellation: readiness.cancellation, progress: readiness.progress, baseline: readiness.baseline.status },
            {
                state: 'ARCHIVED', progress: null, baseline: 'not_evaluated',
                cancellation: { cancelledAt: res.body.cancelledAt, reason: 'Libur mendadak', by: { you: true, elligbleId: 'guru.batal' } },
            }
        );
        const proctored = (await (await loggedIn(proctor)).request('/api/v1/assessment/proctor-monitoring')).body.assignments
            .find((a: { examInstanceId: string }) => a.examInstanceId === exam);
        assert.equal(proctored.cancelledAt, res.body.cancelledAt);
        const live = (await (await loggedIn(proctor)).request('/api/v1/assessment/proctor-monitoring')).body.assignments
            .filter((a: { cancelledAt: string | null }) => a.cancelledAt === null);
        assert.ok(live.every((a: { examInstanceId: string }) => a.examInstanceId !== exam));
    });

    await t.test('a revoked teaching assignment cancels nothing', async () => {
        const exam = await plannedExam();
        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = now() WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.equal((await cancel(teacherClient, { examInstanceId: exam, reason: 'Salah jadwal', actionKey: randomUUID() })).status, 403);
        assert.equal(await stateOf(exam), 'SCHEDULED');
    });
});
