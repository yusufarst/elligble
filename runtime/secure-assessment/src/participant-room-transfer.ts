import type * as http from 'node:http';
import type * as pg from 'pg';
import { HttpError, readJsonObject, sendJson } from './http/http-utils.ts';
import type { SessionCookieConfig } from './http/session-credentials.ts';
import {
    InstitutionRefusal, digestOf, hasExactKeys, institutionFailure, operatorWrite, refuse, type InstitutionActor, type Outcome,
} from './institution-exams.ts';
import { findAction, institutionRoomFailure, lockSession, matchRoomFailure, sameAction, sessionRevision } from './institution-rooms.ts';
import { keyShareInstitutionExam } from './school-exam-monitoring.ts';
import { normalizePermissionReason } from './permission-action-audit.ts';

// Participant room transfer during a running institution exam (ASSESS-ROOM-001; §5A, OD-07, O05-4, O05-5, A04-2, A04-3,
// Owner OR-1..OR-5). The School Operator moves one participant of an ACTIVE or PAUSED institution exam from its current
// room to another existing room of the same exam that has an active Proctor (OR-2), with a reason and a confirmation.
// The move compares the participant's assignment_version (0065) and is safe to replay through its action key. It
// changes only the current room row (0032) and appends one PARTICIPANT_TRANSFER action and one entry to the room history
// of ASSESS-INSTITUTION-002 (0063, E18): the Person, Participant, Attempt, snapshots, answers, timer, sessions, locks and
// submissions are never touched (D04.4-28, O05-5), and nothing is sent to the device (OR-3). Every scope is a join on the
// current row per request (A04-3), so the old room's Proctor loses the participant at commit. The reason is stored and
// never returned (F5). A READY move stays with the room screen (OR-1).
//
// Frame (§4.2): the exact body before any connection; operatorWrite (authentication, BEGIN, the action-key lock
// sa-institution:<tenant>:rooms:<key> shared with the room writes, the Operator assignment FOR SHARE); the replay (E9);
// the scope checks by unlocked reads (E6 steps 1-3); the locks in the OR-4 order with their checks: the session lock,
// the exam FOR KEY SHARE (steps 4-5), the participant's 0032 row FOR UPDATE (steps 6-8), the open attempt FOR UPDATE and
// the re-read in a statement of its own (step 9), the target room and its active mapped Proctors FOR SHARE (step 10);
// the writes; re-authentication and COMMIT. Every refusal writes nothing.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export const ROOM_TRANSFER_ROUTE = '/api/v1/assessment/institution-exams/supervision/room-transfer';

/** O05-4 and OR-1: a transfer applies only while the exam runs. */
export const TRANSFER_STATES: ReadonlySet<string> = new Set(['ACTIVE', 'PAUSED']);

export const TRANSFER_BODY_KEYS = ['examInstanceId', 'participantId', 'targetRoomId', 'expectedAssignmentVersion', 'reason', 'confirmed', 'actionKey'] as const;

export interface RoomTransferRequest {
    examInstanceId: string;
    participantId: string;
    targetRoomId: string;
    expectedAssignmentVersion: number;
    reason: string;
    actionKey: string;
}

/** §4.2 step 1: the exact body; the reason in the 0054 form (1 to 200 characters) and confirmed true; null otherwise. */
export function parseRoomTransferRequest(body: Record<string, unknown>): RoomTransferRequest | null {
    if (!hasExactKeys(body, TRANSFER_BODY_KEYS)) return null;
    const { examInstanceId, participantId, targetRoomId, expectedAssignmentVersion, actionKey } = body;
    if (!uuid(examInstanceId) || !uuid(participantId) || !uuid(targetRoomId) || !uuid(actionKey)) return null;
    if (typeof expectedAssignmentVersion !== 'number' || !Number.isInteger(expectedAssignmentVersion) || expectedAssignmentVersion < 1) return null;
    if (body.confirmed !== true) return null;
    const reason = normalizePermissionReason(body.reason);
    if (reason === null) return null;
    return {
        examInstanceId: examInstanceId.toLowerCase(), participantId: participantId.toLowerCase(), targetRoomId: targetRoomId.toLowerCase(),
        expectedAssignmentVersion, reason, actionKey: actionKey.toLowerCase(),
    };
}

