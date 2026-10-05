import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AttemptLaunch } from '../components/AttemptLaunch.tsx';
import type { ResumeResponse } from '../types/assessment.ts';

const VALID_ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const FINGERPRINT = 'a1b2c3d4e5f60718';

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
import { readExamSessionId, storeExamSessionId } from '../exam/exam-session.ts';

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
    window.sessionStorage.clear();
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
    storeExamSessionId(VALID_ATTEMPT_ID, VALID_SESSION_ID);
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'active', activatedAt: new Date().toISOString(), ownedByCaller: true },
      timer: { status: 'not_started' }
    }));
    vi.mocked(postStartTimer).mockResolvedValue({ status: 'started', startedAt: new Date().toISOString(), configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3600 });

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Siap Memulai Ujian')).toBeDefined();
    });
    // The resume asks about this tab's own session.
    expect(getResume).toHaveBeenCalledWith(VALID_ATTEMPT_ID, VALID_SESSION_ID);

    // Own session already active: only the timer is started.
    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));
    await waitFor(() => expect(postStartTimer).toHaveBeenCalledTimes(1));
    expect(postActivateSession).not.toHaveBeenCalled();
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
      new ApiError(409, 'active_session_exists', 'Conflict', { error: 'active_session_exists', activeSessionFingerprint: FINGERPRINT })
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
      new ApiError(409, 'active_session_exists', 'Conflict', { error: 'active_session_exists', activeSessionFingerprint: FINGERPRINT })
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
        expectedActiveSessionFingerprint: FINGERPRINT,
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
    storeExamSessionId(VALID_ATTEMPT_ID, VALID_SESSION_ID);
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'active', activatedAt: new Date().toISOString(), ownedByCaller: true },
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
      new ApiError(409, 'active_session_exists', 'Conflict', { error: 'active_session_exists', activeSessionFingerprint: FINGERPRINT })
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
      new ApiError(409, 'active_session_exists', 'Conflict', { error: 'active_session_exists', activeSessionFingerprint: FINGERPRINT })
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
      new ApiError(409, 'active_session_changed', 'Conflict', { error: 'active_session_changed' })
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

  it('15. context waterfall: Subject present + Room present -> Subject only', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null,
      context: { subjectLabel: 'Matematika', roomLabel: 'Lab 1' }
    }));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Siap Memulai Ujian')).toBeDefined();
    });
    
    expect(screen.getByText('Matematika')).toBeDefined();
    expect(screen.queryByText('Lab 1')).toBeNull();
  });

  it('16. context waterfall: Subject absent + Room present -> Room only', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null,
      context: { subjectLabel: null, roomLabel: 'Lab 1' } as any
    }));

    render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Siap Memulai Ujian')).toBeDefined();
    });
    
    expect(screen.queryByText('Matematika')).toBeNull();
    expect(screen.getByText('Lab 1')).toBeDefined();
  });

  it('17. context waterfall: Subject absent + Room absent -> context omitted', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null,
      context: { subjectLabel: null, roomLabel: null } as any
    }));

    const { container } = render(<AttemptLaunch />);
    
    await waitFor(() => {
      expect(screen.getByText('Siap Memulai Ujian')).toBeDefined();
    });
    
    expect(container.querySelector('[data-slot="status-page-subtitle"]')).toBeNull();
  });
  it('18. the active session id is never needed: an exam running elsewhere requires explicit takeover', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'active', activatedAt: new Date().toISOString(), ownedByCaller: false },
      timer: { status: 'active', startedAt: new Date().toISOString(), configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 1800 }
    }));

    render(<AttemptLaunch />);

    await waitFor(() => {
      expect(screen.getByText('Sesi Aktif Ditemukan')).toBeDefined();
    });
    expect(screen.queryByTestId('student-exam-workstation')).toBeNull();
    expect(postActivateSession).not.toHaveBeenCalled();

    vi.mocked(postActivateSession)
      .mockRejectedValueOnce(new ApiError(409, 'active_session_exists', 'Conflict', { error: 'active_session_exists', activeSessionFingerprint: FINGERPRINT }))
      .mockResolvedValueOnce({ status: 'active', sessionId: 'x', activatedAt: new Date().toISOString() });
    vi.mocked(postStartTimer).mockResolvedValue({ status: 'started', startedAt: new Date().toISOString(), configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 1800 });

    fireEvent.click(screen.getByRole('button', { name: 'Ya, Pindahkan Sesi' }));

    await waitFor(() => {
      expect(screen.getByTestId('student-exam-workstation')).toBeDefined();
    });
    const calls = vi.mocked(postActivateSession).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toEqual({ attemptId: VALID_ATTEMPT_ID, sessionId: calls[1][0].sessionId });
    expect(calls[1][0]).toEqual(expect.objectContaining({ expectedActiveSessionFingerprint: FINGERPRINT, confirmSupersede: true }));
    // The new session belongs to this tab from now on.
    expect(readExamSessionId(VALID_ATTEMPT_ID)).toBe(calls[1][0].sessionId);
  });

  it('19. a stored session that is no longer the active one is not reused', async () => {
    storeExamSessionId(VALID_ATTEMPT_ID, VALID_SESSION_ID);
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));
    vi.mocked(postActivateSession).mockResolvedValue({ status: 'active', sessionId: 'x', activatedAt: new Date().toISOString() });
    vi.mocked(postStartTimer).mockResolvedValue({ status: 'started', startedAt: new Date().toISOString(), configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3600 });

    render(<AttemptLaunch />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));
    await waitFor(() => expect(postStartTimer).toHaveBeenCalledTimes(1));

    const candidate = vi.mocked(postActivateSession).mock.calls[0][0].sessionId;
    expect(candidate).not.toBe(VALID_SESSION_ID);
    expect(readExamSessionId(VALID_ATTEMPT_ID)).toBe(candidate);
  });

  it('20. the candidate is stored before activation so a lost response is recovered after reload', async () => {
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'none' },
      timer: null
    }));
    let storedDuringActivation: string | null = null;
    vi.mocked(postActivateSession).mockImplementation(async req => {
      storedDuringActivation = readExamSessionId(VALID_ATTEMPT_ID);
      expect(storedDuringActivation).toBe(req.sessionId);
      throw new Error('Network error');
    });

    render(<AttemptLaunch />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));
    await waitFor(() => {
      expect(screen.getByText('Gagal memulai ujian. Silakan coba lagi.')).toBeDefined();
    });
    expect(storedDuringActivation).not.toBeNull();
  });

  it('21. a timer start refused by the server explains why', async () => {
    storeExamSessionId(VALID_ATTEMPT_ID, VALID_SESSION_ID);
    vi.mocked(getResume).mockResolvedValue(createMockResume({
      session: { status: 'active', activatedAt: new Date().toISOString(), ownedByCaller: true },
      timer: { status: 'not_started' }
    }));
    vi.mocked(postStartTimer).mockRejectedValueOnce(new ApiError(409, 'late_start_blocked'));

    render(<AttemptLaunch />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mulai Ujian Sekarang' }));
    await waitFor(() => {
      expect(screen.getByText('Batas waktu untuk memulai ujian ini telah lewat. Hubungi pengawas ruangan.')).toBeDefined();
    });
  });
});
