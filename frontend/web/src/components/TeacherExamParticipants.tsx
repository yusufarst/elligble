import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getTeacherExamParticipantCandidates, postTeacherExamAddParticipants } from '../api/assessment-client.ts';
import type {
  ParticipantAdditionProblemCode, TeacherExamParticipantCandidates, TeacherExamReadinessProjection,
} from '../types/assessment.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadErrorState, LoadingState } from '@/components/ui/page-state';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IconInfo } from '@/components/icons';
import { formatWindow } from '../lib/format.ts';
import { newActionKey } from '../lib/action-key.ts';
import { ParticipantChoiceList } from './ParticipantChoiceList.tsx';

// The teacher adds students of the exam's class to a scheduled or ready exam before it opens
// (ASSESS-TEACHER-004, D04.2-64 LOCKED). The list offers the class on the exam day without
// the students already taking part; a student expected in another exam at the same time
// cannot be chosen. A ready exam is scheduled again and must be marked ready anew, and the
// dialog says so before anything is added. Participants are never removed here (OPEN-05),
// which the dialog says as well. One action key per dialog: trying again after a lost
// connection never adds twice.

type Problem = { code: ParticipantAdditionProblemCode; count?: number };

export function describeParticipantProblem(problem: Problem): string {
  const n = problem.count ?? 1;
  switch (problem.code) {
    case 'time_zone_missing': return 'Zona waktu sekolah belum diatur, sehingga hari ujian belum dapat ditentukan. Hubungi operator sekolah.';
    case 'window_missing': return 'Waktu pelaksanaan ujian belum ditentukan.';
    case 'rooms_in_use': return 'Ujian ini memakai ruang ujian. Penambahan peserta beserta ruangnya belum tersedia di aplikasi.';
    case 'not_enrolled': return `${n} siswa tidak terdaftar di kelas ini pada hari ujian.`;
    case 'already_participant': return `${n} siswa sudah menjadi peserta.`;
    case 'schedule_conflict': return `${n} siswa sudah dijadwalkan pada ujian lain di waktu yang sama.`;
  }
}

/** A refusal that ends this attempt at adding, or null when trying again may work. */
function finalRefusal(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  switch (err.code) {
    case 'invalid_state': return 'Ujian sudah dibuka, sehingga peserta tidak dapat ditambahkan lagi.';
    case 'forbidden': return 'Hanya guru yang mengelola ujian ini yang dapat menambahkan peserta.';
    case 'action_key_reused': return 'Permintaan tadi mungkin sudah tersimpan. Periksa jumlah peserta sebelum mencoba lagi.';
  }
  return null;
}

