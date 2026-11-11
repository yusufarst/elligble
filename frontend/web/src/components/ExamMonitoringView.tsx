import { ActionReasonField, permissionDialogClass, validActionReason } from './ActionReasonField.tsx';
import { newActionKey } from '../lib/action-key.ts';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getExamMonitoring, postBroadcast, postParticipantLock, postParticipantTime } from '../api/assessment-client.ts';
import type {
  BroadcastSendResponse, BroadcastTarget, ExamMonitoringResponse, MonitoredParticipant, MonitoringStatus, ParticipantLockAction, ParticipantLockResponse,
  PermissionIntent, TimeAdditionInput, TimeAdditionResponse,
} from '../types/assessment.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadErrorState, LoadingState, PageStateFrame, StaleDataNotice } from '@/components/ui/page-state';
import { Page, PageHeader } from '@/components/ui/page';
import { Metric, MetricList } from '@/components/ui/metric';
import { IconChevronLeft, IconInfo } from '@/components/icons';
import { LOCKED_PARTICIPANT_STATUS, participantStatus } from '../lib/status.ts';
import { formatClockTime, formatTime } from '../lib/format.ts';
import { BroadcastComposer, BroadcastHistory } from './ExamBroadcast.tsx';
import { AddTimeDialog, TIME_STATES, timeAddedLabel } from './ParticipantTime.tsx';
import { ParticipantRoomTransferDialog, canTransfer, transferNotice, type RoomTransferSource } from './ParticipantRoomTransferDialog.tsx';
import { SCREEN_TITLE } from '../lib/screen-titles.ts';

// Exam-day participant list (D04.6-01/02/03/04/10/17/18/60/61): who is expected, who has
// started, who has submitted and whose exam session moved to another device. It shows only
// what the server knows and when it last knew it; answers still on a student's device and
// connectivity are not claimed. Refreshes by itself; a failed refresh keeps the last data
// and says how old it is, while the exam itself continues unaffected. The supervisor can
// lock one participant's work and unlock it again (D04.6-38/39): the lock keeps every
// answer and does not stop that participant's time (D04.6-40). Messages to participants
// are sent and reviewed here too (D04.6-49..55). The teacher who manages the exam adds time
// for one working participant (D04.6-41); every supervisor sees that time was added.
// One supervision screen for every role (plan §10.1): the School Operator of an institution exam
// uses it through its own source (ASSESS-INSTITUTION-003 E15), over the whole exam, and gives a
// reason with every message (OC-4). Without a source it reads and acts as it always did.
// The Operator's source alone carries the room transfer (ASSESS-ROOM-001 E13): "Pindahkan Ruang" moves one participant
// of a running exam to another room with a Proctor; every other source renders as before.

const DEFAULT_REFRESH_MS = 20000;

/** Where the supervision screen reads and acts: the supervisor routes, or the School Operator's (E15). */
export interface MonitoringSource {
  load(examInstanceId: string): Promise<ExamMonitoringResponse>;
  lock(examInstanceId: string, participantId: string, action: ParticipantLockAction, intent: PermissionIntent): Promise<ParticipantLockResponse>;
  addTime(input: TimeAdditionInput): Promise<TimeAdditionResponse>;
  /** intent: the reason, confirmation and action key, when messageNeedsReason; null otherwise. */
  broadcast(examInstanceId: string, target: BroadcastTarget, message: string, intent: PermissionIntent | null): Promise<BroadcastSendResponse>;
  messageNeedsReason: boolean;
  /** The School Operator's room transfer (ASSESS-ROOM-001); absent for every other source. */
  transfer?: RoomTransferSource;
}

