import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { StudentSafeQuestion, ResumeResponse } from '../types/assessment.ts';
import { getResume, getQuestions, getTimer, postSubmit, postExpiryFinalize, ApiError } from '../api/assessment-client.ts';
import { getActiveTenantId } from '../api/http.ts';
import { useAuthoritativeTimer } from '../hooks/useAuthoritativeTimer.ts';
import { useAnswerManager } from '../hooks/useAnswerManager.ts';
import { clearLocalAnswers } from '../exam/answer-store.ts';
import { countUnreceivedLocalAnswers } from '../exam/answer-sync-api.ts';
import { forgetExamSessionId, readExamSessionId } from '../exam/exam-session.ts';
import { formatTime } from '../lib/format.ts';
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

const FINALIZE_RETRY_INITIAL_MS = 2000;
const FINALIZE_RETRY_MAX_MS = 30000;
const EXPIRY_FLUSH_WAIT_MS = 3000;

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
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [unreceivedAtCompletion, setUnreceivedAtCompletion] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isNavSheetOpen, setIsNavSheetOpen] = useState<boolean>(false);
  const navSheetTriggerRef = useRef<HTMLButtonElement>(null);

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
    forgetExamSessionId(id);
    if (!mountedRef.current) return;
    setUnreceivedAtCompletion(unreceived);
    setSubmittedAt(at);
    setIsSubmitModalOpen(false);
    setPhase('submitted');
  }, [tenantKey]);

  const timerControlRef = useRef<{ applyServerRemaining: (seconds: number) => void } | null>(null);
  const answersRef = useRef<{ pendingCount: number; flush: () => void; hasUnresolvedSaves: boolean } | null>(null);

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
    enabled: phase === 'active',
    onExpire: handleExpire,
  });
  timerControlRef.current = timer;
  const { formattedTime, isWarning, isUrgent } = timer;

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

  const answers = useAnswerManager({
    tenantId: tenantKey,
    attemptId: attemptId || '',
    sessionId,
    initialAnswers,
    enabled: phase === 'active' || phase === 'expired',
    onSessionInactive: handleSessionInactive,
    onTerminalEvent: handleTerminalEvent,
  });
  const { selectedOptions, saveStates, selectOption, hasUnresolvedSaves, degraded, storageDurable } = answers;
  answersRef.current = { pendingCount: answers.pendingCount, flush: answers.flush, hasUnresolvedSaves };

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
      setSubmitError('Gagal mengumpulkan ujian. Periksa koneksi internet Anda lalu coba lagi.');
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [attemptId, hasUnresolvedSaves, isSubmitting, completeAttempt, handleExpire]);

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

  if (phase === 'loading') {
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
          </div>

          <div className="navigator-grid" role="group" aria-label="Nomor Soal">
            {questions.map((q, idx) => {
              const isAnswered = !!selectedOptions[q.snapshotId];
              const isCurrent = idx === currentIndex;
              const qState = saveStates[q.snapshotId];
              const isUnresolved = qState?.status === 'saving' || qState?.status === 'failed';

              let statusText = isAnswered ? 'sudah dijawab' : 'belum dijawab';
              if (isUnresolved) statusText = 'sedang disinkronisasi atau gagal';

              return (
                <button
                  key={q.snapshotId}
                  type="button"
                  className={`nav-btn ${isCurrent ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isUnresolved ? 'unresolved' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Pindah ke soal nomor ${idx + 1}, status ${statusText}`}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <span className="nav-btn-num">{idx + 1}</span>
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
