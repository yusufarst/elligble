import type { PoolClient } from 'pg';
import { checkExamInstanceExistingReadinessChecksCompositionPreflight } from './exam-instance-existing-readiness-checks-composition-preflight.ts';
import { checkExamInstanceBaselineQuestionSnapshotContentReadiness } from './exam-instance-baseline-question-snapshot-content-readiness-preflight.ts';
import type { BaselineQuestionSnapshotBlocker } from './question-snapshot-baseline-frozen-content-contract.ts';

export type CapabilityContext = {
  tenantId: string;
  examInstanceId: string;
};

export type CapabilityDecision = 'granted' | 'denied' | 'unavailable';

export type CapabilityEvaluator = (ctx: CapabilityContext) => Promise<CapabilityDecision> | CapabilityDecision;

export type BaselineReadinessChecksCompositionResult =
  | {
      type: 'baseline_readiness_checks_pass';
      examInstanceId: string;
      tenantId: string;
    }
  | {
      type: 'not_ready';
      category:
        | 'assessment_type'
        | 'question_snapshot_presence'
        | 'participant_presence'
        | 'timing_configuration_presence'
        | 'duration_window_policy_compatibility';
      blocker: string;
    }
  | {
      type: 'not_ready';
      category: 'question_snapshot_content';
      blocker: 'question_snapshot_empty';
    }
  | {
      type: 'not_ready';
      category: 'question_snapshot_content';
      blocker: 'question_snapshot_content_invalid';
      snapshotId: string;
      contentBlocker: BaselineQuestionSnapshotBlocker;
    }
  | { type: 'invalid_state' }
  | { type: 'denied' }
  | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkExamInstanceBaselineReadinessChecksCompositionPreflight(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<BaselineReadinessChecksCompositionResult> {
  if (!UUID_REGEX.test(tenantId) || !UUID_REGEX.test(examInstanceId)) {
    return { type: 'denied' };
  }

  let capability: CapabilityDecision;
  try {
    capability = await evaluateCapability({ tenantId, examInstanceId });
  } catch {
    return { type: 'unavailable' };
  }

  if (capability === 'unavailable') return { type: 'unavailable' };
  if (capability !== 'granted') return { type: 'denied' };

  try {
    // 1. Existing checks
    const existingResult = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
      client,
      tenantId,
      examInstanceId,
      async () => 'granted' as const
    );

    if (existingResult.type === 'denied') return { type: 'denied' };
    if (existingResult.type === 'unavailable') return { type: 'unavailable' };
    if (existingResult.type === 'invalid_state') return { type: 'invalid_state' };
    if (existingResult.type === 'not_ready') {
      return { 
        type: 'not_ready', 
        category: existingResult.category as any, 
        blocker: existingResult.blocker 
      };
    }

    // 2. Snapshot Content checks
    const contentResult = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      client,
      tenantId,
      examInstanceId,
      async () => 'granted' as const
    );

    if (contentResult.type === 'denied') return { type: 'denied' };
    if (contentResult.type === 'unavailable') return { type: 'unavailable' };
    if (contentResult.type === 'invalid_state') return { type: 'invalid_state' };
    
    if (contentResult.type === 'not_ready') {
      if (contentResult.blocker === 'question_snapshot_empty') {
        return {
          type: 'not_ready',
          category: 'question_snapshot_content',
          blocker: 'question_snapshot_empty'
        };
      }
      return {
        type: 'not_ready',
        category: 'question_snapshot_content',
        blocker: 'question_snapshot_content_invalid',
        snapshotId: contentResult.snapshotId,
        contentBlocker: contentResult.contentBlocker
      };
    }

    return {
      type: 'baseline_readiness_checks_pass',
      examInstanceId,
      tenantId
    };
  } catch (error) {
    return { type: 'unavailable' };
  }
}
