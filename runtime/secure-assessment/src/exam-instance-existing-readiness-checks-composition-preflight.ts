import type { PoolClient } from 'pg';
import { checkExamInstanceAssessmentTypeReadiness } from './exam-instance-assessment-type-readiness-preflight.ts';
import { checkExamInstanceQuestionSnapshotPresenceReadiness } from './exam-instance-question-snapshot-presence-readiness-preflight.ts';
import { checkExamInstanceParticipantPresenceReadiness } from './exam-instance-participant-presence-readiness-preflight.ts';
import { checkExamInstanceTimingConfigurationPresenceReadiness } from './exam-instance-timing-configuration-presence-readiness-preflight.ts';
import { checkExamInstanceDurationWindowPolicyCompatibilityReadiness } from './exam-instance-duration-window-policy-compatibility-readiness-preflight.ts';

export type CapabilityContext = {
  tenantId: string;
  examInstanceId: string;
};

export type CapabilityDecision = 'granted' | 'denied' | 'unavailable';

export type CapabilityEvaluator = (ctx: CapabilityContext) => Promise<CapabilityDecision> | CapabilityDecision;

export type ExistingReadinessChecksCompositionResult =
  | { type: 'existing_readiness_checks_pass'; examInstanceId: string; tenantId: string }
  | { type: 'not_ready'; category: string; blocker: string }
  | { type: 'invalid_state' }
  | { type: 'denied' }
  | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkExamInstanceExistingReadinessChecksCompositionPreflight(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<ExistingReadinessChecksCompositionResult> {
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
    // 1. assessment_type
    const assessmentResult = await checkExamInstanceAssessmentTypeReadiness(client, tenantId, examInstanceId, async () => 'granted' as const);
    if (assessmentResult.type === 'denied') return { type: 'denied' };
    if (assessmentResult.type === 'invalid_state') return { type: 'invalid_state' };
    if (assessmentResult.type === 'unavailable') return { type: 'unavailable' };
    if (assessmentResult.type === 'not_ready') {
      return { type: 'not_ready', category: 'assessment_type', blocker: assessmentResult.blocker };
    }

    // 2. question_snapshot_presence
    const questionResult = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, tenantId, examInstanceId, async () => 'granted' as const);
    if (questionResult.type === 'denied') return { type: 'denied' };
    if (questionResult.type === 'invalid_state') return { type: 'invalid_state' };
    if (questionResult.type === 'unavailable') return { type: 'unavailable' };
    if (questionResult.type === 'not_ready') {
      return { type: 'not_ready', category: 'question_snapshot_presence', blocker: questionResult.blocker };
    }

    // 3. participant_presence
    const participantResult = await checkExamInstanceParticipantPresenceReadiness(client, tenantId, examInstanceId, async () => 'granted' as const);
    if (participantResult.type === 'denied') return { type: 'denied' };
    if (participantResult.type === 'invalid_state') return { type: 'invalid_state' };
    if (participantResult.type === 'unavailable') return { type: 'unavailable' };
    if (participantResult.type === 'not_ready') {
      return { type: 'not_ready', category: 'participant_presence', blocker: participantResult.blocker };
    }

    // 4. timing_configuration_presence
    const timingResult = await checkExamInstanceTimingConfigurationPresenceReadiness(client, tenantId, examInstanceId, async () => 'granted' as const);
    if (timingResult.type === 'denied') return { type: 'denied' };
    if (timingResult.type === 'invalid_state') return { type: 'invalid_state' };
    if (timingResult.type === 'unavailable') return { type: 'unavailable' };
    if (timingResult.type === 'not_ready') {
      return { type: 'not_ready', category: 'timing_configuration_presence', blocker: timingResult.blocker };
    }

    // 5. duration_window_policy_compatibility
    const durationResult = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(client, tenantId, examInstanceId, async () => 'granted' as const);
    if (durationResult.type === 'denied') return { type: 'denied' };
    if (durationResult.type === 'invalid_state') return { type: 'invalid_state' };
    if (durationResult.type === 'unavailable') return { type: 'unavailable' };
    if (durationResult.type === 'not_ready') {
      return { type: 'not_ready', category: 'duration_window_policy_compatibility', blocker: durationResult.blocker };
    }

    return {
      type: 'existing_readiness_checks_pass',
      examInstanceId,
      tenantId
    };
  } catch (error) {
    return { type: 'unavailable' };
  }
}
