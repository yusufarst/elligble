import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTeachingContext, createTenant, enrollInTeachingGroup } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { sha256Hex } from '../../src/teacher-exam-import.ts';
import { QUESTIONS_HEADER_V2_RUBRIC } from '../../src/question-import.ts';

// ASSESS-QUESTION-006 real PostgreSQL oracle (record §4/§5/§7, C03): a teacher imports a 34-column
// v2 file with PG, an auto IS row (accepted forms in left_1..left_10), a manual IS row (no forms,
// a rubric) and an ES row; previews it and opens the exam. Students answer through HTTP with a
// client that declares short answer; refusals change nothing; an older client is refused; monitoring
// does not count ""; after submit the auto item is scored after normalization, the manual item is on
// the worklist with the essay, the auto item is not gradable, finalization is refused until the
// manual item is graded, and provisional and final results agree.

const ALL = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING,2:ORDERING,2:NUMERIC_ANSWER,2:ESSAY,2:SHORT_ANSWER' };
const WITHOUT_IS = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING,2:ORDERING,2:NUMERIC_ANSWER,2:ESSAY' };
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
const row = (head: string, forms: string[] = [], rubric = '') => [head, ...pad(forms, 10), ...Array(12).fill(''), '', rubric].join(';');
const FILE = [
    QUESTIONS_HEADER_V2_RUBRIC.join(';'),
    row('1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1'),
    row('2;IS;Sebutkan ibu kota Indonesia;;;;;;;2', ['Jakarta', 'DKI Jakarta']),
    row('3;IS;Sebutkan satu kota di Jawa Barat;;;;;;;2', [], 'Kota di Jawa Barat'),
    row('4;ES;Jelaskan alasanmu;;;;;;;5'),
].join('\r\n') + '\r\n';

