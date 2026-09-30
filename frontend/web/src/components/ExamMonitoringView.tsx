import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getExamMonitoring, postParticipantLock } from '../api/assessment-client.ts';
import type { ExamMonitoringResponse, MonitoredParticipant, MonitoringStatus, ParticipantLockAction, ParticipantLockResponse } from '../types/assessment.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IconChevronLeft, IconInfo } from '@/components/icons';
import { cn } from '@/lib/utils';
import { formatClockTime, formatTime } from '../lib/format.ts';

// Exam-day participant list (D04.6-01/02/03/04/10/17/18/60/61): who is expected, who has
// started, who has submitted and whose exam session moved to another device. It shows only
// what the server knows and when it last knew it; answers still on a student's device and
// connectivity are not claimed. Refreshes by itself; a failed refresh keeps the last data
// and says how old it is, while the exam itself continues unaffected. The supervisor can
// lock one participant's work and unlock it again (D04.6-38/39): the lock keeps every
// answer and does not stop that participant's time (D04.6-40).

const DEFAULT_REFRESH_MS = 20000;

type Filter = 'ALL' | 'NOT_STARTED' | 'ACTIVE' | 'SUBMITTED';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'ALL', label: 'Semua' },
  { value: 'NOT_STARTED', label: 'Belum mulai' },
  { value: 'ACTIVE', label: 'Mengerjakan' },
  { value: 'SUBMITTED', label: 'Dikumpulkan' },
];

function matches(filter: Filter, status: MonitoringStatus): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return status === 'ACTIVE' || status === 'TIME_UP';
  return status === filter;
}

function statusBadge(p: MonitoredParticipant): { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' } {
  switch (p.status) {
    case 'SUBMITTED':
      return p.finalizationSource === 'EXPIRY_CLIENT' || p.finalizationSource === 'EXPIRY_SERVER'
        ? { label: 'Dikumpulkan otomatis', tone: 'neutral' }
        : { label: 'Dikumpulkan', tone: 'success' };
    case 'ACTIVE':
      return { label: 'Mengerjakan', tone: 'info' };
    case 'TIME_UP':
      return { label: 'Waktu habis', tone: 'warning' };
    case 'NOT_STARTED':
      return { label: 'Belum mulai', tone: 'neutral' };
  }
}

const TONE_CLASS: Record<'success' | 'info' | 'warning' | 'neutral', string> = {
  success: 'bg-success-surface text-success-ink',
  info: 'bg-info-surface text-info-ink',
  warning: 'bg-warning-surface text-warning-ink',
  neutral: 'bg-[var(--color-neutral-badge-bg)] text-[var(--color-neutral-badge-text)]',
};

// Exam states in which a supervisor may lock or unlock a participant (as on the server).
const SUPERVISED_STATES = new Set(['ACTIVE', 'PAUSED', 'ENDED']);

/** The lock action offered for a participant: only someone still working can be locked. */
function lockActionFor(p: MonitoredParticipant, examState: string): ParticipantLockAction | null {
  if (!SUPERVISED_STATES.has(examState) || p.status === 'SUBMITTED') return null;
  if (p.lockedAt) return 'unlock';
  return p.status === 'ACTIVE' ? 'lock' : null;
}

const LOCK_COPY: Record<ParticipantLockAction, { title: string; description: string; confirm: string }> = {
  lock: {
    title: 'Kunci Pengerjaan Peserta?',
    description: 'Peserta tidak dapat melihat soal, mengubah jawaban, atau mengumpulkan sampai kunci dibuka. Jawaban yang dipilih sebelum dikunci tetap tersimpan. Waktu ujian peserta tetap berjalan; jika waktunya habis saat dikunci, jawabannya dikumpulkan otomatis.',
    confirm: 'Kunci Pengerjaan',
  },
  unlock: {
    title: 'Buka Kunci Pengerjaan?',
    description: 'Peserta dapat kembali melihat soal dan mengerjakan dengan sisa waktunya saat ini. Waktu yang berjalan selama dikunci tidak dikembalikan.',
    confirm: 'Buka Kunci',
  },
};

function lockOutcomeMessage(id: string, result: ParticipantLockResponse): string {
  if (result.locked) {
    const since = result.lockedAt ? ` sejak ${formatTime(result.lockedAt)}` : '';
    return result.changed ? `Pengerjaan ${id} dikunci${since}.` : `Pengerjaan ${id} sudah dikunci${since}.`;
  }
  return result.changed ? `Kunci pengerjaan ${id} dibuka.` : `Pengerjaan ${id} tidak sedang dikunci.`;
}

function lockFailureMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'no_active_attempt': return 'Peserta ini sudah tidak memiliki pengerjaan yang berjalan. Data ditampilkan ulang.';
      case 'invalid_state': return 'Status ujian telah berubah. Data ditampilkan ulang.';
      case 'forbidden': return 'Anda tidak berwenang mengunci atau membuka kunci peserta ini.';
    }
  }
  return 'Gagal memproses permintaan. Periksa koneksi internet Anda dan coba lagi.';
}

