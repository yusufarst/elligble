import type * as http from 'node:http';
import type * as pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import type { AnswerDependencies } from './answer.ts';
import { HttpError, readJsonObject, sendError, sendJson } from './http/http-utils.ts';
import { participantInScope, resolveSupervisionScope } from './supervision-scope.ts';

// Exam broadcast messages (D04.1-77A..G, D04.6-49..55 LOCKED; ASSESS-PROCTOR-002). A
// supervisor of a running exam sends a short operational message to the entire exam, one
// exam room or selected participants, never beyond their own supervision scope: a room
// proctor reaches only their rooms (D04.1-77B). Recipients are the participants in the
// target who have not submitted, fixed when the message is sent. Each broadcast keeps its
// sender, target, message and time; each recipient row keeps when the student's device
// confirmed receiving it, which is all "delivered" means (D04.6-53: never "read"). Sending
// is rate limited per sender and exam (D04.1-77F, D04.6-55; the exact limits are an
// implementation default). The student channel is separate from answer saving and never
// blocks it (D04.5-57).

export type BroadcastTarget =
    | { scope: 'EXAM' }
    | { scope: 'ROOM'; roomId: string }
    | { scope: 'PARTICIPANTS'; participantIds: string[] };

export type SendBroadcastResult =
    | { type: 'ok'; broadcastId: string; sentAt: string; recipients: number }
    | { type: 'forbidden' }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'no_recipients' }
    | { type: 'rate_limited'; retryAfterSeconds: number }
    | { type: 'unavailable' };

export interface BroadcastRecord {
    broadcastId: string;
    sentAt: string;
    sender: { elligbleId: string | null; you: boolean };
    target: { scope: 'EXAM' | 'ROOM' | 'PARTICIPANTS'; roomLabel: string | null };
    message: string;
    /** Recipients within the viewer's scope, and how many of their devices confirmed receiving it. */
    recipients: number;
    delivered: number;
}

export interface InboxMessage {
    id: string;
    text: string;
    sentAt: string;
}

export const BROADCAST_MAX_LENGTH = 200;
export const BROADCAST_MAX_PARTICIPANTS = 200;
/** Implementation default for D04.6-55: one message per sender and exam every 15 s, at most 20 an hour. */
export const BROADCAST_MIN_INTERVAL_SECONDS = 15;
export const BROADCAST_MAX_PER_HOUR = 20;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPERVISED_STATES = new Set(['ACTIVE', 'PAUSED', 'ENDED']);
const HISTORY_LIMIT = 50;
const INBOX_LIMIT = 50;

/** The message as stored: whitespace collapsed to single spaces, 1 to 200 characters; null when unusable. */
export function normalizeBroadcastMessage(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    // Line breaks and control characters become spaces: a notice is one short paragraph.
    const text = value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
    if (text.length === 0 || [...text].length > BROADCAST_MAX_LENGTH) return null;
    return text;
}

/** A well-formed target, or null. */
export function parseBroadcastTarget(value: unknown): BroadcastTarget | null {
    if (!value || typeof value !== 'object') return null;
    const target = value as Record<string, unknown>;
    if (target.scope === 'EXAM') return { scope: 'EXAM' };
    if (target.scope === 'ROOM') {
        return typeof target.roomId === 'string' && UUID_REGEX.test(target.roomId) ? { scope: 'ROOM', roomId: target.roomId } : null;
    }
    if (target.scope === 'PARTICIPANTS') {
        const ids = target.participantIds;
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > BROADCAST_MAX_PARTICIPANTS) return null;
        if (!ids.every(id => typeof id === 'string' && UUID_REGEX.test(id))) return null;
        const unique = [...new Set((ids as string[]).map(id => id.toLowerCase()))];
        return { scope: 'PARTICIPANTS', participantIds: unique };
    }
    return null;
}

