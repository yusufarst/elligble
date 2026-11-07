import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { MultipleResponseAnswer } from '../components/answers/MultipleResponseAnswer.tsx';
import { TeacherExamPreviewView } from '../components/TeacherExamPreviewView.tsx';
import { AnswerSyncEngine, type SaveOutcome, type SyncApi } from '../exam/answer-sync-engine.ts';
import { MemoryAnswerStore } from '../exam/answer-store.ts';
import type { StudentSafeQuestion, ResumeResponse } from '../types/assessment.ts';
import { MULTIPLE_RESPONSE_KEY, V1_SINGLE_CHOICE_KEY, answerValueOf, canonicalSelection, isAnsweredValue, selectionOf } from '../types/assessment.ts';
import { answerKey, attemptKey, openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { countUnreceivedLocalAnswers, createAnswerSyncApi, toServerAnswerState } from '../exam/answer-sync-api.ts';

// ASSESS-QUESTION-002 client (record §4.5/§4.6/§4A.2–§4A.4, C06): the canonical answer value,
// the checkbox control, "Belum dijawab" for a cleared choice, the payload built by content key,
// the post-submission check, and the honest state for content this client cannot show.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const MR = '33333333-3333-4333-8333-333333333332';
const PG = '33333333-3333-4333-8333-333333333331';
const mrQuestion: StudentSafeQuestion = {
  snapshotId: MR, schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt: 'Bilangan prima di bawah 10 adalah',
  options: ['2', '4', '5', '8', '9'].map((content, i) => ({ id: `opt-${'abcde'[i]}`, content })),
};
const pgQuestion: StudentSafeQuestion = {
  snapshotId: PG, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Ibu kota Indonesia adalah',
  options: ['Bandung', 'Jakarta', 'Surabaya', 'Medan', 'Makassar'].map((content, i) => ({ id: `pg-${i}`, content })),
};
const resume = (answers: ResumeResponse['answers'] = []): ResumeResponse => ({
  attemptId: ATTEMPT, session: { status: 'active', activatedAt: '2026-11-07T08:00:00.000Z', ownedByCaller: true }, answers,
  timer: { status: 'active', startedAt: '2026-11-07T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3000 },
  submission: { status: 'not_submitted' }, context: { subjectLabel: 'Matematika', roomLabel: null },
} as ResumeResponse);

describe('canonical multiple-response values', () => {
  it('sorts by code units, maps payloads both ways and refuses anything malformed', () => {
    expect(canonicalSelection(['opt-c', 'opt-a'])).toBe('["opt-a","opt-c"]');
    expect(answerValueOf({ selectedOptionIds: ['opt-c', 'opt-a'] })).toBe('["opt-a","opt-c"]');
    expect(answerValueOf({ selectedOptionIds: [] })).toBe('[]');
    expect(answerValueOf({ selectedOptionId: 'pg-1' })).toBe('pg-1');
    for (const bad of [{ selectedOptionIds: 'a' }, { selectedOptionIds: [1] }, { selectedOptionIds: ['a', 'a'] }, null, 'x']) expect(answerValueOf(bad)).toBeNull();
    expect(selectionOf('["opt-a","opt-c"]')).toEqual(['opt-a', 'opt-c']);
    for (const bad of ['["opt-c","opt-a"]', '["a","a"]', '[1]', 'nope', '{}']) expect(selectionOf(bad)).toBeNull();
    expect(isAnsweredValue(MULTIPLE_RESPONSE_KEY, '[]')).toBe(false);
    expect(isAnsweredValue(MULTIPLE_RESPONSE_KEY, '["opt-a"]')).toBe(true);
    expect(isAnsweredValue(V1_SINGLE_CHOICE_KEY, '[]')).toBe(true);
    expect(isAnsweredValue(MULTIPLE_RESPONSE_KEY, undefined)).toBe(false);
    expect(toServerAnswerState({ snapshotId: MR, answerPayload: { selectedOptionIds: ['opt-e', 'opt-a'] }, writeVersion: 3, clientWriteIdentity: 'c', updatedAt: '' } as never).optionId).toBe('["opt-a","opt-e"]');
  });

  it('the HTTP adapter builds the payload by key and never sends a malformed value', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: 'c', writeVersion: 1, serverTime: new Date().toISOString() }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createAnswerSyncApi(ATTEMPT, SESSION);
    const base = { attemptId: ATTEMPT, sessionId: SESSION, snapshotId: MR, contentKey: MULTIPLE_RESPONSE_KEY, clientWriteIdentity: 'c', expectedWriteVersion: null, capturedAt: 0 };
    expect((await api.save({ ...base, optionId: '["opt-a","opt-c"]' })).kind).toBe('ack');
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.answerPayload).toEqual({ selectedOptionIds: ['opt-a', 'opt-c'] });
    expect(await api.save({ ...base, optionId: '["opt-c","opt-a"]' })).toEqual({ kind: 'rejected', code: 'invalid_answer_payload' });
    expect(await api.save({ ...base, optionId: 'opt-a' })).toEqual({ kind: 'rejected', code: 'invalid_answer_payload' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('after submission a cleared choice counts as received when the server holds [] or nothing', async () => {
    const store = await openAnswerStore();
    await store.clearAttempt('t', ATTEMPT);
    const record = (snapshotId: string, optionId: string, contentKey?: string) => ({
      key: answerKey('t', ATTEMPT, snapshotId), attemptKey: attemptKey('t', ATTEMPT), tenantId: 't', attemptId: ATTEMPT, snapshotId,
      examSessionId: SESSION, optionId, contentKey, clientWriteIdentity: `c-${snapshotId}`, ownIdentities: [], baseVersion: null, localSequence: 1, capturedAt: 0,
    });
    await store.put(record('q-empty', '[]', MULTIPLE_RESPONSE_KEY));
    await store.put(record('q-set', '["opt-a","opt-c"]', MULTIPLE_RESPONSE_KEY));
    await store.put(record('q-lost', '["opt-b"]', MULTIPLE_RESPONSE_KEY));
    await store.put(record('q-v1', 'pg-1'));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(resume([
      { snapshotId: 'q-set', answerPayload: { selectedOptionIds: ['opt-c', 'opt-a'] }, writeVersion: 1, clientWriteIdentity: 'x', updatedAt: '' },
      { snapshotId: 'q-v1', answerPayload: { selectedOptionId: 'pg-1' }, writeVersion: 1, clientWriteIdentity: 'x', updatedAt: '' },
    ] as never)), { status: 200 })));
    expect(await countUnreceivedLocalAnswers('t', ATTEMPT)).toBe(1);
    vi.unstubAllGlobals();
    await store.clearAttempt('t', ATTEMPT);
  });
});

