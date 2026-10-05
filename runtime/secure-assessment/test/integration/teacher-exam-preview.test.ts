import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, baselineQuestion, createExamInstance, createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// Exam preview before it opens against real PostgreSQL (ASSESS-TEACHER-002; D04.3-38/39):
// only the managing teacher, only while SCHEDULED or READY, the questions in the order
// students receive them with key and score, and nothing written anywhere.

test('teacher exam preview (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
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
    const student = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Fisika');
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Kimia');
    await addMembership(pool, tenant, student.personId);

    const loggedIn = async (person: { username: string; password: string }) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const preview = (c: BrowserLikeClient, examId: string) => c.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${examId}`);

    const exam = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'SCHEDULED', durationSeconds: 5400 });
    // Inserted out of order, with ids that sort differently again: the preview follows the
    // delivered order only.
    const insert = (id: string, content: unknown, order: number) => pool.query(
        'INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [id, tenant, exam, JSON.stringify(content), order]
    ).then(r => r.rows[0].id as string);
    const second = await insert('10000000-0000-4000-8000-000000000000', baselineQuestion(2, 'D'), 2);
    const first = await insert('30000000-0000-4000-8000-000000000000', baselineQuestion(1, 'B'), 1);
    const broken = await insert('20000000-0000-4000-8000-000000000000',
        { schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal tanpa kunci', options: [{ id: 'x', content: 'Ya' }] }, 3);
    await addParticipant(pool, tenant, exam, student.personId);

    const counts = async () => (await pool.query(
        `SELECT (SELECT count(*)::int FROM secure_assessment_exam_attempts) AS attempts,
                (SELECT count(*)::int FROM secure_assessment_timer_state) AS timers,
                (SELECT count(*)::int FROM secure_assessment_exam_answers) AS answers,
                (SELECT count(*)::int FROM secure_assessment_exam_lifecycle_events) AS events`
    )).rows[0];

    await t.test('the managing teacher sees the questions as delivered, with key and score, and nothing is written', async () => {
        const before = await counts();
        const res = await preview(teacherClient, exam);
        assert.equal(res.status, 200);
        assert.equal(res.body.exam.subjectLabel, 'Fisika');
        assert.equal(res.body.exam.groupLabel, 'X-1');
        assert.equal(res.body.exam.lifecycleState, 'SCHEDULED');
        assert.equal(res.body.exam.durationMinutes, 90);
        assert.deepEqual(res.body.questions.map((q: { snapshotId: string; no: number }) => [q.snapshotId, q.no]), [[first, 1], [second, 2], [broken, 3]]);
        const q2 = res.body.questions[1];
        assert.equal(q2.prompt, 'Soal nomor 2: berapakah 2 + 2?');
        assert.deepEqual(q2.options.map((o: { content: string }) => o.content), ['3', '4', '5', '6', '7']);
        assert.equal(q2.correctOptionId, 'D');
        assert.equal(q2.maxScore, 1);
        assert.equal(q2.valid, true);
        // Content the readiness check would refuse is shown as it is, never with a key.
        assert.deepEqual(res.body.questions[2], {
            snapshotId: broken, no: 3, prompt: 'Soal tanpa kunci', options: [{ id: 'x', content: 'Ya' }], correctOptionId: null, maxScore: null, valid: false,
        });
        assert.deepEqual(await counts(), before);
    });

    await t.test('ready exams too; other people, other states and malformed ids are refused', async () => {
        await pool.query(`UPDATE secure_assessment_exam_instances SET lifecycle_state = 'READY' WHERE id = $1`, [exam]);
        assert.equal((await preview(teacherClient, exam)).status, 200);
        assert.equal((await preview(await loggedIn(otherTeacher), exam)).status, 403);
        assert.equal((await preview(await loggedIn(student), exam)).status, 403);
        assert.equal((await preview(teacherClient, '11111111-1111-4111-8111-111111111111')).status, 403);
        assert.equal((await preview(teacherClient, 'bukan-id')).status, 400);
        const active = await createExamInstance(pool, tenant, teaching, { lifecycleState: 'ACTIVE' });
        const res = await preview(teacherClient, active);
        assert.equal(res.status, 409);
        assert.deepEqual(res.body, { error: 'invalid_state', currentState: 'ACTIVE' });
        assert.equal((await teacherClient.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${exam}`, { method: 'POST', body: {} })).status, 405);
    });

    await t.test('a revoked teaching assignment no longer previews', async () => {
        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = now() WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.equal((await preview(teacherClient, exam)).status, 403);
    });
});
