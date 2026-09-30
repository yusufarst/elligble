import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { ExamMonitoringView } from '../components/ExamMonitoringView';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation';
import { ApiError, getExamMonitoring, postParticipantTime } from '../api/assessment-client';
import { setDisplayTimeZone } from '../lib/format';
import { clearAddedTime, takeNewlyAddedSeconds } from '../exam/time-added';
import { openAnswerStore } from '../exam/answer-store';
import { storeExamSessionId } from '../exam/exam-session';
import type { ExamMonitoringResponse, MonitoredParticipant, ResumeResponse, TimerResponse } from '../types/assessment';

vi.mock('../api/assessment-client', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client')>('../api/assessment-client');
  return { ...actual, getExamMonitoring: vi.fn(), postParticipantTime: vi.fn() };
});

// Add time for one participant (ASSESS-PROCTOR-004; D04.6-41, D04.2-78/79, D04.6-64): the
// managing teacher enters minutes and a reason and confirms; a retry keeps the action key;
// every supervisor sees that time was added, only the teacher who and why; the student is
// told once, without the reason.

const EXAM = '5f0c7b8e-1d2a-4c3b-8e9f-0a1b2c3d4e5f';
const WORKING = '1c9b2d3e-4f5a-4b6c-9d7e-8f9a0b1c2d3e';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function participant(overrides: Partial<MonitoredParticipant>): MonitoredParticipant {
  return {
    participantId: WORKING, elligbleId: 'siswa.b', roomLabel: null, status: 'ACTIVE', finalizationSource: null, submittedAt: null,
    remainingSeconds: 2530, answeredCount: 1, lastAcceptedAt: '2026-09-30T01:12:00.000Z', sessionActive: true, sessionMoves: 0, lockedAt: null,
    addedSeconds: 0, ...overrides,
  };
}

function monitoring(overrides: Partial<ExamMonitoringResponse> = {}, lifecycleState = 'ACTIVE'): ExamMonitoringResponse {
  return {
    exam: { examInstanceId: EXAM, subjectLabel: 'Sejarah', lifecycleState, roomBased: false, pausedAt: null },
    scope: 'TEACHER',
    canAddTime: true,
    serverTime: '2026-09-30T01:14:07.000Z',
    questionCount: 3,
    summary: { participants: 4, notStarted: 1, active: 2, submitted: 1 },
    participants: [
      participant({ participantId: '0b8a1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d', elligbleId: 'siswa.a', status: 'SUBMITTED', submittedAt: '2026-09-30T01:05:00.000Z', remainingSeconds: null, sessionActive: false, timeAdditions: [] }),
      participant({ timeAdditions: [] }),
      participant({ participantId: '2dac3e4f-5a6b-4c7d-8e8f-9a0b1c2d3e4f', elligbleId: 'siswa.c', status: 'NOT_STARTED', remainingSeconds: null, answeredCount: 0, lastAcceptedAt: null, sessionActive: false, timeAdditions: [] }),
      participant({ participantId: '3ebd4f5a-6b7c-4d8e-9f9a-0b1c2d3e4f5a', elligbleId: 'siswa.d', status: 'TIME_UP', remainingSeconds: 0, timeAdditions: [] }),
    ],
    ...overrides,
  };
}

const rows = () => screen.getAllByRole('rowheader').map(h => h.closest('tr')!);
const confirmButton = (dialog: HTMLElement) => within(dialog).getAllByRole('button').find(b => /^Tambah/.test(b.textContent ?? ''))! as HTMLButtonElement;

async function openDialog() {
  await screen.findByRole('heading', { name: 'Pemantauan Peserta' });
  fireEvent.click(screen.getByRole('button', { name: 'Tambah waktu siswa.b' }));
  return screen.findByRole('dialog');
}

