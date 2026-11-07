import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { MultipleResponseAnswer } from '../components/answers/MultipleResponseAnswer.tsx';
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

  const route = (answers: ResumeResponse['answers'], questions: StudentSafeQuestion[] | 'unsupported', saves: unknown[] = []) => fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes('/api/v1/assessment/resume')) return new Response(JSON.stringify(resume(answers)), { status: 200 });
    if (url.includes('/api/v1/assessment/questions')) {
      return questions === 'unsupported'
        ? new Response(JSON.stringify({ error: 'question_type_unsupported' }), { status: 409 })
        : new Response(JSON.stringify({ attemptId: ATTEMPT, questions }), { status: 200 });
    }
    if (url.includes('/api/v1/assessment/answer/save')) {
      const body = JSON.parse(String(init?.body));
      saves.push(body);
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

  it('content this client cannot show stops the screen with a reload action', async () => {
    route([], 'unsupported');
    render(<StudentExamWorkstation />);
    expect(await screen.findByRole('heading', { name: 'Perlu Memuat Ulang' })).toBeTruthy();
    expect(screen.getByText('Soal ujian ini memerlukan versi aplikasi yang lebih baru. Muat ulang halaman untuk melanjutkan.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Muat Ulang' })).toBeTruthy();
    const calls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('/assessment/questions')).length;
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fetchSpy.mock.calls.filter(c => String(c[0]).includes('/assessment/questions')).length).toBe(calls);
    expect(document.body.textContent).not.toMatch(/—/);
  });
});
