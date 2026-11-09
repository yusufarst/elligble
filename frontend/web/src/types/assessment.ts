/** Explicit staff confirmation; one key is retained for the same intended action. */
export interface PermissionIntent { reason: string; confirmed: true; actionKey: string }

export interface StudentSafeOption {
  id: string;
  content: string;
}

/**
 * Versioned question content key "<schemaVersion>:<questionType>" (ASSESS-QUESTION-001, A01-4).
 * The client declares the keys it renders; the server refuses any other key explicitly.
 */
export type QuestionContentKey = string;
export const V1_SINGLE_CHOICE_KEY: QuestionContentKey = '1:MULTIPLE_CHOICE_SINGLE';
/** Multiple response, "pilihan ganda kompleks" (ASSESS-QUESTION-002). */
export const MULTIPLE_RESPONSE_KEY: QuestionContentKey = '2:MULTIPLE_RESPONSE';
/** True/false, "Benar/Salah" (ASSESS-QUESTION-003). */
export const TRUE_FALSE_KEY: QuestionContentKey = '2:TRUE_FALSE';
/** Matching, "Menjodohkan" (ASSESS-QUESTION-004). */
export const MATCHING_KEY: QuestionContentKey = '2:MATCHING';
/** Ordering, "Mengurutkan" (ASSESS-QUESTION-005). */
export const ORDERING_KEY: QuestionContentKey = '2:ORDERING';
/** Numeric answer, "Isian angka" (ASSESS-QUESTION-007). */
export const NUMERIC_ANSWER_KEY: QuestionContentKey = '2:NUMERIC_ANSWER';
/** Essay, "Esai" (ASSESS-QUESTION-008). */
export const ESSAY_KEY: QuestionContentKey = '2:ESSAY';
/** Short answer, "Isian singkat" (ASSESS-QUESTION-006). */
export const SHORT_ANSWER_KEY: QuestionContentKey = '2:SHORT_ANSWER';
/** The content keys this client renders and saves; sent as the X-Question-Types header. */
export const SUPPORTED_QUESTION_TYPES: readonly QuestionContentKey[] = Object.freeze([V1_SINGLE_CHOICE_KEY, MULTIPLE_RESPONSE_KEY, TRUE_FALSE_KEY, MATCHING_KEY, ORDERING_KEY, NUMERIC_ANSWER_KEY, ESSAY_KEY, SHORT_ANSWER_KEY]);
export const QUESTION_TYPES_HEADER = 'X-Question-Types';

export function contentKeyOf(question: { schemaVersion: number; questionType: string }): QuestionContentKey {
  return `${question.schemaVersion}:${question.questionType}`;
}

/**
 * Answer values (ASSESS-QUESTION-002 §4A.4), pure helpers shared by the sync adapter, the hook and
 * the exam screen: one canonical string per answer. v1: the option id. Multiple response: the JSON
 * array of the chosen ids sorted by UTF-16 code units ("[]" when cleared).
 */
export const EMPTY_SELECTION = '[]';

export function canonicalSelection(ids: readonly string[]): string {
  return JSON.stringify([...ids].sort());
}

