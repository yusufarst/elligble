import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTeachingContext, createTenant, enrollInTeachingGroup } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { sha256Hex } from '../../src/teacher-exam-import.ts';

// ASSESS-QUESTION-003 real PostgreSQL oracle (record §4/§4A/§7, C03): a teacher imports a v2 file
// with BS and PG rows, previews the key and opens the exam; a Student answers through HTTP with
// a client that declares true/false; refusals change nothing; an older client is refused
// explicitly; submit, finalize and results agree under the composite rule.

const ALL = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE' };
const WITHOUT_TF = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE' };
const FILE = [
    'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',
    '1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1',
    '2;BS;Matahari terbit dari arah timur;;;;;;B;2',
].join('\r\n') + '\r\n';

function wib(minutes: number): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('ASSESS-QUESTION-003 C03 true/false end to end through production wiring', { skip: skipWithoutDatabase, timeout: 180000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'IPA');
    const students = [];
    for (const name of ['siswa.bs.a', 'siswa.bs.b']) {
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
        questionsCsv: FILE, sourceFileName: 'bs.csv', participantEnrollmentIds: null,
    };
    const act = (examInstanceId: string, action: string) => teacherClient.request('/api/v1/assessment/teacher-exams/transition',
        { method: 'POST', body: { reason: 'Uji benar salah', actionKey: randomUUID(), confirmed: true, examInstanceId, action } });

    const preview = await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', { method: 'POST', body });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.body.problems, []);
    assert.deepEqual(preview.body.questions[1], { line: 3, no: 2, prompt: 'Matahari terbit dari arah timur', options: [], score: 2, type: 'BS', correct: 'Benar', correctLetters: [], correctValue: true });
    const imported = await teacherClient.request('/api/v1/assessment/teacher-exams/import', { method: 'POST', body: { importKey: randomUUID(), expectedSha256: sha256Hex(FILE), ...body } });
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    const exam: string = imported.body.examInstanceId;
    const snaps = (await pool.query('SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id=$1 ORDER BY display_order', [exam])).rows;
    assert.deepEqual(snaps[1].frozen_content, { schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Matahari terbit dari arah timur', correctValue: true, maxScore: 2 });
    const [pgId, tfId] = snaps.map(s => s.id as string);
    const pgCorrect = snaps[0].frozen_content.correctOptionId as string;

    await t.test('the teacher preview shows the key; the exam opens', async () => {
        const p = await teacherClient.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${exam}`);
        assert.equal(p.status, 200);
        assert.deepEqual(p.body.questions[1], { snapshotId: tfId, no: 2, prompt: 'Matahari terbit dari arah timur', options: [], correctOptionId: null, maxScore: 2, valid: true,
            questionType: 'TRUE_FALSE', correctOptionIds: null, correctValue: true });
        assert.equal('correctValue' in p.body.questions[0], false, 'v1 items never carry correctValue');
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
    const a = await start(students[0]);
    const b = await start(students[1]);
    const rows = async (attemptId: string) => (await pool.query('SELECT exam_question_snapshot_id, answer_payload, write_version FROM secure_assessment_exam_answers WHERE exam_attempt_id=$1 ORDER BY exam_question_snapshot_id', [attemptId])).rows;

    await t.test('delivery without the key; T1/T2 saves; T4 refusals and an older client change nothing', async () => {
        const d = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: ALL });
        assert.equal(d.status, 200, JSON.stringify(d.body));
        assert.deepEqual(d.body.questions[1], { snapshotId: tfId, schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Matahari terbit dari arah timur' });
        assert.doesNotMatch(JSON.stringify(d.body), /correct/);
        const older = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: WITHOUT_TF });
        assert.deepEqual([older.status, older.body], [409, { error: 'question_type_unsupported' }], 'a client of ASSESS-QUESTION-002 is told explicitly');
        assert.equal((await a.save(tfId, { value: false })).body.writeVersion, 1);
        const before = await rows(a.attemptId);
        for (const bad of [{ value: 'true' }, { value: null }, { value: 1 }, { value: true, extra: 1 }, { selectedOptionId: 'x' }, [true], {}]) {
            const r = await a.save(tfId, bad, 1);
            assert.deepEqual([r.status, r.body.error], [400, 'invalid_answer_payload'], JSON.stringify(bad));
        }
        const refused = await a.save(tfId, { value: true }, 1, WITHOUT_TF);
        assert.deepEqual([refused.status, refused.body], [409, { error: 'question_type_unsupported' }]);
        assert.deepEqual(await rows(a.attemptId), before, 'zero mutation');
        assert.equal((await a.save(tfId, { value: true }, 1)).body.writeVersion, 2, 'changed to the correct value');
        assert.equal((await a.save(pgId, { selectedOptionId: pgCorrect })).status, 200);
        assert.equal((await b.save(tfId, { value: false })).body.writeVersion, 1);
        const resumed = await b.c.request(`/api/v1/assessment/resume?attemptId=${b.attemptId}&examSessionId=${b.sessionId}`);
        assert.deepEqual(resumed.body.answers.map((x: any) => [x.snapshotId, x.answerPayload, x.writeVersion]), [[tfId, { value: false }, 1]]);
    });

    await t.test('submit, provisional and final results agree under the composite rule', async () => {
        for (const s of [a, b]) assert.equal((await s.c.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        const scores = (r: any) => Object.fromEntries(r.participants.map((p: any) => [p.elligbleId, p.score && [p.score.rawScore, p.score.maxScore, p.score.scaledScore, p.score.correct, p.score.incorrect, p.score.unanswered]]));
        const provisional = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.equal(provisional.body.scoring.rule, 'COMPOSITE_PER_ITEM_V1');
        assert.deepEqual(scores(provisional.body), { 'siswa.bs.a': [3, 3, 100, 2, 0, 0], 'siswa.bs.b': [0, 3, 0, 0, 1, 1] });
        assert.equal((await act(exam, 'end')).status, 200);
        assert.equal((await act(exam, 'finalize')).status, 200);
        const fin = (await pool.query('SELECT id, scoring_rule FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0];
        assert.equal(fin.scoring_rule, 'COMPOSITE_PER_ITEM_V1');
        const items = (await pool.query('SELECT item_outcomes FROM secure_assessment_attempt_results WHERE finalization_id=$1 AND exam_attempt_id=$2', [fin.id, b.attemptId])).rows[0].item_outcomes;
        assert.deepEqual(items.map((i: any) => [i.questionSnapshotId, i.ruleId, i.outcome, i.scoreMicro, 'selectedOptionId' in i]),
            [[pgId, 'BASELINE_SINGLE_CHOICE_V1', 'UNANSWERED', 0, true], [tfId, 'TRUE_FALSE_EXACT_V1', 'INCORRECT', 0, false]]);
        const final = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.deepEqual(scores(final.body), scores(provisional.body));
    });
});
