import type {
  ClientAnswerRecoveryScope,
  ClientAnswerRecoveryStore,
} from './client-answer-recovery-store.ts';

import type {
  ClientAnswerSynchronizationExecutor,
} from './client-answer-reconciliation-queue.ts';
import {
  reconcileClientAnswerQueue,
} from './client-answer-reconciliation-queue.ts';

export interface AuthoritativeExpiryFinalizationReceipt {
  readonly status: 'submitted';
  readonly submissionId: string;
  readonly submittedAt: string;
}

export type ExpiryFinalizationResult =
  | AuthoritativeExpiryFinalizationReceipt
  | { readonly status: 'pending_answers_unresolved' }
  | { readonly status: 'finalization_uncertain' };

export interface ExpiryFinalizationExecutor {
  (attemptId: string): Promise<AuthoritativeExpiryFinalizationReceipt>;
}

export async function finalizeAuthoritativeExpiry(
  scope: ClientAnswerRecoveryScope,
  store: Pick<ClientAnswerRecoveryStore, 'listByScope' | 'put'>,
  syncExecutor: ClientAnswerSynchronizationExecutor,
  finalizationExecutor: ExpiryFinalizationExecutor
): Promise<ExpiryFinalizationResult> {
  try {
    const summary = await reconcileClientAnswerQueue(scope, store, syncExecutor);

    if (summary.failed !== 0 || summary.acknowledged !== summary.attempted) {
      return { status: 'pending_answers_unresolved' };
    }
  } catch (error) {
    return { status: 'pending_answers_unresolved' };
  }

  let receipt: AuthoritativeExpiryFinalizationReceipt;
  try {
    receipt = await finalizationExecutor(scope.attemptId);
  } catch (error) {
    return { status: 'finalization_uncertain' };
  }

  if (
    !receipt ||
    receipt.status !== 'submitted' ||
    typeof receipt.submissionId !== 'string' ||
    receipt.submissionId === '' ||
    typeof receipt.submittedAt !== 'string' ||
    receipt.submittedAt === ''
  ) {
    return { status: 'finalization_uncertain' };
  }

  return receipt;
}
