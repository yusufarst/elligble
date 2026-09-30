import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// The teacher and proctor screens are one file downloaded on demand (WEB-001). When it cannot be
// downloaded, the page shows the requested screen's heading and the shared failed-load state
// inside the app, whose navigation keeps working; "Coba Lagi" and any navigation (a workspace,
// the back button) ask for the file again.

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

import { getSession, getMeContext } from '../api/auth-client.ts';

const download = { failures: 0 };

/** The app as a proctor who is also a teacher, on a fresh page: the file not downloaded yet. */
async function openAsProctor(search: string) {
  vi.resetModules();
  vi.doMock('../staff-screens.ts', async (importOriginal) => {
    if (download.failures > 0) {
      download.failures -= 1;
      throw new TypeError('Importing a module script failed.');
    }
    return importOriginal();
  });
  vi.mocked(getSession).mockResolvedValue({
    status: 'authenticated', username: 'pengawas.satu', expiresAt: '2099-01-01T00:00:00.000Z',
    memberships: [{ tenantId: TENANT, displayLabel: 'SMA Negeri 1 Contoh' }],
  });
  vi.mocked(getMeContext).mockResolvedValue({
    tenantId: TENANT, tenantDisplayLabel: 'SMA Negeri 1 Contoh',
    capabilities: { examParticipant: false, proctor: true, teacher: true },
  } as Awaited<ReturnType<typeof getMeContext>>);
  const { setActiveTenantId } = await import('../api/http.ts');
  setActiveTenantId(TENANT);
  window.history.replaceState({}, '', search);
  const { App } = await import('../App.tsx');
  render(<App />);
  expect(await screen.findByText('Gagal Memuat Halaman')).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Ruang kerja' })).toBeTruthy();
}

/** The proctor's list, loaded: its empty state (no exam to supervise). */
const proctorListLoaded = () => screen.findByRole('heading', { level: 2, name: 'Belum Ada Ujian yang Diawasi' });

describe('screens downloaded on demand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    download.failures = 1;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the requested screen\'s heading, and a workspace chosen next opens normally', async () => {
    await openAsProctor(`/?view=proctor&monitorExam=${EXAM}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Pemantauan Peserta' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ruang Ujian/ }));
    expect(await proctorListLoaded()).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Monitoring Ujian' })).toBeTruthy();
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });

  it('the back button asks for the file again', async () => {
    await openAsProctor(`/?view=proctor&monitorExam=${EXAM}`);
    act(() => {
      window.history.replaceState({}, '', '/?view=proctor');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await proctorListLoaded()).toBeTruthy();
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });

  it('"Coba Lagi" shows the screen once the file can be downloaded, without reloading the page', async () => {
    await openAsProctor('/?view=proctor');
    expect(screen.getByRole('heading', { level: 1, name: 'Monitoring Ujian' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(await proctorListLoaded()).toBeTruthy();
    expect(screen.queryByText('Gagal Memuat Halaman')).toBeNull();
  });
});
