import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import { ESSAY_HINT_INVALID, ESSAY_HINT_TOO_LONG, EssayAnswer, formatCount } from '../components/answers/EssayAnswer.tsx';
import { ESSAY_GRADE_SAVED, ESSAY_GRADE_STALE, TeacherEssayGradingView, essayGradeInvalid } from '../components/TeacherEssayGradingView.tsx';
import { TeacherExamPreviewView } from '../components/TeacherExamPreviewView.tsx';
import { TeacherResultsView } from '../components/TeacherResultsView.tsx';
import { TeacherReadinessView } from '../components/TeacherReadinessView.tsx';
import { openAnswerStore } from '../exam/answer-store.ts';
import { storeExamSessionId } from '../exam/exam-session.ts';
import { createAnswerSyncApi, toServerAnswerState } from '../exam/answer-sync-api.ts';
import { buildResultsCsv } from '../lib/results-export.ts';
import { describeImportProblem } from '../lib/question-import.ts';
import {
  ESSAY_KEY, answerValueOf, codePointCount, essayTextProblem, isAnsweredValue, isEmptyValue, isEssayText,
  type ResumeResponse, type StudentSafeQuestion, type TeacherEssayWorklist, type TeacherExamResultsResponse,
} from '../types/assessment.ts';

// ASSESS-QUESTION-008 client (record §4.6, C05): the text predicate shared with the server, the
// payload built only from "" or valid text, the counter, D2 (over-limit or unsupported text is a
// draft that is never sent and reads "Belum tersimpan"), recovery exactly as written, no rubric or
// grade in any record, the essay teacher preview, the grading screen (save, invalid, stale,
// history, read-only once FINALIZED), the D1 results columns, the D4 CSV cells, the finalize
// refusal copy and the import wording.

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const ES = '88888888-8888-4888-8888-888888888888';
const PG = '66666666-6666-4666-8666-666666666666';
const EXAM = '33333333-3333-4333-8333-333333333333';
const esQuestion = { snapshotId: ES, schemaVersion: 2, questionType: 'ESSAY', prompt: 'Jelaskan fotosintesis', options: [] } as StudentSafeQuestion;
const pgQuestion = { snapshotId: PG, schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal pilihan', options: [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }] } as StudentSafeQuestion;
const resume = (answers: ResumeResponse['answers'] = []): ResumeResponse => ({
  attemptId: ATTEMPT, session: { status: 'active', activatedAt: '2026-11-08T08:00:00.000Z', ownedByCaller: true }, answers,
  timer: { status: 'active', startedAt: '2026-11-08T08:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 3000 },
  submission: { status: 'not_submitted' }, context: { subjectLabel: 'IPA', roomLabel: null },
} as ResumeResponse);
const TEXT = 'Baris pertama\nBaris kedua\n\tberindentasi 😀';

describe('essay values', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('applies the server predicate; only "" or valid text is ever sent, exactly as written', async () => {
    for (const text of ['', TEXT, 'a\r\nb', 'a'.repeat(5000), '😀'.repeat(5000), ' é']) expect(isEssayText(text)).toBe(true);
    for (const text of ['a'.repeat(5001), '😀'.repeat(5001), '\u0001', '\u007f', '\u0085', 'a\ud800', '\udc00b']) expect(isEssayText(text)).toBe(false);
    expect([essayTextProblem('a'.repeat(5001) + '\u0001'), essayTextProblem('x\u0001'), essayTextProblem('ok')]).toEqual(['too_long', 'invalid_character', null]);
    expect([codePointCount('😀a'), codePointCount('\r\n')]).toEqual([2, 2]);
    expect(formatCount(5000)).toBe('5.000');
    expect(answerValueOf({ essayText: TEXT })).toBe(TEXT);
    expect(answerValueOf({ essayText: '' })).toBe('');
    for (const bad of [{ essayText: 5 }, { essayText: '\u0001' }]) expect(answerValueOf(bad)).toBeNull();
    expect(toServerAnswerState({ snapshotId: ES, answerPayload: { essayText: TEXT }, writeVersion: 1, clientWriteIdentity: 'c', updatedAt: '' } as never).optionId).toBe(TEXT);
    expect([isAnsweredValue(ESSAY_KEY, TEXT), isAnsweredValue(ESSAY_KEY, ''), isEmptyValue(ESSAY_KEY, ''), isEmptyValue(ESSAY_KEY, '[]')]).toEqual([true, false, true, false]);

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'acknowledged', clientWriteIdentity: 'c', writeVersion: 1, serverTime: new Date().toISOString() }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createAnswerSyncApi(ATTEMPT, SESSION);
    const base = { attemptId: ATTEMPT, sessionId: SESSION, snapshotId: ES, contentKey: ESSAY_KEY, clientWriteIdentity: 'c', expectedWriteVersion: null, capturedAt: 0 };
    expect((await api.save({ ...base, optionId: TEXT })).kind).toBe('ack');
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).answerPayload).toEqual({ essayText: TEXT });
    for (const bad of ['a'.repeat(5001), 'x\u0001']) expect(await api.save({ ...base, optionId: bad })).toEqual({ kind: 'rejected', code: 'invalid_answer_payload' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('the essay control', () => {
  it('is the shared Textarea, labelled and described, with a counter that is not a live region', () => {
    render(<EssayAnswer question={esQuestion} value={undefined} onChange={() => {}} />);
    const field = screen.getByLabelText('Jawaban esai') as HTMLTextAreaElement;
    expect(field.tagName).toBe('TEXTAREA');
    expect(field.getAttribute('maxlength')).toBeNull();
    expect(field.rows).toBeGreaterThanOrEqual(8);
    const described = field.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)!);
    expect(described.map(el => el.textContent)).toEqual(['Tulis jawaban dengan teks biasa, paling banyak 5.000 karakter.', '0/5.000 karakter', '']);
    expect(described[1].getAttribute('aria-live')).toBeNull();
    expect(described[2].getAttribute('aria-live')).toBe('polite');
  });

  it('captures valid text; over-limit or unsupported text is a draft with its hint, over-limit first', () => {
    const onChange = vi.fn();
    const onDraft = vi.fn();
    render(<EssayAnswer question={esQuestion} value={undefined} onChange={onChange} onDraft={onDraft} />);
    const field = screen.getByLabelText('Jawaban esai');
    fireEvent.change(field, { target: { value: TEXT } });
    expect(onChange).toHaveBeenLastCalledWith(TEXT);
    expect(document.querySelector('.essay-count')?.textContent).toBe(`${codePointCount(TEXT)}/5.000 karakter`);
    const long = 'a'.repeat(5001);
    fireEvent.change(field, { target: { value: long } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.essay-hint')?.textContent).toBe(ESSAY_HINT_TOO_LONG);
    expect(document.querySelector('.essay-count')?.textContent).toBe('5.001/5.000 karakter');
    expect(onDraft).toHaveBeenLastCalledWith(long);
    fireEvent.change(field, { target: { value: long + '\u0001' } });
    expect(document.querySelector('.essay-hint')?.textContent).toBe(ESSAY_HINT_TOO_LONG);
    fireEvent.change(field, { target: { value: 'x\u0001' } });
    expect(document.querySelector('.essay-hint')?.textContent).toBe(ESSAY_HINT_INVALID);
    fireEvent.change(field, { target: { value: 'pendek' } });
    expect(onChange).toHaveBeenLastCalledWith('pendek');
    expect(onDraft).toHaveBeenLastCalledWith(undefined);
    expect(document.querySelector('.essay-hint')?.textContent).toBe('');
  });
});

describe('the exam screen with an essay', () => {
  const saves: Array<{ snapshotId: string; answerPayload: unknown }> = [];
  let resumeAnswers: ResumeResponse['answers'] = [];
  beforeEach(async () => {
    vi.restoreAllMocks();
    saves.length = 0;
    resumeAnswers = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) return new Response(JSON.stringify(resume(resumeAnswers)), { status: 200 });
      if (url.includes('/api/v1/assessment/questions')) return new Response(JSON.stringify({ attemptId: ATTEMPT, questions: [esQuestion, pgQuestion] }), { status: 200 });
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

  it('saves as written; over-limit text is never sent and reads "Belum tersimpan"; the draft survives leaving the question', async () => {
    render(<StudentExamWorkstation />);
    const field = await screen.findByLabelText('Jawaban esai');
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    fireEvent.change(field, { target: { value: TEXT } });
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ essayText: TEXT }));
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    const sent = saves.length;
    const long = 'b'.repeat(5001);
    fireEvent.change(field, { target: { value: long } });
    await waitFor(() => expect(saveText()).toBe('Belum tersimpan'));
    expect(saves.length).toBe(sent);
    await userEvent.click(screen.getByRole('button', { name: 'Soal Berikutnya' }));
    expect(await screen.findByText('Soal pilihan')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Soal Sebelumnya' }));
    expect(((await screen.findByLabelText('Jawaban esai')) as HTMLTextAreaElement).value).toBe(long);
    expect(saveText()).toBe('Belum tersimpan');
    fireEvent.change(screen.getByLabelText('Jawaban esai'), { target: { value: '' } });
    await waitFor(() => expect(saves.at(-1)?.answerPayload).toEqual({ essayText: '' }));
    await waitFor(() => expect(saveText()).toBe('Belum dijawab'));
    for (const record of await (await openAnswerStore()).listForAttempt('', ATTEMPT)) expect(JSON.stringify(record)).not.toMatch(/rubric|grade|score/i);
  });

  it('a stored essay is shown exactly as written after a reload', async () => {
    resumeAnswers = [{ snapshotId: ES, answerPayload: { essayText: TEXT }, writeVersion: 3, clientWriteIdentity: 'srv', updatedAt: '2026-11-08T08:10:00.000Z' }] as ResumeResponse['answers'];
    render(<StudentExamWorkstation />);
    expect(((await screen.findByLabelText('Jawaban esai')) as HTMLTextAreaElement).value).toBe(TEXT);
    await waitFor(() => expect(saveText()).toBe('Tersimpan'));
    expect(saves).toEqual([]);
  });
});

describe('teacher preview of an essay', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('shows the Student control as a try-out and the rubric on request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      exam: { examInstanceId: EXAM, subjectLabel: 'IPA', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'SCHEDULED',
        windowStartsAt: '2026-11-08T01:00:00.000Z', windowEndsAt: '2026-11-08T03:00:00.000Z', durationMinutes: 60 },
      questions: [{ snapshotId: 'e1', no: 1, prompt: 'Jelaskan fotosintesis', options: [], correctOptionId: null, correctOptionIds: null,
        questionType: 'ESSAY', rubric: 'Sebutkan dua alasan', maxScore: 5, valid: true }],
    }), { status: 200 })));
    render(<TeacherExamPreviewView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Jelaskan fotosintesis')).toBeTruthy();
    expect(screen.getByText(/· Esai/)).toBeTruthy();
    expect(screen.getByLabelText('Jawaban esai')).toBeTruthy();
    expect(screen.queryByText('Sebutkan dua alasan')).toBeNull();
    await userEvent.click(screen.getByLabelText('Tampilkan kunci jawaban dan skor'));
    expect(screen.getByRole('heading', { name: 'Rubrik' })).toBeTruthy();
    expect(screen.getByText('Sebutkan dua alasan')).toBeTruthy();
  });
});

