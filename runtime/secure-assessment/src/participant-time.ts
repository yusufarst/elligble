import type * as pg from 'pg';
import { resolveSupervisionScope } from './supervision-scope.ts';

// Add time for one participant (ASSESS-PROCTOR-004). D04.6-41 LOCKED: adding time is a
// first-class controlled action that records the minutes, the reason, the actor and the
// time; D04.2-78: participant-specific, without changing the duration for everyone;
// D04.2-79 and D04.6-63: high-impact and audited; D04.6-64: an explicit confirmation with a
// reason; D04.5-31: it updates the attempt timing ledger, which every remaining-time
// computation already reads (migrations 0005, 0044); D04.4-67: all or nothing.
//
// Until the permission matrix (PB05) says otherwise, only the teacher who manages the exam
// adds time: the authority that also pauses, resumes and ends it (D04.4-26A; higher-impact
// actions need stronger authority, D04.6-46/48). An assigned proctor sees an addition on the
// participant list but does not make one. Time goes to the participant's open attempt while
// the exam is ACTIVE or PAUSED and the attempt still has time left: an attempt whose time ran
// out is being finalized and is not reopened (D04.5-47/49), and an ENDED exam keeps every
// attempt's own remaining time (Owner decision 2026-09-30). One request makes one addition:
// the action key chosen by the device finds the addition a retried request already made.

export const MAX_ADDED_MINUTES = 120;
export const TIME_REASON_MAX_LENGTH = 200;

export interface TimeAdditionRequest {
    examInstanceId: string;
    participantId: string;
    minutes: number;
    reason: string;
    actionKey: string;
}

export type TimeAdditionResult =
    | {
        type: 'ok';
        participantId: string;
        /** Seconds this action added. */
        addedSeconds: number;
        /** Every addition to the attempt so far, in seconds. */
        totalAddedSeconds: number;
        /** The attempt's working time left now (frozen while the exam is paused). */
        remainingSeconds: number;
        addedAt: string;
        /** The action key had already added this time: nothing new was recorded. */
        replayed: boolean;
    }
    | { type: 'forbidden' }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'no_active_attempt' }
    | { type: 'not_started' }
    | { type: 'time_up' }
    | { type: 'action_key_reused' }
    | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_STATES = new Set(['ACTIVE', 'PAUSED']);

/** The reason as recorded: one short line, 1 to 200 characters; null when unusable. */
export function normalizeTimeReason(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
    if (text.length === 0 || [...text].length > TIME_REASON_MAX_LENGTH) return null;
    return text;
}

/** A well-formed request, or null. */
export function parseTimeAdditionRequest(body: Record<string, unknown>): TimeAdditionRequest | null {
    const { examInstanceId, participantId, minutes, actionKey } = body;
    const reason = normalizeTimeReason(body.reason);
    if (typeof examInstanceId !== 'string' || !UUID_REGEX.test(examInstanceId)
        || typeof participantId !== 'string' || !UUID_REGEX.test(participantId)
        || typeof actionKey !== 'string' || !UUID_REGEX.test(actionKey)
        || typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 1 || minutes > MAX_ADDED_MINUTES
        || reason === null) {
        return null;
    }
    return { examInstanceId, participantId, minutes, reason, actionKey: actionKey.toLowerCase() };
}

/** Additions so far and the working time left now, for the attempt behind a timer. */
async function readTotals(client: pg.PoolClient, tenantId: string, timerStateId: string): Promise<{ totalAddedSeconds: number; remainingSeconds: number }> {
    const res = await client.query(
        `SELECT COALESCE((SELECT SUM(adj.adjustment_seconds) FROM secure_assessment_timer_adjustments adj
                          WHERE adj.tenant_id = t.tenant_id AND adj.timer_state_id = t.id), 0)::int AS total_added,
                GREATEST(0, secure_assessment_attempt_remaining_seconds(t.tenant_id, t.exam_attempt_id, statement_timestamp())) AS remaining
         FROM secure_assessment_timer_state t
         WHERE t.tenant_id = $1 AND t.id = $2`,
        [tenantId, timerStateId]
    );
    return { totalAddedSeconds: Number(res.rows[0].total_added), remainingSeconds: Number(res.rows[0].remaining ?? 0) };
}

