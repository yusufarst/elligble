import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TeacherExamImportView } from '../components/TeacherExamImportView';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import {
  ApiError, getTeacherExamSetup, getTeacherReadiness, postTeacherExamImport, postTeacherExamImportPreview,
} from '../api/assessment-client';
import { describeImportProblem } from '../lib/question-import';
import { setDisplayTimeZone } from '../lib/format';
import type { TeacherExamImportPreview, TeacherExamSetup } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return {
    ...actual,
    getTeacherExamSetup: vi.fn(),
    postTeacherExamImportPreview: vi.fn(),
    postTeacherExamImport: vi.fn(),
    getTeacherReadiness: vi.fn(),
  };
});

// Teacher question import screen (ASSESS-TEACHER-001): nothing is scheduled before a check
// of exactly what will be scheduled; any change asks for a new check; the confirmation
// carries one import key, kept when it is retried after a lost connection.

const TA = '0f0e0d0c-0b0a-4908-8706-050403020100';
const TA2 = '1f0e0d0c-0b0a-4908-8706-050403020100';
const TYPE = '2f0e0d0c-0b0a-4908-8706-050403020100';
const E1 = '3f0e0d0c-0b0a-4908-8706-050403020101';
const E2 = '3f0e0d0c-0b0a-4908-8706-050403020102';
const CSV = 'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score\n1;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;2\n';

const SETUP: TeacherExamSetup = {
  timeZone: 'Asia/Jakarta',
  teachingAssignments: [
    { teachingAssignmentId: TA, subjectLabel: 'Matematika Wajib', groupLabel: 'X-1', periodLabel: 'Semester Ganjil' },
    { teachingAssignmentId: TA2, subjectLabel: 'Matematika Wajib', groupLabel: 'X-2', periodLabel: 'Semester Ganjil' },
  ],
  assessmentTypes: [{ assessmentTypeId: TYPE, label: 'Ulangan Harian' }],
  limits: { maxQuestions: 200, maxQuestionScore: 1000, maxFileCharacters: 524288, maxDurationMinutes: 1440 },
};

function preview(overrides: Partial<TeacherExamImportPreview> = {}): TeacherExamImportPreview {
  return {
    sourceSha256: 'a'.repeat(64),
    problems: [],
    questions: [{ line: 2, no: 1, prompt: 'Ibu kota Indonesia adalah', options: ['Bandung', 'Jakarta', 'Surabaya', 'Medan', 'Makassar'], correct: 'B', score: 2 }],
    participants: [
      { enrollmentId: E1, elligbleId: 'siswa.a', included: true, conflict: false },
      { enrollmentId: E2, elligbleId: 'siswa.b', included: true, conflict: false },
    ],
    window: { startsAt: '2026-10-05T01:00:00.000Z', endsAt: '2026-10-05T03:00:00.000Z' },
    totals: { questions: 1, maxScore: 2, participants: 2 },
    ...overrides,
  };
}

