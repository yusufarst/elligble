import React, { useEffect, useRef, useState } from 'react';
import { ApiError, postTeacherExamReschedule } from '../api/assessment-client.ts';
import type { LatestStartPolicy, RescheduleProblemCode, TeacherExamReadinessProjection } from '../types/assessment.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatSheetDateTime, formatWindow, zoneLabel } from '../lib/format.ts';
import { LATEST_START_OPTIONS } from '../lib/question-import.ts';
import { newActionKey } from '../lib/action-key.ts';

// The teacher moves a scheduled or ready exam before it opens (ASSESS-TEACHER-003, D04.2-45
// LOCKED): the window, the duration and the late-start rule, in school time. Participants and
// questions stay as they are. The server checks the new schedule as "Tandai Siap" does and
// refuses it with the reasons; a ready exam becomes scheduled again (D04.2-25). Students and
// proctors see that the schedule changed. One action key per dialog: trying again after a
// lost connection never changes the schedule twice.

const MAX_DURATION_MINUTES = 24 * 60;

/** The instant as the school's wall clock, as a datetime-local field shows it. */
function localValue(iso: string | null | undefined): string {
  return iso ? formatSheetDateTime(iso).replace(' ', 'T') : '';
}

export function describeRescheduleProblem(code: RescheduleProblemCode): string {
  switch (code) {
    case 'time_zone_missing': return 'Zona waktu sekolah belum diatur, sehingga jadwal belum dapat ditentukan. Hubungi operator sekolah.';
    case 'window_invalid': return 'Tanggal atau jam pelaksanaan tidak valid.';
    case 'window_order': return 'Waktu selesai harus setelah waktu mulai.';
    case 'window_ended': return 'Waktu selesai sudah lewat. Pilih waktu yang akan datang.';
    case 'duration_invalid': return `Durasi pengerjaan harus bilangan bulat dari 1 sampai ${MAX_DURATION_MINUTES} menit.`;
    case 'duration_exceeds_window': return 'Durasi pengerjaan lebih panjang dari waktu pelaksanaan, sehingga dengan aturan "Tidak boleh terlambat" tidak ada peserta yang dapat memulai. Pendekkan durasi, perpanjang waktu pelaksanaan, atau pilih aturan lain.';
    case 'schedule_conflict': return 'Ada peserta yang sudah dijadwalkan pada ujian lain yang waktunya bertabrakan. Pilih waktu lain.';
    case 'proctor_schedule_conflict': return 'Pengawas ujian ini sudah bertugas pada ujian lain yang waktunya bertabrakan. Pilih waktu lain.';
  }
}

/** A refusal that ends this attempt at rescheduling, or null when trying again may work. */
function finalRefusal(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  switch (err.code) {
    case 'invalid_state': return 'Ujian sudah dibuka, sehingga jadwalnya tidak dapat diubah lagi.';
    case 'forbidden': return 'Hanya guru yang mengelola ujian ini yang dapat mengubah jadwalnya.';
    case 'action_key_reused': return 'Permintaan tadi mungkin sudah tersimpan. Periksa jadwal ujian sebelum mencoba lagi.';
  }
  return null;
}

