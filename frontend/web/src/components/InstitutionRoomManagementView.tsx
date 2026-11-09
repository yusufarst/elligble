import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError, getInstitutionRooms, postInstitutionParticipants, postInstitutionRoomParticipants, postInstitutionRoomProctors,
} from '../api/assessment-client.ts';
import type {
  InstitutionRoom, InstitutionRoomExam, InstitutionRoomProblem, InstitutionRoomProblemCode, InstitutionRoomView,
} from '../types/assessment.ts';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { ActionGroup } from '@/components/ui/action-group';
import { Metric, MetricList } from '@/components/ui/metric';
import { EmptyState, LoadErrorState, LoadingState, StaleDataNotice } from '@/components/ui/page-state';
import { IconChevronLeft, IconInfo } from '@/components/icons';
import { ExamFacts, ExamList, ExamListCard } from './ExamListCard.tsx';
import { ParticipantChoiceList, type ParticipantChoice } from './ParticipantChoiceList.tsx';
import { permissionDialogClass } from './ActionReasonField.tsx';
import { institutionFailureMessages } from './InstitutionExamView.tsx';
import { useActionKey, useRetryFocus } from '../hooks/useDialogAction.ts';
import { examLifecycleStatus, roomProctorBlockerText } from '../lib/status.ts';
import { formatWindow } from '../lib/format.ts';

// "Ruang dan Pengawas" (ASSESS-INSTITUTION-002 §4.6; Owner OB-2, RP-1..RP-5, OB-3): for one session of an
// institution exam period, the School Operator puts every participant into one physical room, sets the
// Proctors of each room by typing their ELLIGBLE ID, and adds students of the rombel enrolled after
// placement. Only ELLIGBLE IDs and rombel are shown: never a name, a question, a key or a score, and there is
// no list of school members. Each dialog is the on-screen confirmation of its change (RP-5); a change to an
// exam already marked ready re-checks it (RP-3).

export const ROOMS_TITLE = 'Ruang dan Pengawas';

const READY_NOTICE = 'Ujian yang sudah ditandai siap akan diperiksa ulang. Bila belum lengkap, ujian kembali ke Terjadwal dan perlu ditandai siap lagi.';
const FORBIDDEN_COPY = 'Anda tidak berwenang mengatur ujian sekolah ini.';
const STALE_COPY = 'Penempatan ruang baru saja diubah. Muat ulang untuk melihat penempatan terbaru.';
const NO_ROW = 'Tidak ada peserta untuk ditampilkan.';

const count = (value: number) => new Intl.NumberFormat('id-ID').format(value);

const PROBLEM_COPY: Record<Exclude<InstitutionRoomProblemCode, 'proctor_unknown' | 'proctor_ineligible' | 'proctor_other_room'>, string> = {
  room_label_invalid: 'Nama ruang wajib diisi, paling banyak 60 karakter.',
  room_conflict: 'Ruang ini sudah dipakai sesi lain pada waktu yang sama.',
  room_unknown: 'Ruang ini belum berisi peserta. Muat ulang halaman.',
  already_in_room: 'Peserta yang dipilih sudah berada di ruang ini.',
  participant_unknown: 'Data pilihan sudah berubah. Muat ulang halaman, lalu pilih lagi.',
  proctor_schedule_conflict: 'pengawas sudah bertugas di ujian lain pada waktu yang sama.',
  not_enrolled: 'siswa tidak terdaftar di rombel ini pada tanggal sesi.',
  already_participant: 'siswa sudah menjadi peserta ujian ini.',
  schedule_conflict: 'siswa sudah dijadwalkan di ujian lain pada waktu yang sama.',
};