const worklist = (state = 'ENDED', grade: TeacherEssayWorklist['questions'][number]['answers'][number]['grade'] = null): TeacherEssayWorklist => ({
  exam: { examInstanceId: EXAM, lifecycleState: state },
  questions: [{
    snapshotId: ES, no: 2, prompt: 'Jelaskan fotosintesis', rubric: 'Sebutkan dua alasan', maxScore: '2.5',
    answers: [{ attemptId: ATTEMPT, elligbleId: 'siswa.a', essayText: TEXT, grade, history: grade ? [grade] : [] }],
  }],
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('the grading screen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists each answer in a fieldset with the text as written and saves a grade', async () => {
    const posts: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/essays/grade')) { posts.push(JSON.parse(String(init?.body))); return json({ revision: 1, score: '2.5', gradedAt: '2026-11-08T02:00:00.000Z' }); }
      return json(worklist());
    }));
    render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Penilaian Esai' })).toBeTruthy();
    expect(screen.getByText('Belum dinilai: 1 dari 1 jawaban')).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Soal 2 · siswa.a' });
    expect(within(group).getByText((_, el) => el?.textContent === TEXT && el.classList.contains('essay-text'))).toBeTruthy();
    expect(screen.getByText('Sebutkan dua alasan')).toBeTruthy();
    const score = within(group).getByLabelText('Skor (0 sampai 2,5)') as HTMLInputElement;
    expect(score.getAttribute('inputmode')).toBe('decimal');
    fireEvent.change(score, { target: { value: '2,5' } });
    fireEvent.click(within(group).getByRole('button', { name: 'Simpan Nilai' }));
    expect(await within(group).findByText(ESSAY_GRADE_SAVED)).toBeTruthy();
    expect(posts).toEqual([{ examInstanceId: EXAM, attemptId: ATTEMPT, snapshotId: ES, score: '2,5', expectedRevision: null }]);
    expect(screen.getByText('Belum dinilai: 0 dari 1 jawaban')).toBeTruthy();
    expect(within(group).getByText('Riwayat').tagName).toBe('SUMMARY');
  });

  it('says why a grade was refused: invalid and stale', async () => {
    let reply = json({ error: 'invalid_score' }, 400);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('/essays/grade') ? reply : json(worklist('ACTIVE', { score: '1', revision: 1, gradedAt: '2026-11-08T02:00:00.000Z' })))));
    render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    const group = await screen.findByRole('group', { name: 'Soal 2 · siswa.a' });
    expect((within(group).getByLabelText('Skor (0 sampai 2,5)') as HTMLInputElement).value).toBe('1');
    fireEvent.change(within(group).getByLabelText('Skor (0 sampai 2,5)'), { target: { value: '3' } });
    fireEvent.click(within(group).getByRole('button', { name: 'Simpan Nilai' }));
    expect(await within(group).findByText(essayGradeInvalid('2.5'))).toBeTruthy();
    expect(essayGradeInvalid('2.5')).toBe('Nilai tidak valid. Gunakan angka 0 sampai 2,5, paling banyak dua angka di belakang koma.');
    reply = json({ error: 'stale_grade', current: 2 }, 409);
    fireEvent.click(within(group).getByRole('button', { name: 'Simpan Nilai' }));
    expect(await within(group).findByText(ESSAY_GRADE_STALE)).toBeTruthy();
  });

  it('is read-only once FINALIZED', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(worklist('FINALIZED', { score: '2.5', revision: 2, gradedAt: '2026-11-08T02:00:00.000Z' }))));
    render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    const group = await screen.findByRole('group', { name: 'Soal 2 · siswa.a' });
    expect(within(group).queryByRole('textbox')).toBeNull();
    expect(within(group).queryByRole('button', { name: 'Simpan Nilai' })).toBeNull();
    expect(within(group).getByText('Nilai: 2,5')).toBeTruthy();
    expect(screen.getByText('Hasil ujian sudah difinalisasi. Nilai esai dibekukan dan tidak dapat diubah.')).toBeTruthy();
  });
});

