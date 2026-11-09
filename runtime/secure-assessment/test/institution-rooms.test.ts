import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    dedupeProctors, institutionRoomFailure, isStaleRevision, matchRoomFailure, normalizeProctorId, normalizeRoomLabel, parseParticipantAdditionRequest,
    parseRoomParticipantsRequest, parseRoomProctorsRequest, planProctorSet, planRoomMove, readinessDecision, roomDisplayLabel, roomReadinessView,
    type RoomRow,
} from '../src/institution-rooms.ts';
import { InstitutionRefusal } from '../src/institution-exams.ts';

// ASSESS-INSTITUTION-002 C01 units: the exact request bodies, the room label form and the Proctor ID
// normalization, the session revision rule, the E2/E3 sync rules as pure functions (rows to create, update and
// prune; Proctors to add and revoke; cancelled exams never given), the E7 decision, the rooms error mapper over
// every named constraint, the de-duplication of Proctors by person, and the edge of every new path before any
// database work (N10).

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';
const E1 = 'e1e1e1e1-0000-4000-8000-000000000001';
const E2 = 'e2e2e2e2-0000-4000-8000-000000000002';

test('C01 room bodies are exact: every key present, nothing else, the right shapes', () => {
    const placement = { sessionId: ID.toUpperCase(), roomLabel: ' Ruang  1 ', participantIds: [ID2, ID3.toUpperCase()], expectedRevision: 0, actionKey: ID };
    assert.deepEqual(parseRoomParticipantsRequest(placement), { sessionId: ID, roomLabel: ' Ruang  1 ', participantIds: [ID2, ID3], expectedRevision: 0, actionKey: ID });
    for (const spoof of ['actorPersonId', 'tenantId', 'examInstanceId']) assert.equal(parseRoomParticipantsRequest({ ...placement, [spoof]: ID }), null, spoof);
    assert.equal(parseRoomParticipantsRequest({ ...placement, participantIds: [] }), null, 'at least one participant');
    assert.equal(parseRoomParticipantsRequest({ ...placement, participantIds: [ID2, ID2.toUpperCase()] }), null, 'distinct');
    assert.equal(parseRoomParticipantsRequest({ ...placement, participantIds: Array.from({ length: 1001 }, () => ID2) }), null, 'at most 1000');
    assert.equal(parseRoomParticipantsRequest({ ...placement, participantIds: ['nope'] }), null);
    assert.equal(parseRoomParticipantsRequest({ ...placement, expectedRevision: -1 }), null);
    assert.equal(parseRoomParticipantsRequest({ ...placement, expectedRevision: 1.5 }), null);
    assert.equal(parseRoomParticipantsRequest({ ...placement, expectedRevision: '0' }), null);
    assert.equal(parseRoomParticipantsRequest({ ...placement, roomLabel: 5 }), null);
    // A label of the wrong form is a 422 problem, not a 400.
    assert.equal(parseRoomParticipantsRequest({ ...placement, roomLabel: '' })?.roomLabel, '');
    const { expectedRevision: _r, ...missing } = placement;
    assert.equal(parseRoomParticipantsRequest(missing), null, 'missing key');

    const proctors = { sessionId: ID, roomLabel: 'Ruang 1', proctorElligbleIds: [' pengawas.satu ', 'ELG-ABCD-EFGH-JKMN'], expectedRevision: 3, actionKey: ID2 };
    assert.deepEqual(parseRoomProctorsRequest(proctors), {
        sessionId: ID, roomLabel: 'Ruang 1', expectedRevision: 3, actionKey: ID2,
        proctorIds: [{ typed: 'pengawas.satu', normalized: 'pengawas.satu' }, { typed: 'ELG-ABCD-EFGH-JKMN', normalized: 'elg-abcd-efgh-jkmn' }],
    });
    assert.deepEqual(parseRoomProctorsRequest({ ...proctors, proctorElligbleIds: [] })?.proctorIds, [], 'an empty set removes every Proctor');
    assert.equal(parseRoomProctorsRequest({ ...proctors, proctorElligbleIds: Array.from({ length: 21 }, (_, i) => `p${i}`) }), null, 'at most 20');
    assert.equal(parseRoomProctorsRequest({ ...proctors, proctorElligbleIds: ['   '] }), null, '1 to 64 characters after trimming');
    assert.equal(parseRoomProctorsRequest({ ...proctors, proctorElligbleIds: ['x'.repeat(65)] }), null);
    assert.ok(parseRoomProctorsRequest({ ...proctors, proctorElligbleIds: ['x'.repeat(64)] }));
    assert.equal(parseRoomProctorsRequest({ ...proctors, proctorElligbleIds: [7] }), null);
    assert.equal(parseRoomProctorsRequest({ ...proctors, membershipIds: [ID] }), null);

    const addition = { examInstanceId: ID, enrollmentIds: [ID2], roomLabel: 'Ruang 1', expectedRevision: 2, actionKey: ID3 };
    assert.deepEqual(parseParticipantAdditionRequest(addition), addition);
    assert.equal(parseParticipantAdditionRequest({ ...addition, enrollmentIds: [] }), null);
    assert.equal(parseParticipantAdditionRequest({ ...addition, sessionId: ID }), null);
    assert.equal(parseParticipantAdditionRequest({ ...addition, actorPersonId: ID }), null);
    const { roomLabel: _l, ...noRoom } = addition;
    assert.equal(parseParticipantAdditionRequest(noRoom), null, 'the target room is named');
});

