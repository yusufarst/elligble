import { createPendingMutation } from './client-answer-sync.ts';
import type { ClientAnswerSyncIdentity, ClientAnswerMutationRecord } from './client-answer-sync.ts';
import { createRecoveryRecord } from './client-answer-recovery-store.ts';
import type { ClientAnswerRecoveryStore } from './client-answer-recovery-store.ts';

export interface CaptureAutosaveOptions {
  identity: ClientAnswerSyncIdentity;
  localSequence: number;
  answerPayload: unknown;
  clientWriteIdentity: string;
  expectedWriteVersion: number | null;
  store: Pick<ClientAnswerRecoveryStore, 'put'>;
  triggerSync: () => void;
}

export async function captureAutosave(options: CaptureAutosaveOptions): Promise<ClientAnswerMutationRecord> {
  const mutation = createPendingMutation(
    options.identity,
    options.localSequence,
    options.answerPayload,
    options.clientWriteIdentity,
    options.expectedWriteVersion
  );

  const recoveryRecord = createRecoveryRecord(mutation);

  await options.store.put(recoveryRecord);

  options.triggerSync();

  return mutation;
}
