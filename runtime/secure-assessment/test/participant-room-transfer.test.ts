import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type * as pg from 'pg';
import {
    ROOM_TRANSFER_ROUTE, TRANSFER_BODY_KEYS, attemptRefusal, examRefusal, matchTransferFailure, parseRoomTransferRequest, rowRefusal,
    transferDigest, transferFailure, transferParticipant, transferReceipt, type RoomTransferRequest,
} from '../src/participant-room-transfer.ts';
import { readMonitoringProjection } from '../src/exam-monitoring.ts';
import { InstitutionRefusal } from '../src/institution-exams.ts';

// ASSESS-ROOM-001 C01 units: the exact body with the reason and confirmed rules; the E6 order (scope reads before any
// lock, the OR-4 lock order, the re-read after the attempt lock in a statement of its own, the NULL remaining case);
// the E9 digest and replay body; the transfer error mapper over every named constraint; the E10 viewer filter; and the
// N10 edge before any database work.

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';
const ID4 = '44444444-4444-4444-8444-444444444444';
const ROOM_FROM = '55555555-5555-4555-8555-555555555555';
const SESSION = '66666666-6666-4666-8666-666666666666';
const ATTEMPT = '77777777-7777-4777-8777-777777777777';
const OPERATOR = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002';
const TENANT = 'cccccccc-0000-4000-8000-000000000003';
const actor = { tenantId: TENANT, personId: OPERATOR };

const body = (over: Record<string, unknown> = {}) => ({
    examInstanceId: ID, participantId: ID2, targetRoomId: ID3, expectedAssignmentVersion: 1, reason: 'Perangkat ruang bermasalah', confirmed: true, actionKey: ID4, ...over,
});

test('C01 the transfer body is exact: three ids and a key as UUIDs, a version of at least 1, a reason in the 0054 form, confirmed true', () => {
    assert.deepEqual([...TRANSFER_BODY_KEYS].sort(), ['actionKey', 'confirmed', 'examInstanceId', 'expectedAssignmentVersion', 'participantId', 'reason', 'targetRoomId']);
    assert.deepEqual(parseRoomTransferRequest(body({ examInstanceId: ID.toUpperCase(), reason: '  Perangkat   ruang\tbermasalah ', actionKey: ID4.toUpperCase() })), {
        examInstanceId: ID, participantId: ID2, targetRoomId: ID3, expectedAssignmentVersion: 1, reason: 'Perangkat ruang bermasalah', actionKey: ID4,
    });
    for (const spoof of ['actorPersonId', 'tenantId', 'sessionId', 'fromRoomId', 'attemptId']) assert.equal(parseRoomTransferRequest(body({ [spoof]: ID })), null, spoof);
    for (const key of TRANSFER_BODY_KEYS) {
        const { [key]: _gone, ...missing } = body();
        assert.equal(parseRoomTransferRequest(missing), null, `without ${key}`);
    }
    for (const key of ['examInstanceId', 'participantId', 'targetRoomId', 'actionKey']) assert.equal(parseRoomTransferRequest(body({ [key]: 'nope' })), null, key);
    for (const version of [0, -1, 1.5, '1', null, Number.NaN]) assert.equal(parseRoomTransferRequest(body({ expectedAssignmentVersion: version })), null, String(version));
    assert.ok(parseRoomTransferRequest(body({ expectedAssignmentVersion: 7 })));
    for (const confirmed of [false, 'true', 1, null]) assert.equal(parseRoomTransferRequest(body({ confirmed })), null, String(confirmed));
    for (const reason of ['', '   ', 'x'.repeat(201), 12, null]) assert.equal(parseRoomTransferRequest(body({ reason })), null, String(reason));
    assert.equal(parseRoomTransferRequest(body({ reason: 'x'.repeat(200) }))?.reason, 'x'.repeat(200));
});

