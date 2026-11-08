import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError, getInstitutionExams, getInstitutionPeriod, postInstitutionCancel, postInstitutionDeadline, postInstitutionPeriod,
  postInstitutionPlacement, postInstitutionSession, postInstitutionTransition,
} from '../api/assessment-client.ts';
import type {
  InstitutionExamItem, InstitutionOverview, InstitutionPeriodDetail, InstitutionProblem, InstitutionProblemCode, InstitutionSession,
  LatestStartPolicy,
} from '../types/assessment.ts';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { ActionGroup } from '@/components/ui/action-group';
import { EmptyState, LoadErrorState, LoadingState, StaleDataNotice } from '@/components/ui/page-state';
import { IconInfo } from '@/components/icons';
import { ExamFacts, ExamList, ExamListCard } from './ExamListCard.tsx';
import { ActionReasonField, permissionDialogClass, validActionReason } from './ActionReasonField.tsx';
import { newActionKey } from '../lib/action-key.ts';
import { CANCELLED_EXAM_STATUS, examLifecycleStatus, preparationStatus, readinessBlockerMessage, readinessPasses } from '../lib/status.ts';
import { formatDateTime, formatWindow, zoneLabel } from '../lib/format.ts';
import { LATEST_START_OPTIONS } from '../lib/question-import.ts';

// "Ujian Sekolah" (ASSESS-INSTITUTION-001 §4.6; Owner O05-1, O05-2, OP-1..OP-9, OB-1): the School
// Operator composes an exam period with its sessions (a date and a time slot) and places one exam per
// subject x rombel in a session, bound to its subject Teacher, with a preparation deadline. The Operator
// extends a deadline (reason and confirmation), marks an exam ready after its deadline and cancels an
// exam that has not opened (archived, never deleted). Only operational data is shown: never a question,
// an answer key or a score. The form dialogs are the on-screen confirmation of creating a period, a
// session and a placement (OP-7 A): nothing is sent before their own action.

export const INSTITUTION_TITLE = 'Ujian Sekolah';

const PROBLEM_COPY: Record<InstitutionProblemCode, string> = {
  label_invalid: 'Nama periode wajib diisi, paling banyak 120 karakter.',
  label_taken: 'Nama periode ini sudah dipakai untuk periode akademik yang sama.',
  assessment_type_unknown: 'Data pilihan sudah berubah. Muat ulang halaman, lalu pilih lagi.',
  academic_period_unknown: 'Data pilihan sudah berubah. Muat ulang halaman, lalu pilih lagi.',
  teaching_assignment_unknown: 'Data pilihan sudah berubah. Muat ulang halaman, lalu pilih lagi.',
  academic_period_ended: 'Periode akademik ini sudah berakhir.',
  date_invalid: 'Tanggal atau jam tidak valid.',
  time_invalid: 'Tanggal atau jam tidak valid.',
  deadline_invalid: 'Tanggal atau jam tidak valid.',
  window_order: 'Jam selesai harus setelah jam mulai.',
  window_ended: 'Waktu sesi sudah lewat.',
  date_outside_period: 'Tanggal sesi harus berada di dalam periode akademik periode ujian ini.',
  session_taken: 'Sesi dengan waktu yang sama sudah ada di periode ini.',
  time_zone_missing: 'Zona waktu sekolah belum diatur. Hubungi administrator platform.',
  teaching_assignment_other_period: 'Mata pelajaran ini bukan dari periode akademik periode ujian ini.',
  already_placed: 'Mata pelajaran dan rombel ini sudah ditempatkan di periode ini.',
  session_started: 'Sesi sudah dimulai, jadi ujian tidak dapat ditempatkan.',
  duration_invalid: 'Durasi harus 1 sampai 1.440 menit.',
  duration_exceeds_window: 'Durasi tidak muat di waktu sesi dengan aturan mulai terlambat ini.',
  deadline_passed: 'Tenggat harus di masa mendatang.',
  deadline_not_before_session: 'Tenggat harus sebelum sesi dimulai.',
  deadline_not_later: 'Tenggat baru harus setelah tenggat saat ini.',
  no_participants: 'Tidak ada siswa yang terdaftar di rombel ini pada tanggal sesi.',
  schedule_conflict: 'siswa sudah dijadwalkan di ujian lain pada waktu yang sama.',
};

