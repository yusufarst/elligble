import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTeachingContext, createTenant, enrollInTeachingGroup } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { sha256Hex } from '../../src/teacher-exam-import.ts';
import { QUESTIONS_HEADER_V2_TOLERANCE } from '../../src/question-import.ts';

// ASSESS-QUESTION-007 real PostgreSQL oracle (record §4/§7, C03): a teacher imports a 33-column v2
// file with IA (with and without tolerance) and PG rows, previews the key and opens the exam;
// Students answer through HTTP with a client that declares numeric answer: inside the tolerance
// (N1/N2), outside (N3) and empty (N4); refusals (N6) change nothing; an older client is refused
// explicitly; monitoring does not count ""; submit, finalize and results agree.

const ALL = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING,2:ORDERING,2:NUMERIC_ANSWER' };
const WITHOUT_IA = { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING,2:ORDERING' };
const row = (head: string, tolerance = '') => [head, ...Array(22).fill(''), tolerance].join(';');
const FILE = [
    QUESTIONS_HEADER_V2_TOLERANCE.join(';'),
    row('1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1'),
    row('2;IA;Hasil dari 5 dibagi 2 adalah;;;;;;2,50;2', '0,1'),
    row('3;IA;Hasil dari 7 dikurangi 10 adalah;;;;;;-3;1'),
].join('\r\n') + '\r\n';

function wib(minutes: number): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('ASSESS-QUESTION-007 C03 numeric answer end to end through production wiring', { skip: skipWithoutDatabase, timeout: 180000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'IPA');
    const students = [];
    for (const name of ['siswa.ia.a', 'siswa.ia.b', 'siswa.ia.c']) {
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
        questionsCsv: FILE, sourceFileName: 'ia.csv', participantEnrollmentIds: null,
    };
    const act = (examInstanceId: string, action: string) => teacherClient.request('/api/v1/assessment/teacher-exams/transition',
        { method: 'POST', body: { reason: 'Uji isian angka', actionKey: randomUUID(), confirmed: true, examInstanceId, action } });

    const preview = await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', { method: 'POST', body });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.body.problems, []);
    assert.deepEqual(preview.body.questions[1], { line: 3, no: 2, prompt: 'Hasil dari 5 dibagi 2 adalah', options: [], score: 2, type: 'IA', correct: '2,50', correctLetters: [], tolerance: '0,1' });
    assert.equal(preview.body.questions[2].tolerance, '0', 'an empty tolerance is 0');
    assert.equal('tolerance' in preview.body.questions[0], false, 'PG items never carry a tolerance');
    const imported = await teacherClient.request('/api/v1/assessment/teacher-exams/import', { method: 'POST', body: { importKey: randomUUID(), expectedSha256: sha256Hex(FILE), ...body } });
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    const exam: string = imported.body.examInstanceId;
    const snaps = (await pool.query('SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id=$1 ORDER BY display_order', [exam])).rows;
    const [pgId, iaId, negId] = snaps.map(s => s.id as string);
    const pgCorrect = snaps[0].frozen_content.correctOptionId as string;
    assert.deepEqual(snaps[1].frozen_content, { schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt: 'Hasil dari 5 dibagi 2 adalah', expected: '2.5', tolerance: '0.1', maxScore: 2 });
    assert.deepEqual([snaps[2].frozen_content.expected, snaps[2].frozen_content.tolerance], ['-3', '0']);

    await t.test('the teacher preview shows the canonical key; the exam opens', async () => {
        const r = await teacherClient.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${exam}`);
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.questions[1], { snapshotId: iaId, no: 2, prompt: 'Hasil dari 5 dibagi 2 adalah', options: [], correctOptionId: null, maxScore: 2, valid: true,
            questionType: 'NUMERIC_ANSWER', correctOptionIds: null, expected: '2.5', tolerance: '0.1' });
        assert.equal('expected' in r.body.questions[0], false, 'v1 items never carry numeric fields');
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
    const [a, b, c] = [await start(students[0]), await start(students[1]), await start(students[2])];
    const rows = async (attemptId: string) => (await pool.query('SELECT exam_question_snapshot_id, answer_payload, write_version FROM secure_assessment_exam_answers WHERE exam_attempt_id=$1 ORDER BY exam_question_snapshot_id', [attemptId])).rows;
    const answeredCounts = async () => {
        const r = await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        return Object.fromEntries(r.body.participants.map((x: any) => [x.elligbleId, x.answeredCount]));
    };

    await t.test('delivery without the key; N1/N3/N4 saves; N6 refusals and an older client change nothing; monitoring', async () => {
        const del = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: ALL });
        assert.equal(del.status, 200, JSON.stringify(del.body));
        assert.deepEqual(del.body.questions[1], { snapshotId: iaId, schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt: 'Hasil dari 5 dibagi 2 adalah' });
        assert.doesNotMatch(JSON.stringify(del.body), /expected|tolerance|correct/);
        const older = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: WITHOUT_IA });
        assert.deepEqual([older.status, older.body], [409, { error: 'question_type_unsupported' }], 'a client of ASSESS-QUESTION-005 is told explicitly');
        assert.equal((await a.save(iaId, { numericText: '3' })).body.writeVersion, 1);
        const before = await rows(a.attemptId);
        for (const bad of [{ numericText: '1.000,5' }, { numericText: '2e3' }, { numericText: '5 cm' }, { numericText: '+2,5' }, { numericText: '2,' }, { numericText: 'NaN' },
            { numericText: '1'.repeat(31) }, { numericText: 2.5 }, { numericText: '2,5', extra: 1 }, {}]) {
            const r = await a.save(iaId, bad, 1);
            assert.deepEqual([r.status, r.body.error], [400, 'invalid_answer_payload'], JSON.stringify(bad));
        }
        const refused = await a.save(iaId, { numericText: '2,5' }, 1, WITHOUT_IA);
        assert.deepEqual([refused.status, refused.body], [409, { error: 'question_type_unsupported' }]);
        assert.deepEqual(await rows(a.attemptId), before, 'zero mutation');
        assert.equal((await a.save(iaId, { numericText: '2,45' }, 1)).body.writeVersion, 2, 'N2 inside the tolerance, comma as typed');
        assert.equal((await a.save(negId, { numericText: '-3' })).status, 200);
        assert.equal((await a.save(pgId, { selectedOptionId: pgCorrect })).status, 200);
        assert.equal((await b.save(iaId, { numericText: '2.61' })).body.writeVersion, 1, 'N3 outside');
        assert.equal((await c.save(iaId, { numericText: '2,5' })).body.writeVersion, 1);
        assert.equal((await c.save(iaId, { numericText: '' }, 1)).body.writeVersion, 2, 'N4 empty write');
        const resumed = await a.c.request(`/api/v1/assessment/resume?attemptId=${a.attemptId}&examSessionId=${a.sessionId}`);
        assert.deepEqual(resumed.body.answers.find((x: any) => x.snapshotId === iaId).answerPayload, { numericText: '2,45' }, 'stored exactly as typed');
        assert.deepEqual(await answeredCounts(), { 'siswa.ia.a': 3, 'siswa.ia.b': 1, 'siswa.ia.c': 0 });
    });

    await t.test('submit, provisional and final results agree under the composite rule', async () => {
        for (const s of [a, b, c]) assert.equal((await s.c.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        const scores = (r: any) => Object.fromEntries(r.participants.map((x: any) => [x.elligbleId, x.score && [x.score.rawScore, x.score.maxScore, x.score.scaledScore, x.score.correct, x.score.incorrect, x.score.unanswered]]));
        const provisional = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.equal(provisional.body.scoring.rule, 'COMPOSITE_PER_ITEM_V1');
        assert.deepEqual(scores(provisional.body), { 'siswa.ia.a': [4, 4, 100, 3, 0, 0], 'siswa.ia.b': [0, 4, 0, 0, 1, 2], 'siswa.ia.c': [0, 4, 0, 0, 0, 3] });
        assert.equal((await act(exam, 'end')).status, 200);
        assert.equal((await act(exam, 'finalize')).status, 200);
        const fin = (await pool.query('SELECT id, scoring_rule FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0];
        assert.equal(fin.scoring_rule, 'COMPOSITE_PER_ITEM_V1');
        const items = (await pool.query('SELECT item_outcomes FROM secure_assessment_attempt_results WHERE finalization_id=$1 AND exam_attempt_id=$2', [fin.id, b.attemptId])).rows[0].item_outcomes;
        assert.deepEqual(items.map((i: any) => [i.questionSnapshotId, i.ruleId, i.outcome, i.scoreMicro]),
            [[pgId, 'BASELINE_SINGLE_CHOICE_V1', 'UNANSWERED', 0], [iaId, 'NUMERIC_EXACT_DECIMAL_TOLERANCE_V1', 'INCORRECT', 0], [negId, 'NUMERIC_EXACT_DECIMAL_TOLERANCE_V1', 'UNANSWERED', 0]]);
        const final = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.deepEqual(scores(final.body), scores(provisional.body));
    });
});
