import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { NUMERIC_HINT, NumericAnswer, classifyNumericText } from '../components/answers/NumericAnswer.tsx';
import { TeacherExamPreviewView } from '../components/TeacherExamPreviewView.tsx';
import { answerKey, attemptKey, openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { countUnreceivedLocalAnswers, createAnswerSyncApi, toServerAnswerState } from '../exam/answer-sync-api.ts';
import { NUMERIC_ANSWER_KEY, answerValueOf, isAnsweredValue, isEmptyValue, isNumericText, type ResumeResponse, type StudentSafeQuestion } from '../types/assessment.ts';

// ASSESS-QUESTION-007 client (record §4.4, C05): the text as typed, the payload built only from a
// valid number or "", D1 (invalid text is never sent; the hint shows), silent incomplete prefixes
// until blur, the draft with "Belum tersimpan", local recovery, no key in any record, and the
// numeric teacher preview.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const IA = '77777777-7777-4777-8777-777777777777';
const PG = '66666666-6666-4666-8666-666666666666';
const iaQuestion = { snapshotId: IA, schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt: 'Hasil dari 5 dibagi 2 adalah', options: [] } as StudentSafeQuestion;
const pgQuestion = { snapshotId: PG, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal pilihan', options: [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }] } as StudentSafeQuestion;
const resume = (answers: ResumeResponse['answers'] = []): ResumeResponse => ({
  attemptId: ATTEMPT, session: { status: 'active', activatedAt: '2026-11-08T08:00:00.000Z', ownedByCaller: true }, answers,
  timer: { status: 'active', startedAt: '2026-11-08T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3000 },
  submission: { status: 'not_submitted' }, context: { subjectLabel: 'IPA', roomLabel: null },
} as ResumeResponse);

describe('numeric values', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('keeps the text as typed; only "" or a valid number is ever sent', async () => {
    for (const text of ['2,5', '-3', '007', '2.5', '1'.repeat(30)]) expect(isNumericText(text)).toBe(true);
    for (const text of ['2,', ',5', '+1', '1.000,5', '2e3', '5 cm', 'NaN', '−2', '２', '1'.repeat(31), ' 2']) expect(isNumericText(text)).toBe(false);
    expect(answerValueOf({ numericText: '2,50' })).toBe('2,50');
    expect(answerValueOf({ numericText: '' })).toBe('');
    for (const bad of [{ numericText: 'abc' }, { numericText: 2.5 }]) expect(answerValueOf(bad)).toBeNull();
    expect(toServerAnswerState({ snapshotId: IA, answerPayload: { numericText: '-3' }, writeVersion: 1, clientWriteIdentity: 'c', updatedAt: '' } as never).optionId).toBe('-3');
    expect([isAnsweredValue(NUMERIC_ANSWER_KEY, '2,5'), isAnsweredValue(NUMERIC_ANSWER_KEY, ''), isAnsweredValue(NUMERIC_ANSWER_KEY, 'abc')]).toEqual([true, false, false]);
    expect([isEmptyValue(NUMERIC_ANSWER_KEY, ''), isEmptyValue(NUMERIC_ANSWER_KEY, '[]'), isEmptyValue('2:ORDERING', '')]).toEqual([true, false, false]);
    expect(['2,5', '', '2,', '-', 'abc', '5 cm'].map(classifyNumericText)).toEqual(['capture', 'capture', 'incomplete', 'incomplete', 'invalid', 'invalid']);

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: 'c', writeVersion: 1, serverTime: new Date().toISOString() }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createAnswerSyncApi(ATTEMPT, SESSION);
    const base = { attemptId: ATTEMPT, sessionId: SESSION, snapshotId: IA, contentKey: NUMERIC_ANSWER_KEY, clientWriteIdentity: 'c', expectedWriteVersion: null, capturedAt: 0 };
    expect((await api.save({ ...base, optionId: '2,50' })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ numericText: '2,50' });
    expect((await api.save({ ...base, optionId: '' })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ numericText: '' });
    for (const bad of ['2,', 'abc', '1.000,5']) expect(await api.save({ ...base, optionId: bad })).toEqual({ kind: 'rejected', code: 'invalid_answer_payload' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a local "" is received when the server holds "" or nothing', async () => {
    const store = await openAnswerStore();
    await store.clearAttempt('', ATTEMPT);
    await store.put({ key: answerKey('', ATTEMPT, IA), attemptKey: attemptKey('', ATTEMPT), tenantId: '', attemptId: ATTEMPT, snapshotId: IA, examSessionId: SESSION,
      contentKey: NUMERIC_ANSWER_KEY, optionId: '', clientWriteIdentity: 'local', ownIdentities: [], baseVersion: null, localSequence: 1, capturedAt: Date.now() });
    for (const [answers, unreceived] of [[[], 0], [[{ snapshotId: IA, answerPayload: { numericText: '' }, writeVersion: 2, clientWriteIdentity: 'x', updatedAt: '' }], 0],
      [[{ snapshotId: IA, answerPayload: { numericText: '2,5' }, writeVersion: 2, clientWriteIdentity: 'x', updatedAt: '' }], 1]] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(resume(answers as never)), { status: 200 })));
      expect(await countUnreceivedLocalAnswers('', ATTEMPT)).toBe(unreceived);
      vi.unstubAllGlobals();
    }
    await store.clearAttempt('', ATTEMPT);
  });
});

