import type * as http from 'node:http';
import type * as pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import { HttpError, readJsonObject, sendJson } from './http/http-utils.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import { normalizeBroadcastMessage, parseBroadcastTarget, sendBroadcastInScope, type BroadcastTarget } from './exam-broadcast.ts';
import { evaluateExamReadiness, runExamTransition, type ExamTransitionRow, type ReadinessSummary } from './exam-lifecycle-operations.ts';
import { readMonitoringProjection } from './exam-monitoring.ts';
import {
    InstitutionRefusal, digestOf, hasExactKeys, institutionFailure, lockInstitutionExam, operatorRead, operatorWrite, refuse,
    type InstitutionActor, type Outcome,
} from './institution-exams.ts';
import { lockSession } from './institution-rooms.ts';
import { applyParticipantLock, type ParticipantLockAction } from './participant-lock.ts';
import { applyTimeAddition, parseTimeAdditionRequest, type TimeAdditionRequest } from './participant-time.ts';
import { normalizePermissionReason } from './permission-action-audit.ts';

// The School Operator's drill-down and running controls of institution exams (ASSESS-INSTITUTION-003; Owner O05-3,
// OC-1..OC-6, OD-07, OD-07b). For the institution exams of its own school, the Operator follows each session as exam,
// room and participant status (the Proctor's projection with ELLIGBLE IDs and no names, OC-5), opens, pauses, resumes
// and ends exams one by one or for a whole session (OC-2, OC-3), and locks and unlocks a participant, sends messages and
// adds time (OC-1). Every control carries a reason (OC-4), a confirmation and an append-only, attributable record
// (0064, E4); a refusal writes nothing. Each business action runs through the same core as the Teacher's or the
// Proctor's (E3), so remaining time, pause and lock boundaries and recipients are identical and the business ledgers
// name the Operator. No score, grade edit or cheating verdict exists here.
//
// Frame (§4.2): the exact body before any connection; operatorWrite (authentication, BEGIN, the action-key lock
// sa-institution:<tenant>:control:<key>, the Operator assignment FOR SHARE); the replay of the key (E11); the object
// locks; the checks and the core; the action row and its entries; re-authentication and COMMIT.
// Lock order (§4.2): a per-exam transition takes the exam row FOR UPDATE (lockInstitutionExam) and no session lock. A
// session-wide transition takes the session lock shared with room writes (lockSession), reads the exams without a
// lock, then takes FOR UPDATE by id only those in the action's from-state or no-op state (F5). Lock and added time
// take the exam row FOR KEY SHARE (keyShareInstitutionExam, E21), then the open attempt FOR UPDATE, the order of every
// attempt writer. A message takes no exam lock, as sendExamBroadcast.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export const SUPERVISION_ROUTES = {
    session: '/api/v1/assessment/institution-exams/supervision',
    exam: '/api/v1/assessment/institution-exams/supervision/exam',
    transition: '/api/v1/assessment/institution-exams/supervision/transition',
    participantLock: '/api/v1/assessment/institution-exams/supervision/participant-lock',
    addTime: '/api/v1/assessment/institution-exams/supervision/add-time',
    broadcast: '/api/v1/assessment/institution-exams/supervision/broadcast',
} as const;

export type ControlTransition = 'activate' | 'pause' | 'resume' | 'end';
export const CONTROL_TRANSITIONS: readonly ControlTransition[] = ['activate', 'pause', 'resume', 'end'];

/** E9: the state an action applies to, and the state in which a repeat is NO_OP (none for activate). */
export const TRANSITION_STATES: Record<ControlTransition, { from: string; noOp: string | null; to: string }> = {
    activate: { from: 'READY', noOp: null, to: 'ACTIVE' },
    pause: { from: 'ACTIVE', noOp: 'PAUSED', to: 'PAUSED' },
    resume: { from: 'PAUSED', noOp: 'ACTIVE', to: 'ACTIVE' },
    end: { from: 'ACTIVE', noOp: 'ENDED', to: 'ENDED' },
};

/** The skip codes of a session-wide transition, in the E7 check order. */
export type SkipCode = 'invalid_state' | 'room_setup_required' | 'window_not_started' | 'window_closed' | 'not_ready';
export const SKIP_CODES: readonly SkipCode[] = ['invalid_state', 'room_setup_required', 'window_not_started', 'window_closed', 'not_ready'];

export type ControlKind = 'TRANSITION' | 'PARTICIPANT_LOCK' | 'TIME_ADD' | 'BROADCAST';
export type ControlOutcome = 'APPLIED' | 'NO_OP' | 'SKIPPED';

/** Keys no Operator response may carry (E5, I-16). */
export const FORBIDDEN_RESPONSE_KEYS: readonly string[] = [
    'fullName', 'name', 'nis', 'nisn', 'birthDate', 'membershipId', 'prompt', 'options', 'correct', 'rubric', 'score', 'answer',
];

// ---------------------------------------------------------------------------------------------
// Request bodies (exact keys and shapes; 400 otherwise, before any connection).

export interface TransitionControl {
    target: { examInstanceId: string } | { sessionId: string };
    action: ControlTransition;
    reason: string;
    actionKey: string;
}
export interface LockControl { examInstanceId: string; participantId: string; action: ParticipantLockAction; reason: string; actionKey: string }
export type TimeControl = TimeAdditionRequest;
export interface BroadcastControl { examInstanceId: string; target: BroadcastTarget; message: string; reason: string; actionKey: string }

/** The reason as recorded (OC-4): the 0054 form, 1 to 200 characters; null when unusable. */
function controlReason(body: Record<string, unknown>): string | null {
    return body.confirmed === true ? normalizePermissionReason(body.reason) : null;
}

export function parseTransitionControl(body: Record<string, unknown>): TransitionControl | null {
    const byExam = hasExactKeys(body, ['examInstanceId', 'action', 'reason', 'confirmed', 'actionKey']);
    const bySession = hasExactKeys(body, ['sessionId', 'action', 'reason', 'confirmed', 'actionKey']);
    if (!byExam && !bySession) return null;
    const id = byExam ? body.examInstanceId : body.sessionId;
    const reason = controlReason(body);
    if (!uuid(id) || !uuid(body.actionKey) || reason === null) return null;
    if (typeof body.action !== 'string' || !CONTROL_TRANSITIONS.includes(body.action as ControlTransition)) return null;
    return {
        target: byExam ? { examInstanceId: id.toLowerCase() } : { sessionId: id.toLowerCase() },
        action: body.action as ControlTransition, reason, actionKey: body.actionKey.toLowerCase(),
    };
}

