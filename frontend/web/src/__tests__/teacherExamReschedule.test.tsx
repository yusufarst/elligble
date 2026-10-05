import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import { AssignedExamDiscovery } from '../components/AssignedExamDiscovery';
import { ProctorMonitoringView } from '../components/ProctorMonitoringView';
import { ApiError, getAssignedExams, getProctorMonitoring, getTeacherReadiness, postTeacherExamReschedule } from '../api/assessment-client';
import { setDisplayTimeZone } from '../lib/format';
import type { TeacherExamReadinessProjection } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  const mocked: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(actual)) mocked[name] = typeof value === 'function' && name !== 'ApiError' ? vi.fn() : value;
  return mocked;
});

// Rescheduling before the exam opens (ASSESS-TEACHER-003; D04.2-45/25): the teacher changes
// the window, duration and late-start rule of a scheduled or ready exam in school time; the
// server's refusals are explained; one action key per dialog; students and proctors see
// that the schedule changed.

const EXAM = '44444444-4444-4444-8444-444444444444';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const pass = { baseline: { status: 'baseline_readiness_checks_pass' as const }, roomProctor: { status: 'room_proctor_readiness_not_applicable' as const } };
const exam = (over: Partial<TeacherExamReadinessProjection> = {}): TeacherExamReadinessProjection => ({
  examInstanceId: EXAM, subjectLabel: 'Ekonomi', groupLabel: 'XI-2', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
  windowStartsAt: '2026-10-05T01:00:00.000Z', windowEndsAt: '2026-10-05T03:00:00.000Z', durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
  scheduleChangedAt: null, progress: null, ...pass, ...over,
});
const moved = {
  examInstanceId: EXAM, lifecycleState: 'SCHEDULED', changed: true, replayed: false, changedAt: '2026-09-30T02:00:00.000Z',
  schedule: { windowStartsAt: '2026-10-05T03:00:00.000Z', windowEndsAt: '2026-10-05T05:00:00.000Z', durationMinutes: 60, latestStartPolicy: 'REMAINING_WINDOW_ONLY' as const },
};

async function openDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ubah Jadwal' }));
  return screen.findByRole('dialog', { name: 'Ubah Jadwal Ujian' });
}

describe('rescheduling on the teacher screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  it('starts from the current schedule in school time and saves the new one', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(postTeacherExamReschedule).mockResolvedValue(moved);
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    expect(within(dialog).getByText('Ekonomi · XI-2 · Ulangan Harian')).toBeTruthy();
    expect(within(dialog).getByText(/Peserta dan soal tidak berubah/)).toBeTruthy();
    expect(within(dialog).queryByText(/perlu ditandai siap lagi/)).toBeNull();
    expect((within(dialog).getByLabelText('Mulai (WIB)') as HTMLInputElement).value).toBe('2026-10-05T08:00');
    expect((within(dialog).getByLabelText('Selesai (WIB)') as HTMLInputElement).value).toBe('2026-10-05T10:00');
    expect((within(dialog).getByLabelText('Durasi pengerjaan (menit)') as HTMLInputElement).value).toBe('90');
    expect((within(dialog).getByRole('radio', { name: /Durasi penuh/ }) as HTMLInputElement).checked).toBe(true);

    fireEvent.change(within(dialog).getByLabelText('Mulai (WIB)'), { target: { value: '2026-10-05T10:00' } });
    fireEvent.change(within(dialog).getByLabelText('Selesai (WIB)'), { target: { value: '2026-10-05T12:00' } });
    fireEvent.change(within(dialog).getByLabelText('Durasi pengerjaan (menit)'), { target: { value: '60' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Sampai waktu selesai/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Jadwal' }));

    expect(await screen.findByText('Jadwal Ekonomi diubah menjadi 5 Oktober 2026, 10.00 sampai 12.00 WIB, durasi 60 menit.')).toBeTruthy();
    const sent = vi.mocked(postTeacherExamReschedule).mock.calls[0][0];
    expect({ ...sent, actionKey: undefined }).toEqual({
      examInstanceId: EXAM, windowStartsAt: '2026-10-05T10:00', windowEndsAt: '2026-10-05T12:00', durationMinutes: 60, latestStartPolicy: 'REMAINING_WINDOW_ONLY', actionKey: undefined,
    });
    expect(sent.actionKey).toMatch(UUID);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(vi.mocked(getTeacherReadiness).mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(document.body.textContent).not.toContain('—');
  });

  it('says a ready exam becomes scheduled again and must be marked ready anew', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam({ lifecycleState: 'READY' })] });
    vi.mocked(postTeacherExamReschedule).mockResolvedValue(moved);
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    expect(within(dialog).getByText(/kembali terjadwal dan perlu ditandai siap lagi/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Jadwal' }));
    expect(await screen.findByText(/Ujian kembali terjadwal; tandai siap lagi sebelum dibuka\.$/)).toBeTruthy();
  });

  it('explains every reason the server gives, keeps the dialog, and keeps the key for the next try', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(postTeacherExamReschedule)
      .mockRejectedValueOnce(new ApiError(422, 'reschedule_invalid', undefined, { problems: [{ code: 'schedule_conflict' }, { code: 'duration_exceeds_window' }] }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ...moved, replayed: true });
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Jadwal' }));
    expect(await within(dialog).findByText('Ada peserta yang sudah dijadwalkan pada ujian lain yang waktunya bertabrakan. Pilih waktu lain.')).toBeTruthy();
    expect(within(dialog).getByText(/Durasi pengerjaan lebih panjang dari waktu pelaksanaan/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Jadwal' }));
    expect(await within(dialog).findByText('Gagal menyimpan jadwal. Periksa koneksi internet Anda, lalu coba lagi.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Jadwal' }));
    expect(await screen.findByText('Jadwal Ekonomi sudah diubah sebelumnya menjadi 5 Oktober 2026, 10.00 sampai 12.00 WIB.')).toBeTruthy();
    const keys = vi.mocked(postTeacherExamReschedule).mock.calls.map(c => c[0].actionKey);
    expect(new Set(keys).size).toBe(1);
  });

  it('closes with the reason when the exam already opened, and offers no change once it has', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(postTeacherExamReschedule).mockRejectedValue(new ApiError(409, 'invalid_state'));
    const view = render(<TeacherReadinessView />);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Jadwal' }));
    expect(await screen.findByText('Ujian sudah dibuka, sehingga jadwalnya tidak dapat diubah lagi.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();

    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [exam({ lifecycleState: 'ACTIVE', progress: { participants: 3, started: 1, submitted: 0, running: 1 } })],
    });
    render(<TeacherReadinessView />);
    await screen.findByText('Ekonomi');
    expect(screen.queryByRole('button', { name: 'Ubah Jadwal' })).toBeNull();
  });

  it('notes on the card when the schedule was changed', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam({ scheduleChangedAt: '2026-09-30T02:00:00.000Z' })] });
    render(<TeacherReadinessView />);
    // The ICU data decides between "2026, 09.00" and "2026 pukul 09.00".
    expect(await screen.findByText(/^Jadwal diubah 30 September 2026(,| pukul) 09\.00 WIB\.$/)).toBeTruthy();
  });
});