/** The canonical value of a stored payload, or null when it is not one this client knows. */
export function answerValueOf(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if ('selectedOptionIds' in payload) {
    const ids = (payload as { selectedOptionIds: unknown }).selectedOptionIds;
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) return null;
    return canonicalSelection(ids as string[]);
  }
  // Numeric answer: the text as typed, or "" (ASSESS-QUESTION-007 §4.4).
  if ('numericText' in payload) {
    const text = (payload as { numericText: unknown }).numericText;
    return typeof text === 'string' && (text === '' || isNumericText(text)) ? text : null;
  }
  // Essay: the text exactly as written, or "" (ASSESS-QUESTION-008 §4.6).
  // Short answer: the text exactly as typed, or "" (ASSESS-QUESTION-006 §4.4).
  if ('shortText' in payload) {
    const text = (payload as { shortText: unknown }).shortText;
    return typeof text === 'string' && isShortText(text) ? text : null;
  }
  if ('essayText' in payload) {
    const text = (payload as { essayText: unknown }).essayText;
    return typeof text === 'string' && isEssayText(text) ? text : null;
  }
  // Ordering: the ids in answer order (ASSESS-QUESTION-005 §4.4).
  if ('orderedItemIds' in payload) {
    const ids = (payload as { orderedItemIds: unknown }).orderedItemIds;
    if (!Array.isArray(ids)) return null;
    const value = JSON.stringify(ids);
    return orderOf(value) ? value : null;
  }
  // Matching: the pairs as the canonical sorted list (ASSESS-QUESTION-004 §4.4).
  if ('pairs' in payload) {
    const pairs = (payload as { pairs: unknown }).pairs;
    if (!Array.isArray(pairs)) return null;
    const list: Array<[string, string]> = [];
    for (const pair of pairs) {
      if (!pair || typeof pair !== 'object') return null;
      const { leftId, rightId } = pair as { leftId: unknown; rightId: unknown };
      if (typeof leftId !== 'string' || typeof rightId !== 'string') return null;
      list.push([leftId, rightId]);
    }
    const value = canonicalPairs(list);
    return pairsOf(value) ? value : null;
  }
  // True/false: a strict boolean becomes "true" or "false" (ASSESS-QUESTION-003 §4.4).
  if ('value' in payload) {
    const value = (payload as { value: unknown }).value;
    return typeof value === 'boolean' ? String(value) : null;
  }
  if ('selectedOptionId' in payload) {
    const value = (payload as { selectedOptionId: unknown }).selectedOptionId;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

/** The ids of a canonical multiple-response value, or null when it is not canonical. */
export function selectionOf(value: string): string[] | null {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.some(id => typeof id !== 'string')) return null;
  const ids = parsed as string[];
  return new Set(ids).size === ids.length && canonicalSelection(ids) === value ? ids : null;
}

/**
 * Matching values (ASSESS-QUESTION-004 §4.4): the JSON list of [leftId, rightId] pairs sorted by
 * leftId in UTF-16 code-unit order; "[]" when no pair is chosen.
 */
export function canonicalPairs(pairs: ReadonlyArray<readonly [string, string]>): string {
  return JSON.stringify([...pairs].map(([l, r]) => [l, r]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

/** The pairs of a canonical matching value (unique left and right ids), or null. */
export function pairsOf(value: string): Array<[string, string]> | null {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(parsed)) return null;
  const pairs: Array<[string, string]> = [];
  for (const pair of parsed) {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || typeof pair[1] !== 'string') return null;
    pairs.push([pair[0], pair[1]]);
  }
  if (new Set(pairs.map(p => p[0])).size !== pairs.length || new Set(pairs.map(p => p[1])).size !== pairs.length) return null;
  return canonicalPairs(pairs) === value ? pairs : null;
}

/** The ids of a canonical ordering value (a JSON array of unique strings, in answer order), or null. */
export function orderOf(value: string): string[] | null {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.some(id => typeof id !== 'string')) return null;
  const ids = parsed as string[];
  return new Set(ids).size === ids.length && JSON.stringify(ids) === value ? ids : null;
}

/** A number as O02-8/D1 accept it (ASSESS-QUESTION-007 E1): optional minus, ASCII digits, one comma or dot decimal, at most 30 characters. */
export function isNumericText(value: string): boolean {
  return value.length <= 30 && /^-?[0-9]+([.,][0-9]+)?$/.test(value);
}

export const SHORT_TEXT_MAX = 200;

/**
 * Short-answer text the server accepts (ASSESS-QUESTION-006 §4.1, the same predicate): one line
 * (no LF or CR) of at most 200 code points, otherwise as for essays. "" is the empty answer.
 */
export function isShortText(value: string): boolean {
  return shortTextProblem(value) === null;
}

/** Why short-answer text cannot be saved: over the limit (checked first, D2) or a character that is not allowed. */
export function shortTextProblem(value: string): 'too_long' | 'invalid_character' | null {
  const problem = essayTextProblem(value);
  if (codePointCount(value) > SHORT_TEXT_MAX) return 'too_long';
  if (problem === 'invalid_character' || /[\n\r]/.test(value)) return 'invalid_character';
  return null;
}

