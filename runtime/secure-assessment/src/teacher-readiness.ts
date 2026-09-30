import * as http from 'node:http';
import * as pg from 'pg';
import { evaluateExamReadiness } from './exam-lifecycle-operations.ts';

export interface TeacherReadinessContext {
    tenantId: string;
    personId: string;
}

export interface TeacherReadinessDependencies {
    pool: pg.Pool;
    getTeacherReadinessContext?: (req: http.IncomingMessage) => TeacherReadinessContext | null;
}

export interface TeacherExamBaselineProjection {
    status: 'baseline_readiness_checks_pass' | 'not_ready' | 'invalid_state' | 'denied' | 'unavailable' | 'not_evaluated';
    category?: string;
    blocker?: string;
}

export interface TeacherExamRoomProctorProjection {
    status: 'room_proctor_readiness_ready' | 'room_proctor_readiness_not_applicable' | 'not_ready' | 'invalid_state' | 'denied' | 'unavailable' | 'not_evaluated';
    blocker?: string;
}

/** Aggregate delivery progress of an ACTIVE, PAUSED or ENDED exam; counts only, no participant identities. */
export interface TeacherExamProgressProjection {
    participants: number;
    started: number;
    submitted: number;
    /** Started, not submitted and with working time left: still running (after END too). */
    running: number;
}

export interface TeacherExamReadinessProjection {
    examInstanceId: string;
    subjectLabel: string | null;
    /** Class and assessment type, so exams of one subject stay apart (D04.2-27/28). */
    groupLabel: string | null;
    assessmentTypeLabel: string | null;
    lifecycleState: string | null;
    windowStartsAt: string | null;
    windowEndsAt: string | null;
    baseline: TeacherExamBaselineProjection;
    roomProctor: TeacherExamRoomProctorProjection;
    progress: TeacherExamProgressProjection | null;
    /** Start of the open pause while the exam is PAUSED. */
    pausedAt: string | null;
    /** When the results were finalized (FINALIZED only). */
    finalizedAt: string | null;
}

const DELIVERY_STATES = new Set(['ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED']);

function isoOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface TeacherReadinessResponse {
    exams: TeacherExamReadinessProjection[];
}

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export async function handleTeacherReadinessGet(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: TeacherReadinessDependencies
): Promise<void> {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
    }

    if (!deps.getTeacherReadinessContext) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }

    let context: TeacherReadinessContext | null = null;
    try {
        context = deps.getTeacherReadinessContext(req);
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
        return;
    }

    if (!context || !context.tenantId || !context.personId || !isValidUUID(context.tenantId) || !isValidUUID(context.personId)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }

    let client: pg.PoolClient;
    try {
        client = await deps.pool.connect();
    } catch (err) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'persistence_unavailable' }));
        return;
    }

    try {
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

        // Verify valid active teaching authority first
        const authorityQuery = `
            SELECT 1
            FROM tenant_memberships tm
            JOIN tenant_teacher_assignments tta
                ON tta.membership_id = tm.id
               AND tta.tenant_id = tm.tenant_id
               AND tta.revoked_at IS NULL
            JOIN academic_core_teaching_assignments ata
                ON ata.teacher_assignment_id = tta.id
               AND ata.tenant_id = tta.tenant_id
               AND ata.revoked_at IS NULL
            WHERE tm.tenant_id = $1
              AND tm.person_id = $2
            LIMIT 1
        `;
        const authorityResult = await client.query(authorityQuery, [context.tenantId, context.personId]);
        if (authorityResult.rows.length === 0) {
            await client.query('COMMIT');
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'forbidden' }));
            return;
        }

        const query = `
            SELECT
                i.id AS exam_instance_id,
                i.lifecycle_state AS lifecycle_state,
                i.window_starts_at AS window_starts_at,
                i.window_ends_at AS window_ends_at,
                s.display_label AS subject_label,
                g.display_label AS group_label,
                t.display_label AS assessment_type_label
            FROM tenant_memberships tm
            JOIN tenant_teacher_assignments tta
                ON tta.membership_id = tm.id
               AND tta.tenant_id = tm.tenant_id
               AND tta.revoked_at IS NULL
            JOIN academic_core_teaching_assignments ata
                ON ata.teacher_assignment_id = tta.id
               AND ata.tenant_id = tta.tenant_id
               AND ata.revoked_at IS NULL
            JOIN secure_assessment_exam_instances i
                ON i.teaching_assignment_id = ata.id
               AND i.tenant_id = ata.tenant_id
               AND i.lifecycle_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED')
            LEFT JOIN academic_core_subject_offerings so
                ON so.id = ata.subject_offering_id AND so.tenant_id = ata.tenant_id
            LEFT JOIN academic_core_subjects s
                ON s.id = so.subject_id AND s.tenant_id = ata.tenant_id
            LEFT JOIN academic_core_academic_groups g
                ON g.id = ata.academic_group_id AND g.tenant_id = ata.tenant_id
            LEFT JOIN secure_assessment_assessment_types t
                ON t.id = i.assessment_type_id AND t.tenant_id = i.tenant_id
            WHERE tm.tenant_id = $1
              AND tm.person_id = $2
            ORDER BY i.window_starts_at ASC NULLS LAST, i.id ASC
        `;

        const queryResult = await client.query(query, [context.tenantId, context.personId]);

        const exams: TeacherExamReadinessProjection[] = [];

        for (const row of queryResult.rows) {
            const examInstanceId = row.exam_instance_id;
            let baseline: TeacherExamBaselineProjection = { status: 'not_evaluated' };
            let roomProctor: TeacherExamRoomProctorProjection = { status: 'not_evaluated' };
            let progress: TeacherExamProgressProjection | null = null;
            let pausedAt: string | null = null;
            let finalizedAt: string | null = null;

            if (DELIVERY_STATES.has(row.lifecycle_state)) {
                const progressResult = await client.query(`
                    SELECT
                        COUNT(DISTINCT p.id)::int AS participants,
                        COUNT(DISTINCT a.id) FILTER (WHERE t.started_at IS NOT NULL)::int AS started,
                        COUNT(DISTINCT sub.id)::int AS submitted,
                        COUNT(DISTINCT a.id) FILTER (WHERE t.started_at IS NOT NULL AND sub.id IS NULL AND rem.seconds > 0)::int AS running
                    FROM secure_assessment_exam_participants p
                    LEFT JOIN secure_assessment_exam_attempts a
                        ON a.exam_participant_id = p.id AND a.tenant_id = p.tenant_id
                    LEFT JOIN secure_assessment_timer_state t
                        ON t.exam_attempt_id = a.id AND t.tenant_id = a.tenant_id
                    LEFT JOIN secure_assessment_exam_submissions sub
                        ON sub.exam_attempt_id = a.id AND sub.tenant_id = a.tenant_id
                    LEFT JOIN LATERAL (
                        SELECT secure_assessment_attempt_remaining_seconds(t.tenant_id, t.exam_attempt_id, statement_timestamp()) AS seconds
                    ) rem ON TRUE
                    WHERE p.tenant_id = $1 AND p.exam_instance_id = $2
                `, [context.tenantId, examInstanceId]);
                const counts = progressResult.rows[0] ?? {};
                progress = {
                    participants: Number(counts.participants ?? 0),
                    started: Number(counts.started ?? 0),
                    submitted: Number(counts.submitted ?? 0),
                    running: Number(counts.running ?? 0),
                };
                if (row.lifecycle_state === 'PAUSED') {
                    const open = await client.query(
                        `SELECT paused_at FROM secure_assessment_exam_pauses
                         WHERE tenant_id = $1 AND exam_instance_id = $2 AND resumed_at IS NULL`,
                        [context.tenantId, examInstanceId]
                    );
                    pausedAt = isoOrNull(open.rows[0]?.paused_at);
                }
                if (row.lifecycle_state === 'FINALIZED') {
                    const done = await client.query(
                        'SELECT finalized_at FROM secure_assessment_exam_result_finalizations WHERE tenant_id = $1 AND exam_instance_id = $2',
                        [context.tenantId, examInstanceId]
                    );
                    finalizedAt = isoOrNull(done.rows[0]?.finalized_at);
                }
            } else {
                const readiness = await evaluateExamReadiness(client as unknown as pg.PoolClient, context.tenantId, examInstanceId);
                baseline = readiness.baseline as TeacherExamBaselineProjection;
                roomProctor = readiness.roomProctor as TeacherExamRoomProctorProjection;
            }

            exams.push({
                examInstanceId,
                subjectLabel: row.subject_label ?? null,
                groupLabel: row.group_label ?? null,
                assessmentTypeLabel: row.assessment_type_label ?? null,
                lifecycleState: row.lifecycle_state ?? null,
                windowStartsAt: isoOrNull(row.window_starts_at),
                windowEndsAt: isoOrNull(row.window_ends_at),
                baseline,
                roomProctor,
                progress,
                pausedAt,
                finalizedAt,
            });
        }

        await client.query('COMMIT');

        const responseBody: TeacherReadinessResponse = {
            exams
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseBody));
    } catch (dbErr) {
        try { await client.query('ROLLBACK'); } catch {}
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'persistence_unavailable' }));
        return;
    } finally {
        client.release();
    }
}
