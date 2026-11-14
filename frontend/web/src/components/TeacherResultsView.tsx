import { flushSync } from 'react-dom';
import { newActionKey } from '../lib/action-key.ts';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getTeacherExamResults, postTeacherResultsExport } from '../api/assessment-client.ts';
import type { ParticipantResult, TeacherExamResultsResponse } from '../types/assessment.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadErrorState, LoadingState, PageStateFrame, StaleDataNotice } from '@/components/ui/page-state';
import { Page, PageHeader } from '@/components/ui/page';
import { Metric, MetricList } from '@/components/ui/metric';
import { IconChevronLeft, IconInfo } from '@/components/icons';
import { formatDateTime, formatTime, formatWindow } from '../lib/format.ts';
import { buildResultsCsv, downloadTextFile, resultsCsvFileName } from '../lib/results-export.ts';
import { resultStatus, type StatusView } from '../lib/status.ts';
import { SCREEN_TITLE } from '../lib/screen-titles.ts';
import { HiddenScore, ScoreRevealToggle } from './ScoreReveal.tsx';
import { ResultPublicationDialog, type PublicationDialogAction } from './ResultPublicationDialog.tsx';

// Results for the teacher who manages the exam (D04.8): provisional until the exam is
// finalized, then the frozen final results (D04.8-17/20). Scores come only from submitted
// attempts; a participant who never started has no score (absent is not zero, D04.4-12). Rows follow the ELLIGBLE ID, never the score (D04.8-51). Scores stay hidden
// until the teacher shows them, so a shared or projected screen does not expose them
// (FRONTEND_DESIGN_SYSTEM §58). RESULT-003: once FINAL, the Teacher publishes the result to the exam's Students,
// withdraws the publication and publishes it again; the state line follows the server only (U04).

const scoreFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export function formatScore(value: number): string {
  return scoreFormat.format(value);
}

function statusOf(row: ParticipantResult): StatusView & { note: string | null } {
  const note = row.status !== 'SUBMITTED' ? null
    : row.finalizationSource === 'EXPIRY_CLIENT' ? 'Waktu habis'
    : row.finalizationSource === 'EXPIRY_SERVER' ? 'Waktu habis saat perangkat tidak terhubung'
    : null;
  return { ...resultStatus(row), note };
}

/** RESULT-003 §4.5: the publication state line of a FINAL result. */
export function publicationStateText(publication: { published: boolean; revision: number; changedAt: string | null }): string {
  if (publication.published && publication.changedAt) {
    return `Dipublikasikan kepada siswa ${formatDateTime(publication.changedAt)}. Setiap siswa hanya melihat nilainya sendiri.`;
  }
  if (publication.revision > 0 && publication.changedAt) {
    return `Publikasi ditarik ${formatDateTime(publication.changedAt)}. Siswa melihat "Hasil belum tersedia".`;
  }
  return 'Belum dipublikasikan. Siswa belum dapat melihat nilai.';
}

/** RESULT-004 E12: the wrapping form of a toolbar button ("Tampilkan Nilai" already uses it). */
export const WRAPPING_BUTTON = 'h-auto min-h-11 max-w-full whitespace-normal py-2';

/** RESULT-004 E6: the results of a running institution exam are not available to its subject Teacher. */
export const RESULTS_RUNNING_TITLE = 'Hasil Belum Tersedia';
export const RESULTS_RUNNING_TEXT = 'Hasil ujian sekolah dapat dilihat setelah ujian berakhir. Selama ujian berlangsung, pemantauan dilakukan operator sekolah dan pengawas ruang.';
export const RESULTS_EXPORT_RUNNING_TEXT = 'Hasil ujian sekolah dapat diekspor setelah ujian berakhir. Tidak ada berkas atau cetakan dibuat.';

/**
 * RESULT-004 E12: a control that disables itself while its request runs loses focus to BODY. When the
 * request settles, and only when focus is still on BODY, focus returns to that control once it is
 * enabled again, otherwise to the first enabled fallback. Focus the user moved elsewhere is left alone.
 */
export function useFocusRestore(fallbacks: () => Array<HTMLElement | null>) {
  const target = useRef<HTMLElement | null>(null);
  const fallbackList = useRef(fallbacks);
  fallbackList.current = fallbacks;
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    if (settled === 0) return;
    const trigger = target.current;
    target.current = null;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    for (const candidate of [trigger, ...fallbackList.current()]) {
      if (!candidate || !candidate.isConnected || (candidate as HTMLButtonElement).disabled) continue;
      candidate.focus();
      if (document.activeElement === candidate) return;
    }
  }, [settled]);
  return useMemo(() => ({
    /** Records the control that started the request. */
    begin(trigger: Element | null) { target.current = trigger instanceof HTMLElement ? trigger : null; },
    /** Call when the request settled, in the same update that enables the control again. */
    settle() { setSettled(n => n + 1); },
  }), []);
}

