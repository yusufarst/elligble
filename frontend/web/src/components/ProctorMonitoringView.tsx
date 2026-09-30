import { Button } from '@/components/ui/button';
import React, { useState, useEffect, useCallback } from 'react';
import { getProctorMonitoring, ApiError } from '../api/assessment-client.ts';
import type { ProctorMonitoringResponse, ProctorMonitoringExamProjection, ProctorMonitoringRoomProjection } from '../types/assessment.ts';
import { formatDateTime, formatWindow } from '../lib/format.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, LoadErrorState, LoadingState, StaleDataNotice } from '@/components/ui/page-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Metric, MetricList } from '@/components/ui/metric';
import { ActionGroup } from '@/components/ui/action-group';
import { CANCELLED_EXAM_STATUS } from '../lib/status.ts';
import { SCREEN_TITLE } from '../lib/screen-titles.ts';
import { ExamFacts, ExamList, ExamListCard } from './ExamListCard.tsx';
import '../styles/proctor-monitoring.css';

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
      <h1 className="proctor-monitoring-title">{SCREEN_TITLE.proctorExams}</h1>
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

      <ExamList>
        {assignments.map((exam: ProctorMonitoringExamProjection) => (
          <li key={exam.examInstanceId}>
            <ExamListCard
              title={exam.subjectLabel || 'Mata Pelajaran Tidak Diketahui'}
              status={exam.cancelledAt ? <StatusBadge tone={CANCELLED_EXAM_STATUS.tone}>{CANCELLED_EXAM_STATUS.label}</StatusBadge> : undefined}
            >
              {exam.windowStartsAt && exam.windowEndsAt && (
                <ExamFacts>
                  <p>{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>
                </ExamFacts>
              )}
              {exam.cancelledAt ? (
                <Alert role="note">
                  <AlertDescription>Ujian ini dibatalkan oleh guru pada {formatDateTime(exam.cancelledAt)} dan tidak akan dibuka.</AlertDescription>
                </Alert>
              ) : exam.scheduleChange && (
                <Alert variant="info" role="note">
                  <AlertDescription>
                    Jadwal diubah pada {formatDateTime(exam.scheduleChange.changedAt)}.
                    {exam.scheduleChange.previousWindowStartsAt && exam.scheduleChange.previousWindowEndsAt
                      ? ` Jadwal sebelumnya: ${formatWindow(exam.scheduleChange.previousWindowStartsAt, exam.scheduleChange.previousWindowEndsAt)}.`
                      : ''}
                  </AlertDescription>
                </Alert>
              )}
              {onOpenExam && !exam.cancelledAt && (
                <ActionGroup>
                  <Button variant="secondary" onClick={() => onOpenExam(exam.examInstanceId)}>Lihat Peserta</Button>
                </ActionGroup>
              )}

              {exam.rooms.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {exam.rooms.map((room: ProctorMonitoringRoomProjection) => (
                    <section key={room.roomId} className="flex flex-col gap-2">
                      <h3 className="m-0 text-base font-semibold">{room.roomLabel || 'Ruangan Tanpa Nama'}</h3>
                      <MetricList className="sm:grid-cols-2">
                        <Metric label="Total Peserta Ujian" value={room.participantCount} />
                        <Metric label="Sesi Aktif" value={room.activeSessionCount} />
                      </MetricList>
                    </section>
                  ))}
                </div>
              )}
            </ExamListCard>
          </li>
        ))}
      </ExamList>
    </main>
  );
};
