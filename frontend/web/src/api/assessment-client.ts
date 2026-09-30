import type {
  ResumeResponse,
  QuestionsResponse,
  TimerResponse,
  SaveAnswerRequest,
  SaveAnswerResponse,
  SubmitResponse,
  ExpiryFinalizeResponse,
  AssignedExamsResponse,
  ProctorMonitoringResponse,
  TeacherReadinessResponse,
  TeacherExamResultsResponse,
  ExamMonitoringResponse,
  ParticipantLockAction,
  ParticipantLockResponse,
  TimeAdditionInput,
  TimeAdditionResponse,
  BroadcastTarget,
  BroadcastSendResponse,
  BroadcastInboxResponse,
  TeacherExamSetup,
  TeacherExamImportInput,
  TeacherExamImportPreview,
  TeacherExamImportResult,
  TeacherExamPreview,
  TeacherExamRescheduleInput,
  TeacherExamRescheduleResult,
  TeacherExamCancelInput,
  TeacherExamCancelResult,
  TeacherExamParticipantCandidates,
  TeacherExamAddParticipantsInput,
  TeacherExamAddParticipantsResult,
} from '../types/assessment.ts';
import { apiFetch } from './http.ts';
import { observeServerTime } from '../exam/server-clock.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly data?: any;

  constructor(status: number, code: string, message?: string, data?: any) {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorCode = 'unknown_error';
    let data;
    try {
      data = await res.json();
      if (data && typeof data.error === 'string') {
        errorCode = data.error;
      }
    } catch {
      // Body not JSON
    }
    throw new ApiError(res.status, errorCode, undefined, data);
  }
  return res.json() as Promise<T>;
}

/** examSessionId: this tab's own exam session, so the server can say whether it is the active one. */
export async function getResume(attemptId: string, examSessionId?: string | null): Promise<ResumeResponse> {
  let url = `/api/v1/assessment/resume?attemptId=${encodeURIComponent(attemptId)}`;
  if (examSessionId) url += `&examSessionId=${encodeURIComponent(examSessionId)}`;
  return observeServerTime(async () => handleResponse<ResumeResponse>(await apiFetch(url, { method: 'GET' })));
}

export async function getQuestions(attemptId: string): Promise<QuestionsResponse> {
  const url = `/api/v1/assessment/questions?attemptId=${encodeURIComponent(attemptId)}`;
  const res = await apiFetch(url, { method: 'GET' });
  return handleResponse<QuestionsResponse>(res);
}

export async function getTimer(attemptId: string): Promise<TimerResponse> {
  const url = `/api/v1/assessment/timer?attemptId=${encodeURIComponent(attemptId)}`;
  return observeServerTime(async () => handleResponse<TimerResponse>(await apiFetch(url, { method: 'GET' })));
}

export async function postSaveAnswer(req: SaveAnswerRequest): Promise<SaveAnswerResponse> {
  const url = '/api/v1/assessment/answer/save';
  const res = await apiFetch(url, { method: 'POST', json: req });
  return handleResponse<SaveAnswerResponse>(res);
}

export interface ReviewFlagRequest {
  attemptId: string;
  sessionId: string;
  snapshotId: string;
  flagged: boolean;
}

/** Stores the desired "Ragu-ragu" state of one question; repeating it is harmless. */
export async function postReviewFlag(req: ReviewFlagRequest): Promise<{ snapshotId: string; flagged: boolean }> {
  const url = '/api/v1/assessment/review-flag';
  const res = await apiFetch(url, { method: 'POST', json: req });
  return handleResponse<{ snapshotId: string; flagged: boolean }>(res);
}

export async function postSubmit(attemptId: string): Promise<SubmitResponse> {
  const url = '/api/v1/assessment/submit';
  const res = await apiFetch(url, { method: 'POST', json: { attemptId } });
  return handleResponse<SubmitResponse>(res);
}

