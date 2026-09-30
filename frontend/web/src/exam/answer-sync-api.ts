import { apiFetch } from '../api/http.ts';
import { getResume } from '../api/assessment-client.ts';
import type { ResumeAnswer } from '../types/assessment.ts';
import type { SaveOutcome, ServerAnswerState, SyncApi } from './answer-sync-engine.ts';
import { openAnswerStore, type PendingAnswerRecord } from './answer-store.ts';
import { serverClock } from './server-clock.ts';

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

function instantOrNull(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function classifySaveFailure(status: number, code: string, body: Record<string, unknown> = {}): SaveOutcome {
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
      case 'exam_paused':
        // The teacher paused the exam (Owner decision 2026-09-30): the engine keeps what
        // was chosen before the boundary and drops only what was chosen after it.
        return { kind: 'exam_paused', pausedAt: instantOrNull(body.pausedAt) };
      case 'captured_during_pause': {
        const pausedAt = instantOrNull(body.pausedAt);
        if (pausedAt === null) return { kind: 'retry' };
        return { kind: 'captured_during_pause', pausedAt, resumedAt: instantOrNull(body.resumedAt) };
      }
      case 'attempt_locked':
        // A supervisor locked this attempt (D04.6-38): the same boundary rule as a pause.
        return { kind: 'attempt_locked', lockedAt: instantOrNull(body.lockedAt) };
      case 'captured_during_lock': {
        const lockedAt = instantOrNull(body.lockedAt);
        if (lockedAt === null) return { kind: 'retry' };
        return { kind: 'captured_during_lock', lockedAt, unlockedAt: instantOrNull(body.unlockedAt) };
      }
      default:
        return { kind: 'rejected', code };
    }
  }
  // Throttling and server or proxy failures are transient: keep the intent and retry.
  if (status === 429 || status >= 500) return { kind: 'retry' };
  return { kind: 'rejected', code };
}

async function errorBody(res: Response): Promise<Record<string, unknown>> {
  try {
    const body = await res.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

export function createAnswerSyncApi(attemptId: string, examSessionId: string): SyncApi {
  return {
    async save(request) {
      let res: Response;
      const sentAt = Date.now();
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
            capturedAt: new Date(request.capturedAt).toISOString(),
          },
        });
      } catch {
        return { kind: 'retry' };
      }
      const receivedAt = Date.now();
      if (!res.ok) {
        const body = await errorBody(res);
        serverClock.observe(typeof body.serverTime === 'string' ? body.serverTime : null, sentAt, receivedAt);
        return classifySaveFailure(res.status, typeof body.error === 'string' ? body.error : 'unknown_error', body);
      }
      try {
        const body = await res.json();
        serverClock.observe(body && typeof body.serverTime === 'string' ? body.serverTime : null, sentAt, receivedAt);
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