async function fillForm(options: { groupLabel?: RegExp } = {}) {
  fireEvent.click(await screen.findByRole('radio', { name: options.groupLabel ?? /X-1/ }));
  fireEvent.change(screen.getByLabelText('Jenis penilaian'), { target: { value: TYPE } });
  fireEvent.change(screen.getByLabelText(/^Mulai/), { target: { value: '2026-10-05T08:00' } });
  fireEvent.change(screen.getByLabelText(/^Selesai/), { target: { value: '2026-10-05T10:00' } });
  fireEvent.change(screen.getByLabelText('Durasi pengerjaan (menit)'), { target: { value: '90' } });
  fireEvent.click(screen.getByRole('radio', { name: /Durasi penuh/ }));
  const file = new File([CSV], 'ulangan-bab-3.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('Berkas CSV'), { target: { files: [file] } });
  await waitFor(() => expect((screen.getByRole('button', { name: 'Periksa Soal dan Jadwal' }) as HTMLButtonElement).disabled).toBe(false));
}

describe('TeacherExamImportView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
    vi.mocked(getTeacherExamSetup).mockResolvedValue(SETUP);
  });

  it('checks exactly the entered schedule and file, and shows questions, key and participants', async () => {
    vi.mocked(postTeacherExamImportPreview).mockResolvedValue(preview());
    render(<TeacherExamImportView onBack={() => {}} onScheduled={() => {}} />);
    expect((await screen.findByRole('button', { name: 'Periksa Soal dan Jadwal' }) as HTMLButtonElement).disabled).toBe(true);
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal dan Jadwal' }));
    await screen.findByText('Soal dan jadwal siap dijadwalkan');
    expect(postTeacherExamImportPreview).toHaveBeenCalledWith({
      teachingAssignmentId: TA,
      assessmentTypeId: TYPE,
      windowStartsAt: '2026-10-05T08:00',
      windowEndsAt: '2026-10-05T10:00',
      durationMinutes: 90,
      latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
      questionsCsv: CSV,
      sourceFileName: 'ulangan-bab-3.csv',
      participantEnrollmentIds: null,
    });
    const question = screen.getByText('Ibu kota Indonesia adalah').closest('li')!;
    const key = within(question).getByText('Kunci jawaban').closest('li')!;
    expect((key).textContent).toContain('B.Jakarta');
    expect(within(question).getByText('Skor 2')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'siswa.a' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('5 Oktober 2026, 08.00 sampai 10.00 WIB')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Jadwalkan Ujian' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('words every problem with its line and never offers to schedule', async () => {
    vi.mocked(postTeacherExamImportPreview).mockResolvedValue(preview({
      problems: [
        { source: 'file', code: 'correct_multiple', line: 3 },
        { source: 'setup', code: 'schedule_conflict', count: 1 },
      ],
      participants: [
        { enrollmentId: E1, elligbleId: 'siswa.a', included: true, conflict: true },
        { enrollmentId: E2, elligbleId: 'siswa.b', included: true, conflict: false },
      ],
    }));
    render(<TeacherExamImportView onBack={() => {}} onScheduled={() => {}} />);
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal dan Jadwal' }));
    const alert = await screen.findByText('Perbaiki 2 hal berikut, lalu periksa lagi');
    const list = alert.closest('[data-slot="alert"]')!;
    expect((list).textContent).toContain('Baris 3: kunci jawaban harus satu huruf. Setiap soal hanya punya satu jawaban benar.');
    expect((list).textContent).toContain('1 peserta sudah dijadwalkan pada ujian lain yang waktunya bertabrakan');
    expect(within(screen.getByRole('checkbox', { name: /siswa\.a/ }).closest('label')!).getByText('Bentrok jadwal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Jadwalkan Ujian' })).toBeNull();
  });

  it('leaving out a student asks for a new check that sends the remaining students', async () => {
    vi.mocked(postTeacherExamImportPreview).mockResolvedValueOnce(preview()).mockResolvedValueOnce(preview({
      participants: [
        { enrollmentId: E1, elligbleId: 'siswa.a', included: true, conflict: false },
        { enrollmentId: E2, elligbleId: 'siswa.b', included: false, conflict: false },
      ],
      totals: { questions: 1, maxScore: 2, participants: 1 },
    }));
    render(<TeacherExamImportView onBack={() => {}} onScheduled={() => {}} />);
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal dan Jadwal' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'siswa.b' }));
    expect(screen.queryByRole('button', { name: 'Jadwalkan Ujian' })).toBeNull();
    expect(screen.getByText('Ada perubahan sejak pemeriksaan terakhir. Periksa lagi sebelum menjadwalkan.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Lagi' }));
    await screen.findByRole('button', { name: 'Jadwalkan Ujian' });
    expect(vi.mocked(postTeacherExamImportPreview).mock.calls[1][0].participantEnrollmentIds).toEqual([E1]);
    expect((screen.getByRole('checkbox', { name: 'siswa.b' }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('Peserta (1 dari 2)')).toBeTruthy();
  });

  it('another class starts again from everyone enrolled in it', async () => {
    vi.mocked(postTeacherExamImportPreview).mockResolvedValue(preview());
    render(<TeacherExamImportView onBack={() => {}} onScheduled={() => {}} />);
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal dan Jadwal' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'siswa.b' }));
    fireEvent.click(screen.getByRole('radio', { name: /X-2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Lagi' }));
    await waitFor(() => expect(postTeacherExamImportPreview).toHaveBeenCalledTimes(2));
    expect(vi.mocked(postTeacherExamImportPreview).mock.calls[1][0]).toMatchObject({ teachingAssignmentId: TA2, participantEnrollmentIds: null });
  });

  it('a confirmation retried after a lost connection keeps its import key and reports the scheduled exam', async () => {
    vi.mocked(postTeacherExamImportPreview).mockResolvedValue(preview());
    vi.mocked(postTeacherExamImport)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ examInstanceId: 'x', replayed: true, questionCount: 1, participantCount: 2 });
    const onScheduled = vi.fn();
    render(<TeacherExamImportView onBack={() => {}} onScheduled={onScheduled} />);
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal dan Jadwal' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Jadwalkan Ujian' }));
    const dialog = await screen.findByRole('dialog', { name: 'Jadwalkan Ujian Ini?' });
    expect((dialog).textContent).toContain('Matematika Wajib · X-1 · Ulangan Harian. 5 Oktober 2026, 08.00 sampai 10.00 WIB. 1 soal, 2 peserta.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Jadwalkan Ujian' }));
    await within(dialog).findByText(/Ujian belum tersimpan karena koneksi terputus/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Coba Lagi' }));
    await waitFor(() => expect(onScheduled).toHaveBeenCalled());
    const [first, second] = vi.mocked(postTeacherExamImport).mock.calls;
    expect(first[1].importKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(second[1]).toEqual(first[1]);
    expect(first[1].expectedSha256).toBe('a'.repeat(64));
    expect(onScheduled.mock.calls[0][0]).toBe('Matematika Wajib · X-1 dijadwalkan dengan 1 soal dan 2 peserta. Periksa kesiapan, lalu tandai siap sebelum dibuka.');
  });

  it('problems found at confirmation replace the preview and close the dialog', async () => {
    vi.mocked(postTeacherExamImportPreview).mockResolvedValue(preview());
    vi.mocked(postTeacherExamImport).mockRejectedValue(new ApiError(422, 'import_invalid', undefined, {
      error: 'import_invalid', ...preview({ problems: [{ source: 'setup', code: 'schedule_conflict', count: 2 }] }),
    }));
    render(<TeacherExamImportView onBack={() => {}} onScheduled={() => {}} />);
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal dan Jadwal' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Jadwalkan Ujian' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Jadwalkan Ujian' }));
    await screen.findByText(/2 peserta sudah dijadwalkan pada ujian lain/);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jadwalkan Ujian' })).toBeNull();
  });

  it('a teacher without a teaching assignment is told so', async () => {
    vi.mocked(getTeacherExamSetup).mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<TeacherExamImportView onBack={() => {}} onScheduled={() => {}} />);
    expect(await screen.findByText('Akses Ditolak')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Buat Ujian dari Berkas Soal' })).toBeTruthy();
  });

  it('every problem code has Indonesian wording without an em dash', () => {
    const file = ['not_text', 'encoding_invalid', 'csv_syntax', 'header_invalid', 'file_empty', 'too_many_questions', 'column_count',
      'number_out_of_order', 'prompt_empty', 'option_empty', 'options_duplicate', 'correct_multiple', 'correct_invalid', 'score_invalid'] as const;
    const setup = ['file_too_large', 'time_zone_missing', 'window_invalid', 'window_order', 'window_ended', 'duration_invalid',
      'duration_exceeds_window', 'assessment_type_unknown', 'participant_not_enrolled', 'no_participants', 'schedule_conflict', 'not_ready'] as const;
    const texts = [
      ...file.map(code => describeImportProblem({ source: 'file', code, line: 4, expected: 2, found: 8, letters: ['B', 'D'] })),
      ...setup.map(code => describeImportProblem({ source: 'setup', code, count: 2 })),
    ];
    for (const text of texts) {
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain('—');
      expect(text).not.toContain('undefined');
    }
    expect(describeImportProblem({ source: 'file', code: 'option_empty', line: 5, letters: ['B', 'D'] })).toBe('Baris 5: pilihan B dan D kosong. Setiap soal perlu lima pilihan, A sampai E.');
  });
});

