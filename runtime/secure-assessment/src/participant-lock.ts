import type * as pg from 'pg';

// Participant lock and unlock (D04.6-38/39 LOCKED, D04.2-76; ASSESS-PROCTOR-001). An
// authorized supervisor stops one participant's work and releases it again directly from
// the monitoring screen, without any code for the student. Authorized means the assigned
// proctor of the exam, limited to their rooms when the exam runs with rooms, or the teacher
// who manages a teacher-managed exam (contextual supervision, D04.4-26A/B/C): the same
// scope as the monitoring list. The lock applies to the participant's open attempt; it
// keeps every answer (D04.6-38) and does not stop the time (D04.6-40, pause is separate).
// Both actions are idempotent and recorded with actor and time (migration 0046).

export type ParticipantLockAction = 'lock' | 'unlock';

export type ParticipantLockResult =
    | { type: 'ok'; participantId: string; locked: boolean; changed: boolean; lockedAt: string | null }
    | { type: 'forbidden' }
    | { type: 'invalid_state'; currentState: string }
    | { type: 'no_active_attempt' }
    | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPERVISED_STATES = new Set(['ACTIVE', 'PAUSED', 'ENDED']);

export async function performParticipantLockAction(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    examInstanceId: string,
    participantId: string,
    action: ParticipantLockAction
): Promise<ParticipantLockResult> {
    if (!UUID_REGEX.test(examInstanceId) || !UUID_REGEX.test(participantId) || (action !== 'lock' && action !== 'unlock')) {
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
        // Exam row before attempt row, the order every attempt writer uses.
        const exam = await client.query(
            `SELECT i.lifecycle_state, COALESCE(i.room_based_operations_enabled, FALSE) AS room_based,
                    (SELECT pa.id FROM secure_assessment_proctor_assignments pa
                     WHERE pa.tenant_id = i.tenant_id AND pa.exam_instance_id = i.id AND pa.person_id = $3 AND pa.revoked_at IS NULL
                     LIMIT 1) AS proctor_assignment_id,
                    EXISTS (
                        SELECT 1
                        FROM academic_core_teaching_assignments ata
                        JOIN tenant_teacher_assignments tta
                          ON tta.id = ata.teacher_assignment_id AND tta.tenant_id = ata.tenant_id AND tta.revoked_at IS NULL
                        JOIN tenant_memberships tm
                          ON tm.id = tta.membership_id AND tm.tenant_id = tta.tenant_id AND tm.person_id = $3
                        WHERE ata.id = i.teaching_assignment_id AND ata.tenant_id = i.tenant_id AND ata.revoked_at IS NULL
                    ) AS is_teacher
             FROM secure_assessment_exam_instances i
             WHERE i.id = $1 AND i.tenant_id = $2
             FOR KEY SHARE OF i`,
            [examInstanceId, actor.tenantId, actor.personId]
        );
        const row = exam.rows[0];
        if (!row || (!row.proctor_assignment_id && !row.is_teacher)) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        // An assigned proctor of an exam with rooms acts only in their rooms.
        const roomFilter: string | null = row.proctor_assignment_id && row.room_based ? row.proctor_assignment_id : null;
        const participant = await client.query(
            `SELECT p.id FROM secure_assessment_exam_participants p
             WHERE p.tenant_id = $1 AND p.exam_instance_id = $2 AND p.id = $3
               AND ($4::uuid IS NULL OR EXISTS (
                   SELECT 1 FROM secure_assessment_exam_participant_room_assignments pra
                   JOIN secure_assessment_exam_proctor_room_assignments epra
                     ON epra.tenant_id = pra.tenant_id AND epra.exam_instance_id = pra.exam_instance_id AND epra.exam_room_id = pra.exam_room_id
                   WHERE pra.tenant_id = p.tenant_id AND pra.exam_instance_id = p.exam_instance_id AND pra.exam_participant_id = p.id
                     AND epra.proctor_assignment_id = $4
               ))`,
            [actor.tenantId, examInstanceId, participantId, roomFilter]
        );
        if (participant.rows.length !== 1) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        if (!SUPERVISED_STATES.has(row.lifecycle_state)) {
            await client.query('ROLLBACK');
            return { type: 'invalid_state', currentState: row.lifecycle_state };
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
        const attemptId: string = attempt.rows[0].id;
        const open = await client.query(
            `SELECT id, locked_at FROM secure_assessment_attempt_locks
             WHERE tenant_id = $1 AND exam_attempt_id = $2 AND unlocked_at IS NULL`,
            [actor.tenantId, attemptId]
        );
        if (action === 'lock') {
            if (open.rows.length === 1) {
                await client.query('ROLLBACK');
                return { type: 'ok', participantId, locked: true, changed: false, lockedAt: new Date(open.rows[0].locked_at).toISOString() };
            }
            // The boundary is taken after the attempt row lock: a save in flight lands before it.
            const created = await client.query(
                `INSERT INTO secure_assessment_attempt_locks (tenant_id, exam_attempt_id, locked_at, locked_by_person_id)
                 VALUES ($1, $2, statement_timestamp(), $3) RETURNING locked_at`,
                [actor.tenantId, attemptId, actor.personId]
            );
            await client.query('COMMIT');
            return { type: 'ok', participantId, locked: true, changed: true, lockedAt: new Date(created.rows[0].locked_at).toISOString() };
        }
        if (open.rows.length === 0) {
            await client.query('ROLLBACK');
            return { type: 'ok', participantId, locked: false, changed: false, lockedAt: null };
        }
        await client.query(
            `UPDATE secure_assessment_attempt_locks SET unlocked_at = statement_timestamp(), unlocked_by_person_id = $3
             WHERE tenant_id = $1 AND id = $2 AND unlocked_at IS NULL`,
            [actor.tenantId, open.rows[0].id, actor.personId]
        );
        await client.query('COMMIT');
        return { type: 'ok', participantId, locked: false, changed: true, lockedAt: null };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
