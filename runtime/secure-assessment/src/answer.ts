import * as http from 'node:http';
import * as pg from 'pg';
import { isDeepStrictEqual } from 'node:util';

export interface AuthorizedAssessmentContext {
    tenantId: string;
    authorizedAttemptId: string;
}

export interface SaveAnswerRequest {
    attemptId: string;
    snapshotId: string;
    answerPayload: any;
    clientWriteIdentity: string;
    expectedWriteVersion: number | null;
}

export interface AnswerDependencies {
    pool: pg.Pool;
    getAuthorizedContext: (req: http.IncomingMessage) => AuthorizedAssessmentContext | null;
}

function isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export async function handleSaveAnswer(req: http.IncomingMessage, res: http.ServerResponse, deps: AnswerDependencies) {
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

            if (!payload.attemptId || !isValidUUID(payload.attemptId)) throw new Error('invalid attemptId');
            if (!payload.snapshotId || !isValidUUID(payload.snapshotId)) throw new Error('invalid snapshotId');
            if (payload.answerPayload === undefined || payload.answerPayload === null) throw new Error('invalid answerPayload');

            if (typeof payload.clientWriteIdentity !== 'string') throw new Error('invalid clientWriteIdentity');
            if (payload.clientWriteIdentity.length < 1 || payload.clientWriteIdentity.length > 255) throw new Error('invalid clientWriteIdentity length');

            if (payload.expectedWriteVersion !== null && payload.expectedWriteVersion !== undefined) {
                if (typeof payload.expectedWriteVersion !== 'number') throw new Error('invalid expectedWriteVersion type');
                if (!Number.isInteger(payload.expectedWriteVersion)) throw new Error('invalid expectedWriteVersion fractional');
                if (payload.expectedWriteVersion <= 0) throw new Error('invalid expectedWriteVersion negative');
                if (payload.expectedWriteVersion > 2147483647) throw new Error('invalid expectedWriteVersion > max');
            } else {
                payload.expectedWriteVersion = null;
            }

            const attemptId = payload.attemptId;
            const snapshotId = payload.snapshotId;
            const answerPayload = payload.answerPayload;
            const clientWriteIdentity = payload.clientWriteIdentity;
            const expectedWriteVersion = payload.expectedWriteVersion;

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
                    'SELECT id, exam_participant_id FROM secure_assessment_exam_attempts WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
                    [attemptId, context.tenantId]
                );
                if (attemptRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                    return;
                }

                const snapshotRes = await client.query(
                    'SELECT id, exam_instance_id FROM secure_assessment_exam_question_snapshots WHERE id = $1 AND tenant_id = $2',
                    [snapshotId, context.tenantId]
                );
                if (snapshotRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
                    return;
                }

                const participantRes = await client.query(
                    'SELECT exam_instance_id FROM secure_assessment_exam_participants WHERE id = $1 AND tenant_id = $2',
                    [attemptRes.rows[0].exam_participant_id, context.tenantId]
                );
                if (participantRes.rows.length === 0 || participantRes.rows[0].exam_instance_id !== snapshotRes.rows[0].exam_instance_id) {
                    await client.query('ROLLBACK');
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'assessment_context_conflict' }));
                    return;
                }

                const submissionRes = await client.query(
                    'SELECT id FROM secure_assessment_exam_submissions WHERE tenant_id = $1 AND exam_attempt_id = $2',
                    [context.tenantId, attemptId]
                );
                const isSubmitted = submissionRes.rows.length > 0;

                let isExpired = false;
                const timerRes = await client.query(`
                    SELECT
                        t.started_at,
                        t.configured_duration_seconds,
                        COALESCE((SELECT SUM(adjustment_seconds) FROM secure_assessment_timer_adjustments WHERE tenant_id = $1 AND timer_state_id = t.id), 0) as total_adjustment,
                        FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.started_at)))::integer as elapsed_seconds
                    FROM secure_assessment_timer_state t
                    WHERE t.tenant_id = $1 AND t.exam_attempt_id = $2
                `, [context.tenantId, attemptId]);

                if (timerRes.rows.length > 0) {
                    const tState = timerRes.rows[0];
                    if (tState.started_at) {
                        const configured = parseInt(tState.configured_duration_seconds, 10);
                        const adj = parseInt(tState.total_adjustment, 10);
                        const elapsed = tState.elapsed_seconds || 0;
                        if ((configured + adj) - elapsed <= 0) {
                            isExpired = true;
                        }
                    }
                }

                const checkTerminalState = async () => {
                    if (isSubmitted) {
                        await client.query('ROLLBACK');
                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'attempt_already_submitted' }));
                        return true;
                    }
                    if (isExpired) {
                        await client.query('ROLLBACK');
                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'timer_expired' }));
                        return true;
                    }
                    return false;
                };

                const currentAnswerRes = await client.query(
                    'SELECT client_write_identity, write_version, answer_payload FROM secure_assessment_exam_answers WHERE tenant_id = $1 AND exam_attempt_id = $2 AND exam_question_snapshot_id = $3 FOR UPDATE',
                    [context.tenantId, attemptId, snapshotId]
                );

                if (currentAnswerRes.rows.length === 0) {
                    if (await checkTerminalState()) return;

                    if (expectedWriteVersion !== null) {
                        await client.query('ROLLBACK');
                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'stale_write_version' }));
                        return;
                    }

                    try {
                        const insertRes = await client.query(
                            `INSERT INTO secure_assessment_exam_answers
                            (tenant_id, exam_attempt_id, exam_question_snapshot_id, answer_payload, client_write_identity, write_version)
                            VALUES ($1, $2, $3, $4, $5, $6)
                            ON CONFLICT (tenant_id, exam_attempt_id, exam_question_snapshot_id) DO NOTHING
                            RETURNING write_version`,
                            [context.tenantId, attemptId, snapshotId, JSON.stringify(answerPayload), clientWriteIdentity, 1]
                        );

                        if (insertRes.rows.length > 0) {
                            await client.query('COMMIT');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'acknowledged', clientWriteIdentity, writeVersion: insertRes.rows[0].write_version }));
                            return;
                        }

                        // Collision occurred, row exists. Re-read and reclassify.
                        const reReadRes = await client.query(
                            'SELECT client_write_identity, write_version, answer_payload FROM secure_assessment_exam_answers WHERE tenant_id = $1 AND exam_attempt_id = $2 AND exam_question_snapshot_id = $3 FOR UPDATE',
                            [context.tenantId, attemptId, snapshotId]
                        );

                        if (reReadRes.rows.length === 0) {
                            await client.query('ROLLBACK');
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'internal_error' }));
                            return;
                        }

                        const current = reReadRes.rows[0];

                        if (current.client_write_identity === clientWriteIdentity) {
                            if (isDeepStrictEqual(current.answer_payload, answerPayload)) {
                                await client.query('ROLLBACK');
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: current.client_write_identity, writeVersion: current.write_version }));
                                return;
                            } else {
                                if (await checkTerminalState()) return;
                                await client.query('ROLLBACK');
                                res.writeHead(409, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'write_identity_reuse_conflict' }));
                                return;
                            }
                        } else {
                            if (await checkTerminalState()) return;
                            await client.query('ROLLBACK');
                            res.writeHead(409, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'stale_write_version' }));
                            return;
                        }
                    } catch (err: any) {
                        await client.query('ROLLBACK');
                        throw err;
                    }
                    return;
                }

                const current = currentAnswerRes.rows[0];

                if (current.client_write_identity === clientWriteIdentity) {
                    if (isDeepStrictEqual(current.answer_payload, answerPayload)) {
                        await client.query('ROLLBACK');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: current.client_write_identity, writeVersion: current.write_version }));
                        return;
                    } else {
                        if (await checkTerminalState()) return;
                        await client.query('ROLLBACK');
                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'write_identity_reuse_conflict' }));
                        return;
                    }
                } else {
                    if (await checkTerminalState()) return;
                    if (expectedWriteVersion !== current.write_version) {
                        await client.query('ROLLBACK');
                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'stale_write_version' }));
                        return;
                    }

                    const updateRes = await client.query(
                        'UPDATE secure_assessment_exam_answers SET answer_payload = $1, client_write_identity = $2, write_version = write_version + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $3 AND exam_attempt_id = $4 AND exam_question_snapshot_id = $5 RETURNING write_version',
                        [JSON.stringify(answerPayload), clientWriteIdentity, context.tenantId, attemptId, snapshotId]
                    );

                    await client.query('COMMIT');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'acknowledged', clientWriteIdentity, writeVersion: updateRes.rows[0].write_version }));
                    return;
                }

            } catch (err: any) {
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackErr) {
                    // Ignore rollback failure
                }
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'persistence_unavailable' }));
                return;
            } finally {
                client.release();
            }

        } catch (err: any) {
            if (err instanceof SyntaxError || (err && err.message && err.message.startsWith('invalid'))) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid_request' }));
                return;
            }

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'internal_error' }));
        }
    });
}
