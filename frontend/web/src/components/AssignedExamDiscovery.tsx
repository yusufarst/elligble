import React, { useState, useEffect } from 'react';
import { getAssignedExams, postStartAttempt, ApiError } from '../api/assessment-client.ts';
import type { AssignedExamItem } from '../types/assessment.ts';
import { formatDateTime, formatDurationMinutes, formatWindow } from '../lib/format.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, LoadErrorState, LoadingState } from '@/components/ui/page-state';
import { Button } from '@/components/ui/button';
import { ActionGroup } from '@/components/ui/action-group';
import { ExamFact, ExamFacts, ExamList, ExamListCard } from './ExamListCard.tsx';
import { SUBMITTED_ATTEMPT_STATUS } from '../lib/status.ts';
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

  const header = (
    <header className="discovery-header">
      <h1 className="discovery-title">Daftar Ujian Siswa</h1>
      <p className="discovery-subtitle">Pilih sesi pengerjaan ujian untuk memulai.</p>
    </header>
  );

  if (phase !== 'ready') {
    return (
      <main className="discovery-container">
        {header}
        {phase === 'loading' ? (
          <LoadingState>Memuat daftar ujian...</LoadingState>
        ) : phase === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">
            Sesi Anda tidak memiliki izin untuk mengakses daftar ujian.
          </LoadErrorState>
        ) : phase === 'error' ? (
          <LoadErrorState kind="failed" title="Gagal Memuat Daftar Ujian" onRetry={fetchAssignedExams}>
            Periksa koneksi internet Anda, lalu coba lagi. Hubungi pengawas jika kendala berlanjut.
          </LoadErrorState>
        ) : (
          <EmptyState title="Belum Ada Ujian yang Ditugaskan">Belum ada ujian yang ditugaskan kepada Anda saat ini.</EmptyState>
        )}
      </main>
    );
  }

  return (
    <main className="discovery-container">
      {header}

      <ExamList>
        {assignments.map((item) => {
          const subjectDisplay = item.subjectLabel || 'Penilaian Akademik';
          const hasAttempts = item.attempts && item.attempts.length > 0;

          return (
            <li key={item.examInstanceId}>
              <ExamListCard
                className="discovery-card"
                data-testid={`assignment-${item.examInstanceId}`}
                title={subjectDisplay}
                status={item.roomLabel && <StatusBadge tone="neutral">Ruang: {item.roomLabel}</StatusBadge>}
              >
                {item.schedule && (item.schedule.windowStartsAt || item.schedule.attemptDurationSeconds) && (
                  <ExamFacts>
                    {item.schedule.windowStartsAt && item.schedule.windowEndsAt && (
                      <ExamFact label="Waktu pelaksanaan">{formatWindow(item.schedule.windowStartsAt, item.schedule.windowEndsAt)}</ExamFact>
                    )}
                    {item.schedule.attemptDurationSeconds && (
                      <ExamFact label="Durasi">{formatDurationMinutes(item.schedule.attemptDurationSeconds)}</ExamFact>
                    )}
                  </ExamFacts>
                )}
                {item.schedule?.change && !hasAttempts && (
                  <Alert variant="info" role="note">
                    <AlertDescription>
                      Jadwal diubah oleh guru pada {formatDateTime(item.schedule.change.changedAt)}.
                      {item.schedule.change.previousWindowStartsAt && item.schedule.change.previousWindowEndsAt
                        ? ` Jadwal sebelumnya: ${formatWindow(item.schedule.change.previousWindowStartsAt, item.schedule.change.previousWindowEndsAt)}.`
                        : ''}
                    </AlertDescription>
                  </Alert>
                )}

                {!hasAttempts ? (
                  (() => {
                    const state = entryState(item, serverNow);
                    const error = startErrors[item.examInstanceId];
                    if (state.kind === 'startable') {
                      return (
                        <>
                          <ActionGroup>
                            <Button
                              data-testid={`start-button-${item.examInstanceId}`}
                              disabled={startingExamId !== null}
                              onClick={() => handleStart(item.examInstanceId)}
                            >
                              {startingExamId === item.examInstanceId ? 'Menyiapkan...' : 'Mulai Ujian'}
                            </Button>
                          </ActionGroup>
                          {error && (
                            <Alert variant="destructive">
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          )}
                        </>
                      );
                    }
                    const text =
                      state.kind === 'not_open' ? `Ujian dibuka ${state.opensAt ? formatDateTime(state.opensAt) : 'sesuai waktu pelaksanaan'}.` :
                      state.kind === 'waiting_activation' ? (state.opensAt ? `Ujian dibuka ${formatDateTime(state.opensAt)} setelah guru atau pengawas membukanya.` : 'Menunggu guru atau pengawas membuka ujian.') :
                      state.kind === 'paused' ? 'Ujian sedang dijeda oleh guru atau pengawas.' :
                      state.kind === 'closed' ? 'Waktu pelaksanaan ujian telah berakhir.' :
                      'Belum ada sesi pengerjaan yang tersedia.';
                    return <p className="m-0 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{text}</p>;
                  })()
                ) : (
                  <div className="flex flex-col gap-3">
                    {item.attempts.map((attempt) => {
                      const isSubmitted = Boolean(attempt.submittedAt);

                      return (
                        <div
                          key={attempt.attemptId}
                          className="flex flex-col gap-3 rounded-md border border-border bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          data-testid={`attempt-row-${attempt.attemptId}`}
                        >
                          <div className="flex items-center gap-2">
                            {isSubmitted && (
                              <StatusBadge tone={SUBMITTED_ATTEMPT_STATUS.tone}>{SUBMITTED_ATTEMPT_STATUS.label}</StatusBadge>
                            )}
                          </div>

                          {!isSubmitted && (
                            <Button data-testid={`launch-button-${attempt.attemptId}`} onClick={() => handleLaunch(attempt.attemptId)}>
                              Mulai Pengerjaan
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ExamListCard>
            </li>
          );
        })}
      </ExamList>
    </main>
  );
};

export default AssignedExamDiscovery;
