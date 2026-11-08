/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InstitutionExamView, institutionFailureMessages, institutionProblemText } from '../components/InstitutionExamView';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import { TeacherExamImportView } from '../components/TeacherExamImportView';
import { availableWorkspaces, WORKSPACE_LABELS } from '../session/AppShell';
import { SCREEN_TITLE } from '../lib/screen-titles';
import { preparationStatus, readinessBlockerMessage } from '../lib/status';
import { setDisplayTimeZone } from '../lib/format';
import {
  ApiError, getInstitutionExams, getInstitutionPeriod, getTeacherExamSetup, getTeacherReadiness, postInstitutionCancel, postInstitutionDeadline,
  postInstitutionPeriod, postInstitutionPlacement, postInstitutionSession, postInstitutionTransition, postTeacherExamContent,
  postTeacherExamContentPreview, postTeacherExamTransition,
} from '../api/assessment-client';
import type {
  InstitutionExamItem, InstitutionOverview, InstitutionPeriodDetail, TeacherExamContentPreview, TeacherExamReadinessProjection, TeacherExamSetup,
} from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return {
    ...actual,
    getInstitutionExams: vi.fn(), getInstitutionPeriod: vi.fn(), postInstitutionPeriod: vi.fn(), postInstitutionSession: vi.fn(),
    postInstitutionPlacement: vi.fn(), postInstitutionDeadline: vi.fn(), postInstitutionCancel: vi.fn(), postInstitutionTransition: vi.fn(),
    getTeacherReadiness: vi.fn(), getTeacherExamSetup: vi.fn(), postTeacherExamContentPreview: vi.fn(), postTeacherExamContent: vi.fn(),
    postTeacherExamTransition: vi.fn(),
  };
});

// ASSESS-INSTITUTION-001 C05: the "Ujian Sekolah" workspace of the School Operator (states, dialogs,
// focus return, problem copy), the subject Teacher's institution card with the organizer actions absent,
// and the preparation mode of the import screen; teacher-managed cards and the import screen unchanged.

const PERIOD = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a01';
const TYPE = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a02';
const ACADEMIC = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a03';
const TA = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a04';
const SESSION = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a05';
const EXAM = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a06';
const EXAM_READY = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a07';
const EXAM_CANCELLED = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a08';
const EXAM_BLOCKED = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a09';

const OVERVIEW: InstitutionOverview = {
  timeZone: 'Asia/Jakarta',
  limits: { maxDurationMinutes: 1440 },
  assessmentTypes: [{ assessmentTypeId: TYPE, label: 'Penilaian Tengah Semester' }],
  academicPeriods: [{ academicPeriodId: ACADEMIC, label: 'Semester Ganjil', startDate: '2026-07-01', endDate: '2026-12-31' }],
  teachingAssignments: [{ teachingAssignmentId: TA, subjectLabel: 'Matematika', groupLabel: 'X-1', academicPeriodId: ACADEMIC, teacherElligbleId: 'guru.mtk' }],
  periods: [{ periodId: PERIOD, label: 'PTS Ganjil', assessmentTypeLabel: 'Penilaian Tengah Semester', academicPeriodLabel: 'Semester Ganjil', sessionCount: 1, examCount: 2 }],
};

function item(overrides: Partial<InstitutionExamItem> = {}): InstitutionExamItem {
  return {
    examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', teacherElligbleId: 'guru.mtk', lifecycleState: 'SCHEDULED', cancelledAt: null,
    durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', participants: 32,
    preparation: { deadline: '2026-11-10T08:00:00.000Z', revision: 1, closed: false, questionCount: 0, preparedAt: null, sourceFileName: null },
    readiness: null,
    ...overrides,
  };
}

const PASS = { baseline: { status: 'baseline_readiness_checks_pass' as const }, roomProctor: { status: 'room_proctor_readiness_not_applicable' as const } };

function detail(exams: InstitutionExamItem[] = [item()]): InstitutionPeriodDetail {
  return {
    period: { periodId: PERIOD, label: 'PTS Ganjil', assessmentTypeLabel: 'Penilaian Tengah Semester', academicPeriodLabel: 'Semester Ganjil' },
    sessions: [{ sessionId: SESSION, startsAt: '2026-11-11T01:00:00.000Z', endsAt: '2026-11-11T03:00:00.000Z', exams }],
  };
}

async function openPeriod(exams?: InstitutionExamItem[]) {
  vi.mocked(getInstitutionExams).mockResolvedValue(OVERVIEW);
  vi.mocked(getInstitutionPeriod).mockResolvedValue(detail(exams));
  render(<InstitutionExamView />);
  fireEvent.click(await screen.findByRole('button', { name: 'Buka Periode' }));
  await screen.findByRole('heading', { level: 3, name: /^Jadwal Sesi: 11 November 2026, 08\.00 sampai 10\.00 WIB$/ });
}

