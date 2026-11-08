import { apiFetch } from '../api/http.ts';
import { getResume } from '../api/assessment-client.ts';
import { ESSAY_KEY, SHORT_ANSWER_KEY, isShortText, MATCHING_KEY, MULTIPLE_RESPONSE_KEY, NUMERIC_ANSWER_KEY, ORDERING_KEY, isEssayText, isNumericText, orderOf, QUESTION_TYPES_HEADER, SUPPORTED_QUESTION_TYPES, TRUE_FALSE_KEY, V1_SINGLE_CHOICE_KEY, answerValueOf, isEmptyValue, pairsOf, selectionOf, type ResumeAnswer } from '../types/assessment.ts';
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

function payloadFor(contentKey: string, value: string): Record<string, unknown> | null {
  if (contentKey === V1_SINGLE_CHOICE_KEY) return { selectedOptionId: value };
  if (contentKey === MULTIPLE_RESPONSE_KEY) {
    const ids = selectionOf(value);
    return ids ? { selectedOptionIds: ids } : null;
  }
  // True/false: only the canonical "true" or "false" is ever sent.
  if (contentKey === TRUE_FALSE_KEY) return value === 'true' ? { value: true } : value === 'false' ? { value: false } : null;
  // Numeric answer: only "" or a valid number is ever sent, as typed (D1).
  if (contentKey === NUMERIC_ANSWER_KEY) return value === '' || isNumericText(value) ? { numericText: value } : null;
  // Essay: only "" or valid text is ever sent, exactly as written (ASSESS-QUESTION-008 D2).
  if (contentKey === ESSAY_KEY) return isEssayText(value) ? { essayText: value } : null;
  // Short answer: only "" or valid one-line text is ever sent, exactly as typed (ASSESS-QUESTION-006 D2).
  if (contentKey === SHORT_ANSWER_KEY) return isShortText(value) ? { shortText: value } : null;
  // Ordering: only a canonical id list is ever sent; the server checks it is every item once.
  if (contentKey === ORDERING_KEY) {
    const ids = orderOf(value);
    return ids ? { orderedItemIds: ids } : null;
  }
  // Matching: only a canonical pair list is ever sent.
  if (contentKey === MATCHING_KEY) {
    const pairs = pairsOf(value);
    return pairs ? { pairs: pairs.map(([leftId, rightId]) => ({ leftId, rightId })) } : null;
  }
  return null;
}

export function toServerAnswerState(answer: ResumeAnswer): ServerAnswerState {
  return {
    snapshotId: answer.snapshotId,
    optionId: answerValueOf(answer.answerPayload),
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
        // was chosen before the boundary and drops only what was chosen after it. The
        // server time orders this answer against other answers about the exam state.
        return { kind: 'exam_paused', pausedAt: instantOrNull(body.pausedAt), serverTime: instantOrNull(body.serverTime) };
      case 'captured_during_pause': {
        const pausedAt = instantOrNull(body.pausedAt);
        if (pausedAt === null) return { kind: 'retry' };
        return { kind: 'captured_during_pause', pausedAt, resumedAt: instantOrNull(body.resumedAt) };
      }
      case 'attempt_locked':
        // A supervisor locked this attempt (D04.6-38): the same boundary rule as a pause.
        return { kind: 'attempt_locked', lockedAt: instantOrNull(body.lockedAt), serverTime: instantOrNull(body.serverTime) };
      case 'captured_during_lock': {
        const lockedAt = instantOrNull(body.lockedAt);
        if (lockedAt === null) return { kind: 'retry' };
        return { kind: 'captured_during_lock', lockedAt, unlockedAt: instantOrNull(body.unlockedAt) };
      }
      // A01-4: the server cannot accept this question's content version; never retried.
      case 'question_type_unsupported':
        return { kind: 'rejected', code };
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
      // The payload follows the question's content key; anything else is never sent.
      if (!SUPPORTED_QUESTION_TYPES.includes(request.contentKey)) return { kind: 'rejected', code: 'question_type_unsupported' };
      const answerPayload = payloadFor(request.contentKey, request.optionId);
      if (!answerPayload) return { kind: 'rejected', code: 'invalid_answer_payload' };
      let res: Response;
      const sentAt = Date.now();
      try {
        res = await apiFetch('/api/v1/assessment/answer/save', {
          method: 'POST',
          headers: { [QUESTION_TYPES_HEADER]: SUPPORTED_QUESTION_TYPES.join(',') },
          json: {
            attemptId: request.attemptId,
            sessionId: request.sessionId,
            snapshotId: request.snapshotId,
            answerPayload,
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
    const accepted = new Map(resume.answers.map(answer => [answer.snapshotId, answerValueOf(answer.answerPayload)]));
    // A cleared multiple-response or matching answer is received when the server holds it or
    // holds nothing: both are unanswered (ASSESS-QUESTION-002 §4A.4, ASSESS-QUESTION-004 §4A.3).
    return records.filter(record => {
      const server = accepted.get(record.snapshotId);
      if (isEmptyValue(record.contentKey ?? V1_SINGLE_CHOICE_KEY, record.optionId) && (server === undefined || server === record.optionId)) return false;
      return server !== record.optionId;
    }).length;
  } catch {
    return records.length;
  }
}
