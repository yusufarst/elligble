import * as http from 'node:http';
import * as pg from 'pg';

export interface AssignedExamDiscoveryContext {
    tenantId: string;
    personId: string;
}

export interface AssignedExamsDependencies {
    pool: pg.Pool;
    getAssignedExamDiscoveryContext: (req: http.IncomingMessage) => AssignedExamDiscoveryContext | null;
}

export interface AssignedExamAttemptProjection {
    attemptId: string;
    submittedAt: string | null;
}

export interface AssignedExamProjection {
    examInstanceId: string;
    subjectLabel: string | null;
    roomLabel: string | null;
    attempts: AssignedExamAttemptProjection[];
}

export interface AssignedExamsResponse {
    assignments: AssignedExamProjection[];
}

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export async function handleAssignedExamsGet(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: AssignedExamsDependencies
): Promise<void> {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
    }

    let context: AssignedExamDiscoveryContext | null = null;
    try {
        context = deps.getAssignedExamDiscoveryContext(req);
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
                p.id as participant_id,
                i.id as exam_instance_id,
                s.display_label as subject_label,
                r.display_label as room_label,
                a.id as attempt_id,
                sub.submitted_at as submitted_at
            FROM secure_assessment_exam_participants p
            JOIN secure_assessment_exam_instances i
                ON i.id = p.exam_instance_id AND i.tenant_id = p.tenant_id
            LEFT JOIN academic_core_teaching_assignments ta
                ON ta.id = i.teaching_assignment_id AND ta.tenant_id = p.tenant_id
            LEFT JOIN academic_core_subject_offerings so
                ON so.id = ta.subject_offering_id AND so.tenant_id = p.tenant_id
            LEFT JOIN academic_core_subjects s
                ON s.id = so.subject_id AND s.tenant_id = p.tenant_id
            LEFT JOIN secure_assessment_exam_participant_room_assignments pra
                ON pra.exam_participant_id = p.id AND pra.exam_instance_id = i.id AND pra.tenant_id = p.tenant_id
            LEFT JOIN secure_assessment_exam_rooms r
                ON r.id = pra.exam_room_id AND r.tenant_id = p.tenant_id
            LEFT JOIN secure_assessment_exam_attempts a
                ON a.exam_participant_id = p.id AND a.tenant_id = p.tenant_id
            LEFT JOIN secure_assessment_exam_submissions sub
                ON sub.exam_attempt_id = a.id AND sub.tenant_id = p.tenant_id
            WHERE p.tenant_id = $1 AND p.person_id = $2
            ORDER BY p.created_at ASC, i.id ASC, a.created_at ASC, a.id ASC
        `;

        const queryResult = await client.query(query, [context.tenantId, context.personId]);
        await client.query('COMMIT');

        const assignmentsMap = new Map<string, AssignedExamProjection>();

        for (const row of queryResult.rows) {
            const participantKey = row.participant_id;
            let item = assignmentsMap.get(participantKey);
            if (!item) {
                item = {
                    examInstanceId: row.exam_instance_id,
                    subjectLabel: row.subject_label ?? null,
                    roomLabel: row.room_label ?? null,
                    attempts: []
                };
                assignmentsMap.set(participantKey, item);
            }
            if (row.attempt_id) {
                let submittedAtIso: string | null = null;
                if (row.submitted_at) {
                    submittedAtIso = row.submitted_at instanceof Date
                        ? row.submitted_at.toISOString()
                        : new Date(row.submitted_at).toISOString();
                }
                item.attempts.push({
                    attemptId: row.attempt_id,
                    submittedAt: submittedAtIso
                });
            }
        }

        const responseBody: AssignedExamsResponse = {
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
