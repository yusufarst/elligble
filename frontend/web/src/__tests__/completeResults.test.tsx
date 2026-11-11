import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  RESULTS_EXPORT_RUNNING_TEXT, RESULTS_RUNNING_TEXT, RESULTS_RUNNING_TITLE, TeacherResultsView, WRAPPING_BUTTON,
} from '../components/TeacherResultsView.tsx';
import { GRADING_RUNNING_TEXT, GRADING_RUNNING_TITLE, TeacherEssayGradingView } from '../components/TeacherEssayGradingView.tsx';
import { ApiError, getTeacherExamResults, postTeacherResultsExport } from '../api/assessment-client.ts';
import { buildResultsCsv } from '../lib/results-export.ts';
import { setDisplayTimeZone } from '../lib/format.ts';
import type { ParticipantResult, ResultItem, TeacherEssayWorklist, TeacherExamResultsResponse } from '../types/assessment.ts';

// RESULT-004 client (record §4.5, E9, E12, §5 X-1/X-2, C06): both screens' refusal states and copy
// (403, institution_exam_running, the export and save refusals) with no em dash; focus after "Perbarui
// Data", "Unduh CSV", "Cetak" and "Simpan Nilai" settle, success and failure: restored when it was on
// BODY, never left on BODY, left alone when the user moved it; the wrapping classes; the per-question
// CSV columns over the golden content G of §5; and unchanged rendering without the new fields.

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return { ...actual, getTeacherExamResults: vi.fn(), postTeacherResultsExport: vi.fn() };
});

const EXAM = '5f0c7b8e-1d2a-4c3b-8e9f-0a1b2c3d4e5f';
const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const ES = '88888888-8888-4888-8888-888888888888';
const EM_DASH = '—';

/**
 * What a browser does when a focused control becomes disabled (the focus fixup rule): focus falls to
 * BODY. jsdom keeps focus on a disabled button, so the test drops it the same way.
 */
function loseFocusToBody() {
  const probe = document.createElement('input');
  document.body.appendChild(probe);
  probe.focus();
  probe.remove();
  if (document.activeElement !== document.body) (document.activeElement as HTMLElement | null)?.blur();
}

