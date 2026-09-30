import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, baselineQuestion, createExamInstance,
    createPersonWithAccount, createTeachingContext, createTenant,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// Authored question order (D04.3-41, D04.2-57..59) and the baseline answer contract
// (D04.3-21) through HTTP with real PostgreSQL.

test('question order and answer contract (real PostgreSQL)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => {
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 1 Contoh');
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));
    const student = await createPersonWithAccount(pool);
    await addMembership(pool, tenant, student.personId);
    const exam = await createExamInstance(pool, tenant, teaching);
    await addParticipant(pool, tenant, exam, student.personId);

    // Identifiers chosen so that identifier order is the reverse of the authored order.
    const ids = [randomUUID(), randomUUID(), randomUUID()].sort().reverse();
    for (const [index, id] of ids.entries()) {
        await pool.query(
            'INSERT INTO secure_assessment_exam_question_snapshots (id, tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, $4, $5)',
            [id, tenant, exam, JSON.stringify(baselineQuestion(index + 1)), index + 1]
        );
    }

    const client = new BrowserLikeClient(app.baseUrl);
    assert.equal((await client.login(student.username, student.password)).status, 200);
    client.tenantId = tenant;
    const attemptId = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
    const sessionId = randomUUID();
    await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } });
    await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } });

    await t.test('questions arrive in the authored order, not identifier order', async () => {
        const res = await client.request(`/api/v1/assessment/questions?attemptId=${attemptId}`);
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.questions.map((q: any) => q.snapshotId), ids);
        assert.match(res.body.questions[0].prompt, /^Soal nomor 1:/);
    });

    await t.test('positions are unique and positive per exam', async () => {
        await assert.rejects(pool.query(
            'INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 2)',
            [tenant, exam, JSON.stringify(baselineQuestion(9))]
        ), /uq_sa_snapshot_display_order/);
        await assert.rejects(pool.query(
            'INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, 0)',
            [tenant, exam, JSON.stringify(baselineQuestion(9))]
        ), /ck_sa_snapshot_display_order_positive/);
    });

    const save = (answerPayload: unknown) => client.request('/api/v1/assessment/answer/save', {
        method: 'POST',
        body: { attemptId, sessionId, snapshotId: ids[0], answerPayload, clientWriteIdentity: randomUUID(), expectedWriteVersion: null },
    });

    await t.test('only an option of the frozen question can be stored', async () => {
        for (const payload of [{ selectedOptionId: 'Z' }, { selectedOptionId: 'A', extra: true }, { text: 'A' }, { selectedOptionId: 3 }]) {
            const res = await save(payload);
            assert.equal(res.status, 400, JSON.stringify(payload));
            assert.equal(res.body.error, 'invalid_answer_payload');
        }
        const stored = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1', [attemptId]);
        assert.equal(stored.rows[0].n, 0);
        const ok = await save({ selectedOptionId: 'C' });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.writeVersion, 1);
    });
});