describe('NumericAnswer', () => {
  const captured: string[] = [];
  const drafts: Array<string | undefined> = [];
  function Harness({ initial, draft }: { initial?: string; draft?: string }) {
    const [value, setValue] = React.useState<string | undefined>(initial);
    return <NumericAnswer question={iaQuestion} value={value} draft={draft} onChange={v => { captured.push(v); setValue(v); }} onDraft={d => drafts.push(d)} />;
  }
  beforeEach(() => { captured.length = 0; drafts.length = 0; });
  const field = () => screen.getByLabelText('Jawaban angka') as HTMLInputElement;
  const hint = () => document.querySelector('.numeric-hint')?.textContent;

  it('is the shared Input in the exam size with the text keyboard, labelled and described', () => {
    render(<Harness />);
    const input = field();
    expect(input.type).toBe('text');
    expect(input.getAttribute('inputmode')).toBeNull();
    expect(input.className).toContain('h-12');
    expect(input.getAttribute('maxlength')).toBeNull();
    expect(input.getAttribute('aria-describedby')?.split(' ').map(id => document.getElementById(id)?.textContent)).toEqual(['Tulis jawaban berupa angka.', '']);
    expect(document.querySelector('.numeric-hint')?.getAttribute('role')).toBe('status');
  });

  it('typing 2,5 key by key shows no hint and captures 2 then 2,5; "5," then blur shows the hint and a draft', async () => {
    render(<Harness />);
    const input = field();
    await userEvent.click(input);
    await userEvent.keyboard('2,');
    expect(hint()).toBe('');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    await userEvent.keyboard('5');
    expect(captured).toEqual(['2', '2,5']);
    expect(hint()).toBe('');
    await userEvent.clear(input);
    expect(captured.at(-1)).toBe('');
    await userEvent.keyboard('5,');
    expect(hint()).toBe('');
    fireEvent.blur(input);
    await waitFor(() => expect(hint()).toBe(NUMERIC_HINT));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(captured.at(-1)).toBe('5'); // the incomplete "5," is never captured
    expect(drafts.at(-1)).toBe('5,');
  });

  it('invalid text is never captured, shows the hint, and a valid text clears the draft', async () => {
    render(<Harness initial="2,5" />);
    const input = field();
    await userEvent.clear(input);
    captured.length = 0;
    await userEvent.type(input, 'abc');
    expect(captured).toEqual([]);
    await waitFor(() => expect(hint()).toBe(NUMERIC_HINT));
    expect(drafts.at(-1)).toBe('abc');
    await userEvent.clear(input);
    await userEvent.type(input, '-3');
    expect(captured.at(-1)).toBe('-3');
    await waitFor(() => expect(drafts.at(-1)).toBeUndefined());
  });

  it('shows a kept draft with the hint when the question is visited again', () => {
    render(<Harness initial="2,5" draft="1.000,5" />);
    expect(field().value).toBe('1.000,5');
    expect(hint()).toBe(NUMERIC_HINT);
  });
});

