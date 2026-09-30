import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getTeacherExamSetup, postTeacherExamImport, postTeacherExamImportPreview } from '../api/assessment-client.ts';
import type {
  ImportProblem, LatestStartPolicy, TeacherExamImportInput, TeacherExamImportPreview, TeacherExamSetup,
} from '../types/assessment.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadErrorState, LoadingState, PageStateFrame } from '@/components/ui/page-state';
import { Metric, MetricList } from '@/components/ui/metric';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IconChevronLeft, IconInfo } from '@/components/icons';
import { formatWindow, zoneLabel } from '../lib/format.ts';
import { downloadTextFile } from '../lib/results-export.ts';
import { newActionKey } from '../lib/action-key.ts';
import { SCREEN_TITLE } from '../lib/screen-titles.ts';
import { ParticipantChoiceList } from './ParticipantChoiceList.tsx';
import {
  LATEST_START_OPTIONS, QUESTION_TEMPLATE_CSV, QUESTION_TEMPLATE_FILE_NAME, describeImportProblem, formatScore,
} from '../lib/question-import.ts';

// A teacher schedules an exam for one of their own classes from a question file
// (ASSESS-TEACHER-001; D04.4-26A, D04.3-61..66): choose the class, assessment type and
// schedule, upload the canonical CSV, check it (the server previews exactly what it would
// create and keeps nothing, D04.3-63), leave out students if needed (D04.4-04), then
// confirm. Any change after a check asks for a new check, so what is scheduled is what was
// previewed. A confirmation carries one import key: retrying it after a lost connection
// returns the exam already created instead of a second one (D04.3-65).

type Stage = 'editing' | 'checking' | 'checked';

const selectClass =
  'flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3.5 py-2.5 text-base text-foreground shadow-sm ' +
  'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** The file as UTF-8 text (invalid bytes become U+FFFD, which the server reports). */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

function confirmFailureMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'content_changed': return 'Berkas soal berubah sejak diperiksa. Periksa lagi sebelum menjadwalkan.';
      case 'forbidden': return 'Anda tidak berwenang membuat ujian untuk kelas ini.';
      case 'invalid_request': return 'Isian belum lengkap atau tidak valid. Periksa lagi.';
      case 'payload_too_large': return 'Berkas soal terlalu besar. Bagi soal ke dalam beberapa ujian.';
    }
  }
  return 'Ujian belum tersimpan karena koneksi terputus. Coba lagi: jika ujian ternyata sudah tersimpan, mencoba lagi tidak membuat ujian ganda.';
}