export async function postExpiryFinalize(attemptId: string): Promise<ExpiryFinalizeResponse> {
  const url = '/api/v1/assessment/expiry-finalize';
  const res = await apiFetch(url, { method: 'POST', json: { attemptId } });
  return handleResponse<ExpiryFinalizeResponse>(res);
}

export async function postActivateSession(req: import('../types/assessment.ts').SessionActivationRequest): Promise<import('../types/assessment.ts').SessionActivationResponse> {
  const url = '/api/v1/assessment/session/activate';
  const res = await apiFetch(url, { method: 'POST', json: req });
  return handleResponse<import('../types/assessment.ts').SessionActivationResponse>(res);
}

export async function postStartTimer(req: import('../types/assessment.ts').TimerStartRequest): Promise<import('../types/assessment.ts').TimerStartResponse> {
  const url = '/api/v1/assessment/timer/start';
  const res = await apiFetch(url, { method: 'POST', json: req });
  return handleResponse<import('../types/assessment.ts').TimerStartResponse>(res);
}

export async function postStartAttempt(examInstanceId: string): Promise<import('../types/assessment.ts').StartAttemptResponse> {
  const url = '/api/v1/assessment/attempts/start';
  const res = await apiFetch(url, { method: 'POST', json: { examInstanceId } });
  return handleResponse<import('../types/assessment.ts').StartAttemptResponse>(res);
}

export async function getAssignedExams(): Promise<AssignedExamsResponse> {
  const url = '/api/v1/assessment/assigned-exams';
  const res = await apiFetch(url, { method: 'GET' });
  return handleResponse<AssignedExamsResponse>(res);
}

export async function getProctorMonitoring(): Promise<ProctorMonitoringResponse> {
  const url = '/api/v1/assessment/proctor-monitoring';
  const res = await apiFetch(url, { method: 'GET' });
  return handleResponse<ProctorMonitoringResponse>(res);
}

export async function postTeacherExamTransition(
  examInstanceId: string,
  action: import('../types/assessment.ts').TeacherExamAction
): Promise<import('../types/assessment.ts').TeacherExamTransitionResponse> {
  const url = '/api/v1/assessment/teacher-exams/transition';
  const res = await apiFetch(url, { method: 'POST', json: { examInstanceId, action } });
  return handleResponse<import('../types/assessment.ts').TeacherExamTransitionResponse>(res);
}

export async function getTeacherReadiness(): Promise<TeacherReadinessResponse> {
  const url = '/api/v1/assessment/teacher-readiness';
  const res = await apiFetch(url, { method: 'GET' });
  return handleResponse<TeacherReadinessResponse>(res);
}

export async function getExamMonitoring(examInstanceId: string): Promise<ExamMonitoringResponse> {
  const url = `/api/v1/assessment/exam-monitoring?examInstanceId=${encodeURIComponent(examInstanceId)}`;
  const res = await apiFetch(url, { method: 'GET' });
  return handleResponse<ExamMonitoringResponse>(res);
}

export async function postParticipantLock(
  examInstanceId: string,
  participantId: string,
  action: ParticipantLockAction
): Promise<ParticipantLockResponse> {
  const url = '/api/v1/assessment/exam-monitoring/participant-lock';
  const res = await apiFetch(url, { method: 'POST', json: { examInstanceId, participantId, action } });
  return handleResponse<ParticipantLockResponse>(res);
}

/** Adds working time for one participant; a retry with the same action key adds nothing twice. */
export async function postParticipantTime(input: TimeAdditionInput): Promise<TimeAdditionResponse> {
  const res = await apiFetch('/api/v1/assessment/exam-monitoring/add-time', { method: 'POST', json: input });
  return handleResponse<TimeAdditionResponse>(res);
}

export async function postBroadcast(examInstanceId: string, target: BroadcastTarget, message: string): Promise<BroadcastSendResponse> {
  const url = '/api/v1/assessment/exam-monitoring/broadcast';
  const res = await apiFetch(url, { method: 'POST', json: { examInstanceId, target, message } });
  return handleResponse<BroadcastSendResponse>(res);
}

