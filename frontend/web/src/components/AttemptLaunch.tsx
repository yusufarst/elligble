import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getResume, postActivateSession, postStartTimer, ApiError } from '../api/assessment-client.ts';
import { StudentExamWorkstation } from './StudentExamWorkstation.tsx';
import type { ResumeResponse } from '../types/assessment.ts';
import {
  claimExamSessionForTab,
  forgetExamSessionId,
  newExamSessionId,
  readExamSessionId,
  storeExamSessionId,
} from '../exam/exam-session.ts';
import { START_REFUSAL_COPY } from '../lib/start-refusal-copy.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconAlertCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { StatusPage } from '@/components/ui/status-page';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LaunchPhase =
  | 'initializing'
  | 'invalid_attempt'
  | 'forbidden'
  | 'not_found'
  | 'inconsistent_state'
  /** No active session, or this tab's own session with the timer not started yet. */
  | 'ready_to_start'
  /** The exam session is active on another device or tab: explicit takeover only. */
  | 'takeover_required'
  | 'launching'
  | 'launched';

export interface AttemptLaunchProps {
  /** Leaves the exam screen (back to the student's exam list). */
  onExit?: () => void;
}

function refusalMessage(err: unknown): string | null {
  return err instanceof ApiError && START_REFUSAL_COPY[err.code] ? START_REFUSAL_COPY[err.code] : null;
}