export function parseLockControl(body: Record<string, unknown>): LockControl | null {
    if (!hasExactKeys(body, ['examInstanceId', 'participantId', 'action', 'reason', 'confirmed', 'actionKey'])) return null;
    const { examInstanceId, participantId, action, actionKey } = body;
    const reason = controlReason(body);
    if (!uuid(examInstanceId) || !uuid(participantId) || !uuid(actionKey) || reason === null) return null;
    if (action !== 'lock' && action !== 'unlock') return null;
    return { examInstanceId: examInstanceId.toLowerCase(), participantId: participantId.toLowerCase(), action, reason, actionKey: actionKey.toLowerCase() };
}

export function parseTimeControl(body: Record<string, unknown>): TimeControl | null {
    if (!hasExactKeys(body, ['examInstanceId', 'participantId', 'minutes', 'reason', 'confirmed', 'actionKey'])) return null;
    if (body.confirmed !== true) return null;
    const request = parseTimeAdditionRequest(body);
    if (!request) return null;
    return { ...request, examInstanceId: request.examInstanceId.toLowerCase(), participantId: request.participantId.toLowerCase() };
}

export function parseBroadcastControl(body: Record<string, unknown>): BroadcastControl | null {
    if (!hasExactKeys(body, ['examInstanceId', 'target', 'message', 'reason', 'confirmed', 'actionKey'])) return null;
    const { examInstanceId, actionKey } = body;
    const reason = controlReason(body);
    const parsed = parseBroadcastTarget(body.target);
    const message = normalizeBroadcastMessage(body.message);
    if (!uuid(examInstanceId) || !uuid(actionKey) || reason === null || !parsed || message === null) return null;
    // Exactly the keys of the target's scope (no hidden extra key rides along).
    const keys = Object.keys(body.target as Record<string, unknown>).sort().join(',');
    const expected = parsed.scope === 'EXAM' ? 'scope' : parsed.scope === 'ROOM' ? 'roomId,scope' : 'participantIds,scope';
    if (keys !== expected) return null;
    const target: BroadcastTarget = parsed.scope === 'ROOM' ? { scope: 'ROOM', roomId: parsed.roomId.toLowerCase() } : parsed;
    return { examInstanceId: examInstanceId.toLowerCase(), target, message, reason, actionKey: actionKey.toLowerCase() };
}

// ---------------------------------------------------------------------------------------------
// Pure rules of the session-wide transition (E9) and the replay bodies (E11).

/** F5: the exams a session-wide action locks, by id: those read in its from-state or its NO_OP state. */
export function examsToLock(action: ControlTransition, read: ReadonlyArray<{ id: string; lifecycleState: string }>): string[] {
    const { from, noOp } = TRANSITION_STATES[action];
    return read.filter(e => e.lifecycleState === from || (noOp !== null && e.lifecycleState === noOp))
        .map(e => e.id).sort((a, b) => a.localeCompare(b));
}

export interface SessionResult {
    examInstanceId: string;
    outcome: ControlOutcome;
    previousState: string;
    resultingState: string;
    skip?: { code: SkipCode; currentState?: string; windowStartsAt?: string; readiness?: ReadinessSummary };
}

/** E9: the outcome of an exam that was not locked, or that is locked in a state the action does not apply to. */
export function classifySessionExam(action: ControlTransition, examInstanceId: string, state: string, locked: boolean): SessionResult | null {
    const { from, noOp } = TRANSITION_STATES[action];
    if (locked && state === from) return null;
    if (locked && noOp !== null && state === noOp) return { examInstanceId, outcome: 'NO_OP', previousState: state, resultingState: state };
    return { examInstanceId, outcome: 'SKIPPED', previousState: state, resultingState: state, skip: { code: 'invalid_state', currentState: state } };
}

/** E9: a session-wide action is written only when at least one exam is APPLIED or NO_OP. */
export function nothingApplicable(results: readonly SessionResult[]): boolean {
    return results.every(r => r.outcome === 'SKIPPED');
}

export interface StoredEntry {
    examInstanceId: string;
    outcome: ControlOutcome;
    previousState: string | null;
    resultingState: string | null;
    skipCode: SkipCode | null;
}

/** E11: the replay body of a one-exam transition, rebuilt from its entry. */
export function examReplayBody(entry: StoredEntry): Record<string, unknown> {
    return { examInstanceId: entry.examInstanceId, lifecycleState: entry.resultingState, changed: entry.outcome === 'APPLIED', replayed: true };
}

/** E11: the replay body of a session-wide transition, results in id order; a skip carries its code and the state read. */
export function sessionReplayBody(sessionId: string, action: string, entries: readonly StoredEntry[]): Record<string, unknown> {
    const results = [...entries].sort((a, b) => a.examInstanceId.localeCompare(b.examInstanceId)).map(e => ({
        examInstanceId: e.examInstanceId, outcome: e.outcome, previousState: e.previousState, resultingState: e.resultingState,
        ...(e.skipCode ? { skip: { code: e.skipCode, ...(e.skipCode === 'invalid_state' && e.previousState ? { currentState: e.previousState } : {}) } } : {}),
    }));
    return { sessionId, action, results, replayed: true };
}

/** E11: the replay body of a lock or unlock. */
export function lockReplayBody(participantId: string, entry: StoredEntry, lockedAt: string | null): Record<string, unknown> {
    const locked = entry.resultingState === 'LOCKED';
    return { participantId, locked, changed: entry.outcome === 'APPLIED', lockedAt: locked ? lockedAt : null, replayed: true };
}

/** The keys of a value (deep) that no Operator response may carry (E5, I-16). */
export function forbiddenKeysIn(value: unknown, found: Set<string> = new Set()): string[] {
    if (Array.isArray(value)) value.forEach(v => forbiddenKeysIn(v, found));
    else if (typeof value === 'object' && value !== null) {
        for (const [key, inner] of Object.entries(value)) {
            if (FORBIDDEN_RESPONSE_KEYS.includes(key)) found.add(key);
            forbiddenKeysIn(inner, found);
        }
    }
    return [...found].sort();
}

