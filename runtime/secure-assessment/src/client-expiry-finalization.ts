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
  const validatingStore: Pick<ClientAnswerRecoveryStore, 'listByScope' | 'put'> = {
    put: async (record) => {
      await store.put(record);
    },
    listByScope: async (s) => {
      const records = await store.listByScope(s);
      for (const record of records) {
        if (record.mutation.syncState === 'acknowledged') {
          const v = record.mutation.acceptedWriteVersion;
          if (v === null || typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) {
            throw new Error('Invalid acknowledged record: missing or invalid acceptedWriteVersion');
          }
        }
      }
      return records;
    }
  };

  try {
    const summary = await reconcileClientAnswerQueue(scope, validatingStore, syncExecutor);

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
    receipt.submissionId.trim() === '' ||
    typeof receipt.submittedAt !== 'string' ||
    receipt.submittedAt.trim() === ''
  ) {
    return { status: 'finalization_uncertain' };
  }

  return receipt;
}