describe('MultipleResponseAnswer', () => {
  it('toggles a canonical set, clears to [] and never shows how many are correct', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<MultipleResponseAnswer question={mrQuestion} value={undefined} onChange={onChange} />);
    expect(screen.getByText('Pilih semua jawaban yang benar.')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(screen.getAllByRole('checkbox').every(box => !(box as HTMLInputElement).checked)).toBe(true);
    await userEvent.click(screen.getByLabelText(/^C\s*5/));
    expect(onChange).toHaveBeenLastCalledWith('["opt-c"]');
    rerender(<MultipleResponseAnswer question={mrQuestion} value='["opt-c"]' onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/^A\s*2/));
    expect(onChange).toHaveBeenLastCalledWith('["opt-a","opt-c"]');
    rerender(<MultipleResponseAnswer question={mrQuestion} value='["opt-a","opt-c"]' onChange={onChange} />);
    expect((screen.getByLabelText(/^A\s*2/) as HTMLInputElement).checked).toBe(true);
    // Keyboard: Tab to an option, Space toggles it.
    screen.getByLabelText(/^A\s*2/).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith('["opt-c"]');
    rerender(<MultipleResponseAnswer question={mrQuestion} value='["opt-c"]' onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/^C\s*5/));
    expect(onChange).toHaveBeenLastCalledWith('[]');
    expect(document.body.textContent).not.toMatch(/2 jawaban|dua jawaban|benar: \d/);
  });
});

