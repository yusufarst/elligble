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
  // 1. Validate observation and attemptId
  if (
    !observation ||
    typeof observation !== 'object' ||
    typeof observation.attemptId !== 'string' ||
    observation.attemptId.trim() === '' ||
    observation.attemptId !== scope.attemptId
  ) {
    return { status: 'authoritative_state_invalid' };
  }

  // 2. Validate timer observation
  const timer = observation.timer;
  if (!timer || typeof timer !== 'object') {
    return { status: 'authoritative_state_invalid' };
  }
  if (timer.status !== 'not_started' && timer.status !== 'active') {
    return { status: 'authoritative_state_invalid' };
  }
  if (timer.status === 'active') {
    const remaining = timer.effectiveRemainingSeconds;
    if (typeof remaining !== 'number' || !Number.isSafeInteger(remaining) || remaining < 0) {
      return { status: 'authoritative_state_invalid' };
    }
  }

  // 3. Validate submission observation
  const submission = observation.submission;
  if (!submission || typeof submission !== 'object') {
    return { status: 'authoritative_state_invalid' };
  }
  if (submission.status !== 'not_submitted' && submission.status !== 'submitted') {
    return { status: 'authoritative_state_invalid' };
  }
  if (submission.status === 'submitted') {
    const { submissionId, submittedAt } = submission;
    if (
      typeof submissionId !== 'string' ||
      submissionId.trim() === '' ||
      typeof submittedAt !== 'string' ||
      submittedAt.trim() === ''
    ) {
      return { status: 'authoritative_state_invalid' };
    }
  }

  // 4. Already-submitted early return
  if (submission.status === 'submitted') {
    return submission;
  }

  // 5. Timer evaluation
  if (timer.status === 'not_started') {
    return { status: 'not_expired' };
  }

  if (timer.status === 'active') {
    const remaining = timer.effectiveRemainingSeconds;
    if (remaining > 0) {
      return { status: 'not_expired' };
    }
    if (remaining === 0) {
      return await coordinator(scope, store, syncExecutor, finalizationExecutor);
    }
  }

  return { status: 'authoritative_state_invalid' };
}
