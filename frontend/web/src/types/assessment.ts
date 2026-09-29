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

/**
 * The active exam session is never disclosed (its id is a device's write capability);
 * the server only says whether the caller's own exam session id is the active one.
 */
export type ResumeSession =
  | { status: 'none' }
  | { status: 'active'; activatedAt: string; ownedByCaller: boolean };

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

export interface ResumeContext {
  subjectLabel: string | null;
  roomLabel: string | null;
}

export interface ResumeResponse {
  attemptId: string;
  session: ResumeSession;
  answers: ResumeAnswer[];
  timer: ResumeTimer;
  submission: ResumeSubmission;
  context: ResumeContext;
  /** Questions the student marked "Ragu-ragu" (D04.5-34); absent from older servers. */
  reviewFlags?: string[];
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

/** Per-question save state shown to the student (Owner-locked labels, see useAnswerManager). */
export type SaveState =
  | { status: 'pristine' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'failed' }
  | { status: 'unsupported_payload' };

export interface SessionActivationRequest {
  attemptId: string;
  sessionId: string;
  /** Opaque fingerprint of the session being taken over, from the 409 active_session_exists. */
  expectedActiveSessionFingerprint?: string;
  confirmSupersede?: boolean;
}

export interface ActiveSessionConflict {
  error: 'active_session_exists';
  activeSessionFingerprint: string;
}

export interface SessionActivationResponse {
  status: 'active';
  sessionId: string;
  activatedAt: string;
  supersededSessionId?: string;
}

export interface TimerStartRequest {
  attemptId: string;
}

export interface TimerStartResponse {
  status: 'started';
  startedAt: string;
  configuredDurationSeconds: number;
  effectiveDurationSeconds: number;
  effectiveRemainingSeconds: number;
}

export interface AssignedExamAttempt {
  attemptId: string;
  submittedAt: string | null;
}

export interface AssignedExamSchedule {
  lifecycleState: string | null;
  windowStartsAt: string | null;
  windowEndsAt: string | null;
  attemptDurationSeconds: number | null;
}

export interface AssignedExamItem {
  examInstanceId: string;
  subjectLabel: string | null;
  roomLabel: string | null;
  schedule?: AssignedExamSchedule;
  attempts: AssignedExamAttempt[];
}

export interface AssignedExamsResponse {
  serverNow?: string;
  assignments: AssignedExamItem[];
}

export interface StartAttemptResponse {
  attemptId: string;
  created: boolean;
}

export interface ProctorMonitoringRoomProjection {
  roomId: string;
  roomLabel: string | null;
  participantCount: number;
  activeSessionCount: number;
}

export interface ProctorMonitoringExamProjection {
  examInstanceId: string;
  subjectLabel: string | null;
  rooms: ProctorMonitoringRoomProjection[];
}

export interface ProctorMonitoringResponse {
  assignments: ProctorMonitoringExamProjection[];
}

export interface TeacherExamBaselineProjection {
  status: 'baseline_readiness_checks_pass' | 'not_ready' | 'invalid_state' | 'denied' | 'unavailable' | 'not_evaluated';
  category?: string;
  blocker?: string;
}

export interface TeacherExamRoomProctorProjection {
  status: 'room_proctor_readiness_ready' | 'room_proctor_readiness_not_applicable' | 'not_ready' | 'invalid_state' | 'denied' | 'unavailable' | 'not_evaluated';
  blocker?: string;
}

export interface TeacherExamProgressProjection {
  participants: number;
  started: number;
  submitted: number;
}

export interface TeacherExamReadinessProjection {
  examInstanceId: string;
  subjectLabel: string | null;
  lifecycleState?: string | null;
  windowStartsAt?: string | null;
  windowEndsAt?: string | null;
  baseline: TeacherExamBaselineProjection;
  roomProctor: TeacherExamRoomProctorProjection;
  progress?: TeacherExamProgressProjection | null;
}

export type TeacherExamAction = 'mark_ready' | 'activate';

export interface TeacherExamTransitionResponse {
  examInstanceId: string;
  lifecycleState: 'READY' | 'ACTIVE';
}

export interface TeacherReadinessResponse {
  exams: TeacherExamReadinessProjection[];
}

export type ParticipantResultStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
export type FinalizationSource = 'STUDENT_SUBMIT' | 'EXPIRY_CLIENT' | 'EXPIRY_SERVER';

export interface ParticipantScore {
  correct: number;
  incorrect: number;
  unanswered: number;
  rawScore: number;
  maxScore: number;
  /** 0 to 100, two decimals, half up. */
  scaledScore: number;
}

export interface ParticipantResult {
  elligbleId: string | null;
  status: ParticipantResultStatus;
  finalizationSource: FinalizationSource | null;
  submittedAt: string | null;
  score: ParticipantScore | null;
}

/** Provisional results of a teacher-managed exam (not finalized, not shown to students). */
export interface TeacherExamResultsResponse {
  exam: {
    examInstanceId: string;
    subjectLabel: string | null;
    groupLabel: string | null;
    assessmentTypeLabel: string | null;
    lifecycleState: string;
    windowStartsAt: string | null;
    windowEndsAt: string | null;
  };
  scoring: { rule: string; available: boolean; questionCount: number; maxScore: number | null };
  resultState: 'PROVISIONAL';
  summary: { participants: number; notStarted: number; inProgress: number; submitted: number };
  participants: ParticipantResult[];
}

export type MonitoringStatus = 'NOT_STARTED' | 'ACTIVE' | 'TIME_UP' | 'SUBMITTED';

export interface MonitoredParticipant {
  elligbleId: string | null;
  roomLabel: string | null;
  status: MonitoringStatus;
  finalizationSource: FinalizationSource | null;
  submittedAt: string | null;
  remainingSeconds: number | null;
  answeredCount: number;
  lastAcceptedAt: string | null;
  sessionActive: boolean;
  sessionMoves: number;
}

/** Exam-day participant list for the assigned proctor or the managing teacher (D04.6). */
export interface ExamMonitoringResponse {
  exam: { examInstanceId: string; subjectLabel: string | null; lifecycleState: string; roomBased: boolean };
  scope: 'PROCTOR' | 'TEACHER';
  serverTime: string;
  questionCount: number;
  summary: { participants: number; notStarted: number; active: number; submitted: number };
  participants: MonitoredParticipant[];
}
