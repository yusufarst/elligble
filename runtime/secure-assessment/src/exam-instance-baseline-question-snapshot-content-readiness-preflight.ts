import type { PoolClient } from 'pg';
import {
  validateBaselineQuestionSnapshotFrozenContent,
  type BaselineQuestionSnapshotBlocker
} from './question-snapshot-baseline-frozen-content-contract';

export type CapabilityContext = {
  tenantId: string;
  examInstanceId: string;
};

export type CapabilityDecision = 'granted' | 'denied' | 'unavailable';

export type CapabilityEvaluator = (ctx: CapabilityContext) => Promise<CapabilityDecision> | CapabilityDecision;

export type BaselineQuestionSnapshotContentReadinessResult =
  | {
      type: 'baseline_question_snapshot_content_ready';
      examInstanceId: string;
      tenantId: string;
      questionSnapshotCount: number;
    }
  | {
      type: 'not_ready';
      blocker: 'question_snapshot_empty';
    }
  | {
      type: 'not_ready';
      blocker: 'question_snapshot_content_invalid';
      snapshotId: string;
      contentBlocker: BaselineQuestionSnapshotBlocker;
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

export async function checkExamInstanceBaselineQuestionSnapshotContentReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<BaselineQuestionSnapshotContentReadinessResult> {
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
        s.id AS snapshot_id,
        s.frozen_content
      FROM secure_assessment_exam_instances ei
      LEFT JOIN secure_assessment_exam_question_snapshots s
        ON s.exam_instance_id = ei.id
        AND s.tenant_id = ei.tenant_id
      WHERE ei.id = $1 AND ei.tenant_id = $2
      ORDER BY s.id ASC
    `;
    const result = await client.query(query, [examInstanceId, tenantId]);

    if (result.rows.length === 0) {
      return { type: 'denied' };
    }

    const lifecycleState = result.rows[0].lifecycle_state;

    if (lifecycleState !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    // Filter out null snapshots (LEFT JOIN where there are no snapshots)
    const snapshots = result.rows.filter(row => row.snapshot_id !== null);

    if (snapshots.length === 0) {
      return { type: 'not_ready', blocker: 'question_snapshot_empty' };
    }

    for (const snapshot of snapshots) {
      const validation = validateBaselineQuestionSnapshotFrozenContent(snapshot.frozen_content);
      if (validation.type === 'invalid_content') {
        return {
          type: 'not_ready',
          blocker: 'question_snapshot_content_invalid',
          snapshotId: snapshot.snapshot_id,
          contentBlocker: validation.blocker
        };
      }
    }

    return {
      type: 'baseline_question_snapshot_content_ready',
      examInstanceId,
      tenantId,
      questionSnapshotCount: snapshots.length,
    };
  } catch (error) {
    return { type: 'unavailable' };
  }
}
