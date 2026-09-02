import { Pool } from 'pg';
import { resolveExamParticipantAcademicEnrollmentContext } from './exam-participant-academic-enrollment-context.ts';

export type ExamParticipantAcademicEnrollmentAssignmentResult =
  | { type: 'assigned' }
  | { type: 'denied' }
  | { type: 'assignment_unavailable' };

export interface ExamParticipantAcademicEnrollmentAssignmentInput {
  tenantId: string;
  examParticipantId: string;
  academicEnrollmentId: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export async function assignExamParticipantAcademicEnrollment(
  pool: Pool,
  input: ExamParticipantAcademicEnrollmentAssignmentInput
): Promise<ExamParticipantAcademicEnrollmentAssignmentResult> {
  try {
    if (
      !isValidUUID(input.tenantId) ||
      !isValidUUID(input.examParticipantId) ||
      !isValidUUID(input.academicEnrollmentId)
    ) {
      return { type: 'denied' };
    }

    const contextRes = await resolveExamParticipantAcademicEnrollmentContext(pool, {
      tenantId: input.tenantId,
      academicEnrollmentId: input.academicEnrollmentId,
    });

    if (contextRes.type === 'context_unavailable') {
      return { type: 'assignment_unavailable' };
    }
    if (contextRes.type === 'denied') {
      return { type: 'denied' };
    }

    const resolvedPersonId = contextRes.context.personId;

    const query = `
      UPDATE secure_assessment_exam_participants
      SET academic_enrollment_id = $1
      WHERE tenant_id = $2
        AND id = $3
        AND person_id = $4
        AND (academic_enrollment_id IS NULL OR academic_enrollment_id = $1)
      RETURNING id
    `;

    const result = await pool.query(query, [
      input.academicEnrollmentId,
      input.tenantId,
      input.examParticipantId,
      resolvedPersonId,
    ]);

    if (result.rowCount === 1) {
      return { type: 'assigned' };
    }

    return { type: 'denied' };
  } catch (error) {
    return { type: 'assignment_unavailable' };
  }
}