function wib(minutes: number): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('ASSESS-QUESTION-006 C03 short answer, auto and manual, end to end through production wiring', { skip: skipWithoutDatabase, timeout: 240000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'IPS');
    const students = [];
    for (const name of ['siswa.is.a', 'siswa.is.b', 'siswa.is.c']) {
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
        questionsCsv: FILE, sourceFileName: 'isian-singkat.csv', participantEnrollmentIds: null,
    };
    const act = (examInstanceId: string, action: string) => teacherClient.request('/api/v1/assessment/teacher-exams/transition',
        { method: 'POST', body: { reason: 'Uji isian singkat', actionKey: randomUUID(), confirmed: true, examInstanceId, action } });

    const preview = await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', { method: 'POST', body });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.body.problems, []);
    assert.deepEqual(preview.body.questions[1], { line: 3, no: 2, prompt: 'Sebutkan ibu kota Indonesia', options: [], score: 2, type: 'IS', correct: '', correctLetters: [], acceptedForms: ['Jakarta', 'DKI Jakarta'] });
    assert.deepEqual(preview.body.questions[2], { line: 4, no: 3, prompt: 'Sebutkan satu kota di Jawa Barat', options: [], score: 2, type: 'IS', correct: '', correctLetters: [], acceptedForms: [], rubric: 'Kota di Jawa Barat' });
    const imported = await teacherClient.request('/api/v1/assessment/teacher-exams/import', { method: 'POST', body: { importKey: randomUUID(), expectedSha256: sha256Hex(FILE), ...body } });
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    const exam: string = imported.body.examInstanceId;
    const snaps = (await pool.query('SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id=$1 ORDER BY display_order', [exam])).rows;
    const [pgId, autoId, manualId, esId] = snaps.map(s => s.id as string);
    const pgCorrect = snaps[0].frozen_content.correctOptionId as string;
    assert.deepEqual(snaps[1].frozen_content, { schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt: 'Sebutkan ibu kota Indonesia', acceptedForms: ['Jakarta', 'DKI Jakarta'], rubric: '', maxScore: 2 });
    assert.deepEqual(snaps[2].frozen_content.acceptedForms, []);

    await t.test('the teacher preview shows the forms and the rubric; the exam opens; the card counts teacher-graded items', async () => {
        const r = await teacherClient.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${exam}`);
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.questions[1], { snapshotId: autoId, no: 2, prompt: 'Sebutkan ibu kota Indonesia', options: [], correctOptionId: null, maxScore: 2, valid: true,
            questionType: 'SHORT_ANSWER', correctOptionIds: null, acceptedForms: ['Jakarta', 'DKI Jakarta'], rubric: '' });
        assert.deepEqual([r.body.questions[2].acceptedForms, r.body.questions[2].rubric], [[], 'Kota di Jawa Barat']);
        assert.equal('acceptedForms' in r.body.questions[0], false);
        const ready = await act(exam, 'mark_ready');
        assert.equal(ready.status, 200, JSON.stringify(ready.body));
        const opened = await act(exam, 'activate');
        assert.equal(opened.status, 200, JSON.stringify(opened.body));
        const cards = await teacherClient.request('/api/v1/assessment/teacher-readiness');
        assert.equal(cards.body.exams.find((e: any) => e.examInstanceId === exam).essayCount, 2, 'the manual short answer and the essay');
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
    const grade = (attemptId: string, snapshotId: string, score: string, expectedRevision: number | null = null) =>
        teacherClient.request('/api/v1/assessment/teacher-exams/essays/grade', { method: 'POST', body: { examInstanceId: exam, attemptId, snapshotId, score, expectedRevision } });

    await t.test('delivery without forms or rubric; saves exactly as typed; refusals and an older client change nothing; monitoring', async () => {
        const del = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: ALL });
        assert.equal(del.status, 200, JSON.stringify(del.body));
        assert.deepEqual(del.body.questions[1], { snapshotId: autoId, schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt: 'Sebutkan ibu kota Indonesia' });
        assert.doesNotMatch(JSON.stringify(del.body), /acceptedForms|rubric|DKI Jakarta|Kota di Jawa Barat|maxScore/);
        const older = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: WITHOUT_IS });
        assert.deepEqual([older.status, older.body], [409, { error: 'question_type_unsupported' }]);
        assert.equal((await a.save(autoId, { shortText: 'Draf' })).body.writeVersion, 1);
        const before = await rows(a.attemptId);
        for (const bad of [{ shortText: 'a'.repeat(201) }, { shortText: 'a\nb' }, { shortText: 'a\rb' }, { shortText: 'x\u0001' }, { shortText: '\u007f' }, { shortText: '\u0085' },
            { shortText: 'a\ud800' }, { shortText: 5 }, { shortText: 'x', extra: 1 }, {}]) {
            const r = await a.save(autoId, bad, 1);
            assert.deepEqual([r.status, r.body.error], [400, 'invalid_answer_payload'], JSON.stringify(bad));
        }
        const refused = await a.save(autoId, { shortText: 'Jakarta' }, 1, WITHOUT_IS);
        assert.deepEqual([refused.status, refused.body], [409, { error: 'question_type_unsupported' }]);
        assert.deepEqual(await rows(a.attemptId), before, 'zero mutation');
        assert.equal((await a.save(autoId, { shortText: '  dki\tJAKARTA ' }, 1)).body.writeVersion, 2);
        assert.equal((await a.save(manualId, { shortText: 'Bandung 😀' })).status, 200);
        assert.equal((await a.save(esId, { essayText: 'Karena dekat.' })).status, 200);
        assert.equal((await a.save(pgId, { selectedOptionId: pgCorrect })).status, 200);
        assert.equal((await b.save(autoId, { shortText: 'Jakarta.' })).status, 200);
        assert.equal((await b.save(manualId, { shortText: 'Sementara' })).body.writeVersion, 1);
        assert.equal((await b.save(manualId, { shortText: '' }, 1)).body.writeVersion, 2, 'an empty write');
        const resumed = await a.c.request(`/api/v1/assessment/resume?attemptId=${a.attemptId}&examSessionId=${a.sessionId}`);
        assert.deepEqual(resumed.body.answers.find((x: any) => x.snapshotId === autoId).answerPayload, { shortText: '  dki\tJAKARTA ' }, 'stored exactly as typed');
        assert.deepEqual(resumed.body.answers.find((x: any) => x.snapshotId === manualId).answerPayload, { shortText: 'Bandung 😀' });
        const monitoring = await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`);
        const answered = Object.fromEntries(monitoring.body.participants.map((x: any) => [x.elligbleId, x.answeredCount]));
        assert.deepEqual([answered['siswa.is.a'], answered['siswa.is.b']], [4, 1], 'an empty short answer is not answered');
    });

    await t.test('after submit: the manual item is on the worklist with the essay; the auto item is not gradable', async () => {
        for (const s of [a, b]) assert.equal((await s.c.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        const r = await teacherClient.request(`/api/v1/assessment/teacher-exams/essays?examInstanceId=${exam}`);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual(r.body.questions.map((q: any) => [q.snapshotId, q.no, q.questionType, q.rubric, q.maxScore]),
            [[manualId, 3, 'SHORT_ANSWER', 'Kota di Jawa Barat', '2'], [esId, 4, 'ESSAY', '', '5']]);
        assert.deepEqual(r.body.questions[0].answers, [{ attemptId: a.attemptId, elligbleId: 'siswa.is.a', essayText: 'Bandung 😀', grade: null, history: [] }], 'the empty answer is not listed');
        const autoGrade = await grade(a.attemptId, autoId, '2');
        assert.deepEqual([autoGrade.status, autoGrade.body], [409, { error: 'not_gradable' }]);
        const emptyGrade = await grade(b.attemptId, manualId, '1');
        assert.deepEqual([emptyGrade.status, emptyGrade.body], [409, { error: 'not_gradable' }]);
        const tooHigh = await grade(a.attemptId, manualId, '2,5');
        assert.deepEqual([tooHigh.status, tooHigh.body], [400, { error: 'invalid_score' }]);
    });

    await t.test('auto scoring after normalization; finalization refused until the manual item is graded; final results agree', async () => {
        const provisional = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.deepEqual(provisional.body.scoring, { rule: 'COMPOSITE_PER_ITEM_V1', available: true, questionCount: 4, maxScore: 10, autoScoredCount: 2, essayCount: 2 });
        const byId = (res: any) => Object.fromEntries(res.body.participants.map((p: any) => [p.elligbleId, p.score]));
        assert.deepEqual(byId(provisional)['siswa.is.a'], { correct: 2, incorrect: 0, unanswered: 0, graded: 0, ungraded: 2, rawScore: 3, maxScore: 10, scaledScore: 30 });
        assert.deepEqual(byId(provisional)['siswa.is.b'], { correct: 0, incorrect: 1, unanswered: 3, graded: 0, ungraded: 0, rawScore: 0, maxScore: 10, scaledScore: 0 });
        assert.equal((await act(exam, 'end')).status, 200);
        assert.equal((await grade(a.attemptId, esId, '3,5')).status, 200);
        const refused = await act(exam, 'finalize');
        assert.deepEqual([refused.status, refused.body], [409, { error: 'grading_incomplete', ungraded: 1 }]);
        assert.equal((await grade(a.attemptId, manualId, '1,5')).status, 200);
        const done = await act(exam, 'finalize');
        assert.equal(done.status, 200, JSON.stringify(done.body));
        const fin = (await pool.query('SELECT id, pending_issues FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0];
        assert.deepEqual(fin.pending_issues, []);
        const items = (await pool.query('SELECT item_outcomes FROM secure_assessment_attempt_results WHERE finalization_id=$1 AND exam_attempt_id=$2', [fin.id, a.attemptId])).rows[0].item_outcomes;
        assert.deepEqual(items.map((i: any) => [i.questionSnapshotId, i.ruleId, i.outcome, i.scoreMicro, i.gradeRevision]),
            [[pgId, 'BASELINE_SINGLE_CHOICE_V1', 'CORRECT', 1_000_000, undefined], [autoId, 'SHORT_ANSWER_ACCEPTED_FORMS_V1', 'CORRECT', 2_000_000, undefined],
                [manualId, 'SHORT_ANSWER_ACCEPTED_FORMS_V1', 'GRADED', 1_500_000, 1], [esId, 'ESSAY_HUMAN_GRADED_V1', 'GRADED', 3_500_000, 1]]);
        const final = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.equal(final.body.resultState, 'FINAL');
        assert.deepEqual(byId(final)['siswa.is.a'], { correct: 2, incorrect: 0, unanswered: 0, graded: 2, ungraded: 0, rawScore: 8, maxScore: 10, scaledScore: 80 });
        assert.equal(byId(final)['siswa.is.c'], null, 'absent is not zero');
    });
});
