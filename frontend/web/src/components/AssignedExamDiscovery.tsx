import React, { useState, useEffect } from 'react';
import { getAssignedExams, ApiError } from '../api/assessment-client.ts';
import type { AssignedExamItem } from '../types/assessment.ts';
import '../styles/assigned-exam-discovery.css';

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

  const fetchAssignedExams = async () => {
    setPhase('loading');
    try {
      const response = await getAssignedExams();
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
          <h2 className="discovery-state-title">Belum Ada Ujian Terjadwal</h2>
          <p className="discovery-state-body">
            Saat ini belum ada jadwal ujian yang aktif untuk kelas Anda.
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

              {!hasAttempts ? (
                <div className="discovery-no-attempts">
                  Belum ada sesi pengerjaan yang tersedia.
                </div>
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
                          {isSubmitted ? (
                            <span className="discovery-status-badge submitted">
                              Sudah dikumpulkan
                            </span>
                          ) : (
                            <span className="discovery-status-badge available">
                              Siap Dikerjakan
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
