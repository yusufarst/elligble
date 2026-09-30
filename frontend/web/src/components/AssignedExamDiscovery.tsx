import React, { useState, useEffect } from 'react';
import { getAssignedExams, postStartAttempt, ApiError } from '../api/assessment-client.ts';
import type { AssignedExamItem } from '../types/assessment.ts';
import { formatDateTime, formatDurationMinutes, formatWindow } from '../lib/format.ts';
import { START_REFUSAL_COPY } from '../lib/start-refusal-copy.ts';
import '../styles/assigned-exam-discovery.css';

// Entry guidance per exam (D04.2-73). Display only: the server decides eligibility
// with its own clock when the student presses "Mulai Ujian" (D04.4-19).
type EntryState =
  | { kind: 'startable' }
  | { kind: 'not_open'; opensAt: string | null }
  | { kind: 'waiting_activation'; opensAt: string | null }
  | { kind: 'paused' }
  | { kind: 'closed' }
  | { kind: 'unknown' };

function entryState(item: AssignedExamItem, serverNow: string | undefined): EntryState {
  const schedule = item.schedule;
  if (!schedule || !schedule.lifecycleState) return { kind: 'unknown' };
  const now = serverNow ? Date.parse(serverNow) : NaN;
  const startsAt = schedule.windowStartsAt ? Date.parse(schedule.windowStartsAt) : NaN;
  const endsAt = schedule.windowEndsAt ? Date.parse(schedule.windowEndsAt) : NaN;
  const beforeStart = !Number.isNaN(now) && !Number.isNaN(startsAt) && now < startsAt;
  const afterEnd = !Number.isNaN(now) && !Number.isNaN(endsAt) && now >= endsAt;
  switch (schedule.lifecycleState) {
    case 'ACTIVE':
      if (beforeStart) return { kind: 'not_open', opensAt: schedule.windowStartsAt };
      if (afterEnd) return { kind: 'closed' };
      return { kind: 'startable' };
    case 'SCHEDULED':
    case 'READY':
      if (afterEnd) return { kind: 'closed' };
      return { kind: 'waiting_activation', opensAt: beforeStart ? schedule.windowStartsAt : null };
    case 'PAUSED':
      return { kind: 'paused' };
    case 'ENDED':
    case 'FINALIZED':
    case 'ARCHIVED':
      return { kind: 'closed' };
    default:
      return { kind: 'unknown' };
  }
}

export interface AssignedExamDiscoveryProps {
  onSelectAttempt?: (attemptId: string) => void;
}

type DiscoveryPhase =
  | 'loading'
  | 'empty'
  | 'ready'
  | 'forbidden'
  | 'error';