/** The supervisor routes, exactly as the screen has always called them. */
export const SUPERVISOR_SOURCE: MonitoringSource = {
  load: examInstanceId => getExamMonitoring(examInstanceId),
  lock: (examInstanceId, participantId, action, intent) => postParticipantLock(examInstanceId, participantId, action, intent),
  addTime: input => postParticipantTime(input),
  broadcast: (examInstanceId, target, message) => postBroadcast(examInstanceId, target, message),
  messageNeedsReason: false,
};

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
  source?: MonitoringSource;
}> = ({ examInstanceId, onBack, backLabel, refreshIntervalMs = DEFAULT_REFRESH_MS, source = SUPERVISOR_SOURCE }) => {
  const [data, setData] = useState<ExamMonitoringResponse | null>(null);
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [confirmLock, setConfirmLock] = useState<{ participant: MonitoredParticipant; action: ParticipantLockAction } | null>(null);
  useEffect(() => { setReason(''); }, [confirmLock]);
  const [lockPending, setLockPending] = useState(false);
  const [notice, setNotice] = useState<{ failed: boolean; text: string } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [addTimeFor, setAddTimeFor] = useState<MonitoredParticipant | null>(null);
  const [transferFor, setTransferFor] = useState<MonitoredParticipant | null>(null);
  const loadingRef = useRef(false);
  const transferTrigger = useRef<HTMLButtonElement | null>(null);
  const lockTrigger = useRef<HTMLButtonElement | null>(null);
  const refreshButton = useRef<HTMLButtonElement | null>(null);
  const backButton = useRef<HTMLButtonElement | null>(null);
  const timeTrigger = useRef<HTMLButtonElement | null>(null);
  const messageTrigger = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useCallback((opener: HTMLButtonElement | null): boolean => {
    const target = [opener, refreshButton.current, backButton.current].find(button => button?.isConnected && !button.disabled);
    if (!target) return false;
    target.focus();
    return document.activeElement === target;
  }, []);

  // A completed Operator action can refresh away its opener. Keep a logical keyboard
  // destination after that DOM update, without moving focus the user has already placed.
  useLayoutEffect(() => {
    const opener = pendingFocus.current;
    if (!opener || source === SUPERVISOR_SOURCE) return;
    pendingFocus.current = null;
    if (!document.activeElement || document.activeElement === document.body) restoreFocus(opener);
  }, [data, error, source, restoreFocus]);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setData(await source.load(examInstanceId));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    } finally {
      loadingRef.current = false;
    }
  }, [examInstanceId, source]);

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

  // The Operator's "Perbarui" gives focus back after its own refresh (rendered review F1); the
  // supervisor screens keep their behaviour and captures.
  const refocusRefresh = useRef(false);
  const refresh = async () => {
    refocusRefresh.current = source !== SUPERVISOR_SOURCE && document.activeElement === refreshButton.current;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  useLayoutEffect(() => {
    if (refreshing || !refocusRefresh.current) return;
    refocusRefresh.current = false;
    if (!document.activeElement || document.activeElement === document.body) refreshButton.current?.focus();
  }, [refreshing]);

  const runLockAction = async (participant: MonitoredParticipant, action: ParticipantLockAction) => {
    const id = participant.elligbleId ?? 'peserta';
    setLockPending(true);
    try {
      const result = await source.lock(examInstanceId, participant.participantId, action, { reason, confirmed: true, actionKey: newActionKey() });
      setNotice({ failed: false, text: lockOutcomeMessage(id, result) });
    } catch (err) {
      setNotice({ failed: true, text: lockFailureMessage(err) });
    } finally {
      // Resolve the current participant actions before returning keyboard focus.
      await load();
      setLockPending(false);
      setConfirmLock(null);
    }
  };

  // The School Operator's level meets the 44 px target gate (ASSESS-INSTITUTION-003 C07); the supervisor screens
  // keep their rendering unchanged, so their earlier captures stay identical.
  // 44 px targets, wrapping and the narrow-first summary for every role, Proctor and Teacher included
  // (Owner decision, ASSESS-ROOM-001 C07; closes ASSESS-INSTITUTION-003 R15). Focus restoration stays Operator-only.
  const comfortable = true;
  const operatorSource = source !== SUPERVISOR_SOURCE;
  const small = comfortable ? 'h-auto min-h-11 whitespace-normal py-2' : undefined;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.participants ?? []).filter(p => matches(filter, p.status) && (!needle || (p.elligbleId ?? '').includes(needle)));
  }, [data, filter, query]);

  const back = (
    <Button ref={backButton} variant="ghost" size="sm" className={comfortable ? '-ml-3 h-auto min-h-11 max-w-full self-start whitespace-normal py-2 text-left' : '-ml-3 self-start'} onClick={onBack}>
      <IconChevronLeft aria-hidden="true" />
      {backLabel}
    </Button>
  );

  if (!data) {
    return (
      <PageStateFrame title={SCREEN_TITLE.examMonitoring} back={back}>
        {error === null ? (
          <LoadingState>Memuat daftar peserta...</LoadingState>
        ) : error === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">
            Daftar peserta hanya dapat dilihat oleh petugas yang berwenang atas ujian ini.
          </LoadErrorState>
        ) : (
          <LoadErrorState kind="failed" title="Gagal Memuat Daftar Peserta" onRetry={refresh} retrying={refreshing}>
            Periksa koneksi internet Anda, lalu coba lagi. Ujian peserta tetap berjalan.
          </LoadErrorState>
        )}
      </PageStateFrame>
    );
  }

  const { exam, summary, questionCount } = data;
  const supervised = SUPERVISED_STATES.has(exam.lifecycleState);
  // A proctor limited to rooms addresses only their rooms (D04.1-77B), as on the server.
  const wholeExam = data.scope === 'TEACHER' || data.scope === 'OPERATOR' || !exam.roomBased;

  return (
    <Page>
      {back}
      <PageHeader
        title={SCREEN_TITLE.examMonitoring}
        actions={supervised && <Button onClick={event => { pendingFocus.current = null; messageTrigger.current = event.currentTarget; setComposerOpen(true); }}>Kirim Pesan</Button>}
      >
        <p className="m-0 text-lg font-medium">{exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}</p>
        <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
          Diperbarui {formatClockTime(data.serverTime)}. Diperbarui otomatis.
        </p>
      </PageHeader>

      {exam.lifecycleState === 'PAUSED' && (
        <Alert variant="warning">
          <IconInfo aria-hidden="true" />
          <AlertTitle>{exam.pausedAt ? `Ujian dijeda sejak ${formatTime(exam.pausedAt)}` : 'Ujian dijeda'}</AlertTitle>
          <AlertDescription>Sisa waktu peserta berhenti dan jawaban tidak dapat diubah sampai ujian dilanjutkan.</AlertDescription>
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
        <StaleDataNotice title="Pemantauan tertunda">
          Data di bawah adalah data terakhir pukul {formatClockTime(data.serverTime)}. Ujian peserta tetap berjalan; pemantauan akan dicoba lagi otomatis.
        </StaleDataNotice>
      )}

      <MetricList aria-label="Ringkasan peserta" layout={comfortable ? 'narrowFirst' : 'default'}>
        <Metric className={comfortable ? 'min-w-0' : undefined} label="Peserta" value={summary.participants} />
        <Metric className={comfortable ? 'min-w-0' : undefined} label="Belum mulai" value={summary.notStarted} />
        <Metric className={comfortable ? 'min-w-0' : undefined} label="Mengerjakan" value={summary.active} />
        <Metric className={comfortable ? 'min-w-0' : undefined} label="Dikumpulkan" value={summary.submitted} />
      </MetricList>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Saring status peserta">
          {FILTERS.map(f => (
            <Button key={f.value} variant={filter === f.value ? 'default' : 'secondary'} size="sm" className={small} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className={comfortable ? 'flex min-w-0 flex-wrap items-end gap-2' : 'flex items-end gap-2'}>
          <label className={comfortable ? 'flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium' : 'flex flex-col gap-1 text-sm font-medium'}>
            Cari ELLIGBLE ID
            <Input value={query} onChange={e => setQuery(e.target.value)} className={comfortable ? 'w-full min-w-0 sm:w-56' : 'h-9 w-full sm:w-56'} autoComplete="off" spellCheck={false} />
          </label>
          <Button ref={refreshButton} variant="secondary" size="sm" className={small} onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Memperbarui...' : 'Perbarui'}
          </Button>
        </div>
      </div>

      {notice && (notice.failed ? (
        <Alert variant="destructive">
          <IconInfo aria-hidden="true" />
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      ) : (
        <p role="status" className="m-0 text-sm font-medium">{notice.text}</p>
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
                const badge = participantStatus(p);
                const remaining = remainingLabel(p);
                const lockAction = lockActionFor(p, exam.lifecycleState);
                const canAddTime = Boolean(data.canAddTime) && TIME_STATES.has(exam.lifecycleState) && p.status === 'ACTIVE';
                const added = timeAddedLabel(p);
                const shownId = p.elligbleId ?? 'Tanpa ELLIGBLE ID';
                const movable = source.transfer !== undefined && canTransfer(p, exam, data.rooms ?? []);
                return (
                  <tr key={p.elligbleId ?? `tanpa-id-${index}`} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-3 text-left font-normal">
                      <span className="block font-mono text-[13px] [overflow-wrap:anywhere]">{shownId}</span>
                      {p.roomLabel && <span className="block text-xs text-muted-foreground">{p.roomLabel}</span>}
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                        {p.lockedAt && <StatusBadge tone={LOCKED_PARTICIPANT_STATUS.tone}>{LOCKED_PARTICIPANT_STATUS.label}</StatusBadge>}
                      </span>
                      {p.lockedAt && <span className="mt-1 block text-xs text-muted-foreground">Dikunci sejak {formatTime(p.lockedAt)}</span>}
                      {added && <span className="mt-1 block text-xs text-info-ink">{added}</span>}
                      {p.submittedAt && <span className="mt-1 block text-xs text-muted-foreground">{formatTime(p.submittedAt)}</span>}
                      {p.sessionMoves > 0 && (
                        <span className="mt-1 block text-xs text-warning-ink">Pindah perangkat {p.sessionMoves} kali</span>
                      )}
                      {(lockAction || canAddTime || movable) && (
                        <span className="mt-2 flex flex-wrap gap-2">
                          {lockAction && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className={small}
                              aria-label={`${lockAction === 'lock' ? 'Kunci' : 'Buka Kunci'} pengerjaan ${shownId}`}
                              onClick={event => { lockTrigger.current = event.currentTarget; setConfirmLock({ participant: p, action: lockAction }); }}
                              disabled={lockPending}
                            >
                              {lockAction === 'lock' ? 'Kunci' : 'Buka Kunci'}
                            </Button>
                          )}
                          {canAddTime && (
                            <Button variant="secondary" size="sm" className={small} aria-label={`Tambah waktu ${shownId}`} onClick={event => { pendingFocus.current = null; timeTrigger.current = event.currentTarget; setAddTimeFor(p); }}>
                              Tambah Waktu
                            </Button>
                          )}
                          {movable && (
                            <Button variant="secondary" size="sm" className={small} aria-label={`Pindahkan ruang ${shownId}`} onClick={event => { pendingFocus.current = null; transferTrigger.current = event.currentTarget; setTransferFor(p); }}>
                              Pindahkan Ruang
                            </Button>
                          )}
                        </span>
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

      {(data.broadcasts?.length ?? 0) > 0 && <BroadcastHistory broadcasts={data.broadcasts!} />}

      <p className="m-0 text-sm leading-relaxed text-muted-foreground">
        Status berasal dari server: jawaban yang sudah diterima, waktu ujian server, dan sesi ujian. Jawaban yang masih tersimpan di perangkat siswa karena koneksi terputus belum terlihat di sini. "Pindah perangkat" berarti sesi ujian dilanjutkan di perangkat atau tab lain; ini bukan tuduhan kecurangan. "Kunci" menghentikan pengerjaan satu peserta tanpa menghentikan waktunya; jawaban yang sudah dipilih tetap tersimpan. "Waktu ditambah" berarti petugas yang berwenang menambah waktu pengerjaan peserta itu.
      </p>

      <BroadcastComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        examInstanceId={examInstanceId}
        wholeExam={wholeExam}
        rooms={data.rooms ?? []}
        participants={data.participants}
        source={source}
        comfortable={comfortable}
        restoreFocus={operatorSource ? () => restoreFocus(messageTrigger.current) : undefined}
        onSent={result => {
          if (operatorSource) pendingFocus.current = messageTrigger.current;
          setComposerOpen(false);
          setNotice({ failed: false, text: `Pesan terkirim ke ${result.recipients} peserta.` });
          void load();
        }}
        onStale={() => void load()}
      />

      <AddTimeDialog
        participant={addTimeFor}
        examInstanceId={examInstanceId}
        examState={exam.lifecycleState}
        source={source}
        comfortable={comfortable}
        onClose={() => setAddTimeFor(null)}
        restoreFocus={operatorSource ? () => restoreFocus(timeTrigger.current) : undefined}
        onDone={outcome => {
          if (operatorSource) pendingFocus.current = timeTrigger.current;
          setAddTimeFor(null);
          setNotice(outcome);
          void load();
        }}
      />

      {source.transfer && (
        <ParticipantRoomTransferDialog
          participant={transferFor}
          examInstanceId={examInstanceId}
          examState={exam.lifecycleState}
          rooms={data.rooms ?? []}
          source={source.transfer}
          onClose={() => setTransferFor(null)}
          restoreFocus={() => restoreFocus(transferTrigger.current)}
          onDone={result => {
            // The row action keeps the focus; when the refresh removed it, "Perbarui" or the back button does.
            pendingFocus.current = transferTrigger.current;
            setTransferFor(null);
            setNotice({ failed: false, text: transferNotice(transferFor?.elligbleId ?? 'Peserta', result) });
            void load();
          }}
        />
      )}

      <Dialog open={confirmLock !== null} onOpenChange={open => { if (!open && !lockPending) setConfirmLock(null); }}>
        {confirmLock && (
          <DialogContent className={permissionDialogClass} aria-describedby="participant-lock-description"
            onCloseAutoFocus={event => {
              const target = [lockTrigger.current, refreshButton.current]
                .find(button => button?.isConnected && !button.disabled);
              if (target) { event.preventDefault(); target.focus(); }
            }}>
            <DialogHeader>
              <DialogTitle>{LOCK_COPY[confirmLock.action].title}</DialogTitle>
              <DialogDescription id="participant-lock-description">{LOCK_COPY[confirmLock.action].description}</DialogDescription>
            </DialogHeader>
            <p className="m-0 font-mono text-sm font-medium [overflow-wrap:anywhere]">{confirmLock.participant.elligbleId ?? 'Tanpa ELLIGBLE ID'}</p>
            <ActionReasonField value={reason} onChange={setReason} disabled={lockPending} />
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmLock(null)} disabled={lockPending}>Batal</Button>
              <Button onClick={() => runLockAction(confirmLock.participant, confirmLock.action)} disabled={lockPending || !validActionReason(reason)}>
                {lockPending ? 'Memproses...' : LOCK_COPY[confirmLock.action].confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Page>
  );
};