describe('adding time on the monitoring screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => setDisplayTimeZone(null));

  it('the managing teacher adds minutes with a reason to one working participant', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring());
    vi.mocked(postParticipantTime).mockResolvedValue({
      participantId: WORKING, addedSeconds: 600, totalAddedSeconds: 600, remainingSeconds: 3130, addedAt: '2026-09-30T01:15:00.000Z', replayed: false,
    });
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'Pemantauan Peserta' });
    // Only someone still working: not the submitted, not started or timed-out rows.
    const [a, , c, d] = rows();
    for (const row of [a, c, d]) expect(within(row).queryByRole('button', { name: /Tambah waktu/ })).toBeNull();

    const dialog = await openDialog();
    expect(within(dialog).getByRole('heading', { name: 'Tambah Waktu Peserta' })).toBeTruthy();
    expect(within(dialog).getByText(/hanya berlaku untuk peserta ini/)).toBeTruthy();
    expect(within(dialog).getByText(/tidak dapat dibatalkan/)).toBeTruthy();
    expect(within(dialog).getByText('siswa.b')).toBeTruthy();
    expect(within(dialog).getByText('Sisa waktu saat ini sekitar 42 menit.')).toBeTruthy();
    expect(confirmButton(dialog).disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText('Tambahan waktu (menit)'), { target: { value: '10' } });
    expect(confirmButton(dialog).textContent).toBe('Tambah 10 Menit');
    expect(confirmButton(dialog).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Alasan'), { target: { value: '  Listrik   padam ' } });
    expect(confirmButton(dialog).disabled).toBe(false);
    fireEvent.click(confirmButton(dialog));

    expect(await screen.findByText('Waktu siswa.b ditambah 10 menit. Sisa waktunya sekarang 52 menit.')).toBeTruthy();
    const sent = vi.mocked(postParticipantTime).mock.calls[0][0];
    expect({ ...sent, actionKey: undefined }).toEqual({ examInstanceId: EXAM, participantId: WORKING, minutes: 10, reason: 'Listrik padam', actionKey: undefined });
    expect(sent.actionKey).toMatch(UUID);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(vi.mocked(getExamMonitoring).mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(document.body.textContent).not.toContain('—');
  });

  it('accepts only 1 to 120 whole minutes and a reason', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring());
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Alasan'), { target: { value: 'Listrik padam' } });
    for (const value of ['0', '121', '1.5', '-5', '']) {
      fireEvent.change(within(dialog).getByLabelText('Tambahan waktu (menit)'), { target: { value } });
      expect(confirmButton(dialog).disabled).toBe(true);
    }
    fireEvent.change(within(dialog).getByLabelText('Tambahan waktu (menit)'), { target: { value: '120' } });
    expect(confirmButton(dialog).disabled).toBe(false);
    fireEvent.change(within(dialog).getByLabelText('Alasan'), { target: { value: ' \n ' } });
    expect(confirmButton(dialog).disabled).toBe(true);
    expect(postParticipantTime).not.toHaveBeenCalled();
  });

  it('keeps the action key when trying again after a lost connection, and takes a new one for the next addition', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring());
    vi.mocked(postParticipantTime)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ participantId: WORKING, addedSeconds: 300, totalAddedSeconds: 300, remainingSeconds: 2800, addedAt: '2026-09-30T01:15:00.000Z', replayed: true });
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    let dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Tambahan waktu (menit)'), { target: { value: '5' } });
    fireEvent.change(within(dialog).getByLabelText('Alasan'), { target: { value: 'Perangkat diganti' } });
    fireEvent.click(confirmButton(dialog));
    expect(await within(dialog).findByText(/mencoba lagi tidak menambah waktu dua kali/)).toBeTruthy();
    fireEvent.click(confirmButton(dialog));
    expect(await screen.findByText('Tambahan 5 menit untuk siswa.b sudah tercatat sebelumnya; tidak ada tambahan baru.')).toBeTruthy();
    const [first, second] = vi.mocked(postParticipantTime).mock.calls.map(c => c[0].actionKey);
    expect(second).toBe(first);

    dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Tambahan waktu (menit)'), { target: { value: '5' } });
    fireEvent.change(within(dialog).getByLabelText('Alasan'), { target: { value: 'Perangkat diganti' } });
    fireEvent.click(confirmButton(dialog));
    await waitFor(() => expect(postParticipantTime).toHaveBeenCalledTimes(3));
    expect(vi.mocked(postParticipantTime).mock.calls[2][0].actionKey).not.toBe(first);
  });

  it('explains a refusal and reads the list again', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring());
    const refusals: Array<[string, string]> = [
      ['time_up', 'Waktu siswa.b sudah habis dan jawabannya dikumpulkan otomatis, sehingga waktunya tidak dapat ditambah.'],
      ['no_active_attempt', 'siswa.b sudah tidak memiliki pengerjaan yang berjalan.'],
      ['invalid_state', 'Status ujian telah berubah. Waktu hanya dapat ditambah saat ujian berlangsung atau dijeda.'],
      ['action_key_reused', 'Permintaan tadi mungkin sudah tercatat. Periksa tambahan waktu peserta ini sebelum mencoba lagi.'],
      ['forbidden', 'Hanya guru yang mengelola ujian ini yang dapat menambah waktu.'],
    ];
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    for (const [code, text] of refusals) {
      vi.mocked(postParticipantTime).mockRejectedValueOnce(new ApiError(code === 'forbidden' ? 403 : 409, code));
      const dialog = await openDialog();
      fireEvent.change(within(dialog).getByLabelText('Tambahan waktu (menit)'), { target: { value: '5' } });
      fireEvent.change(within(dialog).getByLabelText('Alasan'), { target: { value: 'Listrik padam' } });
      fireEvent.click(confirmButton(dialog));
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  it('shows every supervisor that time was added, and the teacher who added it and why', async () => {
    const additions = [
      { addedAt: '2026-09-30T01:10:00.000Z', seconds: 600, reason: 'Listrik padam', by: { elligbleId: 'guru.sejarah', you: true } },
      { addedAt: '2026-09-30T01:12:00.000Z', seconds: 300, reason: 'Perangkat diganti', by: { elligbleId: 'guru.lain', you: false } },
    ];
    const teacherView = monitoring();
    teacherView.participants[1] = participant({ addedSeconds: 900, timeAdditions: additions });
    vi.mocked(getExamMonitoring).mockResolvedValue(teacherView);
    const view = render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'Pemantauan Peserta' });
    expect(within(rows()[1]).getByText('Waktu ditambah 15 menit')).toBeTruthy();
    const dialog = await openDialog();
    expect(within(dialog).getByText('Tambahan sebelumnya')).toBeTruthy();
    const items = within(dialog).getAllByRole('listitem').map(li => li.textContent);
    expect(items).toEqual(['08.10 WIB · 10 menit · Anda: Listrik padam', '08.12 WIB · 5 menit · guru.lain: Perangkat diganti']);
    view.unmount();

    // An assigned proctor sees the addition, not who or why, and cannot add time.
    const proctorView = monitoring({ scope: 'PROCTOR', canAddTime: false });
    proctorView.participants = proctorView.participants.map(p => ({ ...p, timeAdditions: undefined }));
    proctorView.participants[1] = participant({ addedSeconds: 900 });
    vi.mocked(getExamMonitoring).mockResolvedValue(proctorView);
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'Pemantauan Peserta' });
    expect(within(rows()[1]).getByText('Waktu ditambah 15 menit')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Tambah waktu/ })).toBeNull();
    expect(document.body.textContent).not.toContain('Listrik padam');
  });

  it('adds time while paused, saying the time runs again on resume, and never after the end', async () => {
    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring({}, 'PAUSED'));
    vi.mocked(postParticipantTime).mockResolvedValue({
      participantId: WORKING, addedSeconds: 180, totalAddedSeconds: 180, remainingSeconds: 2710, addedAt: '2026-09-30T01:15:00.000Z', replayed: false,
    });
    const view = render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    const dialog = await openDialog();
    expect(within(dialog).getByText('Sisa waktu saat ini sekitar 42 menit, berhenti selama ujian dijeda.')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Tambahan waktu (menit)'), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByLabelText('Alasan'), { target: { value: 'Kompensasi' } });
    fireEvent.click(confirmButton(dialog));
    expect(await screen.findByText('Waktu siswa.b ditambah 3 menit. Sisa waktunya sekarang 45 menit dan mulai berjalan lagi saat ujian dilanjutkan.')).toBeTruthy();
    view.unmount();

    vi.mocked(getExamMonitoring).mockResolvedValue(monitoring({}, 'ENDED'));
    render(<ExamMonitoringView examInstanceId={EXAM} backLabel="Kembali" onBack={() => {}} />);
    await screen.findByRole('heading', { name: 'Pemantauan Peserta' });
    expect(screen.queryByRole('button', { name: /Tambah waktu/ })).toBeNull();
  });
});

