import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import {
    addMembership, createPersonWithAccount, createTeachingContext, createTenant, enrollInTeachingGroup,
} from '../support/fixtures.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';
import { sha256Hex } from '../../src/teacher-exam-import.ts';

// A teacher schedules an exam from a question file against real PostgreSQL (ASSESS-TEACHER-001;
// D04.4-26A/26C, D04.3-61..66, D04.4-03..05, D04.2-36..39): only for their own teaching
// assignment and its class, previewed without writing anything, confirmed once per import
// key, with the batch and source lines kept, participants chosen from the enrolled class,
// a schedule clash refused, and the result an ordinary scheduled exam the teacher can run.

const FILE = [
    'no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score',
    '1,Ibu kota Indonesia adalah,Bandung,Jakarta,Surabaya,Medan,Makassar,B,2',
    '2,"Hasil dari 7 × 8 adalah",54,56,58,64,72,b,1',
    '3,"Kata ""cepat"" termasuk",kata benda,kata kerja,kata sifat,kata keterangan,kata ganti,C,"1,5"',
].join('\n') + '\n';

/** Wall-clock date and time in WIB, `minutes` from now. */
function wib(minutes: number): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('teacher question import and scheduling (real PostgreSQL, production wiring)', { skip: skipWithoutDatabase }, async (t) => {
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
    const teaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, teacher.personId), 'Matematika Wajib');
    const otherTeaching = await createTeachingContext(pool, tenant, await addMembership(pool, tenant, otherTeacher.personId), 'Kimia');

    const students: Array<{ username: string; personId: string; enrollmentId: string; password: string }> = [];
    for (const name of ['siswa.c', 'siswa.a', 'siswa.b']) {
        const person = await createPersonWithAccount(pool, name);
        const enrollmentId = await enrollInTeachingGroup(pool, tenant, teaching, await addMembership(pool, tenant, person.personId));
        students.push({ ...person, enrollmentId });
    }
    // Left the class before any exam day: not a participant.
    const left = await createPersonWithAccount(pool, 'siswa.pindah');
    await enrollInTeachingGroup(pool, tenant, teaching, await addMembership(pool, tenant, left.personId), { endDate: '2026-07-15' });
    // Another teacher's class.
    const elsewhere = await createPersonWithAccount(pool, 'siswa.lain');
    await enrollInTeachingGroup(pool, tenant, otherTeaching, await addMembership(pool, tenant, elsewhere.personId));
    const byName = (name: string) => students.find(s => s.username === name)!;

    const loggedIn = async (person: { username: string; password: string }) => {
        const c = new BrowserLikeClient(app.baseUrl);
        assert.equal((await c.login(person.username, person.password)).status, 200);
        c.tenantId = tenant;
        return c;
    };
    const teacherClient = await loggedIn(teacher);
    const day = wib(30 * 24 * 60).slice(0, 10);
    const request = (overrides: Record<string, unknown> = {}) => ({
        teachingAssignmentId: teaching.teachingAssignmentId,
        assessmentTypeId: teaching.assessmentTypeId,
        windowStartsAt: `${day}T08:00`,
        windowEndsAt: `${day}T10:00`,
        durationMinutes: 90,
        latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
        questionsCsv: FILE,
        sourceFileName: 'C:\\Guru\\ulangan-bab-3.csv',
        participantEnrollmentIds: null,
        ...overrides,
    });
    const preview = (c: BrowserLikeClient, overrides: Record<string, unknown> = {}) =>
        c.request('/api/v1/assessment/teacher-exams/import/preview', { method: 'POST', body: request(overrides) });
    const confirm = (c: BrowserLikeClient, overrides: Record<string, unknown> = {}) => {
        const body = request(overrides);
        return c.request('/api/v1/assessment/teacher-exams/import', {
            method: 'POST',
            body: { importKey: randomUUID(), expectedSha256: sha256Hex(body.questionsCsv as string), ...body },
        });
    };
    const counts = async () => (await pool.query(
        `SELECT (SELECT count(*)::int FROM secure_assessment_exam_instances) AS exams,
                (SELECT count(*)::int FROM secure_assessment_exam_question_snapshots) AS snapshots,
                (SELECT count(*)::int FROM secure_assessment_exam_participants) AS participants,
                (SELECT count(*)::int FROM secure_assessment_question_import_batches) AS batches,
                (SELECT count(*)::int FROM secure_assessment_exam_lifecycle_events) AS events`
    )).rows[0];

    await t.test('the teacher sees only their own classes, the school types and the school time zone', async () => {
        const res = await teacherClient.request('/api/v1/assessment/teacher-exams/setup');
        assert.equal(res.status, 200);
        assert.equal(res.body.timeZone, 'Asia/Jakarta');
        assert.deepEqual(res.body.teachingAssignments, [{
            teachingAssignmentId: teaching.teachingAssignmentId, subjectLabel: 'Matematika Wajib', groupLabel: 'X-1', periodLabel: 'Semester Ganjil',
        }]);
        assert.ok(res.body.assessmentTypes.some((type: { assessmentTypeId: string }) => type.assessmentTypeId === teaching.assessmentTypeId));
        assert.deepEqual(res.body.limits, { maxQuestions: 200, maxQuestionScore: 1000, maxFileCharacters: 524288, maxDurationMinutes: 1440 });
        const student = await loggedIn(byName('siswa.a'));
        assert.equal((await student.request('/api/v1/assessment/teacher-exams/setup')).status, 403);
    });

    await t.test('the preview shows questions, participants and the school-time window, and writes nothing', async () => {
        const before = await counts();
        const res = await preview(teacherClient);
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.problems, []);
        assert.equal(res.body.sourceSha256, sha256Hex(FILE));
        assert.deepEqual(res.body.questions.map((q: { no: number; correct: string; score: number; line: number }) => [q.no, q.correct, q.score, q.line]),
            [[1, 'B', 2, 2], [2, 'B', 1, 3], [3, 'C', 1.5, 4]]);
        assert.equal(res.body.questions[2].prompt, 'Kata "cepat" termasuk');
        // Enrolled on the exam day, by ELLIGBLE ID; the student who left and the other class are not listed.
        assert.deepEqual(res.body.participants.map((p: { elligbleId: string; included: boolean; conflict: boolean }) => [p.elligbleId, p.included, p.conflict]),
            [['siswa.a', true, false], ['siswa.b', true, false], ['siswa.c', true, false]]);
        assert.deepEqual(res.body.window, { startsAt: `${day}T01:00:00.000Z`, endsAt: `${day}T03:00:00.000Z` });
        assert.deepEqual(res.body.totals, { questions: 3, maxScore: 4.5, participants: 3 });
        assert.deepEqual(await counts(), before);
    });

    await t.test('file and setup problems are reported together, without writing', async () => {
        const before = await counts();
        const broken = 'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score\n1;Soal;a;b;c;d;e;A dan B;1\n3;Soal;a;b;c;d;e;A;1\n';
        const res = await preview(teacherClient, {
            questionsCsv: broken, windowStartsAt: `${day}T10:00`, windowEndsAt: `${day}T08:00`, durationMinutes: 0,
            assessmentTypeId: randomUUID(),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.problems, [
            { source: 'file', code: 'correct_multiple', line: 2 },
            { source: 'file', code: 'number_out_of_order', line: 3, expected: 2 },
            { source: 'setup', code: 'duration_invalid' },
            { source: 'setup', code: 'window_order' },
            { source: 'setup', code: 'assessment_type_unknown' },
        ]);
        const ended = await preview(teacherClient, { windowStartsAt: wib(-180), windowEndsAt: wib(-60) });
        assert.deepEqual(ended.body.problems, [{ source: 'setup', code: 'window_ended' }]);
        const invalidDate = await preview(teacherClient, { windowStartsAt: '2026-02-30T08:00' });
        assert.deepEqual(invalidDate.body.problems, [{ source: 'setup', code: 'window_invalid' }]);
        const blocked = await preview(teacherClient, { latestStartPolicy: 'LATE_START_BLOCKED', durationMinutes: 150 });
        assert.deepEqual(blocked.body.problems, [{ source: 'setup', code: 'duration_exceeds_window' }]);
        const nobody = await preview(teacherClient, { participantEnrollmentIds: [] });
        assert.deepEqual(nobody.body.problems, [{ source: 'setup', code: 'no_participants' }]);
        const stranger = await preview(teacherClient, { participantEnrollmentIds: [randomUUID()] });
        assert.deepEqual(stranger.body.problems, [{ source: 'setup', code: 'participant_not_enrolled', count: 1 }, { source: 'setup', code: 'no_participants' }]);
        const huge = await preview(teacherClient, { questionsCsv: 'x'.repeat(512 * 1024 + 1) });
        assert.deepEqual(huge.body.problems, [{ source: 'setup', code: 'file_too_large' }]);
        await pool.query('UPDATE tenant_tenants SET time_zone = NULL WHERE id = $1', [tenant]);
        const noZone = await preview(teacherClient);
        await pool.query(`UPDATE tenant_tenants SET time_zone = 'Asia/Jakarta' WHERE id = $1`, [tenant]);
        assert.deepEqual(noZone.body.problems, [{ source: 'setup', code: 'time_zone_missing' }]);
        assert.deepEqual(await counts(), before);
    });

    await t.test('malformed requests, other classes and other people are refused', async () => {
        const body = (extra: Record<string, unknown>) => ({ method: 'POST', body: { ...request(), ...extra } });
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', body({ windowStartsAt: '5 Oktober 08.00' }))).status, 400);
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', body({ latestStartPolicy: 'ANYTIME' }))).status, 400);
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', body({ participantEnrollmentIds: ['x'] }))).status, 400);
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/import', body({}))).status, 400, 'a confirmation needs its key and SHA-256');
        assert.equal((await preview(teacherClient, { teachingAssignmentId: otherTeaching.teachingAssignmentId })).status, 403);
        const other = await loggedIn(otherTeacher);
        assert.equal((await preview(other)).status, 403);
        assert.equal((await preview(await loggedIn(byName('siswa.a')))).status, 403);
        const big = await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview', {
            method: 'POST', rawBody: JSON.stringify({ ...request(), questionsCsv: 'x'.repeat(1024 * 1024) }),
        });
        assert.equal(big.status, 413);
        assert.equal((await teacherClient.request('/api/v1/assessment/teacher-exams/import/preview')).status, 405);
    });

    let examId = '';
    await t.test('the confirmation schedules the exam with its provenance, the chosen participants and the teacher as actor', async () => {
        const importKey = randomUUID();
        const chosen = [byName('siswa.a').enrollmentId, byName('siswa.c').enrollmentId];
        const body = request({ participantEnrollmentIds: chosen });
        const res = await teacherClient.request('/api/v1/assessment/teacher-exams/import', {
            method: 'POST', body: { ...body, importKey, expectedSha256: sha256Hex(FILE) },
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.replayed, false);
        assert.equal(res.body.questionCount, 3);
        assert.equal(res.body.participantCount, 2);
        examId = res.body.examInstanceId;

        const exam = (await pool.query(
            `SELECT lifecycle_state, teaching_assignment_id, assessment_type_id, window_starts_at, window_ends_at,
                    configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled
             FROM secure_assessment_exam_instances WHERE id = $1`, [examId])).rows[0];
        assert.equal(exam.lifecycle_state, 'SCHEDULED');
        assert.equal(exam.teaching_assignment_id, teaching.teachingAssignmentId);
        assert.equal(exam.assessment_type_id, teaching.assessmentTypeId);
        assert.equal(exam.window_starts_at.toISOString(), `${day}T01:00:00.000Z`);
        assert.equal(exam.window_ends_at.toISOString(), `${day}T03:00:00.000Z`);
        assert.equal(exam.configured_attempt_duration_seconds, 5400);
        assert.equal(exam.latest_start_policy, 'FULL_DURATION_BEYOND_WINDOW');
        assert.equal(exam.room_based_operations_enabled, false);

        const batch = (await pool.query('SELECT * FROM secure_assessment_question_import_batches WHERE exam_instance_id = $1', [examId])).rows;
        assert.equal(batch.length, 1);
        assert.equal(batch[0].imported_by_person_id, teacher.personId);
        assert.equal(batch[0].import_key, importKey);
        assert.equal(batch[0].template, 'elligble-questions-v1');
        assert.equal(batch[0].source_file_name, 'ulangan-bab-3.csv');
        assert.equal(batch[0].source_sha256, sha256Hex(FILE));
        assert.equal(batch[0].question_count, 3);

        const snapshots = (await pool.query(
            `SELECT display_order, import_batch_id, import_source_line, frozen_content FROM secure_assessment_exam_question_snapshots
             WHERE exam_instance_id = $1 ORDER BY display_order`, [examId])).rows;
        assert.deepEqual(snapshots.map(s => [s.display_order, s.import_batch_id, s.import_source_line]),
            [[1, batch[0].id, 2], [2, batch[0].id, 3], [3, batch[0].id, 4]]);
        const second = snapshots[1].frozen_content;
        assert.equal(second.prompt, 'Hasil dari 7 × 8 adalah');
        assert.deepEqual(second.options.map((o: { content: string }) => o.content), ['54', '56', '58', '64', '72']);
        assert.equal(second.correctOptionId, second.options[1].id);
        assert.ok(!second.options.some((o: { id: string }) => /^[A-E]$/.test(o.id)), 'option ids are never the display letters');
        assert.equal(snapshots[2].frozen_content.maxScore, 1.5);

        const participants = (await pool.query(
            'SELECT person_id, academic_enrollment_id FROM secure_assessment_exam_participants WHERE exam_instance_id = $1 ORDER BY academic_enrollment_id', [examId])).rows;
        assert.deepEqual(new Set(participants.map(p => p.person_id)), new Set([byName('siswa.a').personId, byName('siswa.c').personId]));
        const event = (await pool.query(
            'SELECT from_state, to_state, actor_person_id FROM secure_assessment_exam_lifecycle_events WHERE exam_instance_id = $1', [examId])).rows;
        assert.deepEqual(event, [{ from_state: 'DRAFT', to_state: 'SCHEDULED', actor_person_id: teacher.personId }]);

        // An ordinary scheduled exam: listed for the teacher, ready by the readiness checks.
        const readiness = await teacherClient.request('/api/v1/assessment/teacher-readiness');
        const listed = readiness.body.exams.find((e: { examInstanceId: string }) => e.examInstanceId === examId);
        assert.equal(listed.lifecycleState, 'SCHEDULED');
        assert.equal(listed.baseline.status, 'baseline_readiness_checks_pass');
        const ready = await teacherClient.request('/api/v1/assessment/teacher-exams/transition', { method: 'POST', body: { examInstanceId: examId, action: 'mark_ready' } });
        assert.equal(ready.status, 200);
        assert.equal(ready.body.lifecycleState, 'READY');
    });

    await t.test('a retry with the same key returns the same exam; the key never serves another file', async () => {
        const [batch] = (await pool.query('SELECT import_key FROM secure_assessment_question_import_batches WHERE exam_instance_id = $1', [examId])).rows;
        const before = await counts();
        const body = request({ participantEnrollmentIds: [byName('siswa.a').enrollmentId, byName('siswa.c').enrollmentId] });
        const retry = await teacherClient.request('/api/v1/assessment/teacher-exams/import', {
            method: 'POST', body: { ...body, importKey: batch.import_key, expectedSha256: sha256Hex(FILE) },
        });
        assert.equal(retry.status, 200);
        assert.deepEqual(retry.body, { examInstanceId: examId, replayed: true, questionCount: 3, participantCount: 2 });
        const changed = FILE.replace('Bandung', 'Bogor');
        const reused = await teacherClient.request('/api/v1/assessment/teacher-exams/import', {
            method: 'POST', body: { ...request({ questionsCsv: changed }), importKey: batch.import_key, expectedSha256: sha256Hex(changed) },
        });
        assert.equal(reused.status, 409);
        assert.equal(reused.body.error, 'import_key_reused');
        const edited = await teacherClient.request('/api/v1/assessment/teacher-exams/import', {
            method: 'POST', body: { ...request(), importKey: randomUUID(), expectedSha256: sha256Hex(changed) },
        });
        assert.equal(edited.status, 409);
        assert.equal(edited.body.error, 'content_changed');
        assert.deepEqual(await counts(), before);
    });

    await t.test('the same class at an overlapping time is refused; another time is a second exam', async () => {
        const before = await counts();
        const clash = await confirm(teacherClient, { windowStartsAt: `${day}T09:00`, windowEndsAt: `${day}T11:00` });
        assert.equal(clash.status, 422);
        assert.equal(clash.body.error, 'import_invalid');
        assert.deepEqual(clash.body.problems, [{ source: 'setup', code: 'schedule_conflict', count: 2 }]);
        assert.deepEqual(clash.body.participants.map((p: { elligbleId: string; conflict: boolean }) => [p.elligbleId, p.conflict]),
            [['siswa.a', true], ['siswa.b', false], ['siswa.c', true]]);
        assert.deepEqual(await counts(), before);
        // Leaving out the two students already expected elsewhere resolves it.
        const alone = await preview(teacherClient, { windowStartsAt: `${day}T09:00`, windowEndsAt: `${day}T11:00`, participantEnrollmentIds: [byName('siswa.b').enrollmentId] });
        assert.deepEqual(alone.body.problems, []);
        const later = await confirm(teacherClient, { windowStartsAt: `${day}T13:00`, windowEndsAt: `${day}T15:00` });
        assert.equal(later.status, 201);
        assert.notEqual(later.body.examInstanceId, examId);
        assert.equal(later.body.participantCount, 3);
    });

    await t.test('two confirmations racing with one key create one exam', async () => {
        const importKey = randomUUID();
        const body = { ...request({ windowStartsAt: `${day}T16:00`, windowEndsAt: `${day}T17:30` }), importKey, expectedSha256: sha256Hex(FILE) };
        const [a, b] = await Promise.all([
            teacherClient.request('/api/v1/assessment/teacher-exams/import', { method: 'POST', body }),
            teacherClient.request('/api/v1/assessment/teacher-exams/import', { method: 'POST', body }),
        ]);
        assert.deepEqual([a.status, b.status].sort(), [200, 201]);
        assert.equal(a.body.examInstanceId, b.body.examInstanceId);
        const batches = await pool.query('SELECT count(*)::int AS n FROM secure_assessment_question_import_batches WHERE import_key = $1', [importKey]);
        assert.equal(batches.rows[0].n, 1);
    });

    await t.test('a revoked teaching assignment can no longer schedule', async () => {
        await pool.query('UPDATE academic_core_teaching_assignments SET revoked_at = now() WHERE id = $1', [teaching.teachingAssignmentId]);
        assert.equal((await preview(teacherClient, { windowStartsAt: `${day}T18:00`, windowEndsAt: `${day}T19:00` })).status, 403);
        assert.equal((await confirm(teacherClient, { windowStartsAt: `${day}T18:00`, windowEndsAt: `${day}T19:00` })).status, 403);
    });

    await t.test('import batches are append-only', async () => {
        await assert.rejects(pool.query('UPDATE secure_assessment_question_import_batches SET source_file_name = $1', ['lain.csv']), /append-only/);
        await assert.rejects(pool.query('DELETE FROM secure_assessment_question_import_batches'), /append-only/);
    });
});
