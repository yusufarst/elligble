import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, addParticipant, addProctorAssignment, addQuestionSnapshots, createAttemptWithTimer, createExamInstance, createPersonWithAccount,
    createTeachingContext, createTenant, enrollInTeachingGroup,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { sha256Hex } from '../../src/teacher-exam-import.ts';
import { QUESTIONS_HEADER_V2_RUBRIC } from '../../src/question-import.ts';

// ASSESS-QUESTION-008 real PostgreSQL oracle (record §4/§5/§7, C03): a teacher imports a 34-column
// v2 file with PG and ES rows (one with a rubric), previews it and opens the exam; Students write
// essays through HTTP with a client that declares essay; refusals change nothing; an older client
// is refused explicitly; monitoring does not count ""; after submit the managing teacher reads the
// worklist and grades, revises and meets stale and refused writes; nobody else can read or grade;
// finalization is refused while an answered essay is ungraded, then freezes the grades with their
// revision; provisional and final results follow D1; the grade/finalize race stays consistent; and
// migration 0061 upgrades a populated database, rolls back, repeats and stays append-only.

const ALL = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING,2:ORDERING,2:NUMERIC_ANSWER,2:ESSAY' };
const WITHOUT_ES = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING,2:ORDERING,2:NUMERIC_ANSWER' };
const row = (head: string, rubric = '') => [head, ...Array(23).fill(''), rubric].join(';');
const FILE = [
    QUESTIONS_HEADER_V2_RUBRIC.join(';'),
    row('1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1'),
    row('2;ES;Jelaskan proses fotosintesis;;;;;;;5', 'Sebutkan bahan dan hasilnya'),
    row('3;ES;Tulis pendapatmu tentang hutan;;;;;;;2'),
].join('\r\n') + '\r\n';
const TEXT_A = 'Baris pertama\r\nBaris kedua\n\tberindentasi 😀 selesai.';

