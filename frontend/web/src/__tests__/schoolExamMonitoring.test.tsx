/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InstitutionExamView } from '../components/InstitutionExamView';
import { OPERATOR_SOURCE, SchoolExamMonitoringView } from '../components/SchoolExamMonitoringView';
import { ExamMonitoringView } from '../components/ExamMonitoringView';
import { AddTimeDialog } from '../components/ParticipantTime';
import { TeacherReadinessView } from '../components/TeacherReadinessView';
import { setDisplayTimeZone } from '../lib/format';
import {
  ApiError, getExamMonitoring, getInstitutionExams, getInstitutionPeriod, getInstitutionSupervision, getInstitutionSupervisionExam,
  getTeacherReadiness, postBroadcast, postInstitutionSupervisionBroadcast, postInstitutionSupervisionLock, postInstitutionSupervisionTime,
  postInstitutionSupervisionTransition,
} from '../api/assessment-client';
import type {
  ExamMonitoringResponse, InstitutionExamItem, InstitutionOverview, InstitutionPeriodDetail, InstitutionSupervision, MonitoredParticipant,
  SupervisedExam, TeacherExamReadinessProjection,
} from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return {
    ...actual,
    getInstitutionExams: vi.fn(), getInstitutionPeriod: vi.fn(), getInstitutionSupervision: vi.fn(), getInstitutionSupervisionExam: vi.fn(),
    postInstitutionSupervisionTransition: vi.fn(), postInstitutionSupervisionLock: vi.fn(), postInstitutionSupervisionTime: vi.fn(),
    postInstitutionSupervisionBroadcast: vi.fn(), getExamMonitoring: vi.fn(), postBroadcast: vi.fn(), getTeacherReadiness: vi.fn(),
  };
});

// ASSESS-INSTITUTION-003 C05: the "Pelaksanaan Sesi" screen of the School Operator (entry and return focus, the
// participant-level round trip, loading, empty, refused, failed and stale states, each control dialog with its reason,
// retry focus and notice focus, the session dialogs with the affected and unaffected lists, the refusal and skip copy),
// the Operator source in the shared supervision components (whole-exam scope, the reason field on messages, an
// addition without a reason), the Teacher card of an institution exam in ACTIVE, PAUSED and ENDED, the E20 copy, and
// the narrowFirst summary without overflow-wrap: anywhere.

const PERIOD = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c01';
const SESSION = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c02';
const EXAM = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c03';
const EXAM_2 = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c04';
const EXAM_3 = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c05';
const P1 = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c11';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const WINDOW = { startsAt: '2026-11-11T01:00:00.000Z', endsAt: '2026-11-11T03:00:00.000Z' };
const REASON = 'Sesi dimulai sesuai jadwal';

const OVERVIEW: InstitutionOverview = {
  timeZone: 'Asia/Jakarta', limits: { maxDurationMinutes: 1440 }, assessmentTypes: [], academicPeriods: [], teachingAssignments: [],
  periods: [{ periodId: PERIOD, label: 'PTS Ganjil', assessmentTypeLabel: 'Penilaian Tengah Semester', academicPeriodLabel: 'Semester Ganjil', sessionCount: 1, examCount: 1 }],
};

function item(overrides: Partial<InstitutionExamItem> = {}): InstitutionExamItem {
  return {
    examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', teacherElligbleId: 'guru.mtk', lifecycleState: 'READY', cancelledAt: null,
    durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', participants: 3,
    preparation: { deadline: '2026-11-10T08:00:00.000Z', revision: 1, closed: true, questionCount: 2, preparedAt: null, sourceFileName: null },
    readiness: null, ...overrides,
  };
}

function detail(exams: InstitutionExamItem[]): InstitutionPeriodDetail {
  return {
    period: { periodId: PERIOD, label: 'PTS Ganjil', assessmentTypeLabel: 'Penilaian Tengah Semester', academicPeriodLabel: 'Semester Ganjil' },
    sessions: [{ sessionId: SESSION, ...WINDOW, exams }],
  };
}

const READY = { baseline: { status: 'baseline_readiness_checks_pass' }, roomProctor: { status: 'room_proctor_readiness_ready' } } as SupervisedExam['readiness'];
const counts = (o: Partial<SupervisedExam['counts']> = {}) => ({ participants: 3, notStarted: 3, active: 0, submitted: 0, locked: 0, ...o });

function supervised(overrides: Partial<SupervisedExam> = {}): SupervisedExam {
  return {
    examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', lifecycleState: 'READY', pausedAt: null, counts: counts(),
    rooms: [{ label: 'Ruang 1', counts: counts(), proctors: [{ elligbleId: 'pengawas.satu' }, { elligbleId: 'pengawas.tiga' }] }],
    readiness: READY, roomPolicy: true, ...overrides,
  };
}

