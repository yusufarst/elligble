export interface StudentSafeOption {
  id: string;
  content: string;
}

export interface StudentSafeQuestion {
  snapshotId: string;
  schemaVersion: number;
  questionType: 'MULTIPLE_CHOICE_SINGLE';
  prompt: string;
  options: StudentSafeOption[];
}

export interface QuestionsResponse {
  attemptId: string;
  questions: StudentSafeQuestion[];
}

export type ResumeSession =
  | { status: 'none' }
  | { status: 'active'; sessionId: string; activatedAt: string };

export interface ResumeAnswer {
  snapshotId: string;
  answerPayload: unknown;
  clientWriteIdentity: string | null;
  writeVersion: number;
  updatedAt: string;
}

export type ResumeTimer =
  | null
  | { status: 'not_started' }
  | {
      status: 'active';
      startedAt: string;
      configuredDurationSeconds: number;
      effectiveDurationSeconds: number;
      effectiveRemainingSeconds: number;
    };

export type ResumeSubmission =
  | null
  | { status: 'not_submitted' }
  | {
      status: 'submitted';
      submissionId: string;
      submittedAt: string;
    };

export interface ResumeResponse {
  attemptId: string;
  session: ResumeSession;
  answers: ResumeAnswer[];
  timer: ResumeTimer;
  submission: ResumeSubmission;
}

export interface TimerResponse {
  status: 'active' | 'expired';
  startedAt: string;
  configuredDurationSeconds: number;
  effectiveDurationSeconds: number;
  effectiveRemainingSeconds: number;
}

export interface SaveAnswerPayload {
  selectedOptionId: string;
}

export interface SaveAnswerRequest {
  attemptId: string;
  sessionId: string;
  snapshotId: string;
  answerPayload: SaveAnswerPayload;
  clientWriteIdentity: string;
  expectedWriteVersion: number | null;
}

export interface SaveAnswerResponse {
  status: 'acknowledged';
  clientWriteIdentity: string;
  writeVersion: number;
}

export interface SubmitResponse {
  status: 'submitted';
  submissionId: string;
  submittedAt: string;
}

export interface ExpiryFinalizeResponse {
  status: 'submitted';
  submissionId: string;
  submittedAt: string;
}

export type SaveState =
  | { status: 'pristine' }
  | { status: 'saving'; clientWriteIdentity: string; pendingOptionId: string }
  | { status: 'saved'; writeVersion: number; acknowledgedOptionId: string }
  | { status: 'failed'; error: string; pendingOptionId: string }
  | { status: 'unsupported_payload' };