export const AddParticipantsDialog: React.FC<{
  exam: TeacherExamReadinessProjection | null;
  onClose(): void;
  /** The attempt ended with an outcome to show above the list; the list is read again. */
  onDone(notice: { failed: boolean; text: string }): void;
}> = ({ exam, onClose, onDone }) => {
  const [data, setData] = useState<TeacherExamParticipantCandidates | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [problems, setProblems] = useState<Problem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const actionKey = useRef<string | null>(null);
  const open = exam !== null;
  const examId = exam?.examInstanceId ?? null;

  const load = useCallback(async (keepChoice: boolean) => {
    if (!examId) return;
    setLoadFailed(false);
    try {
      const next = await getTeacherExamParticipantCandidates(examId);
      setData(next);
      // Only students who can still be added stay chosen.
      const addable = new Set(next.candidates.filter(c => !c.conflict).map(c => c.enrollmentId));
      setChosen(prev => new Set(keepChoice ? [...prev].filter(id => addable.has(id)) : []));
    } catch (err) {
      const refusal = finalRefusal(err);
      if (refusal) onDone({ failed: true, text: refusal });
      else setLoadFailed(true);
    }
  }, [examId, onDone]);

  // Every opening starts with the current list, nobody chosen and a new action key.
  useEffect(() => {
    if (!open) return;
    setData(null);
    setChosen(new Set());
    setProblems([]);
    setError(null);
    actionKey.current = newActionKey();
    void load(false);
  }, [open, examId]);

  if (!exam) return null;

  const subject = exam.subjectLabel ?? 'Ujian';
  const wasReady = exam.lifecycleState === 'READY';
  const count = chosen.size;

  const toggle = (enrollmentId: string) => setChosen(prev => {
    const next = new Set(prev);
    if (next.has(enrollmentId)) next.delete(enrollmentId);
    else next.add(enrollmentId);
    return next;
  });

  const confirm = async () => {
    if (count === 0 || sending) return;
    setSending(true);
    setError(null);
    setProblems([]);
    try {
      const result = await postTeacherExamAddParticipants({
        examInstanceId: exam.examInstanceId, enrollmentIds: [...chosen], actionKey: actionKey.current ?? newActionKey(),
      });
      onDone({
        failed: false,
        text: `${result.added.length} peserta ditambahkan ke ujian ${subject}.${wasReady ? ' Tandai siap lagi sebelum membuka ujian.' : ''}`,
      });
    } catch (err) {
      const refusal = finalRefusal(err);
      if (refusal) {
        onDone({ failed: true, text: refusal });
      } else if (err instanceof ApiError && err.status === 422 && Array.isArray(err.data?.problems)) {
        // Nothing was added: the list is read again and the dialog stays open.
        setProblems(err.data.problems as Problem[]);
        await load(true);
      } else {
        // The same key goes with the next try: if this one arrived, nobody is added twice.
        setError('Gagal menambahkan peserta. Periksa koneksi internet Anda, lalu coba lagi.');
      }
    } finally {
      setSending(false);
    }
  };

  const examProblems = data?.problems ?? [];
  const conflicts = data?.candidates.some(c => c.conflict) ?? false;

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !sending) onClose(); }}>
      <DialogContent aria-describedby="add-participants-description" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Peserta</DialogTitle>
          <DialogDescription id="add-participants-description">
            Pilih siswa kelas ini yang belum menjadi peserta. Siswa yang ditambahkan melihat ujian ini di daftar ujiannya dan dapat mengerjakannya setelah ujian dibuka. Peserta yang sudah ditambahkan tidak dapat dihapus di aplikasi.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-0.5">
          <p className="m-0 font-medium">{[subject, exam.groupLabel, exam.assessmentTypeLabel].filter(Boolean).join(' · ')}</p>
          {exam.windowStartsAt && exam.windowEndsAt && (
            <p className="m-0 text-sm text-muted-foreground">{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>
          )}
          {data && <p className="m-0 text-sm text-muted-foreground">Peserta saat ini: {data.participantCount}</p>}
        </div>

        {wasReady && (
          <Alert variant="warning" role="note">
            <IconInfo aria-hidden="true" />
            <AlertDescription>Ujian ini sudah ditandai siap. Setelah peserta ditambahkan, ujian kembali berstatus Terjadwal dan perlu ditandai siap lagi sebelum dibuka.</AlertDescription>
          </Alert>
        )}

        {!data && !loadFailed && <LoadingState>Memuat daftar siswa...</LoadingState>}
        {loadFailed && (
          <LoadErrorState kind="failed" title="Gagal Memuat Daftar Siswa" onRetry={() => void load(true)}>
            Periksa koneksi internet Anda, lalu coba lagi.
          </LoadErrorState>
        )}

        {examProblems.length > 0 && (
          <Alert variant="destructive">
            <IconInfo aria-hidden="true" />
            <AlertTitle>Peserta belum dapat ditambahkan</AlertTitle>
            <AlertDescription>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                {examProblems.map(p => <li key={p.code}>{describeParticipantProblem(p)}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {data && examProblems.length === 0 && (
          data.candidates.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">Semua siswa yang terdaftar di kelas ini pada hari ujian sudah menjadi peserta.</p>
          ) : (
            <section aria-labelledby="add-participants-list-title" className="flex flex-col gap-2">
              <h3 id="add-participants-list-title" className="m-0 text-base font-semibold">Siswa yang dapat ditambahkan ({count} dipilih)</h3>
              {conflicts && (
                <p className="m-0 text-sm text-muted-foreground">Siswa bertanda Bentrok jadwal sudah dijadwalkan pada ujian lain di waktu yang sama, sehingga tidak dapat ditambahkan.</p>
              )}
              <ParticipantChoiceList
                participants={data.candidates}
                isChosen={id => chosen.has(id)}
                onToggle={toggle}
                conflictsDisabled
                label="Siswa kelas ini yang belum menjadi peserta"
              />
            </section>
          )
        )}

        {problems.length > 0 && (
          <Alert variant="destructive">
            <IconInfo aria-hidden="true" />
            <AlertTitle>Tidak ada siswa yang ditambahkan</AlertTitle>
            <AlertDescription>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                {problems.map(p => <li key={p.code}>{describeParticipantProblem(p)}</li>)}
              </ul>
              <p className="m-0 mt-1">Daftar siswa sudah diperbarui. Periksa pilihan Anda, lalu coba lagi.</p>
            </AlertDescription>
          </Alert>
        )}
        {error && <p role="alert" className="m-0 text-sm text-danger-ink">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={sending}>Batal</Button>
          <Button onClick={confirm} disabled={count === 0 || sending || examProblems.length > 0}>
            {sending ? 'Menambahkan...' : count > 0 ? `Tambahkan ${count} Peserta` : 'Tambahkan Peserta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
