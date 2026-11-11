import type * as http from 'node:http';
import type * as pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import { findAccountByElligbleId } from '../../identity-access/src/provisioning.ts';
import { HttpError, readJsonObject, sendJson } from './http/http-utils.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import { evaluateExamReadiness } from './exam-lifecycle-operations.ts';
import {
    checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight, type ConditionalRoomProctorReadinessCompositionResult,
} from './exam-instance-conditional-room-proctor-readiness-composition-preflight.ts';
import { listEnrolledStudents, type EnrolledStudent } from './exam-provisioning.ts';
import { SCHEDULING_STATES, overlappingPersonIds } from './teacher-exam-import.ts';
import { MAX_ADDED_PARTICIPANTS } from './teacher-exam-participants.ts';
import {
    InstitutionRefusal, digestOf, hasExactKeys, institutionFailure, operatorRead, operatorWrite, refuse, type InstitutionActor, type Outcome,
} from './institution-exams.ts';

// Rooms, participant room placement and Proctor assignments of institution exams (ASSESS-INSTITUTION-002;
// Owner OB-2, RP-1..RP-5, OB-3; A04-1). For one session (Jadwal Sesi) at a time, before its exams open, the
// School Operator puts every participant into exactly one physical room, sets the Proctors of each room and
// adds students of the exam's rombel who were enrolled after placement. A physical room is identified within
// the session by its normalized label; it is one 0031 row per ExamInstance, kept in sync with that exam's
// participants (the row exists exactly while one of them is in it), every row of one room carrying the same
// text (E2). The Proctors of a room hold one active 0008 assignment per exam with a row of that room, mapped
// (0033) to it (E3). Cancelled exams are frozen and never counted (F1). Readiness is re-checked in the same
// transaction (RP-3, E7): a READY exam that no longer passes goes back to SCHEDULED. Each change is one
// append-only action with its entries (0063, E9). No participant is ever removed (OPEN-05). The Operator sees
// ELLIGBLE IDs and rombel only (OB-3): no name, NIS, NISN, birth date, question, key, rubric, score or answer.
//
// Lock order (E6), after the action-key lock and re-authentication of operatorWrite: the session, then each
// affected room label, then each added Proctor and student person, all sorted; then the exam rows of the
// session that are SCHEDULED or READY FOR UPDATE by id (the lock of every lifecycle change; ASSESS-INSTITUTION-003
// E13 narrowed it so a running exam is never locked); then the Proctor memberships FOR SHARE.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERATED_ELLIGBLE_ID = /^elg-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}$/;
export const ROOM_LABEL_MAX_LENGTH = 60;
/** An input bound of one request, not a policy value (§4.3). */
export const MAX_ROOM_PROCTORS = 20;
export const PROCTOR_ID_MAX_LENGTH = 64;
const EDITABLE_STATES = new Set(['SCHEDULED', 'READY']);

export const INSTITUTION_ROOM_ROUTES = {
    rooms: '/api/v1/assessment/institution-exams/rooms',
    roomParticipants: '/api/v1/assessment/institution-exams/rooms/participants',
    roomProctors: '/api/v1/assessment/institution-exams/rooms/proctors',
    participants: '/api/v1/assessment/institution-exams/participants',
} as const;

/** PARTICIPANT_TRANSFER: a running-exam move (ASSESS-ROOM-001), recorded in the same 0063 history (E18). */
export type RoomActionKind = 'ROOM_PARTICIPANTS' | 'ROOM_PROCTORS' | 'PARTICIPANT_ADDITION' | 'PARTICIPANT_TRANSFER';

export type RoomProblemCode =
    | 'room_label_invalid' | 'participant_unknown' | 'already_in_room' | 'room_conflict' | 'room_unknown'
    | 'proctor_unknown' | 'proctor_ineligible' | 'proctor_other_room' | 'proctor_schedule_conflict'
    | 'not_enrolled' | 'already_participant' | 'schedule_conflict';

export interface RoomProblem { code: RoomProblemCode; count?: number; elligbleIds?: string[] }

// ---------------------------------------------------------------------------------------------
// Request bodies (exact keys and shapes; 400 otherwise, before any connection).

const uuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const revisionValue = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** A list of 1 to `max` distinct UUIDs, lowercased; null otherwise. */
function uuidList(value: unknown, max: number): string[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > max || !value.every(uuid)) return null;
    const ids = (value as string[]).map(id => id.toLowerCase());
    return new Set(ids).size === ids.length ? ids : null;
}

/**
 * A room label as recorded (E2): inner whitespace and control-character runs collapsed to one space, trimmed,
 * 1 to 60 characters; null when unusable. The database keeps the same form (0063 room guard).
 */
export function normalizeRoomLabel(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, ' ').trim();
    return text && [...text].length <= ROOM_LABEL_MAX_LENGTH ? text : null;
}

/**
 * An ELLIGBLE ID typed for a Proctor, normalized as identity_identifier_key does (0055): the generated
 * `elg-xxxx-xxxx-xxxx` form is lowercased; any other value (a legacy username) is kept as it is, because it
 * matches only exactly. The value is trimmed first.
 */
export function normalizeProctorId(value: string): string {
    const trimmed = value.trim();
    const lowered = trimmed.replace(/[A-Z]/g, c => c.toLowerCase());
    return GENERATED_ELLIGBLE_ID.test(lowered) ? lowered : trimmed;
}

export interface RoomParticipantsRequest { sessionId: string; roomLabel: string; participantIds: string[]; expectedRevision: number; actionKey: string }
export interface ProctorId { typed: string; normalized: string }
export interface RoomProctorsRequest { sessionId: string; roomLabel: string; proctorIds: ProctorId[]; expectedRevision: number; actionKey: string }
export interface ParticipantAdditionRequest { examInstanceId: string; enrollmentIds: string[]; roomLabel: string; expectedRevision: number; actionKey: string }

export function parseRoomParticipantsRequest(body: Record<string, unknown>): RoomParticipantsRequest | null {
    if (!hasExactKeys(body, ['sessionId', 'roomLabel', 'participantIds', 'expectedRevision', 'actionKey'])) return null;
    const { sessionId, roomLabel, expectedRevision, actionKey } = body;
    if (!uuid(sessionId) || !uuid(actionKey) || typeof roomLabel !== 'string' || !revisionValue(expectedRevision)) return null;
    const participantIds = uuidList(body.participantIds, MAX_ADDED_PARTICIPANTS);
    if (!participantIds) return null;
    return { sessionId: sessionId.toLowerCase(), roomLabel, participantIds, expectedRevision, actionKey: actionKey.toLowerCase() };
}

export function parseRoomProctorsRequest(body: Record<string, unknown>): RoomProctorsRequest | null {
    if (!hasExactKeys(body, ['sessionId', 'roomLabel', 'proctorElligbleIds', 'expectedRevision', 'actionKey'])) return null;
    const { sessionId, roomLabel, proctorElligbleIds, expectedRevision, actionKey } = body;
    if (!uuid(sessionId) || !uuid(actionKey) || typeof roomLabel !== 'string' || !revisionValue(expectedRevision)) return null;
    if (!Array.isArray(proctorElligbleIds) || proctorElligbleIds.length > MAX_ROOM_PROCTORS) return null;
    const proctorIds: ProctorId[] = [];
    for (const value of proctorElligbleIds) {
        if (typeof value !== 'string') return null;
        const typed = value.trim();
        if (typed.length === 0 || [...typed].length > PROCTOR_ID_MAX_LENGTH) return null;
        proctorIds.push({ typed, normalized: normalizeProctorId(typed) });
    }
    // Two equal normalized strings are one ID typed twice.
    if (new Set(proctorIds.map(p => p.normalized)).size !== proctorIds.length) return null;
    return { sessionId: sessionId.toLowerCase(), roomLabel, proctorIds, expectedRevision, actionKey: actionKey.toLowerCase() };
}

