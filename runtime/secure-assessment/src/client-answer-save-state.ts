import { type ClientAnswerMutationRecord, isMutationAcknowledged } from './client-answer-sync.js';

export type ClientAnswerSaveState = 
  | 'saved'
  | 'saving'
  | 'pending'
  | 'offline'
  | 'save_failed';

export function projectClientAnswerSaveState(
  mutation: ClientAnswerMutationRecord,
  isExplicitlyOffline: boolean
): ClientAnswerSaveState {
  
  if (mutation.syncState === 'failed') {
    return 'save_failed';
  }
  
  if (mutation.syncState === 'acknowledged') {
    if (isMutationAcknowledged(mutation)) {
      return 'saved';
    }
    return 'save_failed';
  }
  
  if (isExplicitlyOffline) {
    return 'offline';
  }
  
  if (mutation.syncState === 'in_flight') {
    return 'saving';
  }
  
  return 'pending';
}
