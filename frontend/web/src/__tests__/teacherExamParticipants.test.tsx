import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import { ApiError, getTeacherExamParticipantCandidates, getTeacherReadiness, postTeacherExamAddParticipants } from '../api/assessment-client';
import { setDisplayTimeZone } from '../lib/format';
import type { TeacherExamParticipantCandidates, TeacherExamReadinessProjection } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  const mocked: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(actual)) mocked[name] = typeof value === 'function' && name !== 'ApiError' ? vi.fn() : value;
  return mocked;
});

// Adding participants after scheduling (ASSESS-TEACHER-004, D04.2-64): the class's students
// who are not participants yet, conflicts shown and not choosable, one key per dialog, a ready
// exam announced to be marked ready again, refusals explained with the list read again, and
// no way to remove anyone.

const EXAM = '88888888-8888-4888-8888-888888888888';
const E1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const E2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const E3 = 'aaaaaaaa-0000-4000-8000-000000000003';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const pass = { baseline: { status: 'baseline_readiness_checks_pass' as const }, roomProctor: { status: 'room_proctor_readiness_not_applicable' as const } };
const exam = (over: Partial<TeacherExamReadinessProjection> = {}): TeacherExamReadinessProjection => ({
  examInstanceId: EXAM, subjectLabel: 'Biologi', groupLabel: 'XI-2', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
  windowStartsAt: '2026-10-05T01:00:00.000Z', windowEndsAt: '2026-10-05T03:00:00.000Z', durationMinutes: 60, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
  scheduleChangedAt: null, cancellation: null, progress: null, participants: 5, participantsAddedAt: null, ...pass, ...over,
});
const offer = (over: Partial<TeacherExamParticipantCandidates> = {}): TeacherExamParticipantCandidates => ({
  examInstanceId: EXAM, lifecycleState: 'SCHEDULED', examDay: '2026-10-05', participantCount: 5,
  candidates: [
    { enrollmentId: E1, elligbleId: 'siswa.bio.06', conflict: false },
    { enrollmentId: E2, elligbleId: 'siswa.bio.07', conflict: false },
    { enrollmentId: E3, elligbleId: 'siswa.bio.08', conflict: true },
  ],
  problems: [],
  ...over,
});

async function openDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Tambah Peserta' }));
  return screen.findByRole('dialog', { name: 'Tambah Peserta' });
}
const addButton = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: /^(Tambahkan( \d+)? Peserta|Menambahkan\.\.\.)$/ }) as HTMLButtonElement;
const box = (dialog: HTMLElement, elligbleId: string) => within(dialog).getByRole('checkbox', { name: new RegExp(elligbleId.replace(/\./g, '\\.')) }) as HTMLInputElement;

