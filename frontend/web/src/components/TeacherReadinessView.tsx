import React, { useState, useEffect, useCallback } from 'react';
import { getTeacherReadiness, postTeacherExamTransition, ApiError } from '../api/assessment-client.ts';
import type { TeacherReadinessResponse, TeacherExamReadinessProjection, TeacherExamAction } from '../types/assessment.ts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, LoadErrorState, LoadingState, StaleDataNotice } from '@/components/ui/page-state';
import { Metric, MetricList } from '@/components/ui/metric';
import { ActionGroup } from '@/components/ui/action-group';
import { ExamFacts, ExamList, ExamListCard } from './ExamListCard.tsx';
import { IconInfo } from '@/components/icons';
import { CANCELLED_EXAM_STATUS, examLifecycleStatus } from '../lib/status.ts';
import { formatDateTime, formatTime, formatWindow } from '../lib/format.ts';
import { RescheduleDialog } from './TeacherExamReschedule.tsx';
import { CancelExamDialog } from './TeacherExamCancel.tsx';
import { AddParticipantsDialog } from './TeacherExamParticipants.tsx';
import { SCREEN_TITLE } from '../lib/screen-titles.ts';

// Exams being delivered: progress, monitoring, results and the pause, resume and end
// controls (Owner decision 2026-09-30); an ended exam is finalized once nobody is still
// working (D04.8-17).
const DELIVERY_STATES = new Set(['ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED']);

type ConfirmableAction = 'activate' | 'pause' | 'resume' | 'end' | 'finalize';

const CONFIRM_COPY: Record<ConfirmableAction, { title: string; description: string; confirm: string; destructive?: boolean }> = {
  activate: {
    title: 'Buka Ujian untuk Peserta?',
    description: 'Setelah dibuka, peserta dapat mulai mengerjakan sesuai waktu pelaksanaan. Soal dan pengaturan ujian tidak dapat diubah lagi.',
    confirm: 'Buka Ujian',
  },
  pause: {
    title: 'Jeda Ujian untuk Semua Peserta?',
    description: 'Sisa waktu setiap peserta berhenti tepat saat ujian dijeda. Selama dijeda, soal disembunyikan dan jawaban tidak dapat diubah; jawaban yang sudah dipilih tetap tersimpan. Peserta yang belum mulai tidak dapat memulai.',
    confirm: 'Jeda Ujian',
  },
  resume: {
    title: 'Lanjutkan Ujian?',
    description: 'Sisa waktu setiap peserta berjalan lagi dari saat ujian dijeda, dan peserta dapat kembali mengerjakan.',
    confirm: 'Lanjutkan Ujian',
  },
  end: {
    title: 'Akhiri Ujian?',
    description: 'Peserta yang belum mulai tidak dapat memulai lagi. Peserta yang sedang mengerjakan tetap dapat menyelesaikan sampai waktunya masing-masing habis, lalu jawabannya dikumpulkan otomatis. Nilai tidak otomatis terlihat oleh siswa. Ujian yang diakhiri tidak dapat dibuka kembali.',
    confirm: 'Akhiri Ujian',
    destructive: true,
  },
  finalize: {
    title: 'Finalisasi Hasil Ujian?',
    description: 'Nilai setiap peserta dibekukan seperti sekarang dan tidak berubah oleh perubahan data berikutnya. Peserta yang tidak mengerjakan dicatat tidak mengerjakan, bukan bernilai 0. Nilai tetap tidak terlihat oleh siswa. Finalisasi tidak dapat dibatalkan.',
    confirm: 'Finalisasi Hasil',
  },
};

function transitionFailureMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'not_ready': return 'Ujian belum memenuhi syarat kesiapan. Periksa rincian kesiapan di bawah.';
      case 'window_not_started': return err.data?.windowStartsAt
        ? `Ujian baru dapat dibuka mulai ${formatDateTime(err.data.windowStartsAt)}.`
        : 'Ujian belum dapat dibuka sebelum waktu pelaksanaan dimulai.';
      case 'window_closed': return 'Waktu pelaksanaan ujian telah berakhir.';
      case 'invalid_state': return 'Status ujian telah berubah. Data ditampilkan ulang.';
      case 'attempts_running': return 'Masih ada peserta yang mengerjakan. Finalisasi dapat dilakukan setelah semua peserta selesai.';
      case 'scoring_unavailable': return 'Konten soal ujian ini tidak dapat dinilai otomatis, sehingga hasil belum dapat difinalisasi. Hubungi operator sekolah.';
      case 'forbidden': return 'Anda tidak memiliki hak untuk mengelola ujian ini.';
    }
  }
  return 'Gagal memproses permintaan. Periksa koneksi internet Anda dan coba lagi.';
}

const mapBaselineBlocker = (blocker?: string): string => {
  switch (blocker) {
    case 'question_snapshot_empty': return 'Soal ujian belum ditambahkan';
    case 'question_snapshot_content_invalid': return 'Konten soal ujian tidak valid';
    case 'participant_schedule_conflict': return 'Terdapat konflik jadwal peserta';
    case 'proctor_schedule_conflict': return 'Terdapat konflik jadwal pengawas';
    case 'duration_window_policy_compatibility': return 'Durasi ujian tidak sesuai dengan rentang waktu';
    case 'timing_configuration_presence': return 'Konfigurasi waktu belum diatur';
    case 'participant_presence': return 'Peserta ujian belum ditentukan';
    case 'question_snapshot_presence': return 'Status soal ujian belum ditetapkan';
    case 'assessment_type': return 'Tipe asesmen belum dikonfigurasi';
    default: return 'Persyaratan dasar belum lengkap';
  }
};

const mapRoomProctorBlocker = (blocker?: string): string => {
  switch (blocker) {
    case 'room_proctor_requirement_policy_unconfigured': return 'Kebijakan ruangan dan pengawas belum diatur';
    case 'participant_empty': return 'Belum ada peserta yang terdaftar';
    case 'exam_room_empty': return 'Belum ada ruangan yang ditetapkan';
    case 'participant_room_assignment_incomplete': return 'Penugasan peserta ke ruangan belum lengkap';
    case 'active_proctor_assignment_empty': return 'Belum ada pengawas yang ditugaskan';
    case 'active_proctor_room_coverage_incomplete': return 'Cakupan pengawas untuk ruangan belum lengkap';
    default: return 'Persyaratan ruangan dan pengawas belum lengkap';
  }
};

