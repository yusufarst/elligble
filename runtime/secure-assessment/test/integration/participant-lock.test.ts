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

// Participant lock and unlock against real PostgreSQL (D04.6-38/39, D04.2-76, D04.6-40):
// an authorized supervisor stops one participant's work and releases it directly; the lock
// keeps every answer, including one chosen before it that is still on its way; nothing new
// is accepted while locked; the time keeps running; other participants are untouched; the
// action is scoped, idempotent and recorded with its actor.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('participant lock and unlock (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
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
    const proctor = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Biologi');
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Kimia');
    await addMembership(pool, tenant, proctor.personId);

    const loggedIn = async (person: { username: string; password: string }) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const lockAction = (c: BrowserLikeClient, examInstanceId: string, participantId: string, action: string) =>
        c.request('/api/v1/assessment/exam-monitoring/participant-lock', { method: 'POST', body: { examInstanceId, participantId, action } });

    async function student(exam: string, options: { startTimer?: boolean; start?: boolean } = {}) {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        const participantId = await addParticipant(pool, tenant, exam, person.personId);
        const client = await loggedIn(person);
        const s = {
            person, client, participantId, attemptId: '', sessionId: randomUUID(),
            save: (snapshotId: string, option: string, extra: Record<string, unknown> = {}) =>
                client.request('/api/v1/assessment/answer/save', {
                    method: 'POST',
                    body: { attemptId: s.attemptId, sessionId: s.sessionId, snapshotId, answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion: null, ...extra },
                }),
            timer: async () => (await client.request(`/api/v1/assessment/timer?attemptId=${s.attemptId}`)).body,
        };
        if (options.start === false) return s;
        s.attemptId = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId: s.attemptId, sessionId: s.sessionId } })).status, 200);
        if (options.startTimer !== false) assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        return s;
    }

    const exam = await createExamInstance(pool, tenant, teaching);
    const snapshots = await addQuestionSnapshots(pool, tenant, exam, 3);

    await t.test('a lock stops one participant only, keeps an answer chosen before it and lets the time run', async () => {
        const locked = await student(exam);
        const neighbour = await student(exam);
        assert.equal((await locked.save(snapshots[0], 'A')).status, 200);
        const before = await locked.timer();

        const res = await lockAction(teacherClient, exam, locked.participantId, 'lock');
        assert.equal(res.status, 200);
        assert.equal(res.body.locked, true);
        assert.equal(res.body.changed, true);
        const again = await lockAction(teacherClient, exam, locked.participantId, 'lock');
        assert.deepEqual({ ...again.body, lockedAt: undefined }, { participantId: locked.participantId, locked: true, changed: false, lockedAt: undefined });
        const rows = (await pool.query('SELECT locked_at, locked_by_person_id, unlocked_at FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1', [locked.attemptId])).rows;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].locked_by_person_id, teacher.personId);
        const lockedAt: Date = rows[0].locked_at;
        assert.equal(res.body.lockedAt, lockedAt.toISOString());

        const refused = await locked.save(snapshots[1], 'B');
        assert.equal(refused.status, 409);
        assert.deepEqual({ error: refused.body.error, lockedAt: refused.body.lockedAt }, { error: 'attempt_locked', lockedAt: lockedAt.toISOString() });
        assert.equal((await locked.save(snapshots[1], 'B', { capturedAt: new Date(lockedAt.getTime() + 1).toISOString() })).body.error, 'attempt_locked');
        assert.equal((await locked.save(snapshots[2], 'C', { capturedAt: new Date(lockedAt.getTime() - 1).toISOString() })).status, 200, 'chosen before the lock: kept');
        const flag = await locked.client.request('/api/v1/assessment/review-flag', { method: 'POST', body: { attemptId: locked.attemptId, sessionId: locked.sessionId, snapshotId: snapshots[0], flagged: true } });
        assert.equal(flag.body.error, 'attempt_locked');
        assert.equal((await locked.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: locked.attemptId } })).body.error, 'attempt_locked');
        assert.equal((await locked.client.request(`/api/v1/assessment/questions?attemptId=${locked.attemptId}`)).body.error, 'attempt_locked');
        const resume = (await locked.client.request(`/api/v1/assessment/resume?attemptId=${locked.attemptId}&examSessionId=${locked.sessionId}`)).body;
        assert.deepEqual(resume.lock, { lockedAt: lockedAt.toISOString() });
        assert.equal(resume.answers.length, 2, 'every accepted answer is kept');

        // The time keeps running (lock is not pause, D04.6-40).
        await sleep(1100);
        const during = await locked.timer();
        assert.equal(during.lockedAt, lockedAt.toISOString());
        assert.ok(during.effectiveRemainingSeconds < before.effectiveRemainingSeconds);

        // Nobody else is affected.
        assert.equal((await neighbour.save(snapshots[0], 'D')).status, 200);
        assert.equal((await neighbour.timer()).lockedAt, null);

        const monitoring = (await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`)).body;
        const listed = monitoring.participants.find((p: { participantId: string }) => p.participantId === locked.participantId);
        assert.equal(listed.lockedAt, lockedAt.toISOString());
        assert.equal(monitoring.participants.find((p: { participantId: string }) => p.participantId === neighbour.participantId).lockedAt, null);

        // Unlock: work continues; a choice made during the lock is not accepted afterwards.
        const unlocked = await lockAction(teacherClient, exam, locked.participantId, 'unlock');
        assert.deepEqual(unlocked.body, { participantId: locked.participantId, locked: false, changed: true, lockedAt: null });
        assert.deepEqual((await lockAction(teacherClient, exam, locked.participantId, 'unlock')).body, { participantId: locked.participantId, locked: false, changed: false, lockedAt: null });
        const closed = (await pool.query('SELECT unlocked_at, unlocked_by_person_id FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1', [locked.attemptId])).rows[0];
        assert.equal(closed.unlocked_by_person_id, teacher.personId);
        const during2 = await locked.save(snapshots[1], 'B', { capturedAt: new Date(lockedAt.getTime() + 500).toISOString() });
        assert.equal(during2.status, 409);
        assert.deepEqual(
            { error: during2.body.error, lockedAt: during2.body.lockedAt, unlockedAt: during2.body.unlockedAt },
            { error: 'captured_during_lock', lockedAt: lockedAt.toISOString(), unlockedAt: closed.unlocked_at.toISOString() }
        );
        assert.equal((await locked.save(snapshots[1], 'B')).status, 200);
        assert.equal((await locked.client.request(`/api/v1/assessment/questions?attemptId=${locked.attemptId}`)).status, 200);
        assert.equal((await locked.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: locked.attemptId } })).status, 200);
        assert.equal((await lockAction(teacherClient, exam, locked.participantId, 'lock')).body.error, 'no_active_attempt', 'a submitted attempt is not locked');
        await assert.rejects(pool.query('DELETE FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1', [locked.attemptId]), /never deleted/);
    });

    await t.test('a locked attempt whose time runs out is still finalized by the server', async () => {
        const s = await student(exam);
        assert.equal((await s.save(snapshots[0], 'B')).status, 200);
        assert.equal((await lockAction(teacherClient, exam, s.participantId, 'lock')).status, 200);
        await pool.query(`UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - interval '3601 seconds' WHERE exam_attempt_id = $1`, [s.attemptId]);
        await finalizeExpiredAttempts(pool);
        const sub = await pool.query('SELECT finalization_source FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1', [s.attemptId]);
        assert.equal(sub.rows[0].finalization_source, 'EXPIRY_SERVER');
    });

    await t.test('a lock waits for a save in flight: the boundary comes after it', async () => {
        const s = await student(exam);
        const holder = await pool.connect();
        let done = false;
        try {
            await holder.query('BEGIN');
            await holder.query('SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 FOR UPDATE', [s.attemptId]);
            const pending = lockAction(teacherClient, exam, s.participantId, 'lock').then(r => { done = true; return r; });
            await sleep(300);
            assert.equal(done, false);
            const lastWrite: Date = (await holder.query('SELECT statement_timestamp() AS t')).rows[0].t;
            await holder.query('COMMIT');
            const res = await pending;
            assert.equal(res.status, 200);
            assert.ok(Date.parse(res.body.lockedAt) > lastWrite.getTime());
        } finally {
            holder.release();
        }
    });

    await t.test('only supervisors in scope lock or unlock', async () => {
        const s = await student(exam);
        const waiting = await student(exam, { start: false });
        const other = await loggedIn(otherTeacher);
        assert.equal((await lockAction(other, exam, s.participantId, 'lock')).status, 403);
        assert.equal((await lockAction(s.client, exam, s.participantId, 'lock')).status, 403);
        assert.equal((await lockAction(teacherClient, exam, s.participantId, 'freeze')).status, 400);
        assert.equal((await lockAction(teacherClient, exam, randomUUID(), 'lock')).status, 403);
        assert.equal((await lockAction(teacherClient, exam, waiting.participantId, 'lock')).body.error, 'no_active_attempt');

        // Another school: the exam and its participants do not exist there.
        const otherSchool = await createTenant(pool);
        const outsider = await createPersonWithAccount(pool);
        await addMembership(pool, otherSchool, outsider.personId);
        const outsiderClient = new BrowserLikeClient(app.baseUrl);
        assert.equal((await outsiderClient.login(outsider.username, outsider.password)).status, 200);
        outsiderClient.tenantId = otherSchool;
        assert.equal((await lockAction(outsiderClient, exam, s.participantId, 'lock')).status, 403, 'another school');

        // A proctor not assigned to this exam.
        const proctorClient = await loggedIn(proctor);
        assert.equal((await lockAction(proctorClient, exam, s.participantId, 'lock')).status, 403, 'not assigned to this exam');
        const written = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_attempt_locks WHERE exam_attempt_id = $1', [s.attemptId]);
        assert.equal(written.rows[0].n, 0, 'a refused action writes nothing');

        // An assigned proctor of an exam without rooms: every participant.
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        assert.equal((await lockAction(proctorClient, exam, s.participantId, 'lock')).body.locked, true);
        assert.equal((await lockAction(proctorClient, exam, s.participantId, 'unlock')).body.locked, false);

        // With rooms: only the proctor's rooms.
        const roomExam = await createExamInstance(pool, tenant, teaching, { roomBasedOperations: true, proctorPerRoomRequired: true });
        await addQuestionSnapshots(pool, tenant, roomExam, 1);
        const inRoom = await student(roomExam);
        const elsewhere = await student(roomExam);
        const q = async (sql: string, params: unknown[]) => (await pool.query(sql, params)).rows[0].id as string;
        const roomA = await q(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Ruang 1') RETURNING id`, [tenant, roomExam]);
        const roomB = await q(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Ruang 2') RETURNING id`, [tenant, roomExam]);
        await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, inRoom.participantId, roomA]);
        await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, elsewhere.participantId, roomB]);
        const assignment = await addProctorAssignment(pool, tenant, roomExam, proctor.personId);
        await pool.query('INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, assignment, roomA]);
        assert.equal((await lockAction(proctorClient, roomExam, inRoom.participantId, 'lock')).status, 200);
        assert.equal((await lockAction(proctorClient, roomExam, elsewhere.participantId, 'lock')).status, 403, 'another room');
        assert.equal((await lockAction(proctorClient, exam, inRoom.participantId, 'lock')).status, 403, 'a participant of another exam');

        const finalized = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'FINALIZED' });
        const person = await createPersonWithAccount(pool);
        const participantId = await addParticipant(pool, tenant, finalized, person.personId);
        assert.deepEqual((await lockAction(teacherClient, finalized, participantId, 'lock')).body, { error: 'invalid_state', currentState: 'FINALIZED' });
    });
});
