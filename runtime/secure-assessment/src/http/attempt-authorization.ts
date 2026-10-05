import type * as http from 'node:http';
import type * as pg from 'pg';
import type { AuthorizedAssessmentContext } from '../answer.ts';
import { AuthenticationError, buildAuthenticatedContext } from './authenticated-context.ts';
import type { SessionCookieConfig } from './session-credentials.ts';

// Production authorization for attempt-scoped routes. The caller may act on an Exam
// Attempt only when the attempt belongs to an Exam Participant whose person is the
// Person of the authenticated session, inside the requested tenant (D04.4-17, D04.5-01).
// Seeing an attempt id is never authority by itself (D04.4-19).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createAttemptAuthorizer(pool: pg.Pool, cookie: SessionCookieConfig) {
    return async function authorizeAttempt(
        req: http.IncomingMessage,
        attemptId: string
    ): Promise<AuthorizedAssessmentContext | null> {
        const membership = await buildAuthenticatedContext(req, pool, { cookie });
        if (!membership) {
            throw new AuthenticationError(403, 'forbidden');
        }
        if (!UUID_REGEX.test(attemptId)) {
            return null;
        }
        let result: pg.QueryResult;
        try {
            result = await pool.query(
                `SELECT a.id
                 FROM secure_assessment_exam_attempts a
                 JOIN secure_assessment_exam_participants p
                   ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
                 WHERE a.id = $1 AND a.tenant_id = $2 AND p.person_id = $3`,
                [attemptId, membership.tenantId, membership.personId]
            );
        } catch {
            throw new AuthenticationError(503, 'persistence_unavailable');
        }
        if (result.rows.length !== 1) {
            return null;
        }
        return { tenantId: membership.tenantId, authorizedAttemptId: attemptId };
    };
}
