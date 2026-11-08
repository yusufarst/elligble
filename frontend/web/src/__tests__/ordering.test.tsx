import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { OrderingAnswer } from '../components/answers/OrderingAnswer.tsx';
import { TeacherExamPreviewView } from '../components/TeacherExamPreviewView.tsx';
import { answerKey, attemptKey, openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { createAnswerSyncApi, toServerAnswerState } from '../exam/answer-sync-api.ts';
import { ORDERING_KEY, answerValueOf, isAnsweredValue, isEmptyValue, orderOf, type ResumeResponse, type StudentSafeQuestion } from '../types/assessment.ts';

// ASSESS-QUESTION-005 client (record §4.4/§4A, C05): the canonical id list, the payload built only
// from it, the answered rule (every item), the empty value, the Mengurutkan control with focus
// following the moved item (to its other button at an end), "Gunakan urutan ini" and "Kosongkan
// jawaban", local recovery, no key in any record, and the ordering teacher preview.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const UR = '55555555-5555-4555-8555-555555555555';
const items = [{ id: 'I1', content: 'Siram tanah' }, { id: 'I2', content: 'Siapkan pot' }, { id: 'I3', content: 'Tanam biji' }];
const urQuestion = { snapshotId: UR, schemaVersion: 2, questionType: 'ORDERING', prompt: 'Urutkan langkah menanam biji', options: [], items } as StudentSafeQuestion;
const resume = (answers: ResumeResponse['answers'] = []): ResumeResponse => ({
  attemptId: ATTEMPT, session: { status: 'active', activatedAt: '2026-11-08T08:00:00.000Z', ownedByCaller: true }, answers,
  timer: { status: 'active', startedAt: '2026-11-08T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3000 },
  submission: { status: 'not_submitted' }, context: { subjectLabel: 'IPA', roomLabel: null },
} as ResumeResponse);
const texts = () => screen.getAllByRole('listitem').filter(li => li.classList.contains('ordering-row')).map(li => li.querySelector('.option-text')?.textContent);

describe('ordering values', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('is the id list in answer order; the payload is built only from it', async () => {
    expect(answerValueOf({ orderedItemIds: ['I3', 'I1', 'I2'] })).toBe('["I3","I1","I2"]');
    expect(answerValueOf({ orderedItemIds: [] })).toBe('[]');
    for (const bad of [{ orderedItemIds: 'x' }, { orderedItemIds: ['I1', 'I1'] }, { orderedItemIds: [1] }]) expect(answerValueOf(bad)).toBeNull();
    expect(orderOf('["I3","I1","I2"]')).toEqual(['I3', 'I1', 'I2']);
    for (const bad of ['["I1","I1"]', '[ "I1" ]', '{}', 'x', '[1]']) expect(orderOf(bad)).toBeNull();
    expect(toServerAnswerState({ snapshotId: UR, answerPayload: { orderedItemIds: ['I2', 'I1', 'I3'] }, writeVersion: 1, clientWriteIdentity: 'c', updatedAt: '' } as never).optionId).toBe('["I2","I1","I3"]');
    expect(isAnsweredValue(ORDERING_KEY, '["I2","I1","I3"]', 3)).toBe(true);
    expect(isAnsweredValue(ORDERING_KEY, '["I2","I1"]', 3)).toBe(false);
    expect(isAnsweredValue(ORDERING_KEY, '[]', 3)).toBe(false);
    expect(isAnsweredValue(ORDERING_KEY, '["I2","I1","I3"]')).toBe(false);
    expect([isEmptyValue(ORDERING_KEY, '[]'), isEmptyValue(ORDERING_KEY, '["I1"]')]).toEqual([true, false]);

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: 'c', writeVersion: 1, serverTime: new Date().toISOString() }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createAnswerSyncApi(ATTEMPT, SESSION);
    const base = { attemptId: ATTEMPT, sessionId: SESSION, snapshotId: UR, contentKey: ORDERING_KEY, clientWriteIdentity: 'c', expectedWriteVersion: null, capturedAt: 0 };
    expect((await api.save({ ...base, optionId: '["I3","I1","I2"]' })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ orderedItemIds: ['I3', 'I1', 'I2'] });
    expect((await api.save({ ...base, optionId: '[]' })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ orderedItemIds: [] });
    for (const bad of ['["I1","I1"]', 'I3,I1', '']) expect(await api.save({ ...base, optionId: bad })).toEqual({ kind: 'rejected', code: 'invalid_answer_payload' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('OrderingAnswer', () => {
  function Harness({ initial }: { initial?: string }) {
    const [value, setValue] = React.useState<string | undefined>(initial);
    return <OrderingAnswer question={urQuestion} value={value} onChange={v => { changes.push(v); setValue(v); }} />;
  }
  const changes: string[] = [];
  beforeEach(() => { changes.length = 0; });

  it('starts unanswered in authored order; a move saves the full order and focus follows the item', async () => {
    render(<Harness />);
    expect(screen.getByText('Urutkan item dengan tombol Naikkan dan Turunkan.')).toBeTruthy();
    expect(texts()).toEqual(['Siram tanah', 'Siapkan pot', 'Tanam biji']);
    expect(changes).toEqual([]);
    expect((screen.getByRole('button', { name: 'Naikkan item 1' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Turunkan item 3' }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(screen.getByRole('button', { name: 'Naikkan item 2' }).getAttribute('aria-describedby')!)?.textContent).toBe('Siapkan pot');
    expect(screen.getAllByRole('listitem').some(li => li.classList.contains('selected'))).toBe(false);

    // Keyboard: "Turunkan" on item 1 twice moves it to the end; focus follows, then goes to its "Naikkan" at the end.
    screen.getByRole('button', { name: 'Turunkan item 1' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(changes.at(-1)).toBe('["I2","I1","I3"]');
    expect(texts()).toEqual(['Siapkan pot', 'Siram tanah', 'Tanam biji']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Turunkan item 2' })));
    expect(screen.getByRole('status').textContent).toBe('Siram tanah dipindah ke urutan 2.');
    await userEvent.keyboard('{Enter}');
    expect(changes.at(-1)).toBe('["I2","I3","I1"]');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Naikkan item 3' }))); // at the end, focus goes to the other button
    expect(screen.getAllByRole('listitem').filter(li => li.classList.contains('selected'))).toHaveLength(3);

    // Pointer: "Naikkan" on item 2 moves it to the top; focus goes to its "Turunkan" at the first position.
    await userEvent.click(screen.getByRole('button', { name: 'Naikkan item 2' }));
    expect(changes.at(-1)).toBe('["I3","I2","I1"]');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Turunkan item 1' })));
    expect(screen.getByRole('status').textContent).toBe('Tanam biji dipindah ke urutan 1.');

    // Clear: "[]", the authored order again, focus on "Gunakan urutan ini"; keeping it saves the shown order.
    await userEvent.click(screen.getByRole('button', { name: 'Kosongkan jawaban' }));
    expect(changes.at(-1)).toBe('[]');
    expect(texts()).toEqual(['Siram tanah', 'Siapkan pot', 'Tanam biji']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Gunakan urutan ini' })));
    expect(screen.getByRole('status').textContent).toBe('Jawaban dikosongkan.');
    await userEvent.click(screen.getByRole('button', { name: 'Gunakan urutan ini' }));
    expect(changes.at(-1)).toBe('["I1","I2","I3"]');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Kosongkan jawaban' })));
    expect(screen.getByRole('status').textContent).toBe('Urutan ini disimpan sebagai jawaban.');
  });

  it('shows a value that is not an order of these items as the authored order, unanswered', () => {
    render(<Harness initial={'["I9","I1","I2"]'} />);
    expect(texts()).toEqual(['Siram tanah', 'Siapkan pot', 'Tanam biji']);
    expect(screen.getByRole('button', { name: 'Gunakan urutan ini' })).toBeTruthy();
  });
});

describe('the exam screen with ordering', () => {
  const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
  let resumeAnswers: ResumeResponse['answers'] = [];
  beforeEach(async () => {
    vi.restoreAllMocks();
    saves.length = 0;
    resumeAnswers = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) return new Response(JSON.stringify(resume(resumeAnswers)), { status: 200 });
      if (url.includes('/api/v1/assessment/questions')) return new Response(JSON.stringify({ attemptId: ATTEMPT, questions: [urQuestion] }), { status: 200 });
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

  it('untouched is "Belum dijawab"; a move saves the order as "Tersimpan"; clearing saves [] as "Belum dijawab"; no key in any record', async () => {
    render(<StudentExamWorkstation />);
    await screen.findByRole('button', { name: 'Gunakan urutan ini' });
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    await userEvent.click(screen.getByRole('button', { name: 'Turunkan item 1' }));
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ orderedItemIds: ['I2', 'I1', 'I3'] }));
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    await userEvent.click(screen.getByRole('button', { name: 'Kosongkan jawaban' }));
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ orderedItemIds: [] }));
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    for (const record of await (await openAnswerStore()).listForAttempt('', ATTEMPT)) expect(JSON.stringify(record)).not.toMatch(/correct/i);
  });

  it('an unsent order on this device is recovered after a reload and sent', async () => {
    await (await openAnswerStore()).put({ key: answerKey('', ATTEMPT, UR), attemptKey: attemptKey('', ATTEMPT), tenantId: '', attemptId: ATTEMPT, snapshotId: UR, examSessionId: SESSION,
      contentKey: ORDERING_KEY, optionId: '["I3","I2","I1"]', clientWriteIdentity: 'local-ur', ownIdentities: [], baseVersion: null, localSequence: 1, capturedAt: Date.now() });
    render(<StudentExamWorkstation />);
    await screen.findByRole('button', { name: 'Kosongkan jawaban' });
    expect(texts()).toEqual(['Tanam biji', 'Siapkan pot', 'Siram tanah']);
    await waitFor(() => expect(saves.map(x => [x.snapshotId, x.answerPayload])).toEqual([[UR, { orderedItemIds: ['I3', 'I2', 'I1'] }]]));
  });
});

describe('teacher preview of ordering', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('shows the Student control as a try-out that sends nothing and the key order on request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      exam: { examInstanceId: ATTEMPT, subjectLabel: 'IPA', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
        windowStartsAt: '2026-11-08T01:00:00.000Z', windowEndsAt: '2026-11-08T03:00:00.000Z', durationMinutes: 60 },
      questions: [{ snapshotId: 'o1', no: 1, prompt: 'Urutkan langkah menanam biji', options: [], correctOptionId: null, correctOptionIds: null,
        questionType: 'ORDERING', items, correctOrder: ['I2', 'I3', 'I1'], maxScore: 2, valid: true }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TeacherExamPreviewView examInstanceId={ATTEMPT} onBack={() => {}} />);
    expect(await screen.findByText('Urutkan langkah menanam biji')).toBeTruthy();
    expect(screen.getByText(/· Mengurutkan/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Turunkan item 1' }));
    expect(texts()).toEqual(['Siapkan pot', 'Siram tanah', 'Tanam biji']);
    expect(screen.queryByRole('heading', { name: 'Kunci jawaban' })).toBeNull();
    await userEvent.click(screen.getByLabelText('Tampilkan kunci jawaban dan skor'));
    expect(within(screen.getByRole('region', { name: 'Kunci jawaban' })).getAllByRole('listitem').map(li => li.textContent)).toEqual(['1.Siapkan pot', '2.Tanam biji', '3.Siram tanah']);
    expect(screen.getByText('Skor 2')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
