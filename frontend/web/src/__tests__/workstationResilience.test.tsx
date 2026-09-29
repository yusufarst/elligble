import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import type { ResumeResponse, StudentSafeQuestion } from '../types/assessment.ts';
import { openAnswerStore } from '../exam/answer-store.ts';
import { readExamSessionId, storeExamSessionId } from '../exam/exam-session.ts';

// Answer preservation and session integrity of the exam screen (D04.5-20..24, D04.5-45..48,
// D04.4-37): offline, reload, supersession, expiry and submission failures.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const Q1 = '33333333-3333-4333-8333-333333333331';

const questions: StudentSafeQuestion[] = [
  {
    snapshotId: Q1,
    schemaVersion: 1,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    prompt: 'Manakah unsur kimia dengan simbol O?',
    options: [
      { id: 'opt-a', content: 'Emas' },
      { id: 'opt-b', content: 'Oksigen' },
    ],
  },
];

function resume(overrides: Partial<ResumeResponse> = {}): ResumeResponse {
  return {
    attemptId: ATTEMPT,
    session: { status: 'active', activatedAt: '2026-09-29T08:00:00.000Z', ownedByCaller: true },
    answers: [],
    timer: {
      status: 'active',
      startedAt: '2026-09-29T08:00:00.000Z',
      configuredDurationSeconds: 3600,
      effectiveDurationSeconds: 3600,
      effectiveRemainingSeconds: 3000,
    },
    submission: { status: 'not_submitted' },
    context: { subjectLabel: 'Kimia', roomLabel: null },
    ...overrides,
  };
}

type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function server(overrides: Record<string, Handler> = {}): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string, init?: RequestInit) => {
    for (const [fragment, handler] of Object.entries(overrides)) {
      if (url.includes(fragment)) return handler(url, init);
    }
    if (url.includes('/api/v1/assessment/resume')) return json(resume());
    if (url.includes('/api/v1/assessment/questions')) return json({ attemptId: ATTEMPT, questions });
    if (url.includes('/api/v1/assessment/answer/save')) {
      const body = JSON.parse(init?.body as string);
      return json({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: 1 });
    }
    return json({ error: 'not_found' }, 404);
  });
}

async function openExam(onRequestTakeover?: () => void) {
  const view = render(<StudentExamWorkstation onRequestTakeover={onRequestTakeover} />);
  expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();
  return view;
}

