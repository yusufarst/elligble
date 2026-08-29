export interface ClientAnswerSyncIdentity {
  tenantId: string;
  participantId: string;
  examInstanceId: string;
  attemptId: string;
  snapshotId: string;
}

export type ClientAnswerSyncState = 'pending' | 'in_flight' | 'acknowledged' | 'failed';

export interface ClientAnswerMutationRecord {
  readonly identity: ClientAnswerSyncIdentity;
  readonly localSequence: number;
  readonly answerPayload: unknown;
  readonly clientWriteIdentity: string;
  readonly expectedWriteVersion: number | null;
  readonly syncState: ClientAnswerSyncState;
  readonly acceptedWriteVersion: number | null;
}

export interface AuthoritativeAcknowledgement {
  status: 'acknowledged';
  clientWriteIdentity: string;
  writeVersion: number;
}

function validateNonEmptyString(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid ${name}: must be a non-empty string`);
  }
}

export function buildSyncKey(identity: ClientAnswerSyncIdentity): string {
  validateNonEmptyString(identity.tenantId, 'tenantId');
  validateNonEmptyString(identity.participantId, 'participantId');
  validateNonEmptyString(identity.examInstanceId, 'examInstanceId');
  validateNonEmptyString(identity.attemptId, 'attemptId');
  validateNonEmptyString(identity.snapshotId, 'snapshotId');

  return `${identity.tenantId}:${identity.participantId}:${identity.examInstanceId}:${identity.attemptId}:${identity.snapshotId}`;
}

export function createPendingMutation(
  identity: ClientAnswerSyncIdentity,
  localSequence: number,
  answerPayload: unknown,
  clientWriteIdentity: string,
  expectedWriteVersion: number | null
): ClientAnswerMutationRecord {
  buildSyncKey(identity); // validates identity

  if (!Number.isSafeInteger(localSequence) || localSequence <= 0) {
    throw new Error('Invalid localSequence: must be a positive safe integer');
  }

  validateNonEmptyString(clientWriteIdentity, 'clientWriteIdentity');
  if (clientWriteIdentity.length > 255) {
    throw new Error('Invalid clientWriteIdentity: maximum 255 characters');
  }

  if (expectedWriteVersion !== null && (!Number.isSafeInteger(expectedWriteVersion) || expectedWriteVersion <= 0 || expectedWriteVersion > 2147483647)) {
    throw new Error('Invalid expectedWriteVersion: must be null or a positive integer <= 2147483647');
  }

  return {
    identity: { ...identity },
    localSequence,
    answerPayload,
    clientWriteIdentity,
    expectedWriteVersion,
    syncState: 'pending',
    acceptedWriteVersion: null
  };
}

export function transitionToInFlight(mutation: ClientAnswerMutationRecord): ClientAnswerMutationRecord {
  if (mutation.syncState !== 'pending') {
    throw new Error('Cannot transition to in_flight: mutation must be pending');
  }
  return {
    ...mutation,
    syncState: 'in_flight'
  };
}

export function markMutationFailed(mutation: ClientAnswerMutationRecord): ClientAnswerMutationRecord {
  return {
    ...mutation,
    syncState: 'failed'
  };
}

export function applyAuthoritativeAcknowledgement(
  mutation: ClientAnswerMutationRecord,
  acknowledgement: AuthoritativeAcknowledgement
): ClientAnswerMutationRecord {
  if (mutation.syncState === 'acknowledged' &&
      mutation.clientWriteIdentity === acknowledgement.clientWriteIdentity &&
      mutation.acceptedWriteVersion === acknowledgement.writeVersion) {
    return mutation;
  }

  if (mutation.syncState === 'failed') {
    return mutation;
  }

  if (mutation.clientWriteIdentity !== acknowledgement.clientWriteIdentity) {
    return mutation;
  }

  if (!Number.isSafeInteger(acknowledgement.writeVersion) || acknowledgement.writeVersion <= 0) {
    return mutation;
  }

  return {
    ...mutation,
    syncState: 'acknowledged',
    acceptedWriteVersion: acknowledgement.writeVersion
  };
}

export function isMutationAcknowledged(mutation: ClientAnswerMutationRecord): boolean {
  return mutation.syncState === 'acknowledged' && mutation.acceptedWriteVersion !== null;
}
