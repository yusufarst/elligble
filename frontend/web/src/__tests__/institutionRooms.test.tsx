/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InstitutionExamView, institutionFailureMessages } from '../components/InstitutionExamView';
import { InstitutionRoomManagementView, roomFailureMessages, roomProblemText } from '../components/InstitutionRoomManagementView';
import { ParticipantChoiceList } from '../components/ParticipantChoiceList';
import { Metric, MetricList } from '../components/ui/metric';
import { setDisplayTimeZone } from '../lib/format';
import {
  ApiError, getInstitutionExams, getInstitutionPeriod, getInstitutionRooms, postInstitutionParticipants, postInstitutionRoomParticipants,
  postInstitutionRoomProctors,
} from '../api/assessment-client';
import type { InstitutionExamItem, InstitutionOverview, InstitutionPeriodDetail, InstitutionRoomExam, InstitutionRoomView } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return {
    ...actual,
    getInstitutionExams: vi.fn(), getInstitutionPeriod: vi.fn(), getInstitutionRooms: vi.fn(),
    postInstitutionRoomParticipants: vi.fn(), postInstitutionRoomProctors: vi.fn(), postInstitutionParticipants: vi.fn(),
  };
});

// ASSESS-INSTITUTION-002 C05: the "Ruang dan Pengawas" screen of the School Operator (entry and return focus,
// loading, empty, refused, failed, stale and success states, each dialog with its retry and notice focus, the
// focus after "Hapus", the READY and demotion notices, the problem copy, non-editable exams), the hidden
// "Perpanjang Tenggat" of an exam ever marked ready, and the shared primitives (ParticipantChoiceList with an
// id and a note, the narrowFirst MetricList) with their existing rendering unchanged (C02).

const PERIOD = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b01';
const SESSION = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b02';
const EXAM = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b03';
const EXAM_READY = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b04';
const EXAM_OPEN = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b05';
const P1 = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b11';
const P2 = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b12';
const P3 = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b13';
const Q1 = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b21';
const EN1 = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b31';
const EN2 = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b32';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SESSION_WINDOW = { startsAt: '2026-11-11T01:00:00.000Z', endsAt: '2026-11-11T03:00:00.000Z' };

const OVERVIEW: InstitutionOverview = {
  timeZone: 'Asia/Jakarta',
  limits: { maxDurationMinutes: 1440 },
  assessmentTypes: [],
  academicPeriods: [],
  teachingAssignments: [],
  periods: [{ periodId: PERIOD, label: 'PTS Ganjil', assessmentTypeLabel: 'Penilaian Tengah Semester', academicPeriodLabel: 'Semester Ganjil', sessionCount: 1, examCount: 1 }],
};

function item(overrides: Partial<InstitutionExamItem> = {}): InstitutionExamItem {
  return {
    examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', teacherElligbleId: 'guru.mtk', lifecycleState: 'SCHEDULED', cancelledAt: null,
    durationMinutes: 90, latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', participants: 3,
    preparation: { deadline: '2026-11-10T08:00:00.000Z', revision: 1, closed: false, questionCount: 0, preparedAt: null, sourceFileName: null },
    readiness: null,
    ...overrides,
  };
}

function detail(exams: InstitutionExamItem[] = [item()]): InstitutionPeriodDetail {
  return {
    period: { periodId: PERIOD, label: 'PTS Ganjil', assessmentTypeLabel: 'Penilaian Tengah Semester', academicPeriodLabel: 'Semester Ganjil' },
    sessions: [{ sessionId: SESSION, ...SESSION_WINDOW, exams }],
  };
}

function exam(overrides: Partial<InstitutionRoomExam> = {}): InstitutionRoomExam {
  return {
    examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', lifecycleState: 'SCHEDULED', editable: true, roomBased: true,
    roomReadiness: { status: 'not_ready', blocker: 'participant_room_assignment_incomplete', participantCount: 3, assignedParticipantCount: 2, unassignedParticipantCount: 1 },
    participants: [
      { participantId: P1, elligbleId: 'siswa.satu', roomLabel: 'Ruang 1' },
      { participantId: P2, elligbleId: 'siswa.dua', roomLabel: 'Ruang 1' },
      { participantId: P3, elligbleId: 'siswa.tiga', roomLabel: null },
    ],
    candidates: [{ enrollmentId: EN1, elligbleId: 'siswa.baru', conflict: false }, { enrollmentId: EN2, elligbleId: 'siswa.bentrok', conflict: true }],
    ...overrides,
  };
}

