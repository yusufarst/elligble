import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { StudentSafeQuestion, ResumeResponse } from '../types/assessment.ts';
import { getResume, getQuestions, postSubmit, postExpiryFinalize, ApiError } from '../api/assessment-client.ts';
import { useAuthoritativeTimer } from '../hooks/useAuthoritativeTimer.ts';
import { useAnswerManager } from '../hooks/useAnswerManager.ts';
import { SubmitConfirmModal } from './SubmitConfirmModal.tsx';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkstationPhase =
  | 'invalid_attempt'
  | 'loading'
  | 'access_denied'
  | 'not_found'
  | 'session_inactive'
  | 'timer_not_started'
  | 'active'
  | 'expired'
  | 'submitted'
  | 'error';

export const StudentExamWorkstation: React.FC = () => {
  const [phase, setPhase] = useState<WorkstationPhase>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [questions, setQuestions] = useState<StudentSafeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [initialRemainingSeconds, setInitialRemainingSeconds] = useState<number>(0);
  const [initialAnswers, setInitialAnswers] = useState<ResumeResponse['answers']>([]);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const expiryFinalizedRef = useRef<boolean>(false);

  // Validate attemptId from search params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('attemptId');

    if (!id || !UUID_REGEX.test(id)) {
      setPhase('invalid_attempt');
      return;
    }

    setAttemptId(id);
  }, []);

  // Initial resume load
  useEffect(() => {
    if (!attemptId) return;

    let isCancelled = false;

    async function loadResume() {
      try {
        const resume = await getResume(attemptId!);
        if (isCancelled) return;

        // Check if already submitted
        if (resume.submission && resume.submission.status === 'submitted') {
          setSubmittedAt(resume.submission.submittedAt);
          setPhase('submitted');
          return;
        }

        // Check active session
        if (resume.session.status !== 'active') {
          setPhase('session_inactive');
          return;
        }

        setSessionId(resume.session.sessionId);

        // Check timer
        if (!resume.timer || resume.timer.status === 'not_started') {
          setPhase('timer_not_started');
          return;
        }

        if (resume.timer.status === 'active') {
          if (resume.timer.effectiveRemainingSeconds <= 0) {
            setPhase('expired');
            if (!expiryFinalizedRef.current) {
              expiryFinalizedRef.current = true;
              postExpiryFinalize(attemptId!).then(res => {
                setSubmittedAt(res.submittedAt);
                setPhase('submitted');
              }).catch(() => {
                // Remain in expired safe state
              });
            }
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
              setPhase('expired');
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
  }, [attemptId]);

  // Handle timer expiration
  const handleExpire = useCallback(async () => {
    setPhase('expired');
    if (attemptId && !expiryFinalizedRef.current) {
      expiryFinalizedRef.current = true;
      try {
        const res = await postExpiryFinalize(attemptId);
        setSubmittedAt(res.submittedAt);
        setPhase('submitted');
      } catch {
        // Safe non-success state: student instructed not to close page
      }
    }
  }, [attemptId]);

  const { formattedTime, isWarning, isUrgent } = useAuthoritativeTimer({
    attemptId: attemptId || '',
    initialRemainingSeconds,
    enabled: phase === 'active',
    onExpire: handleExpire,
  });

  const handleTerminalEvent = useCallback((code: string) => {
    if (code === 'timer_expired') {
      handleExpire();
    } else if (code === 'attempt_already_submitted') {
      setPhase('submitted');
    } else if (code === 'session_not_active') {
      setPhase('session_inactive');
    }
  }, [handleExpire]);

  const { selectedOptions, saveStates, selectOption, hasUnresolvedSaves } = useAnswerManager({
    attemptId: attemptId || '',
    sessionId,
    initialAnswers,
    onTerminalEvent: handleTerminalEvent,
  });

  // Handle final submission
  const handleConfirmSubmit = useCallback(async () => {
    if (!attemptId || hasUnresolvedSaves || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await postSubmit(attemptId);
      setSubmittedAt(res.submittedAt);
      setIsSubmitModalOpen(false);
      setPhase('submitted');
    } catch {
      setIsSubmitting(false);
      alert('Gagal mengumpulkan ujian. Pastikan seluruh jawaban telah tersimpan dan coba lagi.');
    }
  }, [attemptId, hasUnresolvedSaves, isSubmitting]);

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
              Waktu Pengumpulan: {new Date(submittedAt).toLocaleTimeString('id-ID')} WIB
            </p>
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

  return (
    <div className="workstation-container">
      {/* Persistent Top Navigation Bar */}
      <header className="workstation-header">
        <h1 className="workstation-header-title">Ruang Ujian Aman</h1>
        <div className="workstation-header-meta">
          <span className="question-progress-indicator">
            Soal {currentIndex + 1} dari {totalQuestions}
          </span>
          <div
            className={`timer-badge ${isUrgent ? 'urgent' : isWarning ? 'warning' : ''}`}
            aria-live="polite"
            aria-label={`Sisa waktu pengerjaan ujian: ${formattedTime}`}
          >
            <span>Sisa Waktu: {formattedTime}</span>
          </div>
        </div>
      </header>

      {/* Main Split Workstation */}
      <main className="workstation-main">
        {/* Left Pane: Question Navigator */}
        <nav className="navigator-card" aria-label="Daftar Soal Ujian">
          <h2 className="navigator-title">Daftar Soal</h2>
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
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right Pane: Question Stimulus & Options */}
        {currentQuestion && (
          <section className="question-card" aria-label={`Soal nomor ${currentIndex + 1}`}>
            <div className="question-card-header">
              <h2 className="question-number-heading">Soal Nomor {currentIndex + 1}</h2>
              {/* Save Status Badge */}
              <div
                className={`save-status-badge ${
                  currentSaveState?.status === 'saved'
                    ? 'saved'
                    : currentSaveState?.status === 'saving'
                    ? 'saving'
                    : currentSaveState?.status === 'failed'
                    ? 'failed'
                    : ''
                }`}
                aria-live="polite"
              >
                {currentSaveState?.status === 'saved' && 'Tersimpan'}
                {currentSaveState?.status === 'saving' && 'Menyimpan...'}
                {currentSaveState?.status === 'failed' && 'Gagal menyimpan'}
                {currentSaveState?.status === 'unsupported_payload' && 'Format jawaban tidak didukung'}
              </div>
            </div>

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
                      <span className="option-text">
                        <strong>{optionLabel}.</strong> {opt.content}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Workstation Actions Footer */}
            <footer className="workstation-actions">
              <div className="nav-buttons-group">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                >
                  Soal Sebelumnya
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                  disabled={currentIndex === totalQuestions - 1}
                >
                  Soal Berikutnya
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsSubmitModalOpen(true)}
                disabled={hasUnresolvedSaves}
                aria-haspopup="dialog"
              >
                Selesaikan Ujian
              </button>
            </footer>
          </section>
        )}
      </main>

      {/* Submit Confirmation Modal */}
      <SubmitConfirmModal
        isOpen={isSubmitModalOpen}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        isSubmitting={isSubmitting}
        onCancel={() => setIsSubmitModalOpen(false)}
        onConfirm={handleConfirmSubmit}
      />
    </div>
  );
};
