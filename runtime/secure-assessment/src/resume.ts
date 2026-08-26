import * as http from 'node:http';
import * as pg from 'pg';
import { type AuthorizedAssessmentContext } from './answer.ts';

export interface ResumeDependencies {
    pool: pg.Pool;
    getAuthorizedContext: (req: http.IncomingMessage) => AuthorizedAssessmentContext | null;
}

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export async function handleResumeGet(req: http.IncomingMessage, res: http.ServerResponse, deps: ResumeDependencies) {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
    }

    const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const attemptId = parsedUrl.searchParams.get('attemptId');

    if (!attemptId || !isValidUUID(attemptId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return;
    }

    let context;
    try {
        context = deps.getAuthorizedContext(req);
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
        return;
    }

    if (!context) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }

    if (attemptId !== context.authorizedAttemptId) {
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
        let attemptRes, answersRes, timerRes, submissionRes;
        try {
            await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

            attemptRes = await client.query(
                'SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 AND tenant_id = $2',
                [attemptId, context.tenantId]
            );

            if (attemptRes.rows.length === 0) {
                await client.query('ROLLBACK');
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                return;
            }

            answersRes = await client.query(`
                SELECT 
                    exam_question_snapshot_id as "snapshotId", 
                    answer_payload as "answerPayload", 
                    client_write_identity as "clientWriteIdentity", 
                    write_version as "writeVersion", 
                    updated_at as "updatedAt"
                FROM secure_assessment_exam_answers
                WHERE tenant_id = $1 AND exam_attempt_id = $2
                ORDER BY updated_at ASC, exam_question_snapshot_id ASC
            `, [context.tenantId, attemptId]);

            timerRes = await client.query(`
                SELECT
                    t.id,
                    t.started_at,
                    t.configured_duration_seconds,
                    COALESCE((SELECT SUM(adjustment_seconds) FROM secure_assessment_timer_adjustments WHERE tenant_id = $1 AND timer_state_id = t.id), 0) as total_adjustment,
                    FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.started_at)))::integer as elapsed_seconds
                FROM secure_assessment_timer_state t
                WHERE t.tenant_id = $1 AND t.exam_attempt_id = $2
            `, [context.tenantId, attemptId]);

            if (timerRes.rows.length === 0) {
                await client.query('ROLLBACK');
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                return;
            }

            submissionRes = await client.query(
                'SELECT id, submitted_at FROM secure_assessment_exam_submissions WHERE tenant_id = $1 AND exam_attempt_id = $2',
                [context.tenantId, attemptId]
            );

            await client.query('COMMIT');
        } catch (dbErr) {
            try { await client.query('ROLLBACK'); } catch (rollbackErr) { }
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'persistence_unavailable' }));
            return;
        }

        try {
            const answers = answersRes.rows.map(row => ({
                snapshotId: row.snapshotId,
                answerPayload: row.answerPayload,
                clientWriteIdentity: row.clientWriteIdentity,
                writeVersion: parseInt(row.writeVersion, 10),
                updatedAt: row.updatedAt.toISOString()
            }));

            let timerResponse: any = null;
            const timer = timerRes.rows[0];
            if (!timer.started_at) {
                timerResponse = { status: 'not_started' };
            } else {
                const configuredDurationSeconds = parseInt(timer.configured_duration_seconds, 10);
                const totalAdjustment = parseInt(timer.total_adjustment, 10);
                const elapsedSeconds = timer.elapsed_seconds || 0;
                
                const effectiveDurationSeconds = configuredDurationSeconds + totalAdjustment;
                const effectiveRemainingSeconds = Math.max(0, effectiveDurationSeconds - elapsedSeconds);
                
                timerResponse = {
                    status: 'active',
                    startedAt: timer.started_at.toISOString(),
                    configuredDurationSeconds,
                    effectiveDurationSeconds,
                    effectiveRemainingSeconds
                };
            }

            let submissionResponse: any = null;
            if (submissionRes.rows.length === 0) {
                submissionResponse = { status: 'not_submitted' };
            } else {
                submissionResponse = {
                    status: 'submitted',
                    submissionId: submissionRes.rows[0].id,
                    submittedAt: submissionRes.rows[0].submitted_at.toISOString()
                };
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                attemptId,
                answers,
                timer: timerResponse,
                submission: submissionResponse
            }));
        } catch (appErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'internal_error' }));
        }

    } finally {
        client.release();
    }
}