describe('TeacherReadinessView with exam creation', () => {
  it('offers "Buat Ujian", shows the notice, and tells exams of one subject apart by class and type', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({
      exams: [{
        examInstanceId: '4f0e0d0c-0b0a-4908-8706-050403020100', subjectLabel: 'Matematika Wajib', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian',
        lifecycleState: 'SCHEDULED', windowStartsAt: '2026-10-05T01:00:00.000Z', windowEndsAt: '2026-10-05T03:00:00.000Z',
        baseline: { status: 'baseline_readiness_checks_pass' }, roomProctor: { status: 'room_proctor_readiness_not_applicable' }, progress: null,
      }],
    } as never);
    const onCreateExam = vi.fn();
    render(<TeacherReadinessView onCreateExam={onCreateExam} notice="Matematika Wajib · X-1 dijadwalkan." />);
    expect(await screen.findByText('X-1 · Ulangan Harian')).toBeTruthy();
    expect((screen.getByRole('status')).textContent).toContain('Matematika Wajib · X-1 dijadwalkan.');
    fireEvent.click(screen.getByRole('button', { name: 'Buat Ujian' }));
    expect(onCreateExam).toHaveBeenCalled();
  });

  it('offers "Buat Ujian" when there is no exam yet', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [] });
    const onCreateExam = vi.fn();
    render(<TeacherReadinessView onCreateExam={onCreateExam} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buat Ujian' }));
    expect(onCreateExam).toHaveBeenCalled();
  });
});
