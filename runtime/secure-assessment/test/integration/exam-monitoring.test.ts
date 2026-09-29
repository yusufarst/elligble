import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant, type PersonAccount,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// Exam-day participant monitoring against real PostgreSQL (D04.6-01/02/03): who is expected,
// who started, who submitted and whose session moved, scoped to the proctor's assignment or
// the managing teacher, from server facts only and without scores.

test('exam monitoring (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 4 Contoh');
    const teacher = await createPersonWithAccount(pool, 'guru.pantau');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));
    const exam = await createExamInstance(pool, tenant, teaching, { durationSeconds: 3600 });
    const snapshots = await addQuestionSnapshots(pool, tenant, exam, 3);

    async function signedIn(person: PersonAccount, tenantId = tenant) {
        const client = new BrowserLikeClient(app.baseUrl);
        assert.equal((await client.login(person.username, person.password)).status, 200);
        client.tenantId = tenantId;
        return client;
    }
    async function participant(username: string, examId = exam) {
        const person = await createPersonWithAccount(pool, username);
        await addMembership(pool, tenant, person.personId);
        const participantId = await addParticipant(pool, tenant, examId, person.personId);
        return { person, participantId, client: await signedIn(person) };
    }
    async function start(client: BrowserLikeClient, examId = exam) {
        const attemptId: string = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: examId } })).body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const save = (index: number, option: string) => client.request('/api/v1/assessment/answer/save', {
            method: 'POST', body: { attemptId, sessionId, snapshotId: snapshots[index], answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion: null },
        });
        return { attemptId, sessionId, save };
    }

    const absent = await participant('peserta.c');
    const moved = await participant('peserta.b');
    const done = await participant('peserta.a');
    const late = await participant('peserta.d');

    const a = await start(done.client);
    assert.equal((await a.save(0, 'B')).status, 200);
    assert.equal((await done.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: a.attemptId } })).status, 200);

    const b = await start(moved.client);
    assert.equal((await b.save(0, 'A')).status, 200);
    // The student continues on a second device: the first session is superseded.
    const conflict = await moved.client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId: b.attemptId, sessionId: randomUUID() } });
    assert.equal(conflict.status, 409);
    const takeover = await moved.client.request('/api/v1/assessment/session/activate', {
        method: 'POST', body: { attemptId: b.attemptId, sessionId: randomUUID(), confirmSupersede: true, expectedActiveSessionFingerprint: conflict.body.activeSessionFingerprint },
    });
    assert.equal(takeover.status, 200, JSON.stringify(takeover.body));

    const d = await start(late.client);
    await pool.query(
        `UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - interval '3601 seconds' WHERE exam_attempt_id = $1`,
        [d.attemptId]
    );

    const monitoring = (client: BrowserLikeClient, examId = exam) => client.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${examId}`);

    await t.test('the managing teacher sees every participant from server facts', async () => {
        const res = await monitoring(await signedIn(teacher));
        assert.equal(res.status, 200);
        assert.equal(res.body.scope, 'TEACHER');
        assert.equal(res.body.questionCount, 3);
        assert.deepEqual(res.body.exam, { examInstanceId: exam, subjectLabel: 'Matematika Wajib', lifecycleState: 'ACTIVE', roomBased: false });
        assert.ok(!Number.isNaN(Date.parse(res.body.serverTime)));
        assert.deepEqual(res.body.summary, { participants: 4, notStarted: 1, active: 2, submitted: 1 });
        const byId = Object.fromEntries(res.body.participants.map((p: { elligbleId: string }) => [p.elligbleId, p]));
        assert.deepEqual(res.body.participants.map((p: { elligbleId: string }) => p.elligbleId), ['peserta.a', 'peserta.b', 'peserta.c', 'peserta.d']);

        assert.equal(byId['peserta.a'].status, 'SUBMITTED');
        assert.equal(byId['peserta.a'].finalizationSource, 'STUDENT_SUBMIT');
        assert.equal(byId['peserta.a'].answeredCount, 1);
        assert.equal(byId['peserta.a'].sessionActive, false);

        assert.equal(byId['peserta.b'].status, 'ACTIVE');
        assert.equal(byId['peserta.b'].sessionMoves, 1, 'a takeover is visible as a session move');
        assert.equal(byId['peserta.b'].sessionActive, true);
        assert.equal(byId['peserta.b'].answeredCount, 1);
        assert.ok(!Number.isNaN(Date.parse(byId['peserta.b'].lastAcceptedAt)));
        assert.ok(byId['peserta.b'].remainingSeconds > 3500 && byId['peserta.b'].remainingSeconds <= 3600);

        assert.deepEqual(byId['peserta.c'], {
            elligbleId: 'peserta.c', roomLabel: null, status: 'NOT_STARTED', finalizationSource: null, submittedAt: null,
            remainingSeconds: null, answeredCount: 0, lastAcceptedAt: null, sessionActive: false, sessionMoves: 0,
        });
        assert.equal(byId['peserta.d'].status, 'TIME_UP', 'time over, waiting for the server to finalize');
        assert.equal(byId['peserta.d'].remainingSeconds, 0);
        assert.doesNotMatch(JSON.stringify(res.body), /score|correct/i, 'supervision never carries scores');
    });

    await t.test('an assigned proctor sees the exam, or only their rooms when the exam uses rooms', async () => {
        const proctor = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, proctor.personId);
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        const proctorClient = await signedIn(proctor);
        const whole = await monitoring(proctorClient);
        assert.equal(whole.status, 200);
        assert.equal(whole.body.scope, 'PROCTOR');
        assert.equal(whole.body.participants.length, 4, 'no room operations: the whole exam');

        const roomExam = await createExamInstance(pool, tenant, teaching, { roomBasedOperations: true, proctorPerRoomRequired: true });
        const q = async (sql: string, params: unknown[]) => (await pool.query(sql, params)).rows[0]?.id as string;
        const roomA = await q(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Ruang 1') RETURNING id`, [tenant, roomExam]);
        const roomB = await q(`INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, 'Ruang 2') RETURNING id`, [tenant, roomExam]);
        const inA = await participant('ruang.satu', roomExam);
        const inB = await participant('ruang.dua', roomExam);
        await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, inA.participantId, roomA]);
        await pool.query('INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, inB.participantId, roomB]);
        const assignment = await addProctorAssignment(pool, tenant, roomExam, proctor.personId);
        await pool.query('INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id) VALUES ($1, $2, $3, $4)', [tenant, roomExam, assignment, roomA]);

        const rooms = await monitoring(proctorClient, roomExam);
        assert.equal(rooms.status, 200);
        assert.deepEqual(rooms.body.participants.map((p: { elligbleId: string; roomLabel: string }) => [p.elligbleId, p.roomLabel]), [['ruang.satu', 'Ruang 1']]);
        const teacherView = await monitoring(await signedIn(teacher), roomExam);
        assert.equal(teacherView.body.participants.length, 2, 'the managing teacher sees both rooms');
    });

    await t.test('nobody else can monitor the exam', async () => {
        const colleague = await createPersonWithAccount(pool);
        await createTeachingContext(pool, tenant, await addMembership(pool, tenant, colleague.personId), 'Biologi');
        assert.equal((await monitoring(await signedIn(colleague))).status, 403, 'another teacher');
        assert.equal((await monitoring(absent.client)).status, 403, 'a participant');
        const otherProctor = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, otherProctor.personId);
        const otherExam = await createExamInstance(pool, tenant, teaching);
        await addProctorAssignment(pool, tenant, otherExam, otherProctor.personId);
        assert.equal((await monitoring(await signedIn(otherProctor))).status, 403, "a proctor of another exam");
        const outsiderTenant = await createTenant(pool);
        const outsider = await createPersonWithAccount(pool);
        await addMembership(pool, outsiderTenant, outsider.personId);
        assert.equal((await monitoring(await signedIn(outsider, outsiderTenant))).status, 403, 'another school');
        assert.equal((await monitoring(new BrowserLikeClient(app.baseUrl))).status, 401);
        const teacherClient = await signedIn(teacher);
        assert.equal((await teacherClient.request('/api/v1/assessment/exam-monitoring?examInstanceId=x')).status, 400);
        assert.equal((await monitoring(teacherClient, randomUUID())).status, 403);
        assert.equal((await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`, { method: 'POST', body: {} })).status, 405);
    });
});