export function parseParticipantAdditionRequest(body: Record<string, unknown>): ParticipantAdditionRequest | null {
    if (!hasExactKeys(body, ['examInstanceId', 'enrollmentIds', 'roomLabel', 'expectedRevision', 'actionKey'])) return null;
    const { examInstanceId, roomLabel, expectedRevision, actionKey } = body;
    if (!uuid(examInstanceId) || !uuid(actionKey) || typeof roomLabel !== 'string' || !revisionValue(expectedRevision)) return null;
    const enrollmentIds = uuidList(body.enrollmentIds, MAX_ADDED_PARTICIPANTS);
    if (!enrollmentIds) return null;
    return { examInstanceId: examInstanceId.toLowerCase(), enrollmentIds, roomLabel, expectedRevision, actionKey: actionKey.toLowerCase() };
}

// ---------------------------------------------------------------------------------------------
// Pure rules (E2, E3, E5, E7).

/** A write is stale unless it carries the session revision it was read at (E5). */
export function isStaleRevision(expectedRevision: number, currentRevision: number): boolean {
    return expectedRevision !== currentRevision;
}

/** One 0031 row of a non-cancelled exam of the session. `key` is the database's lower(label). */
export interface RoomRow { roomId: string; examId: string; label: string; key: string; participantCount: number }
/** A chosen participant of a non-cancelled exam with its current room row, if any. */
export interface PlacedParticipant { participantId: string; examId: string; roomId: string | null }

export interface RoomMovePlan {
    moves: Array<{ participantId: string; examId: string; fromRoomId: string | null }>;
    /** Exams that need a row of the target room. */
    createFor: string[];
    /** Rows emptied by the moves: removed with their Proctor mappings (E2). */
    prune: string[];
    /** Chosen participants already in the target room. */
    alreadyThere: number;
}

/**
 * The rows to create, update and prune when the chosen participants move into the room whose key is
 * `targetKey` (E2, E4). Only rows and participants of non-cancelled exams are given (F1). A row exists
 * exactly while one participant of its exam is in it: a target row is created per exam that has none, and
 * a source row that the moves empty is pruned. No other row is touched.
 */
export function planRoomMove(chosen: readonly PlacedParticipant[], rows: readonly RoomRow[], targetKey: string): RoomMovePlan {
    const byId = new Map(rows.map(r => [r.roomId, r]));
    const moves: RoomMovePlan['moves'] = [];
    let alreadyThere = 0;
    for (const p of chosen) {
        const from = p.roomId ? byId.get(p.roomId) ?? null : null;
        if (from && from.key === targetKey) alreadyThere++;
        else moves.push({ participantId: p.participantId, examId: p.examId, fromRoomId: from ? from.roomId : null });
    }
    const examsMoving = [...new Set(moves.map(m => m.examId))].sort();
    const createFor = examsMoving.filter(examId => !rows.some(r => r.examId === examId && r.key === targetKey));
    const remaining = new Map(rows.map(r => [r.roomId, r.participantCount]));
    for (const m of moves) if (m.fromRoomId) remaining.set(m.fromRoomId, (remaining.get(m.fromRoomId) ?? 0) - 1);
    const sources = new Set(moves.map(m => m.fromRoomId).filter((id): id is string => id !== null));
    const prune = rows.filter(r => sources.has(r.roomId) && (remaining.get(r.roomId) ?? 0) <= 0).map(r => r.roomId).sort();
    return { moves, createFor, prune, alreadyThere };
}

/** The display label of a room: the label of its earliest row (rows in creation order), or the new label (E2). */
export function roomDisplayLabel(rowsInCreationOrder: readonly RoomRow[], targetKey: string, newLabel: string): string {
    return rowsInCreationOrder.find(r => r.key === targetKey)?.label ?? newLabel;
}

/** The Proctor change of one room: the full set is given at once (E3). */
export function planProctorSet(currentPersons: readonly string[], requestedPersons: readonly string[]): { added: string[]; removed: string[]; changed: boolean } {
    const current = new Set(currentPersons);
    const requested = new Set(requestedPersons);
    const added = [...requested].filter(p => !current.has(p));
    const removed = [...current].filter(p => !requested.has(p));
    return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

export interface ResolvedProctor { typed: string; personId: string | null; membershipId: string | null }

/**
 * Typed IDs that resolve to no member of this school, and the Proctors by person: IDs resolving to one
 * person (a legacy username and the generated ID of one account) collapse to the first typed spelling (§4.3).
 */
export function dedupeProctors(resolved: readonly ResolvedProctor[]): { unknown: string[]; proctors: Array<{ typed: string; personId: string; membershipId: string }> } {
    const unknown: string[] = [];
    const seen = new Set<string>();
    const proctors: Array<{ typed: string; personId: string; membershipId: string }> = [];
    for (const r of resolved) {
        if (!r.personId || !r.membershipId) unknown.push(r.typed);
        else if (!seen.has(r.personId)) {
            seen.add(r.personId);
            proctors.push({ typed: r.typed, personId: r.personId, membershipId: r.membershipId });
        }
    }
    return { unknown, proctors };
}

/** E7: a READY exam stays READY when it still passes and goes back to SCHEDULED otherwise; others are not evaluated. */
export function readinessDecision(lifecycleState: string, ready: boolean | null): 'keep' | 'demote' | 'not_evaluated' {
    if (lifecycleState !== 'READY' || ready === null) return 'not_evaluated';
    return ready ? 'keep' : 'demote';
}

/** The room part of readiness as the Operator reads it (E13): the status, the blocker and its counts. */
export function roomReadinessView(result: ConditionalRoomProctorReadinessCompositionResult): Record<string, unknown> {
    const { type, ...rest } = result as Record<string, unknown> & { type: string };
    delete rest.tenantId;
    delete rest.examInstanceId;
    delete rest.roomBasedOperationsEnabled;
    delete rest.proctorPerRoomRequired;
    return { status: type, ...rest };
}

// ---------------------------------------------------------------------------------------------
// Errors (F4): the room constraints first, then the unchanged frame mapping.

function constraintOf(error: unknown): { code: string; constraint: string } {
    const e = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; constraint?: unknown };
    return { code: typeof e.code === 'string' ? e.code : '', constraint: typeof e.constraint === 'string' ? e.constraint : '' };
}

/** The answer of a database error of a room write, or null when the frame mapping applies. */
export function matchRoomFailure(error: unknown): Outcome | null {
    if (error instanceof InstitutionRefusal) return null;
    const { code, constraint } = constraintOf(error);
    if (code === '23505') {
        switch (constraint) {
            case 'uq_sa_institution_room_action_key':
            case 'uq_sa_participant_addition_action_key':
                return { status: 409, body: { error: 'action_key_reused' } };
            case 'uq_sa_institution_room_action_revision':
            case 'uq_sa_exam_participant_room_assignment_participant':
            case 'uq_sa_exam_proctor_room_assignment_mapping':
            case 'uq_sa_proctor_assignment_active':
                return { status: 409, body: { error: 'stale_assignment' } };
            case 'uq_sa_exam_participants_tenant_instance_person':
            case 'uq_sa_participant_addition_entry_participant':
                return { status: 422, body: { error: 'room_invalid', problems: [{ code: 'already_participant' }] } };
            case 'uq_sa_institution_exam_room_label':
                return { status: 422, body: { error: 'room_invalid', problems: [{ code: 'room_label_invalid' }] } };
        }
    }
    if (code === '23514') {
        if (constraint === 'ck_sa_institution_exam_room_label') return { status: 422, body: { error: 'room_invalid', problems: [{ code: 'room_label_invalid' }] } };
        if (constraint === 'ck_sa_institution_exam_room_frozen') return { status: 409, body: { error: 'invalid_state' } };
    }
    return null;
}

/** The rooms error mapper (§4.2): the room constraints, then the unchanged institutionFailure. */
export function institutionRoomFailure(error: unknown): Outcome {
    return matchRoomFailure(error) ?? institutionFailure(error);
}

/** Runs a write; a database error of a room constraint becomes its answer (the transaction is rolled back by operatorWrite). */
function mapped(run: (client: pg.PoolClient, actor: InstitutionActor) => Promise<Outcome>) {
    return async (client: pg.PoolClient, actor: InstitutionActor): Promise<Outcome> => {
        try {
            return await run(client, actor);
        } catch (error) {
            const outcome = matchRoomFailure(error);
            if (outcome) throw new InstitutionRefusal(outcome.status, outcome.body as Record<string, unknown>);
            throw error;
        }
    };
}

