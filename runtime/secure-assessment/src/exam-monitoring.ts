import type * as pg from 'pg';
import { listElligbleIds } from '../../identity-access/src/directory.ts';
import type { FinalizationSource } from './submission.ts';

// Participant monitoring list for exam day (D04.6-01/02/03/04/10/11/17/18/61): who is
// supposed to be here, who has started, who has submitted, whose device or tab changed.
// Scope follows the governance context: an assigned proctor sees the participants of the
// rooms assigned to them, or every participant when the exam runs without room operations;
// the teacher who manages a teacher-managed exam sees its participants (D04.4-26A/C). Only
// facts the server holds are reported: accepted answers and their time, the server timer,
// sessions and submissions. Connectivity and unsent answers live on the device and are not
// claimed here. No scores: supervision is separate from scoring (D04.1-63).

export type MonitoringStatus = 'NOT_STARTED' | 'ACTIVE' | 'TIME_UP' | 'SUBMITTED';

export interface MonitoredParticipant {
    elligbleId: string | null;
    roomLabel: string | null;
    status: MonitoringStatus;
    finalizationSource: FinalizationSource | null;
    submittedAt: string | null;
    /** Server timer; null until the attempt's timer started or after submission. */
    remainingSeconds: number | null;
    answeredCount: number;
    /** When the server last accepted an answer of this attempt. */
    lastAcceptedAt: string | null;
    /** An exam session is active for the attempt right now. */
    sessionActive: boolean;
    /** How many times the exam session moved to another device or tab. */
    sessionMoves: number;
}

export interface ExamMonitoring {
    /** pausedAt: start of the open pause while the exam is PAUSED (every participant's time is frozen). */
    exam: { examInstanceId: string; subjectLabel: string | null; lifecycleState: string; roomBased: boolean; pausedAt: string | null };
    scope: 'PROCTOR' | 'TEACHER';
    serverTime: string;
    questionCount: number;
    summary: { participants: number; notStarted: number; active: number; submitted: number };
    participants: MonitoredParticipant[];
}

