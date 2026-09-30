import * as http from 'node:http';
import * as pg from 'pg';

export interface ProctorMonitoringContext {
    tenantId: string;
    personId: string;
}

export interface ProctorMonitoringDependencies {
    pool: pg.Pool;
    getProctorMonitoringContext: (req: http.IncomingMessage) => ProctorMonitoringContext | null;
}

export interface ProctorMonitoringRoomProjection {
    roomId: string;
    roomLabel: string | null;
    participantCount: number;
    activeSessionCount: number;
}

export interface ProctorMonitoringExamProjection {
    examInstanceId: string;
    subjectLabel: string | null;
    windowStartsAt: string | null;
    windowEndsAt: string | null;
    /** The latest change of the schedule before the exam opened (D04.2-45), or null. */
    scheduleChange: { changedAt: string; previousWindowStartsAt: string | null; previousWindowEndsAt: string | null } | null;
    /** When the exam was cancelled before it opened (Owner decision 2026-09-30), or null. */
    cancelledAt: string | null;
    rooms: ProctorMonitoringRoomProjection[];
}

export interface ProctorMonitoringResponse {
    assignments: ProctorMonitoringExamProjection[];
}

function isoOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export async function handleProctorMonitoringGet(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: ProctorMonitoringDependencies
): Promise<void> {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
    }

    let context: ProctorMonitoringContext | null = null;
    try {
        context = deps.getProctorMonitoringContext(req);
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

        const query = `
            SELECT
                pa.exam_instance_id,
                s.display_label as subject_label,
                i.window_starts_at,
                i.window_ends_at,
                sc.changed_at as schedule_changed_at,
                sc.previous_window_starts_at,
                sc.previous_window_ends_at,
                (SELECT ec.cancelled_at FROM secure_assessment_exam_cancellations ec
                 WHERE ec.tenant_id = i.tenant_id AND ec.exam_instance_id = i.id) AS cancelled_at,
                er.id as room_id,
                er.display_label as room_label,
                COUNT(DISTINCT pra.exam_participant_id) as participant_count,
                COUNT(DISTINCT sess.id) as active_session_count
            FROM secure_assessment_proctor_assignments pa
            JOIN secure_assessment_exam_instances i
                ON i.id = pa.exam_instance_id AND i.tenant_id = pa.tenant_id
            LEFT JOIN LATERAL (
                SELECT c.changed_at, c.previous_window_starts_at, c.previous_window_ends_at
                FROM secure_assessment_exam_schedule_changes c
                WHERE c.tenant_id = i.tenant_id AND c.exam_instance_id = i.id
                ORDER BY c.changed_at DESC, c.id DESC
                LIMIT 1
            ) sc ON TRUE
            LEFT JOIN academic_core_teaching_assignments ta
                ON ta.id = i.teaching_assignment_id AND ta.tenant_id = pa.tenant_id
            LEFT JOIN academic_core_subject_offerings so
                ON so.id = ta.subject_offering_id AND so.tenant_id = pa.tenant_id
            LEFT JOIN academic_core_subjects s
                ON s.id = so.subject_id AND s.tenant_id = pa.tenant_id
            LEFT JOIN secure_assessment_exam_proctor_room_assignments epra
                ON epra.proctor_assignment_id = pa.id AND epra.tenant_id = pa.tenant_id
            LEFT JOIN secure_assessment_exam_rooms er
                ON er.id = epra.exam_room_id AND er.tenant_id = pa.tenant_id
            LEFT JOIN secure_assessment_exam_participant_room_assignments pra
                ON pra.exam_room_id = er.id AND pra.tenant_id = pa.tenant_id
            LEFT JOIN secure_assessment_exam_attempts att
                ON att.exam_participant_id = pra.exam_participant_id AND att.tenant_id = pa.tenant_id
            LEFT JOIN secure_assessment_exam_sessions sess
                ON sess.exam_attempt_id = att.id AND sess.tenant_id = pa.tenant_id
                AND sess.activated_at IS NOT NULL AND sess.ended_at IS NULL
            WHERE pa.tenant_id = $1 AND pa.person_id = $2 AND pa.revoked_at IS NULL
            GROUP BY pa.exam_instance_id, s.display_label, i.window_starts_at, i.window_ends_at,
                     sc.changed_at, sc.previous_window_starts_at, sc.previous_window_ends_at, i.tenant_id, i.id, er.id, er.display_label
            ORDER BY pa.exam_instance_id ASC, er.id ASC
        `;

        const queryResult = await client.query(query, [context.tenantId, context.personId]);
        await client.query('COMMIT');

        const assignmentsMap = new Map<string, ProctorMonitoringExamProjection>();

        for (const row of queryResult.rows) {
            const examInstanceId = row.exam_instance_id;
            let item = assignmentsMap.get(examInstanceId);
            if (!item) {
                item = {
                    examInstanceId: examInstanceId,
                    subjectLabel: row.subject_label ?? null,
                    windowStartsAt: isoOrNull(row.window_starts_at),
                    windowEndsAt: isoOrNull(row.window_ends_at),
                    scheduleChange: row.schedule_changed_at ? {
                        changedAt: isoOrNull(row.schedule_changed_at)!,
                        previousWindowStartsAt: isoOrNull(row.previous_window_starts_at),
                        previousWindowEndsAt: isoOrNull(row.previous_window_ends_at),
                    } : null,
                    cancelledAt: isoOrNull(row.cancelled_at),
                    rooms: []
                };
                assignmentsMap.set(examInstanceId, item);
            }
            if (row.room_id) {
                item.rooms.push({
                    roomId: row.room_id,
                    roomLabel: row.room_label ?? null,
                    participantCount: parseInt(row.participant_count, 10),
                    activeSessionCount: parseInt(row.active_session_count, 10)
                });
            }
        }

        const responseBody: ProctorMonitoringResponse = {
            assignments: Array.from(assignmentsMap.values())
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