describe('adding participants on the teacher screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  it('offers the class students who are not participants, keeps conflicts out, and adds the chosen ones with one key', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(getTeacherExamParticipantCandidates).mockResolvedValue(offer());
    vi.mocked(postTeacherExamAddParticipants).mockResolvedValue({
      examInstanceId: EXAM, lifecycleState: 'SCHEDULED', addedAt: '2026-09-30T02:00:00.000Z', replayed: false,
      added: [{ enrollmentId: E1, elligbleId: 'siswa.bio.06' }, { enrollmentId: E2, elligbleId: 'siswa.bio.07' }],
    });
    render(<TeacherReadinessView />);
    expect(await screen.findByText('5 peserta')).toBeTruthy();
    const dialog = await openDialog();
    expect(within(dialog).getByText(/Peserta yang sudah ditambahkan tidak dapat dihapus di aplikasi/)).toBeTruthy();
    expect(within(dialog).getByText('Biologi · XI-2 · Ulangan Harian')).toBeTruthy();
    expect(await within(dialog).findByText('Peserta saat ini: 5')).toBeTruthy();
    expect(within(dialog).queryByText(/sudah ditandai siap/)).toBeNull();
    expect(vi.mocked(getTeacherExamParticipantCandidates)).toHaveBeenCalledWith(EXAM);

    // A student expected elsewhere at the same time cannot be chosen.
    expect(box(dialog, 'siswa.bio.08').disabled).toBe(true);
    expect(within(dialog).getByText('Bentrok jadwal')).toBeTruthy();
    expect(within(dialog).getByText(/tidak dapat ditambahkan/)).toBeTruthy();
    expect(addButton(dialog).disabled).toBe(true);
    fireEvent.click(box(dialog, 'siswa.bio.06'));
    expect(addButton(dialog).textContent).toBe('Tambahkan 1 Peserta');
    fireEvent.click(box(dialog, 'siswa.bio.07'));
    fireEvent.click(box(dialog, 'siswa.bio.08'));
    expect(addButton(dialog).textContent).toBe('Tambahkan 2 Peserta');
    fireEvent.click(addButton(dialog));

    expect(await screen.findByText('2 peserta ditambahkan ke ujian Biologi.')).toBeTruthy();
    const sent = vi.mocked(postTeacherExamAddParticipants).mock.calls[0][0];
    expect({ ...sent, actionKey: undefined }).toEqual({ examInstanceId: EXAM, enrollmentIds: [E1, E2], actionKey: undefined });
    expect(sent.actionKey).toMatch(UUID);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(vi.mocked(getTeacherReadiness).mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('tells the teacher of a ready exam that it must be marked ready again, before and after adding', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam({ lifecycleState: 'READY' })] });
    vi.mocked(getTeacherExamParticipantCandidates).mockResolvedValue(offer({ lifecycleState: 'READY' }));
    vi.mocked(postTeacherExamAddParticipants).mockResolvedValue({
      examInstanceId: EXAM, lifecycleState: 'SCHEDULED', addedAt: '2026-09-30T02:00:00.000Z', replayed: false,
      added: [{ enrollmentId: E2, elligbleId: 'siswa.bio.07' }],
    });
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    expect(within(dialog).getByText(/Ujian ini sudah ditandai siap\. Setelah peserta ditambahkan, ujian kembali berstatus Terjadwal/)).toBeTruthy();
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /siswa\.bio\.07/ }));
    fireEvent.click(addButton(dialog));
    expect(await screen.findByText('1 peserta ditambahkan ke ujian Biologi. Tandai siap lagi sebelum membuka ujian.')).toBeTruthy();
  });

  it('keeps the dialog and the key after a lost connection or a refusal, reading the list again after a refusal', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(getTeacherExamParticipantCandidates)
      .mockResolvedValueOnce(offer())
      // Meanwhile siswa.bio.07 was scheduled in another exam at the same time.
      .mockResolvedValueOnce(offer({ candidates: [
        { enrollmentId: E1, elligbleId: 'siswa.bio.06', conflict: false },
        { enrollmentId: E2, elligbleId: 'siswa.bio.07', conflict: true },
      ] }));
    vi.mocked(postTeacherExamAddParticipants)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new ApiError(422, 'participants_invalid', undefined, { error: 'participants_invalid', problems: [{ code: 'schedule_conflict', count: 1 }] }))
      .mockResolvedValueOnce({
        examInstanceId: EXAM, lifecycleState: 'SCHEDULED', addedAt: '2026-09-30T02:00:00.000Z', replayed: false,
        added: [{ enrollmentId: E1, elligbleId: 'siswa.bio.06' }],
      });
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /siswa\.bio\.06/ }));
    fireEvent.click(box(dialog, 'siswa.bio.07'));
    fireEvent.click(addButton(dialog));
    expect(await within(dialog).findByText('Gagal menambahkan peserta. Periksa koneksi internet Anda, lalu coba lagi.')).toBeTruthy();

    fireEvent.click(addButton(dialog));
    expect(await within(dialog).findByText('Tidak ada siswa yang ditambahkan')).toBeTruthy();
    expect(within(dialog).getByText('1 siswa sudah dijadwalkan pada ujian lain di waktu yang sama.')).toBeTruthy();
    // The list was read again: the conflicting student is no longer chosen.
    await waitFor(() => expect(box(dialog, 'siswa.bio.07').disabled).toBe(true));
    expect(box(dialog, 'siswa.bio.06').checked).toBe(true);
    expect(addButton(dialog).textContent).toBe('Tambahkan 1 Peserta');

    fireEvent.click(addButton(dialog));
    expect(await screen.findByText('1 peserta ditambahkan ke ujian Biologi.')).toBeTruthy();
    const calls = vi.mocked(postTeacherExamAddParticipants).mock.calls.map(c => c[0]);
    expect(calls.map(c => c.enrollmentIds)).toEqual([[E1, E2], [E1, E2], [E1]]);
    expect(new Set(calls.map(c => c.actionKey)).size).toBe(1);
  });

  it('closes with the reason when the exam opened meanwhile', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(getTeacherExamParticipantCandidates).mockResolvedValue(offer());
    vi.mocked(postTeacherExamAddParticipants).mockRejectedValueOnce(new ApiError(409, 'invalid_state'));
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /siswa\.bio\.06/ }));
    fireEvent.click(addButton(dialog));
    expect(await screen.findByText('Ujian sudah dibuka, sehingga peserta tidak dapat ditambahkan lagi.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says when everyone already takes part, and why nobody can be added to an exam run with rooms', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(getTeacherExamParticipantCandidates)
      .mockResolvedValueOnce(offer({ candidates: [] }))
      .mockResolvedValueOnce(offer({ candidates: [], problems: [{ code: 'rooms_in_use' }] }));
    render(<TeacherReadinessView />);
    let dialog = await openDialog();
    expect(await within(dialog).findByText('Semua siswa yang terdaftar di kelas ini pada hari ujian sudah menjadi peserta.')).toBeTruthy();
    expect(addButton(dialog).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    dialog = await openDialog();
    expect(await within(dialog).findByText('Peserta belum dapat ditambahkan')).toBeTruthy();
    expect(within(dialog).getByText(/Penambahan peserta beserta ruangnya belum tersedia di aplikasi/)).toBeTruthy();
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect(addButton(dialog).disabled).toBe(true);
  });

  it('offers to try loading again', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam()] });
    vi.mocked(getTeacherExamParticipantCandidates).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(offer());
    render(<TeacherReadinessView />);
    const dialog = await openDialog();
    expect(await within(dialog).findByText('Gagal Memuat Daftar Siswa')).toBeTruthy();
    expect(within(dialog).getByText('Periksa koneksi internet Anda, lalu coba lagi.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Coba Lagi' }));
    expect(await within(dialog).findByRole('checkbox', { name: /siswa\.bio\.06/ })).toBeTruthy();
  });

  it('offers no addition once the exam is open, and notes on the card when participants were added', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [
      exam({ lifecycleState: 'ACTIVE', progress: { participants: 5, started: 1, submitted: 0, running: 1 } }),
    ] });
    const { unmount } = render(<TeacherReadinessView />);
    expect(await screen.findByText('Berlangsung')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tambah Peserta' })).toBeNull();
    unmount();

    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam({ participants: 7, participantsAddedAt: '2026-09-30T02:00:00.000Z' })] });
    render(<TeacherReadinessView />);
    expect(await screen.findByText('7 peserta')).toBeTruthy();
    expect(screen.getByText(/^Peserta ditambahkan 30 September 2026(,| pukul) 09\.00 WIB\.$/)).toBeTruthy();
  });
});