/** A promise the test settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------------------------
// The golden content G and the FINAL E1 projection of §5.

const C = 'CORRECT', I = 'INCORRECT', U = 'UNANSWERED', G = 'GRADED', P = 'UNGRADED';
const QUESTIONS: NonNullable<TeacherExamResultsResponse['questions']> = [
  { no: 1, typeCode: 'PG', maxScore: 2 }, { no: 2, typeCode: 'PGK', maxScore: 3 }, { no: 3, typeCode: 'BS', maxScore: 1 },
  { no: 4, typeCode: 'MJ', maxScore: 4 }, { no: 5, typeCode: 'UR', maxScore: 2 }, { no: 6, typeCode: 'IA', maxScore: 2 },
  { no: 7, typeCode: 'IS', maxScore: 1 }, { no: 8, typeCode: 'IS', maxScore: 2 }, { no: 9, typeCode: 'ES', maxScore: 5 },
];
const items = (outcomes: string[], points: number[]): ResultItem[] =>
  outcomes.map((outcome, i) => ({ no: i + 1, outcome: outcome as ResultItem['outcome'], score: points[i] }));
const zero = [0, 0, 0, 0, 0, 0, 0, 0, 0];

function scored(id: string, source: ParticipantResult['finalizationSource'], counts: [number, number, number, number, number], raw: number, scaled: number, list: ResultItem[]): ParticipantResult {
  const [correct, incorrect, unanswered, graded, ungraded] = counts;
  return {
    elligbleId: id, status: 'SUBMITTED', finalizationSource: source, submittedAt: '2026-11-11T02:00:00.000Z',
    score: { correct, incorrect, unanswered, graded, ungraded, rawScore: raw, maxScore: 22, scaledScore: scaled }, items: list,
  };
}

function finalE1(): TeacherExamResultsResponse {
  return {
    exam: {
      examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X', assessmentTypeLabel: 'PTS', lifecycleState: 'FINALIZED',
      windowStartsAt: '2026-11-11T01:00:00.000Z', windowEndsAt: '2026-11-11T03:00:00.000Z',
    },
    scoring: { rule: 'COMPOSITE_PER_ITEM_V1', available: true, questionCount: 9, maxScore: 22, autoScoredCount: 7, essayCount: 2 },
    resultState: 'FINAL',
    finalizedAt: '2026-11-11T04:00:00.000Z',
    summary: { participants: 8, notStarted: 1, inProgress: 0, submitted: 7 },
    participants: [
      scored('x1', 'STUDENT_SUBMIT', [7, 0, 0, 2, 0], 22, 100, items([C, C, C, C, C, C, C, G, G], [2, 3, 1, 4, 2, 2, 1, 2, 5])),
      scored('x2', 'STUDENT_SUBMIT', [3, 4, 0, 2, 0], 7.5, 34.09, items([C, I, I, I, I, C, C, G, G], [2, 0, 0, 0, 0, 2, 1, 0, 2.5])),
      scored('x3', 'STUDENT_SUBMIT', [0, 0, 9, 0, 0], 0, 0, items([U, U, U, U, U, U, U, U, U], zero)),
      scored('x4', 'STUDENT_SUBMIT', [1, 2, 5, 1, 0], 7, 31.82, items([U, C, U, U, U, I, I, U, G], [0, 3, 0, 0, 0, 0, 0, 0, 4])),
      { elligbleId: 'x5', status: 'ABSENT', finalizationSource: null, submittedAt: null, score: null },
      scored('x6', 'EXPIRY_SERVER', [1, 0, 8, 0, 0], 2, 9.09, items([C, U, U, U, U, U, U, U, U], [2, 0, 0, 0, 0, 0, 0, 0, 0])),
      scored('x7', 'STUDENT_SUBMIT', [1, 0, 8, 0, 0], 1, 4.55, items([U, U, C, U, U, U, U, U, U], [0, 0, 1, 0, 0, 0, 0, 0, 0])),
      scored('x8', 'STUDENT_SUBMIT', [0, 2, 5, 2, 0], 0, 0, items([I, U, U, U, U, U, I, G, G], zero)),
    ],
    questions: QUESTIONS,
  };
}

/** G-1: provisional, x7 still running, x4 and x8 not graded yet. */
function provisionalE1(): TeacherExamResultsResponse {
  const final = finalE1();
  const byId = (id: string) => final.participants.find(p => p.elligbleId === id)!;
  return {
    ...final,
    exam: { ...final.exam, lifecycleState: 'ENDED' },
    resultState: 'PROVISIONAL',
    finalizedAt: null,
    summary: { participants: 8, notStarted: 1, inProgress: 2, submitted: 5 },
    participants: [
      byId('x1'), byId('x2'), byId('x3'),
      scored('x4', 'STUDENT_SUBMIT', [1, 2, 5, 0, 1], 3, 13.64, items([U, C, U, U, U, I, I, U, P], [0, 3, 0, 0, 0, 0, 0, 0, 0])),
      { elligbleId: 'x5', status: 'NOT_STARTED', finalizationSource: null, submittedAt: null, score: null },
      { elligbleId: 'x6', status: 'IN_PROGRESS', finalizationSource: null, submittedAt: null, score: null },
      { elligbleId: 'x7', status: 'IN_PROGRESS', finalizationSource: null, submittedAt: null, score: null },
      scored('x8', 'STUDENT_SUBMIT', [0, 2, 5, 0, 2], 0, 0, items([I, U, U, U, U, U, I, P, P], zero)),
    ],
  };
}

const lines = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n');
const lineOf = (csv: string, id: string) => lines(csv).find(line => line.split(';')[5] === id)!;
const FIXED = 19;

