import type * as pg from 'pg';
import { checkExamInstanceBaselineReadinessChecksCompositionPreflight } from './exam-instance-baseline-readiness-checks-composition-preflight.ts';
import { checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight } from './exam-instance-conditional-room-proctor-readiness-composition-preflight.ts';

// Teacher-managed exam operations (D04.4-26A/B/C): the teacher who holds the active
// Teaching Assignment of an Exam Instance may move it SCHEDULED -> READY (all mandatory
// readiness checks pass, D04.2-06) and READY -> ACTIVE (final re-check, D04.2-68;
// never before the window opens, D04.2-70). Every transition is recorded with its actor.
//
// Pause, resume and end follow the Owner decision of 2026-09-30 (D04.2-77/81). A whole-exam
// pause is not a casual room-proctor action (D04.6-48), so, like activation, it belongs to
// the managing teacher. PAUSE (ACTIVE -> PAUSED) records the authoritative pause boundary:
// every active attempt's remaining time freezes there (secure_assessment_attempt_elapsed_
// seconds, migration 0044). RESUME (PAUSED -> ACTIVE) closes the pause, so each attempt
// continues from exactly its pre-pause remaining time. END (ACTIVE -> ENDED) only stops new
// starts: attempts already running keep their own remaining time and finish by submission
// or automatic submission at their own expiry; nothing is force-submitted and no result
// becomes visible. The three are idempotent: repeating one that already took effect changes
// nothing and records nothing. END of a paused exam needs a resume first (not decided).
// Institution-managed governance (D04.4-26D/E) is intentionally not implemented here.

export type TeacherExamAction = 'mark_ready' | 'activate' | 'pause' | 'resume' | 'end';

export const TEACHER_EXAM_ACTIONS: readonly TeacherExamAction[] = ['mark_ready', 'activate', 'pause', 'resume', 'end'];

export interface TeacherActor {
    tenantId: string;
    personId: string;
}

export interface ReadinessSummary {
    baseline: { status: string; category?: string; blocker?: string };
    roomProctor: { status: string; blocker?: string };
}

export type TeacherExamActionResult =
    | { type: 'transitioned'; examInstanceId: string; lifecycleState: string; changed: boolean }
    | { type: 'forbidden' }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'not_ready'; readiness: ReadinessSummary }
    | { type: 'window_not_started'; windowStartsAt: string }
    | { type: 'window_closed' }
    | { type: 'unavailable' };

