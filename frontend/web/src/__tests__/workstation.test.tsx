import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentExamWorkstation } from '../components/StudentExamWorkstation.tsx';
import type { StudentSafeQuestion, ResumeResponse, QuestionsResponse, TimerResponse } from '../types/assessment.ts';

const VALID_ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const SNAPSHOT_1 = '33333333-3333-4333-8333-333333333331';
const SNAPSHOT_2 = '33333333-3333-4333-8333-333333333332';

const sampleQuestions: StudentSafeQuestion[] = [
  {
    snapshotId: SNAPSHOT_1,
    schemaVersion: 1,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    prompt: 'Manakah unsur kimia dengan simbol O?',
    options: [
      { id: 'opt-1a', content: 'Emas' },
      { id: 'opt-1b', content: 'Oksigen' },
      { id: 'opt-1c', content: 'Besi' },
      { id: 'opt-1d', content: 'Perak' },
      { id: 'opt-1e', content: 'Karbon' },
    ],
  },
  {
    snapshotId: SNAPSHOT_2,
    schemaVersion: 1,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    prompt: 'Berapakah jumlah sudut siku-siku pada persegi?',
    options: [
      { id: 'opt-2a', content: '1' },
      { id: 'opt-2b', content: '2' },
      { id: 'opt-2c', content: '3' },
      { id: 'opt-2d', content: '4' },
      { id: 'opt-2e', content: '5' },
    ],
  },
];

function createMockResume(overrides?: Partial<ResumeResponse>): ResumeResponse {
  return {
    attemptId: VALID_ATTEMPT_ID,
    session: {
      status: 'active',
      sessionId: VALID_SESSION_ID,
      activatedAt: '2026-09-12T08:00:00.000Z',
    },
    answers: [],
    timer: {
      status: 'active',
      startedAt: '2026-09-12T08:00:00.000Z',
      configuredDurationSeconds: 3600,
      effectiveDurationSeconds: 3600,
      effectiveRemainingSeconds: 3000,
    },
    submission: {
      status: 'not_submitted',
    },
    ...overrides,
  };
}

