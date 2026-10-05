import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { useBroadcastInbox, NOTICE_MS } from '../hooks/useBroadcastInbox.ts';
import type { BroadcastInboxResponse, InboxMessage, ResumeResponse, StudentSafeQuestion, TimerResponse } from '../types/assessment.ts';
import { openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { setDisplayTimeZone } from '../lib/format.ts';

// Supervisor messages on the student's exam screen (D04.1-77C/G, D04.5-57/58/59, D04.6-52/53):
// fetched when the timer answer counts more, confirmed as received at once, shown once as a
// notice that neither takes the focus nor stops answering, and kept to reread.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const Q1 = '33333333-3333-4333-8333-333333333331';
const PROMPT = 'Manakah unsur kimia dengan simbol O?';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
const message = (id: string, text: string, sentAt = minutesAgo(1)): InboxMessage => ({ id, text, sentAt });
const inboxOf = (messages: InboxMessage[]): BroadcastInboxResponse => ({ messages, total: messages.length, serverTime: new Date().toISOString() });

describe('useBroadcastInbox', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('fetches at the start, confirms new messages at once and shows a recent one once', async () => {
    const m1 = message('m-1', 'Ujian tersisa 15 menit.');
    const fetchInbox = vi.fn(async () => inboxOf([m1]));
    const { result } = renderHook(() => useBroadcastInbox({ attemptId: ATTEMPT, enabled: true, fetchInbox }));
    await waitFor(() => expect(fetchInbox).toHaveBeenCalledTimes(2));
    expect(fetchInbox.mock.calls).toEqual([[ATTEMPT, []], [ATTEMPT, ['m-1']]]);
    expect(result.current.messages).toEqual([m1]);
    expect(result.current.notice).toEqual({ message: m1, more: 0 });

    // After a reload the same message is not shown again.
    const again = renderHook(() => useBroadcastInbox({ attemptId: ATTEMPT, enabled: true, fetchInbox: vi.fn(async () => inboxOf([m1])) }));
    await waitFor(() => expect(again.result.current.messages).toEqual([m1]));
    expect(again.result.current.notice).toBeNull();
  });

  it('lists old messages without a notice and counts the other new ones', async () => {
    const old = message('m-old', 'Harap tetap di tempat duduk.', minutesAgo(20));
    const a = message('m-a', 'Silakan lanjutkan ke soal berikutnya.', minutesAgo(1));
    const b = message('m-b', 'Jaringan sedang bermasalah. Tetap lanjutkan ujian.', minutesAgo(0));
    const { result } = renderHook(() => useBroadcastInbox({ attemptId: ATTEMPT, enabled: true, fetchInbox: vi.fn(async () => inboxOf([b, a, old])) }));
    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(result.current.notice).toEqual({ message: b, more: 1 });
  });

  it('asks again only when the count grows or a confirmation is still owed', async () => {
    const m1 = message('m-1', 'Ujian tersisa 15 menit.');
    const m2 = message('m-2', 'Harap tetap di tempat duduk.');
    let answer = inboxOf([m1]);
    let failConfirm = true;
    const fetchInbox = vi.fn(async (_id: string, received: string[]) => {
      if (received.length > 0 && failConfirm) throw new TypeError('Failed to fetch');
      return answer;
    });
    const { result } = renderHook(() => useBroadcastInbox({ attemptId: ATTEMPT, enabled: true, fetchInbox }));
    await waitFor(() => expect(fetchInbox).toHaveBeenCalledTimes(2));
    // The confirmation failed: the next timer answer retries it even without a new message.
    failConfirm = false;
    act(() => result.current.noteCount(1));
    await waitFor(() => expect(fetchInbox).toHaveBeenCalledTimes(3));
    expect(fetchInbox.mock.calls[2]).toEqual([ATTEMPT, ['m-1']]);
    act(() => result.current.noteCount(1));
    expect(fetchInbox).toHaveBeenCalledTimes(3);
    answer = inboxOf([m2, m1]);
    act(() => result.current.noteCount(2));
    await waitFor(() => expect(result.current.notice?.message).toEqual(m2));
    act(() => result.current.dismiss());
    expect(result.current.notice).toBeNull();
    expect(result.current.messages).toEqual([m2, m1]);
  });

  it('closes a notice by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useBroadcastInbox({ attemptId: ATTEMPT, enabled: true, fetchInbox: vi.fn(async () => inboxOf([message('m-1', 'Ujian tersisa 15 menit.')])) }));
    await waitFor(() => expect(result.current.notice).not.toBeNull());
    act(() => { vi.advanceTimersByTime(NOTICE_MS + 10); });
    expect(result.current.notice).toBeNull();
  });
});

