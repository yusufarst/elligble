**Status:** LOCKED
**Version:** 1.0.0
**Canonical:** YES
**Depends On:** DEC-036, DEC-037, FRONTEND_DESIGN_SYSTEM.md
**Used By:** All frontend implementations, UI components, copy authoring
**Last Reviewed:** 2026-09-12

# ELLIGBLE — UI Content and Copy Style Guide

## 1. Purpose and Language Policy

- **School-Facing Language:** The primary language for all user-facing interfaces across Indonesian secondary schools (SMA, SMK, MA, MAK, and equivalent) is **Bahasa Indonesia**.
- **Tone:** Formal, clear, respectful, calm, and institutional. Avoid colloquial slang, patronizing phrasing, marketing jargon, and robotic AI-generated filler.
- **Internal Technical Naming:** Internal code, API routes, database fields, and architectural documentation maintain canonical English naming (e.g., `attempt_id`, `exam_instance_id`, `is_authoritative`).
- **Prohibition of Em Dash:** The em dash character "—" is strictly prohibited in user-facing UI copy. Use appropriate Indonesian punctuation such as colons, commas, parentheses, or regular hyphens instead. (Note: Internal canonical terminology such as `IN — CORE` remains intact).

## 2. Navigation Labels

- Student Portal: "Beranda", "Jadwal Ujian", "Hasil Belajar", "Profil Siswa", "Pengaturan Akun".
- Teacher / Proctor Portal: "Beranda", "Pelaksanaan Ujian", "Ruang Ujian", "Daftar Siswa", "Laporan Kehadiran".
- School Admin Portal: "Dasbor Sekolah", "Tahun Ajaran", "Mata Pelajaran", "Rombongan Belajar", "Manajemen Akun".

## 3. Page Titles and Headings

- Format: Sentence case or title case in proper Indonesian grammar.
- Examples:
  - "Pelaksanaan Ujian Aman"
  - "Konfirmasi Pengumpulan Ujian"
  - "Daftar Ruang dan Pengawas"
  - "Status Koneksi dan Sinkronisasi"

## 4. Button Labels

Action-oriented, unambiguous, and concise:
- Primary Actions: "Masuk", "Mulai Ujian", "Simpan dan Lanjutkan", "Selesaikan Ujian", "Kirim Jawaban".
- Secondary Actions: "Kembali", "Batal", "Soal Sebelumnya", "Tutup", "Muat Ulang".
- Destructive Actions: "Hapus", "Keluarkan Peserta", "Batalkan Sesi".

## 5. Field Labels and Helper Text

- Labels must be descriptive and directly above the input:
  - "Nomor Induk Siswa Nasional (NISN)"
  - "Kode Akses Ujian"
  - "Kata Sandi"
- Helper Text:
  - "Masukkan 10 digit NISN yang terdaftar resmi."
  - "Kode akses terdiri dari 6 karakter yang diberikan pengawas ruangan."

## 6. Validation and System Errors

Provide clear, constructive error copy explaining what happened and how to resolve it:
- Validation:
  - "NISN harus berupa 10 digit angka."
  - "Kata sandi wajib diisi."
  - "Pilih salah satu jawaban sebelum melanjutkan."
- System Errors:
  - "Gagal memuat data ujian. Periksa koneksi internet Anda dan coba lagi."
  - "Terjadi gangguan pada server. Silakan hubungi pengawas jika kendala berlanjut."

## 7. Empty and Loading States

- Empty State:
  - Heading: "Belum Ada Ujian Terjadwal"
  - Body: "Saat ini belum ada jadwal ujian yang aktif untuk kelas Anda."
- Loading State:
  - "Memuat soal ujian..."
  - "Menyiapkan lembar jawaban..."
  - "Memverifikasi sesi..."

## 8. Offline and Connectivity States

Calm, non-panicking guidance:
- Banner: "Koneksi internet terputus. Jawaban Anda tetap tersimpan aman di perangkat ini dan akan dikirimkan otomatis saat kembali terhubung."
- Offline Status Tag: "Tersimpan Lokal (Menunggu Koneksi)"

## 9. Success, Warning, and Confirmation Copy

- Success: "Jawaban berhasil disimpan." / "Ujian berhasil dikumpulkan."
- Warning: "Sisa waktu pengerjaan kurang dari 5 menit. Pastikan seluruh jawaban telah diperiksa."
- Confirmation: "Apakah Anda yakin ingin menyelesaikan ujian ini? Jawaban yang telah dikirim tidak dapat diubah kembali."

## 10. Secure Assessment Workstation Copy