export const RescheduleDialog: React.FC<{
  exam: TeacherExamReadinessProjection | null;
  onClose(): void;
  /** The attempt ended with an outcome to show above the list; the list is read again. */
  onDone(notice: { failed: boolean; text: string }): void;
}> = ({ exam, onClose, onDone }) => {
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [duration, setDuration] = useState('');
  const [policy, setPolicy] = useState<LatestStartPolicy>('FULL_DURATION_BEYOND_WINDOW');
  const [problems, setProblems] = useState<RescheduleProblemCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const actionKey = useRef<string | null>(null);
  const open = exam !== null;

  // Every opening starts from the exam's current schedule, with a new action key.
  useEffect(() => {
    if (!exam) return;
    setStartsAt(localValue(exam.windowStartsAt));
    setEndsAt(localValue(exam.windowEndsAt));
    setDuration(exam.durationMinutes ? String(exam.durationMinutes) : '');
    setPolicy(exam.latestStartPolicy ?? 'FULL_DURATION_BEYOND_WINDOW');
    setProblems([]);
    setError(null);
    actionKey.current = newActionKey();
  }, [exam?.examInstanceId, open]);

  if (!exam) return null;

  const zone = zoneLabel();
  const minutes = /^\d{1,4}$/.test(duration.trim()) ? Number(duration.trim()) : NaN;
  const ready = startsAt !== '' && endsAt !== '' && Number.isInteger(minutes);
  const subject = exam.subjectLabel ?? 'Ujian';
  const wasReady = exam.lifecycleState === 'READY';

  const save = async () => {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    setProblems([]);
    try {
      const result = await postTeacherExamReschedule({
        examInstanceId: exam.examInstanceId, windowStartsAt: startsAt, windowEndsAt: endsAt, durationMinutes: minutes, latestStartPolicy: policy,
        actionKey: actionKey.current ?? newActionKey(),
      });
      const window = formatWindow(result.schedule.windowStartsAt, result.schedule.windowEndsAt);
      onDone({
        failed: false,
        text: !result.changed ? `Jadwal ${subject} tidak berubah.`
          : result.replayed ? `Jadwal ${subject} sudah diubah sebelumnya menjadi ${window}.`
          : `Jadwal ${subject} diubah menjadi ${window}, durasi ${result.schedule.durationMinutes} menit.${wasReady ? ' Ujian kembali terjadwal; tandai siap lagi sebelum dibuka.' : ''}`,
      });
    } catch (err) {
      const refusal = finalRefusal(err);
      if (refusal) {
        onDone({ failed: true, text: refusal });
      } else if (err instanceof ApiError && err.code === 'reschedule_invalid' && Array.isArray(err.data?.problems)) {
        setProblems((err.data.problems as Array<{ code: RescheduleProblemCode }>).map(p => p.code));
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Periksa kembali tanggal, jam, dan durasi.');
      } else {
        // The same key goes with the next try: if this one arrived, nothing changes twice.
        setError('Gagal menyimpan jadwal. Periksa koneksi internet Anda, lalu coba lagi.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !sending) onClose(); }}>
      <DialogContent aria-describedby="reschedule-description" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ubah Jadwal Ujian</DialogTitle>
          <DialogDescription id="reschedule-description">
            Jadwal baru langsung terlihat oleh siswa dan pengawas, dengan tanda bahwa jadwal diubah. Peserta dan soal tidak berubah.
            {wasReady ? ' Ujian ini sudah ditandai siap; setelah jadwal diubah, ujian kembali terjadwal dan perlu ditandai siap lagi.' : ''}
          </DialogDescription>
        </DialogHeader>
        <p className="m-0 font-medium">{[subject, exam.groupLabel, exam.assessmentTypeLabel].filter(Boolean).join(' · ')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reschedule-starts" className="text-sm font-medium">Mulai{zone ? ` (${zone})` : ''}</label>
            <Input id="reschedule-starts" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reschedule-ends" className="text-sm font-medium">Selesai{zone ? ` (${zone})` : ''}</label>
            <Input id="reschedule-ends" type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={e => setEndsAt(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:max-w-[240px]">
          <label htmlFor="reschedule-duration" className="text-sm font-medium">Durasi pengerjaan (menit)</label>
          <Input
            id="reschedule-duration"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DURATION_MINUTES}
            step={1}
            value={duration}
            onChange={e => setDuration(e.target.value)}
          />
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-sm font-medium">Peserta yang mulai terlambat</legend>
          {LATEST_START_OPTIONS.map(option => (
            <label key={option.value} className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 text-sm has-[:checked]:border-foreground">
              <input
                type="radio"
                name="reschedule-latest-start"
                value={option.value}
                checked={policy === option.value}
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

        {problems.length > 0 && (
          <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink">
            <p className="m-0 font-medium">Jadwal belum dapat disimpan:</p>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
              {problems.map(code => <li key={code}>{describeRescheduleProblem(code)}</li>)}
            </ul>
          </div>
        )}
        {error && <p role="alert" className="m-0 text-sm text-danger-ink">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={sending}>Batal</Button>
          <Button onClick={save} disabled={!ready || sending}>{sending ? 'Menyimpan...' : 'Simpan Jadwal'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
