import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type * as pg from 'pg';
import {
    CONTROL_TRANSITIONS, FORBIDDEN_RESPONSE_KEYS, SKIP_CODES, TRANSITION_STATES, classifySessionExam, coreRefusal, evaluateTransition,
    examReplayBody, examsToLock, forbiddenKeysIn, institutionControlFailure, lockReplayBody, matchControlFailure, nothingApplicable,
    parseBroadcastControl, parseLockControl, parseTimeControl, parseTransitionControl, sessionReplayBody, type TransitionRow,
} from '../src/school-exam-monitoring.ts';
import { readMonitoringProjection } from '../src/exam-monitoring.ts';
import { InstitutionRefusal } from '../src/institution-exams.ts';

// ASSESS-INSTITUTION-003 C01 units: the exact bodies of the six routes with the reason and confirmation rules and the
// session-or-exam transition shapes; the E7 check order; the E9 table (from-state and NO_OP state per action, which
// exams are locked, each outcome and skip code, nothing_applicable); the E11 replay bodies; the controls error mapper
// over every named constraint and core result; the E5 projection filters (no other actor's reason, no forbidden key);
// and the N10 edge of every new path before any database work.

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';
const OPERATOR = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002';
const TENANT = 'cccccccc-0000-4000-8000-000000000003';

test('C01 transition bodies are exact: an exam or a session, the four actions, a reason and confirmed true', () => {
    const byExam = { examInstanceId: ID.toUpperCase(), action: 'pause', reason: '  Listrik   padam ', confirmed: true, actionKey: ID2.toUpperCase() };
    assert.deepEqual(parseTransitionControl(byExam), { target: { examInstanceId: ID }, action: 'pause', reason: 'Listrik padam', actionKey: ID2 });
    const bySession = { sessionId: ID, action: 'activate', reason: 'Sesi dimulai', confirmed: true, actionKey: ID2 };
    assert.deepEqual(parseTransitionControl(bySession), { target: { sessionId: ID }, action: 'activate', reason: 'Sesi dimulai', actionKey: ID2 });
    for (const action of CONTROL_TRANSITIONS) assert.ok(parseTransitionControl({ ...byExam, action }), action);
    for (const action of ['mark_ready', 'finalize', 'cancel', '']) assert.equal(parseTransitionControl({ ...byExam, action }), null, action);
    assert.equal(parseTransitionControl({ ...byExam, sessionId: ID }), null, 'never both an exam and a session');
    for (const spoof of ['actorPersonId', 'tenantId', 'participantId']) assert.equal(parseTransitionControl({ ...byExam, [spoof]: ID }), null, spoof);
    assert.equal(parseTransitionControl({ ...byExam, confirmed: 'true' }), null, 'confirmed is true itself');
    assert.equal(parseTransitionControl({ ...byExam, confirmed: false }), null);
    assert.equal(parseTransitionControl({ ...byExam, reason: '   ' }), null, 'a reason that normalizes to nothing');
    assert.equal(parseTransitionControl({ ...byExam, reason: 'x'.repeat(201) }), null, 'more than 200 characters');
    assert.ok(parseTransitionControl({ ...byExam, reason: 'x'.repeat(200) }));
    assert.equal(parseTransitionControl({ ...byExam, actionKey: 'nope' }), null);
    assert.equal(parseTransitionControl({ ...byExam, examInstanceId: 'nope' }), null);
    const { reason: _r, ...noReason } = byExam;
    assert.equal(parseTransitionControl(noReason), null, 'OC-4: a reason on every control');
});