describe('the exam screen with multiple response', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    vi.restoreAllMocks();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
  });
  afterEach(() => { vi.restoreAllMocks(); window.history.pushState({}, '', '/'); });

  const route = (answers: ResumeResponse['answers'], questions: StudentSafeQuestion[] | 'unsupported', saves: unknown[] = [], refuse: string[] = []) => fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes('/api/v1/assessment/resume')) return new Response(JSON.stringify(resume(answers)), { status: 200 });
    if (url.includes('/api/v1/assessment/questions')) {
      return questions === 'unsupported'
        ? new Response(JSON.stringify({ error: 'question_type_unsupported' }), { status: 409 })
        : new Response(JSON.stringify({ attemptId: ATTEMPT, questions }), { status: 200 });
    }
    if (url.includes('/api/v1/assessment/answer/save')) {
      const body = JSON.parse(String(init?.body));
      saves.push(body);
      if (refuse.includes(body.snapshotId)) return new Response(JSON.stringify({ error: 'question_type_unsupported' }), { status: 409 });
      return new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: saves.length, serverTime: new Date().toISOString() }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  });

  it('renders checkboxes, saves the set and shows a cleared choice as "Belum dijawab"', async () => {
    const saves: Array<{ answerPayload: unknown }> = [];
    route([], [mrQuestion, pgQuestion], saves);
    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Pilih semua jawaban yang benar.')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    await userEvent.click(screen.getByLabelText(/^A\s*2/));
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ selectedOptionIds: ['opt-a'] }));
    await waitFor(() => expect(screen.getByText('Tersimpan')).toBeTruthy());
    await userEvent.click(screen.getByLabelText(/^A\s*2/));
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ selectedOptionIds: [] }));
    await waitFor(() => expect(document.querySelector('.save-status-text')?.textContent).toBe('Belum dijawab'));
    expect(screen.getAllByRole('button', { name: /Pindah ke soal nomor 1, status belum dijawab/ }).length).toBeGreaterThan(0);
  });

  it('a resumed set is restored and counted as answered', async () => {
    route([{ snapshotId: MR, answerPayload: { selectedOptionIds: ['opt-e', 'opt-a'] }, writeVersion: 2, clientWriteIdentity: 'c', updatedAt: '2026-11-07T08:10:00.000Z' }] as never, [mrQuestion, pgQuestion]);
    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Pilih semua jawaban yang benar.')).toBeTruthy();
    expect((screen.getByLabelText(/^A\s*2/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/^E\s*9/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/^B\s*4/) as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByRole('button', { name: /Pindah ke soal nomor 1, status sudah dijawab/ }).length).toBeGreaterThan(0);
  });

  it('delivery refused: a reload page with the time, no more question requests, and pending answers still sent', async () => {
    const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
    const store = await openAnswerStore();
    await store.put({ key: answerKey('', ATTEMPT, PG), attemptKey: attemptKey('', ATTEMPT), tenantId: '', attemptId: ATTEMPT, snapshotId: PG,
      examSessionId: SESSION, optionId: 'pg-1', clientWriteIdentity: 'local-1', ownIdentities: [], baseVersion: null, localSequence: 1, capturedAt: Date.now() });
    route([], 'unsupported', saves);
    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Sisa waktu, tetap berjalan')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(saves.map(x => [x.snapshotId, x.answerPayload])).toEqual([[PG, { selectedOptionId: 'pg-1' }]]));
    expect(await screen.findByRole('heading', { name: 'Perlu Memuat Ulang' })).toBeTruthy();
    expect(screen.getByText('Soal ujian ini memerlukan versi aplikasi yang lebih baru. Muat ulang halaman untuk melanjutkan.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Muat Ulang' })).toBeTruthy();
    const calls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('/assessment/questions')).length;
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fetchSpy.mock.calls.filter(c => String(c[0]).includes('/assessment/questions')).length).toBe(calls);
    expect(document.body.textContent).not.toMatch(/—/);
  });
});

