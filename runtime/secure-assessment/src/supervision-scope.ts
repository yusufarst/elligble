import type * as pg from 'pg';

// Who supervises an exam and over which participants (D04.4-26A/B/C, D04.6-02/03,
// D04.1-77B): an assigned proctor of the exam, limited to the rooms assigned to them when
// the exam runs with room operations, or the teacher who manages a teacher-managed exam,
// over all its participants. The same scope governs the participant list, the participant
// lock and broadcast messages.

export interface SupervisionScope {
    lifecycleState: string;
    roomBased: boolean;
    scope: 'PROCTOR' | 'TEACHER';
    /** The proctor assignment whose rooms bound the scope, or null for the whole exam. */
    roomFilter: string | null;
}

/**
 * The actor's supervision scope over the exam, or null when the actor does not supervise it
 * (or the exam is not in the actor's school). With lockExam the exam row is taken FOR KEY
 * SHARE, the lock every attempt writer takes before the attempt row.
 */
export async function resolveSupervisionScope(
    client: pg.PoolClient,
    actor: { tenantId: string; personId: string },
    examInstanceId: string,
    options: { lockExam?: boolean } = {}
): Promise<SupervisionScope | null> {
    const res = await client.query(
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
         WHERE i.id = $1 AND i.tenant_id = $2${options.lockExam ? '\n         FOR KEY SHARE OF i' : ''}`,
        [examInstanceId, actor.tenantId, actor.personId]
    );
    const row = res.rows[0];
    if (!row || (!row.proctor_assignment_id && !row.is_teacher)) return null;
    const scope: 'PROCTOR' | 'TEACHER' = row.proctor_assignment_id ? 'PROCTOR' : 'TEACHER';
    return {
        lifecycleState: row.lifecycle_state,
        roomBased: Boolean(row.room_based),
        scope,
        // An assigned proctor of an exam with rooms acts only in their rooms.
        roomFilter: scope === 'PROCTOR' && row.room_based ? row.proctor_assignment_id : null,
    };
}

/**
 * SQL condition: the participant row aliased `alias` lies within the scope whose room filter
 * is bound to the parameter `param` (a proctor assignment id, or NULL for the whole exam).
 * Both arguments are fixed identifiers of the calling query, never input.
 */
export function participantInScope(alias: string, param: string): string {
    return `(${param}::uuid IS NULL OR EXISTS (
                SELECT 1 FROM secure_assessment_exam_participant_room_assignments scope_pra
                JOIN secure_assessment_exam_proctor_room_assignments scope_epra
                  ON scope_epra.tenant_id = scope_pra.tenant_id AND scope_epra.exam_instance_id = scope_pra.exam_instance_id
                 AND scope_epra.exam_room_id = scope_pra.exam_room_id
                WHERE scope_pra.tenant_id = ${alias}.tenant_id AND scope_pra.exam_instance_id = ${alias}.exam_instance_id
                  AND scope_pra.exam_participant_id = ${alias}.id AND scope_epra.proctor_assignment_id = ${param}
            ))`;
}
