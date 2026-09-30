import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant, type PersonAccount,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { finalizeExpiredAttempts } from '../../src/expiry-finalization.ts';

// Provisional results for the teacher who manages the exam (D04.4-26A/C, D04.8) against real
// PostgreSQL through the production wiring: scores from the accepted answers of finalized
// attempts only, absent is not zero, listed by ELLIGBLE ID, and nobody else can read them.

test('teacher results (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 3 Contoh');
    const teacher = await createPersonWithAccount(pool, 'guru.hasil');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));
    const exam = await createExamInstance(pool, tenant, teaching, { durationSeconds: 3600 });
    const snapshots = await addQuestionSnapshots(pool, tenant, exam, 3); // every correct option is 'B'

    async function signedIn(person: PersonAccount, tenantId = tenant): Promise<BrowserLikeClient> {
        const client = new BrowserLikeClient(app.baseUrl);
        assert.equal((await client.login(person.username, person.password)).status, 200);
        client.tenantId = tenantId;
        return client;
    }

    async function participant(username: string) {
        const person = await createPersonWithAccount(pool, username);
        await addMembership(pool, tenant, person.personId);
        await addParticipant(pool, tenant, exam, person.personId);
        return { person, client: await signedIn(person) };
    }

    async function startExam(client: BrowserLikeClient) {
        const start = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        const attemptId: string = start.body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const answer = async (index: number, option: string) => {
            const res = await client.request('/api/v1/assessment/answer/save', {
                method: 'POST',
                body: { attemptId, sessionId, snapshotId: snapshots[index], answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion: null },
            });
            assert.equal(res.status, 200);
        };
        return { attemptId, answer };
    }

    // Created out of alphabetical order: the list must follow the ELLIGBLE ID, not creation or score.
    const absent = await participant('siswa.d');
    const working = await participant('siswa.c');
    const timedOut = await participant('siswa.b');
    const finished = await participant('siswa.a');

    const a = await startExam(finished.client);
    await a.answer(0, 'B');
    await a.answer(1, 'A');
    assert.equal((await finished.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: a.attemptId } })).status, 200);

    const b = await startExam(timedOut.client);
    for (const index of [0, 1, 2]) await b.answer(index, 'B');
    await pool.query(
        `UPDATE secure_assessment_timer_state SET started_at = statement_timestamp() - interval '3601 seconds' WHERE exam_attempt_id = $1`,
        [b.attemptId]
    );
    assert.deepEqual(await finalizeExpiredAttempts(pool), { finalized: 1 });

    const c = await startExam(working.client);
    await c.answer(0, 'B');

    const results = (client: BrowserLikeClient, examInstanceId = exam) =>
        client.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examInstanceId}`);

    await t.test('the teacher sees provisional scores of finalized attempts only', async () => {
        const res = await results(await signedIn(teacher));
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.deepEqual(res.body.exam, {
            examInstanceId: exam,
            subjectLabel: 'Matematika Wajib',
            groupLabel: 'X-1',
            assessmentTypeLabel: 'ULANGAN_HARIAN',
            lifecycleState: 'ACTIVE',
            windowStartsAt: res.body.exam.windowStartsAt,
            windowEndsAt: res.body.exam.windowEndsAt,
        });
        assert.deepEqual(res.body.scoring, { rule: 'BASELINE_SINGLE_CHOICE_V1', available: true, questionCount: 3, maxScore: 3 });
        assert.equal(res.body.resultState, 'PROVISIONAL');
        assert.deepEqual(res.body.summary, { participants: 4, notStarted: 1, inProgress: 1, submitted: 2 });
        const rows = res.body.participants;
        assert.deepEqual(rows.map((r: { elligbleId: string }) => r.elligbleId), ['siswa.a', 'siswa.b', 'siswa.c', 'siswa.d']);

        assert.equal(rows[0].status, 'SUBMITTED');
        assert.equal(rows[0].finalizationSource, 'STUDENT_SUBMIT');
        assert.ok(!Number.isNaN(Date.parse(rows[0].submittedAt)));
        assert.deepEqual(rows[0].score, { correct: 1, incorrect: 1, unanswered: 1, rawScore: 1, maxScore: 3, scaledScore: 33.33 });

        assert.equal(rows[1].status, 'SUBMITTED');
        assert.equal(rows[1].finalizationSource, 'EXPIRY_SERVER');
        assert.deepEqual(rows[1].score, { correct: 3, incorrect: 0, unanswered: 0, rawScore: 3, maxScore: 3, scaledScore: 100 });

        assert.deepEqual(rows[2], { elligbleId: 'siswa.c', status: 'IN_PROGRESS', finalizationSource: null, submittedAt: null, score: null });
        assert.deepEqual(rows[3], { elligbleId: 'siswa.d', status: 'NOT_STARTED', finalizationSource: null, submittedAt: null, score: null }, 'absent is not zero');
    });

    await t.test('students never receive scores or the answer key', async () => {
        for (const [client, attemptId] of [[finished.client, a.attemptId], [timedOut.client, b.attemptId]] as const) {
            for (const route of [`/api/v1/assessment/resume?attemptId=${attemptId}`, `/api/v1/assessment/questions?attemptId=${attemptId}`, '/api/v1/assessment/assigned-exams']) {
                const res = await client.request(route);
                assert.doesNotMatch(JSON.stringify(res.body), /scaledScore|rawScore|correctOptionId|"score"/, route);
            }
            assert.equal((await results(client)).status, 403, 'a participant cannot read the results');
        }
    });

    await t.test('only the teacher who manages the exam can read its results', async () => {
        const colleague = await createPersonWithAccount(pool);
        await createTeachingContext(pool, tenant, await addMembership(pool, tenant, colleague.personId), 'Fisika');
        assert.equal((await results(await signedIn(colleague))).status, 403, 'another teacher of the same school');

        const proctor = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, proctor.personId);
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        assert.equal((await results(await signedIn(proctor))).status, 403, 'a proctor supervises, but does not score (D04.1-63)');

        const otherTenant = await createTenant(pool, 'SMA Lain');
        const outsider = await createPersonWithAccount(pool);
        await createTeachingContext(pool, otherTenant, await addMembership(pool, otherTenant, outsider.personId));
        assert.equal((await results(await signedIn(outsider, otherTenant))).status, 403, 'a teacher of another school');

        const anonymous = new BrowserLikeClient(app.baseUrl);
        assert.equal((await results(anonymous)).status, 401);

        const teacherClient = await signedIn(teacher);
        assert.equal((await results(teacherClient, randomUUID())).status, 403, 'an unknown exam looks like a forbidden one');
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/results?examInstanceId=bukan-uuid')).status, 400);
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/results')).status, 400);
        assert.equal((await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`, { method: 'POST', body: {} })).status, 405);

        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = now() WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.equal((await results(teacherClient)).status, 403, 'a revoked teaching assignment ends access');
        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = NULL WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.equal((await results(teacherClient)).status, 200);
    });
});