function data(exams: SupervisedExam[] = [supervised()]): InstitutionSupervision {
  return { session: { sessionId: SESSION, periodLabel: 'PTS Ganjil', ...WINDOW }, serverTime: '2026-11-11T01:05:00.000Z', exams };
}

async function openScreen(value: InstitutionSupervision = data()) {
  vi.mocked(getInstitutionSupervision).mockResolvedValue(value);
  render(<SchoolExamMonitoringView session={{ sessionId: SESSION, ...WINDOW }} onBack={() => {}} />);
  await screen.findByRole('heading', { level: 2, name: 'Ujian di Sesi Ini' });
}

function participant(overrides: Partial<MonitoredParticipant> = {}): MonitoredParticipant {
  return {
    participantId: P1, elligbleId: 'siswa.satu', roomLabel: 'Ruang 1', status: 'ACTIVE', finalizationSource: null, submittedAt: null,
    remainingSeconds: 1800, answeredCount: 1, lastAcceptedAt: null, sessionActive: true, sessionMoves: 0, lockedAt: null, addedSeconds: 0, ...overrides,
  };
}

function monitoring(overrides: Partial<ExamMonitoringResponse> = {}): ExamMonitoringResponse {
  return {
    exam: { examInstanceId: EXAM, subjectLabel: 'Matematika', lifecycleState: 'ACTIVE', roomBased: true, pausedAt: null },
    scope: 'OPERATOR', canAddTime: true, serverTime: '2026-11-11T01:05:00.000Z', questionCount: 2,
    summary: { participants: 1, notStarted: 0, active: 1, submitted: 0 }, participants: [participant()],
    rooms: [{ roomId: 'r-1', label: 'Ruang 1' }], broadcasts: [], ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setDisplayTimeZone('Asia/Jakarta');
});
afterEach(() => setDisplayTimeZone(null));

describe('the entry from "Ujian Sekolah"', () => {
  it('"Pelaksanaan Sesi" shows for a session with a ready, running or ended exam only', async () => {
    vi.mocked(getInstitutionExams).mockResolvedValue(OVERVIEW);
    vi.mocked(getInstitutionPeriod).mockResolvedValue(detail([item({ lifecycleState: 'SCHEDULED' }), item({ examInstanceId: EXAM_2, lifecycleState: 'READY', cancelledAt: '2026-11-09T01:00:00.000Z' })]));
    render(<InstitutionExamView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buka Periode' }));
    await screen.findByRole('button', { name: 'Ruang dan Pengawas' });
    expect(screen.queryByRole('button', { name: 'Pelaksanaan Sesi' })).toBeNull();
  });

  it('replaces the period view, focuses its title, and "Kembali" restores the view, refreshes it and focuses the trigger', async () => {
    vi.mocked(getInstitutionExams).mockResolvedValue(OVERVIEW);
    vi.mocked(getInstitutionPeriod).mockResolvedValue(detail([item()]));
    vi.mocked(getInstitutionSupervision).mockResolvedValue(data());
    render(<InstitutionExamView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buka Periode' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pelaksanaan Sesi' }));
    const title = await screen.findByRole('heading', { level: 1, name: 'Pelaksanaan Sesi' });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(screen.getByText('Jadwal Sesi: 11 November 2026, 08.00 sampai 10.00 WIB. Pantau setiap ujian, ruang dan peserta di sesi ini. Setiap tindakan memerlukan alasan dan dicatat.')).toBeTruthy();
    expect(getInstitutionSupervision).toHaveBeenCalledWith(SESSION);
    await screen.findByRole('heading', { level: 2, name: 'Ujian di Sesi Ini' });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Pelaksanaan Sesi' }));
    const calls = vi.mocked(getInstitutionPeriod).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke Ujian Sekolah' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pelaksanaan Sesi' })));
    await waitFor(() => expect(vi.mocked(getInstitutionPeriod).mock.calls.length).toBeGreaterThan(calls));
  });
});