const questions: StudentSafeQuestion[] = [
  { snapshotId: Q1, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: PROMPT, options: [{ id: 'opt-a', content: 'Emas' }, { id: 'opt-b', content: 'Oksigen' }] },
];

function resume(overrides: Partial<ResumeResponse> = {}): ResumeResponse {
  return {
    attemptId: ATTEMPT,
    session: { status: 'active', activatedAt: '2026-09-30T01:00:00.000Z', ownedByCaller: true },
    answers: [],
    timer: { status: 'active', startedAt: '2026-09-30T01:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 2530 },
    submission: { status: 'not_submitted' },
    context: { subjectLabel: 'Kimia', roomLabel: null },
    reviewFlags: [],
    exam: { lifecycleState: 'ACTIVE', pausedAt: null },
    ...overrides,
  };
}

function timer(messageCount: number, examState = 'ACTIVE', pausedAt: string | null = null): TimerResponse {
  return { status: 'active', startedAt: '2026-09-30T01:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 2530, examState, pausedAt, messageCount };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('supervisor messages on the exam screen', () => {
  let inbox: InboxMessage[];
  let examState: string;
  const inboxCalls: string[][] = [];

  beforeEach(async () => {
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
    window.sessionStorage.clear();
    window.localStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    setDisplayTimeZone('Asia/Jakarta');
    inbox = [];
    examState = 'ACTIVE';
    inboxCalls.length = 0;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) return json(resume());
      if (url.includes('/api/v1/assessment/questions')) return json({ attemptId: ATTEMPT, questions });
      if (url.includes('/api/v1/assessment/timer')) return json(timer(inbox.length, examState, examState === 'PAUSED' ? '2026-09-30T01:14:00.000Z' : null));
      if (url.includes('/api/v1/assessment/broadcasts/inbox')) {
        inboxCalls.push(JSON.parse(init?.body as string).received);
        return json(inboxOf(inbox));
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        const body = JSON.parse(init?.body as string);
        return json({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: 1 });
      }
      return json({ error: 'not_found' }, 404);
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDisplayTimeZone(null);
    window.history.pushState({}, '', '/');
  });

  const checkNow = () => act(async () => {
    window.dispatchEvent(new Event('online'));
  });

  it('shows a new message without taking the focus or stopping the answers, and keeps it to reread', async () => {
    render(<StudentExamWorkstation />);
    const choice = await screen.findByLabelText(/Oksigen/);
    await userEvent.click(choice);
    const focused = document.activeElement;
    inbox = [{ id: 'm-1', text: 'Ujian tersisa 15 menit.', sentAt: new Date(Date.now() - 30_000).toISOString() }];
    await checkNow();

    const banner = (await screen.findByText('Ujian tersisa 15 menit.', { selector: '.broadcast-banner-text' })).closest('.broadcast-banner') as HTMLElement;
    expect(banner.getAttribute('role')).toBe('status');
    expect(within(banner).getByText(/^Pesan pengawas, \d{2}\.\d{2} WIB$/)).toBeTruthy();
    expect(document.activeElement).toBe(focused);
    await waitFor(() => expect(inboxCalls).toContainEqual(['m-1']));

    // Answering goes on while the notice is shown.
    await userEvent.click(screen.getByLabelText(/Emas/));
    expect(await screen.findByText('Tersimpan')).toBeTruthy();
    const navigator = screen.getByRole('navigation', { name: 'Daftar Soal Ujian' });
    expect(within(navigator).getByText('Ujian tersisa 15 menit.')).toBeTruthy();

    await userEvent.click(within(banner).getByRole('button', { name: 'Tutup' }));
    expect(document.querySelector('.broadcast-banner')).toBeNull();
    expect(within(navigator).getByText('Ujian tersisa 15 menit.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('—');
  });

  it('shows the latest message on the paused screen', async () => {
    examState = 'PAUSED';
    inbox = [{ id: 'm-2', text: 'Ujian dijeda sebentar. Tetap di tempat duduk.', sentAt: new Date().toISOString() }];
    render(<StudentExamWorkstation />);
    await screen.findByText(PROMPT);
    await checkNow();
    expect(await screen.findByRole('heading', { name: 'Ujian Dijeda' })).toBeTruthy();
    const latest = await screen.findByRole('region', { name: 'Pesan pengawas terbaru' });
    expect(within(latest).getByText('Ujian dijeda sebentar. Tetap di tempat duduk.')).toBeTruthy();
  });
});
