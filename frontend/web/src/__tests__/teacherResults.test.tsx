import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TeacherResultsView, formatScore } from '../components/TeacherResultsView';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import { ApiError, getTeacherExamResults, getTeacherReadiness } from '../api/assessment-client';
import type { TeacherExamResultsResponse } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return { ...actual, getTeacherExamResults: vi.fn(), getTeacherReadiness: vi.fn() };
});

const EXAM = '5f0c7b8e-1d2a-4c3b-8e9f-0a1b2c3d4e5f';

function response(overrides: Partial<TeacherExamResultsResponse> = {}): TeacherExamResultsResponse {
  return {
    exam: {
      examInstanceId: EXAM,
      subjectLabel: 'Matematika Wajib',
      groupLabel: 'X-1',
      assessmentTypeLabel: 'Ulangan Harian',
      lifecycleState: 'ACTIVE',
      windowStartsAt: '2026-09-29T01:00:00.000Z',
      windowEndsAt: '2026-09-29T03:00:00.000Z',
    },
    scoring: { rule: 'BASELINE_SINGLE_CHOICE_V1', available: true, questionCount: 3, maxScore: 3 },
    resultState: 'PROVISIONAL',
    summary: { participants: 4, notStarted: 1, inProgress: 1, submitted: 2 },
    participants: [
      { elligbleId: 'siswa.a', status: 'SUBMITTED', finalizationSource: 'STUDENT_SUBMIT', submittedAt: '2026-09-29T01:41:00.000Z', score: { correct: 2, incorrect: 1, unanswered: 0, rawScore: 2, maxScore: 3, scaledScore: 66.67 } },
      { elligbleId: 'siswa.b', status: 'SUBMITTED', finalizationSource: 'EXPIRY_SERVER', submittedAt: '2026-09-29T02:30:00.000Z', score: { correct: 3, incorrect: 0, unanswered: 0, rawScore: 3, maxScore: 3, scaledScore: 100 } },
      { elligbleId: 'siswa.c', status: 'IN_PROGRESS', finalizationSource: null, submittedAt: null, score: null },
      { elligbleId: 'siswa.d', status: 'NOT_STARTED', finalizationSource: null, submittedAt: null, score: null },
    ],
    ...overrides,
  };
}

const rows = () => screen.getAllByRole('row').slice(1);
// The results are on screen: the heading alone shows in every state (UI consistency audit M13).
const loaded = () => screen.findByText('Matematika Wajib');