/** The words of one refusal of a room check. */
export function roomProblemText(problem: InstitutionRoomProblem): string {
  const ids = problem.elligbleIds ?? [];
  switch (problem.code) {
    case 'proctor_unknown':
      return ids.length > 1
        ? `${count(ids.length)} ELLIGBLE ID tidak ditemukan di sekolah ini: ${ids.join(', ')}.`
        : `ELLIGBLE ID ini tidak ditemukan di sekolah ini: ${ids[0] ?? ''}.`;
    case 'proctor_ineligible':
      return `Pengawas harus anggota sekolah yang bukan siswa dan bukan peserta ujian pada waktu yang sama: ${ids.join(', ')}.`;
    case 'proctor_other_room':
      return `Pengawas ini sudah bertugas di ruang lain pada sesi ini: ${ids.join(', ')}.`;
    case 'already_participant':
      // A racing unique key answers without a count.
      if (problem.count === undefined) return 'Siswa yang dipilih sudah menjadi peserta ujian ini.';
      return `${count(problem.count)} ${PROBLEM_COPY.already_participant}`;
    case 'proctor_schedule_conflict':
    case 'not_enrolled':
    case 'schedule_conflict':
      return `${count(problem.count ?? ids.length)} ${PROBLEM_COPY[problem.code]}`;
    default:
      return PROBLEM_COPY[problem.code] ?? PROBLEM_COPY.participant_unknown;
  }
}

/** What a failed room write tells the Operator: one line per distinct problem. */
export function roomFailureMessages(err: unknown): string[] {
  if (err instanceof ApiError) {
    if (err.status === 422 && Array.isArray(err.data?.problems)) {
      return [...new Set((err.data.problems as InstitutionRoomProblem[]).map(roomProblemText))];
    }
    switch (err.code) {
      case 'stale_assignment': return [STALE_COPY];
      case 'invalid_state': return ['Status ujian sudah berubah. Muat ulang halaman.'];
    }
  }
  // invalid_request, action_key_reused, state_changed, forbidden, a lost connection or 503: the frozen copy.
  return institutionFailureMessages(err);
}

function examLabel(exam: Pick<InstitutionRoomExam, 'subjectLabel' | 'groupLabel'>): string {
  return [exam.subjectLabel, exam.groupLabel].filter(Boolean).join(' · ') || 'Ujian';
}

/** A label as the server records it (whitespace collapsed, trimmed), for the notices. */
const tidyLabel = (value: string) => value.replace(/\s+/g, ' ').trim();

const FailureList: React.FC<{ messages: string[] }> = ({ messages }) => messages.length === 0 ? null : (
  <div role="alert" className="flex flex-col gap-1 text-sm text-danger-ink">
    {messages.map(message => <p key={message} className="m-0">{message}</p>)}
  </div>
);

const ReadyNotice: React.FC<{ show: boolean }> = ({ show }) => !show ? null : (
  <Alert variant="info" role="note">
    <IconInfo aria-hidden="true" />
    <AlertDescription>{READY_NOTICE}</AlertDescription>
  </Alert>
);

const Field: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
  </div>
);

interface DialogProps {
  open: boolean;
  onClose(): void;
  /** Return focus to the action that opened the dialog, or to the notice; true when it could. */
  restoreFocus(): boolean;
}

interface Done { lines: string[] }

/** The participants of the editable exams, one group per exam, for choosing who goes into a room. */
interface PickerGroup { examInstanceId: string; title: string; groupLabel: string; participants: ParticipantChoice[] }

function pickerGroups(view: InstitutionRoomView, include: (p: InstitutionRoomExam['participants'][number]) => boolean): PickerGroup[] {
  return view.exams.filter(e => e.editable).map(exam => ({
    examInstanceId: exam.examInstanceId,
    title: examLabel(exam),
    groupLabel: exam.groupLabel ?? exam.subjectLabel ?? 'Ujian',
    participants: exam.participants.filter(include).map(p => ({
      id: p.participantId, elligbleId: p.elligbleId ?? '-', conflict: false,
      note: p.roomLabel ? `Ruang ${p.roomLabel}` : 'Belum punya ruang',
    })),
  })).filter(g => g.participants.length > 0);
}