export const TeacherExamImportView: React.FC<{
  onBack(): void;
  /** The exam was scheduled: back to the list with this notice. */
  onScheduled(notice: string): void;
}> = ({ onBack, onScheduled }) => {
  const [setup, setSetup] = useState<TeacherExamSetup | null>(null);
  const [setupError, setSetupError] = useState<'forbidden' | 'failed' | null>(null);
  const [teachingAssignmentId, setTeachingAssignmentId] = useState('');
  const [assessmentTypeId, setAssessmentTypeId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [duration, setDuration] = useState('');
  const [policy, setPolicy] = useState<LatestStartPolicy | ''>('');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>('editing');
  const [preview, setPreview] = useState<TeacherExamImportPreview | null>(null);
  /** Class and exam day the listed participants belong to. */
  const [previewBasis, setPreviewBasis] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const importKey = useRef<string | null>(null);

  const load = async () => {
    setSetupError(null);
    try {
      const loaded = await getTeacherExamSetup();
      setSetup(loaded);
      if (loaded.teachingAssignments.length === 1) setTeachingAssignmentId(loaded.teachingAssignments[0].teachingAssignmentId);
    } catch (err) {
      setSetupError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  // Any change after a check makes the check stale: what is scheduled is what was previewed.
  // Participants are chosen from the class on the exam day: another class or day starts
  // again from everyone enrolled.
  const basis = `${teachingAssignmentId}|${startsAt.slice(0, 10)}`;
  const input: TeacherExamImportInput | null = useMemo(() => {
    const minutes = Number(duration);
    if (!teachingAssignmentId || !assessmentTypeId || !startsAt || !endsAt || !policy || !file || duration.trim() === '' || !Number.isFinite(minutes)) return null;
    return {
      teachingAssignmentId,
      assessmentTypeId,
      // datetime-local may carry seconds; the school-time minute is what counts.
      windowStartsAt: startsAt.slice(0, 16),
      windowEndsAt: endsAt.slice(0, 16),
      durationMinutes: minutes,
      latestStartPolicy: policy,
      questionsCsv: file.text,
      sourceFileName: file.name,
      participantEnrollmentIds: preview && previewBasis === basis
        ? preview.participants.filter(p => !excluded.has(p.enrollmentId)).map(p => p.enrollmentId)
        : null,
    };
  }, [teachingAssignmentId, assessmentTypeId, startsAt, endsAt, duration, policy, file, excluded, preview, previewBasis, basis]);

  const showPreview = (result: TeacherExamImportPreview) => {
    setPreview(result);
    setPreviewBasis(basis);
    setExcluded(new Set(result.participants.filter(p => !p.included).map(p => p.enrollmentId)));
    setStage('checked');
  };

  const edited = () => {
    if (stage === 'checked') setStage('editing');
    setSaveError(null);
  };
  const change = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    edited();
  };

  const chooseFile = async (chosen: File | undefined) => {
    setFileNotice(null);
    setPreview(null);
    setExcluded(new Set());
    edited();
    if (!chosen) {
      setFile(null);
      return;
    }
    const maxBytes = setup?.limits.maxFileCharacters ?? 512 * 1024;
    if (chosen.size > maxBytes * 4) {
      setFile(null);
      setFileNotice('Berkas soal terlalu besar. Bagi soal ke dalam beberapa ujian.');
      return;
    }
    try {
      setFile({ name: chosen.name, text: await readFileText(chosen) });
    } catch {
      setFile(null);
      setFileNotice('Berkas tidak dapat dibaca. Pilih berkas lagi.');
    }
  };

  const check = async () => {
    if (!input) return;
    setStage('checking');
    setCheckError(null);
    setSaveError(null);
    try {
      showPreview(await postTeacherExamImportPreview(input));
    } catch (err) {
      setStage('editing');
      setCheckError(err instanceof ApiError && err.status === 403
        ? 'Anda tidak berwenang membuat ujian untuk kelas ini.'
        : 'Gagal memeriksa. Periksa koneksi internet Anda, lalu coba lagi.');
    }
  };

  const toggleParticipant = (enrollmentId: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) next.delete(enrollmentId);
      else next.add(enrollmentId);
      return next;
    });
    edited();
  };

  const openConfirm = () => {
    importKey.current = newActionKey();
    setSaveError(null);
    setConfirmOpen(true);
  };

  const schedule = async () => {
    if (!input || !preview || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      // The same key on every retry of this confirmation (D04.3-65).
      const result = await postTeacherExamImport(input, { importKey: importKey.current ?? newActionKey(), expectedSha256: preview.sourceSha256 });
      const assignment = setup?.teachingAssignments.find(a => a.teachingAssignmentId === teachingAssignmentId);
      const label = assignment ? `${assignment.subjectLabel} · ${assignment.groupLabel}` : 'Ujian';
      onScheduled(`${label} dijadwalkan dengan ${result.questionCount} soal dan ${result.participantCount} peserta. Periksa kesiapan, lalu tandai siap sebelum dibuka.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.data && Array.isArray(err.data.problems)) {
        // Something changed on the server since the check (for example another exam was
        // scheduled for these students): show what it found now.
        showPreview(err.data as TeacherExamImportPreview);
        setConfirmOpen(false);
      } else {
        setSaveError(confirmFailureMessage(err));
        if (err instanceof ApiError && err.code === 'content_changed') {
          setConfirmOpen(false);
          setStage('editing');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const back = (
    <Button variant="ghost" size="sm" className="-ml-3 self-start" onClick={onBack}>
      <IconChevronLeft aria-hidden="true" />
      Kembali ke Pelaksanaan Ujian
    </Button>
  );

  if (!setup) {
    return (
      <PageStateFrame title={SCREEN_TITLE.examImport} back={back}>
        {setupError === null ? (
          <LoadingState>Memuat data kelas...</LoadingState>
        ) : setupError === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">Ujian hanya dapat dibuat oleh guru yang memiliki penugasan mengajar aktif.</LoadErrorState>
        ) : (
          <LoadErrorState kind="failed" title="Gagal Memuat Data Kelas" onRetry={load}>Periksa koneksi internet Anda, lalu coba lagi.</LoadErrorState>
        )}
      </PageStateFrame>
    );
  }

  const zone = zoneLabel();
  const assignment = setup.teachingAssignments.find(a => a.teachingAssignmentId === teachingAssignmentId);
  const typeLabel = setup.assessmentTypes.find(t => t.assessmentTypeId === assessmentTypeId)?.label;
  const fresh = stage === 'checked' && preview !== null;
  const ready = fresh && preview!.problems.length === 0;
  const included = preview ? preview.participants.filter(p => !excluded.has(p.enrollmentId)).length : 0;

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-6 md:px-6">
      {back}
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold">{SCREEN_TITLE.examImport}</h1>
        <p className="m-0 text-muted-foreground">
          Pilih kelas dan jadwal, unggah soal pilihan ganda (A sampai E) dalam templat CSV ELLIGBLE, periksa hasilnya, lalu jadwalkan.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Kelas dan Jenis Penilaian</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">Kelas dan mata pelajaran</legend>
            {setup.teachingAssignments.map(a => (
              <label key={a.teachingAssignmentId} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-foreground">
                <input
                  type="radio"
                  name="teaching-assignment"
                  value={a.teachingAssignmentId}
                  checked={teachingAssignmentId === a.teachingAssignmentId}
                  onChange={() => change(setTeachingAssignmentId)(a.teachingAssignmentId)}
                  className="size-4 accent-primary"
                />
                <span className="flex flex-col">
                  <span className="font-medium">{a.subjectLabel} · {a.groupLabel}</span>
                  <span className="text-xs text-muted-foreground">{a.periodLabel}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="assessment-type" className="text-sm font-medium">Jenis penilaian</label>
            {setup.assessmentTypes.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">Belum ada jenis penilaian di sekolah ini. Hubungi operator sekolah.</p>
            ) : (
              <select id="assessment-type" className={selectClass} value={assessmentTypeId} onChange={e => change(setAssessmentTypeId)(e.target.value)}>
                <option value="">Pilih jenis penilaian</option>
                {setup.assessmentTypes.map(t => <option key={t.assessmentTypeId} value={t.assessmentTypeId}>{t.label}</option>)}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jadwal</CardTitle>
          <CardDescription>
            {setup.timeZone ? `Semua waktu dalam zona waktu sekolah (${zone}).` : 'Zona waktu sekolah belum diatur. Hubungi operator sekolah.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="window-starts" className="text-sm font-medium">Mulai{zone ? ` (${zone})` : ''}</label>
              <Input id="window-starts" type="datetime-local" value={startsAt} onChange={e => change(setStartsAt)(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="window-ends" className="text-sm font-medium">Selesai{zone ? ` (${zone})` : ''}</label>
              <Input id="window-ends" type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={e => change(setEndsAt)(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:max-w-[240px]">
            <label htmlFor="duration" className="text-sm font-medium">Durasi pengerjaan (menit)</label>
            <Input
              id="duration"
              type="number"
              inputMode="numeric"
              min={1}
              max={setup.limits.maxDurationMinutes}
              step={1}
              value={duration}
              onChange={e => change(setDuration)(e.target.value)}
            />
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">Peserta yang mulai terlambat</legend>
            {LATEST_START_OPTIONS.map(option => (
              <label key={option.value} className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 text-sm has-[:checked]:border-foreground">
                <input
                  type="radio"
                  name="latest-start"
                  value={option.value}
                  checked={policy === option.value}
                  onChange={() => change(setPolicy)(option.value)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Berkas Soal</CardTitle>
          <CardDescription>
            Satu baris per soal: nomor, teks soal, pilihan A sampai E, kunci jawaban (satu huruf) dan skor.
            Simpan sebagai CSV UTF-8; pemisah kolom boleh titik koma atau koma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="questions-file" className="text-sm font-medium">Berkas CSV</label>
            <input
              id="questions-file"
              type="file"
              accept=".csv,text/csv"
              onChange={e => void chooseFile(e.target.files?.[0])}
              className="block w-full min-w-0 text-sm file:mr-3 file:h-11 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-background file:px-4 file:text-[15px] file:font-medium file:text-foreground"
            />
            {fileNotice && <p role="alert" className="m-0 text-sm text-danger-ink">{fileNotice}</p>}
          </div>
          <Button
            variant="link"
            className="h-auto self-start px-0"
            onClick={() => downloadTextFile(QUESTION_TEMPLATE_CSV, QUESTION_TEMPLATE_FILE_NAME)}
          >
            Unduh Templat CSV
          </Button>
        </CardContent>
      </Card>

      {checkError && (
        <Alert variant="destructive">
          <IconInfo aria-hidden="true" />
          <AlertDescription>{checkError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button variant={preview ? 'secondary' : 'default'} onClick={check} disabled={!input || stage === 'checking' || fresh}>
          {stage === 'checking' ? 'Memeriksa...' : preview ? 'Periksa Lagi' : 'Periksa Soal dan Jadwal'}
        </Button>
        {!input && <p className="m-0 text-sm text-muted-foreground">Lengkapi semua isian dan pilih berkas soal untuk memeriksa.</p>}
        {preview && !fresh && input && stage !== 'checking' && (
          <p role="status" className="m-0 text-sm text-warning-ink">Ada perubahan sejak pemeriksaan terakhir. Periksa lagi sebelum menjadwalkan.</p>
        )}
      </div>

      {preview && (
        <PreviewSection
          preview={preview}
          problems={preview.problems}
          excluded={excluded}
          onToggle={toggleParticipant}
          maxQuestionScore={setup.limits.maxQuestionScore}
        />
      )}

      {ready && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="m-0 text-sm text-muted-foreground">
            Setelah dijadwalkan, soal tidak dapat diubah dan peserta tidak dapat dihapus di aplikasi. Sebelum ujian dibuka, jadwalnya masih dapat diubah dan siswa kelas ini masih dapat ditambahkan. Ujian baru dapat dikerjakan setelah Anda menandainya siap dan membukanya.
          </p>
          <Button className="self-start" onClick={openConfirm}>Jadwalkan Ujian</Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={next => { if (!next && !saving) setConfirmOpen(false); }}>
        {confirmOpen && preview && (
          <DialogContent aria-describedby="schedule-description">
            <DialogHeader>
              <DialogTitle>Jadwalkan Ujian Ini?</DialogTitle>
              <DialogDescription id="schedule-description">
                {[
                  [assignment ? `${assignment.subjectLabel} · ${assignment.groupLabel}` : null, typeLabel].filter(Boolean).join(' · '),
                  preview.window ? formatWindow(preview.window.startsAt, preview.window.endsAt) : null,
                  `${preview.totals.questions} soal, ${included} peserta`,
                  'Soal tidak dapat diubah dan peserta tidak dapat dihapus setelah dijadwalkan; sebelum ujian dibuka, jadwal masih dapat diubah dan siswa kelas ini masih dapat ditambahkan',
                ].filter(Boolean).join('. ')}.
              </DialogDescription>
            </DialogHeader>
            {saveError && <p role="alert" className="m-0 text-sm text-danger-ink">{saveError}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={saving}>Batal</Button>
              <Button onClick={schedule} disabled={saving}>{saving ? 'Menjadwalkan...' : saveError ? 'Coba Lagi' : 'Jadwalkan Ujian'}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
};

const PreviewSection: React.FC<{
  preview: TeacherExamImportPreview;
  problems: ImportProblem[];
  excluded: Set<string>;
  onToggle(enrollmentId: string): void;
  maxQuestionScore: number;
}> = ({ preview, problems, excluded, onToggle, maxQuestionScore }) => {
  const included = preview.participants.filter(p => !excluded.has(p.enrollmentId)).length;
  return (
    <section aria-labelledby="preview-title" className="flex flex-col gap-4">
      <h2 id="preview-title" className="m-0 text-xl font-semibold">Hasil Pemeriksaan</h2>
      {problems.length > 0 ? (
        <Alert variant="destructive">
          <IconInfo aria-hidden="true" />
          <AlertTitle>Perbaiki {problems.length} hal berikut, lalu periksa lagi</AlertTitle>
          <AlertDescription>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
              {problems.map((problem, i) => <li key={i}>{describeImportProblem(problem, { maxQuestionScore })}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="success" role="status">
          <IconInfo aria-hidden="true" />
          <AlertTitle>Soal dan jadwal siap dijadwalkan</AlertTitle>
          <AlertDescription>Tidak ada yang disimpan sebelum Anda menekan "Jadwalkan Ujian".</AlertDescription>
        </Alert>
      )}

      <MetricList aria-label="Ringkasan">
        <Metric label="Soal" value={preview.totals.questions} />
        <Metric label="Skor maksimum" value={formatScore(preview.totals.maxScore)} />
        <Metric label="Peserta" value={included} />
        <Metric
          className="col-span-2 sm:col-span-1"
          valueClassName="text-sm font-medium"
          label="Waktu pelaksanaan"
          value={preview.window ? formatWindow(preview.window.startsAt, preview.window.endsAt) : 'Belum valid'}
        />
      </MetricList>

      {preview.participants.length > 0 && (
        <section aria-labelledby="participants-title" className="flex flex-col gap-2">
          <h3 id="participants-title" className="m-0 text-base font-semibold">Peserta ({included} dari {preview.participants.length})</h3>
          <p className="m-0 text-sm text-muted-foreground">Siswa yang terdaftar di kelas ini pada hari ujian. Hapus centang untuk mengecualikan siswa.</p>
          <ParticipantChoiceList participants={preview.participants} isChosen={id => !excluded.has(id)} onToggle={onToggle} />
        </section>
      )}

      {preview.questions.length > 0 && (
        <section aria-labelledby="questions-title" className="flex flex-col gap-2">
          <h3 id="questions-title" className="m-0 text-base font-semibold">Soal</h3>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {preview.questions.map(q => (
              <li key={q.no} className="flex flex-col gap-2 rounded-md border border-border bg-background px-4 py-3">
                <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Soal {q.no}</span>
                  <span className="tabular-nums">Skor {formatScore(q.score)}</span>
                </p>
                <p className="m-0 whitespace-pre-wrap text-[15px] [overflow-wrap:anywhere]">{q.prompt}</p>
                <ol className="m-0 flex list-none flex-col gap-1 p-0">
                  {q.options.map((option, i) => {
                    const letter = 'ABCDE'[i];
                    const key = letter === q.correct;
                    return (
                      <li key={letter} className={`flex gap-2 rounded-md px-2 py-1 text-sm ${key ? 'border border-success-line bg-success-surface' : ''}`}>
                        <span className="w-4 shrink-0 font-semibold">{letter}.</span>
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{option}</span>
                        {key && <span className="shrink-0 text-xs font-semibold text-success-ink">Kunci jawaban</span>}
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
};
