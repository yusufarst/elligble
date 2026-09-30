import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from '../App.tsx';

const TENANT_A = '44444444-4444-4444-8444-444444444444';
const TENANT_B = '55555555-5555-4555-8555-555555555555';

vi.mock('../api/auth-client.ts', async () => {
  const actual = await vi.importActual<typeof import('../api/auth-client.ts')>('../api/auth-client.ts');
  return { ...actual, getSession: vi.fn(), getMeContext: vi.fn(), login: vi.fn(), logout: vi.fn(), activate: vi.fn() };
});
vi.mock('../api/assessment-client.ts', () => ({
  getAssignedExams: vi.fn(async () => ({ assignments: [] })),
  getProctorMonitoring: vi.fn(async () => ({ assignments: [] })),
  getTeacherReadiness: vi.fn(async () => ({ exams: [] })),
  ApiError: class ApiError extends Error {},
}));

import { getSession, getMeContext, login, logout, activate, LoginError, ActivationError } from '../api/auth-client.ts';
import { apiFetch, getActiveTenantId, setActiveTenantId } from '../api/http.ts';
import { act } from '@testing-library/react';

const session = (memberships: Array<{ tenantId: string; displayLabel: string | null }>) => ({
  status: 'authenticated' as const, username: 'siswa.satu', expiresAt: '2099-01-01T00:00:00.000Z', memberships,
});
const me = (tenantId: string, caps: Partial<{ examParticipant: boolean; proctor: boolean; teacher: boolean }>) => ({
  tenantId, tenantDisplayLabel: tenantId === TENANT_A ? 'SMA Negeri 1 Contoh' : 'SMA Negeri 2 Contoh',
  capabilities: { examParticipant: false, proctor: false, teacher: false, ...caps },
});

