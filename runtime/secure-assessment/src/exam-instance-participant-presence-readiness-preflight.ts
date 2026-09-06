import type { PoolClient } from 'pg';

export type CapabilityEvaluator = (context: { tenantId: string; examInstanceId: string }) => Promise<'granted' | 'denied' | 'unavailable'>;

export type ParticipantPresencePreflightResult =
  | { type: 'participant_presence_ready'; examInstanceId: string; tenantId: string; participantCount: number }
  | { type: 'not_ready'; blocker: 'participant_empty' }
  | { type: 'invalid_state' }
  | { type: 'denied' }
  | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkExamInstanceParticipantPresenceReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<ParticipantPresencePreflightResult> {
  if (!UUID_REGEX.test(tenantId) || !UUID_REGEX.test(examInstanceId)) {
    return { type: 'denied' };
  }

  let capability: 'granted' | 'denied' | 'unavailable';
  try {
    capability = await evaluateCapability({ tenantId, examInstanceId });
  } catch (error) {
    return { type: 'unavailable' };
  }

  if (capability === 'unavailable') {
    return { type: 'unavailable' };
  }

  if (capability !== 'granted') {
    return { type: 'denied' };
  }

  try {
    const instanceResult = await client.query(
      `
      SELECT lifecycle_state
      FROM secure_assessment_exam_instances
      WHERE id = $1 AND tenant_id = $2
      `,
      [examInstanceId, tenantId]
    );

    if (instanceResult.rows.length === 0) {
      return { type: 'denied' };
    }

    const { lifecycle_state } = instanceResult.rows[0];

    if (lifecycle_state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    const countResult = await client.query(
      `
      SELECT COUNT(*) as participant_count
      FROM secure_assessment_exam_participants
      WHERE exam_instance_id = $1 AND tenant_id = $2
      `,
      [examInstanceId, tenantId]
    );

    const participantCount = parseInt(countResult.rows[0].participant_count, 10);

    if (participantCount === 0) {
      return {
        type: 'not_ready',
        blocker: 'participant_empty'
      };
    }

    return {
      type: 'participant_presence_ready',
      examInstanceId,
      tenantId,
      participantCount
    };

  } catch (error) {
    return { type: 'unavailable' };
  }
}