const results = (essays: boolean): TeacherExamResultsResponse => ({
  exam: { examInstanceId: EXAM, subjectLabel: 'IPA', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'ENDED',
    windowStartsAt: '2026-09-29T01:00:00.000Z', windowEndsAt: '2026-09-29T03:00:00.000Z' },
  scoring: { rule: 'COMPOSITE_PER_ITEM_V1', available: true, questionCount: 3, maxScore: 8, autoScoredCount: essays ? 1 : 3, essayCount: essays ? 2 : 0 },
  resultState: 'PROVISIONAL', finalizedAt: null,
  summary: { participants: 2, notStarted: 1, inProgress: 0, submitted: 1 },
  participants: [
    { elligbleId: 'siswa.a', status: 'SUBMITTED', finalizationSource: 'STUDENT_SUBMIT', submittedAt: '2026-09-29T01:41:00.000Z',
      score: { correct: 1, incorrect: 0, unanswered: 0, graded: 1, ungraded: 1, rawScore: 5, maxScore: 8, scaledScore: 62.5 } },
    { elligbleId: 'siswa.b', status: 'NOT_STARTED', finalizationSource: null, submittedAt: null, score: null },
  ],
});

describe('results with essays (D1, D4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows "Benar" of the automatically scored questions, "Dinilai guru" and the ungraded count only with essays', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(results(true))));
    const { unmount } = render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByRole('columnheader', { name: 'Dinilai guru' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan Nilai' }));
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('1/1')).toBeTruthy();
    expect(within(row).getByText('Belum dinilai: 1')).toBeTruthy();
    expect(screen.getByText(/Esai dinilai guru; poinnya masuk ke Nilai\./)).toBeTruthy();
    unmount();
    vi.stubGlobal('fetch', vi.fn(async () => json(results(false))));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByRole('columnheader', { name: 'Benar' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Dinilai guru' })).toBeNull();
    expect(screen.queryByText(/Esai dinilai guru/)).toBeNull();
  });

  it('appends "Dinilai guru" and "Belum dinilai" to the CSV, empty when there is no score', () => {
    const [header, a, b] = buildResultsCsv(results(true)).replace(/^﻿/, '').trimEnd().split('\r\n').map(line => line.split(';'));
    expect(header.length).toBe(19);
    expect(header.slice(16)).toEqual(['Aturan penilaian', 'Dinilai guru', 'Belum dinilai']);
    expect(a.slice(16)).toEqual(['COMPOSITE_PER_ITEM_V1', '1', '1']);
    expect(b.slice(16)).toEqual(['', '', '']);
  });
});

