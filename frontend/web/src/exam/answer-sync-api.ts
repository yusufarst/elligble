import { apiFetch } from '../api/http.ts';
import { getResume } from '../api/assessment-client.ts';
import type { ResumeAnswer } from '../types/assessment.ts';
import type { SaveOutcome, ServerAnswerState, SyncApi } from './answer-sync-engine.ts';
import { openAnswerStore, type PendingAnswerRecord } from './answer-store.ts';

// HTTP adapter between the sync engine and POST /api/v1/assessment/answer/save. Every
// response is classified once here so the engine never guesses from raw status codes.

/** The baseline payload is { selectedOptionId }; anything else is not a renderable choice. */
export function selectedOptionOf(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'selectedOptionId' in payload) {
    const value = (payload as { selectedOptionId: unknown }).selectedOptionId;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

export function toServerAnswerState(answer: ResumeAnswer): ServerAnswerState {
  return {
    snapshotId: answer.snapshotId,
    optionId: selectedOptionOf(answer.answerPayload),
    writeVersion: answer.writeVersion,
    clientWriteIdentity: answer.clientWriteIdentity,
  };
}

export function classifySaveFailure(status: number, code: string): SaveOutcome {
  if (status === 401) return { kind: 'unauthorized' };
  if (status === 409) {
    switch (code) {
      case 'stale_write_version':
        return { kind: 'stale' };
      case 'write_identity_reuse_conflict':
        return { kind: 'identity_conflict' };
      case 'session_not_active':
        return { kind: 'session_inactive' };
      case 'attempt_already_submitted':
      case 'timer_expired':
        return { kind: 'terminal', code };
      default:
        return { kind: 'rejected', code };
    }
  }
  // Throttling and server or proxy failures are transient: keep the intent and retry.
  if (status === 429 || status >= 500) return { kind: 'retry' };
  return { kind: 'rejected', code };
}

async function errorCode(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body && typeof body.error === 'string' ? body.error : 'unknown_error';
  } catch {
    return 'unknown_error';
  }
}

export function createAnswerSyncApi(attemptId: string, examSessionId: string): SyncApi {
  return {
    async save(request) {
      let res: Response;
      try {
        res = await apiFetch('/api/v1/assessment/answer/save', {
          method: 'POST',
          json: {
            attemptId: request.attemptId,
            sessionId: request.sessionId,
            snapshotId: request.snapshotId,
            answerPayload: { selectedOptionId: request.optionId },
            clientWriteIdentity: request.clientWriteIdentity,
            expectedWriteVersion: request.expectedWriteVersion,
          },
        });
      } catch {
        return { kind: 'retry' };
      }
      if (!res.ok) return classifySaveFailure(res.status, await errorCode(res));
      try {
        const body = await res.json();
        if (body && typeof body.writeVersion === 'number') {
          return {
            kind: 'ack',
            writeVersion: body.writeVersion,
            clientWriteIdentity: typeof body.clientWriteIdentity === 'string' ? body.clientWriteIdentity : request.clientWriteIdentity,
          };
        }
      } catch {
        // Unreadable acknowledgement: resend; the server recognises the same write identity.
      }
      return { kind: 'retry' };
    },
    async fetchServerAnswers() {
      const resume = await getResume(attemptId, examSessionId);
      return resume.answers.map(toServerAnswerState);
    },
  };
}

/**
 * Choices kept on this device that the server's final answers do not contain. Used once the
 * attempt is final so the student is never told that unsent choices were received (D04.5-48).
 */
export async function countUnreceivedLocalAnswers(tenantId: string, attemptId: string): Promise<number> {
  let records: PendingAnswerRecord[];
  try {
    records = await (await openAnswerStore()).listForAttempt(tenantId, attemptId);
  } catch {
    return 0;
  }
  if (records.length === 0) return 0;
  try {
    const resume = await getResume(attemptId);
    const accepted = new Map(resume.answers.map(answer => [answer.snapshotId, selectedOptionOf(answer.answerPayload)]));
    return records.filter(record => accepted.get(record.snapshotId) !== record.optionId).length;
  } catch {
    return records.length;
  }
}
