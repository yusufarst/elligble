// Student-facing reasons the server refuses to start an exam (attempt start and timer
// start re-check the same eligibility with server time).
export const START_REFUSAL_COPY: Record<string, string> = {
  exam_not_active: 'Ujian belum dibuka oleh guru atau pengawas. Silakan tunggu.',
  exam_not_open: 'Ujian belum dibuka. Silakan tunggu sesuai waktu pelaksanaan.',
  exam_window_closed: 'Waktu pelaksanaan ujian telah berakhir.',
  late_start_blocked: 'Batas waktu untuk memulai ujian ini telah lewat. Hubungi pengawas ruangan.',
  exam_not_ready: 'Ujian belum siap dikerjakan. Hubungi guru atau pengawas.',
  attempt_already_submitted: 'Ujian ini sudah dikumpulkan.',
  not_participant: 'Anda tidak terdaftar sebagai peserta ujian ini. Hubungi pengawas ruangan.',
};
