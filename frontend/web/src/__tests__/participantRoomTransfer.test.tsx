/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { OPERATOR_SOURCE } from '../components/SchoolExamMonitoringView';
import { ExamMonitoringView, SUPERVISOR_SOURCE, type MonitoringSource } from '../components/ExamMonitoringView';
import { ParticipantRoomTransferDialog, canTransfer, transferRefusalCopy, transferTargets } from '../components/ParticipantRoomTransferDialog';
import { setDisplayTimeZone } from '../lib/format';
import { ApiError, getExamMonitoring, getInstitutionSupervisionExam, postInstitutionRoomTransfer } from '../api/assessment-client';
import type { ExamMonitoringResponse, MonitoredParticipant, ParticipantRoomTransferResult } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return { ...actual, getInstitutionSupervisionExam: vi.fn(), getExamMonitoring: vi.fn(), postInstitutionRoomTransfer: vi.fn() };
});

// ASSESS-ROOM-001 C05 (and C02 for the client): when "Pindahkan Ruang" shows and when it does not, a locked participant
// included; the dialog with its target choice, the ACTIVE and PAUSED copy (F6), the reason, one action key on retries,
// the retry focus and the focus after success (never BODY, also when the refresh removed the row action); every refusal
// copy with "Perbarui" after stale_assignment; and every other source renders no new action.

const EXAM = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d01';
const P1 = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d11';
const P2 = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d12';
const ROOM_1 = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d21';
const ROOM_2 = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d22';
const ROOM_3 = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d23';
const ROOM_10 = '0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d24';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REASON = 'Perangkat ruang bermasalah';
const ACTIVE_COPY = 'Peserta tetap mengerjakan ujian yang sama di perangkat yang sama. Jawaban dan sesi ujiannya tidak berubah. Sisa waktunya tetap berjalan selama pindah.';
const PAUSED_COPY = 'Peserta tetap mengerjakan ujian yang sama di perangkat yang sama. Jawaban dan sesi ujiannya tidak berubah. Ujian sedang dijeda, jadi sisa waktunya tetap berhenti sampai ujian dilanjutkan.';
const ROOMS = [
  { roomId: ROOM_1, label: 'Ruang 1', supervised: true },
  { roomId: ROOM_10, label: 'Ruang 10', supervised: true },
  { roomId: ROOM_2, label: 'Ruang 2', supervised: true },
  { roomId: ROOM_3, label: 'Ruang 3', supervised: false },
];

function participant(overrides: Partial<MonitoredParticipant> = {}): MonitoredParticipant {
  return {
    participantId: P1, elligbleId: 'siswa.satu', roomLabel: 'Ruang 1', status: 'ACTIVE', finalizationSource: null, submittedAt: null,
    remainingSeconds: 1800, answeredCount: 1, lastAcceptedAt: null, sessionActive: true, sessionMoves: 0, lockedAt: null, addedSeconds: 0,
    roomId: ROOM_1, assignmentVersion: 1, ...overrides,
  };
}

function monitoring(overrides: Partial<ExamMonitoringResponse> = {}): ExamMonitoringResponse {
  return {
    exam: { examInstanceId: EXAM, subjectLabel: 'Matematika', lifecycleState: 'ACTIVE', roomBased: true, pausedAt: null },
    scope: 'OPERATOR', canAddTime: true, serverTime: '2026-11-11T01:05:00.000Z', questionCount: 2,
    summary: { participants: 1, notStarted: 0, active: 1, submitted: 0 }, participants: [participant()],
    rooms: ROOMS, broadcasts: [], ...overrides,
  };
}

function receipt(overrides: Partial<ParticipantRoomTransferResult> = {}): ParticipantRoomTransferResult {
  return {
    examInstanceId: EXAM, participantId: P1, fromRoomLabel: 'Ruang 1', roomLabel: 'Ruang 2', assignmentVersion: 2,
    transferredAt: '2026-11-11T01:10:00.000Z', revision: 4, replayed: false, ...overrides,
  };
}

async function openOperator(value: ExamMonitoringResponse = monitoring()) {
  vi.mocked(getInstitutionSupervisionExam).mockResolvedValue(value);
  render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali ke Pelaksanaan Sesi" onBack={() => {}} source={OPERATOR_SOURCE} refreshIntervalMs={60_000} />);
  await screen.findByRole('heading', { level: 1, name: 'Pemantauan Peserta' });
  await screen.findByText(value.participants[0]?.elligbleId ?? 'Tidak ada peserta dalam cakupan pengawasan Anda.');
}