// ---------------------------------------------------------------------------------------------
// Errors (§4.2): the control constraints and core results first, then the unchanged institutionFailure.

function constraintOf(error: unknown): { code: string; constraint: string } {
    const e = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; constraint?: unknown };
    return { code: typeof e.code === 'string' ? e.code : '', constraint: typeof e.constraint === 'string' ? e.constraint : '' };
}

/** The answer of a database error of a control, or null when the frame mapping applies. */
export function matchControlFailure(error: unknown): Outcome | null {
    if (error instanceof InstitutionRefusal) return null;
    const { code, constraint } = constraintOf(error);
    if (code === '23505') {
        switch (constraint) {
            case 'uq_sa_institution_control_action_key':
            case 'uq_sa_timer_adj_action_key':
                return { status: 409, body: { error: 'action_key_reused' } };
            case 'uq_sa_institution_control_entry_exam':
            case 'uq_sa_exam_pauses_open':
            case 'uq_sa_attempt_locks_open':
                return { status: 409, body: { error: 'state_changed' } };
        }
    }
    if (code === '23514' && (constraint === 'ck_sa_institution_control_session' || constraint === 'ck_sa_institution_control_entry_scope')) {
        return { status: 403, body: { error: 'forbidden' } };
    }
    return null;
}

/** The controls error mapper (§4.2): the control constraints, then the unchanged institutionFailure. */
export function institutionControlFailure(error: unknown): Outcome {
    return matchControlFailure(error) ?? institutionFailure(error);
}

/** A refusing result of a core, as the Operator routes answer it (§4.2 errors table). */
export type CoreRefusal =
    | { type: 'forbidden' }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'room_setup_required' }
    | { type: 'not_ready'; readiness: ReadinessSummary }
    | { type: 'window_not_started'; windowStartsAt: string }
    | { type: 'window_closed' }
    | { type: 'no_active_attempt' } | { type: 'not_started' } | { type: 'time_up' }
    | { type: 'action_key_reused' }
    | { type: 'no_recipients' }
    | { type: 'rate_limited'; retryAfterSeconds: number }
    | { type: 'unavailable' }
    | { type: string };

export function coreRefusal(result: CoreRefusal, examInstanceId: string): Outcome {
    const r = result as Record<string, unknown>;
    switch (result.type) {
        case 'forbidden': return { status: 403, body: { error: 'forbidden' } };
        case 'invalid_state': return { status: 409, body: { error: 'invalid_state', examInstanceId, currentState: r.currentState } };
        case 'room_setup_required': return { status: 409, body: { error: 'room_setup_required' } };
        case 'not_ready': return { status: 409, body: { error: 'not_ready', readiness: r.readiness } };
        case 'window_not_started': return { status: 409, body: { error: 'window_not_started', windowStartsAt: r.windowStartsAt } };
        case 'window_closed': return { status: 409, body: { error: 'window_closed' } };
        case 'no_active_attempt': case 'not_started': case 'time_up': case 'action_key_reused': case 'no_recipients':
            return { status: 409, body: { error: result.type } };
        case 'rate_limited': return { status: 429, body: { error: 'rate_limited', retryAfterSeconds: r.retryAfterSeconds } };
        case 'unavailable': return { status: 503, body: { error: 'persistence_unavailable' } };
        default: return { status: 500, body: { error: 'internal_error' } };
    }
}

function refuseWith(outcome: Outcome): never {
    throw new InstitutionRefusal(outcome.status, outcome.body as Record<string, unknown>);
}

/** Runs a control; a database error of a control constraint becomes its answer (operatorWrite rolls back). */
function mapped(run: (client: pg.PoolClient, actor: InstitutionActor) => Promise<Outcome>) {
    return async (client: pg.PoolClient, actor: InstitutionActor): Promise<Outcome> => {
        try {
            return await run(client, actor);
        } catch (error) {
            const outcome = matchControlFailure(error);
            if (outcome) refuseWith(outcome);
            throw error;
        }
    };
}

// ---------------------------------------------------------------------------------------------
// Object locks and the ledger.

export interface InstitutionExamScope {
    lifecycle_state: string;
    institution_session_id: string;
    room_based: boolean;
    room_policy: boolean;
}

const EXAM_SCOPE_SELECT = `SELECT i.lifecycle_state, i.institution_session_id, s.starts_at AS session_starts_at, t.time_zone,
            coalesce(i.room_based_operations_enabled, FALSE) AS room_based,
            (coalesce(i.room_based_operations_enabled, FALSE) AND coalesce(i.proctor_per_room_required, FALSE)) AS room_policy
     FROM secure_assessment_exam_instances i
     JOIN secure_assessment_institution_exam_sessions s ON s.id = i.institution_session_id AND s.tenant_id = i.tenant_id
     JOIN tenant_tenants t ON t.id = i.tenant_id
     WHERE i.id = $1 AND i.tenant_id = $2`;

/**
 * E21: this tenant's institution exam FOR KEY SHARE, the lock every attempt writer and the supervision path take before
 * the attempt row; 403 for anything else, a teacher-managed exam included (the query and refusal of lockInstitutionExam).
 */
export async function keyShareInstitutionExam(client: pg.PoolClient, actor: InstitutionActor, examInstanceId: string): Promise<InstitutionExamScope> {
    const res = await client.query(`${EXAM_SCOPE_SELECT}\n     FOR KEY SHARE OF i`, [examInstanceId, actor.tenantId]);
    if (res.rows.length !== 1) refuse(403, 'forbidden');
    return res.rows[0] as InstitutionExamScope;
}

/** This tenant's institution exam without a lock (a message, a read); 403 otherwise. */
async function readInstitutionExam(client: pg.PoolClient, actor: InstitutionActor, examInstanceId: string): Promise<InstitutionExamScope> {
    const res = await client.query(EXAM_SCOPE_SELECT, [examInstanceId, actor.tenantId]);
    if (res.rows.length !== 1) refuse(403, 'forbidden');
    return res.rows[0] as InstitutionExamScope;
}

