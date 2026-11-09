import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError, getInstitutionSupervision, getInstitutionSupervisionExam, postInstitutionSupervisionBroadcast, postInstitutionSupervisionLock,
  postInstitutionSupervisionTime, postInstitutionSupervisionTransition,
} from '../api/assessment-client.ts';
import type {
  InstitutionReadiness, InstitutionSupervision, SupervisedExam, SupervisionAction, SupervisionSessionExamResult, SupervisionSkipCode,
} from '../types/assessment.ts';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { ActionGroup } from '@/components/ui/action-group';
import { Metric, MetricList } from '@/components/ui/metric';
import { EmptyState, LoadErrorState, LoadingState, StaleDataNotice } from '@/components/ui/page-state';
import { IconChevronLeft, IconInfo } from '@/components/icons';
import { ExamFacts, ExamListCard } from './ExamListCard.tsx';
import { ActionReasonField, permissionDialogClass, validActionReason } from './ActionReasonField.tsx';
import { ExamMonitoringView, type MonitoringSource } from './ExamMonitoringView.tsx';
import { institutionFailureMessages } from './InstitutionExamView.tsx';
import { useActionKey, useRetryFocus } from '../hooks/useDialogAction.ts';
import { examLifecycleStatus, readinessBlockerMessage } from '../lib/status.ts';
import { formatClockTime, formatTime, formatWindow } from '../lib/format.ts';

// "Pelaksanaan Sesi" (ASSESS-INSTITUTION-003 §4.6; Owner O05-3, OC-1..OC-6): the School Operator follows one
// session of institution exams as exam, room and participant status, refreshed by itself every 20 s and on return
// to the tab, and marked stale when a refresh fails (E6). The Operator opens, pauses, resumes and ends one exam or
// every exam of the session that qualifies (OC-2, OC-3). Every control asks for a reason and a confirmation
// (OC-4) and keeps one action key on its retries. "Pantau Peserta" opens the shared supervision screen with the
// Operator's source, over the whole exam (E15). ELLIGBLE IDs only; never a name, an answer or a score (OB-3, OC-5).

export const SUPERVISION_TITLE = 'Pelaksanaan Sesi';

const DEFAULT_REFRESH_MS = 20000;

/** The Operator's source for the shared supervision screen (E15). */
export const OPERATOR_SOURCE: MonitoringSource = {
  load: examInstanceId => getInstitutionSupervisionExam(examInstanceId),
  lock: (examInstanceId, participantId, action, intent) => postInstitutionSupervisionLock({ examInstanceId, participantId, action, ...intent }),
  addTime: input => postInstitutionSupervisionTime(input),
  broadcast: (examInstanceId, target, message, intent) => {
    if (!intent) return Promise.reject(new ApiError(400, 'invalid_request'));
    return postInstitutionSupervisionBroadcast({ examInstanceId, target, message, ...intent });
  },
  messageNeedsReason: true,
};

const count = (value: number) => new Intl.NumberFormat('id-ID').format(value);

function examLabel(exam: { subjectLabel: string | null; groupLabel: string | null }): string {
  return [exam.subjectLabel, exam.groupLabel].filter(Boolean).join(' · ') || 'Ujian';
}

/** E9: the state an action applies to and the state in which it is already done. */
const ACTION_STATES: Record<SupervisionAction, { from: string; done: string | null }> = {
  activate: { from: 'READY', done: null },
  pause: { from: 'ACTIVE', done: 'PAUSED' },
  resume: { from: 'PAUSED', done: 'ACTIVE' },
  end: { from: 'ACTIVE', done: 'ENDED' },
};

const ACTION_COPY: Record<SupervisionAction, { verb: string; done: string; session: string; confirmSession: string }> = {
  activate: { verb: 'Buka Ujian', done: 'dibuka', session: 'Buka Semua Ujian di Sesi Ini?', confirmSession: 'Buka Semua Ujian' },
  pause: { verb: 'Jeda Ujian', done: 'dijeda', session: 'Jeda Semua Ujian di Sesi Ini?', confirmSession: 'Jeda Semua Ujian' },
  resume: { verb: 'Lanjutkan Ujian', done: 'dilanjutkan', session: 'Lanjutkan Semua Ujian di Sesi Ini?', confirmSession: 'Lanjutkan Semua Ujian' },
  end: { verb: 'Akhiri Ujian', done: 'diakhiri', session: 'Akhiri Semua Ujian di Sesi Ini?', confirmSession: 'Akhiri Semua Ujian' },
};

