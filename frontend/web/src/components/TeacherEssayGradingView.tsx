import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getTeacherEssays, postTeacherEssayGrade } from '../api/assessment-client.ts';
import type { EssayGradeEntry, TeacherEssayWorklist } from '../types/assessment.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadErrorState, LoadingState, PageStateFrame } from '@/components/ui/page-state';
import { Page, PageHeader } from '@/components/ui/page';
import { IconChevronLeft, IconInfo } from '@/components/icons';
import { formatDateTime } from '../lib/format.ts';
import { SCREEN_TITLE } from '../lib/screen-titles.ts';
import { useFocusRestore, WRAPPING_BUTTON } from './TeacherResultsView.tsx';

// Essay grading by the managing teacher (ASSESS-QUESTION-008 §4.6; Owner O02-9/O02-10, E1-E3).
// Every answered essay of the first submitted attempts, by ELLIGBLE ID, with the rubric. Each
// answer is its own fieldset: the text as written, the score with the decimal keyboard, "Simpan
// Nilai", one polite status region and the revision history. The server decides validity, the
// revision and the state; once the results are FINALIZED the screen is read-only.

type LoadError = 'forbidden' | 'running' | 'not_available' | 'failed';
type Status = { tone: 'success' | 'danger'; text: string } | null;

/** "3.5" as "3,5" (decimal comma, UI_CONTENT_AND_COPY_STYLE). */
const comma = (score: string) => score.replace('.', ',');

export const ESSAY_GRADE_SAVED = 'Nilai tersimpan.';
export const ESSAY_GRADE_STALE = 'Nilai ini baru saja diubah. Muat ulang untuk melihat nilai terbaru.';
/** RESULT-004 E7 (Owner RS-2): an institution exam is graded once it has ended. */
export const GRADING_RUNNING_TITLE = 'Penilaian Belum Tersedia';
export const GRADING_RUNNING_TEXT = 'Jawaban ujian sekolah dapat dinilai setelah ujian berakhir.';
export const essayGradeInvalid = (max: string) => `Nilai tidak valid. Gunakan angka 0 sampai ${comma(max)}, paling banyak dua angka di belakang koma.`;