// ---------------------------------------------------------------------------------------------
// Session state.

function iso(value: unknown): string {
    return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

const roomInvalid = (problems: RoomProblem[]): never => refuse(422, 'room_invalid', { problems });

export interface LockedSession {
    sessionId: string;
    startsAt: Date;
    endsAt: Date;
    periodLabel: string;
    academicPeriodId: string;
    /** The session's school-zone date, `YYYY-MM-DD`. */
    sessionDay: string;
}

const SESSION_SELECT = `SELECT s.id, s.starts_at, s.ends_at, ep.label AS period_label, ep.academic_period_id,
            to_char((s.starts_at AT TIME ZONE coalesce(t.time_zone, 'UTC'))::date, 'YYYY-MM-DD') AS session_day
     FROM secure_assessment_institution_exam_sessions s
     JOIN secure_assessment_institution_exam_periods ep ON ep.id = s.period_id AND ep.tenant_id = s.tenant_id
     JOIN tenant_tenants t ON t.id = s.tenant_id
     WHERE s.id = $1 AND s.tenant_id = $2`;

function sessionOf(row: Record<string, unknown>): LockedSession {
    return {
        sessionId: String(row.id), startsAt: new Date(row.starts_at as string), endsAt: new Date(row.ends_at as string),
        periodLabel: String(row.period_label), academicPeriodId: String(row.academic_period_id), sessionDay: String(row.session_day),
    };
}

/**
 * E6 step 1: the session lock, then the session must be this tenant's (403 otherwise). Shared with the session-wide
 * transitions of ASSESS-INSTITUTION-003, so room writes and session shortcuts serialize on one key.
 */
export async function lockSession(client: pg.PoolClient, actor: InstitutionActor, sessionId: string): Promise<LockedSession> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sa-institution-rooms:' || $1::text || ':' || $2::text))", [actor.tenantId, sessionId]);
    const res = await client.query(SESSION_SELECT, [sessionId, actor.tenantId]);
    if (res.rows.length !== 1) refuse(403, 'forbidden');
    return sessionOf(res.rows[0]);
}

/** The session revision: the number of room actions recorded for the session (E5). */
export async function sessionRevision(client: pg.PoolClient, tenantId: string, sessionId: string): Promise<number> {
    const res = await client.query(
        'SELECT coalesce(max(revision), 0)::int AS revision FROM secure_assessment_institution_room_actions WHERE tenant_id = $1 AND session_id = $2',
        [tenantId, sessionId]);
    return Number(res.rows[0].revision);
}

/** The database's lower() of a label, so every comparison is the database's (E2). */
async function labelKey(client: pg.PoolClient, label: string): Promise<string> {
    return (await client.query('SELECT lower($1::text) AS key', [label])).rows[0].key as string;
}

/** E6 step 2: one advisory lock per affected room label, sorted. */
async function lockLabels(client: pg.PoolClient, tenantId: string, keys: Array<string | null>): Promise<void> {
    for (const key of [...new Set(keys.filter((k): k is string => k !== null))].sort()) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('sa-institution-room-label:' || $1::text || ':' || $2::text))", [tenantId, key]);
    }
}

/** E6 step 3: one advisory lock per added Proctor and per added student, all sorted. */
async function lockPersons(client: pg.PoolClient, tenantId: string, proctors: string[], students: string[]): Promise<void> {
    const keys = [...new Set([
        ...proctors.map(p => `sa-institution-proctor:${tenantId}:${p}`),
        ...students.map(p => `sa-institution-participant:${tenantId}:${p}`),
    ])].sort();
    for (const key of keys) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
}

interface SessionExam {
    id: string;
    lifecycleState: string;
    cancelled: boolean;
    /** TRUE/TRUE: room-based with a Proctor per room (RP-1). */
    roomPolicy: boolean;
}

/**
 * E6 step 4, narrowed by ASSESS-INSTITUTION-003 E13 (R14): the session's exams are read without a lock, then only those
 * that were SCHEDULED or READY are taken FOR UPDATE by id, then every state is read again. An exam that has left those
 * states never returns to them, so it is refused without a lock when the write affects it (requireEditable), and the
 * answer saves of a running exam never wait for a room write.
 */
async function lockSessionExams(client: pg.PoolClient, tenantId: string, sessionId: string): Promise<SessionExam[]> {
    const unlocked = await client.query(
        `SELECT i.id, i.lifecycle_state FROM secure_assessment_exam_instances i
         WHERE i.tenant_id = $1 AND i.institution_session_id = $2 ORDER BY i.id`, [tenantId, sessionId]);
    const editable = unlocked.rows.filter(r => EDITABLE_STATES.has(r.lifecycle_state)).map(r => r.id as string);
    if (editable.length > 0) {
        await client.query(
            `SELECT i.id FROM secure_assessment_exam_instances i
             WHERE i.tenant_id = $1 AND i.id = ANY($2::uuid[]) ORDER BY i.id FOR UPDATE OF i`, [tenantId, editable]);
    }
    const res = await client.query(
        `SELECT i.id, i.lifecycle_state,
                (coalesce(i.room_based_operations_enabled, FALSE) AND coalesce(i.proctor_per_room_required, FALSE)) AS room_policy,
                EXISTS (SELECT 1 FROM secure_assessment_exam_cancellations c WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id) AS cancelled
         FROM secure_assessment_exam_instances i
         WHERE i.tenant_id = $1 AND i.institution_session_id = $2 ORDER BY i.id`, [tenantId, sessionId]);
    return res.rows.map(r => ({ id: r.id, lifecycleState: r.lifecycle_state, cancelled: r.cancelled === true, roomPolicy: r.room_policy === true }));
}

/** The 0031 rows of these exams, in creation order, with their participant counts. */
async function readRoomRows(client: pg.PoolClient, tenantId: string, examIds: string[]): Promise<RoomRow[]> {
    if (examIds.length === 0) return [];
    const res = await client.query(
        `SELECT r.id, r.exam_instance_id, r.display_label, lower(r.display_label) AS label_key,
                (SELECT count(*)::int FROM secure_assessment_exam_participant_room_assignments ra
                 WHERE ra.tenant_id = r.tenant_id AND ra.exam_instance_id = r.exam_instance_id AND ra.exam_room_id = r.id) AS participants
         FROM secure_assessment_exam_rooms r
         WHERE r.tenant_id = $1 AND r.exam_instance_id = ANY($2::uuid[])
         ORDER BY r.created_at, r.id`, [tenantId, examIds]);
    return res.rows.map(r => ({ roomId: r.id, examId: r.exam_instance_id, label: r.display_label, key: r.label_key, participantCount: Number(r.participants) }));
}

/** An active 0008 assignment of these exams mapped (0033) to one of their rows. */
interface ProctorLink { assignmentId: string; examId: string; personId: string; roomId: string }

async function readProctorLinks(client: pg.PoolClient, tenantId: string, examIds: string[]): Promise<ProctorLink[]> {
    if (examIds.length === 0) return [];
    const res = await client.query(
        `SELECT pa.id, pa.exam_instance_id, pa.person_id, m.exam_room_id
         FROM secure_assessment_proctor_assignments pa
         JOIN secure_assessment_exam_proctor_room_assignments m
           ON m.proctor_assignment_id = pa.id AND m.tenant_id = pa.tenant_id AND m.exam_instance_id = pa.exam_instance_id
         WHERE pa.tenant_id = $1 AND pa.exam_instance_id = ANY($2::uuid[]) AND pa.revoked_at IS NULL
         ORDER BY pa.id, m.exam_room_id`, [tenantId, examIds]);
    return res.rows.map(r => ({ assignmentId: r.id, examId: r.exam_instance_id, personId: r.person_id, roomId: r.exam_room_id }));
}

/** The current Proctors of a room: from the rows of non-cancelled exams only (E3). */
function roomProctorPersons(links: readonly ProctorLink[], rows: readonly RoomRow[], key: string): string[] {
    const roomIds = new Set(rows.filter(r => r.key === key).map(r => r.roomId));
    return [...new Set(links.filter(l => roomIds.has(l.roomId)).map(l => l.personId))].sort();
}