function wib(minutes: number): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('ASSESS-QUESTION-008 C03 essay and human grading end to end through production wiring', { skip: skipWithoutDatabase, timeout: 240000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'IPA');
    const students = [];
    for (const name of ['siswa.es.b', 'siswa.es.a', 'siswa.es.d', 'siswa.es.c']) {
        const person = await createPersonWithAccount(pool, name);
        await enrollInTeachingGroup(pool, tenant, teaching, await addMembership(pool, tenant, person.personId));
        students.push(person);
    }
    const otherTeacher = await createPersonWithAccount(pool);
    await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'IPS');
    const proctor = await createPersonWithAccount(pool);
    await addMembership(pool, tenant, proctor.personId);
    const otherTenant = await createTenant(pool);
    const foreignTeacher = await createPersonWithAccount(pool);
    await createTeachingContext(pool, otherTenant, await addMembership(pool, otherTenant, foreignTeacher.personId), 'IPA');

    const loggedIn = async (person: { username: string; password: string }, tenantId = tenant) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenantId;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const body = {
        teachingAssignmentId: teaching.teachingAssignmentId, assessmentTypeId: teaching.assessmentTypeId,
        windowStartsAt: wib(-2), windowEndsAt: wib(120), durationMinutes: 60, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
        questionsCsv: FILE, sourceFileName: 'esai.csv', participantEnrollmentIds: null,
    };
    const act = (examInstanceId: string, action: string) => teacherClient.request('/api/v1/assessment/teacher-exams/transition',
        { method: 'POST', body: { reason: 'Uji esai', actionKey: randomUUID(), confirmed: true, examInstanceId, action } });

    const preview = await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', { method: 'POST', body });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.body.problems, []);
    assert.deepEqual(preview.body.questions[1], { line: 3, no: 2, prompt: 'Jelaskan proses fotosintesis', options: [], score: 5, type: 'ES', correct: '', correctLetters: [], rubric: 'Sebutkan bahan dan hasilnya' });
    assert.equal(preview.body.questions[2].rubric, '');
    assert.equal('rubric' in preview.body.questions[0], false, 'PG items never carry a rubric');
    const imported = await teacherClient.request('/api/v1/assessment/teacher-exams/import', { method: 'POST', body: { importKey: randomUUID(), expectedSha256: sha256Hex(FILE), ...body } });
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    const exam: string = imported.body.examInstanceId;
    const snaps = (await pool.query('SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id=$1 ORDER BY display_order', [exam])).rows;
    const [pgId, es1, es2] = snaps.map(s => s.id as string);
    const pgCorrect = snaps[0].frozen_content.correctOptionId as string;
    const pgWrong = (snaps[0].frozen_content.options as Array<{ id: string }>).find(o => o.id !== pgCorrect)!.id;
    assert.deepEqual(snaps[1].frozen_content, { schemaVersion: 2, questionType: 'ESSAY', prompt: 'Jelaskan proses fotosintesis', rubric: 'Sebutkan bahan dan hasilnya', maxScore: 5 });
    assert.deepEqual(snaps[2].frozen_content.rubric, '');

    // An exam of the same teacher with a v1 question and a submitted attempt: foreign objects for grading.
    const otherExam = await createExamInstance(pool, tenant, teaching);
    const [foreignSnapshot] = await addQuestionSnapshots(pool, tenant, otherExam, 1);
    const foreignAttempt = await createAttemptWithTimer(pool, tenant, await addParticipant(pool, tenant, otherExam, students[0].personId));
    await pool.query("INSERT INTO secure_assessment_exam_submissions (tenant_id, exam_attempt_id, finalization_source) VALUES ($1, $2, 'STUDENT_SUBMIT')", [tenant, foreignAttempt]);

    await t.test('the teacher preview shows the rubric; the exam opens; the readiness card counts essays', async () => {
        const r = await teacherClient.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${exam}`);
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.questions[1], { snapshotId: es1, no: 2, prompt: 'Jelaskan proses fotosintesis', options: [], correctOptionId: null, maxScore: 5, valid: true,
            questionType: 'ESSAY', correctOptionIds: null, rubric: 'Sebutkan bahan dan hasilnya' });
        assert.equal('rubric' in r.body.questions[0], false);
        assert.equal((await act(exam, 'mark_ready')).status, 200);
        assert.equal((await act(exam, 'activate')).status, 200);
        const cards = await teacherClient.request('/api/v1/assessment/teacher-readiness');
        assert.equal(cards.status, 200, JSON.stringify(cards.body));
        assert.equal(cards.body.exams.find((e: any) => e.examInstanceId === exam).essayCount, 2);
        assert.equal(cards.body.exams.find((e: any) => e.examInstanceId === otherExam)?.essayCount, 0);
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
    const b = await start(students[0]);
    const a = await start(students[1]);
    const d = await start(students[2]);
    const rows = async (attemptId: string) => (await pool.query('SELECT exam_question_snapshot_id, answer_payload, write_version FROM secure_assessment_exam_answers WHERE exam_attempt_id=$1 ORDER BY exam_question_snapshot_id', [attemptId])).rows;
    const grade = (client: BrowserLikeClient, attemptId: string, snapshotId: string, score: unknown, expectedRevision: number | null = null, examInstanceId = exam) =>
        client.request('/api/v1/assessment/teacher-exams/essays/grade', { method: 'POST', body: { examInstanceId, attemptId, snapshotId, score, expectedRevision } });
    const worklist = (client: BrowserLikeClient, examInstanceId = exam) => client.request(`/api/v1/assessment/teacher-exams/essays?examInstanceId=${examInstanceId}`);
    const revisions = async () => (await pool.query('SELECT count(*)::int AS n FROM secure_assessment_essay_grade_revisions')).rows[0].n as number;

    await t.test('delivery without the rubric; saves keep the text exactly; refusals and an older client change nothing; monitoring', async () => {
        const del = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: ALL });
        assert.equal(del.status, 200, JSON.stringify(del.body));
        assert.deepEqual(del.body.questions[1], { snapshotId: es1, schemaVersion: 2, questionType: 'ESSAY', prompt: 'Jelaskan proses fotosintesis' });
        assert.doesNotMatch(JSON.stringify(del.body), /rubric|Sebutkan bahan|maxScore|score/i);
        const older = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: WITHOUT_ES });
        assert.deepEqual([older.status, older.body], [409, { error: 'question_type_unsupported' }], 'a client of ASSESS-QUESTION-007 is told explicitly');
        assert.equal((await a.save(es1, { essayText: 'Draf awal' })).body.writeVersion, 1);
        const before = await rows(a.attemptId);
        for (const bad of [{ essayText: 'a'.repeat(5001) }, { essayText: 'x\u0001' }, { essayText: '\u007f' }, { essayText: '\u0085' }, { essayText: 'a\ud800' },
            { essayText: 5 }, { essayText: 'x', extra: 1 }, {}]) {
            const r = await a.save(es1, bad, 1);
            assert.deepEqual([r.status, r.body.error], [400, 'invalid_answer_payload'], JSON.stringify(bad));
        }
        const refused = await a.save(es1, { essayText: 'Jawaban' }, 1, WITHOUT_ES);
        assert.deepEqual([refused.status, refused.body], [409, { error: 'question_type_unsupported' }]);
        assert.deepEqual(await rows(a.attemptId), before, 'zero mutation');
        assert.equal((await a.save(es1, { essayText: TEXT_A }, 1)).body.writeVersion, 2);
        assert.equal((await a.save(es2, { essayText: '😀'.repeat(5000) })).status, 200, '5,000 astral code points are accepted');
        assert.equal((await a.save(pgId, { selectedOptionId: pgCorrect })).status, 200);
        assert.equal((await b.save(es1, { essayText: 'Tumbuhan membuat makanan.' })).status, 200);
        assert.equal((await b.save(es2, { essayText: 'Sementara' })).body.writeVersion, 1);
        assert.equal((await b.save(es2, { essayText: '' }, 1)).body.writeVersion, 2, 'an empty write');
        assert.equal((await b.save(pgId, { selectedOptionId: pgWrong })).status, 200);
        assert.equal((await d.save(pgId, { selectedOptionId: pgCorrect })).status, 200);
        const resumed = await a.c.request(`/api/v1/assessment/resume?attemptId=${a.attemptId}&examSessionId=${a.sessionId}`);
        assert.deepEqual(resumed.body.answers.find((x: any) => x.snapshotId === es1).answerPayload, { essayText: TEXT_A }, 'CRLF, LF, tab and astral characters survive exactly');
        assert.doesNotMatch(JSON.stringify(resumed.body), /rubric|Sebutkan bahan/);
        const monitoring = await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`);
        const answered = Object.fromEntries(monitoring.body.participants.map((x: any) => [x.elligbleId, x.answeredCount]));
        assert.deepEqual([answered['siswa.es.a'], answered['siswa.es.b'], answered['siswa.es.d']], [3, 2, 1], 'an empty essay is not answered');
    });

    await t.test('an unsubmitted attempt is not gradable and not listed', async () => {
        const n = await revisions();
        assert.deepEqual([(await grade(teacherClient, a.attemptId, es1, '3')).status, (await grade(teacherClient, a.attemptId, es1, '3')).body.error], [409, 'not_gradable']);
        assert.deepEqual((await worklist(teacherClient)).body.questions.map((q: any) => q.answers.length), [0, 0]);
        assert.equal(await revisions(), n);
    });

    await t.test('after submit the worklist lists the first submitted attempts with non-empty essays, by ELLIGBLE ID', async () => {
        for (const s of [a, b]) assert.equal((await s.c.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        const r = await worklist(teacherClient);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual(r.body.exam, { examInstanceId: exam, lifecycleState: 'ACTIVE' });
        assert.deepEqual(r.body.questions.map((q: any) => [q.snapshotId, q.no, q.prompt, q.rubric, q.maxScore]),
            [[es1, 2, 'Jelaskan proses fotosintesis', 'Sebutkan bahan dan hasilnya', '5'], [es2, 3, 'Tulis pendapatmu tentang hutan', '', '2']]);
        assert.deepEqual(r.body.questions[0].answers, [
            { attemptId: a.attemptId, elligbleId: 'siswa.es.a', essayText: TEXT_A, grade: null, history: [] },
            { attemptId: b.attemptId, elligbleId: 'siswa.es.b', essayText: 'Tumbuhan membuat makanan.', grade: null, history: [] },
        ]);
        assert.deepEqual(r.body.questions[1].answers.map((x: any) => x.elligbleId), ['siswa.es.a'], 'an empty essay is not listed');
    });

    await t.test('unauthorized readers and graders are refused uniformly with zero mutation', async () => {
        const n = await revisions();
        const clients = [await loggedIn(otherTeacher), await loggedIn(proctor), b.c, await loggedIn(foreignTeacher, otherTenant)];
        await addProctorAssignment(pool, tenant, exam, proctor.personId);
        for (const c of clients) {
            const read = await worklist(c);
            assert.deepEqual([read.status, read.body], [403, { error: 'forbidden' }]);
            const write = await grade(c, a.attemptId, es1, '3');
            assert.deepEqual([write.status, write.body], [403, { error: 'forbidden' }]);
        }
        assert.equal(await revisions(), n);
    });

    let firstGrade = '';
    await t.test('grade, revise, stale and refused writes (E-5, E-6)', async () => {
        const n = await revisions();
        const refusals: Array<[unknown, number, unknown, string?]> = [
            [{ score: '-1' }, 400, { error: 'invalid_score' }], [{ score: '5,01' }, 400, { error: 'invalid_score' }], [{ score: '2,555' }, 400, { error: 'invalid_score' }],
            [{ score: 'abc' }, 400, { error: 'invalid_score' }], [{ score: 3 }, 400, { error: 'invalid_request' }],
            [{ attemptId: b.attemptId, snapshotId: es2 }, 409, { error: 'not_gradable' }, 'an empty answer'],
            [{ snapshotId: pgId }, 409, { error: 'not_gradable' }, 'a non-essay snapshot'],
            [{ snapshotId: foreignSnapshot }, 409, { error: 'not_gradable' }, 'a snapshot of another exam'],
            [{ attemptId: foreignAttempt }, 409, { error: 'not_gradable' }, 'an attempt of another exam'],
            [{ attemptId: randomUUID() }, 409, { error: 'not_gradable' }],
        ];
        for (const [patch, status, expected, label] of refusals) {
            const p = patch as Record<string, unknown>;
            const r = await grade(teacherClient, (p.attemptId as string) ?? a.attemptId, (p.snapshotId as string) ?? es1, 'score' in p ? p.score : '3');
            assert.deepEqual([r.status, r.body], [status, expected], label ?? JSON.stringify(patch));
        }
        const extra = await teacherClient.request('/api/v1/assessment/teacher-exams/essays/grade', { method: 'POST', body: { examInstanceId: exam, attemptId: a.attemptId, snapshotId: es1, score: '3', expectedRevision: null, gradedBy: randomUUID() } });
        assert.deepEqual([extra.status, extra.body], [400, { error: 'invalid_request' }]);
        assert.equal(await revisions(), n, 'zero mutation');

        const first = await grade(teacherClient, a.attemptId, es1, '3');
        assert.equal(first.status, 200, JSON.stringify(first.body));
        assert.deepEqual([first.body.revision, first.body.score], [1, '3']);
        firstGrade = first.body.gradedAt;
        const stale = await grade(teacherClient, a.attemptId, es1, '4');
        assert.deepEqual([stale.status, stale.body], [409, { error: 'stale_grade', current: 1 }]);
        const wrong = await grade(teacherClient, a.attemptId, es1, '4', 2);
        assert.deepEqual([wrong.status, wrong.body], [409, { error: 'stale_grade', current: 1 }]);
        const second = await grade(teacherClient, a.attemptId, es1, '4', 1);
        assert.deepEqual([second.status, second.body.revision, second.body.score], [200, 2, '4']);
        const stored = (await pool.query('SELECT revision, score_micro, graded_by_person_id FROM secure_assessment_essay_grade_revisions WHERE exam_attempt_id=$1 ORDER BY revision', [a.attemptId])).rows;
        assert.deepEqual(stored.map(r => [r.revision, Number(r.score_micro), r.graded_by_person_id]), [[1, 3_000_000, teacher.personId], [2, 4_000_000, teacher.personId]]);
        const r = await worklist(teacherClient);
        const entry = r.body.questions[0].answers[0];
        assert.deepEqual([entry.grade.score, entry.grade.revision, entry.history.map((h: any) => h.score)], ['4', 2, ['3', '4']]);
        assert.equal(entry.history[0].gradedAt, firstGrade);
    });

    await t.test('two writes with the same expected revision: exactly one succeeds', async () => {
        const both = await Promise.all([grade(teacherClient, b.attemptId, es1, '2'), grade(teacherClient, b.attemptId, es1, '1,5')]);
        assert.deepEqual(both.map(r => r.status).sort(), [200, 409]);
        assert.deepEqual(both.find(r => r.status === 409)!.body, { error: 'stale_grade', current: 1 });
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_essay_grade_revisions WHERE exam_attempt_id=$1', [b.attemptId])).rows[0].n, 1);
    });

    await t.test('provisional results follow D1; finalization is refused while an answered essay is ungraded', async () => {
        const res = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual(res.body.scoring, { rule: 'COMPOSITE_PER_ITEM_V1', available: true, questionCount: 3, maxScore: 8, autoScoredCount: 1, essayCount: 2 });
        const byId = Object.fromEntries(res.body.participants.map((p: any) => [p.elligbleId, p.score]));
        assert.deepEqual(byId['siswa.es.a'], { correct: 1, incorrect: 0, unanswered: 0, graded: 1, ungraded: 1, rawScore: 5, maxScore: 8, scaledScore: 62.5 });
        assert.equal(byId['siswa.es.b'].correct, 0);
        assert.deepEqual([byId['siswa.es.b'].incorrect, byId['siswa.es.b'].unanswered, byId['siswa.es.b'].graded, byId['siswa.es.b'].ungraded], [1, 1, 1, 0]);
        assert.equal(byId['siswa.es.d'], null, 'still in progress');
        assert.equal((await d.c.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: d.attemptId } })).status, 200);
        assert.equal((await act(exam, 'end')).status, 200);
        const refused = await act(exam, 'finalize');
        assert.deepEqual([refused.status, refused.body], [409, { error: 'grading_incomplete', ungraded: 1 }]);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0].n, 0);
        assert.equal((await pool.query('SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE id=$1', [exam])).rows[0].lifecycle_state, 'ENDED');
        assert.equal((await worklist(teacherClient)).body.exam.lifecycleState, 'ENDED');
        assert.equal((await grade(teacherClient, a.attemptId, es2, '1,5')).status, 200, 'grading stays open while ENDED');
    });

    await t.test('a grade racing finalization either lands before it or is refused; the frozen revision matches', async () => {
        const [fin, late] = await Promise.all([act(exam, 'finalize'), grade(teacherClient, a.attemptId, es1, '4,5', 2)]);
        assert.equal(fin.status, 200, JSON.stringify(fin.body));
        assert.ok(late.status === 200 || (late.status === 409 && late.body.error === 'invalid_state'), JSON.stringify(late.body));
        const finalization = (await pool.query('SELECT id, pending_issues FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0];
        assert.deepEqual(finalization.pending_issues, []);
        const items = (await pool.query('SELECT item_outcomes FROM secure_assessment_attempt_results WHERE finalization_id=$1 AND exam_attempt_id=$2', [finalization.id, a.attemptId])).rows[0].item_outcomes;
        const current = (await pool.query(`SELECT exam_question_snapshot_id AS s, max(revision)::int AS r FROM secure_assessment_essay_grade_revisions WHERE exam_attempt_id=$1 GROUP BY 1`, [a.attemptId])).rows;
        const latest = Object.fromEntries(current.map(r => [r.s, r.r]));
        assert.deepEqual(items.map((i: any) => [i.questionSnapshotId, i.ruleId, i.outcome, i.gradeRevision]),
            [[pgId, 'BASELINE_SINGLE_CHOICE_V1', 'CORRECT', undefined], [es1, 'ESSAY_HUMAN_GRADED_V1', 'GRADED', latest[es1]], [es2, 'ESSAY_HUMAN_GRADED_V1', 'GRADED', 1]]);
        assert.equal(items[1].scoreMicro, late.status === 200 ? 4_500_000 : 4_000_000);
    });

    await t.test('once FINALIZED: read-only worklist, grades refused, final results agree with D1', async () => {
        const r = await worklist(teacherClient);
        assert.deepEqual([r.status, r.body.exam.lifecycleState], [200, 'FINALIZED']);
        const n = await revisions();
        const refused = await grade(teacherClient, b.attemptId, es1, '2', 1);
        assert.deepEqual([refused.status, refused.body], [409, { error: 'invalid_state', currentState: 'FINALIZED' }]);
        assert.equal(await revisions(), n);
        await assert.rejects(pool.query('UPDATE secure_assessment_essay_grade_revisions SET score_micro = 0'), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_essay_grade_revisions'), /append-only/);
        const final = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.equal(final.body.resultState, 'FINAL');
        assert.deepEqual([final.body.scoring.autoScoredCount, final.body.scoring.essayCount], [1, 2]);
        const byId = Object.fromEntries(final.body.participants.map((p: any) => [p.elligbleId, p.score]));
        const aRaw = byId['siswa.es.a'].rawScore;
        assert.ok(aRaw === 6.5 || aRaw === 7, String(aRaw));
        assert.deepEqual([byId['siswa.es.a'].correct, byId['siswa.es.a'].graded, byId['siswa.es.a'].ungraded], [1, 2, 0]);
        assert.deepEqual(byId['siswa.es.d'], { correct: 1, incorrect: 0, unanswered: 2, graded: 0, ungraded: 0, rawScore: 1, maxScore: 8, scaledScore: 12.5 });
        assert.equal(byId['siswa.es.c'], null, 'absent is not zero');
    });
});

test('ASSESS-QUESTION-008 C03 migration 0061 upgrade on a populated database, rollback and repeat', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const c = await db.pool.connect();
    try {
        const dir = new URL('../../../../database/migrations/', import.meta.url);
        for (const file of (await readdir(dir)).filter(n => /^\d{4}.*\.sql$/.test(n) && n < '0061').sort()) await c.query(await readFile(new URL(file, dir), 'utf8'));
        // A populated database: an exam with a submitted attempt and an answer.
        const tenant = await createTenant(db.pool);
        const teacher = await createPersonWithAccount(db.pool);
        const teaching = await createTeachingContext(db.pool, tenant, await addMembership(db.pool, tenant, teacher.personId), 'IPA');
        const student = await createPersonWithAccount(db.pool);
        const exam = await createExamInstance(db.pool, tenant, teaching);
        const [snapshot] = await addQuestionSnapshots(db.pool, tenant, exam, 1);
        const attempt = await createAttemptWithTimer(db.pool, tenant, await addParticipant(db.pool, tenant, exam, student.personId));
        await c.query('INSERT INTO secure_assessment_exam_answers (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload) VALUES ($1, $2, $3, $4)',
            [tenant, attempt, snapshot, JSON.stringify({ selectedOptionId: 'B' })]);
        const table = async () => (await c.query("SELECT to_regclass('public.secure_assessment_essay_grade_revisions') AS t")).rows[0].t;
        assert.equal(await table(), null);
        const sql = await readFile(new URL('0061_secure_assessment_essay_grades.sql', dir), 'utf8');
        const failing = sql.replace("INSERT INTO elligble_migration_history (migration_id) VALUES ('0061_secure_assessment_essay_grades');", "RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing, sql);
        await assert.rejects(c.query(failing), /synthetic migration rollback/); await c.query('ROLLBACK');
        assert.equal(await table(), null, 'the failed migration left nothing behind');
        await c.query(sql); await c.query(sql);
        assert.equal((await c.query("SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id='0061_secure_assessment_essay_grades'")).rows[0].n, 1);
        assert.equal((await c.query('SELECT count(*)::int AS n FROM secure_assessment_exam_answers')).rows[0].n, 1, 'existing answers are untouched');
        const insert = (revision: number, score: number, att = attempt) => c.query(
            'INSERT INTO secure_assessment_essay_grade_revisions (tenant_id, exam_attempt_id, exam_question_snapshot_id, revision, score_micro, graded_by_person_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [tenant, att, snapshot, revision, score, teacher.personId]);
        await insert(1, 1_000_000);
        await assert.rejects(insert(1, 2_000_000), /uq_sa_essay_grade_revision/);
        await assert.rejects(insert(0, 1), /ck_sa_essay_grade_revision/);
        await assert.rejects(insert(2, -1), /ck_sa_essay_grade_score/);
        await assert.rejects(insert(2, 1, randomUUID()), /fk_sa_essay_grade_answer/, 'a grade always belongs to an existing answer');
        await assert.rejects(c.query('UPDATE secure_assessment_essay_grade_revisions SET score_micro = 0'), /append-only/);
        await assert.rejects(c.query('DELETE FROM secure_assessment_essay_grade_revisions'), /append-only/);
        await assert.rejects(c.query('DELETE FROM secure_assessment_exam_answers'), /fk_sa_essay_grade_answer/, 'ON DELETE RESTRICT');
    } finally { c.release(); }
});