function actionDescription(action: SupervisionAction, endsAt: string): string {
  switch (action) {
    case 'activate': return `Peserta dapat mulai mengerjakan sampai ${formatTime(endsAt)}. Kesiapan diperiksa ulang saat ujian dibuka.`;
    case 'pause': return 'Sisa waktu setiap peserta berhenti dan jawaban tidak dapat diubah sampai ujian dilanjutkan.';
    case 'resume': return 'Peserta melanjutkan dengan sisa waktu masing-masing saat dijeda.';
    case 'end': return 'Peserta baru tidak dapat mulai. Peserta yang sedang mengerjakan tetap dapat menyelesaikan sampai waktunya habis. Tidak ada hasil yang ditampilkan.';
  }
}

const ROOM_SETUP_COPY = 'Ruang dan pengawas ujian ini belum diatur. Atur lewat Ruang dan Pengawas.';
const INVALID_STATE_COPY = 'Status ujian sudah berubah. Pilih Perbarui untuk melihat status terbaru.';

function notReadyCopy(readiness: InstitutionReadiness | null | undefined): string {
  const blocker = readiness ? readinessBlockerMessage(readiness) : null;
  return `Ujian belum siap dibuka: ${blocker ?? 'Persyaratan dasar belum lengkap'}.`;
}

/** The words of one refusal code of a control (§4.6). */
function codeCopy(code: string, data: { windowStartsAt?: string; readiness?: InstitutionReadiness } = {}): string | null {
  switch (code) {
    case 'not_ready': return notReadyCopy(data.readiness);
    case 'window_not_started': return data.windowStartsAt ? `Ujian baru dapat dibuka mulai ${formatTime(data.windowStartsAt)}.` : 'Ujian belum dapat dibuka.';
    case 'window_closed': return 'Waktu sesi sudah berakhir, jadi ujian tidak dapat dibuka.';
    case 'room_setup_required': return ROOM_SETUP_COPY;
    case 'invalid_state': return INVALID_STATE_COPY;
    case 'nothing_applicable': return 'Tidak ada ujian di sesi ini yang dapat dikenai tindakan ini.';
  }
  return null;
}

/** One skipped exam of a session-wide control, in words. */
function skipLine(label: string, skip: { code: SupervisionSkipCode; currentState?: string; windowStartsAt?: string; readiness?: InstitutionReadiness }): string {
  if (skip.code === 'invalid_state') return `${label}: status ujian tidak sesuai (${examLifecycleStatus(skip.currentState ?? '').label}).`;
  return `${label}: ${codeCopy(skip.code, skip) ?? INVALID_STATE_COPY}`;
}

/** What a failed control tells the Operator: the control codes, then the frozen ASSESS-INSTITUTION-001 copy. */
function controlFailureMessages(err: unknown, labels: Map<string, string>): string[] {
  if (err instanceof ApiError) {
    const own = codeCopy(err.code, err.data ?? {});
    if (own) {
      const skips = err.code === 'nothing_applicable' && Array.isArray(err.data?.results)
        ? (err.data.results as SupervisionSessionExamResult[]).filter(r => r.skip).map(r => skipLine(labels.get(r.examInstanceId) ?? 'Ujian', r.skip!))
        : [];
      return [own, ...skips];
    }
  }
  return institutionFailureMessages(err);
}

const FailureList: React.FC<{ messages: string[] }> = ({ messages }) => messages.length === 0 ? null : (
  <div role="alert" className="flex min-w-0 flex-col gap-1 text-sm text-danger-ink">
    {messages.map(message => <p key={message} className="m-0 break-words">{message}</p>)}
  </div>
);

/** Why an exam is left out of a session-wide control, as the Operator can tell before sending (the server decides). */
function predictedCause(action: SupervisionAction, exam: SupervisedExam): string | null {
  if (exam.lifecycleState !== ACTION_STATES[action].from) return `status ujian tidak sesuai (${examLifecycleStatus(exam.lifecycleState).label}).`;
  if (action !== 'activate') return null;
  if (!exam.roomPolicy) return ROOM_SETUP_COPY;
  const blocker = exam.readiness ? readinessBlockerMessage(exam.readiness) : null;
  return blocker ? notReadyCopy(exam.readiness) : null;
}