/** D04.2-41: the label is used by an open exam of another overlapping institution session of this tenant (E8). */
async function roomConflict(client: pg.PoolClient, tenantId: string, session: LockedSession, key: string): Promise<boolean> {
    const res = await client.query(
        `SELECT 1
         FROM secure_assessment_exam_rooms r
         JOIN secure_assessment_exam_instances i ON i.id = r.exam_instance_id AND i.tenant_id = r.tenant_id
         JOIN secure_assessment_institution_exam_sessions s ON s.id = i.institution_session_id AND s.tenant_id = i.tenant_id
         WHERE r.tenant_id = $1 AND lower(r.display_label) = $2 AND i.institution_session_id <> $3
           AND i.lifecycle_state = ANY($4::text[])
           AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_cancellations c WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id)
           AND s.starts_at < $6 AND s.ends_at > $5
         LIMIT 1`, [tenantId, key, session.sessionId, SCHEDULING_STATES, session.startsAt, session.endsAt]);
    return res.rows.length > 0;
}

/** E10: an affected exam that is not SCHEDULED or READY refuses the whole write. */
function requireEditable(exams: readonly SessionExam[]): void {
    for (const exam of [...exams].sort((a, b) => a.id.localeCompare(b.id))) {
        if (!EDITABLE_STATES.has(exam.lifecycleState)) refuse(409, 'invalid_state', { examInstanceId: exam.id, currentState: exam.lifecycleState });
    }
}

// ---------------------------------------------------------------------------------------------
// Writes.

interface PendingEntry {
    examId: string;
    kind: 'PARTICIPANT_ROOM' | 'PROCTOR_ASSIGNED' | 'PROCTOR_REVOKED';
    participantId: string | null;
    assignmentId: string | null;
    fromLabel: string | null;
    label: string;
}