async function openDialog(id = 'siswa.satu') {
  fireEvent.click(await screen.findByRole('button', { name: `Pindahkan ruang ${id}` }));
  return screen.findByRole('dialog', { name: `Pindahkan ${id} ke Ruang Lain?` });
}

function fill(dialog: HTMLElement, roomLabel = 'Ruang 2', reason = REASON) {
  fireEvent.change(within(dialog).getByLabelText('Ruang tujuan'), { target: { value: ROOMS.find(r => r.label === roomLabel)!.roomId } });
  fireEvent.change(within(dialog).getByLabelText('Alasan tindakan'), { target: { value: reason } });
}

beforeEach(() => {
  vi.clearAllMocks();
  setDisplayTimeZone('Asia/Jakarta');
});
afterEach(() => setDisplayTimeZone(null));

describe('when "Pindahkan Ruang" shows (§4.5)', () => {
  const exam = { lifecycleState: 'ACTIVE', roomBased: true };
  it('a participant not started or working with a room, in an ACTIVE or PAUSED room-based exam with another supervised room', () => {
    expect(canTransfer(participant(), exam, ROOMS)).toBe(true);
    expect(canTransfer(participant({ status: 'NOT_STARTED', remainingSeconds: null }), exam, ROOMS)).toBe(true);
    expect(canTransfer(participant({ lockedAt: '2026-11-11T01:00:00.000Z' }), exam, ROOMS)).toBe(true);
    expect(canTransfer(participant(), { lifecycleState: 'PAUSED', roomBased: true }, ROOMS)).toBe(true);
  });

  it('never for a submitted or timed-out participant, one without a room, without another supervised room, or outside ACTIVE and PAUSED', () => {
    expect(canTransfer(participant({ status: 'SUBMITTED' }), exam, ROOMS)).toBe(false);
    expect(canTransfer(participant({ status: 'TIME_UP' }), exam, ROOMS)).toBe(false);
    expect(canTransfer(participant({ roomId: null }), exam, ROOMS)).toBe(false);
    expect(canTransfer(participant({ assignmentVersion: null }), exam, ROOMS)).toBe(false);
    expect(canTransfer(participant(), exam, [ROOMS[0], ROOMS[3]])).toBe(false);
    expect(canTransfer(participant(), exam, ROOMS.map(r => ({ roomId: r.roomId, label: r.label })))).toBe(false);
    for (const lifecycleState of ['SCHEDULED', 'READY', 'ENDED', 'FINALIZED']) expect(canTransfer(participant(), { lifecycleState, roomBased: true }, ROOMS)).toBe(false);
    expect(canTransfer(participant(), { lifecycleState: 'ACTIVE', roomBased: false }, ROOMS)).toBe(false);
  });

  it('the targets are the other supervised rooms, ordered by label', () => {
    expect(transferTargets(ROOMS, ROOM_1).map(r => r.label)).toEqual(['Ruang 2', 'Ruang 10']);
    expect(transferTargets(ROOMS, ROOM_2).map(r => r.label)).toEqual(['Ruang 1', 'Ruang 10']);
  });

  it('the Operator row shows it, with a 44 px wrapping target, also for a locked participant; a submitted one has none', async () => {
    await openOperator(monitoring({
      participants: [participant({ lockedAt: '2026-11-11T01:00:00.000Z' }), participant({ participantId: P2, elligbleId: 'siswa.dua', status: 'SUBMITTED', submittedAt: '2026-11-11T01:04:00.000Z', remainingSeconds: null })],
    }));
    const action = screen.getByRole('button', { name: 'Pindahkan ruang siswa.satu' });
    expect(action.textContent).toBe('Pindahkan Ruang');
    expect(action.className).toContain('min-h-11');
    expect(action.className).toContain('h-auto');
    expect(action.className).toContain('whitespace-normal');
    expect(screen.queryByRole('button', { name: 'Pindahkan ruang siswa.dua' })).toBeNull();
  });

  it('every other source renders no new action, even when the rooms carry coverage (C02)', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring({ scope: 'PROCTOR', canAddTime: false }));
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    await screen.findByText('siswa.satu');
    expect(screen.queryByRole('button', { name: /Pindahkan ruang/ })).toBeNull();
    expect(screen.queryByText('Pindahkan Ruang')).toBeNull();
    expect(SUPERVISOR_SOURCE.transfer).toBeUndefined();
    const custom: MonitoringSource = { ...OPERATOR_SOURCE, transfer: undefined };
    vi.mocked(getInstitutionSupervisionExam).mockResolvedValue(monitoring());
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali lagi" onBack={() => {}} source={custom} />);
    await waitFor(() => expect(screen.getAllByText('siswa.satu')).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: 'Kunci pengerjaan siswa.satu' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Pindahkan ruang/ })).toBeNull();
  });
});