export type ExamMonitoringOutcome = { type: 'ok'; monitoring: ExamMonitoring } | { type: 'forbidden' } | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function readExamMonitoring(
    pool: pg.Pool,
    actor: { tenantId: string; personId: string },
    examInstanceId: string
): Promise<ExamMonitoringOutcome> {
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
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const exam = await client.query(
            `SELECT i.lifecycle_state, COALESCE(i.room_based_operations_enabled, FALSE) AS room_based,
                    s.display_label AS subject_label, statement_timestamp() AS db_now,
                    (SELECT ps.paused_at FROM secure_assessment_exam_pauses ps
                     WHERE ps.tenant_id = i.tenant_id AND ps.exam_instance_id = i.id AND ps.resumed_at IS NULL) AS paused_at,
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
             LEFT JOIN academic_core_teaching_assignments ta ON ta.id = i.teaching_assignment_id AND ta.tenant_id = i.tenant_id
             LEFT JOIN academic_core_subject_offerings so ON so.id = ta.subject_offering_id AND so.tenant_id = i.tenant_id
             LEFT JOIN academic_core_subjects s ON s.id = so.subject_id AND s.tenant_id = i.tenant_id
             WHERE i.id = $1 AND i.tenant_id = $2`,
            [examInstanceId, actor.tenantId, actor.personId]
        );
        const row = exam.rows[0];
        if (!row || (!row.proctor_assignment_id && !row.is_teacher)) {
            await client.query('ROLLBACK');
            return { type: 'forbidden' };
        }
        const scope: 'PROCTOR' | 'TEACHER' = row.proctor_assignment_id ? 'PROCTOR' : 'TEACHER';
        // An assigned proctor of a room-based exam sees only their rooms.
        const roomFilter: string | null = scope === 'PROCTOR' && row.room_based ? row.proctor_assignment_id : null;

        const questions = await client.query(
            'SELECT count(*)::int AS n FROM secure_assessment_exam_question_snapshots WHERE tenant_id = $1 AND exam_instance_id = $2',
            [actor.tenantId, examInstanceId]
        );
        const participants = await client.query(
            `SELECT p.person_id, er.display_label AS room_label, a.id AS attempt_id,
                    t.started_at,
                    GREATEST(0, secure_assessment_attempt_remaining_seconds(t.tenant_id, t.exam_attempt_id, statement_timestamp())) AS remaining_seconds,
                    sub.submitted_at, sub.finalization_source,
                    COALESCE(ans.answered, 0) AS answered, ans.last_accepted_at,
                    EXISTS (SELECT 1 FROM secure_assessment_exam_sessions ss
                            WHERE ss.tenant_id = p.tenant_id AND ss.exam_attempt_id = a.id AND ss.activated_at IS NOT NULL AND ss.ended_at IS NULL) AS session_active,
                    (SELECT count(*)::int FROM secure_assessment_exam_sessions ss
                     WHERE ss.tenant_id = p.tenant_id AND ss.exam_attempt_id = a.id AND ss.superseded_by_session_id IS NOT NULL) AS session_moves
             FROM secure_assessment_exam_participants p
             LEFT JOIN secure_assessment_exam_participant_room_assignments pra
               ON pra.tenant_id = p.tenant_id AND pra.exam_instance_id = p.exam_instance_id AND pra.exam_participant_id = p.id
             LEFT JOIN secure_assessment_exam_rooms er ON er.id = pra.exam_room_id AND er.tenant_id = p.tenant_id
             LEFT JOIN LATERAL (
                 SELECT att.id FROM secure_assessment_exam_attempts att
                 WHERE att.tenant_id = p.tenant_id AND att.exam_participant_id = p.id
                 ORDER BY att.created_at ASC, att.id ASC LIMIT 1
             ) a ON TRUE
             LEFT JOIN secure_assessment_timer_state t ON t.tenant_id = p.tenant_id AND t.exam_attempt_id = a.id
             LEFT JOIN secure_assessment_exam_submissions sub ON sub.tenant_id = p.tenant_id AND sub.exam_attempt_id = a.id
             LEFT JOIN LATERAL (
                 SELECT count(*)::int AS answered, max(x.updated_at) AS last_accepted_at FROM secure_assessment_exam_answers x
                 WHERE x.tenant_id = p.tenant_id AND x.exam_attempt_id = a.id
             ) ans ON TRUE
             WHERE p.tenant_id = $1 AND p.exam_instance_id = $2
               AND ($3::uuid IS NULL OR pra.exam_room_id IN (
                   SELECT epra.exam_room_id FROM secure_assessment_exam_proctor_room_assignments epra
                   WHERE epra.tenant_id = p.tenant_id AND epra.exam_instance_id = p.exam_instance_id AND epra.proctor_assignment_id = $3
               ))`,
            [actor.tenantId, examInstanceId, roomFilter]
        );
        const elligbleIds = await listElligbleIds(client, participants.rows.map(r => r.person_id as string));
        await client.query('COMMIT');

        const list: MonitoredParticipant[] = participants.rows.map(r => {
            const status: MonitoringStatus = r.submitted_at ? 'SUBMITTED'
                : !r.started_at ? 'NOT_STARTED'
                : Number(r.remaining_seconds) <= 0 ? 'TIME_UP'
                : 'ACTIVE';
            return {
                elligbleId: elligbleIds.get(r.person_id) ?? null,
                roomLabel: r.room_label ?? null,
                status,
                finalizationSource: status === 'SUBMITTED' ? (r.finalization_source ?? null) : null,
                submittedAt: status === 'SUBMITTED' ? isoOrNull(r.submitted_at) : null,
                remainingSeconds: status === 'ACTIVE' ? Number(r.remaining_seconds) : status === 'TIME_UP' ? 0 : null,
                answeredCount: Number(r.answered),
                lastAcceptedAt: isoOrNull(r.last_accepted_at),
                sessionActive: status !== 'SUBMITTED' && Boolean(r.session_active),
                sessionMoves: Number(r.session_moves ?? 0),
            };
        });
        list.sort((a, b) => {
            if (a.elligbleId === null || b.elligbleId === null) return a.elligbleId === b.elligbleId ? 0 : a.elligbleId === null ? 1 : -1;
            return a.elligbleId < b.elligbleId ? -1 : a.elligbleId > b.elligbleId ? 1 : 0;
        });
        const count = (status: MonitoringStatus) => list.filter(p => p.status === status).length;
        return {
            type: 'ok',
            monitoring: {
                exam: {
                    examInstanceId,
                    subjectLabel: row.subject_label ?? null,
                    lifecycleState: row.lifecycle_state,
                    roomBased: Boolean(row.room_based),
                    pausedAt: row.lifecycle_state === 'PAUSED' ? isoOrNull(row.paused_at) : null,
                },
                scope,
                serverTime: new Date(row.db_now).toISOString(),
                questionCount: questions.rows[0].n,
                summary: { participants: list.length, notStarted: count('NOT_STARTED'), active: count('ACTIVE') + count('TIME_UP'), submitted: count('SUBMITTED') },
                participants: list,
            },
        };
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        return { type: 'unavailable' };
    } finally {
        client.release();
    }
}
