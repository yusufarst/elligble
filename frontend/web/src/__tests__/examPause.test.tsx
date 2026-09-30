import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import type { ResumeResponse, StudentSafeQuestion, TimerResponse } from '../types/assessment.ts';
import { openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { setDisplayTimeZone } from '../lib/format.ts';

// The student's exam screen under a teacher's pause or end (Owner decision 2026-09-30): paused
// means read-only with the questions hidden and the time frozen; an answer chosen before the
// pause is still saved; a choice made after it is not, and the student is told; resume
// continues from the frozen time; end lets the attempt finish on its own time. A supervisor's
// lock of one attempt (D04.6-38/40) hides the questions the same way but the time keeps running.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const Q1 = '33333333-3333-4333-8333-333333333331';
const Q2 = '33333333-3333-4333-8333-333333333332';
const PROMPT = 'Manakah unsur kimia dengan simbol O?';

const questions: StudentSafeQuestion[] = [
  { snapshotId: Q1, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: PROMPT, options: [{ id: 'opt-a', content: 'Emas' }, { id: 'opt-b', content: 'Oksigen' }] },
  { snapshotId: Q2, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Manakah gas mulia?', options: [{ id: 'opt-c', content: 'Neon' }, { id: 'opt-d', content: 'Klorin' }] },
];

const PAUSED_AT = '2026-09-30T01:14:00.000Z';

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

function timer(examState: string, pausedAt: string | null = null, remaining = 2530, lockedAt: string | null = null): TimerResponse {
  return { status: 'active', startedAt: '2026-09-30T01:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: remaining, examState, pausedAt, lockedAt };
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
    if (url.includes('/api/v1/assessment/timer')) return json(timer('ACTIVE'));
    if (url.includes('/api/v1/assessment/answer/save')) {
      const body = JSON.parse(init?.body as string);
      return json({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: 1 });
    }
    return json({ error: 'not_found' }, 404);
  });
}

/** The workstation checks the exam state at once when the connection returns. */
const checkNow = () => act(async () => {
  window.dispatchEvent(new Event('online'));
});

describe('the exam screen during a pause', () => {
  beforeEach(async () => {
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    setDisplayTimeZone('Asia/Jakarta');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDisplayTimeZone(null);
    window.history.pushState({}, '', '/');
  });

  it('opens paused after a reload: no question content, the frozen time, then the exam continues from it', async () => {
    let examState = 'PAUSED';
    const fetchSpy = server({
      '/api/v1/assessment/resume': () => json(resume({ exam: { lifecycleState: 'PAUSED', pausedAt: PAUSED_AT } })),
      '/api/v1/assessment/timer': () => json(timer(examState, examState === 'PAUSED' ? PAUSED_AT : null)),
    });
    globalThis.fetch = fetchSpy;
    render(<StudentExamWorkstation />);

    expect(await screen.findByRole('heading', { name: 'Ujian Dijeda' })).toBeTruthy();
    expect(screen.getByText(/Guru menjeda ujian sejak 08\.14 WIB\./)).toBeTruthy();
    expect(screen.getByText('42:10')).toBeTruthy();
    expect(await screen.findByText('Semua jawaban yang Anda pilih sebelum ujian dijeda sudah tersimpan.')).toBeTruthy();
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(fetchSpy.mock.calls.some(c => (c[0] as string).includes('/questions'))).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(screen.getByText('42:10')).toBeTruthy();
    expect(document.body.textContent).not.toContain('—');

    examState = 'ACTIVE';
    await checkNow();
    expect(await screen.findByText(PROMPT)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ujian Dijeda' })).toBeNull();
    expect(screen.getByLabelText(/Sisa waktu pengerjaan ujian: 42:(10|09)/)).toBeTruthy();
  });

  it('saves an answer chosen before the pause even though it reaches the server during the pause', async () => {
    let examState = 'ACTIVE';
    let pausedAt: string | null = null;
    const saves: Array<{ capturedAt: string }> = [];
    globalThis.fetch = server({
      '/api/v1/assessment/timer': () => json(timer(examState, pausedAt)),
      '/api/v1/assessment/answer/save': (_url, init) => {
        const body = JSON.parse(init?.body as string);
        saves.push(body);
        if (examState === 'ACTIVE') {
          // The request is lost while the teacher pauses the exam.
          examState = 'PAUSED';
          pausedAt = new Date(Date.now() + 1).toISOString();
          throw new TypeError('Failed to fetch');
        }
        if (Date.parse(body.capturedAt) >= Date.parse(pausedAt!)) return json({ error: 'exam_paused', pausedAt }, 409);
        return json({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: 1 });
      },
    });
    render(<StudentExamWorkstation />);
    await userEvent.click(await screen.findByLabelText(/Oksigen/));
    await waitFor(() => expect(saves).toHaveLength(1));
    await checkNow();
    expect(await screen.findByRole('heading', { name: 'Ujian Dijeda' })).toBeTruthy();
    expect(await screen.findByText('Semua jawaban yang Anda pilih sebelum ujian dijeda sudah tersimpan.', undefined, { timeout: 4000 })).toBeTruthy();
    expect(saves).toHaveLength(2);
    expect(saves[1].capturedAt).toBe(saves[0].capturedAt);
  });

  it('switches to the paused screen when a save shows the pause, and says which choice was not saved', async () => {
    let examState = 'ACTIVE';
    const boundary = new Date(Date.now() - 60_000).toISOString();
    globalThis.fetch = server({
      '/api/v1/assessment/timer': () => json(timer(examState, examState === 'PAUSED' ? boundary : null)),
      '/api/v1/assessment/answer/save': () => {
        examState = 'PAUSED';
        return json({ error: 'exam_paused', pausedAt: boundary }, 409);
      },
    });
    render(<StudentExamWorkstation />);
    await userEvent.click(await screen.findByLabelText(/Oksigen/));

    expect(await screen.findByRole('heading', { name: 'Ujian Dijeda' })).toBeTruthy();
    expect(await screen.findByText('Pilihan jawaban pada soal 1 dibuat setelah ujian dijeda sehingga tidak disimpan. Periksa kembali soal tersebut.')).toBeTruthy();
    expect(screen.queryByText(PROMPT)).toBeNull();

    examState = 'ACTIVE';
    await checkNow();
    expect(await screen.findByText(PROMPT)).toBeTruthy();
    expect(screen.getByText('Pilihan jawaban pada soal 1 dibuat setelah ujian dijeda sehingga tidak disimpan. Periksa kembali soal tersebut.')).toBeTruthy();
    expect((screen.getByLabelText(/Oksigen/) as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Mengerti' }));
    expect(screen.queryByText(/dibuat setelah ujian dijeda/)).toBeNull();
  });

  it('does not submit while paused', async () => {
    let examState = 'ACTIVE';
    globalThis.fetch = server({
      '/api/v1/assessment/timer': () => json(timer(examState, examState === 'PAUSED' ? PAUSED_AT : null)),
      '/api/v1/assessment/submit': () => {
        examState = 'PAUSED';
        return json({ error: 'exam_paused', pausedAt: PAUSED_AT }, 409);
      },
    });
    render(<StudentExamWorkstation />);
    await screen.findByText(PROMPT);
    await userEvent.click(screen.getByRole('button', { name: 'Selesaikan Ujian' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Kirim Jawaban Sekarang' }));
    expect(await screen.findByRole('heading', { name: 'Ujian Dijeda' })).toBeTruthy();
    expect(screen.queryByText('Ujian Berhasil Dikumpulkan')).toBeNull();
  });

  it('shows a calm note when the teacher ends the exam and lets the student keep working', async () => {
    let examState = 'ACTIVE';
    globalThis.fetch = server({
      '/api/v1/assessment/timer': () => json(timer(examState)),
    });
    render(<StudentExamWorkstation />);
    await screen.findByText(PROMPT);
    examState = 'ENDED';
    await checkNow();
    expect(await screen.findByText('Guru telah mengakhiri ujian. Anda tetap dapat menyelesaikan sampai waktu Anda habis.')).toBeTruthy();
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    expect(await screen.findByText('Tersimpan')).toBeTruthy();
  });
});

const LOCKED_AT = '2026-09-30T01:20:00.000Z';

describe('the exam screen while a supervisor locks the attempt', () => {
  beforeEach(async () => {
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    setDisplayTimeZone('Asia/Jakarta');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDisplayTimeZone(null);
    window.history.pushState({}, '', '/');
  });

  it('opens locked after a reload: no question content, the time keeps running, then the questions return on unlock', async () => {
    let lockedAt: string | null = LOCKED_AT;
    const fetchSpy = server({
      '/api/v1/assessment/resume': () => json(resume({ lock: { lockedAt: LOCKED_AT } })),
      '/api/v1/assessment/timer': () => json(timer('ACTIVE', null, 2530, lockedAt)),
    });
    globalThis.fetch = fetchSpy;
    render(<StudentExamWorkstation />);

    expect(await screen.findByRole('heading', { name: 'Pengerjaan Dikunci' })).toBeTruthy();
    expect(screen.getByText(/Pengawas mengunci pengerjaan Anda sejak 08\.20 WIB\./)).toBeTruthy();
    expect(screen.getByText('Sisa waktu, tetap berjalan')).toBeTruthy();
    expect(await screen.findByText('Semua jawaban yang Anda pilih sebelum pengerjaan dikunci sudah tersimpan.')).toBeTruthy();
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(fetchSpy.mock.calls.some(c => (c[0] as string).includes('/questions'))).toBe(false);
    // Unlike a pause, the countdown does not stop.
    await waitFor(() => expect(screen.queryByText('42:10')).toBeNull(), { timeout: 2500 });
    expect(screen.getByText(/42:0\d/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('—');

    lockedAt = null;
    await checkNow();
    expect(await screen.findByText(PROMPT)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pengerjaan Dikunci' })).toBeNull();
  });

  it('switches to the locked screen when a save shows the lock, and says which choice was not saved', async () => {
    let lockedAt: string | null = null;
    let unlocked = false;
    const boundary = new Date(Date.now() - 60_000).toISOString();
    globalThis.fetch = server({
      '/api/v1/assessment/timer': () => json(timer('ACTIVE', null, 2530, lockedAt)),
      '/api/v1/assessment/answer/save': (_url, init) => {
        const body = JSON.parse(init?.body as string);
        if (unlocked) return json({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: 1 });
        lockedAt = boundary;
        return json({ error: 'attempt_locked', lockedAt: boundary }, 409);
      },
    });
    render(<StudentExamWorkstation />);
    await userEvent.click(await screen.findByLabelText(/Oksigen/));

    expect(await screen.findByRole('heading', { name: 'Pengerjaan Dikunci' })).toBeTruthy();
    expect(await screen.findByText('Pilihan jawaban pada soal 1 dibuat setelah pengerjaan dikunci sehingga tidak disimpan. Periksa kembali soal tersebut.')).toBeTruthy();
    expect(screen.queryByText(PROMPT)).toBeNull();

    lockedAt = null;
    unlocked = true;
    await checkNow();
    expect(await screen.findByText(PROMPT)).toBeTruthy();
    expect((screen.getByLabelText(/Oksigen/) as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    expect(await screen.findByText('Tersimpan')).toBeTruthy();
  });

  it('does not submit while locked', async () => {
    let lockedAt: string | null = null;
    globalThis.fetch = server({
      '/api/v1/assessment/timer': () => json(timer('ACTIVE', null, 2530, lockedAt)),
      '/api/v1/assessment/submit': () => {
        lockedAt = LOCKED_AT;
        return json({ error: 'attempt_locked', lockedAt: LOCKED_AT }, 409);
      },
    });
    render(<StudentExamWorkstation />);
    await screen.findByText(PROMPT);
    await userEvent.click(screen.getByRole('button', { name: 'Selesaikan Ujian' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Kirim Jawaban Sekarang' }));
    expect(await screen.findByRole('heading', { name: 'Pengerjaan Dikunci' })).toBeTruthy();
    expect(screen.queryByText('Ujian Berhasil Dikumpulkan')).toBeNull();
  });
});

// Answers about the exam state can arrive out of order (ASSESS-SYNC-001): a state check that
// was answered before the pause or lock began must not bring the questions back after a save
// has already reported it.
describe('the exam screen with state answers out of order', () => {
  beforeEach(async () => {
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    setDisplayTimeZone('Asia/Jakarta');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setDisplayTimeZone(null);
    window.history.pushState({}, '', '/');
  });

  const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

  it('stays locked when a state answer produced before the lock arrives after a save reported it', async () => {
    const lockedAt = at(-60_000);
    let fresh = false;
    let unlocked = false;
    globalThis.fetch = server({
      '/api/v1/assessment/timer': () => json({ ...timer('ACTIVE', null, 2530, fresh && !unlocked ? lockedAt : null), serverTime: fresh ? at(10_000) : at(-120_000) }),
      '/api/v1/assessment/answer/save': (_url, init) => {
        const body = JSON.parse(init?.body as string);
        if (unlocked) return json({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: 1 });
        return json({ error: 'attempt_locked', lockedAt, serverTime: at(5_000) }, 409);
      },
    });
    render(<StudentExamWorkstation />);
    await userEvent.click(await screen.findByLabelText(/Oksigen/));
    expect(await screen.findByRole('heading', { name: 'Pengerjaan Dikunci' })).toBeTruthy();
    // The check after the refusal is answered with the state from before the lock.
    await checkNow();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.getByRole('heading', { name: 'Pengerjaan Dikunci' })).toBeTruthy();
    expect(screen.queryByText(PROMPT)).toBeNull();

    fresh = true;
    unlocked = true;
    await checkNow();
    expect(await screen.findByText(PROMPT)).toBeTruthy();
  });

  it('stays paused when a state answer produced before the pause arrives after a save reported it', async () => {
    const pausedAt = at(-60_000);
    let fresh = false;
    globalThis.fetch = server({
      '/api/v1/assessment/timer': () => json({ ...timer('ACTIVE'), serverTime: fresh ? at(10_000) : at(-120_000) }),
      '/api/v1/assessment/answer/save': () => json({ error: 'exam_paused', pausedAt, serverTime: at(5_000) }, 409),
    });
    render(<StudentExamWorkstation />);
    await userEvent.click(await screen.findByLabelText(/Oksigen/));
    expect(await screen.findByRole('heading', { name: 'Ujian Dijeda' })).toBeTruthy();
    await checkNow();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.getByRole('heading', { name: 'Ujian Dijeda' })).toBeTruthy();
    expect(screen.queryByText(PROMPT)).toBeNull();

    fresh = true;
    await checkNow();
    expect(await screen.findByText(PROMPT)).toBeTruthy();
  });
});
