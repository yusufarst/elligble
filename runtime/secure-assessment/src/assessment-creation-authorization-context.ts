import { Pool } from 'pg';

export type AssessmentCreationAuthorizationContextResult =
  | { type: 'context_resolved'; context: ResolvedAssessmentCreationContext }
  | { type: 'denied' }
  | { type: 'context_unavailable' };

export interface ResolvedAssessmentCreationContext {
  tenantId: string;
  personId: string;
  membershipId: string;
  teacherAssignmentId: string;
  teachingAssignmentId: string;
  subjectOfferingId: string;
  academicGroupId: string;
}

export interface AssessmentCreationContextInput {
  tenantId: string;
  personId: string;
  subjectOfferingId: string;
  academicGroupId: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export async function resolveTeacherManagedAssessmentCreationContext(
  pool: Pool,
  input: AssessmentCreationContextInput
): Promise<AssessmentCreationAuthorizationContextResult> {
  try {
    if (
      !isValidUUID(input.tenantId) ||
      !isValidUUID(input.personId) ||
      !isValidUUID(input.subjectOfferingId) ||
      !isValidUUID(input.academicGroupId)
    ) {
      return { type: 'denied' };
    }

    const query = `
      SELECT
        tm.id AS membership_id,
        tta.id AS teacher_assignment_id,
        ata.id AS teaching_assignment_id
      FROM tenant_memberships tm
      JOIN tenant_teacher_assignments tta
        ON tta.membership_id = tm.id
       AND tta.tenant_id = tm.tenant_id
       AND tta.revoked_at IS NULL
      JOIN academic_core_teaching_assignments ata
        ON ata.teacher_assignment_id = tta.id
       AND ata.tenant_id = tta.tenant_id
       AND ata.revoked_at IS NULL
      WHERE tm.tenant_id = $1
        AND tm.person_id = $2
        AND ata.subject_offering_id = $3
        AND ata.academic_group_id = $4
      LIMIT 2
    `;

    const result = await pool.query(query, [
      input.tenantId,
      input.personId,
      input.subjectOfferingId,
      input.academicGroupId,
    ]);

    if (result.rows.length === 1) {
      const row = result.rows[0];
      return {
        type: 'context_resolved',
        context: {
          tenantId: input.tenantId,
          personId: input.personId,
          membershipId: row.membership_id,
          teacherAssignmentId: row.teacher_assignment_id,
          teachingAssignmentId: row.teaching_assignment_id,
          subjectOfferingId: input.subjectOfferingId,
          academicGroupId: input.academicGroupId,
        },
      };
    }

    return { type: 'denied' };
  } catch (error) {
    return { type: 'context_unavailable' };
  }
}
