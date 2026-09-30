import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeacherReadinessView } from '../components/TeacherReadinessView.tsx';
import type { TeacherExamReadinessProjection } from '../types/assessment.ts';

vi.mock('../api/assessment-client.ts', () => ({
  getTeacherReadiness: vi.fn(),
  postTeacherExamTransition: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message?: string, public data?: any) {
      super(message || code);
    }
  },
}));

import { getTeacherReadiness, postTeacherExamTransition, ApiError } from '../api/assessment-client.ts';
import { setDisplayTimeZone } from '../lib/format.ts';

const EXAM = '33333333-3333-4333-8333-333333333333';
const pass = { baseline: { status: 'baseline_readiness_checks_pass' as const }, roomProctor: { status: 'room_proctor_readiness_not_applicable' as const } };
const exam = (over: Partial<TeacherExamReadinessProjection>): TeacherExamReadinessProjection => ({
  examInstanceId: EXAM,
  subjectLabel: 'Fisika',
  lifecycleState: 'SCHEDULED',
  windowStartsAt: '2026-09-29T01:00:00.000Z',
  windowEndsAt: '2026-09-29T03:00:00.000Z',
  progress: null,
  ...pass,
  ...over,
});

describe('teacher exam operations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks a ready-to-go scheduled exam as READY and reloads', async () => {
    vi.mocked(getTeacherReadiness)
      .mockResolvedValueOnce({ exams: [exam({})] })
      .mockResolvedValueOnce({ exams: [exam({ lifecycleState: 'READY' })] });
    vi.mocked(postTeacherExamTransition).mockResolvedValue({ examInstanceId: EXAM, lifecycleState: 'READY' });
    render(<TeacherReadinessView />);
    expect(await screen.findByText('Terjadwal')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Tandai Siap' }));
    await waitFor(() => expect(postTeacherExamTransition).toHaveBeenCalledWith(EXAM, 'mark_ready'));
    expect(await screen.findByText('Siap Dibuka')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Buka Ujian' })).toBeDefined();
  });

  it('cannot mark an exam ready while readiness fails', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [exam({ baseline: { status: 'not_ready', blocker: 'question_snapshot_empty' } })],
    });
    render(<TeacherReadinessView />);
    const button = await screen.findByRole('button', { name: 'Tandai Siap' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Soal ujian belum ditambahkan')).toBeDefined();
  });

  it('asks for confirmation before opening a READY exam to participants', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam({ lifecycleState: 'READY' })] });
    vi.mocked(postTeacherExamTransition).mockResolvedValue({ examInstanceId: EXAM, lifecycleState: 'ACTIVE' });
    render(<TeacherReadinessView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buka Ujian' }));
    expect(await screen.findByRole('heading', { name: 'Buka Ujian untuk Peserta?' })).toBeDefined();
    expect(postTeacherExamTransition).not.toHaveBeenCalled();
    const dialogButtons = screen.getAllByRole('button', { name: 'Buka Ujian' });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]);
    await waitFor(() => expect(postTeacherExamTransition).toHaveBeenCalledWith(EXAM, 'activate'));
  });

  it('explains why an exam cannot be opened yet', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam({ lifecycleState: 'READY' })] });
    vi.mocked(postTeacherExamTransition).mockRejectedValue(
      new (ApiError as any)(409, 'window_not_started', undefined, { error: 'window_not_started', windowStartsAt: '2026-09-29T01:00:00.000Z' })
    );
    render(<TeacherReadinessView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buka Ujian' }));
    const dialogButtons = await screen.findAllByRole('button', { name: 'Buka Ujian' });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]);
    expect(await screen.findByText(/^Ujian baru dapat dibuka mulai /)).toBeDefined();
  });

  it('shows aggregate progress for an ACTIVE exam without actions or identities', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [exam({
        lifecycleState: 'ACTIVE',
        baseline: { status: 'not_evaluated' },
        roomProctor: { status: 'not_evaluated' },
        progress: { participants: 32, started: 30, submitted: 4 },
      })],
    });
    render(<TeacherReadinessView />);
    expect(await screen.findByText('Berlangsung')).toBeDefined();
    const progress = screen.getByLabelText('Kemajuan pelaksanaan ujian');
    expect(progress.textContent).toContain('32');
    expect(progress.textContent).toContain('30');
    expect(progress.textContent).toContain('4');
    expect(screen.queryByRole('button', { name: 'Tandai Siap' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Buka Ujian' })).toBeNull();
  });
});