describe('the session screen', () => {
  it('loading, then the summary, the session actions, the exam cards with rooms, Proctors and readiness', async () => {
    let resolve!: (value: InstitutionSupervision) => void;
    vi.mocked(getInstitutionSupervision).mockReturnValue(new Promise(r => { resolve = r; }));
    render(<SchoolExamMonitoringView session={{ sessionId: SESSION, ...WINDOW }} onBack={() => {}} />);
    expect(screen.getByRole('status').textContent).toBe('Memuat pelaksanaan sesi...');
    resolve(data([
      supervised(),
      supervised({ examInstanceId: EXAM_2, subjectLabel: 'Fisika', groupLabel: 'X-2', lifecycleState: 'PAUSED', pausedAt: '2026-11-11T01:30:00.000Z', readiness: null,
        counts: counts({ notStarted: 0, active: 2, submitted: 1, locked: 1 }),
        rooms: [{ label: 'Ruang 2', counts: counts({ participants: 2, notStarted: 0, active: 2, locked: 1 }), proctors: [] }] }),
      supervised({ examInstanceId: EXAM_3, subjectLabel: 'Kimia', lifecycleState: 'READY', roomPolicy: false, rooms: [] }),
    ]));
    const summary = await screen.findByLabelText('Ringkasan sesi');
    expect(summary.className.split(' ')).toEqual(expect.arrayContaining(['grid-cols-1', 'min-[480px]:grid-cols-2', 'sm:grid-cols-4']));
    expect(summary.innerHTML).not.toContain('overflow-wrap');
    const metric = (label: string) => within(summary).getByText(label).nextElementSibling!.textContent;
    expect([metric('Ujian'), metric('Berlangsung'), metric('Dijeda'), metric('Peserta mengerjakan')]).toEqual(['3', '0', '1', '2']);
    expect(screen.getByText('Diperbarui 08.05.00 WIB. Diperbarui otomatis.')).toBeTruthy();
    const actions = screen.getByRole('heading', { level: 2, name: 'Tindakan untuk Seluruh Sesi' }).parentElement!;
    expect(within(actions).getAllByRole('button').map(b => b.textContent)).toEqual(['Buka Semua Ujian', 'Lanjutkan Semua Ujian']);
    const ready = screen.getByTestId(`supervision-exam-${EXAM}`);
    expect(within(ready).getByRole('heading', { level: 3, name: 'Matematika' })).toBeTruthy();
    expect(within(ready).getByText('X-1 · 3 peserta · 0 mengerjakan · 0 dikumpulkan')).toBeTruthy();
    expect(within(ready).getByText('Ruang 1: 3 peserta, 0 mengerjakan, 0 dikunci. Pengawas: pengawas.satu, pengawas.tiga')).toBeTruthy();
    expect(within(ready).getByText('Siap dibuka.')).toBeTruthy();
    expect(within(ready).getAllByRole('button').map(b => b.textContent)).toEqual(['Buka Ujian']);
    const paused = screen.getByTestId(`supervision-exam-${EXAM_2}`);
    expect(within(paused).getByText('Dijeda')).toBeTruthy();
    expect(within(paused).getByText('Dijeda sejak 08.30 WIB')).toBeTruthy();
    expect(within(paused).getByText('Ruang 2: 2 peserta, 2 mengerjakan, 1 dikunci. Pengawas: -')).toBeTruthy();
    expect(within(paused).getAllByRole('button').map(b => b.textContent)).toEqual(['Lanjutkan Ujian', 'Pantau Peserta']);
    expect(within(screen.getByTestId(`supervision-exam-${EXAM_3}`)).getByText('Ruang dan pengawas ujian ini belum diatur. Atur lewat Ruang dan Pengawas.')).toBeTruthy();
    // ELLIGBLE IDs only: no name, NIS or score is part of the screen.
    expect(document.body.textContent).not.toMatch(/NISN|Nama lengkap|Nilai|Skor/);
    expect(document.body.textContent).not.toContain('—');
  });

  it('an empty session, a refusal that replaces the data, a failed load with "Coba Lagi", and a failed refresh that keeps the data', async () => {
    await openScreen(data([]));
    expect(screen.getByText('Belum ada ujian di sesi ini.')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Tindakan untuk Seluruh Sesi' })).toBeNull();
    vi.mocked(getInstitutionSupervision).mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui' }));
    expect(await screen.findByText('Anda tidak berwenang mengatur ujian sekolah ini.')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Ujian di Sesi Ini' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Perbarui' })).toBeNull();
  });

  it('a failed first load offers "Coba Lagi"; a failed refresh keeps the data with "Pemantauan tertunda"', async () => {
    vi.mocked(getInstitutionSupervision).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(data());
    render(<SchoolExamMonitoringView session={{ sessionId: SESSION, ...WINDOW }} onBack={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Coba Lagi' }));
    await screen.findByRole('heading', { level: 2, name: 'Ujian di Sesi Ini' });
    vi.mocked(getInstitutionSupervision).mockRejectedValueOnce(new TypeError('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui' }));
    expect(await screen.findByText('Pemantauan tertunda')).toBeTruthy();
    expect(screen.getByText(/Data di bawah adalah data terakhir pukul 08\.05\.00 WIB\./)).toBeTruthy();
    expect(screen.getByTestId(`supervision-exam-${EXAM}`)).toBeTruthy();
  });

  it('refreshes by itself on its interval', async () => {
    vi.mocked(getInstitutionSupervision).mockResolvedValue(data());
    render(<SchoolExamMonitoringView session={{ sessionId: SESSION, ...WINDOW }} onBack={() => {}} refreshIntervalMs={30} />);
    await screen.findByRole('heading', { level: 2, name: 'Ujian di Sesi Ini' });
    await waitFor(() => expect(vi.mocked(getInstitutionSupervision).mock.calls.length).toBeGreaterThan(2));
  });
});

