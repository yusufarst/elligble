import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { StudentSafeQuestion, ResumeResponse, TimerResponse } from '../types/assessment.ts';
import { getResume, getQuestions, getTimer, postSubmit, postExpiryFinalize, ApiError } from '../api/assessment-client.ts';
import { getActiveTenantId } from '../api/http.ts';
import { useAuthoritativeTimer } from '../hooks/useAuthoritativeTimer.ts';
import { useAnswerManager } from '../hooks/useAnswerManager.ts';
import { clearReviewFlags, useReviewFlags } from '../hooks/useReviewFlags.ts';
import { clearLocalAnswers } from '../exam/answer-store.ts';
import { countUnreceivedLocalAnswers } from '../exam/answer-sync-api.ts';
import { forgetExamSessionId, readExamSessionId } from '../exam/exam-session.ts';
import { formatTime } from '../lib/format.ts';
import type { ExamRunState } from '../exam/answer-sync-engine.ts';
import { SubmitConfirmModal } from './SubmitConfirmModal.tsx';
import { QuestionNavigatorSheet } from './QuestionNavigatorSheet.tsx';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkstationPhase =
  | 'invalid_attempt'
  | 'loading'
  | 'access_denied'
  | 'not_found'
  | 'session_inactive'
  /** The exam session moved to another device or tab; this one can no longer write. */
  | 'superseded'
  | 'timer_not_started'
  | 'active'
  | 'expired'
  | 'submitted'
  | 'error';

export interface StudentExamWorkstationProps {
  /** This tab's own exam session id; defaults to the one stored for the attempt in this tab. */
  examSessionId?: string;
  /** Moves the exam session to this device again (explicit takeover flow). */
  onRequestTakeover?: () => void;
  /** Leaves the exam screen (back to the student's exam list). */
  onExit?: () => void;
}

/** Non-blocking reminders (D04.5-32); the server timer stays the only authority. */
const TIME_REMINDER_THRESHOLDS_SECONDS = [30 * 60, 15 * 60, 5 * 60];
const TIME_REMINDER_VISIBLE_MS = 10000;
const FINALIZE_RETRY_INITIAL_MS = 2000;
const FINALIZE_RETRY_MAX_MS = 30000;
const EXPIRY_FLUSH_WAIT_MS = 3000;
/**
 * How often the exam state is checked while working and while paused (Owner decision
 * 2026-09-30). A save also reports a pause at once; while paused the check is more frequent
 * so the exam continues on this device soon after the teacher resumes it.
 */
const STATE_CHECK_ACTIVE_MS = 15000;
const STATE_CHECK_PAUSED_MS = 5000;

function runStateOf(value: string | null | undefined): ExamRunState {
  return value === 'PAUSED' ? 'PAUSED' : value === 'ENDED' ? 'ENDED' : 'ACTIVE';
}