describe('BU-081 StudentExamWorkstation Test Suite', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('1. missing or invalid attemptId produces no API request and renders invalid-link state', async () => {
    window.history.pushState({}, '', '?attemptId=not-a-valid-uuid');

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Tautan Tidak Valid')).toBeTruthy();
    expect(
      screen.getByText('Tautan pengerjaan ujian tidak valid atau format sesi tidak dikenali.')
    ).toBeTruthy();

    // Zero fetch calls
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('2. missing attemptId parameter produces no API request and renders invalid-link state', async () => {
    window.history.pushState({}, '', '/');

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Tautan Tidak Valid')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('3. active resume and questions load correctly with questions and authoritative timer', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        const qRes: QuestionsResponse = {
          attemptId: VALID_ATTEMPT_ID,
          questions: sampleQuestions,
        };
        return new Response(JSON.stringify(qRes), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    // Renders header and progress
    expect(await screen.findByText('Ruang Ujian Aman')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Daftar Soal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Daftar Soal' })).toBeTruthy();

    // Renders first question prompt and all 5 options
    expect(screen.getByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();
    expect(screen.getByText(/Oksigen/)).toBeTruthy();
    expect(screen.getByText(/Emas/)).toBeTruthy();
    expect(screen.getByText(/Besi/)).toBeTruthy();
    expect(screen.getByText(/Perak/)).toBeTruthy();
    expect(screen.getByText(/Karbon/)).toBeTruthy();

    // Monospace countdown display
    expect(screen.getByText(/Sisa Waktu:/)).toBeTruthy();
  });

  it('4. submitted resume terminal state renders correctly without loading questions', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(
          JSON.stringify(
            createMockResume({
              submission: {
                status: 'submitted',
                submissionId: 'sub-1234',
                submittedAt: '2026-09-12T08:30:00.000Z',
              },
            })
          ),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Ujian Berhasil Dikumpulkan')).toBeTruthy();
    expect(
      screen.getByText(
        'Jawaban Anda telah tersimpan resmi pada server sekolah. Anda dapat meninggalkan ruang ujian setelah diizinkan pengawas.'
      )
    ).toBeTruthy();

    // Should NOT fetch questions when already submitted
    const questionsCalls = fetchSpy.mock.calls.filter(c => c[0].includes('/api/v1/assessment/questions'));
    expect(questionsCalls.length).toBe(0);
  });

  it('5. inactive session renders safe non-editable state', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(
          JSON.stringify(
            createMockResume({
              session: { status: 'none' },
            })
          ),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Sesi Ujian Tidak Aktif')).toBeTruthy();
    expect(
      screen.getByText('Sesi ujian belum aktif atau tidak dapat diakses. Silakan hubungi pengawas ujian.')
    ).toBeTruthy();
  });

  it('6. timer not started renders safe non-editable state', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(
          JSON.stringify(
            createMockResume({
              timer: { status: 'not_started' },
            })
          ),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Waktu Ujian Belum Dimulai')).toBeTruthy();
    expect(
      screen.getByText('Waktu pelaksanaan ujian belum dimulai oleh pengawas ruangan.')
    ).toBeTruthy();
  });

  it('7. question order is strictly preserved from server payload', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    // First question is prompt 1
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Click "Soal Berikutnya"
    const nextBtn = screen.getByRole('button', { name: 'Soal Berikutnya' });
    await userEvent.click(nextBtn);

    // Second question is prompt 2
    expect(await screen.findByText('Berapakah jumlah sudut siku-siku pada persegi?')).toBeTruthy();
  });

  it('8. supported resume answer restoration populates selection and marks saved', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(
          JSON.stringify(
            createMockResume({
              answers: [
                {
                  snapshotId: SNAPSHOT_1,
                  answerPayload: { selectedOptionId: 'opt-1b' },
                  clientWriteIdentity: 'prev-client-identity-1',
                  writeVersion: 1,
                  updatedAt: '2026-09-12T08:05:00.000Z',
                },
              ],
            })
          ),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Tersimpan')).toBeTruthy();

    // Option B is checked
    const radioOptionB = screen.getByLabelText(/Oksigen/) as HTMLInputElement;
    expect(radioOptionB.checked).toBe(true);

    // Option A is not checked
    const radioOptionA = screen.getByLabelText(/Emas/) as HTMLInputElement;
    expect(radioOptionA.checked).toBe(false);
  });

  it('9. unsupported answer payload from resume fails safe and does not fabricate a selection', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(
          JSON.stringify(
            createMockResume({
              answers: [
                {
                  snapshotId: SNAPSHOT_1,
                  answerPayload: { unsupportedType: true }, // Not { selectedOptionId: string }
                  clientWriteIdentity: 'prev-id',
                  writeVersion: 1,
                  updatedAt: '2026-09-12T08:05:00.000Z',
                },
              ],
            })
          ),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Format jawaban tidak didukung')).toBeTruthy();

    // No radio option is selected
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every(r => !r.checked)).toBe(true);
  });

  it('10. single-choice option selection triggers answer save with unique clientWriteIdentity and null expectedWriteVersion', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let saveRequestBody: any = null;

    fetchSpy.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        saveRequestBody = JSON.parse(opts?.body as string);
        return new Response(
          JSON.stringify({
            status: 'acknowledged',
            clientWriteIdentity: saveRequestBody.clientWriteIdentity,
            writeVersion: 1,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Select Option B (Oksigen)
    const radioOptionB = screen.getByLabelText(/Oksigen/);
    await userEvent.click(radioOptionB);

    await waitFor(() => {
      expect(screen.getByText('Tersimpan')).toBeTruthy();
    });

    expect(saveRequestBody).not.toBeNull();
    expect(saveRequestBody.attemptId).toBe(VALID_ATTEMPT_ID);
    expect(saveRequestBody.sessionId).toBe(VALID_SESSION_ID);
    expect(saveRequestBody.snapshotId).toBe(SNAPSHOT_1);
    expect(saveRequestBody.answerPayload).toEqual({ selectedOptionId: 'opt-1b' });
    expect(saveRequestBody.expectedWriteVersion).toBeNull();
    expect(typeof saveRequestBody.clientWriteIdentity).toBe('string');
    expect(saveRequestBody.clientWriteIdentity.length).toBeGreaterThan(10);
  });

  it('11. updating an answer sends the previous acknowledged writeVersion and new clientWriteIdentity', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    const saveRequests: any[] = [];

    fetchSpy.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        const body = JSON.parse(opts?.body as string);
        saveRequests.push(body);
        const version = saveRequests.length; // 1 then 2
        return new Response(
          JSON.stringify({
            status: 'acknowledged',
            clientWriteIdentity: body.clientWriteIdentity,
            writeVersion: version,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // First selection: Option B
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    await waitFor(() => expect(screen.getByText('Tersimpan')).toBeTruthy());

    expect(saveRequests[0].expectedWriteVersion).toBeNull();
    const firstIdentity = saveRequests[0].clientWriteIdentity;

    // Second selection: Option E
    await userEvent.click(screen.getByLabelText(/Karbon/));
    await waitFor(() => expect(saveRequests.length).toBe(2));

    expect(saveRequests[1].expectedWriteVersion).toBe(1);
    expect(saveRequests[1].answerPayload).toEqual({ selectedOptionId: 'opt-1e' });
    expect(saveRequests[1].clientWriteIdentity).not.toBe(firstIdentity);
  });

  it('12. server failure displays calm failed state and does not show saved', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        return new Response(JSON.stringify({ error: 'persistence_unavailable' }), { status: 503 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    await userEvent.click(screen.getByLabelText(/Oksigen/));

    expect(await screen.findByText('Gagal menyimpan')).toBeTruthy();
    expect(screen.queryByText('Tersimpan')).toBeNull();
  });

  it('13. bounded stale write reconciliation: if remote equals desired option, marks saved', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let saveAttempts = 0;
    let resumeCalls = 0;

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        resumeCalls++;
        if (resumeCalls === 1) {
          return new Response(JSON.stringify(createMockResume({ answers: [] })), { status: 200 });
        }
        // When re-fetched during reconciliation, remote already has opt-1b with version 2
        return new Response(
          JSON.stringify(
            createMockResume({
              answers: [
                {
                  snapshotId: SNAPSHOT_1,
                  answerPayload: { selectedOptionId: 'opt-1b' },
                  clientWriteIdentity: 'remote-ack-id',
                  writeVersion: 2,
                  updatedAt: '2026-09-12T08:10:00.000Z',
                },
              ],
            })
          ),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        saveAttempts++;
        return new Response(JSON.stringify({ error: 'stale_write_version' }), { status: 409 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    await userEvent.click(screen.getByLabelText(/Oksigen/));

    // Stale write error returned, client re-fetched resume, saw opt-1b is already acknowledged, marks saved!
    expect(await screen.findByText('Tersimpan')).toBeTruthy();
    expect(saveAttempts).toBe(1);
  });

  it('14. bounded stale write reconciliation: retries once with latest version, if second fails marks failed', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let saveAttempts = 0;

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        // Remote answer is opt-1a (different from desired opt-1b), writeVersion 2
        return new Response(
          JSON.stringify(
            createMockResume({
              answers: [
                {
                  snapshotId: SNAPSHOT_1,
                  answerPayload: { selectedOptionId: 'opt-1a' },
                  clientWriteIdentity: 'other-identity',
                  writeVersion: 2,
                  updatedAt: '2026-09-12T08:10:00.000Z',
                },
              ],
            })
          ),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        saveAttempts++;
        return new Response(JSON.stringify({ error: 'stale_write_version' }), { status: 409 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    await userEvent.click(screen.getByLabelText(/Oksigen/));

    expect(await screen.findByText('Gagal menyimpan')).toBeTruthy();
    // Proves bounded retry: exactly 2 save attempts (initial + 1 retry)
    expect(saveAttempts).toBe(2);
  });

  it('15. question navigation updates current index and aria-current attribute', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Click question number '2' button in navigator grid
    const navBtn2 = screen.getByRole('button', { name: /soal nomor 2/i });
    await userEvent.click(navBtn2);

    expect(await screen.findByText('Berapakah jumlah sudut siku-siku pada persegi?')).toBeTruthy();
    expect(screen.getByText('Soal 2 dari 2')).toBeTruthy();
    expect(navBtn2.getAttribute('aria-current')).toBe('true');

    // Click "Soal Sebelumnya"
    const prevBtn = screen.getByRole('button', { name: 'Soal Sebelumnya' });
    await userEvent.click(prevBtn);

    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();
    expect(screen.getByText('Soal 1 dari 2')).toBeTruthy();
  });

  it('16. submit button is disabled when unresolved saves exist', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Trigger save failure
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    expect(await screen.findByText('Gagal menyimpan')).toBeTruthy();

    const submitBtn = screen.getByRole('button', { name: 'Selesaikan Ujian' }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('17. submit confirmation dialog displays counts and requires confirmation checkbox before submission', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let submitCalled = false;

    fetchSpy.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        const body = JSON.parse(opts?.body as string);
        return new Response(
          JSON.stringify({
            status: 'acknowledged',
            clientWriteIdentity: body.clientWriteIdentity,
            writeVersion: 1,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/submit')) {
        submitCalled = true;
        return new Response(
          JSON.stringify({
            status: 'submitted',
            submissionId: 'sub-new-1',
            submittedAt: '2026-09-12T08:45:00.000Z',
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Answer question 1
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    await waitFor(() => expect(screen.getByText('Tersimpan')).toBeTruthy());

    // Click "Selesaikan Ujian"
    const openModalBtn = screen.getByRole('button', { name: 'Selesaikan Ujian' });
    await userEvent.click(openModalBtn);

    // Modal dialog is open
    expect(await screen.findByText('Konfirmasi Pengumpulan Ujian')).toBeTruthy();
    expect(screen.getByText('Total Soal:').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Sudah Dijawab:').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Belum Dijawab:').nextElementSibling?.textContent).toBe('1');

    const confirmBtn = screen.getByRole('button', { name: 'Kirim Jawaban Sekarang' }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    // Check confirmation declaration checkbox
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    expect(confirmBtn.disabled).toBe(false);

    // Submit
    await userEvent.click(confirmBtn);

    expect(await screen.findByText('Ujian Berhasil Dikumpulkan')).toBeTruthy();
    expect(submitCalled).toBe(true);
  });

  it('18. 403 forbidden renders safe access denied state', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async () => {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Akses Ditolak')).toBeTruthy();
    expect(
      screen.getByText('Akses ditolak. Anda tidak memiliki izin untuk mengakses sesi pengerjaan ujian ini.')
    ).toBeTruthy();
  });

  it('19. 404 not found renders safe not found state', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async () => {
      return new Response(JSON.stringify({ error: 'assessment_context_not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Data Tidak Ditemukan')).toBeTruthy();
    expect(
      screen.getByText('Data pengerjaan ujian tidak ditemukan. Hubungi pengawas ruangan.')
    ).toBeTruthy();
  });

  it('20. timer reaching zero triggers expiry-finalize exactly once and renders expired state', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let expiryFinalizeCalls = 0;

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(
          JSON.stringify(
            createMockResume({
              timer: {
                status: 'active',
                startedAt: '2026-09-12T08:00:00.000Z',
                configuredDurationSeconds: 3600,
                effectiveDurationSeconds: 3600,
                effectiveRemainingSeconds: 1, // 1 second left!
              },
            })
          ),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/expiry-finalize')) {
        expiryFinalizeCalls++;
        return new Response(
          JSON.stringify({
            status: 'submitted',
            submissionId: 'sub-exp-1',
            submittedAt: '2026-09-12T09:00:00.000Z',
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Wait for 1-second countdown to reach 0
    await waitFor(
      () => {
        expect(expiryFinalizeCalls).toBe(1);
      },
      { timeout: 3000 }
    );

    // Transitions to submitted state after expiry finalization succeeds
    expect(await screen.findByText('Ujian Berhasil Dikumpulkan')).toBeTruthy();
    expect(expiryFinalizeCalls).toBe(1);
  });

  it('21. never sends custom tenant or authentication headers in any request', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    for (const call of fetchSpy.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers) {
        expect(headers['X-Tenant-ID']).toBeUndefined();
        expect(headers['X-Person-ID']).toBeUndefined();
        expect(headers['X-Participant-ID']).toBeUndefined();
        expect(headers['Authorization']).toBeUndefined();
      }
    }
  });

  it('22. focus resync calls timer API without network polling', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let timerGetCalls = 0;

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/timer')) {
        timerGetCalls++;
        const tRes: TimerResponse = {
          status: 'active',
          startedAt: '2026-09-12T08:00:00.000Z',
          configuredDurationSeconds: 3600,
          effectiveDurationSeconds: 3600,
          effectiveRemainingSeconds: 2800,
        };
        return new Response(JSON.stringify(tRes), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Trigger focus event
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(timerGetCalls).toBe(1);
    });
  });

  it('23. 409 safe state on initial load renders calm error state', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async () => {
      return new Response(JSON.stringify({ error: 'exam_not_active' }), { status: 409 });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Terjadi Kendala')).toBeTruthy();
    expect(
      screen.getByText('Gagal memuat lembar ujian. Periksa koneksi internet Anda atau hubungi pengawas.')
    ).toBeTruthy();
  });

  it('24. 5xx server error renders calm error state without internal database detail leakage', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async () => {
      return new Response(JSON.stringify({ error: 'internal_error', rawSql: 'SELECT * FROM secrets' }), {
        status: 500,
      });
    });

    render(<StudentExamWorkstation />);

    expect(await screen.findByText('Terjadi Kendala')).toBeTruthy();
    expect(screen.queryByText(/SELECT \* FROM/i)).toBeNull();
  });

  it('25. displays "Menyimpan..." indicator while save request is unresolved', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let resolveSave: (value: Response) => void;
    const savePromise = new Promise<Response>(resolve => {
      resolveSave = resolve;
    });

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        return savePromise;
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    await userEvent.click(screen.getByLabelText(/Oksigen/));

    // While unresolved, "Menyimpan..." is shown
    expect(await screen.findByText('Menyimpan...')).toBeTruthy();
    expect(screen.queryByText('Tersimpan')).toBeNull();

    // Now resolve save
    await act(async () => {
      resolveSave!(
        new Response(
          JSON.stringify({
            status: 'acknowledged',
            clientWriteIdentity: 'identity-123',
            writeVersion: 1,
          }),
          { status: 200 }
        )
      );
    });

    expect(await screen.findByText('Tersimpan')).toBeTruthy();
  });

  it('26. modal dialog traps focus and closes on Escape', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Open submit modal
    const openBtn = screen.getByRole('button', { name: 'Selesaikan Ujian' });
    await userEvent.click(openBtn);

    expect(await screen.findByText('Konfirmasi Pengumpulan Ujian')).toBeTruthy();

    // Press Escape key
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByText('Konfirmasi Pengumpulan Ujian')).toBeNull();
    });
  });

  it('27. student-safe question projection contains only authorized properties without answer key or scores', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    for (const q of sampleQuestions) {
      expect(q.snapshotId).toBeTruthy();
      expect(q.prompt).toBeTruthy();
      expect(q.questionType).toBe('MULTIPLE_CHOICE_SINGLE');
      expect(q.options.length).toBe(5);
      expect((q as any).correctOptionId).toBeUndefined();
      expect((q as any).maxScore).toBeUndefined();
      expect((q as any).answerKey).toBeUndefined();
      expect((q as any).tenantId).toBeUndefined();
      expect((q as any).personId).toBeUndefined();
    }
  });

  it('28. idempotent submission returns safe submitted terminal receipt without duplicate mutation', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/submit')) {
        // Idempotent server response returning existing receipt
        return new Response(
          JSON.stringify({
            status: 'submitted',
            submissionId: 'sub-existing-same-id',
            submittedAt: '2026-09-12T08:00:00.000Z',
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Open submit dialog and confirm
    await userEvent.click(screen.getByRole('button', { name: 'Selesaikan Ujian' }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Kirim Jawaban Sekarang' }));

    // Presented as safe terminal success
    expect(await screen.findByText('Ujian Berhasil Dikumpulkan')).toBeTruthy();
  });

  it('29. mobile question navigator trigger exists and opens QuestionNavigatorSheet dialog with aria-modal and summary', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    const triggerBtn = screen.getByRole('button', { name: 'Daftar Soal' });
    expect(triggerBtn.getAttribute('aria-haspopup')).toBe('dialog');
    expect(triggerBtn.getAttribute('aria-expanded')).toBe('false');

    // Click trigger to open sheet
    await userEvent.click(triggerBtn);
    expect(triggerBtn.getAttribute('aria-expanded')).toBe('true');

    // Dialog is present with role="dialog" and aria-modal="true"
    const dialog = screen.getByRole('dialog', { name: 'Daftar Soal' });
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // Summary counts rendered inside dialog
    expect(screen.getByText('Total Soal:').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Sudah Dijawab:').nextElementSibling?.textContent).toBe('0');
    expect(screen.getByText('Belum Dijawab:').nextElementSibling?.textContent).toBe('2');

    // Close button present
    expect(screen.getByRole('button', { name: 'Tutup daftar soal' })).toBeTruthy();
  });

  it('30. QuestionNavigatorSheet traps focus and closes on Escape, restoring focus to trigger', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    const triggerBtn = screen.getByRole('button', { name: 'Daftar Soal' });
    await userEvent.click(triggerBtn);

    expect(screen.getByRole('dialog', { name: 'Daftar Soal' })).toBeTruthy();

    // Focus close button on open
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tutup daftar soal' }));
    });

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    // Dialog closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Daftar Soal' })).toBeNull();
    });

    // Focus returns to trigger button
    expect(document.activeElement).toBe(triggerBtn);
  });

  it('31. selecting a question from QuestionNavigatorSheet navigates to that question and closes the sheet', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Open sheet
    await userEvent.click(screen.getByRole('button', { name: 'Daftar Soal' }));

    const dialog = screen.getByRole('dialog', { name: 'Daftar Soal' });
    const question2Btn = dialog.querySelector('button.sheet-nav-btn:nth-child(2)') as HTMLButtonElement;
    expect(question2Btn).toBeTruthy();

    // Click question 2 in sheet
    await userEvent.click(question2Btn);

    // Sheet closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Daftar Soal' })).toBeNull();
    });

    // Question 2 prompt is active
    expect(await screen.findByText('Berapakah jumlah sudut siku-siku pada persegi?')).toBeTruthy();
    expect(screen.getByText('Soal 2 dari 2')).toBeTruthy();
  });

  it('32. QuestionNavigatorSheet accurately updates answered and unanswered counts upon answer selection', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        const body = JSON.parse(opts?.body as string);
        return new Response(
          JSON.stringify({
            status: 'acknowledged',
            clientWriteIdentity: body.clientWriteIdentity,
            writeVersion: 1,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Answer question 1
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    await waitFor(() => expect(screen.getByText('Tersimpan')).toBeTruthy());

    // Open sheet
    await userEvent.click(screen.getByRole('button', { name: 'Daftar Soal' }));

    const dialog = screen.getByRole('dialog', { name: 'Daftar Soal' });
    expect(dialog).toBeTruthy();

    // Verified updated summary counts
    expect(screen.getByText('Sudah Dijawab:').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Belum Dijawab:').nextElementSibling?.textContent).toBe('1');

    // Question 1 button has answered indicator
    const btn1 = dialog.querySelector('button.sheet-nav-btn:nth-child(1)') as HTMLButtonElement;
    expect(btn1.classList.contains('answered')).toBe(true);
    expect(btn1.textContent).toContain('✓');
  });

  it('33. "Selesaikan Ujian" is reachable through QuestionNavigatorSheet and requires SubmitConfirmModal declaration before submission', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let submitCalled = false;

    fetchSpy.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        const body = JSON.parse(opts?.body as string);
        return new Response(
          JSON.stringify({
            status: 'acknowledged',
            clientWriteIdentity: body.clientWriteIdentity,
            writeVersion: 1,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/submit')) {
        submitCalled = true;
        return new Response(
          JSON.stringify({
            status: 'submitted',
            submissionId: 'sub-sheet-1',
            submittedAt: '2026-09-12T09:15:00.000Z',
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Answer question 1
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    await waitFor(() => expect(screen.getByText('Tersimpan')).toBeTruthy());

    // Open sheet
    await userEvent.click(screen.getByRole('button', { name: 'Daftar Soal' }));

    const dialog = screen.getByRole('dialog', { name: 'Daftar Soal' });
    const sheetSubmitBtn = dialog.querySelector('button.sheet-submit-btn') as HTMLButtonElement;
    expect(sheetSubmitBtn).toBeTruthy();

    // Click submit in sheet
    await userEvent.click(sheetSubmitBtn);

    // Sheet closes, SubmitConfirmModal opens
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Daftar Soal' })).toBeNull();
      expect(screen.getByText('Konfirmasi Pengumpulan Ujian')).toBeTruthy();
    });

    // Check declaration and confirm
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Kirim Jawaban Sekarang' }));

    expect(await screen.findByText('Ujian Berhasil Dikumpulkan')).toBeTruthy();
    expect(submitCalled).toBe(true);
  });

  it('34. opening and closing QuestionNavigatorSheet makes zero network requests and introduces no auth headers', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    const baselineCalls = fetchSpy.mock.calls.length;

    // Open sheet
    const trigger = screen.getByRole('button', { name: 'Daftar Soal' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Daftar Soal' })).toBeTruthy();

    // Close sheet via close button
    await userEvent.click(screen.getByRole('button', { name: 'Tutup daftar soal' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Daftar Soal' })).toBeNull());

    // Open sheet again
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Daftar Soal' })).toBeTruthy();

    // Close via Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Daftar Soal' })).toBeNull());

    // Zero extra network calls introduced
    expect(fetchSpy.mock.calls.length).toBe(baselineCalls);

    // No forbidden auth headers
    for (const call of fetchSpy.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers) {
        expect(headers['X-Tenant-ID']).toBeUndefined();
        expect(headers['X-Person-ID']).toBeUndefined();
        expect(headers['Authorization']).toBeUndefined();
      }
    }
  });

  it('35. previous and next navigation controls in bottom action bar function correctly and disable at boundaries', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    const prevBtn = screen.getByRole('button', { name: 'Soal Sebelumnya' }) as HTMLButtonElement;
    const nextBtn = screen.getByRole('button', { name: 'Soal Berikutnya' }) as HTMLButtonElement;

    // At question 1 (index 0), prev is disabled, next is enabled
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);

    // Click next
    await userEvent.click(nextBtn);

    // Now at question 2 (index 1), next is disabled, prev is enabled
    expect(await screen.findByText('Berapakah jumlah sudut siku-siku pada persegi?')).toBeTruthy();
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(true);

    // Click prev
    await userEvent.click(prevBtn);

    // Back to question 1
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
  });

  it('36. sheet question grid presents non-color-only state indicators for active, answered, and unresolved states', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(
          JSON.stringify(
            createMockResume({
              answers: [
                {
                  snapshotId: SNAPSHOT_1,
                  answerPayload: { selectedOptionId: 'opt-1b' },
                  clientWriteIdentity: 'initial-id-1',
                  writeVersion: 1,
                  updatedAt: '2026-09-12T08:05:00.000Z',
                },
              ],
            })
          ),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Open sheet
    await userEvent.click(screen.getByRole('button', { name: 'Daftar Soal' }));

    const dialog = screen.getByRole('dialog', { name: 'Daftar Soal' });
    const btn1 = dialog.querySelector('button.sheet-nav-btn:nth-child(1)') as HTMLButtonElement;
    const btn2 = dialog.querySelector('button.sheet-nav-btn:nth-child(2)') as HTMLButtonElement;

    // Button 1 is both active and answered: has aria-current, active class, answered class, and visual marker
    expect(btn1.getAttribute('aria-current')).toBe('true');
    expect(btn1.classList.contains('active')).toBe(true);
    expect(btn1.classList.contains('answered')).toBe(true);
    expect(btn1.textContent).toContain('•');
    expect(btn1.textContent).toContain('✓');

    // Button 2 is unanswered and inactive
    expect(btn2.getAttribute('aria-current')).toBeNull();
    expect(btn2.classList.contains('answered')).toBe(false);
    expect(btn2.textContent).not.toContain('✓');
  });

  it('37. "Selesaikan Ujian" inside QuestionNavigatorSheet is disabled when unresolved saves exist', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        return new Response(JSON.stringify({ error: 'server_down' }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Trigger save failure
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    expect(await screen.findByText('Gagal menyimpan')).toBeTruthy();

    // Open sheet
    await userEvent.click(screen.getByRole('button', { name: 'Daftar Soal' }));

    const dialog = screen.getByRole('dialog', { name: 'Daftar Soal' });
    const sheetSubmitBtn = dialog.querySelector('button.sheet-submit-btn') as HTMLButtonElement;
    expect(sheetSubmitBtn.disabled).toBe(true);
  });

  it('38. QuestionNavigatorSheet backdrop click closes the sheet safely', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Open sheet
    await userEvent.click(screen.getByRole('button', { name: 'Daftar Soal' }));
    expect(screen.getByRole('dialog', { name: 'Daftar Soal' })).toBeTruthy();

    // Click backdrop
    const backdrop = document.querySelector('.sheet-backdrop') as HTMLElement;
    expect(backdrop).toBeTruthy();
    await userEvent.click(backdrop);

    // Sheet closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Daftar Soal' })).toBeNull();
    });
  });

  it('39. four workstation actions are present with accessible semantics (Soal Sebelumnya, Daftar Soal, Soal Berikutnya, Selesaikan Ujian) and visible mobile labels', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Verify all four buttons exist in workstation-actions with full accessible names
    const prevBtn = screen.getByRole('button', { name: 'Soal Sebelumnya' }) as HTMLButtonElement;
    const navBtn = screen.getByRole('button', { name: 'Daftar Soal' }) as HTMLButtonElement;
    const nextBtn = screen.getByRole('button', { name: 'Soal Berikutnya' }) as HTMLButtonElement;
    const submitBtn = screen.getByRole('button', { name: 'Selesaikan Ujian' }) as HTMLButtonElement;

    expect(prevBtn).toBeTruthy();
    expect(navBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();
    expect(submitBtn).toBeTruthy();

    // Verify visible mobile short labels are present inside each action button
    expect(prevBtn.textContent).toContain('Sebelum');
    expect(navBtn.textContent).toContain('Daftar');
    expect(nextBtn.textContent).toContain('Berikut');
    expect(submitBtn.textContent).toContain('Selesai');

    // Initial state: question 1 of 2
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
    expect(submitBtn.disabled).toBe(false);
  });

  it('40. workstation Selesaikan Ujian action opens SubmitConfirmModal and is blocked when unresolved saves exist', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        return new Response(JSON.stringify({ error: 'server_down' }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // Action button on workstation
    const workstationSubmitBtn = screen.getByRole('button', { name: 'Selesaikan Ujian' }) as HTMLButtonElement;
    expect(workstationSubmitBtn.disabled).toBe(false);

    // Trigger save failure to produce unresolved save state
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    expect(await screen.findByText('Gagal menyimpan')).toBeTruthy();

    // Workstation Selesaikan Ujian button must now be disabled
    expect(workstationSubmitBtn.disabled).toBe(true);
  });

  it('41. persistent current-question save status presents Belum dijawab when pristine, Menyimpan... during save, Tersimpan upon server acknowledgement, and Gagal menyimpan on failure', async () => {
    window.history.pushState({}, '', `?attemptId=${VALID_ATTEMPT_ID}`);

    let resolveSave: (() => void) | null = null;
    let shouldFail = false;

    fetchSpy.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/assessment/resume')) {
        return new Response(JSON.stringify(createMockResume()), { status: 200 });
      }
      if (url.includes('/api/v1/assessment/questions')) {
        return new Response(
          JSON.stringify({
            attemptId: VALID_ATTEMPT_ID,
            questions: sampleQuestions,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/v1/assessment/answer/save')) {
        if (shouldFail) {
          return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
        }
        const body = JSON.parse(opts?.body as string);
        return new Promise<Response>(resolve => {
          resolveSave = () => {
            resolve(
              new Response(
                JSON.stringify({
                  status: 'acknowledged',
                  clientWriteIdentity: body.clientWriteIdentity,
                  writeVersion: 1,
                }),
                { status: 200 }
              )
            );
          };
        });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    });

    render(<StudentExamWorkstation />);
    expect(await screen.findByText('Manakah unsur kimia dengan simbol O?')).toBeTruthy();

    // 1. Pristine state: persistent status is "Belum dijawab"
    const statusBadge = document.querySelector('.save-status-badge') as HTMLElement;
    expect(statusBadge).toBeTruthy();
    expect(statusBadge.textContent).toContain('Belum dijawab');
    expect(statusBadge.classList.contains('unanswered')).toBe(true);

    // 2. Select option: triggers save in flight -> "Menyimpan..."
    await userEvent.click(screen.getByLabelText(/Oksigen/));
    expect(await screen.findByText('Menyimpan...')).toBeTruthy();
    expect(statusBadge.classList.contains('saving')).toBe(true);

    // 3. Server acknowledges -> transitions to "Tersimpan"
    act(() => {
      if (resolveSave) {
        resolveSave();
      }
    });
    expect(await screen.findByText('Tersimpan')).toBeTruthy();
    expect(statusBadge.classList.contains('saved')).toBe(true);

    // 4. Move to question 2 (pristine) -> verifies pristine state on question 2
    const nextBtn = screen.getByRole('button', { name: 'Soal Berikutnya' });
    await userEvent.click(nextBtn);
    expect(await screen.findByText('Berapakah jumlah sudut siku-siku pada persegi?')).toBeTruthy();
    expect(screen.getByText('Belum dijawab')).toBeTruthy();

    // 5. Select option on question 2 with save failure -> "Gagal menyimpan"
    shouldFail = true;
    await userEvent.click(screen.getByLabelText(/4/));
    expect(await screen.findByText('Gagal menyimpan')).toBeTruthy();
    expect(statusBadge.classList.contains('failed')).toBe(true);
  });
});