describe('RESULT-004 CSV per-question columns (E9, X-1, X-2)', () => {
  beforeEach(() => setDisplayTimeZone('Asia/Jakarta'));
  afterEach(() => setDisplayTimeZone(null));

  it('X-1 FINAL E1: the 19 fixed columns, then one column per question with the E9 cell strings', () => {
    const csv = buildResultsCsv(finalE1());
    const header = lines(csv)[0].split(';');
    expect(header.slice(0, FIXED)).toEqual([
      'Mata pelajaran', 'Kelas', 'Jenis penilaian', 'Status hasil', 'Waktu finalisasi (WIB)',
      'ELLIGBLE ID', 'Status peserta', 'Cara pengumpulan', 'Waktu pengumpulan (WIB)', 'Percobaan',
      'Benar', 'Salah', 'Tidak dijawab', 'Skor', 'Skor maksimum', 'Nilai (0-100)', 'Aturan penilaian', 'Dinilai guru', 'Belum dinilai',
    ]);
    expect(header.slice(FIXED)).toEqual([
      'Soal 1 (PG, maks 2)', 'Soal 2 (PGK, maks 3)', 'Soal 3 (BS, maks 1)', 'Soal 4 (MJ, maks 4)', 'Soal 5 (UR, maks 2)',
      'Soal 6 (IA, maks 2)', 'Soal 7 (IS, maks 1)', 'Soal 8 (IS, maks 2)', 'Soal 9 (ES, maks 5)',
    ]);
    expect(lineOf(csv, 'x2').endsWith('7,5;22;34,09;COMPOSITE_PER_ITEM_V1;2;0;2;0 (salah);0 (salah);0 (salah);0 (salah);2;1;0 (dinilai guru);2,5')).toBe(true);
    expect(lineOf(csv, 'x3').split(';').slice(FIXED)).toEqual(Array(9).fill('0 (tidak dijawab)'));
    expect(lineOf(csv, 'x4').split(';').slice(FIXED).join(';'))
      .toBe('0 (tidak dijawab);3;0 (tidak dijawab);0 (tidak dijawab);0 (tidak dijawab);0 (salah);0 (salah);0 (tidak dijawab);4');
    expect(lineOf(csv, 'x8').split(';').slice(FIXED).join(';'))
      .toBe('0 (salah);0 (tidak dijawab);0 (tidak dijawab);0 (tidak dijawab);0 (tidak dijawab);0 (tidak dijawab);0 (salah);0 (dinilai guru);0 (dinilai guru)');
    expect(lineOf(csv, 'x1').split(';').slice(FIXED).join(';')).toBe('2;3;1;4;2;2;1;2;5');
    // Absent is not zero: 21 empty cells after "Tidak mengerjakan".
    expect(lineOf(csv, 'x5').endsWith(`;Tidak mengerjakan${';'.repeat(21)}`)).toBe(true);
    expect(lineOf(csv, 'x5').split(';')).toHaveLength(FIXED + 9);
    for (const line of lines(csv)) expect(line.split(';')).toHaveLength(FIXED + 9);
    expect(csv).not.toContain(EM_DASH);
  });

  it('X-1 provisional G-1: "Belum dinilai" for ungraded answers, empty cells for participants still working', () => {
    const csv = buildResultsCsv(provisionalE1());
    expect(lineOf(csv, 'x4').split(';')[FIXED + 8]).toBe('Belum dinilai');
    expect(lineOf(csv, 'x8').split(';').slice(FIXED + 7)).toEqual(['Belum dinilai', 'Belum dinilai']);
    for (const id of ['x5', 'x6', 'x7']) expect(lineOf(csv, id).split(';').slice(FIXED)).toEqual(Array(9).fill(''));
    // The D4 column counts the ungraded answers.
    expect(lineOf(csv, 'x8').split(';')[18]).toBe('2');
  });

  it('every E9 cell string: CORRECT, INCORRECT, UNANSWERED, GRADED above 0 and with 0, UNGRADED and no score', () => {
    const data = finalE1();
    data.questions = [{ no: 1, typeCode: 'IA', maxScore: 2.5 }, { no: 2, typeCode: 'ES', maxScore: 5 }];
    data.participants = [
      scored('a', 'STUDENT_SUBMIT', [1, 0, 0, 1, 0], 4, 53.33, items([C, G], [1.5, 2.5])),
      scored('b', 'STUDENT_SUBMIT', [0, 1, 0, 1, 0], 0, 0, items([I, G], [0, 0])),
      scored('c', 'STUDENT_SUBMIT', [0, 0, 1, 0, 1], 0, 0, items([U, P], [0, 0])),
      { elligbleId: 'd', status: 'ABSENT', finalizationSource: null, submittedAt: null, score: null },
    ];
    const csv = buildResultsCsv(data);
    expect(lines(csv)[0].split(';').slice(FIXED)).toEqual(['Soal 1 (IA, maks 2,5)', 'Soal 2 (ES, maks 5)']);
    expect(lineOf(csv, 'a').split(';').slice(FIXED)).toEqual(['1,5', '2,5']);
    expect(lineOf(csv, 'b').split(';').slice(FIXED)).toEqual(['0 (salah)', '0 (dinilai guru)']);
    expect(lineOf(csv, 'c').split(';').slice(FIXED)).toEqual(['0 (tidak dijawab)', 'Belum dinilai']);
    expect(lineOf(csv, 'd').split(';').slice(FIXED)).toEqual(['', '']);
  });

  it('throws on an outcome outside the closed set, or a scored row without its item: no file is built', () => {
    const unknown = finalE1();
    unknown.participants[0] = { ...unknown.participants[0], items: [...unknown.participants[0].items!.slice(0, 8), { no: 9, outcome: 'PARTIAL' as ResultItem['outcome'], score: 1 }] };
    expect(() => buildResultsCsv(unknown)).toThrow(/Unknown result item outcome PARTIAL/);
    const missing = finalE1();
    missing.participants[0] = { ...missing.participants[0], items: missing.participants[0].items!.slice(0, 8) };
    expect(() => buildResultsCsv(missing)).toThrow(/no item/);
  });

  it('X-2 spreadsheet safety: the formula guard holds in fixed and per-question columns; BOM, CRLF and ";" are kept', () => {
    const data = finalE1();
    data.exam = { ...data.exam, subjectLabel: '=HYPERLINK("http://contoh")', groupLabel: 'X; IPA "1"' };
    data.participants = [{ ...data.participants[1], elligbleId: '-x2' }];
    const csv = buildResultsCsv(data);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const body = lines(csv)[1];
    expect(body.startsWith(`"'=HYPERLINK(""http://contoh"")";"X; IPA ""1""";PTS;Final;`)).toBe(true);
    expect(body).toContain(";'-x2;Dikumpulkan;");
    // Each per-question header and cell is plain: no formula start, no quote, separator or line break.
    const header = lines(csv)[0];
    const cells = [...header.split(';').slice(FIXED), ...body.split(';').slice(-9)];
    expect(cells).toHaveLength(18);
    for (const cell of cells) {
      expect(cell).not.toMatch(/^[=+\-@\t\r]/);
      expect(cell).not.toMatch(/[";\r\n]/);
    }
  });

  it('a response without questions (an older server) adds no column', () => {
    const data = finalE1();
    delete data.questions;
    for (const row of data.participants) delete row.items;
    for (const line of lines(buildResultsCsv(data))) expect(line.split(';')).toHaveLength(FIXED);
  });
});

// ---------------------------------------------------------------------------------------------
// The results screen.

function teacherManaged(overrides: Partial<TeacherExamResultsResponse> = {}): TeacherExamResultsResponse {
  return {
    exam: {
      examInstanceId: EXAM, subjectLabel: 'Matematika Wajib', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'ACTIVE',
      windowStartsAt: '2026-09-29T01:00:00.000Z', windowEndsAt: '2026-09-29T03:00:00.000Z',
    },
    scoring: { rule: 'BASELINE_SINGLE_CHOICE_V1', available: true, questionCount: 3, maxScore: 3, autoScoredCount: 3, essayCount: 0 },
    resultState: 'PROVISIONAL',
    summary: { participants: 2, notStarted: 1, inProgress: 0, submitted: 1 },
    participants: [
      { elligbleId: 'siswa.a', status: 'SUBMITTED', finalizationSource: 'STUDENT_SUBMIT', submittedAt: '2026-09-29T01:41:00.000Z', score: { correct: 2, incorrect: 1, unanswered: 0, graded: 0, ungraded: 0, rawScore: 2, maxScore: 3, scaledScore: 66.67 } },
      { elligbleId: 'siswa.d', status: 'NOT_STARTED', finalizationSource: null, submittedAt: null, score: null },
    ],
    ...overrides,
  };
}
const withProjection = (): TeacherExamResultsResponse => {
  const data = teacherManaged();
  return {
    ...data,
    participants: [{ ...data.participants[0], items: items([C, C, I], [1, 1, 0]) }, data.participants[1]],
    questions: [{ no: 1, typeCode: 'PG', maxScore: 1 }, { no: 2, typeCode: 'PG', maxScore: 1 }, { no: 3, typeCode: 'PG', maxScore: 1 }],
  };
};
const running = (state = 'ACTIVE') => new ApiError(409, 'institution_exam_running', undefined, { error: 'institution_exam_running', currentState: state });
const loaded = () => screen.findByText('Matematika Wajib');
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('RESULT-004 results screen refusals (§4.5, E13)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403 names the subject Teacher, not the managing one', async () => {
    vi.mocked(getTeacherExamResults).mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Akses Ditolak')).toBeTruthy();
    expect(screen.getByText('Hasil ujian hanya dapat dilihat oleh guru mata pelajaran ujian ini.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('yang mengelola');
    expect(document.body.textContent).not.toContain(EM_DASH);
  });

  it('409 institution_exam_running: "Hasil Belum Tersedia", no table, no retry', async () => {
    vi.mocked(getTeacherExamResults).mockRejectedValueOnce(running('PAUSED'));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText(RESULTS_RUNNING_TITLE)).toBeTruthy();
    expect(RESULTS_RUNNING_TITLE).toBe('Hasil Belum Tersedia');
    expect(screen.getByText(RESULTS_RUNNING_TEXT)).toBeTruthy();
    expect(RESULTS_RUNNING_TEXT).toBe('Hasil ujian sekolah dapat dilihat setelah ujian berakhir. Selama ujian berlangsung, pemantauan dilakukan operator sekolah dan pengawas ruang.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Coba Lagi' })).toBeNull();
    expect(document.body.textContent).not.toContain(EM_DASH);
  });

  it('a refresh refused as running clears the earlier data, and focus goes to "Kembali", not BODY', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(teacherManaged({ exam: { ...teacherManaged().exam, lifecycleState: 'READY' } })).mockRejectedValueOnce(running());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    const refresh = button('Perbarui Data');
    refresh.focus();
    fireEvent.click(refresh);
    expect(await screen.findByText(RESULTS_RUNNING_TITLE)).toBeTruthy();
    expect(screen.queryByText('siswa.a')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Kembali ke Pelaksanaan Ujian/ })));
  });

  it('export refused as running: its own copy, no file and no print', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValue(teacherManaged());
    vi.mocked(postTeacherResultsExport).mockRejectedValue(running());
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    fireEvent.click(button('Unduh CSV'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', RESULTS_EXPORT_RUNNING_TEXT);
    expect(RESULTS_EXPORT_RUNNING_TEXT).toBe('Hasil ujian sekolah dapat diekspor setelah ujian berakhir. Tidak ada berkas atau cetakan dibuat.');
    fireEvent.click(button('Cetak'));
    await waitFor(() => expect(postTeacherResultsExport).toHaveBeenCalledTimes(2));
    expect(download).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
    download.mockRestore(); print.mockRestore();
  });

  it('renders a response without the new fields exactly as before, and with them the same screen (RS-1: detail in the CSV only)', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(teacherManaged());
    const { unmount } = render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    fireEvent.click(button('Tampilkan Nilai'));
    const before = screen.getByRole('table').outerHTML;
    unmount();
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(withProjection());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    fireEvent.click(button('Tampilkan Nilai'));
    expect(screen.getByRole('table').outerHTML).toBe(before);
    expect(screen.queryByText(/Soal 1/)).toBeNull();
  });
});

