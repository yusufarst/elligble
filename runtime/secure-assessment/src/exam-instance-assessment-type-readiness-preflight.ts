import type { PoolClient } from 'pg';

export type AssessmentTypeReadinessCapabilityDecision =
  | 'granted'
  | 'denied'
  | 'unavailable';

export interface AssessmentTypeReadinessAuthorizationContext {
  tenantId: string;
  examInstanceId: string;
}

export type AssessmentTypeReadinessCapabilityEvaluator = (
  context: AssessmentTypeReadinessAuthorizationContext
) => Promise<AssessmentTypeReadinessCapabilityDecision> | AssessmentTypeReadinessCapabilityDecision;

export type AssessmentTypeReadinessResult =
  | { type: 'assessment_type_ready'; examInstanceId: string; tenantId: string; assessmentTypeId: string; assessmentTypeDisplayLabel: string }
  | { type: 'not_ready'; blocker: 'assessment_type_missing' }
  | { type: 'invalid_state' }
  | { type: 'denied' }
  | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export async function checkExamInstanceAssessmentTypeReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: AssessmentTypeReadinessCapabilityEvaluator
): Promise<AssessmentTypeReadinessResult> {
  if (!isValidUUID(tenantId) || !isValidUUID(examInstanceId)) {
    return { type: 'denied' };
  }

  if (typeof evaluateCapability !== 'function') {
    return { type: 'denied' };
  }

  const authContext: AssessmentTypeReadinessAuthorizationContext = {
    tenantId,
    examInstanceId,
  };

  let capabilityDecision: AssessmentTypeReadinessCapabilityDecision;
  try {
    capabilityDecision = await evaluateCapability(authContext);
  } catch {
    return { type: 'unavailable' };
  }

  if (capabilityDecision === 'unavailable') {
    return { type: 'unavailable' };
  }

  if (capabilityDecision !== 'granted') {
    return { type: 'denied' };
  }

  try {
    const query = `
      SELECT
        ei.lifecycle_state,
        ei.assessment_type_id,
        at.display_label as assessment_type_display_label
      FROM public.secure_assessment_exam_instances ei
      LEFT JOIN public.secure_assessment_assessment_types at
        ON ei.assessment_type_id = at.id
        AND at.tenant_id = ei.tenant_id
      WHERE ei.id = $1
        AND ei.tenant_id = $2
    `;

    const result = await client.query(query, [examInstanceId, tenantId]);

    if (result.rows.length === 0) {
      return { type: 'denied' };
    }

    const row = result.rows[0];

    if (row.lifecycle_state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    if (row.assessment_type_id === null || row.assessment_type_display_label === null) {
      return { type: 'not_ready', blocker: 'assessment_type_missing' };
    }

    return {
      type: 'assessment_type_ready',
      examInstanceId,
      tenantId,
      assessmentTypeId: row.assessment_type_id,
      assessmentTypeDisplayLabel: row.assessment_type_display_label
    };
  } catch (error) {
    return { type: 'unavailable' };
  }
}
