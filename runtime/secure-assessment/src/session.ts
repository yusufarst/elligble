import { IncomingMessage, ServerResponse } from 'http';
import { Pool } from 'pg';
import type { AuthorizedAssessmentContext } from './answer.ts';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(uuid: any): boolean {
  return typeof uuid === 'string' && uuidRegex.test(uuid);
}

export async function handleSessionActivate(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: AuthorizedAssessmentContext,
  pool: Pool
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return resolve();
      }

      const { attemptId, sessionId, expectedActiveSessionId } = parsed;

      if (parsed.confirmSupersede !== undefined && typeof parsed.confirmSupersede !== 'boolean') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return resolve();
      }
      const confirmSupersede = parsed.confirmSupersede === true;

      if (!isValidUUID(attemptId) || !isValidUUID(sessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return resolve();
      }

      if (attemptId !== ctx.authorizedAttemptId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return resolve();
      }

      if (confirmSupersede && !isValidUUID(expectedActiveSessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request' }));
        return resolve();
      }

      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Lock Attempt
        const attemptRes = await client.query(
          'SELECT id FROM secure_assessment_exam_attempts WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
          [attemptId, ctx.tenantId]
        );
        if (attemptRes.rows.length === 0) {
          await client.query('ROLLBACK');
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'assessment_context_not_found' }));
          return resolve();
        }

        // 2. Check Submission
        const subRes = await client.query(
          'SELECT id FROM secure_assessment_exam_submissions WHERE exam_attempt_id = $1 AND tenant_id = $2',
          [attemptId, ctx.tenantId]
        );
        if (subRes.rows.length > 0) {
          await client.query('ROLLBACK');
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'attempt_already_submitted' }));
          return resolve();
        }

        // 3. Read Target Session
        const targetRes = await client.query(
          'SELECT id, exam_attempt_id, activated_at, ended_at, superseded_by_session_id FROM secure_assessment_exam_sessions WHERE id = $1 AND tenant_id = $2',
          [sessionId, ctx.tenantId]
        );
        let targetSession = null;
        if (targetRes.rows.length > 0) {
          targetSession = targetRes.rows[0];
          if (targetSession.exam_attempt_id !== attemptId) {
            await client.query('ROLLBACK');
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'session_not_activatable' }));
            return resolve();
          }
          if (targetSession.ended_at !== null || targetSession.superseded_by_session_id !== null) {
            await client.query('ROLLBACK');
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'session_not_activatable' }));
            return resolve();
          }
        }

        // 4. Read Current Active Session
        const activeRes = await client.query(
          'SELECT id, activated_at FROM secure_assessment_exam_sessions WHERE exam_attempt_id = $1 AND tenant_id = $2 AND activated_at IS NOT NULL AND ended_at IS NULL',
          [attemptId, ctx.tenantId]
        );
        const currentActive = activeRes.rows.length > 0 ? activeRes.rows[0] : null;

        // 5. Idempotent Retry
        if (currentActive && currentActive.id === sessionId) {
          await client.query('ROLLBACK');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'active',
            sessionId: currentActive.id,
            activatedAt: currentActive.activated_at.toISOString()
          }));
          return resolve();
        }

        if (!currentActive) {
          const timeRes = await client.query('SELECT statement_timestamp() AS ts');
          const ts = timeRes.rows[0].ts;
          // First Activation
          if (targetSession) {
            await client.query(
              'UPDATE secure_assessment_exam_sessions SET activated_at = $1 WHERE id = $2 AND tenant_id = $3 AND exam_attempt_id = $4',
              [ts, sessionId, ctx.tenantId, attemptId]
            );
          } else {
            await client.query(
              'INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id, activated_at) VALUES ($1, $2, $3, $4)',
              [sessionId, ctx.tenantId, attemptId, ts]
            );
          }
          await client.query('COMMIT');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'active',
            sessionId,
            activatedAt: ts.toISOString()
          }));
          return resolve();
        } else {
          // Another Session Active
          if (confirmSupersede !== true) {
            await client.query('ROLLBACK');
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'active_session_exists',
              activeSessionId: currentActive.id
            }));
            return resolve();
          }

          if (currentActive.id !== expectedActiveSessionId) {
            await client.query('ROLLBACK');
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'active_session_changed' }));
            return resolve();
          }

          const timeRes = await client.query('SELECT statement_timestamp() AS ts');
          const ts = timeRes.rows[0].ts;

          // Confirmed Supersession
          if (!targetSession) {
            await client.query(
              'INSERT INTO secure_assessment_exam_sessions (id, tenant_id, exam_attempt_id) VALUES ($1, $2, $3)',
              [sessionId, ctx.tenantId, attemptId]
            );
          }
          await client.query(
            'UPDATE secure_assessment_exam_sessions SET ended_at = $1, superseded_by_session_id = $2 WHERE id = $3 AND tenant_id = $4 AND exam_attempt_id = $5',
            [ts, sessionId, currentActive.id, ctx.tenantId, attemptId]
          );
          await client.query(
            'UPDATE secure_assessment_exam_sessions SET activated_at = $1 WHERE id = $2 AND tenant_id = $3 AND exam_attempt_id = $4',
            [ts, sessionId, ctx.tenantId, attemptId]
          );
          await client.query('COMMIT');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'active',
            sessionId,
            activatedAt: ts.toISOString(),
            supersededSessionId: currentActive.id
          }));
          return resolve();
        }

      } catch (err) {
        if (client) {
          await client.query('ROLLBACK').catch(() => {});
        }
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'persistence_unavailable' }));
        return resolve();
      } finally {
        if (client) {
          client.release();
        }
      }
    });
  });
}