test('C01 lock, added-time and message bodies are exact, each with a reason (OC-4) and confirmed true', () => {
    const lock = { examInstanceId: ID, participantId: ID2.toUpperCase(), action: 'unlock', reason: 'Perangkat pulih', confirmed: true, actionKey: ID3 };
    assert.deepEqual(parseLockControl(lock), { examInstanceId: ID, participantId: ID2, action: 'unlock', reason: 'Perangkat pulih', actionKey: ID3 });
    assert.equal(parseLockControl({ ...lock, action: 'pause' }), null);
    assert.equal(parseLockControl({ ...lock, confirmed: undefined }), null);
    assert.equal(parseLockControl({ ...lock, attemptId: ID }), null);
    const { reason: _l, ...lockNoReason } = lock;
    assert.equal(parseLockControl(lockNoReason), null);

    const time = { examInstanceId: ID.toUpperCase(), participantId: ID2, minutes: 10, reason: 'Listrik padam', confirmed: true, actionKey: ID3 };
    assert.deepEqual(parseTimeControl(time), { examInstanceId: ID, participantId: ID2, minutes: 10, reason: 'Listrik padam', actionKey: ID3 });
    assert.equal(parseTimeControl({ ...time, minutes: 121 }), null, 'MAX_ADDED_MINUTES');
    assert.equal(parseTimeControl({ ...time, minutes: 0 }), null);
    assert.equal(parseTimeControl({ ...time, minutes: 1.5 }), null);
    assert.ok(parseTimeControl({ ...time, minutes: 120 }));
    assert.equal(parseTimeControl({ ...time, confirmed: false }), null);
    assert.equal(parseTimeControl({ ...time, actorPersonId: OPERATOR }), null);

    const message = { examInstanceId: ID, target: { scope: 'ROOM', roomId: ID2.toUpperCase() }, message: ' Harap  tenang ', reason: 'Ruang ramai', confirmed: true, actionKey: ID3 };
    assert.deepEqual(parseBroadcastControl(message), { examInstanceId: ID, target: { scope: 'ROOM', roomId: ID2 }, message: 'Harap tenang', reason: 'Ruang ramai', actionKey: ID3 });
    assert.deepEqual(parseBroadcastControl({ ...message, target: { scope: 'EXAM' } })?.target, { scope: 'EXAM' });
    assert.deepEqual(parseBroadcastControl({ ...message, target: { scope: 'PARTICIPANTS', participantIds: [ID2, ID2.toUpperCase()] } })?.target,
        { scope: 'PARTICIPANTS', participantIds: [ID2] });
    assert.equal(parseBroadcastControl({ ...message, target: { scope: 'EXAM', roomId: ID2 } }), null, 'exactly the keys of the target');
    assert.equal(parseBroadcastControl({ ...message, target: { scope: 'PARTICIPANTS', participantIds: Array.from({ length: 201 }, () => ID2) } }), null);
    assert.equal(parseBroadcastControl({ ...message, message: 'x'.repeat(201) }), null);
    const { reason: _m, ...messageNoReason } = message;
    assert.equal(parseBroadcastControl(messageNoReason), null, 'OC-4: a message needs a reason too');
});

test('C01 E9 the from-state and NO_OP state per action; only those exams are locked, by id', () => {
    assert.deepEqual(TRANSITION_STATES, {
        activate: { from: 'READY', noOp: null, to: 'ACTIVE' },
        pause: { from: 'ACTIVE', noOp: 'PAUSED', to: 'PAUSED' },
        resume: { from: 'PAUSED', noOp: 'ACTIVE', to: 'ACTIVE' },
        end: { from: 'ACTIVE', noOp: 'ENDED', to: 'ENDED' },
    });
    const read = [
        { id: ID3, lifecycleState: 'ACTIVE' }, { id: ID, lifecycleState: 'READY' }, { id: ID2, lifecycleState: 'PAUSED' },
        { id: 'dddddddd-0000-4000-8000-000000000004', lifecycleState: 'SCHEDULED' }, { id: 'eeeeeeee-0000-4000-8000-000000000005', lifecycleState: 'ENDED' },
    ];
    // F5: an activate shortcut never locks an ACTIVE exam.
    assert.deepEqual(examsToLock('activate', read), [ID]);
    assert.deepEqual(examsToLock('pause', read), [ID2, ID3]);
    assert.deepEqual(examsToLock('resume', read), [ID2, ID3]);
    assert.deepEqual(examsToLock('end', read), [ID3, 'eeeeeeee-0000-4000-8000-000000000005']);
});