export const ESSAY_TEXT_MAX = 5000;

/**
 * Essay text the server accepts (ASSESS-QUESTION-008 §4.1, the same predicate): a well-formed
 * string (no lone surrogate) of at most 5,000 code points with no control character other than
 * tab, LF and CR, no DEL and no C1 control. "" is the empty answer.
 */
export function isEssayText(value: string): boolean {
  return essayTextProblem(value) === null;
}

/** Why essay text cannot be saved: over the limit (checked first, D2) or a character that is not allowed. */
export function essayTextProblem(value: string): 'too_long' | 'invalid_character' | null {
  let count = 0;
  let invalid = false;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) invalid = true;
      else i++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      invalid = true;
    } else if ((unit < 0x20 && unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) || (unit >= 0x7f && unit <= 0x9f)) {
      invalid = true;
    }
    count++;
  }
  if (count > ESSAY_TEXT_MAX) return 'too_long';
  return invalid ? 'invalid_character' : null;
}

/** The number of Unicode code points, as the 5,000 limit counts them. */
export function codePointCount(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    count++;
  }
  return count;
}

/** Whether a value is the empty answer of a type that allows one: "[]" for multiple response, matching and ordering, "" for numeric answer and essay (O02-2). */
export function isEmptyValue(contentKey: string, value: string | null | undefined): boolean {
  if (contentKey === NUMERIC_ANSWER_KEY || contentKey === ESSAY_KEY || contentKey === SHORT_ANSWER_KEY) return value === '';
  return value === EMPTY_SELECTION && (contentKey === MULTIPLE_RESPONSE_KEY || contentKey === MATCHING_KEY || contentKey === ORDERING_KEY);
}

/**
 * Whether a value counts as answered: v1 and true/false any value, multiple response a non-empty
 * set, matching only every left item paired (Owner D1, ASSESS-QUESTION-004 §4A.1).
 */
export function isAnsweredValue(contentKey: string, value: string | null | undefined, leftCount?: number): boolean {
  if (value === null || value === undefined) return false;
  if (contentKey === MATCHING_KEY) {
    const pairs = pairsOf(value);
    return pairs !== null && leftCount !== undefined && leftCount > 0 && pairs.length === leftCount;
  }
  if (contentKey === NUMERIC_ANSWER_KEY) return value !== '' && isNumericText(value);
  if (contentKey === ESSAY_KEY) return value !== '' && isEssayText(value);
  if (contentKey === SHORT_ANSWER_KEY) return value !== '' && isShortText(value);
  // Ordering: a full order of every item (ASSESS-QUESTION-005 §4A.4 item 7); the count is the item count.
  if (contentKey === ORDERING_KEY) {
    const ids = orderOf(value);
    return ids !== null && leftCount !== undefined && leftCount > 0 && ids.length === leftCount;
  }
  return contentKey === MULTIPLE_RESPONSE_KEY ? value !== EMPTY_SELECTION : true;
}

export interface StudentSafeQuestion {
  snapshotId: string;
  schemaVersion: number;
  questionType: string;
  prompt: string;
  options: StudentSafeOption[];
  /** Matching only (ASSESS-QUESTION-004 §4.4): the items in stored order; no key. */
  leftItems?: StudentSafeOption[];
  rightItems?: StudentSafeOption[];
  /** Ordering only (ASSESS-QUESTION-005 §4.4): the items in display order; no key. */
  items?: StudentSafeOption[];
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
  /** Essay questions of the exam (ASSESS-QUESTION-008); absent means 0. */
  essayCount?: number;
  /** An exam the School Operator placed (ASSESS-INSTITUTION-001); absent or null for a teacher-managed exam. */
  institution?: TeacherExamInstitutionBlock | null;
}