/** RP-1: an affected institution exam that is not TRUE/TRUE becomes room-based with a Proctor per room. */
async function applyRoomPolicy(client: pg.PoolClient, tenantId: string, exams: readonly SessionExam[]): Promise<void> {
    const ids = exams.filter(e => !e.roomPolicy).map(e => e.id);
    if (ids.length === 0) return;
    await client.query(
        `UPDATE secure_assessment_exam_instances SET room_based_operations_enabled = TRUE, proctor_per_room_required = TRUE
         WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, ids]);
}

/** One Proctor of one row: the person's active assignment of the exam (or a new one), mapped to the row. */
async function assignProctor(client: pg.PoolClient, tenantId: string, examId: string, roomId: string, label: string, personId: string, entries: PendingEntry[]): Promise<void> {
    const active = await client.query(
        `SELECT id FROM secure_assessment_proctor_assignments
         WHERE tenant_id = $1 AND exam_instance_id = $2 AND person_id = $3 AND revoked_at IS NULL`, [tenantId, examId, personId]);
    const assignmentId: string = active.rows[0]?.id ?? (await client.query(
        `INSERT INTO secure_assessment_proctor_assignments (tenant_id, exam_instance_id, person_id) VALUES ($1, $2, $3) RETURNING id`,
        [tenantId, examId, personId])).rows[0].id;
    await client.query(
        `INSERT INTO secure_assessment_exam_proctor_room_assignments (tenant_id, exam_instance_id, proctor_assignment_id, exam_room_id)
         VALUES ($1, $2, $3, $4)`, [tenantId, examId, assignmentId, roomId]);
    entries.push({ examId, kind: 'PROCTOR_ASSIGNED', participantId: null, assignmentId, fromLabel: null, label });
}

/** A new row of a room for one exam, with the room's current Proctors (E2, E3). */
async function createRoomRow(client: pg.PoolClient, tenantId: string, examId: string, label: string, proctors: readonly string[], entries: PendingEntry[]): Promise<string> {
    const roomId: string = (await client.query(
        'INSERT INTO secure_assessment_exam_rooms (tenant_id, exam_instance_id, display_label) VALUES ($1, $2, $3) RETURNING id',
        [tenantId, examId, label])).rows[0].id;
    for (const personId of proctors) await assignProctor(client, tenantId, examId, roomId, label, personId, entries);
    return roomId;
}

/** An emptied row: its mappings removed, the assignments mapped only to it revoked, then the row removed (E2). */
async function pruneRoomRow(client: pg.PoolClient, tenantId: string, row: RoomRow, entries: PendingEntry[]): Promise<void> {
    const mappedHere = await client.query(
        `SELECT DISTINCT pa.id FROM secure_assessment_proctor_assignments pa
         JOIN secure_assessment_exam_proctor_room_assignments m ON m.proctor_assignment_id = pa.id AND m.tenant_id = pa.tenant_id
         WHERE m.tenant_id = $1 AND m.exam_room_id = $2 AND pa.revoked_at IS NULL ORDER BY pa.id`, [tenantId, row.roomId]);
    await client.query('DELETE FROM secure_assessment_exam_proctor_room_assignments WHERE tenant_id = $1 AND exam_room_id = $2', [tenantId, row.roomId]);
    for (const { id } of mappedHere.rows) {
        const revoked = await client.query(
            `UPDATE secure_assessment_proctor_assignments pa SET revoked_at = statement_timestamp()
             WHERE pa.id = $1 AND pa.tenant_id = $2 AND pa.revoked_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_proctor_room_assignments m WHERE m.tenant_id = pa.tenant_id AND m.proctor_assignment_id = pa.id)
             RETURNING id`, [id, tenantId]);
        if (revoked.rowCount === 1) entries.push({ examId: row.examId, kind: 'PROCTOR_REVOKED', participantId: null, assignmentId: id, fromLabel: null, label: row.label });
    }
    await client.query('DELETE FROM secure_assessment_exam_rooms WHERE id = $1 AND tenant_id = $2', [row.roomId, tenantId]);
}

/** E7: every affected READY exam is evaluated again; one that fails goes back to SCHEDULED with its event. */
async function recheckReadiness(client: pg.PoolClient, actor: InstitutionActor, exams: readonly SessionExam[]): Promise<string[]> {
    const demoted: string[] = [];
    for (const exam of [...exams].sort((a, b) => a.id.localeCompare(b.id))) {
        if (exam.lifecycleState !== 'READY') continue;
        const readiness = await evaluateExamReadiness(client, actor.tenantId, exam.id);
        if (readinessDecision(exam.lifecycleState, readiness.ready) !== 'demote') continue;
        const moved = await client.query(
            `UPDATE secure_assessment_exam_instances SET lifecycle_state = 'SCHEDULED' WHERE id = $1 AND tenant_id = $2 AND lifecycle_state = 'READY'`,
            [exam.id, actor.tenantId]);
        if (moved.rowCount !== 1) throw new Error('A ready exam could not be scheduled again.');
        await client.query(
            `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id)
             VALUES ($1, $2, 'READY', 'SCHEDULED', $3)`, [actor.tenantId, exam.id, actor.personId]);
        demoted.push(exam.id);
    }
    return demoted;
}

/** The append-only action row and its entries (E9). */
async function recordAction(
    client: pg.PoolClient, actor: InstitutionActor,
    action: { sessionId: string; kind: RoomActionKind; revision: number; demoted: string[]; actionKey: string; digest: string },
    entries: readonly PendingEntry[]
): Promise<void> {
    const recorded = await client.query(
        `INSERT INTO secure_assessment_institution_room_actions
             (tenant_id, session_id, kind, revision, demoted_exam_instance_ids, actor_person_id, action_key, request_digest)
         VALUES ($1, $2, $3, $4, $5::uuid[], $6, $7, $8) RETURNING id`,
        [actor.tenantId, action.sessionId, action.kind, action.revision, action.demoted, actor.personId, action.actionKey, action.digest]);
    if (entries.length === 0) return;
    await client.query(
        `INSERT INTO secure_assessment_institution_room_action_entries
             (tenant_id, action_id, exam_instance_id, entry_kind, exam_participant_id, proctor_assignment_id, from_room_label, room_label)
         SELECT $1, $2, e.exam, e.kind, e.participant, e.assignment, e.from_label, e.label
         FROM unnest($3::uuid[], $4::text[], $5::uuid[], $6::uuid[], $7::text[], $8::text[]) WITH ORDINALITY AS e(exam, kind, participant, assignment, from_label, label, n)
         ORDER BY e.n`,
        [actor.tenantId, recorded.rows[0].id, entries.map(e => e.examId), entries.map(e => e.kind), entries.map(e => e.participantId),
            entries.map(e => e.assignmentId), entries.map(e => e.fromLabel), entries.map(e => e.label)]);
}

export interface RecordedAction { id: string; kind: string; actorPersonId: string; digest: string; revision: number; demoted: string[]; sessionId: string }

/** The earlier action of this key, for the replay (§4.2 step 3). */
export async function findAction(client: pg.PoolClient, tenantId: string, actionKey: string): Promise<RecordedAction | null> {
    const res = await client.query(
        `SELECT id, kind, actor_person_id, request_digest, revision, demoted_exam_instance_ids, session_id
         FROM secure_assessment_institution_room_actions WHERE tenant_id = $1 AND action_key = $2`, [tenantId, actionKey]);
    const r = res.rows[0];
    return r ? {
        id: r.id, kind: r.kind, actorPersonId: r.actor_person_id, digest: r.request_digest, revision: Number(r.revision),
        demoted: (r.demoted_exam_instance_ids ?? []) as string[], sessionId: r.session_id,
    } : null;
}

export function sameAction(earlier: RecordedAction, kind: RoomActionKind, actor: InstitutionActor, digest: string): void {
    if (earlier.kind !== kind || earlier.actorPersonId !== actor.personId || earlier.digest !== digest) refuse(409, 'action_key_reused');
}

/** The rooms and their participants and Proctors as the writes read them under the locks. */
interface SessionRooms { live: SessionExam[]; rows: RoomRow[]; links: ProctorLink[] }

async function readSessionRooms(client: pg.PoolClient, tenantId: string, exams: SessionExam[]): Promise<SessionRooms> {
    const live = exams.filter(e => !e.cancelled);
    const ids = live.map(e => e.id);
    return { live, rows: await readRoomRows(client, tenantId, ids), links: await readProctorLinks(client, tenantId, ids) };
}

// POST rooms/participants -------------------------------------------------------------------

async function placeParticipants(client: pg.PoolClient, actor: InstitutionActor, request: RoomParticipantsRequest): Promise<Outcome> {
    const label = normalizeRoomLabel(request.roomLabel);
    const digest = digestOf(actor, 'ROOM_PARTICIPANTS', {
        sessionId: request.sessionId, roomLabel: label ?? request.roomLabel, participantIds: [...request.participantIds].sort(), expectedRevision: request.expectedRevision,
    });
    const earlier = await findAction(client, actor.tenantId, request.actionKey);
    if (earlier) {
        sameAction(earlier, 'ROOM_PARTICIPANTS', actor, digest);
        const moved = await client.query(
            `SELECT count(*)::int AS n FROM secure_assessment_institution_room_action_entries WHERE tenant_id = $1 AND action_id = $2 AND entry_kind = 'PARTICIPANT_ROOM'`,
            [actor.tenantId, earlier.id]);
        return { status: 200, body: { sessionId: earlier.sessionId, revision: earlier.revision, moved: Number(moved.rows[0].n), demoted: earlier.demoted, replayed: true } };
    }
    const session = await lockSession(client, actor, request.sessionId);
    const revision = await sessionRevision(client, actor.tenantId, session.sessionId);
    if (isStaleRevision(request.expectedRevision, revision)) refuse(409, 'stale_assignment', { revision });
    const targetKey = label === null ? null : await labelKey(client, label);

    const readChosen = async () => (await client.query(
        `SELECT p.id, p.exam_instance_id, ra.exam_room_id, lower(r.display_label) AS room_key
         FROM secure_assessment_exam_participants p
         JOIN secure_assessment_exam_instances i ON i.id = p.exam_instance_id AND i.tenant_id = p.tenant_id
         LEFT JOIN secure_assessment_exam_participant_room_assignments ra
           ON ra.tenant_id = p.tenant_id AND ra.exam_instance_id = p.exam_instance_id AND ra.exam_participant_id = p.id
         LEFT JOIN secure_assessment_exam_rooms r ON r.id = ra.exam_room_id AND r.tenant_id = ra.tenant_id
         WHERE p.tenant_id = $1 AND i.institution_session_id = $2 AND p.id = ANY($3::uuid[])
         ORDER BY p.id`, [actor.tenantId, session.sessionId, request.participantIds])).rows;
    // The room state of the session does not change under the session lock: the labels to lock are the
    // target and the rooms the chosen participants leave.
    await lockLabels(client, actor.tenantId, [targetKey, ...(await readChosen()).map(r => r.room_key as string | null)]);
    const exams = await lockSessionExams(client, actor.tenantId, session.sessionId);
    const state = await readSessionRooms(client, actor.tenantId, exams);
    const liveIds = new Set(state.live.map(e => e.id));
    const chosen: PlacedParticipant[] = (await readChosen()).filter(r => liveIds.has(r.exam_instance_id))
        .map(r => ({ participantId: r.id, examId: r.exam_instance_id, roomId: r.exam_room_id ?? null }));
    const unknown = request.participantIds.length - chosen.length;
    const plan = targetKey === null ? null : planRoomMove(chosen, state.rows, targetKey);

    const affectedIds = new Set(plan ? plan.moves.map(m => m.examId) : chosen.map(p => p.examId));
    const affected = state.live.filter(e => affectedIds.has(e.id));
    requireEditable(affected);

    const problems: RoomProblem[] = [];
    if (label === null) problems.push({ code: 'room_label_invalid' });
    if (unknown > 0) problems.push({ code: 'participant_unknown' });
    if (plan && unknown === 0 && plan.moves.length === 0) problems.push({ code: 'already_in_room' });
    if (targetKey !== null && await roomConflict(client, actor.tenantId, session, targetKey)) problems.push({ code: 'room_conflict' });
    if (problems.length > 0 || !plan || label === null || targetKey === null) return roomInvalid(problems);

    const entries: PendingEntry[] = [];
    await applyRoomPolicy(client, actor.tenantId, affected);
    const display = roomDisplayLabel(state.rows, targetKey, label);
    const proctors = roomProctorPersons(state.links, state.rows, targetKey);
    const target = new Map(state.rows.filter(r => r.key === targetKey).map(r => [r.examId, r.roomId]));
    for (const examId of plan.createFor) target.set(examId, await createRoomRow(client, actor.tenantId, examId, display, proctors, entries));
    const byRoom = new Map(state.rows.map(r => [r.roomId, r]));
    const updates = plan.moves.filter(m => m.fromRoomId !== null);
    const inserts = plan.moves.filter(m => m.fromRoomId === null);
    if (updates.length > 0) {
        await client.query(
            `UPDATE secure_assessment_exam_participant_room_assignments ra SET exam_room_id = m.room, assigned_at = statement_timestamp()
             FROM unnest($2::uuid[], $3::uuid[]) AS m(participant, room)
             WHERE ra.tenant_id = $1 AND ra.exam_participant_id = m.participant`,
            [actor.tenantId, updates.map(m => m.participantId), updates.map(m => target.get(m.examId)!)]);
    }
    if (inserts.length > 0) {
        await client.query(
            `INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
             SELECT $1, m.exam, m.participant, m.room FROM unnest($2::uuid[], $3::uuid[], $4::uuid[]) AS m(exam, participant, room)`,
            [actor.tenantId, inserts.map(m => m.examId), inserts.map(m => m.participantId), inserts.map(m => target.get(m.examId)!)]);
    }
    for (const m of plan.moves) {
        entries.push({
            examId: m.examId, kind: 'PARTICIPANT_ROOM', participantId: m.participantId, assignmentId: null,
            fromLabel: m.fromRoomId ? byRoom.get(m.fromRoomId)?.label ?? null : null, label: display,
        });
    }
    for (const roomId of plan.prune) await pruneRoomRow(client, actor.tenantId, byRoom.get(roomId)!, entries);
    const demoted = await recheckReadiness(client, actor, affected);
    await recordAction(client, actor, { sessionId: session.sessionId, kind: 'ROOM_PARTICIPANTS', revision: revision + 1, demoted, actionKey: request.actionKey, digest }, entries);
    return { status: 200, body: { sessionId: session.sessionId, revision: revision + 1, moved: plan.moves.length, demoted, replayed: false } };
}

// POST rooms/proctors -----------------------------------------------------------------------

/** Each typed ID through findAccountByElligbleId, then to a membership of this tenant only (E12). */
async function resolveProctors(client: pg.PoolClient, tenantId: string, ids: readonly ProctorId[]): Promise<ResolvedProctor[]> {
    const resolved: ResolvedProctor[] = [];
    for (const id of ids) {
        const account = await findAccountByElligbleId(client, id.normalized);
        const membership = account ? await client.query(
            'SELECT id FROM tenant_memberships WHERE tenant_id = $1 AND person_id = $2 ORDER BY id LIMIT 1', [tenantId, account.personId]) : null;
        const membershipId = membership?.rows[0]?.id ?? null;
        resolved.push({ typed: id.typed, personId: membershipId ? account!.personId : null, membershipId });
    }
    return resolved;
}

async function setRoomProctors(client: pg.PoolClient, actor: InstitutionActor, request: RoomProctorsRequest): Promise<Outcome> {
    const label = normalizeRoomLabel(request.roomLabel);
    const digest = digestOf(actor, 'ROOM_PROCTORS', {
        sessionId: request.sessionId, roomLabel: label ?? request.roomLabel, proctorElligbleIds: request.proctorIds.map(p => p.normalized), expectedRevision: request.expectedRevision,
    });
    const earlier = await findAction(client, actor.tenantId, request.actionKey);
    if (earlier) {
        sameAction(earlier, 'ROOM_PROCTORS', actor, digest);
        const { proctors } = dedupeProctors(await resolveProctors(client, actor.tenantId, request.proctorIds));
        return {
            status: 200,
            body: { sessionId: earlier.sessionId, revision: earlier.revision, changed: true, proctors: proctors.map(p => ({ elligbleId: p.typed })), demoted: earlier.demoted, replayed: true },
        };
    }
    const session = await lockSession(client, actor, request.sessionId);
    const revision = await sessionRevision(client, actor.tenantId, session.sessionId);
    if (isStaleRevision(request.expectedRevision, revision)) refuse(409, 'stale_assignment', { revision });
    const targetKey = label === null ? null : await labelKey(client, label);
    const { unknown, proctors } = dedupeProctors(await resolveProctors(client, actor.tenantId, request.proctorIds));
    await lockLabels(client, actor.tenantId, [targetKey]);
    await lockPersons(client, actor.tenantId, proctors.map(p => p.personId), []);
    const exams = await lockSessionExams(client, actor.tenantId, session.sessionId);
    if (proctors.length > 0) {
        await client.query('SELECT id FROM tenant_memberships WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR SHARE',
            [actor.tenantId, proctors.map(p => p.membershipId)]);
    }
    const state = await readSessionRooms(client, actor.tenantId, exams);
    const roomRows = targetKey === null ? [] : state.rows.filter(r => r.key === targetKey);
    const known = roomRows.some(r => r.participantCount > 0);
    const affected = known ? state.live.filter(e => roomRows.some(r => r.examId === e.id)) : [];
    requireEditable(affected);

    const problems: RoomProblem[] = [];
    if (!known) problems.push({ code: 'room_unknown' });
    if (unknown.length > 0) problems.push({ code: 'proctor_unknown', elligbleIds: unknown });
    const current = targetKey === null ? [] : roomProctorPersons(state.links, state.rows, targetKey);
    const plan = planProctorSet(current, proctors.map(p => p.personId));
    const added = proctors.filter(p => plan.added.includes(p.personId));
    if (known && added.length > 0) {
        const addedPersons = added.map(p => p.personId);
        const enrolled = await client.query(
            `SELECT DISTINCT m.person_id FROM academic_core_student_enrollments e
             JOIN tenant_memberships m ON m.id = e.membership_id AND m.tenant_id = e.tenant_id
             WHERE e.tenant_id = $1 AND m.person_id = ANY($2::uuid[]) AND e.academic_period_id = $3
               AND e.start_date <= $4::date AND (e.end_date IS NULL OR e.end_date >= $4::date)`,
            [actor.tenantId, addedPersons, session.academicPeriodId, session.sessionDay]);
        const ineligible = new Set<string>([
            ...enrolled.rows.map(r => r.person_id as string),
            ...await overlappingPersonIds(client, actor.tenantId, addedPersons, session.startsAt, session.endsAt),
        ]);
        const roomKeyOf = new Map(state.rows.map(r => [r.roomId, r.key]));
        const otherRoom = new Set(state.links.filter(l => roomKeyOf.get(l.roomId) !== targetKey).map(l => l.personId));
        const elsewhere = await client.query(
            `SELECT DISTINCT pa.person_id FROM secure_assessment_proctor_assignments pa
             JOIN secure_assessment_exam_instances i ON i.id = pa.exam_instance_id AND i.tenant_id = pa.tenant_id
             WHERE pa.tenant_id = $1 AND pa.person_id = ANY($2::uuid[]) AND pa.revoked_at IS NULL
               AND i.institution_session_id IS DISTINCT FROM $3::uuid AND i.lifecycle_state = ANY($4::text[])
               AND i.window_starts_at < $6 AND i.window_ends_at > $5`,
            [actor.tenantId, addedPersons, session.sessionId, SCHEDULING_STATES, session.startsAt, session.endsAt]);
        const conflicting = new Set(elsewhere.rows.map(r => r.person_id as string));
        const typedOf = (set: Set<string>) => added.filter(p => set.has(p.personId)).map(p => p.typed);
        if (typedOf(ineligible).length > 0) problems.push({ code: 'proctor_ineligible', elligbleIds: typedOf(ineligible) });
        if (typedOf(otherRoom).length > 0) problems.push({ code: 'proctor_other_room', elligbleIds: typedOf(otherRoom) });
        if (typedOf(conflicting).length > 0) {
            problems.push({ code: 'proctor_schedule_conflict', count: typedOf(conflicting).length, elligbleIds: typedOf(conflicting) });
        }
    }
    if (problems.length > 0 || targetKey === null) return roomInvalid(problems);
    const answered = proctors.map(p => ({ elligbleId: p.typed }));
    // E3, note g: an unchanged set writes nothing, keeps the revision and answers changed: false.
    if (!plan.changed) return { status: 200, body: { sessionId: session.sessionId, revision, changed: false, proctors: answered, demoted: [], replayed: false } };

    const entries: PendingEntry[] = [];
    await applyRoomPolicy(client, actor.tenantId, affected);
    for (const row of [...roomRows].sort((a, b) => a.examId.localeCompare(b.examId))) {
        for (const personId of plan.added) await assignProctor(client, actor.tenantId, row.examId, row.roomId, row.label, personId, entries);
        for (const link of state.links.filter(l => l.roomId === row.roomId && plan.removed.includes(l.personId))) {
            const revoked = await client.query(
                `UPDATE secure_assessment_proctor_assignments SET revoked_at = statement_timestamp()
                 WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL RETURNING id`, [link.assignmentId, actor.tenantId]);
            if (revoked.rowCount === 1) {
                entries.push({ examId: row.examId, kind: 'PROCTOR_REVOKED', participantId: null, assignmentId: link.assignmentId, fromLabel: null, label: row.label });
            }
        }
    }
    const demoted = await recheckReadiness(client, actor, affected);
    await recordAction(client, actor, { sessionId: session.sessionId, kind: 'ROOM_PROCTORS', revision: revision + 1, demoted, actionKey: request.actionKey, digest }, entries);
    return { status: 200, body: { sessionId: session.sessionId, revision: revision + 1, changed: true, proctors: answered, demoted, replayed: false } };
}

// POST participants -------------------------------------------------------------------------

async function addParticipants(client: pg.PoolClient, actor: InstitutionActor, request: ParticipantAdditionRequest): Promise<Outcome> {
    const label = normalizeRoomLabel(request.roomLabel);
    const digest = digestOf(actor, 'PARTICIPANT_ADDITION', {
        examInstanceId: request.examInstanceId, enrollmentIds: [...request.enrollmentIds].sort(), roomLabel: label ?? request.roomLabel, expectedRevision: request.expectedRevision,
    });
    const earlier = await findAction(client, actor.tenantId, request.actionKey);
    if (earlier) {
        sameAction(earlier, 'PARTICIPANT_ADDITION', actor, digest);
        const recorded = await client.query(
            `SELECT e.academic_enrollment_id, p.person_id
             FROM secure_assessment_exam_participant_additions a
             JOIN secure_assessment_exam_participant_addition_entries e ON e.participant_addition_id = a.id AND e.tenant_id = a.tenant_id
             JOIN secure_assessment_exam_participants p ON p.id = e.exam_participant_id AND p.tenant_id = e.tenant_id
             WHERE a.tenant_id = $1 AND a.action_key = $2 ORDER BY e.academic_enrollment_id`, [actor.tenantId, request.actionKey]);
        const ids = await listElligbleIds(client, recorded.rows.map(r => r.person_id as string));
        return {
            status: 200,
            body: {
                examInstanceId: request.examInstanceId, revision: earlier.revision,
                added: recorded.rows.map(r => ({ enrollmentId: r.academic_enrollment_id, elligbleId: ids.get(r.person_id) ?? null })),
                demoted: earlier.demoted, replayed: true,
            },
        };
    }
    // This tenant's institution exam only (a teacher-managed exam included in the 403); read without a lock:
    // the exam row is locked after the session (E6).
    const examRes = await client.query(
        `SELECT i.institution_session_id, ata.academic_group_id, o.academic_period_id
         FROM secure_assessment_exam_instances i
         JOIN academic_core_teaching_assignments ata ON ata.id = i.teaching_assignment_id AND ata.tenant_id = i.tenant_id
         JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
         WHERE i.id = $1 AND i.tenant_id = $2 AND i.institution_session_id IS NOT NULL`, [request.examInstanceId, actor.tenantId]);
    if (examRes.rows.length !== 1) refuse(403, 'forbidden');
    const { institution_session_id: sessionId, academic_group_id: groupId, academic_period_id: periodId } = examRes.rows[0];
    const session = await lockSession(client, actor, sessionId);
    const revision = await sessionRevision(client, actor.tenantId, session.sessionId);
    if (isStaleRevision(request.expectedRevision, revision)) refuse(409, 'stale_assignment', { revision });
    const targetKey = label === null ? null : await labelKey(client, label);
    // E11: the students enrolled in the exam's rombel on the session's school-zone date.
    const enrolled = new Map((await listEnrolledStudents(client, actor.tenantId, { groupId, periodId, examDay: session.sessionDay })).map(s => [s.enrollmentId, s]));
    const chosen = request.enrollmentIds.flatMap(id => enrolled.get(id) ?? []);
    await lockLabels(client, actor.tenantId, [targetKey]);
    await lockPersons(client, actor.tenantId, [], chosen.map(s => s.personId));
    const exams = await lockSessionExams(client, actor.tenantId, session.sessionId);
    const exam = exams.find(e => e.id === request.examInstanceId);
    if (!exam) throw new Error('The institution exam left its session.');
    requireEditable([exam]);
    if (exam.cancelled) refuse(409, 'invalid_state', { examInstanceId: exam.id, currentState: exam.lifecycleState });

    const problems: RoomProblem[] = [];
    if (label === null) problems.push({ code: 'room_label_invalid' });
    if (chosen.length < request.enrollmentIds.length) problems.push({ code: 'not_enrolled', count: request.enrollmentIds.length - chosen.length });
    const taken = new Set((await client.query(
        'SELECT person_id FROM secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2', [actor.tenantId, exam.id])).rows.map(r => r.person_id as string));
    const fresh: EnrolledStudent[] = [];
    let already = 0;
    for (const student of chosen) {
        if (taken.has(student.personId)) already++;
        else {
            taken.add(student.personId);
            fresh.push(student);
        }
    }
    if (already > 0) problems.push({ code: 'already_participant', count: already });
    if (fresh.length > 0) {
        const conflicting = new Set(await overlappingPersonIds(client, actor.tenantId, fresh.map(s => s.personId), session.startsAt, session.endsAt));
        const blocked = fresh.filter(s => conflicting.has(s.personId)).length;
        if (blocked > 0) problems.push({ code: 'schedule_conflict', count: blocked });
    }
    if (targetKey !== null && await roomConflict(client, actor.tenantId, session, targetKey)) problems.push({ code: 'room_conflict' });
    if (problems.length > 0 || label === null || targetKey === null) return roomInvalid(problems);

    const state = await readSessionRooms(client, actor.tenantId, exams);
    const entries: PendingEntry[] = [];
    await applyRoomPolicy(client, actor.tenantId, [exam]);
    // 0053: the addition with its provenance, as the Teacher's addition writes it (teacher-exam-participants.ts).
    const addition = await client.query(
        `INSERT INTO secure_assessment_exam_participant_additions
             (tenant_id, exam_instance_id, added_by_person_id, added_at, previous_lifecycle_state, action_key)
         VALUES ($1, $2, $3, statement_timestamp(), $4, $5) RETURNING id`,
        [actor.tenantId, exam.id, actor.personId, exam.lifecycleState, request.actionKey]);
    const additionId: string = addition.rows[0].id;
    const display = roomDisplayLabel(state.rows, targetKey, label);
    const roomId = state.rows.find(r => r.examId === exam.id && r.key === targetKey)?.roomId
        ?? await createRoomRow(client, actor.tenantId, exam.id, display, roomProctorPersons(state.links, state.rows, targetKey), entries);
    for (const student of fresh) {
        const participant = await client.query(
            `INSERT INTO secure_assessment_exam_participants (tenant_id, exam_instance_id, person_id, academic_enrollment_id)
             VALUES ($1, $2, $3, $4) RETURNING id`, [actor.tenantId, exam.id, student.personId, student.enrollmentId]);
        const participantId: string = participant.rows[0].id;
        await client.query(
            `INSERT INTO secure_assessment_exam_participant_addition_entries
                 (participant_addition_id, tenant_id, exam_instance_id, exam_participant_id, academic_enrollment_id)
             VALUES ($1, $2, $3, $4, $5)`, [additionId, actor.tenantId, exam.id, participantId, student.enrollmentId]);
        await client.query(
            `INSERT INTO secure_assessment_exam_participant_room_assignments (tenant_id, exam_instance_id, exam_participant_id, exam_room_id)
             VALUES ($1, $2, $3, $4)`, [actor.tenantId, exam.id, participantId, roomId]);
        entries.push({ examId: exam.id, kind: 'PARTICIPANT_ROOM', participantId, assignmentId: null, fromLabel: null, label: display });
    }
    const demoted = await recheckReadiness(client, actor, [exam]);
    await recordAction(client, actor, { sessionId: session.sessionId, kind: 'PARTICIPANT_ADDITION', revision: revision + 1, demoted, actionKey: request.actionKey, digest }, entries);
    return {
        status: 201,
        body: { examInstanceId: exam.id, revision: revision + 1, added: fresh.map(s => ({ enrollmentId: s.enrollmentId, elligbleId: s.elligbleId })), demoted, replayed: false },
    };
}

// GET rooms ---------------------------------------------------------------------------------

/** One room as the Operator reads it (§4.3). */
export interface RoomView {
    label: string;
    participantCount: number;
    groups: Array<{ examInstanceId: string; subjectLabel: string | null; groupLabel: string | null; count: number }>;
    proctors: Array<{ elligbleId: string }>;
}

async function readRoomView(client: pg.PoolClient, actor: InstitutionActor, sessionId: string): Promise<Outcome> {
    const sessionRes = await client.query(SESSION_SELECT, [sessionId, actor.tenantId]);
    if (sessionRes.rows.length !== 1) refuse(403, 'forbidden');
    const session = sessionOf(sessionRes.rows[0]);
    const revision = await sessionRevision(client, actor.tenantId, sessionId);
    const examRes = await client.query(
        `SELECT i.id, i.lifecycle_state, s.display_label AS subject_label, g.display_label AS group_label, ata.academic_group_id, o.academic_period_id,
                (coalesce(i.room_based_operations_enabled, FALSE) AND coalesce(i.proctor_per_room_required, FALSE)) AS room_policy
         FROM secure_assessment_exam_instances i
         JOIN academic_core_teaching_assignments ata ON ata.id = i.teaching_assignment_id AND ata.tenant_id = i.tenant_id
         LEFT JOIN academic_core_subject_offerings o ON o.id = ata.subject_offering_id AND o.tenant_id = ata.tenant_id
         LEFT JOIN academic_core_subjects s ON s.id = o.subject_id AND s.tenant_id = o.tenant_id
         LEFT JOIN academic_core_academic_groups g ON g.id = ata.academic_group_id AND g.tenant_id = ata.tenant_id
         WHERE i.tenant_id = $1 AND i.institution_session_id = $2
           AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_cancellations c WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id)
         ORDER BY s.display_label, g.display_label, i.id`, [actor.tenantId, sessionId]);
    const examIds = examRes.rows.map(r => r.id as string);
    const rows = await readRoomRows(client, actor.tenantId, examIds);
    const links = await readProctorLinks(client, actor.tenantId, examIds);
    const participantRes = examIds.length === 0 ? { rows: [] as Array<Record<string, unknown>> } : await client.query(
        `SELECT p.id, p.exam_instance_id, p.person_id, r.display_label
         FROM secure_assessment_exam_participants p
         LEFT JOIN secure_assessment_exam_participant_room_assignments ra
           ON ra.tenant_id = p.tenant_id AND ra.exam_instance_id = p.exam_instance_id AND ra.exam_participant_id = p.id
         LEFT JOIN secure_assessment_exam_rooms r ON r.id = ra.exam_room_id AND r.tenant_id = ra.tenant_id
         WHERE p.tenant_id = $1 AND p.exam_instance_id = ANY($2::uuid[])`, [actor.tenantId, examIds]);
    const ids = await listElligbleIds(client, [...new Set([...participantRes.rows.map(r => r.person_id as string), ...links.map(l => l.personId)])]);
    const byElligbleId = (a: { elligbleId: string | null }, b: { elligbleId: string | null }) => (a.elligbleId ?? '') < (b.elligbleId ?? '') ? -1 : (a.elligbleId ?? '') > (b.elligbleId ?? '') ? 1 : 0;

    const examInfo = new Map(examRes.rows.map(r => [r.id as string, r]));
    const rooms = new Map<string, RoomView & { key: string; persons: Set<string> }>();
    for (const row of rows) {
        if (row.participantCount === 0) continue;
        const room = rooms.get(row.key) ?? { key: row.key, label: row.label, participantCount: 0, groups: [], proctors: [], persons: new Set<string>() };
        room.participantCount += row.participantCount;
        const info = examInfo.get(row.examId);
        room.groups.push({ examInstanceId: row.examId, subjectLabel: info?.subject_label ?? null, groupLabel: info?.group_label ?? null, count: row.participantCount });
        for (const link of links.filter(l => l.roomId === row.roomId)) room.persons.add(link.personId);
        rooms.set(row.key, room);
    }
    const order = new Map(examIds.map((id, i) => [id, i]));
    const roomList = [...rooms.values()]
        .sort((a, b) => a.label.localeCompare(b.label, 'id', { numeric: true, sensitivity: 'base' }) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map(({ key: _key, persons, ...room }) => ({
            ...room,
            groups: room.groups.sort((a, b) => (order.get(a.examInstanceId) ?? 0) - (order.get(b.examInstanceId) ?? 0)),
            proctors: [...persons].map(p => ({ elligbleId: ids.get(p) ?? null })).filter((p): p is { elligbleId: string } => p.elligbleId !== null).sort(byElligbleId),
        }));

    const examsView = [];
    for (const exam of examRes.rows) {
        const editable = EDITABLE_STATES.has(exam.lifecycle_state);
        const participants = participantRes.rows.filter(p => p.exam_instance_id === exam.id)
            .map(p => ({ participantId: p.id as string, elligbleId: ids.get(p.person_id as string) ?? null, roomLabel: (p.display_label as string | null) ?? null }))
            .sort(byElligbleId);
        let roomReadiness: Record<string, unknown> | null = null;
        let candidates: Array<{ enrollmentId: string; elligbleId: string; conflict: boolean }> = [];
        if (editable) {
            roomReadiness = roomReadinessView(await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
                client, actor.tenantId, exam.id, async () => 'granted' as const));
            const taken = new Set(participantRes.rows.filter(p => p.exam_instance_id === exam.id).map(p => p.person_id as string));
            const seen = new Set<string>();
            const open = (await listEnrolledStudents(client, actor.tenantId, { groupId: exam.academic_group_id, periodId: exam.academic_period_id, examDay: session.sessionDay }))
                .filter(s => !taken.has(s.personId) && (seen.has(s.personId) ? false : (seen.add(s.personId), true)));
            const conflicting = open.length === 0 ? new Set<string>()
                : new Set(await overlappingPersonIds(client, actor.tenantId, open.map(s => s.personId), session.startsAt, session.endsAt));
            candidates = open.map(s => ({ enrollmentId: s.enrollmentId, elligbleId: s.elligbleId, conflict: conflicting.has(s.personId) }));
        }
        examsView.push({
            examInstanceId: exam.id, subjectLabel: exam.subject_label ?? null, groupLabel: exam.group_label ?? null, lifecycleState: exam.lifecycle_state,
            editable, roomBased: exam.room_policy === true, roomReadiness, participants, candidates,
        });
    }
    return {
        status: 200,
        body: {
            session: { sessionId, periodLabel: session.periodLabel, startsAt: iso(session.startsAt), endsAt: iso(session.endsAt) },
            revision,
            rooms: roomList,
            exams: examsView,
        },
    };
}

// ---------------------------------------------------------------------------------------------
// Routes.

/** The Operator room routes (§4.3): method, exact body or query, then one transaction each. */
export async function handleInstitutionRoomRoute(
    req: http.IncomingMessage, res: http.ServerResponse, url: URL, pool: pg.Pool, cookie: SessionCookieConfig
): Promise<void> {
    const send = (outcome: Outcome) => sendJson(res, outcome.status, outcome.body);
    const pathname = url.pathname;
    if (pathname === INSTITUTION_ROOM_ROUTES.rooms) {
        if (req.method !== 'GET') { req.resume(); send({ status: 405, body: { error: 'method_not_allowed' } }); return; }
        const keys = [...url.searchParams.keys()];
        const sessionId = url.searchParams.get('sessionId');
        if (keys.length !== 1 || keys[0] !== 'sessionId' || !uuid(sessionId)) {
            send({ status: 400, body: { error: 'invalid_request' } });
            return;
        }
        send(await operatorRead(req, pool, cookie, (client, actor) => readRoomView(client, actor, sessionId.toLowerCase())));
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
    // One action-key lock for the three writes: a key serves one route only (uq_sa_institution_room_action_key).
    switch (pathname) {
        case INSTITUTION_ROOM_ROUTES.roomParticipants: {
            const request = parseRoomParticipantsRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'rooms', request.actionKey, mapped((c, a) => placeParticipants(c, a, request))));
            return;
        }
        case INSTITUTION_ROOM_ROUTES.roomProctors: {
            const request = parseRoomProctorsRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'rooms', request.actionKey, mapped((c, a) => setRoomProctors(c, a, request))));
            return;
        }
        case INSTITUTION_ROOM_ROUTES.participants: {
            const request = parseParticipantAdditionRequest(body);
            if (!request) return bad();
            send(await operatorWrite(req, pool, cookie, 'rooms', request.actionKey, mapped((c, a) => addParticipants(c, a, request))));
            return;
        }
    }
    send({ status: 404, body: { error: 'not found' } });
}
