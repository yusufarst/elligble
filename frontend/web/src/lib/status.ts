import type { StatusTone } from '@/components/ui/status-badge';
import type { MonitoredParticipant, ParticipantResult } from '../types/assessment.ts';

// The words and tones of every state shown in a status badge (plan §10.1.7, UI-SYSTEM-003):
// one place, so a state reads and looks the same for the student, the teacher and the
// proctor. Running now is "active" everywhere; time running out is "danger" and saved or
// submitted is "success" (FRONTEND_DESIGN_SYSTEM §27); paused and locked need attention
// ("warning"); scheduled, ended, cancelled and not started are at rest ("neutral").

export interface StatusView {
  label: string;
  tone: StatusTone;
}

const EXAM_LIFECYCLE: Record<string, StatusView> = {
  SCHEDULED: { label: 'Terjadwal', tone: 'neutral' },
  READY: { label: 'Siap Dibuka', tone: 'info' },
  ACTIVE: { label: 'Berlangsung', tone: 'active' },
  PAUSED: { label: 'Dijeda', tone: 'warning' },
  ENDED: { label: 'Diakhiri', tone: 'neutral' },
  FINALIZED: { label: 'Hasil Final', tone: 'success' },
  // Never the raw state name on screen; a cancelled exam is shown as "Dibatalkan" instead.
  ARCHIVED: { label: 'Diarsipkan', tone: 'neutral' },
};

/** An exam's lifecycle as teachers and proctors see it. */
export function examLifecycleStatus(state: string): StatusView {
  return EXAM_LIFECYCLE[state] ?? { label: state, tone: 'neutral' };
}

export const CANCELLED_EXAM_STATUS: StatusView = { label: 'Dibatalkan', tone: 'neutral' };

function submittedAutomatically(source: string | null | undefined): boolean {
  return source === 'EXPIRY_CLIENT' || source === 'EXPIRY_SERVER';
}

/** A participant during the exam (monitoring, message recipients). */
export function participantStatus(p: Pick<MonitoredParticipant, 'status' | 'finalizationSource'>): StatusView {
  switch (p.status) {
    case 'SUBMITTED':
      return submittedAutomatically(p.finalizationSource)
        ? { label: 'Dikumpulkan otomatis', tone: 'neutral' }
        : { label: 'Dikumpulkan', tone: 'success' };
    case 'ACTIVE':
      return { label: 'Mengerjakan', tone: 'active' };
    case 'TIME_UP':
      return { label: 'Waktu habis', tone: 'danger' };
    case 'NOT_STARTED':
      return { label: 'Belum mulai', tone: 'neutral' };
  }
}

/** A supervisor locked this participant's work (D04.6-38). */
export const LOCKED_PARTICIPANT_STATUS: StatusView = { label: 'Dikunci', tone: 'warning' };

/** A participant in the results and their export. */
export function resultStatus(row: Pick<ParticipantResult, 'status' | 'finalizationSource'>): StatusView {
  switch (row.status) {
    case 'SUBMITTED':
      return submittedAutomatically(row.finalizationSource)
        ? { label: 'Dikumpulkan otomatis', tone: 'neutral' }
        : { label: 'Dikumpulkan', tone: 'success' };
    case 'IN_PROGRESS':
      return { label: 'Sedang mengerjakan', tone: 'active' };
    case 'NOT_STARTED':
      return { label: 'Belum mulai', tone: 'neutral' };
    case 'ABSENT':
      return { label: 'Tidak mengerjakan', tone: 'neutral' };
  }
}

/** The student's own submitted attempt on their exam list. */
export const SUBMITTED_ATTEMPT_STATUS: StatusView = { label: 'Sudah dikumpulkan', tone: 'success' };

/** The question preparation of an institution exam (ASSESS-INSTITUTION-001 §4.6). */
export function preparationStatus(preparation: { closed: boolean; questionCount: number }): StatusView {
  if (preparation.closed) return { label: 'Penyiapan ditutup', tone: 'neutral' };
  if (preparation.questionCount === 0) return { label: 'Belum ada soal', tone: 'warning' };
  return { label: `Soal disiapkan: ${preparation.questionCount} soal`, tone: 'info' };
}

// The readiness blockers as teachers and the School Operator read them (moved from the teacher list).

export function baselineBlockerText(blocker?: string): string {
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
}

export function roomProctorBlockerText(blocker?: string): string {
  switch (blocker) {
    case 'room_proctor_requirement_policy_unconfigured': return 'Kebijakan ruangan dan pengawas belum diatur';
    case 'participant_empty': return 'Belum ada peserta yang terdaftar';
    case 'exam_room_empty': return 'Belum ada ruangan yang ditetapkan';
    case 'participant_room_assignment_incomplete': return 'Penugasan peserta ke ruangan belum lengkap';
    case 'active_proctor_assignment_empty': return 'Belum ada pengawas yang ditugaskan';
    case 'active_proctor_room_coverage_incomplete': return 'Cakupan pengawas untuk ruangan belum lengkap';
    default: return 'Persyaratan ruangan dan pengawas belum lengkap';
  }
}

export interface ReadinessResult {
  baseline: { status: string; blocker?: string };
  roomProctor: { status: string; blocker?: string };
}

/** All mandatory readiness checks pass. */
export function readinessPasses(readiness: ReadinessResult): boolean {
  return readiness.baseline.status === 'baseline_readiness_checks_pass'
    && (readiness.roomProctor.status === 'room_proctor_readiness_ready' || readiness.roomProctor.status === 'room_proctor_readiness_not_applicable');
}

/** The first readiness blocker in words, or null when every check passes. */
export function readinessBlockerMessage(readiness: ReadinessResult): string | null {
  if (readinessPasses(readiness)) return null;
  if (readiness.baseline.status !== 'baseline_readiness_checks_pass') return baselineBlockerText(readiness.baseline.blocker);
  return roomProctorBlockerText(readiness.roomProctor.blocker);
}