// One exam session per attempt is active at a time (D04.4-32/35/36/37). This tab keeps its
// own session id; the server only reports whether that id is the active one, and moving
// the exam to this tab always needs the student's explicit confirmation.
export const AttemptLaunch: React.FC<AttemptLaunchProps> = ({ onExit }) => {
  const [phase, setPhase] = useState<LaunchPhase>('initializing');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [resumeContext, setResumeContext] = useState<ResumeResponse['context'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [examSessionId, setExamSessionId] = useState<string | null>(null);

  /** Candidate id for activating from this screen; reused across retries of the same launch. */
  const candidateRef = useRef<string | null>(null);
  /** Fingerprint of the session to take over, known after a 409 active_session_exists. */
  const fingerprintRef = useRef<string | null>(null);

  const ensureCandidate = useCallback((id: string): string => {
    if (!candidateRef.current) {
      candidateRef.current = newExamSessionId();
      // Stored before activation: if the response is lost, a reload still finds its session.
      storeExamSessionId(id, candidateRef.current);
      void claimExamSessionForTab(candidateRef.current);
    }
    return candidateRef.current;
  }, []);

  const adoptSession = useCallback((id: string, sessionId: string) => {
    storeExamSessionId(id, sessionId);
    setExamSessionId(sessionId);
  }, []);

  const loadState = useCallback(async (id: string) => {
    setPhase('initializing');
    setErrorMessage('');
    fingerprintRef.current = null;
    let own = readExamSessionId(id);
    if (own && !(await claimExamSessionForTab(own))) {
      // Another tab of this browser (e.g. a duplicated tab) already works with this id.
      own = null;
      forgetExamSessionId(id);
    }
    try {
      const resume = await getResume(id, own);
      setResumeContext(resume.context);
      const timerActive = resume.timer?.status === 'active';

      if (resume.submission && resume.submission.status === 'submitted') {
        setPhase('launched');
        return;
      }
      if (own && resume.session.status === 'active' && resume.session.ownedByCaller) {
        adoptSession(id, own);
        setPhase(timerActive ? 'launched' : 'ready_to_start');
        return;
      }
      // This tab has no active session of its own.
      setExamSessionId(null);
      if (own && own !== candidateRef.current) forgetExamSessionId(id);
      if (resume.session.status === 'active') {
        setPhase('takeover_required');
      } else if (timerActive) {
        setPhase('inconsistent_state');
      } else {
        setPhase('ready_to_start');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) setPhase('forbidden');
        else if (err.status === 404) setPhase('not_found');
        else {
          setErrorMessage('Terjadi kesalahan tidak terduga saat memuat data ujian.');
          setPhase('inconsistent_state');
        }
      } else {
        setErrorMessage('Gagal terhubung ke server.');
        setPhase('inconsistent_state');
      }
    }
  }, [adoptSession]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('attemptId');
    if (!id || !UUID_REGEX.test(id)) {
      setPhase('invalid_attempt');
      return;
    }
    setAttemptId(id);
    void loadState(id);
    // Runs once per mounted exam screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartFailure = (err: unknown, fallback: string, retryPhase: LaunchPhase) => {
    if (err instanceof ApiError && err.status === 409) {
      if (err.code === 'active_session_exists' && typeof err.data?.activeSessionFingerprint === 'string') {
        fingerprintRef.current = err.data.activeSessionFingerprint;
        setPhase('takeover_required');
        return;
      }
      if (err.code === 'session_not_activatable') {
        setErrorMessage('Sesi ujian tidak dapat diaktifkan.');
        setPhase('inconsistent_state');
        return;
      }
      if (err.code === 'attempt_already_submitted') {
        setPhase('launched');
        return;
      }
    }
    setErrorMessage(refusalMessage(err) ?? fallback);
    setPhase(retryPhase);
  };

  const handleLaunch = async () => {
    if (!attemptId) return;
    setPhase('launching');
    setErrorMessage('');
    try {
      if (!examSessionId) {
        const candidate = ensureCandidate(attemptId);
        await postActivateSession({ attemptId, sessionId: candidate });
        adoptSession(attemptId, candidate);
      }
      await postStartTimer({ attemptId });
      setPhase('launched');
    } catch (err) {
      handleStartFailure(err, 'Gagal memulai ujian. Silakan coba lagi.', 'ready_to_start');
    }
  };

  const handleConfirmTakeover = async () => {
    if (!attemptId) return;
    setPhase('launching');
    setErrorMessage('');
    const candidate = ensureCandidate(attemptId);
    try {
      let fingerprint = fingerprintRef.current;
      let activated = false;
      if (!fingerprint) {
        // Resume only said "active elsewhere": learn which session is being replaced.
        try {
          await postActivateSession({ attemptId, sessionId: candidate });
          activated = true;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409 && err.code === 'active_session_exists' && typeof err.data?.activeSessionFingerprint === 'string') {
            fingerprint = err.data.activeSessionFingerprint;
          } else {
            throw err;
          }
        }
      }
      if (!activated) {
        await postActivateSession({
          attemptId,
          sessionId: candidate,
          expectedActiveSessionFingerprint: fingerprint ?? undefined,
          confirmSupersede: true,
        });
      }
      adoptSession(attemptId, candidate);
      await postStartTimer({ attemptId });
      setPhase('launched');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'active_session_changed') {
        // The session changed again meanwhile: show the current state and ask again.
        void loadState(attemptId);
        return;
      }
      if (err instanceof ApiError && err.status === 409 && err.code !== 'active_session_exists') {
        handleStartFailure(err, 'Gagal mengambil alih sesi ujian. Silakan coba lagi.', 'takeover_required');
        return;
      }
      setErrorMessage(refusalMessage(err) ?? 'Gagal mengambil alih sesi ujian. Silakan coba lagi.');
      setPhase('takeover_required');
    }
  };

  const handleSessionLost = useCallback(() => {
    if (!attemptId) return;
    candidateRef.current = null;
    setExamSessionId(null);
    forgetExamSessionId(attemptId);
    void loadState(attemptId);
  }, [attemptId, loadState]);

  if (phase === 'launched') {
    return (
      <StudentExamWorkstation
        examSessionId={examSessionId ?? undefined}
        onRequestTakeover={handleSessionLost}
        onExit={onExit}
      />
    );
  }

  // The exam the page is about: its subject, else its room.
  const context = resumeContext?.subjectLabel || resumeContext?.roomLabel || undefined;

  if (phase === 'invalid_attempt') {
    return (
      <StatusPage title="Tautan Ujian Tidak Valid" role="alert">
        <p>
          Sesi ujian ini harus dibuka melalui halaman tugas / ujian yang resmi. Silakan kembali ke halaman utama aplikasi dan pilih ujian yang ditugaskan kepada Anda.
        </p>
      </StatusPage>
    );
  }

  if (phase === 'forbidden') {
    return (
      <StatusPage title="Akses Ditolak" role="alert">
        <p>Anda tidak memiliki izin untuk mengakses sesi pengerjaan ujian ini.</p>
      </StatusPage>
    );
  }

  if (phase === 'not_found') {
    return (
      <StatusPage title="Data Tidak Ditemukan" role="alert">
        <p>Data pengerjaan ujian tidak ditemukan. Hubungi pengawas ruangan.</p>
      </StatusPage>
    );
  }

  if (phase === 'inconsistent_state') {
    return (
      <StatusPage title="Status Ujian Tidak Valid" role="alert">
        <p>{errorMessage || 'Sistem mendeteksi ketidaksesuaian status pada ujian Anda. Harap hubungi pengawas.'}</p>
      </StatusPage>
    );
  }

  if (phase === 'takeover_required') {
    return (
      <StatusPage
        title="Sesi Aktif Ditemukan"
        subtitle={context}
        actions={
          <>
            <Button variant="secondary" onClick={() => (onExit ? onExit() : attemptId && loadState(attemptId))}>
              Batal
            </Button>
            <Button onClick={handleConfirmTakeover}>Ya, Pindahkan Sesi</Button>
          </>
        }
      >
        <p>
          Sistem mendeteksi Anda sedang mengerjakan ujian ini di perangkat atau jendela lain.
          Apakah Anda ingin memindahkan sesi pengerjaan ke layar ini?
        </p>
        <p>Jawaban yang sudah tersimpan tetap aman. Layar lain akan dinonaktifkan dan tidak dapat lagi menyimpan jawaban.</p>
        {errorMessage && (
          <Alert variant="destructive">
            <IconAlertCircle aria-hidden="true" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </StatusPage>
    );
  }

  if (phase === 'ready_to_start' || phase === 'launching') {
    const isLaunching = phase === 'launching';
    return (
      <StatusPage
        title="Siap Memulai Ujian"
        subtitle={context}
        actions={
          <>
            <Button onClick={handleLaunch} disabled={isLaunching}>
              {isLaunching ? 'Memulai...' : 'Mulai Ujian Sekarang'}
            </Button>
            {onExit && !isLaunching && (
              <Button variant="secondary" onClick={onExit}>Kembali ke Jadwal Ujian</Button>
            )}
          </>
        }
      >
        <p>Pastikan Anda sudah siap. Waktu akan mulai berjalan segera setelah Anda menekan tombol di bawah.</p>
        {errorMessage && (
          <Alert variant="destructive">
            <IconAlertCircle aria-hidden="true" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </StatusPage>
    );
  }

  return <StatusPage title="Memuat..." role="status" live="polite" />;
};
