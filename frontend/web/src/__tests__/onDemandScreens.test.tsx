import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../App.tsx';

// The teacher and proctor screens are downloaded on demand (WEB-001). A screen whose file cannot
// be downloaded shows its heading and the shared failed-load state inside the app, whose
// navigation keeps working, and any navigation (a workspace, the back button) leaves it behind.

const TENANT = '44444444-4444-4444-8444-444444444444';
const EXAM = '66666666-6666-4666-8666-666666666666';

vi.mock('../api/auth-client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/auth-client.ts')>('../api/auth-client.ts');
  return { ...actual, getSession: vi.fn(), getMeContext: vi.fn() };
});
vi.mock('../api/assessment-client.ts', () => ({
  getProctorMonitoring: vi.fn(async () => ({ assignments: [] })),
  getTeacherReadiness: vi.fn(async () => ({ exams: [] })),
  ApiError: class ApiError extends Error {},
}));
// The participant monitoring screen cannot be downloaded (offline, or a release replaced its file).
vi.mock('../components/ExamMonitoringView.tsx', () => {
  throw new TypeError('Failed to fetch dynamically imported module');
});

import { getSession, getMeContext } from '../api/auth-client.ts';
import { setActiveTenantId } from '../api/http.ts';

async function openAsProctor(search: string) {
  setActiveTenantId(TENANT);
  vi.mocked(getSession).mockResolvedValue({
    status: 'authenticated', username: 'pengawas.satu', expiresAt: '2099-01-01T00:00:00.000Z',
    memberships: [{ tenantId: TENANT, displayLabel: 'SMA Negeri 1 Contoh' }],
  });
  vi.mocked(getMeContext).mockResolvedValue({
    tenantId: TENANT, tenantDisplayLabel: 'SMA Negeri 1 Contoh',
    capabilities: { examParticipant: false, proctor: true, teacher: true },
  } as Awaited<ReturnType<typeof getMeContext>>);
  window.history.replaceState({}, '', search);
  render(<App />);
  expect(await screen.findByText('Gagal Memuat Halaman')).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1, name: 'Pemantauan Peserta' })).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Ruang kerja' })).toBeTruthy();
}

describe('screens downloaded on demand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('a workspace chosen after a failed download opens normally', async () => {
    await openAsProctor(`/?view=proctor&monitorExam=${EXAM}`);
    fireEvent.click(screen.getByRole('button', { name: /Ruang Ujian/ }));
    expect(await screen.findByRole('heading', { name: 'Monitoring Ujian' })).toBeTruthy();
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });

  it('the back button leaves a screen that could not be downloaded', async () => {
    await openAsProctor(`/?view=proctor&monitorExam=${EXAM}`);
    act(() => {
      window.history.replaceState({}, '', '/?view=proctor');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByRole('heading', { name: 'Monitoring Ujian' })).toBeTruthy();
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });
});
