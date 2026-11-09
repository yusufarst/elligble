import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    deadlineProblems, durationFitsWindow, hasExactKeys, institutionFailure, isPreparationClosed, isRealDate, isRealTime, mapContentReadiness,
    normalizeInstitutionLabel, parseCancelRequest, parseContentRequest, parseDeadlineRequest, parsePeriodRequest, parsePlacementRequest,
    parseSessionRequest, parseTransitionRequest, schoolInstants, sessionLocals,
} from '../src/institution-exams.ts';
import type { BaselineQuestionSnapshotContentReadinessResult } from '../src/exam-instance-baseline-question-snapshot-content-readiness-preflight.ts';
import { MATCHING_RIGHT_LETTERS, OPTION_LETTERS, QUESTIONS_HEADER_V2_RUBRIC, parseQuestionFile, type ParsedQuestion } from '../src/question-import.ts';
import { previewQuestionsOf } from '../src/teacher-exam-import.ts';
import { AuthenticationError } from '../src/http/authenticated-context.ts';

// ASSESS-INSTITUTION-001 C01/C02 units: the content-readiness mapping over all six preflight results,
// the exact request bodies, the school-zone conversion of dates, times and deadlines, the problem codes
// and the deadline revision rule, the reason normalization, the error mapping, and the extracted
// preview items of the teacher import (unchanged).

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

test('C01 the content-readiness result maps as a pure function over all six preflight results (E6)', () => {
    const results: Array<[BaselineQuestionSnapshotContentReadinessResult, ReturnType<typeof mapContentReadiness>]> = [
        [{ type: 'baseline_question_snapshot_content_ready', examInstanceId: ID, tenantId: ID2, questionSnapshotCount: 3 }, { kind: 'accepted' }],
        [{ type: 'not_ready', blocker: 'question_snapshot_empty' },
            { kind: 'invalid', problem: { source: 'setup', code: 'not_ready', blocker: 'question_snapshot_empty' } }],
        [{ type: 'not_ready', blocker: 'question_snapshot_content_invalid', snapshotId: ID, contentBlocker: 'prompt_invalid' as never },
            { kind: 'invalid', problem: { source: 'setup', code: 'not_ready', blocker: 'question_snapshot_content_invalid' } }],
        [{ type: 'invalid_state' }, { kind: 'unavailable' }],
        [{ type: 'denied' }, { kind: 'unavailable' }],
        [{ type: 'unavailable' }, { kind: 'unavailable' }],
    ];
    for (const [result, expected] of results) assert.deepEqual(mapContentReadiness(result), expected, result.type);
    // The invalid problem never carries the snapshot id or the content blocker to the client.
    const invalid = mapContentReadiness(results[2][0]);
    assert.equal(JSON.stringify(invalid).includes(ID), false);
});