describe('time added, on the student device', () => {
  const ATTEMPT = '11111111-1111-4111-8111-111111111111';
  const SESSION = '22222222-2222-4222-8222-222222222222';
  const PROMPT = 'Kapan Sumpah Pemuda diikrarkan?';

  function timer(added: number, examState = 'ACTIVE'): TimerResponse {
    return {
      status: 'active', startedAt: '2026-09-30T01:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600 + added,
      effectiveRemainingSeconds: 2530 + added, examState, pausedAt: examState === 'PAUSED' ? '2026-09-30T01:14:00.000Z' : null, lockedAt: null,
    };
  }

  function server(state: { added: number; examState?: string }) {
    const resume: ResumeResponse = {
      attemptId: ATTEMPT,
      session: { status: 'active', activatedAt: '2026-09-30T01:00:00.000Z', ownedByCaller: true },
      answers: [],
      timer: { status: 'active', startedAt: '2026-09-30T01:00:00.000Z', configuredDurationSeconds: 3600, effectiveDurationSeconds: 3600, effectiveRemainingSeconds: 2530 },
      submission: { status: 'not_submitted' },
      context: { subjectLabel: 'Sejarah', roomLabel: null },
      reviewFlags: [],
      exam: { lifecycleState: state.examState ?? 'ACTIVE', pausedAt: state.examState === 'PAUSED' ? '2026-09-30T01:14:00.000Z' : null },
    };
    const question = { snapshotId: '33333333-3333-4333-8333-333333333331', schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: PROMPT, options: [{ id: 'a', content: '1928' }, { id: 'b', content: '1945' }] };
    return vi.fn(async (url: string) => {
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.includes('/api/v1/assessment/resume')) return json(resume);
      if (url.includes('/api/v1/assessment/questions')) return json({ attemptId: ATTEMPT, questions: [question] });
      if (url.includes('/api/v1/assessment/timer')) return json(timer(state.added, state.examState));
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });
  }
  const checkNow = () => act(async () => {
    window.dispatchEvent(new Event('online'));
  });

  beforeEach(async () => {
    window.history.pushState({}, '', `?attemptId=${ATTEMPT}`);
    window.sessionStorage.clear();
    window.localStorage.clear();
    clearAddedTime(ATTEMPT);
    storeExamSessionId(ATTEMPT, SESSION);
    await (await openAnswerStore()).clearAttempt('', ATTEMPT);
    setDisplayTimeZone('Asia/Jakarta');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setDisplayTimeZone(null);
    window.history.pushState({}, '', '/');
  });

  it('says once that time was added, without the reason, and not again after a reload', async () => {
    const state = { added: 0 };
    globalThis.fetch = server(state) as unknown as typeof fetch;
    const view = render(<StudentExamWorkstation />);
    expect(await screen.findByText(PROMPT)).toBeTruthy();
    await checkNow();
    expect(screen.queryByText(/ditambah/)).toBeNull();

    state.added = 600;
    await checkNow();
    expect(await screen.findByText('Waktu pengerjaan Anda ditambah 10 menit.')).toBeTruthy();
    expect(screen.getByLabelText(/Sisa waktu pengerjaan ujian: 52:/)).toBeTruthy();
    await checkNow();
    expect(screen.getAllByText('Waktu pengerjaan Anda ditambah 10 menit.')).toHaveLength(1);
    view.unmount();

    // A reload of the page: the same addition is not announced again; a new one is.
    render(<StudentExamWorkstation />);
    expect(await screen.findByText(PROMPT)).toBeTruthy();
    await checkNow();
    expect(screen.queryByText(/ditambah/)).toBeNull();
    state.added = 900;
    await checkNow();
    expect(await screen.findByText('Waktu pengerjaan Anda ditambah 5 menit.')).toBeTruthy();
  });

  it('says it on the paused screen too, next to the frozen time', async () => {
    const state = { added: 0, examState: 'PAUSED' };
    globalThis.fetch = server(state) as unknown as typeof fetch;
    render(<StudentExamWorkstation />);
    expect(await screen.findByRole('heading', { name: 'Ujian Dijeda' })).toBeTruthy();
    state.added = 180;
    await checkNow();
    expect(await screen.findByText('Waktu pengerjaan Anda ditambah 3 menit.')).toBeTruthy();
    expect(screen.getByText('45:10')).toBeTruthy();
  });

  it('remembers what was announced on the device, and in memory when storage is refused', () => {
    // A new page on a device that announced 10 minutes before: only more is new.
    const reloaded = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const kept = new Map<string, string>([[`elligble.timeAdded.${reloaded}`, '600']]);
    const storage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) } as unknown as Storage;
    expect(takeNewlyAddedSeconds(reloaded, 600, storage)).toBe(0);
    expect(takeNewlyAddedSeconds(reloaded, 900, storage)).toBe(300);
    expect(kept.get(`elligble.timeAdded.${reloaded}`)).toBe('900');
    clearAddedTime(reloaded, storage);
    expect(kept.size).toBe(0);

    const refusing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} } as unknown as Storage;
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    clearAddedTime(id, refusing);
    expect(takeNewlyAddedSeconds(id, 0, refusing)).toBe(0);
    expect(takeNewlyAddedSeconds(id, 600, refusing)).toBe(600);
    expect(takeNewlyAddedSeconds(id, 600, refusing)).toBe(0);
    expect(takeNewlyAddedSeconds(id, 300, refusing)).toBe(0); // an older answer announces nothing
    expect(takeNewlyAddedSeconds(id, 900, refusing)).toBe(300);
  });
});
