import React, { useState, useEffect, useCallback } from 'react';
import { getTeacherReadiness, ApiError } from '../api/assessment-client.ts';
import type { TeacherReadinessResponse, TeacherExamReadinessProjection } from '../types/assessment.ts';
import '../styles/teacher-readiness.css';
import '../styles/design-tokens.css';

export const TeacherReadinessView: React.FC = () => {
  const [data, setData] = useState<TeacherReadinessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchReadinessData = useCallback(async () => {
    try {
      const response = await getTeacherReadiness();
      setData(response);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('forbidden');
        } else {
          setError('api_error');
        }
      } else {
        setError('network_error');
      }
    }
  }, []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await fetchReadinessData();
    setLoading(false);
  }, [fetchReadinessData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchReadinessData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  if (loading) {
    return (
      <div className="teacher-readiness-container">
        <div className="teacher-state-message">
          <h2 className="teacher-state-title">Memuat data kesiapan ujian...</h2>
          <p>Harap tunggu sebentar.</p>
        </div>
      </div>
    );
  }

  if (error) {
    let title = 'Terjadi Kesalahan';
    let message = 'Gagal memuat data kesiapan ujian. Silakan coba lagi.';

    if (error === 'forbidden') {
      title = 'Akses Ditolak';
      message = 'Anda tidak memiliki hak akses. Pastikan Anda ditugaskan sebagai guru.';
    }

    return (
      <div className="teacher-readiness-container">
        <div className="teacher-state-message">
          <h2 className="teacher-state-title">{title}</h2>
          <p>{message}</p>
          <button className="teacher-refresh-btn" onClick={handleRefresh} disabled={isRefreshing} style={{ marginTop: '16px' }}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const exams = data?.exams || [];

  if (exams.length === 0) {
    return (
      <div className="teacher-readiness-container">
        <div className="teacher-state-message">
          <h2 className="teacher-state-title">Tidak Ada Ujian Terjadwal</h2>
          <p>Anda belum memiliki ujian yang dijadwalkan saat ini.</p>
          <button className="teacher-refresh-btn" onClick={handleRefresh} disabled={isRefreshing} style={{ marginTop: '16px' }}>
            Perbarui Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-readiness-container">
      <div className="teacher-readiness-header">
        <h1 className="teacher-readiness-title">Kesiapan Ujian</h1>
        <button
          className="teacher-refresh-btn"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Memperbarui...' : 'Perbarui Data'}
        </button>
      </div>

      <div className="teacher-exams-list">
        {exams.map((exam: TeacherExamReadinessProjection) => {
          const isBaselineReady = exam.baseline.type === 'baseline_readiness_checks_pass';
          const isRoomProctorReady = exam.roomProctor.type === 'room_proctor_readiness_not_applicable' || exam.roomProctor.type === 'room_proctor_readiness_ready';
          const isFullyReady = isBaselineReady && isRoomProctorReady;

          return (
            <div key={exam.examInstanceId} className="teacher-exam-card">
              <div className="teacher-exam-card-header">
                <h2 className="teacher-exam-subject">{exam.subjectLabel || 'Mata Pelajaran Tidak Diketahui'}</h2>
                <div className={`teacher-status-badge ${isFullyReady ? 'status-ready' : 'status-not-ready'}`}>
                  {isFullyReady ? 'SIAP' : 'BELUM SIAP'}
                </div>
              </div>

              <div className="teacher-readiness-details">
                <div className="readiness-section">
                  <h3 className="readiness-section-title">Kesiapan Dasar (Baseline)</h3>
                  {isBaselineReady ? (
                    <p className="readiness-pass">Semua pengecekan dasar terpenuhi.</p>
                  ) : (
                    <div className="readiness-fail">
                      <p>Pengecekan dasar gagal:</p>
                      <code>{exam.baseline.type === 'not_ready' ? exam.baseline.blocker : exam.baseline.type}</code>
                    </div>
                  )}
                </div>

                <div className="readiness-section">
                  <h3 className="readiness-section-title">Kesiapan Ruangan &amp; Pengawas</h3>
                  {isRoomProctorReady ? (
                    <p className="readiness-pass">Pengecekan ruangan/pengawas terpenuhi (atau tidak wajib).</p>
                  ) : (
                    <div className="readiness-fail">
                      <p>Pengecekan ruangan/pengawas gagal:</p>
                      <code>{exam.roomProctor.type === 'not_ready' ? exam.roomProctor.blocker : exam.roomProctor.type}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