describe('StudentExamWorkstation resilience', () => {
  beforeEach(async () => {
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('sends this tab\'s own exam session id when loading and saving', async () => {
    const fetchSpy = server();
    globalThis.fetch = fetchSpy;
    await openExam();
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    await screen.findByText('Tersimpan');
    const resumeUrl = fetchSpy.mock.calls.map(c => c[0] as string).find(u => u.includes('/resume'));
    expect(resumeUrl).toContain(`examSessionId=${SESSION}`);
    const save = fetchSpy.mock.calls.find(c => (c[0] as string).includes('/answer/save'));
    expect(JSON.parse(save![1]!.body as string).sessionId).toBe(SESSION);
  });

  it('stops writing and explains when the exam session moved to another device', async () => {
    globalThis.fetch = server({
      '/api/v1/assessment/answer/save': () => json({ error: 'session_not_active' }, 409),
    });
    const takeover = vi.fn();
    await openExam(takeover);
    await userEvent.click(screen.getByLabelText(/Oksigen/));

    expect(await screen.findByText('Sesi Dipindahkan')).toBeTruthy();
    expect(screen.getByText('Sesi ujian Anda telah dibuka di perangkat lain. Sesi pada perangkat ini dinonaktifkan.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Lanjutkan di Perangkat Ini' }));
    expect(takeover).toHaveBeenCalledTimes(1);
  });

  it('does not open the exam for writing when another device holds the session', async () => {
    const fetchSpy = server({
      '/api/v1/assessment/resume': () => json(resume({ session: { status: 'active', activatedAt: '2026-09-29T08:00:00.000Z', ownedByCaller: false } })),
    });
    globalThis.fetch = fetchSpy;
    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Sesi Dipindahkan')).toBeTruthy();
    expect(fetchSpy.mock.calls.some(c => (c[0] as string).includes('/questions'))).toBe(false);
  });

  it('keeps answering offline with an honest state, then syncs by itself when back online', async () => {
    let online = false;
    const saves: string[] = [];
    globalThis.fetch = server({
      '/api/v1/assessment/answer/save': (_url, init) => {
        const body = JSON.parse(init?.body as string);
        saves.push(body.answerPayload.selectedOptionId);
        if (!online) throw new TypeError('Failed to fetch');
        return json({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: 1 });
      },
    });
    await openExam();
    await userEvent.click(screen.getByLabelText(/Oksigen/));

    expect(await screen.findByText('Gagal menyimpan')).toBeTruthy();
    expect(screen.queryByText('Tersimpan')).toBeNull();
    // No durable storage in this environment: the banner must not promise that a reload is safe.
    expect(screen.getByText(/Koneksi terputus\. Jangan tutup atau muat ulang halaman ini\./)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Selesaikan Ujian' }) as HTMLButtonElement).disabled).toBe(true);

    online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByText('Tersimpan')).toBeTruthy();
    expect(screen.queryByText(/Koneksi terputus/)).toBeNull();
    expect(saves.at(-1)).toBe('opt-b');
    expect((screen.getByRole('button', { name: 'Selesaikan Ujian' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('restores an unsynced choice after the exam screen is reopened and sends it', async () => {
    globalThis.fetch = server({
      '/api/v1/assessment/answer/save': () => json({ error: 'persistence_unavailable' }, 503),
    });
    const first = await openExam();
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    await screen.findByText('Gagal menyimpan');
    first.unmount();

    const fetchSpy = server();
    globalThis.fetch = fetchSpy;
    await openExam();
    expect(await screen.findByText('Tersimpan')).toBeTruthy();
    expect((screen.getByLabelText(/Oksigen/) as HTMLInputElement).checked).toBe(true);
    const save = fetchSpy.mock.calls.find(c => (c[0] as string).includes('/answer/save'));
    expect(JSON.parse(save![1]!.body as string).answerPayload).toEqual({ selectedOptionId: 'opt-b' });
  });

  it('continues the exam when the server says the time is not over yet', async () => {
    let finalizeCalls = 0;
    globalThis.fetch = server({
      '/api/v1/assessment/resume': () => json(resume({
        timer: { status: 'active', startedAt: '2026-09-29T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 1 },
      })),
      '/api/v1/assessment/expiry-finalize': () => {
        finalizeCalls++;
        return json({ error: 'timer_not_expired' }, 409);
      },
      '/api/v1/assessment/timer': () => json({ status: 'active', startedAt: '2026-09-29T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 120 }),
    });
    await openExam();
    await waitFor(() => expect(finalizeCalls).toBe(1), { timeout: 3000 });
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();
    expect(await screen.findByText('02:00')).toBeTruthy();
  });

  it('never claims that a choice the server did not receive was submitted', async () => {
    globalThis.fetch = server({
      '/api/v1/assessment/resume': () => json(resume({
        timer: { status: 'active', startedAt: '2026-09-29T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 2 },
      })),
      '/api/v1/assessment/answer/save': () => json({ error: 'persistence_unavailable' }, 503),
      '/api/v1/assessment/expiry-finalize': () => json({ status: 'submitted', submissionId: 'sub-1', submittedAt: '2026-09-29T09:00:00.000Z' }),
    });
    await openExam();
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    await screen.findByText('Gagal menyimpan');

    expect(await screen.findByText('Ujian Berhasil Dikumpulkan', {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByText('1 jawaban terakhir di perangkat ini belum diterima server sebelum ujian berakhir. Laporkan kepada pengawas ruangan.')).toBeTruthy();
    expect(await (await openAnswerStore()).listForAttempt('', ATTEMPT)).toEqual([]);
  }, 12000);

  it('shows a failed submission inline, lets the student retry, then forgets the device copy', async () => {
    let submitCalls = 0;
    globalThis.fetch = server({
      '/api/v1/assessment/submit': () => {
        submitCalls++;
        return submitCalls === 1
          ? json({ error: 'persistence_unavailable' }, 503)
          : json({ status: 'submitted', submissionId: 'sub-2', submittedAt: '2026-09-29T08:40:00.000Z' });
      },
    });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await openExam();
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    await screen.findByText('Tersimpan');

    await userEvent.click(screen.getByRole('button', { name: 'Selesaikan Ujian' }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Kirim Jawaban Sekarang' }));
    expect(await screen.findByText('Gagal mengumpulkan ujian. Periksa koneksi internet Anda lalu coba lagi.')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Kirim Jawaban Sekarang' }));
    expect(await screen.findByText('Ujian Berhasil Dikumpulkan')).toBeTruthy();
    expect(submitCalls).toBe(2);
    expect(readExamSessionId(ATTEMPT)).toBeNull();
  });
  it('reminds the student without blocking when the remaining time crosses 5 minutes', async () => {
    globalThis.fetch = server({
      '/api/v1/assessment/resume': () => json(resume({
        timer: { status: 'active', startedAt: '2026-09-29T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 301 },
      })),
    });
    await openExam();
    expect(screen.queryByText(/Sisa waktu \d+ menit\./)).toBeNull();
    expect(await screen.findByText('Sisa waktu 5 menit.', {}, { timeout: 4000 })).toBeTruthy();
    // Answering continues while the reminder is shown.
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    expect(await screen.findByText('Tersimpan')).toBeTruthy();
  });
});