/** A participant of the named exam (the existing rule of the lock and time routes); 403 otherwise. */
async function requireParticipant(client: pg.PoolClient, actor: InstitutionActor, examInstanceId: string, participantId: string): Promise<void> {
    const res = await client.query(
        'SELECT 1 FROM secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND id = $3',
        [actor.tenantId, examInstanceId, participantId]);
    if (res.rows.length !== 1) refuse(403, 'forbidden');
}

interface ControlRow {
    sessionId: string;
    examInstanceId: string | null;
    participantId: string | null;
    kind: ControlKind;
    action: string;
    reason: string;
    actionKey: string;
    digest: string;
}

interface EntryRow extends StoredEntry {
    participantId: string | null;
    attemptId: string | null;
    broadcastId: string | null;
}

/** The append-only action row and its entries (E4, §4.1). */
async function recordControl(client: pg.PoolClient, actor: InstitutionActor, action: ControlRow, entries: readonly EntryRow[]): Promise<void> {
    const recorded = await client.query(
        `INSERT INTO secure_assessment_institution_control_actions
             (tenant_id, session_id, exam_instance_id, participant_id, kind, action, reason, confirmed, actor_person_id, action_key, request_digest)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10) RETURNING id`,
        [actor.tenantId, action.sessionId, action.examInstanceId, action.participantId, action.kind, action.action, action.reason,
            actor.personId, action.actionKey, action.digest]);
    await client.query(
        `INSERT INTO secure_assessment_institution_control_entries
             (tenant_id, action_id, exam_instance_id, participant_id, attempt_id, broadcast_id, outcome, previous_state, resulting_state, skip_code)
         SELECT $1, $2, e.exam, e.participant, e.attempt, e.broadcast, e.outcome, e.previous, e.resulting, e.skip
         FROM unnest($3::uuid[], $4::uuid[], $5::uuid[], $6::uuid[], $7::text[], $8::text[], $9::text[], $10::text[])
              WITH ORDINALITY AS e(exam, participant, attempt, broadcast, outcome, previous, resulting, skip, n)
         ORDER BY e.n`,
        [actor.tenantId, recorded.rows[0].id, entries.map(e => e.examInstanceId), entries.map(e => e.participantId), entries.map(e => e.attemptId),
            entries.map(e => e.broadcastId), entries.map(e => e.outcome), entries.map(e => e.previousState), entries.map(e => e.resultingState),
            entries.map(e => e.skipCode)]);
}

interface EarlierControl {
    id: string;
    kind: ControlKind;
    action: string;
    actorPersonId: string;
    digest: string;
    sessionId: string;
    examInstanceId: string | null;
    participantId: string | null;
    actedAt: Date;
}

/** §4.2 step 3: the earlier control of this key, refused with action_key_reused unless it is the same control. */
async function earlierControl(client: pg.PoolClient, actor: InstitutionActor, actionKey: string, kind: ControlKind, digest: string): Promise<EarlierControl | null> {
    const res = await client.query(
        `SELECT id, kind, action, actor_person_id, request_digest, session_id, exam_instance_id, participant_id, acted_at
         FROM secure_assessment_institution_control_actions WHERE tenant_id = $1 AND action_key = $2`, [actor.tenantId, actionKey]);
    const r = res.rows[0];
    if (!r) return null;
    if (r.kind !== kind || r.actor_person_id !== actor.personId || r.request_digest !== digest) refuse(409, 'action_key_reused');
    return {
        id: r.id, kind: r.kind, action: r.action, actorPersonId: r.actor_person_id, digest: r.request_digest, sessionId: r.session_id,
        examInstanceId: r.exam_instance_id ?? null, participantId: r.participant_id ?? null, actedAt: new Date(r.acted_at),
    };
}

async function storedEntries(client: pg.PoolClient, tenantId: string, actionId: string): Promise<Array<StoredEntry & { attemptId: string | null; broadcastId: string | null }>> {
    const res = await client.query(
        `SELECT exam_instance_id, outcome, previous_state, resulting_state, skip_code, attempt_id, broadcast_id
         FROM secure_assessment_institution_control_entries WHERE tenant_id = $1 AND action_id = $2 ORDER BY exam_instance_id`,
        [tenantId, actionId]);
    return res.rows.map(r => ({
        examInstanceId: r.exam_instance_id, outcome: r.outcome, previousState: r.previous_state ?? null, resultingState: r.resulting_state ?? null,
        skipCode: r.skip_code ?? null, attemptId: r.attempt_id ?? null, broadcastId: r.broadcast_id ?? null,
    }));
}

const noParticipant = { participantId: null, attemptId: null, broadcastId: null } as const;

// ---------------------------------------------------------------------------------------------
// Transitions (E7, E8, E9).

export interface TransitionRow extends ExamTransitionRow { id: string; institution_session_id: string; room_policy: boolean }

const TRANSITION_SELECT = `SELECT i.id, i.institution_session_id, i.lifecycle_state, i.window_starts_at, i.window_ends_at, statement_timestamp() AS db_now,
            (coalesce(i.room_based_operations_enabled, FALSE) AND coalesce(i.proctor_per_room_required, FALSE)) AS room_policy
     FROM secure_assessment_exam_instances i`;

export type Evaluated = { applied: true; resultingState: string; changed: boolean } | { applied: false; refusal: CoreRefusal };

/**
 * E7 and E8 for one exam held FOR UPDATE: the state, then for activation the room flags (step 2, inserted here before
 * the core), then the core's window and readiness checks; pause, resume and end through the same core.
 */
export async function evaluateTransition(client: pg.PoolClient, actor: InstitutionActor, action: ControlTransition, row: TransitionRow): Promise<Evaluated> {
    if (action === 'activate' && row.lifecycle_state === 'READY' && row.room_policy !== true) {
        return { applied: false, refusal: { type: 'room_setup_required' } };
    }
    const result = await runExamTransition(client, actor.tenantId, row.id, actor.personId, action, row);
    if (result.type === 'transitioned') return { applied: true, resultingState: result.lifecycleState, changed: result.changed };
    // A PAUSED exam without its open pause, or any unexpected result, aborts the whole transaction.
    if (!SKIP_CODES.includes(result.type as SkipCode)) refuseWith(coreRefusal(result, row.id));
    return { applied: false, refusal: result };
}

