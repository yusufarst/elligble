import { Pool } from 'pg';

export type ExamParticipantAcademicEnrollmentContextResult =
  | { type: 'context_resolved'; context: ResolvedExamParticipantAcademicEnrollmentContext }
  | { type: 'denied' }
  | { type: 'context_unavailable' };

export interface ResolvedExamParticipantAcademicEnrollmentContext {
  tenantId: string;
  personId: string;
  membershipId: string;
  academicEnrollmentId: string;
  academicYearId: string;
  academicGroupId: string;
  academicPeriodId: string;
}

export interface ExamParticipantAcademicEnrollmentContextInput {
  tenantId: string;
  academicEnrollmentId: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export async function resolveExamParticipantAcademicEnrollmentContext(
  pool: Pool,
  input: ExamParticipantAcademicEnrollmentContextInput
): Promise<ExamParticipantAcademicEnrollmentContextResult> {
  try {
    if (!isValidUUID(input.tenantId) || !isValidUUID(input.academicEnrollmentId)) {
      return { type: 'denied' };
    }

    const query = `
      SELECT
        tm.person_id,
        acse.membership_id,
        acse.academic_year_id,
        acse.academic_group_id,
        acse.academic_period_id
      FROM academic_core_student_enrollments acse
      JOIN tenant_memberships tm
        ON tm.id = acse.membership_id
       AND tm.tenant_id = acse.tenant_id
      WHERE acse.tenant_id = $1
        AND acse.id = $2
        AND acse.start_date <= CURRENT_DATE
        AND (acse.end_date IS NULL OR acse.end_date >= CURRENT_DATE)
      LIMIT 2
    `;

    const result = await pool.query(query, [input.tenantId, input.academicEnrollmentId]);

    if (result.rows.length === 1) {
      const row = result.rows[0];
      return {
        type: 'context_resolved',
        context: {
          tenantId: input.tenantId,
          personId: row.person_id,
          membershipId: row.membership_id,
          academicEnrollmentId: input.academicEnrollmentId,
          academicYearId: row.academic_year_id,
          academicGroupId: row.academic_group_id,
          academicPeriodId: row.academic_period_id,
        },
      };
    }

    return { type: 'denied' };
  } catch (error) {
    return { type: 'context_unavailable' };
  }
}