/**
 * RESULT-004 E12 (rendered review, as ASSESS-ROOM-001 §11.0.2): the opener of the screen is gone after navigation,
 * so once the screen has first settled (loaded or refused), its title takes focus when nothing else holds it, in the
 * layout phase so no input reaches the screen first.
 */
export function useEntryTitleFocus(settled: boolean) {
  const done = useRef(false);
  useLayoutEffect(() => {
    if (!settled || done.current) return;
    done.current = true;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    const title = document.querySelector<HTMLHeadingElement>('h1[data-slot="page-title"]');
    if (!title) return;
    title.tabIndex = -1;
    title.classList.add('outline-none');
    title.focus();
  }, [settled]);
}

export const TeacherResultsView: React.FC<{ examInstanceId: string; onBack(): void }> = ({ examInstanceId, onBack }) => {
  const [data, setData] = useState<TeacherExamResultsResponse | null>(null);
  const [error, setError] = useState<'forbidden' | 'running' | 'failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeExam = useRef(examInstanceId);
  activeExam.current = examInstanceId;
  const [exportPending, setExportPending] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportKeys = useRef<Partial<Record<'csv' | 'print', string>>>({});
  const [showScores, setShowScores] = useState(false);
  const [publicationAction, setPublicationAction] = useState<PublicationDialogAction | null>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const publicationButton = useRef<HTMLButtonElement>(null);
  const focus = useFocusRestore(() => [refreshButton.current, backButton.current]);
  useEntryTitleFocus(data !== null || error !== null);

  const load = useCallback(async () => {
    try {
      setData(await getTeacherExamResults(examInstanceId));
      setError(null);
    } catch (err) {
      // E6: nothing about a running institution exam stays on the screen.
      if (err instanceof ApiError && err.code === 'institution_exam_running') {
        setData(null);
        setError('running');
        return;
      }
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    }
  }, [examInstanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async (trigger: Element | null = document.activeElement) => {
    focus.begin(trigger);
    setRefreshing(true);
    await load();
    setRefreshing(false);
    focus.settle();
  };

  const exportResults = async (format: 'csv' | 'print', trigger: Element | null) => {
    if (exportPending) return;
    focus.begin(trigger);
    setExportPending(true); setExportError(null);
    try {
      const key = exportKeys.current[format] ??= newActionKey();
      const result = await postTeacherResultsExport(examInstanceId, format, key);
      if (activeExam.current !== examInstanceId) return;
      flushSync(() => setData(result));
      if (format === 'csv') downloadTextFile(buildResultsCsv(result), resultsCsvFileName(result));
      else window.print();
      delete exportKeys.current[format];
    } catch (err) {
      const terminal = err instanceof ApiError && ['export_data_changed', 'action_key_reused'].includes(err.code);
      if (terminal) delete exportKeys.current[format];
      setExportError(err instanceof ApiError && err.code === 'forbidden'
        ? 'Akses ekspor ditolak. Tidak ada berkas atau cetakan dibuat.'
        : err instanceof ApiError && err.code === 'institution_exam_running' ? RESULTS_EXPORT_RUNNING_TEXT
        : terminal ? 'Data atau permintaan berubah. Periksa hasil terbaru sebelum meminta ekspor lagi.'
        : 'Izin ekspor belum diterima. Periksa koneksi, lalu coba lagi. Tidak ada berkas atau cetakan dibuat.');
    } finally {
      setExportPending(false);
      focus.settle();
    }
  };

  // RESULT-003 E11: the dialog closes after the server's 200 and the results are read again; focus returns to the action
  // button (its label has changed), or to the existing fallbacks, never to BODY.
  const restorePublicationFocus = () => {
    const button = publicationButton.current;
    if (!button || !button.isConnected || button.disabled) return false;
    button.focus();
    return document.activeElement === button;
  };
  const publicationDone = async () => {
    focus.begin(publicationButton.current);
    setPublicationAction(null);
    await load();
    focus.settle();
  };

  const back = (
    <Button ref={backButton} variant="ghost" size="sm" className="-ml-3 min-h-11 min-w-11 self-start whitespace-normal print:hidden" onClick={onBack}>
      <IconChevronLeft aria-hidden="true" />
      Kembali ke Pelaksanaan Ujian
    </Button>
  );

  if (!data) {
    return (
      <PageStateFrame title={SCREEN_TITLE.examResults} back={back}>
        {error === null ? (
          <LoadingState>Memuat hasil ujian...</LoadingState>
        ) : error === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">Hasil ujian hanya dapat dilihat oleh guru mata pelajaran ujian ini.</LoadErrorState>
        ) : error === 'running' ? (
          <LoadErrorState kind="refused" title={RESULTS_RUNNING_TITLE}>{RESULTS_RUNNING_TEXT}</LoadErrorState>
        ) : (
          <LoadErrorState kind="failed" title="Gagal Memuat Hasil Ujian" onRetry={() => void refresh()} retrying={refreshing}>
            Periksa koneksi internet Anda, lalu coba lagi.
          </LoadErrorState>
        )}
      </PageStateFrame>
    );
  }

  const { exam, scoring, summary, participants } = data;
  const final = data.resultState === 'FINAL';
  const context = [exam.groupLabel, exam.assessmentTypeLabel].filter(Boolean).join(' · ');
  // D1 (ASSESS-QUESTION-008): with essays, "Benar" counts the automatically scored questions only and
  // a "Dinilai guru" column shows the graded essays; exams without essays render as before.
  const withEssays = (scoring.essayCount ?? 0) > 0;
  // RESULT-003 §4.5: publication controls only on a FINAL result whose server sends the publication state.
  const publication = final && data.publication && typeof data.publication === 'object' ? data.publication : null;
  const published = publication?.published === true;

  return (
    <Page>
      {back}
      <PageHeader title={SCREEN_TITLE.examResults}>
        <p className="m-0 text-lg font-medium">{exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}</p>
        {context && <p className="m-0 text-sm text-muted-foreground">{context}</p>}
        {exam.windowStartsAt && exam.windowEndsAt && (
          <p className="m-0 text-sm text-muted-foreground">{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>
        )}
      </PageHeader>

      {final ? (
        <Alert variant="success" role="note">
          <IconInfo aria-hidden="true" />
          <AlertTitle>Hasil final</AlertTitle>
          <AlertDescription>
            {data.finalizedAt ? `Difinalisasi ${formatDateTime(data.finalizedAt)}. ` : ''}Nilai dibekukan dan tidak berubah oleh perubahan data berikutnya. {published ? 'Setiap siswa dapat melihat nilainya sendiri.' : 'Hasil ini tidak ditampilkan kepada siswa.'}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="info" role="note">
          <IconInfo aria-hidden="true" />
          <AlertTitle>Hasil sementara</AlertTitle>
          <AlertDescription>
            Nilai dihitung otomatis dari jawaban yang diterima server. Hasil ini belum difinalisasi dan tidak ditampilkan kepada siswa.
          </AlertDescription>
        </Alert>
      )}

      {publication && (
        <div className="flex min-w-0 flex-col gap-2">
          <p role="status" className="m-0 text-sm [overflow-wrap:anywhere]">{publicationStateText(publication)}</p>
          <div className="flex flex-wrap gap-2 print:hidden">
            {/* E11: the wrapping form, so no label widens the page at 200 % text. */}
            <Button ref={publicationButton} variant={published ? 'secondary' : 'default'} className={WRAPPING_BUTTON}
              onClick={() => setPublicationAction(published ? 'withdraw' : 'publish')}>
              {published ? 'Tarik Publikasi' : 'Publikasikan Hasil'}
            </Button>
          </div>
        </div>
      )}

      <MetricList className={final ? 'sm:grid-cols-3' : undefined} aria-label="Ringkasan peserta">
        <Metric label="Peserta" value={summary.participants} />
        <Metric label="Dikumpulkan" value={summary.submitted} />
        {final ? (
          <Metric label="Tidak mengerjakan" value={summary.notStarted} />
        ) : (
          <>
            <Metric label="Sedang mengerjakan" value={summary.inProgress} />
            <Metric label="Belum mulai" value={summary.notStarted} />
          </>
        )}
      </MetricList>

      <div className="flex flex-wrap gap-2 print:hidden">
        {/* The shared reveal control (RESULT-003 E7a), moved unchanged to ScoreReveal.tsx. */}
        <ScoreRevealToggle pressed={showScores} onToggle={() => setShowScores(s => !s)} disabled={!scoring.available} />
        {/* RESULT-004 E12: the same wrapping form, so no label widens the page at 200 % text. */}
        <Button ref={refreshButton} variant="secondary" className={WRAPPING_BUTTON} onClick={event => void refresh(event.currentTarget)} disabled={refreshing}>
          {refreshing ? 'Memperbarui...' : 'Perbarui Data'}
        </Button>
        <Button variant="secondary" className={WRAPPING_BUTTON} onClick={event => void exportResults('csv', event.currentTarget)} disabled={exportPending || participants.length === 0}>
          Unduh CSV
        </Button>
        <Button variant="secondary" className={WRAPPING_BUTTON} onClick={event => void exportResults('print', event.currentTarget)} disabled={exportPending}>Cetak</Button>
      </div>
      <p className="m-0 text-xs text-muted-foreground print:hidden">
        Berkas CSV memakai titik koma sebagai pemisah kolom dan koma sebagai tanda desimal, sesuai pengaturan Indonesia pada Excel dan Google Sheets. Berkas berisi nilai; simpan hanya di perangkat sekolah.
      </p>
      {exportError && <p role="alert" className="m-0 text-sm text-danger-ink print:hidden">{exportError}</p>}
      {exportPending && <p role="status" className="m-0 text-sm print:hidden">Meminta izin ekspor...</p>}
      {error === 'failed' && <StaleDataNotice />}
      {!scoring.available && (
        <Alert variant="warning">
          <IconInfo aria-hidden="true" />
          <AlertTitle>Nilai belum dapat dihitung</AlertTitle>
          <AlertDescription>Konten soal ujian ini tidak dapat dinilai otomatis. Hubungi operator sekolah.</AlertDescription>
        </Alert>
      )}

      {participants.length === 0 ? (
        <p className="m-0 text-muted-foreground">Ujian ini belum memiliki peserta.</p>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Hasil per peserta, diurutkan menurut ELLIGBLE ID</caption>
            <thead className="bg-[var(--color-neutral-50)] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Peserta</th>
                <th scope="col" className="w-16 px-3 py-2 text-right sm:w-24">Benar</th>
                {withEssays && <th scope="col" className="w-20 px-3 py-2 text-right sm:w-28">Dinilai guru</th>}
                <th scope="col" className="w-20 px-3 py-2 text-right sm:w-24">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((row, index) => {
                const status = statusOf(row);
                return (
                  <tr key={row.elligbleId ?? `tanpa-id-${index}`} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-3 text-left font-normal">
                      <span className="block font-mono text-[13px] [overflow-wrap:anywhere]">{row.elligbleId ?? 'Tanpa ELLIGBLE ID'}</span>
                      <StatusBadge tone={status.tone} className="mt-1.5">{status.label}</StatusBadge>
                      {(status.note || row.submittedAt) && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {[status.note, row.submittedAt ? formatTime(row.submittedAt) : null].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </th>
                    {row.score ? (
                      <>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {showScores ? `${row.score.correct}/${withEssays ? scoring.autoScoredCount : scoring.questionCount}` : <HiddenScore />}
                        </td>
                        {withEssays && (
                          <td className="px-3 py-3 text-right tabular-nums">{showScores ? row.score.graded : <HiddenScore />}</td>
                        )}
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {showScores ? formatScore(row.score.scaledScore) : <HiddenScore />}
                          {withEssays && (row.score.ungraded ?? 0) > 0 && (
                            <span className="mt-1 block text-xs font-normal text-warning-ink">Belum dinilai: {row.score.ungraded}</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td colSpan={withEssays ? 3 : 2} className="px-3 py-3 text-right text-muted-foreground">{row.status === 'ABSENT' ? 'Tidak ada nilai' : 'Belum ada nilai'}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="m-0 text-sm leading-relaxed text-muted-foreground">
        Nilai adalah poin benar dibagi poin maksimum ({scoring.maxScore !== null ? formatScore(scoring.maxScore) : 'tidak tersedia'}), dikali 100, dan dibulatkan dua angka di belakang koma. Soal yang tidak dijawab bernilai 0. {final ? 'Peserta yang tidak mengerjakan tidak diberi nilai, bukan bernilai 0.' : 'Peserta yang belum mulai tidak diberi nilai.'} Jika waktu habis saat perangkat siswa tidak terhubung, hanya jawaban yang sudah diterima server yang dihitung.{withEssays ? ' Poin soal yang dinilai guru ikut masuk ke Nilai.' : ''}
      </p>

      {publication && (
        <ResultPublicationDialog
          action={publicationAction}
          examInstanceId={examInstanceId}
          expectedRevision={publication.revision}
          onClose={() => setPublicationAction(null)}
          onDone={() => void publicationDone()}
          onStale={() => void load()}
          restoreFocus={restorePublicationFocus}
        />
      )}
    </Page>
  );
};