describe('TeacherResultsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads the results as a CSV file and opens the print dialog', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValue(response({ resultState: 'FINAL', finalizedAt: '2026-09-29T04:05:00.000Z' }));
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return 'blob:hasil'; });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicked: HTMLAnchorElement[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unduh CSV' }));
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('hasil-ujian_matematika-wajib_x-1_2026-09-29_final.csv');
    const content = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]);
    });
    expect(content.split('\r\n')[0]).toContain('ELLIGBLE ID');
    expect(content).toContain('siswa.a;Dikumpulkan;Oleh siswa');
    expect(content).toContain('66,67');
    expect(blobs[0].type).toBe('text/csv;charset=utf-8');
    fireEvent.click(screen.getByRole('button', { name: 'Cetak' }));
    expect(print).toHaveBeenCalledTimes(1);
    click.mockRestore();
    print.mockRestore();
  });

  it('shows finalized results as final, with who did not take the exam instead of a zero', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValue(response({
      exam: { ...response().exam, lifecycleState: 'FINALIZED' },
      resultState: 'FINAL',
      finalizedAt: '2026-09-29T04:05:00.000Z',
      summary: { participants: 3, notStarted: 1, inProgress: 0, submitted: 2 },
      participants: [
        response().participants[0],
        response().participants[1],
        { elligbleId: 'siswa.d', status: 'ABSENT', finalizationSource: null, submittedAt: null, score: null },
      ],
    }));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Hasil final')).toBeTruthy();
    expect(screen.queryByText('Hasil sementara')).toBeNull();
    expect(screen.getByText(/Nilai dibekukan dan tidak berubah oleh perubahan data berikutnya/)).toBeTruthy();
    const summary = screen.getByLabelText('Ringkasan peserta');
    expect(within(summary).getByText('Tidak mengerjakan').nextSibling?.textContent).toBe('1');
    expect(within(summary).queryByText('Sedang mengerjakan')).toBeNull();
    const absent = screen.getAllByRole('row').find(r => r.textContent?.includes('siswa.d'))!;
    expect(within(absent).getByText('Tidak mengerjakan')).toBeTruthy();
    expect(within(absent).getByText('Tidak ada nilai')).toBeTruthy();
    expect(document.body.textContent).not.toContain('\u2014');
  });

  it('lists participants in the server order with scores hidden until the teacher shows them', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValue(response());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Hasil Ujian' })).toBeTruthy();
    expect(getTeacherExamResults).toHaveBeenCalledWith(EXAM);
    expect(screen.getByText('Matematika Wajib')).toBeTruthy();
    expect(screen.getByText('X-1 · Ulangan Harian')).toBeTruthy();
    expect(screen.getByText('Hasil sementara')).toBeTruthy();

    const summary = screen.getByLabelText('Ringkasan peserta');
    expect(within(summary).getByText('Peserta').nextSibling?.textContent).toBe('4');
    expect(within(summary).getByText('Dikumpulkan').nextSibling?.textContent).toBe('2');

    expect(screen.getAllByRole('rowheader').map(h => h.firstChild?.textContent)).toEqual(['siswa.a', 'siswa.b', 'siswa.c', 'siswa.d']);
    expect(screen.getAllByLabelText('Disembunyikan')).toHaveLength(4);
    expect(screen.queryByText('66,67')).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Tampilkan Nilai' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    const [a, b, c, d] = rows().map(r => within(r).getAllByRole('cell').map(cell => cell.textContent));
    expect(a).toEqual(['2/3', '66,67']);
    expect(b).toEqual(['3/3', '100']);
    expect(c).toEqual(['Belum ada nilai']);
    expect(d).toEqual(['Belum ada nilai']);
    const [, , working, absent] = screen.getAllByRole('rowheader');
    // The same tone as a working participant on monitoring and a running exam.
    expect(within(working).getByText('Sedang mengerjakan').getAttribute('data-tone')).toBe('active');
    expect(within(absent).getByText('Belum mulai')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sembunyikan Nilai' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('tells how each attempt was finalized, including a device that was away at time expiry', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValue(response());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    const [a, b] = rows();
    expect(within(a).getByText('Dikumpulkan')).toBeTruthy();
    expect(within(b).getByText('Dikumpulkan otomatis')).toBeTruthy();
    expect(within(b).getByText(/Waktu habis saat perangkat tidak terhubung/)).toBeTruthy();
    expect(screen.getByText(/hanya jawaban yang sudah diterima server yang dihitung/)).toBeTruthy();
  });

  it('explains a refusal and retries a failed load', async () => {
    vi.mocked(getTeacherExamResults).mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    const { unmount } = render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Akses Ditolak')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Hasil Ujian' })).toBeTruthy();
    unmount();

    vi.mocked(getTeacherExamResults).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(response());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Gagal Memuat Hasil Ujian')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Hasil Ujian' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    await loaded();
    expect(screen.queryByText('Gagal Memuat Hasil Ujian')).toBeNull();
  });

  it('keeps the last data when a refresh fails', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(response()).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui Data' }));
    expect(await screen.findByText('Gagal memperbarui data')).toBeTruthy();
    expect(screen.getByText('Data yang tampil adalah data terakhir.')).toBeTruthy();
    expect(rows()).toHaveLength(4);
  });

  it('cannot show scores when the exam cannot be scored', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValue(response({
      scoring: { rule: 'BASELINE_SINGLE_CHOICE_V1', available: false, questionCount: 3, maxScore: null },
      participants: [{ elligbleId: 'siswa.a', status: 'SUBMITTED', finalizationSource: null, submittedAt: '2026-09-29T01:41:00.000Z', score: null }],
    }));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Nilai belum dapat dihitung')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Tampilkan Nilai' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('goes back to Pelaksanaan Ujian and uses no em dash in its copy', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValue(response());
    const onBack = vi.fn();
    render(<TeacherResultsView examInstanceId={EXAM} onBack={onBack} />);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan Nilai' }));
    expect(document.body.textContent).not.toContain('—');
    fireEvent.click(screen.getByRole('button', { name: /Kembali ke Pelaksanaan Ujian/ }));
    expect(onBack).toHaveBeenCalled();
  });

  it('formats scores the Indonesian way', () => {
    expect(formatScore(82.22)).toBe('82,22');
    expect(formatScore(85)).toBe('85');
    expect(formatScore(85.5)).toBe('85,5');
    expect(formatScore(100)).toBe('100');
  });
});

describe('TeacherReadinessView results entry', () => {
  it('offers the results of a running exam', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [{
        examInstanceId: EXAM,
        subjectLabel: 'Matematika Wajib',
        lifecycleState: 'ACTIVE',
        baseline: { status: 'not_evaluated' },
        roomProctor: { status: 'not_evaluated' },
        progress: { participants: 4, started: 3, submitted: 2 },
      }],
    });
    const onOpenResults = vi.fn();
    render(<TeacherReadinessView onOpenResults={onOpenResults} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lihat Hasil' }));
    await waitFor(() => expect(onOpenResults).toHaveBeenCalledWith(EXAM));
  });
});
