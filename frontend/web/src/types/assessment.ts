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
  /** The latest change of the schedule before the exam opened (D04.2-45), or null. */
  change?: ScheduleChange | null;
}

export interface ScheduleChange {
  changedAt: string;
  previousWindowStartsAt: string | null;
  previousWindowEndsAt: string | null;
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
  windowStartsAt?: string | null;
  windowEndsAt?: string | null;
  /** The latest change of the schedule before the exam opened (D04.2-45), or null. */
  scheduleChange?: ScheduleChange | null;
  /** When the exam was cancelled before it opened, or null. */
  cancelledAt?: string | null;
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
  /** Class and assessment type, so exams of one subject stay apart. */
  groupLabel?: string | null;
  assessmentTypeLabel?: string | null;
  lifecycleState?: string | null;
  windowStartsAt?: string | null;
  windowEndsAt?: string | null;
  /** Working time per attempt and the late-start rule, as scheduled. */
  durationMinutes?: number | null;
  latestStartPolicy?: LatestStartPolicy | null;
  /** When the schedule was last changed before the exam opened, or null. */
  scheduleChangedAt?: string | null;
  /** How many students take part. */
  participants?: number;
  /** When participants were last added after scheduling, or null. */
  participantsAddedAt?: string | null;
  /** The cancellation of an exam that never opened, or null (shown as "Dibatalkan"). */
  cancellation?: { cancelledAt: string; reason: string; by: { you: boolean; elligbleId: string | null } } | null;
  baseline: TeacherExamBaselineProjection;
  roomProctor: TeacherExamRoomProctorProjection;
  progress?: TeacherExamProgressProjection | null;
  /** Start of the open pause while the exam is PAUSED. */
  pausedAt?: string | null;
  /** When the results were finalized (FINALIZED only). */
  finalizedAt?: string | null;
}

export type TeacherExamAction = 'mark_ready' | 'activate' | 'pause' | 'resume' | 'end' | 'finalize';

/** Cancelling a scheduled or ready exam (ASSESS-TEACHER-003, Owner decision 2026-09-30). */
export type ExamAdditionProblemCode = 'time_zone_missing' | 'window_missing' | 'rooms_in_use';
export type ParticipantAdditionProblemCode = ExamAdditionProblemCode | 'not_enrolled' | 'already_participant' | 'schedule_conflict';

/** Students of the exam's class on the exam day who are not participants yet (ASSESS-TEACHER-004). */
export interface TeacherExamParticipantCandidates {
  examInstanceId: string;
  lifecycleState: string;
  examDay: string | null;
  participantCount: number;
  candidates: Array<{
    enrollmentId: string;
    elligbleId: string;
    /** Already expected in another exam at an overlapping time: cannot be added. */
    conflict: boolean;
  }>;
  /** Why nobody can be added to this exam now, or empty. */
  problems: Array<{ code: ExamAdditionProblemCode }>;
}

export interface TeacherExamAddParticipantsInput {
  examInstanceId: string;
  enrollmentIds: string[];
  /** Chosen by the device once per dialog; a retry reuses it. */
  actionKey: string;
}

export interface TeacherExamAddParticipantsResult {
  examInstanceId: string;
  /** SCHEDULED after an addition: a ready exam is marked ready again. */
  lifecycleState: string;
  addedAt: string;
  added: Array<{ enrollmentId: string; elligbleId: string | null }>;
  replayed: boolean;
}

export interface TeacherExamCancelInput {
  examInstanceId: string;
  reason: string;
  /** Chosen by the device once per dialog; a retry reuses it. */
  actionKey: string;
}

export interface TeacherExamCancelResult {
  examInstanceId: string;
  cancelledAt: string;
  reason: string;
  /** False when the exam had already been cancelled: nothing new was recorded. */
  changed: boolean;
  replayed: boolean;
}

/** A new schedule for a scheduled or ready exam (ASSESS-TEACHER-003, D04.2-45). */
export interface TeacherExamRescheduleInput {
  examInstanceId: string;
  /** Wall-clock date and time in the school's zone, `YYYY-MM-DDTHH:MM`. */
  windowStartsAt: string;
  windowEndsAt: string;
  durationMinutes: number;
  latestStartPolicy: LatestStartPolicy;
  /** Chosen by the device once per dialog; a retry reuses it. */
  actionKey: string;
}

export type RescheduleProblemCode =
  | 'time_zone_missing' | 'window_invalid' | 'window_order' | 'window_ended' | 'duration_invalid'
  | 'duration_exceeds_window' | 'schedule_conflict' | 'proctor_schedule_conflict';

export interface TeacherExamRescheduleResult {
  examInstanceId: string;
  lifecycleState: string;
  schedule: { windowStartsAt: string; windowEndsAt: string; durationMinutes: number; latestStartPolicy: LatestStartPolicy };
  /** False when the exam already had this schedule: nothing was recorded. */
  changed: boolean;
  replayed: boolean;
  changedAt: string | null;
}

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
  /** Working time added to the participant's attempt, in seconds (D04.6-41). */
  addedSeconds?: number;
  /** Each addition, oldest first; only for the managing teacher. */
  timeAdditions?: TimeAddition[];
}

