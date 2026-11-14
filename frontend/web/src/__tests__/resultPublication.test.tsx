import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { TeacherResultsView, formatScore as teacherFormatScore } from '../components/TeacherResultsView.tsx';
import { TeacherReadinessView } from '../components/TeacherReadinessView.tsx';
import { AssignedExamDiscovery } from '../components/AssignedExamDiscovery.tsx';
import { HiddenScore, ScoreRevealToggle } from '../components/ScoreReveal.tsx';
import { publicationRefusalCopy } from '../components/ResultPublicationDialog.tsx';
import { Button } from '@/components/ui/button';
import { IconEye, IconEyeOff } from '@/components/icons';
import { formatScore } from '../lib/question-import.ts';
import { buildResultsCsv } from '../lib/results-export.ts';
import {
  ApiError, getAssignedExams, getMyResults, getTeacherExamResults, getTeacherReadiness, postResultPublication,
} from '../api/assessment-client.ts';
import type {
  AssignedExamItem, MyResultEntry, ResultPublicationReceipt, TeacherExamReadinessProjection, TeacherExamResultsResponse,
} from '../types/assessment.ts';

// RESULT-003 C06: the Teacher results state lines, action labels and the FINAL note; the publish and withdraw dialog
// (copy, reason, confirmation, every refusal of §4.5, focus after success and failure, never on BODY); the Teacher card;
// the Student card for published, absent, unavailable and failed loads, nothing before "my-results" settles, and E7a
// (masked by default, value element absent, one card's reveal leaves the others masked, a remount masks again, nothing
// stored); the moved HiddenScore and toggle unchanged; no "my-results" call without a FINALIZED exam.

vi.mock('../api/assessment-client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/assessment-client.ts')>('../api/assessment-client.ts');
  return {
    ...actual,
    getTeacherExamResults: vi.fn(), getTeacherReadiness: vi.fn(), postResultPublication: vi.fn(), postTeacherResultsExport: vi.fn(),
    getAssignedExams: vi.fn(), getMyResults: vi.fn(), postStartAttempt: vi.fn(),
  };
});

const EXAM = '5f0c7b8e-1d2a-4c3b-8e9f-0a1b2c3d4e5f';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REASON = 'Hasil siap dibagikan';
const AT = '2026-11-12T03:04:00.000Z';
const LATER = '2026-11-12T05:30:00.000Z';
/** The ICU data decides between "2026, 10.04" and "2026 pukul 10.04". */
const time = (hm: string) => `12 November 2026(,| pukul) ${hm} WIB`;
const EM_DASH = '—';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function finalResults(publication?: TeacherExamResultsResponse['publication']): TeacherExamResultsResponse {
  return {
    exam: {
      examInstanceId: EXAM, subjectLabel: 'Ekonomi', groupLabel: 'X-1', assessmentTypeLabel: 'Ulangan Harian', lifecycleState: 'FINALIZED',
      windowStartsAt: '2026-11-12T01:00:00.000Z', windowEndsAt: '2026-11-12T03:00:00.000Z',
    },
    scoring: { rule: 'COMPOSITE_PER_ITEM_V1', available: true, questionCount: 3, maxScore: 10, autoScoredCount: 2, essayCount: 1 },
    resultState: 'FINAL',
    finalizedAt: '2026-11-12T03:00:00.000Z',
    ...(publication === undefined ? {} : { publication }),
    summary: { participants: 3, notStarted: 1, inProgress: 0, submitted: 2 },
    participants: [
      { elligbleId: 'siswa.a', status: 'SUBMITTED', finalizationSource: 'STUDENT_SUBMIT', submittedAt: '2026-11-12T02:00:00.000Z', score: { correct: 2, incorrect: 0, unanswered: 0, graded: 1, ungraded: 0, rawScore: 9, maxScore: 10, scaledScore: 90 } },
      { elligbleId: 'siswa.b', status: 'SUBMITTED', finalizationSource: 'STUDENT_SUBMIT', submittedAt: '2026-11-12T02:10:00.000Z', score: { correct: 1, incorrect: 1, unanswered: 0, graded: 1, ungraded: 0, rawScore: 5.5, maxScore: 10, scaledScore: 55 } },
      { elligbleId: 'siswa.c', status: 'ABSENT', finalizationSource: null, submittedAt: null, score: null },
    ],
  };
}