test('C01 E9 outcomes: from-state goes to the core, NO_OP state is NO_OP, everything else is SKIPPED invalid_state with the state read', () => {
    assert.equal(classifySessionExam('pause', ID, 'ACTIVE', true), null, 'evaluated by the core');
    assert.deepEqual(classifySessionExam('pause', ID, 'PAUSED', true), { examInstanceId: ID, outcome: 'NO_OP', previousState: 'PAUSED', resultingState: 'PAUSED' });
    assert.deepEqual(classifySessionExam('pause', ID, 'ENDED', true), {
        examInstanceId: ID, outcome: 'SKIPPED', previousState: 'ENDED', resultingState: 'ENDED', skip: { code: 'invalid_state', currentState: 'ENDED' },
    }, 'locked, but moved while waiting');
    assert.deepEqual(classifySessionExam('activate', ID, 'ACTIVE', false), {
        examInstanceId: ID, outcome: 'SKIPPED', previousState: 'ACTIVE', resultingState: 'ACTIVE', skip: { code: 'invalid_state', currentState: 'ACTIVE' },
    }, 'not locked');
    assert.equal(classifySessionExam('activate', ID, 'READY', false)?.outcome, 'SKIPPED', 'an unlocked exam never reaches the core');
    assert.deepEqual(SKIP_CODES, ['invalid_state', 'room_setup_required', 'window_not_started', 'window_closed', 'not_ready']);
    const skipped = { examInstanceId: ID, outcome: 'SKIPPED' as const, previousState: 'SCHEDULED', resultingState: 'SCHEDULED' };
    assert.equal(nothingApplicable([]), true, 'a session with no exam');
    assert.equal(nothingApplicable([skipped, skipped]), true);
    assert.equal(nothingApplicable([skipped, { ...skipped, outcome: 'NO_OP' }]), false);
    assert.equal(nothingApplicable([{ ...skipped, outcome: 'APPLIED' }]), false);
});

/** A client that answers nothing: the checks it reaches before any query are the ones under test. */
function silentClient() {
    const statements: string[] = [];
    const client = { query: async (sql: string) => { statements.push(sql); throw new Error('no database in a unit test'); } };
    return { client: client as unknown as pg.PoolClient, statements };
}

test('C01 E7 order: state, then room flags, then window; nothing reaches the database before readiness', async () => {
    const actor = { tenantId: TENANT, personId: OPERATOR };
    const now = new Date('2026-11-10T01:00:00Z');
    const row = (over: Partial<TransitionRow>): TransitionRow => ({
        id: ID, institution_session_id: ID2, lifecycle_state: 'READY', room_policy: true,
        window_starts_at: new Date('2026-11-10T00:30:00Z'), window_ends_at: new Date('2026-11-10T03:00:00Z'), db_now: now, ...over,
    });
    const run = async (action: 'activate' | 'pause', over: Partial<TransitionRow>) => {
        const { client, statements } = silentClient();
        const result = await evaluateTransition(client, actor, action, row(over));
        return { result, statements };
    };
    let r = await run('activate', { lifecycle_state: 'ACTIVE', room_policy: false });
    assert.deepEqual(r.result, { applied: false, refusal: { type: 'invalid_state', currentState: 'ACTIVE' } }, '1. state first');
    r = await run('activate', { room_policy: false, window_starts_at: new Date('2026-11-10T02:00:00Z') });
    assert.deepEqual(r.result, { applied: false, refusal: { type: 'room_setup_required' } }, '2. room flags before the window');
    r = await run('activate', { window_starts_at: new Date('2026-11-10T02:00:00Z') });
    assert.deepEqual(r.result, { applied: false, refusal: { type: 'window_not_started', windowStartsAt: '2026-11-10T02:00:00.000Z' } }, '3. window');
    r = await run('activate', { window_ends_at: now });
    assert.deepEqual(r.result, { applied: false, refusal: { type: 'window_closed' } }, 'from the window end');
    assert.equal(r.statements.length, 0, 'every check above ran before any query');
    r = await run('pause', { lifecycle_state: 'PAUSED', room_policy: false });
    assert.deepEqual(r.result, { applied: true, resultingState: 'PAUSED', changed: false }, 'an idempotent repeat is a no-op, without the room flags');
    r = await run('pause', { lifecycle_state: 'READY' });
    assert.deepEqual(r.result, { applied: false, refusal: { type: 'invalid_state', currentState: 'READY' } });
});

