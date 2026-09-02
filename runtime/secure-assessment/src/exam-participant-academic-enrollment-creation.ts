import { Pool } from 'pg';
import { resolveExamParticipantAcademicEnrollmentContext } from './exam-participant-academic-enrollment-context.ts';

export interface ExamParticipantAcademicEnrollmentCreationInput {
  tenantId: string;
  examInstanceId: string;
  academicEnrollmentId: string;
}

export type ExamParticipantAcademicEnrollmentCreationResult =
  | { type: 'created'; examParticipantId: string; tenantId: string; examInstanceId: string; personId: string; academicEnrollmentId: string }
  | { type: 'denied' }
  | { type: 'creation_unavailable' };

function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

export async function createExamParticipantAcademicEnrollment(
  pool: Pool,
  input: ExamParticipantAcademicEnrollmentCreationInput
): Promise<ExamParticipantAcademicEnrollmentCreationResult> {
  if (!isValidUUID(input.tenantId) || !isValidUUID(input.examInstanceId) || !isValidUUID(input.academicEnrollmentId)) {
    return { type: 'denied' };
  }

  try {
    const contextResult = await resolveExamParticipantAcademicEnrollmentContext(pool, {
      tenantId: input.tenantId,
      academicEnrollmentId: input.academicEnrollmentId,
    });

    if (contextResult.type === 'denied') {
      return { type: 'denied' };
    }

    if (contextResult.type === 'context_unavailable') {
      return { type: 'creation_unavailable' };
    }

    const canonicalPersonId = contextResult.context.personId;

    const instanceCheck = await pool.query(
      `SELECT 1 FROM secure_assessment_exam_instances WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [input.examInstanceId, input.tenantId]
    );

    if (instanceCheck.rowCount === 0) {
      return { type: 'denied' };
    }

    const duplicateCheck = await pool.query(
      `SELECT 1 FROM secure_assessment_exam_participants WHERE tenant_id = $1 AND exam_instance_id = $2 AND person_id = $3 LIMIT 1`,
      [input.tenantId, input.examInstanceId, canonicalPersonId]
    );

    if ((duplicateCheck.rowCount ?? 0) > 0) {
      return { type: 'denied' };
    }

    const insertResult = await pool.query(
      `
        INSERT INTO secure_assessment_exam_participants (
          tenant_id, exam_instance_id, person_id, academic_enrollment_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, tenant_id, exam_instance_id, person_id, academic_enrollment_id
      `,
      [input.tenantId, input.examInstanceId, canonicalPersonId, input.academicEnrollmentId]
    );

    const row = insertResult.rows[0];

    return {
      type: 'created',
      examParticipantId: row.id,
      tenantId: row.tenant_id,
      examInstanceId: row.exam_instance_id,
      personId: row.person_id,
      academicEnrollmentId: row.academic_enrollment_id,
    };
  } catch (error) {
    return { type: 'creation_unavailable' };
  }
}
