import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addQuestionSnapshots, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

test('student exam journey through HTTP (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 1 Contoh');
    const teacher = await createPersonWithAccount(pool, 'guru.jurnal');
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));

    async function studentFor(examOptions: Parameters<typeof createExamInstance>[3] = {}, questions = 3) {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        const exam = await createExamInstance(pool, tenant, teaching, examOptions);
        const snapshots = await addQuestionSnapshots(pool, tenant, exam, questions);
        await addParticipant(pool, tenant, exam, person.personId);
        const client = new BrowserLikeClient(app.baseUrl);
        assert.equal((await client.login(person.username, person.password)).status, 200);
        client.tenantId = tenant;
        return { person, exam, snapshots, client };
    }

    await t.test('complete journey: start, activate, timer, questions, answers, refresh, submit', async () => {
        const { exam, snapshots, client } = await studentFor({}, 3);

        const list = await client.request('/api/v1/assessment/assigned-exams');
        assert.equal(list.status, 200);
        assert.equal(list.body.assignments[0].schedule.lifecycleState, 'ACTIVE');
        assert.equal(list.body.assignments[0].schedule.attemptDurationSeconds, 3600);
        assert.deepEqual(list.body.assignments[0].attempts, []);
        assert.ok(!Number.isNaN(Date.parse(list.body.serverNow)));

        const start = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.equal(start.status, 201);
        const attemptId = start.body.attemptId;
        const again = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.deepEqual(again.body, { attemptId, created: false }, 'start is idempotent');

        const sessionId = randomUUID();
        const activate = await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } });
        assert.equal(activate.status, 200);
        const timer = await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } });
        assert.equal(timer.status, 200);
        assert.equal(timer.body.configuredDurationSeconds, 3600);

        const questions = await client.request(`/api/v1/assessment/questions?attemptId=${attemptId}`);
        assert.equal(questions.status, 200);
        assert.equal(questions.body.questions.length, 3);
        assert.equal(JSON.stringify(questions.body).includes('correctOptionId'), false, 'answer key never reaches the student');

        const save = (snapshotId: string, option: string, expectedWriteVersion: number | null) => client.request('/api/v1/assessment/answer/save', {
            method: 'POST',
            body: { attemptId, sessionId, snapshotId, answerPayload: { selectedOptionId: option }, clientWriteIdentity: randomUUID(), expectedWriteVersion },
        });
        assert.equal((await save(snapshots[0], 'A', null)).body.writeVersion, 1);
        assert.equal((await save(snapshots[0], 'C', 1)).body.writeVersion, 2);
        assert.equal((await save(snapshots[1], 'B', null)).status, 200);
        assert.equal((await save(snapshots[0], 'D', 1)).status, 409, 'stale write version rejected');

        const resume = await client.request(`/api/v1/assessment/resume?attemptId=${attemptId}`);
        assert.equal(resume.status, 200);
        assert.equal(resume.body.session.status, 'active');
        assert.equal(resume.body.timer.status, 'active');
        const answers = Object.fromEntries(resume.body.answers.map((a: any) => [a.snapshotId, a.answerPayload.selectedOptionId]));
        assert.deepEqual(answers, { [snapshots[0]]: 'C', [snapshots[1]]: 'B' });

        const submit = await client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId } });
        assert.equal(submit.status, 200);
        const submitAgain = await client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId } });
        assert.equal(submitAgain.status, 200);
        assert.equal(submitAgain.body.submissionId, submit.body.submissionId, 'submission is idempotent');
        assert.equal((await save(snapshots[2], 'A', null)).status, 409, 'no writes after submission');

        const after = await client.request('/api/v1/assessment/assigned-exams');
        assert.ok(after.body.assignments[0].attempts[0].submittedAt);
        const restart = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.equal(restart.status, 409);
        assert.equal(restart.body.error, 'attempt_already_submitted');
    });

    await t.test('entry is refused with a specific reason before the exam is runnable', async () => {
        const hour = 60 * 60 * 1000;
        const cases: Array<[Parameters<typeof createExamInstance>[3], string]> = [
            [{ lifecycleState: 'SCHEDULED' }, 'exam_not_active'],
            [{ lifecycleState: 'READY' }, 'exam_not_active'],
            [{ windowStartsAt: new Date(Date.now() + hour), windowEndsAt: new Date(Date.now() + 3 * hour) }, 'exam_not_open'],
            [{ windowStartsAt: new Date(Date.now() - 3 * hour), windowEndsAt: new Date(Date.now() - hour) }, 'exam_window_closed'],
            [{ latestStartPolicy: 'LATE_START_BLOCKED', windowEndsAt: new Date(Date.now() + 10 * 60 * 1000) }, 'late_start_blocked'],
        ];
        for (const [options, reason] of cases) {
            const { exam, client } = await studentFor(options, 1);
            const res = await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
            assert.equal(res.status, 409, reason);
            assert.equal(res.body.error, reason);
            const count = await pool.query('SELECT COUNT(*)::int AS n FROM secure_assessment_exam_attempts a JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id WHERE p.exam_instance_id = $1', [exam]);
            assert.equal(count.rows[0].n, 0, `no attempt created for ${reason}`);
        }
    });

    await t.test('REMAINING_WINDOW_ONLY shortens the attempt to the remaining window at timer start', async () => {
        const { exam, client } = await studentFor({ latestStartPolicy: 'REMAINING_WINDOW_ONLY', windowEndsAt: new Date(Date.now() + 20 * 60 * 1000) }, 1);
        const attemptId = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId: randomUUID() } });
        const timer = await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } });
        assert.equal(timer.status, 200);
        assert.ok(timer.body.configuredDurationSeconds <= 20 * 60 && timer.body.configuredDurationSeconds > 19 * 60, String(timer.body.configuredDurationSeconds));
    });

    await t.test('an exam paused or ended before the timer starts refuses the start', async () => {
        const { exam, client } = await studentFor({}, 1);
        const attemptId = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId: randomUUID() } });
        await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'PAUSED' WHERE id = $1`, [exam]);
        const timer = await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } });
        assert.equal(timer.status, 409);
        assert.equal(timer.body.error, 'exam_not_active');
    });

    await t.test('concurrent starts create exactly one attempt', async () => {
        const { exam, client } = await studentFor({}, 1);
        const results = await Promise.all(Array.from({ length: 8 }, () =>
            client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })));
        const ids = new Set(results.map(r => r.body.attemptId));
        assert.equal(ids.size, 1);
        assert.equal(results.filter(r => r.status === 201).length, 1);
    });

    await t.test('only assigned participants can start; other tenants and anonymous callers cannot', async () => {
        const { exam } = await studentFor({}, 1);
        const stranger = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, stranger.personId);
        const c = new BrowserLikeClient(app.baseUrl);
        await c.login(stranger.username, stranger.password);
        c.tenantId = tenant;
        const res = await c.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } });
        assert.equal(res.status, 403);
        assert.equal(res.body.error, 'not_participant');

        const otherTenant = await createTenant(pool, 'SMA Lain');
        await addMembership(pool, otherTenant, stranger.personId);
        c.tenantId = otherTenant;
        assert.equal((await c.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).status, 403);

        const anonymous = new BrowserLikeClient(app.baseUrl);
        anonymous.tenantId = tenant;
        assert.equal((await anonymous.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).status, 401);
        assert.equal((await c.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: 'nope' } })).status, 400);
    });
});