describe('the transfer dialog', () => {
  it('ACTIVE: the current room, the targets, the copy; it sends the version read with one action key on retries, then focus returns to the row action', async () => {
    await openOperator();
    const dialog = await openDialog();
    expect(within(dialog).getByText('Ruang saat ini: Ruang 1.')).toBeTruthy();
    const select = within(dialog).getByLabelText('Ruang tujuan') as HTMLSelectElement;
    expect([...select.options].map(o => o.textContent)).toEqual(['Pilih ruang', 'Ruang 2', 'Ruang 10']);
    expect(within(dialog).getByText(ACTIVE_COPY)).toBeTruthy();
    expect(within(dialog).getByText('Setelah dipindahkan, pengawas Ruang 1 tidak lagi melihat peserta ini.')).toBeTruthy();
    expect(within(dialog).getByText('Siswa tidak menerima pemberitahuan otomatis. Sampaikan langsung atau kirim pesan.')).toBeTruthy();
    expect(dialog.textContent).not.toContain('—');
    const send = within(dialog).getByRole('button', { name: 'Pindahkan Peserta' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(select, { target: { value: ROOM_2 } });
    expect(send.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Alasan tindakan'), { target: { value: REASON } });
    expect(send.disabled).toBe(false);

    vi.mocked(postInstitutionRoomTransfer).mockRejectedValueOnce(new TypeError('offline'));
    fireEvent.click(send);
    expect(await within(dialog).findByText('Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Pindahkan Peserta' })));

    vi.mocked(postInstitutionRoomTransfer).mockResolvedValueOnce(receipt());
    vi.mocked(getInstitutionSupervisionExam).mockResolvedValue(monitoring({ participants: [participant({ roomLabel: 'Ruang 2', roomId: ROOM_2, assignmentVersion: 2 })] }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pindahkan Peserta' }));
    const shown = await screen.findByText('siswa.satu dipindahkan dari Ruang 1 ke Ruang 2.');
    expect(shown.getAttribute('role')).toBe('status');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [first, second] = vi.mocked(postInstitutionRoomTransfer).mock.calls.map(c => c[0]);
    expect(first).toEqual({
      examInstanceId: EXAM, participantId: P1, targetRoomId: ROOM_2, expectedAssignmentVersion: 1, reason: REASON, confirmed: true, actionKey: expect.stringMatching(UUID),
    });
    expect(second).toEqual(first);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pindahkan ruang siswa.satu' })));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('PAUSED: the time stays frozen until the exam resumes (F6)', async () => {
    await openOperator(monitoring({ exam: { examInstanceId: EXAM, subjectLabel: 'Matematika', lifecycleState: 'PAUSED', roomBased: true, pausedAt: '2026-11-11T01:00:00.000Z' } }));
    const dialog = await openDialog();
    expect(within(dialog).getByText(PAUSED_COPY)).toBeTruthy();
    expect(within(dialog).queryByText(ACTIVE_COPY)).toBeNull();
  });

  it('a new opening starts empty with a new action key; "Batal" returns focus to the row action', async () => {
    vi.mocked(postInstitutionRoomTransfer).mockRejectedValue(new ApiError(409, 'state_changed'));
    await openOperator();
    let dialog = await openDialog();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pindahkan Peserta' }));
    await within(dialog).findByText('Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pindahkan ruang siswa.satu' })));
    dialog = await openDialog();
    expect((within(dialog).getByLabelText('Ruang tujuan') as HTMLSelectElement).value).toBe('');
    expect((within(dialog).getByLabelText('Alasan tindakan') as HTMLTextAreaElement).value).toBe('');
    expect(within(dialog).queryByRole('alert')).toBeNull();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pindahkan Peserta' }));
    await within(dialog).findByText('Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.');
    const [first, second] = vi.mocked(postInstitutionRoomTransfer).mock.calls.map(c => c[0]);
    expect(second.actionKey).not.toBe(first.actionKey);
  });

  it('when the refresh removes the row action, focus goes to "Perbarui", never BODY', async () => {
    await openOperator();
    const dialog = await openDialog();
    fill(dialog);
    vi.mocked(postInstitutionRoomTransfer).mockResolvedValueOnce(receipt());
    // The refresh after the move finds the participant submitted meanwhile: the row action is gone.
    vi.mocked(getInstitutionSupervisionExam).mockResolvedValue(monitoring({
      participants: [participant({ status: 'SUBMITTED', submittedAt: '2026-11-11T01:09:00.000Z', remainingSeconds: null, roomLabel: 'Ruang 2', roomId: ROOM_2, assignmentVersion: 2 })],
    }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pindahkan Peserta' }));
    await screen.findByText('siswa.satu dipindahkan dari Ruang 1 ke Ruang 2.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Pindahkan ruang siswa.satu' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Perbarui' })));
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('the refusal copy (§4.5)', () => {
  const OWN: Array<[string, string]> = [
    ['stale_assignment', 'Ruang peserta ini baru saja diubah. Pilih Perbarui untuk melihat ruang terbaru.'],
    ['already_in_room', 'Peserta sudah berada di ruang ini.'],
    ['target_room_unsupervised', 'Ruang tujuan belum punya pengawas, jadi peserta tidak dapat dipindahkan ke sana.'],
    ['participant_without_room', 'Peserta ini belum punya ruang, jadi tidak dapat dipindahkan.'],
    ['attempt_already_submitted', 'Peserta sudah mengumpulkan jawaban, jadi tidak dapat dipindahkan.'],
    ['time_up', 'Waktu peserta sudah habis, jadi tidak dapat dipindahkan.'],
  ];
  const SHARED: Array<[ApiError | Error, string]> = [
    [new ApiError(409, 'invalid_state'), 'Status ujian sudah berubah. Pilih Perbarui untuk melihat status terbaru.'],
    [new ApiError(409, 'room_setup_required'), 'Ruang dan pengawas ujian ini belum diatur. Atur lewat Ruang dan Pengawas.'],
    [new ApiError(400, 'invalid_request'), 'Isian belum lengkap atau tidak valid. Periksa lagi.'],
    [new ApiError(409, 'action_key_reused'), 'Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.'],
    [new ApiError(409, 'state_changed'), 'Tindakan ini bertabrakan dengan perubahan lain. Muat ulang, lalu coba lagi.'],
    [new ApiError(403, 'forbidden'), 'Anda tidak berwenang mengatur ujian sekolah ini.'],
    [new ApiError(503, 'persistence_unavailable'), 'Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda.'],
    [new TypeError('offline'), 'Perubahan belum tersimpan karena koneksi terputus. Coba lagi: mencoba lagi tidak membuat data ganda.'],
  ];

  it('names every transfer code; no copy carries an em dash', () => {
    for (const [code, copy] of OWN) expect(transferRefusalCopy(code)).toBe(copy);
    for (const code of ['invalid_state', 'room_setup_required', 'forbidden', 'invalid_request']) expect(transferRefusalCopy(code)).toBeNull();
    for (const [, copy] of [...OWN, ...SHARED]) expect(copy).not.toContain('—');
  });

  it('each refusal shows in the dialog, wrapping, with the retry action focused', async () => {
    const p = participant();
    for (const [error, copy] of [...OWN.map(([code, text]) => [new ApiError(409, code), text] as [ApiError, string]), ...SHARED]) {
      vi.mocked(postInstitutionRoomTransfer).mockRejectedValueOnce(error);
      const { unmount } = render(
        <ParticipantRoomTransferDialog participant={p} examInstanceId={EXAM} examState="ACTIVE" rooms={ROOMS} source={OPERATOR_SOURCE.transfer!}
          onClose={() => {}} onDone={() => {}} restoreFocus={() => false} />);
      const dialog = await screen.findByRole('dialog', { name: 'Pindahkan siswa.satu ke Ruang Lain?' });
      fill(dialog);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Pindahkan Peserta' }));
      const text = await within(dialog).findByText(copy);
      expect(text.closest('[data-slot="alert-description"]')?.className).toContain('break-words');
      expect(text.closest('[data-slot="alert-description"]')?.className).toContain('min-w-0');
      await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Pindahkan Peserta' })));
      unmount();
    }
  });

  it('a stale move tells the Operator to choose "Perbarui"; the list offers it', async () => {
    vi.mocked(postInstitutionRoomTransfer).mockRejectedValueOnce(new ApiError(409, 'stale_assignment', undefined, { assignmentVersion: 2, roomLabel: 'Ruang 2' }));
    await openOperator();
    const dialog = await openDialog();
    fill(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pindahkan Peserta' }));
    expect(await within(dialog).findByText('Ruang peserta ini baru saja diubah. Pilih Perbarui untuk melihat ruang terbaru.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Perbarui' })).toBeTruthy();
  });
});
