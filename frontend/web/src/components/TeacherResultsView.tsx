import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, getTeacherExamResults } from '../api/assessment-client.ts';
import type { ParticipantResult, TeacherExamResultsResponse } from '../types/assessment.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IconChevronLeft, IconEye, IconEyeOff, IconInfo } from '@/components/icons';
import { cn } from '@/lib/utils';
import { formatDateTime, formatTime, formatWindow } from '../lib/format.ts';

// Results for the teacher who manages the exam (D04.8): provisional until the exam is
// finalized, then the frozen final results (D04.8-17/20). Scores come only from submitted
// attempts; a participant who never started has no score (absent is not zero, D04.4-12). Rows follow the ELLIGBLE ID, never the score (D04.8-51). Scores stay hidden
// until the teacher shows them, so a shared or projected screen does not expose them
// (FRONTEND_DESIGN_SYSTEM §58).

const scoreFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export function formatScore(value: number): string {
  return scoreFormat.format(value);
}

function statusOf(row: ParticipantResult): { label: string; tone: 'success' | 'neutral'; note: string | null } {
  switch (row.status) {
    case 'SUBMITTED':
      if (row.finalizationSource === 'EXPIRY_CLIENT') return { label: 'Dikumpulkan otomatis', tone: 'neutral', note: 'Waktu habis' };
      if (row.finalizationSource === 'EXPIRY_SERVER') {
        return { label: 'Dikumpulkan otomatis', tone: 'neutral', note: 'Waktu habis saat perangkat tidak terhubung' };
      }
      return { label: 'Dikumpulkan', tone: 'success', note: null };
    case 'IN_PROGRESS':
      return { label: 'Sedang mengerjakan', tone: 'neutral', note: null };
    case 'NOT_STARTED':
      return { label: 'Belum mulai', tone: 'neutral', note: null };
    case 'ABSENT':
      return { label: 'Tidak mengerjakan', tone: 'neutral', note: null };
  }
}

const Hidden: React.FC = () => (
  <span aria-label="Disembunyikan" className="tracking-widest text-muted-foreground">••••</span>
);

export const TeacherResultsView: React.FC<{ examInstanceId: string; onBack(): void }> = ({ examInstanceId, onBack }) => {
  const [data, setData] = useState<TeacherExamResultsResponse | null>(null);
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showScores, setShowScores] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getTeacherExamResults(examInstanceId));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    }
  }, [examInstanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
          <p role="status" className="m-0 text-muted-foreground">Memuat hasil ujian...</p>
        ) : (
          <Alert variant={error === 'forbidden' ? 'default' : 'destructive'}>
            <IconInfo aria-hidden="true" />
            <AlertTitle>{error === 'forbidden' ? 'Akses Ditolak' : 'Gagal Memuat Hasil Ujian'}</AlertTitle>
            <AlertDescription>
              {error === 'forbidden'
                ? 'Hasil ujian hanya dapat dilihat oleh guru yang mengelola ujian ini.'
                : 'Periksa koneksi internet Anda, lalu coba lagi.'}
            </AlertDescription>
            {error === 'failed' && (
              <Button variant="secondary" size="sm" className="col-start-2 mt-2 justify-self-start" onClick={refresh} disabled={refreshing}>
                Coba Lagi
              </Button>
            )}
          </Alert>
        )}
      </main>
    );
  }

  const { exam, scoring, summary, participants } = data;
  const final = data.resultState === 'FINAL';
  const context = [exam.groupLabel, exam.assessmentTypeLabel].filter(Boolean).join(' · ');

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-6 md:px-6">
      {back}
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold">Hasil Ujian</h1>
        <p className="m-0 text-lg font-medium">{exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}</p>
        {context && <p className="m-0 text-sm text-muted-foreground">{context}</p>}
        {exam.windowStartsAt && exam.windowEndsAt && (
          <p className="m-0 text-sm text-muted-foreground">{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>
        )}
      </header>

      {final ? (
        <Alert variant="success" role="note">
          <IconInfo aria-hidden="true" />
          <AlertTitle>Hasil final</AlertTitle>
          <AlertDescription>
            {data.finalizedAt ? `Difinalisasi ${formatDateTime(data.finalizedAt)}. ` : ''}Nilai dibekukan dan tidak berubah oleh perubahan data berikutnya. Hasil ini tidak ditampilkan kepada siswa.
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

      <dl className={cn('m-0 grid grid-cols-2 gap-3', final ? 'sm:grid-cols-3' : 'sm:grid-cols-4')} aria-label="Ringkasan peserta">
        {(final
          ? [
            ['Peserta', summary.participants],
            ['Dikumpulkan', summary.submitted],
            ['Tidak mengerjakan', summary.notStarted],
          ]
          : [
            ['Peserta', summary.participants],
            ['Dikumpulkan', summary.submitted],
            ['Sedang mengerjakan', summary.inProgress],
            ['Belum mulai', summary.notStarted],
          ]).map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="m-0 text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" aria-pressed={showScores} onClick={() => setShowScores(s => !s)} disabled={!scoring.available}>
          {showScores ? <IconEyeOff aria-hidden="true" /> : <IconEye aria-hidden="true" />}
          {showScores ? 'Sembunyikan Nilai' : 'Tampilkan Nilai'}
        </Button>
        <Button variant="secondary" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Memperbarui...' : 'Perbarui Data'}
        </Button>
      </div>
      {error === 'failed' && (
        <p role="alert" className="m-0 text-sm text-danger-ink">Gagal memperbarui data. Data yang tampil adalah data terakhir.</p>
      )}
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
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Hasil per peserta, diurutkan menurut ELLIGBLE ID</caption>
            <thead className="bg-[var(--color-neutral-50)] text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Peserta</th>
                <th scope="col" className="w-16 px-3 py-2 text-right sm:w-24">Benar</th>
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
                      <span
                        className={cn(
                          'mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs font-medium',
                          status.tone === 'success' ? 'bg-success-surface text-success-ink' : 'bg-[var(--color-neutral-badge-bg)] text-[var(--color-neutral-badge-text)]'
                        )}
                      >
                        {status.label}
                      </span>
                      {(status.note || row.submittedAt) && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {[status.note, row.submittedAt ? formatTime(row.submittedAt) : null].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </th>
                    {row.score ? (
                      <>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {showScores ? `${row.score.correct}/${scoring.questionCount}` : <Hidden />}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {showScores ? formatScore(row.score.scaledScore) : <Hidden />}
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="px-3 py-3 text-right text-muted-foreground">{row.status === 'ABSENT' ? 'Tidak ada nilai' : 'Belum ada nilai'}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="m-0 text-sm leading-relaxed text-muted-foreground">
        Nilai adalah poin benar dibagi poin maksimum ({scoring.maxScore !== null ? formatScore(scoring.maxScore) : 'tidak tersedia'}), dikali 100, dan dibulatkan dua angka di belakang koma. Soal yang tidak dijawab bernilai 0. {final ? 'Peserta yang tidak mengerjakan tidak diberi nilai, bukan bernilai 0.' : 'Peserta yang belum mulai tidak diberi nilai.'} Jika waktu habis saat perangkat siswa tidak terhubung, hanya jawaban yang sudah diterima server yang dihitung.
      </p>
    </main>
  );
};
