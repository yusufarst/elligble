import React, { useState, useEffect, useRef } from 'react';
import { getResume, postActivateSession, postStartTimer, ApiError } from '../api/assessment-client.ts';
import { StudentExamWorkstation } from './StudentExamWorkstation.tsx';
import type { ResumeResponse } from '../types/assessment.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LaunchPhase =
  | 'initializing'
  | 'invalid_attempt'
  | 'forbidden'
  | 'not_found'
  | 'inconsistent_state'
  | 'pre_start_no_session'
  | 'pre_start_has_session'
  | 'conflict_confirmation'
  | 'launching'
  | 'launched';

export const AttemptLaunch: React.FC = () => {
  const [phase, setPhase] = useState<LaunchPhase>('initializing');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [resumeContext, setResumeContext] = useState<ResumeResponse['context'] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const candidateSessionIdRef = useRef<string>('');
  const [conflictSessionId, setConflictSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('attemptId');
    if (!id || !UUID_REGEX.test(id)) {
      setPhase('invalid_attempt');
      return;
    }
    setAttemptId(id);
    candidateSessionIdRef.current = crypto.randomUUID();
  }, []);

  const fetchState = async (id: string, _forceRefresh: boolean = false) => {
    try {
      setPhase('initializing');
      const resume = await getResume(id);
      setResumeContext(resume.context);

      if (resume.submission && resume.submission.status === 'submitted') {
        setPhase('launched');
        return;
      }

      if (resume.session.status === 'active') {
        if (resume.timer && resume.timer.status === 'active') {
          setPhase('launched');
        } else {
          setPhase('pre_start_has_session');
        }
      } else {
        if (resume.timer && resume.timer.status === 'active') {
          setPhase('inconsistent_state');
        } else {
          setPhase('pre_start_no_session');
        }
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
  };

  useEffect(() => {
    if (attemptId && phase === 'initializing') {
      fetchState(attemptId);
    }
  }, [attemptId, phase]);

  const handleLaunch = async () => {
    if (!attemptId) return;
    setPhase('launching');
    setErrorMessage('');

    try {
      if (phase === 'pre_start_no_session') {
        await postActivateSession({
          attemptId,
          sessionId: candidateSessionIdRef.current,
        });
      }
      
      await postStartTimer({ attemptId });
      setPhase('launched');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        if (err.code === 'active_session_exists' && err.data?.activeSessionId) {
          setConflictSessionId(err.data.activeSessionId);
          setPhase('conflict_confirmation');
          return;
        } else if (err.code === 'session_not_activatable') {
          setErrorMessage('Sesi ujian tidak dapat diaktifkan.');
          setPhase('inconsistent_state');
          return;
        }
      }
      setErrorMessage('Gagal memulai ujian. Silakan coba lagi.');
      setPhase('pre_start_no_session'); // Or whatever allows retry safely
    }
  };

  const handleConfirmSupersede = async () => {
    if (!attemptId || !conflictSessionId) return;
    setPhase('launching');
    setErrorMessage('');

    try {
      await postActivateSession({
        attemptId,
        sessionId: candidateSessionIdRef.current,
        expectedActiveSessionId: conflictSessionId,
        confirmSupersede: true,
      });
      await postStartTimer({ attemptId });
      setPhase('launched');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'active_session_changed') {
        // Refresh authoritative resume state and require confirmation again
        fetchState(attemptId, true);
        return;
      }
      setErrorMessage('Gagal mengambil alih sesi ujian. Silakan coba lagi.');
      setPhase('conflict_confirmation');
    }
  };

  if (phase === 'launched') {
    return <StudentExamWorkstation />;
  }

  const renderContext = () => {
    if (!resumeContext || (!resumeContext.subjectLabel && !resumeContext.roomLabel)) return null;
    return (
      <div className="launch-context" style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--color-neutral-600)' }}>
        {resumeContext.subjectLabel && <div style={{ fontSize: '1.125rem', fontWeight: 500 }}>{resumeContext.subjectLabel}</div>}
        {resumeContext.roomLabel && <div>{resumeContext.roomLabel}</div>}
      </div>
    );
  };

  if (phase === 'invalid_attempt') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert">
          <h1 className="state-card-title">Tautan Ujian Tidak Valid</h1>
          <p className="state-card-body">
            Sesi ujian ini harus dibuka melalui halaman tugas / ujian yang resmi. Silakan kembali ke halaman utama aplikasi dan pilih ujian yang ditugaskan kepada Anda.
          </p>
        </div>
      </main>
    );
  }

  if (phase === 'forbidden') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert">
          <h1 className="state-card-title">Akses Ditolak</h1>
          <p className="state-card-body">
            Anda tidak memiliki izin untuk mengakses sesi pengerjaan ujian ini.
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

  if (phase === 'inconsistent_state') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card" role="alert">
          <h1 className="state-card-title">Status Ujian Tidak Valid</h1>
          <p className="state-card-body">
            {errorMessage || 'Sistem mendeteksi ketidaksesuaian status pada ujian Anda. Harap hubungi pengawas.'}
          </p>
        </div>
      </main>
    );
  }

  if (phase === 'conflict_confirmation') {
    return (
      <main className="fullscreen-state-container">
        <div className="state-card">
          <h1 className="state-card-title">Sesi Aktif Ditemukan</h1>
          {renderContext()}
          <p className="state-card-body" style={{ marginBottom: '1.5rem' }}>
            Sistem mendeteksi Anda sedang mengerjakan ujian ini di perangkat atau jendela lain.
            Apakah Anda ingin memindahkan sesi pengerjaan ke layar ini?
          </p>
          {errorMessage && <p className="state-card-body" style={{ color: 'var(--color-red-600)', marginBottom: '1rem' }}>{errorMessage}</p>}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fetchState(attemptId!)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmSupersede}
            >
              Ya, Pindahkan Sesi
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'pre_start_no_session' || phase === 'pre_start_has_session' || phase === 'launching') {
    const isLaunching = phase === 'launching';
    return (
      <main className="fullscreen-state-container">
        <div className="state-card">
          <h1 className="state-card-title">Siap Memulai Ujian</h1>
          {renderContext()}
          <p className="state-card-body" style={{ marginBottom: '1.5rem' }}>
            Pastikan Anda sudah siap. Waktu akan mulai berjalan segera setelah Anda menekan tombol di bawah.
          </p>
          {errorMessage && <p className="state-card-body" style={{ color: 'var(--color-red-600)', marginBottom: '1rem' }}>{errorMessage}</p>}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLaunch}
            disabled={isLaunching}
            style={{ width: '100%', maxWidth: '300px', margin: '0 auto', display: 'block' }}
          >
            {isLaunching ? 'Memulai...' : 'Mulai Ujian Sekarang'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="fullscreen-state-container">
      <div className="state-card">
        <h1 className="state-card-title">Memuat...</h1>
      </div>
    </main>
  );
};