function view(overrides: Partial<InstitutionRoomView> = {}): InstitutionRoomView {
  return {
    session: { sessionId: SESSION, periodLabel: 'PTS Ganjil', ...SESSION_WINDOW },
    revision: 2,
    rooms: [{ label: 'Ruang 1', participantCount: 2, groups: [{ examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', count: 2 }], proctors: [{ elligbleId: 'pengawas.satu' }] }],
    exams: [exam()],
    ...overrides,
  };
}

async function openRooms(data: InstitutionRoomView = view()) {
  vi.mocked(getInstitutionRooms).mockResolvedValue(data);
  render(<InstitutionRoomManagementView session={{ sessionId: SESSION, ...SESSION_WINDOW }} onBack={() => {}} />);
  await screen.findByRole('heading', { level: 2, name: 'Daftar Ruang' });
}

beforeEach(() => {
  vi.clearAllMocks();
  setDisplayTimeZone('Asia/Jakarta');
});
afterEach(() => setDisplayTimeZone(null));

describe('the entry from "Ujian Sekolah"', () => {
  it('"Ruang dan Pengawas" replaces the period view; the title takes focus; "Kembali" restores it and returns focus to the trigger', async () => {
    vi.mocked(getInstitutionExams).mockResolvedValue(OVERVIEW);
    vi.mocked(getInstitutionPeriod).mockResolvedValue(detail());
    vi.mocked(getInstitutionRooms).mockResolvedValue(view());
    render(<InstitutionExamView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buka Periode' }));
    const trigger = await screen.findByRole('button', { name: 'Ruang dan Pengawas' });
    expect(screen.getByRole('button', { name: 'Tempatkan Ujian' })).toBeTruthy();
    fireEvent.click(trigger);
    const title = await screen.findByRole('heading', { level: 1, name: 'Ruang dan Pengawas' });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(screen.getByText('Jadwal Sesi: 11 November 2026, 08.00 sampai 10.00 WIB. Tempatkan setiap peserta di satu ruang dan tetapkan pengawas untuk setiap ruang sebelum ujian dibuka.')).toBeTruthy();
    expect(getInstitutionRooms).toHaveBeenCalledWith(SESSION);
    expect(screen.queryByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeNull();
    await screen.findByRole('heading', { level: 2, name: 'Daftar Ruang' });
    // The title keeps its element and its focus when the data arrives.
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Ruang dan Pengawas' }));
    const calls = vi.mocked(getInstitutionPeriod).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke Ujian Sekolah' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ruang dan Pengawas' })));
    await waitFor(() => expect(vi.mocked(getInstitutionPeriod).mock.calls.length).toBeGreaterThan(calls));
  });

  it('"Perpanjang Tenggat" is hidden for an exam that was ever marked ready, and its refusal has its copy', async () => {
    vi.mocked(getInstitutionExams).mockResolvedValue(OVERVIEW);
    vi.mocked(getInstitutionPeriod).mockResolvedValue(detail([item(), item({ examInstanceId: EXAM_READY, subjectLabel: 'Fisika', markedReadyBefore: true })]));
    render(<InstitutionExamView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buka Periode' }));
    const plain = await screen.findByTestId(`institution-exam-${EXAM}`);
    const demoted = screen.getByTestId(`institution-exam-${EXAM_READY}`);
    expect(within(plain).getByRole('button', { name: 'Perpanjang Tenggat' })).toBeTruthy();
    expect(within(demoted).queryByRole('button', { name: 'Perpanjang Tenggat' })).toBeNull();
    expect(within(demoted).getByRole('button', { name: 'Batalkan Ujian' })).toBeTruthy();
    expect(institutionFailureMessages(new ApiError(409, 'marked_ready_before'))).toEqual(['Ujian ini pernah ditandai siap, jadi tenggat tidak dapat diperpanjang.']);
  });
});

describe('the room screen states', () => {
  it('loading, then the summary, the rooms and the exams', async () => {
    let resolve!: (value: InstitutionRoomView) => void;
    vi.mocked(getInstitutionRooms).mockReturnValue(new Promise(r => { resolve = r; }));
    render(<InstitutionRoomManagementView session={{ sessionId: SESSION, ...SESSION_WINDOW }} onBack={() => {}} />);
    expect(screen.getByRole('status').textContent).toBe('Memuat ruang dan pengawas...');
    resolve(view({ rooms: [...view().rooms, { label: 'Lab IPA', participantCount: 1, groups: [{ examInstanceId: EXAM, subjectLabel: 'Matematika', groupLabel: 'X-1', count: 1 }], proctors: [] }] }));
    const summary = await screen.findByLabelText('Ringkasan ruang');
    expect(summary.className.split(' ')).toEqual(expect.arrayContaining(['grid-cols-1', 'min-[480px]:grid-cols-2', 'sm:grid-cols-4']));
    expect(summary.className.split(' ')).not.toContain('grid-cols-2');
    expect(summary.innerHTML).not.toContain('overflow-wrap');
    expect(document.getElementById('institution-rooms')!.className).not.toContain('overflow-wrap');
    const metric = (label: string) => within(summary).getByText(label).nextElementSibling!.textContent;
    expect([metric('Peserta'), metric('Belum punya ruang'), metric('Ruang'), metric('Ruang tanpa pengawas')]).toEqual(['3', '1', '2', '1']);
    const room = screen.getByTestId('institution-room-Ruang 1');
    expect(within(room).getByRole('heading', { level: 3, name: 'Ruang 1' })).toBeTruthy();
    expect(within(room).getByText('2 peserta')).toBeTruthy();
    expect(within(room).getByText('Matematika · X-1: 2 peserta')).toBeTruthy();
    expect(room.textContent).toContain('Pengawas: pengawas.satu');
    expect(within(room).queryByText('Belum ada pengawas')).toBeNull();
    expect(within(screen.getByTestId('institution-room-Lab IPA')).getByText('Belum ada pengawas')).toBeTruthy();
    const card = screen.getByTestId(`institution-room-exam-${EXAM}`);
    expect(within(card).getByRole('heading', { level: 3, name: 'Matematika' })).toBeTruthy();
    expect(within(card).getByText('X-1 · 3 peserta · 1 belum punya ruang')).toBeTruthy();
    expect(within(card).getByText('Terjadwal')).toBeTruthy();
    expect(within(card).getByText('Penugasan peserta ke ruangan belum lengkap.')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Tambah Peserta' })).toBeTruthy();
    // No name, NIS or question is part of the screen.
    expect(document.body.textContent).not.toMatch(/NISN|Nama lengkap|Kunci jawaban/);
  });

  it('the empty state, a complete exam and a non-editable exam', async () => {
    await openRooms(view({
      rooms: [],
      exams: [
        exam({ participants: [{ participantId: P3, elligbleId: 'siswa.tiga', roomLabel: null }], roomReadiness: { status: 'not_ready', blocker: 'exam_room_empty' } }),
        exam({ examInstanceId: EXAM_READY, subjectLabel: 'Fisika', lifecycleState: 'READY', roomReadiness: { status: 'room_proctor_readiness_ready' }, candidates: [] }),
        exam({ examInstanceId: EXAM_OPEN, subjectLabel: 'Kimia', lifecycleState: 'ACTIVE', editable: false, roomReadiness: null, candidates: [] }),
      ],
    }));
    expect(screen.getByRole('heading', { name: 'Belum ada ruang.' })).toBeTruthy();
    expect(screen.getByText('Belum ada ruang di sesi ini. Tambahkan ruang, lalu tempatkan peserta.')).toBeTruthy();
    expect(within(screen.getByTestId(`institution-room-exam-${EXAM}`)).getByText('Belum ada ruangan yang ditetapkan.')).toBeTruthy();
    expect(within(screen.getByTestId(`institution-room-exam-${EXAM_READY}`)).getByText('Ruang dan pengawas lengkap.')).toBeTruthy();
    const opened = screen.getByTestId(`institution-room-exam-${EXAM_OPEN}`);
    expect(within(opened).getByText('Ujian ini sudah dibuka, jadi ruang dan pengawasnya tidak dapat diubah di sini.')).toBeTruthy();
    expect(within(opened).queryByRole('button', { name: 'Tambah Peserta' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tambah Ruang' })).toBeTruthy();
  });

  it('a refused load says who may see it; a failed one offers "Coba Lagi"; a failed refresh keeps the data', async () => {
    vi.mocked(getInstitutionRooms).mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    const { unmount } = render(<InstitutionRoomManagementView session={{ sessionId: SESSION, ...SESSION_WINDOW }} onBack={() => {}} />);
    expect(await screen.findByText('Anda tidak berwenang mengatur ujian sekolah ini.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Muat Ulang' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Kembali ke Ujian Sekolah' })).toBeTruthy();
    unmount();
    vi.mocked(getInstitutionRooms).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(view()).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<InstitutionRoomManagementView session={{ sessionId: SESSION, ...SESSION_WINDOW }} onBack={() => {}} />);
    expect(await screen.findByText('Gagal Memuat Ruang dan Pengawas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Daftar Ruang' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Muat Ulang' }));
    expect(await screen.findByText('Gagal memperbarui data')).toBeTruthy();
    expect(screen.getByTestId('institution-room-Ruang 1')).toBeTruthy();
  });
});

describe('the dialogs', () => {
  it('"Tambah Ruang" lists the participants without a room by default, keeps its key on a retry, then focuses the notice', async () => {
    await openRooms(view({ exams: [exam({ lifecycleState: 'READY' })] }));
    vi.mocked(postInstitutionRoomParticipants)
      .mockRejectedValueOnce(new ApiError(422, 'room_invalid', undefined, { problems: [{ code: 'room_conflict' }] }))
      .mockResolvedValueOnce({ sessionId: SESSION, revision: 3, moved: 1, demoted: [EXAM], replayed: false });
    const trigger = screen.getByRole('button', { name: 'Tambah Ruang' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Tambah Ruang' });
    expect(within(dialog).getByRole('checkbox', { name: /siswa\.tiga/ })).toBeTruthy();
    expect(within(dialog).queryByRole('checkbox', { name: /siswa\.satu/ })).toBeNull();
    expect(within(dialog).getByText('Belum punya ruang', { selector: 'span' })).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Tampilkan'), { target: { value: 'all' } });
    expect(within(dialog).getByRole('checkbox', { name: /siswa\.satu/ }).closest('label')!.textContent).toContain('Ruang Ruang 1');
    fireEvent.change(within(dialog).getByLabelText('Tampilkan'), { target: { value: 'unplaced' } });
    const save = within(dialog).getByRole('button', { name: 'Simpan Ruang' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pilih semua X-1' }));
    expect(save.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Nama ruang'), { target: { value: '  Ruang   2 ' } });
    // An exam already marked ready is re-checked.
    expect(within(dialog).getByText('Ujian yang sudah ditandai siap akan diperiksa ulang. Bila belum lengkap, ujian kembali ke Terjadwal dan perlu ditandai siap lagi.')).toBeTruthy();
    expect(postInstitutionRoomParticipants).not.toHaveBeenCalled();
    fireEvent.click(save);
    expect(await within(dialog).findByText('Ruang ini sudah dipakai sesi lain pada waktu yang sama.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(save));
    vi.mocked(getInstitutionRooms).mockResolvedValue(view({ rooms: [] }));
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [first, second] = vi.mocked(postInstitutionRoomParticipants).mock.calls.map(c => c[0]);
    expect(first).toEqual({ sessionId: SESSION, roomLabel: '  Ruang   2 ', participantIds: [P3], expectedRevision: 2, actionKey: expect.stringMatching(UUID) });
    expect(second.actionKey).toBe(first.actionKey);
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Peserta ditempatkan di Ruang 2: 1 peserta.Ujian Matematika · X-1 kembali ke Terjadwal dan perlu ditandai siap lagi.');
    await waitFor(() => expect(document.activeElement).toBe(notice));
  });

  it('"Tempatkan Peserta di <ruang>" lists the participants not in this room, each noted; a stale revision has its copy', async () => {
    await openRooms();
    vi.mocked(postInstitutionRoomParticipants).mockRejectedValueOnce(new ApiError(409, 'stale_assignment', undefined, { revision: 5 }));
    const room = screen.getByTestId('institution-room-Ruang 1');
    const trigger = within(room).getByRole('button', { name: 'Tempatkan Peserta' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Tempatkan Peserta di Ruang 1' });
    expect(within(dialog).queryByLabelText('Nama ruang')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Tampilkan'), { target: { value: 'all' } });
    expect(within(dialog).queryByRole('checkbox', { name: /siswa\.satu/ }), 'already in this room').toBeNull();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /siswa\.tiga/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tempatkan Peserta' }));
    expect(await within(dialog).findByText('Penempatan ruang baru saja diubah. Muat ulang untuk melihat penempatan terbaru.')).toBeTruthy();
    expect(vi.mocked(postInstitutionRoomParticipants).mock.calls[0][0]).toMatchObject({ roomLabel: 'Ruang 1', participantIds: [P3], expectedRevision: 2 });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('"Atur Pengawas <ruang>": "Hapus" moves focus to the field, IDs are typed, the set is saved, and the problems have their copy', async () => {
    await openRooms();
    vi.mocked(postInstitutionRoomProctors)
      .mockRejectedValueOnce(new ApiError(422, 'room_invalid', undefined, { problems: [{ code: 'proctor_unknown', elligbleIds: ['ELG-ABCD-EFGH-JKMN', 'tidak.ada'] }] }))
      .mockResolvedValueOnce({ sessionId: SESSION, revision: 3, changed: true, proctors: [{ elligbleId: 'ELG-ABCD-EFGH-JKMN' }], demoted: [], replayed: false });
    fireEvent.click(within(screen.getByTestId('institution-room-Ruang 1')).getByRole('button', { name: 'Atur Pengawas' }));
    const dialog = await screen.findByRole('dialog', { name: 'Atur Pengawas Ruang 1' });
    expect(within(dialog).getByText('Pengawas hanya melihat peserta di ruang ini. Satu pengawas bertugas di satu ruang pada sesi ini.')).toBeTruthy();
    const field = within(dialog).getByLabelText('ELLIGBLE ID pengawas');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus pengawas.satu' }));
    expect(within(dialog).queryByText('pengawas.satu')).toBeNull();
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: ' ELG-ABCD-EFGH-JKMN ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambahkan' }));
    fireEvent.change(field, { target: { value: 'tidak.ada' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.change(field, { target: { value: 'elg-abcd-efgh-jkmn' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambahkan' }));
    expect(within(dialog).getAllByRole('button', { name: /^Hapus / }).map(b => b.getAttribute('aria-label'))).toEqual(['Hapus ELG-ABCD-EFGH-JKMN', 'Hapus tidak.ada']);
    const save = within(dialog).getByRole('button', { name: 'Simpan Pengawas' });
    fireEvent.click(save);
    expect(await within(dialog).findByText('2 ELLIGBLE ID tidak ditemukan di sekolah ini: ELG-ABCD-EFGH-JKMN, tidak.ada.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(save));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus tidak.ada' }));
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [first, second] = vi.mocked(postInstitutionRoomProctors).mock.calls.map(c => c[0]);
    expect(first).toEqual({ sessionId: SESSION, roomLabel: 'Ruang 1', proctorElligbleIds: ['ELG-ABCD-EFGH-JKMN', 'tidak.ada'], expectedRevision: 2, actionKey: expect.stringMatching(UUID) });
    expect(second).toEqual({ ...first, proctorElligbleIds: ['ELG-ABCD-EFGH-JKMN'] });
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Pengawas Ruang 1 tersimpan.');
    await waitFor(() => expect(document.activeElement).toBe(notice));
  });

  it('"Tambah Peserta <mapel> · <rombel>": conflicts disabled, the room required, the READY notice and the demotion notice', async () => {
    await openRooms(view({ exams: [exam({ lifecycleState: 'READY' })] }));
    vi.mocked(postInstitutionParticipants).mockResolvedValueOnce({ examInstanceId: EXAM, revision: 3, added: [{ enrollmentId: EN1, elligbleId: 'siswa.baru' }], demoted: [EXAM], replayed: false });
    fireEvent.click(within(screen.getByTestId(`institution-room-exam-${EXAM}`)).getByRole('button', { name: 'Tambah Peserta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tambah Peserta Matematika · X-1' });
    expect((within(dialog).getByRole('checkbox', { name: /siswa\.bentrok/ }) as HTMLInputElement).disabled).toBe(true);
    expect(within(dialog).getByText('Bentrok jadwal')).toBeTruthy();
    expect(within(dialog).getByText(/akan diperiksa ulang/)).toBeTruthy();
    const select = within(dialog).getByLabelText('Ruang') as HTMLSelectElement;
    expect(select.value).toBe('Ruang 1');
    const add = within(dialog).getByRole('button', { name: 'Tambah Peserta' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /siswa\.baru/ }));
    fireEvent.change(select, { target: { value: '' } });
    expect(add.disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'Ruang 1' } });
    fireEvent.click(add);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(vi.mocked(postInstitutionParticipants).mock.calls[0][0]).toEqual({
      examInstanceId: EXAM, enrollmentIds: [EN1], roomLabel: 'Ruang 1', expectedRevision: 2, actionKey: expect.stringMatching(UUID),
    });
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Peserta ditambahkan: 1 siswa.Ujian Matematika · X-1 kembali ke Terjadwal dan perlu ditandai siap lagi.');
    await waitFor(() => expect(document.activeElement).toBe(notice));
  });

  it('without rooms the addition says to add a room first', async () => {
    await openRooms(view({ rooms: [] }));
    fireEvent.click(within(screen.getByTestId(`institution-room-exam-${EXAM}`)).getByRole('button', { name: 'Tambah Peserta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tambah Peserta Matematika · X-1' });
    expect(within(dialog).getByText('Tambahkan ruang lebih dulu.')).toBeTruthy();
    expect(within(dialog).queryByLabelText('Ruang')).toBeNull();
    expect(within(dialog).queryByText(/akan diperiksa ulang/)).toBeNull();
  });
});

describe('the copy', () => {
  it('every room problem and refusal has its frozen copy', () => {
    const p = (code: string, extra: { count?: number; elligbleIds?: string[] } = {}) => roomProblemText({ code: code as never, ...extra });
    expect(p('room_label_invalid')).toBe('Nama ruang wajib diisi, paling banyak 60 karakter.');
    expect(p('room_conflict')).toBe('Ruang ini sudah dipakai sesi lain pada waktu yang sama.');
    expect(p('room_unknown')).toBe('Ruang ini belum berisi peserta. Muat ulang halaman.');
    expect(p('already_in_room')).toBe('Peserta yang dipilih sudah berada di ruang ini.');
    expect(p('participant_unknown')).toBe('Data pilihan sudah berubah. Muat ulang halaman, lalu pilih lagi.');
    expect(p('proctor_unknown', { elligbleIds: ['tidak.ada'] })).toBe('ELLIGBLE ID ini tidak ditemukan di sekolah ini: tidak.ada.');
    expect(p('proctor_unknown', { elligbleIds: ['a.satu', 'b.dua'] })).toBe('2 ELLIGBLE ID tidak ditemukan di sekolah ini: a.satu, b.dua.');
    expect(p('proctor_ineligible', { elligbleIds: ['siswa.satu'] })).toBe('Pengawas harus anggota sekolah yang bukan siswa dan bukan peserta ujian pada waktu yang sama: siswa.satu.');
    expect(p('proctor_other_room', { elligbleIds: ['pengawas.satu'] })).toBe('Pengawas ini sudah bertugas di ruang lain pada sesi ini: pengawas.satu.');
    expect(p('proctor_schedule_conflict', { count: 1, elligbleIds: ['pengawas.dua'] })).toBe('1 pengawas sudah bertugas di ujian lain pada waktu yang sama.');
    expect(p('not_enrolled', { count: 2 })).toBe('2 siswa tidak terdaftar di rombel ini pada tanggal sesi.');
    expect(p('already_participant', { count: 1250 })).toBe('1.250 siswa sudah menjadi peserta ujian ini.');
    expect(p('schedule_conflict', { count: 3 })).toBe('3 siswa sudah dijadwalkan di ujian lain pada waktu yang sama.');
    const refusal = (status: number, code: string, data?: unknown) => roomFailureMessages(new ApiError(status, code, undefined, data));
    expect(refusal(409, 'stale_assignment', { revision: 4 })).toEqual(['Penempatan ruang baru saja diubah. Muat ulang untuk melihat penempatan terbaru.']);
    expect(refusal(409, 'invalid_state')).toEqual(['Status ujian sudah berubah. Muat ulang halaman.']);
    expect(refusal(400, 'invalid_request')).toEqual(['Isian belum lengkap atau tidak valid. Periksa lagi.']);
    expect(refusal(409, 'action_key_reused')).toEqual(['Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.']);
    expect(refusal(409, 'state_changed')).toEqual(['Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.']);
    expect(refusal(403, 'forbidden')).toEqual(['Anda tidak berwenang mengatur ujian sekolah ini.']);
    const connection = ['Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda.'];
    expect(refusal(503, 'persistence_unavailable')).toEqual(connection);
    expect(roomFailureMessages(new TypeError('Failed to fetch'))).toEqual(connection);
    expect(refusal(422, 'room_invalid', { problems: [{ code: 'not_enrolled', count: 1 }, { code: 'room_label_invalid' }, { code: 'room_label_invalid' }] }))
      .toEqual(['1 siswa tidak terdaftar di rombel ini pada tanggal sesi.', 'Nama ruang wajib diisi, paling banyak 60 karakter.']);
  });

  it('no em dash in the copy of the new and changed screens', () => {
    const sources = import.meta.glob(['../components/InstitutionRoomManagementView.tsx', '../components/InstitutionExamView.tsx', '../components/ParticipantChoiceList.tsx',
      '../components/ui/metric.tsx', '../hooks/useDialogAction.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(sources)).toHaveLength(5);
    for (const [path, text] of Object.entries(sources)) expect(text.includes('—'), path).toBe(false);
  });
});

describe('the shared primitives', () => {
  it('ParticipantChoiceList keys a row by its id and shows a note; a row without them renders as before', () => {
    const toggled: string[] = [];
    const { container, rerender } = render(
      <ParticipantChoiceList participants={[{ enrollmentId: EN1, elligbleId: 'siswa.baru', conflict: false }, { enrollmentId: EN2, elligbleId: 'siswa.bentrok', conflict: true }]}
        isChosen={id => id === EN1} onToggle={id => toggled.push(id)} conflictsDisabled />);
    const before = container.innerHTML;
    expect(before).not.toContain('text-muted-foreground break-words');
    fireEvent.click(screen.getByRole('checkbox', { name: /siswa\.baru/ }));
    expect(toggled).toEqual([EN1]);
    rerender(
      <ParticipantChoiceList participants={[{ id: Q1, elligbleId: 'siswa.empat', conflict: false, note: 'Ruang Laboratorium Bahasa' }]}
        isChosen={id => id === Q1} onToggle={id => toggled.push(id)} />);
    const row = screen.getByRole('checkbox', { name: /siswa\.empat/ }) as HTMLInputElement;
    expect(row.checked).toBe(true);
    const note = screen.getByText('Ruang Laboratorium Bahasa');
    expect(note.className).not.toContain('overflow-wrap');
    fireEvent.click(row);
    expect(toggled).toEqual([EN1, Q1]);
  });

  it('MetricList keeps its default classes and gives the narrowFirst grid as the import summary had it', () => {
    const { container } = render(
      <>
        <MetricList aria-label="biasa"><Metric label="A" value={1} /></MetricList>
        <MetricList aria-label="sempit" layout="narrowFirst"><Metric className="min-w-0" label="B" value={2} /></MetricList>
      </>,
    );
    expect(screen.getByLabelText('biasa').className).toBe('m-0 grid grid-cols-2 gap-3 sm:grid-cols-4');
    expect(screen.getByLabelText('sempit').className).toBe('m-0 grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-4');
    expect(container.innerHTML).not.toContain('overflow-wrap');
  });
});