describe('finalize refusal and import wording', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explains a finalization refused while essays are ungraded, and offers "Nilai Esai"', async () => {
    const card = {
      examInstanceId: EXAM, subjectLabel: 'IPA', lifecycleState: 'ENDED', windowStartsAt: '2026-09-29T01:00:00.000Z', windowEndsAt: '2026-09-29T03:00:00.000Z',
      baseline: { status: 'baseline_readiness_checks_pass' }, roomProctor: { status: 'room_proctor_readiness_not_applicable' },
      progress: { participants: 2, started: 2, submitted: 2, running: 0 }, essayCount: 2,
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('/teacher-exams/transition') ? json({ error: 'grading_incomplete', ungraded: 3 }, 409) : json({ exams: [card] }))));
    const onOpenEssays = vi.fn();
    render(<TeacherReadinessView onOpenEssays={onOpenEssays} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nilai Esai' }));
    expect(onOpenEssays).toHaveBeenCalledWith(EXAM);
    fireEvent.click(screen.getByRole('button', { name: 'Finalisasi Hasil' }));
    fireEvent.change(screen.getByLabelText('Alasan tindakan'), { target: { value: 'Pelaksanaan ujian terjadwal' } });
    const buttons = screen.getAllByRole('button', { name: 'Finalisasi Hasil' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText('Masih ada 3 jawaban esai yang belum dinilai. Nilai semua esai sebelum finalisasi hasil.')).toBeTruthy();
  });

  it('words the ES problems', () => {
    const word = (problem: Parameters<typeof describeImportProblem>[0]) => describeImportProblem(problem);
    expect(word({ source: 'file', code: 'options_not_allowed', line: 2, type: 'ES' })).toBe('Baris 2: soal Esai (ES) tidak memakai kolom pilihan; kosongkan option_a sampai option_e.');
    expect(word({ source: 'file', code: 'items_not_allowed', line: 2, type: 'ES' })).toBe('Baris 2: soal ES tidak memakai kolom left_1 sampai right_l; kosongkan kolom itu.');
    expect(word({ source: 'file', code: 'correct_not_allowed', line: 2 })).toBe('Baris 2: soal ES dinilai guru, jadi kolom correct dikosongkan.');
    expect(word({ source: 'file', code: 'rubric_not_allowed', line: 2 })).toBe('Baris 2: kolom rubric hanya untuk soal ES; kosongkan untuk tipe lain.');
    expect(word({ source: 'file', code: 'type_invalid', line: 2 })).toBe('Baris 2: tipe soal harus PG, PGK, BS, MJ, UR, IA atau ES.');
    expect(word({ source: 'file', code: 'header_invalid', line: 1 })).toContain('right_a sampai right_l;tolerance;rubric). Unduh templat terbaru');
  });
});
