import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssignedExamDiscovery } from '../components/AssignedExamDiscovery.tsx';
import type { AssignedExamItem } from '../types/assessment.ts';

vi.mock('../api/assessment-client.ts', () => ({
  getAssignedExams: vi.fn(),
  postStartAttempt: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string) {
      super(code);
    }
  },
}));

import { getAssignedExams, postStartAttempt, ApiError } from '../api/assessment-client.ts';

const EXAM = '33333333-3333-4333-8333-333333333333';
const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-09-29T08:30:00.000Z';

function exam(schedule: Partial<NonNullable<AssignedExamItem['schedule']>>, attempts: AssignedExamItem['attempts'] = []): AssignedExamItem {
  return {
    examInstanceId: EXAM,
    subjectLabel: 'Matematika Wajib',
    roomLabel: null,
    schedule: {
      lifecycleState: 'ACTIVE',
      windowStartsAt: '2026-09-29T08:00:00.000Z',
      windowEndsAt: '2026-09-29T10:00:00.000Z',
      attemptDurationSeconds: 2700,
      ...schedule,
    },
    attempts,
  };
}

describe('student exam entry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers "Mulai Ujian" for an ACTIVE exam inside its window and hands the new attempt to the launcher', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: NOW, assignments: [exam({})] });
    vi.mocked(postStartAttempt).mockResolvedValue({ attemptId: ATTEMPT, created: true });
    const onSelectAttempt = vi.fn();
    render(<AssignedExamDiscovery onSelectAttempt={onSelectAttempt} />);
    expect(await screen.findByText('45 menit')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian' }));
    await waitFor(() => expect(onSelectAttempt).toHaveBeenCalledWith(ATTEMPT));
    expect(postStartAttempt).toHaveBeenCalledWith(EXAM);
  });

  it('explains a refused start with the server reason and keeps the student on the list', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: NOW, assignments: [exam({})] });
    vi.mocked(postStartAttempt).mockRejectedValue(new (ApiError as any)(409, 'late_start_blocked'));
    const onSelectAttempt = vi.fn();
    render(<AssignedExamDiscovery onSelectAttempt={onSelectAttempt} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mulai Ujian' }));
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText('Batas waktu untuk memulai ujian ini telah lewat. Hubungi pengawas ruangan.')).toBeDefined();
    expect(onSelectAttempt).not.toHaveBeenCalled();
  });

  it('shows a network failure message when the start request fails', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: NOW, assignments: [exam({})] });
    vi.mocked(postStartAttempt).mockRejectedValue(new TypeError('Failed to fetch'));
    render(<AssignedExamDiscovery onSelectAttempt={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mulai Ujian' }));
    expect(await screen.findByText('Gagal memulai ujian. Periksa koneksi internet Anda dan coba lagi.')).toBeDefined();
  });

  it('waits for the teacher or proctor when the exam is scheduled but not opened', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: NOW, assignments: [exam({ lifecycleState: 'READY' })] });
    render(<AssignedExamDiscovery />);
    expect(await screen.findByText('Menunggu guru atau pengawas membuka ujian.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mulai Ujian' })).toBeNull();
  });

  it('does not offer a start before the window opens or after it ends', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({
      serverNow: NOW,
      assignments: [exam({ windowStartsAt: '2026-09-29T09:00:00.000Z' })],
    });
    const { unmount } = render(<AssignedExamDiscovery />);
    expect(await screen.findByText(/^Ujian dibuka /)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mulai Ujian' })).toBeNull();
    unmount();

    vi.mocked(getAssignedExams).mockResolvedValue({
      serverNow: NOW,
      assignments: [exam({ windowEndsAt: '2026-09-29T08:15:00.000Z' })],
    });
    render(<AssignedExamDiscovery />);
    expect(await screen.findByText('Waktu pelaksanaan ujian telah berakhir.')).toBeDefined();
  });

  it('continues an existing attempt instead of offering a new start', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: NOW, assignments: [exam({}, [{ attemptId: ATTEMPT, submittedAt: null }])] });
    render(<AssignedExamDiscovery onSelectAttempt={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Mulai Pengerjaan' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mulai Ujian' })).toBeNull();
  });
});