describe('RESULT-004 results screen focus and layout (E12)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('the four toolbar buttons take the wrapping form', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValue(teacherManaged());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    for (const name of ['Tampilkan Nilai', 'Perbarui Data', 'Unduh CSV', 'Cetak']) {
      const classes = button(name).className.split(/\s+/);
      for (const c of ['h-auto', 'min-h-11', 'max-w-full', 'whitespace-normal', 'py-2']) expect(classes, `${name} ${c}`).toContain(c);
    }
    expect(WRAPPING_BUTTON).toBe('h-auto min-h-11 max-w-full whitespace-normal py-2');
  });

  it('"Perbarui Data" keeps disabled while it runs; focus lost to BODY returns to it on success and on failure', async () => {
    for (const outcome of ['success', 'failure'] as const) {
      const pending = deferred<TeacherExamResultsResponse>();
      vi.mocked(getTeacherExamResults).mockResolvedValueOnce(teacherManaged()).mockImplementationOnce(() => pending.promise);
      const { unmount } = render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
      await loaded();
      const refresh = button('Perbarui Data');
      refresh.focus();
      fireEvent.click(refresh);
      const busy = button('Memperbarui...');
      expect(busy.disabled).toBe(true);
      loseFocusToBody(); // A browser moves focus off a control that becomes disabled.
      expect(document.activeElement).toBe(document.body);
      if (outcome === 'success') pending.resolve(teacherManaged());
      else pending.reject(new TypeError('Failed to fetch'));
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Perbarui Data' })), { timeout: 2000 });
      expect(button('Perbarui Data').disabled).toBe(false);
      unmount();
    }
  });

  it('focus the user moved elsewhere while the request ran is left alone', async () => {
    const pending = deferred<TeacherExamResultsResponse>();
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(teacherManaged()).mockImplementationOnce(() => pending.promise);
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    const refresh = button('Perbarui Data');
    refresh.focus();
    fireEvent.click(refresh);
    const toggle = button('Tampilkan Nilai');
    toggle.focus();
    pending.resolve(teacherManaged());
    await waitFor(() => expect(button('Perbarui Data').disabled).toBe(false));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(document.activeElement).toBe(toggle);
  });

  it('"Unduh CSV" and "Cetak": success and failure return focus to the control; a control left disabled falls back to "Perbarui Data"', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:hasil'), revokeObjectURL: vi.fn() });
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    vi.mocked(getTeacherExamResults).mockResolvedValue(withProjection());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    type Exported = Awaited<ReturnType<typeof postTeacherResultsExport>>;
    const receipt = (data: TeacherExamResultsResponse): Exported => ({ ...data, audit: { id: EXAM, outcome: 'ISSUED', replayed: false }, issuedAt: '2026-09-29T04:05:00.000Z' });
    const cases: Array<[string, 'resolve' | 'reject', TeacherExamResultsResponse, string]> = [
      ['Unduh CSV', 'resolve', withProjection(), 'Unduh CSV'],
      ['Unduh CSV', 'reject', withProjection(), 'Unduh CSV'],
      ['Cetak', 'resolve', withProjection(), 'Cetak'],
      ['Cetak', 'reject', withProjection(), 'Cetak'],
      // The export answers with no participants: "Unduh CSV" stays disabled, so focus goes to "Perbarui Data".
      ['Unduh CSV', 'resolve', { ...withProjection(), participants: [], summary: { participants: 0, notStarted: 0, inProgress: 0, submitted: 0 } }, 'Perbarui Data'],
    ];
    for (const [name, how, data, expected] of cases) {
      const pending = deferred<Exported>();
      vi.mocked(postTeacherResultsExport).mockImplementationOnce(() => pending.promise);
      const control = button(name);
      control.focus();
      fireEvent.click(control);
      expect(control.disabled).toBe(true);
      loseFocusToBody();
      if (how === 'resolve') pending.resolve(receipt(data));
      else pending.reject(new TypeError('Failed to fetch'));
      await waitFor(() => expect(document.activeElement).toBe(button(expected)), { timeout: 2000 });
      expect(document.activeElement).not.toBe(document.body);
    }
    expect(download).toHaveBeenCalledTimes(2);
    expect(print).toHaveBeenCalledTimes(1);
    download.mockRestore(); print.mockRestore();
  });
});