/** The groups with "Pilih semua <rombel>" and one tickable row per participant (ParticipantChoiceList). */
const ParticipantPicker: React.FC<{ groups: PickerGroup[]; chosen: Set<string>; onChange(next: Set<string>): void; idPrefix: string }> = ({
  groups, chosen, onChange, idPrefix,
}) => {
  if (groups.length === 0) return <p className="m-0 text-sm text-muted-foreground">{NO_ROW}</p>;
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {groups.map(group => (
        <section key={group.examInstanceId} aria-labelledby={`${idPrefix}-${group.examInstanceId}`} className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 id={`${idPrefix}-${group.examInstanceId}`} className="m-0 text-sm font-semibold">{group.title}</h3>
            <Button
              variant="secondary"
              size="sm"
              className="h-auto min-h-11"
              onClick={() => onChange(new Set([...chosen, ...group.participants.map(p => p.id!)]))}
            >
              Pilih semua {group.groupLabel}
            </Button>
          </div>
          <ParticipantChoiceList participants={group.participants} isChosen={id => chosen.has(id)} onToggle={toggle} label={group.title} />
        </section>
      ))}
    </div>
  );
};

type ShowFilter = 'unplaced' | 'all';

const ShowField: React.FC<{ id: string; value: ShowFilter; onChange(value: ShowFilter): void; disabled: boolean }> = ({ id, value, onChange, disabled }) => (
  <Field id={id} label="Tampilkan">
    <NativeSelect id={id} value={value} disabled={disabled} onChange={e => onChange(e.target.value as ShowFilter)}>
      <option value="unplaced">Belum punya ruang</option>
      <option value="all">Semua peserta</option>
    </NativeSelect>
  </Field>
);

function readyAmong(view: InstitutionRoomView, examIds: Iterable<string>): boolean {
  const ids = new Set(examIds);
  return view.exams.some(e => ids.has(e.examInstanceId) && e.lifecycleState === 'READY');
}

function examsOfParticipants(view: InstitutionRoomView, participantIds: Set<string>): string[] {
  return view.exams.filter(e => e.participants.some(p => participantIds.has(p.participantId))).map(e => e.examInstanceId);
}

function demotionLines(view: InstitutionRoomView, demoted: string[]): string[] {
  return demoted.map(id => {
    const exam = view.exams.find(e => e.examInstanceId === id);
    return `Ujian ${exam ? examLabel(exam) : 'ini'} kembali ke Terjadwal dan perlu ditandai siap lagi.`;
  });
}