describe('the workspace and the shared words', () => {
  it('a School Operator gets "Ujian Sekolah" right after "Data Siswa"', () => {
    const me = { tenantId: 'school', tenantDisplayLabel: 'School', capabilities: { examParticipant: false, teacher: true, proctor: false, schoolOperator: true } };
    expect(availableWorkspaces(me)).toEqual(['teacher', 'operator', 'institution']);
    expect(WORKSPACE_LABELS.institution).toBe('Ujian Sekolah');
    expect(SCREEN_TITLE.examPreparation).toBe('Siapkan Soal Ujian Sekolah');
  });

  it('preparationStatus words the preparation of an institution exam', () => {
    expect(preparationStatus({ closed: false, questionCount: 0 })).toEqual({ label: 'Belum ada soal', tone: 'warning' });
    expect(preparationStatus({ closed: false, questionCount: 12 })).toEqual({ label: 'Soal disiapkan: 12 soal', tone: 'info' });
    expect(preparationStatus({ closed: true, questionCount: 12 })).toEqual({ label: 'Penyiapan ditutup', tone: 'neutral' });
    expect(preparationStatus({ closed: true, questionCount: 0 })).toEqual({ label: 'Penyiapan ditutup', tone: 'neutral' });
    expect(readinessBlockerMessage(PASS)).toBeNull();
    expect(readinessBlockerMessage({ baseline: { status: 'not_ready', blocker: 'participant_schedule_conflict' }, roomProctor: { status: 'not_evaluated' } }))
      .toBe('Terdapat konflik jadwal peserta');
  });

  it('every problem and refusal has its frozen copy', () => {
    const p = (code: string, count?: number) => institutionProblemText({ code: code as never, count });
    expect(p('label_invalid')).toBe('Nama periode wajib diisi, paling banyak 120 karakter.');
    expect(p('label_taken')).toBe('Nama periode ini sudah dipakai untuk periode akademik yang sama.');
    for (const code of ['assessment_type_unknown', 'academic_period_unknown', 'teaching_assignment_unknown']) expect(p(code)).toBe('Data pilihan sudah berubah. Muat ulang halaman, lalu pilih lagi.');
    expect(p('academic_period_ended')).toBe('Periode akademik ini sudah berakhir.');
    for (const code of ['date_invalid', 'time_invalid', 'deadline_invalid']) expect(p(code)).toBe('Tanggal atau jam tidak valid.');
    expect(p('window_order')).toBe('Jam selesai harus setelah jam mulai.');
    expect(p('window_ended')).toBe('Waktu sesi sudah lewat.');
    expect(p('date_outside_period')).toBe('Tanggal sesi harus berada di dalam periode akademik periode ujian ini.');
    expect(p('session_taken')).toBe('Sesi dengan waktu yang sama sudah ada di periode ini.');
    expect(p('time_zone_missing')).toBe('Zona waktu sekolah belum diatur. Hubungi administrator platform.');
    expect(p('teaching_assignment_other_period')).toBe('Mata pelajaran ini bukan dari periode akademik periode ujian ini.');
    expect(p('already_placed')).toBe('Mata pelajaran dan rombel ini sudah ditempatkan di periode ini.');
    expect(p('session_started')).toBe('Sesi sudah dimulai, jadi ujian tidak dapat ditempatkan.');
    expect(p('duration_invalid')).toBe('Durasi harus 1 sampai 1.440 menit.');
    expect(p('duration_exceeds_window')).toBe('Durasi tidak muat di waktu sesi dengan aturan mulai terlambat ini.');
    expect(p('deadline_passed')).toBe('Tenggat harus di masa mendatang.');
    expect(p('deadline_not_before_session')).toBe('Tenggat harus sebelum sesi dimulai.');
    expect(p('deadline_not_later')).toBe('Tenggat baru harus setelah tenggat saat ini.');
    expect(p('no_participants')).toBe('Tidak ada siswa yang terdaftar di rombel ini pada tanggal sesi.');
    expect(p('schedule_conflict', 1250)).toBe('1.250 siswa sudah dijadwalkan di ujian lain pada waktu yang sama.');
    const refusal = (status: number, code: string, data?: unknown) => institutionFailureMessages(new ApiError(status, code, undefined, data));
    expect(refusal(409, 'stale_deadline')).toEqual(['Tenggat baru saja diubah. Muat ulang untuk melihat tenggat terbaru.']);
    expect(refusal(409, 'preparation_open')).toEqual(['Tenggat penyiapan soal belum lewat. Ujian dapat ditandai siap setelah tenggat.']);
    expect(refusal(409, 'not_ready', { readiness: { baseline: { status: 'not_ready', blocker: 'participant_schedule_conflict' }, roomProctor: { status: 'not_evaluated' } } }))
      .toEqual(['Ujian belum dapat ditandai siap: Terdapat konflik jadwal peserta.']);
    expect(refusal(409, 'invalid_state')).toEqual(['Status ujian sudah berubah. Muat ulang halaman.']);
    expect(refusal(400, 'invalid_request')).toEqual(['Isian belum lengkap atau tidak valid. Periksa lagi.']);
    expect(refusal(409, 'action_key_reused')).toEqual(['Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.']);
    expect(refusal(409, 'state_changed')).toEqual(['Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.']);
    expect(refusal(403, 'forbidden')).toEqual(['Anda tidak berwenang mengatur ujian sekolah ini.']);
    const connection = ['Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda.'];
    expect(refusal(503, 'persistence_unavailable')).toEqual(connection);
    expect(institutionFailureMessages(new TypeError('Failed to fetch'))).toEqual(connection);
    expect(refusal(422, 'composition_invalid', { problems: [{ code: 'date_invalid' }, { code: 'time_invalid' }, { code: 'window_ended' }] }))
      .toEqual(['Tanggal atau jam tidak valid.', 'Waktu sesi sudah lewat.']);
  });

  it('no em dash in the copy of the new and changed screens', () => {
    const sources = import.meta.glob(['../components/InstitutionExamView.tsx', '../components/TeacherExamImportView.tsx', '../components/TeacherReadinessView.tsx', '../lib/status.ts'],
      { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(sources)).toHaveLength(4);
    for (const [path, text] of Object.entries(sources)) expect(text.includes('—'), path).toBe(false);
  });
});

describe('InstitutionExamView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  it('loading, then the empty state, with the header that says what the screen does', async () => {
    vi.mocked(getInstitutionExams).mockResolvedValue({ ...OVERVIEW, periods: [] });
    render(<InstitutionExamView />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Memuat ujian sekolah...');
    expect(await screen.findByRole('heading', { name: 'Belum ada periode ujian.' })).toBeTruthy();
    expect(screen.getByText(/Isi soal dan kunci jawaban tidak ditampilkan di sini\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buat Periode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Muat Ulang' })).toBeTruthy();
  });

  it('a refusal says who may use it and offers nothing; a failure offers "Coba Lagi"', async () => {
    vi.mocked(getInstitutionExams).mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    const { unmount } = render(<InstitutionExamView />);
    expect(await screen.findByText('Akses Ditolak')).toBeTruthy();
    expect(screen.getByText('Anda tidak berwenang mengatur ujian sekolah ini.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Buat Periode' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Coba Lagi' })).toBeNull();
    unmount();
    vi.mocked(getInstitutionExams).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ ...OVERVIEW, periods: [] });
    render(<InstitutionExamView />);
    expect(await screen.findByText('Gagal Memuat Ujian Sekolah')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(await screen.findByRole('heading', { name: 'Belum ada periode ujian.' })).toBeTruthy();
  });

  it('an open period lists its sessions and exams with operational facts only', async () => {
    await openPeriod([
      item({ preparation: { deadline: '2026-11-10T08:00:00.000Z', revision: 2, closed: false, questionCount: 25, preparedAt: '2026-11-09T03:00:00.000Z', sourceFileName: 'mtk.csv' } }),
      item({ examInstanceId: EXAM_BLOCKED, subjectLabel: 'Fisika', preparation: { deadline: '2026-11-09T01:00:00.000Z', revision: 1, closed: true, questionCount: 0, preparedAt: null, sourceFileName: null },
        readiness: { baseline: { status: 'not_ready', category: 'question_snapshot_presence', blocker: 'question_snapshot_empty' }, roomProctor: { status: 'room_proctor_readiness_not_applicable' } } }),
      item({ examInstanceId: EXAM_READY, subjectLabel: 'Biologi', lifecycleState: 'READY', preparation: { deadline: '2026-11-09T01:00:00.000Z', revision: 1, closed: true, questionCount: 10, preparedAt: null, sourceFileName: null } }),
      item({ examInstanceId: EXAM_CANCELLED, subjectLabel: 'Kimia', lifecycleState: 'ARCHIVED', cancelledAt: '2026-11-09T02:00:00.000Z' }),
    ]);
    const scheduled = screen.getByTestId(`institution-exam-${EXAM}`);
    expect(within(scheduled).getByRole('heading', { name: 'Matematika' })).toBeTruthy();
    expect(within(scheduled).getByText('X-1 · Guru guru.mtk')).toBeTruthy();
    expect(within(scheduled).getByText('32 peserta · 90 menit')).toBeTruthy();
    expect(within(scheduled).getByText('Tenggat penyiapan soal: 10 November 2026 pukul 15.00 WIB (diperpanjang)')).toBeTruthy();
    expect(within(scheduled).getByText('Terjadwal')).toBeTruthy();
    expect(within(scheduled).getByText('Soal disiapkan: 25 soal')).toBeTruthy();
    expect((within(scheduled).getByRole('button', { name: 'Tandai Siap' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(scheduled).getByRole('button', { name: 'Perpanjang Tenggat' })).toBeTruthy();
    expect(within(scheduled).getByRole('button', { name: 'Batalkan Ujian' })).toBeTruthy();
    const blocked = screen.getByTestId(`institution-exam-${EXAM_BLOCKED}`);
    expect(within(blocked).getByText('Soal ujian belum ditambahkan')).toBeTruthy();
    expect(within(blocked).getByText('Penyiapan ditutup')).toBeTruthy();
    expect((within(blocked).getByRole('button', { name: 'Tandai Siap' }) as HTMLButtonElement).disabled).toBe(true);
    const ready = screen.getByTestId(`institution-exam-${EXAM_READY}`);
    expect(within(ready).getByText('Siap Dibuka')).toBeTruthy();
    expect(within(ready).queryByRole('button', { name: 'Tandai Siap' })).toBeNull();
    expect(within(ready).queryByRole('button', { name: 'Perpanjang Tenggat' })).toBeNull();
    expect(within(ready).getByRole('button', { name: 'Batalkan Ujian' })).toBeTruthy();
    const cancelled = screen.getByTestId(`institution-exam-${EXAM_CANCELLED}`);
    expect(within(cancelled).getByText('Dibatalkan')).toBeTruthy();
    expect(within(cancelled).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/mtk\.csv/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Tambah Sesi' })).toBeTruthy();
  });

  it('"Buat Periode Ujian" sends nothing before "Simpan Periode", keeps its key on a retry, shows the problem copy and returns focus', async () => {
    vi.mocked(getInstitutionExams).mockResolvedValue({ ...OVERVIEW, periods: [] });
    vi.mocked(postInstitutionPeriod)
      .mockRejectedValueOnce(new ApiError(422, 'composition_invalid', undefined, { error: 'composition_invalid', problems: [{ code: 'label_taken' }] }))
      .mockResolvedValueOnce({ periodId: PERIOD, replayed: false });
    vi.mocked(getInstitutionPeriod).mockResolvedValue({ ...detail([]), sessions: [] });
    render(<InstitutionExamView />);
    await screen.findByRole('heading', { name: 'Belum ada periode ujian.' });
    const trigger = screen.getByRole('button', { name: 'Buat Periode' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Buat Periode Ujian' });
    const save = within(dialog).getByRole('button', { name: 'Simpan Periode' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Nama periode'), { target: { value: 'PTS Ganjil' } });
    fireEvent.change(within(dialog).getByLabelText('Jenis penilaian'), { target: { value: TYPE } });
    expect((within(dialog).getByLabelText('Periode Akademik') as HTMLSelectElement).value).toBe(ACADEMIC);
    expect(postInstitutionPeriod).not.toHaveBeenCalled();
    fireEvent.click(save);
    expect(await within(dialog).findByText('Nama periode ini sudah dipakai untuk periode akademik yang sama.')).toBeTruthy();
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [first, second] = vi.mocked(postInstitutionPeriod).mock.calls.map(c => c[0]);
    expect(first).toMatchObject({ label: 'PTS Ganjil', assessmentTypeId: TYPE, academicPeriodId: ACADEMIC });
    expect(second.actionKey).toBe(first.actionKey);
    expect(await screen.findByText('Periode ujian tersimpan.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Buat Periode' })));
  });

  it('"Tambah Sesi" and "Tempatkan Ujian di Sesi" send the school-zone values and the options of the subject Teacher', async () => {
    await openPeriod([]);
    vi.mocked(postInstitutionSession).mockResolvedValue({ sessionId: SESSION, startsAt: '', endsAt: '', replayed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Tambah Sesi' }));
    const sessionDialog = await screen.findByRole('dialog', { name: 'Tambah Sesi' });
    fireEvent.change(within(sessionDialog).getByLabelText('Tanggal'), { target: { value: '2026-11-12' } });
    fireEvent.change(within(sessionDialog).getByLabelText('Jam mulai'), { target: { value: '08:00' } });
    fireEvent.change(within(sessionDialog).getByLabelText('Jam selesai'), { target: { value: '10:00' } });
    fireEvent.click(within(sessionDialog).getByRole('button', { name: 'Simpan Sesi' }));
    await waitFor(() => expect(postInstitutionSession).toHaveBeenCalledWith(expect.objectContaining({ periodId: PERIOD, date: '2026-11-12', startTime: '08:00', endTime: '10:00' })));
    expect(await screen.findByText('Sesi tersimpan.')).toBeTruthy();

    vi.mocked(postInstitutionPlacement)
      .mockRejectedValueOnce(new ApiError(422, 'composition_invalid', undefined, { problems: [{ code: 'schedule_conflict', count: 3 }, { code: 'deadline_not_before_session' }] }))
      .mockResolvedValueOnce({ examInstanceId: EXAM, participants: 32, preparationDeadline: '2026-11-10T08:00:00.000Z', replayed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Tempatkan Ujian' }));
    const placement = await screen.findByRole('dialog', { name: 'Tempatkan Ujian di Sesi' });
    const subject = within(placement).getByLabelText('Mata pelajaran dan rombel') as HTMLSelectElement;
    expect([...subject.options].map(o => o.textContent)).toEqual(['Pilih mata pelajaran dan rombel', 'Matematika · X-1 · guru.mtk']);
    fireEvent.change(subject, { target: { value: TA } });
    fireEvent.change(within(placement).getByLabelText('Durasi pengerjaan (menit)'), { target: { value: '90' } });
    fireEvent.click(within(placement).getByRole('radio', { name: /Durasi penuh/ }));
    fireEvent.change(within(placement).getByLabelText('Tenggat penyiapan soal'), { target: { value: '2026-11-10T15:00' } });
    fireEvent.click(within(placement).getByRole('button', { name: 'Tempatkan Ujian' }));
    expect(await within(placement).findByText('3 siswa sudah dijadwalkan di ujian lain pada waktu yang sama.')).toBeTruthy();
    expect(within(placement).getByText('Tenggat harus sebelum sesi dimulai.')).toBeTruthy();
    fireEvent.click(within(placement).getByRole('button', { name: 'Tempatkan Ujian' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const calls = vi.mocked(postInstitutionPlacement).mock.calls.map(c => c[0]);
    expect(calls[0]).toMatchObject({ sessionId: SESSION, teachingAssignmentId: TA, durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', preparationDeadline: '2026-11-10T15:00' });
    expect(calls[1].actionKey).toBe(calls[0].actionKey);
    expect(await screen.findByText(/Matematika · X-1 ditempatkan dengan 32 peserta\./)).toBeTruthy();
  });

  it('"Tandai Siap?" confirms without a reason; a refusal is worded; focus returns to the action', async () => {
    await openPeriod([item({ preparation: { deadline: '2026-11-09T01:00:00.000Z', revision: 1, closed: true, questionCount: 5, preparedAt: null, sourceFileName: null }, readiness: PASS })]);
    vi.mocked(postInstitutionTransition)
      .mockRejectedValueOnce(new ApiError(409, 'not_ready', undefined, { readiness: { baseline: { status: 'not_ready', blocker: 'participant_schedule_conflict' }, roomProctor: { status: 'not_evaluated' } } }))
      .mockResolvedValueOnce({ examInstanceId: EXAM, lifecycleState: 'READY' });
    const action = screen.getByRole('button', { name: 'Tandai Siap' }) as HTMLButtonElement;
    expect(action.disabled).toBe(false);
    fireEvent.click(action);
    const dialog = await screen.findByRole('dialog', { name: 'Tandai Siap?' });
    expect(within(dialog).getByText('Ujian Matematika · X-1 akan ditandai siap. Soal tidak dapat diubah lagi, dan tenggat tidak dapat diperpanjang. Membuka ujian dilakukan pada langkah tersendiri.')).toBeTruthy();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tandai Siap' }));
    expect(await within(dialog).findByText('Ujian belum dapat ditandai siap: Terdapat konflik jadwal peserta.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tandai Siap' })));
    fireEvent.click(screen.getByRole('button', { name: 'Tandai Siap' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Tandai Siap?' })).getByRole('button', { name: 'Tandai Siap' }));
    expect(await screen.findByText('Matematika · X-1 ditandai siap.')).toBeTruthy();
    expect(postInstitutionTransition).toHaveBeenLastCalledWith(EXAM);
  });

  it('"Perpanjang Tenggat Penyiapan Soal" needs a new deadline and a reason, sends the expected revision and words a stale one', async () => {
    await openPeriod([item({ preparation: { deadline: '2026-11-10T08:00:00.000Z', revision: 2, closed: false, questionCount: 0, preparedAt: null, sourceFileName: null } })]);
    vi.mocked(postInstitutionDeadline).mockRejectedValueOnce(new ApiError(409, 'stale_deadline', undefined, { current: { revision: 3 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Perpanjang Tenggat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Perpanjang Tenggat Penyiapan Soal' });
    const extend = within(dialog).getByRole('button', { name: 'Perpanjang' }) as HTMLButtonElement;
    fireEvent.change(within(dialog).getByLabelText('Tenggat baru'), { target: { value: '2026-11-10T18:00' } });
    expect(extend.disabled).toBe(true);
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }), { target: { value: 'Guru sakit' } });
    expect(extend.disabled).toBe(false);
    fireEvent.click(extend);
    expect(await within(dialog).findByText('Tenggat baru saja diubah. Muat ulang untuk melihat tenggat terbaru.')).toBeTruthy();
    expect(postInstitutionDeadline).toHaveBeenCalledWith(expect.objectContaining({ examInstanceId: EXAM, preparationDeadline: '2026-11-10T18:00', expectedRevision: 2, reason: 'Guru sakit' }));
  });

  it('"Batalkan Ujian Sekolah?" says the Teacher sees the reason, needs one, and a lost connection is worded', async () => {
    await openPeriod();
    vi.mocked(postInstitutionCancel).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ examInstanceId: EXAM, cancelledAt: '', changed: true, replayed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Batalkan Ujian' }));
    const dialog = await screen.findByRole('dialog', { name: 'Batalkan Ujian Sekolah?' });
    expect(within(dialog).getByText('Ujian diarsipkan dan tidak dihapus. Guru mata pelajaran melihat pembatalan ini beserta alasannya.')).toBeTruthy();
    const confirm = within(dialog).getByRole('button', { name: 'Batalkan Ujian' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }), { target: { value: 'Salah tempat' } });
    fireEvent.click(confirm);
    expect(await within(dialog).findByText('Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda.')).toBeTruthy();
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [a, b] = vi.mocked(postInstitutionCancel).mock.calls.map(c => c[0]);
    expect(b.actionKey).toBe(a.actionKey);
    expect(a).toMatchObject({ examInstanceId: EXAM, reason: 'Salah tempat' });
    expect(await screen.findByText('Matematika · X-1 dibatalkan dan diarsipkan.')).toBeTruthy();
  });
});

function card(overrides: Partial<TeacherExamReadinessProjection> = {}): TeacherExamReadinessProjection {
  return {
    examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', assessmentTypeLabel: 'Penilaian Tengah Semester', lifecycleState: 'SCHEDULED',
    windowStartsAt: '2026-11-11T01:00:00.000Z', windowEndsAt: '2026-11-11T03:00:00.000Z', durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
    participants: 32, cancellation: null, baseline: { status: 'not_ready', category: 'question_snapshot_presence', blocker: 'question_snapshot_empty' },
    roomProctor: { status: 'room_proctor_readiness_not_applicable' }, progress: null,
    institution: { periodLabel: 'PTS Ganjil', preparationDeadline: '2026-11-10T08:00:00.000Z', deadlineExtended: false, preparationClosed: false, questionCount: 0 },
    ...overrides,
  };
}

describe('the subject Teacher institution card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  const show = async (exam: TeacherExamReadinessProjection, handlers: { onPrepareExam?: (id: string) => void; onOpenPreview?: (id: string) => void } = {}) => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [exam] });
    render(<TeacherReadinessView onPrepareExam={handlers.onPrepareExam ?? (() => {})} onOpenPreview={handlers.onOpenPreview ?? (() => {})} onCreateExam={() => {}} />);
    return screen.findByTestId(`teacher-exam-${exam.examInstanceId}`);
  };
  const ORGANIZER = ['Ubah Jadwal', 'Tambah Peserta', 'Tandai Siap', 'Buka Ujian', 'Batalkan Ujian', 'Jeda Ujian', 'Akhiri Ujian', 'Lanjutkan Ujian'];

  it('open preparation: the facts, "Siapkan Soal", and no organizer action', async () => {
    const prepare = vi.fn();
    const el = await show(card(), { onPrepareExam: prepare });
    expect(within(el).getByText('Ujian sekolah · PTS Ganjil')).toBeTruthy();
    expect(within(el).getByText('Tenggat penyiapan soal 10 November 2026 pukul 15.00 WIB.')).toBeTruthy();
    expect(within(el).getByText('Belum ada soal.')).toBeTruthy();
    expect(within(el).getByText('Jadwal, peserta, dan pelaksanaan ujian ini diatur operator sekolah.')).toBeTruthy();
    for (const name of ORGANIZER) expect(within(el).queryByRole('button', { name })).toBeNull();
    expect(within(el).queryByRole('button', { name: 'Pratinjau Soal' })).toBeNull();
    fireEvent.click(within(el).getByRole('button', { name: 'Siapkan Soal' }));
    expect(prepare).toHaveBeenCalledWith(EXAM);
  });

  it('closed preparation and READY: no "Siapkan Soal"; the preview stays when questions exist', async () => {
    const closedInstitution = { periodLabel: 'PTS Ganjil', preparationDeadline: '2026-11-10T08:00:00.000Z', deadlineExtended: true, preparationClosed: true, questionCount: 25 };
    let el = await show(card({ institution: closedInstitution }));
    expect(within(el).getByText('Penyiapan soal ditutup 10 November 2026 pukul 15.00 WIB.')).toBeTruthy();
    expect(within(el).getByText('25 soal disiapkan.')).toBeTruthy();
    expect(within(el).queryByRole('button', { name: 'Siapkan Soal' })).toBeNull();
    expect(within(el).getByRole('button', { name: 'Pratinjau Soal' })).toBeTruthy();
    document.body.innerHTML = '';
    el = await show(card({ lifecycleState: 'READY', institution: closedInstitution, baseline: { status: 'baseline_readiness_checks_pass' } }));
    expect(within(el).getByText('Siap Dibuka')).toBeTruthy();
    for (const name of [...ORGANIZER, 'Siapkan Soal']) expect(within(el).queryByRole('button', { name })).toBeNull();
    expect(within(el).getByRole('button', { name: 'Pratinjau Soal' })).toBeTruthy();
  });

  it('an opened institution exam has no pause, resume or end; a cancelled one is listed with the Operator', async () => {
    let el = await show(card({ lifecycleState: 'ACTIVE', progress: { participants: 32, started: 3, submitted: 0, running: 3 },
      institution: { periodLabel: 'PTS Ganjil', preparationDeadline: '2026-11-10T08:00:00.000Z', deadlineExtended: false, preparationClosed: true, questionCount: 25 } }));
    expect(within(el).queryByRole('button', { name: 'Jeda Ujian' })).toBeNull();
    expect(within(el).queryByRole('button', { name: 'Akhiri Ujian' })).toBeNull();
    document.body.innerHTML = '';
    el = await show(card({ lifecycleState: 'ARCHIVED', cancellation: { cancelledAt: '2026-11-09T02:00:00.000Z', reason: 'Salah tempat', by: { you: false, elligbleId: 'operator.sekolah' } } }));
    expect(screen.getByRole('heading', { name: 'Ujian Dibatalkan' })).toBeTruthy();
    expect(within(el).getByText(/oleh operator\.sekolah\. Alasan: Salah tempat/)).toBeTruthy();
  });

  it('a teacher-managed card is unchanged, and the institution refusal is worded', async () => {
    vi.mocked(postTeacherExamTransition).mockRejectedValue(new ApiError(409, 'institution_managed'));
    const el = await show(card({ institution: null, baseline: { status: 'baseline_readiness_checks_pass' } }));
    for (const name of ['Ubah Jadwal', 'Tambah Peserta', 'Tandai Siap', 'Batalkan Ujian', 'Pratinjau Soal']) expect(within(el).getByRole('button', { name })).toBeTruthy();
    expect(within(el).queryByRole('button', { name: 'Siapkan Soal' })).toBeNull();
    expect(within(el).queryByText(/Ujian sekolah/)).toBeNull();
    fireEvent.click(within(el).getByRole('button', { name: 'Tandai Siap' }));
    expect(await within(el).findByText('Ujian ini diatur operator sekolah, jadi tindakan ini dilakukan oleh operator.')).toBeTruthy();
  });
});

const SETUP: TeacherExamSetup = {
  timeZone: 'Asia/Jakarta',
  teachingAssignments: [{ teachingAssignmentId: TA, subjectLabel: 'Matematika', groupLabel: 'X-1', periodLabel: 'Semester Ganjil' }],
  assessmentTypes: [],
  limits: { maxQuestions: 200, maxQuestionScore: 1000, maxFileCharacters: 524288, maxDurationMinutes: 1440 },
};
const CSV = 'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score\n1;Ibu kota Indonesia adalah;Bandung;Jakarta;Surabaya;Medan;Makassar;B;2\n';

function contentPreview(overrides: Partial<TeacherExamContentPreview> = {}): TeacherExamContentPreview {
  return {
    sourceSha256: 'b'.repeat(64), problems: [],
    questions: [{ line: 2, no: 1, prompt: 'Ibu kota Indonesia adalah', options: ['Bandung', 'Jakarta', 'Surabaya', 'Medan', 'Makassar'], correct: 'B', score: 2, type: 'PG', correctLetters: ['B'] }],
    participants: [], window: { startsAt: '2026-11-11T01:00:00.000Z', endsAt: '2026-11-11T03:00:00.000Z' }, totals: { questions: 1, maxScore: 2, participants: 32 }, replaces: 0,
    ...overrides,
  };
}

describe('TeacherExamImportView in preparation mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
    vi.mocked(getTeacherExamSetup).mockResolvedValue(SETUP);
  });
  afterEach(() => setDisplayTimeZone(null));

  const choose = async () => {
    const file = new File([CSV], 'ulangan.csv', { type: 'text/csv' });
    fireEvent.change(await screen.findByLabelText('Berkas CSV'), { target: { files: [file] } });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Periksa Soal' }) as HTMLButtonElement).disabled).toBe(false));
  };

  it('the empty screen: the read-only summary of the Operator, the file field, nothing to schedule', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [card()] });
    render(<TeacherExamImportView preparation={{ examInstanceId: EXAM }} onBack={() => {}} onScheduled={() => {}} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Siapkan Soal Ujian Sekolah' })).toBeTruthy();
    expect(screen.getByText('Unggah berkas soal untuk ujian sekolah ini sebelum tenggat. Jadwal, durasi, dan peserta diatur operator sekolah.')).toBeTruthy();
    const summary = screen.getByLabelText('Ujian sekolah');
    expect(within(summary).getByText('X-1')).toBeTruthy();
    expect(within(summary).getByText('90 menit')).toBeTruthy();
    expect(within(summary).getByText('Durasi penuh')).toBeTruthy();
    expect(within(summary).getByText('32')).toBeTruthy();
    expect(within(summary).getByText('11 November 2026, 08.00 sampai 10.00 WIB')).toBeTruthy();
    expect(within(summary).getByText('10 November 2026 pukul 15.00 WIB')).toBeTruthy();
    expect(screen.queryByLabelText('Jenis penilaian')).toBeNull();
    expect(screen.queryByLabelText(/^Mulai/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jadwalkan Ujian' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Periksa Soal' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('checks the file, warns that it replaces the stored questions, and saves with one key', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [card({ institution: { periodLabel: 'PTS Ganjil', preparationDeadline: '2026-11-10T08:00:00.000Z', deadlineExtended: false, preparationClosed: false, questionCount: 3 } })] });
    vi.mocked(postTeacherExamContentPreview).mockResolvedValue(contentPreview({ replaces: 3 }));
    vi.mocked(postTeacherExamContent).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ examInstanceId: EXAM, questionCount: 1, replayed: false });
    const saved = vi.fn();
    render(<TeacherExamImportView preparation={{ examInstanceId: EXAM }} onBack={() => {}} onScheduled={saved} />);
    await choose();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal' }));
    expect(await screen.findByText('Soal siap disimpan')).toBeTruthy();
    expect(postTeacherExamContentPreview).toHaveBeenCalledWith({ examInstanceId: EXAM, questionsCsv: CSV, sourceFileName: 'ulangan.csv' });
    expect(screen.getByText('Kunci jawaban')).toBeTruthy();
    expect(screen.queryByRole('region', { name: /^Peserta \(/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Soal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Simpan Soal Ujian Sekolah?' });
    expect(within(dialog).getByText('Soal yang sudah tersimpan (3 soal) akan diganti seluruhnya oleh berkas ini.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Soal' }));
    expect(await within(dialog).findByText(/Soal belum tersimpan karena koneksi terputus\./)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Coba Lagi' }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith('Soal ujian sekolah tersimpan: 1 soal.'));
    const [a, b] = vi.mocked(postTeacherExamContent).mock.calls;
    expect(b[1].importKey).toBe(a[1].importKey);
    expect(a[1].expectedSha256).toBe('b'.repeat(64));
  });

  it('a file with problems shows the problems; a deadline that passed meanwhile shows "preparation_closed"', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [card()] });
    vi.mocked(postTeacherExamContentPreview)
      .mockRejectedValueOnce(new ApiError(422, 'import_invalid', undefined, contentPreview({ problems: [{ source: 'file', code: 'prompt_empty', line: 2 }] })))
      .mockRejectedValueOnce(new ApiError(409, 'preparation_closed', undefined, { preparationDeadline: '2026-11-10T08:00:00.000Z' }));
    render(<TeacherExamImportView preparation={{ examInstanceId: EXAM }} onBack={() => {}} onScheduled={() => {}} />);
    await choose();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal' }));
    expect(await screen.findByText('Perbaiki 1 hal berikut, lalu periksa lagi')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Simpan Soal' })).toBeNull();
    await choose();
    fireEvent.click(screen.getByRole('button', { name: 'Periksa Soal' }));
    expect(await screen.findByText('Tenggat penyiapan soal sudah lewat, jadi soal tidak dapat diubah. Hubungi operator sekolah bila perlu perpanjangan.')).toBeTruthy();
    expect(screen.queryByLabelText('Berkas CSV')).toBeNull();
  });

  it('a closed exam opens closed, and a teacher-managed exam is not an institution exam', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValueOnce({ exams: [card({ institution: { periodLabel: 'PTS Ganjil', preparationDeadline: '2026-11-08T08:00:00.000Z', deadlineExtended: false, preparationClosed: true, questionCount: 0 } })] });
    const { unmount } = render(<TeacherExamImportView preparation={{ examInstanceId: EXAM }} onBack={() => {}} onScheduled={() => {}} />);
    expect(await screen.findByText('Tenggat penyiapan soal sudah lewat, jadi soal tidak dapat diubah. Hubungi operator sekolah bila perlu perpanjangan.')).toBeTruthy();
    expect(screen.queryByLabelText('Berkas CSV')).toBeNull();
    unmount();
    vi.mocked(getTeacherReadiness).mockResolvedValueOnce({ exams: [card({ institution: null })] });
    render(<TeacherExamImportView preparation={{ examInstanceId: EXAM }} onBack={() => {}} onScheduled={() => {}} />);
    expect(await screen.findByText('Ujian ini bukan ujian sekolah.')).toBeTruthy();
  });

  it('without the prop the import screen is the scheduling screen, as before', async () => {
    render(<TeacherExamImportView onBack={() => {}} onScheduled={() => {}} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Buat Ujian dari Berkas Soal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Periksa Soal dan Jadwal' })).toBeTruthy();
    expect(getTeacherReadiness).not.toHaveBeenCalled();
  });
});