/** The student's supervisor messages; `received` confirms the ones this device already holds. */
export async function postBroadcastInbox(attemptId: string, received: string[] = []): Promise<BroadcastInboxResponse> {
  const url = '/api/v1/assessment/broadcasts/inbox';
  const res = await apiFetch(url, { method: 'POST', json: { attemptId, received } });
  return handleResponse<BroadcastInboxResponse>(res);
}

export async function getTeacherExamResults(examInstanceId: string): Promise<TeacherExamResultsResponse> {
  const url = `/api/v1/assessment/teacher-exams/results?examInstanceId=${encodeURIComponent(examInstanceId)}`;
  const res = await apiFetch(url, { method: 'GET' });
  return handleResponse<TeacherExamResultsResponse>(res);
}

/** The teacher's own classes, the school's assessment types and time zone, for a new exam. */
export async function getTeacherExamSetup(): Promise<TeacherExamSetup> {
  const res = await apiFetch('/api/v1/assessment/teacher-exams/setup', { method: 'GET' });
  return handleResponse<TeacherExamSetup>(res);
}

/** Cancels a scheduled or ready exam; repeating it is safe (the same key, or an exam already cancelled). */
export async function getTeacherExamParticipantCandidates(examInstanceId: string): Promise<TeacherExamParticipantCandidates> {
  const url = `/api/v1/assessment/teacher-exams/participants/candidates?examInstanceId=${encodeURIComponent(examInstanceId)}`;
  const res = await apiFetch(url, { method: 'GET' });
  return handleResponse<TeacherExamParticipantCandidates>(res);
}

export async function postTeacherExamAddParticipants(input: TeacherExamAddParticipantsInput): Promise<TeacherExamAddParticipantsResult> {
  const res = await apiFetch('/api/v1/assessment/teacher-exams/participants/add', { method: 'POST', json: input });
  return handleResponse<TeacherExamAddParticipantsResult>(res);
}

export async function postTeacherExamCancel(input: TeacherExamCancelInput): Promise<TeacherExamCancelResult> {
  const res = await apiFetch('/api/v1/assessment/teacher-exams/cancel', { method: 'POST', json: input });
  return handleResponse<TeacherExamCancelResult>(res);
}

/** Moves a scheduled or ready exam before it opens; a retry with the same action key changes nothing twice. */
export async function postTeacherExamReschedule(input: TeacherExamRescheduleInput): Promise<TeacherExamRescheduleResult> {
  const res = await apiFetch('/api/v1/assessment/teacher-exams/reschedule', { method: 'POST', json: input });
  return handleResponse<TeacherExamRescheduleResult>(res);
}

/** Checks the question file and the schedule without keeping anything. */
export async function postTeacherExamImportPreview(input: TeacherExamImportInput): Promise<TeacherExamImportPreview> {
  const res = await apiFetch('/api/v1/assessment/teacher-exams/import/preview', { method: 'POST', json: input });
  return handleResponse<TeacherExamImportPreview>(res);
}

/**
 * Schedules the previewed exam. `importKey` names this confirmation: sending it again (after
 * a timeout) returns the exam already created. A 422 carries the problems (ApiError.data).
 */
export async function postTeacherExamImport(
  input: TeacherExamImportInput,
  confirmation: { importKey: string; expectedSha256: string }
): Promise<TeacherExamImportResult> {
  const res = await apiFetch('/api/v1/assessment/teacher-exams/import', { method: 'POST', json: { ...input, ...confirmation } });
  return handleResponse<TeacherExamImportResult>(res);
}

/** The questions of a scheduled or ready exam as students will receive them; writes nothing. */
export async function getTeacherExamPreview(examInstanceId: string): Promise<TeacherExamPreview> {
  const url = `/api/v1/assessment/teacher-exams/preview?examInstanceId=${encodeURIComponent(examInstanceId)}`;
  const res = await apiFetch(url, { method: 'GET' });
  return handleResponse<TeacherExamPreview>(res);
}