/** E9: the digest covers the whole intent, the reason and the confirmation included. */
export function transferDigest(actor: InstitutionActor, request: RoomTransferRequest): string {
    return digestOf(actor, 'PARTICIPANT_TRANSFER', {
        examInstanceId: request.examInstanceId, participantId: request.participantId, targetRoomId: request.targetRoomId,
        expectedAssignmentVersion: request.expectedAssignmentVersion, reason: request.reason, confirmed: true,
    });
}

// ---------------------------------------------------------------------------------------------
// Pure rules (E6).

export type TransferRefusalCode =
    | 'invalid_state' | 'room_setup_required' | 'participant_without_room' | 'stale_assignment' | 'already_in_room'
    | 'attempt_already_submitted' | 'time_up' | 'target_room_unsupervised';

/** E6 steps 4 and 5: ACTIVE or PAUSED, then the TRUE/TRUE room policy. */
export function examRefusal(lifecycleState: string, roomPolicy: boolean): 'invalid_state' | 'room_setup_required' | null {
    if (!TRANSFER_STATES.has(lifecycleState)) return 'invalid_state';
    return roomPolicy ? null : 'room_setup_required';
}

/** E6 steps 6 to 8 on the locked current row (null when the participant has none). */
export function rowRefusal(row: { roomId: string; version: number } | null, expectedVersion: number, targetRoomId: string): 'participant_without_room' | 'stale_assignment' | 'already_in_room' | null {
    if (!row) return 'participant_without_room';
    if (row.version !== expectedVersion) return 'stale_assignment';
    return row.roomId === targetRoomId ? 'already_in_room' : null;
}

/**
 * E6 step 9, from the re-read made after the attempt lock in a statement of its own. No open attempt: a submitted one
 * refuses, none at all is a participant not started (eligible). An open attempt: submitted meanwhile refuses; no
 * remaining value (timer not started) is eligible; zero or less is expired, awaiting the finalizer.
 */
export function attemptRefusal(read: { open: boolean; anySubmitted: boolean; submitted: boolean; remaining: number | null }): 'attempt_already_submitted' | 'time_up' | null {
    if (!read.open) return read.anySubmitted ? 'attempt_already_submitted' : null;
    if (read.submitted) return 'attempt_already_submitted';
    if (read.remaining === null) return null;
    return read.remaining <= 0 ? 'time_up' : null;
}

/** The receipt of an applied or replayed transfer (§4.3). No reason, session, device or answer field (F5). */
export interface TransferReceipt {
    examInstanceId: string;
    participantId: string;
    fromRoomLabel: string;
    roomLabel: string;
    assignmentVersion: number;
    transferredAt: string;
    revision: number;
    replayed: boolean;
}

/** E9: the replay body, rebuilt from the stored action and its entry, never re-evaluated. */
export function transferReceipt(stored: {
    examInstanceId: string; participantId: string; fromRoomLabel: string; roomLabel: string; assignmentVersion: number; actedAt: unknown; revision: number;
}, replayed: boolean): TransferReceipt {
    const at = stored.actedAt instanceof Date ? stored.actedAt : new Date(String(stored.actedAt));
    return {
        examInstanceId: stored.examInstanceId, participantId: stored.participantId, fromRoomLabel: stored.fromRoomLabel, roomLabel: stored.roomLabel,
        assignmentVersion: stored.assignmentVersion, transferredAt: at.toISOString(), revision: stored.revision, replayed,
    };
}

// ---------------------------------------------------------------------------------------------
// Errors (§4.2): the transfer constraints first, then the unchanged room and frame mapping.

function constraintOf(error: unknown): { code: string; constraint: string } {
    const e = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; constraint?: unknown };
    return { code: typeof e.code === 'string' ? e.code : '', constraint: typeof e.constraint === 'string' ? e.constraint : '' };
}