export const AssignedExamDiscovery: React.FC<AssignedExamDiscoveryProps> = ({
  onSelectAttempt,
}) => {
  const [phase, setPhase] = useState<DiscoveryPhase>('loading');
  const [assignments, setAssignments] = useState<AssignedExamItem[]>([]);
  const [serverNow, setServerNow] = useState<string | undefined>(undefined);
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [startErrors, setStartErrors] = useState<Record<string, string>>({});

  const fetchAssignedExams = async () => {
    setPhase('loading');
    try {
      const response = await getAssignedExams();
      setServerNow(response.serverNow);
      if (!response.assignments || response.assignments.length === 0) {
        setAssignments([]);
        setPhase('empty');
      } else {
        setAssignments(response.assignments);
        setPhase('ready');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPhase('forbidden');
      } else {
        setPhase('error');
      }
    }
  };

  useEffect(() => {
    fetchAssignedExams();
  }, []);

  const handleStart = async (examInstanceId: string) => {
    if (startingExamId) return;
    setStartingExamId(examInstanceId);
    setStartErrors(prev => ({ ...prev, [examInstanceId]: '' }));
    try {
      const { attemptId } = await postStartAttempt(examInstanceId);
      handleLaunch(attemptId);
    } catch (err) {
      const message = err instanceof ApiError && START_REFUSAL_COPY[err.code]
        ? START_REFUSAL_COPY[err.code]
        : 'Gagal memulai ujian. Periksa koneksi internet Anda dan coba lagi.';
      setStartErrors(prev => ({ ...prev, [examInstanceId]: message }));
    } finally {
      setStartingExamId(null);
    }
  };

  const handleLaunch = (attemptId: string) => {
    if (onSelectAttempt) {
      onSelectAttempt(attemptId);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('attemptId', attemptId);
      window.location.href = url.toString();
    }
  };

  if (phase === 'loading') {
    return (
      <div className="discovery-container">
        <header className="discovery-header">
          <h1 className="discovery-title">Daftar Ujian Siswa</h1>
          <p className="discovery-subtitle">Pilih sesi pengerjaan ujian untuk memulai.</p>
        </header>
        <div className="discovery-loading-state" role="status">
          Memuat daftar ujian...
        </div>
      </div>
    );
  }

  if (phase === 'forbidden') {
    return (
      <div className="discovery-container">
        <header className="discovery-header">
          <h1 className="discovery-title">Daftar Ujian Siswa</h1>
          <p className="discovery-subtitle">Pilih sesi pengerjaan ujian untuk memulai.</p>
        </header>
        <div className="discovery-state-card error">
          <h2 className="discovery-state-title">Akses Ditolak</h2>
          <p className="discovery-state-body">
            Sesi Anda tidak memiliki izin untuk mengakses daftar ujian.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="discovery-container">
        <header className="discovery-header">
          <h1 className="discovery-title">Daftar Ujian Siswa</h1>
          <p className="discovery-subtitle">Pilih sesi pengerjaan ujian untuk memulai.</p>
        </header>
        <div className="discovery-state-card error">
          <h2 className="discovery-state-title">Gagal Memuat Data Ujian</h2>
          <p className="discovery-state-body">
            Terjadi gangguan saat memuat daftar ujian. Silakan muat ulang atau hubungi pengawas.
          </p>
          <button
            type="button"
            className="discovery-retry-button"
            onClick={fetchAssignedExams}
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="discovery-container">
        <header className="discovery-header">
          <h1 className="discovery-title">Daftar Ujian Siswa</h1>
          <p className="discovery-subtitle">Pilih sesi pengerjaan ujian untuk memulai.</p>
        </header>
        <div className="discovery-state-card">
          <h2 className="discovery-state-title">Belum Ada Ujian yang Ditugaskan</h2>
          <p className="discovery-state-body">
            Belum ada ujian yang ditugaskan kepada Anda saat ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="discovery-container">
      <header className="discovery-header">
        <h1 className="discovery-title">Daftar Ujian Siswa</h1>
        <p className="discovery-subtitle">Pilih sesi pengerjaan ujian untuk memulai.</p>
      </header>

      <div className="discovery-list" role="list">
        {assignments.map((item) => {
          const subjectDisplay = item.subjectLabel || 'Penilaian Akademik';
          const hasAttempts = item.attempts && item.attempts.length > 0;

          return (
            <article
              key={item.examInstanceId}
              className="discovery-card"
              data-testid={`assignment-${item.examInstanceId}`}
            >
              <div className="discovery-card-header">
                <h2 className="discovery-subject-title">{subjectDisplay}</h2>
                {item.roomLabel && (
                  <span className="discovery-room-badge">
                    Ruang: {item.roomLabel}
                  </span>
                )}
              </div>

              {item.schedule && (item.schedule.windowStartsAt || item.schedule.attemptDurationSeconds) && (
                <dl className="discovery-schedule">
                  {item.schedule.windowStartsAt && item.schedule.windowEndsAt && (
                    <div>
                      <dt>Waktu pelaksanaan</dt>
                      <dd>{formatWindow(item.schedule.windowStartsAt, item.schedule.windowEndsAt)}</dd>
                    </div>
                  )}
                  {item.schedule.attemptDurationSeconds && (
                    <div>
                      <dt>Durasi</dt>
                      <dd>{formatDurationMinutes(item.schedule.attemptDurationSeconds)}</dd>
                    </div>
                  )}
                </dl>
              )}
              {item.schedule?.change && !hasAttempts && (
                <p className="discovery-schedule-change" role="note">
                  Jadwal diubah oleh guru pada {formatDateTime(item.schedule.change.changedAt)}.
                  {item.schedule.change.previousWindowStartsAt && item.schedule.change.previousWindowEndsAt
                    ? ` Jadwal sebelumnya: ${formatWindow(item.schedule.change.previousWindowStartsAt, item.schedule.change.previousWindowEndsAt)}.`
                    : ''}
                </p>
              )}

              {!hasAttempts ? (
                (() => {
                  const state = entryState(item, serverNow);
                  const error = startErrors[item.examInstanceId];
                  if (state.kind === 'startable') {
                    return (
                      <div className="discovery-entry">
                        <button
                          type="button"
                          className="discovery-launch-button"
                          data-testid={`start-button-${item.examInstanceId}`}
                          disabled={startingExamId !== null}
                          onClick={() => handleStart(item.examInstanceId)}
                        >
                          {startingExamId === item.examInstanceId ? 'Menyiapkan...' : 'Mulai Ujian'}
                        </button>
                        {error && <p className="discovery-entry-error" role="alert">{error}</p>}
                      </div>
                    );
                  }
                  const text =
                    state.kind === 'not_open' ? `Ujian dibuka ${state.opensAt ? formatDateTime(state.opensAt) : 'sesuai waktu pelaksanaan'}.` :
                    state.kind === 'waiting_activation' ? (state.opensAt ? `Ujian dibuka ${formatDateTime(state.opensAt)} setelah guru atau pengawas membukanya.` : 'Menunggu guru atau pengawas membuka ujian.') :
                    state.kind === 'paused' ? 'Ujian sedang dijeda oleh guru atau pengawas.' :
                    state.kind === 'closed' ? 'Waktu pelaksanaan ujian telah berakhir.' :
                    'Belum ada sesi pengerjaan yang tersedia.';
                  return (
                    <div className="discovery-no-attempts">
                      {text}
                    </div>
                  );
                })()
              ) : (
                <div className="discovery-attempts-list">
                  {item.attempts.map((attempt) => {
                    const isSubmitted = Boolean(attempt.submittedAt);

                    return (
                      <div
                        key={attempt.attemptId}
                        className="discovery-attempt-item"
                        data-testid={`attempt-row-${attempt.attemptId}`}
                      >
                        <div className="discovery-attempt-info">
                          {isSubmitted && (
                            <span className="discovery-status-badge submitted">
                              Sudah dikumpulkan
                            </span>
                          )}
                        </div>

                        {!isSubmitted && (
                          <button
                            type="button"
                            className="discovery-launch-button"
                            data-testid={`launch-button-${attempt.attemptId}`}
                            onClick={() => handleLaunch(attempt.attemptId)}
                          >
                            Mulai Pengerjaan
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default AssignedExamDiscovery;
