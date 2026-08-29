import type {
  ClientAnswerRecoveryScope,
  ClientAnswerRecoveryRecord,
} from './client-answer-recovery-store.ts';

import type {
  ClientAnswerMutationRecord,
  AuthoritativeAcknowledgement,
} from './client-answer-sync.ts';
import {
  isMutationAcknowledged,
  applyAuthoritativeAcknowledgement,
} from './client-answer-sync.ts';

export interface ClientAnswerSynchronizationExecutor {
  (mutation: ClientAnswerMutationRecord): Promise<AuthoritativeAcknowledgement>;
}

export interface ClientAnswerReconciliationSummary {
  scanned: number;
  attempted: number;
  acknowledged: number;
  failed: number;
  skippedAcknowledged: number;
}

export interface ClientAnswerRecoveryStoreAdapter {
  listByScope(scope: ClientAnswerRecoveryScope): Promise<ClientAnswerRecoveryRecord[]>;
  put(record: ClientAnswerRecoveryRecord): Promise<void>;
}

export async function reconcileClientAnswerQueue(
  scope: ClientAnswerRecoveryScope,
  store: ClientAnswerRecoveryStoreAdapter,
  executor: ClientAnswerSynchronizationExecutor
): Promise<ClientAnswerReconciliationSummary> {
  const summary: ClientAnswerReconciliationSummary = {
    scanned: 0,
    attempted: 0,
    acknowledged: 0,
    failed: 0,
    skippedAcknowledged: 0,
  };

  const records = await store.listByScope(scope);
  summary.scanned = records.length;

  const candidates = records.filter(r => !isMutationAcknowledged(r.mutation));
  summary.skippedAcknowledged = records.length - candidates.length;

  // Deterministic order: localSequence ascending, then clientWriteIdentity, then recordKey
  candidates.sort((a, b) => {
    if (a.mutation.localSequence !== b.mutation.localSequence) {
      return a.mutation.localSequence - b.mutation.localSequence;
    }
    if (a.mutation.clientWriteIdentity !== b.mutation.clientWriteIdentity) {
      return a.mutation.clientWriteIdentity.localeCompare(b.mutation.clientWriteIdentity);
    }
    return a.recordKey.localeCompare(b.recordKey);
  });

  for (const record of candidates) {
    summary.attempted++;

    // Establish in-flight representation without modifying original
    const inFlightMutation: ClientAnswerMutationRecord = {
      ...record.mutation,
      syncState: 'in_flight',
    };
    const inFlightRecord: ClientAnswerRecoveryRecord = {
      ...record,
      mutation: inFlightMutation,
    };

    // Persist in-flight state prior to executor call (optional but consistent with retry)
    // Wait, the prompt says: "5. Before retry, establish a valid local retry/in-flight representation..."
    // Let's persist it so that if executor crashes we know it was in flight.
    await store.put(inFlightRecord);

    let ack: AuthoritativeAcknowledgement | null = null;
    let executorFailed = false;

    try {
      ack = await executor(inFlightMutation);
    } catch (error) {
      executorFailed = true;
    }

    if (executorFailed || !ack) {
      const failedMutation: ClientAnswerMutationRecord = {
        ...record.mutation,
        syncState: 'failed',
      };
      await store.put({ ...record, mutation: failedMutation });
      summary.failed++;
      continue;
    }

    const ackedMutation = applyAuthoritativeAcknowledgement(inFlightMutation, ack);

    if (isMutationAcknowledged(ackedMutation)) {
      await store.put({ ...record, mutation: ackedMutation });
      summary.acknowledged++;
    } else {
      const failedMutation: ClientAnswerMutationRecord = {
        ...record.mutation,
        syncState: 'failed',
      };
      await store.put({ ...record, mutation: failedMutation });
      summary.failed++;
    }
  }

  return summary;
}