const NEVER = { published: false, revision: 0, changedAt: null };
const PUBLISHED = { published: true, revision: 1, changedAt: AT };
const WITHDRAWN = { published: false, revision: 2, changedAt: LATER };
const receipt = (published: boolean, revision: number, changedAt = AT): ResultPublicationReceipt => ({ examInstanceId: EXAM, published, revision, changedAt, replayed: false });

const stateLine = (hidden = false) => screen.getAllByRole('status', { hidden }).find(node => /publikasi|Dipublikasikan|Belum dipublikasikan/i.test(node.textContent ?? ''))!;
const dialog = () => screen.getByRole('dialog');
const focusIsOnBody = () => document.activeElement === document.body || document.activeElement === null;

describe('RESULT-003 Teacher results publication', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => cleanup());

  it('shows no publication controls without a publication object (older server) or while PROVISIONAL', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(finalResults());
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Hasil final')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publikasikan Hasil' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tarik Publikasi' })).toBeNull();
    expect(screen.getByText(/Nilai dibekukan dan tidak berubah oleh perubahan data berikutnya\. Hasil ini tidak ditampilkan kepada siswa\./)).toBeTruthy();
    cleanup();
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce({ ...finalResults(null), resultState: 'PROVISIONAL', finalizedAt: null, exam: { ...finalResults().exam, lifecycleState: 'ENDED' } });
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByText('Hasil sementara')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publikasikan Hasil' })).toBeNull();
    expect(screen.queryByText(/Belum dipublikasikan/)).toBeNull();
  });

  it('state lines and note: never published, published and withdrawn', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(finalResults(NEVER));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect((await screen.findByRole('button', { name: 'Publikasikan Hasil' })).className).toContain('whitespace-normal');
    expect(stateLine().textContent).toBe('Belum dipublikasikan. Siswa belum dapat melihat nilai.');
    expect(screen.getByText(/Hasil ini tidak ditampilkan kepada siswa\./)).toBeTruthy();
    cleanup();

    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(finalResults(PUBLISHED));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Tarik Publikasi' })).toBeTruthy();
    expect(stateLine().textContent).toMatch(new RegExp(`^Dipublikasikan kepada siswa ${time('10.04')}\\. Setiap siswa hanya melihat nilainya sendiri\\.$`));
    expect(screen.getByText(/Nilai dibekukan dan tidak berubah oleh perubahan data berikutnya\. Setiap siswa dapat melihat nilainya sendiri\./)).toBeTruthy();
    expect(screen.queryByText(/Hasil ini tidak ditampilkan kepada siswa/)).toBeNull();
    // The scores stay masked on the Teacher screen too (§58), whatever the publication.
    expect(screen.getAllByLabelText('Disembunyikan')).toHaveLength(6);
    cleanup();

    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(finalResults(WITHDRAWN));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Publikasikan Hasil' })).toBeTruthy();
    expect(stateLine().textContent).toMatch(new RegExp(`^Publikasi ditarik ${time('12.30')}\\. Siswa melihat "Hasil belum tersedia"\\.$`));
    expect(screen.getByText(/Hasil ini tidak ditampilkan kepada siswa\./)).toBeTruthy();
    expect(document.body.textContent).not.toContain(EM_DASH);
  });

  it('publishes with a reason and the confirmation; nothing changes before the 200; focus returns to the action, never BODY', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(finalResults(NEVER)).mockResolvedValueOnce(finalResults(PUBLISHED));
    const pending = deferred<ResultPublicationReceipt>();
    vi.mocked(postResultPublication).mockReturnValueOnce(pending.promise);
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    const action = await screen.findByRole('button', { name: 'Publikasikan Hasil' });
    action.focus();
    fireEvent.click(action);
    const d = dialog();
    expect(within(d).getByRole('heading', { name: 'Publikasikan Hasil Ujian?' })).toBeTruthy();
    expect(within(d).getByText('Setiap siswa peserta ujian ini dapat melihat nilainya sendiri. Siswa tidak melihat nilai siswa lain, peringkat, atau kunci jawaban. Publikasi dapat ditarik kembali.')).toBeTruthy();
    const confirm = within(d).getByRole('button', { name: 'Publikasikan Hasil' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(d).getByLabelText('Alasan tindakan'), { target: { value: '   ' } });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(d).getByLabelText('Alasan tindakan'), { target: { value: REASON } });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    expect(within(d).getByRole('button', { name: 'Batal' })).toBeTruthy();
    expect(d.textContent).not.toContain(EM_DASH);
    fireEvent.click(confirm);
    await waitFor(() => expect(postResultPublication).toHaveBeenCalledTimes(1));
    expect(vi.mocked(postResultPublication).mock.calls[0][0]).toEqual({ examInstanceId: EXAM, action: 'publish', expectedRevision: 0, reason: REASON, confirmed: true, actionKey: expect.stringMatching(UUID) });
    // U04: inspect retained background state while Radix correctly hides it from the modal accessibility tree.
    expect(stateLine(true).textContent).toBe('Belum dipublikasikan. Siswa belum dapat melihat nilai.');
    pending.resolve(receipt(true, 1));
    const withdraw = await screen.findByRole('button', { name: 'Tarik Publikasi' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(stateLine().textContent).toMatch(/^Dipublikasikan kepada siswa /);
    expect(getTeacherExamResults).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(document.activeElement).toBe(withdraw));
    expect(withdraw).toBe(action);
  });

  it('withdraws: the copy, the receipt, the state line and the focus', async () => {
    vi.mocked(getTeacherExamResults).mockResolvedValueOnce(finalResults(PUBLISHED)).mockResolvedValueOnce(finalResults(WITHDRAWN));
    vi.mocked(postResultPublication).mockResolvedValueOnce(receipt(false, 2, LATER));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    const action = await screen.findByRole('button', { name: 'Tarik Publikasi' });
    action.focus();
    fireEvent.click(action);
    const d = dialog();
    expect(within(d).getByRole('heading', { name: 'Tarik Publikasi Hasil?' })).toBeTruthy();
    expect(within(d).getByText('Nilai disembunyikan kembali dari siswa, dan siswa melihat "Hasil belum tersedia". Hasil yang difinalisasi tidak berubah dan dapat dipublikasikan lagi.')).toBeTruthy();
    fireEvent.change(within(d).getByLabelText('Alasan tindakan'), { target: { value: 'Ada keberatan dari siswa' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Tarik Publikasi' }));
    await waitFor(() => expect(postResultPublication).toHaveBeenCalledWith({ examInstanceId: EXAM, action: 'withdraw', expectedRevision: 1, reason: 'Ada keberatan dari siswa', confirmed: true, actionKey: expect.stringMatching(UUID) }));
    const publish = await screen.findByRole('button', { name: 'Publikasikan Hasil' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(stateLine().textContent).toMatch(/^Publikasi ditarik /);
    await waitFor(() => expect(document.activeElement).toBe(publish));
  });

  it('every refusal of §4.5 in the dialog; focus on the enabled retry control; one key per opening; publication_changed reloads', async () => {
    const refusals: Array<[unknown, string]> = [
      [new ApiError(409, 'publication_changed', undefined, { error: 'publication_changed', published: true, revision: 1 }), 'Status publikasi telah berubah. Data diperbarui; periksa lalu ulangi bila perlu.'],
      [new ApiError(409, 'invalid_state', undefined, { error: 'invalid_state', currentState: 'ENDED' }), 'Hasil harus difinalisasi sebelum dipublikasikan.'],
      [new ApiError(403, 'forbidden'), 'Hanya guru mata pelajaran ujian ini yang dapat mempublikasikan hasil.'],
      [new ApiError(409, 'action_key_reused'), 'Permintaan bertabrakan dengan perubahan lain. Tutup lalu coba lagi.'],
      [new ApiError(409, 'state_changed'), 'Permintaan bertabrakan dengan perubahan lain. Tutup lalu coba lagi.'],
      [new ApiError(503, 'persistence_unavailable'), 'Gagal terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.'],
      [new TypeError('Failed to fetch'), 'Gagal terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.'],
    ];
    for (const [error, copy] of refusals) {
      expect(publicationRefusalCopy(error)).toBe(copy);
      expect(copy).not.toContain(EM_DASH);
    }

    vi.mocked(getTeacherExamResults).mockResolvedValue(finalResults(NEVER));
    render(<TeacherResultsView examInstanceId={EXAM} onBack={() => {}} />);
    const action = await screen.findByRole('button', { name: 'Publikasikan Hasil' });
    fireEvent.click(action);
    const d = dialog();
    fireEvent.change(within(d).getByLabelText('Alasan tindakan'), { target: { value: REASON } });
    const confirm = within(d).getByRole('button', { name: 'Publikasikan Hasil' });
    for (const [error, copy] of refusals) {
      vi.mocked(postResultPublication).mockRejectedValueOnce(error);
      const loadsBefore = vi.mocked(getTeacherExamResults).mock.calls.length;
      confirm.focus();
      fireEvent.click(confirm);
      expect(await within(d).findByText(copy)).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(confirm));
      expect(focusIsOnBody()).toBe(false);
      const reloaded = vi.mocked(getTeacherExamResults).mock.calls.length - loadsBefore;
      expect(reloaded, String((error as Error).message)).toBe(error instanceof ApiError && error.code === 'publication_changed' ? 1 : 0);
    }
    const keys = vi.mocked(postResultPublication).mock.calls.map(call => call[0].actionKey);
    expect(new Set(keys).size).toBe(1);
    // Closing and opening again starts empty with a new key.
    fireEvent.click(within(d).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Publikasikan Hasil' }));
    const again = dialog();
    expect((within(again).getByLabelText('Alasan tindakan') as HTMLTextAreaElement).value).toBe('');
    fireEvent.change(within(again).getByLabelText('Alasan tindakan'), { target: { value: REASON } });
    vi.mocked(postResultPublication).mockRejectedValueOnce(new ApiError(503, 'persistence_unavailable'));
    fireEvent.click(within(again).getByRole('button', { name: 'Publikasikan Hasil' }));
    await waitFor(() => expect(postResultPublication).toHaveBeenCalledTimes(refusals.length + 1));
    expect(vi.mocked(postResultPublication).mock.calls.at(-1)![0].actionKey).not.toBe(keys[0]);
  });

  it('the moved HiddenScore and toggle render exactly the markup of the Teacher screen before the move', () => {
    const { container: moved } = render(<div><HiddenScore /><ScoreRevealToggle pressed={false} onToggle={() => {}} disabled={false} /><ScoreRevealToggle pressed onToggle={() => {}} disabled /></div>);
    const movedHtml = moved.innerHTML;
    cleanup();
    // The markup of TeacherResultsView.tsx:38-40 and :244-247 before RESULT-003.
    const Original = ({ showScores, available }: { showScores: boolean; available: boolean }) => (
      <Button variant="secondary" className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left" aria-pressed={showScores} onClick={() => {}} disabled={!available}>
        {showScores ? <IconEyeOff aria-hidden="true" /> : <IconEye aria-hidden="true" />}
        {showScores ? 'Sembunyikan Nilai' : 'Tampilkan Nilai'}
      </Button>
    );
    const { container: original } = render(<div><span aria-label="Disembunyikan" className="tracking-widest text-muted-foreground">••••</span><Original showScores={false} available /><Original showScores available={false} /></div>);
    expect(movedHtml).toBe(original.innerHTML);
  });

  it('the shared formatScore equals the Teacher screen formatScore (E14, R10)', () => {
    for (const value of [90, 33.33, 55, 100, 0, 34.09]) expect(formatScore(value)).toBe(teacherFormatScore(value));
    expect([90, 33.33, 55].map(formatScore)).toEqual(['90', '33,33', '55']);
  });
});

describe('RESULT-003 Teacher card', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => cleanup());

  const card = (over: Partial<TeacherExamReadinessProjection>): TeacherExamReadinessProjection => ({
    examInstanceId: EXAM, subjectLabel: 'Ekonomi', lifecycleState: 'FINALIZED', windowStartsAt: '2026-11-12T01:00:00.000Z', windowEndsAt: '2026-11-12T03:00:00.000Z',
    finalizedAt: '2026-11-12T03:00:00.000Z', progress: { participants: 3, started: 2, submitted: 2, running: 0 },
    baseline: { status: 'not_evaluated' }, roomProctor: { status: 'not_evaluated' }, ...over,
  });

  it('says when the result was published, and is unchanged otherwise', async () => {
    vi.mocked(getTeacherReadiness).mockResolvedValueOnce({ exams: [card({ publishedAt: AT })] });
    render(<TeacherReadinessView onOpenResults={() => {}} />);
    expect(await screen.findByText(new RegExp(`^Hasil difinalisasi ${time('10.00')}\\. Hasil dipublikasikan kepada siswa ${time('10.04')}\\.$`))).toBeTruthy();
    expect(screen.queryByText(/Nilai tidak ditampilkan kepada siswa/)).toBeNull();
    cleanup();
    for (const over of [{ publishedAt: null }, {}]) {
      vi.mocked(getTeacherReadiness).mockResolvedValueOnce({ exams: [card(over)] });
      render(<TeacherReadinessView onOpenResults={() => {}} />);
      expect(await screen.findByText(new RegExp(`^Hasil difinalisasi ${time('10.00')}\\. Nilai tidak ditampilkan kepada siswa\\.$`))).toBeTruthy();
      cleanup();
    }
  });
});

describe('RESULT-003 Student card (E7, E7a, RP-1)', () => {
  const E1 = '11111111-1111-4111-8111-111111111111';
  const E2 = '22222222-2222-4222-8222-222222222222';
  const ABSENT = '33333333-3333-4333-8333-333333333333';
  const NONE = '44444444-4444-4444-8444-444444444444';
  const ENDED = '55555555-5555-4555-8555-555555555555';
  const ARCHIVED = '66666666-6666-4666-8666-666666666666';
  const item = (examInstanceId: string, subjectLabel: string, lifecycleState: string, submitted = true): AssignedExamItem => ({
    examInstanceId, subjectLabel, roomLabel: null,
    schedule: { lifecycleState, windowStartsAt: '2026-11-12T01:00:00.000Z', windowEndsAt: '2026-11-12T03:00:00.000Z', attemptDurationSeconds: 3600 },
    attempts: submitted ? [{ attemptId: `${examInstanceId.slice(0, 8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, submittedAt: '2026-11-12T02:00:00.000Z' }] : [],
  });
  const ASSIGNMENTS = [
    item(E1, 'Ekonomi', 'FINALIZED'), item(E2, 'Matematika', 'FINALIZED'), item(ABSENT, 'Fisika', 'FINALIZED', false),
    item(NONE, 'Kimia', 'FINALIZED'), item(ENDED, 'Biologi', 'ENDED'), item(ARCHIVED, 'Sejarah', 'ARCHIVED', false),
  ];
  const RESULTS: MyResultEntry[] = [
    { examInstanceId: E1, publishedAt: AT, standing: 'SUBMITTED', scaledScore: 90 },
    { examInstanceId: E2, publishedAt: LATER, standing: 'SUBMITTED', scaledScore: 33.33 },
    { examInstanceId: ABSENT, publishedAt: AT, standing: 'ABSENT', scaledScore: null },
  ];
  const cardOf = (id: string) => screen.getByTestId(`assignment-${id}`);
  const storageWrites: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    storageWrites.length = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) { storageWrites.push(`${key}=${value}`); });
    window.history.replaceState({}, '', '/');
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('no result line until my-results settles; then masked values, the absent copy and "Hasil belum tersedia."', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: '2026-11-12T06:00:00.000Z', assignments: ASSIGNMENTS });
    const pending = deferred<{ results: MyResultEntry[] }>();
    vi.mocked(getMyResults).mockReturnValueOnce(pending.promise);
    render(<AssignedExamDiscovery />);
    await screen.findByText('Ekonomi');
    await waitFor(() => expect(getMyResults).toHaveBeenCalledTimes(1));
    expect(vi.mocked(getMyResults).mock.calls[0]).toEqual([]);
    expect(screen.queryByTestId(`result-${E1}`)).toBeNull();
    expect(screen.queryByText('Hasil belum tersedia.')).toBeNull();
    expect(screen.queryByText(/Nilai/)).toBeNull();
    pending.resolve({ results: RESULTS });

    // V-1: masked, the value element absent, the reveal control not pressed.
    const e1 = await screen.findByTestId(`result-${E1}`);
    expect(within(e1).getByLabelText('Disembunyikan').textContent).toBe('••••');
    expect(screen.queryByTestId(`result-value-${E1}`)).toBeNull();
    expect(e1.textContent).not.toContain('90');
    const toggle = within(e1).getByRole('button', { name: 'Tampilkan Nilai' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(within(e1).getByText(new RegExp(`^Dipublikasikan ${time('10.04')}\\.$`))).toBeTruthy();
    // Absent is not zero; no entry is "Hasil belum tersedia."; ENDED and ARCHIVED get no line.
    expect(within(cardOf(ABSENT)).getByText('Anda tercatat tidak mengerjakan ujian ini, sehingga tidak ada nilai.')).toBeTruthy();
    expect(within(cardOf(ABSENT)).queryByRole('button', { name: 'Tampilkan Nilai' })).toBeNull();
    expect(within(cardOf(NONE)).getByText('Hasil belum tersedia.')).toBeTruthy();
    expect(within(cardOf(NONE)).queryByText(/Nilai/)).toBeNull();
    for (const id of [ENDED, ARCHIVED]) expect(screen.queryByTestId(`result-${id}`)).toBeNull();
    expect(within(cardOf(ENDED)).queryByText(/Hasil/)).toBeNull();

    // V-2: one card's reveal leaves the other masked; pressing again hides it.
    fireEvent.click(toggle);
    expect(screen.getByTestId(`result-value-${E1}`).textContent).toBe('90');
    expect(within(e1).getByRole('button', { name: 'Sembunyikan Nilai' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId(`result-value-${E2}`)).toBeNull();
    expect(within(screen.getByTestId(`result-${E2}`)).getByLabelText('Disembunyikan')).toBeTruthy();
    fireEvent.click(within(screen.getByTestId(`result-${E2}`)).getByRole('button', { name: 'Tampilkan Nilai' }));
    expect(screen.getByTestId(`result-value-${E2}`).textContent).toBe('33,33');
    fireEvent.click(within(e1).getByRole('button', { name: 'Sembunyikan Nilai' }));
    expect(screen.queryByTestId(`result-value-${E1}`)).toBeNull();
    expect(screen.getByTestId(`result-value-${E2}`)).toBeTruthy();
    expect(document.body.textContent).not.toContain(EM_DASH);

    // D-1, V-3: nothing stored, nothing in the URL; a remount masks again.
    expect(storageWrites).toEqual([]);
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    cleanup();
    vi.mocked(getMyResults).mockResolvedValueOnce({ results: RESULTS });
    render(<AssignedExamDiscovery />);
    expect(within(await screen.findByTestId(`result-${E2}`)).getByLabelText('Disembunyikan')).toBeTruthy();
    expect(screen.queryByTestId(`result-value-${E2}`)).toBeNull();
    expect(screen.queryByTestId(`result-value-${E1}`)).toBeNull();
  });

  it('V-4: a failed load shows no result line, no "Hasil belum tersedia." and no value, only the notice; "Coba Lagi" keeps focus', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: '2026-11-12T06:00:00.000Z', assignments: ASSIGNMENTS });
    vi.mocked(getMyResults).mockRejectedValueOnce(new ApiError(503, 'persistence_unavailable'));
    render(<AssignedExamDiscovery />);
    expect(await screen.findByText('Hasil ujian belum dapat dimuat. Periksa koneksi internet Anda, lalu coba lagi.')).toBeTruthy();
    for (const entry of ASSIGNMENTS) expect(screen.queryByTestId(`result-${entry.examInstanceId}`)).toBeNull();
    expect(screen.queryByText('Hasil belum tersedia.')).toBeNull();
    expect(screen.queryByText(/Nilai/)).toBeNull();
    expect(screen.queryByLabelText('Disembunyikan')).toBeNull();

    const retry = screen.getByRole('button', { name: 'Coba Lagi' });
    expect(retry.className).toContain('min-h-11');
    retry.focus();
    const again = deferred<{ results: MyResultEntry[] }>();
    vi.mocked(getMyResults).mockReturnValueOnce(again.promise);
    fireEvent.click(retry);
    expect(document.activeElement).toBe(retry);
    expect(retry.textContent).toBe('Memuat...');
    again.reject(new TypeError('Failed to fetch'));
    await waitFor(() => expect(retry.textContent).toBe('Coba Lagi'));
    expect(document.activeElement).toBe(retry);

    vi.mocked(getMyResults).mockResolvedValueOnce({ results: RESULTS });
    fireEvent.click(retry);
    expect(await screen.findByTestId(`result-${E1}`)).toBeTruthy();
    expect(screen.queryByText(/belum dapat dimuat/)).toBeNull();
    await waitFor(() => expect(focusIsOnBody()).toBe(false));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Daftar Ujian Siswa' }));
  });

  it('never asks for my-results without a FINALIZED exam', async () => {
    vi.mocked(getAssignedExams).mockResolvedValue({ serverNow: '2026-11-12T06:00:00.000Z', assignments: [item(ENDED, 'Biologi', 'ENDED'), item(ARCHIVED, 'Sejarah', 'ARCHIVED', false)] });
    render(<AssignedExamDiscovery />);
    expect(await screen.findByText('Biologi')).toBeTruthy();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(getMyResults).not.toHaveBeenCalled();
    expect(screen.queryByText(/Hasil/)).toBeNull();
  });
});

// X-1: publication metadata must not change the approved RESULT-004 CSV columns or values.
it('publication state never appears as a CSV column or changes a result value', () => {
  const unpublished = finalResults(NEVER);
  const published = finalResults(PUBLISHED);
  const withdrawn = finalResults(WITHDRAWN);
  const csv = buildResultsCsv(unpublished);
  expect(buildResultsCsv(published)).toBe(csv);
  expect(buildResultsCsv(withdrawn)).toBe(csv);
  expect(csv.split('\r\n')[0]).not.toMatch(/publication|publikasi/i);
  expect(csv.split('\r\n')[0].split(';')).toHaveLength(19 + (unpublished.questions?.length ?? 0));
});