describe('session gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveTenantId(null);
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('shows the login screen when there is no session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Masuk ke ELLIGBLE' })).toBeDefined();
    expect(screen.getByLabelText('ELLIGBLE ID')).toBeDefined();
    expect(screen.getByLabelText('Kata Sandi')).toBeDefined();
  });

  it('validates required fields in Bahasa Indonesia without calling the server', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('ELLIGBLE ID wajib diisi.')).toBeDefined();
    expect(screen.getByText('Kata sandi wajib diisi.')).toBeDefined();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows a generic error for wrong credentials and clears the password', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(login).mockRejectedValue(new LoginError('invalid_credentials'));
    render(<App />);
    fireEvent.change(await screen.findByLabelText('ELLIGBLE ID'), { target: { value: 'siswa.satu' } });
    fireEvent.change(screen.getByLabelText('Kata Sandi'), { target: { value: 'salah-sandi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('ELLIGBLE ID atau kata sandi tidak sesuai. Periksa kembali lalu coba lagi.')).toBeDefined();
    expect((screen.getByLabelText('Kata Sandi') as HTMLInputElement).value).toBe('');
  });

  it('explains throttling after too many attempts', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(login).mockRejectedValue(new LoginError('too_many_attempts'));
    render(<App />);
    fireEvent.change(await screen.findByLabelText('ELLIGBLE ID'), { target: { value: 'siswa.satu' } });
    fireEvent.change(screen.getByLabelText('Kata Sandi'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText(/Terlalu banyak percobaan masuk/)).toBeDefined();
  });

  it('logs in, auto-selects the only tenant and opens the student workspace', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(login).mockResolvedValue(session([{ tenantId: TENANT_A, displayLabel: 'SMA Negeri 1 Contoh' }]));
    vi.mocked(getMeContext).mockResolvedValue(me(TENANT_A, { examParticipant: true }));
    render(<App />);
    fireEvent.change(await screen.findByLabelText('ELLIGBLE ID'), { target: { value: 'siswa.satu' } });
    fireEvent.change(screen.getByLabelText('Kata Sandi'), { target: { value: 'benar-sandi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('Daftar Ujian Siswa')).toBeDefined();
    expect(login).toHaveBeenCalledWith('siswa.satu', 'benar-sandi');
    expect(window.localStorage.getItem('elligble.activeTenant')).toBe(TENANT_A);
  });

  it('asks which school to open when the account has several memberships', async () => {
    vi.mocked(getSession).mockResolvedValue(session([
      { tenantId: TENANT_A, displayLabel: 'SMA Negeri 1 Contoh' },
      { tenantId: TENANT_B, displayLabel: 'SMA Negeri 2 Contoh' },
    ]));
    vi.mocked(getMeContext).mockResolvedValue(me(TENANT_B, { teacher: true }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Pilih Sekolah' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /SMA Negeri 2 Contoh/ }));
    expect(await screen.findByTestId('active-tenant')).toBeDefined();
    expect(screen.getByTestId('active-tenant').textContent).toBe('SMA Negeri 2 Contoh');
    expect(screen.getByRole('button', { name: 'Ganti Sekolah' })).toBeDefined();
  });

  it('only offers workspaces backed by explicit assignments', async () => {
    setActiveTenantId(TENANT_A);
    vi.mocked(getSession).mockResolvedValue(session([{ tenantId: TENANT_A, displayLabel: 'SMA Negeri 1 Contoh' }]));
    vi.mocked(getMeContext).mockResolvedValue(me(TENANT_A, { proctor: true, teacher: true }));
    window.history.replaceState({}, '', '/?view=student');
    render(<App />);
    expect(await screen.findByRole('navigation', { name: 'Ruang kerja' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Ruang Ujian/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Pelaksanaan Ujian/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Jadwal Ujian/ })).toBeNull();
    expect(screen.getByText(/Halaman yang diminta tidak tersedia/)).toBeDefined();
  });

  it('logs out back to the login screen', async () => {
    vi.mocked(getSession).mockResolvedValue(session([{ tenantId: TENANT_A, displayLabel: 'SMA Negeri 1 Contoh' }]));
    vi.mocked(getMeContext).mockResolvedValue(me(TENANT_A, { examParticipant: true }));
    vi.mocked(logout).mockResolvedValue();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keluar' }));
    expect(await screen.findByRole('heading', { name: 'Masuk ke ELLIGBLE' })).toBeDefined();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the server cannot be reached', async () => {
    vi.mocked(getSession).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(null);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Coba Lagi' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Masuk ke ELLIGBLE' })).toBeDefined());
  });

  it('logout forgets the school choice so the next person on a shared device chooses explicitly', async () => {
    setActiveTenantId(TENANT_B);
    vi.mocked(getSession).mockResolvedValue(session([
      { tenantId: TENANT_A, displayLabel: 'SMA Negeri 1 Contoh' },
      { tenantId: TENANT_B, displayLabel: 'SMA Negeri 2 Contoh' },
    ]));
    vi.mocked(getMeContext).mockResolvedValue(me(TENANT_B, { teacher: true }));
    vi.mocked(logout).mockResolvedValue();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keluar' }));
    await screen.findByRole('heading', { name: 'Masuk ke ELLIGBLE' });
    expect(getActiveTenantId()).toBeNull();
    expect(window.localStorage.getItem('elligble.activeTenant')).toBeNull();
  });

  it('an expired session keeps the screen and asks the same account to sign in again', async () => {
    vi.mocked(getSession).mockResolvedValue(session([{ tenantId: TENANT_A, displayLabel: 'SMA Negeri 1 Contoh' }]));
    vi.mocked(getMeContext).mockResolvedValue(me(TENANT_A, { examParticipant: true }));
    vi.mocked(login).mockResolvedValue(session([{ tenantId: TENANT_A, displayLabel: 'SMA Negeri 1 Contoh' }]));
    render(<App />);
    await screen.findByText('Daftar Ujian Siswa');

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      await apiFetch('/api/v1/assessment/resume?attemptId=x');
    });
    vi.unstubAllGlobals();

    expect(await screen.findByRole('heading', { name: 'Sesi Anda Telah Berakhir' })).toBeDefined();
    const idField = screen.getAllByLabelText('ELLIGBLE ID').at(-1) as HTMLInputElement;
    expect(idField.value).toBe('siswa.satu');
    expect(idField.readOnly).toBe(true);
    expect(screen.getByText('Daftar Ujian Siswa')).toBeDefined();

    const passwordFields = screen.getAllByLabelText('Kata Sandi');
    fireEvent.change(passwordFields.at(-1)!, { target: { value: 'benar-sandi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk Kembali' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sesi Anda Telah Berakhir' })).toBeNull());
    expect(login).toHaveBeenCalledWith('siswa.satu', 'benar-sandi');
    expect(screen.getByText('Daftar Ujian Siswa')).toBeDefined();
  });
  async function openActivation() {
    vi.mocked(getSession).mockResolvedValue(null);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Belum pernah masuk? Aktifkan akun dengan kode aktivasi' }));
    expect(await screen.findByRole('heading', { name: 'Aktivasi Akun' })).toBeDefined();
  }

  function fillActivation(values: { username?: string; code?: string; password?: string; confirm?: string }) {
    if (values.username !== undefined) fireEvent.change(screen.getByLabelText('ELLIGBLE ID'), { target: { value: values.username } });
    if (values.code !== undefined) fireEvent.change(screen.getByLabelText('Kode Aktivasi'), { target: { value: values.code } });
    if (values.password !== undefined) fireEvent.change(screen.getByLabelText('Kata Sandi Baru'), { target: { value: values.password } });
    if (values.confirm !== undefined) fireEvent.change(screen.getByLabelText('Ulangi Kata Sandi Baru'), { target: { value: values.confirm } });
    fireEvent.click(screen.getByRole('button', { name: 'Aktifkan dan Masuk' }));
  }

  it('activation validates required fields, length and confirmation without calling the server', async () => {
    await openActivation();
    fillActivation({});
    expect(await screen.findByText('ELLIGBLE ID wajib diisi.')).toBeDefined();
    expect(screen.getByText('Kode aktivasi wajib diisi.')).toBeDefined();
    expect(screen.getByText('Kata sandi baru wajib diisi.')).toBeDefined();
    fillActivation({ username: 'siswa.baru', code: 'ABCD-EFGH-JKMN', password: 'pendek', confirm: 'pendek' });
    expect(await screen.findByText('Kata sandi minimal 8 karakter.')).toBeDefined();
    fillActivation({ password: 'matahari-pagi-2026', confirm: 'matahari-pagi-2025' });
    expect(await screen.findByText('Kedua kata sandi tidak sama.')).toBeDefined();
    expect(activate).not.toHaveBeenCalled();
  });

  it('activation explains a refused password next to the field', async () => {
    vi.mocked(activate).mockRejectedValue(new ActivationError('password_rejected', 'too_common'));
    await openActivation();
    fillActivation({ username: 'siswa.baru', code: 'ABCD-EFGH-JKMN', password: 'bismillah1', confirm: 'bismillah1' });
    expect(await screen.findByText('Kata sandi ini terlalu umum atau mudah ditebak. Pilih kata sandi lain.')).toBeDefined();
    expect((screen.getByLabelText('Kata Sandi Baru') as HTMLInputElement).value).toBe('');
  });

  it('activation reports a wrong, used or expired code without revealing which', async () => {
    vi.mocked(activate).mockRejectedValue(new ActivationError('invalid_activation'));
    await openActivation();
    fillActivation({ username: 'siswa.baru', code: 'ABCD-EFGH-JKMN', password: 'matahari-pagi-2026', confirm: 'matahari-pagi-2026' });
    expect(await screen.findByText(/ELLIGBLE ID atau kode aktivasi tidak sesuai, sudah dipakai, atau sudah kedaluwarsa/)).toBeDefined();
  });

  it('a successful activation signs the person in like a login', async () => {
    vi.mocked(activate).mockResolvedValue(session([{ tenantId: TENANT_A, displayLabel: 'SMA Negeri 1 Contoh' }]));
    vi.mocked(getMeContext).mockResolvedValue(me(TENANT_A, { examParticipant: true }));
    await openActivation();
    fillActivation({ username: ' siswa.baru ', code: 'abcd efgh jkmn', password: 'matahari-pagi-2026', confirm: 'matahari-pagi-2026' });
    expect(await screen.findByText('SMA Negeri 1 Contoh')).toBeDefined();
    expect(activate).toHaveBeenCalledWith('siswa.baru', 'abcd efgh jkmn', 'matahari-pagi-2026');
  });

  it('the activation screen leads back to the login form', async () => {
    await openActivation();
    fireEvent.click(screen.getByRole('button', { name: 'Kembali ke halaman masuk' }));
    expect(await screen.findByRole('heading', { name: 'Masuk ke ELLIGBLE' })).toBeDefined();
  });
});
