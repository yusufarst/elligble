import type { PoolClient } from 'pg';
import {
  validateBaselineQuestionSnapshotFrozenContent,
  type BaselineQuestionSnapshotBlocker
} from './question-snapshot-baseline-frozen-content-contract.ts';

export type ExamInstanceBaselineScoringReadinessResult =
  | {
      type: 'baseline_scoring_ready';
      examInstanceId: string;
      tenantId: string;
      questionSnapshotCount: number;
      totalMaxScore: number;
    }
  | {
      type: 'not_ready';
      blocker: 'question_snapshot_empty';
    }
  | {
      type: 'not_ready';
      blocker: 'scoring_snapshot_invalid';
      snapshotId: string;
      contentBlocker: BaselineQuestionSnapshotBlocker;
    }
  | {
      type: 'not_ready';
      blocker: 'total_max_score_invalid';
    }
  | { type: 'invalid_state' }
  | { type: 'denied' }
  | { type: 'unavailable' };

export async function checkExamInstanceBaselineScoringReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: () => Promise<boolean>
): Promise<ExamInstanceBaselineScoringReadinessResult> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId) || !uuidRegex.test(examInstanceId)) {
    return { type: 'denied' };
  }

  let capabilityGranted = false;
  try {
    capabilityGranted = await evaluateCapability();
  } catch (e) {
    return { type: 'unavailable' };
  }
  if (!capabilityGranted) {
    return { type: 'denied' };
  }

  try {
    const instanceRes = await client.query(
      `SELECT lifecycle_state FROM secure_assessment_exam_instances WHERE tenant_id = $1 AND id = $2`,
      [tenantId, examInstanceId]
    );

    if (instanceRes.rows.length === 0) {
      return { type: 'denied' };
    }

    const state = instanceRes.rows[0].lifecycle_state;
    if (state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    const snapshotsRes = await client.query(
      `SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 AND tenant_id = $2 ORDER BY id ASC`,
      [examInstanceId, tenantId]
    );

    if (snapshotsRes.rows.length === 0) {
      return { type: 'not_ready', blocker: 'question_snapshot_empty' };
    }

    let totalMaxScore = 0;
    for (const row of snapshotsRes.rows) {
      const validation = validateBaselineQuestionSnapshotFrozenContent(row.frozen_content);
      if (validation.type === 'invalid_content') {
        return {
          type: 'not_ready',
          blocker: 'scoring_snapshot_invalid',
          snapshotId: row.id,
          contentBlocker: validation.blocker
        };
      }
      totalMaxScore += validation.maxScore;
    }

    if (!Number.isFinite(totalMaxScore) || totalMaxScore <= 0) {
      return { type: 'not_ready', blocker: 'total_max_score_invalid' };
    }

    return {
      type: 'baseline_scoring_ready',
      examInstanceId,
      tenantId,
      questionSnapshotCount: snapshotsRes.rows.length,
      totalMaxScore
    };
  } catch (e) {
    return { type: 'unavailable' };
  }
}
