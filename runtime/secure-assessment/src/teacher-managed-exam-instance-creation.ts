import type { Pool, PoolClient } from 'pg';
import { resolveTeacherManagedAssessmentCreationContext } from './assessment-creation-authorization-context.ts';

import type {
  AssessmentCreationContextInput,
  ResolvedAssessmentCreationContext,
} from './assessment-creation-authorization-context.ts';

export type AssessmentCreationCapabilityDecision =
  | 'granted'
  | 'denied'
  | 'unavailable';

export type AssessmentCreationCapabilityEvaluator = (
  context: ResolvedAssessmentCreationContext
) => Promise<AssessmentCreationCapabilityDecision>;

export type TeacherManagedExamInstanceCreationResult =
  | { type: 'created'; examInstanceId: string; teachingAssignmentId: string }
  | { type: 'denied' }
  | { type: 'unavailable' };

export async function createTeacherManagedExamInstance(
  pool: Pool,
  input: AssessmentCreationContextInput,
  evaluateCapability: AssessmentCreationCapabilityEvaluator
): Promise<TeacherManagedExamInstanceCreationResult> {
  let client: PoolClient | null = null;

  try {
    const resolution = await resolveTeacherManagedAssessmentCreationContext(pool, input);

    if (resolution.type === 'denied') {
      return { type: 'denied' };
    }
    if (resolution.type === 'context_unavailable') {
      return { type: 'unavailable' };
    }

    const context = resolution.context;

    if (typeof evaluateCapability !== 'function') {
      return { type: 'denied' };
    }

    let capabilityDecision: AssessmentCreationCapabilityDecision;
    try {
      capabilityDecision = await evaluateCapability(context);
    } catch {
      return { type: 'unavailable' };
    }

    if (capabilityDecision === 'unavailable') {
      return { type: 'unavailable' };
    }
    if (capabilityDecision !== 'granted') {
      return { type: 'denied' };
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Revalidate the complete context with row-level locking
    const revalidationQuery = `
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
        AND tm.id = $3
        AND tta.id = $4
        AND ata.id = $5
        AND ata.subject_offering_id = $6
        AND ata.academic_group_id = $7
      FOR UPDATE OF tm, tta, ata
    `;

    const revalidationResult = await client.query(revalidationQuery, [
      context.tenantId,
      context.personId,
      context.membershipId,
      context.teacherAssignmentId,
      context.teachingAssignmentId,
      context.subjectOfferingId,
      context.academicGroupId
    ]);

    if (revalidationResult.rows.length !== 1) {
      await client.query('ROLLBACK');
      return { type: 'denied' };
    }

    // Insert new Exam Instance
    const insertQuery = `
      INSERT INTO secure_assessment_exam_instances (
        tenant_id,
        teaching_assignment_id
      ) VALUES ($1, $2)
      RETURNING id
    `;
    const insertResult = await client.query(insertQuery, [
      context.tenantId,
      context.teachingAssignmentId
    ]);

    await client.query('COMMIT');

    return {
      type: 'created',
      examInstanceId: insertResult.rows[0].id,
      teachingAssignmentId: context.teachingAssignmentId
    };
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Ignore rollback error
      }
    }
    return { type: 'unavailable' };
  } finally {
    if (client) {
      client.release();
    }
  }
}
