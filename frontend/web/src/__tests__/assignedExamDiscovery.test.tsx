import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AssignedExamDiscovery } from '../components/AssignedExamDiscovery.tsx';
import { App } from '../App.tsx';

const ATTEMPT_ID_1 = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID_2 = '22222222-2222-4222-8222-222222222222';
const INSTANCE_ID_1 = '33333333-3333-4333-8333-333333333333';

vi.mock('../api/assessment-client.ts', () => ({
  getAssignedExams: vi.fn(),
  getResume: vi.fn(),
  postActivateSession: vi.fn(),
  postStartTimer: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message?: string, public data?: any) {
      super(message || code);
    }
  },
}));

import { getAssignedExams, ApiError } from '../api/assessment-client.ts';

vi.mock('../components/AttemptLaunch.tsx', () => ({
  AttemptLaunch: () => <div data-testid="attempt-launch-view">AttemptLaunch Component</div>
}));

describe('BU-085 AssignedExamDiscovery and App Navigation Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('1. loading state is rendered initially', () => {
    vi.mocked(getAssignedExams).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<AssignedExamDiscovery />);
    expect(screen.getByText('Memuat daftar ujian...')).toBeDefined();
  });

  it('2. empty assigned-exam list rendered correctly', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ assignments: [] });
    render(<AssignedExamDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Belum Ada Ujian yang Ditugaskan')).toBeDefined();
    });
    expect(screen.getByText('Belum ada ujian yang ditugaskan kepada Anda saat ini.')).toBeDefined();
    expect(screen.queryByText(/terjadwal/i)).toBeNull();
    expect(screen.queryByText(/jadwal ujian/i)).toBeNull();
    expect(screen.queryByText(/aktif untuk kelas/i)).toBeNull();
  });

  it('3. assignment with zero attempts is visible without launch button', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({
      assignments: [
        {
          examInstanceId: INSTANCE_ID_1,
          subjectLabel: 'Bahasa Indonesia',
          roomLabel: 'Ruang 10',
          attempts: [],
        }
      ]
    });

    render(<AssignedExamDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Bahasa Indonesia')).toBeDefined();
    });
    expect(screen.getByText('Ruang: Ruang 10')).toBeDefined();
    expect(screen.getByText('Belum ada sesi pengerjaan yang tersedia.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mulai Pengerjaan' })).toBeNull();
  });

  it('4. assignment with single unsubmitted attempt provides launch action', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({
      assignments: [
        {
          examInstanceId: INSTANCE_ID_1,
          subjectLabel: 'Matematika',
          roomLabel: 'Lab 1',
          attempts: [
            {
              attemptId: ATTEMPT_ID_1,
              submittedAt: null,
            }
          ]
        }
      ]
    });

    const onSelectAttempt = vi.fn();
    render(<AssignedExamDiscovery onSelectAttempt={onSelectAttempt} />);

    await waitFor(() => {
      expect(screen.getByText('Matematika')).toBeDefined();
    });
    expect(screen.queryByText('Siap Dikerjakan')).toBeNull();
    const button = screen.getByRole('button', { name: 'Mulai Pengerjaan' });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(onSelectAttempt).toHaveBeenCalledWith(ATTEMPT_ID_1);
  });

  it('5. multiple distinct attempts preserved and rendered separately without invented taxonomy', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({
      assignments: [
        {
          examInstanceId: INSTANCE_ID_1,
          subjectLabel: 'Fisika',
          roomLabel: null,
          attempts: [
            {
              attemptId: ATTEMPT_ID_1,
              submittedAt: '2026-09-16T08:00:00.000Z',
            },
            {
              attemptId: ATTEMPT_ID_2,
              submittedAt: null,
            }
          ]
        }
      ]
    });

    render(<AssignedExamDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Fisika')).toBeDefined();
    });

    // Both attempt rows exist
    expect(screen.getByTestId(`attempt-row-${ATTEMPT_ID_1}`)).toBeDefined();
    expect(screen.getByTestId(`attempt-row-${ATTEMPT_ID_2}`)).toBeDefined();

    // First attempt is submitted
    expect(screen.getByText('Sudah dikumpulkan')).toBeDefined();
    // Second attempt has launch button
    expect(screen.getByRole('button', { name: 'Mulai Pengerjaan' })).toBeDefined();

    // Prohibit invented taxonomy
    expect(screen.queryByText(/Percobaan 1/i)).toBeNull();
    expect(screen.queryByText(/Percobaan 2/i)).toBeNull();
    expect(screen.queryByText(/Susulan/i)).toBeNull();
    // Raw UUID must not be exposed to student
    expect(screen.queryByText(ATTEMPT_ID_1)).toBeNull();
    expect(screen.queryByText(ATTEMPT_ID_2)).toBeNull();
  });

  it('6. submitted attempt has no launch action', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({
      assignments: [
        {
          examInstanceId: INSTANCE_ID_1,
          subjectLabel: 'Kimia',
          roomLabel: 'Lab Kimia',
          attempts: [
            {
              attemptId: ATTEMPT_ID_1,
              submittedAt: '2026-09-16T09:00:00.000Z',
            }
          ]
        }
      ]
    });

    render(<AssignedExamDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Sudah dikumpulkan')).toBeDefined();
    });
    expect(screen.queryByRole('button', { name: 'Mulai Pengerjaan' })).toBeNull();
  });

  it('7. 403 state rendered when trusted context is absent/forbidden', async () => {
    vi.mocked(getAssignedExams).mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<AssignedExamDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak')).toBeDefined();
    });
    expect(screen.getByText('Sesi Anda tidak memiliki izin untuk mengakses daftar ujian.')).toBeDefined();
  });

  it('8. API failure state renders error card with retry button', async () => {
    vi.mocked(getAssignedExams).mockRejectedValueOnce(new ApiError(503, 'persistence_unavailable'));
    render(<AssignedExamDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Gagal Memuat Data Ujian')).toBeDefined();
    });
    const retryBtn = screen.getByRole('button', { name: 'Muat Ulang' });
    expect(retryBtn).toBeDefined();

    // Now mock recovery on retry
    vi.mocked(getAssignedExams).mockResolvedValueOnce({ assignments: [] });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Belum Ada Ujian yang Ditugaskan')).toBeDefined();
    });
  });

  it('9. fallback label used when subjectLabel and roomLabel are absent', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({
      assignments: [
        {
          examInstanceId: INSTANCE_ID_1,
          subjectLabel: null,
          roomLabel: null,
          attempts: [],
        }
      ]
    });

    render(<AssignedExamDiscovery />);

    await waitFor(() => {
      expect(screen.getByText('Penilaian Akademik')).toBeDefined();
    });
  });

  it('10. App with no attemptId renders AssignedExamDiscovery', async () => {
    window.history.replaceState({}, '', '/');
    vi.mocked(getAssignedExams).mockResolvedValue({ assignments: [] });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Daftar Ujian Siswa')).toBeDefined();
    });
    expect(screen.queryByTestId('attempt-launch-view')).toBeNull();
  });

  it('11. App with direct attemptId renders BU-084 AttemptLaunch directly', async () => {
    window.history.replaceState({}, '', `/?attemptId=${ATTEMPT_ID_1}`);

    render(<App />);

    expect(screen.getByTestId('attempt-launch-view')).toBeDefined();
    expect(screen.queryByText('Daftar Ujian Siswa')).toBeNull();
  });

  it('12. App handoff passes EXACT server-returned attemptId and updates URL to BU-084 AttemptLaunch', async () => {
    window.history.replaceState({}, '', '/');
    vi.mocked(getAssignedExams).mockResolvedValue({
      assignments: [
        {
          examInstanceId: INSTANCE_ID_1,
          subjectLabel: 'Biologi',
          roomLabel: null,
          attempts: [
            {
              attemptId: ATTEMPT_ID_1,
              submittedAt: null,
            }
          ]
        }
      ]
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Pengerjaan' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mulai Pengerjaan' }));

    // Verify URL query was updated with the exact server-provided attemptId
    expect(window.location.search).toContain(`attemptId=${ATTEMPT_ID_1}`);

    // Verify AttemptLaunch view is now rendered
    expect(screen.getByTestId('attempt-launch-view')).toBeDefined();
  });
});