export async function sendExamBroadcast(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    examInstanceId: string,
    target: BroadcastTarget,
    message: string
): Promise<SendBroadcastResult> {
    if (!UUID_REGEX.test(examInstanceId) || !UUID_REGEX.test(actor.tenantId) || !UUID_REGEX.test(actor.personId)) {
        return { type: 'forbidden' };
    }
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN');
        // No exam row lock: a message never waits for, or holds up, answer saving.
        const supervision = await resolveSupervisionScope(client, actor, examInstanceId);
        if (!supervision) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        const roomFilter = supervision.roomFilter;
        // A proctor limited to rooms cannot address the entire exam (D04.1-77B).
        if (target.scope === 'EXAM' && roomFilter !== null) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        if (target.scope === 'ROOM') {
            const room = await client.query(
                `SELECT 1 FROM secure_assessment_exam_rooms r
                 WHERE r.tenant_id = $1 AND r.exam_instance_id = $2 AND r.id = $3
                   AND ($4::uuid IS NULL OR EXISTS (
                       SELECT 1 FROM secure_assessment_exam_proctor_room_assignments epra
                       WHERE epra.tenant_id = r.tenant_id AND epra.exam_instance_id = r.exam_instance_id
                         AND epra.exam_room_id = r.id AND epra.proctor_assignment_id = $4
                   ))`,
                [actor.tenantId, examInstanceId, target.roomId, roomFilter]
            );
            if (room.rows.length !== 1 || !supervision.roomBased) {
                await client.query('ROLLBACK');
                return { type: 'forbidden' };
            }
        }
        if (target.scope === 'PARTICIPANTS') {
            const inScope = await client.query(
                `SELECT count(*)::int AS n FROM secure_assessment_exam_participants p
                 WHERE p.tenant_id = $1 AND p.exam_instance_id = $2 AND p.id = ANY($3::uuid[])
                   AND ${participantInScope('p', '$4')}`,
                [actor.tenantId, examInstanceId, target.participantIds, roomFilter]
            );
            // Every selected participant must be in the sender's scope: nothing is sent partially.
            if (inScope.rows[0].n !== target.participantIds.length) {
                await client.query('ROLLBACK');
                return { type: 'forbidden' };
            }
        }
        if (!SUPERVISED_STATES.has(supervision.lifecycleState)) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', currentState: supervision.lifecycleState };
        }

        // One sender's messages to one exam are decided one at a time (a double click
        // cannot pass the limit twice); nothing else waits for this lock.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`sa-broadcast:${examInstanceId}:${actor.personId}`]);
        const recent = await client.query(
            `SELECT EXTRACT(EPOCH FROM statement_timestamp() - max(b.sent_at)) AS since_last,
                    count(*) FILTER (WHERE b.sent_at > statement_timestamp() - interval '1 hour')::int AS last_hour,
                    EXTRACT(EPOCH FROM min(b.sent_at) FILTER (WHERE b.sent_at > statement_timestamp() - interval '1 hour')
                        + interval '1 hour' - statement_timestamp()) AS hour_frees_in
             FROM secure_assessment_exam_broadcasts b
             WHERE b.tenant_id = $1 AND b.exam_instance_id = $2 AND b.sender_person_id = $3`,
            [actor.tenantId, examInstanceId, actor.personId]
        );
        const limits = recent.rows[0];
        if (limits.since_last !== null && Number(limits.since_last) < BROADCAST_MIN_INTERVAL_SECONDS) {
            await client.query('ROLLBACK');
            return { type: 'rate_limited', retryAfterSeconds: Math.max(1, Math.ceil(BROADCAST_MIN_INTERVAL_SECONDS - Number(limits.since_last))) };
        }
        if (Number(limits.last_hour) >= BROADCAST_MAX_PER_HOUR) {
            await client.query('ROLLBACK');
            return { type: 'rate_limited', retryAfterSeconds: Math.max(1, Math.ceil(Number(limits.hour_frees_in ?? 1))) };
        }

        const created = await client.query(
            `INSERT INTO secure_assessment_exam_broadcasts (tenant_id, exam_instance_id, sender_person_id, target_scope, exam_room_id, message, sent_at)
             VALUES ($1, $2, $3, $4, $5, $6, statement_timestamp())
             RETURNING id, sent_at`,
            [actor.tenantId, examInstanceId, actor.personId, target.scope, target.scope === 'ROOM' ? target.roomId : null, message]
        );
        const broadcastId: string = created.rows[0].id;
        // Recipients: participants in the target and in the sender's scope who have not submitted.
        const recipients = await client.query(
            `INSERT INTO secure_assessment_exam_broadcast_recipients (broadcast_id, tenant_id, exam_instance_id, exam_participant_id)
             SELECT $7::uuid, p.tenant_id, p.exam_instance_id, p.id
             FROM secure_assessment_exam_participants p
             WHERE p.tenant_id = $1 AND p.exam_instance_id = $2
               AND ${participantInScope('p', '$3')}
               AND (
                   $4::text = 'EXAM'
                   OR ($4::text = 'ROOM' AND EXISTS (
                       SELECT 1 FROM secure_assessment_exam_participant_room_assignments pra
                       WHERE pra.tenant_id = p.tenant_id AND pra.exam_instance_id = p.exam_instance_id
                         AND pra.exam_participant_id = p.id AND pra.exam_room_id = $5::uuid))
                   OR ($4::text = 'PARTICIPANTS' AND p.id = ANY($6::uuid[]))
               )
               AND NOT EXISTS (
                   SELECT 1 FROM secure_assessment_exam_attempts a
                   JOIN secure_assessment_exam_submissions s ON s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id
                   WHERE a.tenant_id = p.tenant_id AND a.exam_participant_id = p.id
               )`,
            [actor.tenantId, examInstanceId, roomFilter, target.scope,
                target.scope === 'ROOM' ? target.roomId : null,
                target.scope === 'PARTICIPANTS' ? target.participantIds : null,
                broadcastId]
        );
        if ((recipients.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return { type: 'no_recipients' };
        }
        await client.query('COMMIT');
        return { type: 'ok', broadcastId, sentAt: new Date(created.rows[0].sent_at).toISOString(), recipients: recipients.rowCount ?? 0 };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}

