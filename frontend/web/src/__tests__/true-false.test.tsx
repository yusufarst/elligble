import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { TrueFalseAnswer } from '../components/answers/TrueFalseAnswer.tsx';
import { TeacherExamPreviewView } from '../components/TeacherExamPreviewView.tsx';
import { AnswerSyncEngine, type SaveOutcome, type SyncApi } from '../exam/answer-sync-engine.ts';
import { MemoryAnswerStore, answerKey, attemptKey, openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { createAnswerSyncApi, toServerAnswerState } from '../exam/answer-sync-api.ts';
import { TRUE_FALSE_KEY, answerValueOf, isAnsweredValue, type ResumeResponse, type StudentSafeQuestion } from '../types/assessment.ts';

// ASSESS-QUESTION-003 client (record §4.4/§4A, C05): canonical "true"/"false" values, the payload
// built only from them, the Benar/Salah control with keyboard and pointer, local recovery,
// adoption, no key in any record, and the true/false teacher preview.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const TF = '33333333-3333-4333-8333-333333333333';
const tfQuestion = { snapshotId: TF, schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Matahari terbit dari arah timur' } as unknown as StudentSafeQuestion;
const resume = (): ResumeResponse => ({
  attemptId: ATTEMPT, session: { status: 'active', activatedAt: '2026-11-08T08:00:00.000Z', ownedByCaller: true }, answers: [],
  timer: { status: 'active', startedAt: '2026-11-08T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3000 },
  submission: { status: 'not_submitted' }, context: { subjectLabel: 'IPA', roomLabel: null },
} as ResumeResponse);

describe('true/false values', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('maps strict booleans only and builds the payload only from "true"/"false"', async () => {
    expect(answerValueOf({ value: true })).toBe('true');
    expect(answerValueOf({ value: false })).toBe('false');
    for (const bad of [{ value: 'true' }, { value: 1 }, { value: null }]) expect(answerValueOf(bad)).toBeNull();
    expect(isAnsweredValue(TRUE_FALSE_KEY, 'false')).toBe(true);
    expect(toServerAnswerState({ snapshotId: TF, answerPayload: { value: false }, writeVersion: 1, clientWriteIdentity: 'c', updatedAt: '' } as never).optionId).toBe('false');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: 'c', writeVersion: 1, serverTime: new Date().toISOString() }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createAnswerSyncApi(ATTEMPT, SESSION);
    const base = { attemptId: ATTEMPT, sessionId: SESSION, snapshotId: TF, contentKey: TRUE_FALSE_KEY, clientWriteIdentity: 'c', expectedWriteVersion: null, capturedAt: 0 };
    expect((await api.save({ ...base, optionId: 'true' })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ value: true });
    for (const bad of ['TRUE', 'benar', '1', '']) expect(await api.save({ ...base, optionId: bad })).toEqual({ kind: 'rejected', code: 'invalid_answer_payload' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('TrueFalseAnswer', () => {
  it('offers Benar and Salah as radio cards, nothing preselected, keyboard and pointer', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TrueFalseAnswer question={tfQuestion} value={undefined} onChange={onChange} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map(r => r.labels?.[0]?.textContent?.trim())).toEqual(['BBenar', 'SSalah']);
    expect(radios.every(r => !r.checked)).toBe(true);
    await userEvent.click(screen.getByText('Salah'));
    expect(onChange).toHaveBeenLastCalledWith('false');
    rerender(<TrueFalseAnswer question={tfQuestion} value="false" onChange={onChange} />);
    expect((screen.getByRole('radio', { name: 'Salah' }) as HTMLInputElement).checked).toBe(true);
    screen.getByRole('radio', { name: 'Benar' }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith('true');
  });
});

describe('the exam screen with true/false', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
  beforeEach(async () => {
    vi.restoreAllMocks();
    saves.length = 0;
    fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) return new Response(JSON.stringify(resume()), { status: 200 });
      if (url.includes('/api/v1/assessment/questions')) return new Response(JSON.stringify({ attemptId: ATTEMPT, questions: [tfQuestion] }), { status: 200 });
      if (url.includes('/api/v1/assessment/answer/save')) {
        const body = JSON.parse(String(init?.body));
        saves.push(body);
        return new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: saves.length, serverTime: new Date().toISOString() }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });
    globalThis.fetch = fetchSpy;
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
  });
  afterEach(() => { vi.restoreAllMocks(); window.history.pushState({}, '', '/'); });

  it('renders the control, saves a strict boolean and shows it saved; no key in any record', async () => {
    render(<StudentExamWorkstation />);
    expect(await screen.findByRole('radio', { name: 'Benar' })).toBeTruthy();
    await userEvent.click(screen.getByText('Benar'));
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ value: true }));
    await waitFor(() => expect(document.querySelector('.save-status-text')?.textContent).toBe('Tersimpan'));
    await userEvent.click(screen.getByText('Salah'));
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ value: false }));
    for (const record of await (await openAnswerStore()).listForAttempt('', ATTEMPT)) expect(JSON.stringify(record)).not.toMatch(/correct/i);
  });

  it('an unsent value on this device is recovered after a reload and sent', async () => {
    await (await openAnswerStore()).put({ key: answerKey('', ATTEMPT, TF), attemptKey: attemptKey('', ATTEMPT), tenantId: '', attemptId: ATTEMPT, snapshotId: TF, examSessionId: SESSION,
      contentKey: TRUE_FALSE_KEY, optionId: 'false', clientWriteIdentity: 'local-tf', ownIdentities: [], baseVersion: null, localSequence: 1, capturedAt: Date.now() });
    render(<StudentExamWorkstation />);
    expect(await screen.findByRole('radio', { name: 'Salah' })).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'Salah' }) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(saves.map(x => [x.snapshotId, x.answerPayload])).toEqual([[TF, { value: false }]]));
  });
});

