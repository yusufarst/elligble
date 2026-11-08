import type { ImportProblem, LatestStartPolicy } from '../types/assessment.ts';

// Teacher-facing wording for the question import (UI_CONTENT_AND_COPY_STYLE: plain
// Indonesian, the line to fix first, what to do next). The server decides every problem;
// this only words it.

export const QUESTION_TEMPLATE_FILE_NAME = 'templat-soal-elligble.csv';

const ITEM_COLUMNS = [...Array.from({ length: 10 }, (_, i) => `left_${i + 1}`), ...'abcdefghijkl'.split('').map(l => `right_${l}`)];
const NO_ITEMS = ';'.repeat(ITEM_COLUMNS.length);

/**
 * The canonical elligble-questions-v2 columns (ASSESS-QUESTION-002, O02-12) with the matching item
 * columns left_1..left_10 and right_a..right_l appended (ASSESS-QUESTION-004 §4.2), and one example
 * row each of PG (pilihan ganda), PGK (pilihan ganda kompleks), BS (benar/salah) and MJ
 * (menjodohkan), separated by semicolons with a decimal comma, as spreadsheets set to Indonesian
 * open and save them; files separated by commas, ten-column v2 files and elligble-questions-v1
 * files without the type column are read as well.
 */
export const QUESTION_TEMPLATE_CSV = '\uFEFF' + [
  ['no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score', ...ITEM_COLUMNS].join(';'),
  '1;PG;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;1' + NO_ITEMS,
  '2;PGK;Bilangan prima di bawah 10 adalah;2;4;5;8;9;A,C;1,5' + NO_ITEMS,
  '3;BS;Matahari terbit dari arah timur;;;;;;B;1' + NO_ITEMS,
  '4;MJ;Pasangkan nama hewan dengan makanannya;;;;;;B,C,A;3;Sapi;Kucing;Kelinci' + ';'.repeat(7) + ';Wortel;Rumput;Ikan;Biji jagung' + ';'.repeat(8),
].join('\r\n') + '\r\n';

export const LATEST_START_OPTIONS: Array<{ value: LatestStartPolicy; label: string; description: string }> = [
  {
    value: 'FULL_DURATION_BEYOND_WINDOW',
    label: 'Durasi penuh',
    description: 'Peserta yang mulai terlambat tetap mendapat durasi penuh, walaupun melewati waktu selesai.',
  },
  {
    value: 'REMAINING_WINDOW_ONLY',
    label: 'Sampai waktu selesai',
    description: 'Peserta yang mulai terlambat hanya mendapat sisa waktu sampai waktu selesai.',
  },
  {
    value: 'LATE_START_BLOCKED',
    label: 'Tidak boleh terlambat',
    description: 'Peserta tidak dapat memulai jika durasi penuh tidak lagi cukup sebelum waktu selesai.',
  },
];

const letters = (list?: string[]) => {
  const items = list ?? [];
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
};

