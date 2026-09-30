import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TeacherExamPreviewView } from '../components/TeacherExamPreviewView';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import * as client from '../api/assessment-client';
import { ApiError, getTeacherExamPreview, getTeacherReadiness } from '../api/assessment-client';
import { setDisplayTimeZone } from '../lib/format';
import type { TeacherExamPreview } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  const mocked: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(actual)) mocked[name] = typeof value === 'function' && name !== 'ApiError' ? vi.fn() : value;
  return mocked;
});

// Exam preview before it opens (ASSESS-TEACHER-002; D04.3-38/39): the questions as the exam
// screen shows them, in order, with the key only on request; trying an option sends nothing.

const EXAM = '6f0e0d0c-0b0a-4908-8706-050403020100';

function preview(overrides: Partial<TeacherExamPreview> = {}): TeacherExamPreview {
  return {
    exam: {
      examInstanceId: EXAM, subjectLabel: 'Fisika', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
      windowStartsAt: '2026-10-05T01:00:00.000Z', windowEndsAt: '2026-10-05T03:00:00.000Z', durationMinutes: 90,
    },
    questions: [
      { snapshotId: 's1', no: 1, prompt: 'Satuan gaya adalah', options: ['Joule', 'Newton', 'Watt', 'Pascal', 'Volt'].map((c, i) => ({ id: `o1${i}`, content: c })), correctOptionId: 'o11', maxScore: 2, valid: true },
      { snapshotId: 's2', no: 2, prompt: 'Satuan daya adalah', options: ['Joule', 'Newton', 'Watt', 'Pascal', 'Volt'].map((c, i) => ({ id: `o2${i}`, content: c })), correctOptionId: 'o22', maxScore: 1.5, valid: true },
      { snapshotId: 's3', no: 3, prompt: 'Soal tanpa kunci', options: [{ id: 'x', content: 'Ya' }], correctOptionId: null, maxScore: null, valid: false },
    ],
    ...overrides,
  };
}

const option = (text: string) => screen.getByText(text, { selector: '.option-text' }).closest('label')!;

describe('TeacherExamPreviewView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });

  it('shows one question at a time in order, like the exam screen, with the key only on request', async () => {
    vi.mocked(getTeacherExamPreview).mockResolvedValue(preview());
    render(<TeacherExamPreviewView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Satuan gaya adalah')).toBeTruthy();
    expect(screen.getByText('5 Oktober 2026, 08.00 sampai 10.00 WIB · Durasi 90 menit')).toBeTruthy();
    expect(screen.getByText('Soal 1 dari 3')).toBeTruthy();
    expect(within(option('Newton')).getByText('B')).toBeTruthy();
    expect(screen.queryByText('Kunci jawaban')).toBeNull();
    expect(screen.queryByText('Skor 2')).toBeNull();

    fireEvent.click(screen.getByLabelText('Tampilkan kunci jawaban dan skor'));
    expect(within(option('Newton')).getByText('Kunci jawaban')).toBeTruthy();
    expect(screen.getByText('Skor 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Soal Berikutnya' }));
    expect(screen.getByText('Satuan daya adalah')).toBeTruthy();
    expect(within(option('Watt')).getByText('Kunci jawaban')).toBeTruthy();
    expect(screen.getByText('Skor 1,5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Soal 1' }));
    expect(screen.getByText('Satuan gaya adalah')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Soal Sebelumnya' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('trying an option stays on this screen: nothing but the preview is requested', async () => {
    vi.mocked(getTeacherExamPreview).mockResolvedValue(preview());
    render(<TeacherExamPreviewView examInstanceId={EXAM} onBack={() => {}} />);
    await screen.findByText('Satuan gaya adalah');
    fireEvent.click(option('Joule'));
    expect(option('Joule').className).toContain('selected');
    fireEvent.click(screen.getByRole('button', { name: 'Soal Berikutnya' }));
    fireEvent.click(screen.getByRole('button', { name: 'Soal Sebelumnya' }));
    expect(option('Joule').className).toContain('selected');
    const called = Object.entries(client).filter(([, fn]) => typeof fn === 'function' && vi.isMockFunction(fn) && fn.mock.calls.length > 0).map(([name]) => name);
    expect(called).toEqual(['getTeacherExamPreview']);
  });

  it('marks content that is not a valid question', async () => {
    vi.mocked(getTeacherExamPreview).mockResolvedValue(preview());
    render(<TeacherExamPreviewView examInstanceId={EXAM} onBack={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Soal 3 (tidak valid)' }));
    expect(screen.getByText('Konten soal ini tidak valid, sehingga ujian belum dapat ditandai siap. Hubungi operator sekolah.')).toBeTruthy();
  });

  it('explains refusals', async () => {
    vi.mocked(getTeacherExamPreview).mockRejectedValueOnce(new ApiError(409, 'invalid_state'));
    const { unmount } = render(<TeacherExamPreviewView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Pratinjau Tidak Tersedia')).toBeTruthy();
    unmount();
    vi.mocked(getTeacherExamPreview).mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    render(<TeacherExamPreviewView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Akses Ditolak')).toBeTruthy();
  });
});

describe('TeacherReadinessView preview button', () => {
  it('offers "Pratinjau Soal" before the exam opens only', async () => {
    const base = {
      subjectLabel: 'Fisika', windowStartsAt: '2026-10-05T01:00:00.000Z', windowEndsAt: '2026-10-05T03:00:00.000Z',
      baseline: { status: 'baseline_readiness_checks_pass' }, roomProctor: { status: 'room_proctor_readiness_not_applicable' },
    };
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [
        { ...base, examInstanceId: 'a0000000-0000-4000-8000-000000000001', lifecycleState: 'SCHEDULED', progress: null },
        { ...base, examInstanceId: 'a0000000-0000-4000-8000-000000000002', lifecycleState: 'ACTIVE', progress: { participants: 1, started: 0, submitted: 0, running: 0 } },
      ],
    } as never);
    const onOpenPreview = vi.fn();
    render(<TeacherReadinessView onOpenPreview={onOpenPreview} />);
    const buttons = await screen.findAllByRole('button', { name: 'Pratinjau Soal' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onOpenPreview).toHaveBeenCalledWith('a0000000-0000-4000-8000-000000000001');
  });
});