test('C01 Operator bodies are exact: every key present, nothing else, the right shapes', () => {
    const period = { label: ' PTS  Ganjil ', assessmentTypeId: ID.toUpperCase(), academicPeriodId: ID2, actionKey: ID };
    assert.deepEqual(parsePeriodRequest(period), { label: ' PTS  Ganjil ', assessmentTypeId: ID, academicPeriodId: ID2, actionKey: ID });
    for (const spoof of ['actorPersonId', 'tenantId', 'createdBy', 'reason']) {
        assert.equal(parsePeriodRequest({ ...period, [spoof]: ID }), null, spoof);
    }
    assert.equal(parsePeriodRequest({ label: 'x', assessmentTypeId: ID, academicPeriodId: ID2 }), null, 'missing key');
    assert.equal(parsePeriodRequest({ ...period, label: 5 }), null);
    assert.equal(parsePeriodRequest({ ...period, actionKey: 'not-a-key' }), null);

    const session = { periodId: ID, date: '2026-12-02', startTime: '08:00', endTime: '10:00', actionKey: ID2 };
    assert.deepEqual(parseSessionRequest(session), session);
    assert.equal(parseSessionRequest({ ...session, date: 20261202 }), null);
    assert.equal(parseSessionRequest({ ...session, tenantId: ID }), null);
    // A malformed value of the right shape is a 422 problem, not a 400.
    assert.deepEqual(parseSessionRequest({ ...session, date: '2026-13-40' })?.date, '2026-13-40');

    const placement = { sessionId: ID, teachingAssignmentId: ID2, durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', preparationDeadline: '2026-12-01T15:00', actionKey: ID };
    assert.deepEqual(parsePlacementRequest(placement), placement);
    assert.equal(parsePlacementRequest({ ...placement, latestStartPolicy: 'ANYTIME' }), null);
    assert.equal(parsePlacementRequest({ ...placement, durationMinutes: '90' }), null);
    assert.equal(parsePlacementRequest({ ...placement, durationMinutes: Number.NaN }), null);
    assert.equal(parsePlacementRequest({ ...placement, participants: [] }), null);
    assert.equal(parsePlacementRequest({ ...placement, durationMinutes: 1.5 })?.durationMinutes, 1.5, 'an integer check is a problem code');

    const transition = { examInstanceId: ID, action: 'mark_ready' };
    assert.deepEqual(parseTransitionRequest(transition), transition);
    for (const action of ['activate', 'pause', 'end', 'finalize']) assert.equal(parseTransitionRequest({ ...transition, action }), null, action);
    // OP-7 A: mark ready carries no reason, confirmation or key; any extra field is refused.
    assert.equal(parseTransitionRequest({ ...transition, reason: 'x' }), null);
    assert.equal(parseTransitionRequest({ ...transition, actionKey: ID }), null);
    assert.equal(hasExactKeys({ a: 1, b: undefined }, ['a', 'b']), true);
    assert.equal(hasExactKeys({ a: 1 }, ['a', 'b']), false);
});

test('C01 the extension and cancellation need a normalized reason and an explicit confirmation', () => {
    const extension = { examInstanceId: ID, preparationDeadline: '2026-12-01T18:00', expectedRevision: 1, reason: '  Guru\n sakit\t ', confirmed: true, actionKey: ID2 };
    assert.deepEqual(parseDeadlineRequest(extension), { examInstanceId: ID, preparationDeadline: '2026-12-01T18:00', expectedRevision: 1, reason: 'Guru sakit', actionKey: ID2 });
    assert.equal(parseDeadlineRequest({ ...extension, reason: '   ' }), null, 'empty reason');
    assert.equal(parseDeadlineRequest({ ...extension, reason: 'a'.repeat(201) }), null, 'over 200 characters');
    assert.equal(parseDeadlineRequest({ ...extension, reason: 'a'.repeat(200) })?.reason.length, 200);
    assert.equal(parseDeadlineRequest({ ...extension, confirmed: 'true' }), null, 'confirmed must be true');
    assert.equal(parseDeadlineRequest({ ...extension, confirmed: false }), null);
    assert.equal(parseDeadlineRequest({ ...extension, expectedRevision: 0 }), null);
    assert.equal(parseDeadlineRequest({ ...extension, expectedRevision: 1.5 }), null);
    const { confirmed: _c, ...withoutConfirmation } = extension;
    assert.equal(parseDeadlineRequest(withoutConfirmation), null);

    const cancel = { examInstanceId: ID, reason: 'Salah  tempat', confirmed: true, actionKey: ID2 };
    assert.deepEqual(parseCancelRequest(cancel), { examInstanceId: ID, reason: 'Salah tempat', actionKey: ID2 });
    assert.equal(parseCancelRequest({ ...cancel, confirmed: undefined }), null);
    assert.equal(parseCancelRequest({ ...cancel, reason: '' }), null);
    assert.equal(parseCancelRequest({ ...cancel, actorPersonId: ID }), null);
});

test('C01 content bodies are exact; the file name is cleaned; confirmation adds the key and the SHA-256', () => {
    const preview = { examInstanceId: ID, questionsCsv: 'no', sourceFileName: 'C:\\soal\\ulangan.csv' };
    assert.deepEqual(parseContentRequest(preview, false), { examInstanceId: ID, questionsCsv: 'no', sourceFileName: 'ulangan.csv' });
    assert.deepEqual(parseContentRequest({ ...preview, sourceFileName: null }, false)?.sourceFileName, null);
    assert.equal(parseContentRequest({ ...preview, sourceFileName: 5 }, false), null);
    assert.equal(parseContentRequest({ examInstanceId: ID, questionsCsv: 'no' }, false), null, 'sourceFileName is part of the exact body');
    assert.equal(parseContentRequest({ ...preview, teachingAssignmentId: ID }, false), null);
    const confirm = { ...preview, importKey: ID2, expectedSha256: 'a'.repeat(64) };
    assert.equal(parseContentRequest(confirm, false), null, 'the preview takes no key');
    assert.deepEqual(parseContentRequest(confirm, true), { examInstanceId: ID, questionsCsv: 'no', sourceFileName: 'ulangan.csv', importKey: ID2, expectedSha256: 'a'.repeat(64) });
    assert.equal(parseContentRequest({ ...confirm, expectedSha256: 'A'.repeat(64) }, true), null);
    assert.equal(parseContentRequest({ ...confirm, importKey: 'x' }, true), null);
});

test('C01 labels, dates and times', () => {
    assert.equal(normalizeInstitutionLabel('  PTS \t Ganjil\n2026 '), 'PTS Ganjil 2026');
    assert.equal(normalizeInstitutionLabel('   '), null);
    assert.equal(normalizeInstitutionLabel('a'.repeat(120)), 'a'.repeat(120));
    assert.equal(normalizeInstitutionLabel('a'.repeat(121)), null);
    assert.equal(normalizeInstitutionLabel('😀'.repeat(120)), '😀'.repeat(120), 'counted in characters, not code units');
    assert.equal(normalizeInstitutionLabel(7), null);
    assert.equal(isRealDate('2026-02-28'), true);
    assert.equal(isRealDate('2026-02-29'), false);
    assert.equal(isRealDate('2028-02-29'), true);
    assert.equal(isRealDate('2026-2-01'), false);
    assert.equal(isRealTime('00:00'), true);
    assert.equal(isRealTime('23:59'), true);
    assert.equal(isRealTime('24:00'), false);
    assert.equal(isRealTime('08:60'), false);
    assert.equal(isRealTime('8:00'), false);
});

test('C01 school-zone conversion: a session is one date with two wall-clock times, converted with the tenant zone', async () => {
    assert.deepEqual(sessionLocals('2026-12-02', '08:00', '10:00'), ['2026-12-02T08:00', '2026-12-02T10:00']);
    // A fixed-offset stand-in for PostgreSQL's AT TIME ZONE: checks which values travel where.
    const offsets: Record<string, number> = { 'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9 };
    const seen: Array<{ text: string; values: unknown[] }> = [];
    const client = {
        query: async (text: string, values: unknown[]) => {
            seen.push({ text, values });
            const [zone, ...locals] = values as string[];
            const row: Record<string, unknown> = { db_now: new Date('2026-11-09T00:00:00Z') };
            locals.forEach((local, i) => { row[`t${i}`] = new Date(Date.parse(`${local}:00Z`) - offsets[zone] * 3600_000); });
            return { rows: [row] };
        },
    };
    const wib = await schoolInstants(client as never, 'Asia/Jakarta', sessionLocals('2026-12-02', '08:00', '10:00'));
    assert.deepEqual(wib.instants.map(d => d.toISOString()), ['2026-12-02T01:00:00.000Z', '2026-12-02T03:00:00.000Z']);
    assert.equal(wib.now.toISOString(), '2026-11-09T00:00:00.000Z');
    assert.match(seen[0].text, /\(\$2::timestamp AT TIME ZONE \$1\) AS t0, \(\$3::timestamp AT TIME ZONE \$1\) AS t1, statement_timestamp\(\) AS db_now/);
    assert.deepEqual(seen[0].values, ['Asia/Jakarta', '2026-12-02T08:00', '2026-12-02T10:00']);
    const wit = await schoolInstants(client as never, 'Asia/Jayapura', ['2026-12-01T15:00']);
    assert.equal(wit.instants[0].toISOString(), '2026-12-01T06:00:00.000Z', 'a deadline in WIT');
});

test('C01 the deadline revision rule and the composition problem codes', () => {
    const now = new Date('2026-11-09T00:00:00Z');
    const session = new Date('2026-11-12T01:00:00Z');
    const at = (iso: string) => new Date(iso);
    assert.deepEqual(deadlineProblems(at('2026-11-10T08:00:00Z'), { now, sessionStartsAt: session }), []);
    assert.deepEqual(deadlineProblems(at('2026-11-08T08:00:00Z'), { now, sessionStartsAt: session }), ['deadline_passed']);
    assert.deepEqual(deadlineProblems(now, { now, sessionStartsAt: session }), ['deadline_passed'], 'now is not in the future');
    assert.deepEqual(deadlineProblems(session, { now, sessionStartsAt: session }), ['deadline_not_before_session']);
    assert.deepEqual(deadlineProblems(at('2026-11-13T00:00:00Z'), { now, sessionStartsAt: session }), ['deadline_not_before_session']);
    // Extension: later than the current one; an expired current deadline may still be extended (OP-4 A).
    const current = at('2026-11-10T08:00:00Z');
    assert.deepEqual(deadlineProblems(at('2026-11-10T09:00:00Z'), { now, sessionStartsAt: session, current }), []);
    assert.deepEqual(deadlineProblems(current, { now, sessionStartsAt: session, current }), ['deadline_not_later']);
    assert.deepEqual(deadlineProblems(at('2026-11-09T12:00:00Z'), { now, sessionStartsAt: session, current }), ['deadline_not_later']);
    const expired = at('2026-11-08T08:00:00Z');
    assert.deepEqual(deadlineProblems(at('2026-11-11T08:00:00Z'), { now, sessionStartsAt: session, current: expired }), []);
    assert.deepEqual(deadlineProblems(at('2026-11-08T09:00:00Z'), { now, sessionStartsAt: session, current: expired }), ['deadline_passed']);
    assert.deepEqual(deadlineProblems(at('2026-11-07T09:00:00Z'), { now, sessionStartsAt: session, current: expired }), ['deadline_not_later', 'deadline_passed']);

    // The existing duration/window/policy rule: only a blocked late start needs the duration to fit.
    const start = at('2026-11-12T01:00:00Z');
    const end = at('2026-11-12T03:00:00Z');
    assert.equal(durationFitsWindow(150, start, end, 'FULL_DURATION_BEYOND_WINDOW'), true);
    assert.equal(durationFitsWindow(150, start, end, 'REMAINING_WINDOW_ONLY'), true);
    assert.equal(durationFitsWindow(120, start, end, 'LATE_START_BLOCKED'), true);
    assert.equal(durationFitsWindow(121, start, end, 'LATE_START_BLOCKED'), false);

    // Closed: past the deadline (or none), or no longer SCHEDULED.
    assert.equal(isPreparationClosed('SCHEDULED', at('2026-11-10T00:00:00Z'), now), false);
    assert.equal(isPreparationClosed('SCHEDULED', now, now), true);
    assert.equal(isPreparationClosed('SCHEDULED', null, now), true);
    assert.equal(isPreparationClosed('READY', at('2026-11-10T00:00:00Z'), now), true);
    assert.equal(isPreparationClosed('ARCHIVED', at('2026-11-10T00:00:00Z'), now), true);
});

test('C01 database failures map as §4.2 says: a racing unique constraint answers like its check', () => {
    const pgError = (code: string, constraint?: string) => Object.assign(new Error(code), { code, constraint });
    assert.deepEqual(institutionFailure(pgError('40001')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(institutionFailure(pgError('40P01')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(institutionFailure(pgError('23505', 'uq_sa_institution_period_label')),
        { status: 422, body: { error: 'composition_invalid', problems: [{ code: 'label_taken' }] } });
    assert.deepEqual(institutionFailure(pgError('23505', 'uq_sa_institution_session_slot')),
        { status: 422, body: { error: 'composition_invalid', problems: [{ code: 'session_taken' }] } });
    for (const constraint of ['uq_sa_institution_period_action_key', 'uq_sa_institution_session_action_key', 'uq_sa_institution_deadline_action_key', 'uq_sa_exam_cancellation_action_key']) {
        assert.deepEqual(institutionFailure(pgError('23505', constraint)), { status: 409, body: { error: 'action_key_reused' } }, constraint);
    }
    assert.deepEqual(institutionFailure(pgError('08006')), { status: 503, body: { error: 'persistence_unavailable' } });
    assert.deepEqual(institutionFailure(pgError('57P01')), { status: 503, body: { error: 'persistence_unavailable' } });
    assert.deepEqual(institutionFailure(pgError('ECONNREFUSED')), { status: 503, body: { error: 'persistence_unavailable' } });
    assert.deepEqual(institutionFailure(new AuthenticationError(401, 'unauthorized')), { status: 401, body: { error: 'unauthorized' } });
    assert.deepEqual(institutionFailure(new Error('unexpected')), { status: 500, body: { error: 'internal_error' } });
});

// C02: the preview items of the teacher import, as the import built them inline before the extraction
// (teacher-exam-import.ts at e031d31, lines 307 to 316), for every question type.
function legacyPreviewKey(q: ParsedQuestion): { correct: string; correctLetters: string[] } {
    if (q.type === 'MJ') {
        const letters = (q.correctPairIndexes ?? []).map(i => MATCHING_RIGHT_LETTERS[i]);
        return { correct: letters.join(', '), correctLetters: letters };
    }
    if (q.type === 'IA') return { correct: q.numericKey ?? '', correctLetters: [] };
    if (q.type === 'ES' || q.type === 'IS') return { correct: '', correctLetters: [] };
    if (q.type === 'UR') {
        const numbers = (q.correctSequence ?? []).map(i => String(i + 1));
        return { correct: numbers.join(', '), correctLetters: numbers };
    }
    const letters = q.correctIndexes.map(i => OPTION_LETTERS[i]);
    return { correct: q.type === 'BS' ? (q.correctValue ? 'Benar' : 'Salah') : letters.join(', '), correctLetters: letters };
}
const legacyPreview = (questions: ParsedQuestion[]) => questions.map(q => ({
    line: q.line, no: q.no, prompt: q.prompt, options: q.options, score: q.maxScore, type: q.type,
    ...legacyPreviewKey(q),
    ...(q.type === 'BS' ? { correctValue: q.correctValue === true } : {}),
    ...(q.type === 'MJ' ? { leftItems: q.leftItems ?? [], rightItems: q.rightItems ?? [] } : {}),
    ...(q.type === 'UR' ? { leftItems: q.leftItems ?? [], rightItems: [], keyEqualsAuthoredOrder: (q.correctSequence ?? []).every((v, i) => v === i) } : {}),
    ...(q.type === 'IA' ? { tolerance: q.numericTolerance ?? '0' } : {}),
    ...(q.type === 'ES' ? { rubric: q.essayRubric ?? '' } : {}),
    ...(q.type === 'IS' ? { acceptedForms: q.acceptedForms ?? [], ...((q.acceptedForms ?? []).length === 0 ? { rubric: q.essayRubric ?? '' } : {}) } : {}),
}));

test('C02 previewQuestionsOf gives exactly the preview items of the import, for every question type', () => {
    const row = (head: string, left: string[] = [], right: string[] = [], tolerance = '', rubric = '') =>
        [head, ...[...left, ...Array(10 - left.length).fill('')], ...[...right, ...Array(12 - right.length).fill('')], tolerance, rubric].join(';');
    const file = [
        QUESTIONS_HEADER_V2_RUBRIC.join(';'),
        row('1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1'),
        row('2;PGK;Bilangan prima di bawah ini adalah;2;4;5;6;9;A,C;2'),
        row('3;BS;Matahari terbit di timur;;;;;;B;1'),
        row('4;MJ;Pasangkan hewan dengan suaranya;;;;;;B,A;2', ['Kucing', 'Anjing'], ['Menggonggong', 'Mengeong']),
        row('5;UR;Urutkan dari terkecil;;;;;;2,1;2', ['Dua', 'Satu']),
        row('6;IA;Hasil dari 7 dibagi 2 adalah;;;;;;3,5;1', [], [], '0,1'),
        row('7;ES;Jelaskan proses fotosintesis;;;;;;;5', [], [], '', 'Sebutkan bahan dan hasilnya'),
        row('8;IS;Ibu kota Jawa Barat adalah;;;;;;;2', ['Bandung', 'Kota Bandung']),
        row('9;IS;Sebutkan satu kota di Jawa;;;;;;;2', [], [], '', 'Kota besar di Jawa'),
    ].join('\r\n') + '\r\n';
    const parsed = parseQuestionFile(file);
    assert.deepEqual(parsed.problems, []);
    assert.equal(parsed.questions.length, 9);
    const items = previewQuestionsOf(parsed.questions);
    assert.deepEqual(items, legacyPreview(parsed.questions));
    assert.deepEqual(items.map(i => i.type), ['PG', 'PGK', 'BS', 'MJ', 'UR', 'IA', 'ES', 'IS', 'IS']);
    assert.deepEqual(items[0], { line: 2, no: 1, prompt: 'Ibu kota Indonesia adalah', options: ['Bandung', 'Jakarta', 'Surabaya', 'Medan', 'Makassar'], score: 1, type: 'PG', correct: 'B', correctLetters: ['B'] });
    assert.equal(items[2].correct, 'Benar');
    assert.deepEqual(items[3].correctLetters, ['B', 'A']);
    assert.equal(items[4].keyEqualsAuthoredOrder, false);
    assert.deepEqual(items[7].acceptedForms, ['Bandung', 'Kota Bandung']);
    assert.equal('rubric' in items[7], false);
    assert.equal(items[8].rubric, 'Kota besar di Jawa');
    assert.deepEqual(previewQuestionsOf([]), []);
});

test('C01 the edge of every new path, before any database work (N10): origin, method, body size, exact body', async () => {
    const { createServer } = await import('../src/server.ts');
    let connections = 0;
    const pool = {
        connect: async () => { connections++; throw new Error('database unavailable'); },
        query: async () => { connections++; throw new Error('database unavailable'); },
    };
    const server = createServer({ checkReadiness: async () => false, pool: pool as never, security: { cookie: { secure: false }, allowedOrigins: [], hsts: false } });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const post = (path: string, body: string, headers: Record<string, string> = {}) =>
        fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
    const operatorPaths = ['periods', 'sessions', 'placements', 'deadline', 'cancel', 'transition'].map(p => `/api/v1/assessment/institution-exams/${p}`);
    const contentPaths = ['/api/v1/assessment/teacher-exams/content/preview', '/api/v1/assessment/teacher-exams/content'];
    try {
        for (const path of [...operatorPaths, ...contentPaths]) {
            const foreign = await post(path, '{}', { Origin: 'https://elsewhere.example' });
            assert.equal(foreign.status, 403, path);
            assert.deepEqual(await foreign.json(), { error: 'origin_not_allowed' });
            const bad = await post(path, JSON.stringify({ actorPersonId: ID }));
            assert.equal(bad.status, 400, path);
            assert.deepEqual(await bad.json(), { error: 'invalid_request' });
            const wrong = await fetch(base + path, { method: 'PUT', body: '{}' });
            assert.equal(wrong.status, 405, path);
        }
        for (const path of operatorPaths) {
            const large = await post(path, JSON.stringify({ label: 'x'.repeat(64 * 1024) }));
            assert.equal(large.status, 413, path);
            assert.deepEqual(await large.json(), { error: 'payload_too_large' });
        }
        for (const path of contentPaths) {
            const fits = await post(path, JSON.stringify({ questionsCsv: 'x'.repeat(100 * 1024) }));
            assert.equal(fits.status, 400, `${path}: the content routes take the import's 1 MiB`);
            const large = await post(path, JSON.stringify({ questionsCsv: 'x'.repeat(1024 * 1024) }));
            assert.equal(large.status, 413, path);
        }
        const overview = await fetch(`${base}/api/v1/assessment/institution-exams`, { method: 'POST', body: '{}' });
        assert.equal(overview.status, 405);
        const query = await fetch(`${base}/api/v1/assessment/institution-exams?periodId=nope`);
        assert.equal(query.status, 400);
        const extra = await fetch(`${base}/api/v1/assessment/institution-exams?periodId=${ID}&tenantId=${ID}`);
        assert.equal(extra.status, 400);
        const anonymous = await fetch(`${base}/api/v1/assessment/institution-exams`);
        assert.equal(anonymous.status, 401);
        assert.equal(connections, 0, 'nothing reached the database');
    } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});
