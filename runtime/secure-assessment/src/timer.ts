import * as http from 'node:http';
import * as pg from 'pg';

import { type AuthorizedAssessmentContext } from './answer.ts';
import { evaluateStartEligibility } from './attempt-eligibility.ts';
import { readAttemptExamState, type AttemptExamState } from './exam-pause.ts';

/** Exam state beside the timer, so the workstation knows whether time is frozen (Owner decision 2026-09-30). */
function examStateFields(state: AttemptExamState | null, dbNow: unknown) {
    return {
        examState: state?.lifecycleState ?? null,
        pausedAt: state?.pausedAt ? state.pausedAt.toISOString() : null,
        serverTime: new Date(dbNow instanceof Date || typeof dbNow === 'string' ? dbNow : Date.now()).toISOString(),
    };
}

export interface TimerDependencies {
    pool: pg.Pool;
    getAuthorizedContext: (req: http.IncomingMessage) => AuthorizedAssessmentContext | null;
}

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export async function handleTimerStart(req: http.IncomingMessage, res: http.ServerResponse, deps: TimerDependencies) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
    }

    const context = deps.getAuthorizedContext(req);
    if (!context) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const payload = JSON.parse(body);

            if (!payload.attemptId || !isValidUUID(payload.attemptId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid_request' }));
                return;
            }
            const attemptId = payload.attemptId;

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
                await client.query('BEGIN');

                const checkRes = await client.query(
                    'SELECT id, started_at FROM secure_assessment_timer_state WHERE tenant_id = $1 AND exam_attempt_id = $2 FOR UPDATE',
                    [context.tenantId, attemptId]
                );

                if (checkRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                    return;
                }

                if (checkRes.rows[0].started_at === null || checkRes.rows[0].started_at === undefined) {
                    // The attempt really begins now: re-validate eligibility with server time
                    // (D04.2-72) and apply the latest-start policy (D04.2-34). An already
                    // started timer is returned unchanged (idempotent start).
                    const examRes = await client.query(`
                        SELECT
                            i.lifecycle_state, i.window_starts_at, i.window_ends_at,
                            i.configured_attempt_duration_seconds, i.latest_start_policy,
                            statement_timestamp() AS db_now,
                            EXISTS (
                                SELECT 1 FROM secure_assessment_exam_submissions sub
                                WHERE sub.tenant_id = a.tenant_id AND sub.exam_attempt_id = a.id
                            ) AS submitted
                        FROM secure_assessment_exam_attempts a
                        JOIN secure_assessment_exam_participants p
                            ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
                        JOIN secure_assessment_exam_instances i
                            ON i.id = p.exam_instance_id AND i.tenant_id = a.tenant_id
                        WHERE a.tenant_id = $1 AND a.id = $2
                        FOR KEY SHARE OF i
                    `, [context.tenantId, attemptId]);

                    if (examRes.rows.length === 0) {
                        await client.query('ROLLBACK');
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                        return;
                    }
                    if (examRes.rows[0].submitted) {
                        await client.query('ROLLBACK');
                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'attempt_already_submitted' }));
                        return;
                    }
                    const eligibility = evaluateStartEligibility(examRes.rows[0], new Date(examRes.rows[0].db_now));
                    if (!eligibility.eligible) {
                        await client.query('ROLLBACK');
                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: eligibility.reason }));
                        return;
                    }

                    await client.query(`
                        UPDATE secure_assessment_timer_state
                        SET started_at = CURRENT_TIMESTAMP,
                            configured_duration_seconds = LEAST(configured_duration_seconds, $3),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE tenant_id = $1 AND exam_attempt_id = $2 AND started_at IS NULL
                    `, [context.tenantId, attemptId, eligibility.effectiveDurationSeconds]);
                }

                const stateRes = await client.query(`
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
                const examState = await readAttemptExamState(client, context.tenantId, attemptId, { lock: false });

                await client.query('COMMIT');

                const state = stateRes.rows[0];
                const startedAt = state.started_at;
                const configuredDurationSeconds = parseInt(state.configured_duration_seconds, 10);
                const totalAdjustment = parseInt(state.total_adjustment, 10);
                const elapsedSeconds = state.elapsed_seconds || 0;

                const effectiveDurationSeconds = configuredDurationSeconds + totalAdjustment;
                const effectiveRemainingSeconds = Math.max(0, effectiveDurationSeconds - elapsedSeconds);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'started',
                    startedAt: startedAt.toISOString(),
                    configuredDurationSeconds,
                    effectiveDurationSeconds,
                    effectiveRemainingSeconds,
                    ...examStateFields(examState, state.db_now)
                }));

            } catch (err) {
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackErr) { }
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'internal_error' }));
            } finally {
                client.release();
            }

        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
        }
    });
}

export async function handleTimerGet(req: http.IncomingMessage, res: http.ServerResponse, deps: TimerDependencies) {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
    }

    const context = deps.getAuthorizedContext(req);
    if (!context) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }

    const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const attemptId = parsedUrl.searchParams.get('attemptId');

    if (!attemptId || !isValidUUID(attemptId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
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
        const stateRes = await client.query(`
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

        if (stateRes.rows.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
            return;
        }

        const state = stateRes.rows[0];
        const startedAt = state.started_at;

        if (!startedAt) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'timer_not_started' }));
            return;
        }

        const configuredDurationSeconds = parseInt(state.configured_duration_seconds, 10);
        const totalAdjustment = parseInt(state.total_adjustment, 10);
        const elapsedSeconds = state.elapsed_seconds || 0;

        const effectiveDurationSeconds = configuredDurationSeconds + totalAdjustment;
        const effectiveRemainingSeconds = Math.max(0, effectiveDurationSeconds - elapsedSeconds);

        const status = effectiveRemainingSeconds <= 0 ? 'expired' : 'active';
        const examState = await readAttemptExamState(client, context.tenantId, attemptId, { lock: false });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status,
            startedAt: startedAt.toISOString(),
            configuredDurationSeconds,
            effectiveDurationSeconds,
            effectiveRemainingSeconds,
            ...examStateFields(examState, state.db_now)
        }));

    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
    } finally {
        client.release();
    }
}