test('C01 Proctor IDs are normalized as identity_identifier_key does; two equal normalized strings are 400', () => {
    assert.equal(normalizeProctorId('  ELG-ABCD-EFGH-JKMN '), 'elg-abcd-efgh-jkmn');
    assert.equal(normalizeProctorId('elg-abcd-efgh-jkmn'), 'elg-abcd-efgh-jkmn');
    // A legacy username matches only exactly: it keeps its case.
    assert.equal(normalizeProctorId(' Pengawas.Satu '), 'Pengawas.Satu');
    // Not the generated alphabet (i, l, o, 0, 1 are excluded): unchanged.
    assert.equal(normalizeProctorId('ELG-ABCI-EFGH-JKMN'), 'ELG-ABCI-EFGH-JKMN');
    const body = { sessionId: ID, roomLabel: 'Ruang 1', proctorElligbleIds: ['  ELG-ABCD-EFGH-JKMN ', 'elg-abcd-efgh-jkmn'], expectedRevision: 0, actionKey: ID2 };
    assert.equal(parseRoomProctorsRequest(body), null);
    assert.ok(parseRoomProctorsRequest({ ...body, proctorElligbleIds: ['Pengawas.Satu', 'pengawas.satu'] }), 'legacy usernames differ by case');
});

test('C01 a legacy username and the generated ID of one account collapse to one Proctor before any write', () => {
    const resolved = [
        { typed: 'pengawas.satu', personId: ID, membershipId: ID2 },
        { typed: 'ELG-ABCD-EFGH-JKMN', personId: ID, membershipId: ID2 },
        { typed: 'lain.sekolah', personId: null, membershipId: null },
        { typed: 'tidak.ada', personId: null, membershipId: null },
        { typed: 'pengawas.dua', personId: ID3, membershipId: ID },
    ];
    const { unknown, proctors } = dedupeProctors(resolved);
    assert.deepEqual(unknown, ['lain.sekolah', 'tidak.ada'], 'a foreign and a nonexistent ID are echoed alike, as typed');
    assert.deepEqual(proctors, [{ typed: 'pengawas.satu', personId: ID, membershipId: ID2 }, { typed: 'pengawas.dua', personId: ID3, membershipId: ID }],
        'the first typed spelling is kept');
    // One person, one assignment per exam: the set change adds the person once and the current set is unchanged on a retry.
    assert.deepEqual(planProctorSet([], proctors.map(p => p.personId)), { added: [ID, ID3], removed: [], changed: true });
    assert.deepEqual(planProctorSet([ID, ID3], proctors.map(p => p.personId)), { added: [], removed: [], changed: false });
});