// Pause, resume and end (Owner decision 2026-09-30): the managing teacher controls a running
// exam; every change is confirmed first and repeats nothing on the server.
describe('pausing, resuming and ending a running exam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });

  const progress = { participants: 30, started: 28, submitted: 3, running: 25 };
  const lastDialogButton = (name: string) => {
    const buttons = screen.getAllByRole('button', { name });
    return buttons[buttons.length - 1];
  };

  it('pauses after confirmation and then shows since when the exam is paused', async () => {
    vi.mocked(getTeacherReadiness)
      .mockResolvedValueOnce({ exams: [exam({ lifecycleState: 'ACTIVE', progress })] })
      .mockResolvedValueOnce({ exams: [exam({ lifecycleState: 'PAUSED', pausedAt: '2026-09-29T01:14:00.000Z', progress })] });
    vi.mocked(postTeacherExamTransition).mockResolvedValue({ examInstanceId: EXAM, lifecycleState: 'PAUSED', changed: true });
    render(<TeacherReadinessView />);
    expect(await screen.findByText('Masih mengerjakan')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Jeda Ujian' }));
    expect(await screen.findByRole('heading', { name: 'Jeda Ujian untuk Semua Peserta?' })).toBeDefined();
    expect(screen.getByText(/Sisa waktu setiap peserta berhenti tepat saat ujian dijeda/)).toBeDefined();
    expect(postTeacherExamTransition).not.toHaveBeenCalled();
    fireEvent.click(lastDialogButton('Jeda Ujian'));
    await waitFor(() => expect(postTeacherExamTransition).toHaveBeenCalledWith(EXAM, 'pause'));
    expect(await screen.findByText('Ujian dijeda sejak 08.14 WIB')).toBeDefined();
    expect(screen.getByText('Dijeda')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Lanjutkan Ujian' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Akhiri Ujian' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jeda Ujian' })).toBeNull();
    expect(document.body.textContent).not.toContain('\u2014');
  });

  it('resumes a paused exam after confirmation', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam({ lifecycleState: 'PAUSED', pausedAt: '2026-09-29T01:14:00.000Z', progress })] });
    vi.mocked(postTeacherExamTransition).mockResolvedValue({ examInstanceId: EXAM, lifecycleState: 'ACTIVE', changed: true });
    render(<TeacherReadinessView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lanjutkan Ujian' }));
    expect(await screen.findByRole('heading', { name: 'Lanjutkan Ujian?' })).toBeDefined();
    fireEvent.click(lastDialogButton('Lanjutkan Ujian'));
    await waitFor(() => expect(postTeacherExamTransition).toHaveBeenCalledWith(EXAM, 'resume'));
  });

  it('ends an exam only after the consequences are confirmed, and says who is still working', async () => {
    vi.mocked(getTeacherReadiness)
      .mockResolvedValueOnce({ exams: [exam({ lifecycleState: 'ACTIVE', progress })] })
      .mockResolvedValueOnce({ exams: [exam({ lifecycleState: 'ENDED', progress })] });
    vi.mocked(postTeacherExamTransition).mockResolvedValue({ examInstanceId: EXAM, lifecycleState: 'ENDED', changed: true });
    const onOpenResults = vi.fn();
    render(<TeacherReadinessView onOpenResults={onOpenResults} onOpenMonitoring={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Akhiri Ujian' }));
    expect(await screen.findByRole('heading', { name: 'Akhiri Ujian?' })).toBeDefined();
    expect(screen.getByText(/tetap dapat menyelesaikan sampai waktunya masing-masing habis/)).toBeDefined();
    expect(screen.getByText(/Nilai tidak otomatis terlihat oleh siswa/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(postTeacherExamTransition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Akhiri Ujian' }));
    fireEvent.click(lastDialogButton('Akhiri Ujian'));
    await waitFor(() => expect(postTeacherExamTransition).toHaveBeenCalledWith(EXAM, 'end'));
    expect(await screen.findByText('Ujian telah diakhiri. 25 peserta masih mengerjakan sampai waktunya masing-masing habis.')).toBeDefined();
    expect(screen.getByText('Diakhiri')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Akhiri Ujian' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jeda Ujian' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat Hasil' }));
    expect(onOpenResults).toHaveBeenCalledWith(EXAM);
  });
});