describe('the exam screen with a numeric answer', () => {
  const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
  let resumeAnswers: ResumeResponse['answers'] = [];
  beforeEach(async () => {
    vi.restoreAllMocks();
    saves.length = 0;
    resumeAnswers = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) return new Response(JSON.stringify(resume(resumeAnswers)), { status: 200 });
      if (url.includes('/api/v1/assessment/questions')) return new Response(JSON.stringify({ attemptId: ATTEMPT, questions: [iaQuestion, pgQuestion] }), { status: 200 });
      if (url.includes('/api/v1/assessment/answer/save')) {
        const body = JSON.parse(String(init?.body));
        saves.push(body);
        return new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: saves.length, serverTime: new Date().toISOString() }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    }) as unknown as typeof fetch;
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
  });
  afterEach(() => { vi.restoreAllMocks(); window.history.pushState({}, '', '/'); });
  const saveText = () => document.querySelector('.save-status-text')?.textContent;

  it('saves as typed; invalid text is never sent and reads "Belum tersimpan"; the draft survives leaving the question; "" reads "Belum dijawab"', async () => {
    render(<StudentExamWorkstation />);
    const input = await screen.findByLabelText('Jawaban angka') as HTMLInputElement;
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    await userEvent.type(input, '2,5');
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ numericText: '2,5' }));
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    const sent = saves.length;
    await userEvent.type(input, ' cm');
    await waitFor(() => expect(saveText()).toBe('Belum tersimpan'));
    expect(document.querySelector('.numeric-hint')?.textContent).toBe(NUMERIC_HINT);
    expect(saves.length).toBe(sent);
    await userEvent.click(screen.getByRole('button', { name: 'Soal Berikutnya' }));
    expect(await screen.findByText('Soal pilihan')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Soal Sebelumnya' }));
    expect(((await screen.findByLabelText('Jawaban angka')) as HTMLInputElement).value).toBe('2,5 cm');
    expect(saveText()).toBe('Belum tersimpan');
    await userEvent.clear(screen.getByLabelText('Jawaban angka'));
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ numericText: '' }));
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    for (const record of await (await openAnswerStore()).listForAttempt('', ATTEMPT)) expect(JSON.stringify(record)).not.toMatch(/expected|tolerance/i);
  });

  it('a stored answer is shown exactly as typed after a reload', async () => {
    resumeAnswers = [{ snapshotId: IA, answerPayload: { numericText: '2,50' }, writeVersion: 3, clientWriteIdentity: 'srv', updatedAt: '2026-11-08T08:10:00.000Z' }] as ResumeResponse['answers'];
    render(<StudentExamWorkstation />);
    expect(((await screen.findByLabelText('Jawaban angka')) as HTMLInputElement).value).toBe('2,50');
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    expect(saves).toEqual([]);
  });
});

describe('teacher preview of a numeric answer', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('shows the Student control as a try-out and the key with a comma on request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      exam: { examInstanceId: ATTEMPT, subjectLabel: 'IPA', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
        windowStartsAt: '2026-11-08T01:00:00.000Z', windowEndsAt: '2026-11-08T03:00:00.000Z', durationMinutes: 60 },
      questions: [{ snapshotId: 'n1', no: 1, prompt: 'Hasil dari 5 dibagi 2 adalah', options: [], correctOptionId: null, correctOptionIds: null,
        questionType: 'NUMERIC_ANSWER', expected: '123456789012345678.5', tolerance: '0.1', maxScore: 2, valid: true }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TeacherExamPreviewView examInstanceId={ATTEMPT} onBack={() => {}} />);
    expect(await screen.findByText('Hasil dari 5 dibagi 2 adalah')).toBeTruthy();
    expect(screen.getByText(/· Isian angka/)).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Jawaban angka'), 'abc');
    expect(document.querySelector('.numeric-hint')?.textContent).toBe(NUMERIC_HINT);
    expect(screen.queryByText('Kunci jawaban')).toBeNull();
    await userEvent.click(screen.getByLabelText('Tampilkan kunci jawaban dan skor'));
    expect(screen.getByText('123456789012345678,5')).toBeTruthy();
    expect(screen.getByText('Toleransi 0,1')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
