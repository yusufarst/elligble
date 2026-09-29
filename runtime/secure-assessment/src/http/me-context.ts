import type * as http from 'node:http';
import type * as pg from 'pg';
import { AuthenticationError, buildAuthenticatedContext } from './authenticated-context.ts';
import { sendError, sendJson } from './http-utils.ts';
import type { SessionCookieConfig } from './session-credentials.ts';

// Navigation read model for the selected tenant. It reports which workspaces the Person
// can open, derived only from explicit assignments that the corresponding endpoints
// already enforce (exam participation, active proctor assignment, active teaching
// assignment). It grants nothing by itself and invents no Permission Matrix (PB05 OPEN).

export interface MeContextDependencies {
    pool: pg.Pool;
    cookie: SessionCookieConfig;
}

export interface WorkspaceCapabilities {
    examParticipant: boolean;
    proctor: boolean;
    teacher: boolean;
}

export async function handleMeContextGet(req: http.IncomingMessage, res: http.ServerResponse, deps: MeContextDependencies): Promise<void> {
    if (req.method !== 'GET') {
        sendError(res, 405, 'method_not_allowed');
        return;
    }

    let membership;
    try {
        membership = await buildAuthenticatedContext(req, deps.pool, { cookie: deps.cookie });
    } catch (err) {
        if (err instanceof AuthenticationError) {
            sendError(res, err.statusCode, err.message);
            return;
        }
        sendError(res, 500, 'internal_error');
        return;
    }
    if (!membership) {
        sendError(res, 403, 'forbidden');
        return;
    }

    try {
        const result = await deps.pool.query(`
            SELECT
                t.display_label,
                EXISTS (
                    SELECT 1 FROM secure_assessment_exam_participants p
                    WHERE p.tenant_id = $1 AND p.person_id = $2
                ) AS exam_participant,
                EXISTS (
                    SELECT 1 FROM secure_assessment_proctor_assignments pa
                    WHERE pa.tenant_id = $1 AND pa.person_id = $2 AND pa.revoked_at IS NULL
                ) AS proctor,
                EXISTS (
                    SELECT 1
                    FROM tenant_teacher_assignments tta
                    JOIN academic_core_teaching_assignments ata
                      ON ata.teacher_assignment_id = tta.id
                     AND ata.tenant_id = tta.tenant_id
                     AND ata.revoked_at IS NULL
                    WHERE tta.tenant_id = $1 AND tta.membership_id = $3 AND tta.revoked_at IS NULL
                ) AS teacher
            FROM tenant_tenants t
            WHERE t.id = $1
        `, [membership.tenantId, membership.personId, membership.membershipId]);

        const row = result.rows[0];
        const capabilities: WorkspaceCapabilities = {
            examParticipant: Boolean(row?.exam_participant),
            proctor: Boolean(row?.proctor),
            teacher: Boolean(row?.teacher),
        };
        sendJson(res, 200, {
            tenantId: membership.tenantId,
            tenantDisplayLabel: row?.display_label ?? null,
            capabilities,
        });
    } catch {
        sendError(res, 503, 'persistence_unavailable');
    }
}
