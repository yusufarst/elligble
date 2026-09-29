import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { useReviewFlags, clearReviewFlags } from '../hooks/useReviewFlags.ts';
import { ApiError, type ReviewFlagRequest } from '../api/assessment-client.ts';
import type { ResumeResponse, StudentSafeQuestion } from '../types/assessment.ts';
import { openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';

// "Ragu-ragu / Tandai" (D04.5-33/34/35): a mark the student sets for their own review. It is
// separate from the answer, survives a reload, follows the server, and never blocks
// saving or submitting.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const Q1 = '33333333-3333-4333-8333-333333333331';
const Q2 = '33333333-3333-4333-8333-333333333332';
const STORAGE_KEY = `elligble.reviewFlags.${ATTEMPT}`;

const questions: StudentSafeQuestion[] = [
  { snapshotId: Q1, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Manakah unsur kimia dengan simbol O?', options: [{ id: 'opt-a', content: 'Emas' }, { id: 'opt-b', content: 'Oksigen' }] },
  { snapshotId: Q2, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Manakah gas mulia?', options: [{ id: 'opt-c', content: 'Neon' }, { id: 'opt-d', content: 'Klorin' }] },
];

function resume(overrides: Partial<ResumeResponse> = {}): ResumeResponse {
  return {
    attemptId: ATTEMPT,
    session: { status: 'active', activatedAt: '2026-09-29T08:00:00.000Z', ownedByCaller: true },
    answers: [{ snapshotId: Q1, answerPayload: { selectedOptionId: 'opt-b' }, clientWriteIdentity: 'w-1', writeVersion: 1, updatedAt: '2026-09-29T08:01:00.000Z' }],
    timer: { status: 'active', startedAt: '2026-09-29T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3000 },
    submission: { status: 'not_submitted' },
    context: { subjectLabel: 'Kimia', roomLabel: null },
    reviewFlags: [],
    ...overrides,
  };
}

type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function server(overrides: Record<string, Handler> = {}): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string, init?: RequestInit) => {
    for (const [fragment, handler] of Object.entries(overrides)) {
      if (url.includes(fragment)) return handler(url, init);
    }
    if (url.includes('/api/v1/assessment/resume')) return json(resume());
    if (url.includes('/api/v1/assessment/questions')) return json({ attemptId: ATTEMPT, questions });
    if (url.includes('/api/v1/assessment/review-flag')) {
      const body = JSON.parse(init?.body as string);
      return json({ snapshotId: body.snapshotId, flagged: body.flagged });
    }
    if (url.includes('/api/v1/assessment/submit')) return json({ status: 'submitted', submissionId: 's-1', submittedAt: '2026-09-29T08:30:00.000Z' });
    return json({ error: 'not_found' }, 404);
  });
}

const flagRequests = (fetchSpy: ReturnType<typeof server>) =>
  fetchSpy.mock.calls.filter(c => (c[0] as string).includes('/review-flag')).map(c => JSON.parse(c[1]!.body as string));

async function openExam() {
  const view = render(<StudentExamWorkstation />);
  expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();
  return view;
}

const flagBox = () => screen.getByRole('checkbox', { name: 'Ragu-ragu' }) as HTMLInputElement;

describe('Ragu-ragu in the exam screen', () => {
  beforeEach(async () => {
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
    window.sessionStorage.clear();
    window.localStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('shows a mark from the server and sends a change without touching the answer', async () => {
    const fetchSpy = server({ '/api/v1/assessment/resume': () => json(resume({ reviewFlags: [Q1] })) });
    globalThis.fetch = fetchSpy;
    await openExam();

    expect(flagBox().checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Pindah ke soal nomor 1, status sudah dijawab, ditandai ragu-ragu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pindah ke soal nomor 2, status belum dijawab' })).toBeTruthy();

    await userEvent.click(flagBox());
    expect(flagBox().checked).toBe(false);
    await waitFor(() => expect(flagRequests(fetchSpy)).toEqual([{ attemptId: ATTEMPT, sessionId: SESSION, snapshotId: Q1, flagged: false }]));
    expect((screen.getByLabelText(/Oksigen/) as HTMLInputElement).checked).toBe(true);
    expect(fetchSpy.mock.calls.some(c => (c[0] as string).includes('/answer/save'))).toBe(false);
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  it('keeps an unsent mark on this device across a reload and sends it later', async () => {
    let reachable = false;
    const fetchSpy = server({
      '/api/v1/assessment/review-flag': (_url, init) => {
        if (!reachable) throw new TypeError('Failed to fetch');
        const body = JSON.parse(init?.body as string);
        return json({ snapshotId: body.snapshotId, flagged: body.flagged });
      },
    });
    globalThis.fetch = fetchSpy;
    const first = await openExam();
    await userEvent.click(flagBox());
    expect(flagBox().checked).toBe(true);
    await waitFor(() => expect(flagRequests(fetchSpy)).toHaveLength(1));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ [Q1]: true });
    first.unmount();

    reachable = true;
    await openExam();
    expect(flagBox().checked).toBe(true);
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
    expect(flagRequests(fetchSpy).at(-1)).toEqual({ attemptId: ATTEMPT, sessionId: SESSION, snapshotId: Q1, flagged: true });
  });

  it('reminds about marked questions when submitting, without blocking it, and forgets them afterwards', async () => {
    const fetchSpy = server({ '/api/v1/assessment/resume': () => json(resume({ reviewFlags: [Q2] })) });
    globalThis.fetch = fetchSpy;
    await openExam();
    await userEvent.click(screen.getAllByRole('button', { name: 'Selesaikan Ujian' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Ditandai Ragu-ragu:').nextSibling?.textContent).toBe('1');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ [Q2]: true }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kirim Jawaban Sekarang' }));
    expect(await screen.findByText('Ujian Berhasil Dikumpulkan')).toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('useReviewFlags', () => {
  beforeEach(() => window.localStorage.clear());

  it('merges the server marks with this device\'s unsent ones', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ [Q1]: false, [Q2]: true }));
    const send = vi.fn(async () => ({}));
    const { result } = renderHook(() => useReviewFlags({ attemptId: ATTEMPT, sessionId: SESSION, initialFlags: [Q1], enabled: true, send, storage: window.localStorage }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(result.current.flags).toEqual({ [Q1]: false, [Q2]: true });
    expect(result.current.flaggedCount).toBe(1);
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  it('sends a change made while the previous one is in flight right after it', async () => {
    const sent: ReviewFlagRequest[] = [];
    let release: () => void = () => {};
    const send = vi.fn((req: ReviewFlagRequest) => {
      sent.push(req);
      return sent.length === 1 ? new Promise<void>(resolve => { release = resolve; }) : Promise.resolve();
    });
    const { result } = renderHook(() => useReviewFlags({ attemptId: ATTEMPT, sessionId: SESSION, initialFlags: [], enabled: true, send, storage: window.localStorage }));
    act(() => result.current.toggle(Q1));
    await waitFor(() => expect(sent).toHaveLength(1));
    act(() => result.current.toggle(Q1));
    expect(result.current.flags[Q1]).toBe(false);
    await act(async () => release());
    await waitFor(() => expect(sent.map(r => r.flagged)).toEqual([true, false]));
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  it('stops once the attempt is closed and drops a request the server can never accept', async () => {
    const send = vi.fn(async (req: ReviewFlagRequest) => {
      if (req.snapshotId === Q1) throw new ApiError(404, 'assessment_context_not_found');
      throw new ApiError(409, 'attempt_already_submitted');
    });
    const { result } = renderHook(() => useReviewFlags({ attemptId: ATTEMPT, sessionId: SESSION, initialFlags: [], enabled: true, send, storage: window.localStorage }));
    act(() => result.current.toggle(Q1));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    act(() => result.current.toggle(Q2));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => result.current.toggle(Q2));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('forgets a finished attempt\'s marks on this device', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ [Q1]: true }));
    clearReviewFlags(ATTEMPT, window.localStorage);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
