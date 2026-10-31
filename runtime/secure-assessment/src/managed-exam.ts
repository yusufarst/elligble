import type pg from 'pg';

// The exam as its managing teacher changes it before it opens (D04.4-26A: the teacher who
// holds the active teaching assignment of a teacher-managed exam). A change takes the row FOR
// UPDATE, the lock every lifecycle transition takes, so changes to one exam are decided one
// at a time and a retry that overtakes the original finds what the original recorded.
// Rescheduling (teacher-exam-schedule.ts), cancellation (teacher-exam-cancel.ts) and adding
// participants (teacher-exam-participants.ts) share it; reading what a change would act on
// takes no lock.

export interface ManagedExamRow {
    lifecycle_state: string;
    window_starts_at: Date | null;
    window_ends_at: Date | null;
    configured_attempt_duration_seconds: number | null;
    latest_start_policy: string | null;
    /** The school's time zone. */
    time_zone: string | null;
    db_now: Date;
}

async function selectManagedExam(
    client: pg.PoolClient,
    actor: { tenantId: string; personId: string },
    examInstanceId: string,
    lock: boolean,
    keyShare = false
): Promise<ManagedExamRow | null> {
    const exam = await client.query(
        `SELECT i.lifecycle_state, i.window_starts_at, i.window_ends_at, i.configured_attempt_duration_seconds,
                i.latest_start_policy, t.time_zone, statement_timestamp() AS db_now
         FROM secure_assessment_exam_instances i
         JOIN tenant_tenants t ON t.id = i.tenant_id
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
         ${lock ? (keyShare ? 'FOR KEY SHARE OF i' : 'FOR UPDATE OF i') : ''}`,
        [examInstanceId, actor.tenantId, actor.personId]
    );
    if (exam.rows.length !== 1) return null;
    if (lock) {
        const authority = await client.query(
            `SELECT ata.id FROM academic_core_teaching_assignments ata
             JOIN tenant_teacher_assignments tta ON tta.id = ata.teacher_assignment_id AND tta.tenant_id = ata.tenant_id
             JOIN tenant_memberships tm ON tm.id = tta.membership_id AND tm.tenant_id = tta.tenant_id
             JOIN secure_assessment_exam_instances i ON i.teaching_assignment_id = ata.id AND i.tenant_id = ata.tenant_id
             WHERE i.id = $1 AND i.tenant_id = $2 AND tm.person_id = $3
               AND ata.revoked_at IS NULL AND tta.revoked_at IS NULL
             FOR SHARE OF ata, tta, tm`, [examInstanceId, actor.tenantId, actor.personId]
        );
        if (authority.rows.length !== 1) return null;
    }
    return exam.rows[0] as ManagedExamRow;
}

/** The managing teacher's exam, locked; null when the actor does not manage it. */
export function lockManagedExam(
    client: pg.PoolClient,
    actor: { tenantId: string; personId: string },
    examInstanceId: string,
    keyShare = false
): Promise<ManagedExamRow | null> {
    return selectManagedExam(client, actor, examInstanceId, true, keyShare);
}

/** The managing teacher's exam as it stands, without a lock; null when the actor does not manage it. */
export function readManagedExam(
    client: pg.PoolClient,
    actor: { tenantId: string; personId: string },
    examInstanceId: string
): Promise<ManagedExamRow | null> {
    return selectManagedExam(client, actor, examInstanceId, false);
}
