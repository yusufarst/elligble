import type * as http from 'node:http';
import type * as pg from 'pg';
import type { AnswerDependencies } from './answer.ts';
import { HttpError, readJsonObject, sendError, sendJson } from './http/http-utils.ts';

// "Ragu-ragu / Tandai" (D04.5-33/34/35): the student marks a question for their own review.
// The mark is stored apart from the answer and never changes it. Like an answer it can only
// be written by the attempt's active exam session while the attempt is open: not after
// submission and not after the time ran out. The request carries the desired state, so a
// retry or a repeat is harmless (the last write wins; one active session writes at a time).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleReviewFlag(req: http.IncomingMessage, res: http.ServerResponse, deps: AnswerDependencies): Promise<void> {
    if (req.method !== 'POST') {
        sendError(res, 405, 'method_not_allowed');
        return;
    }
    const context = deps.getAuthorizedContext(req);
    if (!context) {
        sendError(res, 403, 'forbidden');
        return;
    }
    let body: Record<string, unknown>;
    try {
        body = await readJsonObject(req);
    } catch (err) {
        sendError(res, err instanceof HttpError ? err.statusCode : 400, err instanceof HttpError ? err.message : 'invalid_request');
        return;
    }
    const { attemptId, sessionId, snapshotId, flagged } = body;
    if (typeof attemptId !== 'string' || !UUID_REGEX.test(attemptId) || typeof sessionId !== 'string' || !UUID_REGEX.test(sessionId)
        || typeof snapshotId !== 'string' || !UUID_REGEX.test(snapshotId) || typeof flagged !== 'boolean') {
        sendError(res, 400, 'invalid_request');
        return;
    }
    if (attemptId !== context.authorizedAttemptId) {
        sendError(res, 403, 'forbidden');
        return;
    }

    let client: pg.PoolClient;
    try {
        client = await deps.pool.connect();
    } catch {
        sendError(res, 503, 'persistence_unavailable');
        return;
    }
    try {
        await client.query('BEGIN');
        // Shares the attempt with other writers but waits for a submission in progress.
        const attempt = await client.query(
            `SELECT p.exam_instance_id FROM secure_assessment_exam_attempts a
             JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
             WHERE a.id = $1 AND a.tenant_id = $2
             FOR SHARE OF a`,
            [attemptId, context.tenantId]
        );
        if (attempt.rows.length !== 1) {
            await client.query('ROLLBACK');
            sendError(res, 404, 'assessment_context_not_found');
            return;
        }
        const session = await client.query(
            'SELECT id FROM secure_assessment_exam_sessions WHERE tenant_id = $1 AND exam_attempt_id = $2 AND activated_at IS NOT NULL AND ended_at IS NULL',
            [context.tenantId, attemptId]
        );
        if (session.rows.length === 0 || session.rows[0].id !== sessionId) {
            await client.query('ROLLBACK');
            sendError(res, 409, 'session_not_active');
            return;
        }
        const snapshot = await client.query(
            'SELECT exam_instance_id FROM secure_assessment_exam_question_snapshots WHERE id = $1 AND tenant_id = $2',
            [snapshotId, context.tenantId]
        );
        if (snapshot.rows.length !== 1 || snapshot.rows[0].exam_instance_id !== attempt.rows[0].exam_instance_id) {
            await client.query('ROLLBACK');
            sendError(res, 404, 'assessment_context_not_found');
            return;
        }
        const state = await client.query(
            `SELECT
                EXISTS (SELECT 1 FROM secure_assessment_exam_submissions s WHERE s.tenant_id = $1 AND s.exam_attempt_id = $2) AS submitted,
                COALESCE((
                    SELECT t.started_at + (t.configured_duration_seconds + COALESCE((
                        SELECT SUM(adj.adjustment_seconds) FROM secure_assessment_timer_adjustments adj
                        WHERE adj.tenant_id = t.tenant_id AND adj.timer_state_id = t.id
                    ), 0)) * interval '1 second' <= statement_timestamp()
                    FROM secure_assessment_timer_state t
                    WHERE t.tenant_id = $1 AND t.exam_attempt_id = $2 AND t.started_at IS NOT NULL
                ), FALSE) AS expired`,
            [context.tenantId, attemptId]
        );
        if (state.rows[0].submitted) {
            await client.query('ROLLBACK');
            sendError(res, 409, 'attempt_already_submitted');
            return;
        }
        if (state.rows[0].expired) {
            await client.query('ROLLBACK');
            sendError(res, 409, 'timer_expired');
            return;
        }
        await client.query(
            `INSERT INTO secure_assessment_review_flags (tenant_id, exam_attempt_id, exam_question_snapshot_id, flagged)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (tenant_id, exam_attempt_id, exam_question_snapshot_id)
             DO UPDATE SET flagged = EXCLUDED.flagged, updated_at = CURRENT_TIMESTAMP`,
            [context.tenantId, attemptId, snapshotId, flagged]
        );
        await client.query('COMMIT');
        sendJson(res, 200, { snapshotId, flagged });
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        sendError(res, 503, 'persistence_unavailable');
    } finally {
        client.release();
    }
}