function instantOrNull(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** "soal 3", "soal 3 dan 5", "soal 2, 3 dan 7": numbers of the questions whose choice was dropped. */
function describeQuestions(snapshotIds: string[], questions: StudentSafeQuestion[]): string | null {
  const numbers = snapshotIds
    .map(id => questions.findIndex(q => q.snapshotId === id) + 1)
    .filter(n => n > 0)
    .sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  if (numbers.length === 1) return `soal ${numbers[0]}`;
  return `soal ${numbers.slice(0, -1).join(', ')} dan ${numbers[numbers.length - 1]}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Waits for the next retry, or less when the connection comes back. */
function waitForRetry(ms: number): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('online', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    window.addEventListener('online', done);
  });
}

export const StudentExamWorkstation: React.FC<StudentExamWorkstationProps> = ({ examSessionId, onRequestTakeover, onExit }) => {
  const [phase, setPhase] = useState<WorkstationPhase>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [examContext, setExamContext] = useState<{subjectLabel: string | null, roomLabel: string | null} | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [questions, setQuestions] = useState<StudentSafeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [initialRemainingSeconds, setInitialRemainingSeconds] = useState<number>(0);
  const [initialAnswers, setInitialAnswers] = useState<ResumeResponse['answers'] | null>(null);
  const [initialFlags, setInitialFlags] = useState<string[] | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [unreceivedAtCompletion, setUnreceivedAtCompletion] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isNavSheetOpen, setIsNavSheetOpen] = useState<boolean>(false);
  const navSheetTriggerRef = useRef<HTMLButtonElement>(null);
  // Exam pause and end (Owner decision 2026-09-30): a paused exam hides the questions and
  // freezes the time; an ended exam lets this running attempt finish on its own time.
  const [examState, setExamState] = useState<ExamRunState>('ACTIVE');
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [discardedIds, setDiscardedIds] = useState<string[]>([]);
  const [discardReason, setDiscardReason] = useState<'pause' | 'lock'>('pause');
  const examStateRef = useRef<ExamRunState>('ACTIVE');
  examStateRef.current = examState;
  // A supervisor's lock of this attempt (D04.6-38): questions hidden, time keeps running.
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const lockedRef = useRef<boolean>(false);
  lockedRef.current = lockedAt !== null;
  const questionsLoadingRef = useRef<boolean>(false);

  const finalizingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const tenantKey = getActiveTenantId() ?? '';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Validate attemptId from search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('attemptId');

    if (!id || !UUID_REGEX.test(id)) {
      setPhase('invalid_attempt');
      return;
    }

    setAttemptId(id);
    const own = examSessionId ?? readExamSessionId(id);
    if (own) setSessionId(own);
  }, [examSessionId]);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  /** The attempt is final on the server: drop this device's copy of it (shared devices). */
  const completeAttempt = useCallback(async (id: string, at: string | null) => {
    const unreceived = await countUnreceivedLocalAnswers(tenantKey, id);
    await clearLocalAnswers(tenantKey, id);
    clearReviewFlags(id);
    forgetExamSessionId(id);
    if (!mountedRef.current) return;
    setUnreceivedAtCompletion(unreceived);
    setSubmittedAt(at);
    setIsSubmitModalOpen(false);
    setPhase('submitted');
  }, [tenantKey]);

  const timerControlRef = useRef<{ applyServerRemaining: (seconds: number) => void } | null>(null);
  const answersRef = useRef<{ pendingCount: number; flush: () => void; hasUnresolvedSaves: boolean } | null>(null);
  const runInfoRef = useRef<((timer: TimerResponse) => void) | null>(null);

  // Timer expiry: flush what can still be sent (D04.5-46), then ask the server to finalize
  // from its accepted answers (D04.5-47), retrying until it answers (D04.5-45/49).
  const finalizeExpiredAttempt = useCallback(async (id: string) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setPhase('expired');
    try {
      const answers = answersRef.current;
      if (answers && answers.pendingCount > 0) {
        answers.flush();
        const deadline = Date.now() + EXPIRY_FLUSH_WAIT_MS;
        while (Date.now() < deadline && (answersRef.current?.pendingCount ?? 0) > 0 && mountedRef.current) {
          await sleep(200);
        }
      }
      let delay = FINALIZE_RETRY_INITIAL_MS;
      while (mountedRef.current) {
        try {
          const res = await postExpiryFinalize(id);
          await completeAttempt(id, res.submittedAt);
          return;
        } catch (err) {
          if (err instanceof ApiError && err.code === 'timer_not_expired') {
            // The server still has time left (this device ran ahead): continue the exam.
            try {
              const timer = await getTimer(id);
              if (timer.status === 'active' && timer.effectiveRemainingSeconds > 0) {
                timerControlRef.current?.applyServerRemaining(timer.effectiveRemainingSeconds);
                runInfoRef.current?.(timer);
                if (mountedRef.current) setPhase('active');
                return;
              }
            } catch {
              // Retry below.
            }
          } else if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            if (mountedRef.current) {
              setErrorMessage('Pengumpulan otomatis tidak dapat diproses. Hubungi pengawas ruangan.');
              setPhase('error');
            }
            return;
          }
        }
        await waitForRetry(delay);
        delay = Math.min(delay * 2, FINALIZE_RETRY_MAX_MS);
      }
    } finally {
      finalizingRef.current = false;
    }
  }, [completeAttempt]);

  // Initial resume load
  useEffect(() => {
    if (!attemptId) return;

    let isCancelled = false;

    async function loadResume() {
      try {
        const resume = await getResume(attemptId!, sessionId || null);
        if (isCancelled) return;

        // Check if already submitted
        if (resume.submission && resume.submission.status === 'submitted') {
          await completeAttempt(attemptId!, resume.submission.submittedAt);
          return;
        }

        // Check active session
        if (resume.session.status !== 'active') {
          setPhase('session_inactive');
          return;
        }
        if (!sessionId || !resume.session.ownedByCaller) {
          // Another device or tab holds the exam session (D04.4-37, D04.5-22).
          setPhase('superseded');
          return;
        }

        // Check timer
        if (!resume.timer || resume.timer.status === 'not_started') {
          setPhase('timer_not_started');
          return;
        }

        setExamContext(resume.context);

        if (resume.timer.status === 'active') {
          if (resume.timer.effectiveRemainingSeconds <= 0) {
            void finalizeExpiredAttempt(attemptId!);
            return;
          }

          setInitialRemainingSeconds(resume.timer.effectiveRemainingSeconds);
        }

        setInitialAnswers(resume.answers);
        setInitialFlags(resume.reviewFlags ?? []);

        const runState = runStateOf(resume.exam?.lifecycleState);
        setExamState(runState);
        examStateRef.current = runState;
        const lock = resume.lock?.lockedAt ?? null;
        setLockedAt(lock);
        lockedRef.current = lock !== null;
        if (runState === 'PAUSED' || lock !== null) {
          // No question content while paused or locked; the questions load afterwards.
          if (runState === 'PAUSED') setPausedAt(resume.exam?.pausedAt ?? null);
          setPhase('active');
          return;
        }

        // Load questions
        const qRes = await getQuestions(attemptId!);
        if (isCancelled) return;

        setQuestions(qRes.questions);
        setPhase('active');
      } catch (err) {
        if (isCancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 403) {
            setPhase('access_denied');
            return;
          }
          if (err.status === 404) {
            setPhase('not_found');
            return;
          }
          if (err.status === 409) {
            if (err.code === 'attempt_already_submitted') {
              setPhase('submitted');
              return;
            }
            if (err.code === 'session_not_active') {
              setPhase('session_inactive');
              return;
            }
            if (err.code === 'timer_not_started') {
              setPhase('timer_not_started');
              return;
            }
            if (err.code === 'timer_expired') {
              void finalizeExpiredAttempt(attemptId!);
              return;
            }
            if (err.code === 'exam_paused') {
              // Paused between the resume and the questions: wait on the paused screen.
              setExamState('PAUSED');
              examStateRef.current = 'PAUSED';
              setPhase('active');
              return;
            }
            if (err.code === 'attempt_locked') {
              setLockedAt(typeof err.data?.lockedAt === 'string' ? err.data.lockedAt : new Date().toISOString());
              lockedRef.current = true;
              setPhase('active');
              return;
            }
          }
        }
        setErrorMessage('Gagal memuat lembar ujian. Periksa koneksi internet Anda atau hubungi pengawas.');
        setPhase('error');
      }
    }

    loadResume();

    return () => {
      isCancelled = true;
    };
    // The session id is fixed for this mounted workstation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const handleExpire = useCallback(() => {
    if (attemptId) void finalizeExpiredAttempt(attemptId);
  }, [attemptId, finalizeExpiredAttempt]);

  const timer = useAuthoritativeTimer({
    attemptId: attemptId || '',
    initialRemainingSeconds,
    // Time stands still while the exam is paused.
    enabled: phase === 'active' && examState !== 'PAUSED',
    onExpire: handleExpire,
    onTimerInfo: timerInfo => runInfoRef.current?.(timerInfo),
  });
  timerControlRef.current = timer;
  const { formattedTime, isWarning, isUrgent, remainingSeconds } = timer;

  const [timeReminder, setTimeReminder] = useState<string | null>(null);
  const lastRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'active' || examState === 'PAUSED') {
      lastRemainingRef.current = null;
      return;
    }
    const previous = lastRemainingRef.current;
    lastRemainingRef.current = remainingSeconds;
    if (previous === null || remainingSeconds <= 0) return;
    if (TIME_REMINDER_THRESHOLDS_SECONDS.some(t => previous > t && remainingSeconds <= t)) {
      setTimeReminder(`Sisa waktu ${Math.ceil(remainingSeconds / 60)} menit.`);
    }
  }, [remainingSeconds, phase, examState]);
  useEffect(() => {
    if (!timeReminder) return;
    const hide = setTimeout(() => setTimeReminder(null), TIME_REMINDER_VISIBLE_MS);
    return () => clearTimeout(hide);
  }, [timeReminder]);

  // Re-align with the server clock after a reconnect (D04.5-28).
  useEffect(() => {
    if (phase !== 'active') return;
    const onOnline = () => void timer.resync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [phase, timer.resync]);

  const handleTerminalEvent = useCallback((code: string) => {
    if (code === 'timer_expired') {
      handleExpire();
    } else if (code === 'attempt_already_submitted') {
      if (attemptId) void completeAttempt(attemptId, null);
    }
  }, [handleExpire, attemptId, completeAttempt]);

  const handleSessionInactive = useCallback(() => {
    setIsSubmitModalOpen(false);
    setIsNavSheetOpen(false);
    setPhase('superseded');
  }, []);

  const checkExamStateRef = useRef<(() => Promise<void>) | null>(null);
  const handleExamPausedBySave = useCallback((at: number | null) => {
    setIsSubmitModalOpen(false);
    setIsNavSheetOpen(false);
    setExamState('PAUSED');
    examStateRef.current = 'PAUSED';
    if (at !== null) setPausedAt(new Date(at).toISOString());
    // Fetch the frozen remaining time to show it.
    void checkExamStateRef.current?.();
  }, []);
  const handleAttemptLockedBySave = useCallback((at: number | null) => {
    setIsSubmitModalOpen(false);
    setIsNavSheetOpen(false);
    setLockedAt(at !== null ? new Date(at).toISOString() : new Date().toISOString());
    lockedRef.current = true;
    void checkExamStateRef.current?.();
  }, []);
  const handleDiscarded = useCallback((ids: string[]) => {
    setDiscardReason(lockedRef.current && examStateRef.current !== 'PAUSED' ? 'lock' : 'pause');
    setDiscardedIds(prev => [...new Set([...prev, ...ids])]);
  }, []);

  const answers = useAnswerManager({
    tenantId: tenantKey,
    attemptId: attemptId || '',
    sessionId,
    initialAnswers,
    enabled: phase === 'active' || phase === 'expired',
    onSessionInactive: handleSessionInactive,
    onTerminalEvent: handleTerminalEvent,
    onExamPaused: handleExamPausedBySave,
    onAttemptLocked: handleAttemptLockedBySave,
    onDiscarded: handleDiscarded,
  });
  const { selectedOptions, saveStates, selectOption, hasUnresolvedSaves, degraded, storageDurable } = answers;
  const review = useReviewFlags({ attemptId: attemptId || '', sessionId, initialFlags, enabled: phase === 'active' });
  answersRef.current = { pendingCount: answers.pendingCount, flush: answers.flush, hasUnresolvedSaves };

  const loadQuestions = useCallback(async (id: string) => {
    if (questionsLoadingRef.current) return;
    questionsLoadingRef.current = true;
    try {
      const qRes = await getQuestions(id);
      if (mountedRef.current) setQuestions(qRes.questions);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'exam_paused' && mountedRef.current) {
        setExamState('PAUSED');
        examStateRef.current = 'PAUSED';
      }
      if (err instanceof ApiError && err.code === 'attempt_locked' && mountedRef.current) {
        setLockedAt(typeof err.data?.lockedAt === 'string' ? err.data.lockedAt : new Date().toISOString());
        lockedRef.current = true;
      }
      // Otherwise the next state check tries again.
    } finally {
      questionsLoadingRef.current = false;
    }
  }, []);

  // What the server says about the exam: pause (freeze and hide), resume (exact remaining
  // time, questions back) or end (this attempt continues on its own time).
  const noteExamState = answers.noteExamState;
  const noteLockState = answers.noteLockState;
  const isFreshState = answers.isFreshState;
  const applyRunInfo = useCallback((info: TimerResponse) => {
    if (!mountedRef.current) return;
    // Answers can arrive out of order: one produced before an answer already applied about
    // the pause or the lock (such as a refusal that reported it) changes nothing.
    const at = instantOrNull(info.serverTime);
    if (!isFreshState('pause', at) || !isFreshState('lock', at)) return;
    const state = runStateOf(info.examState);
    const remaining = info.status === 'expired' ? 0 : info.effectiveRemainingSeconds;
    const wasPaused = examStateRef.current === 'PAUSED';
    if (state === 'PAUSED') {
      setIsSubmitModalOpen(false);
      setIsNavSheetOpen(false);
      setPausedAt(info.pausedAt ?? null);
    }
    examStateRef.current = state;
    setExamState(state);
    noteExamState(state, state === 'PAUSED' ? instantOrNull(info.pausedAt) : null, at);
    const lock = info.lockedAt ?? null;
    const wasLocked = lockedRef.current;
    if (lock !== null) {
      setIsSubmitModalOpen(false);
      setIsNavSheetOpen(false);
    }
    lockedRef.current = lock !== null;
    setLockedAt(lock);
    noteLockState(instantOrNull(lock), at);
    // The server's value replaces the local countdown (frozen while paused, exact on resume).
    timerControlRef.current?.applyServerRemaining(remaining);
    // Questions are fetched once the exam runs again (also retried by later checks).
    if (state !== 'PAUSED' && lock === null && attemptId && questions.length === 0) void loadQuestions(attemptId);
    if ((wasPaused && state !== 'PAUSED') || (wasLocked && lock === null)) answersRef.current?.flush();
  }, [noteExamState, noteLockState, isFreshState, attemptId, questions.length, loadQuestions]);
  runInfoRef.current = applyRunInfo;

  const checkExamState = useCallback(async () => {
    if (!attemptId) return;
    try {
      applyRunInfo(await getTimer(attemptId));
    } catch {
      // Offline or unreachable: the next check, a save or reconnecting tries again.
    }
  }, [attemptId, applyRunInfo]);
  checkExamStateRef.current = checkExamState;

  // Regular state check while the exam screen is open; sooner while paused, and at once
  // when the tab is visible again or the connection returns.
  useEffect(() => {
    if (phase !== 'active') return;
    const base = examState === 'PAUSED' || lockedAt !== null ? STATE_CHECK_PAUSED_MS : STATE_CHECK_ACTIVE_MS;
    let stopped = false;
    let handle: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      // A little jitter keeps a whole room from asking at the same moment.
      handle = setTimeout(async () => {
        await checkExamState();
        if (!stopped) schedule();
      }, base * (0.8 + Math.random() * 0.4));
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkExamState();
    };
    window.addEventListener('online', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (handle) clearTimeout(handle);
      window.removeEventListener('online', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, examState, lockedAt !== null, checkExamState]);

  // Handle final submission (idempotent on the server, D04.5-40/44).
  const handleConfirmSubmit = useCallback(async () => {
    if (!attemptId || hasUnresolvedSaves || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await postSubmit(attemptId);
      await completeAttempt(attemptId, res.submittedAt);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'attempt_already_submitted') {
        await completeAttempt(attemptId, null);
        return;
      }
      if (err instanceof ApiError && err.code === 'timer_expired') {
        setIsSubmitModalOpen(false);
        handleExpire();
        return;
      }
      if (err instanceof ApiError && err.code === 'exam_paused') {
        handleExamPausedBySave(instantOrNull(typeof err.data?.pausedAt === 'string' ? err.data.pausedAt : null));
        return;
      }
      if (err instanceof ApiError && err.code === 'attempt_locked') {
        handleAttemptLockedBySave(instantOrNull(typeof err.data?.lockedAt === 'string' ? err.data.lockedAt : null));
        return;
      }
      setSubmitError('Gagal mengumpulkan ujian. Periksa koneksi internet Anda lalu coba lagi.');
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [attemptId, hasUnresolvedSaves, isSubmitting, completeAttempt, handleExpire, handleExamPausedBySave, handleAttemptLockedBySave]);

  // Render Phase States
  if (phase === 'invalid_attempt') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert">
          <h1 className="state-card-title">Tautan Tidak Valid</h1>
          <p className="state-card-body">
            Tautan pengerjaan ujian tidak valid atau format sesi tidak dikenali.
          </p>
        </div>
      </main>
    );
  }

  if (phase === 'access_denied') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert">
          <h1 className="state-card-title">Akses Ditolak</h1>
          <p className="state-card-body">
            Akses ditolak. Anda tidak memiliki izin untuk mengakses sesi pengerjaan ujian ini.
          </p>
        </div>
      </main>
    );
  }

  if (phase === 'not_found') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert">
          <h1 className="state-card-title">Data Tidak Ditemukan</h1>
          <p className="state-card-body">
            Data pengerjaan ujian tidak ditemukan. Hubungi pengawas ruangan.
          </p>
        </div>
      </main>
    );
  }

  if (phase === 'session_inactive') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card">
          <h1 className="state-card-title">Sesi Ujian Tidak Aktif</h1>
          <p className="state-card-body">
            Sesi ujian belum aktif atau tidak dapat diakses. Silakan hubungi pengawas ujian.
          </p>
        </div>
      </main>
    );
  }

  if (phase === 'superseded') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert">
          <h1 className="state-card-title">Sesi Dipindahkan</h1>
          <p className="state-card-body">
            Sesi ujian Anda telah dibuka di perangkat lain. Sesi pada perangkat ini dinonaktifkan.
          </p>
          <p className="state-card-body">
            Jawaban yang sudah tersimpan tetap aman. Lanjutkan ujian di perangkat yang sedang aktif, atau pindahkan kembali ke perangkat ini.
          </p>
          {onRequestTakeover && (
            <button type="button" className="btn btn-primary" onClick={onRequestTakeover} style={{ width: '100%', maxWidth: '300px', margin: '0.5rem auto 0', display: 'block' }}>
              Lanjutkan di Perangkat Ini
            </button>
          )}
        </div>
      </main>
    );
  }

  if (phase === 'timer_not_started') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card">
          <h1 className="state-card-title">Waktu Ujian Belum Dimulai</h1>
          <p className="state-card-body">
            Waktu pelaksanaan ujian belum dimulai oleh pengawas ruangan.
          </p>
        </div>
      </main>
    );
  }

  if (phase === 'submitted') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card">
          <h1 className="state-card-title">Ujian Berhasil Dikumpulkan</h1>
          <p className="state-card-body">
            Jawaban Anda telah tersimpan resmi pada server sekolah. Anda dapat meninggalkan ruang ujian setelah diizinkan pengawas.
          </p>
          {submittedAt && (
            <p className="state-card-body" style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)' }}>
              Waktu Pengumpulan: {formatTime(submittedAt)}
            </p>
          )}
          {unreceivedAtCompletion > 0 && (
            <p className="state-card-body" role="alert" style={{ color: 'var(--color-danger-text)' }}>
              {unreceivedAtCompletion} jawaban terakhir di perangkat ini belum diterima server sebelum ujian berakhir. Laporkan kepada pengawas ruangan.
            </p>
          )}
          {onExit && (
            <button type="button" className="btn btn-secondary" onClick={onExit} style={{ width: '100%', maxWidth: '300px', margin: '0.5rem auto 0', display: 'block' }}>
              Kembali ke Jadwal Ujian
            </button>
          )}
        </div>
      </main>
    );
  }

  if (phase === 'expired') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert" aria-live="assertive">
          <h1 className="state-card-title">Waktu Ujian Telah Habis</h1>
          <p className="state-card-body">
            Sistem sedang mengumpulkan seluruh jawaban Anda secara otomatis. Harap tunggu hingga proses selesai.
          </p>
          {!isOnline && (
            <p className="state-card-body">
              Koneksi terputus. Pengumpulan dicoba lagi otomatis saat kembali terhubung. Jangan tutup halaman ini.
            </p>
          )}
        </div>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert">
          <h1 className="state-card-title">Terjadi Kendala</h1>
          <p className="state-card-body">{errorMessage}</p>
        </div>
      </main>
    );
  }

  const discardedText = discardedIds.length > 0
    ? (() => {
      const which = describeQuestions(discardedIds, questions);
      const when = discardReason === 'lock' ? 'setelah pengerjaan dikunci' : 'setelah ujian dijeda';
      return which
        ? `Pilihan jawaban pada ${which} dibuat ${when} sehingga tidak disimpan. Periksa kembali soal tersebut.`
        : `Beberapa pilihan jawaban dibuat ${when} sehingga tidak disimpan. Periksa kembali jawaban Anda.`;
    })()
    : null;

  // Paused (Owner decision 2026-09-30): the questions are hidden and the time is frozen, so
  // the pause gives no extra working time; answers chosen before it keep being sent.
  if (phase === 'active' && examState === 'PAUSED') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card paused-card" role="status" aria-live="polite">
          <h1 className="state-card-title">Ujian Dijeda</h1>
          <p className="state-card-body">
            {pausedAt ? `Guru menjeda ujian sejak ${formatTime(pausedAt)}.` : 'Guru menjeda ujian.'} Sisa waktu Anda berhenti dan berjalan lagi saat ujian dilanjutkan.
          </p>
          <p className="paused-remaining" aria-label={`Sisa waktu ${formattedTime}`}>
            <span className="paused-remaining-label">Sisa waktu</span>
            <span className="paused-remaining-value">{formattedTime}</span>
          </p>
          <p className="state-card-body">
            {!answers.ready
              ? 'Memeriksa jawaban di perangkat ini...'
              : answers.pendingCount > 0
                ? (degraded || !isOnline
                  ? 'Koneksi terputus. Jawaban yang Anda pilih sebelum ujian dijeda akan dikirim otomatis saat kembali terhubung.'
                  : 'Mengirim jawaban yang Anda pilih sebelum ujian dijeda...')
                : 'Semua jawaban yang Anda pilih sebelum ujian dijeda sudah tersimpan.'}
          </p>
          {discardedText && (
            <p className="state-card-body paused-discarded" role="alert">{discardedText}</p>
          )}
          <p className="state-card-body">Tetap di halaman ini. Soal tampil kembali setelah guru melanjutkan ujian.</p>
        </div>
      </main>
    );
  }

  // Locked by a supervisor (D04.6-38/40): the questions are hidden, the time keeps running,
  // answers chosen before the lock keep being sent.
  if (phase === 'active' && lockedAt !== null) {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card paused-card" role="status" aria-live="polite">
          <h1 className="state-card-title">Pengerjaan Dikunci</h1>
          <p className="state-card-body">
            Pengawas mengunci pengerjaan Anda sejak {formatTime(lockedAt)}. Hubungi pengawas ruangan untuk membuka kunci.
          </p>
          <p className="paused-remaining" aria-label={`Sisa waktu ${formattedTime}, tetap berjalan`}>
            <span className="paused-remaining-label">Sisa waktu, tetap berjalan</span>
            <span className="paused-remaining-value">{formattedTime}</span>
          </p>
          <p className="state-card-body">
            {!answers.ready
              ? 'Memeriksa jawaban di perangkat ini...'
              : answers.pendingCount > 0
                ? (degraded || !isOnline
                  ? 'Koneksi terputus. Jawaban yang Anda pilih sebelum pengerjaan dikunci akan dikirim otomatis saat kembali terhubung.'
                  : 'Mengirim jawaban yang Anda pilih sebelum pengerjaan dikunci...')
                : 'Semua jawaban yang Anda pilih sebelum pengerjaan dikunci sudah tersimpan.'}
          </p>
          {discardedText && (
            <p className="state-card-body paused-discarded" role="alert">{discardedText}</p>
          )}
          <p className="state-card-body">Soal tampil kembali setelah pengawas membuka kunci.</p>
        </div>
      </main>
    );
  }

  // Questions appear only once this device's unsynced choices are restored, so nothing can
  // be answered or submitted before the local buffer and the server state are reconciled.
  if (phase === 'loading' || (phase === 'active' && (!answers.ready || questions.length === 0))) {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card">
          <h1 className="state-card-title">Memuat Ujian...</h1>
          <p className="state-card-body">Menyiapkan lembar jawaban dan data soal.</p>
        </div>
      </main>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = questions.filter(q => !!selectedOptions[q.snapshotId]).length;
  const unansweredCount = totalQuestions - answeredCount;

  const currentSaveState = currentQuestion ? saveStates[currentQuestion.snapshotId] : undefined;

  const getSaveStatusPresentation = () => {
    if (!currentSaveState || currentSaveState.status === 'pristine') {
      const isAnswered = currentQuestion ? !!selectedOptions[currentQuestion.snapshotId] : false;
      if (isAnswered) {
        return {
          statusClass: 'saved',
          text: 'Tersimpan',
        };
      }
      return {
        statusClass: 'unanswered',
        text: 'Belum dijawab',
      };
    }
    switch (currentSaveState.status) {
      case 'saving':
        return {
          statusClass: 'saving',
          text: 'Menyimpan...',
        };
      case 'saved':
        return {
          statusClass: 'saved',
          text: 'Tersimpan',
        };
      case 'failed':
        return {
          statusClass: 'failed',
          text: 'Gagal menyimpan',
        };
      case 'unsupported_payload':
        return {
          statusClass: 'unsupported',
          text: 'Format jawaban tidak didukung',
        };
      default:
        return {
          statusClass: 'unanswered',
          text: 'Belum dijawab',
        };
    }
  };

  const saveStatus = getSaveStatusPresentation();

  return (
    <div className="workstation-container">
      {/* Compact Assessment Focus Header: Content-First, Zero Generic Branding */}
      <header className="workstation-header">
        <div className="workstation-header-inner">
          <div className="header-rail-region" aria-hidden="true" />
          <div className="header-workspace-region">
            <div className="header-primary-group">
              <h1 className="question-progress-heading question-progress-indicator">
                Soal {currentIndex + 1} dari {totalQuestions}
              </h1>
              {examContext && (examContext.subjectLabel || examContext.roomLabel) && (
                <span className="exam-context-subtitle">
                  {examContext.subjectLabel || examContext.roomLabel}
                </span>
              )}
            </div>

            <div className="header-status-group">
              {/* Server-authoritative tabular-nums countdown timer */}
              <div
                className={`timer-badge timer-display ${isUrgent ? 'urgent' : isWarning ? 'warning' : ''}`}
                aria-live="polite"
                aria-label={`Sisa waktu pengerjaan ujian: ${formattedTime}`}
              >
                <svg
                  className="timer-clock-icon"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="timer-label sr-only">Sisa Waktu: </span>
                <span className="timer-value">{formattedTime}</span>
              </div>

              {/* Dynamic operational status slot */}
              <div
                className={`save-status-badge dynamic-status-slot ${saveStatus.statusClass}`}
                aria-live="polite"
                aria-label={`Status penyimpanan: ${saveStatus.text}`}
              >
                <span className="status-dot" aria-hidden="true" />
                <span className="save-status-text">{saveStatus.text}</span>
              </div>
            </div>
          </div>
        </div>
        {timeReminder && (
          <div className="time-reminder-banner" role="status" aria-live="polite">
            {timeReminder}
          </div>
        )}
        {examState === 'ENDED' && (
          <div className="exam-ended-banner" role="status">
            Guru telah mengakhiri ujian. Anda tetap dapat menyelesaikan sampai waktu Anda habis.
          </div>
        )}
        {discardedText && (
          <div className="discarded-banner" role="alert">
            <span>{discardedText}</span>
            <button type="button" className="discarded-banner-dismiss" onClick={() => setDiscardedIds([])}>Mengerti</button>
          </div>
        )}
        {(degraded || !isOnline) && (
          <div className="connection-banner" role="status" aria-live="polite">
            {storageDurable
              ? 'Koneksi terputus. Jawaban disimpan sementara di perangkat ini dan akan dikirim otomatis saat kembali terhubung.'
              : 'Koneksi terputus. Jangan tutup atau muat ulang halaman ini. Jawaban akan dikirim otomatis saat kembali terhubung.'}
          </div>
        )}
      </header>

      {/* Main Split Workstation */}
      <main className="workstation-main">
        {/* Left Pane: Question Navigator (Desktop only) */}
        <nav className="navigator-card" aria-label="Daftar Soal Ujian">
          <div className="navigator-header">
            <h2 className="navigator-title">Daftar Soal</h2>
          </div>

          <div className="navigator-legend" aria-hidden="true">
            <span className="legend-chip"><span className="chip-indicator active-dot" /> Aktif</span>
            <span className="legend-chip"><span className="chip-indicator answered-dot" /> Terjawab</span>
            <span className="legend-chip"><span className="chip-indicator unanswered-dot" /> Kosong</span>
            <span className="legend-chip"><span className="chip-indicator flagged-dot" /> Ragu-ragu</span>
          </div>

          <div className="navigator-grid" role="group" aria-label="Nomor Soal">
            {questions.map((q, idx) => {
              const isAnswered = !!selectedOptions[q.snapshotId];
              const isCurrent = idx === currentIndex;
              const qState = saveStates[q.snapshotId];
              const isUnresolved = qState?.status === 'saving' || qState?.status === 'failed';

              const isFlagged = !!review.flags[q.snapshotId];

              let statusText = isAnswered ? 'sudah dijawab' : 'belum dijawab';
              if (isUnresolved) statusText = 'sedang disinkronisasi atau gagal';
              if (isFlagged) statusText += ', ditandai ragu-ragu';

              return (
                <button
                  key={q.snapshotId}
                  type="button"
                  className={`nav-btn ${isCurrent ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isUnresolved ? 'unresolved' : ''} ${isFlagged ? 'flagged' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Pindah ke soal nomor ${idx + 1}, status ${statusText}`}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <span className="nav-btn-num">{idx + 1}</span>
                  {isFlagged && <span className="flag-corner" aria-hidden="true" />}
                  {isAnswered && !isUnresolved && <span className="nav-btn-dot answered-dot" aria-hidden="true" />}
                  {isCurrent && <span className="nav-btn-dot current-dot" aria-hidden="true" />}
                  {isUnresolved && <span className="nav-btn-dot unresolved-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="navigator-summary-box">
            <div className="navigator-summary-row">
              <span className="navigator-summary-label">Total Soal</span>
              <strong className="navigator-summary-val">{totalQuestions}</strong>
            </div>
            <div className="navigator-summary-row">
              <span className="navigator-summary-label">Sudah Dijawab</span>
              <strong className="navigator-summary-val answered-accent">{answeredCount}</strong>
            </div>
            <div className="navigator-summary-row">
              <span className="navigator-summary-label">Belum Dijawab</span>
              <strong className="navigator-summary-val">{unansweredCount}</strong>
            </div>
            {review.flaggedCount > 0 && (
              <div className="navigator-summary-row">
                <span className="navigator-summary-label">Ragu-ragu</span>
                <strong className="navigator-summary-val">{review.flaggedCount}</strong>
              </div>
            )}
          </div>
        </nav>

        {/* Right Pane: Question Stimulus & Options */}
        {currentQuestion && (
          <section className="question-card" aria-label={`Soal nomor ${currentIndex + 1}`}>
            <fieldset className="question-fieldset">
              <legend className="question-prompt">{currentQuestion.prompt}</legend>

              <div className="options-list" role="radiogroup" aria-label="Pilihan Jawaban">
                {currentQuestion.options.map((opt, optIdx) => {
                  const isSelected = selectedOptions[currentQuestion.snapshotId] === opt.id;
                  const optionLabel = String.fromCharCode(65 + optIdx); // A, B, C, D, E

                  return (
                    <label
                      key={opt.id}
                      className={`option-item-label ${isSelected ? 'selected' : ''}`}
                      htmlFor={`option-${currentQuestion.snapshotId}-${opt.id}`}
                    >
                      <input
                        type="radio"
                        id={`option-${currentQuestion.snapshotId}-${opt.id}`}
                        name={`question-${currentQuestion.snapshotId}`}
                        value={opt.id}
                        checked={isSelected}
                        onChange={() => selectOption(currentQuestion.snapshotId, opt.id)}
                        className="option-radio-input"
                      />
                      <span className="option-marker" aria-hidden="true">
                        {optionLabel}
                      </span>
                      <span className="option-text">
                        {opt.content}
                      </span>
                      {isSelected && (
                        <span className="option-check-badge" aria-hidden="true">
                          <svg
                            className="check-svg"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className={`review-flag-toggle ${review.flags[currentQuestion.snapshotId] ? 'flagged' : ''}`}>
              <input
                type="checkbox"
                checked={!!review.flags[currentQuestion.snapshotId]}
                onChange={() => review.toggle(currentQuestion.snapshotId)}
                aria-label="Ragu-ragu"
                aria-describedby="review-flag-hint"
              />
              <span aria-hidden="true">Ragu-ragu</span>
              <span id="review-flag-hint" className="review-flag-hint">Tandai untuk diperiksa lagi sebelum mengumpulkan. Jawaban tidak berubah.</span>
            </label>

            {/* Workstation Actions: Persistent Bottom Bar on Mobile, Grid-aligned on Desktop */}
            <footer className="workstation-actions">
              <div className="action-buttons-group">
                <button
                  type="button"
                  className="btn btn-secondary action-btn action-btn-prev nav-btn-prev"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  aria-label="Soal Sebelumnya"
                >
                  <svg
                    className="dock-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span className="btn-label-mobile">Sebelum</span>
                  <span className="btn-label-desktop">Sebelum</span>
                </button>
                <button
                  ref={navSheetTriggerRef}
                  type="button"
                  className="btn btn-secondary action-btn action-btn-nav mobile-nav-trigger"
                  onClick={() => setIsNavSheetOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={isNavSheetOpen}
                  aria-label="Daftar Soal"
                >
                  <svg
                    className="dock-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                  <span className="btn-label-mobile">Daftar</span>
                  <span className="btn-label-desktop">Daftar Soal</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary action-btn action-btn-next nav-btn-next"
                  onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                  disabled={currentIndex === totalQuestions - 1}
                  aria-label="Soal Berikutnya"
                >
                  <span className="btn-label-mobile">Berikut</span>
                  <span className="btn-label-desktop">Soal Berikutnya</span>
                  <svg
                    className="dock-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="btn btn-primary action-btn action-btn-submit workstation-submit-btn"
                  onClick={() => setIsSubmitModalOpen(true)}
                  disabled={hasUnresolvedSaves}
                  aria-haspopup="dialog"
                  aria-label="Selesaikan Ujian"
                >
                  <svg
                    className="dock-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="btn-label-mobile">Selesai</span>
                  <span className="btn-label-desktop">Selesaikan Ujian</span>
                </button>
              </div>
            </footer>
          </section>
        )}
      </main>

      {/* Mobile Question Navigator Sheet */}
      <QuestionNavigatorSheet
        isOpen={isNavSheetOpen}
        onClose={() => setIsNavSheetOpen(false)}
        questions={questions}
        currentIndex={currentIndex}
        selectedOptions={selectedOptions}
        saveStates={saveStates}
        flags={review.flags}
        onSelectQuestion={idx => setCurrentIndex(idx)}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        hasUnresolvedSaves={hasUnresolvedSaves}
        triggerRef={navSheetTriggerRef}
      />

      {/* Submit Confirmation Modal */}
      <SubmitConfirmModal
        isOpen={isSubmitModalOpen}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        flaggedCount={review.flaggedCount}
        isSubmitting={isSubmitting}
        errorMessage={submitError}
        onCancel={() => {
          setSubmitError('');
          setIsSubmitModalOpen(false);
        }}
        onConfirm={handleConfirmSubmit}
      />
    </div>
  );
};