describe('students and proctors see that the schedule changed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  const change = { changedAt: '2026-09-30T02:00:00.000Z', previousWindowStartsAt: '2026-10-05T01:00:00.000Z', previousWindowEndsAt: '2026-10-05T03:00:00.000Z' };

  it('on the student card until the student starts', async () => {
    const assignment = {
      examInstanceId: EXAM, subjectLabel: 'Ekonomi', roomLabel: null, attempts: [],
      schedule: { lifecycleState: 'SCHEDULED', windowStartsAt: '2026-10-05T03:00:00.000Z', windowEndsAt: '2026-10-05T05:00:00.000Z', attemptDurationSeconds: 3600, change },
    };
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: '2026-09-30T03:00:00.000Z', assignments: [assignment] } as never);
    const view = render(<AssignedExamDiscovery />);
    expect(await screen.findByText(
      /^Jadwal diubah oleh guru pada 30 September 2026(,| pukul) 09\.00 WIB\. Jadwal sebelumnya: 5 Oktober 2026, 08\.00 sampai 10\.00 WIB\.$/
    )).toBeTruthy();
    expect(screen.getByText('5 Oktober 2026, 10.00 sampai 12.00 WIB')).toBeTruthy();
    view.unmount();

    vi.mocked(getAssignedExams).mockResolvedValue({
      serverNow: '2026-10-05T03:30:00.000Z',
      assignments: [{ ...assignment, schedule: { ...assignment.schedule, lifecycleState: 'ACTIVE' }, attempts: [{ attemptId: '55555555-5555-4555-8555-555555555555', submittedAt: null }] }],
    } as never);
    render(<AssignedExamDiscovery />);
    await screen.findByText('Ekonomi');
    expect(screen.queryByText(/Jadwal diubah/)).toBeNull();
  });

  it('on the proctor list, with the new window', async () => {
    vi.mocked(getProctorMonitoring).mockResolvedValue({
      assignments: [{ examInstanceId: EXAM, subjectLabel: 'Ekonomi', windowStartsAt: '2026-10-05T03:00:00.000Z', windowEndsAt: '2026-10-05T05:00:00.000Z', scheduleChange: change, rooms: [] }],
    } as never);
    render(<ProctorMonitoringView />);
    expect(await screen.findByText('5 Oktober 2026, 10.00 sampai 12.00 WIB')).toBeTruthy();
    expect(screen.getByText(/^Jadwal diubah pada 30 September 2026(,| pukul) 09\.00 WIB\. Jadwal sebelumnya: 5 Oktober 2026, 08\.00 sampai 10\.00 WIB\.$/)).toBeTruthy();
  });
});
