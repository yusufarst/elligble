import React, { useState, useEffect, useRef } from 'react';
import { getAssignedExams, getMyResults, postStartAttempt, ApiError } from '../api/assessment-client.ts';
import type { AssignedExamItem, MyResultEntry } from '../types/assessment.ts';
import { formatDateTime, formatDurationMinutes, formatWindow } from '../lib/format.ts';
import { formatScore } from '../lib/question-import.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, LoadErrorState, LoadingState } from '@/components/ui/page-state';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { ActionGroup } from '@/components/ui/action-group';
import { IconInfo } from '@/components/icons';
import { ExamFact, ExamFacts, ExamList, ExamListCard } from './ExamListCard.tsx';
import { HiddenScore, ScoreRevealToggle } from './ScoreReveal.tsx';
import { SUBMITTED_ATTEMPT_STATUS } from '../lib/status.ts';
import { START_REFUSAL_COPY } from '../lib/start-refusal-copy.ts';

// RESULT-003 (E7, E7a, RP-1 "Nilai akhir saja"): the Student's own published result shows as one line on the card of a
// FINALIZED exam, only once "my-results" has settled: a published value masked by default with its own reveal control
// (FRONTEND_DESIGN_SYSTEM §58), the absent copy, or "Hasil belum tersedia.". A failed load shows no result line and no
// value anywhere, only one notice with "Coba Lagi" (U05, C22). The value and the reveal state live in component state
// only: never stored, never in the URL, masked again on every load (E10).
type ResultsLoad =
  | { status: 'idle' | 'loading' }
  | { status: 'failed' | 'retrying' }
  | { status: 'ready'; byExam: ReadonlyMap<string, MyResultEntry> };

const hasFinalized = (items: AssignedExamItem[]) => items.some(item => item.schedule?.lifecycleState === 'FINALIZED');

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
  const [results, setResults] = useState<ResultsLoad>({ status: 'idle' });
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const resultsRequest = useRef(0);
  const retryResultsButton = useRef<HTMLButtonElement>(null);
  const focusAfterRetry = useRef(false);

  // E7: "my-results" only when at least one exam is FINALIZED; until it settles no card shows a result line.
  const loadResults = async (retry = false) => {
    const request = ++resultsRequest.current;
    setResults({ status: retry ? 'retrying' : 'loading' });
    try {
      const response = await getMyResults();
      if (request !== resultsRequest.current) return;
      focusAfterRetry.current = retry;
      setResults({ status: 'ready', byExam: new Map(response.results.map(entry => [entry.examInstanceId, entry])) });
    } catch {
      if (request !== resultsRequest.current) return;
      setResults({ status: 'failed' });
    }
  };

  // The retry control stays enabled (a disabled control would drop focus to BODY): a failed retry keeps focus on it;
  // after a successful one the notice is gone, so the page title takes focus when nothing else holds it.
  useEffect(() => {
    if (results.status !== 'ready' || !focusAfterRetry.current) return;
    focusAfterRetry.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    const title = document.querySelector<HTMLHeadingElement>('h1[data-slot="page-title"]');
    if (!title) return;
    title.tabIndex = -1;
    title.classList.add('outline-none');
    title.focus();
  }, [results]);

  const fetchAssignedExams = async () => {
    setPhase('loading');
    resultsRequest.current++;
    setResults({ status: 'idle' });
    setRevealed(new Set());
    try {
      const response = await getAssignedExams();
      setServerNow(response.serverNow);
      if (!response.assignments || response.assignments.length === 0) {
        setAssignments([]);
        setPhase('empty');
      } else {
        setAssignments(response.assignments);
        setPhase('ready');
        if (hasFinalized(response.assignments)) void loadResults();
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
    <PageHeader title="Daftar Ujian Siswa">
      <p className="m-0 text-sm text-muted-foreground">Pilih sesi pengerjaan ujian untuk memulai.</p>
    </PageHeader>
  );

  if (phase !== 'ready') {
    return (
      <Page width="focused">
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
      </Page>
    );
  }

  // RP-1: the own published result of one FINALIZED exam (E7, E7a); called only once "my-results" has settled.
  const resultLine = (examInstanceId: string, entry: MyResultEntry | undefined) => {
    if (!entry) {
      // O05-6: unpublished or withdrawn.
      return <ExamFacts data-testid={`result-${examInstanceId}`}><p>Hasil belum tersedia.</p></ExamFacts>;
    }
    if (entry.standing === 'ABSENT' || entry.scaledScore === null) {
      // D04.4-12: absent is not zero, so there is no value and no reveal control.
      return <ExamFacts data-testid={`result-${examInstanceId}`}><p>Anda tercatat tidak mengerjakan ujian ini, sehingga tidak ada nilai.</p></ExamFacts>;
    }
    const shown = revealed.has(examInstanceId);
    const toggle = () => setRevealed(previous => {
      const next = new Set(previous);
      if (next.has(examInstanceId)) next.delete(examInstanceId); else next.add(examInstanceId);
      return next;
    });
    return (
      <div className="flex min-w-0 flex-col gap-3" data-testid={`result-${examInstanceId}`}>
        <ExamFacts>
          <ExamFact label="Nilai">
            {/* E7a: before the reveal the value element is not rendered at all; only the mask is. */}
            {shown ? <span data-testid={`result-value-${examInstanceId}`} className="font-semibold tabular-nums">{formatScore(entry.scaledScore)}</span> : <HiddenScore />}
          </ExamFact>
        </ExamFacts>
        <ActionGroup>
          <ScoreRevealToggle pressed={shown} onToggle={toggle} />
        </ActionGroup>
        <ExamFacts>
          <p>Dipublikasikan {formatDateTime(entry.publishedAt)}.</p>
        </ExamFacts>
      </div>
    );
  };

  return (
    <Page width="focused">
      {header}

      {(results.status === 'failed' || results.status === 'retrying') && (
        // U05, C22: a failed load is neither "Hasil belum tersedia" nor a zero; no card shows a result line.
        <Alert variant="warning">
          <IconInfo aria-hidden="true" />
          <AlertDescription className="min-w-0 break-words">
            <p className="m-0">Hasil ujian belum dapat dimuat. Periksa koneksi internet Anda, lalu coba lagi.</p>
            <Button ref={retryResultsButton} variant="secondary" className="mt-2 h-auto min-h-11 max-w-full whitespace-normal py-2"
              aria-busy={results.status === 'retrying'} onClick={() => { if (results.status !== 'retrying') void loadResults(true); }}>
              {results.status === 'retrying' ? 'Memuat...' : 'Coba Lagi'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
                      state.kind === 'waiting_activation' ? (state.opensAt ? `Ujian dibuka ${formatDateTime(state.opensAt)} setelah petugas ujian membukanya.` : 'Menunggu petugas ujian membuka ujian.') :
                      state.kind === 'paused' ? 'Ujian sedang dijeda oleh petugas ujian.' :
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
                {item.schedule?.lifecycleState === 'FINALIZED' && results.status === 'ready' && resultLine(item.examInstanceId, results.byExam.get(item.examInstanceId))}
              </ExamListCard>
            </li>
          );
        })}
      </ExamList>
    </Page>
  );
};

export default AssignedExamDiscovery;
