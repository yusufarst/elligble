import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ExamMonitoringView } from '../components/ExamMonitoringView';
import { ProctorMonitoringView } from '../components/ProctorMonitoringView';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import { ApiError, getExamMonitoring, getProctorMonitoring, getTeacherReadiness } from '../api/assessment-client';
import { setDisplayTimeZone } from '../lib/format';
import type { ExamMonitoringResponse } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return { ...actual, getExamMonitoring: vi.fn(), getProctorMonitoring: vi.fn(), getTeacherReadiness: vi.fn() };
});

const EXAM = '5f0c7b8e-1d2a-4c3b-8e9f-0a1b2c3d4e5f';

function monitoring(overrides: Partial<ExamMonitoringResponse> = {}): ExamMonitoringResponse {
  return {
    exam: { examInstanceId: EXAM, subjectLabel: 'Matematika Wajib', lifecycleState: 'ACTIVE', roomBased: false },
    scope: 'PROCTOR',
    serverTime: '2026-09-30T01:14:07.000Z',
    questionCount: 3,
    summary: { participants: 4, notStarted: 1, active: 2, submitted: 1 },
    participants: [
      { elligbleId: 'siswa.a', roomLabel: null, status: 'SUBMITTED', finalizationSource: 'STUDENT_SUBMIT', submittedAt: '2026-09-30T01:05:00.000Z', remainingSeconds: null, answeredCount: 3, lastAcceptedAt: '2026-09-30T01:04:00.000Z', sessionActive: false, sessionMoves: 0 },
      { elligbleId: 'siswa.b', roomLabel: null, status: 'ACTIVE', finalizationSource: null, submittedAt: null, remainingSeconds: 2530, answeredCount: 1, lastAcceptedAt: '2026-09-30T01:12:00.000Z', sessionActive: true, sessionMoves: 1 },
      { elligbleId: 'siswa.c', roomLabel: null, status: 'NOT_STARTED', finalizationSource: null, submittedAt: null, remainingSeconds: null, answeredCount: 0, lastAcceptedAt: null, sessionActive: false, sessionMoves: 0 },
      { elligbleId: 'siswa.d', roomLabel: null, status: 'TIME_UP', finalizationSource: null, submittedAt: null, remainingSeconds: 0, answeredCount: 2, lastAcceptedAt: '2026-09-30T00:59:00.000Z', sessionActive: true, sessionMoves: 0 },
    ],
    ...overrides,
  };
}

const ids = () => screen.getAllByRole('rowheader').map(h => h.firstChild?.textContent);

describe('ExamMonitoringView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  it('lists who is expected, working, finished or moved, from server facts only', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring());
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali ke Monitoring Ujian" onBack={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Pemantauan Peserta' })).toBeTruthy();
    expect(getExamMonitoring).toHaveBeenCalledWith(EXAM);
    expect(screen.getByText('Diperbarui 08.14.07 WIB. Diperbarui otomatis.')).toBeTruthy();
    expect(ids()).toEqual(['siswa.a', 'siswa.b', 'siswa.c', 'siswa.d']);

    const [a, b, c, d] = screen.getAllByRole('rowheader').map(h => h.closest('tr')!);
    expect(within(a).getByText('Dikumpulkan')).toBeTruthy();
    expect(within(a).getByText('3/3')).toBeTruthy();
    expect(within(b).getByText('Mengerjakan')).toBeTruthy();
    expect(within(b).getByText('42 menit')).toBeTruthy();
    expect(within(b).getByText('Pindah perangkat 1 kali')).toBeTruthy();
    expect(within(b).getByText('diterima 08.12 WIB')).toBeTruthy();
    expect(within(c).getByText('Belum mulai')).toBeTruthy();
    expect(within(c).getByText('Belum ada')).toBeTruthy();
    expect(within(d).getAllByText('Waktu habis')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/nilai|skor|curang\b/i);
    expect(document.body.textContent).not.toContain('—');
  });

  it('filters by status and finds a participant by ELLIGBLE ID', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring());
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'Pemantauan Peserta' });
    fireEvent.click(screen.getByRole('button', { name: 'Mengerjakan' }));
    expect(ids()).toEqual(['siswa.b', 'siswa.d']);
    expect(screen.getByRole('button', { name: 'Mengerjakan' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Semua' }));
    fireEvent.change(screen.getByLabelText('Cari ELLIGBLE ID'), { target: { value: 'SISWA.C ' } });
    expect(ids()).toEqual(['siswa.c']);
    fireEvent.change(screen.getByLabelText('Cari ELLIGBLE ID'), { target: { value: 'tidak.ada' } });
    expect(screen.getByText('Tidak ada peserta yang cocok.')).toBeTruthy();
  });

  it('refreshes by itself and keeps the last data, marked as delayed, when a refresh fails', async () => {
    vi.mocked(getExamMonitoring)
      .mockResolvedValueOnce(monitoring())
      .mockRejectedValue(new TypeError('Failed to fetch'));
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} refreshIntervalMs={30} />);
    await screen.findByRole('heading', { name: 'Pemantauan Peserta' });
    expect(await screen.findByText('Pemantauan tertunda')).toBeTruthy();
    expect(screen.getByText(/data terakhir pukul 08\.14\.07 WIB/)).toBeTruthy();
    expect(ids()).toHaveLength(4);
    await waitFor(() => expect(vi.mocked(getExamMonitoring).mock.calls.length).toBeGreaterThan(2));
  });

  it('says when the exam is paused or has ended', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring({
      exam: { examInstanceId: EXAM, subjectLabel: 'Matematika Wajib', lifecycleState: 'PAUSED', roomBased: false, pausedAt: '2026-09-30T01:10:00.000Z' },
    }));
    const paused = render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    expect(await screen.findByText('Ujian dijeda sejak 08.10 WIB')).toBeTruthy();
    expect(screen.getByText(/Sisa waktu peserta berhenti/)).toBeTruthy();
    paused.unmount();
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring({
      exam: { examInstanceId: EXAM, subjectLabel: 'Matematika Wajib', lifecycleState: 'ENDED', roomBased: false, pausedAt: null },
    }));
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    expect(await screen.findByText('Ujian telah diakhiri')).toBeTruthy();
    expect(document.body.textContent).not.toContain('\u2014');
  });

  it('explains a refusal', async () => {
    vi.mocked(getExamMonitoring).mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    expect(await screen.findByText('Akses Ditolak')).toBeTruthy();
  });

  it('is reachable from the proctor and teacher views', async () => {
    vi.mocked(getProctorMonitoring).mockResolvedValue({ assignments: [{ examInstanceId: EXAM, subjectLabel: 'Matematika Wajib', rooms: [] }] });
    const onOpenExam = vi.fn();
    const proctor = render(<ProctorMonitoringView onOpenExam={onOpenExam} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lihat Peserta' }));
    expect(onOpenExam).toHaveBeenCalledWith(EXAM);
    expect(screen.queryByText('Tidak ada ruangan yang ditugaskan untuk ujian ini.')).toBeNull();
    proctor.unmount();

    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [{ examInstanceId: EXAM, subjectLabel: 'Matematika Wajib', lifecycleState: 'ACTIVE', baseline: { status: 'not_evaluated' }, roomProctor: { status: 'not_evaluated' }, progress: { participants: 4, started: 3, submitted: 1 } }],
    });
    const onOpenMonitoring = vi.fn();
    render(<TeacherReadinessView onOpenMonitoring={onOpenMonitoring} onOpenResults={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pantau Peserta' }));
    expect(onOpenMonitoring).toHaveBeenCalledWith(EXAM);
  });
});
