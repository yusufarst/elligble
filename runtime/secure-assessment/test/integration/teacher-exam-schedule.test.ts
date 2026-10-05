import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// Rescheduling before the exam opens against real PostgreSQL (ASSESS-TEACHER-003; D04.2-45
// LOCKED, D04.2-25, D04.2-46): only the managing teacher, only while SCHEDULED or READY; the
// new schedule is checked as "Tandai Siap" checks it; a READY exam is scheduled again; each
// change keeps before and after, actor and time, append-only; students and proctors see that
// the schedule changed; a retried request changes nothing twice.

/** Wall-clock `YYYY-MM-DDTHH:MM` in WIB, `hours` from now, on a whole hour. */
function wib(hours: number): string {
    const at = new Date(Date.now() + hours * 3_600_000 + 7 * 3_600_000);
    return `${at.toISOString().slice(0, 13)}:00`;
}
/** The instant of a WIB wall-clock value. */
const instant = (local: string) => new Date(`${local}:00+07:00`).toISOString();

test('rescheduling an exam before it opens (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool, 'guru.jadwal');
    const otherTeacher = await createPersonWithAccount(pool);
    const proctor = await createPersonWithAccount(pool, 'pengawas.jadwal');
    const student = await createPersonWithAccount(pool, 'siswa.jadwal');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Ekonomi');
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Sosiologi');
    await addMembership(pool, tenant, proctor.personId);
    await addMembership(pool, tenant, student.personId);

    const loggedIn = async (person: { username: string; password: string }) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const reschedule = (c: BrowserLikeClient, body: Record<string, unknown>) =>
        c.request('/api/v1/assessment/teacher-exams/reschedule', { method: 'POST', body });
    const changes = async (exam: string) => (await pool.query(
        `SELECT previous_lifecycle_state, previous_window_starts_at, previous_window_ends_at, previous_duration_seconds, previous_latest_start_policy,
                new_window_starts_at, new_window_ends_at, new_duration_seconds, new_latest_start_policy, changed_by_person_id, action_key, changed_at
         FROM secure_assessment_exam_schedule_changes WHERE exam_instance_id = $1 ORDER BY changed_at`,
        [exam]
    )).rows;
    const examRow = async (exam: string) => (await pool.query(
        `SELECT lifecycle_state, window_starts_at, window_ends_at, configured_attempt_duration_seconds AS duration, latest_start_policy
         FROM secure_assessment_exam_instances WHERE id = $1`,
        [exam]
    )).rows[0];

    /** A scheduled exam tomorrow 08:00 to 10:00 WIB (on whole hours), 90 minutes, with questions and one participant. */
    async function scheduledExam(lifecycleState = 'SCHEDULED', participantPersonId = student.personId) {
        const exam = await createExamInstance(pool, tenant, teaching, {
            lifecycleState, windowStartsAt: new Date(instant(wib(24))), windowEndsAt: new Date(instant(wib(26))), durationSeconds: 5400,
        });
        await addQuestionSnapshots(pool, tenant, exam, 2);
        await addParticipant(pool, tenant, exam, participantPersonId);
        return exam;
    }

    await t.test('the managing teacher moves a scheduled exam; the change keeps before and after, once per request', async () => {
        const exam = await scheduledExam();
        const before = await examRow(exam);
        const actionKey = randomUUID();
        const body = { examInstanceId: exam, windowStartsAt: wib(27), windowEndsAt: wib(29), durationMinutes: 60, latestStartPolicy: 'REMAINING_WINDOW_ONLY', actionKey };
        const res = await reschedule(teacherClient, body);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual({ ...res.body, changedAt: undefined }, {
            examInstanceId: exam, lifecycleState: 'SCHEDULED', changed: true, replayed: false, changedAt: undefined,
            schedule: { windowStartsAt: instant(wib(27)), windowEndsAt: instant(wib(29)), durationMinutes: 60, latestStartPolicy: 'REMAINING_WINDOW_ONLY' },
        });
        const after = await examRow(exam);
        assert.deepEqual(
            [after.lifecycle_state, after.window_starts_at.toISOString(), after.window_ends_at.toISOString(), after.duration, after.latest_start_policy],
            ['SCHEDULED', instant(wib(27)), instant(wib(29)), 3600, 'REMAINING_WINDOW_ONLY']
        );
        const recorded = await changes(exam);
        assert.equal(recorded.length, 1);
        assert.deepEqual({ ...recorded[0], changed_at: recorded[0].changed_at.toISOString() }, {
            previous_lifecycle_state: 'SCHEDULED',
            previous_window_starts_at: before.window_starts_at, previous_window_ends_at: before.window_ends_at,
            previous_duration_seconds: 5400, previous_latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
            new_window_starts_at: after.window_starts_at, new_window_ends_at: after.window_ends_at,
            new_duration_seconds: 3600, new_latest_start_policy: 'REMAINING_WINDOW_ONLY',
            changed_by_person_id: teacher.personId, action_key: actionKey, changed_at: res.body.changedAt,
        });

        // A retry finds the change; the key never serves another one.
        const retry = await reschedule(teacherClient, body);
        assert.equal(retry.status, 200);
        assert.deepEqual(retry.body, { ...res.body, replayed: true });
        assert.equal((await reschedule(teacherClient, { ...body, durationMinutes: 45 })).body.error, 'action_key_reused');
        // Asking for the schedule it already has records nothing.
        const same = await reschedule(teacherClient, { ...body, actionKey: randomUUID() });
        assert.equal(same.status, 200);
        assert.equal(same.body.changed, false);
        assert.equal((await changes(exam)).length, 1);

        await assert.rejects(pool.query('UPDATE secure_assessment_exam_schedule_changes SET new_duration_seconds = 60'), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_schedule_changes'), /append-only/);
        await assert.rejects(pool.query(
            `INSERT INTO secure_assessment_exam_schedule_changes (tenant_id, exam_instance_id, changed_by_person_id, action_key, previous_lifecycle_state,
                 new_window_starts_at, new_window_ends_at, new_duration_seconds, new_latest_start_policy)
             SELECT tenant_id, exam_instance_id, changed_by_person_id, action_key, 'SCHEDULED', new_window_starts_at, new_window_ends_at, 600, new_latest_start_policy
             FROM secure_assessment_exam_schedule_changes WHERE exam_instance_id = $1`,
            [exam]
        ), /uq_sa_schedule_change_action_key/);
    });

    await t.test('retries that overtake the original wait for it and change nothing twice', async () => {
        const exam = await scheduledExam();
        const body = { examInstanceId: exam, windowStartsAt: wib(60), windowEndsAt: wib(62), durationMinutes: 45, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', actionKey: randomUUID() };
        // A transition in flight holds the exam row, so the original and both retries are all
        // under way at once when it ends.
        const holder = await pool.connect();
        let results: Awaited<ReturnType<typeof reschedule>>[];
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_instances WHERE id = $1 FOR UPDATE', [exam]);
            const pending = Promise.all([reschedule(teacherClient, body), reschedule(teacherClient, body), reschedule(teacherClient, body)]);
            await new Promise(resolve => setTimeout(resolve, 400));
            await holder.query('COMMIT');
            results = await pending;
        } finally {
            holder.release();
        }
        assert.deepEqual(results.map(r => [r.status, r.body.replayed]).sort(), [[200, false], [200, true], [200, true]], JSON.stringify(results.map(r => r.body)));
        assert.equal((await changes(exam)).length, 1);
        // The same key for another exam is refused, even at the same moment.
        const second = await scheduledExam();
        const reused = await reschedule(teacherClient, { ...body, examInstanceId: second });
        assert.equal(reused.status, 409);
        assert.equal(reused.body.error, 'action_key_reused');
        assert.equal((await changes(second)).length, 0);
    });

    await t.test('a ready exam is scheduled again and marked ready anew; students, proctors and the teacher see the change', async () => {
        const exam = await scheduledExam('READY');
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        const previous = await examRow(exam);
        const res = await reschedule(teacherClient, {
            examInstanceId: exam, windowStartsAt: wib(30), windowEndsAt: wib(33), durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', actionKey: randomUUID(),
        });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.lifecycleState, 'SCHEDULED');
        assert.equal((await examRow(exam)).lifecycle_state, 'SCHEDULED');
        const events = (await pool.query(
            'SELECT from_state, to_state, actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1',
            [exam]
        )).rows;
        assert.deepEqual(events, [{ from_state: 'READY', to_state: 'SCHEDULED', actor_person_id: teacher.personId }]);
        assert.equal((await changes(exam))[0].previous_lifecycle_state, 'READY');

        const change = { changedAt: res.body.changedAt, previousWindowStartsAt: previous.window_starts_at.toISOString(), previousWindowEndsAt: previous.window_ends_at.toISOString() };
        const assigned = (await (await loggedIn(student)).request('/api/v1/assessment/assigned-exams')).body.assignments
            .find((a: { examInstanceId: string }) => a.examInstanceId === exam);
        assert.deepEqual(assigned.schedule, {
            lifecycleState: 'SCHEDULED', windowStartsAt: instant(wib(30)), windowEndsAt: instant(wib(33)), attemptDurationSeconds: 5400, change,
        });
        const proctored = (await (await loggedIn(proctor)).request('/api/v1/assessment/proctor-monitoring')).body.assignments
            .find((a: { examInstanceId: string }) => a.examInstanceId === exam);
        assert.deepEqual(
            { windowStartsAt: proctored.windowStartsAt, windowEndsAt: proctored.windowEndsAt, scheduleChange: proctored.scheduleChange },
            { windowStartsAt: instant(wib(30)), windowEndsAt: instant(wib(33)), scheduleChange: change }
        );
        const readiness = (await teacherClient.request('/api/v1/assessment/teacher-readiness')).body.exams
            .find((e: { examInstanceId: string }) => e.examInstanceId === exam);
        assert.deepEqual(
            [readiness.lifecycleState, readiness.durationMinutes, readiness.latestStartPolicy, readiness.scheduleChangedAt],
            ['SCHEDULED', 90, 'FULL_DURATION_BEYOND_WINDOW', res.body.changedAt]
        );

        const ready = await teacherClient.request('/api/v1/assessment/teacher-exams/transition', { method: 'POST', body: { examInstanceId: exam, action: 'mark_ready' } });
        assert.equal(ready.status, 200, JSON.stringify(ready.body));
        assert.equal((await examRow(exam)).lifecycle_state, 'READY');
    });

    await t.test('the new schedule is checked as "Tandai Siap" checks it; a refused change changes nothing', async () => {
        const exam = await scheduledExam();
        const other = await scheduledExam();
        const before = await examRow(exam);
        const base = { examInstanceId: exam, windowStartsAt: wib(40), windowEndsAt: wib(42), durationMinutes: 60, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW' };
        const problems = async (changes: Record<string, unknown>) => {
            const res = await reschedule(teacherClient, { ...base, actionKey: randomUUID(), ...changes });
            assert.equal(res.status, 422, JSON.stringify(res.body));
            assert.equal(res.body.error, 'reschedule_invalid');
            return res.body.problems.map((p: { code: string }) => p.code);
        };
        assert.deepEqual(await problems({ windowEndsAt: wib(39) }), ['window_order']);
        assert.deepEqual(await problems({ windowStartsAt: wib(-5), windowEndsAt: wib(-3) }), ['window_ended']);
        assert.deepEqual(await problems({ windowStartsAt: '2026-02-30T08:00' }), ['window_invalid']);
        assert.deepEqual(await problems({ durationMinutes: 0 }), ['duration_invalid']);
        assert.deepEqual(await problems({ durationMinutes: 1441 }), ['duration_invalid']);
        assert.deepEqual(await problems({ durationMinutes: 150, latestStartPolicy: 'LATE_START_BLOCKED' }), ['duration_exceeds_window']);
        // The same student is expected in the other exam tomorrow 08:00 to 10:00 WIB.
        assert.deepEqual(await problems({ windowStartsAt: wib(25), windowEndsAt: wib(27) }), ['schedule_conflict']);
        await pool.query(`UPDATE tenant_tenants SET time_zone = NULL WHERE id = $1`, [tenant]);
        assert.deepEqual(await problems({}), ['time_zone_missing']);
        await pool.query(`UPDATE tenant_tenants SET time_zone = 'Asia/Jakarta' WHERE id = $1`, [tenant]);

        assert.deepEqual(await examRow(exam), before);
        assert.equal((await changes(exam)).length, 0);
        assert.equal((await changes(other)).length, 0);
    });

    await t.test('only the managing teacher reschedules, and only before the exam opens', async () => {
        const exam = await scheduledExam();
        const body = (examInstanceId: string) => ({
            examInstanceId, windowStartsAt: wib(50), windowEndsAt: wib(52), durationMinutes: 60, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', actionKey: randomUUID(),
        });
        assert.equal((await reschedule(await loggedIn(otherTeacher), body(exam))).status, 403);
        assert.equal((await reschedule(await loggedIn(student), body(exam))).status, 403);
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        assert.equal((await reschedule(await loggedIn(proctor), body(exam))).status, 403, 'an assigned proctor does not reschedule');
        assert.equal((await reschedule(teacherClient, body(randomUUID()))).status, 403);

        for (const state of ['ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED']) {
            const opened = await createExamInstance(pool, tenant, teaching, { lifecycleState: state });
            const res = await reschedule(teacherClient, body(opened));
            assert.equal(res.status, 409, state);
            assert.deepEqual(res.body, { error: 'invalid_state', currentState: state });
        }
        for (const bad of [
            { examInstanceId: 'bukan-id' }, { actionKey: 'bukan-kunci' }, { windowStartsAt: '5 Oktober 2026' }, { windowEndsAt: undefined },
            { durationMinutes: '60' }, { latestStartPolicy: 'BEBAS' },
        ]) {
            assert.equal((await reschedule(teacherClient, { ...body(exam), ...bad })).status, 400, JSON.stringify(bad));
        }
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/reschedule')).status, 405);

        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = now() WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.equal((await reschedule(teacherClient, body(exam))).status, 403, 'a revoked teaching assignment reschedules nothing');
        assert.equal((await changes(exam)).length, 0);
    });
});