/** "Tambah Ruang" and "Tempatkan Peserta di <ruang>": one room, the chosen participants (rooms/participants). */
const PlacementDialog: React.FC<DialogProps & { view: InstitutionRoomView; room: InstitutionRoom | null; onSaved(done: Done): void }> = ({
  open, onClose, restoreFocus, view, room, onSaved,
}) => {
  const [label, setLabel] = useState('');
  const [show, setShow] = useState<ShowFilter>('unplaced');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  useEffect(() => {
    if (open) { setLabel(''); setShow('unplaced'); setChosen(new Set()); setErrors([]); }
  }, [open]);
  const roomKey = room ? room.label.toLowerCase() : null;
  const groups = useMemo(() => pickerGroups(view, p => (show === 'all' || p.roomLabel === null) && (roomKey === null || (p.roomLabel ?? '').toLowerCase() !== roomKey)),
    [view, show, roomKey]);
  const visible = new Set(groups.flatMap(g => g.participants.map(p => p.id!)));
  const selected = [...chosen].filter(id => visible.has(id));
  const targetLabel = room ? room.label : label;
  const submit = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const result = await postInstitutionRoomParticipants({
        sessionId: view.session.sessionId, roomLabel: targetLabel, participantIds: selected, expectedRevision: view.revision, actionKey: key.current,
      });
      onSaved({ lines: [`Peserta ditempatkan di ${tidyLabel(targetLabel)}: ${count(result.moved)} peserta.`, ...demotionLines(view, result.demoted)] });
    } catch (err) {
      setErrors(roomFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  const title = room ? `Tempatkan Peserta di ${room.label}` : 'Tambah Ruang';
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && (
        <DialogContent className={permissionDialogClass} aria-describedby={undefined}
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {!room && (
            <Field id="room-label" label="Nama ruang">
              <Input id="room-label" value={label} maxLength={120} disabled={saving} onChange={e => setLabel(e.target.value)} />
            </Field>
          )}
          <ShowField id="room-show" value={show} onChange={setShow} disabled={saving} />
          <ParticipantPicker groups={groups} chosen={chosen} onChange={setChosen} idPrefix="room-group" />
          <ReadyNotice show={readyAmong(view, examsOfParticipants(view, new Set(selected)))} />
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} onClick={submit} disabled={saving || selected.length === 0 || !targetLabel.trim()}>
              {saving ? 'Menyimpan...' : room ? 'Tempatkan Peserta' : 'Simpan Ruang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

/** "Atur Pengawas <ruang>": the full Proctor set of one room, typed by ELLIGBLE ID (rooms/proctors). */
const ProctorDialog: React.FC<DialogProps & { view: InstitutionRoomView; room: InstitutionRoom | null; onSaved(done: Done): void }> = ({
  open, onClose, restoreFocus, view, room, onSaved,
}) => {
  const [proctors, setProctors] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  const field = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) { setProctors(room ? room.proctors.map(p => p.elligbleId) : []); setTyped(''); setErrors([]); }
  }, [open, room]);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const add = () => {
    const value = typed.trim();
    if (!value) return;
    if (!proctors.some(p => same(p, value))) setProctors([...proctors, value]);
    setTyped('');
    field.current?.focus();
  };
  const remove = (id: string) => {
    setProctors(proctors.filter(p => p !== id));
    // The row and its "Hapus" leave: focus goes to the field, never to the page body.
    field.current?.focus();
  };
  const submit = async () => {
    if (!room) return;
    setSaving(true);
    setErrors([]);
    try {
      const result = await postInstitutionRoomProctors({
        sessionId: view.session.sessionId, roomLabel: room.label, proctorElligbleIds: proctors, expectedRevision: view.revision, actionKey: key.current,
      });
      onSaved({ lines: [`Pengawas ${room.label} tersimpan.`, ...demotionLines(view, result.demoted)] });
    } catch (err) {
      setErrors(roomFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && room && (
        <DialogContent className={permissionDialogClass} aria-describedby="proctor-dialog-description"
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Atur Pengawas {room.label}</DialogTitle>
            <DialogDescription id="proctor-dialog-description">
              Pengawas hanya melihat peserta di ruang ini. Satu pengawas bertugas di satu ruang pada sesi ini.
            </DialogDescription>
          </DialogHeader>
          {proctors.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={`Pengawas ${room.label}`}>
              {proctors.map(id => (
                <li key={id} className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-3 py-1">
                  <span className="min-w-0 font-mono text-[13px] [overflow-wrap:anywhere]">{id}</span>
                  <Button variant="secondary" size="sm" className="h-auto min-h-11" aria-label={`Hapus ${id}`} disabled={saving} onClick={() => remove(id)}>Hapus</Button>
                </li>
              ))}
            </ul>
          )}
          <Field id="proctor-id" label="ELLIGBLE ID pengawas">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Input
                id="proctor-id"
                ref={field}
                value={typed}
                maxLength={64}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={saving}
                className="font-mono sm:flex-1"
                onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              />
              <Button variant="secondary" onClick={add} disabled={saving || !typed.trim() || proctors.length >= 20}>Tambahkan</Button>
            </div>
          </Field>
          <ReadyNotice show={readyAmong(view, room.groups.map(g => g.examInstanceId))} />
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} onClick={submit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Pengawas'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

/** "Tambah Peserta <mapel> · <rombel>": students of the rombel enrolled after placement (participants). */
const AdditionDialog: React.FC<DialogProps & { view: InstitutionRoomView; exam: InstitutionRoomExam | null; onSaved(done: Done): void }> = ({
  open, onClose, restoreFocus, view, exam, onSaved,
}) => {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [roomLabel, setRoomLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const retry = useRetryFocus(open, errors, saving);
  const key = useActionKey(open);
  useEffect(() => {
    if (open) { setChosen(new Set()); setRoomLabel(view.rooms.length === 1 ? view.rooms[0].label : ''); setErrors([]); }
  }, [open, view]);
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChosen(next);
  };
  const submit = async () => {
    if (!exam) return;
    setSaving(true);
    setErrors([]);
    try {
      const result = await postInstitutionParticipants({
        examInstanceId: exam.examInstanceId, enrollmentIds: [...chosen], roomLabel, expectedRevision: view.revision, actionKey: key.current,
      });
      onSaved({ lines: [`Peserta ditambahkan: ${count(result.added.length)} siswa.`, ...demotionLines(view, result.demoted)] });
    } catch (err) {
      setErrors(roomFailureMessages(err));
    } finally {
      setSaving(false);
    }
  };
  const title = exam ? `Tambah Peserta ${examLabel(exam)}` : '';
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      {open && exam && (
        <DialogContent className={permissionDialogClass} aria-describedby={undefined}
          onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {exam.candidates.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">Semua siswa yang terdaftar di rombel ini pada tanggal sesi sudah menjadi peserta.</p>
          ) : (
            <ParticipantChoiceList participants={exam.candidates} isChosen={id => chosen.has(id)} onToggle={toggle} conflictsDisabled label={title} />
          )}
          {view.rooms.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">Tambahkan ruang lebih dulu.</p>
          ) : (
            <Field id="addition-room" label="Ruang">
              <NativeSelect id="addition-room" value={roomLabel} disabled={saving} required onChange={e => setRoomLabel(e.target.value)}>
                <option value="">Pilih ruang</option>
                {view.rooms.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
              </NativeSelect>
            </Field>
          )}
          <ReadyNotice show={exam.lifecycleState === 'READY'} />
          <FailureList messages={errors} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
            <Button ref={retry} onClick={submit} disabled={saving || chosen.size === 0 || !roomLabel}>{saving ? 'Menyimpan...' : 'Tambah Peserta'}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

type OpenDialog =
  | { kind: 'room' }
  | { kind: 'place'; room: InstitutionRoom }
  | { kind: 'proctors'; room: InstitutionRoom }
  | { kind: 'addition'; exam: InstitutionRoomExam }
  | null;

const RoomCard: React.FC<{ room: InstitutionRoom; editable: boolean; onAction(kind: 'place' | 'proctors', room: InstitutionRoom, trigger: HTMLButtonElement): void }> = ({
  room, editable, onAction,
}) => (
  <li className="min-w-0">
    <Card data-testid={`institution-room-${room.label}`} className="min-w-0 gap-4">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <CardTitle level="h3" className="text-lg break-words">{room.label}</CardTitle>
        {room.proctors.length === 0 && <StatusBadge tone="warning" className="max-w-full whitespace-normal">Belum ada pengawas</StatusBadge>}
      </CardHeader>
      <CardContent>
        <ExamFacts>
          <p>{count(room.participantCount)} peserta</p>
          {room.groups.map(group => (
            <p key={group.examInstanceId}>{examLabel(group)}: {count(group.count)} peserta</p>
          ))}
          {room.proctors.length > 0 && (
            <p>Pengawas: <span className="font-mono [overflow-wrap:anywhere]">{room.proctors.map(p => p.elligbleId).join(', ')}</span></p>
          )}
        </ExamFacts>
        {editable && (
          <ActionGroup>
            <Button variant="secondary" className="h-auto min-h-11 whitespace-normal py-2" onClick={event => onAction('place', room, event.currentTarget)}>Tempatkan Peserta</Button>
            <Button variant="secondary" className="h-auto min-h-11 whitespace-normal py-2" onClick={event => onAction('proctors', room, event.currentTarget)}>Atur Pengawas</Button>
          </ActionGroup>
        )}
      </CardContent>
    </Card>
  </li>
);

const ExamItem: React.FC<{ exam: InstitutionRoomExam; onAdd(exam: InstitutionRoomExam, trigger: HTMLButtonElement): void }> = ({ exam, onAdd }) => {
  const lifecycle = examLifecycleStatus(exam.lifecycleState);
  const unplaced = exam.participants.filter(p => p.roomLabel === null).length;
  const readiness = exam.roomReadiness;
  const message = !exam.editable ? null
    : readiness?.status === 'not_ready' ? `${roomProctorBlockerText(readiness.blocker)}.`
    : readiness?.status === 'room_proctor_readiness_ready' ? 'Ruang dan pengawas lengkap.'
    : null;
  return (
    <li>
      <ExamListCard
        headingLevel="h3"
        data-testid={`institution-room-exam-${exam.examInstanceId}`}
        title={exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}
        status={<StatusBadge tone={lifecycle.tone}>{lifecycle.label}</StatusBadge>}
      >
        <ExamFacts>
          <p>{exam.groupLabel ?? '-'} · {count(exam.participants.length)} peserta · {count(unplaced)} belum punya ruang</p>
        </ExamFacts>
        {message && (
          <p className={`m-0 text-sm ${readiness?.status === 'not_ready' ? 'text-warning-ink' : 'text-success-ink'}`}>{message}</p>
        )}
        {!exam.editable && (
          <p className="m-0 text-sm text-muted-foreground">Ujian ini sudah dibuka, jadi ruang dan pengawasnya tidak dapat diubah di sini.</p>
        )}
        {exam.editable && (
          <ActionGroup>
            <Button variant="secondary" onClick={event => onAdd(exam, event.currentTarget)}>Tambah Peserta</Button>
          </ActionGroup>
        )}
      </ExamListCard>
    </li>
  );
};

export const InstitutionRoomManagementView: React.FC<{
  session: { sessionId: string; startsAt: string; endsAt: string };
  onBack(): void;
}> = ({ session, onBack }) => {
  const [view, setView] = useState<InstitutionRoomView | null>(null);
  const [loadError, setLoadError] = useState<'forbidden' | 'failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const reloadButton = useRef<HTMLButtonElement | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const page = useRef<HTMLElement | null>(null);

  // On entry, focus moves to the screen title, which stays in every state.
  useEffect(() => {
    const title = page.current?.querySelector<HTMLHeadingElement>('h1');
    if (!title) return;
    title.tabIndex = -1;
    title.classList.add('outline-none');
    title.focus();
  }, []);

  const load = useCallback(async () => {
    try {
      setView(await getInstitutionRooms(session.sessionId));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    }
  }, [session.sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const restoreFocus = () => {
    // Controlled dialogs have no Radix trigger: return to the opener; after a completed change, to its
    // notice, because the refresh may remove the opener (as InstitutionExamView).
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
  const close = () => setDialog(null);
  const done = async ({ lines }: Done) => {
    trigger.current = null;
    setDialog(null);
    setNotice(lines);
    await refresh();
  };

  const back = (
    <Button variant="ghost" size="sm" className="-ml-3 h-auto min-h-11 max-w-full self-start whitespace-normal py-2 text-left" onClick={onBack}>
      <IconChevronLeft aria-hidden="true" />
      Kembali ke Ujian Sekolah
    </Button>
  );
  const header = (
    <PageHeader
      title={ROOMS_TITLE}
      actions={loadError !== 'forbidden' && (
        <Button ref={reloadButton} variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Memuat...' : 'Muat Ulang'}
        </Button>
      )}
    >
      <p className="m-0 text-muted-foreground">
        Jadwal Sesi: {formatWindow(session.startsAt, session.endsAt)}. Tempatkan setiap peserta di satu ruang dan tetapkan pengawas untuk setiap ruang sebelum ujian dibuka.
      </p>
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

  if (!view) {
    return (
      <Page id="institution-rooms" ref={page} className="min-w-0">
        {noticeBanner}
        {back}
        {header}
        {loadError === null ? (
          <LoadingState>Memuat ruang dan pengawas...</LoadingState>
        ) : loadError === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">{FORBIDDEN_COPY}</LoadErrorState>
        ) : (
          <LoadErrorState kind="failed" title="Gagal Memuat Ruang dan Pengawas" onRetry={() => void refresh()} retrying={refreshing}>
            Periksa koneksi internet Anda, lalu coba lagi.
          </LoadErrorState>
        )}
      </Page>
    );
  }

  const participants = view.exams.reduce((n, e) => n + e.participants.length, 0);
  const unplaced = view.exams.reduce((n, e) => n + e.participants.filter(p => p.roomLabel === null).length, 0);
  const uncovered = view.rooms.filter(r => r.proctors.length === 0).length;
  const anyEditable = view.exams.some(e => e.editable);
  const editableExams = new Set(view.exams.filter(e => e.editable).map(e => e.examInstanceId));

  return (
    <Page id="institution-rooms" ref={page} className="min-w-0">
      {noticeBanner}
      {back}
      {header}
      {loadError === 'failed' && <StaleDataNotice />}
      <MetricList aria-label="Ringkasan ruang" layout="narrowFirst">
        <Metric className="min-w-0" label="Peserta" value={count(participants)} />
        <Metric className="min-w-0" label="Belum punya ruang" value={count(unplaced)} />
        <Metric className="min-w-0" label="Ruang" value={count(view.rooms.length)} />
        <Metric className="min-w-0" label="Ruang tanpa pengawas" value={count(uncovered)} />
      </MetricList>

      <section aria-labelledby="rooms-title" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="rooms-title" className="m-0 text-xl font-semibold">Daftar Ruang</h2>
          {anyEditable && <Button onClick={event => open({ kind: 'room' }, event.currentTarget)}>Tambah Ruang</Button>}
        </div>
        {view.rooms.length === 0 ? (
          <EmptyState title="Belum ada ruang.">Belum ada ruang di sesi ini. Tambahkan ruang, lalu tempatkan peserta.</EmptyState>
        ) : (
          <ul role="list" className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
            {view.rooms.map(room => (
              <RoomCard key={room.label} room={room} editable={room.groups.some(g => editableExams.has(g.examInstanceId))}
                onAction={(kind, item, opener) => open({ kind, room: item }, opener)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="room-exams-title" className="flex min-w-0 flex-col gap-3">
        <h2 id="room-exams-title" className="m-0 text-xl font-semibold">Peserta per Ujian</h2>
        <ExamList>
          {view.exams.map(exam => (
            <ExamItem key={exam.examInstanceId} exam={exam} onAdd={(item, opener) => open({ kind: 'addition', exam: item }, opener)} />
          ))}
        </ExamList>
      </section>

      <PlacementDialog
        open={dialog?.kind === 'room' || dialog?.kind === 'place'}
        onClose={close}
        restoreFocus={restoreFocus}
        view={view}
        room={dialog?.kind === 'place' ? dialog.room : null}
        onSaved={result => void done(result)}
      />
      <ProctorDialog
        open={dialog?.kind === 'proctors'}
        onClose={close}
        restoreFocus={restoreFocus}
        view={view}
        room={dialog?.kind === 'proctors' ? dialog.room : null}
        onSaved={result => void done(result)}
      />
      <AdditionDialog
        open={dialog?.kind === 'addition'}
        onClose={close}
        restoreFocus={restoreFocus}
        view={view}
        exam={dialog?.kind === 'addition' ? dialog.exam : null}
        onSaved={result => void done(result)}
      />
    </Page>
  );
};
