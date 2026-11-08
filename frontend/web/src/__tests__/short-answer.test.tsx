import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { SHORT_HINT_INVALID, SHORT_HINT_TOO_LONG, ShortAnswer } from '../components/answers/ShortAnswer.tsx';
import { TeacherEssayGradingView } from '../components/TeacherEssayGradingView.tsx';
import { TeacherExamPreviewView } from '../components/TeacherExamPreviewView.tsx';
import { openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { createAnswerSyncApi, toServerAnswerState } from '../exam/answer-sync-api.ts';
import { describeImportProblem } from '../lib/question-import.ts';
import {
  SHORT_ANSWER_KEY, answerValueOf, isAnsweredValue, isEmptyValue, isShortText, shortTextProblem,
  type ResumeResponse, type StudentSafeQuestion,
} from '../types/assessment.ts';

// ASSESS-QUESTION-006 client (record §4.4, C05): the one-line predicate shared with the server, the
// payload built only from "" or valid text, the counter, D2 (over-limit or unsupported text is a
// draft that is never sent and reads "Belum tersimpan"), recovery exactly as typed, no forms, rubric
// or grade in any record, the teacher preview of auto and manual items, the grading type line and
// the import wording.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const IS = '99999999-9999-4999-8999-999999999999';
const PG = '66666666-6666-4666-8666-666666666666';
const EXAM = '33333333-3333-4333-8333-333333333333';
const isQuestion = { snapshotId: IS, schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt: 'Ibu kota Indonesia adalah', options: [] } as StudentSafeQuestion;
const pgQuestion = { snapshotId: PG, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal pilihan', options: [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }] } as StudentSafeQuestion;
const resume = (answers: ResumeResponse['answers'] = []): ResumeResponse => ({
  attemptId: ATTEMPT, session: { status: 'active', activatedAt: '2026-11-08T08:00:00.000Z', ownedByCaller: true }, answers,
  timer: { status: 'active', startedAt: '2026-11-08T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3000 },
  submission: { status: 'not_submitted' }, context: { subjectLabel: 'IPS', roomLabel: null },
} as ResumeResponse);
const TEXT = 'DKI\tJakarta 😀';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('short-answer values', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('applies the server predicate; only "" or valid one-line text is ever sent, exactly as typed', async () => {
    for (const text of ['', TEXT, 'a'.repeat(200), '😀'.repeat(200)]) expect(isShortText(text)).toBe(true);
    for (const text of ['a'.repeat(201), 'a\nb', 'a\rb', '\u0001', '\u007f', 'a\ud800']) expect(isShortText(text)).toBe(false);
    expect([shortTextProblem('a'.repeat(201) + '\n'), shortTextProblem('a\nb'), shortTextProblem('ok')]).toEqual(['too_long', 'invalid_character', null]);
    expect(answerValueOf({ shortText: TEXT })).toBe(TEXT);
    expect(answerValueOf({ shortText: '' })).toBe('');
    for (const bad of [{ shortText: 5 }, { shortText: 'a\nb' }]) expect(answerValueOf(bad)).toBeNull();
    expect(toServerAnswerState({ snapshotId: IS, answerPayload: { shortText: TEXT }, writeVersion: 1, clientWriteIdentity: 'c', updatedAt: '' } as never).optionId).toBe(TEXT);
    expect([isAnsweredValue(SHORT_ANSWER_KEY, TEXT), isAnsweredValue(SHORT_ANSWER_KEY, ''), isEmptyValue(SHORT_ANSWER_KEY, ''), isEmptyValue(SHORT_ANSWER_KEY, '[]')]).toEqual([true, false, true, false]);

    const fetchMock = vi.fn(async () => json({ status: 'acknowledged', clientWriteIdentity: 'c', writeVersion: 1, serverTime: new Date().toISOString() }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createAnswerSyncApi(ATTEMPT, SESSION);
    const base = { attemptId: ATTEMPT, sessionId: SESSION, snapshotId: IS, contentKey: SHORT_ANSWER_KEY, clientWriteIdentity: 'c', expectedWriteVersion: null, capturedAt: 0 };
    expect((await api.save({ ...base, optionId: TEXT })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ shortText: TEXT });
    for (const bad of ['a'.repeat(201), 'a\nb']) expect(await api.save({ ...base, optionId: bad })).toEqual({ kind: 'rejected', code: 'invalid_answer_payload' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('the short-answer control', () => {
  it('is the shared Input in the exam size, labelled and described, with a counter that is not a live region', () => {
    render(<ShortAnswer question={isQuestion} value={undefined} onChange={() => {}} />);
    const field = screen.getByLabelText('Jawaban singkat') as HTMLInputElement;
    expect([field.tagName, field.type, field.getAttribute('maxlength')]).toEqual(['INPUT', 'text', null]);
    const described = field.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)!);
    expect(described.map(el => el.textContent)).toEqual(['Tulis jawaban singkat dalam satu baris, paling banyak 200 karakter.', '0/200 karakter', '']);
    expect(described[1].getAttribute('aria-live')).toBeNull();
    expect(described[2].getAttribute('aria-live')).toBe('polite');
  });

  it('captures valid text; over-limit or unsupported text is a draft with its hint, over-limit first', () => {
    const onChange = vi.fn();
    const onDraft = vi.fn();
    render(<ShortAnswer question={isQuestion} value={undefined} onChange={onChange} onDraft={onDraft} />);
    const field = screen.getByLabelText('Jawaban singkat');
    fireEvent.change(field, { target: { value: TEXT } });
    expect(onChange).toHaveBeenLastCalledWith(TEXT);
    const long = 'a'.repeat(201);
    fireEvent.change(field, { target: { value: long } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.essay-hint')?.textContent).toBe(SHORT_HINT_TOO_LONG);
    expect(document.querySelector('.essay-count')?.textContent).toBe('201/200 karakter');
    expect(onDraft).toHaveBeenLastCalledWith(long);
    fireEvent.change(field, { target: { value: 'x\u0001' } });
    expect(document.querySelector('.essay-hint')?.textContent).toBe(SHORT_HINT_INVALID);
    fireEvent.change(field, { target: { value: 'Jakarta' } });
    expect(onChange).toHaveBeenLastCalledWith('Jakarta');
    expect(onDraft).toHaveBeenLastCalledWith(undefined);
  });
});

describe('the exam screen with a short answer', () => {
  const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
  let resumeAnswers: ResumeResponse['answers'] = [];
  beforeEach(async () => {
    vi.restoreAllMocks();
    saves.length = 0;
    resumeAnswers = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) return json(resume(resumeAnswers));
      if (url.includes('/api/v1/assessment/questions')) return json({ attemptId: ATTEMPT, questions: [isQuestion, pgQuestion] });
      if (url.includes('/api/v1/assessment/answer/save')) {
        const body = JSON.parse(String(init?.body));
        saves.push(body);
        return json({ status: 'acknowledged', clientWriteIdentity: body.clientWriteIdentity, writeVersion: saves.length, serverTime: new Date().toISOString() });
      }
      return json({ error: 'not_found' }, 404);
    }) as unknown as typeof fetch;
    window.sessionStorage.clear();
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
  });
  afterEach(() => { vi.restoreAllMocks(); window.history.pushState({}, '', '/'); });
  const saveText = () => document.querySelector('.save-status-text')?.textContent;

  it('saves as typed; over-limit text is never sent and reads "Belum tersimpan"; the draft survives leaving the question', async () => {
    render(<StudentExamWorkstation />);
    const field = await screen.findByLabelText('Jawaban singkat');
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    fireEvent.change(field, { target: { value: TEXT } });
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ shortText: TEXT }));
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    const sent = saves.length;
    const long = 'b'.repeat(201);
    fireEvent.change(field, { target: { value: long } });
    await waitFor(() => expect(saveText()).toBe('Belum tersimpan'));
    expect(saves.length).toBe(sent);
    await userEvent.click(screen.getByRole('button', { name: 'Soal Berikutnya' }));
    expect(await screen.findByText('Soal pilihan')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Soal Sebelumnya' }));
    expect(((await screen.findByLabelText('Jawaban singkat')) as HTMLInputElement).value).toBe(long);
    expect(saveText()).toBe('Belum tersimpan');
    fireEvent.change(screen.getByLabelText('Jawaban singkat'), { target: { value: '' } });
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ shortText: '' }));
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    for (const record of await (await openAnswerStore()).listForAttempt('', ATTEMPT)) expect(JSON.stringify(record)).not.toMatch(/acceptedForms|rubric|grade|score/i);
  });

  it('a stored answer is shown exactly as typed after a reload', async () => {
    resumeAnswers = [{ snapshotId: IS, answerPayload: { shortText: TEXT }, writeVersion: 3, clientWriteIdentity: 'srv', updatedAt: '2026-11-08T08:10:00.000Z' }] as ResumeResponse['answers'];
    render(<StudentExamWorkstation />);
    expect(((await screen.findByLabelText('Jawaban singkat')) as HTMLInputElement).value).toBe(TEXT);
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    expect(saves).toEqual([]);
  });
});

describe('teacher surfaces of a short answer', () => {
  afterEach(() => vi.unstubAllGlobals());
  const preview = (item: Record<string, unknown>) => json({
    exam: { examInstanceId: EXAM, subjectLabel: 'IPS', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
      windowStartsAt: '2026-11-08T01:00:00.000Z', windowEndsAt: '2026-11-08T03:00:00.000Z', durationMinutes: 60 },
    questions: [{ snapshotId: 's1', no: 1, prompt: 'Ibu kota Indonesia adalah', options: [], correctOptionId: null, correctOptionIds: null, questionType: 'SHORT_ANSWER', maxScore: 2, valid: true, ...item }],
  });

  it('previews an auto item with its accepted forms on request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => preview({ acceptedForms: ['Jakarta', 'DKI Jakarta'], rubric: '' })));
    render(<TeacherExamPreviewView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Ibu kota Indonesia adalah')).toBeTruthy();
    expect(screen.getByText(/· Isian singkat/)).toBeTruthy();
    expect(screen.getByLabelText('Jawaban singkat')).toBeTruthy();
    expect(screen.queryByText('DKI Jakarta')).toBeNull();
    await userEvent.click(screen.getByLabelText('Tampilkan kunci jawaban dan skor'));
    expect(screen.getByRole('heading', { name: 'Bentuk jawaban diterima' })).toBeTruthy();
    expect(screen.getByText('DKI Jakarta')).toBeTruthy();
  });

  it('previews a manual item as graded by the teacher with its rubric', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => preview({ acceptedForms: [], rubric: 'Sebutkan ibu kota' })));
    render(<TeacherExamPreviewView examInstanceId={EXAM} onBack={() => {}} />);
    await userEvent.click(await screen.findByLabelText('Tampilkan kunci jawaban dan skor'));
    expect(screen.getByText('Dinilai guru')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rubrik' })).toBeTruthy();
    expect(screen.getByText('Sebutkan ibu kota')).toBeTruthy();
  });

  it('labels each question on the grading screen with its type, with neutral copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      exam: { examInstanceId: EXAM, lifecycleState: 'ENDED' },
      questions: [
        { snapshotId: 'e1', no: 1, questionType: 'ESSAY', prompt: 'Jelaskan', rubric: '', maxScore: '5', answers: [] },
        { snapshotId: 's1', no: 2, questionType: 'SHORT_ANSWER', prompt: 'Sebutkan ibu kota', rubric: '', maxScore: '2',
          answers: [{ attemptId: ATTEMPT, elligbleId: 'siswa.a', essayText: 'Jakarta', grade: null, history: [] }] },
      ],
    })));
    render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Isian singkat')).toBeTruthy();
    expect(screen.getByText('Esai')).toBeTruthy();
    expect(screen.getByText('Belum ada jawaban yang dikumpulkan untuk soal ini.')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Soal 2 · siswa.a' })).getByLabelText('Skor (0 sampai 2)')).toBeTruthy();
  });

  it('words the IS problems', () => {
    const word = (problem: Parameters<typeof describeImportProblem>[0]) => describeImportProblem(problem);
    expect(word({ source: 'file', code: 'options_not_allowed', line: 2, type: 'IS' })).toBe('Baris 2: soal Isian singkat (IS) tidak memakai kolom pilihan; kosongkan option_a sampai option_e.');
    expect(word({ source: 'file', code: 'items_not_allowed', line: 2, type: 'IS' })).toBe('Baris 2: soal IS tidak memakai kolom right_a sampai right_l; kosongkan kolom itu.');
    expect(word({ source: 'file', code: 'items_duplicate', line: 2, type: 'IS' })).toBe('Baris 2: bentuk jawaban IS tidak boleh sama satu sama lain (huruf besar, huruf kecil dan spasi tidak dibedakan).');
    expect(word({ source: 'file', code: 'correct_not_allowed', line: 2, type: 'IS' })).toBe('Baris 2: soal IS memakai kolom left_1 sampai left_10 untuk bentuk jawaban, jadi kolom correct dikosongkan.');
    expect(word({ source: 'file', code: 'short_answer_forms_invalid', line: 2 })).toBe('Baris 2: bentuk jawaban IS diisi berurutan mulai left_1, paling banyak 10, masing-masing satu baris, paling banyak 200 karakter dan tanpa karakter yang tidak didukung.');
    expect(word({ source: 'file', code: 'type_invalid', line: 2 })).toBe('Baris 2: tipe soal harus PG, PGK, BS, MJ, UR, IA, IS atau ES.');
  });
});