test('C01 E6 pure rules: state then room policy; no row, version, same room; the attempt re-read incl. NULL remaining', () => {
    assert.equal(examRefusal('ACTIVE', true), null);
    assert.equal(examRefusal('PAUSED', true), null);
    for (const state of ['SCHEDULED', 'READY', 'ENDED', 'FINALIZED']) assert.equal(examRefusal(state, false), 'invalid_state', `${state}: state before policy`);
    assert.equal(examRefusal('ACTIVE', false), 'room_setup_required');
    assert.equal(rowRefusal(null, 1, ID3), 'participant_without_room');
    assert.equal(rowRefusal({ roomId: ID3, version: 2 }, 1, ID3), 'stale_assignment', 'the version before the same room');
    assert.equal(rowRefusal({ roomId: ID3, version: 1 }, 1, ID3), 'already_in_room');
    assert.equal(rowRefusal({ roomId: ROOM_FROM, version: 1 }, 1, ID3), null);
    assert.equal(attemptRefusal({ open: false, anySubmitted: false, submitted: false, remaining: null }), null, 'not started');
    assert.equal(attemptRefusal({ open: false, anySubmitted: true, submitted: false, remaining: null }), 'attempt_already_submitted');
    assert.equal(attemptRefusal({ open: true, anySubmitted: true, submitted: true, remaining: 300 }), 'attempt_already_submitted', 'a submit seen by the re-read');
    assert.equal(attemptRefusal({ open: true, anySubmitted: false, submitted: false, remaining: null }), null, 'timer not started');
    assert.equal(attemptRefusal({ open: true, anySubmitted: false, submitted: false, remaining: 0 }), 'time_up');
    assert.equal(attemptRefusal({ open: true, anySubmitted: false, submitted: false, remaining: -5 }), 'time_up');
    assert.equal(attemptRefusal({ open: true, anySubmitted: false, submitted: false, remaining: 1 }), null);
});

/** Labels each statement of the transfer by what it does, so the order can be compared. */
function label(sql: string): string {
    if (sql.includes('AND action_key = $2')) return 'replay';
    if (sql.includes('i.institution_session_id IS NOT NULL')) return 'scope:exam';
    if (sql.includes('FROM secure_assessment_exam_participants WHERE')) return 'scope:participant';
    if (sql.startsWith('SELECT display_label FROM secure_assessment_exam_rooms')) return 'scope:target';
    if (sql.includes("'sa-institution-rooms:'")) return 'lock:session';
    if (sql.includes('JOIN tenant_tenants t ON t.id = s.tenant_id')) return 'read:session';
    if (sql.includes('FOR KEY SHARE OF i')) return 'lock:exam';
    if (sql.includes('FOR UPDATE OF ra')) return 'lock:row';
    if (sql.includes('FOR UPDATE OF a')) return 'lock:attempt';
    if (sql.includes('AS any_submitted')) return 'reread:attempt';
    if (sql.includes('AND id = $3 FOR SHARE')) return 'lock:target';
    if (sql.includes('FOR SHARE OF pa, m')) return 'lock:proctors';
    if (sql.startsWith('UPDATE secure_assessment_exam_participant_room_assignments')) return 'write:row';
    if (sql.includes('coalesce(max(revision), 0)')) return 'read:revision';
    if (sql.includes('INSERT INTO secure_assessment_institution_room_actions')) return 'write:action';
    if (sql.includes('INSERT INTO secure_assessment_institution_room_action_entries')) return 'write:entry';
    if (sql.includes('FROM secure_assessment_institution_room_action_entries e')) return 'replay:entry';
    return `unknown:${sql.slice(0, 40)}`;
}

type Rows = Array<Record<string, unknown>>;
const ACTED = new Date('2026-11-11T01:10:00.123Z');
const DEFAULTS: Record<string, Rows> = {
    'replay': [],
    'scope:exam': [{ institution_session_id: SESSION }],
    'scope:participant': [{ '?column?': 1 }],
    'scope:target': [{ display_label: 'Ruang 2' }],
    'lock:session': [{}],
    'read:session': [{ id: SESSION, starts_at: ACTED, ends_at: ACTED, period_label: 'PTS', academic_period_id: ID, session_day: '2026-11-11' }],
    'lock:exam': [{ lifecycle_state: 'ACTIVE', institution_session_id: SESSION, room_based: true, room_policy: true }],
    'lock:row': [{ id: ID4, exam_room_id: ROOM_FROM, assignment_version: 1, display_label: 'Ruang 1' }],
    'lock:attempt': [{ id: ATTEMPT }],
    'reread:attempt': [{ any_submitted: false, submitted: false, remaining: 1200 }],
    'lock:target': [{ id: ID3 }],
    'lock:proctors': [{ id: ID }],
    'write:row': [{ assignment_version: 2 }],
    'read:revision': [{ revision: 3 }],
    'write:action': [{ id: ID, acted_at: ACTED }],
    'write:entry': [],
};

