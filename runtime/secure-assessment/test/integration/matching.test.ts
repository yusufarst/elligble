import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTeachingContext, createTenant, enrollInTeachingGroup } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { sha256Hex } from '../../src/teacher-exam-import.ts';
import { QUESTIONS_HEADER_V2_EXTENDED } from '../../src/question-import.ts';

// ASSESS-QUESTION-004 real PostgreSQL oracle (record §4/§4A/§7, C03): a teacher imports an extended
// v2 file with MJ and PG rows, previews the key and opens the exam; Students answer through HTTP
// with a client that declares matching: exact (M1/M2), swapped (M3), incomplete (M4, Owner D1) and
// empty (M5); refusals change nothing; an older client is refused explicitly; monitoring counts
// only complete matching answers; submit, finalize and results agree under the composite rule.

const ALL = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING' };
const WITHOUT_MJ = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE' };
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
const LEFT = ['Sapi', 'Kucing', 'Kelinci'];
const RIGHT = ['Wortel', 'Rumput', 'Ikan', 'Biji jagung'];
const FILE = [
    QUESTIONS_HEADER_V2_EXTENDED.join(';'),
    ['1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1', ...pad([], 22)].join(';'),
    ['2;MJ;Pasangkan hewan dengan makanannya;;;;;;B,C,A;3', ...pad(LEFT, 10), ...pad(RIGHT, 12)].join(';'),
].join('\r\n') + '\r\n';