describe('adoption by another session', () => {
  it('keeps the value, version and identity; a newer foreign answer is kept instead', async () => {
    const calls: Array<{ snapshotId: string; optionId: string; contentKey: string; expectedWriteVersion: number | null; clientWriteIdentity: string }> = [];
    const api: SyncApi = { save: async req => { calls.push(req); return { kind: 'ack', writeVersion: (req.expectedWriteVersion ?? 0) + 1, clientWriteIdentity: req.clientWriteIdentity } as SaveOutcome; }, fetchServerAnswers: async () => [] };
    const store = new MemoryAnswerStore();
    const old = (snapshotId: string, optionId: string, baseVersion: number | null) => ({ key: answerKey('t', ATTEMPT, snapshotId), attemptKey: attemptKey('t', ATTEMPT), tenantId: 't', attemptId: ATTEMPT,
      snapshotId, examSessionId: 'old', contentKey: TRUE_FALSE_KEY, optionId, clientWriteIdentity: `old-${snapshotId}`, ownIdentities: [], baseVersion, localSequence: 1, capturedAt: 0 });
    await store.put(old('q-keep', 'true', 1));
    await store.put(old('q-gone', 'true', null));
    const engine = new AnswerSyncEngine({ tenantId: 't', attemptId: ATTEMPT, examSessionId: SESSION, store, api,
      events: { onChange: () => {}, onSessionInactive: () => {}, onTerminal: () => {}, onUnauthorized: () => {} }, newIdentity: () => 'n', random: () => 0 });
    expect(await engine.initialize([
      { snapshotId: 'q-keep', optionId: 'false', writeVersion: 1, clientWriteIdentity: 'mine' },
      { snapshotId: 'q-gone', optionId: 'false', writeVersion: 2, clientWriteIdentity: 'other' },
    ])).toEqual({ adopted: 1, discarded: 1 });
    await waitFor(() => expect(calls.map(c => [c.snapshotId, c.contentKey, c.optionId, c.expectedWriteVersion, c.clientWriteIdentity])).toEqual([['q-keep', TRUE_FALSE_KEY, 'true', 1, 'old-q-keep']]));
    expect(engine.view('q-gone')).toEqual({ optionId: 'false', status: 'saved' });
    engine.dispose();
  });
});

describe('teacher preview of true/false', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('shows Benar/Salah try-out cards that send nothing and the key on request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      exam: { examInstanceId: ATTEMPT, subjectLabel: 'IPA', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
        windowStartsAt: '2026-11-08T01:00:00.000Z', windowEndsAt: '2026-11-08T03:00:00.000Z', durationMinutes: 60 },
      questions: [{ snapshotId: 't1', no: 1, prompt: 'Matahari terbit dari arah timur', options: [], correctOptionId: null, correctOptionIds: null, correctValue: false,
        questionType: 'TRUE_FALSE', maxScore: 2, valid: true }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TeacherExamPreviewView examInstanceId={ATTEMPT} onBack={() => {}} />);
    expect(await screen.findByText('Matahari terbit dari arah timur')).toBeTruthy();
    expect(screen.getByText(/Benar\/Salah/)).toBeTruthy();
    await userEvent.click(screen.getByText('Benar'));
    expect((screen.getByRole('radio', { name: 'Benar' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText('Kunci jawaban')).toBeNull();
    await userEvent.click(screen.getByLabelText('Tampilkan kunci jawaban dan skor'));
    expect(screen.getAllByText('Kunci jawaban')).toHaveLength(1);
    expect(screen.getByText('Salah').closest('label')?.textContent).toContain('Kunci jawaban');
    expect(screen.getByText('Skor 2')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
