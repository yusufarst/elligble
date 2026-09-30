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
  /** Exam state: PAUSED freezes the time (Owner decision 2026-09-30); absent from older servers. */
  exam?: { lifecycleState: string | null; pausedAt: string | null };
  /** A supervisor's lock of this attempt (D04.6-38); lockedAt null when not locked. */
  lock?: { lockedAt: string | null };
  serverTime?: string;
}

/** Exam state and server time reported beside the timer (absent from older servers). */
export interface ExamRunInfo {
  examState?: string | null;
  pausedAt?: string | null;
  /** Since when a supervisor has locked this attempt, or null. */
  lockedAt?: string | null;
  serverTime?: string;
}

export interface TimerResponse extends ExamRunInfo {
  status: 'active' | 'expired';
  startedAt: string;
  configuredDurationSeconds: number;
  effectiveDurationSeconds: number;
  effectiveRemainingSeconds: number;
  /** How many supervisor messages the student has (the device fetches them when this grows). */
  messageCount?: number;
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

export interface TimerStartResponse extends ExamRunInfo {
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
  /** Started, not submitted and with working time left (still running after END too). */
  running?: number;
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
  /** Start of the open pause while the exam is PAUSED. */
  pausedAt?: string | null;
  /** When the results were finalized (FINALIZED only). */
  finalizedAt?: string | null;
}

export type TeacherExamAction = 'mark_ready' | 'activate' | 'pause' | 'resume' | 'end' | 'finalize';

export interface TeacherExamTransitionResponse {
  examInstanceId: string;
  lifecycleState: string;
  /** False when the action had already taken effect (pause, resume and end are idempotent). */
  changed?: boolean;
}

export interface TeacherReadinessResponse {
  exams: TeacherExamReadinessProjection[];
}

/** ABSENT: in finalized results, a participant who did not work on the exam (not a zero). */
export type ParticipantResultStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'ABSENT';
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

/** Results of a teacher-managed exam: provisional, or frozen once finalized; never shown to students. */
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
  resultState: 'PROVISIONAL' | 'FINAL';
  /** When the results were finalized (FINAL only). */
  finalizedAt?: string | null;
  summary: { participants: number; notStarted: number; inProgress: number; submitted: number };
  participants: ParticipantResult[];
}

export type MonitoringStatus = 'NOT_STARTED' | 'ACTIVE' | 'TIME_UP' | 'SUBMITTED';

export interface MonitoredParticipant {
  /** Reference for supervisor actions on this participant (lock, unlock). */
  participantId: string;
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
  /** Since when a supervisor has locked the participant's attempt (D04.6-38), or null. */
  lockedAt: string | null;
}

export type ParticipantLockAction = 'lock' | 'unlock';

/** Outcome of a lock or unlock; repeating an action changes nothing (changed false). */
export interface ParticipantLockResponse {
  participantId: string;
  locked: boolean;
  changed: boolean;
  lockedAt: string | null;
}

/** Where a supervisor's message goes (D04.6-49): the entire exam, one room or selected participants. */
export type BroadcastTarget =
  | { scope: 'EXAM' }
  | { scope: 'ROOM'; roomId: string }
  | { scope: 'PARTICIPANTS'; participantIds: string[] };

/** A sent message as supervisors see it: counts within the viewer's scope; delivered is not read (D04.6-53). */
export interface BroadcastRecord {
  broadcastId: string;
  sentAt: string;
  sender: { elligbleId: string | null; you: boolean };
  target: { scope: 'EXAM' | 'ROOM' | 'PARTICIPANTS'; roomLabel: string | null };
  message: string;
  recipients: number;
  delivered: number;
}

export interface BroadcastSendResponse {
  broadcastId: string;
  sentAt: string;
  recipients: number;
}

/** A supervisor message as the student's device receives it. */
export interface InboxMessage {
  id: string;
  text: string;
  sentAt: string;
}

export interface BroadcastInboxResponse {
  /** Newest first, at most 50. */
  messages: InboxMessage[];
  /** How many messages the student has in all. */
  total: number;
  serverTime: string;
}

/** Exam-day participant list for the assigned proctor or the managing teacher (D04.6). */
export interface ExamMonitoringResponse {
  exam: { examInstanceId: string; subjectLabel: string | null; lifecycleState: string; roomBased: boolean; pausedAt?: string | null };
  scope: 'PROCTOR' | 'TEACHER';
  serverTime: string;
  questionCount: number;
  summary: { participants: number; notStarted: number; active: number; submitted: number };
  participants: MonitoredParticipant[];
  /** Rooms of a room-based exam within the viewer's scope. */
  rooms?: Array<{ roomId: string; label: string }>;
  /** Messages that reached participants in the viewer's scope, newest first. */
  broadcasts?: BroadcastRecord[];
}
