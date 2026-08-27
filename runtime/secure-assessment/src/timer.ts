import * as http from 'node:http';
import * as pg from 'pg';

import { type AuthorizedAssessmentContext } from './answer.ts';

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
                    'SELECT id FROM secure_assessment_timer_state WHERE tenant_id = $1 AND exam_attempt_id = $2 FOR UPDATE',
                    [context.tenantId, attemptId]
                );

                if (checkRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                    return;
                }

                await client.query(`
                    UPDATE secure_assessment_timer_state
                    SET started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE tenant_id = $1 AND exam_attempt_id = $2 AND started_at IS NULL
                `, [context.tenantId, attemptId]);

                const stateRes = await client.query(`
                    SELECT
                        t.id,
                        t.started_at,
                        t.configured_duration_seconds,
                        COALESCE((SELECT SUM(adjustment_seconds) FROM secure_assessment_timer_adjustments WHERE tenant_id = $1 AND timer_state_id = t.id), 0) as total_adjustment,
                        FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.started_at)))::integer as elapsed_seconds
                    FROM secure_assessment_timer_state t
                    WHERE t.tenant_id = $1 AND t.exam_attempt_id = $2
                `, [context.tenantId, attemptId]);

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
                    effectiveRemainingSeconds
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
                FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.started_at)))::integer as elapsed_seconds
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

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status,
            startedAt: startedAt.toISOString(),
            configuredDurationSeconds,
            effectiveDurationSeconds,
            effectiveRemainingSeconds
        }));

    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
    } finally {
        client.release();
    }
}
