import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import { AssignedExamDiscovery } from '../components/AssignedExamDiscovery';
import { ProctorMonitoringView } from '../components/ProctorMonitoringView';
import { ApiError, getAssignedExams, getProctorMonitoring, getTeacherReadiness, postStartAttempt, postTeacherExamCancel } from '../api/assessment-client';
import { setDisplayTimeZone } from '../lib/format';
import type { TeacherExamReadinessProjection } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  const mocked: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(actual)) mocked[name] = typeof value === 'function' && name !== 'ApiError' ? vi.fn() : value;
  return mocked;
});

// Cancelling an exam before it opens (ASSESS-TEACHER-003; Owner decision 2026-09-30): only
// scheduled or ready exams, a required reason, one key per dialog; the exam stays in the
// teacher's history as "Dibatalkan" (never the stored state name); a student who still tries
// is told it was cancelled; a proctor sees it cancelled, with nothing to open.

const EXAM = '66666666-6666-4666-8666-666666666666';
const CANCELLED = '77777777-7777-4777-8777-777777777777';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const pass = { baseline: { status: 'baseline_readiness_checks_pass' as const }, roomProctor: { status: 'room_proctor_readiness_not_applicable' as const } };
const exam = (over: Partial<TeacherExamReadinessProjection> = {}): TeacherExamReadinessProjection => ({
  examInstanceId: EXAM, subjectLabel: 'Seni Budaya', groupLabel: 'XII-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
  windowStartsAt: '2026-10-05T01:00:00.000Z', windowEndsAt: '2026-10-05T03:00:00.000Z', durationMinutes: 60, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
  scheduleChangedAt: null, cancellation: null, progress: null, ...pass, ...over,
});
const cancelledExam = exam({
  examInstanceId: CANCELLED, lifecycleState: 'ARCHIVED', baseline: { status: 'not_evaluated' } as never, roomProctor: { status: 'not_evaluated' } as never,
  cancellation: { cancelledAt: '2026-09-30T02:00:00.000Z', reason: 'Bentrok dengan upacara', by: { you: true, elligbleId: 'guru.seni' } },
});

async function openDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Batalkan Ujian' }));
  return screen.findByRole('dialog', { name: 'Batalkan Ujian Ini?' });
}
const confirmButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: /^(Batalkan Ujian|Membatalkan\.\.\.)$/ }) as HTMLButtonElement;