test('C01 E11 replay bodies are rebuilt from the stored entries, never re-evaluated', () => {
    assert.deepEqual(examReplayBody({ examInstanceId: ID, outcome: 'APPLIED', previousState: 'READY', resultingState: 'ACTIVE', skipCode: null }),
        { examInstanceId: ID, lifecycleState: 'ACTIVE', changed: true, replayed: true });
    assert.deepEqual(examReplayBody({ examInstanceId: ID, outcome: 'NO_OP', previousState: 'PAUSED', resultingState: 'PAUSED', skipCode: null }),
        { examInstanceId: ID, lifecycleState: 'PAUSED', changed: false, replayed: true });
    assert.deepEqual(sessionReplayBody(ID3, 'activate', [
        { examInstanceId: ID2, outcome: 'SKIPPED', previousState: 'READY', resultingState: 'READY', skipCode: 'window_not_started' },
        { examInstanceId: ID, outcome: 'APPLIED', previousState: 'READY', resultingState: 'ACTIVE', skipCode: null },
        { examInstanceId: ID3, outcome: 'SKIPPED', previousState: 'SCHEDULED', resultingState: 'SCHEDULED', skipCode: 'invalid_state' },
    ]), {
        sessionId: ID3, action: 'activate', replayed: true,
        results: [
            { examInstanceId: ID, outcome: 'APPLIED', previousState: 'READY', resultingState: 'ACTIVE' },
            { examInstanceId: ID2, outcome: 'SKIPPED', previousState: 'READY', resultingState: 'READY', skip: { code: 'window_not_started' } },
            { examInstanceId: ID3, outcome: 'SKIPPED', previousState: 'SCHEDULED', resultingState: 'SCHEDULED', skip: { code: 'invalid_state', currentState: 'SCHEDULED' } },
        ],
    }, 'id order; a replayed skip carries only its code and the state read');
    const at = '2026-11-10T01:02:03.000Z';
    assert.deepEqual(lockReplayBody(ID2, { examInstanceId: ID, outcome: 'APPLIED', previousState: 'UNLOCKED', resultingState: 'LOCKED', skipCode: null }, at),
        { participantId: ID2, locked: true, changed: true, lockedAt: at, replayed: true });
    assert.deepEqual(lockReplayBody(ID2, { examInstanceId: ID, outcome: 'NO_OP', previousState: 'UNLOCKED', resultingState: 'UNLOCKED', skipCode: null }, at),
        { participantId: ID2, locked: false, changed: false, lockedAt: null, replayed: true });
});

