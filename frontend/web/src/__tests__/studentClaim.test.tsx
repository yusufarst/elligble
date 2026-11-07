import { it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudentClaimView } from '../components/StudentClaimView.tsx';
import * as client from '../api/identity-client.ts';

// AUTH-002 public claim form: no account-trust implication, no password field, uniform
// received state, same key on retry, purge on success/cancel/unmount, no late repopulation.
vi.mock('../api/identity-client.ts', async () => ({ ...await vi.importActual<typeof import('../api/identity-client.ts')>('../api/identity-client.ts'), submitClaim: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const SCHOOL = '11111111-1111-4111-8111-111111111111';
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((y, n) => { resolve = y; reject = n; }); return { promise, resolve, reject }; }
function fill(name = 'Siti Rahmawati', nisn = '0012345678', birth = '2010-02-03') {
  fireEvent.change(screen.getByLabelText('Nama Lengkap'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('NISN'), { target: { value: nisn } });
  fireEvent.change(screen.getByLabelText('Tanggal Lahir'), { target: { value: birth } });
}

it('collects only claim fields, never a password, and shows a uniform received state', async () => {
  vi.mocked(client.submitClaim).mockResolvedValue({ status: 'received', requestKey: 'k' });
  render(<StudentClaimView initialTenantId={SCHOOL} onBack={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Ajukan Pendaftaran Akun' })).toBeTruthy();
  expect(screen.queryByLabelText('Kode Sekolah')).toBeNull();
  expect(document.querySelector('input[type=password]')).toBeNull();
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Kirim Pengajuan' }));
  const status = await screen.findByRole('status');
  expect(status.textContent).toContain('Pengajuan sudah dikirim');
  expect(status.textContent).not.toContain('Siti');
  expect(document.activeElement).toBe(status);
  const sent = vi.mocked(client.submitClaim).mock.calls[0][0];
  expect(sent).toMatchObject({ tenantId: SCHOOL, fullName: 'Siti Rahmawati', nisn: '0012345678', birthDate: '2010-02-03' });
  expect(Object.keys(sent).sort()).toEqual(['birthDate', 'fullName', 'nisn', 'requestKey', 'tenantId']);
  expect(screen.queryByDisplayValue('0012345678')).toBeNull();
});

it('validates fields locally, keeps NISN leading zeros, and asks for a school code without a link', async () => {
  vi.mocked(client.submitClaim).mockResolvedValue({ status: 'received', requestKey: 'k' });
  render(<StudentClaimView initialTenantId={null} onBack={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kirim Pengajuan' }));
  expect(await screen.findByText('Nama lengkap wajib diisi.')).toBeTruthy();
  expect(screen.getByText('Kode sekolah tidak valid. Gunakan kode atau tautan dari sekolah Anda.')).toBeTruthy();
  expect(client.submitClaim).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Kode Sekolah'), { target: { value: SCHOOL.toUpperCase() } });
  fill('Budi', '0001', '2010-01-01');
  fireEvent.click(screen.getByRole('button', { name: 'Kirim Pengajuan' }));
  await waitFor(() => expect(client.submitClaim).toHaveBeenCalledTimes(1));
  expect(vi.mocked(client.submitClaim).mock.calls[0][0]).toMatchObject({ tenantId: SCHOOL, nisn: '0001' });
});

it('a failed send retries with the same key; a changed field gets a new key', async () => {
  vi.mocked(client.submitClaim).mockRejectedValueOnce(new client.ClaimApiError('unavailable')).mockRejectedValueOnce(new client.ClaimApiError('busy'))
    .mockResolvedValue({ status: 'received', requestKey: 'k' });
  render(<StudentClaimView initialTenantId={SCHOOL} onBack={() => {}} />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Kirim Pengajuan' }));
  expect((await screen.findByRole('alert')).textContent).toContain('kirim ulang');
  fireEvent.click(screen.getByRole('button', { name: 'Kirim Ulang Pengajuan' }));
  expect((await screen.findByRole('alert')).textContent).toContain('sedang sibuk');
  const [first, second] = vi.mocked(client.submitClaim).mock.calls.map(c => c[0].requestKey);
  expect(second).toBe(first);
  fireEvent.change(screen.getByLabelText('Nama Lengkap'), { target: { value: 'Siti R' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kirim Pengajuan' }));
  await screen.findByRole('status');
  expect(vi.mocked(client.submitClaim).mock.calls[2][0].requestKey).not.toBe(first);
});

it('cancel purges entered data and a late response cannot repopulate an unmounted form', async () => {
  const late = deferred<client.ClaimReceipt>();
  vi.mocked(client.submitClaim).mockReturnValue(late.promise);
  const onBack = vi.fn();
  const view = render(<StudentClaimView initialTenantId={SCHOOL} onBack={onBack} />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Kirim Pengajuan' }));
  expect((screen.getByRole('button', { name: 'Batal' }) as HTMLButtonElement).disabled).toBe(true);
  view.unmount();
  await act(async () => { late.resolve({ status: 'received', requestKey: 'k' }); await late.promise; });
  render(<StudentClaimView initialTenantId={SCHOOL} onBack={onBack} />);
  expect((screen.getByLabelText('Nama Lengkap') as HTMLInputElement).value).toBe('');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