### 10.1 Assessment Entry
- Title: "Ruang Ujian Aman"
- Guidance: "Pastikan Anda berada di ruang yang ditentukan dan telah memverifikasi kehadiran dengan pengawas sebelum memulai."
- Action: "Mulai Pengerjaan"

### 10.2 Question Navigation and Answer States
- Question Progress: "Soal 12 dari 40"
- Answer Saved: "Tersimpan"
- Answer Saving: "Menyimpan..."
- Answer Pending Sync: "Menunggu Sinkronisasi"
- Answer Retry: "Mencoba menyimpan kembali..."

### 10.3 Authoritative Timer Copy
- Active: "Sisa Waktu: 01:24:30"
- Warning (< 5 min): "Perhatian: Sisa waktu 04:59"
- Time Expired: "Waktu Ujian Telah Habis"
- Expired Subtitle: "Sistem sedang mengumpulkan seluruh jawaban Anda secara otomatis. Harap tunggu hingga proses selesai."

### 10.4 Submission Flow
- Submit Button: "Selesaikan Ujian"
- Modal Title: "Konfirmasi Pengumpulan Ujian"
- Summary Checklist:
  - "Total Soal: 40"
  - "Sudah Dijawab: 38"
  - "Belum Dijawab: 2"
- Confirmation Checkbox: "Saya menyatakan telah memeriksa seluruh jawaban dan siap mengumpulkan ujian ini."
- Final Submit Button: "Kirim Jawaban Sekarang"
- Submission Success Title: "Ujian Berhasil Dikumpulkan"
- Submission Success Body: "Jawaban Anda telah tersimpan resmi pada server sekolah. Anda dapat meninggalkan ruang ujian setelah diizinkan pengawas."
- Idempotent / Duplicate Notice: "Ujian ini telah dikumpulkan sebelumnya pada [Waktu]. Tidak ada perubahan yang dilakukan."

### 10.5 Session Reconnect / Replacement
- Reconnect Notice: "Sesi ujian Anda dilanjutkan. Seluruh jawaban sebelumnya telah dipulihkan."
- Superseded Session Notice: "Sesi ujian Anda telah dibuka di perangkat lain. Sesi pada perangkat ini dinonaktifkan."

## 11. Role-Specific Operational Wording

### 11.1 Pengawas (Proctor)
- "Status Ruang Ujian: Siap"
- "Jumlah Siswa Hadir: 32 dari 32"
- "Peringatan Jadwal: Tidak ditemukan bentrok jadwal pengawas atau peserta."
- "Verifikasi Kehadiran Peserta"

### 11.2 Guru (Teacher)
- "Status Kesiapan Ujian: Memenuhi Syarat"
- "Paket Soal Terkunci: Versi 1.0"
- "Pemantauan Pelaksanaan Ujian"

### 11.3 Orang Tua / Wali (Guardian)
- "Laporan Perkembangan Belajar Siswa"
- "Nilai Ujian dan Evaluasi Akademik"
- "Akses terbatas untuk informasi akademik resmi."

### 11.4 Mitra (Partner)
- "Daftar Peluang dan Program Magang"
- "Verifikasi Dokumen Kerjasama"

## 12. Accessibility and Formatting Standards

- Screen Reader Labels: Provide explicit `aria-label` where visual context is minimal (e.g. `aria-label="Pindah ke soal nomor 15, status sudah dijawab"`).
- Date and Time Formatting: Follow Indonesian locale standards (WIB/WITA/WIT):
  - Tanggal: "12 September 2026"
  - Waktu: "08.00 WIB"
  - Durasi: "90 menit"
- Numbers: Format using periods for thousands and commas for decimals in Indonesian locale (e.g., "1.000", "85,5").

## 13. Terminology Consistency Matrix

| Technical Term | Standard Indonesian UI Copy | Forbidden / Deprecated Terms |
| :--- | :--- | :--- |
| Exam Instance | Sesi Ujian / Pelaksanaan Ujian | Tes, Kuis, Quiz |
| Attempt | Pengerjaan Ujian | Percobaan, Trial |
| Submission | Pengumpulan Ujian | Submit, Kirim data mentah |
| Proctor | Pengawas Ujian | Mandor, Supervisor |
| Autosave | Penyimpanan Otomatis | Auto-save, Backup |
| Participant | Peserta Ujian | Pengguna, User |
| Readiness Preflight | Pemeriksaan Kesiapan Ujian | Check, Pre-test |
| Super Admin | Administrator Sekolah | Super Admin, Superuser |
