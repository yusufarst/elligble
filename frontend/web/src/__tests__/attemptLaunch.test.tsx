import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AttemptLaunch } from '../components/AttemptLaunch.tsx';
import type { ResumeResponse } from '../types/assessment.ts';

const VALID_ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_SESSION_ID = '22222222-2222-4222-8222-222222222222';

vi.mock('../api/assessment-client.ts', () => ({
  getResume: vi.fn(),
  postActivateSession: vi.fn(),
  postStartTimer: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message?: string, public data?: any) {
      super(message || code);
    }
  },
}));

import { getResume, postActivateSession, postStartTimer, ApiError } from '../api/assessment-client.ts';

vi.mock('../components/StudentExamWorkstation.tsx', () => ({
  StudentExamWorkstation: () => <div data-testid="student-exam-workstation">Workstation</div>
}));

function createMockResume(overrides?: Partial<ResumeResponse>): ResumeResponse {
  return {
    attemptId: VALID_ATTEMPT_ID,
    session: { status: 'none' },
    answers: [],
    timer: null,
    submission: { status: 'not_submitted' },
    context: { subjectLabel: 'Matematika', roomLabel: 'Lab 1' },
    ...overrides,
  };
}

describe('BU-084 AttemptLaunch Test Suite', () => {
  let originalLocation: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, search: `?attemptId=${VALID_ATTEMPT_ID}` } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('1. missing attemptId guidance', async () => {
    window.location.search = '';
    render(<AttemptLaunch />);
    
    expect(screen.getByText('Tautan Ujian Tidak Valid')).toBeDefined();
  });

  it('2. pre-start with no session / timer not started', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Siap Memulai Ujian')).toBeDefined();
    });
    expect(screen.getByText('Matematika')).toBeDefined();
  });

  it('3. active session / timer not started', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'active', sessionId: VALID_SESSION_ID, activatedAt: new Date().toISOString() },
      timer: { status: 'not_started' }
    }));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Siap Memulai Ujian')).toBeDefined();
    });
  });

  it('4. session activation then timer start ordering (B, C, D)', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));
    vi.mocked(postActivateSession).mockResolvedValue({ status: 'active', sessionId: 'c-1', activatedAt: new Date().toISOString() });
    vi.mocked(postStartTimer).mockResolvedValue({ status: 'started', startedAt: new Date().toISOString(), configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3600 });

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));

    await waitFor(() => {
      expect(postActivateSession).toHaveBeenCalledTimes(1);
    });
    
    await waitFor(() => {
      expect(postStartTimer).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('student-exam-workstation')).toBeDefined();
  });

  it('5. active_session_exists explicit confirmation', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));
    
    vi.mocked(postActivateSession).mockRejectedValueOnce(
      new ApiError(409, 'active_session_exists', 'Conflict', { activeSessionId: VALID_SESSION_ID })
    );

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));

    await waitFor(() => {
      expect(screen.getByText('Sesi Aktif Ditemukan')).toBeDefined();
    });
    
    expect(screen.getByRole('button', { name: 'Ya, Pindahkan Sesi' })).toBeDefined();
  });

  it('6. confirmed supersession payload', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));
    
    vi.mocked(postActivateSession).mockRejectedValueOnce(
      new ApiError(409, 'active_session_exists', 'Conflict', { activeSessionId: VALID_SESSION_ID })
    );

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));

    await waitFor(() => {
      expect(screen.getByText('Sesi Aktif Ditemukan')).toBeDefined();
    });

    vi.mocked(postActivateSession).mockResolvedValueOnce({ status: 'active', sessionId: 'new-id', activatedAt: new Date().toISOString() });
    
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Pindahkan Sesi' }));

    await waitFor(() => {
      expect(postActivateSession).toHaveBeenLastCalledWith(expect.objectContaining({
        attemptId: VALID_ATTEMPT_ID,
        expectedActiveSessionId: VALID_SESSION_ID,
        confirmSupersede: true
      }));
    });
    
    await waitFor(() => {
      expect(postStartTimer).toHaveBeenCalledTimes(1);
    });
  });

  it('7. forbidden state', async () => {
    vi.mocked(getResume).mockRejectedValueOnce(new ApiError(403, 'forbidden'));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak')).toBeDefined();
    });
  });

  it('8. not-found state', async () => {
    vi.mocked(getResume).mockRejectedValueOnce(new ApiError(404, 'not_found'));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Data Tidak Ditemukan')).toBeDefined();
    });
  });

  it('9. submitted state', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      submission: { status: 'submitted', submissionId: '123', submittedAt: new Date().toISOString() }
    }));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByTestId('student-exam-workstation')).toBeDefined();
    });
  });

  it('10. active workstation handoff', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'active', sessionId: VALID_SESSION_ID, activatedAt: new Date().toISOString() },
      timer: { status: 'active', startedAt: new Date().toISOString(), configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3600 }
    }));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByTestId('student-exam-workstation')).toBeDefined();
    });
  });

  it('11. no silent supersession - must show explicit modal', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));
    
    vi.mocked(postActivateSession).mockRejectedValueOnce(
      new ApiError(409, 'active_session_exists', 'Conflict', { activeSessionId: VALID_SESSION_ID })
    );

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));

    await waitFor(() => {
      expect(screen.getByText('Sesi Aktif Ditemukan')).toBeDefined();
    });
    
    // Timer should NOT be started yet
    expect(postStartTimer).not.toHaveBeenCalled();
  });

  it('12. crypto.randomUUID candidate stability across retry', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));
    
    vi.mocked(postActivateSession)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ status: 'active', sessionId: 'c-1', activatedAt: new Date().toISOString() });

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });

    // First attempt
    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));

    await waitFor(() => {
      expect(screen.getByText('Gagal memulai ujian. Silakan coba lagi.')).toBeDefined();
    });

    // Second attempt
    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));

    await waitFor(() => {
      expect(postStartTimer).toHaveBeenCalledTimes(1);
    });

    const calls = vi.mocked(postActivateSession).mock.calls;
    expect(calls.length).toBe(2);
    // Session ID should be the same across retries for the same component lifecycle
    expect(calls[0][0].sessionId).toBe(calls[1][0].sessionId);
  });

  it('13. active_session_changed refresh/reconfirmation', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));
    
    vi.mocked(postActivateSession).mockRejectedValueOnce(
      new ApiError(409, 'active_session_exists', 'Conflict', { activeSessionId: VALID_SESSION_ID })
    );

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));

    await waitFor(() => {
      expect(screen.getByText('Sesi Aktif Ditemukan')).toBeDefined();
    });

    // Now confirm, but the server says active_session_changed
    vi.mocked(postActivateSession).mockRejectedValueOnce(
      new ApiError(409, 'active_session_changed', 'Conflict', { activeSessionId: 'NEW_SESSION_ID' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ya, Pindahkan Sesi' }));

    // Should fetch resume state again
    await waitFor(() => {
      expect(getResume).toHaveBeenCalledTimes(2);
    });
  });

  it('14. active timer / no active session fail-safe', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: { status: 'active', startedAt: new Date().toISOString(), configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3600 }
    }));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Status Ujian Tidak Valid')).toBeDefined();
    });
  });
});