describe('the save-path refusal, local recovery and adoption', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    vi.restoreAllMocks();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
  });
  afterEach(() => { vi.restoreAllMocks(); window.history.pushState({}, '', '/'); });

  const serve = (saves: Array<{ snapshotId: string; answerPayload: unknown }>, refuse: string[] = []) => fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes('/api/v1/assessment/resume')) return new Response(JSON.stringify(resume()), { status: 200 });
    if (url.includes('/api/v1/assessment/questions')) return new Response(JSON.stringify({ attemptId: ATTEMPT, questions: [mrQuestion, pgQuestion] }), { status: 200 });
    if (url.includes('/api/v1/assessment/answer/save')) {
      const body = JSON.parse(String(init?.body));
      saves.push(body);
      if (refuse.includes(body.snapshotId)) return new Response(JSON.stringify({ error: 'question_type_unsupported' }), { status: 409 });
      return new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: 1, serverTime: new Date().toISOString() }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  });

  it('a save refused as unsupported shows the reload alert; the questions stay and other answers are still sent', async () => {
    const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
    serve(saves, [MR]);
    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Pilih semua jawaban yang benar.')).toBeTruthy();
    await userEvent.click(screen.getByLabelText(/^A\s*2/));
    expect(await screen.findByRole('button', { name: 'Muat Ulang' })).toBeTruthy();
    expect(screen.getByText('Soal ujian ini memerlukan versi aplikasi yang lebih baru. Muat ulang halaman untuk melanjutkan.')).toBeTruthy();
    expect(screen.getByText('Bilangan prima di bawah 10 adalah')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Soal Berikutnya' }));
    await userEvent.click(screen.getByLabelText(/Jakarta/));
    await waitFor(() => expect(saves.some(x => x.snapshotId === PG && JSON.stringify(x.answerPayload) === JSON.stringify({ selectedOptionId: 'pg-1' }))).toBe(true));
  });

  it('an unsent set on this device is recovered after a reload and sent; no record holds a correct set', async () => {
    const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
    const store = await openAnswerStore();
    await store.put({ key: answerKey('', ATTEMPT, MR), attemptKey: attemptKey('', ATTEMPT), tenantId: '', attemptId: ATTEMPT, snapshotId: MR, examSessionId: SESSION,
      contentKey: MULTIPLE_RESPONSE_KEY, optionId: '["opt-a","opt-c"]', clientWriteIdentity: 'local-mr', ownIdentities: [], baseVersion: null, localSequence: 1, capturedAt: Date.now() });
    serve(saves);
    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Pilih semua jawaban yang benar.')).toBeTruthy();
    expect((screen.getByLabelText(/^A\s*2/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/^C\s*5/) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(saves.map(x => [x.snapshotId, x.answerPayload])).toEqual([[MR, { selectedOptionIds: ['opt-a', 'opt-c'] }]]));
    await userEvent.click(screen.getByLabelText(/^E\s*9/));
    const records = await (await openAnswerStore()).listForAttempt('', ATTEMPT);
    for (const record of records) expect(JSON.stringify(record)).not.toMatch(/correct/i);
  });

  it('adoption by another session keeps value and version; a newer foreign answer is kept instead', async () => {
    const calls: Array<{ snapshotId: string; optionId: string; contentKey: string; expectedWriteVersion: number | null; clientWriteIdentity: string }> = [];
    const api: SyncApi = {
      save: async req => { calls.push(req); return { kind: 'ack', writeVersion: (req.expectedWriteVersion ?? 0) + 1, clientWriteIdentity: req.clientWriteIdentity } as SaveOutcome; },
      fetchServerAnswers: async () => [],
    };
    const store = new MemoryAnswerStore();
    const old = (snapshotId: string, optionId: string, baseVersion: number | null) => ({ key: answerKey('t', ATTEMPT, snapshotId), attemptKey: attemptKey('t', ATTEMPT), tenantId: 't', attemptId: ATTEMPT,
      snapshotId, examSessionId: 'old-session', contentKey: MULTIPLE_RESPONSE_KEY, optionId, clientWriteIdentity: `old-${snapshotId}`, ownIdentities: [], baseVersion, localSequence: 1, capturedAt: 0 });
    await store.put(old('q-keep', '["opt-b","opt-d"]', 2));
    await store.put(old('q-gone', '["opt-a"]', null));
    const engine = new AnswerSyncEngine({ tenantId: 't', attemptId: ATTEMPT, examSessionId: SESSION, store, api,
      events: { onChange: () => {}, onSessionInactive: () => {}, onTerminal: () => {}, onUnauthorized: () => {} }, newIdentity: () => 'n', random: () => 0 });
    const result = await engine.initialize([
      { snapshotId: 'q-keep', optionId: '["opt-b"]', writeVersion: 2, clientWriteIdentity: 'mine-earlier' },
      { snapshotId: 'q-gone', optionId: '["opt-e"]', writeVersion: 3, clientWriteIdentity: 'someone-else' },
    ]);
    expect(result).toEqual({ adopted: 1, discarded: 1 });
    await waitFor(() => expect(calls.map(c => [c.snapshotId, c.contentKey, c.optionId, c.expectedWriteVersion, c.clientWriteIdentity])).toEqual([['q-keep', MULTIPLE_RESPONSE_KEY, '["opt-b","opt-d"]', 2, 'old-q-keep']]));
    expect(engine.view('q-gone')).toEqual({ optionId: '["opt-e"]', status: 'saved' });
    engine.dispose();
  });
});