function wib(minutes: number): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('ASSESS-QUESTION-004 C03 matching end to end through production wiring', { skip: skipWithoutDatabase, timeout: 180000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'IPA');
    const students = [];
    for (const name of ['siswa.mj.a', 'siswa.mj.b', 'siswa.mj.c', 'siswa.mj.d']) {
        const person = await createPersonWithAccount(pool, name);
        await enrollInTeachingGroup(pool, tenant, teaching, await addMembership(pool, tenant, person.personId));
        students.push(person);
    }
    const loggedIn = async (person: { username: string; password: string }) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const body = {
        teachingAssignmentId: teaching.teachingAssignmentId, assessmentTypeId: teaching.assessmentTypeId,
        windowStartsAt: wib(-2), windowEndsAt: wib(120), durationMinutes: 60, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
        questionsCsv: FILE, sourceFileName: 'mj.csv', participantEnrollmentIds: null,
    };
    const act = (examInstanceId: string, action: string) => teacherClient.request('/api/v1/assessment/teacher-exams/transition',
        { method: 'POST', body: { reason: 'Uji menjodohkan', actionKey: randomUUID(), confirmed: true, examInstanceId, action } });

    const preview = await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', { method: 'POST', body });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.body.problems, []);
    assert.deepEqual(preview.body.questions[1], { line: 3, no: 2, prompt: 'Pasangkan hewan dengan makanannya', options: [], score: 3, type: 'MJ',
        correct: 'B, C, A', correctLetters: ['B', 'C', 'A'], leftItems: LEFT, rightItems: RIGHT });
    assert.equal('leftItems' in preview.body.questions[0], false, 'PG items never carry matching fields');
    const imported = await teacherClient.request('/api/v1/assessment/teacher-exams/import', { method: 'POST', body: { importKey: randomUUID(), expectedSha256: sha256Hex(FILE), ...body } });
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    const exam: string = imported.body.examInstanceId;
    const snaps = (await pool.query('SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id=$1 ORDER BY display_order', [exam])).rows;
    const [pgId, mjId] = snaps.map(s => s.id as string);
    const pgCorrect = snaps[0].frozen_content.correctOptionId as string;
    const content = snaps[1].frozen_content;
    assert.equal(content.questionType, 'MATCHING');
    const L = (content.leftItems as Array<{ id: string }>).map(i => i.id);
    const R = (content.rightItems as Array<{ id: string }>).map(i => i.id);
    assert.deepEqual(content.correctPairs, [{ leftId: L[0], rightId: R[1] }, { leftId: L[1], rightId: R[2] }, { leftId: L[2], rightId: R[0] }]);
    const p = (pairs: Array<[number, number]>) => ({ pairs: pairs.map(([l, r]) => ({ leftId: L[l], rightId: R[r] })) });

    await t.test('the teacher preview shows the key; the exam opens', async () => {
        const r = await teacherClient.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${exam}`);
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.questions[1], {
            snapshotId: mjId, no: 2, prompt: 'Pasangkan hewan dengan makanannya', options: [], correctOptionId: null, maxScore: 3, valid: true,
            questionType: 'MATCHING', correctOptionIds: null,
            leftItems: LEFT.map((c, i) => ({ id: L[i], content: c })), rightItems: RIGHT.map((c, i) => ({ id: R[i], content: c })),
            correctPairs: content.correctPairs,
        });
        assert.equal('correctPairs' in r.body.questions[0], false, 'v1 items never carry matching fields');
        assert.equal((await act(exam, 'mark_ready')).status, 200);
        assert.equal((await act(exam, 'activate')).status, 200);
    });

    const start = async (person: { username: string; password: string }) => {
        const c = await loggedIn(person);
        const attemptId: string = (await c.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await c.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await c.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const save = (snapshotId: string, answerPayload: unknown, expectedWriteVersion: number | null = null, headers = ALL) => c.request('/api/v1/assessment/answer/save',
            { method: 'POST', headers, body: { attemptId, sessionId, snapshotId, answerPayload, clientWriteIdentity: randomUUID(), expectedWriteVersion } });
        return { c, attemptId, sessionId, save };
    };
    const [a, b, c, d] = [await start(students[0]), await start(students[1]), await start(students[2]), await start(students[3])];
    const rows = async (attemptId: string) => (await pool.query('SELECT exam_question_snapshot_id, answer_payload, write_version FROM secure_assessment_exam_answers WHERE exam_attempt_id=$1 ORDER BY exam_question_snapshot_id', [attemptId])).rows;
    const answeredCounts = async () => {
        const r = await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        return Object.fromEntries(r.body.participants.map((x: any) => [x.elligbleId, x.answeredCount]));
    };

    await t.test('delivery without the key; M1/M2/M4/M5 saves; M7 refusals and an older client change nothing; monitoring counts complete answers only', async () => {
        const del = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: ALL });
        assert.equal(del.status, 200, JSON.stringify(del.body));
        assert.deepEqual(del.body.questions[1], { snapshotId: mjId, schemaVersion: 2, questionType: 'MATCHING', prompt: 'Pasangkan hewan dengan makanannya',
            leftItems: LEFT.map((x, i) => ({ id: L[i], content: x })), rightItems: RIGHT.map((x, i) => ({ id: R[i], content: x })) });
        assert.doesNotMatch(JSON.stringify(del.body), /correct/);
        const older = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: WITHOUT_MJ });
        assert.deepEqual([older.status, older.body], [409, { error: 'question_type_unsupported' }], 'a client of ASSESS-QUESTION-003 is told explicitly');
        assert.equal((await a.save(mjId, p([[0, 1], [1, 2]]))).body.writeVersion, 1, 'M4 incomplete is saved');
        const before = await rows(a.attemptId);
        for (const bad of [p([[0, 1], [0, 2]]), p([[0, 1], [1, 1]]), { pairs: [{ leftId: 'x', rightId: R[0] }] }, { pairs: [{ leftId: L[0], rightId: L[1] }] },
            { pairs: [{ leftId: L[0], rightId: R[1], extra: 1 }] }, { pairs: [], extra: 1 }, { pairs: 'x' }, { selectedOptionIds: [] }, [], {}]) {
            const r = await a.save(mjId, bad, 1);
            assert.deepEqual([r.status, r.body.error], [400, 'invalid_answer_payload'], JSON.stringify(bad));
        }
        const refused = await a.save(mjId, p([[0, 1], [1, 2], [2, 0]]), 1, WITHOUT_MJ);
        assert.deepEqual([refused.status, refused.body], [409, { error: 'question_type_unsupported' }]);
        assert.deepEqual(await rows(a.attemptId), before, 'zero mutation');
        assert.deepEqual(await answeredCounts(), { 'siswa.mj.a': 0, 'siswa.mj.b': 0, 'siswa.mj.c': 0, 'siswa.mj.d': 0 }, 'M4 is not answered (D1)');
        assert.equal((await a.save(mjId, p([[2, 0], [0, 1], [1, 2]]), 1)).body.writeVersion, 2, 'M2 completed, in another order');
        assert.equal((await a.save(pgId, { selectedOptionId: pgCorrect })).status, 200);
        assert.equal((await b.save(mjId, p([[0, 1], [1, 2]]))).body.writeVersion, 1, 'B stays incomplete');
        assert.equal((await c.save(mjId, p([[0, 2], [1, 1], [2, 0]]))).body.writeVersion, 1, 'M3 complete but swapped');
        assert.equal((await d.save(mjId, p([[0, 1]]))).body.writeVersion, 1);
        assert.equal((await d.save(mjId, { pairs: [] }, 1)).body.writeVersion, 2, 'M5 empty write');
        const resumed = await b.c.request(`/api/v1/assessment/resume?attemptId=${b.attemptId}&examSessionId=${b.sessionId}`);
        assert.deepEqual(resumed.body.answers.map((x: any) => [x.snapshotId, x.answerPayload, x.writeVersion]), [[mjId, p([[0, 1], [1, 2]]), 1]], 'an incomplete answer is recovered');
        assert.deepEqual(await answeredCounts(), { 'siswa.mj.a': 2, 'siswa.mj.b': 0, 'siswa.mj.c': 1, 'siswa.mj.d': 0 });
    });

    await t.test('submit, provisional and final results agree under the composite rule; M4 is UNANSWERED', async () => {
        for (const s of [a, b, c, d]) assert.equal((await s.c.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        const scores = (r: any) => Object.fromEntries(r.participants.map((x: any) => [x.elligbleId, x.score && [x.score.rawScore, x.score.maxScore, x.score.scaledScore, x.score.correct, x.score.incorrect, x.score.unanswered]]));
        const provisional = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.equal(provisional.body.scoring.rule, 'COMPOSITE_PER_ITEM_V1');
        assert.deepEqual(scores(provisional.body), {
            'siswa.mj.a': [4, 4, 100, 2, 0, 0], 'siswa.mj.b': [0, 4, 0, 0, 0, 2], 'siswa.mj.c': [0, 4, 0, 0, 1, 1], 'siswa.mj.d': [0, 4, 0, 0, 0, 2],
        });
        assert.equal((await act(exam, 'end')).status, 200);
        assert.equal((await act(exam, 'finalize')).status, 200);
        const fin = (await pool.query('SELECT id, scoring_rule FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0];
        assert.equal(fin.scoring_rule, 'COMPOSITE_PER_ITEM_V1');
        const items = (await pool.query('SELECT item_outcomes FROM secure_assessment_attempt_results WHERE finalization_id=$1 AND exam_attempt_id=$2', [fin.id, b.attemptId])).rows[0].item_outcomes;
        assert.deepEqual(items.map((i: any) => [i.questionSnapshotId, i.ruleId, i.outcome, i.scoreMicro]),
            [[pgId, 'BASELINE_SINGLE_CHOICE_V1', 'UNANSWERED', 0], [mjId, 'MATCHING_EXACT_PAIRS_V1', 'UNANSWERED', 0]]);
        const final = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.deepEqual(scores(final.body), scores(provisional.body));
    });
});