describe('cancelling on the teacher screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  it('asks for a reason, says what cancelling means, and cancels with one key', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(postTeacherExamCancel).mockResolvedValue({ examInstanceId: EXAM, cancelledAt: '2026-09-30T02:00:00.000Z', reason: 'Bentrok dengan upacara', changed: true, replayed: false });
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    expect(within(dialog).getByText(/tidak lagi tampil di daftar ujian siswa/)).toBeTruthy();
    expect(within(dialog).getByText(/Soal, peserta, dan riwayatnya tetap tersimpan/)).toBeTruthy();
    expect(within(dialog).getByText(/tidak dapat diurungkan/)).toBeTruthy();
    expect(within(dialog).getByText('Seni Budaya · XII-1 · Ulangan Harian')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Kembali' })).toBeTruthy();
    expect(confirmButton(dialog).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Alasan pembatalan'), { target: { value: '   ' } });
    expect(confirmButton(dialog).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Alasan pembatalan'), { target: { value: '  Bentrok dengan\n upacara ' } });
    fireEvent.click(confirmButton(dialog));

    expect(await screen.findByText('Ujian Seni Budaya dibatalkan dan tidak lagi tampil untuk siswa.')).toBeTruthy();
    const sent = vi.mocked(postTeacherExamCancel).mock.calls[0][0];
    expect({ ...sent, actionKey: undefined }).toEqual({ examInstanceId: EXAM, reason: 'Bentrok dengan upacara', actionKey: undefined });
    expect(sent.actionKey).toMatch(UUID);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(vi.mocked(getTeacherReadiness).mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('keeps the dialog and the key after a lost connection, and closes with the reason when the exam opened meanwhile', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam({ lifecycleState: 'READY' })] });
    vi.mocked(postTeacherExamCancel)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new ApiError(409, 'invalid_state'));
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Alasan pembatalan'), { target: { value: 'Guru berhalangan' } });
    fireEvent.click(confirmButton(dialog));
    expect(await within(dialog).findByText('Gagal membatalkan ujian. Periksa koneksi internet Anda, lalu coba lagi.')).toBeTruthy();
    fireEvent.click(confirmButton(dialog));
    expect(await screen.findByText('Ujian sudah dibuka, sehingga tidak dapat dibatalkan. Gunakan "Akhiri Ujian" untuk menghentikannya.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    const keys = vi.mocked(postTeacherExamCancel).mock.calls.map(c => c[0].actionKey);
    expect(keys[0]).toBe(keys[1]);
  });

  it('offers no cancellation once the exam is open', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [exam({ lifecycleState: 'ACTIVE', progress: { participants: 3, started: 1, submitted: 0, running: 1 } })],
    });
    render(<TeacherReadinessView />);
    await screen.findByText('Seni Budaya');
    expect(screen.queryByRole('button', { name: 'Batalkan Ujian' })).toBeNull();
  });

  it('keeps a cancelled exam apart as "Dibatalkan", with who, when and why, and nothing to do', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam(), cancelledExam] });
    render(<TeacherReadinessView />);
    const section = (await screen.findByRole('heading', { name: 'Ujian Dibatalkan' })).closest('section')!;
    const card = within(section).getByTestId(`teacher-exam-${CANCELLED}`);
    expect(within(card).getByText('Dibatalkan')).toBeTruthy();
    // The ICU data decides between "2026, 09.00" and "2026 pukul 09.00".
    expect(within(card).getByText(/^Dibatalkan 30 September 2026(,| pukul) 09\.00 WIB oleh Anda\. Alasan: Bentrok dengan upacara$/)).toBeTruthy();
    expect(within(card).queryByRole('button')).toBeNull();
    // The live exam keeps its actions; the stored state name never shows.
    expect(within(screen.getByTestId(`teacher-exam-${EXAM}`)).getByRole('button', { name: 'Batalkan Ujian' })).toBeTruthy();
    expect(document.body.textContent).not.toContain('ARCHIVED');
    expect(document.body.textContent).not.toContain('—');
  });

  it('still shows the history when every exam was cancelled', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [cancelledExam] });
    render(<TeacherReadinessView />);
    expect(await screen.findByText('Tidak ada ujian yang terjadwal atau berlangsung.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ujian Dibatalkan' })).toBeTruthy();
  });
});

describe('a cancelled exam for students and proctors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  it('tells a student on a stale list that the exam was cancelled', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({
      serverNow: '2026-10-05T01:30:00.000Z',
      assignments: [{
        examInstanceId: EXAM, subjectLabel: 'Seni Budaya', roomLabel: null, attempts: [],
        schedule: { lifecycleState: 'ACTIVE', windowStartsAt: '2026-10-05T01:00:00.000Z', windowEndsAt: '2026-10-05T03:00:00.000Z', attemptDurationSeconds: 3600, change: null },
      }],
    } as never);
    vi.mocked(postStartAttempt).mockRejectedValue(new ApiError(409, 'exam_cancelled'));
    render(<AssignedExamDiscovery />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mulai Ujian' }));
    expect(await screen.findByText('Ujian ini dibatalkan oleh guru dan tidak dapat dikerjakan.')).toBeTruthy();
  });

  it('shows a proctor the exam as cancelled, with nothing to open', async () => {
    vi.mocked(getProctorMonitoring).mockResolvedValue({
      assignments: [{
        examInstanceId: EXAM, subjectLabel: 'Seni Budaya', windowStartsAt: '2026-10-05T01:00:00.000Z', windowEndsAt: '2026-10-05T03:00:00.000Z',
        scheduleChange: null, cancelledAt: '2026-09-30T02:00:00.000Z', rooms: [],
      }],
    } as never);
    render(<ProctorMonitoringView onOpenExam={() => {}} />);
    expect(await screen.findByText(/^Ujian ini dibatalkan oleh guru pada 30 September 2026(,| pukul) 09\.00 WIB dan tidak akan dibuka\.$/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lihat Peserta' })).toBeNull();
    expect(document.body.textContent).not.toContain('ARCHIVED');
  });
});