function scripted(over: Record<string, Rows> = {}) {
    const statements: string[] = [];
    const params: Record<string, unknown[]> = {};
    const client = {
        query: async (sql: string, values: unknown[] = []) => {
            const name = label(sql.trim());
            statements.push(name);
            params[name] = values;
            return { rows: over[name] ?? DEFAULTS[name] ?? [] };
        },
    } as unknown as pg.PoolClient;
    return { client, statements, params };
}

const request: RoomTransferRequest = { examInstanceId: ID, participantId: ID2, targetRoomId: ID3, expectedAssignmentVersion: 1, reason: 'Perangkat ruang bermasalah', actionKey: ID4 };
const FULL_ORDER = [
    'replay', 'scope:exam', 'scope:participant', 'scope:target', 'lock:session', 'read:session', 'lock:exam', 'lock:row', 'lock:attempt',
    'reread:attempt', 'lock:target', 'lock:proctors', 'write:row', 'read:revision', 'write:action', 'write:entry',
];

async function refusal(over: Record<string, Rows>, req: RoomTransferRequest = request) {
    const run = scripted(over);
    try {
        await transferParticipant(run.client, actor, req);
    } catch (error) {
        assert.ok(error instanceof InstitutionRefusal, String(error));
        return { status: error.status, body: error.body, statements: run.statements };
    }
    assert.fail('the transfer was expected to refuse');
}

test('C01 E6 and OR-4: scope reads before any lock, then session, exam, row, attempt (re-read in its own statement), target; writes last', async () => {
    const run = scripted();
    const outcome = await transferParticipant(run.client, actor, request);
    assert.deepEqual(run.statements, FULL_ORDER);
    assert.deepEqual(outcome, {
        status: 200,
        body: { examInstanceId: ID, participantId: ID2, fromRoomLabel: 'Ruang 1', roomLabel: 'Ruang 2', assignmentVersion: 2, transferredAt: ACTED.toISOString(), revision: 4, replayed: false },
    });
    // The writes: the row by its id with the target; the action with revision + 1, the reason and the digest; the entry with the labels, version and attempt.
    assert.deepEqual(run.params['write:row'], [TENANT, ID4, ID3]);
    assert.deepEqual(run.params['write:action'], [TENANT, SESSION, 4, OPERATOR, ID4, transferDigest(actor, request), 'Perangkat ruang bermasalah']);
    assert.deepEqual(run.params['write:entry'], [TENANT, ID, ID, ID2, 'Ruang 1', 'Ruang 2', 2, ATTEMPT]);
    // Each lock query is scoped by tenant, exam or participant.
    assert.deepEqual(run.params['lock:row'], [TENANT, ID, ID2]);
    assert.deepEqual(run.params['lock:attempt'], [TENANT, ID2]);
    assert.deepEqual(run.params['reread:attempt'], [TENANT, ID2, ATTEMPT]);
    assert.deepEqual(run.params['lock:proctors'], [TENANT, ID, ID3]);
});

