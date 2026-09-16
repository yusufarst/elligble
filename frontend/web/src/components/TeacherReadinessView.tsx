import React, { useState, useEffect, useCallback } from 'react';
import { getTeacherReadiness, ApiError } from '../api/assessment-client.ts';
import type { TeacherReadinessResponse, TeacherExamReadinessProjection } from '../types/assessment.ts';
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

export const TeacherReadinessView: React.FC = () => {
  const [data, setData] = useState<TeacherReadinessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

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
        <h1 className="teacher-readiness-title">Kesiapan Ujian</h1>
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

          return (
            <div key={exam.examInstanceId} className="teacher-exam-card">
              <div className="teacher-exam-card-header">
                <h2 className="teacher-exam-subject">{exam.subjectLabel ?? 'Informasi mata pelajaran tidak tersedia'}</h2>
              </div>

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
            </div>
          );
        })}
      </div>
    </div>
  );
};