const TRANSFER_GUARDS = new Set(['ck_sa_institution_room_transfer_scope', 'ck_sa_institution_room_action_transfer', 'ck_sa_institution_room_entry_shape']);

/** The answer of a database error of a transfer, or null when the frame mapping applies. */
export function matchTransferFailure(error: unknown): Outcome | null {
    if (error instanceof InstitutionRefusal) return null;
    const { code, constraint } = constraintOf(error);
    if (code === '23505' && constraint === 'uq_sa_institution_room_action_key') return { status: 409, body: { error: 'action_key_reused' } };
    // Unreachable under the session lock; named so a defect never answers 500.
    if (code === '23505' && constraint === 'uq_sa_institution_room_action_revision') return { status: 409, body: { error: 'stale_assignment' } };
    // Unreachable through the route; named so a defect never answers 500 or writes.
    if (code === '23514' && TRANSFER_GUARDS.has(constraint)) return { status: 403, body: { error: 'forbidden' } };
    return matchRoomFailure(error);
}

/** The transfer error mapper (§4.2): the transfer constraints, then the unchanged institutionRoomFailure and institutionFailure. */
export function transferFailure(error: unknown): Outcome {
    return matchTransferFailure(error) ?? institutionRoomFailure(error);
}

/** Runs the transfer; a database error of a named constraint becomes its answer (operatorWrite rolls back). */
function mapped(run: (client: pg.PoolClient, actor: InstitutionActor) => Promise<Outcome>) {
    return async (client: pg.PoolClient, actor: InstitutionActor): Promise<Outcome> => {
        try {
            return await run(client, actor);
        } catch (error) {
            const outcome = matchTransferFailure(error);
            if (outcome) throw new InstitutionRefusal(outcome.status, outcome.body as Record<string, unknown>);
            throw error;
        }
    };
}

// ---------------------------------------------------------------------------------------------
// The transfer.

/** E9: the earlier transfer of this key, as its original receipt; action_key_reused for any other kind, actor or body. */
async function replayOf(client: pg.PoolClient, actor: InstitutionActor, actionKey: string, digest: string): Promise<Outcome | null> {
    const earlier = await findAction(client, actor.tenantId, actionKey);
    if (!earlier) return null;
    sameAction(earlier, 'PARTICIPANT_TRANSFER', actor, digest);
    const res = await client.query(
        `SELECT e.exam_instance_id, e.exam_participant_id, e.from_room_label, e.room_label, e.assignment_version, a.acted_at, a.revision
         FROM secure_assessment_institution_room_action_entries e
         JOIN secure_assessment_institution_room_actions a ON a.id = e.action_id AND a.tenant_id = e.tenant_id
         WHERE e.tenant_id = $1 AND e.action_id = $2 AND e.entry_kind = 'PARTICIPANT_TRANSFER'`, [actor.tenantId, earlier.id]);
    const row = res.rows[0];
    if (!row) throw new Error('A transfer action has no entry.');
    return {
        status: 200,
        body: transferReceipt({
            examInstanceId: row.exam_instance_id, participantId: row.exam_participant_id, fromRoomLabel: row.from_room_label, roomLabel: row.room_label,
            assignmentVersion: Number(row.assignment_version), actedAt: row.acted_at, revision: Number(row.revision),
        }, true),
    };
}