test('C01 the room label form: whitespace collapsed, trimmed, 1 to 60 characters', () => {
    assert.equal(normalizeRoomLabel('  Ruang   1 '), 'Ruang 1');
    assert.equal(normalizeRoomLabel('ruang\t\n1'), 'ruang 1');
    assert.equal(normalizeRoomLabel('Lab IPA'), 'Lab IPA');
    assert.equal(normalizeRoomLabel('Ruang\u0000A'), 'Ruang A');
    assert.equal(normalizeRoomLabel(''), null);
    assert.equal(normalizeRoomLabel('   '), null);
    assert.equal(normalizeRoomLabel('x'.repeat(60)), 'x'.repeat(60));
    assert.equal(normalizeRoomLabel('x'.repeat(61)), null);
    assert.equal(normalizeRoomLabel('😀'.repeat(60)), '😀'.repeat(60), 'characters, not UTF-16 units');
    assert.equal(normalizeRoomLabel(12), null);
});

test('C01 the session revision rule: a write carries the revision it read', () => {
    assert.equal(isStaleRevision(0, 0), false);
    assert.equal(isStaleRevision(3, 3), false);
    assert.equal(isStaleRevision(2, 3), true);
    assert.equal(isStaleRevision(4, 3), true);
});

const row = (roomId: string, examId: string, label: string, participantCount: number): RoomRow => ({ roomId, examId, label, key: label.toLowerCase(), participantCount });

test('C01 E2 sync: a target row per exam that has none, moves update or insert the current row, emptied source rows are pruned', () => {
    // E1: three participants, two in Ruang 1 and one without a room; E2: two in Ruang 1.
    const rows = [row('r1-e1', E1, 'Ruang 1', 2), row('r1-e2', E2, 'Ruang 1', 2)];
    const chosen = [
        { participantId: 'p1', examId: E1, roomId: 'r1-e1' },
        { participantId: 'p2', examId: E1, roomId: 'r1-e1' },
        { participantId: 'p3', examId: E1, roomId: null },
        { participantId: 'q1', examId: E2, roomId: 'r1-e2' },
    ];
    const plan = planRoomMove(chosen, rows, 'ruang 2');
    assert.deepEqual(plan.moves, [
        { participantId: 'p1', examId: E1, fromRoomId: 'r1-e1' },
        { participantId: 'p2', examId: E1, fromRoomId: 'r1-e1' },
        { participantId: 'p3', examId: E1, fromRoomId: null },
        { participantId: 'q1', examId: E2, fromRoomId: 'r1-e2' },
    ]);
    assert.deepEqual(plan.createFor, [E1, E2]);
    assert.deepEqual(plan.prune, ['r1-e1'], 'E1 leaves Ruang 1 entirely; E2 keeps one participant there');
    assert.equal(plan.alreadyThere, 0);

    // Moving into an existing room: no row is created; a participant already there is not moved.
    const back = planRoomMove([{ participantId: 'p1', examId: E1, roomId: 'r2-e1' }, { participantId: 'p2', examId: E1, roomId: 'r1-e1' }],
        [row('r1-e1', E1, 'Ruang 1', 2), row('r2-e1', E1, 'Ruang 2', 1)], 'ruang 1');
    assert.deepEqual(back.moves, [{ participantId: 'p1', examId: E1, fromRoomId: 'r2-e1' }]);
    assert.deepEqual([back.createFor, back.prune, back.alreadyThere], [[], ['r2-e1'], 1]);

    // Every chosen participant already there: nothing to do (already_in_room).
    const none = planRoomMove([{ participantId: 'p1', examId: E1, roomId: 'r1-e1' }], rows, 'ruang 1');
    assert.deepEqual([none.moves, none.createFor, none.prune, none.alreadyThere], [[], [], [], 1]);

    // Cancelled exams are never given: their rows are neither counted nor pruned (F1).
    const live = planRoomMove([{ participantId: 'p1', examId: E1, roomId: 'r1-e1' }], [row('r1-e1', E1, 'Ruang 1', 1)], 'ruang 2');
    assert.deepEqual(live.prune, ['r1-e1']);
    assert.deepEqual(live.createFor, [E1]);
});

