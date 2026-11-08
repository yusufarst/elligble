import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { MatchingAnswer, matchingStatus } from '../components/answers/MatchingAnswer.tsx';
import { TeacherExamPreviewView } from '../components/TeacherExamPreviewView.tsx';
import { answerKey, attemptKey, openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { createAnswerSyncApi, toServerAnswerState } from '../exam/answer-sync-api.ts';
import { MATCHING_KEY, MULTIPLE_RESPONSE_KEY, TRUE_FALSE_KEY, answerValueOf, canonicalPairs, isAnsweredValue, isEmptyValue, pairsOf, type ResumeResponse, type StudentSafeQuestion } from '../types/assessment.ts';

// ASSESS-QUESTION-004 client (record §4.4/§4A, C05): the canonical pair list, the payload built
// only from it, the answered rule of Owner D1 (every left item paired), the empty value, the
// Menjodohkan control with used right items disabled and unpairing, local recovery, no key in any
// record, and the matching teacher preview.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const MJ = '44444444-4444-4444-8444-444444444444';
const left = [{ id: 'L1', content: 'Sapi' }, { id: 'L2', content: 'Kucing' }, { id: 'L3', content: 'Kelinci' }];
const right = [{ id: 'R1', content: 'Wortel' }, { id: 'R2', content: 'Rumput' }, { id: 'R3', content: 'Ikan' }, { id: 'R4', content: 'Biji jagung' }];
const mjQuestion = { snapshotId: MJ, schemaVersion: 2, questionType: 'MATCHING', prompt: 'Pasangkan hewan dengan makanannya', options: [], leftItems: left, rightItems: right } as StudentSafeQuestion;
const resume = (answers: ResumeResponse['answers'] = []): ResumeResponse => ({
  attemptId: ATTEMPT, session: { status: 'active', activatedAt: '2026-11-08T08:00:00.000Z', ownedByCaller: true }, answers,
  timer: { status: 'active', startedAt: '2026-11-08T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3000 },
  submission: { status: 'not_submitted' }, context: { subjectLabel: 'IPA', roomLabel: null },
} as ResumeResponse);

describe('matching values', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('is the sorted pair list; the payload is built only from it', async () => {
    const value = canonicalPairs([['L3', 'R1'], ['L1', 'R2']]);
    expect(value).toBe('[["L1","R2"],["L3","R1"]]');
    expect(pairsOf(value)).toEqual([['L1', 'R2'], ['L3', 'R1']]);
    for (const bad of ['[["L3","R1"],["L1","R2"]]', '[["L1","R2"],["L1","R3"]]', '[["L1","R2"],["L2","R2"]]', '[["L1"]]', '{}', 'x']) expect(pairsOf(bad)).toBeNull();
    expect(answerValueOf({ pairs: [{ leftId: 'L3', rightId: 'R1' }, { leftId: 'L1', rightId: 'R2' }] })).toBe(value);
    expect(answerValueOf({ pairs: [] })).toBe('[]');
    for (const bad of [{ pairs: 'x' }, { pairs: [{ leftId: 1, rightId: 'R1' }] }, { pairs: [{ leftId: 'L1', rightId: 'R1' }, { leftId: 'L1', rightId: 'R2' }] }]) expect(answerValueOf(bad)).toBeNull();
    expect(toServerAnswerState({ snapshotId: MJ, answerPayload: { pairs: [{ leftId: 'L1', rightId: 'R2' }] }, writeVersion: 1, clientWriteIdentity: 'c', updatedAt: '' } as never).optionId).toBe('[["L1","R2"]]');

    // Owner D1: answered only with every left item paired.
    const complete = canonicalPairs([['L1', 'R2'], ['L2', 'R3'], ['L3', 'R1']]);
    expect(isAnsweredValue(MATCHING_KEY, complete, 3)).toBe(true);
    expect(isAnsweredValue(MATCHING_KEY, value, 3)).toBe(false);
    expect(isAnsweredValue(MATCHING_KEY, '[]', 3)).toBe(false);
    expect(isAnsweredValue(MATCHING_KEY, complete)).toBe(false);
    expect(isAnsweredValue(MULTIPLE_RESPONSE_KEY, '["a"]')).toBe(true);
    expect(isAnsweredValue(TRUE_FALSE_KEY, 'false')).toBe(true);
    expect([isEmptyValue(MATCHING_KEY, '[]'), isEmptyValue(MULTIPLE_RESPONSE_KEY, '[]'), isEmptyValue(TRUE_FALSE_KEY, '[]'), isEmptyValue(MATCHING_KEY, value)]).toEqual([true, true, false, false]);

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: 'c', writeVersion: 1, serverTime: new Date().toISOString() }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createAnswerSyncApi(ATTEMPT, SESSION);
    const base = { attemptId: ATTEMPT, sessionId: SESSION, snapshotId: MJ, contentKey: MATCHING_KEY, clientWriteIdentity: 'c', expectedWriteVersion: null, capturedAt: 0 };
    expect((await api.save({ ...base, optionId: value })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ pairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L3', rightId: 'R1' }] });
    expect((await api.save({ ...base, optionId: '[]' })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ pairs: [] });
    for (const bad of ['[["L3","R1"],["L1","R2"]]', 'L1:R2', '']) expect(await api.save({ ...base, optionId: bad })).toEqual({ kind: 'rejected', code: 'invalid_answer_payload' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('MatchingAnswer', () => {
  it('lists the right items, one select per left item, disables used items, unpairs and words the status', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<MatchingAnswer question={mjQuestion} value={undefined} onChange={onChange} />);
    expect(within(screen.getByRole('region', { name: 'Pasangan kanan' })).getAllByRole('listitem').map(li => li.textContent)).toEqual(['AA. Wortel', 'BB. Rumput', 'CC. Ikan', 'DD. Biji jagung']);
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects.map(s => s.getAttribute('aria-label'))).toEqual(['Pasangan untuk pernyataan 1', 'Pasangan untuk pernyataan 2', 'Pasangan untuk pernyataan 3']);
    expect(selects[0].getAttribute('aria-describedby') && document.getElementById(selects[0].getAttribute('aria-describedby')!)?.textContent).toBe('Sapi');
    expect(selects.every(s => s.value === '')).toBe(true);
    expect([...selects[0].options].map(o => o.textContent)).toEqual(['Pilih pasangan', 'A. Wortel', 'B. Rumput', 'C. Ikan', 'D. Biji jagung']);
    expect(screen.getByRole('status').textContent).toBe('');
    await userEvent.selectOptions(selects[0], 'R2');
    expect(onChange).toHaveBeenLastCalledWith('[["L1","R2"]]');

    rerender(<MatchingAnswer question={mjQuestion} value={'[["L1","R2"]]'} onChange={onChange} />);
    const used = [...(screen.getByRole('combobox', { name: 'Pasangan untuk pernyataan 2' }) as HTMLSelectElement).options].find(o => o.value === 'R2')!;
    expect([used.disabled, used.textContent]).toEqual([true, 'B. Rumput (sudah dipakai)']);
    const own = [...(screen.getByRole('combobox', { name: 'Pasangan untuk pernyataan 1' }) as HTMLSelectElement).options].find(o => o.value === 'R2')!;
    expect([own.disabled, own.selected]).toEqual([false, true]);
    expect(screen.getByRole('status').textContent).toBe('Belum lengkap: 1 dari 3 pernyataan dipasangkan.');
    const row = screen.getByText('Sapi').closest('li')!;
    expect(row.className).toContain('paired');
    expect(row.querySelector('.matching-chosen')?.textContent).toBe('B');

    // Keyboard: focus the second select and move with the arrow key (native select behaviour).
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pasangan untuk pernyataan 2' }), 'R3');
    expect(onChange).toHaveBeenLastCalledWith('[["L1","R2"],["L2","R3"]]');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pasangan untuk pernyataan 1' }), '');
    expect(onChange).toHaveBeenLastCalledWith('[]');

    rerender(<MatchingAnswer question={mjQuestion} value={'[["L1","R2"],["L2","R3"],["L3","R1"]]'} onChange={onChange} />);
    expect(screen.getByRole('status').textContent).toBe('Semua pernyataan sudah dipasangkan.');
    expect([matchingStatus(0, 3), matchingStatus(2, 3), matchingStatus(3, 3)]).toEqual(['', 'Belum lengkap: 2 dari 3 pernyataan dipasangkan.', 'Semua pernyataan sudah dipasangkan.']);
  });
});

describe('the exam screen with matching', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
  let resumeAnswers: ResumeResponse['answers'] = [];
  beforeEach(async () => {
    vi.restoreAllMocks();
    saves.length = 0;
    resumeAnswers = [];
    fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) return new Response(JSON.stringify(resume(resumeAnswers)), { status: 200 });
      if (url.includes('/api/v1/assessment/questions')) return new Response(JSON.stringify({ attemptId: ATTEMPT, questions: [mjQuestion] }), { status: 200 });
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
  const saveText = () => document.querySelector('.save-status-text')?.textContent;

  it('saves pairs; an incomplete answer reads "Belum dijawab" with "Belum lengkap"; complete reads "Tersimpan"; unpairing all saves []', async () => {
    render(<StudentExamWorkstation />);
    const first = await screen.findByRole('combobox', { name: 'Pasangan untuk pernyataan 1' });
    await userEvent.selectOptions(first, 'R2');
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ pairs: [{ leftId: 'L1', rightId: 'R2' }] }));
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    expect(screen.getByText('Belum lengkap: 1 dari 3 pernyataan dipasangkan.')).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pasangan untuk pernyataan 2' }), 'R3');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pasangan untuk pernyataan 3' }), 'R1');
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ pairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L2', rightId: 'R3' }, { leftId: 'L3', rightId: 'R1' }] }));
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    for (const name of ['Pasangan untuk pernyataan 1', 'Pasangan untuk pernyataan 2', 'Pasangan untuk pernyataan 3']) await userEvent.selectOptions(screen.getByRole('combobox', { name }), '');
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ pairs: [] }));
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    for (const record of await (await openAnswerStore()).listForAttempt('', ATTEMPT)) expect(JSON.stringify(record)).not.toMatch(/correct/i);
  });

  it('an unsent incomplete answer on this device is recovered after a reload and sent', async () => {
    await (await openAnswerStore()).put({ key: answerKey('', ATTEMPT, MJ), attemptKey: attemptKey('', ATTEMPT), tenantId: '', attemptId: ATTEMPT, snapshotId: MJ, examSessionId: SESSION,
      contentKey: MATCHING_KEY, optionId: '[["L2","R3"]]', clientWriteIdentity: 'local-mj', ownIdentities: [], baseVersion: null, localSequence: 1, capturedAt: Date.now() });
    render(<StudentExamWorkstation />);
    const second = await screen.findByRole('combobox', { name: 'Pasangan untuk pernyataan 2' }) as HTMLSelectElement;
    expect(second.value).toBe('R3');
    await waitFor(() => expect(saves.map(x => [x.snapshotId, x.answerPayload])).toEqual([[MJ, { pairs: [{ leftId: 'L2', rightId: 'R3' }] }]]));
  });

  it('a complete answer held by the server is shown as answered after a reload', async () => {
    resumeAnswers = [{ snapshotId: MJ, answerPayload: { pairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L2', rightId: 'R3' }, { leftId: 'L3', rightId: 'R1' }] }, writeVersion: 3, clientWriteIdentity: 'srv', updatedAt: '2026-11-08T08:10:00.000Z' }] as ResumeResponse['answers'];
    render(<StudentExamWorkstation />);
    expect(((await screen.findByRole('combobox', { name: 'Pasangan untuk pernyataan 3' })) as HTMLSelectElement).value).toBe('R1');
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    expect(screen.getByText('Semua pernyataan sudah dipasangkan.')).toBeTruthy();
    expect(saves).toEqual([]);
  });
});

describe('teacher preview of matching', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('shows the Student control as a try-out that sends nothing and the key on request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      exam: { examInstanceId: ATTEMPT, subjectLabel: 'IPA', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
        windowStartsAt: '2026-11-08T01:00:00.000Z', windowEndsAt: '2026-11-08T03:00:00.000Z', durationMinutes: 60 },
      questions: [{ snapshotId: 'm1', no: 1, prompt: 'Pasangkan hewan dengan makanannya', options: [], correctOptionId: null, correctOptionIds: null,
        questionType: 'MATCHING', leftItems: left, rightItems: right, correctPairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L2', rightId: 'R3' }, { leftId: 'L3', rightId: 'R1' }], maxScore: 3, valid: true }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TeacherExamPreviewView examInstanceId={ATTEMPT} onBack={() => {}} />);
    expect(await screen.findByText('Pasangkan hewan dengan makanannya')).toBeTruthy();
    expect(screen.getByText(/· Menjodohkan/)).toBeTruthy();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pasangan untuk pernyataan 1' }), 'R4');
    expect((screen.getByRole('combobox', { name: 'Pasangan untuk pernyataan 1' }) as HTMLSelectElement).value).toBe('R4');
    expect(screen.queryByRole('heading', { name: 'Kunci jawaban' })).toBeNull();
    await userEvent.click(screen.getByLabelText('Tampilkan kunci jawaban dan skor'));
    const key = screen.getByRole('region', { name: 'Kunci jawaban' });
    expect(within(key).getAllByRole('listitem').map(li => li.textContent)).toEqual(['1. SapiB. Rumput', '2. KucingC. Ikan', '3. KelinciA. Wortel']);
    expect(screen.getByText('Skor 3')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