/** §4.2 steps 3 to 6, inside operatorWrite. Exported for the C01 order units. */
export async function transferParticipant(client: pg.PoolClient, actor: InstitutionActor, request: RoomTransferRequest): Promise<Outcome> {
    const digest = transferDigest(actor, request);
    const replay = await replayOf(client, actor, request.actionKey, digest);
    if (replay) return replay;

    // E6 steps 1 to 3, unlocked reads of facts an opened exam never changes (0062, OPEN-05, the 0063 room guard); 403 otherwise.
    const exam = await client.query(
        `SELECT i.institution_session_id FROM secure_assessment_exam_instances i
         WHERE i.id = $1 AND i.tenant_id = $2 AND i.institution_session_id IS NOT NULL`, [request.examInstanceId, actor.tenantId]);
    if (exam.rows.length !== 1) refuse(403, 'forbidden');
    const sessionId: string = exam.rows[0].institution_session_id;
    const participant = await client.query(
        'SELECT 1 FROM secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND id = $3',
        [actor.tenantId, request.examInstanceId, request.participantId]);
    if (participant.rows.length !== 1) refuse(403, 'forbidden');
    const target = await client.query(
        'SELECT display_label FROM secure_assessment_exam_rooms WHERE tenant_id = $1 AND exam_instance_id = $2 AND id = $3',
        [actor.tenantId, request.examInstanceId, request.targetRoomId]);
    if (target.rows.length !== 1) refuse(403, 'forbidden');
    const targetLabel: string = target.rows[0].display_label;

    // OR-4 lock 1: the session lock shared with room writes and session-wide transitions.
    await lockSession(client, actor, sessionId);
    // OR-4 lock 2: the exam FOR KEY SHARE, as every attempt writer and the supervision path take it; E6 steps 4 and 5.
    const locked = await keyShareInstitutionExam(client, actor, request.examInstanceId);
    const examCheck = examRefusal(locked.lifecycle_state, locked.room_policy === true);
    if (examCheck === 'invalid_state') refuse(409, 'invalid_state', { examInstanceId: request.examInstanceId, currentState: locked.lifecycle_state });
    if (examCheck) refuse(409, examCheck);

    // OR-4 lock 3: the participant's current room row FOR UPDATE; E6 steps 6 to 8.
    const current = await client.query(
        `SELECT ra.id, ra.exam_room_id, ra.assignment_version, r.display_label
         FROM secure_assessment_exam_participant_room_assignments ra
         JOIN secure_assessment_exam_rooms r ON r.id = ra.exam_room_id AND r.tenant_id = ra.tenant_id
         WHERE ra.tenant_id = $1 AND ra.exam_instance_id = $2 AND ra.exam_participant_id = $3
         FOR UPDATE OF ra`, [actor.tenantId, request.examInstanceId, request.participantId]);
    const row = current.rows[0] as { id: string; exam_room_id: string; assignment_version: number; display_label: string } | undefined;
    const rowCheck = rowRefusal(row ? { roomId: row.exam_room_id, version: Number(row.assignment_version) } : null, request.expectedAssignmentVersion, request.targetRoomId);
    if (rowCheck === 'stale_assignment') refuse(409, 'stale_assignment', { assignmentVersion: Number(row!.assignment_version), roomLabel: row!.display_label });
    if (rowCheck) refuse(409, rowCheck);
    const from = row!;

    // OR-4 lock 4: the open (first unsubmitted) attempt FOR UPDATE. Its pre-wait snapshot is not trusted (F1): the
    // submission and the remaining time are read again in a statement of its own, so a submit or the finalizer that
    // committed while this request waited is seen.
    const attempt = await client.query(
        `SELECT a.id FROM secure_assessment_exam_attempts a
         WHERE a.tenant_id = $1 AND a.exam_participant_id = $2
           AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id)
         ORDER BY a.created_at ASC, a.id ASC
         LIMIT 1
         FOR UPDATE OF a`, [actor.tenantId, request.participantId]);
    const attemptId: string | null = attempt.rows[0]?.id ?? null;
    const reread = await client.query(
        `SELECT EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s
                        JOIN secure_assessment_exam_attempts a ON a.id = s.exam_attempt_id AND a.tenant_id = s.tenant_id
                        WHERE s.tenant_id = $1 AND a.exam_participant_id = $2) AS any_submitted,
                EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = $1 AND s.exam_attempt_id = $3::uuid) AS submitted,
                secure_assessment_attempt_remaining_seconds($1, $3::uuid, statement_timestamp()) AS remaining`,
        [actor.tenantId, request.participantId, attemptId]);
    const state = reread.rows[0];
    const attemptCheck = attemptRefusal({
        open: attemptId !== null, anySubmitted: state.any_submitted === true, submitted: state.submitted === true,
        remaining: state.remaining === null || state.remaining === undefined ? null : Number(state.remaining),
    });
    if (attemptCheck) refuse(409, attemptCheck);

    // OR-4 lock 5: the target room row and its active mapped Proctor assignments FOR SHARE; E6 step 10 (O05-4, OR-2).
    await client.query(
        'SELECT id FROM secure_assessment_exam_rooms WHERE tenant_id = $1 AND exam_instance_id = $2 AND id = $3 FOR SHARE',
        [actor.tenantId, request.examInstanceId, request.targetRoomId]);
    const coverage = await client.query(
        `SELECT pa.id FROM secure_assessment_proctor_assignments pa
         JOIN secure_assessment_exam_proctor_room_assignments m
           ON m.proctor_assignment_id = pa.id AND m.tenant_id = pa.tenant_id AND m.exam_instance_id = pa.exam_instance_id
         WHERE pa.tenant_id = $1 AND pa.exam_instance_id = $2 AND m.exam_room_id = $3 AND pa.revoked_at IS NULL
         ORDER BY pa.id, m.id
         FOR SHARE OF pa, m`, [actor.tenantId, request.examInstanceId, request.targetRoomId]);
    if (coverage.rows.length === 0) refuse(409, 'target_room_unsupervised');

    // The writes: the current row (the 0065 trigger sets the version), then the action and its one entry (E8).
    const moved = await client.query(
        `UPDATE secure_assessment_exam_participant_room_assignments SET exam_room_id = $3, assigned_at = statement_timestamp()
         WHERE tenant_id = $1 AND id = $2 RETURNING assignment_version`, [actor.tenantId, from.id, request.targetRoomId]);
    const assignmentVersion = Number(moved.rows[0].assignment_version);
    const revision = await sessionRevision(client, actor.tenantId, sessionId) + 1;
    const action = await client.query(
        `INSERT INTO secure_assessment_institution_room_actions
             (tenant_id, session_id, kind, revision, actor_person_id, action_key, request_digest, reason, confirmed)
         VALUES ($1, $2, 'PARTICIPANT_TRANSFER', $3, $4, $5, $6, $7, TRUE) RETURNING id, acted_at`,
        [actor.tenantId, sessionId, revision, actor.personId, request.actionKey, digest, request.reason]);
    await client.query(
        `INSERT INTO secure_assessment_institution_room_action_entries
             (tenant_id, action_id, exam_instance_id, entry_kind, exam_participant_id, from_room_label, room_label, assignment_version, exam_attempt_id)
         VALUES ($1, $2, $3, 'PARTICIPANT_TRANSFER', $4, $5, $6, $7, $8)`,
        [actor.tenantId, action.rows[0].id, request.examInstanceId, request.participantId, from.display_label, targetLabel, assignmentVersion, attemptId]);
    return {
        status: 200,
        body: transferReceipt({
            examInstanceId: request.examInstanceId, participantId: request.participantId, fromRoomLabel: from.display_label, roomLabel: targetLabel,
            assignmentVersion, actedAt: action.rows[0].acted_at, revision,
        }, false),
    };
}

// ---------------------------------------------------------------------------------------------
// Route.

/** POST supervision/room-transfer (§4.3): method, exact body, then one Operator transaction. */
export async function handleRoomTransferRoute(
    req: http.IncomingMessage, res: http.ServerResponse, pool: pg.Pool, cookie: SessionCookieConfig
): Promise<void> {
    const send = (outcome: Outcome) => sendJson(res, outcome.status, outcome.body);
    if (req.method !== 'POST') { req.resume(); send({ status: 405, body: { error: 'method_not_allowed' } }); return; }
    let body: Record<string, unknown>;
    try {
        body = await readJsonObject(req);
    } catch (error) {
        send(institutionFailure(error instanceof HttpError ? error : new HttpError(400, 'invalid_request')));
        return;
    }
    const request = parseRoomTransferRequest(body);
    if (!request) { send({ status: 400, body: { error: 'invalid_request' } }); return; }
    // The action-key namespace of the room writes: a key serves one room route only (uq_sa_institution_room_action_key).
    send(await operatorWrite(req, pool, cookie, 'rooms', request.actionKey, mapped((c, a) => transferParticipant(c, a, request))));
}
