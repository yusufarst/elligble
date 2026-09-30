import type pg from 'pg';
import { lockManagedExam } from './managed-exam.ts';

// The teacher cancels an exam before it opens (ASSESS-TEACHER-003). D04.2-47 LOCKED concept:
// cancellation before ACTIVE is explicit and never hidden by deletion. Owner decision
// 2026-09-30: a SCHEDULED or READY exam moves to ARCHIVED (there is no CANCELLED state), and
// the cancellation stays in append-only history with its reason, actor and time: the
// lifecycle event names the cancellation record (migration 0052), so an ARCHIVED exam shows
// unambiguously whether it was cancelled before opening or archived after completion. An
// opened exam is never cancelled (its end stays END, Owner decision on D04.2-81). Only the
// teacher who manages the exam cancels it, the authority that schedules, opens and ends it
// (D04.4-26A). Nothing is deleted: participants, question snapshots and every record stay.
// A cancelled exam leaves student discovery, refuses attempt starts and no longer takes part
// in schedule conflicts (they consider operational states only); teachers and proctors keep
// it as "Dibatalkan". Repeating a cancellation is safe: the action key finds the
// cancellation it made, and an exam already cancelled stays as it was.

export const CANCELLATION_REASON_MAX_LENGTH = 200;

export interface CancellationRequest {
    examInstanceId: string;
    reason: string;
    actionKey: string;
}

export type CancellationOutcome =
    | {
        type: 'cancelled';
        examInstanceId: string;
        cancelledAt: string;
        reason: string;
        /** False when the exam had already been cancelled: nothing new was recorded. */
        changed: boolean;
        /** The action key had already cancelled it. */
        replayed: boolean;
    }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'forbidden' }
    | { type: 'action_key_reused' }
    | { type: 'unavailable' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CANCELLABLE_STATES = new Set(['SCHEDULED', 'READY']);

/** The reason as recorded: one short line, 1 to 200 characters; null when unusable. */
export function normalizeCancellationReason(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
    if (text.length === 0 || [...text].length > CANCELLATION_REASON_MAX_LENGTH) return null;
    return text;
}

/** A well-formed request, or null (400). */
export function parseCancellationRequest(body: Record<string, unknown>): CancellationRequest | null {
    const { examInstanceId, actionKey } = body;
    const reason = normalizeCancellationReason(body.reason);
    if (typeof examInstanceId !== 'string' || !UUID.test(examInstanceId)) return null;
    if (typeof actionKey !== 'string' || !UUID.test(actionKey)) return null;
    if (reason === null) return null;
    return { examInstanceId: examInstanceId.toLowerCase(), reason, actionKey: actionKey.toLowerCase() };
}

function iso(value: unknown): string {
    return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

export async function cancelTeacherExam(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    request: CancellationRequest
): Promise<CancellationOutcome> {
    if (!UUID.test(actor.tenantId) || !UUID.test(actor.personId)) return { type: 'forbidden' };
    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN');
        // Locked like every lifecycle transition: cancellations of one exam are decided one at
        // a time, so a retry that overtakes the original finds what it recorded.
        const exam = await lockManagedExam(client, actor, request.examInstanceId);
        if (!exam) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }

        const byKey = await client.query(
            `SELECT exam_instance_id, cancelled_by_person_id, cancelled_at, reason
             FROM secure_assessment_exam_cancellations WHERE tenant_id = $1 AND action_key = $2`,
            [actor.tenantId, request.actionKey]
        );
        if (byKey.rows.length === 1) {
            await client.query('ROLLBACK');
            const earlier = byKey.rows[0];
            if (earlier.exam_instance_id !== request.examInstanceId || earlier.cancelled_by_person_id !== actor.personId) {
                return { type: 'action_key_reused' };
            }
            return {
                type: 'cancelled', examInstanceId: request.examInstanceId, cancelledAt: iso(earlier.cancelled_at), reason: earlier.reason,
                changed: true, replayed: true,
            };
        }
        // Already cancelled, by this request under another key or by an earlier one: it stays so.
        const existing = await client.query(
            `SELECT cancelled_at, reason FROM secure_assessment_exam_cancellations WHERE tenant_id = $1 AND exam_instance_id = $2`,
            [actor.tenantId, request.examInstanceId]
        );
        if (existing.rows.length === 1) {
            await client.query('ROLLBACK');
            return {
                type: 'cancelled', examInstanceId: request.examInstanceId, cancelledAt: iso(existing.rows[0].cancelled_at),
                reason: existing.rows[0].reason, changed: false, replayed: false,
            };
        }
        if (!CANCELLABLE_STATES.has(exam.lifecycle_state)) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', currentState: exam.lifecycle_state };
        }

        const recorded = await client.query(
            `INSERT INTO secure_assessment_exam_cancellations
                 (tenant_id, exam_instance_id, cancelled_by_person_id, cancelled_at, reason, previous_lifecycle_state, action_key)
             VALUES ($1, $2, $3, statement_timestamp(), $4, $5, $6)
             RETURNING id, cancelled_at`,
            [actor.tenantId, request.examInstanceId, actor.personId, request.reason, exam.lifecycle_state, request.actionKey]
        );
        const { id: cancellationId, cancelled_at: cancelledAt } = recorded.rows[0];
        await client.query(
            `UPDATE secure_assessment_exam_instances SET lifecycle_state = 'ARCHIVED' WHERE id = $1 AND tenant_id = $2`,
            [request.examInstanceId, actor.tenantId]
        );
        await client.query(
            `INSERT INTO secure_assessment_exam_lifecycle_events
                 (tenant_id, exam_instance_id, from_state, to_state, actor_person_id, occurred_at, cancellation_id)
             VALUES ($1, $2, $3, 'ARCHIVED', $4, $5, $6)`,
            [actor.tenantId, request.examInstanceId, exam.lifecycle_state, actor.personId, cancelledAt, cancellationId]
        );
        await client.query('COMMIT');
        return {
            type: 'cancelled', examInstanceId: request.examInstanceId, cancelledAt: iso(cancelledAt), reason: request.reason,
            changed: true, replayed: false,
        };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        // The same key used at the same moment for another exam: the unique key decides.
        if ((err as { code?: string })?.code === '23505') return { type: 'action_key_reused' };
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