function remainingLabel(p: MonitoredParticipant): string | null {
  if (p.status === 'TIME_UP') return 'Waktu habis';
  if (p.status !== 'ACTIVE' || p.remainingSeconds === null) return null;
  return p.remainingSeconds < 60 ? 'Kurang dari 1 menit' : `${Math.floor(p.remainingSeconds / 60)} menit`;
}

export const ExamMonitoringView: React.FC<{
  examInstanceId: string;
  onBack(): void;
  backLabel: string;
  refreshIntervalMs?: number;
}> = ({ examInstanceId, onBack, backLabel, refreshIntervalMs = DEFAULT_REFRESH_MS }) => {
  const [data, setData] = useState<ExamMonitoringResponse | null>(null);
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [confirmLock, setConfirmLock] = useState<{ participant: MonitoredParticipant; action: ParticipantLockAction } | null>(null);
  const [lockPending, setLockPending] = useState(false);
  const [lockNotice, setLockNotice] = useState<{ failed: boolean; text: string } | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setData(await getExamMonitoring(examInstanceId));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    } finally {
      loadingRef.current = false;
    }
  }, [examInstanceId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), refreshIntervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, refreshIntervalMs]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const runLockAction = async (participant: MonitoredParticipant, action: ParticipantLockAction) => {
    const id = participant.elligbleId ?? 'peserta';
    setLockPending(true);
    try {
      const result = await postParticipantLock(examInstanceId, participant.participantId, action);
      setLockNotice({ failed: false, text: lockOutcomeMessage(id, result) });
    } catch (err) {
      setLockNotice({ failed: true, text: lockFailureMessage(err) });
    } finally {
      setLockPending(false);
      setConfirmLock(null);
      await load();
    }
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.participants ?? []).filter(p => matches(filter, p.status) && (!needle || (p.elligbleId ?? '').includes(needle)));
  }, [data, filter, query]);

  const back = (
    <Button variant="ghost" size="sm" className="-ml-3 self-start" onClick={onBack}>
      <IconChevronLeft aria-hidden="true" />
      {backLabel}
    </Button>
  );

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6 md:px-6">
        {back}
        {error === null ? (
          <p role="status" className="m-0 text-muted-foreground">Memuat daftar peserta...</p>
        ) : (
          <Alert variant={error === 'forbidden' ? 'default' : 'destructive'}>
            <IconInfo aria-hidden="true" />
            <AlertTitle>{error === 'forbidden' ? 'Akses Ditolak' : 'Gagal Memuat Daftar Peserta'}</AlertTitle>
            <AlertDescription>
              {error === 'forbidden'
                ? 'Daftar peserta hanya dapat dilihat oleh pengawas yang ditugaskan atau guru yang mengelola ujian ini.'
                : 'Periksa koneksi internet Anda, lalu coba lagi. Ujian peserta tetap berjalan.'}
            </AlertDescription>
            {error === 'failed' && (
              <Button variant="secondary" size="sm" className="col-start-2 mt-2 justify-self-start" onClick={refresh} disabled={refreshing}>
                Coba Lagi
              </Button>
            )}
          </Alert>
        )}
      </main>
    );
  }

  const { exam, summary, questionCount } = data;

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-6 md:px-6">
      {back}
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold">Pemantauan Peserta</h1>
        <p className="m-0 text-lg font-medium">{exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}</p>
        <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
          Diperbarui {formatClockTime(data.serverTime)}. Diperbarui otomatis.
        </p>
      </header>

      {exam.lifecycleState === 'PAUSED' && (
        <Alert variant="warning">
          <IconInfo aria-hidden="true" />
          <AlertTitle>{exam.pausedAt ? `Ujian dijeda sejak ${formatTime(exam.pausedAt)}` : 'Ujian dijeda'}</AlertTitle>
          <AlertDescription>Sisa waktu peserta berhenti dan jawaban tidak dapat diubah sampai guru melanjutkan ujian.</AlertDescription>
        </Alert>
      )}
      {exam.lifecycleState === 'ENDED' && (
        <Alert>
          <IconInfo aria-hidden="true" />
          <AlertTitle>Ujian telah diakhiri</AlertTitle>
          <AlertDescription>Peserta yang belum mulai tidak dapat memulai. Peserta yang sedang mengerjakan dapat menyelesaikan sampai waktunya habis.</AlertDescription>
        </Alert>
      )}

      {error === 'failed' && (
        <Alert variant="warning">
          <IconInfo aria-hidden="true" />
          <AlertTitle>Pemantauan tertunda</AlertTitle>
          <AlertDescription>
            Data di bawah adalah data terakhir pukul {formatClockTime(data.serverTime)}. Ujian peserta tetap berjalan; pemantauan akan dicoba lagi otomatis.
          </AlertDescription>
        </Alert>
      )}

      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Ringkasan peserta">
        {[
          ['Peserta', summary.participants],
          ['Belum mulai', summary.notStarted],
          ['Mengerjakan', summary.active],
          ['Dikumpulkan', summary.submitted],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="m-0 text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Saring status peserta">
          {FILTERS.map(f => (
            <Button key={f.value} variant={filter === f.value ? 'default' : 'secondary'} size="sm" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Cari ELLIGBLE ID
            <Input value={query} onChange={e => setQuery(e.target.value)} className="h-9 w-full sm:w-56" autoComplete="off" spellCheck={false} />
          </label>
          <Button variant="secondary" size="sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Memperbarui...' : 'Perbarui'}
          </Button>
        </div>
      </div>

      {lockNotice && (lockNotice.failed ? (
        <Alert variant="destructive">
          <IconInfo aria-hidden="true" />
          <AlertDescription>{lockNotice.text}</AlertDescription>
        </Alert>
      ) : (
        <p role="status" className="m-0 text-sm font-medium">{lockNotice.text}</p>
      ))}

      {visible.length === 0 ? (
        <p className="m-0 text-muted-foreground">
          {data.participants.length === 0 ? 'Tidak ada peserta dalam cakupan pengawasan Anda.' : 'Tidak ada peserta yang cocok.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Peserta ujian, diurutkan menurut ELLIGBLE ID</caption>
            <thead className="bg-[var(--color-neutral-50)] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Peserta</th>
                <th scope="col" className="w-24 px-3 py-2 text-right sm:w-32">Jawaban</th>
                <th scope="col" className="w-24 px-3 py-2 text-right sm:w-32">Sisa waktu</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p, index) => {
                const badge = statusBadge(p);
                const remaining = remainingLabel(p);
                const lockAction = lockActionFor(p, exam.lifecycleState);
                const shownId = p.elligbleId ?? 'Tanpa ELLIGBLE ID';
                return (
                  <tr key={p.elligbleId ?? `tanpa-id-${index}`} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-3 text-left font-normal">
                      <span className="block font-mono text-[13px] [overflow-wrap:anywhere]">{shownId}</span>
                      {p.roomLabel && <span className="block text-xs text-muted-foreground">{p.roomLabel}</span>}
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className={cn('inline-block rounded-md px-2 py-0.5 text-xs font-medium', TONE_CLASS[badge.tone])}>{badge.label}</span>
                        {p.lockedAt && <span className={cn('inline-block rounded-md px-2 py-0.5 text-xs font-medium', TONE_CLASS.warning)}>Dikunci</span>}
                      </span>
                      {p.lockedAt && <span className="mt-1 block text-xs text-muted-foreground">Dikunci sejak {formatTime(p.lockedAt)}</span>}
                      {p.submittedAt && <span className="mt-1 block text-xs text-muted-foreground">{formatTime(p.submittedAt)}</span>}
                      {p.sessionMoves > 0 && (
                        <span className="mt-1 block text-xs text-warning-ink">Pindah perangkat {p.sessionMoves} kali</span>
                      )}
                      {lockAction && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-2"
                          aria-label={`${lockAction === 'lock' ? 'Kunci' : 'Buka Kunci'} pengerjaan ${shownId}`}
                          onClick={() => setConfirmLock({ participant: p, action: lockAction })}
                          disabled={lockPending}
                        >
                          {lockAction === 'lock' ? 'Kunci' : 'Buka Kunci'}
                        </Button>
                      )}
                    </th>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {p.status === 'NOT_STARTED' ? (
                        <span className="text-muted-foreground">Belum ada</span>
                      ) : (
                        <>
                          <span className="block">{p.answeredCount}/{questionCount}</span>
                          {p.lastAcceptedAt && <span className="block text-xs text-muted-foreground">diterima {formatTime(p.lastAcceptedAt)}</span>}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {remaining ?? <span className="text-muted-foreground">Tidak berlaku</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="m-0 text-sm leading-relaxed text-muted-foreground">
        Status berasal dari server: jawaban yang sudah diterima, waktu ujian server, dan sesi ujian. Jawaban yang masih tersimpan di perangkat siswa karena koneksi terputus belum terlihat di sini. "Pindah perangkat" berarti sesi ujian dilanjutkan di perangkat atau tab lain; ini bukan tuduhan kecurangan. "Kunci" menghentikan pengerjaan satu peserta tanpa menghentikan waktunya; jawaban yang sudah dipilih tetap tersimpan.
      </p>

      <Dialog open={confirmLock !== null} onOpenChange={open => { if (!open && !lockPending) setConfirmLock(null); }}>
        {confirmLock && (
          <DialogContent aria-describedby="participant-lock-description">
            <DialogHeader>
              <DialogTitle>{LOCK_COPY[confirmLock.action].title}</DialogTitle>
              <DialogDescription id="participant-lock-description">{LOCK_COPY[confirmLock.action].description}</DialogDescription>
            </DialogHeader>
            <p className="m-0 font-mono text-sm font-medium [overflow-wrap:anywhere]">{confirmLock.participant.elligbleId ?? 'Tanpa ELLIGBLE ID'}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirmLock(null)} disabled={lockPending}>Batal</Button>
              <Button onClick={() => runLockAction(confirmLock.participant, confirmLock.action)} disabled={lockPending}>
                {lockPending ? 'Memproses...' : LOCK_COPY[confirmLock.action].confirm}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
};
