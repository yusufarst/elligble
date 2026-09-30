import React, { useState, useEffect, useCallback } from 'react';
import { getTeacherReadiness, postTeacherExamTransition, ApiError } from '../api/assessment-client.ts';
import type { TeacherReadinessResponse, TeacherExamReadinessProjection, TeacherExamAction } from '../types/assessment.ts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IconInfo } from '@/components/icons';
import { formatDateTime, formatTime, formatWindow } from '../lib/format.ts';

const LIFECYCLE_LABELS: Record<string, string> = {
  SCHEDULED: 'Terjadwal',
  READY: 'Siap Dibuka',
  ACTIVE: 'Berlangsung',
  PAUSED: 'Dijeda',
  ENDED: 'Diakhiri',
};

// Exams being delivered: progress, monitoring, results and the pause, resume and end
// controls (Owner decision 2026-09-30).
const DELIVERY_STATES = new Set(['ACTIVE', 'PAUSED', 'ENDED']);

type ConfirmableAction = 'activate' | 'pause' | 'resume' | 'end';

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
      case 'forbidden': return 'Anda tidak memiliki hak untuk mengelola ujian ini.';
    }
  }
  return 'Gagal memproses permintaan. Periksa koneksi internet Anda dan coba lagi.';
}
import '../styles/teacher-readiness.css';
import '../styles/design-tokens.css';

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
}> = ({ onOpenResults, onOpenMonitoring }) => {
  const [data, setData] = useState<TeacherReadinessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ exam: TeacherExamReadinessProjection; action: ConfirmableAction } | null>(null);

  const fetchReadinessData = useCallback(async () => {
    try {
      const response = await getTeacherReadiness();
      setData(response);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('forbidden');
        } else {
          setError('api_error');
        }
      } else {
        setError('network_error');
      }
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

  if (loading) {
    return (
      <div className="teacher-readiness-container">
        <div className="teacher-state-message">
          <h2 className="teacher-state-title">Memuat data kesiapan ujian...</h2>
          <p>Harap tunggu sebentar.</p>
        </div>
      </div>
    );
  }

  if (error) {
    let title = 'Terjadi Kesalahan';
    let message = 'Gagal memuat data kesiapan ujian. Silakan coba lagi.';

    if (error === 'forbidden') {
      title = 'Akses Ditolak';
      message = 'Anda tidak memiliki hak akses. Pastikan Anda ditugaskan sebagai guru.';
    }

    return (
      <div className="teacher-readiness-container">
        <div className="teacher-state-message">
          <h2 className="teacher-state-title">{title}</h2>
          <p>{message}</p>
          <button className="teacher-refresh-btn" onClick={handleRefresh} disabled={isRefreshing} style={{ marginTop: '16px' }}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const exams = data?.exams || [];

  if (exams.length === 0) {
    return (
      <div className="teacher-readiness-container">
        <div className="teacher-state-message">
          <h2 className="teacher-state-title">Tidak Ada Ujian Terjadwal</h2>
          <p>Anda belum memiliki ujian yang dijadwalkan saat ini.</p>
          <button className="teacher-refresh-btn" onClick={handleRefresh} disabled={isRefreshing} style={{ marginTop: '16px' }}>
            Perbarui Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-readiness-container">
      <div className="teacher-readiness-header">
        <h1 className="teacher-readiness-title">Pelaksanaan Ujian</h1>
        <button
          className="teacher-refresh-btn"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Memperbarui...' : 'Perbarui Data'}
        </button>
      </div>

      <div className="teacher-exams-list">
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

          return (
            <div key={exam.examInstanceId} className="teacher-exam-card" data-testid={`teacher-exam-${exam.examInstanceId}`}>
              <div className="teacher-exam-card-header">
                <h2 className="teacher-exam-subject">{exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}</h2>
                {exam.lifecycleState && (
                  <span className={`teacher-lifecycle-badge lifecycle-${lifecycle.toLowerCase()}`}>{LIFECYCLE_LABELS[lifecycle] ?? lifecycle}</span>
                )}
              </div>
              {exam.windowStartsAt && exam.windowEndsAt && (
                <p className="teacher-exam-window">{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>
              )}

              {DELIVERY_STATES.has(lifecycle) && exam.progress ? (
                <>
                {lifecycle === 'PAUSED' && (
                  <Alert variant="warning" className="mb-3">
                    <IconInfo aria-hidden="true" />
                    <AlertTitle>{exam.pausedAt ? `Ujian dijeda sejak ${formatTime(exam.pausedAt)}` : 'Ujian dijeda'}</AlertTitle>
                    <AlertDescription>Sisa waktu setiap peserta berhenti dan jawaban tidak dapat diubah sampai ujian dilanjutkan.</AlertDescription>
                  </Alert>
                )}
                {lifecycle === 'ENDED' && (
                  <p className="teacher-exam-note">
                    {exam.progress.running
                      ? `Ujian telah diakhiri. ${exam.progress.running} peserta masih mengerjakan sampai waktunya masing-masing habis.`
                      : 'Ujian telah diakhiri. Tidak ada peserta yang masih mengerjakan.'}
                  </p>
                )}
                <dl className="teacher-exam-progress" aria-label="Kemajuan pelaksanaan ujian">
                  <div><dt>Peserta</dt><dd>{exam.progress.participants}</dd></div>
                  <div><dt>Sudah mulai</dt><dd>{exam.progress.started}</dd></div>
                  <div><dt>Dikumpulkan</dt><dd>{exam.progress.submitted}</dd></div>
                  {exam.progress.running !== undefined && (
                    <div><dt>Masih mengerjakan</dt><dd>{exam.progress.running}</dd></div>
                  )}
                </dl>
                {(onOpenResults || onOpenMonitoring) && (
                  <div className="teacher-exam-actions">
                    {onOpenMonitoring && (
                      <Button variant="secondary" onClick={() => onOpenMonitoring(exam.examInstanceId)}>Pantau Peserta</Button>
                    )}
                    {onOpenResults && (
                      <Button variant="secondary" onClick={() => onOpenResults(exam.examInstanceId)}>Lihat Hasil</Button>
                    )}
                  </div>
                )}
                {(lifecycle === 'ACTIVE' || lifecycle === 'PAUSED') && (
                  <div className="teacher-exam-actions teacher-exam-controls" role="group" aria-label="Kendali ujian">
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
                    {actionError && <p className="teacher-action-error" role="alert">{actionError}</p>}
                  </div>
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

              {exam.lifecycleState && (lifecycle === 'SCHEDULED' || lifecycle === 'READY') && (
                <div className="teacher-exam-actions">
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
                  {actionError && <p className="teacher-action-error" role="alert">{actionError}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
    </div>
  );
};
