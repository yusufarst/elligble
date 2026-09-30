import type { ParticipantResult, TeacherExamResultsResponse } from '../types/assessment.ts';
import { formatSheetDate, formatSheetDateTime, zoneLabel } from './format.ts';
import { resultStatus } from './status.ts';

// Result export for the teacher who manages the exam (D04.8-52/53). One flat table in which
// every row carries its own provenance (exam, result state, how and when the attempt was
// submitted, attempt kind, scoring rule), so rows stay meaningful when files are merged.
// The file follows the Indonesian spreadsheet convention: semicolon between columns, comma
// before decimals, UTF-8 with a byte-order mark so Excel reads it as UTF-8. A text value
// that a spreadsheet could run as a formula is prefixed with an apostrophe. Absent
// participants have empty score cells, never 0 (D04.4-12).

const SEPARATOR = ';';
const FORMULA_START = /^[=+\-@\t\r]/;

function text(value: string | null | undefined): string {
  const raw = value ?? '';
  const safe = FORMULA_START.test(raw) ? `'${raw}` : raw;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function decimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

function integer(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function participantStatus(row: ParticipantResult): string {
  return resultStatus(row).label;
}

function submittedBy(row: ParticipantResult): string {
  if (row.status !== 'SUBMITTED') return '';
  switch (row.finalizationSource) {
    case 'STUDENT_SUBMIT': return 'Oleh siswa';
    case 'EXPIRY_CLIENT': return 'Otomatis saat waktu habis';
    case 'EXPIRY_SERVER': return 'Otomatis oleh server saat waktu habis, perangkat tidak terhubung';
    default: return '';
  }
}

export function buildResultsCsv(data: TeacherExamResultsResponse): string {
  const zone = zoneLabel();
  const header = [
    'Mata pelajaran', 'Kelas', 'Jenis penilaian', 'Status hasil', `Waktu finalisasi (${zone})`,
    'ELLIGBLE ID', 'Status peserta', 'Cara pengumpulan', `Waktu pengumpulan (${zone})`, 'Percobaan',
    'Benar', 'Salah', 'Tidak dijawab', 'Skor', 'Skor maksimum', 'Nilai (0-100)', 'Aturan penilaian',
  ];
  const final = data.resultState === 'FINAL';
  const exam = data.exam;
  const lines = [header.map(text).join(SEPARATOR)];
  for (const row of data.participants) {
    const score = row.score;
    lines.push([
      text(exam.subjectLabel),
      text(exam.groupLabel),
      text(exam.assessmentTypeLabel),
      text(final ? 'Final' : 'Sementara'),
      text(final && data.finalizedAt ? formatSheetDateTime(data.finalizedAt) : ''),
      text(row.elligbleId),
      text(participantStatus(row)),
      text(submittedBy(row)),
      text(row.submittedAt ? formatSheetDateTime(row.submittedAt) : ''),
      // Baseline results always come from the original attempt (D04.8-53 lineage later).
      text(row.status === 'SUBMITTED' || row.status === 'IN_PROGRESS' ? 'Asli' : ''),
      integer(score?.correct),
      integer(score?.incorrect),
      integer(score?.unanswered),
      decimal(score?.rawScore),
      decimal(score?.maxScore),
      decimal(score?.scaledScore),
      text(score ? data.scoring.rule : ''),
    ].join(SEPARATOR));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

function slug(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "hasil-ujian_matematika-wajib_x-1_2026-09-29_final.csv" */
export function resultsCsvFileName(data: TeacherExamResultsResponse): string {
  const parts = ['hasil-ujian', slug(data.exam.subjectLabel), slug(data.exam.groupLabel)];
  if (data.exam.windowStartsAt) parts.push(formatSheetDate(data.exam.windowStartsAt));
  parts.push(data.resultState === 'FINAL' ? 'final' : 'sementara');
  return `${parts.filter(Boolean).join('_')}.csv`;
}

/** Hands the file to the browser's download (nothing leaves the device otherwise). */
export function downloadTextFile(content: string, fileName: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