// ---------------------------------------------------------------------------------------------
// The grading screen.

const worklist = (state = 'ENDED'): TeacherEssayWorklist => ({
  exam: { examInstanceId: EXAM, lifecycleState: state },
  questions: [{
    snapshotId: ES, no: 9, questionType: 'ESSAY', prompt: 'Mengapa hutan penting?', rubric: 'Sebutkan dua alasan.', maxScore: '5',
    answers: [{ attemptId: ATTEMPT, elligbleId: 'x4', essayText: 'Hutan menyimpan air.', grade: null, history: [] }],
  }],
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('RESULT-004 grading screen (§4.5, E7, E12)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('403 names the subject Teacher; 409 institution_exam_running: "Penilaian Belum Tersedia"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'forbidden' }, 403)));
    const { unmount } = render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Jawaban hanya dapat dinilai oleh guru mata pelajaran ujian ini.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('yang mengelola');
    unmount();
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'institution_exam_running', currentState: 'ACTIVE' }, 409)));
    render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText(GRADING_RUNNING_TITLE)).toBeTruthy();
    expect(GRADING_RUNNING_TITLE).toBe('Penilaian Belum Tersedia');
    expect(screen.getByText(GRADING_RUNNING_TEXT)).toBeTruthy();
    expect(GRADING_RUNNING_TEXT).toBe('Jawaban ujian sekolah dapat dinilai setelah ujian berakhir.');
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.body.textContent).not.toContain(EM_DASH);
  });

  it('a save refused as running shows the copy in the answer status line', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('/essays/grade')
      ? json({ error: 'institution_exam_running', currentState: 'PAUSED' }, 409) : json(worklist()))));
    render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    const group = await screen.findByRole('group', { name: 'Soal 9 · x4' });
    fireEvent.change(within(group).getByLabelText('Skor (0 sampai 5)'), { target: { value: '4' } });
    fireEvent.click(within(group).getByRole('button', { name: 'Simpan Nilai' }));
    expect(await within(group).findByText(GRADING_RUNNING_TEXT)).toBeTruthy();
    expect(within(group).getByRole('status').textContent).toBe(GRADING_RUNNING_TEXT);
  });

  it('"Simpan Nilai" wraps, keeps disabled while saving, and gets focus back from BODY on success and on failure', async () => {
    for (const reply of [json({ revision: 1, score: '4', gradedAt: '2026-11-11T05:00:00.000Z' }), json({ error: 'stale_grade', current: 1 }, 409)]) {
      const pending = deferred<Response>();
      vi.stubGlobal('fetch', vi.fn((url: string) => (url.includes('/essays/grade') ? pending.promise : Promise.resolve(json(worklist())))));
      const { unmount } = render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
      const group = await screen.findByRole('group', { name: 'Soal 9 · x4' });
      const save = within(group).getByRole('button', { name: 'Simpan Nilai' }) as HTMLButtonElement;
      for (const c of ['h-auto', 'min-h-11', 'max-w-full', 'whitespace-normal', 'py-2']) expect(save.className.split(/\s+/)).toContain(c);
      fireEvent.change(within(group).getByLabelText('Skor (0 sampai 5)'), { target: { value: '4' } });
      save.focus();
      fireEvent.click(save);
      await waitFor(() => expect(save.disabled).toBe(true));
      loseFocusToBody();
      expect(document.activeElement).toBe(document.body);
      pending.resolve(reply);
      await waitFor(() => expect(document.activeElement).toBe(save), { timeout: 2000 });
      expect(save.disabled).toBe(false);
      unmount();
    }
  });

  it('focus moved to the score field while saving stays there', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((url: string) => (url.includes('/essays/grade') ? pending.promise : Promise.resolve(json(worklist())))));
    render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    const group = await screen.findByRole('group', { name: 'Soal 9 · x4' });
    const field = within(group).getByLabelText('Skor (0 sampai 5)') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '4' } });
    const save = within(group).getByRole('button', { name: 'Simpan Nilai' }) as HTMLButtonElement;
    save.focus();
    fireEvent.click(save);
    await waitFor(() => expect(save.disabled).toBe(true));
    field.focus();
    pending.resolve(json({ revision: 1, score: '4', gradedAt: '2026-11-11T05:00:00.000Z' }));
    await waitFor(() => expect(save.disabled).toBe(false));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(document.activeElement).toBe(field);
  });
});

describe('RESULT-004 entry focus (E12, rendered review; as ASSESS-ROOM-001 §11.0.2)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  const title = (name: string) => screen.getByRole('heading', { level: 1, name });

  it('the results screen title takes focus once it has loaded or been refused, never leaving BODY', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(teacherManaged());
    const { unmount } = render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    await loaded();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
    expect((document.activeElement as HTMLElement).tabIndex).toBe(-1);
    unmount();
    vi.mocked(getTeacherExamResults).mockRejectedValueOnce(running());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText(RESULTS_RUNNING_TITLE)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
  });

  it('the grading screen title takes focus once it has loaded; focus already elsewhere is left alone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(worklist())));
    const { unmount } = render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    await screen.findByRole('group', { name: 'Soal 9 · x4' });
    await waitFor(() => expect(document.activeElement).toBe(title('Penilaian Esai')));
    unmount();
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(() => pending.promise));
    const outside = document.createElement('button');
    document.body.append(outside);
    render(<TeacherEssayGradingView examInstanceId={EXAM} onBack={() => {}} />);
    outside.focus();
    pending.resolve(json(worklist()));
    await screen.findByRole('group', { name: 'Soal 9 · x4' });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