export const TeacherReadinessView: React.FC<{
  onOpenResults?(examInstanceId: string): void;
  onOpenMonitoring?(examInstanceId: string): void;
  /** Opens "Buat Ujian dari Berkas Soal" (ASSESS-TEACHER-001). */
  onCreateExam?(): void;
  /** Opens "Pratinjau Soal" of a scheduled or ready exam (ASSESS-TEACHER-002, D04.3-38). */
  onOpenPreview?(examInstanceId: string): void;
  /** Shown once above the list, for example after an exam was scheduled. */
  notice?: string | null;
}> = ({ onOpenResults, onOpenMonitoring, onCreateExam, onOpenPreview, notice }) => {
  const [data, setData] = useState<TeacherReadinessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ exam: TeacherExamReadinessProjection; action: ConfirmableAction } | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<TeacherExamReadinessProjection | null>(null);
  const [cancelFor, setCancelFor] = useState<TeacherExamReadinessProjection | null>(null);
  const [addFor, setAddFor] = useState<TeacherExamReadinessProjection | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ failed: boolean; text: string } | null>(null);

  // A failed refresh keeps the last data on screen with a notice; a refusal replaces it.
  const fetchReadinessData = useCallback(async () => {
    try {
      const response = await getTeacherReadiness();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    }
  }, []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await fetchReadinessData();
    setLoading(false);
  }, [fetchReadinessData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchReadinessData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const runTransition = async (examInstanceId: string, action: TeacherExamAction) => {
    setPendingAction(examInstanceId);
    setActionErrors(prev => ({ ...prev, [examInstanceId]: '' }));
    try {
      await postTeacherExamTransition(examInstanceId, action);
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [examInstanceId]: transitionFailureMessage(err) }));
    } finally {
      setPendingAction(null);
      setConfirm(null);
      await fetchReadinessData();
    }
  };

  const shownNotice = statusNotice ?? (notice ? { failed: false, text: notice } : null);
  const noticeBanner = shownNotice ? (
    <Alert variant={shownNotice.failed ? 'destructive' : 'success'} role={shownNotice.failed ? 'alert' : 'status'} className="mb-4">
      <IconInfo aria-hidden="true" />
      <AlertDescription>{shownNotice.text}</AlertDescription>
    </Alert>
  ) : null;

  // The notice and the header keep their places in every state, so the header's buttons are
  // not replaced (nor their focus lost) while the page moves from loading to the list.
  const header = (
    <div className="teacher-readiness-header">
      <h1 className="teacher-readiness-title">{SCREEN_TITLE.teacherExams}</h1>
      {error !== 'forbidden' && (
        <div className="flex flex-wrap gap-2">
          {onCreateExam && <Button onClick={onCreateExam}>Buat Ujian</Button>}
          {data && (
            <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? 'Memperbarui...' : 'Perbarui Data'}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (loading || error === 'forbidden' || !data) {
    return (
      <main className="teacher-readiness-container">
        {noticeBanner}
        {header}
        {loading ? (
          <LoadingState>Memuat daftar ujian...</LoadingState>
        ) : error === 'forbidden' ? (
          <LoadErrorState kind="refused" title="Akses Ditolak">
            Anda tidak memiliki hak akses. Pastikan Anda ditugaskan sebagai guru.
          </LoadErrorState>
        ) : (
          <LoadErrorState kind="failed" title="Gagal Memuat Daftar Ujian" onRetry={handleRefresh} retrying={isRefreshing}>
            Periksa koneksi internet Anda, lalu coba lagi.
          </LoadErrorState>
        )}
      </main>
    );
  }

  const allExams = data.exams || [];
  // Cancelled exams keep their record in a history section, never among the exams to run.
  const exams = allExams.filter(exam => !exam.cancellation);
  const cancelledExams = allExams.filter(exam => exam.cancellation);

  const staleNotice = error === 'failed' ? <div className="mb-4"><StaleDataNotice /></div> : null;

  if (allExams.length === 0) {
    return (
      <main className="teacher-readiness-container">
        {noticeBanner}
        {header}
        {staleNotice}
        <EmptyState title="Belum Ada Ujian Terjadwal">Anda belum memiliki ujian yang dijadwalkan saat ini.</EmptyState>
      </main>
    );
  }

  return (
    <main className="teacher-readiness-container">
      {noticeBanner}
      {header}
      {staleNotice}

      {exams.length === 0 && <p className="m-0 mb-4 text-muted-foreground">Tidak ada ujian yang terjadwal atau berlangsung.</p>}
      <ExamList>
        {exams.map((exam: TeacherExamReadinessProjection) => {

          let baselineMessage = '';
          switch (exam.baseline.status) {
            case 'baseline_readiness_checks_pass':
              baselineMessage = 'Kesiapan dasar terpenuhi';
              break;
            case 'not_ready':
              baselineMessage = mapBaselineBlocker(exam.baseline.blocker);
              break;
            case 'denied':
              baselineMessage = 'Status kesiapan dasar tidak dapat diakses';
              break;
            case 'unavailable':
              baselineMessage = 'Data kesiapan dasar sementara tidak tersedia';
              break;
            case 'invalid_state':
              baselineMessage = 'Status ujian tidak mendukung pemeriksaan kesiapan dasar';
              break;
          }

          let roomProctorMessage = '';
          switch (exam.roomProctor.status) {
            case 'room_proctor_readiness_ready':
              roomProctorMessage = 'Kesiapan ruangan dan pengawas terpenuhi';
              break;
            case 'room_proctor_readiness_not_applicable':
              roomProctorMessage = 'Pemeriksaan ruangan dan pengawas tidak berlaku untuk ujian ini';
              break;
            case 'not_ready':
              roomProctorMessage = mapRoomProctorBlocker(exam.roomProctor.blocker);
              break;
            case 'denied':
              roomProctorMessage = 'Status ruangan dan pengawas tidak dapat diakses';
              break;
            case 'unavailable':
              roomProctorMessage = 'Data ruangan dan pengawas sementara tidak tersedia';
              break;
            case 'invalid_state':
              roomProctorMessage = 'Status ujian tidak mendukung pemeriksaan ruangan dan pengawas';
              break;
          }

          const lifecycle = exam.lifecycleState ?? 'SCHEDULED';
          const readinessPass =
            exam.baseline.status === 'baseline_readiness_checks_pass' &&
            (exam.roomProctor.status === 'room_proctor_readiness_ready' || exam.roomProctor.status === 'room_proctor_readiness_not_applicable');
          const busy = pendingAction === exam.examInstanceId;
          const actionError = actionErrors[exam.examInstanceId];

          const beforeOpening = lifecycle === 'SCHEDULED' || lifecycle === 'READY';

          return (
            <li key={exam.examInstanceId}>
            <ExamListCard
              className="teacher-exam-card"
              data-testid={`teacher-exam-${exam.examInstanceId}`}
              title={exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}
              status={exam.lifecycleState && (
                <StatusBadge tone={examLifecycleStatus(lifecycle).tone}>{examLifecycleStatus(lifecycle).label}</StatusBadge>
              )}
            >
              <ExamFacts>
                {(exam.groupLabel || exam.assessmentTypeLabel) && (
                  <p>{[exam.groupLabel, exam.assessmentTypeLabel].filter(Boolean).join(' · ')}</p>
                )}
                {exam.windowStartsAt && exam.windowEndsAt && <p>{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>}
                {beforeOpening && exam.participants !== undefined && <p>{exam.participants} peserta</p>}
                {exam.scheduleChangedAt && beforeOpening && <p>Jadwal diubah {formatDateTime(exam.scheduleChangedAt)}.</p>}
                {exam.participantsAddedAt && beforeOpening && <p>Peserta ditambahkan {formatDateTime(exam.participantsAddedAt)}.</p>}
                {lifecycle === 'ENDED' && exam.progress && (
                  <p>
                    {exam.progress.running
                      ? `Ujian telah diakhiri. ${exam.progress.running} peserta masih mengerjakan sampai waktunya masing-masing habis.`
                      : 'Ujian telah diakhiri. Tidak ada peserta yang masih mengerjakan.'}
                  </p>
                )}
                {lifecycle === 'FINALIZED' && exam.progress && (
                  <p>{exam.finalizedAt ? `Hasil difinalisasi ${formatDateTime(exam.finalizedAt)}.` : 'Hasil telah difinalisasi.'} Nilai tidak ditampilkan kepada siswa.</p>
                )}
              </ExamFacts>

              {DELIVERY_STATES.has(lifecycle) && exam.progress ? (
                <>
                {lifecycle === 'PAUSED' && (
                  <Alert variant="warning">
                    <IconInfo aria-hidden="true" />
                    <AlertTitle>{exam.pausedAt ? `Ujian dijeda sejak ${formatTime(exam.pausedAt)}` : 'Ujian dijeda'}</AlertTitle>
                    <AlertDescription>Sisa waktu setiap peserta berhenti dan jawaban tidak dapat diubah sampai ujian dilanjutkan.</AlertDescription>
                  </Alert>
                )}
                <MetricList aria-label="Kemajuan pelaksanaan ujian">
                  <Metric label="Peserta" value={exam.progress.participants} />
                  <Metric label="Sudah mulai" value={exam.progress.started} />
                  <Metric label="Dikumpulkan" value={exam.progress.submitted} />
                  {exam.progress.running !== undefined && <Metric label="Masih mengerjakan" value={exam.progress.running} />}
                </MetricList>
                {(onOpenResults || onOpenMonitoring) && (
                  <ActionGroup>
                    {onOpenMonitoring && (
                      <Button variant="secondary" onClick={() => onOpenMonitoring(exam.examInstanceId)}>Pantau Peserta</Button>
                    )}
                    {onOpenResults && (
                      <Button variant="secondary" onClick={() => onOpenResults(exam.examInstanceId)}>Lihat Hasil</Button>
                    )}
                  </ActionGroup>
                )}
                {lifecycle === 'ENDED' && (
                  <ActionGroup className="border-t border-border pt-4" role="group" aria-label="Kendali ujian">
                    <Button onClick={() => setConfirm({ exam, action: 'finalize' })} disabled={busy || (exam.progress.running ?? 0) > 0}>
                      {busy ? 'Memproses...' : 'Finalisasi Hasil'}
                    </Button>
                    {(exam.progress.running ?? 0) > 0 && (
                      <p className="m-0 text-sm text-muted-foreground">Finalisasi dapat dilakukan setelah semua peserta selesai.</p>
                    )}
                  </ActionGroup>
                )}
                {(lifecycle === 'ACTIVE' || lifecycle === 'PAUSED') && (
                  <ActionGroup className="border-t border-border pt-4" role="group" aria-label="Kendali ujian">
                    {lifecycle === 'ACTIVE' && (
                      <>
                        <Button variant="secondary" onClick={() => setConfirm({ exam, action: 'pause' })} disabled={busy}>Jeda Ujian</Button>
                        <Button variant="destructive" onClick={() => setConfirm({ exam, action: 'end' })} disabled={busy}>Akhiri Ujian</Button>
                      </>
                    )}
                    {lifecycle === 'PAUSED' && (
                      <Button onClick={() => setConfirm({ exam, action: 'resume' })} disabled={busy}>
                        {busy ? 'Memproses...' : 'Lanjutkan Ujian'}
                      </Button>
                    )}
                  </ActionGroup>
                )}
                {actionError && (lifecycle === 'ENDED' || lifecycle === 'ACTIVE' || lifecycle === 'PAUSED') && (
                  <p className="m-0 text-sm text-danger-ink" role="alert">{actionError}</p>
                )}
                </>
              ) : (
              <div className="teacher-readiness-details">
                <div className="readiness-section">
                  <h3 className="readiness-section-title">Kesiapan Dasar</h3>
                  <div className={`readiness-status ${exam.baseline.status === 'baseline_readiness_checks_pass' ? 'readiness-pass' : 'readiness-fail'}`}>
                    <p>{baselineMessage}</p>
                  </div>
                </div>

                <div className="readiness-section">
                  <h3 className="readiness-section-title">Kesiapan Ruangan &amp; Pengawas</h3>
                  <div className={`readiness-status ${(exam.roomProctor.status === 'room_proctor_readiness_ready' || exam.roomProctor.status === 'room_proctor_readiness_not_applicable') ? 'readiness-pass' : 'readiness-fail'}`}>
                    <p>{roomProctorMessage}</p>
                  </div>
                </div>
              </div>
              )}

              {exam.lifecycleState && beforeOpening && (
                <ActionGroup>
                  {onOpenPreview && (
                    <Button variant="secondary" onClick={() => onOpenPreview(exam.examInstanceId)}>Pratinjau Soal</Button>
                  )}
                  <Button variant="secondary" onClick={() => setRescheduleFor(exam)} disabled={busy}>Ubah Jadwal</Button>
                  <Button variant="secondary" onClick={() => setAddFor(exam)} disabled={busy}>Tambah Peserta</Button>
                  {lifecycle === 'SCHEDULED' && (
                    <Button onClick={() => runTransition(exam.examInstanceId, 'mark_ready')} disabled={!readinessPass || busy}>
                      {busy ? 'Memproses...' : 'Tandai Siap'}
                    </Button>
                  )}
                  {lifecycle === 'READY' && (
                    <Button onClick={() => setConfirm({ exam, action: 'activate' })} disabled={busy}>
                      {busy ? 'Memproses...' : 'Buka Ujian'}
                    </Button>
                  )}
                  <Button variant="destructive" onClick={() => setCancelFor(exam)} disabled={busy}>Batalkan Ujian</Button>
                </ActionGroup>
              )}
              {actionError && exam.lifecycleState && beforeOpening && (
                <p className="m-0 text-sm text-danger-ink" role="alert">{actionError}</p>
              )}
            </ExamListCard>
            </li>
          );
        })}
      </ExamList>

      {cancelledExams.length > 0 && (
        <section aria-labelledby="cancelled-exams-title" className="mt-8 flex flex-col gap-3">
          <h2 id="cancelled-exams-title" className="m-0 text-lg font-semibold">Ujian Dibatalkan</h2>
          <ExamList>
            {cancelledExams.map(exam => {
              const cancellation = exam.cancellation!;
              return (
                <li key={exam.examInstanceId}>
                  <ExamListCard
                    className="teacher-exam-card"
                    data-testid={`teacher-exam-${exam.examInstanceId}`}
                    headingLevel="h3"
                    title={exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}
                    status={<StatusBadge tone={CANCELLED_EXAM_STATUS.tone}>{CANCELLED_EXAM_STATUS.label}</StatusBadge>}
                  >
                    <ExamFacts>
                      {(exam.groupLabel || exam.assessmentTypeLabel) && <p>{[exam.groupLabel, exam.assessmentTypeLabel].filter(Boolean).join(' · ')}</p>}
                      {exam.windowStartsAt && exam.windowEndsAt && <p>{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>}
                      <p className="[overflow-wrap:anywhere]">
                        Dibatalkan {formatDateTime(cancellation.cancelledAt)} oleh {cancellation.by.you ? 'Anda' : (cancellation.by.elligbleId ?? 'guru lain')}. Alasan: {cancellation.reason}
                      </p>
                    </ExamFacts>
                  </ExamListCard>
                </li>
              );
            })}
          </ExamList>
        </section>
      )}

      <CancelExamDialog
        exam={cancelFor}
        onClose={() => setCancelFor(null)}
        onDone={outcome => {
          setCancelFor(null);
          setStatusNotice(outcome);
          void fetchReadinessData();
        }}
      />

      <AddParticipantsDialog
        exam={addFor}
        onClose={() => setAddFor(null)}
        onDone={outcome => {
          setAddFor(null);
          setStatusNotice(outcome);
          void fetchReadinessData();
        }}
      />

      <RescheduleDialog
        exam={rescheduleFor}
        onClose={() => setRescheduleFor(null)}
        onDone={outcome => {
          setRescheduleFor(null);
          setStatusNotice(outcome);
          void fetchReadinessData();
        }}
      />

      <Dialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null); }}>
        {confirm && (
          <DialogContent aria-describedby="exam-action-description">
            <DialogHeader>
              <DialogTitle>{CONFIRM_COPY[confirm.action].title}</DialogTitle>
              <DialogDescription id="exam-action-description">{CONFIRM_COPY[confirm.action].description}</DialogDescription>
            </DialogHeader>
            <p className="m-0 font-medium">{confirm.exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Batal</Button>
              <Button
                variant={CONFIRM_COPY[confirm.action].destructive ? 'destructive' : 'default'}
                onClick={() => runTransition(confirm.exam.examInstanceId, confirm.action)}
                disabled={pendingAction !== null}
              >
                {CONFIRM_COPY[confirm.action].confirm}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
};
