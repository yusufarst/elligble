import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import type * as http from 'node:http';
import type pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, addParticipant, baselineQuestion, createExamInstance, createPersonWithAccount, createTeachingContext, createTenant } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { createQuestionRegistry, V1_SINGLE_CHOICE_DESCRIPTOR, type QuestionDescriptor } from '../../src/question-contract.ts';
import { handleSaveAnswer } from '../../src/answer.ts';
import { freezeExamResults } from '../../src/result-finalization.ts';
import { scoreBaselineAttempt, selectedOptionOf } from '../../src/scoring.ts';
import { checkExamInstanceBaselineQuestionSnapshotContentReadiness } from '../../src/exam-instance-baseline-question-snapshot-content-readiness-preflight.ts';

// ASSESS-QUESTION-001 real PostgreSQL oracles (record §5A/§7, C03–C06). Version 2 content is
// inserted directly as synthetic rows, because no production writer creates it yet. The
// production server always runs with the production registry (v1 only); composite results and
// empty writes are proven by calling the real handler and finalizer with a test-only registry.

const TEST_KEY = '2:TEST_BOOLEAN';
const testBoolean = (correct: boolean, maxScore = 2) => ({ schemaVersion: 2, questionType: 'TEST_BOOLEAN', prompt: 'Benar atau salah?', correct, maxScore });
const TEST_DESCRIPTOR: QuestionDescriptor = {
    key: TEST_KEY, scoringRuleId: 'TEST_BOOLEAN_V1', allowsEmpty: true,
    validateContent: c => (typeof c.correct === 'boolean' && typeof c.maxScore === 'number' && c.maxScore > 0 ? { ok: true } : { ok: false }),
    studentView: c => ({ schemaVersion: 2, questionType: 'TEST_BOOLEAN', prompt: c.prompt }),
    validateAnswer: (_c, p) => {
        if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).join() !== 'value') return { ok: false };
        const value = (p as { value: unknown }).value;
        return value === '' ? { ok: true, empty: true } : typeof value === 'boolean' ? { ok: true, empty: false } : { ok: false };
    },
    score: (c, p) => {
        const maxMicro = BigInt(Math.round((c.maxScore as number) * 1_000_000));
        const value = p && typeof p === 'object' ? (p as { value?: unknown }).value : undefined;
        if (typeof value !== 'boolean') return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro };
        return value === c.correct ? { outcome: 'CORRECT', earnedMicro: maxMicro, maxMicro } : { outcome: 'INCORRECT', earnedMicro: 0n, maxMicro };
    },
};
const TEST_REGISTRY = createQuestionRegistry([V1_SINGLE_CHOICE_DESCRIPTOR, TEST_DESCRIPTOR]);
const UNSUPPORTED = { error: 'question_type_unsupported' };