export const TeacherEssayGradingView: React.FC<{ examInstanceId: string; onBack(): void }> = ({ examInstanceId, onBack }) => {
  const [data, setData] = useState<TeacherEssayWorklist | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const reloadButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const saveButtons = useRef(new Map<string, HTMLButtonElement>());
  const focus = useFocusRestore(() => [reloadButton.current, backButton.current]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const worklist = await getTeacherEssays(examInstanceId);
      setData(worklist);
      setScores(Object.fromEntries(worklist.questions.flatMap(q => q.answers.map(a => [`${q.snapshotId}:${a.attemptId}`, a.grade ? comma(a.grade.score) : '']))));
      setStatuses({});
    } catch (err) {
      // E7: no answer of a running institution exam stays on the screen.
      if (err instanceof ApiError && err.code === 'institution_exam_running') setData(null);
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden'
        : err instanceof ApiError && err.code === 'institution_exam_running' ? 'running'
        : err instanceof ApiError && err.code === 'invalid_state' ? 'not_available'
        : 'failed');
    }
  }, [examInstanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** "Muat Ulang" and "Coba Lagi": when the screen behind the control changes, focus is not left on BODY. */
  const reload = async (trigger: Element | null) => {
    focus.begin(trigger);
    await load();
    focus.settle();
  };

  const back = (
    <Button ref={backButton} variant="ghost" size="sm" className="-ml-3 h-auto min-h-11 max-w-full self-start whitespace-normal py-2 text-left" onClick={onBack}>
      <IconChevronLeft aria-hidden="true" />
      Kembali ke Pelaksanaan Ujian
    </Button>
  );

  if (!data) {
    return (
      <PageStateFrame title={SCREEN_TITLE.essayGrading} back={back}>
        {error === null ? (
          <LoadingState>Memuat jawaban...</LoadingState>
        ) : error === 'failed' ? (
          <LoadErrorState kind="failed" title="Gagal Memuat Jawaban" onRetry={() => void reload(document.activeElement)}>Periksa koneksi internet Anda, lalu coba lagi.</LoadErrorState>
        ) : error === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">Jawaban hanya dapat dinilai oleh guru mata pelajaran ujian ini.</LoadErrorState>
        ) : error === 'running' ? (
          <LoadErrorState kind="refused" title={GRADING_RUNNING_TITLE}>{GRADING_RUNNING_TEXT}</LoadErrorState>
        ) : (
          <LoadErrorState kind="refused" title="Penilaian Belum Tersedia">Jawaban dapat dinilai setelah ujian dibuka.</LoadErrorState>
        )}
      </PageStateFrame>
    );
  }

  const finalized = data.exam.lifecycleState === 'FINALIZED';
  const all = data.questions.flatMap(q => q.answers);
  const ungraded = all.filter(a => !a.grade).length;

  const save = async (snapshotId: string, attemptId: string, maxScore: string, expected: EssayGradeEntry | null) => {
    const key = `${snapshotId}:${attemptId}`;
    focus.begin(saveButtons.current.get(key) ?? null);
    setBusy(key);
    setStatuses(prev => ({ ...prev, [key]: null }));
    try {
      const saved = await postTeacherEssayGrade({ examInstanceId, attemptId, snapshotId, score: (scores[key] ?? '').trim(), expectedRevision: expected?.revision ?? null });
      setData(prev => prev && {
        ...prev,
        questions: prev.questions.map(q => q.snapshotId !== snapshotId ? q : {
          ...q,
          answers: q.answers.map(a => a.attemptId !== attemptId ? a : { ...a, grade: saved, history: [...a.history, saved] }),
        }),
      });
      setScores(prev => ({ ...prev, [key]: comma(saved.score) }));
      setStatuses(prev => ({ ...prev, [key]: { tone: 'success', text: ESSAY_GRADE_SAVED } }));
    } catch (err) {
      const text = err instanceof ApiError && (err.code === 'invalid_score' || err.code === 'invalid_request') ? essayGradeInvalid(maxScore)
        : err instanceof ApiError && err.code === 'stale_grade' ? ESSAY_GRADE_STALE
        : err instanceof ApiError && err.code === 'institution_exam_running' ? GRADING_RUNNING_TEXT
        : err instanceof ApiError && err.code === 'invalid_state' ? 'Status ujian telah berubah. Muat ulang untuk melihat keadaan terbaru.'
        : err instanceof ApiError && err.status === 403 ? 'Anda tidak memiliki hak untuk menilai ujian ini.'
        : 'Gagal menyimpan nilai. Periksa koneksi internet Anda dan coba lagi.';
      setStatuses(prev => ({ ...prev, [key]: { tone: 'danger', text } }));
    } finally {
      setBusy(null);
      focus.settle();
    }
  };

  return (
    <Page>
      {back}
      <PageHeader title={SCREEN_TITLE.essayGrading} actions={<Button ref={reloadButton} variant="secondary" onClick={event => void reload(event.currentTarget)}>Muat Ulang</Button>}>
        <p className="m-0 text-lg font-medium tabular-nums">Belum dinilai: {ungraded} dari {all.length} jawaban</p>
      </PageHeader>

      {finalized ? (
        <Alert variant="success" role="note">
          <IconInfo aria-hidden="true" />
          <AlertDescription>Hasil ujian sudah difinalisasi. Nilai dibekukan dan tidak dapat diubah.</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="info" role="note">
          <IconInfo aria-hidden="true" />
          <AlertDescription>Nilai setiap jawaban sebelum finalisasi hasil. Nilai dapat diubah sampai hasil difinalisasi; setiap perubahan tercatat di riwayat.</AlertDescription>
        </Alert>
      )}

      {data.questions.map(q => (
        <section key={q.snapshotId} aria-labelledby={`essay-q-${q.snapshotId}`} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 id={`essay-q-${q.snapshotId}`} className="m-0 text-lg font-semibold">Soal {q.no}</h2>
            <p className="m-0 text-sm text-muted-foreground">{q.questionType === 'SHORT_ANSWER' ? 'Isian singkat' : 'Esai'}</p>
            <p className="essay-text text-[15px]">{q.prompt}</p>
            <h3 className="m-0 text-sm font-semibold">Rubrik</h3>
            <p className="essay-text text-sm text-muted-foreground">{q.rubric || 'Tidak ada rubrik.'}</p>
          </div>
          {q.answers.length === 0 ? (
            <p className="m-0 text-muted-foreground">Belum ada jawaban yang dikumpulkan untuk soal ini.</p>
          ) : q.answers.map(a => {
            const key = `${q.snapshotId}:${a.attemptId}`;
            const fieldId = `essay-score-${q.snapshotId}-${a.attemptId}`;
            const status = statuses[key] ?? null;
            return (
              <fieldset key={key} className="essay-grading-answer">
                <legend>Soal {q.no} · {a.elligbleId ?? 'Tanpa ELLIGBLE ID'}</legend>
                <p className="essay-text">{a.essayText}</p>
                {finalized ? (
                  <p className="m-0 font-semibold tabular-nums">Nilai: {a.grade ? comma(a.grade.score) : 'belum dinilai'}</p>
                ) : (
                  <form className="essay-grading-form" onSubmit={event => { event.preventDefault(); void save(q.snapshotId, a.attemptId, q.maxScore, a.grade); }}>
                    <div className="essay-grading-score">
                      <Label htmlFor={fieldId}>Skor (0 sampai {comma(q.maxScore)})</Label>
                      <Input
                        id={fieldId}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={scores[key] ?? ''}
                        aria-describedby={`${fieldId}-status`}
                        aria-invalid={status?.tone === 'danger' || undefined}
                        onChange={event => setScores(prev => ({ ...prev, [key]: event.target.value }))}
                      />
                    </div>
                    <Button
                      ref={(button: HTMLButtonElement | null) => { if (button) saveButtons.current.set(key, button); else saveButtons.current.delete(key); }}
                      type="submit"
                      className={WRAPPING_BUTTON}
                      disabled={busy === key}
                    >
                      {busy === key ? 'Menyimpan...' : 'Simpan Nilai'}
                    </Button>
                  </form>
                )}
                <p id={`${fieldId}-status`} className="essay-grading-status" data-tone={status?.tone} role="status" aria-live="polite">{status?.text ?? ''}</p>
                {a.history.length > 0 && (
                  <details className="essay-history">
                    <summary>Riwayat</summary>
                    <ul>
                      {a.history.map(h => (
                        <li key={h.revision} className="tabular-nums">{comma(h.score)}, {formatDateTime(h.gradedAt)}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </fieldset>
            );
          })}
        </section>
      ))}
    </Page>
  );
};