const TRANSITIONS: Record<TeacherExamAction, { from: string; to: string; idempotent: boolean }> = {
    mark_ready: { from: 'SCHEDULED', to: 'READY', idempotent: false },
    activate: { from: 'READY', to: 'ACTIVE', idempotent: false },
    pause: { from: 'ACTIVE', to: 'PAUSED', idempotent: true },
    resume: { from: 'PAUSED', to: 'ACTIVE', idempotent: true },
    end: { from: 'ACTIVE', to: 'ENDED', idempotent: true },
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Readiness as the teacher view presents it; reused by the transition and the read model. */
export async function evaluateExamReadiness(client: pg.PoolClient, tenantId: string, examInstanceId: string): Promise<ReadinessSummary & { ready: boolean }> {
    const baselineRaw = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(client, tenantId, examInstanceId, async () => 'granted' as const);
    const roomRaw = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(client, tenantId, examInstanceId, async () => 'granted' as const);

    const baseline = baselineRaw.type === 'not_ready'
        ? { status: 'not_ready', category: baselineRaw.category, blocker: baselineRaw.blocker }
        : { status: baselineRaw.type };
    const roomProctor = roomRaw.type === 'not_ready'
        ? { status: 'not_ready', blocker: roomRaw.blocker }
        : { status: roomRaw.type };
    const ready = baselineRaw.type === 'baseline_readiness_checks_pass' &&
        (roomRaw.type === 'room_proctor_readiness_ready' || roomRaw.type === 'room_proctor_readiness_not_applicable');
    return { baseline, roomProctor, ready };
}

export async function performTeacherExamAction(
    pool: pg.Pool,
    actor: TeacherActor,
    examInstanceId: string,
    action: TeacherExamAction
): Promise<TeacherExamActionResult> {
    if (!UUID_REGEX.test(examInstanceId) || !Object.hasOwn(TRANSITIONS, action)) {
        return { type: 'forbidden' };
    }
    const transition = TRANSITIONS[action];

    let client: pg.PoolClient;
    try {
        client = await pool.connect();
    } catch {
        return { type: 'unavailable' };
    }

    try {
        await client.query('BEGIN');
        const exam = await client.query(
            `SELECT i.lifecycle_state, i.window_starts_at, i.window_ends_at, statement_timestamp() AS db_now
             FROM secure_assessment_exam_instances i
             WHERE i.id = $1 AND i.tenant_id = $2
               AND EXISTS (
                   SELECT 1
                   FROM tenant_memberships tm
                   JOIN tenant_teacher_assignments tta
                     ON tta.membership_id = tm.id AND tta.tenant_id = tm.tenant_id AND tta.revoked_at IS NULL
                   JOIN academic_core_teaching_assignments ata
                     ON ata.teacher_assignment_id = tta.id AND ata.tenant_id = tta.tenant_id AND ata.revoked_at IS NULL
                   WHERE tm.tenant_id = i.tenant_id AND tm.person_id = $3 AND ata.id = i.teaching_assignment_id
               )
             FOR UPDATE OF i`,
            [examInstanceId, actor.tenantId, actor.personId]
        );
        if (exam.rows.length !== 1) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        const row = exam.rows[0];
        if (transition.idempotent && row.lifecycle_state === transition.to) {
            await client.query('ROLLBACK');
            return { type: 'transitioned', examInstanceId, lifecycleState: transition.to, changed: false };
        }
        if (row.lifecycle_state !== transition.from) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', currentState: row.lifecycle_state };
        }

        if (action === 'pause' || action === 'resume' || action === 'end') {
            const moved = await client.query(
                `UPDATE secure_assessment_exam_instances SET lifecycle_state = $3
                 WHERE id = $1 AND tenant_id = $2 AND lifecycle_state = $4`,
                [examInstanceId, actor.tenantId, transition.to, transition.from]
            );
            if (moved.rowCount !== 1) {
                await client.query('ROLLBACK');
                return { type: 'invalid_state', currentState: row.lifecycle_state };
            }
            // The boundary is taken here, after the exam row lock: every answer save,
            // submission or timer start that saw the exam running has already committed.
            if (action === 'pause') {
                await client.query(
                    `INSERT INTO secure_assessment_exam_pauses (tenant_id, exam_instance_id, paused_at, paused_by_person_id)
                     VALUES ($1, $2, statement_timestamp(), $3)`,
                    [actor.tenantId, examInstanceId, actor.personId]
                );
            } else if (action === 'resume') {
                const closed = await client.query(
                    `UPDATE secure_assessment_exam_pauses SET resumed_at = statement_timestamp(), resumed_by_person_id = $3
                     WHERE tenant_id = $1 AND exam_instance_id = $2 AND resumed_at IS NULL`,
                    [actor.tenantId, examInstanceId, actor.personId]
                );
                if (closed.rowCount !== 1) {
                    // A PAUSED exam without its open pause would lose the boundary; refuse.
                    await client.query('ROLLBACK');
                    return { type: 'unavailable' };
                }
            }
            await client.query(
                `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [actor.tenantId, examInstanceId, transition.from, transition.to, actor.personId]
            );
            await client.query('COMMIT');
            return { type: 'transitioned', examInstanceId, lifecycleState: transition.to, changed: true };
        }

        if (action === 'activate') {
            const now = new Date(row.db_now).getTime();
            if (row.window_starts_at && now < new Date(row.window_starts_at).getTime()) {
                await client.query('ROLLBACK');
                return { type: 'window_not_started', windowStartsAt: new Date(row.window_starts_at).toISOString() };
            }
            if (row.window_ends_at && now >= new Date(row.window_ends_at).getTime()) {
                await client.query('ROLLBACK');
                return { type: 'window_closed' };
            }
        }

        const readiness = await evaluateExamReadiness(client, actor.tenantId, examInstanceId);
        if (!readiness.ready) {
            await client.query('ROLLBACK');
            return { type: 'not_ready', readiness: { baseline: readiness.baseline, roomProctor: readiness.roomProctor } };
        }

        const updated = await client.query(
            `UPDATE secure_assessment_exam_instances SET lifecycle_state = $3
             WHERE id = $1 AND tenant_id = $2 AND lifecycle_state = $4`,
            [examInstanceId, actor.tenantId, transition.to, transition.from]
        );
        if (updated.rowCount !== 1) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', currentState: row.lifecycle_state };
        }
        await client.query(
            `INSERT INTO secure_assessment_exam_lifecycle_events (tenant_id, exam_instance_id, from_state, to_state, actor_person_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [actor.tenantId, examInstanceId, transition.from, transition.to, actor.personId]
        );
        await client.query('COMMIT');
        return { type: 'transitioned', examInstanceId, lifecycleState: transition.to, changed: true };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
