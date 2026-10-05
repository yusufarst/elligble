import type pg from 'pg';
import { checkExamInstanceDurationWindowPolicyCompatibilityReadiness } from './exam-instance-duration-window-policy-compatibility-readiness-preflight.ts';
import { checkExamInstanceParticipantProctorScheduleConflictReadiness } from './exam-instance-participant-proctor-schedule-conflict-readiness-preflight.ts';
import { LATEST_START_POLICIES, type LatestStartPolicy } from './exam-provisioning.ts';
import { LOCAL_DATE_TIME, MAX_DURATION_MINUTES, isRealLocalDateTime } from './teacher-exam-import.ts';
import { lockManagedExam } from './managed-exam.ts';

// The teacher moves a scheduled or ready exam before it opens (ASSESS-TEACHER-003). D04.2-45
// LOCKED: rescheduling before ACTIVE is allowed under governance, with a readiness re-check,
// a conflict re-check, participant and proctor notification and audit; D04.2-46: an ACTIVE
// exam is not rescheduled; D04.2-25 LOCKED: READY is re-evaluated after a schedule change, so
// a READY exam falls back to SCHEDULED (recorded as a lifecycle event) and the teacher marks it
// ready again; D04.2-66 and D04.2-86: the participants stay as they are. Only the teacher who
// manages the exam reschedules it, the authority that marks it ready and opens it
// (D04.4-26A). The new window must still be ahead, the duration must fit the window under
// the late-start rule, and no participant or proctor may be expected elsewhere at an
// overlapping time: the same checks as "Tandai Siap". Each change is kept with the values
// before and after it, who made it and when (migration 0051); students and proctors see that
// the schedule changed. One request makes one change: the action key chosen by the device
// finds the change a retried request already made.

export type RescheduleProblemCode =
    | 'time_zone_missing'
    | 'window_invalid'
    | 'window_order'
    | 'window_ended'
    | 'duration_invalid'
    | 'duration_exceeds_window'
    | 'schedule_conflict'
    | 'proctor_schedule_conflict';

export interface RescheduleRequest {
    examInstanceId: string;
    /** Wall-clock date and time in the school's zone, `YYYY-MM-DDTHH:MM`. */
    windowStartsAt: string;
    windowEndsAt: string;
    durationMinutes: number;
    latestStartPolicy: LatestStartPolicy;
    actionKey: string;
}

export interface ExamSchedule {
    windowStartsAt: string;
    windowEndsAt: string;
    durationMinutes: number;
    latestStartPolicy: LatestStartPolicy;
}

export type RescheduleOutcome =
    | {
        type: 'rescheduled';
        examInstanceId: string;
        lifecycleState: string;
        schedule: ExamSchedule;
        /** False when the request asked for the schedule the exam already had: nothing was recorded. */
        changed: boolean;
        /** The action key had already made this change. */
        replayed: boolean;
        changedAt: string | null;
    }
    | { type: 'invalid'; problems: Array<{ code: RescheduleProblemCode }> }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'forbidden' }
    | { type: 'action_key_reused' }
    | { type: 'unavailable' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESCHEDULABLE_STATES = new Set(['SCHEDULED', 'READY']);

/** The request body as rescheduling expects it, or null when it is malformed (400). */
export function parseRescheduleRequest(body: Record<string, unknown>): RescheduleRequest | null {
    const { examInstanceId, windowStartsAt, windowEndsAt, durationMinutes, latestStartPolicy, actionKey } = body;
    if (typeof examInstanceId !== 'string' || !UUID.test(examInstanceId)) return null;
    if (typeof actionKey !== 'string' || !UUID.test(actionKey)) return null;
    if (typeof windowStartsAt !== 'string' || !LOCAL_DATE_TIME.test(windowStartsAt)) return null;
    if (typeof windowEndsAt !== 'string' || !LOCAL_DATE_TIME.test(windowEndsAt)) return null;
    if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes)) return null;
    if (typeof latestStartPolicy !== 'string' || !LATEST_START_POLICIES.includes(latestStartPolicy as LatestStartPolicy)) return null;
    return {
        examInstanceId: examInstanceId.toLowerCase(),
        windowStartsAt,
        windowEndsAt,
        durationMinutes,
        latestStartPolicy: latestStartPolicy as LatestStartPolicy,
        actionKey: actionKey.toLowerCase(),
    };
}