export interface TimeAddition {
  addedAt: string;
  seconds: number;
  reason: string;
  by: { elligbleId: string | null; you: boolean };
}

/** One addition of working time for one participant (ASSESS-PROCTOR-004). */
export interface TimeAdditionInput {
  examInstanceId: string;
  participantId: string;
  minutes: number;
  reason: string;
  /** Chosen by the device once per intended addition; a retry reuses it. */
  actionKey: string;
}

export interface TimeAdditionResponse {
  participantId: string;
  addedSeconds: number;
  totalAddedSeconds: number;
  remainingSeconds: number;
  addedAt: string;
  /** The key had already added this time: nothing new was recorded. */
  replayed: boolean;
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
  /** The viewer manages the exam and may add time (ASSESS-PROCTOR-004). */
  canAddTime?: boolean;
  serverTime: string;
  questionCount: number;
  summary: { participants: number; notStarted: number; active: number; submitted: number };
  participants: MonitoredParticipant[];
  /** Rooms of a room-based exam within the viewer's scope. */
  rooms?: Array<{ roomId: string; label: string }>;
  /** Messages that reached participants in the viewer's scope, newest first. */
  broadcasts?: BroadcastRecord[];
}

// Teacher question import and scheduling (ASSESS-TEACHER-001).

export type LatestStartPolicy = 'FULL_DURATION_BEYOND_WINDOW' | 'REMAINING_WINDOW_ONLY' | 'LATE_START_BLOCKED';

export interface TeacherExamSetup {
  /** The school's time zone; exam times are entered and shown in it. */
  timeZone: string | null;
  teachingAssignments: Array<{ teachingAssignmentId: string; subjectLabel: string; groupLabel: string; periodLabel: string }>;
  assessmentTypes: Array<{ assessmentTypeId: string; label: string }>;
  limits: { maxQuestions: number; maxQuestionScore: number; maxFileCharacters: number; maxDurationMinutes: number };
}

export interface TeacherExamImportInput {
  teachingAssignmentId: string;
  assessmentTypeId: string;
  /** Wall-clock date and time in the school's zone, `YYYY-MM-DDTHH:MM`. */
  windowStartsAt: string;
  windowEndsAt: string;
  durationMinutes: number;
  latestStartPolicy: LatestStartPolicy;
  questionsCsv: string;
  sourceFileName: string | null;
  /** null: everyone enrolled on the exam day. */
  participantEnrollmentIds: string[] | null;
}

export type QuestionProblemCode =
  | 'not_text' | 'encoding_invalid' | 'csv_syntax' | 'header_invalid' | 'file_empty' | 'too_many_questions'
  | 'column_count' | 'number_out_of_order' | 'prompt_empty' | 'option_empty' | 'options_duplicate'
  | 'correct_multiple' | 'correct_invalid' | 'score_invalid';

export type SetupProblemCode =
  | 'file_too_large' | 'time_zone_missing' | 'window_invalid' | 'window_order' | 'window_ended' | 'duration_invalid'
  | 'duration_exceeds_window' | 'assessment_type_unknown' | 'participant_not_enrolled' | 'no_participants'
  | 'schedule_conflict' | 'not_ready';

export type ImportProblem =
  | { source: 'file'; code: QuestionProblemCode; line: number | null; expected?: number; found?: number; letters?: string[] }
  | { source: 'setup'; code: SetupProblemCode; count?: number; blocker?: string };

export interface TeacherExamImportPreview {
  sourceSha256: string;
  problems: ImportProblem[];
  questions: Array<{ line: number; no: number; prompt: string; options: string[]; correct: string; score: number }>;
  participants: Array<{ enrollmentId: string; elligbleId: string; included: boolean; conflict: boolean }>;
  window: { startsAt: string; endsAt: string } | null;
  totals: { questions: number; maxScore: number; participants: number };
}

export interface TeacherExamImportResult {
  examInstanceId: string;
  replayed: boolean;
  questionCount: number;
  participantCount: number;
}

/** The managing teacher's preview of a scheduled or ready exam (ASSESS-TEACHER-002). */
export interface TeacherExamPreview {
  exam: {
    examInstanceId: string;
    subjectLabel: string | null;
    groupLabel: string | null;
    assessmentTypeLabel: string | null;
    lifecycleState: string;
    windowStartsAt: string | null;
    windowEndsAt: string | null;
    durationMinutes: number | null;
  };
  questions: Array<{
    snapshotId: string;
    no: number;
    prompt: string;
    options: Array<{ id: string; content: string }>;
    correctOptionId: string | null;
    maxScore: number | null;
    valid: boolean;
  }>;
}
