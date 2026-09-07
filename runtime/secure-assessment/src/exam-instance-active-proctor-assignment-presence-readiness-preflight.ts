import type { PoolClient } from 'pg';

export interface CapabilityContext {
  tenantId: string;
  examInstanceId: string;
}

export type CapabilityDecision = 'granted' | 'denied' | 'unavailable';

export type CapabilityEvaluator = (
  context: CapabilityContext
) => CapabilityDecision | Promise<CapabilityDecision>;

export type ActiveProctorAssignmentPresenceReadinessResult =
  | { type: 'denied' }
  | { type: 'unavailable' }
  | { type: 'invalid_state' }
  | { type: 'not_ready'; blocker: 'active_proctor_assignment_empty' }
  | { type: 'active_proctor_assignment_presence_ready'; tenantId: string; examInstanceId: string; activeProctorAssignmentCount: number };

export async function checkExamInstanceActiveProctorAssignmentPresenceReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<ActiveProctorAssignmentPresenceReadinessResult> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    return { type: 'denied' };
  }
  if (!uuidRegex.test(examInstanceId)) {
    return { type: 'denied' };
  }

  let decision: CapabilityDecision;
  try {
    decision = await evaluateCapability({ tenantId, examInstanceId });
  } catch {
    return { type: 'unavailable' };
  }

  if (decision === 'unavailable') {
    return { type: 'unavailable' };
  }
  if (decision === 'denied') {
    return { type: 'denied' };
  }
  if (decision !== 'granted') {
    return { type: 'denied' };
  }

  try {
    const examInstanceResult = await client.query(
      `SELECT lifecycle_state
       FROM public.secure_assessment_exam_instances
       WHERE id = $1 AND tenant_id = $2`,
      [examInstanceId, tenantId]
    );

    if (examInstanceResult.rowCount === 0) {
      return { type: 'denied' };
    }

    if (examInstanceResult.rows[0].lifecycle_state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    const assignmentsResult = await client.query(
      `SELECT COUNT(*) as count
       FROM public.secure_assessment_proctor_assignments
       WHERE exam_instance_id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
      [examInstanceId, tenantId]
    );

    const count = parseInt(assignmentsResult.rows[0].count, 10);

    if (count === 0) {
      return { type: 'not_ready', blocker: 'active_proctor_assignment_empty' };
    }

    return {
      type: 'active_proctor_assignment_presence_ready',
      tenantId,
      examInstanceId,
      activeProctorAssignmentCount: count
    };

  } catch {
    return { type: 'unavailable' };
  }
}
