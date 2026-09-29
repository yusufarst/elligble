import type * as http from 'node:http';
import type * as pg from 'pg';
import { evaluateStartEligibility } from './attempt-eligibility.ts';
import { HttpError, readJsonObject, sendError, sendJson } from './http/http-utils.ts';

// Student entry: creates (or returns) the caller's Exam Attempt for an assigned Exam
// Instance. Idempotent per participant: a retry never creates a second attempt
// (D04.5-02); a submitted attempt is never replaced by a new one (retake needs explicit
// authority, D04.1-12). Eligibility uses database time (D04.2-35).

export interface AttemptStartContext {
    tenantId: string;
    personId: string;
}

export interface AttemptStartDependencies {
    pool: pg.Pool;
    getContext: () => AttemptStartContext;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleAttemptStart(req: http.IncomingMessage, res: http.ServerResponse, deps: AttemptStartDependencies): Promise<void> {
    if (req.method !== 'POST') {
        sendError(res, 405, 'method_not_allowed');
        return;
    }

    let examInstanceId: unknown;
    try {
        examInstanceId = (await readJsonObject(req))['examInstanceId'];
    } catch (err) {
        sendError(res, err instanceof HttpError ? err.statusCode : 400, err instanceof HttpError ? err.message : 'invalid_request');
        return;
    }
    if (typeof examInstanceId !== 'string' || !UUID_REGEX.test(examInstanceId)) {
        sendError(res, 400, 'invalid_request');
        return;
    }

    const context = deps.getContext();
    let client: pg.PoolClient;
    try {
        client = await deps.pool.connect();
    } catch {
        sendError(res, 503, 'persistence_unavailable');
        return;
    }

    try {
        await client.query('BEGIN');

        // Serializes concurrent starts for the same participant.
        const participants = await client.query(
            `SELECT id FROM secure_assessment_exam_participants
             WHERE tenant_id = $1 AND exam_instance_id = $2 AND person_id = $3
             FOR UPDATE`,
            [context.tenantId, examInstanceId, context.personId]
        );
        if (participants.rows.length !== 1) {
            await client.query('ROLLBACK');
            sendError(res, 403, participants.rows.length === 0 ? 'not_participant' : 'forbidden');
            return;
        }
        const participantId = participants.rows[0].id;

        const attempts = await client.query(
            `SELECT a.id, (s.id IS NOT NULL) AS submitted
             FROM secure_assessment_exam_attempts a
             LEFT JOIN secure_assessment_exam_submissions s
               ON s.exam_attempt_id = a.id AND s.tenant_id = a.tenant_id
             WHERE a.tenant_id = $1 AND a.exam_participant_id = $2
             ORDER BY a.created_at ASC, a.id ASC`,
            [context.tenantId, participantId]
        );
        const open = attempts.rows.find(r => !r.submitted);
        if (open) {
            await client.query('COMMIT');
            sendJson(res, 200, { attemptId: open.id, created: false });
            return;
        }
        if (attempts.rows.length > 0) {
            await client.query('ROLLBACK');
            sendError(res, 409, 'attempt_already_submitted');
            return;
        }

        const exam = await client.query(
            `SELECT lifecycle_state, window_starts_at, window_ends_at,
                    configured_attempt_duration_seconds, latest_start_policy,
                    statement_timestamp() AS db_now
             FROM secure_assessment_exam_instances
             WHERE id = $1 AND tenant_id = $2
             FOR SHARE`,
            [examInstanceId, context.tenantId]
        );
        if (exam.rows.length !== 1) {
            await client.query('ROLLBACK');
            sendError(res, 403, 'forbidden');
            return;
        }
        const eligibility = evaluateStartEligibility(exam.rows[0], new Date(exam.rows[0].db_now));
        if (!eligibility.eligible) {
            await client.query('ROLLBACK');
            sendError(res, 409, eligibility.reason);
            return;
        }

        const attempt = await client.query(
            `INSERT INTO secure_assessment_exam_attempts (tenant_id, exam_participant_id)
             VALUES ($1, $2) RETURNING id`,
            [context.tenantId, participantId]
        );
        const attemptId = attempt.rows[0].id;
        // The exam's full configured duration; the latest-start policy is applied again
        // when the timer actually starts.
        await client.query(
            `INSERT INTO secure_assessment_timer_state (tenant_id, exam_attempt_id, configured_duration_seconds)
             VALUES ($1, $2, $3)`,
            [context.tenantId, attemptId, Number(exam.rows[0].configured_attempt_duration_seconds)]
        );
        await client.query('COMMIT');
        sendJson(res, 201, { attemptId, created: true });
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        sendError(res, 503, 'persistence_unavailable');
    } finally {
        client.release();
    }
}