test('C01 E2 the display label of a room is the label of its earliest row; a new room keeps the typed label', () => {
    const rows = [row('a', E2, 'Ruang 1', 1), row('b', E1, 'RUANG 1', 1)];
    assert.equal(roomDisplayLabel(rows, 'ruang 1', 'ruang 1'), 'Ruang 1');
    assert.equal(roomDisplayLabel(rows, 'lab ipa', 'Lab IPA'), 'Lab IPA');
});

test('C01 E3 the Proctor set of a room is replaced as a whole: additions and removals together, an equal set is no change', () => {
    assert.deepEqual(planProctorSet([ID, ID2], [ID2, ID3]), { added: [ID3], removed: [ID], changed: true });
    assert.deepEqual(planProctorSet([ID], []), { added: [], removed: [ID], changed: true });
    assert.deepEqual(planProctorSet([ID2, ID], [ID, ID2]), { added: [], removed: [], changed: false });
    assert.deepEqual(planProctorSet([], []), { added: [], removed: [], changed: false });
});

test('C01 E7 a READY exam stays READY when it passes, goes back to SCHEDULED otherwise; others are not evaluated', () => {
    assert.equal(readinessDecision('READY', true), 'keep');
    assert.equal(readinessDecision('READY', false), 'demote');
    assert.equal(readinessDecision('SCHEDULED', false), 'not_evaluated');
    assert.equal(readinessDecision('SCHEDULED', true), 'not_evaluated');
    assert.equal(readinessDecision('READY', null), 'not_evaluated');
});

test('C01 E13 the room readiness view keeps the status, the blocker and the counts only', () => {
    assert.deepEqual(roomReadinessView({ type: 'not_ready', blocker: 'exam_room_empty' }), { status: 'not_ready', blocker: 'exam_room_empty' });
    assert.deepEqual(roomReadinessView({ type: 'not_ready', blocker: 'active_proctor_room_coverage_incomplete', examRoomCount: 2, coveredExamRoomCount: 1, uncoveredExamRoomCount: 1 }),
        { status: 'not_ready', blocker: 'active_proctor_room_coverage_incomplete', examRoomCount: 2, coveredExamRoomCount: 1, uncoveredExamRoomCount: 1 });
    assert.deepEqual(roomReadinessView({
        type: 'room_proctor_readiness_ready', tenantId: ID, examInstanceId: ID2, roomBasedOperationsEnabled: true, proctorPerRoomRequired: true,
        examRoomCount: 1, coveredExamRoomCount: 1, participantCount: 3, assignedParticipantCount: 3,
    }), { status: 'room_proctor_readiness_ready', examRoomCount: 1, coveredExamRoomCount: 1, participantCount: 3, assignedParticipantCount: 3 });
    assert.deepEqual(roomReadinessView({ type: 'room_proctor_readiness_not_applicable', tenantId: ID, examInstanceId: ID2, roomBasedOperationsEnabled: false, proctorPerRoomRequired: false }),
        { status: 'room_proctor_readiness_not_applicable' });
});

