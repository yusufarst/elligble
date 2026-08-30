import type { Pool } from 'pg';

export interface ProctorAuthorizationInput {
    tenantId: string;
    examInstanceId: string;
    personId: string;
}

export interface AuthorizedProctorContext {
    tenantId: string;
    examInstanceId: string;
    personId: string;
    proctorAssignmentId: string;
}

export type ProctorAuthorizationResult =
    | { status: 'authorized'; context: AuthorizedProctorContext }
    | { status: 'denied' }
    | { status: 'authorization_unavailable' };

export async function authorizeExplicitProctorAssignment(
    pool: Pool,
    input: ProctorAuthorizationInput
): Promise<ProctorAuthorizationResult> {
    if (!input.tenantId || !input.examInstanceId || !input.personId) {
        return { status: 'denied' };
    }

    try {
        const query = `
            SELECT id
            FROM secure_assessment_proctor_assignments
            WHERE tenant_id = $1
              AND exam_instance_id = $2
              AND person_id = $3
              AND revoked_at IS NULL
        `;

        const result = await pool.query(query, [
            input.tenantId,
            input.examInstanceId,
            input.personId
        ]);

        if (result.rows.length === 0) {
            return { status: 'denied' };
        }

        // According to our schema, multiple active assignments for the exact same tenant, exam instance,
        // and person are prevented by a unique index (uq_sa_proctor_assignment_active).
        // Therefore, rows.length is exactly 1 here.
        const assignmentId = result.rows[0].id;

        return {
            status: 'authorized',
            context: {
                tenantId: input.tenantId,
                examInstanceId: input.examInstanceId,
                personId: input.personId,
                proctorAssignmentId: assignmentId
            }
        };
    } catch (err) {
        // Any database failure (connection, query syntax, pool exhausted) means authorization is unavailable,
        // it must never default to 'authorized'. We also do not leak credentials/errors.
        return { status: 'authorization_unavailable' };
    }
}