const CONNECTION_COPY = 'Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda.';
const FORBIDDEN_COPY = 'Anda tidak berwenang mengatur ujian sekolah ini.';

const count = (value: number) => new Intl.NumberFormat('id-ID').format(value);

/** The words of one refusal of a composition check. */
export function institutionProblemText(problem: InstitutionProblem): string {
  if (problem.code === 'schedule_conflict') return `${count(problem.count ?? 0)} ${PROBLEM_COPY.schedule_conflict}`;
  return PROBLEM_COPY[problem.code] ?? CONNECTION_COPY;
}

/** What a failed Operator request tells the Operator: one line per distinct problem. */
export function institutionFailureMessages(err: unknown): string[] {
  if (err instanceof ApiError) {
    if (err.status === 422 && Array.isArray(err.data?.problems)) {
      return [...new Set((err.data.problems as InstitutionProblem[]).map(institutionProblemText))];
    }
    switch (err.code) {
      case 'stale_deadline': return ['Tenggat baru saja diubah. Muat ulang untuk melihat tenggat terbaru.'];
      case 'preparation_open': return ['Tenggat penyiapan soal belum lewat. Ujian dapat ditandai siap setelah tenggat.'];
      case 'not_ready': {
        const blocker = err.data?.readiness ? readinessBlockerMessage(err.data.readiness) : null;
        return [`Ujian belum dapat ditandai siap: ${blocker ?? 'Persyaratan dasar belum lengkap'}.`];
      }
      case 'invalid_state': return ['Status ujian sudah berubah. Muat ulang halaman.'];
      case 'invalid_request': return ['Isian belum lengkap atau tidak valid. Periksa lagi.'];
      case 'action_key_reused':
      case 'state_changed':
        return ['Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.'];
      case 'forbidden': return [FORBIDDEN_COPY];
    }
  }
  return [CONNECTION_COPY];
}

function examLabel(exam: InstitutionExamItem): string {
  return [exam.subjectLabel, exam.groupLabel].filter(Boolean).join(' · ') || 'Ujian';
}

const FailureList: React.FC<{ messages: string[] }> = ({ messages }) => messages.length === 0 ? null : (
  <div role="alert" className="flex flex-col gap-1 text-sm text-danger-ink">
    {messages.map(message => <p key={message} className="m-0">{message}</p>)}
  </div>
);

/** One field of a dialog form: the label above the control. */
const Field: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
  </div>
);

interface DialogProps {
  open: boolean;
  onClose(): void;
  /** Return focus to the action that opened the dialog; true when it could. */
  restoreFocus(): boolean;
}

/** A dialog form with one action key per opening, kept on every retry of it. */
function useActionKey(open: boolean) {
  const key = useRef<string>('');
  useEffect(() => {
    if (open) key.current = newActionKey();
  }, [open]);
  return key;
}

/**
 * Sending disables the focused action. Restore focus to the enabled retry control only after the
 * error and that control have both committed to the dialog (as TeacherExamParticipants).
 */
function useRetryFocus(open: boolean, errors: string[], saving: boolean) {
  const retry = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open && errors.length > 0 && !saving && retry.current && !retry.current.disabled) retry.current.focus();
  }, [open, errors, saving]);
  return retry;
}

