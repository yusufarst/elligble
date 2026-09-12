import * as http from 'node:http';
import * as pg from 'pg';
import { type AuthorizedAssessmentContext } from './answer.ts';
import { validateBaselineQuestionSnapshotFrozenContent } from './question-snapshot-baseline-frozen-content-contract.ts';

export interface QuestionDeliveryDependencies {
    pool: pg.Pool;
    getAuthorizedContext: (req: http.IncomingMessage) => AuthorizedAssessmentContext | null;
}

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export async function handleQuestionDelivery(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: QuestionDeliveryDependencies
): Promise<void> {
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

    let context: AuthorizedAssessmentContext | null;
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
        let attemptRes: pg.QueryResult;
        let sessionRes: pg.QueryResult;
        let submissionRes: pg.QueryResult;
        let timerRes: pg.QueryResult;
        let snapshotsRes: pg.QueryResult;

        try {
            await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

            // 1. Resolve Attempt -> Exam Participant -> Exam Instance (tenant-scoped)
            attemptRes = await client.query(
                `SELECT
                    a.id AS attempt_id,
                    i.id AS exam_instance_id,
                    i.lifecycle_state
                FROM secure_assessment_exam_attempts a
                JOIN secure_assessment_exam_participants p
                    ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
                JOIN secure_assessment_exam_instances i
                    ON i.id = p.exam_instance_id AND i.tenant_id = a.tenant_id
                WHERE a.id = $1 AND a.tenant_id = $2`,
                [attemptId, context.tenantId]
            );

            if (attemptRes.rows.length === 0) {
                await client.query('ROLLBACK');
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                return;
            }

            const examInstance = attemptRes.rows[0];
            if (examInstance.lifecycle_state !== 'ACTIVE') {
                await client.query('ROLLBACK');
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'exam_not_active' }));
                return;
            }

            // 2. Require active Exam Session: activated_at IS NOT NULL and ended_at IS NULL
            sessionRes = await client.query(
                `SELECT id, activated_at, ended_at
                FROM secure_assessment_exam_sessions
                WHERE tenant_id = $1 AND exam_attempt_id = $2
                  AND activated_at IS NOT NULL AND ended_at IS NULL`,
                [context.tenantId, attemptId]
            );

            if (sessionRes.rows.length === 0) {
                await client.query('ROLLBACK');
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'session_not_active' }));
                return;
            }

            if (sessionRes.rows.length > 1) {
                await client.query('ROLLBACK');
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'internal_error' }));
                return;
            }

            // 3. Require no authoritative Submission
            submissionRes = await client.query(
                `SELECT id FROM secure_assessment_exam_submissions
                WHERE tenant_id = $1 AND exam_attempt_id = $2`,
                [context.tenantId, attemptId]
            );

            if (submissionRes.rows.length > 0) {
                await client.query('ROLLBACK');
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'attempt_already_submitted' }));
                return;
            }

            // 4. Require authoritative timer state
            timerRes = await client.query(
                `SELECT
                    t.id,
                    t.started_at,
                    t.configured_duration_seconds,
                    COALESCE((SELECT SUM(adjustment_seconds) FROM secure_assessment_timer_adjustments WHERE tenant_id = $1 AND timer_state_id = t.id), 0) AS total_adjustment,
                    FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.started_at)))::integer AS elapsed_seconds
                FROM secure_assessment_timer_state t
                WHERE t.tenant_id = $1 AND t.exam_attempt_id = $2`,
                [context.tenantId, attemptId]
            );

            if (timerRes.rows.length === 0) {
                await client.query('ROLLBACK');
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                return;
            }

            const timer = timerRes.rows[0];
            if (timer.started_at === null) {
                await client.query('ROLLBACK');
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'timer_not_started' }));
                return;
            }

            const configuredDurationSeconds = parseInt(timer.configured_duration_seconds, 10);
            const totalAdjustment = parseInt(timer.total_adjustment, 10);
            const elapsedSeconds = timer.elapsed_seconds || 0;
            const effectiveDurationSeconds = configuredDurationSeconds + totalAdjustment;
            const effectiveRemainingSeconds = effectiveDurationSeconds - elapsedSeconds;

            if (effectiveRemainingSeconds <= 0) {
                await client.query('ROLLBACK');
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'timer_expired' }));
                return;
            }

            // 5. Read question snapshots for exact tenant + resolved Exam Instance
            // Deterministic ordering: ORDER BY id ASC
            snapshotsRes = await client.query(
                `SELECT id, frozen_content
                FROM secure_assessment_exam_question_snapshots
                WHERE tenant_id = $1 AND exam_instance_id = $2
                ORDER BY id ASC`,
                [context.tenantId, examInstance.exam_instance_id]
            );

            await client.query('COMMIT');
        } catch (dbErr) {
            try { await client.query('ROLLBACK'); } catch { }
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'persistence_unavailable' }));
            return;
        }

        try {
            const projectedQuestions = [];

            for (const row of snapshotsRes.rows) {
                const validation = validateBaselineQuestionSnapshotFrozenContent(row.frozen_content);
                if (validation.type !== 'baseline_question_snapshot_content_valid') {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'internal_error' }));
                    return;
                }

                const frozen = row.frozen_content as Record<string, unknown>;
                const options = Array.isArray(frozen.options) ? frozen.options : [];

                projectedQuestions.push({
                    snapshotId: row.id,
                    schemaVersion: 1,
                    questionType: 'MULTIPLE_CHOICE_SINGLE',
                    prompt: frozen.prompt,
                    options: options.map((opt: Record<string, unknown>) => ({
                        id: opt.id,
                        content: opt.content
                    }))
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                attemptId,
                questions: projectedQuestions
            }));
        } catch (appErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'internal_error' }));
        }
    } finally {
        client.release();
    }
}
