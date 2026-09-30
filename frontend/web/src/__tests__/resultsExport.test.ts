import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildResultsCsv, resultsCsvFileName } from '../lib/results-export.ts';
import { setDisplayTimeZone } from '../lib/format.ts';
import type { TeacherExamResultsResponse } from '../types/assessment.ts';

// Result export (D04.8-52/53): spreadsheet-ready for Indonesian settings, every row with its
// provenance, absent is not zero, nothing a spreadsheet would run as a formula.

function results(overrides: Partial<TeacherExamResultsResponse> = {}): TeacherExamResultsResponse {
  return {
    exam: {
      examInstanceId: '5f0c7b8e-1d2a-4c3b-8e9f-0a1b2c3d4e5f',
      subjectLabel: 'Matematika Wajib',
      groupLabel: 'X-1',
      assessmentTypeLabel: 'Ulangan Harian',
      lifecycleState: 'FINALIZED',
      windowStartsAt: '2026-09-29T01:00:00.000Z',
      windowEndsAt: '2026-09-29T03:00:00.000Z',
    },
    scoring: { rule: 'BASELINE_SINGLE_CHOICE_V1', available: true, questionCount: 3, maxScore: 3 },
    resultState: 'FINAL',
    finalizedAt: '2026-09-29T04:05:00.000Z',
    summary: { participants: 3, notStarted: 1, inProgress: 0, submitted: 2 },
    participants: [
      { elligbleId: 'siswa.a', status: 'SUBMITTED', finalizationSource: 'STUDENT_SUBMIT', submittedAt: '2026-09-29T01:41:00.000Z', score: { correct: 2, incorrect: 1, unanswered: 0, rawScore: 2, maxScore: 3, scaledScore: 66.67 } },
      { elligbleId: 'siswa.b', status: 'SUBMITTED', finalizationSource: 'EXPIRY_SERVER', submittedAt: '2026-09-29T02:30:00.000Z', score: { correct: 1, incorrect: 0, unanswered: 2, rawScore: 1.5, maxScore: 3, scaledScore: 50 } },
      { elligbleId: 'siswa.c', status: 'ABSENT', finalizationSource: null, submittedAt: null, score: null },
    ],
    ...overrides,
  };
}

const rowsOf = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n').map(line => line.split(';'));

describe('result export', () => {
  beforeEach(() => setDisplayTimeZone('Asia/Jakarta'));
  afterEach(() => setDisplayTimeZone(null));

  it('writes one self-describing row per participant for Indonesian spreadsheets', () => {
    const csv = buildResultsCsv(results());
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const [header, a, b, c] = rowsOf(csv);
    expect(header).toEqual([
      'Mata pelajaran', 'Kelas', 'Jenis penilaian', 'Status hasil', 'Waktu finalisasi (WIB)',
      'ELLIGBLE ID', 'Status peserta', 'Cara pengumpulan', 'Waktu pengumpulan (WIB)', 'Percobaan',
      'Benar', 'Salah', 'Tidak dijawab', 'Skor', 'Skor maksimum', 'Nilai (0-100)', 'Aturan penilaian',
    ]);
    expect(a).toEqual([
      'Matematika Wajib', 'X-1', 'Ulangan Harian', 'Final', '2026-09-29 11:05',
      'siswa.a', 'Dikumpulkan', 'Oleh siswa', '2026-09-29 08:41', 'Asli',
      '2', '1', '0', '2', '3', '66,67', 'BASELINE_SINGLE_CHOICE_V1',
    ]);
    expect(b.slice(6, 9)).toEqual(['Dikumpulkan otomatis', 'Otomatis oleh server saat waktu habis, perangkat tidak terhubung', '2026-09-29 09:30']);
    expect(b.slice(13, 16)).toEqual(['1,5', '3', '50']);
    // Absent is not zero: every score cell stays empty.
    expect(c.slice(5, 17)).toEqual(['siswa.c', 'Tidak mengerjakan', '', '', '', '', '', '', '', '', '', '']);
    expect(csv).not.toContain('—');
  });

  it('marks provisional results and never lets a value run as a formula', () => {
    const csv = buildResultsCsv(results({
      resultState: 'PROVISIONAL',
      finalizedAt: null,
      exam: { ...results().exam, subjectLabel: '=HYPERLINK("http://contoh")', groupLabel: 'X; IPA "1"' },
      participants: [{ elligbleId: '-siswa', status: 'IN_PROGRESS', finalizationSource: null, submittedAt: null, score: null }],
    }));
    const body = csv.replace(/^﻿/, '').split('\r\n')[1];
    expect(body.startsWith(`"'=HYPERLINK(""http://contoh"")";"X; IPA ""1""";Ulangan Harian;Sementara;;'-siswa;Sedang mengerjakan;;;Asli`)).toBe(true);
  });

  it('names the file after the exam, its date and its state', () => {
    expect(resultsCsvFileName(results())).toBe('hasil-ujian_matematika-wajib_x-1_2026-09-29_final.csv');
    expect(resultsCsvFileName(results({ resultState: 'PROVISIONAL', exam: { ...results().exam, subjectLabel: 'Bahasa Indonesia', groupLabel: null } })))
      .toBe('hasil-ujian_bahasa-indonesia_2026-09-29_sementara.csv');
  });
});