function iso(value: unknown): string {
    return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

function scheduleOf(startsAt: unknown, endsAt: unknown, durationSeconds: unknown, policy: unknown): ExamSchedule {
    return {
        windowStartsAt: iso(startsAt),
        windowEndsAt: iso(endsAt),
        durationMinutes: Math.round(Number(durationSeconds) / 60),
        latestStartPolicy: policy as LatestStartPolicy,
    };
}

export async function rescheduleTeacherExam(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    request: RescheduleRequest
): Promise<RescheduleOutcome> {
    if (!UUID.test(actor.tenantId) || !UUID.test(actor.personId)) return { type: 'forbidden' };
    const problems: Array<{ code: RescheduleProblemCode }> = [];
    const localValid = isRealLocalDateTime(request.windowStartsAt) && isRealLocalDateTime(request.windowEndsAt);
    if (!localValid) problems.push({ code: 'window_invalid' });
    const durationValid = Number.isInteger(request.durationMinutes) && request.durationMinutes >= 1 && request.durationMinutes <= MAX_DURATION_MINUTES;
    if (!durationValid) problems.push({ code: 'duration_invalid' });

    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }
    try {
        await client.query('BEGIN');
        // The managing teacher's exam, locked like every lifecycle transition: requests for one
        // exam are decided one at a time, so a retry that overtakes the original finds its change.
        const row = await lockManagedExam(client, actor, request.examInstanceId);
        if (!row) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        const timeZone: string | null = row.time_zone ?? null;
        if (!timeZone) problems.push({ code: 'time_zone_missing' });

        let startsAt: Date | null = null;
        let endsAt: Date | null = null;
        if (timeZone && localValid) {
            const window = await client.query(
                `SELECT ($1::timestamp AT TIME ZONE $3) AS starts_at, ($2::timestamp AT TIME ZONE $3) AS ends_at`,
                [request.windowStartsAt, request.windowEndsAt, timeZone]
            );
            startsAt = window.rows[0].starts_at;
            endsAt = window.rows[0].ends_at;
        }
        const durationSeconds = request.durationMinutes * 60;

        // A retried request finds its change; a key never serves another one.
        const earlier = await client.query(
            `SELECT exam_instance_id, changed_by_person_id, changed_at, new_window_starts_at, new_window_ends_at,
                    new_duration_seconds, new_latest_start_policy
             FROM secure_assessment_exam_schedule_changes
             WHERE tenant_id = $1 AND action_key = $2`,
            [actor.tenantId, request.actionKey]
        );
        if (earlier.rows.length === 1) {
            const change = earlier.rows[0];
            const same = change.exam_instance_id === request.examInstanceId && change.changed_by_person_id === actor.personId
                && startsAt !== null && endsAt !== null
                && new Date(change.new_window_starts_at).getTime() === startsAt.getTime()
                && new Date(change.new_window_ends_at).getTime() === endsAt.getTime()
                && Number(change.new_duration_seconds) === durationSeconds
                && change.new_latest_start_policy === request.latestStartPolicy;
            await client.query('ROLLBACK');
            if (!same) return { type: 'action_key_reused' };
            return {
                type: 'rescheduled', examInstanceId: request.examInstanceId, lifecycleState: row.lifecycle_state,
                schedule: scheduleOf(change.new_window_starts_at, change.new_window_ends_at, change.new_duration_seconds, change.new_latest_start_policy),
                changed: true, replayed: true, changedAt: iso(change.changed_at),
            };
        }

        if (!RESCHEDULABLE_STATES.has(row.lifecycle_state)) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', currentState: row.lifecycle_state };
        }
        if (startsAt && endsAt) {
            if (!(endsAt.getTime() > startsAt.getTime())) problems.push({ code: 'window_order' });
            else if (!(endsAt.getTime() > new Date(row.db_now).getTime())) problems.push({ code: 'window_ended' });
        }
        if (problems.length > 0) {
            await client.query('ROLLBACK');
            return { type: 'invalid', problems };
        }

        const unchanged = row.window_starts_at && row.window_ends_at
            && new Date(row.window_starts_at).getTime() === startsAt!.getTime()
            && new Date(row.window_ends_at).getTime() === endsAt!.getTime()
            && Number(row.configured_attempt_duration_seconds) === durationSeconds
            && row.latest_start_policy === request.latestStartPolicy;
        if (unchanged) {
            await client.query('ROLLBACK');
            return {
                type: 'rescheduled', examInstanceId: request.examInstanceId, lifecycleState: row.lifecycle_state,
                schedule: scheduleOf(startsAt, endsAt, durationSeconds, request.latestStartPolicy),
                changed: false, replayed: false, changedAt: null,
            };
        }

        // READY is re-evaluated after the change: the exam is scheduled again (D04.2-25).
        await client.query(
            `UPDATE secure_assessment_exam_instances
             SET window_starts_at = $3, window_ends_at = $4, configured_attempt_duration_seconds = $5, latest_start_policy = $6,
                 lifecycle_state = 'SCHEDULED'
             WHERE id = $1 AND tenant_id = $2`,
            [request.examInstanceId, actor.tenantId, startsAt, endsAt, durationSeconds, request.latestStartPolicy]
        );
        if (row.lifecycle_state === 'READY') {
            await client.query(
                `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id, occurred_at)
                 VALUES ($1, $2, 'READY', 'SCHEDULED', $3, statement_timestamp())`,
                [actor.tenantId, request.examInstanceId, actor.personId]
            );
        }

        // What the schedule decides, checked as "Tandai Siap" checks it.
        const granted = async () => 'granted' as const;
        const fit = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(client, actor.tenantId, request.examInstanceId, granted);
        if (fit.type === 'not_ready' && fit.blocker === 'attempt_duration_exceeds_window') problems.push({ code: 'duration_exceeds_window' });
        else if (fit.type === 'unavailable') throw new Error('readiness unavailable');
        const conflict = await checkExamInstanceParticipantProctorScheduleConflictReadiness(client, actor.tenantId, request.examInstanceId, granted);
        if (conflict.type === 'not_ready') {
            problems.push({ code: conflict.blocker === 'proctor_schedule_conflict' ? 'proctor_schedule_conflict' : 'schedule_conflict' });
        } else if (conflict.type === 'unavailable') {
            throw new Error('readiness unavailable');
        }
        if (problems.length > 0) {
            await client.query('ROLLBACK');
            return { type: 'invalid', problems };
        }

        const recorded = await client.query(
            `INSERT INTO secure_assessment_exam_schedule_changes (
                 tenant_id, exam_instance_id, changed_by_person_id, action_key, changed_at, previous_lifecycle_state,
                 previous_window_starts_at, previous_window_ends_at, previous_duration_seconds, previous_latest_start_policy,
                 new_window_starts_at, new_window_ends_at, new_duration_seconds, new_latest_start_policy)
             VALUES ($1, $2, $3, $4, statement_timestamp(), $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING changed_at`,
            [
                actor.tenantId, request.examInstanceId, actor.personId, request.actionKey, row.lifecycle_state,
                row.window_starts_at, row.window_ends_at, row.configured_attempt_duration_seconds, row.latest_start_policy,
                startsAt, endsAt, durationSeconds, request.latestStartPolicy,
            ]
        );
        await client.query('COMMIT');
        return {
            type: 'rescheduled', examInstanceId: request.examInstanceId, lifecycleState: 'SCHEDULED',
            schedule: scheduleOf(startsAt, endsAt, durationSeconds, request.latestStartPolicy),
            changed: true, replayed: false, changedAt: iso(recorded.rows[0].changed_at),
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