describe('the control dialogs', () => {
  it('"Buka Ujian": reason, one action key on retries, retry focus, then the notice takes focus', async () => {
    await openScreen();
    const trigger = within(screen.getByTestId(`supervision-exam-${EXAM}`)).getByRole('button', { name: 'Buka Ujian' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Buka Ujian Matematika · X-1?' });
    expect(within(dialog).getByText('Peserta dapat mulai mengerjakan sampai 10.00 WIB. Kesiapan diperiksa ulang saat ujian dibuka.')).toBeTruthy();
    const confirm = within(dialog).getByRole('button', { name: 'Buka Ujian' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Alasan tindakan'), { target: { value: REASON } });
    vi.mocked(postInstitutionSupervisionTransition).mockRejectedValueOnce(new TypeError('offline'));
    fireEvent.click(confirm);
    expect(await within(dialog).findByText('Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Buka Ujian' })));
    vi.mocked(postInstitutionSupervisionTransition).mockResolvedValueOnce({ examInstanceId: EXAM, lifecycleState: 'ACTIVE', changed: true, replayed: false });
    vi.mocked(getInstitutionSupervision).mockResolvedValue(data([supervised({ lifecycleState: 'ACTIVE', readiness: null })]));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buka Ujian' }));
    const notice = await screen.findByText('Ujian Matematika · X-1 dibuka.');
    const calls = vi.mocked(postInstitutionSupervisionTransition).mock.calls.map(c => c[0]);
    expect(calls[0]).toEqual({ examInstanceId: EXAM, action: 'activate', reason: REASON, confirmed: true, actionKey: expect.stringMatching(UUID) });
    expect(calls[1]).toEqual(calls[0]);
    await waitFor(() => expect(document.activeElement).toBe(notice.closest('[role="status"]')));
    expect(await within(screen.getByTestId(`supervision-exam-${EXAM}`)).findByRole('button', { name: 'Pantau Peserta' })).toBeTruthy();
  });

  it('each exam dialog has its words; "Batal" returns focus to the trigger', async () => {
    await openScreen(data([supervised({ lifecycleState: 'ACTIVE', readiness: null }), supervised({ examInstanceId: EXAM_2, subjectLabel: 'Fisika', lifecycleState: 'PAUSED', readiness: null })]));
    const cases: Array<[string, string, string, string]> = [
      [EXAM, 'Jeda Ujian', 'Jeda Ujian Matematika · X-1?', 'Sisa waktu setiap peserta berhenti dan jawaban tidak dapat diubah sampai ujian dilanjutkan.'],
      [EXAM, 'Akhiri Ujian', 'Akhiri Ujian Matematika · X-1?', 'Peserta baru tidak dapat mulai. Peserta yang sedang mengerjakan tetap dapat menyelesaikan sampai waktunya habis. Tidak ada hasil yang ditampilkan.'],
      [EXAM_2, 'Lanjutkan Ujian', 'Lanjutkan Ujian Fisika · X-1?', 'Peserta melanjutkan dengan sisa waktu masing-masing saat dijeda.'],
    ];
    for (const [exam, button, title, text] of cases) {
      const trigger = within(screen.getByTestId(`supervision-exam-${exam}`)).getByRole('button', { name: button });
      fireEvent.click(trigger);
      const dialog = await screen.findByRole('dialog', { name: title });
      expect(within(dialog).getByText(text)).toBeTruthy();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    }
  });

  it('the refusal copy of a control, with "Perbarui" for a state that changed', async () => {
    await openScreen();
    const cases: Array<[ApiError, string]> = [
      [new ApiError(409, 'invalid_state', undefined, { error: 'invalid_state', currentState: 'ACTIVE' }), 'Status ujian sudah berubah. Pilih Perbarui untuk melihat status terbaru.'],
      [new ApiError(409, 'window_not_started', undefined, { error: 'window_not_started', windowStartsAt: '2026-11-11T01:00:00.000Z' }), 'Ujian baru dapat dibuka mulai 08.00 WIB.'],
      [new ApiError(409, 'window_closed'), 'Waktu sesi sudah berakhir, jadi ujian tidak dapat dibuka.'],
      [new ApiError(409, 'room_setup_required'), 'Ruang dan pengawas ujian ini belum diatur. Atur lewat Ruang dan Pengawas.'],
      [new ApiError(409, 'not_ready', undefined, { error: 'not_ready', readiness: { baseline: { status: 'baseline_readiness_checks_pass' }, roomProctor: { status: 'not_ready', blocker: 'active_proctor_room_coverage_incomplete' } } }),
        'Ujian belum siap dibuka: Cakupan pengawas untuk ruangan belum lengkap.'],
      [new ApiError(409, 'action_key_reused'), 'Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.'],
      [new ApiError(403, 'forbidden'), 'Anda tidak berwenang mengatur ujian sekolah ini.'],
    ];
    for (const [error, text] of cases) {
      fireEvent.click(within(screen.getByTestId(`supervision-exam-${EXAM}`)).getByRole('button', { name: 'Buka Ujian' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Alasan tindakan'), { target: { value: REASON } });
      vi.mocked(postInstitutionSupervisionTransition).mockRejectedValueOnce(error);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Buka Ujian' }));
      expect(await within(dialog).findByText(text)).toBeTruthy();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
  });

  it('a session dialog lists the affected and unaffected exams; the notice counts them and names each skip', async () => {
    await openScreen(data([
      supervised({ lifecycleState: 'ACTIVE', readiness: null }),
      supervised({ examInstanceId: EXAM_2, subjectLabel: 'Fisika', groupLabel: 'X-2', lifecycleState: 'SCHEDULED', readiness: null }),
    ]));
    const trigger = screen.getByRole('button', { name: 'Jeda Semua Ujian' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Jeda Semua Ujian di Sesi Ini?' });
    const affected = within(dialog).getByRole('heading', { level: 3, name: 'Akan terkena:' }).parentElement!;
    expect(within(affected).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Matematika · X-1']);
    const unaffected = within(dialog).getByRole('heading', { level: 3, name: 'Tidak terkena:' }).parentElement!;
    expect(within(unaffected).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Fisika · X-2: status ujian tidak sesuai (Terjadwal).']);
    fireEvent.change(within(dialog).getByLabelText('Alasan tindakan'), { target: { value: 'Listrik padam di sekolah' } });
    vi.mocked(postInstitutionSupervisionTransition).mockResolvedValueOnce({
      sessionId: SESSION, action: 'pause', replayed: false,
      results: [
        { examInstanceId: EXAM, outcome: 'APPLIED', previousState: 'ACTIVE', resultingState: 'PAUSED' },
        { examInstanceId: EXAM_2, outcome: 'SKIPPED', previousState: 'SCHEDULED', resultingState: 'SCHEDULED', skip: { code: 'invalid_state', currentState: 'SCHEDULED' } },
      ],
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Jeda Semua Ujian' }));
    const notice = (await screen.findByText('1 ujian dijeda.')).closest('[role="status"]')!;
    expect(notice.textContent).toBe('1 ujian dijeda.1 ujian tidak terkena.Fisika · X-2: status ujian tidak sesuai (Terjadwal).');
    expect(vi.mocked(postInstitutionSupervisionTransition).mock.calls[0][0]).toEqual({
      sessionId: SESSION, action: 'pause', reason: 'Listrik padam di sekolah', confirmed: true, actionKey: expect.stringMatching(UUID),
    });
    await waitFor(() => expect(document.activeElement).toBe(notice));
  });

  it('nothing_applicable names the skip of every exam', async () => {
    await openScreen(data([supervised()]));
    fireEvent.click(screen.getByRole('button', { name: 'Buka Semua Ujian' }));
    const dialog = await screen.findByRole('dialog', { name: 'Buka Semua Ujian di Sesi Ini?' });
    fireEvent.change(within(dialog).getByLabelText('Alasan tindakan'), { target: { value: REASON } });
    vi.mocked(postInstitutionSupervisionTransition).mockRejectedValueOnce(new ApiError(409, 'nothing_applicable', undefined, {
      error: 'nothing_applicable',
      results: [{ examInstanceId: EXAM, outcome: 'SKIPPED', previousState: 'READY', resultingState: 'READY', skip: { code: 'window_not_started', windowStartsAt: '2026-11-11T01:00:00.000Z' } }],
    }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buka Semua Ujian' }));
    expect(await within(dialog).findByText('Tidak ada ujian di sesi ini yang dapat dikenai tindakan ini.')).toBeTruthy();
    expect(within(dialog).getByText('Matematika · X-1: Ujian baru dapat dibuka mulai 08.00 WIB.')).toBeTruthy();
  });
});

describe('the participant level with the Operator source', () => {
  it('"Pantau Peserta" opens the shared screen over the whole exam and "Kembali" returns focus to the trigger', async () => {
    await openScreen(data([supervised({ lifecycleState: 'ACTIVE', readiness: null })]));
    vi.mocked(getInstitutionSupervisionExam).mockResolvedValue(monitoring());
    fireEvent.click(within(screen.getByTestId(`supervision-exam-${EXAM}`)).getByRole('button', { name: 'Pantau Peserta' }));
    await screen.findByRole('button', { name: 'Kunci pengerjaan siswa.satu' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Pemantauan Peserta' })));
    expect(getInstitutionSupervisionExam).toHaveBeenCalledWith(EXAM);
    expect(getExamMonitoring).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke Pelaksanaan Sesi' }));
    await screen.findByRole('heading', { level: 1, name: 'Pelaksanaan Sesi' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pantau Peserta' })));
  });

  it('a lock goes to the Operator route with its reason; messages need a reason and address the whole exam', async () => {
    vi.mocked(getInstitutionSupervisionExam).mockResolvedValue(monitoring());
    vi.mocked(postInstitutionSupervisionLock).mockResolvedValue({ participantId: P1, locked: true, changed: true, lockedAt: '2026-11-11T01:10:00.000Z', replayed: false });
    vi.mocked(postInstitutionSupervisionBroadcast).mockResolvedValue({ broadcastId: 'b-1', sentAt: '2026-11-11T01:10:00.000Z', recipients: 1, replayed: false });
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali ke Pelaksanaan Sesi" onBack={() => {}} source={OPERATOR_SOURCE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kunci pengerjaan siswa.satu' }));
    const lock = await screen.findByRole('dialog', { name: 'Kunci Pengerjaan Peserta?' });
    fireEvent.change(within(lock).getByLabelText('Alasan tindakan'), { target: { value: 'Perangkat bermasalah' } });
    fireEvent.click(within(lock).getByRole('button', { name: 'Kunci Pengerjaan' }));
    expect(await screen.findByText(/Pengerjaan siswa\.satu dikunci/)).toBeTruthy();
    expect(vi.mocked(postInstitutionSupervisionLock).mock.calls[0][0]).toEqual({
      examInstanceId: EXAM, participantId: P1, action: 'lock', reason: 'Perangkat bermasalah', confirmed: true, actionKey: expect.stringMatching(UUID),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Kirim Pesan' }));
    const composer = await screen.findByRole('dialog', { name: 'Kirim Pesan ke Peserta' });
    expect(within(composer).getByRole('radio', { name: 'Semua peserta' })).toBeTruthy();
    fireEvent.change(within(composer).getByLabelText('Pesan'), { target: { value: 'Harap tetap di tempat duduk.' } });
    const send = within(composer).getByRole('button', { name: 'Kirim Pesan' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(within(composer).getByLabelText('Alasan tindakan'), { target: { value: 'Ruang ujian ramai' } });
    vi.mocked(postInstitutionSupervisionBroadcast).mockRejectedValueOnce(new TypeError('offline'));
    fireEvent.click(send);
    expect(await within(composer).findByText('Gagal mengirim pesan. Periksa koneksi internet Anda dan coba lagi.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(composer).getByRole('button', { name: 'Kirim Pesan' })));
    fireEvent.click(within(composer).getByRole('button', { name: 'Kirim Pesan' }));
    expect(await screen.findByText('Pesan terkirim ke 1 peserta.')).toBeTruthy();
    const [first, second] = vi.mocked(postInstitutionSupervisionBroadcast).mock.calls.map(c => c[0]);
    expect(first).toEqual({ examInstanceId: EXAM, target: { scope: 'EXAM' }, message: 'Harap tetap di tempat duduk.', reason: 'Ruang ujian ramai', confirmed: true, actionKey: expect.stringMatching(UUID) });
    expect(second.actionKey).toBe(first.actionKey);
    expect(postBroadcast).not.toHaveBeenCalled();
  });

  it('added time goes to the Operator route; an addition by another actor is listed without its reason', async () => {
    vi.mocked(postInstitutionSupervisionTime).mockResolvedValue({ participantId: P1, addedSeconds: 600, totalAddedSeconds: 900, remainingSeconds: 2400, addedAt: '2026-11-11T01:10:00.000Z', replayed: false });
    const done = vi.fn();
    const p = participant({ addedSeconds: 300, timeAdditions: [
      { addedAt: '2026-11-11T01:02:00.000Z', seconds: 300, by: { elligbleId: 'operator.dua', you: false } },
      { addedAt: '2026-11-11T01:03:00.000Z', seconds: 60, reason: 'Listrik padam', by: { elligbleId: 'operator.satu', you: true } },
    ] });
    render(<AddTimeDialog participant={p} examInstanceId={EXAM} examState="ACTIVE" onClose={() => {}} onDone={done} source={OPERATOR_SOURCE} comfortable />);
    const items = screen.getAllByRole('listitem').map(li => li.textContent);
    expect(items).toEqual(['08.02 WIB · 5 menit · operator.dua', '08.03 WIB · 1 menit · Anda: Listrik padam']);
    fireEvent.change(screen.getByLabelText('Tambahan waktu (menit)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Alasan'), { target: { value: 'Gangguan jaringan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tambah 10 Menit' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(vi.mocked(postInstitutionSupervisionTime).mock.calls[0][0]).toEqual({ examInstanceId: EXAM, participantId: P1, minutes: 10, reason: 'Gangguan jaringan', actionKey: expect.stringMatching(UUID) });
  });

  it('the supervisor screen keeps the supervisor routes and the E20 copy for every viewer', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring({ scope: 'PROCTOR', canAddTime: false, exam: { examInstanceId: EXAM, subjectLabel: 'Matematika', lifecycleState: 'PAUSED', roomBased: true, pausedAt: null } }));
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    expect(await screen.findByText('Sisa waktu peserta berhenti dan jawaban tidak dapat diubah sampai ujian dilanjutkan.')).toBeTruthy();
    expect(screen.getByText(/"Waktu ditambah" berarti petugas yang berwenang menambah waktu pengerjaan peserta itu\./)).toBeTruthy();
    expect(getInstitutionSupervisionExam).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Kembali' }).className).not.toContain('min-h-11');
  });

  it('a refused participant list says who may see it, in role-neutral words', async () => {
    vi.mocked(getInstitutionSupervisionExam).mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali ke Pelaksanaan Sesi" onBack={() => {}} source={OPERATOR_SOURCE} />);
    expect(await screen.findByText('Daftar peserta hanya dapat dilihat oleh petugas yang berwenang atas ujian ini.')).toBeTruthy();
  });
});

describe('the subject Teacher card of an institution exam (E2)', () => {
  function teacherExam(overrides: Partial<TeacherExamReadinessProjection>): TeacherExamReadinessProjection {
    return {
      examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', lifecycleState: 'ACTIVE',
      baseline: { status: 'not_evaluated' }, roomProctor: { status: 'not_evaluated' }, progress: null, pausedAt: null,
      institution: { periodLabel: 'PTS Ganjil', preparationDeadline: '2026-11-10T08:00:00.000Z', deadlineExtended: false, preparationClosed: true, questionCount: 2 },
      ...overrides,
    } as TeacherExamReadinessProjection;
  }
  const RUNNING = 'Ujian ini sedang dilaksanakan. Pemantauan dilakukan operator sekolah dan pengawas ruang. Kemajuan peserta tampil setelah ujian berakhir.';

  it('ACTIVE: the badge and the running line; no counts and no "Pantau Peserta"', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [teacherExam({})] });
    render(<TeacherReadinessView onOpenMonitoring={() => {}} onOpenResults={() => {}} />);
    const card = await screen.findByTestId(`teacher-exam-${EXAM}`);
    expect(within(card).getByText('Berlangsung')).toBeTruthy();
    expect(within(card).getByText(RUNNING)).toBeTruthy();
    expect(within(card).queryByLabelText('Kemajuan pelaksanaan ujian')).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Pantau Peserta' })).toBeNull();
    expect(within(card).queryByText('Kesiapan Dasar')).toBeNull();
  });

  it('PAUSED: the pause notice shows with progress null', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [teacherExam({ lifecycleState: 'PAUSED', pausedAt: '2026-11-11T01:30:00.000Z' })] });
    render(<TeacherReadinessView onOpenMonitoring={() => {}} />);
    const card = await screen.findByTestId(`teacher-exam-${EXAM}`);
    expect(within(card).getByText('Ujian dijeda sejak 08.30 WIB')).toBeTruthy();
    expect(within(card).getByText(RUNNING)).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Pantau Peserta' })).toBeNull();
  });

  it('ENDED: the counts and "Finalisasi Hasil", still no "Pantau Peserta"; a teacher-managed exam keeps it', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValue({ exams: [
      teacherExam({ lifecycleState: 'ENDED', progress: { participants: 3, started: 2, submitted: 2, running: 0 } }),
      teacherExam({ examInstanceId: EXAM_2, lifecycleState: 'ACTIVE', institution: null, progress: { participants: 3, started: 1, submitted: 0, running: 1 } }),
    ] });
    render(<TeacherReadinessView onOpenMonitoring={() => {}} onOpenResults={() => {}} />);
    const ended = await screen.findByTestId(`teacher-exam-${EXAM}`);
    expect(within(ended).getByLabelText('Kemajuan pelaksanaan ujian')).toBeTruthy();
    expect(within(ended).getByRole('button', { name: 'Finalisasi Hasil' })).toBeTruthy();
    expect(within(ended).queryByRole('button', { name: 'Pantau Peserta' })).toBeNull();
    expect(within(ended).queryByText(RUNNING)).toBeNull();
    const managed = screen.getByTestId(`teacher-exam-${EXAM_2}`);
    expect(within(managed).getByRole('button', { name: 'Pantau Peserta' })).toBeTruthy();
    expect(within(managed).getByRole('button', { name: 'Jeda Ujian' })).toBeTruthy();
  });
});


describe('controlled Operator dialog focus', () => {
  it('returns add-time focus to its opener, then to refresh if the refreshed row loses that action', async () => {
    let resolveRead: (value: ExamMonitoringResponse) => void = () => { throw new Error('Refresh not requested'); };
    const refreshed = new Promise<ExamMonitoringResponse>(resolve => { resolveRead = resolve; });
    vi.mocked(getInstitutionSupervisionExam).mockResolvedValueOnce(monitoring()).mockReturnValueOnce(refreshed);
    vi.mocked(postInstitutionSupervisionTime).mockResolvedValue({ participantId: P1, addedSeconds: 600, totalAddedSeconds: 600, remainingSeconds: 2400, addedAt: '2026-11-11T01:10:00.000Z', replayed: false });
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali ke Pelaksanaan Sesi" onBack={() => {}} source={OPERATOR_SOURCE} />);
    const opener = await screen.findByRole('button', { name: 'Tambah waktu siswa.satu' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Tambah Waktu Peserta' });
    fireEvent.change(within(dialog).getByLabelText('Tambahan waktu (menit)'), { target: { value: '10' } });
    fireEvent.change(within(dialog).getByLabelText('Alasan'), { target: { value: 'Gangguan jaringan' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah 10 Menit' }));
    await screen.findByText(/^Waktu siswa.satu ditambah 10 menit\./);
    await waitFor(() => expect(document.activeElement).toBe(opener));
    await act(async () => { resolveRead(monitoring({ participants: [participant({ status: 'SUBMITTED', remainingSeconds: 0 })], summary: { participants: 1, notStarted: 0, active: 0, submitted: 1 } })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tambah waktu siswa.satu' })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Perbarui' }));
  });

  it('returns focus after an Operator message is sent', async () => {
    vi.mocked(getInstitutionSupervisionExam).mockResolvedValue(monitoring());
    vi.mocked(postInstitutionSupervisionBroadcast).mockResolvedValue({ broadcastId: 'sent', sentAt: '2026-11-11T01:10:00.000Z', recipients: 1, replayed: false });
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali ke Pelaksanaan Sesi" onBack={() => {}} source={OPERATOR_SOURCE} />);
    const opener = await screen.findByRole('button', { name: 'Kirim Pesan' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Kirim Pesan ke Peserta' });
    fireEvent.change(within(dialog).getByLabelText('Pesan'), { target: { value: 'Tetap tenang.' } });
    fireEvent.change(within(dialog).getByLabelText('Alasan tindakan'), { target: { value: 'Pengumuman ruang' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kirim Pesan' }));
    await screen.findByText('Pesan terkirim ke 1 peserta.');
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('returns add-time cancellation focus to its opener', async () => {
    vi.mocked(getInstitutionSupervisionExam).mockResolvedValue(monitoring());
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali ke Pelaksanaan Sesi" onBack={() => {}} source={OPERATOR_SOURCE} />);
    const opener = await screen.findByRole('button', { name: 'Tambah waktu siswa.satu' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Tambah Waktu Peserta' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(postInstitutionSupervisionTime).not.toHaveBeenCalled();
  });
});