test('C01 E6 the first failing check decides, and nothing is written', async () => {
    const writes = (statements: string[]) => statements.filter(s => s.startsWith('write:'));
    const cases: Array<[string, Record<string, Rows>, number, Record<string, unknown>, string]> = [
        ['1. exam', { 'scope:exam': [], 'scope:participant': [], 'lock:exam': [{ lifecycle_state: 'READY', room_policy: false }] }, 403, { error: 'forbidden' }, 'scope:exam'],
        ['2. participant', { 'scope:participant': [], 'scope:target': [] }, 403, { error: 'forbidden' }, 'scope:participant'],
        ['3. target', { 'scope:target': [] }, 403, { error: 'forbidden' }, 'scope:target'],
        ['4. state', { 'lock:exam': [{ lifecycle_state: 'READY', institution_session_id: SESSION, room_policy: false }] }, 409, { error: 'invalid_state', examInstanceId: ID, currentState: 'READY' }, 'lock:exam'],
        ['5. room policy', { 'lock:exam': [{ lifecycle_state: 'ACTIVE', institution_session_id: SESSION, room_policy: false }], 'lock:row': [] }, 409, { error: 'room_setup_required' }, 'lock:exam'],
        ['6. no row', { 'lock:row': [] }, 409, { error: 'participant_without_room' }, 'lock:row'],
        ['7. version', { 'lock:row': [{ id: ID4, exam_room_id: ID3, assignment_version: 2, display_label: 'Ruang 2' }] }, 409, { error: 'stale_assignment', assignmentVersion: 2, roomLabel: 'Ruang 2' }, 'lock:row'],
        ['8. same room', { 'lock:row': [{ id: ID4, exam_room_id: ID3, assignment_version: 1, display_label: 'Ruang 2' }] }, 409, { error: 'already_in_room' }, 'lock:row'],
        ['9. submitted while waiting', { 'reread:attempt': [{ any_submitted: true, submitted: true, remaining: 900 }], 'lock:proctors': [] }, 409, { error: 'attempt_already_submitted' }, 'reread:attempt'],
        ['9. only a submitted attempt', { 'lock:attempt': [], 'reread:attempt': [{ any_submitted: true, submitted: false, remaining: null }] }, 409, { error: 'attempt_already_submitted' }, 'reread:attempt'],
        ['9. expired', { 'reread:attempt': [{ any_submitted: false, submitted: false, remaining: 0 }] }, 409, { error: 'time_up' }, 'reread:attempt'],
        ['10. unsupervised', { 'lock:proctors': [] }, 409, { error: 'target_room_unsupervised' }, 'lock:proctors'],
    ];
    for (const [name, over, status, expected, last] of cases) {
        const r = await refusal(over);
        assert.deepEqual([r.status, r.body], [status, expected], name);
        assert.equal(r.statements.at(-1), last, `${name}: stops at its check`);
        assert.deepEqual(writes(r.statements), [], `${name}: nothing written`);
        if (status === 403) assert.ok(!r.statements.some(s => s.startsWith('lock:')), `${name}: refused before any object lock`);
    }
});

test('C01 E6 step 9 eligibility: no attempt (not started) and a timer not started (NULL remaining) both move', async () => {
    let run = scripted({ 'lock:attempt': [], 'reread:attempt': [{ any_submitted: false, submitted: false, remaining: null }] });
    let outcome = await transferParticipant(run.client, actor, request);
    assert.equal(outcome.status, 200);
    assert.deepEqual(run.params['reread:attempt'], [TENANT, ID2, null]);
    assert.equal(run.params['write:entry'].at(-1), null, 'the entry carries a NULL attempt');
    run = scripted({ 'reread:attempt': [{ any_submitted: false, submitted: false, remaining: null }] });
    outcome = await transferParticipant(run.client, actor, request);
    assert.equal(outcome.status, 200);
    assert.equal(run.params['write:entry'].at(-1), ATTEMPT);
    // The re-read is a statement of its own after the attempt lock (F1), never folded into the lock query.
    const at = run.statements.indexOf('lock:attempt');
    assert.equal(run.statements[at + 1], 'reread:attempt');
});

test('C01 E9 the digest covers the whole intent; a replay returns the stored receipt; another kind, actor or body is action_key_reused', async () => {
    const digest = transferDigest(actor, request);
    assert.match(digest, /^[0-9a-f]{64}$/);
    for (const change of [{ examInstanceId: ID2 }, { participantId: ID3 }, { targetRoomId: ID }, { expectedAssignmentVersion: 2 }, { reason: 'Alasan lain' }]) {
        assert.notEqual(transferDigest(actor, { ...request, ...change }), digest, JSON.stringify(change));
    }
    assert.notEqual(transferDigest({ ...actor, personId: OTHER }, request), digest, 'the actor is part of the digest');
    assert.equal(transferDigest(actor, { ...request, actionKey: ID }), digest, 'the key is not part of the digest');

    const stored = { id: ID, kind: 'PARTICIPANT_TRANSFER', actor_person_id: OPERATOR, request_digest: digest, revision: 4, demoted_exam_instance_ids: [], session_id: SESSION };
    const entry = { exam_instance_id: ID, exam_participant_id: ID2, from_room_label: 'Ruang 1', room_label: 'Ruang 2', assignment_version: 2, acted_at: ACTED, revision: 4 };
    const run = scripted({ 'replay': [stored], 'replay:entry': [entry] });
    const replay = await transferParticipant(run.client, actor, request);
    assert.deepEqual(run.statements, ['replay', 'replay:entry'], 'never re-evaluated, no lock and no write');
    assert.deepEqual(replay, {
        status: 200,
        body: { examInstanceId: ID, participantId: ID2, fromRoomLabel: 'Ruang 1', roomLabel: 'Ruang 2', assignmentVersion: 2, transferredAt: ACTED.toISOString(), revision: 4, replayed: true },
    });
    for (const earlier of [{ ...stored, kind: 'ROOM_PARTICIPANTS' }, { ...stored, actor_person_id: OTHER }, { ...stored, request_digest: 'f'.repeat(64) }]) {
        const r = await refusal({ 'replay': [earlier], 'replay:entry': [entry] });
        assert.deepEqual([r.status, r.body], [409, { error: 'action_key_reused' }]);
        assert.deepEqual(r.statements, ['replay']);
    }
    assert.deepEqual(transferReceipt({ examInstanceId: ID, participantId: ID2, fromRoomLabel: 'A', roomLabel: 'B', assignmentVersion: 3, actedAt: ACTED.toISOString(), revision: 9 }, true),
        { examInstanceId: ID, participantId: ID2, fromRoomLabel: 'A', roomLabel: 'B', assignmentVersion: 3, transferredAt: ACTED.toISOString(), revision: 9, replayed: true });
    assert.ok(!JSON.stringify(replay).includes('Perangkat ruang bermasalah'), 'no response carries the reason (F5)');
});

