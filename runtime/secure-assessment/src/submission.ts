import * as http from 'node:http';
import * as pg from 'pg';
import { type AuthorizedAssessmentContext } from './answer.ts';

export interface SubmissionDependencies {
    pool: pg.Pool;
    getAuthorizedContext: (req: http.IncomingMessage) => AuthorizedAssessmentContext | null;
}

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

async function executeSubmissionInsertion(client: pg.PoolClient, tenantId: string, attemptId: string): Promise<{ submissionId: string, submittedAt: string } | null> {
    const insertRes = await client.query(
        `INSERT INTO secure_assessment_exam_submissions
        (tenant_id, exam_attempt_id)
        VALUES ($1, $2)
        ON CONFLICT (tenant_id, exam_attempt_id)
        DO NOTHING
        RETURNING id, submitted_at`,
        [tenantId, attemptId]
    );

    if (insertRes.rows.length > 0) {
        return {
            submissionId: insertRes.rows[0].id,
            submittedAt: insertRes.rows[0].submitted_at.toISOString()
        };
    }

    const reReadRes = await client.query(
        'SELECT id, submitted_at FROM secure_assessment_exam_submissions WHERE tenant_id = $1 AND exam_attempt_id = $2',
        [tenantId, attemptId]
    );

    if (reReadRes.rows.length === 0) {
        return null;
    }

    return {
        submissionId: reReadRes.rows[0].id,
        submittedAt: reReadRes.rows[0].submitted_at.toISOString()
    };
}

export async function handleSubmit(req: http.IncomingMessage, res: http.ServerResponse, deps: SubmissionDependencies) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
    }



    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        let payload;
        try {
            payload = JSON.parse(body);
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
            return;
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
            return;
        }

        if (!payload.attemptId || !isValidUUID(payload.attemptId)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
            return;
        }
        const attemptId = payload.attemptId;

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
            let attemptRes;
            try {
                await client.query('BEGIN');
                attemptRes = await client.query(
                    'SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
                    [attemptId, context.tenantId]
                );
            } catch (err) {
                try { await client.query('ROLLBACK'); } catch (rollbackErr) { }
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'persistence_unavailable' }));
                return;
            }

            if (attemptRes.rows.length === 0) {
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackErr) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'persistence_unavailable' }));
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                return;
            }

            let result;
            try {
                result = await executeSubmissionInsertion(client, context.tenantId, attemptId);
            } catch (err) {
                try { await client.query('ROLLBACK'); } catch (rollbackErr) { }
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'persistence_unavailable' }));
                return;
            }

            if (!result) {
                try { await client.query('ROLLBACK'); } catch (rollbackErr) { }
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'internal_error' }));
                return;
            }

            try {
                await client.query('COMMIT');
            } catch (err) {
                try { await client.query('ROLLBACK'); } catch (rollbackErr) { }
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'persistence_unavailable' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'submitted',
                submissionId: result.submissionId,
                submittedAt: result.submittedAt
            }));
            return;

        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'internal_error' }));
        } finally {
            client.release();
        }
    });
}

export async function handleSubmissionGet(req: http.IncomingMessage, res: http.ServerResponse, deps: SubmissionDependencies) {
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
        let attemptRes;
        try {
            attemptRes = await client.query(
                'SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 AND tenant_id = $2',
                [attemptId, context.tenantId]
            );
        } catch (err) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'persistence_unavailable' }));
            return;
        }

        if (attemptRes.rows.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
            return;
        }

        let submissionRes;
        try {
            submissionRes = await client.query(
                'SELECT id, submitted_at FROM secure_assessment_exam_submissions WHERE tenant_id = $1 AND exam_attempt_id = $2',
                [context.tenantId, attemptId]
            );
        } catch (err) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'persistence_unavailable' }));
            return;
        }

        if (submissionRes.rows.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'not_submitted' }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'submitted',
            submissionId: submissionRes.rows[0].id,
            submittedAt: submissionRes.rows[0].submitted_at.toISOString()
        }));

    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
    } finally {
        client.release();
    }
}

export async function handleExpiryFinalize(req: http.IncomingMessage, res: http.ServerResponse, deps: SubmissionDependencies) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        let payload;
        try {
            payload = JSON.parse(body);
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
            return;
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
            return;
        }

        if (!payload.attemptId || !isValidUUID(payload.attemptId)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
            return;
        }
        const attemptId = payload.attemptId;

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
            await client.query('BEGIN');

            const attemptRes = await client.query(
                'SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
                [attemptId, context.tenantId]
            );

            if (attemptRes.rows.length === 0) {
                await client.query('ROLLBACK');
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                return;
            }

            const submissionRes = await client.query(
                'SELECT id, submitted_at FROM secure_assessment_exam_submissions WHERE tenant_id = $1 AND exam_attempt_id = $2',
                [context.tenantId, attemptId]
            );

            if (submissionRes.rows.length > 0) {
                await client.query('ROLLBACK');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'submitted',
                    submissionId: submissionRes.rows[0].id,
                    submittedAt: submissionRes.rows[0].submitted_at.toISOString()
                }));
                return;
            }

            const stateRes = await client.query(`
                SELECT
                    t.id,
                    t.started_at,
                    t.configured_duration_seconds,
                    COALESCE((SELECT SUM(adjustment_seconds) FROM secure_assessment_timer_adjustments WHERE tenant_id = $1 AND timer_state_id = t.id), 0) as total_adjustment,
                    FLOOR(EXTRACT(EPOCH FROM (statement_timestamp() - t.started_at)))::integer as elapsed_seconds
                FROM secure_assessment_timer_state t
                WHERE t.tenant_id = $1 AND t.exam_attempt_id = $2
            `, [context.tenantId, attemptId]);

            if (stateRes.rows.length === 0) {
                await client.query('ROLLBACK');
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'internal_error' }));
                return;
            }

            const state = stateRes.rows[0];
            if (!state.started_at) {
                await client.query('ROLLBACK');
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'timer_not_started' }));
                return;
            }

            const configuredDurationSeconds = parseInt(state.configured_duration_seconds, 10);
            const totalAdjustment = parseInt(state.total_adjustment, 10);
            const elapsedSeconds = state.elapsed_seconds || 0;

            const effectiveDurationSeconds = configuredDurationSeconds + totalAdjustment;
            const effectiveRemainingSeconds = Math.max(0, effectiveDurationSeconds - elapsedSeconds);

            if (effectiveRemainingSeconds > 0) {
                await client.query('ROLLBACK');
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'timer_not_expired' }));
                return;
            }

            const result = await executeSubmissionInsertion(client, context.tenantId, attemptId);

            if (!result) {
                await client.query('ROLLBACK');
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'internal_error' }));
                return;
            }

            await client.query('COMMIT');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'submitted',
                submissionId: result.submissionId,
                submittedAt: result.submittedAt
            }));

        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (rollbackErr) { }
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'internal_error' }));
        } finally {
            client.release();
        }
    });
}
