import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { addMembership, createPersonWithAccount, createTeachingContext, createTenant, enrollInTeachingGroup } from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { sha256Hex } from '../../src/teacher-exam-import.ts';

// ASSESS-QUESTION-002 real PostgreSQL oracles (record §4/§4A/§7, C03/C05): a teacher imports a
// v2 file (PG + PGK), previews the key set and opens the exam; a Student answers through HTTP;
// refusals change nothing; submit, finalize and results agree; monitoring does not count a
// cleared choice; migration 0060 upgrade, rollback and repeat.

const FILE = [
    'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',
    '1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1',
    '2;PGK;Bilangan prima di bawah 10 adalah;2;4;5;8;9;A,C;2',
].join('\r\n') + '\r\n';

function wib(minutes: number): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('ASSESS-QUESTION-002 C03 multiple response end to end through production wiring', { skip: skipWithoutDatabase, timeout: 180000 }, async t => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    t.after(async () => { await app.close(); await db.close(); });
    const pool = db.pool;
    const tenant = await createTenant(pool);
    const teacher = await createPersonWithAccount(pool);
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Matematika Wajib');
    const students = [];
    for (const name of ['siswa.mr.a', 'siswa.mr.b']) {
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
        questionsCsv: FILE, sourceFileName: 'pgk.csv', participantEnrollmentIds: null,
    };
    const act = (examInstanceId: string, action: string) => teacherClient.request('/api/v1/assessment/teacher-exams/transition',
        { method: 'POST', body: { reason: 'Uji pilihan ganda kompleks', actionKey: randomUUID(), confirmed: true, examInstanceId, action } });

    // Import preview: types, key letters and the v2 template.
    const preview = await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', { method: 'POST', body });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.body.problems, []);
    assert.deepEqual(preview.body.questions.map((q: any) => [q.no, q.type, q.correct, q.correctLetters, q.score]), [[1, 'PG', 'B', ['B'], 1], [2, 'PGK', 'A, C', ['A', 'C'], 2]]);
    const imported = await teacherClient.request('/api/v1/assessment/teacher-exams/import', { method: 'POST', body: { importKey: randomUUID(), expectedSha256: sha256Hex(FILE), ...body } });
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    const exam: string = imported.body.examInstanceId;
    const batch = (await pool.query('SELECT template, question_count FROM secure_assessment_question_import_batches WHERE exam_instance_id=$1', [exam])).rows[0];
    assert.deepEqual(batch, { template: 'elligble-questions-v2', question_count: 2 });
    const snaps = (await pool.query('SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id=$1 ORDER BY display_order', [exam])).rows;
    assert.equal(snaps[0].frozen_content.schemaVersion, 1, 'PG stays v1 content');
    assert.equal(snaps[1].frozen_content.questionType, 'MULTIPLE_RESPONSE');
    const [pgId, mrId] = snaps.map(s => s.id as string);
    const opt = (i: number) => snaps[1].frozen_content.options[i].id as string;
    const pgCorrect = snaps[0].frozen_content.correctOptionId as string;

    await t.test('teacher preview shows the key set; readiness passes and the exam opens', async () => {
        const p = await teacherClient.request(`/api/v1/assessment/teacher-exams/preview?examInstanceId=${exam}`);
        assert.equal(p.status, 200, JSON.stringify(p.body));
        assert.deepEqual(p.body.questions.map((q: any) => [q.questionType, q.valid, q.correctOptionId === null, q.correctOptionIds, q.maxScore]),
            [['MULTIPLE_CHOICE_SINGLE', true, false, null, 1], ['MULTIPLE_RESPONSE', true, true, [opt(0), opt(2)], 2]]);
        assert.equal((await act(exam, 'mark_ready')).status, 200);
        assert.equal((await act(exam, 'activate')).status, 200);
    });

    const start = async (person: { username: string; password: string }) => {
        const c = await loggedIn(person);
        const attemptId: string = (await c.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: exam } })).body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await c.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await c.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const save = (snapshotId: string, answerPayload: unknown, expectedWriteVersion: number | null = null) => c.request('/api/v1/assessment/answer/save',
            { method: 'POST', body: { attemptId, sessionId, snapshotId, answerPayload, clientWriteIdentity: randomUUID(), expectedWriteVersion } });
        return { c, attemptId, sessionId, save };
    };
    const a = await start(students[0]);
    const b = await start(students[1]);
    const rows = async (attemptId: string) => (await pool.query('SELECT exam_question_snapshot_id, answer_payload, write_version FROM secure_assessment_exam_answers WHERE exam_attempt_id=$1 ORDER BY exam_question_snapshot_id', [attemptId])).rows;
    const monitoring = async () => {
        const r = await teacherClient.request(`/api/v1/assessment/exam-monitoring?examInstanceId=${exam}`);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        return r.body;
    };

    await t.test('delivery projects no key; saves follow V1/V2/V6 and refusals V8–V10 change nothing', async () => {
        const d = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`);
        assert.equal(d.status, 200);
        assert.deepEqual(d.body.questions[1], { snapshotId: mrId, schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt: 'Bilangan prima di bawah 10 adalah',
            options: [0, 1, 2, 3, 4].map(i => ({ id: opt(i), content: ['2', '4', '5', '8', '9'][i] })) });
        assert.doesNotMatch(JSON.stringify(d.body), /correct/);
        const old = await a.c.request(`/api/v1/assessment/questions?attemptId=${a.attemptId}`, { headers: { 'X-Question-Types': '1:MULTIPLE_CHOICE_SINGLE' } });
        assert.deepEqual([old.status, old.body], [409, { error: 'question_type_unsupported' }], 'an older client is told explicitly');
        assert.equal((await a.save(mrId, { selectedOptionIds: [opt(2)] })).body.writeVersion, 1);
        const before = await rows(a.attemptId);
        for (const bad of [{ selectedOptionIds: [opt(0), opt(0)] }, { selectedOptionIds: [opt(0), 'opt_zz'] }, { selectedOptionIds: opt(0) }, { selectedOptionId: opt(0) },
            { selectedOptionIds: [opt(0)], extra: 1 }, { selectedOptionIds: [1] }]) {
            const r = await a.save(mrId, bad, 1);
            assert.deepEqual([r.status, r.body.error], [400, 'invalid_answer_payload'], JSON.stringify(bad));
        }
        assert.deepEqual(await rows(a.attemptId), before, 'zero mutation');
        assert.equal((await a.save(mrId, { selectedOptionIds: [opt(2), opt(0)] }, 1)).body.writeVersion, 2, 'V2 order-independent');
        assert.equal((await a.save(pgId, { selectedOptionId: pgCorrect })).status, 200);
        // B clears its choice: an accepted versioned write that is not answered.
        assert.equal((await b.save(mrId, { selectedOptionIds: [opt(1)] })).body.writeVersion, 1);
        assert.equal((await b.save(mrId, { selectedOptionIds: [] }, 1)).body.writeVersion, 2, 'V6 empty write');
        const resumed = await b.c.request(`/api/v1/assessment/resume?attemptId=${b.attemptId}&examSessionId=${b.sessionId}`);
        assert.deepEqual(resumed.body.answers.map((x: any) => [x.snapshotId, x.answerPayload, x.writeVersion]), [[mrId, { selectedOptionIds: [] }, 2]]);
        const m = await monitoring();
        const answered = Object.fromEntries((m.participants ?? m.rows ?? []).map((p: any) => [p.elligbleId, p.answeredCount ?? p.answered]));
        assert.equal(answered['siswa.mr.a'], 2);
        assert.equal(answered['siswa.mr.b'], 0, 'a cleared choice is not answered (O02-2)');
    });

    await t.test('submit, provisional and final results agree under the composite rule', async () => {
        for (const s of [a, b]) assert.equal((await s.c.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId: s.attemptId } })).status, 200);
        const provisional = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.equal(provisional.status, 200);
        assert.equal(provisional.body.scoring.rule, 'COMPOSITE_PER_ITEM_V1');
        const scores = (body: any) => Object.fromEntries(body.results.map((r: any) => [r.elligbleId, r.score && [r.score.rawScore, r.score.maxScore, r.score.scaledScore, r.score.correct, r.score.unanswered]]));
        assert.deepEqual(scores(provisional.body), { 'siswa.mr.a': [3, 3, 100, 2, 0], 'siswa.mr.b': [0, 3, 0, 0, 2] });
        assert.equal((await act(exam, 'end')).status, 200);
        assert.equal((await act(exam, 'finalize')).status, 200);
        const fin = (await pool.query('SELECT id, scoring_rule, max_score_micro FROM secure_assessment_exam_result_finalizations WHERE exam_instance_id=$1', [exam])).rows[0];
        assert.deepEqual([fin.scoring_rule, Number(fin.max_score_micro)], ['COMPOSITE_PER_ITEM_V1', 3_000_000]);
        const items = (await pool.query('SELECT item_outcomes FROM secure_assessment_attempt_results WHERE finalization_id=$1 AND exam_attempt_id=$2', [fin.id, a.attemptId])).rows[0].item_outcomes;
        assert.deepEqual(items.map((i: any) => [i.questionSnapshotId, i.ruleId, i.outcome, i.scoreMicro]), [[pgId, 'BASELINE_SINGLE_CHOICE_V1', 'CORRECT', 1_000_000], [mrId, 'MULTIPLE_RESPONSE_EXACT_SET_V1', 'CORRECT', 2_000_000]]);
        const final = await teacherClient.request(`/api/v1/assessment/teacher-exams/results?examInstanceId=${exam}`);
        assert.equal(final.body.scoring.rule, 'COMPOSITE_PER_ITEM_V1');
        assert.deepEqual(scores(final.body), scores(provisional.body));
    });
});

test('ASSESS-QUESTION-002 C05 migration 0060 upgrade, rollback and repeat', { skip: skipWithoutDatabase }, async t => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const c = await db.pool.connect();
    try {
        const dir = new URL('../../../../database/migrations/', import.meta.url);
        for (const file of (await readdir(dir)).filter(n => /^\d{4}.*\.sql$/.test(n) && n < '0060').sort()) await c.query(await readFile(new URL(file, dir), 'utf8'));
        const constraint = async () => (await c.query(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname='ck_sa_question_import_batch_template'`)).rows[0].d as string;
        const before = await constraint();
        assert.match(before, /elligble-questions-v1/);
        assert.doesNotMatch(before, /v2/);
        const sql = await readFile(new URL('0060_secure_assessment_question_import_template_v2.sql', dir), 'utf8');
        const failing = sql.replace("INSERT INTO elligble_migration_history (migration_id) VALUES ('0060_secure_assessment_question_import_template_v2');", "RAISE EXCEPTION 'synthetic migration rollback';");
        assert.notEqual(failing, sql);
        await assert.rejects(c.query(failing), /synthetic migration rollback/); await c.query('ROLLBACK');
        assert.equal(await constraint(), before, 'the failed migration left the constraint as it was');
        await c.query(sql); await c.query(sql);
        const after = await constraint();
        assert.match(after, /elligble-questions-v1/);
        assert.match(after, /elligble-questions-v2/);
        assert.equal((await c.query(`SELECT count(*)::int AS n FROM elligble_migration_history WHERE migration_id='0060_secure_assessment_question_import_template_v2'`)).rows[0].n, 1);
    } finally { c.release(); }
});