type OpenDialog =
  | { kind: 'exam'; exam: SupervisedExam; action: SupervisionAction }
  | { kind: 'session'; action: SupervisionAction }
  | null;

interface DialogProps {
  open: boolean;
  onClose(): void;
  /** Return focus to the action that opened the dialog, or to the notice of a completed control; true when it could. */
  restoreFocus(): boolean;
}

const ControlDialog: React.FC<DialogProps & {
  target: OpenDialog;
  data: InstitutionSupervision;
  onDone(lines: string[]): void;
}> = ({ open, onClose, restoreFocus, target, data, onDone }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  useEffect(() => {
    if (open) { setReason(''); setErrors([]); }
  }, [open]);
  if (!target) return <Dialog open={false} />;
  const action = target.action;
  const copy = ACTION_COPY[action];
  const labels = new Map(data.exams.map(e => [e.examInstanceId, examLabel(e)]));
  const affected = target.kind === 'session' ? data.exams.filter(e => predictedCause(action, e) === null) : [];
  const unaffected = target.kind === 'session'
    ? data.exams.map(e => ({ exam: e, cause: predictedCause(action, e) })).filter((x): x is { exam: SupervisedExam; cause: string } => x.cause !== null)
    : [];
  const title = target.kind === 'exam' ? `${copy.verb} ${examLabel(target.exam)}?` : copy.session;
  const confirm = target.kind === 'exam' ? copy.verb : copy.confirmSession;

  const submit = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const intent = { reason, confirmed: true as const, actionKey: key.current };
      const result = await postInstitutionSupervisionTransition(target.kind === 'exam'
        ? { examInstanceId: target.exam.examInstanceId, action, ...intent }
        : { sessionId: data.session.sessionId, action, ...intent });
      if ('results' in result) {
        const done = result.results.filter(r => r.outcome !== 'SKIPPED').length;
        const skipped = result.results.filter(r => r.outcome === 'SKIPPED');
        onDone([
          `${count(done)} ujian ${copy.done}.`,
          ...(skipped.length > 0 ? [`${count(skipped.length)} ujian tidak terkena.`] : []),
          ...skipped.map(r => skipLine(labels.get(r.examInstanceId) ?? 'Ujian', r.skip!)),
        ]);
      } else {
        onDone([`Ujian ${examLabel(target.kind === 'exam' ? target.exam : { subjectLabel: null, groupLabel: null })} ${copy.done}.`]);
      }
    } catch (err) {
      setErrors(controlFailureMessages(err, labels));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && (
        <DialogContent className={permissionDialogClass} aria-describedby="supervision-dialog-description"
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription id="supervision-dialog-description">{actionDescription(action, data.session.endsAt)}</DialogDescription>
          </DialogHeader>
          {target.kind === 'session' && (
            <div className="flex min-w-0 flex-col gap-3 text-sm">
              <section aria-labelledby="supervision-affected" className="flex min-w-0 flex-col gap-1">
                <h3 id="supervision-affected" className="m-0 text-sm font-medium">Akan terkena:</h3>
                <ul role="list" className="m-0 flex list-none flex-col gap-1 p-0">
                  {affected.map(exam => <li key={exam.examInstanceId} className="break-words">{examLabel(exam)}</li>)}
                </ul>
              </section>
              {unaffected.length > 0 && (
                <section aria-labelledby="supervision-unaffected" className="flex min-w-0 flex-col gap-1">
                  <h3 id="supervision-unaffected" className="m-0 text-sm font-medium">Tidak terkena:</h3>
                  <ul role="list" className="m-0 flex list-none flex-col gap-1 p-0 text-muted-foreground">
                    {unaffected.map(({ exam, cause }) => <li key={exam.examInstanceId} className="break-words">{examLabel(exam)}: {cause}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}
          <ActionReasonField value={reason} onChange={setReason} disabled={saving} />
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} variant={action === 'end' ? 'destructive' : 'default'} onClick={submit} disabled={saving || !validActionReason(reason)}>
              {saving ? 'Memproses...' : confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

/** One room line of an exam card (§4.6). */
function roomLine(room: SupervisedExam['rooms'][number]): string {
  const proctors = room.proctors.length > 0 ? room.proctors.map(p => p.elligbleId).join(', ') : '-';
  return `${room.label}: ${count(room.counts.participants)} peserta, ${count(room.counts.active)} mengerjakan, ${count(room.counts.locked)} dikunci. Pengawas: ${proctors}`;
}

const wrapButton = 'h-auto min-h-11 whitespace-normal py-2';

const ExamCard: React.FC<{
  exam: SupervisedExam;
  onControl(exam: SupervisedExam, action: SupervisionAction, trigger: HTMLButtonElement): void;
  onMonitor(exam: SupervisedExam): void;
}> = ({ exam, onControl, onMonitor }) => {
  const lifecycle = examLifecycleStatus(exam.lifecycleState);
  const ready = exam.lifecycleState === 'READY';
  const blocker = ready && exam.readiness ? readinessBlockerMessage(exam.readiness) : null;
  const readyLine = !ready ? null : !exam.roomPolicy ? ROOM_SETUP_COPY : blocker ? notReadyCopy(exam.readiness) : 'Siap dibuka.';
  const monitored = ['ACTIVE', 'PAUSED', 'ENDED'].includes(exam.lifecycleState);
  return (
    <li className="min-w-0">
      <ExamListCard
        headingLevel="h3"
        className="min-w-0"
        data-testid={`supervision-exam-${exam.examInstanceId}`}
        title={exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}
        status={<StatusBadge tone={lifecycle.tone} className="max-w-full whitespace-normal">{lifecycle.label}</StatusBadge>}
      >
        <ExamFacts className="min-w-0 break-words">
          <p>{exam.groupLabel ?? '-'} · {count(exam.counts.participants)} peserta · {count(exam.counts.active)} mengerjakan · {count(exam.counts.submitted)} dikumpulkan</p>
          {exam.lifecycleState === 'PAUSED' && exam.pausedAt && <p>Dijeda sejak {formatTime(exam.pausedAt)}</p>}
          {exam.rooms.map(room => <p key={room.label} className="break-words">{roomLine(room)}</p>)}
        </ExamFacts>
        {readyLine && (
          <p className={`m-0 min-w-0 break-words text-sm ${readyLine === 'Siap dibuka.' ? 'text-success-ink' : 'text-warning-ink'}`}>{readyLine}</p>
        )}
        {(ready || monitored) && (
          <ActionGroup>
            {ready && <Button className={wrapButton} onClick={event => onControl(exam, 'activate', event.currentTarget)}>Buka Ujian</Button>}
            {exam.lifecycleState === 'ACTIVE' && (
              <>
                <Button variant="secondary" className={wrapButton} onClick={event => onControl(exam, 'pause', event.currentTarget)}>Jeda Ujian</Button>
                <Button variant="destructive" className={wrapButton} onClick={event => onControl(exam, 'end', event.currentTarget)}>Akhiri Ujian</Button>
              </>
            )}
            {exam.lifecycleState === 'PAUSED' && (
              <Button className={wrapButton} onClick={event => onControl(exam, 'resume', event.currentTarget)}>Lanjutkan Ujian</Button>
            )}
            {monitored && (
              <Button id={`monitor-trigger-${exam.examInstanceId}`} variant="secondary" className={wrapButton} onClick={() => onMonitor(exam)}>Pantau Peserta</Button>
            )}
          </ActionGroup>
        )}
      </ExamListCard>
    </li>
  );
};

export const SchoolExamMonitoringView: React.FC<{
  session: { sessionId: string; startsAt: string; endsAt: string };
  onBack(): void;
  refreshIntervalMs?: number;
}> = ({ session, onBack, refreshIntervalMs = DEFAULT_REFRESH_MS }) => {
  const [data, setData] = useState<InstitutionSupervision | null>(null);
  const [loadError, setLoadError] = useState<'forbidden' | 'failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  // "Pantau Peserta" replaces this screen with the shared supervision screen; returning focuses its trigger.
  const [monitored, setMonitored] = useState<SupervisedExam | null>(null);
  const monitorTrigger = useRef<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const reloadButton = useRef<HTMLButtonElement | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const page = useRef<HTMLElement | null>(null);
  const level = useRef<HTMLDivElement | null>(null);
  const loading = useRef(false);

  // On entry, focus moves to the screen title, which stays in every state.
  useEffect(() => {
    const title = page.current?.querySelector<HTMLHeadingElement>('h1');
    if (!title) return;
    title.tabIndex = -1;
    title.classList.add('outline-none');
    title.focus();
  }, []);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      setData(await getInstitutionSupervision(session.sessionId));
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // A refusal replaces the data: nothing of the session stays on screen.
        setData(null);
        setLoadError('forbidden');
      } else {
        setLoadError('failed');
      }
    } finally {
      loading.current = false;
    }
  }, [session.sessionId]);

  // E6: refreshed by itself every 20 s and on return to the tab, while this screen shows.
  useEffect(() => {
    if (monitored) return;
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
  }, [load, refreshIntervalMs, monitored]);

  // Back from "Pantau Peserta": focus returns to its trigger once the card is on screen again.
  useEffect(() => {
    if (monitored || !monitorTrigger.current || !data) return;
    const button = document.getElementById(`monitor-trigger-${monitorTrigger.current}`);
    monitorTrigger.current = null;
    (button ?? page.current?.querySelector<HTMLHeadingElement>('h1'))?.focus();
  }, [monitored, data]);

  // Into "Pantau Peserta": its trigger is gone, so focus goes to the new screen's title, and again to the title that
  // replaces it when the list arrives, unless the user has moved focus meanwhile.
  useEffect(() => {
    const root = level.current;
    if (!monitored || !root) return;
    let previous: HTMLHeadingElement | null = null;
    const focusTitle = () => {
      const title = root.querySelector<HTMLHeadingElement>('h1');
      if (!title || title === previous) return;
      const active = document.activeElement;
      if (previous !== null && active !== null && active !== document.body && active !== previous) return;
      title.tabIndex = -1;
      title.classList.add('outline-none');
      title.focus();
      previous = title;
    };
    focusTitle();
    const observer = new MutationObserver(focusTitle);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [monitored]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const restoreFocus = () => {
    // Controlled dialogs have no Radix trigger: return to the opener; after a completed control, to its notice,
    // because the refresh may remove the opener (as InstitutionExamView).
    const target = [trigger.current, noticeRef.current, reloadButton.current]
      .find(el => el?.isConnected && !(el instanceof HTMLButtonElement && el.disabled));
    target?.focus();
    return target !== undefined;
  };
  const open = (next: OpenDialog, opener: HTMLButtonElement | null) => {
    trigger.current = opener;
    setNotice(null);
    setDialog(next);
  };
  const done = async (lines: string[]) => {
    trigger.current = null;
    setDialog(null);
    setNotice(lines);
    await refresh();
  };

  if (monitored) {
    return (
      <div ref={level} className="contents">
        <ExamMonitoringView
          examInstanceId={monitored.examInstanceId}
          backLabel="Kembali ke Pelaksanaan Sesi"
          source={OPERATOR_SOURCE}
          refreshIntervalMs={refreshIntervalMs}
          onBack={() => {
            monitorTrigger.current = monitored.examInstanceId;
            setNotice(null);
            setMonitored(null);
          }}
        />
      </div>
    );
  }

  const back = (
    <Button variant="ghost" size="sm" className="-ml-3 h-auto min-h-11 max-w-full self-start whitespace-normal py-2 text-left" onClick={onBack}>
      <IconChevronLeft aria-hidden="true" />
      Kembali ke Ujian Sekolah
    </Button>
  );
  const slot = data?.session ?? session;
  const header = (
    <PageHeader
      title={SUPERVISION_TITLE}
      actions={loadError !== 'forbidden' && (
        <Button ref={reloadButton} variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Memperbarui...' : 'Perbarui'}
        </Button>
      )}
    >
      <p className="m-0 text-muted-foreground">
        Jadwal Sesi: {formatWindow(slot.startsAt, slot.endsAt)}. Pantau setiap ujian, ruang dan peserta di sesi ini. Setiap tindakan memerlukan alasan dan dicatat.
      </p>
      {data && (
        <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
          Diperbarui {formatClockTime(data.serverTime)}. Diperbarui otomatis.
        </p>
      )}
    </PageHeader>
  );

  // One notice slot in every state, so the title keeps its element (and its focus) when the data arrives.
  const noticeBanner = notice ? (
    <Alert ref={noticeRef} tabIndex={-1} variant="success" role="status" className="outline-none">
      <IconInfo aria-hidden="true" />
      <AlertDescription className="min-w-0 break-words">
        {notice.map(line => <p key={line} className="m-0">{line}</p>)}
      </AlertDescription>
    </Alert>
  ) : null;

  if (!data) {
    return (
      <Page id="institution-supervision" ref={page} className="min-w-0">
        {noticeBanner}
        {back}
        {header}
        {loadError === null ? (
          <LoadingState>Memuat pelaksanaan sesi...</LoadingState>
        ) : loadError === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">Anda tidak berwenang mengatur ujian sekolah ini.</LoadErrorState>
        ) : (
          <LoadErrorState kind="failed" title="Gagal Memuat Pelaksanaan Sesi" onRetry={() => void refresh()} retrying={refreshing}>
            Periksa koneksi internet Anda, lalu coba lagi. Ujian peserta tetap berjalan.
          </LoadErrorState>
        )}
      </Page>
    );
  }

  const running = data.exams.filter(e => e.lifecycleState === 'ACTIVE').length;
  const paused = data.exams.filter(e => e.lifecycleState === 'PAUSED').length;
  const working = data.exams.reduce((n, e) => n + e.counts.active, 0);
  const qualifies = (action: SupervisionAction) => data.exams.some(e => e.lifecycleState === ACTION_STATES[action].from);
  const sessionActions = (['activate', 'pause', 'resume', 'end'] as const).filter(qualifies);

  return (
    <Page id="institution-supervision" ref={page} className="min-w-0">
      {noticeBanner}
      {back}
      {header}
      {loadError === 'failed' && (
        <StaleDataNotice title="Pemantauan tertunda">
          Data di bawah adalah data terakhir pukul {formatClockTime(data.serverTime)}. Ujian peserta tetap berjalan; pemantauan akan dicoba lagi otomatis.
        </StaleDataNotice>
      )}
      <MetricList aria-label="Ringkasan sesi" layout="narrowFirst">
        <Metric className="min-w-0" label="Ujian" value={count(data.exams.length)} />
        <Metric className="min-w-0" label="Berlangsung" value={count(running)} />
        <Metric className="min-w-0" label="Dijeda" value={count(paused)} />
        <Metric className="min-w-0" label="Peserta mengerjakan" value={count(working)} />
      </MetricList>

      {sessionActions.length > 0 && (
        <section aria-labelledby="session-actions-title" className="flex min-w-0 flex-col gap-3">
          <h2 id="session-actions-title" className="m-0 text-xl font-semibold">Tindakan untuk Seluruh Sesi</h2>
          <ActionGroup>
            {sessionActions.map(action => (
              <Button key={action} variant={action === 'end' ? 'destructive' : 'secondary'} className={wrapButton}
                onClick={event => open({ kind: 'session', action }, event.currentTarget)}>
                {ACTION_COPY[action].confirmSession}
              </Button>
            ))}
          </ActionGroup>
        </section>
      )}

      <section aria-labelledby="session-exams-title" className="flex min-w-0 flex-col gap-3">
        <h2 id="session-exams-title" className="m-0 text-xl font-semibold">Ujian di Sesi Ini</h2>
        {data.exams.length === 0 ? (
          <EmptyState title="Belum ada ujian.">Belum ada ujian di sesi ini.</EmptyState>
        ) : (
          <ul role="list" className="m-0 grid list-none grid-cols-1 gap-4 p-0">
            {data.exams.map(exam => (
              <ExamCard key={exam.examInstanceId} exam={exam}
                onControl={(item, action, opener) => open({ kind: 'exam', exam: item, action }, opener)}
                onMonitor={item => { setNotice(null); setMonitored(item); }} />
            ))}
          </ul>
        )}
      </section>

      <ControlDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        restoreFocus={restoreFocus}
        target={dialog}
        data={data}
        onDone={lines => void done(lines)}
      />
    </Page>
  );
};
