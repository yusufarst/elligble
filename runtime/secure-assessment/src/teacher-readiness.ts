import * as http from 'node:http';
import * as pg from 'pg';
import {
    checkExamInstanceBaselineReadinessChecksCompositionPreflight,
    BaselineReadinessChecksCompositionResult
} from './exam-instance-baseline-readiness-checks-composition-preflight.ts';
import {
    checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight,
    ConditionalRoomProctorReadinessCompositionResult
} from './exam-instance-conditional-room-proctor-readiness-composition-preflight.ts';

export interface TeacherReadinessContext {
    tenantId: string;
    personId: string;
}

export interface TeacherReadinessDependencies {
    pool: pg.Pool;
    getTeacherReadinessContext?: (req: http.IncomingMessage) => TeacherReadinessContext | null;
}

export interface TeacherExamReadinessProjection {
    examInstanceId: string;
    subjectLabel: string | null;
    baseline: BaselineReadinessChecksCompositionResult;
    roomProctor: ConditionalRoomProctorReadinessCompositionResult;
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

        const query = `
            SELECT
                i.id AS exam_instance_id,
                s.display_label AS subject_label
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
               AND i.lifecycle_state = 'SCHEDULED'
            LEFT JOIN academic_core_subject_offerings so
                ON so.id = ata.subject_offering_id AND so.tenant_id = ata.tenant_id
            LEFT JOIN academic_core_subjects s
                ON s.id = so.subject_id AND s.tenant_id = ata.tenant_id
            WHERE tm.tenant_id = $1
              AND tm.person_id = $2
            ORDER BY i.id ASC
        `;

        const queryResult = await client.query(query, [context.tenantId, context.personId]);

        const exams: TeacherExamReadinessProjection[] = [];

        for (const row of queryResult.rows) {
            const examInstanceId = row.exam_instance_id;

            const baseline = await checkExamInstanceBaselineReadinessChecksCompositionPreflight(
                client,
                context.tenantId,
                examInstanceId,
                async () => 'granted' as const
            );

            const roomProctor = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
                client,
                context.tenantId,
                examInstanceId,
                async () => 'granted' as const
            );

            exams.push({
                examInstanceId,
                subjectLabel: row.subject_label ?? null,
                baseline,
                roomProctor
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
