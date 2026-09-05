import type { PoolClient } from 'pg';

export type CapabilityContext = {
  tenantId: string;
  examInstanceId: string;
};

export type CapabilityDecision = 'granted' | 'denied' | 'unavailable';

export type CapabilityEvaluator = (ctx: CapabilityContext) => Promise<CapabilityDecision> | CapabilityDecision;

export type QuestionSnapshotPresenceReadinessResult =
  | {
      type: 'question_snapshot_presence_ready';
      examInstanceId: string;
      tenantId: string;
      questionSnapshotCount: number;
    }
  | {
      type: 'not_ready';
      blocker: 'question_snapshot_empty';
    }
  | {
      type: 'invalid_state';
    }
  | {
      type: 'denied';
    }
  | {
      type: 'unavailable';
    };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkExamInstanceQuestionSnapshotPresenceReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<QuestionSnapshotPresenceReadinessResult> {
  if (!UUID_REGEX.test(tenantId) || !UUID_REGEX.test(examInstanceId)) {
    return { type: 'denied' };
  }

  try {
    const decision = await evaluateCapability({ tenantId, examInstanceId });
    if (decision === 'unavailable') {
      return { type: 'unavailable' };
    }
    if (decision !== 'granted') {
      return { type: 'denied' };
    }
  } catch (error) {
    return { type: 'unavailable' };
  }

  try {
    const query = `
      SELECT
        ei.lifecycle_state,
        COUNT(s.id)::int AS snapshot_count
      FROM secure_assessment_exam_instances ei
      LEFT JOIN secure_assessment_exam_question_snapshots s
        ON s.exam_instance_id = ei.id
        AND s.tenant_id = ei.tenant_id
      WHERE ei.id = $1 AND ei.tenant_id = $2
      GROUP BY ei.id, ei.lifecycle_state
    `;
    const result = await client.query(query, [examInstanceId, tenantId]);

    if (result.rows.length === 0) {
      return { type: 'denied' };
    }

    const row = result.rows[0];

    if (row.lifecycle_state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    const snapshotCount = row.snapshot_count;

    if (snapshotCount === 0) {
      return { type: 'not_ready', blocker: 'question_snapshot_empty' };
    }

    return {
      type: 'question_snapshot_presence_ready',
      examInstanceId,
      tenantId,
      questionSnapshotCount: snapshotCount,
    };
  } catch (error) {
    return { type: 'unavailable' };
  }
}