/** Rooms of a room-based exam that the viewer supervises (all rooms for a whole-exam scope). */
export async function readScopeRooms(
    client: pg.PoolClient,
    tenantId: string,
    examInstanceId: string,
    roomFilter: string | null
): Promise<Array<{ roomId: string; label: string }>> {
    const res = await client.query(
        `SELECT r.id, r.display_label FROM secure_assessment_exam_rooms r
         WHERE r.tenant_id = $1 AND r.exam_instance_id = $2
           AND ($3::uuid IS NULL OR EXISTS (
               SELECT 1 FROM secure_assessment_exam_proctor_room_assignments epra
               WHERE epra.tenant_id = r.tenant_id AND epra.exam_instance_id = r.exam_instance_id
                 AND epra.exam_room_id = r.id AND epra.proctor_assignment_id = $3
           ))
         ORDER BY r.display_label, r.id`,
        [tenantId, examInstanceId, roomFilter]
    );
    return res.rows.map(r => ({ roomId: r.id as string, label: r.display_label as string }));
}

/**
 * The exam's broadcasts that reached anyone in the viewer's scope, newest first, with the
 * recipient and delivery counts within that scope (D04.6-53/54).
 */
export async function readBroadcastHistory(
    client: pg.PoolClient,
    actor: { tenantId: string; personId: string },
    examInstanceId: string,
    roomFilter: string | null
): Promise<BroadcastRecord[]> {
    const res = await client.query(
        `SELECT b.id, b.sent_at, b.sender_person_id, b.target_scope, er.display_label AS room_label, b.message,
                count(*)::int AS recipients, count(r.delivered_at)::int AS delivered
         FROM secure_assessment_exam_broadcasts b
         JOIN secure_assessment_exam_broadcast_recipients r ON r.broadcast_id = b.id AND r.tenant_id = b.tenant_id
         JOIN secure_assessment_exam_participants p ON p.id = r.exam_participant_id AND p.tenant_id = r.tenant_id
         LEFT JOIN secure_assessment_exam_rooms er ON er.id = b.exam_room_id AND er.tenant_id = b.tenant_id
         WHERE b.tenant_id = $1 AND b.exam_instance_id = $2
           AND ${participantInScope('p', '$3')}
         GROUP BY b.id, b.sent_at, b.sender_person_id, b.target_scope, er.display_label, b.message
         ORDER BY b.sent_at DESC, b.id
         LIMIT ${HISTORY_LIMIT}`,
        [actor.tenantId, examInstanceId, roomFilter]
    );
    const senders = await listElligbleIds(client, [...new Set(res.rows.map(r => r.sender_person_id as string))]);
    return res.rows.map(r => ({
        broadcastId: r.id,
        sentAt: new Date(r.sent_at).toISOString(),
        sender: { elligbleId: senders.get(r.sender_person_id) ?? null, you: r.sender_person_id === actor.personId },
        target: { scope: r.target_scope, roomLabel: r.room_label ?? null },
        message: r.message,
        recipients: Number(r.recipients),
        delivered: Number(r.delivered),
    }));
}

