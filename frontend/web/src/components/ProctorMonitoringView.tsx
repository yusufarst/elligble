import React, { useState, useEffect, useCallback } from 'react';
import { getProctorMonitoring, ApiError } from '../api/assessment-client.ts';
import type { ProctorMonitoringResponse, ProctorMonitoringExamProjection, ProctorMonitoringRoomProjection } from '../types/assessment.ts';
import '../styles/proctor-monitoring.css';
import '../styles/design-tokens.css';

export const ProctorMonitoringView: React.FC = () => {
  const [data, setData] = useState<ProctorMonitoringResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const response = await getProctorMonitoring();
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
    await fetchMonitoringData();
    setLoading(false);
  }, [fetchMonitoringData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMonitoringData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  if (loading) {
    return (
      <div className="proctor-monitoring-container">
        <div className="proctor-state-message">
          <h2 className="proctor-state-title">Memuat data pengawasan...</h2>
          <p>Harap tunggu sebentar.</p>
        </div>
      </div>
    );
  }

  if (error) {
    let title = 'Terjadi Kesalahan';
    let message = 'Gagal memuat data pengawasan. Silakan coba lagi.';

    if (error === 'forbidden') {
      title = 'Akses Ditolak';
      message = 'Anda tidak memiliki hak akses untuk memonitoring ruangan. Pastikan Anda telah ditugaskan sebagai pengawas ujian.';
    }

    return (
      <div className="proctor-monitoring-container">
        <div className="proctor-state-message">
          <h2 className="proctor-state-title">{title}</h2>
          <p>{message}</p>
          <button className="proctor-refresh-btn" onClick={handleRefresh} disabled={isRefreshing} style={{ marginTop: '16px' }}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const assignments = data?.assignments || [];

  if (assignments.length === 0) {
    return (
      <div className="proctor-monitoring-container">
        <div className="proctor-state-message">
          <h2 className="proctor-state-title">Tidak Ada Ujian</h2>
          <p>Anda belum ditugaskan untuk mengawasi ujian apapun saat ini.</p>
          <button className="proctor-refresh-btn" onClick={handleRefresh} disabled={isRefreshing} style={{ marginTop: '16px' }}>
            Perbarui Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="proctor-monitoring-container">
      <div className="proctor-monitoring-header">
        <h1 className="proctor-monitoring-title">Monitoring Ujian</h1>
        <button
          className="proctor-refresh-btn"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Memperbarui...' : 'Perbarui Data'}
        </button>
      </div>

      {assignments.map((exam: ProctorMonitoringExamProjection) => (
        <div key={exam.examInstanceId} className="proctor-exam-group">
          <h2 className="proctor-exam-title">{exam.subjectLabel || 'Mata Pelajaran Tidak Diketahui'}</h2>

          {exam.rooms.length === 0 ? (
            <div className="proctor-state-message" style={{ padding: '24px', marginTop: '0' }}>
              <p>Tidak ada ruangan yang ditugaskan untuk ujian ini.</p>
            </div>
          ) : (
            <div className="proctor-rooms-grid">
              {exam.rooms.map((room: ProctorMonitoringRoomProjection) => (
                <div key={room.roomId} className="proctor-room-card">
                  <h3 className="proctor-room-header">{room.roomLabel || 'Ruangan Tanpa Nama'}</h3>
                  <div className="proctor-room-stats">
                    <div className="proctor-stat-row">
                      <span className="proctor-stat-label">Total Peserta Ujian</span>
                      <span className="proctor-stat-value">{room.participantCount}</span>
                    </div>
                    <div className="proctor-stat-row">
                      <span className="proctor-stat-label">Sesi Aktif</span>
                      <span className={`proctor-stat-value ${room.activeSessionCount > 0 ? 'proctor-stat-active' : ''}`}>
                        {room.activeSessionCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