export interface TeacherExamInstitutionBlock {
  periodLabel: string;
  preparationDeadline: string | null;
  deadlineExtended: boolean;
  /** The deadline passed or the exam is no longer scheduled: the questions are final. */
  preparationClosed: boolean;
  questionCount: number;
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

export interface TeacherExamAddParticipantsInput extends PermissionIntent {
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
export interface TeacherExamRescheduleInput extends PermissionIntent {
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
  /** D1 (ASSESS-QUESTION-008): automatically scored questions only. */
  correct: number;
  incorrect: number;
  unanswered: number;
  /** Essays with a grade, and answered essays still waiting for one (0 once final). */
  graded: number;
  ungraded: number;
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
  /** autoScoredCount: questions that are not essays; essayCount: essay questions (ASSESS-QUESTION-008). */
  scoring: { rule: string; available: boolean; questionCount: number; maxScore: number | null; autoScoredCount: number; essayCount: number };
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
  /** Each addition, oldest first; only for the managing teacher and the School Operator. */
  timeAdditions?: TimeAddition[];
}

export interface TimeAddition {
  addedAt: string;
  seconds: number;
  /** Always present for the managing teacher; for the School Operator only on its own additions (P5 A06). */
  reason?: string;
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
  /** OPERATOR: the School Operator of an institution exam, over every participant (ASSESS-INSTITUTION-003). */
  scope: 'PROCTOR' | 'TEACHER' | 'OPERATOR';
  /** The viewer manages the exam, or is the School Operator, and may add time (ASSESS-PROCTOR-004). */
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
  | 'correct_multiple' | 'correct_invalid' | 'score_invalid' | 'type_invalid' | 'correct_duplicate' | 'options_not_allowed'
  | 'columns_missing' | 'matching_items_invalid' | 'items_duplicate' | 'items_not_allowed' | 'ordering_items_invalid' | 'tolerance_invalid' | 'tolerance_not_allowed'
  | 'correct_not_allowed' | 'rubric_not_allowed' | 'short_answer_forms_invalid';

export type SetupProblemCode =
  | 'file_too_large' | 'time_zone_missing' | 'window_invalid' | 'window_order' | 'window_ended' | 'duration_invalid'
  | 'duration_exceeds_window' | 'assessment_type_unknown' | 'participant_not_enrolled' | 'no_participants'
  | 'schedule_conflict' | 'not_ready';

export type ImportProblem =
  | { source: 'file'; code: QuestionProblemCode; line: number | null; expected?: number; found?: number; letters?: string[]; type?: 'BS' | 'MJ' | 'UR' | 'IA' | 'ES' | 'IS'; side?: 'left' | 'right' }
  | { source: 'setup'; code: SetupProblemCode; count?: number; blocker?: string };

export interface TeacherExamImportPreview {
  sourceSha256: string;
  problems: ImportProblem[];
  /** type and correctLetters: ASSESS-QUESTION-002 (absent from older servers: PG with `correct`). */
  questions: Array<{ line: number; no: number; prompt: string; options: string[]; correct: string; score: number; type?: 'PG' | 'PGK' | 'BS' | 'MJ' | 'UR' | 'IA' | 'ES' | 'IS'; correctLetters?: string[]; correctValue?: boolean; leftItems?: string[]; rightItems?: string[]; keyEqualsAuthoredOrder?: boolean; tolerance?: string; rubric?: string; acceptedForms?: string[] }>;
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

// Institution exams (ASSESS-INSTITUTION-001): the School Operator composes an exam period; the subject
// Teacher prepares the questions before the deadline.

export interface InstitutionOverview {
  timeZone: string | null;
  limits: { maxDurationMinutes: number };
  assessmentTypes: Array<{ assessmentTypeId: string; label: string }>;
  academicPeriods: Array<{ academicPeriodId: string; label: string; startDate: string; endDate: string }>;
  teachingAssignments: Array<{ teachingAssignmentId: string; subjectLabel: string; groupLabel: string; academicPeriodId: string; teacherElligbleId: string | null }>;
  periods: Array<{ periodId: string; label: string; assessmentTypeLabel: string; academicPeriodLabel: string; sessionCount: number; examCount: number }>;
}

export interface InstitutionReadiness {
  baseline: TeacherExamBaselineProjection;
  roomProctor: TeacherExamRoomProctorProjection;
}

/** One placed exam as the Operator sees it: operational data only, never questions, keys or scores. */
export interface InstitutionExamItem {
  examInstanceId: string;
  subjectLabel: string | null;
  groupLabel: string | null;
  teacherElligbleId: string | null;
  lifecycleState: string;
  cancelledAt: string | null;
  durationMinutes: number;
  latestStartPolicy: LatestStartPolicy;
  participants: number;
  preparation: { deadline: string | null; revision: number; closed: boolean; questionCount: number; preparedAt: string | null; sourceFileName: string | null };
  /** Evaluated only for a scheduled exam past its deadline, where "Tandai Siap" applies. */
  readiness: InstitutionReadiness | null;
  /** The exam was ever marked ready: its deadline is not extended (ASSESS-INSTITUTION-002 RP-3). */
  markedReadyBefore?: boolean;
}

export interface InstitutionSession {
  sessionId: string;
  startsAt: string;
  endsAt: string;
  exams: InstitutionExamItem[];
}

export interface InstitutionPeriodDetail {
  period: { periodId: string; label: string; assessmentTypeLabel: string; academicPeriodLabel: string };
  sessions: InstitutionSession[];
}

export type InstitutionProblemCode =
  | 'label_invalid' | 'label_taken' | 'assessment_type_unknown' | 'academic_period_unknown' | 'academic_period_ended'
  | 'time_zone_missing' | 'date_invalid' | 'time_invalid' | 'window_order' | 'window_ended' | 'date_outside_period' | 'session_taken'
  | 'teaching_assignment_unknown' | 'teaching_assignment_other_period' | 'already_placed' | 'session_started'
  | 'duration_invalid' | 'duration_exceeds_window' | 'deadline_invalid' | 'deadline_passed' | 'deadline_not_before_session'
  | 'deadline_not_later' | 'no_participants' | 'schedule_conflict';

export interface InstitutionProblem { code: InstitutionProblemCode; count?: number }

export interface InstitutionPeriodInput { label: string; assessmentTypeId: string; academicPeriodId: string; actionKey: string }
/** Wall-clock values in the school's zone: `YYYY-MM-DD`, `HH:MM`. */
export interface InstitutionSessionInput { periodId: string; date: string; startTime: string; endTime: string; actionKey: string }
export interface InstitutionPlacementInput {
  sessionId: string;
  teachingAssignmentId: string;
  durationMinutes: number;
  latestStartPolicy: LatestStartPolicy;
  /** Wall-clock date and time in the school's zone, `YYYY-MM-DDTHH:MM`. */
  preparationDeadline: string;
  actionKey: string;
}
export interface InstitutionDeadlineInput { examInstanceId: string; preparationDeadline: string; expectedRevision: number; reason: string; actionKey: string }
export interface InstitutionCancelInput { examInstanceId: string; reason: string; actionKey: string }

export interface InstitutionPeriodResult { periodId: string; replayed: boolean }
export interface InstitutionSessionResult { sessionId: string; startsAt: string; endsAt: string; replayed: boolean }
export interface InstitutionPlacementResult { examInstanceId: string; participants: number; preparationDeadline: string; replayed: boolean }
export interface InstitutionDeadlineResult { examInstanceId: string; revision: number; preparationDeadline: string; reason: string; replayed: boolean }
export interface InstitutionCancelResult { examInstanceId: string; cancelledAt: string; changed: boolean; replayed: boolean }
export interface InstitutionTransitionResult { examInstanceId: string; lifecycleState: string }

// Rooms and Proctors of institution exams (ASSESS-INSTITUTION-002): ELLIGBLE IDs and rombel only (OB-3).

/** The room part of readiness of one exam: its status, blocker and counts. */
export interface InstitutionRoomReadiness {
  status: string;
  blocker?: string;
  participantCount?: number;
  assignedParticipantCount?: number;
  unassignedParticipantCount?: number;
  examRoomCount?: number;
  coveredExamRoomCount?: number;
  uncoveredExamRoomCount?: number;
}

/** One physical room of a session: the same label across the session's exams. */
export interface InstitutionRoom {
  label: string;
  participantCount: number;
  groups: Array<{ examInstanceId: string; subjectLabel: string | null; groupLabel: string | null; count: number }>;
  proctors: Array<{ elligbleId: string }>;
}

export interface InstitutionRoomExam {
  examInstanceId: string;
  subjectLabel: string | null;
  groupLabel: string | null;
  lifecycleState: string;
  /** SCHEDULED or READY: rooms and Proctors may change. */
  editable: boolean;
  roomBased: boolean;
  roomReadiness: InstitutionRoomReadiness | null;
  participants: Array<{ participantId: string; elligbleId: string | null; roomLabel: string | null }>;
  /** Students of the rombel on the session date who are not participants yet (editable exams only). */
  candidates: Array<{ enrollmentId: string; elligbleId: string; conflict: boolean }>;
}

export interface InstitutionRoomView {
  session: { sessionId: string; periodLabel: string; startsAt: string; endsAt: string };
  /** The session revision every write carries back (stale writes are refused). */
  revision: number;
  rooms: InstitutionRoom[];
  exams: InstitutionRoomExam[];
}

export type InstitutionRoomProblemCode =
  | 'room_label_invalid' | 'participant_unknown' | 'already_in_room' | 'room_conflict' | 'room_unknown'
  | 'proctor_unknown' | 'proctor_ineligible' | 'proctor_other_room' | 'proctor_schedule_conflict'
  | 'not_enrolled' | 'already_participant' | 'schedule_conflict';

export interface InstitutionRoomProblem { code: InstitutionRoomProblemCode; count?: number; elligbleIds?: string[] }

export interface InstitutionRoomParticipantsInput { sessionId: string; roomLabel: string; participantIds: string[]; expectedRevision: number; actionKey: string }
export interface InstitutionRoomParticipantsResult { sessionId: string; revision: number; moved: number; demoted: string[]; replayed: boolean }
export interface InstitutionRoomProctorsInput { sessionId: string; roomLabel: string; proctorElligbleIds: string[]; expectedRevision: number; actionKey: string }
export interface InstitutionRoomProctorsResult {
  sessionId: string; revision: number; changed: boolean; proctors: Array<{ elligbleId: string }>; demoted: string[]; replayed: boolean;
}
export interface InstitutionParticipantsInput { examInstanceId: string; enrollmentIds: string[]; roomLabel: string; expectedRevision: number; actionKey: string }
export interface InstitutionParticipantsResult {
  examInstanceId: string; revision: number; added: Array<{ enrollmentId: string; elligbleId: string | null }>; demoted: string[]; replayed: boolean;
}

// Supervision and running controls of institution exams (ASSESS-INSTITUTION-003): ELLIGBLE IDs only, no names or
// scores (OB-3, OC-5); every control carries a reason, a confirmation and an action key (OC-4).

export type SupervisionAction = 'activate' | 'pause' | 'resume' | 'end';
export type SupervisionSkipCode = 'invalid_state' | 'room_setup_required' | 'window_not_started' | 'window_closed' | 'not_ready';

/** Participants by status: not started, working (time up included), submitted, and locked while open. */
export interface SupervisionCounts { participants: number; notStarted: number; active: number; submitted: number; locked: number }

export interface SupervisedRoom { label: string; counts: SupervisionCounts; proctors: Array<{ elligbleId: string }> }

/** One non-cancelled exam of the session as the Operator follows it. */
export interface SupervisedExam {
  examInstanceId: string;
  subjectLabel: string | null;
  groupLabel: string | null;
  lifecycleState: string;
  pausedAt: string | null;
  counts: SupervisionCounts;
  rooms: SupervisedRoom[];
  /** Evaluated only for a READY exam, where "Buka Ujian" applies. */
  readiness: InstitutionReadiness | null;
  /** Rooms are required with a Proctor per room (needed before opening). */
  roomPolicy: boolean;
}

export interface InstitutionSupervision {
  session: { sessionId: string; periodLabel: string; startsAt: string; endsAt: string };
  serverTime: string;
  exams: SupervisedExam[];
}

export type SupervisionTransitionInput = ({ examInstanceId: string } | { sessionId: string }) & PermissionIntent & { action: SupervisionAction };

export interface SupervisionExamTransitionResult { examInstanceId: string; lifecycleState: string; changed: boolean; replayed: boolean }

export interface SupervisionSessionExamResult {
  examInstanceId: string;
  outcome: 'APPLIED' | 'NO_OP' | 'SKIPPED';
  previousState: string;
  resultingState: string;
  skip?: { code: SupervisionSkipCode; currentState?: string; windowStartsAt?: string; readiness?: InstitutionReadiness };
}

export interface SupervisionSessionTransitionResult { sessionId: string; action: SupervisionAction; results: SupervisionSessionExamResult[]; replayed: boolean }

export interface SupervisionLockInput extends PermissionIntent { examInstanceId: string; participantId: string; action: ParticipantLockAction }
export interface SupervisionLockResult extends ParticipantLockResponse { replayed: boolean }

export interface SupervisionBroadcastInput extends PermissionIntent { examInstanceId: string; target: BroadcastTarget; message: string }
export interface SupervisionBroadcastResult extends BroadcastSendResponse { replayed: boolean }

export interface TeacherExamContentInput { examInstanceId: string; questionsCsv: string; sourceFileName: string | null }
export interface TeacherExamContentPreview extends TeacherExamImportPreview {
  /** The questions stored now, which saving this file replaces; 0 when none. */
  replaces: number;
}
export interface TeacherExamContentResult { examInstanceId: string; questionCount: number; replayed: boolean }

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
  /** ASSESS-QUESTION-002: the valid type (absent from older servers: single choice); null for invalid content. */
  questionType?: 'MULTIPLE_CHOICE_SINGLE' | 'MULTIPLE_RESPONSE' | 'TRUE_FALSE' | 'MATCHING' | 'ORDERING' | 'NUMERIC_ANSWER' | 'ESSAY' | 'SHORT_ANSWER' | null;
  /** Short answer only (ASSESS-QUESTION-006 §4.4): the accepted forms as authored; [] in manual mode. */
  acceptedForms?: string[];
  /** Essay only: the rubric as authored, possibly empty. */
  rubric?: string;
  /** Multiple response: the key options in authored order. */
  correctOptionIds?: string[] | null;
  /** True/false only: the key. */
  correctValue?: boolean;
  /** Matching only: the items and the key. */
  leftItems?: Array<{ id: string; content: string }>;
  rightItems?: Array<{ id: string; content: string }>;
  correctPairs?: Array<{ leftId: string; rightId: string }>;
  /** Ordering only: the items and the correct order. */
  items?: Array<{ id: string; content: string }>;
  correctOrder?: string[];
  /** Numeric answer only: the canonical key and tolerance. */
  expected?: string;
  tolerance?: string;
    maxScore: number | null;
    valid: boolean;
  }>;
}

/** One grade revision of an essay answer (ASSESS-QUESTION-008 §4.3); score is a decimal string with ".". */
export interface EssayGradeEntry {
  score: string;
  revision: number;
  gradedAt: string;
}

/** The managing teacher's essay worklist: first submitted attempts with non-empty essays, by ELLIGBLE ID. */
export interface TeacherEssayWorklist {
  exam: { examInstanceId: string; lifecycleState: string };
  questions: Array<{
    snapshotId: string;
    no: number;
    /** ASSESS-QUESTION-006: essays and manual short answers; absent means 'ESSAY'. */
    questionType?: 'ESSAY' | 'SHORT_ANSWER';
    prompt: string;
    rubric: string;
    maxScore: string;
    answers: Array<{ attemptId: string; elligbleId: string | null; essayText: string; grade: EssayGradeEntry | null; history: EssayGradeEntry[] }>;
  }>;
}

export interface TeacherEssayGradeRequest {
  examInstanceId: string;
  attemptId: string;
  snapshotId: string;
  /** As typed: up to four digits, optionally a comma or dot and one or two decimals. */
  score: string;
  /** The revision the teacher saw, or null when the answer had no grade. */
  expectedRevision: number | null;
}