async function transitionOneExam(client: pg.PoolClient, actor: InstitutionActor, request: TransitionControl, examInstanceId: string, digest: string): Promise<Outcome> {
    const earlier = await earlierControl(client, actor, request.actionKey, 'TRANSITION', digest);
    if (earlier) {
        const [entry] = await storedEntries(client, actor.tenantId, earlier.id);
        return { status: 200, body: examReplayBody(entry) };
    }
    // The exam row FOR UPDATE, the lock of every lifecycle change; no session lock (§4.2).
    await lockInstitutionExam(client, actor, examInstanceId);
    const res = await client.query(`${TRANSITION_SELECT} WHERE i.id = $1 AND i.tenant_id = $2`, [examInstanceId, actor.tenantId]);
    const row = res.rows[0] as TransitionRow;
    const evaluated = await evaluateTransition(client, actor, request.action, row);
    if (!evaluated.applied) refuseWith(coreRefusal(evaluated.refusal, examInstanceId));
    await recordControl(client, actor, {
        sessionId: row.institution_session_id, examInstanceId, participantId: null, kind: 'TRANSITION', action: request.action,
        reason: request.reason, actionKey: request.actionKey, digest,
    }, [{
        examInstanceId, ...noParticipant, outcome: evaluated.changed ? 'APPLIED' : 'NO_OP',
        previousState: row.lifecycle_state, resultingState: evaluated.resultingState, skipCode: null,
    }]);
    return { status: 200, body: { examInstanceId, lifecycleState: evaluated.resultingState, changed: evaluated.changed, replayed: false } };
}

function skipOf(refusal: CoreRefusal, state: string): SessionResult['skip'] {
    const r = refusal as Record<string, unknown>;
    switch (refusal.type) {
        case 'invalid_state': return { code: 'invalid_state', currentState: String(r.currentState ?? state) };
        case 'window_not_started': return { code: 'window_not_started', windowStartsAt: String(r.windowStartsAt) };
        case 'not_ready': return { code: 'not_ready', readiness: r.readiness as ReadinessSummary };
        default: return { code: refusal.type as SkipCode };
    }
}

async function transitionSession(client: pg.PoolClient, actor: InstitutionActor, request: TransitionControl, sessionId: string, digest: string): Promise<Outcome> {
    const earlier = await earlierControl(client, actor, request.actionKey, 'TRANSITION', digest);
    if (earlier) return { status: 200, body: sessionReplayBody(sessionId, earlier.action, await storedEntries(client, actor.tenantId, earlier.id)) };
    // 1. The session lock shared with room writes; 403 for another tenant's or a nonexistent session.
    await lockSession(client, actor, sessionId);
    // 2. The non-cancelled exams, read without a lock.
    const read = await client.query(
        `SELECT i.id, i.lifecycle_state FROM secure_assessment_exam_instances i
         WHERE i.tenant_id = $1 AND i.institution_session_id = $2
           AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_cancellations c WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id)
         ORDER BY i.id`, [actor.tenantId, sessionId]);
    const exams = read.rows.map(r => ({ id: r.id as string, lifecycleState: r.lifecycle_state as string }));
    // 3. FOR UPDATE by id only the exams in the from-state or the NO_OP state; then their state read again.
    const toLock = examsToLock(request.action, exams);
    const locked = new Map<string, TransitionRow>();
    if (toLock.length > 0) {
        await client.query(
            `SELECT i.id FROM secure_assessment_exam_instances i WHERE i.tenant_id = $1 AND i.id = ANY($2::uuid[]) ORDER BY i.id FOR UPDATE OF i`,
            [actor.tenantId, toLock]);
        const again = await client.query(`${TRANSITION_SELECT} WHERE i.tenant_id = $1 AND i.id = ANY($2::uuid[]) ORDER BY i.id`, [actor.tenantId, toLock]);
        for (const row of again.rows as TransitionRow[]) locked.set(row.id, row);
    }
    // 4. The core per locked exam in id order; the others are SKIPPED from the unlocked read.
    const results: SessionResult[] = [];
    for (const exam of [...exams].sort((a, b) => a.id.localeCompare(b.id))) {
        const row = locked.get(exam.id);
        const state = row ? row.lifecycle_state : exam.lifecycleState;
        const classified = classifySessionExam(request.action, exam.id, state, row !== undefined);
        if (classified) { results.push(classified); continue; }
        const evaluated = await evaluateTransition(client, actor, request.action, row!);
        results.push(evaluated.applied
            ? { examInstanceId: exam.id, outcome: evaluated.changed ? 'APPLIED' : 'NO_OP', previousState: state, resultingState: evaluated.resultingState }
            : { examInstanceId: exam.id, outcome: 'SKIPPED', previousState: state, resultingState: state, skip: skipOf(evaluated.refusal, state) });
    }
    if (nothingApplicable(results)) refuse(409, 'nothing_applicable', { results });
    await recordControl(client, actor, {
        sessionId, examInstanceId: null, participantId: null, kind: 'TRANSITION', action: request.action,
        reason: request.reason, actionKey: request.actionKey, digest,
    }, results.map(r => ({
        examInstanceId: r.examInstanceId, ...noParticipant, outcome: r.outcome, previousState: r.previousState, resultingState: r.resultingState,
        skipCode: r.skip?.code ?? null,
    })));
    return { status: 200, body: { sessionId, action: request.action, results, replayed: false } };
}

// ---------------------------------------------------------------------------------------------
// Participant controls (E10).