test('C01 the transfer error mapper: every named constraint, then the unchanged room and frame mapping', () => {
    const pgError = (code: string, constraint?: string) => Object.assign(new Error(code), { code, constraint });
    const cases: Array<[string, string, unknown]> = [
        ['23505', 'uq_sa_institution_room_action_key', { status: 409, body: { error: 'action_key_reused' } }],
        ['23505', 'uq_sa_institution_room_action_revision', { status: 409, body: { error: 'stale_assignment' } }],
        ['23514', 'ck_sa_institution_room_transfer_scope', { status: 403, body: { error: 'forbidden' } }],
        ['23514', 'ck_sa_institution_room_action_transfer', { status: 403, body: { error: 'forbidden' } }],
        ['23514', 'ck_sa_institution_room_entry_shape', { status: 403, body: { error: 'forbidden' } }],
        ['23505', 'uq_sa_exam_participant_room_assignment_participant', { status: 409, body: { error: 'stale_assignment' } }],
        ['23514', 'ck_sa_institution_exam_room_frozen', { status: 409, body: { error: 'invalid_state' } }],
    ];
    for (const [code, constraint, expected] of cases) {
        assert.deepEqual(transferFailure(pgError(code, constraint)), expected, constraint);
        assert.deepEqual(matchTransferFailure(pgError(code, constraint)), expected, constraint);
    }
    assert.equal(matchTransferFailure(pgError('23505', 'uq_other')), null);
    assert.deepEqual(transferFailure(pgError('23505', 'uq_other')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(transferFailure(pgError('40P01')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(transferFailure(pgError('40001')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(transferFailure(pgError('08006')), { status: 503, body: { error: 'persistence_unavailable' } });
    assert.deepEqual(transferFailure(pgError('23514', 'ck_other')), { status: 500, body: { error: 'internal_error' } });
    const refused = new InstitutionRefusal(409, { error: 'time_up' });
    assert.equal(matchTransferFailure(refused), null, 'a refusal is never remapped');
    assert.deepEqual(transferFailure(refused), { status: 409, body: { error: 'time_up' } });
});

test('C01 E10 only the Operator viewer that asks gets roomId, assignmentVersion and supervised; every other projection is unchanged', async () => {
    const at = new Date('2026-11-11T01:00:00Z');
    let statements: string[] = [];
    const client = {
        query: async (sql: string) => {
            statements.push(sql);
            if (sql.includes('identity_person_account_bindings')) return { rows: [{ person_id: 'p-s1', username: 'siswa.satu' }] };
            if (sql.includes('AS paused_at')) return { rows: [{ subject_label: 'Matematika', db_now: at, paused_at: null }] };
            if (sql.includes('secure_assessment_exam_question_snapshots WHERE')) return { rows: [{ n: 2 }] };
            if (sql.includes('AS session_moves')) {
                return { rows: [{
                    participant_id: ID2, person_id: 'p-s1', room_label: 'Ruang 1', room_id: ROOM_FROM, assignment_version: 3, attempt_id: ATTEMPT, locked_at: null,
                    started_at: at, remaining_seconds: 900, submitted_at: null, finalization_source: null, answered: 1, last_accepted_at: at, added_seconds: 0,
                    session_active: true, session_moves: 0,
                }] };
            }
            if (sql.includes('SELECT DISTINCT m.exam_room_id')) return { rows: [{ exam_room_id: ROOM_FROM }] };
            if (sql.includes('SELECT r.id, r.display_label FROM secure_assessment_exam_rooms r')) return { rows: [{ id: ROOM_FROM, display_label: 'Ruang 1' }, { id: ID3, display_label: 'Ruang 2' }] };
            return { rows: [] };
        },
    } as unknown as pg.PoolClient;
    const viewer = { roomFilter: null, roomBased: true, lifecycleState: 'ACTIVE', canAddTime: true, timeAdditions: 'own_reasons' as const };
    const operator = await readMonitoringProjection(client, actor, ID, { ...viewer, scope: 'OPERATOR', roomTransfer: true });
    assert.deepEqual([operator.participants[0].roomId, operator.participants[0].assignmentVersion], [ROOM_FROM, 3]);
    assert.deepEqual(operator.rooms, [{ roomId: ROOM_FROM, label: 'Ruang 1', supervised: true }, { roomId: ID3, label: 'Ruang 2', supervised: false }]);

    statements = [];
    const plainOperator = await readMonitoringProjection(client, actor, ID, { ...viewer, scope: 'OPERATOR' });
    const proctor = await readMonitoringProjection(client, actor, ID, { ...viewer, scope: 'PROCTOR', roomTransfer: true, canAddTime: false, timeAdditions: 'none' });
    const teacher = await readMonitoringProjection(client, actor, ID, { ...viewer, scope: 'TEACHER', roomTransfer: true, timeAdditions: 'with_reasons' });
    for (const [name, projection] of [['operator without the flag', plainOperator], ['proctor', proctor], ['teacher', teacher]] as const) {
        assert.ok(!('roomId' in projection.participants[0]) && !('assignmentVersion' in projection.participants[0]), name);
        assert.deepEqual(projection.rooms, [{ roomId: ROOM_FROM, label: 'Ruang 1' }, { roomId: ID3, label: 'Ruang 2' }], name);
    }
    assert.ok(!statements.some(sql => sql.includes('SELECT DISTINCT m.exam_room_id')), 'no coverage query for any other viewer');
    for (const key of ['fullName', 'name', 'nis', 'nisn', 'birthDate', 'sessionId', 'activeSessionFingerprint', 'answer', 'score', 'reason']) {
        assert.ok(!JSON.stringify(operator).includes(`"${key}"`), key);
    }
});

test('C01 the edge of the transfer path, before any database work (N10): origin, method, body size, exact body', async () => {
    const { createServer } = await import('../src/server.ts');
    let connections = 0;
    const pool = {
        connect: async () => { connections++; throw new Error('database unavailable'); },
        query: async () => { connections++; throw new Error('database unavailable'); },
    };
    const server = createServer({ checkReadiness: async () => false, pool: pool as never, security: { cookie: { secure: false }, allowedOrigins: [], hsts: false } });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const post = (payload: string, headers: Record<string, string> = {}) =>
        fetch(base + ROOM_TRANSFER_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: payload });
    try {
        const foreign = await post(JSON.stringify(body()), { Origin: 'https://elsewhere.example' });
        assert.deepEqual([foreign.status, await foreign.json()], [403, { error: 'origin_not_allowed' }]);
        const large = await post(JSON.stringify({ ...body(), reason: 'x'.repeat(65 * 1024) }));
        assert.deepEqual([large.status, await large.json()], [413, { error: 'payload_too_large' }]);
        for (const bad of [body({ actorPersonId: OPERATOR }), body({ tenantId: TENANT }), body({ confirmed: false }), body({ reason: ' ' }), body({ expectedAssignmentVersion: 0 })]) {
            const r = await post(JSON.stringify(bad));
            assert.deepEqual([r.status, await r.json()], [400, { error: 'invalid_request' }], JSON.stringify(bad));
        }
        const { reason: _r, ...noReason } = body();
        assert.equal((await post(JSON.stringify(noReason))).status, 400, 'a missing reason');
        assert.equal((await post('not json')).status, 400);
        for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await fetch(base + ROOM_TRANSFER_ROUTE, { method })).status, 405, method);
        const anonymous = await post(JSON.stringify(body()));
        assert.equal(anonymous.status, 401, 'anonymous');
        assert.equal(connections, 0, 'nothing reached the database');
    } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});