/** How many messages the participant of the attempt has received so far (for the timer answer). */
export async function countAttemptMessages(client: pg.PoolClient, tenantId: string, attemptId: string): Promise<number> {
    const res = await client.query(
        `SELECT count(*)::int AS n
         FROM secure_assessment_exam_attempts a
         JOIN secure_assessment_exam_broadcast_recipients r ON r.tenant_id = a.tenant_id AND r.exam_participant_id = a.exam_participant_id
         WHERE a.tenant_id = $1 AND a.id = $2`,
        [tenantId, attemptId]
    );
    return Number(res.rows[0]?.n ?? 0);
}

/**
 * The student's messages for the attempt's participant, newest first. `received` lists the
 * messages the device confirms it already holds: their delivery is recorded, once.
 */
export async function readAttemptInbox(
    pool: pg.Pool,
    tenantId: string,
    attemptId: string,
    received: string[]
): Promise<{ type: 'ok'; messages: InboxMessage[]; total: number; serverTime: string } | { type: 'not_found' } | { type: 'unavailable' }> {
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN');
        const attempt = await client.query(
            'SELECT exam_participant_id, statement_timestamp() AS db_now FROM secure_assessment_exam_attempts WHERE tenant_id = $1 AND id = $2',
            [tenantId, attemptId]
        );
        if (attempt.rows.length !== 1) {
            await client.query('ROLLBACK');
            return { type: 'not_found' };
        }
        const participantId: string = attempt.rows[0].exam_participant_id;
        if (received.length > 0) {
            await client.query(
                `UPDATE secure_assessment_exam_broadcast_recipients SET delivered_at = statement_timestamp()
                 WHERE tenant_id = $1 AND exam_participant_id = $2 AND broadcast_id = ANY($3::uuid[]) AND delivered_at IS NULL`,
                [tenantId, participantId, received]
            );
        }
        const messages = await client.query(
            `SELECT b.id, b.message, b.sent_at, count(*) OVER ()::int AS total
             FROM secure_assessment_exam_broadcast_recipients r
             JOIN secure_assessment_exam_broadcasts b ON b.id = r.broadcast_id AND b.tenant_id = r.tenant_id
             WHERE r.tenant_id = $1 AND r.exam_participant_id = $2
             ORDER BY b.sent_at DESC, b.id
             LIMIT ${INBOX_LIMIT}`,
            [tenantId, participantId]
        );
        await client.query('COMMIT');
        return {
            type: 'ok',
            messages: messages.rows.map(r => ({ id: r.id as string, text: r.message as string, sentAt: new Date(r.sent_at).toISOString() })),
            total: Number(messages.rows[0]?.total ?? 0),
            serverTime: new Date(attempt.rows[0].db_now).toISOString(),
        };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}

const MAX_RECEIVED = 100;

/**
 * POST /api/v1/assessment/broadcasts/inbox { attemptId, received }: the student's messages.
 * `received` names the messages the device already holds, so their delivery is recorded.
 */
export async function handleBroadcastInbox(req: http.IncomingMessage, res: http.ServerResponse, deps: AnswerDependencies): Promise<void> {
    if (req.method !== 'POST') {
        sendError(res, 405, 'method_not_allowed');
        return;
    }
    const context = deps.getAuthorizedContext(req);
    if (!context) {
        sendError(res, 403, 'forbidden');
        return;
    }
    let body: Record<string, unknown>;
    try {
        body = await readJsonObject(req);
    } catch (err) {
        sendError(res, err instanceof HttpError ? err.statusCode : 400, err instanceof HttpError ? err.message : 'invalid_request');
        return;
    }
    const { attemptId, received } = body;
    if (typeof attemptId !== 'string' || !UUID_REGEX.test(attemptId)
        || (received !== undefined && (!Array.isArray(received) || received.length > MAX_RECEIVED
            || !received.every(id => typeof id === 'string' && UUID_REGEX.test(id))))) {
        sendError(res, 400, 'invalid_request');
        return;
    }
    if (attemptId !== context.authorizedAttemptId) {
        sendError(res, 403, 'forbidden');
        return;
    }
    const result = await readAttemptInbox(deps.pool, context.tenantId, attemptId, (received as string[] | undefined) ?? []);
    if (result.type === 'ok') {
        sendJson(res, 200, { messages: result.messages, total: result.total, serverTime: result.serverTime });
        return;
    }
    if (result.type === 'not_found') {
        sendError(res, 404, 'assessment_context_not_found');
        return;
    }
    sendError(res, 503, 'persistence_unavailable');
}
