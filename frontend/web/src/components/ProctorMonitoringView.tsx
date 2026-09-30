import { Button } from '@/components/ui/button';
import React, { useState, useEffect, useCallback } from 'react';
import { getProctorMonitoring, ApiError } from '../api/assessment-client.ts';
import type { ProctorMonitoringResponse, ProctorMonitoringExamProjection, ProctorMonitoringRoomProjection } from '../types/assessment.ts';
import { formatDateTime, formatWindow } from '../lib/format.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, LoadErrorState, LoadingState, StaleDataNotice } from '@/components/ui/page-state';
import '../styles/proctor-monitoring.css';
import '../styles/design-tokens.css';

export const ProctorMonitoringView: React.FC<{ onOpenExam?(examInstanceId: string): void }> = ({ onOpenExam }) => {
  const [data, setData] = useState<ProctorMonitoringResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // A failed refresh keeps the last data on screen with a notice; a refusal replaces it.
  const fetchMonitoringData = useCallback(async () => {
    try {
      const response = await getProctorMonitoring();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
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

  const header = (
    <div className="proctor-monitoring-header">
      <h1 className="proctor-monitoring-title">Monitoring Ujian</h1>
      {data && error !== 'forbidden' && (
        <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? 'Memperbarui...' : 'Perbarui Data'}
        </Button>
      )}
    </div>
  );

  if (loading || error === 'forbidden' || !data) {
    return (
      <main className="proctor-monitoring-container">
        {header}
        {loading ? (
          <LoadingState>Memuat daftar ujian...</LoadingState>
        ) : error === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">
            Anda tidak memiliki hak akses untuk memonitoring ruangan. Pastikan Anda telah ditugaskan sebagai pengawas ujian.
          </LoadErrorState>
        ) : (
          <LoadErrorState kind="failed" title="Gagal Memuat Daftar Ujian" onRetry={handleRefresh} retrying={isRefreshing}>
            Periksa koneksi internet Anda, lalu coba lagi.
          </LoadErrorState>
        )}
      </main>
    );
  }

  const assignments = data.assignments || [];
  const staleNotice = error === 'failed' ? <div className="mb-4"><StaleDataNotice /></div> : null;

  if (assignments.length === 0) {
    return (
      <main className="proctor-monitoring-container">
        {header}
        {staleNotice}
        <EmptyState title="Belum Ada Ujian yang Diawasi">Anda belum ditugaskan untuk mengawasi ujian apa pun saat ini.</EmptyState>
      </main>
    );
  }

  return (
    <main className="proctor-monitoring-container">
      {header}
      {staleNotice}

      {assignments.map((exam: ProctorMonitoringExamProjection) => (
        <div key={exam.examInstanceId} className="proctor-exam-group">
          <h2 className="proctor-exam-title">{exam.subjectLabel || 'Mata Pelajaran Tidak Diketahui'}</h2>
          {exam.windowStartsAt && exam.windowEndsAt && (
            <p className="proctor-exam-window">{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>
          )}
          {exam.cancelledAt ? (
            <Alert role="note" className="mb-3">
              <AlertDescription>Ujian ini dibatalkan oleh guru pada {formatDateTime(exam.cancelledAt)} dan tidak akan dibuka.</AlertDescription>
            </Alert>
          ) : exam.scheduleChange && (
            <Alert variant="info" role="note" className="mb-3">
              <AlertDescription>
                Jadwal diubah pada {formatDateTime(exam.scheduleChange.changedAt)}.
                {exam.scheduleChange.previousWindowStartsAt && exam.scheduleChange.previousWindowEndsAt
                  ? ` Jadwal sebelumnya: ${formatWindow(exam.scheduleChange.previousWindowStartsAt, exam.scheduleChange.previousWindowEndsAt)}.`
                  : ''}
              </AlertDescription>
            </Alert>
          )}
          {onOpenExam && !exam.cancelledAt && (
            <Button variant="secondary" className="mb-3" onClick={() => onOpenExam(exam.examInstanceId)}>Lihat Peserta</Button>
          )}

          {exam.rooms.length === 0 ? null : (
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
    </main>
  );
};