async function lockParticipant(client: pg.PoolClient, actor: InstitutionActor, request: LockControl, digest: string): Promise<Outcome> {
    const earlier = await earlierControl(client, actor, request.actionKey, 'PARTICIPANT_LOCK', digest);
    if (earlier) {
        const [entry] = await storedEntries(client, actor.tenantId, earlier.id);
        let lockedAt: string | null = null;
        if (entry.resultingState === 'LOCKED' && entry.attemptId) {
            // Compared in the database at full precision: acted_at passed through a JavaScript Date loses its
            // microseconds and could fall before the lock of the same transaction.
            const lock = await client.query(
                `SELECT l.locked_at FROM secure_assessment_attempt_locks l
                 JOIN secure_assessment_institution_control_actions a ON a.id = $3 AND a.tenant_id = l.tenant_id
                 WHERE l.tenant_id = $1 AND l.exam_attempt_id = $2 AND l.locked_at <= a.acted_at
                 ORDER BY l.locked_at DESC, l.id DESC LIMIT 1`,
                [actor.tenantId, entry.attemptId, earlier.id]);
            lockedAt = lock.rows[0] ? new Date(lock.rows[0].locked_at).toISOString() : null;
        }
        return { status: 200, body: lockReplayBody(request.participantId, entry, lockedAt) };
    }
    // Exam row FOR KEY SHARE, the participant, then the open attempt FOR UPDATE (the order of every attempt writer).
    const exam = await keyShareInstitutionExam(client, actor, request.examInstanceId);
    await requireParticipant(client, actor, request.examInstanceId, request.participantId);
    const { result, attemptId } = await applyParticipantLock(client, actor.tenantId, request.participantId, actor.personId, exam.lifecycle_state, request.action);
    if (result.type !== 'ok') refuseWith(coreRefusal(result, request.examInstanceId));
    const resultingState = result.locked ? 'LOCKED' : 'UNLOCKED';
    const previousState = result.changed ? (result.locked ? 'UNLOCKED' : 'LOCKED') : resultingState;
    await recordControl(client, actor, {
        sessionId: exam.institution_session_id, examInstanceId: request.examInstanceId, participantId: request.participantId,
        kind: 'PARTICIPANT_LOCK', action: request.action, reason: request.reason, actionKey: request.actionKey, digest,
    }, [{
        examInstanceId: request.examInstanceId, participantId: request.participantId, attemptId, broadcastId: null,
        outcome: result.changed ? 'APPLIED' : 'NO_OP', previousState, resultingState, skipCode: null,
    }]);
    return { status: 200, body: { participantId: request.participantId, locked: result.locked, changed: result.changed, lockedAt: result.lockedAt, replayed: false } };
}

