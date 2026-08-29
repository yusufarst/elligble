import type {
  ClientAnswerRecoveryScope,
  ClientAnswerRecoveryStore
} from './client-answer-recovery-store.ts';
import type { ClientAnswerSynchronizationExecutor } from './client-answer-reconciliation-queue.ts';
import type {
  AuthoritativeExpiryFinalizationReceipt,
  ExpiryFinalizationExecutor,
  ExpiryFinalizationResult
} from './client-expiry-finalization.ts';
import { finalizeAuthoritativeExpiry } from './client-expiry-finalization.ts';

export type TimerObservation =
  | { status: 'not_started' }
  | { status: 'active'; effectiveRemainingSeconds: number };

export type SubmissionObservation =
  | { status: 'not_submitted' }
  | (AuthoritativeExpiryFinalizationReceipt & { status: 'submitted' });

export interface AuthoritativeAssessmentObservation {
  attemptId: string;
  timer: TimerObservation;
  submission: SubmissionObservation;
}

export type ExpiryTriggerResult =
  | { status: 'not_expired' }
  | { status: 'authoritative_state_invalid' }
  | ExpiryFinalizationResult;

export async function triggerAuthoritativeExpiry(
  scope: ClientAnswerRecoveryScope,
  observation: AuthoritativeAssessmentObservation,
  store: ClientAnswerRecoveryStore,
  syncExecutor: ClientAnswerSynchronizationExecutor,
  finalizationExecutor: ExpiryFinalizationExecutor,
  coordinator: typeof finalizeAuthoritativeExpiry = finalizeAuthoritativeExpiry
): Promise<ExpiryTriggerResult> {
  if (
    !observation ||
    typeof observation.attemptId !== 'string' ||
    observation.attemptId.trim() === ''
  ) {
    return { status: 'authoritative_state_invalid' };
  }

  if (observation.attemptId !== scope.attemptId) {
    return { status: 'authoritative_state_invalid' };
  }

  if (observation.submission.status === 'submitted') {
    const { status, submissionId, submittedAt } = observation.submission;
    if (
      typeof submissionId !== 'string' ||
      submissionId.trim() === '' ||
      typeof submittedAt !== 'string' ||
      submittedAt.trim() === ''
    ) {
      return { status: 'authoritative_state_invalid' };
    }
    return observation.submission;
  }

  if (observation.submission.status !== 'not_submitted') {
    return { status: 'authoritative_state_invalid' };
  }

  if (observation.timer.status === 'not_started') {
    return { status: 'not_expired' };
  }

  if (observation.timer.status === 'active') {
    const remaining = observation.timer.effectiveRemainingSeconds;
    if (typeof remaining !== 'number' || !Number.isSafeInteger(remaining) || remaining < 0) {
      return { status: 'authoritative_state_invalid' };
    }

    if (remaining > 0) {
      return { status: 'not_expired' };
    }

    if (remaining === 0) {
      return await coordinator(scope, store, syncExecutor, finalizationExecutor);
    }
  }

  return { status: 'authoritative_state_invalid' };
}
