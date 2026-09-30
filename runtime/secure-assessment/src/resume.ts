import * as http from 'node:http';
import * as pg from 'pg';
import { type AuthorizedAssessmentContext } from './answer.ts';
import { readAttemptExamState } from './exam-pause.ts';

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
    // The caller's own exam session id (kept per browser tab). The active session id is
    // never returned: knowing it is what lets a device write answers (D04.4-32/35/37).
    const callerExamSessionId = parsedUrl.searchParams.get('examSessionId');

    if (!attemptId || !isValidUUID(attemptId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return;
    }
    if (callerExamSessionId !== null && !isValidUUID(callerExamSessionId)) {
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
        let attemptRes, sessionRes, answersRes, timerRes, submissionRes, contextProjectionRes, reviewFlagsRes, examState;
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

            sessionRes = await client.query(
                'SELECT id, activated_at FROM secure_assessment_exam_sessions WHERE tenant_id = $1 AND exam_attempt_id = $2 AND activated_at IS NOT NULL AND ended_at IS NULL',
                [context.tenantId, attemptId]
            );

            if (sessionRes.rows.length > 1) {
                await client.query('ROLLBACK');
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'internal_error' }));
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
                    secure_assessment_attempt_elapsed_seconds(t.tenant_id, t.exam_attempt_id, CURRENT_TIMESTAMP) as elapsed_seconds,
                    statement_timestamp() as db_now
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

            contextProjectionRes = await client.query(`
                SELECT 
                    s.display_label as "subjectLabel",
                    r.display_label as "roomLabel"
                FROM secure_assessment_exam_attempts a
                JOIN secure_assessment_exam_participants p 
                  ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
                JOIN secure_assessment_exam_instances i
                  ON i.id = p.exam_instance_id AND i.tenant_id = a.tenant_id
                LEFT JOIN academic_core_teaching_assignments ta
                  ON ta.id = i.teaching_assignment_id AND ta.tenant_id = a.tenant_id
                LEFT JOIN academic_core_subject_offerings so
                  ON so.id = ta.subject_offering_id AND so.tenant_id = a.tenant_id
                LEFT JOIN academic_core_subjects s
                  ON s.id = so.subject_id AND s.tenant_id = a.tenant_id
                LEFT JOIN secure_assessment_exam_participant_room_assignments pra
                  ON pra.exam_participant_id = p.id AND pra.exam_instance_id = i.id AND pra.tenant_id = a.tenant_id
                LEFT JOIN secure_assessment_exam_rooms r
                  ON r.id = pra.exam_room_id AND r.tenant_id = a.tenant_id
                WHERE a.id = $1 AND a.tenant_id = $2
            `, [attemptId, context.tenantId]);

            // Whether the exam is paused (time frozen) or ended (Owner decision 2026-09-30).
            examState = await readAttemptExamState(client, context.tenantId, attemptId, { lock: false });

            // "Ragu-ragu" marks: the student's own navigation aid, kept apart from answers (D04.5-35).
            reviewFlagsRes = await client.query(
                `SELECT exam_question_snapshot_id AS "snapshotId" FROM secure_assessment_review_flags
                 WHERE tenant_id = $1 AND exam_attempt_id = $2 AND flagged
                 ORDER BY exam_question_snapshot_id ASC`,
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
            let sessionResponse: any = { status: 'none' };
            if (sessionRes.rows.length === 1) {
                sessionResponse = {
                    status: 'active',
                    activatedAt: sessionRes.rows[0].activated_at.toISOString(),
                    ownedByCaller: callerExamSessionId !== null && sessionRes.rows[0].id === callerExamSessionId
                };
            }

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

            const projection = contextProjectionRes.rows[0];
            const contextData = {
                subjectLabel: projection?.subjectLabel || null,
                roomLabel: projection?.roomLabel || null
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                attemptId,
                session: sessionResponse,
                answers,
                timer: timerResponse,
                submission: submissionResponse,
                context: contextData,
                reviewFlags: (reviewFlagsRes.rows ?? []).map(row => row.snapshotId as string),
                exam: {
                    lifecycleState: examState?.lifecycleState ?? null,
                    pausedAt: examState?.pausedAt ? examState.pausedAt.toISOString() : null
                },
                serverTime: new Date(timer.db_now ?? Date.now()).toISOString()
            }));
        } catch (appErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'internal_error' }));
        }

    } finally {
        client.release();
    }
}
