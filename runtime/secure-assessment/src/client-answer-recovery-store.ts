import type { ClientAnswerMutationRecord } from './client-answer-sync.ts';

export interface ClientAnswerRecoveryScope {
  tenantId: string;
  participantId: string;
  examInstanceId: string;
  attemptId: string;
}

export interface ClientAnswerRecoveryRecord {
  readonly recordKey: string;
  readonly scopeKey: string;
  readonly mutation: ClientAnswerMutationRecord;
}

function validateNonEmptyString(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid ${name}: must be a non-empty string`);
  }
}

export function buildRecoveryScopeKey(scope: ClientAnswerRecoveryScope): string {
  validateNonEmptyString(scope.tenantId, 'tenantId');
  validateNonEmptyString(scope.participantId, 'participantId');
  validateNonEmptyString(scope.examInstanceId, 'examInstanceId');
  validateNonEmptyString(scope.attemptId, 'attemptId');

  return JSON.stringify([
    scope.tenantId,
    scope.participantId,
    scope.examInstanceId,
    scope.attemptId
  ]);
}

export function buildRecoveryRecordKey(mutation: ClientAnswerMutationRecord): string {
  validateNonEmptyString(mutation.identity.tenantId, 'tenantId');
  validateNonEmptyString(mutation.identity.participantId, 'participantId');
  validateNonEmptyString(mutation.identity.examInstanceId, 'examInstanceId');
  validateNonEmptyString(mutation.identity.attemptId, 'attemptId');
  validateNonEmptyString(mutation.identity.snapshotId, 'snapshotId');

  if (!Number.isSafeInteger(mutation.localSequence) || mutation.localSequence <= 0) {
    throw new Error('Invalid localSequence: must be a positive safe integer');
  }

  validateNonEmptyString(mutation.clientWriteIdentity, 'clientWriteIdentity');

  return JSON.stringify([
    mutation.identity.tenantId,
    mutation.identity.participantId,
    mutation.identity.examInstanceId,
    mutation.identity.attemptId,
    mutation.identity.snapshotId,
    mutation.localSequence,
    mutation.clientWriteIdentity
  ]);
}

export function createRecoveryRecord(mutation: ClientAnswerMutationRecord): ClientAnswerRecoveryRecord {
  const scopeKey = buildRecoveryScopeKey({
    tenantId: mutation.identity.tenantId,
    participantId: mutation.identity.participantId,
    examInstanceId: mutation.identity.examInstanceId,
    attemptId: mutation.identity.attemptId
  });

  const recordKey = buildRecoveryRecordKey(mutation);

  return {
    recordKey,
    scopeKey,
    mutation: {
      identity: { ...mutation.identity },
      localSequence: mutation.localSequence,
      answerPayload: mutation.answerPayload,
      clientWriteIdentity: mutation.clientWriteIdentity,
      expectedWriteVersion: mutation.expectedWriteVersion,
      syncState: mutation.syncState,
      acceptedWriteVersion: mutation.acceptedWriteVersion
    }
  };
}

export function isRecoveryRecordForScope(record: ClientAnswerRecoveryRecord, scope: ClientAnswerRecoveryScope): boolean {
  return (
    record.mutation.identity.tenantId === scope.tenantId &&
    record.mutation.identity.participantId === scope.participantId &&
    record.mutation.identity.examInstanceId === scope.examInstanceId &&
    record.mutation.identity.attemptId === scope.attemptId
  );
}

export interface ClientAnswerRecoveryStore {
  put(record: ClientAnswerRecoveryRecord): Promise<void>;
  get(recordKey: string): Promise<ClientAnswerRecoveryRecord | null>;
  listByScope(scope: ClientAnswerRecoveryScope): Promise<ClientAnswerRecoveryRecord[]>;
  delete(recordKey: string): Promise<void>;
  clearScope(scope: ClientAnswerRecoveryScope): Promise<void>;
}