test('C01 the controls error mapper: every named constraint, then the unchanged institutionFailure', () => {
    const pgError = (code: string, constraint?: string) => Object.assign(new Error(code), { code, constraint });
    const cases: Array<[string, string, unknown]> = [
        ['23505', 'uq_sa_institution_control_action_key', { status: 409, body: { error: 'action_key_reused' } }],
        ['23505', 'uq_sa_timer_adj_action_key', { status: 409, body: { error: 'action_key_reused' } }],
        ['23505', 'uq_sa_institution_control_entry_exam', { status: 409, body: { error: 'state_changed' } }],
        ['23505', 'uq_sa_exam_pauses_open', { status: 409, body: { error: 'state_changed' } }],
        ['23505', 'uq_sa_attempt_locks_open', { status: 409, body: { error: 'state_changed' } }],
        ['23514', 'ck_sa_institution_control_session', { status: 403, body: { error: 'forbidden' } }],
        ['23514', 'ck_sa_institution_control_entry_scope', { status: 403, body: { error: 'forbidden' } }],
    ];
    for (const [code, constraint, expected] of cases) {
        assert.deepEqual(institutionControlFailure(pgError(code, constraint)), expected, constraint);
        assert.deepEqual(matchControlFailure(pgError(code, constraint)), expected, constraint);
    }
    assert.equal(matchControlFailure(pgError('23505', 'uq_other')), null);
    assert.deepEqual(institutionControlFailure(pgError('23505', 'uq_other')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(institutionControlFailure(pgError('40001')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(institutionControlFailure(pgError('40P01')), { status: 409, body: { error: 'state_changed' } });
    assert.deepEqual(institutionControlFailure(pgError('08006')), { status: 503, body: { error: 'persistence_unavailable' } });
    assert.deepEqual(institutionControlFailure(pgError('23514', 'ck_other')), { status: 500, body: { error: 'internal_error' } });
    assert.equal(matchControlFailure(new InstitutionRefusal(409, { error: 'nothing_applicable', results: [] })), null, 'a refusal is never remapped');
});

test('C01 core results map to the §4.2 answers', () => {
    const readiness = { baseline: { status: 'not_ready', blocker: 'x' }, roomProctor: { status: 'not_evaluated' } };
    const cases: Array<[Record<string, unknown>, unknown]> = [
        [{ type: 'forbidden' }, { status: 403, body: { error: 'forbidden' } }],
        [{ type: 'invalid_state', currentState: 'ENDED' }, { status: 409, body: { error: 'invalid_state', examInstanceId: ID, currentState: 'ENDED' } }],
        [{ type: 'room_setup_required' }, { status: 409, body: { error: 'room_setup_required' } }],
        [{ type: 'not_ready', readiness }, { status: 409, body: { error: 'not_ready', readiness } }],
        [{ type: 'window_not_started', windowStartsAt: '2026-11-10T02:00:00.000Z' }, { status: 409, body: { error: 'window_not_started', windowStartsAt: '2026-11-10T02:00:00.000Z' } }],
        [{ type: 'window_closed' }, { status: 409, body: { error: 'window_closed' } }],
        [{ type: 'no_active_attempt' }, { status: 409, body: { error: 'no_active_attempt' } }],
        [{ type: 'not_started' }, { status: 409, body: { error: 'not_started' } }],
        [{ type: 'time_up' }, { status: 409, body: { error: 'time_up' } }],
        [{ type: 'action_key_reused' }, { status: 409, body: { error: 'action_key_reused' } }],
        [{ type: 'no_recipients' }, { status: 409, body: { error: 'no_recipients' } }],
        [{ type: 'rate_limited', retryAfterSeconds: 12 }, { status: 429, body: { error: 'rate_limited', retryAfterSeconds: 12 } }],
        [{ type: 'unavailable' }, { status: 503, body: { error: 'persistence_unavailable' } }],
    ];
    for (const [result, expected] of cases) assert.deepEqual(coreRefusal(result as { type: string }, ID), expected, String(result.type));
});

test('C01 E5 the Operator projection: every addition, a reason only on its own, no forbidden key', async () => {
    const at = new Date('2026-11-10T01:00:00Z');
    const client = {
        query: async (sql: string) => {
            if (sql.includes('identity_person_account_bindings')) {
                return { rows: [{ person_id: 'p-s1', username: 'elg-siswa-0001' }, { person_id: OPERATOR, username: 'operator.satu' }, { person_id: OTHER, username: 'operator.dua' }] };
            }
            if (sql.includes('AS paused_at')) return { rows: [{ subject_label: 'Matematika', db_now: at, paused_at: null }] };
            if (sql.includes('secure_assessment_exam_question_snapshots WHERE')) return { rows: [{ n: 5 }] };
            if (sql.includes('adj.reason')) {
                return { rows: [
                    { exam_participant_id: ID2, created_at: at, adjustment_seconds: 600, reason: 'Listrik padam', actor_person_id: OPERATOR },
                    { exam_participant_id: ID2, created_at: at, adjustment_seconds: 300, reason: 'Alasan orang lain', actor_person_id: OTHER },
                ] };
            }
            if (sql.includes('AS session_moves')) {
                return { rows: [{
                    participant_id: ID2, person_id: 'p-s1', room_label: 'Ruang 1', attempt_id: ID3, locked_at: null, started_at: at, remaining_seconds: 900,
                    submitted_at: null, finalization_source: null, answered: 2, last_accepted_at: at, added_seconds: 900, session_active: true, session_moves: 0,
                }] };
            }
            if (sql.includes('secure_assessment_exam_rooms r')) return { rows: [{ id: ID, display_label: 'Ruang 1' }] };
            return { rows: [] };
        },
    } as unknown as pg.PoolClient;
    const monitoring = await readMonitoringProjection(client, { tenantId: TENANT, personId: OPERATOR }, ID, {
        scope: 'OPERATOR', roomFilter: null, roomBased: true, lifecycleState: 'ACTIVE', canAddTime: true, timeAdditions: 'own_reasons',
    });
    assert.equal(monitoring.scope, 'OPERATOR');
    assert.equal(monitoring.canAddTime, true);
    assert.deepEqual(monitoring.participants[0].timeAdditions, [
        { addedAt: at.toISOString(), seconds: 600, reason: 'Listrik padam', by: { elligbleId: 'operator.satu', you: true } },
        { addedAt: at.toISOString(), seconds: 300, by: { elligbleId: 'operator.dua', you: false } },
    ]);
    assert.ok(!JSON.stringify(monitoring).includes('Alasan orang lain'), "another actor's reason never leaves the server");
    assert.deepEqual(forbiddenKeysIn(monitoring), []);
    assert.deepEqual(forbiddenKeysIn({ a: [{ nisn: '1', inner: { score: 1 } }], name: 'x' }), ['name', 'nisn', 'score']);
    assert.ok(FORBIDDEN_RESPONSE_KEYS.includes('fullName') && FORBIDDEN_RESPONSE_KEYS.includes('answer'));
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
    const P = '/api/v1/assessment/institution-exams/supervision';
    const writePaths = ['transition', 'participant-lock', 'add-time', 'broadcast'].map(p => `${P}/${p}`);
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
            const large = await post(path, JSON.stringify({ reason: 'x'.repeat(64 * 1024) }));
            assert.equal(large.status, 413, path);
            assert.deepEqual(await large.json(), { error: 'payload_too_large' });
        }
        const noReason = await post(`${P}/transition`, JSON.stringify({ examInstanceId: ID, action: 'pause', reason: ' ', confirmed: true, actionKey: ID2 }));
        assert.equal(noReason.status, 400, 'a reason that normalizes to nothing');
        const unconfirmed = await post(`${P}/broadcast`, JSON.stringify({ examInstanceId: ID, target: { scope: 'EXAM' }, message: 'Tenang', reason: 'Ruang ramai', confirmed: false, actionKey: ID2 }));
        assert.equal(unconfirmed.status, 400, 'confirmed other than true');
        for (const [path, key] of [[P, 'sessionId'], [`${P}/exam`, 'examInstanceId']] as const) {
            assert.equal((await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 405, path);
            assert.equal((await fetch(base + path)).status, 400, 'exactly one query key');
            assert.equal((await fetch(`${base}${path}?${key}=nope`)).status, 400);
            assert.equal((await fetch(`${base}${path}?${key}=${ID}&tenantId=${ID}`)).status, 400);
            assert.equal((await fetch(`${base}${path}?periodId=${ID}`)).status, 400);
            assert.equal((await fetch(`${base}${path}?${key}=${ID}`)).status, 401, 'anonymous');
        }
        assert.equal(connections, 0, 'nothing reached the database');
    } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});