export async function addParticipantTime(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    request: TimeAdditionRequest
): Promise<TimeAdditionResult> {
    const { examInstanceId, participantId, minutes, reason, actionKey } = request;
    if (!UUID_REGEX.test(actor.tenantId) || !UUID_REGEX.test(actor.personId)) return { type: 'forbidden' };
    const seconds = minutes * 60;
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN');
        // Requests with one action key are decided one at a time: a retry that overtakes the
        // original waits for it and then finds its addition.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sa-add-time:${actor.tenantId}:${actionKey}`]);
        // Exam row before attempt row, the order every attempt writer uses.
        const supervision = await resolveSupervisionScope(client, actor, examInstanceId, { lockExam: true });
        if (!supervision || !supervision.managingTeacher) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        const participant = await client.query(
            'SELECT 1 FROM secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND id = $3',
            [actor.tenantId, examInstanceId, participantId]
        );
        if (participant.rows.length !== 1) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }

        const earlier = await client.query(
            `SELECT adj.timer_state_id, adj.adjustment_seconds, adj.reason, adj.actor_person_id, adj.created_at, a.exam_participant_id
             FROM secure_assessment_timer_adjustments adj
             JOIN secure_assessment_timer_state t ON t.id = adj.timer_state_id AND t.tenant_id = adj.tenant_id
             JOIN secure_assessment_exam_attempts a ON a.id = t.exam_attempt_id AND a.tenant_id = t.tenant_id
             WHERE adj.tenant_id = $1 AND adj.action_key = $2`,
            [actor.tenantId, actionKey]
        );
        if (earlier.rows.length === 1) {
            const row = earlier.rows[0];
            const same = row.exam_participant_id === participantId && row.actor_person_id === actor.personId
                && Number(row.adjustment_seconds) === seconds && row.reason === reason;
            if (!same) {
                await client.query('ROLLBACK');
                return { type: 'action_key_reused' };
            }
            const totals = await readTotals(client, actor.tenantId, row.timer_state_id);
            await client.query('ROLLBACK');
            return {
                type: 'ok', participantId, addedSeconds: seconds, ...totals,
                addedAt: new Date(row.created_at).toISOString(), replayed: true,
            };
        }

        if (!TIME_STATES.has(supervision.lifecycleState)) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', currentState: supervision.lifecycleState };
        }
        // The participant's open (first unsubmitted) attempt, locked against its writers.
        const attempt = await client.query(
            `SELECT a.id FROM secure_assessment_exam_attempts a
             WHERE a.tenant_id = $1 AND a.exam_participant_id = $2
               AND NOT EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id)
             ORDER BY a.created_at ASC, a.id ASC
             LIMIT 1
             FOR UPDATE OF a`,
            [actor.tenantId, participantId]
        );
        if (attempt.rows.length !== 1) {
            await client.query('ROLLBACK');
            return { type: 'no_active_attempt' };
        }
        // Read after the attempt lock, in a statement of its own: a submission committed while
        // this request waited for the lock is seen here.
        const timer = await client.query(
            `SELECT t.id, t.started_at,
                    EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = t.tenant_id AND s.exam_attempt_id = t.exam_attempt_id) AS submitted,
                    secure_assessment_attempt_remaining_seconds(t.tenant_id, t.exam_attempt_id, statement_timestamp()) AS remaining
             FROM secure_assessment_timer_state t
             WHERE t.tenant_id = $1 AND t.exam_attempt_id = $2`,
            [actor.tenantId, attempt.rows[0].id]
        );
        const state = timer.rows[0];
        if (state?.submitted) {
            await client.query('ROLLBACK');
            return { type: 'no_active_attempt' };
        }
        if (!state?.started_at) {
            await client.query('ROLLBACK');
            return { type: 'not_started' };
        }
        if (Number(state.remaining) <= 0) {
            await client.query('ROLLBACK');
            return { type: 'time_up' };
        }
        const created = await client.query(
            `INSERT INTO secure_assessment_timer_adjustments (tenant_id, timer_state_id, adjustment_seconds, reason, actor_person_id, action_key, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, statement_timestamp())
             RETURNING created_at`,
            [actor.tenantId, state.id, seconds, reason, actor.personId, actionKey]
        );
        const totals = await readTotals(client, actor.tenantId, state.id);
        await client.query('COMMIT');
        return {
            type: 'ok', participantId, addedSeconds: seconds, ...totals,
            addedAt: new Date(created.rows[0].created_at).toISOString(), replayed: false,
        };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        // The same key used at the same moment for another participant: the index decides.
        if ((err as { code?: string })?.code === '23505') return { type: 'action_key_reused' };
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
