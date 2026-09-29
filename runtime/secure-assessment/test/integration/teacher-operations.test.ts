import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

test('teacher-managed exam operations (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 1 Contoh');

    const teacher = await createPersonWithAccount(pool, 'guru.operasi');
    const otherTeacher = await createPersonWithAccount(pool, 'guru.lain');
    const student = await createPersonWithAccount(pool, 'siswa.operasi');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Fisika');
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Kimia');
    await addMembership(pool, tenant, student.personId);

    const clientFor = async (person: typeof teacher) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await clientFor(teacher);
    const transition = (c: BrowserLikeClient, examInstanceId: string, action: string) =>
        c.request('/api/v1/assessment/teacher-exams/transition', { method: 'POST', body: { examInstanceId, action } });

    // Each exam gets its own participant: one student in two overlapping exams is a
    // participant schedule conflict (D04.2-39) and correctly blocks READY.
    async function scheduledExam(options: Parameters<typeof createExamInstance>[3] = {}, questions = 3, withStudent = true, participant: typeof student | null = student) {
        const exam = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED', ...options });
        if (questions > 0) await addQuestionSnapshots(pool, tenant, exam, questions);
        if (withStudent) {
            const person = participant ?? await createPersonWithAccount(pool);
            if (participant === null) await addMembership(pool, tenant, person.personId);
            await addParticipant(pool, tenant, exam, person.personId);
        }
        return exam;
    }
    const freshStudent = null;

    await t.test('SCHEDULED -> READY -> ACTIVE with attributed lifecycle events; then a student can start', async () => {
        const exam = await scheduledExam();

        const view = await teacherClient.request('/api/v1/assessment/teacher-readiness');
        const listed = view.body.exams.find((e: any) => e.examInstanceId === exam);
        assert.equal(listed.lifecycleState, 'SCHEDULED');
        assert.equal(listed.baseline.status, 'baseline_readiness_checks_pass');
        assert.equal(listed.roomProctor.status, 'room_proctor_readiness_not_applicable');

        const ready = await transition(teacherClient, exam, 'mark_ready');
        assert.equal(ready.status, 200);
        assert.deepEqual(ready.body, { examInstanceId: exam, lifecycleState: 'READY' });
        const active = await transition(teacherClient, exam, 'activate');
        assert.equal(active.status, 200);
        assert.equal(active.body.lifecycleState, 'ACTIVE');

        const events = await pool.query(
            'SELECT from_state, to_state, actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 ORDER BY occurred_at, from_state DESC',
            [exam]
        );
        assert.deepEqual(events.rows, [
            { from_state: 'SCHEDULED', to_state: 'READY', actor_person_id: teacher.personId },
            { from_state: 'READY', to_state: 'ACTIVE', actor_person_id: teacher.personId },
        ]);

        const s = await clientFor(student);
        const start = await s.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.equal(start.status, 201);
        const attemptId = start.body.attemptId;
        await s.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId: randomUUID() } });
        await s.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } });

        const monitoring = await teacherClient.request('/api/v1/assessment/teacher-readiness');
        const activeView = monitoring.body.exams.find((e: any) => e.examInstanceId === exam);
        assert.equal(activeView.lifecycleState, 'ACTIVE');
        assert.deepEqual(activeView.progress, { participants: 1, started: 1, submitted: 0 });
        assert.equal(activeView.baseline.status, 'not_evaluated');

        await s.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId } });
        const after = await teacherClient.request('/api/v1/assessment/teacher-readiness');
        assert.deepEqual(after.body.exams.find((e: any) => e.examInstanceId === exam).progress, { participants: 1, started: 1, submitted: 1 });
    });

    await t.test('an exam that fails readiness cannot become READY, and nothing is recorded', async () => {
        const noQuestions = await scheduledExam({}, 0, true, freshStudent);
        const res = await transition(teacherClient, noQuestions, 'mark_ready');
        assert.equal(res.status, 409);
        assert.equal(res.body.error, 'not_ready');
        assert.equal(res.body.readiness.baseline.status, 'not_ready');
        const noStudents = await scheduledExam({}, 2, false, freshStudent);
        const res2 = await transition(teacherClient, noStudents, 'mark_ready');
        assert.equal(res2.status, 409);
        assert.equal(res2.body.readiness.baseline.category, 'participant_presence');
        const unconfiguredRooms = await scheduledExam({ roomBasedOperations: null, proctorPerRoomRequired: null }, 3, true, freshStudent);
        const res3 = await transition(teacherClient, unconfiguredRooms, 'mark_ready');
        assert.equal(res3.status, 409);
        assert.equal(res3.body.readiness.roomProctor.status, 'not_ready');
        const state = await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id = ANY($1)', [[noQuestions, noStudents, unconfiguredRooms]]);
        assert.ok(state.rows.every(r => r.lifecycle_state === 'SCHEDULED'));
        const events = await pool.query('SELECT COUNT(*)::int AS n FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = ANY($1)', [[noQuestions, noStudents, unconfiguredRooms]]);
        assert.equal(events.rows[0].n, 0);
    });

    await t.test('order and window are enforced', async () => {
        const exam = await scheduledExam({}, 3, true, freshStudent);
        const skip = await transition(teacherClient, exam, 'activate');
        assert.equal(skip.status, 409);
        assert.deepEqual(skip.body, { error: 'invalid_state', currentState: 'SCHEDULED' });

        const later = await scheduledExam({ windowStartsAt: new Date(Date.now() + 60 * 60 * 1000), windowEndsAt: new Date(Date.now() + 3 * 60 * 60 * 1000) }, 3, true, freshStudent);
        assert.equal((await transition(teacherClient, later, 'mark_ready')).status, 200);
        const early = await transition(teacherClient, later, 'activate');
        assert.equal(early.status, 409);
        assert.equal(early.body.error, 'window_not_started');
        assert.ok(early.body.windowStartsAt);
    });

    await t.test('only the teacher of the exam may operate it', async () => {
        const exam = await scheduledExam({}, 3, true, freshStudent);
        const other = await clientFor(otherTeacher);
        assert.equal((await transition(other, exam, 'mark_ready')).status, 403);
        const s = await clientFor(student);
        assert.equal((await transition(s, exam, 'mark_ready')).status, 403);
        assert.equal((await transition(teacherClient, randomUUID(), 'mark_ready')).status, 403);
        assert.equal((await transition(teacherClient, exam, 'finalize')).status, 400);
        const anonymous = new BrowserLikeClient(app.baseUrl);
        anonymous.tenantId = tenant;
        assert.equal((await transition(anonymous, exam, 'mark_ready')).status, 401);
    });

    await t.test('concurrent activation transitions exactly once', async () => {
        const exam = await scheduledExam({}, 3, true, freshStudent);
        assert.equal((await transition(teacherClient, exam, 'mark_ready')).status, 200);
        const results = await Promise.all(Array.from({ length: 5 }, () => transition(teacherClient, exam, 'activate')));
        assert.equal(results.filter(r => r.status === 200).length, 1);
        assert.ok(results.filter(r => r.status !== 200).every(r => r.status === 409 && r.body.currentState === 'ACTIVE'));
        const events = await pool.query(`SELECT COUNT(*)::int AS n FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1 AND to_state = 'ACTIVE'`, [exam]);
        assert.equal(events.rows[0].n, 1);
    });

    await t.test('a participant in two overlapping exams blocks READY (schedule conflict)', async () => {
        const first = await scheduledExam({}, 2, true, freshStudent);
        const personRow = await pool.query('SELECT person_id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1', [first]);
        const second = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED' });
        await addQuestionSnapshots(pool, tenant, second, 2);
        await addParticipant(pool, tenant, second, personRow.rows[0].person_id);
        const res = await transition(teacherClient, second, 'mark_ready');
        assert.equal(res.status, 409);
        assert.equal(res.body.readiness.baseline.blocker, 'participant_schedule_conflict');
    });

    await t.test('lifecycle events are append-only', async () => {
        await assert.rejects(() => pool.query('UPDATE secure_assessment_exam_lifecycle_events SET to_state = to_state'), /append-only/);
        await assert.rejects(() => pool.query('DELETE FROM secure_assessment_exam_lifecycle_events'), /append-only/);
    });
});