export function describeImportProblem(problem: ImportProblem, limits: { maxQuestionScore: number } = { maxQuestionScore: 1000 }): string {
  if (problem.source === 'file') {
    const at = problem.line === null ? '' : `Baris ${problem.line}: `;
    switch (problem.code) {
      case 'not_text': return 'Berkas ini bukan berkas CSV (mungkin berkas Excel). Simpan sebagai "CSV UTF-8", lalu unggah lagi.';
      case 'encoding_invalid': return `${at}berkas tidak tersimpan sebagai UTF-8. Simpan sebagai "CSV UTF-8", lalu unggah lagi.`;
      case 'csv_syntax': return `${at}tanda kutip ganda tidak berpasangan.`;
      case 'header_invalid': return `${at}judul kolom harus sama dengan templat ELLIGBLE (no;prompt;option_a sampai option_e;correct;score, atau no;type;prompt;option_a sampai option_e;correct;score, atau no;type;prompt;option_a sampai option_e;correct;score;left_1 sampai left_10;right_a sampai right_l). Unduh templat terbaru lalu salin soal Anda ke dalamnya.`;
      case 'file_empty': return 'Berkas tidak berisi soal.';
      case 'too_many_questions': return `Berkas berisi ${problem.found} soal; paling banyak ${problem.expected} soal dalam satu berkas.`;
      case 'column_count': return `${at}harus ada ${problem.expected ?? 9} kolom, ditemukan ${problem.found}.`;
      case 'number_out_of_order': return `${at}nomor soal harus ${problem.expected}. Soal diberi nomor 1, 2, 3 dan seterusnya secara berurutan.`;
      case 'prompt_empty': return `${at}teks soal kosong.`;
      case 'option_empty': return `${at}pilihan ${letters(problem.letters)} kosong. Setiap soal perlu lima pilihan, A sampai E.`;
      case 'options_duplicate': return `${at}pilihan ${letters(problem.letters)} sama. Setiap pilihan harus berbeda.`;
      case 'correct_multiple': return `${at}kunci jawaban harus satu huruf. Setiap soal hanya punya satu jawaban benar.`;
      case 'correct_invalid': return problem.type === 'BS' ? `${at}kunci jawaban BS harus B (Benar) atau S (Salah).`
        : problem.type === 'MJ' ? `${at}kunci jawaban MJ adalah huruf pasangan kanan untuk setiap pernyataan kiri secara berurutan, misalnya B,C,A.`
        : `${at}kunci jawaban harus salah satu huruf A, B, C, D, atau E.`;
      case 'score_invalid': return `${at}skor harus angka lebih dari 0 sampai ${limits.maxQuestionScore}, dengan paling banyak dua angka di belakang koma.`;
      case 'type_invalid': return `${at}tipe soal harus PG, PGK, BS atau MJ.`;
      case 'correct_duplicate': return problem.type === 'MJ' ? `${at}setiap pasangan kanan hanya boleh dipakai sekali dalam kunci jawaban MJ.` : `${at}huruf kunci jawaban tidak boleh berulang.`;
      case 'options_not_allowed': return problem.type === 'MJ'
        ? `${at}soal Menjodohkan (MJ) tidak memakai kolom pilihan; kosongkan option_a sampai option_e.`
        : `${at}soal Benar/Salah (BS) tidak memakai kolom pilihan; kosongkan option_a sampai option_e.`;
      case 'columns_missing': return `${at}soal Menjodohkan (MJ) memerlukan kolom left_1 sampai left_10 dan right_a sampai right_l. Unduh templat terbaru lalu salin soal Anda ke dalamnya.`;
      case 'matching_items_invalid': return problem.side === 'right'
        ? `${at}soal MJ memerlukan pasangan kanan sebanyak pernyataan kiri, ditambah paling banyak 2 pengecoh, diisi berurutan mulai right_a.`
        : `${at}soal MJ memerlukan 2 sampai 10 pernyataan kiri, diisi berurutan mulai left_1.`;
      case 'items_duplicate': return problem.side === 'right' ? `${at}pasangan kanan tidak boleh sama satu sama lain.` : `${at}pernyataan kiri tidak boleh sama satu sama lain.`;
      case 'items_not_allowed': return `${at}kolom left_1 sampai right_l hanya untuk soal MJ; kosongkan untuk soal PG, PGK atau BS.`;
    }
  }
  switch (problem.code) {
    case 'file_too_large': return 'Berkas soal terlalu besar. Bagi soal ke dalam beberapa ujian.';
    case 'time_zone_missing': return 'Zona waktu sekolah belum diatur, sehingga jadwal belum dapat ditentukan. Hubungi operator sekolah.';
    case 'window_invalid': return 'Tanggal atau jam pelaksanaan tidak valid.';
    case 'window_order': return 'Waktu selesai harus setelah waktu mulai.';
    case 'window_ended': return 'Waktu selesai sudah lewat. Pilih waktu yang akan datang.';
    case 'duration_invalid': return 'Durasi pengerjaan harus bilangan bulat dari 1 sampai 1440 menit.';
    case 'duration_exceeds_window': return 'Durasi pengerjaan lebih panjang dari waktu pelaksanaan, sehingga dengan aturan "Tidak boleh terlambat" tidak ada peserta yang dapat memulai. Pendekkan durasi, perpanjang waktu pelaksanaan, atau pilih aturan lain.';
    case 'assessment_type_unknown': return 'Jenis penilaian tidak ditemukan. Muat ulang halaman, lalu pilih lagi.';
    case 'participant_not_enrolled': return `${problem.count ?? 1} peserta yang dipilih tidak terdaftar di kelas ini pada hari ujian. Periksa daftar peserta.`;
    case 'no_participants': return 'Belum ada peserta. Pilih paling sedikit satu siswa yang terdaftar di kelas ini pada hari ujian.';
    case 'schedule_conflict': return `${problem.count ?? 1} peserta sudah dijadwalkan pada ujian lain yang waktunya bertabrakan (ditandai di daftar peserta). Ubah waktu pelaksanaan atau kecualikan peserta tersebut.`;
    case 'not_ready': return 'Ujian ini belum memenuhi syarat kesiapan. Hubungi operator sekolah.';
  }
}

/** "4,5" for 4.5: Indonesian decimal comma. */
export function formatScore(value: number): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