test('ASSESS-QUESTION-001 C03/C04/C05/C06 versioned content through real PostgreSQL', { skip: skipWithoutDatabase, timeout: 180000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;
    const tenant = await createTenant(pool, 'SMA Negeri 2 Contoh');
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId));
    const loggedIn = async (person: { username: string; password: string }) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const act = (examInstanceId: string, action: string) => teacherClient.request('/api/v1/assessment/teacher-exams/transition',
        { method: 'POST', body: { reason: 'Uji tipe soal', actionKey: randomUUID(), confirmed: true, examInstanceId, action } });

    async function examWith(contents: unknown[], lifecycleState = 'ACTIVE') {
        const exam = await createExamInstance(pool, tenant, teaching, { lifecycleState });
        const ids: string[] = [];
        for (const [i, content] of contents.entries()) {
            ids.push((await pool.query('INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1,$2,$3,$4) RETURNING id',
                [tenant, exam, JSON.stringify(content), i + 1])).rows[0].id);
        }
        return { exam, ids };
    }
    async function studentIn(exam: string) {
        const person = await createPersonWithAccount(pool);
        await addMembership(pool, tenant, person.personId);
        await addParticipant(pool, tenant, exam, person.personId);
        const client = await loggedIn(person);
        const attemptId: string = (await client.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await client.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await client.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const deliver = (headers?: Record<string, string>) => client.request(`/api/v1/assessment/questions?attemptId=${attemptId}`, { headers });
        const save = (snapshotId: string, answerPayload: unknown, extra: { headers?: Record<string, string>; identity?: string; expected?: number | null } = {}) =>
            client.request('/api/v1/assessment/answer/save', { method: 'POST', headers: extra.headers,
                body: { attemptId, sessionId, snapshotId, answerPayload, clientWriteIdentity: extra.identity ?? randomUUID(), expectedWriteVersion: extra.expected ?? null } });
        return { person, client, attemptId, sessionId, deliver, save };
    }
    const answerRows = async (attemptId: string) => (await pool.query('SELECT exam_question_snapshot_id, answer_payload, write_version, client_write_identity FROM secure_assessment_exam_answers WHERE exam_attempt_id=$1 ORDER BY exam_question_snapshot_id', [attemptId])).rows;

    await t.test('C04 an unsupported version 2 row is refused explicitly on delivery and save, with zero mutation', async () => {
        const { exam, ids } = await examWith([baselineQuestion(1), testBoolean(true), { ...baselineQuestion(3), schemaVersion: 2 }]);
        const s = await studentIn(exam);
        const delivered = await s.deliver();
        assert.equal(delivered.status, 409);
        assert.deepEqual(delivered.body, UNSUPPORTED, 'no question content');
        assert.deepEqual((await s.deliver({ 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:TEST_BOOLEAN' })).body, UNSUPPORTED, 'the server does not support it either');
        assert.deepEqual((await s.save(ids[1], { value: true })).body, UNSUPPORTED);
        const v2Single = await s.save(ids[2], { selectedOptionId: 'B' });
        assert.equal(v2Single.status, 409, 'a version 2 single choice row is no longer accepted');
        assert.deepEqual(await answerRows(s.attemptId), []);
        // The v1 row of the same exam is still saved as before.
        assert.equal((await s.save(ids[0], { selectedOptionId: 'B' })).status, 200);
    });

    await t.test('C04 a client that does not declare v1 is refused on a v1 exam; a malformed header is 400 with zero mutation', async () => {
        const { exam, ids } = await examWith([baselineQuestion(1), baselineQuestion(2)]);
        const s = await studentIn(exam);
        assert.equal((await s.save(ids[0], { selectedOptionId: 'B' })).status, 200);
        const before = await answerRows(s.attemptId);
        const other = { 'X-Question-Types': '2:TRUE_FALSE' };
        assert.deepEqual([(await s.deliver(other)).status, (await s.deliver(other)).body], [409, UNSUPPORTED]);
        const refused = await s.save(ids[1], { selectedOptionId: 'B' }, { headers: other });
        assert.deepEqual([refused.status, refused.body], [409, UNSUPPORTED]);
        for (const bad of ['bogus', '1:MULTIPLE_CHOICE_SINGLE,1:MULTIPLE_CHOICE_SINGLE', '']) {
            const d = await s.deliver({ 'X-Question-Types': bad });
            assert.deepEqual([d.status, d.body], [400, { error: 'invalid_request' }], bad);
            const w = await s.save(ids[1], { selectedOptionId: 'C' }, { headers: { 'X-Question-Types': bad } });
            assert.deepEqual([w.status, w.body], [400, { error: 'invalid_request' }], bad);
        }
        assert.deepEqual(await answerRows(s.attemptId), before, 'zero mutation');
        assert.equal((await s.deliver({ 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE' })).status, 200);
        assert.equal((await s.deliver({ 'X-Question-Types': ' 1:MULTIPLE_CHOICE_SINGLE , 2:TRUE_FALSE' })).status, 200, 'undeclared extra keys are harmless');
    });

    await t.test('C04 delivery keeps the existing refusals of a paused or submitted attempt ahead of an unsupported row', async () => {
        const paused = await examWith([testBoolean(true)]);
        const p = await studentIn(paused.exam);
        assert.equal((await act(paused.exam, 'pause')).status, 200);
        const pr = await p.deliver();
        assert.equal(pr.status, 409);
        assert.equal(pr.body.error, 'exam_paused');
        const submitted = await examWith([baselineQuestion(1), testBoolean(true)]);
        const q = await studentIn(submitted.exam);
        assert.equal((await q.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: q.attemptId } })).status, 200);
        const sr = await q.deliver();
        assert.equal(sr.status, 409);
        assert.equal(sr.body.error, 'attempt_already_submitted');
    });

    await t.test('C04 readiness keeps the v1 blocker for an unsupported row and activation is refused', async () => {
        const ready = await examWith([baselineQuestion(1)], 'READY');
        const blocked = await examWith([baselineQuestion(1), testBoolean(true)], 'READY');
        for (const e of [ready, blocked]) await addParticipant(pool, tenant, e.exam, (await createPersonWithAccount(pool)).personId);
        const c = await pool.connect();
        try {
            const content = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(c, tenant, blocked.exam, async () => 'granted' as const);
            assert.deepEqual(content, { type: 'not_ready', blocker: 'question_snapshot_content_invalid', snapshotId: blocked.ids[1], contentBlocker: 'schema_version_invalid' });
            const invalidRegistered = await examWith([testBoolean(true, 0)], 'READY');
            const viaTest = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(c, tenant, invalidRegistered.exam, async () => 'granted' as const, TEST_REGISTRY);
            assert.deepEqual(viaTest, { type: 'not_ready', blocker: 'question_snapshot_content_invalid', snapshotId: invalidRegistered.ids[0], contentBlocker: 'question_content_invalid' });
            const validRegistered = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(c, tenant, blocked.exam, async () => 'granted' as const, TEST_REGISTRY);
            assert.equal(validRegistered.type, 'baseline_question_snapshot_content_ready');
        } finally { c.release(); }
        const refused = await act(blocked.exam, 'activate');
        assert.equal(refused.status, 409, JSON.stringify(refused.body));
        assert.match(JSON.stringify(refused.body), /question_snapshot_content_invalid/);
        assert.equal((await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id=$1', [blocked.exam])).rows[0].lifecycle_state, 'READY');
        assert.equal((await act(ready.exam, 'activate')).status, 200, 'the same exam with v1 content activates');
    });

    await t.test('C05 v1 regression: delivery, save, resume, submit and finalization are unchanged', async () => {
        const contents = [baselineQuestion(1), baselineQuestion(2, 'C'), baselineQuestion(3)];
        const { exam, ids } = await examWith(contents);
        const s = await studentIn(exam);
        const expectedView = ids.map((snapshotId, i) => ({ snapshotId, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: contents[i].prompt,
            options: contents[i].options.map(o => ({ id: o.id, content: o.content })) }));
        for (const headers of [undefined, { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE' }]) {
            const d = await s.deliver(headers);
            assert.equal(d.status, 200);
            assert.equal(JSON.stringify(d.body), JSON.stringify({ attemptId: s.attemptId, questions: expectedView }));
        }
        const identity = randomUUID();
        const first = await s.save(ids[0], { selectedOptionId: 'B' }, { identity });
        assert.deepEqual([first.status, first.body.writeVersion], [200, 1]);
        const replay = await s.save(ids[0], { selectedOptionId: 'B' }, { identity });
        assert.deepEqual([replay.status, replay.body.writeVersion], [200, 1], 'idempotent');
        const reuse = await s.save(ids[0], { selectedOptionId: 'A' }, { identity });
        assert.deepEqual([reuse.status, reuse.body.error], [409, 'write_identity_reuse_conflict']);
        const stale = await s.save(ids[0], { selectedOptionId: 'A' }, { expected: 5 });
        assert.deepEqual([stale.status, stale.body.error], [409, 'stale_write_version']);
        assert.equal((await s.save(ids[0], { selectedOptionId: 'A' }, { expected: 1, headers: { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE' } })).body.writeVersion, 2);
        assert.equal((await s.save(ids[1], { selectedOptionId: 'C' })).status, 200);
        const resumed = await s.client.request(`/api/v1/assessment/resume?attemptId=${s.attemptId}&examSessionId=${s.sessionId}`);
        assert.equal(resumed.status, 200);
        assert.deepEqual(resumed.body.answers.map((a: any) => [a.snapshotId, a.answerPayload, a.writeVersion]).sort(),
            [[ids[0], { selectedOptionId: 'A' }, 2], [ids[1], { selectedOptionId: 'C' }, 1]].sort());
        assert.equal((await s.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        assert.equal((await act(exam, 'end')).status, 200);
        assert.equal((await act(exam, 'finalize')).status, 200);
        const fin = (await pool.query('SELECT id, scoring_rule, question_count, max_score_micro FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0];
        assert.deepEqual([fin.scoring_rule, fin.question_count, Number(fin.max_score_micro)], ['BASELINE_SINGLE_CHOICE_V1', 3, 3_000_000]);
        const result = (await pool.query('SELECT item_outcomes, raw_score_micro, scaled_score FROM secure_assessment_attempt_results WHERE finalization_id=$1 AND standing=$2', [fin.id, 'SUBMITTED'])).rows[0];
        const answers = new Map<string, unknown>([[ids[0], { selectedOptionId: 'A' }], [ids[1], { selectedOptionId: 'C' }]]);
        const expected = scoreBaselineAttempt(ids.map((id, i) => ({ id, frozenContent: contents[i] })), answers);
        assert.ok(expected.type === 'scored');
        assert.deepEqual(result.item_outcomes, expected.score.items.map(item => ({ questionSnapshotId: item.questionSnapshotId, selectedOptionId: selectedOptionOf(answers.get(item.questionSnapshotId)),
            outcome: item.outcome, scoreMicro: item.score * 1_000_000, maxScoreMicro: item.maxScore * 1_000_000 })));
        assert.deepEqual([Number(result.raw_score_micro), Number(result.scaled_score)], [1_000_000, 33.33]);
    });

    await t.test('C06 composite through a test-only registry: empty versioned write, per-item rules and exact totals', async () => {
        const { exam, ids } = await examWith([baselineQuestion(1), testBoolean(true, 2), testBoolean(false, 0.5)]);
        const s = await studentIn(exam);
        assert.equal((await s.save(ids[0], { selectedOptionId: 'B' })).status, 200);
        assert.deepEqual((await s.save(ids[1], { value: '' })).body, UNSUPPORTED, 'the production server refuses the test type');
        const deps = { pool, getAuthorizedContext: () => ({ tenantId: tenant, authorizedAttemptId: s.attemptId }), questionRegistry: TEST_REGISTRY };
        const save = (snapshotId: string, answerPayload: unknown, expectedWriteVersion: number | null, header = `1:MULTIPLE_CHOICE_SINGLE,${TEST_KEY}`) =>
            new Promise<{ status: number; body: any }>(resolve => {
                const req = Object.assign(new PassThrough(), { method: 'POST', headers: { 'x-question-types': header } });
                const res = { statusCode: 0, writeHead(st: number) { this.statusCode = st; return this; }, end(b?: string) { resolve({ status: this.statusCode, body: b ? JSON.parse(b) : null }); } };
                void handleSaveAnswer(req as unknown as http.IncomingMessage, res as unknown as http.ServerResponse, deps);
                req.end(JSON.stringify({ attemptId: s.attemptId, sessionId: s.sessionId, snapshotId, answerPayload, clientWriteIdentity: randomUUID(), expectedWriteVersion }));
            });
        assert.deepEqual((await save(ids[1], { value: '' }, null, '1:MULTIPLE_CHOICE_SINGLE')).body, UNSUPPORTED, 'not declared by the client');
        assert.equal((await save(ids[1], { value: 'ya' }, null)).status, 400);
        const empty = await save(ids[1], { value: '' }, null);
        assert.deepEqual([empty.status, empty.body.writeVersion], [200, 1], 'an empty value is an accepted versioned write');
        assert.equal((await save(ids[1], { value: true }, 1)).body.writeVersion, 2);
        assert.equal((await save(ids[1], { value: '' }, 2)).body.writeVersion, 3, 'cleared again');
        assert.equal((await save(ids[2], { value: false }, null)).body.writeVersion, 1);
        assert.equal((await s.client.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        assert.equal((await act(exam, 'end')).status, 200);
        const c: pg.PoolClient = await pool.connect();
        let outcome;
        try {
            await c.query('BEGIN');
            const production = await freezeExamResults(c, tenant, exam, teacher.personId);
            assert.deepEqual(production, { type: 'scoring_unavailable' }, 'production cannot score an unsupported row');
            outcome = await freezeExamResults(c, tenant, exam, teacher.personId, TEST_REGISTRY);
            await c.query('COMMIT');
        } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
        assert.equal(outcome.type, 'frozen');
        const fin = (await pool.query('SELECT id, scoring_rule, question_count, max_score_micro FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0];
        assert.deepEqual([fin.scoring_rule, fin.question_count, Number(fin.max_score_micro)], ['COMPOSITE_PER_ITEM_V1', 3, 3_500_000]);
        const result = (await pool.query('SELECT item_outcomes, correct_count, incorrect_count, unanswered_count, raw_score_micro, max_score_micro, scaled_score FROM secure_assessment_attempt_results WHERE finalization_id=$1', [fin.id])).rows[0];
        assert.deepEqual(result.item_outcomes, [
            { questionSnapshotId: ids[0], ruleId: 'BASELINE_SINGLE_CHOICE_V1', selectedOptionId: 'B', outcome: 'CORRECT', scoreMicro: 1_000_000, maxScoreMicro: 1_000_000 },
            { questionSnapshotId: ids[1], ruleId: 'TEST_BOOLEAN_V1', outcome: 'UNANSWERED', scoreMicro: 0, maxScoreMicro: 2_000_000 },
            { questionSnapshotId: ids[2], ruleId: 'TEST_BOOLEAN_V1', outcome: 'CORRECT', scoreMicro: 500_000, maxScoreMicro: 500_000 },
        ]);
        assert.deepEqual([result.correct_count, result.incorrect_count, result.unanswered_count, Number(result.raw_score_micro), Number(result.max_score_micro), Number(result.scaled_score)],
            [2, 0, 1, 1_500_000, 3_500_000, 42.86]);
    });
});