async function addTime(client: pg.PoolClient, actor: InstitutionActor, request: TimeControl, digest: string): Promise<Outcome> {
    const earlier = await earlierControl(client, actor, request.actionKey, 'TIME_ADD', digest);
    if (earlier) {
        // The existing replay of the core: the 0050 row of this action key, with the totals now.
        const res = await client.query(
            `SELECT adj.created_at, adj.adjustment_seconds,
                    COALESCE((SELECT SUM(x.adjustment_seconds) FROM secure_assessment_timer_adjustments x
                              WHERE x.tenant_id = t.tenant_id AND x.timer_state_id = t.id), 0)::int AS total_added,
                    GREATEST(0, secure_assessment_attempt_remaining_seconds(t.tenant_id, t.exam_attempt_id, statement_timestamp())) AS remaining
             FROM secure_assessment_timer_adjustments adj
             JOIN secure_assessment_timer_state t ON t.id = adj.timer_state_id AND t.tenant_id = adj.tenant_id
             WHERE adj.tenant_id = $1 AND adj.action_key = $2`, [actor.tenantId, request.actionKey]);
        const row = res.rows[0];
        return {
            status: 200,
            body: {
                participantId: request.participantId, addedSeconds: Number(row.adjustment_seconds), totalAddedSeconds: Number(row.total_added),
                remainingSeconds: Number(row.remaining ?? 0), addedAt: new Date(row.created_at).toISOString(), replayed: true,
            },
        };
    }
    // One added-time key is decided one at a time across this route and the Teacher's (the 0050 key lock).
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sa-add-time:${actor.tenantId}:${request.actionKey}`]);
    const exam = await keyShareInstitutionExam(client, actor, request.examInstanceId);
    await requireParticipant(client, actor, request.examInstanceId, request.participantId);
    const { result, attemptId } = await applyTimeAddition(client, actor.tenantId, actor.personId, request, exam.lifecycle_state);
    if (result.type !== 'ok') refuseWith(coreRefusal(result, request.examInstanceId));
    // A key already used on the Teacher's added-time route has no control row here (E11).
    if (result.replayed) refuse(409, 'action_key_reused');
    await recordControl(client, actor, {
        sessionId: exam.institution_session_id, examInstanceId: request.examInstanceId, participantId: request.participantId,
        kind: 'TIME_ADD', action: 'add_time', reason: request.reason, actionKey: request.actionKey, digest,
    }, [{
        examInstanceId: request.examInstanceId, participantId: request.participantId, attemptId, broadcastId: null,
        outcome: 'APPLIED', previousState: null, resultingState: null, skipCode: null,
    }]);
    return {
        status: 200,
        body: {
            participantId: result.participantId, addedSeconds: result.addedSeconds, totalAddedSeconds: result.totalAddedSeconds,
            remainingSeconds: result.remainingSeconds, addedAt: result.addedAt, replayed: false,
        },
    };
}

async function sendMessage(client: pg.PoolClient, actor: InstitutionActor, request: BroadcastControl, digest: string): Promise<Outcome> {
    const earlier = await earlierControl(client, actor, request.actionKey, 'BROADCAST', digest);
    if (earlier) {
        const [entry] = await storedEntries(client, actor.tenantId, earlier.id);
        const res = await client.query(
            `SELECT b.id, b.sent_at, (SELECT count(*)::int FROM secure_assessment_exam_broadcast_recipients r
                                      WHERE r.tenant_id = b.tenant_id AND r.broadcast_id = b.id) AS recipients
             FROM secure_assessment_exam_broadcasts b WHERE b.tenant_id = $1 AND b.id = $2`, [actor.tenantId, entry.broadcastId]);
        const row = res.rows[0];
        return { status: 200, body: { broadcastId: row.id, sentAt: new Date(row.sent_at).toISOString(), recipients: Number(row.recipients), replayed: true } };
    }
    // No exam row lock: a message never waits for, or holds up, answer saving (the order of sendExamBroadcast).
    const exam = await readInstitutionExam(client, actor, request.examInstanceId);
    const result = await sendBroadcastInScope(client, actor.tenantId, request.examInstanceId, actor.personId,
        { roomFilter: null, roomBased: exam.room_based === true, lifecycleState: exam.lifecycle_state }, request.target, request.message);
    if (result.type !== 'ok') refuseWith(coreRefusal(result, request.examInstanceId));
    await recordControl(client, actor, {
        sessionId: exam.institution_session_id, examInstanceId: request.examInstanceId, participantId: null,
        kind: 'BROADCAST', action: 'message', reason: request.reason, actionKey: request.actionKey, digest,
    }, [{
        examInstanceId: request.examInstanceId, participantId: null, attemptId: null, broadcastId: result.broadcastId,
        outcome: 'APPLIED', previousState: null, resultingState: null, skipCode: null,
    }]);
    return { status: 200, body: { broadcastId: result.broadcastId, sentAt: result.sentAt, recipients: result.recipients, replayed: false } };
}

// ---------------------------------------------------------------------------------------------
// Reads (E5): one REPEATABLE READ READ ONLY snapshot each, the scope decided per request (A04-3).

function iso(value: unknown): string {
    return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

function isoOrNull(value: unknown): string | null {
    return value === null || value === undefined ? null : iso(value);
}

interface StatusCounts { participants: number; notStarted: number; active: number; submitted: number; locked: number }

const emptyCounts = (): StatusCounts => ({ participants: 0, notStarted: 0, active: 0, submitted: 0, locked: 0 });

/** The status rules of the monitoring list: submitted, not started, otherwise working (TIME_UP included); locked while open. */
export function countStatus(counts: StatusCounts, participant: { started: boolean; submitted: boolean; locked: boolean }): void {
    counts.participants += 1;
    if (participant.submitted) counts.submitted += 1;
    else if (!participant.started) counts.notStarted += 1;
    else counts.active += 1;
    if (participant.locked && !participant.submitted) counts.locked += 1;
}

async function readSupervisionSession(client: pg.PoolClient, actor: InstitutionActor, sessionId: string): Promise<Outcome> {
    const sessionRes = await client.query(
        `SELECT s.id, s.starts_at, s.ends_at, ep.label AS period_label, statement_timestamp() AS db_now
         FROM secure_assessment_institution_exam_sessions s
         JOIN secure_assessment_institution_exam_periods ep ON ep.id = s.period_id AND ep.tenant_id = s.tenant_id
         WHERE s.id = $1 AND s.tenant_id = $2`, [sessionId, actor.tenantId]);
    if (sessionRes.rows.length !== 1) refuse(403, 'forbidden');
    const session = sessionRes.rows[0];
    const examRes = await client.query(
        `SELECT i.id, i.lifecycle_state, s.display_label AS subject_label, g.display_label AS group_label,
                (coalesce(i.room_based_operations_enabled, FALSE) AND coalesce(i.proctor_per_room_required, FALSE)) AS room_policy,
                (SELECT ps.paused_at FROM secure_assessment_exam_pauses ps
                 WHERE ps.tenant_id = i.tenant_id AND ps.exam_instance_id = i.id AND ps.resumed_at IS NULL) AS paused_at
         FROM secure_assessment_exam_instances i
         JOIN academic_core_teaching_assignments ata ON ata.id = i.teaching_assignment_id AND ata.tenant_id = i.tenant_id
         LEFT JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
         LEFT JOIN academic_core_subjects s ON s.id = o.subject_id AND s.tenant_id = o.tenant_id
         LEFT JOIN academic_core_academic_groups g ON g.id = ata.academic_group_id AND g.tenant_id = ata.tenant_id
         WHERE i.tenant_id = $1 AND i.institution_session_id = $2
           AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_cancellations c WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id)
         ORDER BY s.display_label, g.display_label, i.id`, [actor.tenantId, sessionId]);
    const examIds = examRes.rows.map(r => r.id as string);
    const participants = examIds.length === 0 ? [] : (await client.query(
        `SELECT p.exam_instance_id, pra.exam_room_id AS room_id, (t.started_at IS NOT NULL) AS started, (sub.exam_attempt_id IS NOT NULL) AS submitted,
                EXISTS (SELECT 1 FROM secure_assessment_attempt_locks l
                        WHERE l.tenant_id = p.tenant_id AND l.exam_attempt_id = a.id AND l.unlocked_at IS NULL) AS locked
         FROM secure_assessment_exam_participants p
         LEFT JOIN secure_assessment_exam_participant_room_assignments pra
           ON pra.tenant_id = p.tenant_id AND pra.exam_instance_id = p.exam_instance_id AND pra.exam_participant_id = p.id
         LEFT JOIN LATERAL (
             SELECT att.id FROM secure_assessment_exam_attempts att
             WHERE att.tenant_id = p.tenant_id AND att.exam_participant_id = p.id
             ORDER BY att.created_at ASC, att.id ASC LIMIT 1
         ) a ON TRUE
         LEFT JOIN secure_assessment_timer_state t ON t.tenant_id = p.tenant_id AND t.exam_attempt_id = a.id
         LEFT JOIN secure_assessment_exam_submissions sub ON sub.tenant_id = p.tenant_id AND sub.exam_attempt_id = a.id
         WHERE p.tenant_id = $1 AND p.exam_instance_id = ANY($2::uuid[])`, [actor.tenantId, examIds])).rows;
    const roomRows = examIds.length === 0 ? [] : (await client.query(
        `SELECT r.id, r.exam_instance_id, r.display_label FROM secure_assessment_exam_rooms r
         WHERE r.tenant_id = $1 AND r.exam_instance_id = ANY($2::uuid[]) ORDER BY r.display_label, r.id`, [actor.tenantId, examIds])).rows;
    const proctorRows = examIds.length === 0 ? [] : (await client.query(
        `SELECT m.exam_room_id, pa.person_id
         FROM secure_assessment_proctor_assignments pa
         JOIN secure_assessment_exam_proctor_room_assignments m
           ON m.proctor_assignment_id = pa.id AND m.tenant_id = pa.tenant_id AND m.exam_instance_id = pa.exam_instance_id
         WHERE pa.tenant_id = $1 AND pa.exam_instance_id = ANY($2::uuid[]) AND pa.revoked_at IS NULL`, [actor.tenantId, examIds])).rows;
    const ids = await listElligbleIds(client, [...new Set(proctorRows.map(r => r.person_id as string))]);

    const exams = [];
    for (const exam of examRes.rows) {
        const counts = emptyCounts();
        const byRoom = new Map<string, StatusCounts>();
        for (const p of participants.filter(x => x.exam_instance_id === exam.id)) {
            const flags = { started: p.started === true, submitted: p.submitted === true, locked: p.locked === true };
            countStatus(counts, flags);
            if (p.room_id) {
                const roomCounts = byRoom.get(p.room_id) ?? emptyCounts();
                countStatus(roomCounts, flags);
                byRoom.set(p.room_id, roomCounts);
            }
        }
        const rooms = roomRows.filter(r => r.exam_instance_id === exam.id)
            .sort((a, b) => String(a.display_label).localeCompare(String(b.display_label), 'id', { numeric: true, sensitivity: 'base' }) || String(a.id).localeCompare(String(b.id)))
            .map(r => ({
                label: r.display_label as string,
                counts: byRoom.get(r.id) ?? emptyCounts(),
                proctors: [...new Set(proctorRows.filter(x => x.exam_room_id === r.id).map(x => ids.get(x.person_id) ?? null))]
                    .filter((id): id is string => id !== null).sort().map(elligbleId => ({ elligbleId })),
            }));
        let readiness: { baseline: unknown; roomProctor: unknown } | null = null;
        // E5: full readiness only for READY exams, to say whether "Buka Ujian" passes.
        if (exam.lifecycle_state === 'READY') {
            const evaluated = await evaluateExamReadiness(client, actor.tenantId, exam.id);
            readiness = { baseline: evaluated.baseline, roomProctor: evaluated.roomProctor };
        }
        exams.push({
            examInstanceId: exam.id, subjectLabel: exam.subject_label ?? null, groupLabel: exam.group_label ?? null,
            lifecycleState: exam.lifecycle_state, pausedAt: exam.lifecycle_state === 'PAUSED' ? isoOrNull(exam.paused_at) : null,
            counts, rooms, readiness, roomPolicy: exam.room_policy === true,
        });
    }
    return {
        status: 200,
        body: {
            session: { sessionId: session.id, periodLabel: session.period_label, startsAt: iso(session.starts_at), endsAt: iso(session.ends_at) },
            serverTime: iso(session.db_now),
            exams,
        },
    };
}

async function readSupervisionExam(client: pg.PoolClient, actor: InstitutionActor, examInstanceId: string): Promise<Outcome> {
    const exam = await readInstitutionExam(client, actor, examInstanceId);
    // OC-5: the Proctor's projection over every participant of the exam, with no room filter (E1, E5).
    const monitoring = await readMonitoringProjection(client, actor, examInstanceId, {
        scope: 'OPERATOR', roomFilter: null, roomBased: exam.room_based === true, lifecycleState: exam.lifecycle_state,
        canAddTime: true, timeAdditions: 'own_reasons',
    });
    return { status: 200, body: monitoring };
}

// ---------------------------------------------------------------------------------------------
// Routes.

/** The Operator supervision routes (§4.3): method, exact query or body, then one transaction each. */
export async function handleSupervisionRoute(
    req: http.IncomingMessage, res: http.ServerResponse, url: URL, pool: pg.Pool, cookie: SessionCookieConfig
): Promise<void> {
    const send = (outcome: Outcome) => {
        const body = outcome.body as Record<string, unknown>;
        const headers = outcome.status === 429 && typeof body?.retryAfterSeconds === 'number' ? { 'Retry-After': String(body.retryAfterSeconds) } : {};
        sendJson(res, outcome.status, outcome.body, headers);
    };
    const pathname = url.pathname;
    if (pathname === SUPERVISION_ROUTES.session || pathname === SUPERVISION_ROUTES.exam) {
        if (req.method !== 'GET') { req.resume(); send({ status: 405, body: { error: 'method_not_allowed' } }); return; }
        const key = pathname === SUPERVISION_ROUTES.session ? 'sessionId' : 'examInstanceId';
        const keys = [...url.searchParams.keys()];
        const id = url.searchParams.get(key);
        if (keys.length !== 1 || keys[0] !== key || !uuid(id)) {
            send({ status: 400, body: { error: 'invalid_request' } });
            return;
        }
        const lowered = id.toLowerCase();
        send(await operatorRead(req, pool, cookie, (client, actor) => key === 'sessionId'
            ? readSupervisionSession(client, actor, lowered) : readSupervisionExam(client, actor, lowered)));
        return;
    }
    if (req.method !== 'POST') { req.resume(); send({ status: 405, body: { error: 'method_not_allowed' } }); return; }
    let body: Record<string, unknown>;
    try {
        body = await readJsonObject(req);
    } catch (error) {
        send(institutionFailure(error instanceof HttpError ? error : new HttpError(400, 'invalid_request')));
        return;
    }
    const bad = () => send({ status: 400, body: { error: 'invalid_request' } });
    // One action-key lock for the four controls: a key serves one route only (uq_sa_institution_control_action_key).
    switch (pathname) {
        case SUPERVISION_ROUTES.transition: {
            const request = parseTransitionControl(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'control', request.actionKey, mapped((c, a) => {
                const digest = digestOf(a, 'control-transition', { ...request.target, action: request.action, reason: request.reason, confirmed: true });
                return 'examInstanceId' in request.target
                    ? transitionOneExam(c, a, request, request.target.examInstanceId, digest)
                    : transitionSession(c, a, request, request.target.sessionId, digest);
            })));
            return;
        }
        case SUPERVISION_ROUTES.participantLock: {
            const request = parseLockControl(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'control', request.actionKey, mapped((c, a) => lockParticipant(c, a, request, digestOf(a, 'control-lock', {
                examInstanceId: request.examInstanceId, participantId: request.participantId, action: request.action, reason: request.reason, confirmed: true,
            })))));
            return;
        }
        case SUPERVISION_ROUTES.addTime: {
            const request = parseTimeControl(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'control', request.actionKey, mapped((c, a) => addTime(c, a, request, digestOf(a, 'control-time', {
                examInstanceId: request.examInstanceId, participantId: request.participantId, minutes: request.minutes, reason: request.reason, confirmed: true,
            })))));
            return;
        }
        case SUPERVISION_ROUTES.broadcast: {
            const request = parseBroadcastControl(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'control', request.actionKey, mapped((c, a) => sendMessage(c, a, request, digestOf(a, 'control-message', {
                examInstanceId: request.examInstanceId, target: request.target, message: request.message, reason: request.reason, confirmed: true,
            })))));
            return;
        }
    }
    send({ status: 404, body: { error: 'not found' } });
}
