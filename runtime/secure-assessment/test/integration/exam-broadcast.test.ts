import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant, type PersonAccount,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// Exam broadcast messages against real PostgreSQL (D04.1-77A..G, D04.6-49..55): a supervisor
// reaches the entire exam, one room or selected participants within their own scope; the
// recipients are fixed when sent and exclude who already submitted; the student's device
// fetches its messages and confirms receiving them, which is the only delivery state kept;
// sending is limited per sender; history and recipients cannot be rewritten.

test('exam broadcast messages (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
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
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Fisika');
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Kimia');
    await addMembership(pool, tenant, proctor.personId);

    const loggedIn = async (person: PersonAccount, tenantId = tenant) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenantId;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const send = (c: BrowserLikeClient, examInstanceId: string, target: unknown, message: unknown) =>
        c.request('/api/v1/assessment/exam-monitoring/broadcast', { method: 'POST', body: { examInstanceId, target, message } });
    const monitoring = async (c: BrowserLikeClient, examInstanceId: string) =>
        (await c.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${examInstanceId}`)).body;
    /** Moves a sender's earlier messages out of the per-sender interval (rows cannot be edited, so they are re-created). */
    const leaveInterval = async () => {
        await pool.query('ALTER TABLE secure_assessment_exam_broadcasts DISABLE TRIGGER trg_prevent_sa_exam_broadcast_mutation');
        await pool.query(`UPDATE secure_assessment_exam_broadcasts SET sent_at = sent_at - interval '2 hours'`);
        await pool.query('ALTER TABLE secure_assessment_exam_broadcasts ENABLE TRIGGER trg_prevent_sa_exam_broadcast_mutation');
    };

    async function student(exam: string, options: { start?: boolean } = {}) {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        const participantId = await addParticipant(pool, tenant, exam, person.personId);
        const client = await loggedIn(person);
        const s = {
            person, client, participantId, attemptId: '', sessionId: randomUUID(),
            inbox: (received?: string[]) => client.request('/api/v1/assessment/broadcasts/inbox', { method: 'POST', body: { attemptId: s.attemptId, ...(received ? { received } : {}) } }),
            timer: async () => (await client.request(`/api/v1/assessment/timer?attemptId=${s.attemptId}`)).body,
            submit: () => client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } }),
        };
        if (options.start === false) return s;
        s.attemptId = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId: s.attemptId, sessionId: s.sessionId } })).status, 200);
        assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        return s;
    }

    const exam = await createExamInstance(pool, tenant, teaching);
    await addQuestionSnapshots(pool, tenant, exam, 2);

    await t.test('the whole exam receives a message; the device confirms receiving it; nobody claims it was read', async () => {
        const working = await student(exam);
        const done = await student(exam);
        assert.equal((await done.submit()).status, 200);
        const waiting = await student(exam, { start: false });

        const res = await send(teacherClient, exam, { scope: 'EXAM' }, '  Ujian   tersisa\n15 menit.  ');
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.recipients, 2, 'the working and the waiting participant; not the one who submitted');
        const stored = (await pool.query('SELECT sender_person_id, target_scope, exam_room_id, message, sent_at FROM secure_assessment_exam_broadcasts WHERE id = $1', [res.body.broadcastId])).rows[0];
        assert.deepEqual(
            { sender: stored.sender_person_id, scope: stored.target_scope, room: stored.exam_room_id, message: stored.message },
            { sender: teacher.personId, scope: 'EXAM', room: null, message: 'Ujian tersisa 15 menit.' }
        );
        assert.equal(res.body.sentAt, stored.sent_at.toISOString());
        const recipients = (await pool.query('SELECT exam_participant_id FROM secure_assessment_exam_broadcast_recipients WHERE broadcast_id = $1 ORDER BY 1', [res.body.broadcastId])).rows.map(r => r.exam_participant_id);
        assert.deepEqual(recipients, [working.participantId, waiting.participantId].sort());

        // The student's device learns there is a message, fetches it, then confirms it.
        assert.equal((await working.timer()).messageCount, 1);
        const first = await working.inbox();
        assert.equal(first.status, 200);
        assert.deepEqual(first.body.messages, [{ id: res.body.broadcastId, text: 'Ujian tersisa 15 menit.', sentAt: res.body.sentAt }]);
        assert.ok(!Number.isNaN(Date.parse(first.body.serverTime)));
        let view = (await monitoring(teacherClient, exam)).broadcasts;
        assert.deepEqual(view.map((b: { recipients: number; delivered: number }) => [b.recipients, b.delivered]), [[2, 0]], 'fetched is not yet confirmed');
        assert.equal((await working.inbox([res.body.broadcastId])).status, 200);
        const deliveredAt = (await pool.query('SELECT delivered_at FROM secure_assessment_exam_broadcast_recipients WHERE broadcast_id = $1 AND exam_participant_id = $2', [res.body.broadcastId, working.participantId])).rows[0].delivered_at;
        assert.ok(deliveredAt instanceof Date);
        assert.equal((await working.inbox([res.body.broadcastId])).status, 200);
        const again = (await pool.query('SELECT delivered_at FROM secure_assessment_exam_broadcast_recipients WHERE broadcast_id = $1 AND exam_participant_id = $2', [res.body.broadcastId, working.participantId])).rows[0].delivered_at;
        assert.equal(again.getTime(), deliveredAt.getTime(), 'recorded once');

        view = (await monitoring(teacherClient, exam)).broadcasts;
        assert.equal(view.length, 1);
        assert.deepEqual(
            { ...view[0], sentAt: undefined },
            { broadcastId: res.body.broadcastId, sentAt: undefined, sender: { elligbleId: teacher.username, you: true }, target: { scope: 'EXAM', roomLabel: null }, message: 'Ujian tersisa 15 menit.', recipients: 2, delivered: 1 }
        );
        assert.doesNotMatch(JSON.stringify(view), /read|dibaca/i);

        // Another participant's message ids confirm nothing for this device.
        const intruder = await done.inbox([res.body.broadcastId]);
        assert.equal(intruder.status, 200);
        assert.deepEqual(intruder.body.messages, [], 'the submitted participant was not a recipient');
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_broadcast_recipients WHERE broadcast_id = $1 AND delivered_at IS NOT NULL', [res.body.broadcastId])).rows[0].n, 1);
        // Another student's attempt is not readable.
        const other = await working.client.request('/api/v1/assessment/broadcasts/inbox', { method: 'POST', body: { attemptId: done.attemptId } });
        assert.equal(other.status, 403);
        await leaveInterval();
    });

    await t.test('selected participants only; nothing is sent when one of them is outside the scope', async () => {
        const a = await student(exam);
        const b = await student(exam);
        const res = await send(teacherClient, exam, { scope: 'PARTICIPANTS', participantIds: [a.participantId] }, 'Silakan lanjutkan ke soal berikutnya.');
        assert.equal(res.status, 200);
        assert.equal(res.body.recipients, 1);
        assert.equal((await a.inbox()).body.messages[0].text, 'Silakan lanjutkan ke soal berikutnya.');
        assert.deepEqual((await b.inbox()).body.messages, [], 'not selected (and joined after the exam-wide message)');
        await leaveInterval();

        const elsewhere = await createExamInstance(pool, tenant, teaching);
        const stranger = await student(elsewhere, { start: false });
        const before = (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_broadcasts')).rows[0].n;
        const mixed = await send(teacherClient, exam, { scope: 'PARTICIPANTS', participantIds: [a.participantId, stranger.participantId] }, 'Harap tetap di tempat duduk.');
        assert.equal(mixed.status, 403);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_broadcasts')).rows[0].n, before, 'nothing written');
    });

    await t.test('one sender is limited, others are not; limits say when to try again', async () => {
        const first = await send(teacherClient, exam, { scope: 'EXAM' }, 'Harap tetap di tempat duduk.');
        assert.equal(first.status, 200);
        const repeat = await send(teacherClient, exam, { scope: 'EXAM' }, 'Harap tetap di tempat duduk.');
        assert.equal(repeat.status, 429);
        assert.equal(repeat.body.error, 'rate_limited');
        assert.ok(repeat.body.retryAfterSeconds >= 1 && repeat.body.retryAfterSeconds <= 15);
        assert.equal(repeat.headers.get('retry-after'), String(repeat.body.retryAfterSeconds));

        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        const proctorClient = await loggedIn(proctor);
        assert.equal((await send(proctorClient, exam, { scope: 'EXAM' }, 'Jaringan sedang bermasalah. Tetap lanjutkan ujian.')).status, 200, 'another supervisor is not held back');

        // Twenty messages in the last hour: the next waits until the oldest leaves the hour.
        await leaveInterval();
        for (let i = 0; i < 20; i++) {
            await pool.query(
                `INSERT INTO secure_assessment_exam_broadcasts (tenant_id, exam_instance_id, sender_person_id, target_scope, message, sent_at)
                 VALUES ($1, $2, $3, 'EXAM', 'Pesan lama', statement_timestamp() - interval '30 minutes' + $4 * interval '1 second')`,
                [tenant, exam, teacher.personId, i]
            );
        }
        const capped = await send(teacherClient, exam, { scope: 'EXAM' }, 'Ujian tersisa 15 menit.');
        assert.equal(capped.status, 429);
        assert.ok(capped.body.retryAfterSeconds > 1700 && capped.body.retryAfterSeconds <= 1800, String(capped.body.retryAfterSeconds));
        await leaveInterval();
    });

    await t.test('a device confirms only the messages it holds', async () => {
        const s = await student(exam);
        const one = await send(teacherClient, exam, { scope: 'PARTICIPANTS', participantIds: [s.participantId] }, 'Pesan pertama.');
        await leaveInterval();
        const two = await send(teacherClient, exam, { scope: 'PARTICIPANTS', participantIds: [s.participantId] }, 'Pesan kedua.');
        assert.equal(two.status, 200);
        assert.equal((await s.timer()).messageCount, 2);
        const both = (await s.inbox()).body;
        assert.deepEqual(both.messages.map((m: { text: string }) => m.text), ['Pesan kedua.', 'Pesan pertama.']);
        assert.equal(both.total, 2);
        assert.equal((await s.inbox([one.body.broadcastId])).status, 200);
        const rows = await pool.query(
            'SELECT broadcast_id, delivered_at IS NOT NULL AS delivered FROM secure_assessment_exam_broadcast_recipients WHERE exam_participant_id = $1',
            [s.participantId]
        );
        assert.deepEqual(
            Object.fromEntries(rows.rows.map(r => [r.broadcast_id, r.delivered])),
            { [one.body.broadcastId]: true, [two.body.broadcastId]: false }
        );
        await leaveInterval();
    });

    await t.test('a room proctor reaches only their rooms; the teacher reaches every room', async () => {
        const roomExam = await createExamInstance(pool, tenant, teaching, { roomBasedOperations: true, proctorPerRoomRequired: true });
        await addQuestionSnapshots(pool, tenant, roomExam, 1);
        const q = async (sql: string, params: unknown[]) => (await pool.query(sql, params)).rows[0].id as string;
        const roomA = await q(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Ruang 1') RETURNING id`, [tenant, roomExam]);
        const roomB = await q(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Ruang 2') RETURNING id`, [tenant, roomExam]);
        const inA = await student(roomExam);
        const inB = await student(roomExam);
        await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, inA.participantId, roomA]);
        await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, inB.participantId, roomB]);
        const assignment = await addProctorAssignment(pool, tenant, roomExam, proctor.personId);
        await pool.query('INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, assignment, roomA]);
        const proctorClient = await loggedIn(proctor);

        assert.equal((await send(proctorClient, roomExam, { scope: 'EXAM' }, 'Harap tetap di tempat duduk.')).status, 403, 'not the whole exam');
        assert.equal((await send(proctorClient, roomExam, { scope: 'ROOM', roomId: roomB }, 'Harap tetap di tempat duduk.')).status, 403, 'not another room');
        assert.equal((await send(proctorClient, roomExam, { scope: 'PARTICIPANTS', participantIds: [inB.participantId] }, 'Harap tetap di tempat duduk.')).status, 403);
        const own = await send(proctorClient, roomExam, { scope: 'ROOM', roomId: roomA }, 'Harap tetap di tempat duduk.');
        assert.equal(own.status, 200);
        assert.equal(own.body.recipients, 1);
        assert.equal((await inA.inbox()).body.messages.length, 1);
        assert.equal((await inB.inbox()).body.messages.length, 0);

        const toB = await send(teacherClient, roomExam, { scope: 'ROOM', roomId: roomB }, 'Silakan lanjutkan ke soal berikutnya.');
        assert.equal(toB.status, 200);
        assert.equal((await inB.inbox()).body.messages.length, 1);

        // Each supervisor sees what reached their scope, with counts inside it.
        const proctorView = await monitoring(proctorClient, roomExam);
        assert.deepEqual(proctorView.rooms, [{ roomId: roomA, label: 'Ruang 1' }]);
        assert.deepEqual(proctorView.broadcasts.map((b: { target: { roomLabel: string } }) => b.target.roomLabel), ['Ruang 1']);
        const teacherView = await monitoring(teacherClient, roomExam);
        assert.deepEqual(teacherView.rooms.map((r: { label: string }) => r.label), ['Ruang 1', 'Ruang 2']);
        assert.deepEqual(teacherView.broadcasts.map((b: { target: { roomLabel: string }; sender: { you: boolean } }) => [b.target.roomLabel, b.sender.you]), [['Ruang 2', true], ['Ruang 1', false]]);

        // A room target on an exam without room operations is refused.
        const room = await q(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Aula') RETURNING id`, [tenant, exam]);
        assert.equal((await send(teacherClient, exam, { scope: 'ROOM', roomId: room }, 'Harap tetap di tempat duduk.')).status, 403);
        await leaveInterval();
    });

    await t.test('only supervisors of a running exam send, and only well-formed messages', async () => {
        const outsiderSchool = await createTenant(pool);
        const outsider = await createPersonWithAccount(pool);
        await addMembership(pool, outsiderSchool, outsider.personId);
        const outsiderClient = await loggedIn(outsider, outsiderSchool);
        const participant = await student(exam, { start: false });
        const lone = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, lone.personId);
        for (const [client, why] of [[await loggedIn(otherTeacher), 'another teacher'], [participant.client, 'a participant'], [outsiderClient, 'another school'], [await loggedIn(lone), 'an unassigned member']] as const) {
            assert.equal((await send(client, exam, { scope: 'EXAM' }, 'Harap tetap di tempat duduk.')).status, 403, why);
        }
        for (const [body, why] of [
            [{ scope: 'EXAM' }, ''], [{ scope: 'EXAM' }, '   '], [{ scope: 'EXAM' }, 'x'.repeat(201)],
            [{ scope: 'EVERYONE' }, 'Halo'], [{ scope: 'ROOM' }, 'Halo'], [{ scope: 'PARTICIPANTS', participantIds: [] }, 'Halo'],
            [{ scope: 'PARTICIPANTS', participantIds: ['bukan-id'] }, 'Halo'],
        ] as const) {
            assert.equal((await send(teacherClient, exam, body, why)).status, 400, JSON.stringify([body, why]));
        }
        assert.equal((await send(teacherClient, exam, { scope: 'EXAM' }, 'x'.repeat(200))).status, 200, '200 characters are allowed');
        await leaveInterval();

        const scheduled = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED' });
        await student(scheduled, { start: false });
        assert.deepEqual((await send(teacherClient, scheduled, { scope: 'EXAM' }, 'Halo')).body, { error: 'invalid_state', currentState: 'SCHEDULED' });

        const finished = await createExamInstance(pool, tenant, teaching);
        await addQuestionSnapshots(pool, tenant, finished, 1);
        const last = await student(finished);
        assert.equal((await last.submit()).status, 200);
        assert.equal((await send(teacherClient, finished, { scope: 'EXAM' }, 'Halo')).body.error, 'no_recipients', 'everyone submitted');
    });

    await t.test('history and recipients cannot be rewritten', async () => {
        const id = (await pool.query('SELECT id FROM secure_assessment_exam_broadcasts LIMIT 1')).rows[0].id;
        await assert.rejects(pool.query(`UPDATE secure_assessment_exam_broadcasts SET message = 'lain' WHERE id = $1`, [id]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_broadcasts WHERE id = $1', [id]), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_exam_broadcast_recipients'), /never deleted/);
        await assert.rejects(pool.query('UPDATE secure_assessment_exam_broadcast_recipients SET delivered_at = NULL WHERE delivered_at IS NOT NULL'), /only records its delivery/);
    });
});
