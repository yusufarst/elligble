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