const PeriodDialog: React.FC<DialogProps & { overview: InstitutionOverview; onSaved(periodId: string): void }> = ({ open, onClose, restoreFocus, overview, onSaved }) => {
  const [label, setLabel] = useState('');
  const [assessmentTypeId, setAssessmentTypeId] = useState('');
  const [academicPeriodId, setAcademicPeriodId] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  useEffect(() => {
    if (!open) return;
    setLabel(''); setAssessmentTypeId(''); setErrors([]);
    setAcademicPeriodId(overview.academicPeriods.length === 1 ? overview.academicPeriods[0].academicPeriodId : '');
  }, [open, overview]);
  const submit = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const result = await postInstitutionPeriod({ label, assessmentTypeId, academicPeriodId, actionKey: key.current });
      onSaved(result.periodId);
    } catch (err) {
      setErrors(institutionFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && (
        <DialogContent className={permissionDialogClass} aria-describedby={undefined}
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Buat Periode Ujian</DialogTitle>
          </DialogHeader>
          <Field id="period-label" label="Nama periode">
            <Input id="period-label" value={label} maxLength={240} disabled={saving} onChange={e => setLabel(e.target.value)} />
          </Field>
          <Field id="period-type" label="Jenis penilaian">
            <NativeSelect id="period-type" value={assessmentTypeId} disabled={saving} onChange={e => setAssessmentTypeId(e.target.value)}>
              <option value="">Pilih jenis penilaian</option>
              {overview.assessmentTypes.map(t => <option key={t.assessmentTypeId} value={t.assessmentTypeId}>{t.label}</option>)}
            </NativeSelect>
          </Field>
          <Field id="period-academic" label="Periode Akademik">
            <NativeSelect id="period-academic" value={academicPeriodId} disabled={saving} onChange={e => setAcademicPeriodId(e.target.value)}>
              <option value="">Pilih periode akademik</option>
              {overview.academicPeriods.map(p => <option key={p.academicPeriodId} value={p.academicPeriodId}>{p.label}</option>)}
            </NativeSelect>
          </Field>
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} onClick={submit} disabled={saving || !label.trim() || !assessmentTypeId || !academicPeriodId}>
              {saving ? 'Menyimpan...' : 'Simpan Periode'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

const SessionDialog: React.FC<DialogProps & { periodId: string | null; onSaved(): void }> = ({ open, onClose, restoreFocus, periodId, onSaved }) => {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  useEffect(() => {
    if (open) { setDate(''); setStartTime(''); setEndTime(''); setErrors([]); }
  }, [open]);
  const zone = zoneLabel();
  const submit = async () => {
    if (!periodId) return;
    setSaving(true);
    setErrors([]);
    try {
      await postInstitutionSession({ periodId, date, startTime: startTime.slice(0, 5), endTime: endTime.slice(0, 5), actionKey: key.current });
      onSaved();
    } catch (err) {
      setErrors(institutionFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && (
        <DialogContent className={permissionDialogClass} aria-describedby="session-dialog-description"
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Tambah Sesi</DialogTitle>
            <DialogDescription id="session-dialog-description">{zone ? `Semua waktu dalam zona waktu sekolah (${zone}).` : 'Semua waktu dalam zona waktu sekolah.'}</DialogDescription>
          </DialogHeader>
          <Field id="session-date" label="Tanggal">
            <Input id="session-date" type="date" value={date} disabled={saving} onChange={e => setDate(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="session-start" label="Jam mulai">
              <Input id="session-start" type="time" value={startTime} disabled={saving} onChange={e => setStartTime(e.target.value)} />
            </Field>
            <Field id="session-end" label="Jam selesai">
              <Input id="session-end" type="time" value={endTime} disabled={saving} onChange={e => setEndTime(e.target.value)} />
            </Field>
          </div>
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} onClick={submit} disabled={saving || !date || !startTime || !endTime}>{saving ? 'Menyimpan...' : 'Simpan Sesi'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

const PlacementDialog: React.FC<DialogProps & { overview: InstitutionOverview; session: InstitutionSession | null; onSaved(notice: string): void }> = ({
  open, onClose, restoreFocus, overview, session, onSaved,
}) => {
  const [teachingAssignmentId, setTeachingAssignmentId] = useState('');
  const [duration, setDuration] = useState('');
  const [policy, setPolicy] = useState<LatestStartPolicy | ''>('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  useEffect(() => {
    if (open) { setTeachingAssignmentId(''); setDuration(''); setPolicy(''); setDeadline(''); setErrors([]); }
  }, [open]);
  const zone = zoneLabel();
  const minutes = Number(duration);
  const complete = !!session && !!teachingAssignmentId && duration.trim() !== '' && Number.isFinite(minutes) && !!policy && !!deadline;
  const submit = async () => {
    if (!complete || !session || !policy) return;
    setSaving(true);
    setErrors([]);
    try {
      const result = await postInstitutionPlacement({
        sessionId: session.sessionId, teachingAssignmentId, durationMinutes: minutes, latestStartPolicy: policy,
        preparationDeadline: deadline.slice(0, 16), actionKey: key.current,
      });
      const assignment = overview.teachingAssignments.find(a => a.teachingAssignmentId === teachingAssignmentId);
      const label = assignment ? `${assignment.subjectLabel} · ${assignment.groupLabel}` : 'Ujian';
      onSaved(`${label} ditempatkan dengan ${count(result.participants)} peserta. Guru mata pelajaran dapat menyiapkan soal sampai ${formatDateTime(result.preparationDeadline)}.`);
    } catch (err) {
      setErrors(institutionFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && session && (
        <DialogContent className={permissionDialogClass} aria-describedby="placement-dialog-description"
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Tempatkan Ujian di Sesi</DialogTitle>
            <DialogDescription id="placement-dialog-description">Jadwal Sesi: {formatWindow(session.startsAt, session.endsAt)}</DialogDescription>
          </DialogHeader>
          <Field id="placement-assignment" label="Mata pelajaran dan rombel">
            <NativeSelect id="placement-assignment" value={teachingAssignmentId} disabled={saving} onChange={e => setTeachingAssignmentId(e.target.value)}>
              <option value="">Pilih mata pelajaran dan rombel</option>
              {overview.teachingAssignments.map(a => (
                <option key={a.teachingAssignmentId} value={a.teachingAssignmentId}>
                  {[a.subjectLabel, a.groupLabel, a.teacherElligbleId].filter(Boolean).join(' · ')}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="placement-duration" label="Durasi pengerjaan (menit)">
            <Input id="placement-duration" type="number" inputMode="numeric" min={1} max={overview.limits.maxDurationMinutes} step={1}
              value={duration} disabled={saving} onChange={e => setDuration(e.target.value)} />
          </Field>
          <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">Aturan mulai terlambat</legend>
            {LATEST_START_OPTIONS.map(option => (
              <label key={option.value} className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 text-sm has-[:checked]:border-foreground">
                <input
                  type="radio"
                  name="placement-latest-start"
                  value={option.value}
                  checked={policy === option.value}
                  disabled={saving}
                  onChange={() => setPolicy(option.value)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Field id="placement-deadline" label="Tenggat penyiapan soal">
            <Input id="placement-deadline" type="datetime-local" value={deadline} disabled={saving} onChange={e => setDeadline(e.target.value)}
              aria-describedby="placement-deadline-help" />
          </Field>
          <p id="placement-deadline-help" className="m-0 text-sm text-muted-foreground">
            {zone ? `Dalam zona waktu sekolah (${zone}). ` : ''}Setelah tenggat, soal tidak dapat diubah.
          </p>
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} onClick={submit} disabled={saving || !complete}>{saving ? 'Menyimpan...' : 'Tempatkan Ujian'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

const DeadlineDialog: React.FC<DialogProps & { exam: InstitutionExamItem | null; onSaved(notice: string): void }> = ({ open, onClose, restoreFocus, exam, onSaved }) => {
  const [deadline, setDeadline] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  useEffect(() => {
    if (open) { setDeadline(''); setReason(''); setErrors([]); }
  }, [open]);
  const submit = async () => {
    if (!exam) return;
    setSaving(true);
    setErrors([]);
    try {
      const result = await postInstitutionDeadline({
        examInstanceId: exam.examInstanceId, preparationDeadline: deadline.slice(0, 16), expectedRevision: exam.preparation.revision, reason, actionKey: key.current,
      });
      onSaved(`Tenggat penyiapan soal ${examLabel(exam)} diperpanjang sampai ${formatDateTime(result.preparationDeadline)}.`);
    } catch (err) {
      setErrors(institutionFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && exam && (
        <DialogContent className={permissionDialogClass} aria-describedby="deadline-dialog-description"
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Perpanjang Tenggat Penyiapan Soal</DialogTitle>
            <DialogDescription id="deadline-dialog-description">
              {examLabel(exam)}{exam.preparation.deadline ? `. Tenggat penyiapan soal: ${formatDateTime(exam.preparation.deadline)}.` : '.'}
            </DialogDescription>
          </DialogHeader>
          <Field id="deadline-new" label="Tenggat baru">
            <Input id="deadline-new" type="datetime-local" value={deadline} disabled={saving} onChange={e => setDeadline(e.target.value)} />
          </Field>
          <ActionReasonField value={reason} onChange={setReason} disabled={saving} />
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} onClick={submit} disabled={saving || !deadline || !validActionReason(reason)}>{saving ? 'Menyimpan...' : 'Perpanjang'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

const CancelDialog: React.FC<DialogProps & { exam: InstitutionExamItem | null; onSaved(notice: string): void }> = ({ open, onClose, restoreFocus, exam, onSaved }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  useEffect(() => {
    if (open) { setReason(''); setErrors([]); }
  }, [open]);
  const submit = async () => {
    if (!exam) return;
    setSaving(true);
    setErrors([]);
    try {
      await postInstitutionCancel({ examInstanceId: exam.examInstanceId, reason, actionKey: key.current });
      onSaved(`${examLabel(exam)} dibatalkan dan diarsipkan.`);
    } catch (err) {
      setErrors(institutionFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && exam && (
        <DialogContent className={permissionDialogClass} aria-describedby="cancel-dialog-description"
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Batalkan Ujian Sekolah?</DialogTitle>
            <DialogDescription id="cancel-dialog-description">
              Ujian diarsipkan dan tidak dihapus. Guru mata pelajaran melihat pembatalan ini beserta alasannya.
            </DialogDescription>
          </DialogHeader>
          <p className="m-0 font-medium">{examLabel(exam)}</p>
          <ActionReasonField value={reason} onChange={setReason} disabled={saving} />
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} variant="destructive" onClick={submit} disabled={saving || !validActionReason(reason)}>{saving ? 'Membatalkan...' : 'Batalkan Ujian'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

const ReadyDialog: React.FC<DialogProps & { exam: InstitutionExamItem | null; onSaved(notice: string): void }> = ({ open, onClose, restoreFocus, exam, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  useEffect(() => {
    if (open) setErrors([]);
  }, [open]);
  const submit = async () => {
    if (!exam) return;
    setSaving(true);
    setErrors([]);
    try {
      await postInstitutionTransition(exam.examInstanceId);
      onSaved(`${examLabel(exam)} ditandai siap.`);
    } catch (err) {
      setErrors(institutionFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && exam && (
        <DialogContent className={permissionDialogClass} aria-describedby="ready-dialog-description"
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Tandai Siap?</DialogTitle>
            <DialogDescription id="ready-dialog-description">
              Ujian {examLabel(exam)} akan ditandai siap. Soal tidak dapat diubah lagi, dan tenggat tidak dapat diperpanjang. Membuka ujian dilakukan pada langkah tersendiri.
            </DialogDescription>
          </DialogHeader>
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} onClick={submit} disabled={saving}>{saving ? 'Memproses...' : 'Tandai Siap'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

type OpenDialog =
  | { kind: 'period' }
  | { kind: 'session'; periodId: string }
  | { kind: 'placement'; session: InstitutionSession }
  | { kind: 'deadline'; exam: InstitutionExamItem }
  | { kind: 'cancel'; exam: InstitutionExamItem }
  | { kind: 'ready'; exam: InstitutionExamItem }
  | null;

const ExamItem: React.FC<{ exam: InstitutionExamItem; onAction(kind: 'deadline' | 'cancel' | 'ready', exam: InstitutionExamItem, trigger: HTMLButtonElement): void }> = ({ exam, onAction }) => {
  const cancelled = exam.cancelledAt !== null;
  const lifecycle = examLifecycleStatus(exam.lifecycleState);
  const preparation = preparationStatus(exam.preparation);
  const blocker = exam.readiness ? readinessBlockerMessage(exam.readiness) : null;
  const ready = exam.readiness !== null && readinessPasses(exam.readiness);
  return (
    <li>
      <ExamListCard
        headingLevel="h3"
        data-testid={`institution-exam-${exam.examInstanceId}`}
        title={exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}
        status={
          <span className="flex flex-wrap gap-2">
            {cancelled ? (
              <StatusBadge tone={CANCELLED_EXAM_STATUS.tone}>{CANCELLED_EXAM_STATUS.label}</StatusBadge>
            ) : (
              <>
                <StatusBadge tone={lifecycle.tone}>{lifecycle.label}</StatusBadge>
                <StatusBadge tone={preparation.tone}>{preparation.label}</StatusBadge>
              </>
            )}
          </span>
        }
      >
        <ExamFacts>
          <p>{exam.groupLabel ?? '-'} · Guru {exam.teacherElligbleId ?? '-'}</p>
          <p>{count(exam.participants)} peserta · {count(exam.durationMinutes)} menit</p>
          {exam.preparation.deadline && (
            <p>Tenggat penyiapan soal: {formatDateTime(exam.preparation.deadline)}{exam.preparation.revision > 1 ? ' (diperpanjang)' : ''}</p>
          )}
          {cancelled && exam.cancelledAt && <p>Dibatalkan {formatDateTime(exam.cancelledAt)}.</p>}
        </ExamFacts>
        {!cancelled && blocker && (
          <p className="m-0 text-sm text-warning-ink">{blocker}</p>
        )}
        {!cancelled && (exam.lifecycleState === 'SCHEDULED' || exam.lifecycleState === 'READY') && (
          <ActionGroup>
            {exam.lifecycleState === 'SCHEDULED' && (
              <>
                <Button variant="secondary" onClick={event => onAction('deadline', exam, event.currentTarget)}>Perpanjang Tenggat</Button>
                <Button onClick={event => onAction('ready', exam, event.currentTarget)} disabled={!ready}>Tandai Siap</Button>
              </>
            )}
            <Button variant="destructive" onClick={event => onAction('cancel', exam, event.currentTarget)}>Batalkan Ujian</Button>
          </ActionGroup>
        )}
      </ExamListCard>
    </li>
  );
};

export const InstitutionExamView: React.FC = () => {
  const [overview, setOverview] = useState<InstitutionOverview | null>(null);
  const [loadError, setLoadError] = useState<'forbidden' | 'failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openPeriodId, setOpenPeriodId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InstitutionPeriodDetail | null>(null);
  const [detailError, setDetailError] = useState<'forbidden' | 'failed' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const reloadButton = useRef<HTMLButtonElement | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);

  const restoreFocus = () => {
    // Controlled dialogs have no Radix trigger: return to the opener; when a completed action
    // removes it, to the notice of that action, which survives the refresh (as StudentClaimView).
    const target = [trigger.current, noticeRef.current, reloadButton.current]
      .find(el => el?.isConnected && !(el instanceof HTMLButtonElement && el.disabled));
    target?.focus();
    return target !== undefined;
  };

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await getInstitutionExams());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    }
  }, []);

  const loadDetail = useCallback(async (periodId: string) => {
    try {
      const loaded = await getInstitutionPeriod(periodId);
      setDetail(loaded);
      setDetailError(null);
    } catch (err) {
      setDetailError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const refresh = async (periodId: string | null = openPeriodId) => {
    setRefreshing(true);
    await loadOverview();
    if (periodId) await loadDetail(periodId);
    setRefreshing(false);
  };

  const openPeriod = async (periodId: string) => {
    setOpenPeriodId(periodId);
    setDetail(null);
    setDetailError(null);
    await loadDetail(periodId);
  };

  const open = (next: OpenDialog, opener: HTMLButtonElement | null) => {
    trigger.current = opener;
    setNotice(null);
    setDialog(next);
  };
  const close = () => setDialog(null);
  const done = async (text: string, periodId: string | null = openPeriodId, removesTrigger = false) => {
    // "Tandai Siap" and "Batalkan Ujian" leave their card with the refresh: focus goes to the notice.
    if (removesTrigger) trigger.current = null;
    setDialog(null);
    setNotice(text);
    await refresh(periodId);
  };

  const header = (
    <PageHeader
      title={INSTITUTION_TITLE}
      actions={loadError !== 'forbidden' && (
        <>
          <Button onClick={event => open({ kind: 'period' }, event.currentTarget)} disabled={!overview}>Buat Periode</Button>
          <Button ref={reloadButton} variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? 'Memuat...' : 'Muat Ulang'}
          </Button>
        </>
      )}
    >
      <p className="m-0 text-muted-foreground">
        Susun periode ujian, sesi, dan ujian setiap mata pelajaran per rombel. Guru mata pelajaran menyiapkan soal sebelum tenggat. Isi soal dan kunci jawaban tidak ditampilkan di sini.
      </p>
    </PageHeader>
  );

  const noticeBanner = notice ? (
    <Alert ref={noticeRef} tabIndex={-1} variant="success" role="status" className="outline-none">
      <IconInfo aria-hidden="true" />
      <AlertDescription>{notice}</AlertDescription>
    </Alert>
  ) : null;

  if (!overview) {
    return (
      <Page id="institution-exams" className="min-w-0 [overflow-wrap:anywhere]">
        {header}
        {loadError === null ? (
          <LoadingState>Memuat ujian sekolah...</LoadingState>
        ) : loadError === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">{FORBIDDEN_COPY}</LoadErrorState>
        ) : (
          <LoadErrorState kind="failed" title="Gagal Memuat Ujian Sekolah" onRetry={() => void refresh()} retrying={refreshing}>
            Periksa koneksi internet Anda, lalu coba lagi.
          </LoadErrorState>
        )}
      </Page>
    );
  }

  return (
    <Page id="institution-exams" className="min-w-0 [overflow-wrap:anywhere]">
      {noticeBanner}
      {header}
      {loadError === 'failed' && <StaleDataNotice />}
      {overview.periods.length === 0 ? (
        <EmptyState title="Belum ada periode ujian.">Pilih Buat Periode untuk mulai menyusun ujian sekolah.</EmptyState>
      ) : (
        <ul role="list" className="m-0 flex list-none flex-col gap-4 p-0">
          {overview.periods.map(period => {
            const isOpen = period.periodId === openPeriodId;
            return (
              <li key={period.periodId}>
                <Card data-testid={`institution-period-${period.periodId}`}>
                  <CardHeader>
                    <CardTitle>{period.label}</CardTitle>
                    <CardDescription>{period.assessmentTypeLabel} · {period.academicPeriodLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!isOpen ? (
                      <ActionGroup>
                        <Button variant="secondary" onClick={() => void openPeriod(period.periodId)}>Buka Periode</Button>
                      </ActionGroup>
                    ) : detail === null ? (
                      detailError === null ? (
                        <LoadingState>Memuat sesi...</LoadingState>
                      ) : detailError === 'forbidden' ? (
                        <LoadErrorState kind="refused" title="Akses Ditolak">{FORBIDDEN_COPY}</LoadErrorState>
                      ) : (
                        <LoadErrorState kind="failed" title="Gagal Memuat Sesi" onRetry={() => void loadDetail(period.periodId)}>
                          Periksa koneksi internet Anda, lalu coba lagi.
                        </LoadErrorState>
                      )
                    ) : (
                      <>
                        {detail.sessions.length === 0 && <p className="m-0 text-sm text-muted-foreground">Belum ada sesi di periode ini.</p>}
                        {detail.sessions.map(session => (
                          <section key={session.sessionId} aria-labelledby={`session-${session.sessionId}`} className="flex min-w-0 flex-col gap-3 border-t border-border pt-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <h3 id={`session-${session.sessionId}`} className="m-0 text-base font-semibold">
                                Jadwal Sesi: {formatWindow(session.startsAt, session.endsAt)}
                              </h3>
                              <Button variant="secondary" onClick={event => open({ kind: 'placement', session }, event.currentTarget)}>Tempatkan Ujian</Button>
                            </div>
                            {session.exams.length === 0 ? (
                              <p className="m-0 text-sm text-muted-foreground">Belum ada ujian di sesi ini.</p>
                            ) : (
                              <ExamList>
                                {session.exams.map(exam => (
                                  <ExamItem key={exam.examInstanceId} exam={exam} onAction={(kind, item, opener) => open({ kind, exam: item }, opener)} />
                                ))}
                              </ExamList>
                            )}
                          </section>
                        ))}
                        <ActionGroup className="border-t border-border pt-4">
                          <Button onClick={event => open({ kind: 'session', periodId: period.periodId }, event.currentTarget)}>Tambah Sesi</Button>
                        </ActionGroup>
                      </>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <PeriodDialog
        open={dialog?.kind === 'period'}
        onClose={close}
        restoreFocus={restoreFocus}
        overview={overview}
        onSaved={periodId => {
          setOpenPeriodId(periodId);
          setDetail(null);
          void done('Periode ujian tersimpan.', periodId);
        }}
      />
      <SessionDialog
        open={dialog?.kind === 'session'}
        onClose={close}
        restoreFocus={restoreFocus}
        periodId={dialog?.kind === 'session' ? dialog.periodId : null}
        onSaved={() => void done('Sesi tersimpan.')}
      />
      <PlacementDialog
        open={dialog?.kind === 'placement'}
        onClose={close}
        restoreFocus={restoreFocus}
        overview={overview}
        session={dialog?.kind === 'placement' ? dialog.session : null}
        onSaved={text => void done(text)}
      />
      <DeadlineDialog
        open={dialog?.kind === 'deadline'}
        onClose={close}
        restoreFocus={restoreFocus}
        exam={dialog?.kind === 'deadline' ? dialog.exam : null}
        onSaved={text => void done(text)}
      />
      <CancelDialog
        open={dialog?.kind === 'cancel'}
        onClose={close}
        restoreFocus={restoreFocus}
        exam={dialog?.kind === 'cancel' ? dialog.exam : null}
        onSaved={text => void done(text, openPeriodId, true)}
      />
      <ReadyDialog
        open={dialog?.kind === 'ready'}
        onClose={close}
        restoreFocus={restoreFocus}
        exam={dialog?.kind === 'ready' ? dialog.exam : null}
        onSaved={text => void done(text, openPeriodId, true)}
      />
    </Page>
  );
};