test('C01 the rooms error mapper translates every named constraint, then falls through to institutionFailure (F4)', () => {
    const pgError = (code: string, constraint?: string) => Object.assign(new Error(code), { code, constraint });
    const cases: Array<[string, string, unknown]> = [
        ['23505', 'uq_sa_institution_room_action_key', { status: 409, body: { error: 'action_key_reused' } }],
        ['23505', 'uq_sa_participant_addition_action_key', { status: 409, body: { error: 'action_key_reused' } }],
        ['23505', 'uq_sa_institution_room_action_revision', { status: 409, body: { error: 'stale_assignment' } }],
        ['23505', 'uq_sa_exam_participant_room_assignment_participant', { status: 409, body: { error: 'stale_assignment' } }],
        ['23505', 'uq_sa_exam_proctor_room_assignment_mapping', { status: 409, body: { error: 'stale_assignment' } }],
        ['23505', 'uq_sa_proctor_assignment_active', { status: 409, body: { error: 'stale_assignment' } }],
        ['23505', 'uq_sa_exam_participants_tenant_instance_person', { status: 422, body: { error: 'room_invalid', problems: [{ code: 'already_participant' }] } }],
        ['23505', 'uq_sa_participant_addition_entry_participant', { status: 422, body: { error: 'room_invalid', problems: [{ code: 'already_participant' }] } }],
        ['23505', 'uq_sa_institution_exam_room_label', { status: 422, body: { error: 'room_invalid', problems: [{ code: 'room_label_invalid' }] } }],
        ['23514', 'ck_sa_institution_exam_room_label', { status: 422, body: { error: 'room_invalid', problems: [{ code: 'room_label_invalid' }] } }],
        ['23514', 'ck_sa_institution_exam_room_frozen', { status: 409, body: { error: 'invalid_state' } }],
    ];
    for (const [code, constraint, expected] of cases) {
        assert.deepEqual(institutionRoomFailure(pgError(code, constraint)), expected, constraint);
        assert.deepEqual(matchRoomFailure(pgError(code, constraint)), expected, constraint);
    }
    // Anything else is the unchanged frame mapping.
    assert.equal(matchRoomFailure(pgError('23505', 'uq_other')), null);
    assert.deepEqual(institutionRoomFailure(pgError('23505', 'uq_other')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(institutionRoomFailure(pgError('23505', 'uq_sa_institution_period_action_key')), { status: 409, body: { error: 'action_key_reused' } });
    assert.deepEqual(institutionRoomFailure(pgError('40001')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(institutionRoomFailure(pgError('40P01')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(institutionRoomFailure(pgError('08006')), { status: 503, body: { error: 'persistence_unavailable' } });
    assert.deepEqual(institutionRoomFailure(pgError('23514', 'ck_other')), { status: 500, body: { error: 'internal_error' } });
    assert.deepEqual(institutionRoomFailure(new Error('unexpected')), { status: 500, body: { error: 'internal_error' } });
    // A refusal of the frame is never remapped.
    assert.equal(matchRoomFailure(new InstitutionRefusal(409, { error: 'stale_assignment', revision: 2 })), null);
    assert.deepEqual(institutionRoomFailure(new InstitutionRefusal(409, { error: 'stale_assignment', revision: 2 })), { status: 409, body: { error: 'stale_assignment', revision: 2 } });
});

test('C01 the edge of every new path, before any database work (N10): origin, method, body size, exact body, query', async () => {
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
    const writePaths = ['rooms/participants', 'rooms/proctors', 'participants'].map(p => `/api/v1/assessment/institution-exams/${p}`);
    try {
        for (const path of writePaths) {
            const foreign = await post(path, '{}', { Origin: 'https://elsewhere.example' });
            assert.equal(foreign.status, 403, path);
            assert.deepEqual(await foreign.json(), { error: 'origin_not_allowed' });
            const bad = await post(path, JSON.stringify({ actorPersonId: ID }));
            assert.equal(bad.status, 400, path);
            assert.deepEqual(await bad.json(), { error: 'invalid_request' });
            const wrong = await fetch(base + path, { method: 'PUT', body: '{}' });
            assert.equal(wrong.status, 405, path);
            const large = await post(path, JSON.stringify({ roomLabel: 'x'.repeat(64 * 1024) }));
            assert.equal(large.status, 413, path);
            assert.deepEqual(await large.json(), { error: 'payload_too_large' });
        }
        const duplicate = await post(writePaths[1], JSON.stringify({ sessionId: ID, roomLabel: 'Ruang 1', proctorElligbleIds: ['  ELG-ABCD-EFGH-JKMN ', 'elg-abcd-efgh-jkmn'], expectedRevision: 0, actionKey: ID2 }));
        assert.equal(duplicate.status, 400, 'equal normalized IDs before any connection');
        const rooms = '/api/v1/assessment/institution-exams/rooms';
        assert.equal((await fetch(`${base}${rooms}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 405);
        assert.equal((await fetch(`${base}${rooms}`)).status, 400, 'exactly one query key');
        assert.equal((await fetch(`${base}${rooms}?sessionId=nope`)).status, 400);
        assert.equal((await fetch(`${base}${rooms}?sessionId=${ID}&tenantId=${ID}`)).status, 400);
        assert.equal((await fetch(`${base}${rooms}?periodId=${ID}`)).status, 400);
        assert.equal((await fetch(`${base}${rooms}?sessionId=${ID}`)).status, 401, 'anonymous');
        assert.equal(connections, 0, 'nothing reached the database');
    } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});
