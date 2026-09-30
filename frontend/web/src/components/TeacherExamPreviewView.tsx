import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, getTeacherExamPreview } from '../api/assessment-client.ts';
import type { TeacherExamPreview } from '../types/assessment.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IconChevronLeft, IconChevronRight, IconInfo } from '@/components/icons';
import { formatWindow } from '../lib/format.ts';
import { formatScore } from '../lib/question-import.ts';

// The teacher previews a scheduled or ready exam before opening it (ASSESS-TEACHER-002;
// D04.3-38 LOCKED): one question at a time as the exam screen shows it (the same question
// card, options A to E and navigation), in the order students receive the questions, with
// the key and score on request. Choices made here stay on this screen: nothing is sent and
// no attempt exists (D04.3-39 LOCKED).

type LoadError = 'forbidden' | 'not_available' | 'failed';

export const TeacherExamPreviewView: React.FC<{ examInstanceId: string; onBack(): void }> = ({ examInstanceId, onBack }) => {
  const [data, setData] = useState<TeacherExamPreview | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [current, setCurrent] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const [tried, setTried] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getTeacherExamPreview(examInstanceId));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden'
        : err instanceof ApiError && err.code === 'invalid_state' ? 'not_available'
        : 'failed');
    }
  }, [examInstanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Button variant="ghost" size="sm" className="-ml-3 self-start" onClick={onBack}>
      <IconChevronLeft aria-hidden="true" />
      Kembali ke Pelaksanaan Ujian
    </Button>
  );

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6 md:px-6">
        {back}
        {error === null ? (
          <p role="status" className="m-0 text-muted-foreground">Memuat pratinjau soal...</p>
        ) : (
          <Alert variant={error === 'failed' ? 'destructive' : 'default'}>
            <IconInfo aria-hidden="true" />
            <AlertTitle>
              {error === 'forbidden' ? 'Akses Ditolak' : error === 'not_available' ? 'Pratinjau Tidak Tersedia' : 'Gagal Memuat Pratinjau'}
            </AlertTitle>
            <AlertDescription>
              {error === 'forbidden'
                ? 'Pratinjau hanya dapat dilihat oleh guru yang mengelola ujian ini.'
                : error === 'not_available'
                  ? 'Pratinjau tersedia sebelum ujian dibuka, saat ujian masih terjadwal atau siap dibuka.'
                  : 'Periksa koneksi internet Anda, lalu coba lagi.'}
            </AlertDescription>
            {error === 'failed' && (
              <Button variant="secondary" size="sm" className="col-start-2 mt-2 justify-self-start" onClick={load}>Coba Lagi</Button>
            )}
          </Alert>
        )}
      </main>
    );
  }

  const { exam, questions } = data;
  const context = [exam.groupLabel, exam.assessmentTypeLabel].filter(Boolean).join(' · ');
  const question = questions[current];

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-6 md:px-6">
      {back}
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold">Pratinjau Soal</h1>
        <p className="m-0 text-lg font-medium">{exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}</p>
        {context && <p className="m-0 text-sm text-muted-foreground">{context}</p>}
        {exam.windowStartsAt && exam.windowEndsAt && (
          <p className="m-0 text-sm text-muted-foreground">
            {formatWindow(exam.windowStartsAt, exam.windowEndsAt)}{exam.durationMinutes ? ` · Durasi ${exam.durationMinutes} menit` : ''}
          </p>
        )}
      </header>

      <Alert variant="info" role="note">
        <IconInfo aria-hidden="true" />
        <AlertDescription>
          Tampilan ini meniru layar ujian siswa, dengan urutan soal yang sama. Pilihan yang Anda klik hanya untuk mencoba dan tidak disimpan; tidak ada pengerjaan yang dibuat.
        </AlertDescription>
      </Alert>

      {questions.length === 0 ? (
        <p className="m-0 text-muted-foreground">Ujian ini belum memiliki soal.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Daftar soal pratinjau" className="flex flex-wrap gap-2">
              {questions.map((q, i) => (
                <button
                  key={q.snapshotId}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-current={i === current ? 'step' : undefined}
                  aria-label={`Soal ${q.no}${q.valid ? '' : ' (tidak valid)'}`}
                  className={`inline-flex size-10 items-center justify-center rounded-md border text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    i === current ? 'border-foreground bg-foreground text-background' : q.valid ? 'border-border bg-background hover:bg-accent' : 'border-danger-line bg-danger-surface text-danger-ink'
                  }`}
                >
                  {q.no}
                </button>
              ))}
            </nav>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={showKey} onChange={e => setShowKey(e.target.checked)} className="size-4 accent-primary" />
              Tampilkan kunci jawaban dan skor
            </label>
          </div>

          {/* The exam screen's own question card (workstation.css), so the preview looks the same. */}
          <section className="question-card" aria-label={`Soal nomor ${question.no}`}>
            <p className="m-0 mb-3 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Soal {question.no} dari {questions.length}</span>
              {showKey && question.maxScore !== null && <span className="tabular-nums">Skor {formatScore(question.maxScore)}</span>}
            </p>
            {!question.valid && (
              <Alert variant="destructive" className="mb-3">
                <IconInfo aria-hidden="true" />
                <AlertDescription>Konten soal ini tidak valid, sehingga ujian belum dapat ditandai siap. Hubungi operator sekolah.</AlertDescription>
              </Alert>
            )}
            <fieldset className="question-fieldset">
              <legend className="question-prompt whitespace-pre-wrap [overflow-wrap:anywhere]">{question.prompt}</legend>
              <div className="options-list" role="radiogroup" aria-label="Pilihan Jawaban">
                {question.options.map((option, i) => {
                  const selected = tried[question.snapshotId] === option.id;
                  const key = showKey && option.id === question.correctOptionId;
                  const inputId = `preview-${question.snapshotId}-${i}`;
                  return (
                    <label key={option.id} htmlFor={inputId} className={`option-item-label ${selected ? 'selected' : ''} ${key ? 'outline outline-2 outline-foreground' : ''}`}>
                      <input
                        type="radio"
                        id={inputId}
                        name={`preview-${question.snapshotId}`}
                        checked={selected}
                        onChange={() => setTried(prev => ({ ...prev, [question.snapshotId]: option.id }))}
                        className="option-radio-input"
                      />
                      <span className="option-marker" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                      <span className="option-text [overflow-wrap:anywhere]">{option.content}</span>
                      {key && <span className="shrink-0 text-xs font-semibold text-foreground">Kunci jawaban</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>

          {/* Short visible labels keep both buttons on one line at 360 px; the names stay complete. */}
          <div className="flex justify-between gap-2">
            <Button variant="secondary" aria-label="Soal Sebelumnya" onClick={() => setCurrent(i => Math.max(0, i - 1))} disabled={current === 0}>
              <IconChevronLeft aria-hidden="true" />
              Sebelumnya
            </Button>
            <Button variant="secondary" aria-label="Soal Berikutnya" onClick={() => setCurrent(i => Math.min(questions.length - 1, i + 1))} disabled={current === questions.length - 1}>
              Berikutnya
              <IconChevronRight aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </main>
  );
};