describe('teacher preview of multiple response', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('shows the instruction, try-out checkboxes that send nothing, and every key option on request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      exam: { examInstanceId: ATTEMPT, subjectLabel: 'Matematika', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
        windowStartsAt: '2026-11-07T01:00:00.000Z', windowEndsAt: '2026-11-07T03:00:00.000Z', durationMinutes: 60 },
      questions: [{ snapshotId: 'm1', no: 1, prompt: 'Bilangan prima di bawah 10 adalah', options: ['2', '4', '5', '8', '9'].map((content, i) => ({ id: `o${i}`, content })),
        correctOptionId: null, correctOptionIds: ['o0', 'o2'], questionType: 'MULTIPLE_RESPONSE', maxScore: 2, valid: true }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TeacherExamPreviewView examInstanceId={ATTEMPT} onBack={() => {}} />);
    expect(await screen.findByText('Bilangan prima di bawah 10 adalah')).toBeTruthy();
    expect(screen.getByText('Pilih semua jawaban yang benar.')).toBeTruthy();
    expect(screen.getByText(/Pilihan ganda kompleks/)).toBeTruthy();
    const boxes = screen.getAllByRole('checkbox').filter(box => (box as HTMLInputElement).closest('.options-list'));
    expect(boxes).toHaveLength(5);
    await userEvent.click(boxes[1]);
    await userEvent.click(boxes[3]);
    expect([(boxes[1] as HTMLInputElement).checked, (boxes[3] as HTMLInputElement).checked]).toEqual([true, true]);
    expect(screen.queryByText('Kunci jawaban')).toBeNull();
    await userEvent.click(screen.getByLabelText('Tampilkan kunci jawaban dan skor'));
    expect(screen.getAllByText('Kunci jawaban')).toHaveLength(2);
    expect(screen.getByText('Skor 2')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
