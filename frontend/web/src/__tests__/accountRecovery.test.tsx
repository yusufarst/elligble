import { it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AccountRecoveryView } from '../components/AccountRecoveryView.tsx';
import * as client from '../api/identity-client.ts';

// AUTH-003 verifier recovery UI: lookup, in-person comparison, reasoned issue with the same key
// on retry, one-time code handoff, purge on a new lookup, close and unmount.
vi.mock('../api/identity-client.ts', async () => ({ ...await vi.importActual<typeof import('../api/identity-client.ts')>('../api/identity-client.ts'), authorizeRecovery: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const preview: client.RecoveryPreview = { phase: 'preview', elligbleId: 'elg-abcd-efgh-jkmn', roster: { fullName: 'Rina Putri', nisn: '0012345678', birthDate: '2010-02-03', groupLabel: 'X-1', revision: 2 } };
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

async function lookup() {
  fireEvent.change(screen.getByLabelText('ELLIGBLE ID siswa'), { target: { value: ' elg-abcd-efgh-jkmn ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Periksa' }));
  await screen.findByText('Rina Putri');
}

it('shows the comparison fields, needs in-person confirmation and a reason, and shows the code once', async () => {
  vi.mocked(client.authorizeRecovery).mockResolvedValueOnce(preview).mockRejectedValueOnce(new client.ClaimApiError('unavailable'))
    .mockResolvedValue({ phase: 'issued', elligbleId: 'elg-abcd-efgh-jkmn', recoveryCode: 'ABCD-EFGH-JKMN', expiresAt: '2026-11-07T08:15:00Z', replayed: false });
  render(<AccountRecoveryView />);
  await lookup();
  expect(vi.mocked(client.authorizeRecovery).mock.calls[0][0]).toEqual({ elligbleId: 'elg-abcd-efgh-jkmn', confirmed: false });
  expect(screen.getByText('0012345678')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Terbitkan Kode Pemulihan' }));
  const dialog = await screen.findByRole('dialog', { name: 'Terbitkan Kode Pemulihan?' });
  const send = within(dialog).getByRole('button', { name: 'Terbitkan' }) as HTMLButtonElement;
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }), { target: { value: 'Lupa kata sandi' } });
  expect(send.disabled).toBe(true);
  fireEvent.click(within(dialog).getByLabelText('Saya sudah memverifikasi siswa ini secara langsung dengan kartu pelajar.'));
  expect(send.disabled).toBe(false);
  fireEvent.click(send);
  const retry = await within(dialog).findByRole('button', { name: 'Kirim Ulang Tindakan' });
  fireEvent.click(retry);
  const handoff = await screen.findByRole('dialog', { name: 'Serahkan Kode Pemulihan' });
  expect(handoff.textContent).toContain('ABCD-EFGH-JKMN');
  const [first, second] = vi.mocked(client.authorizeRecovery).mock.calls.slice(1).map(c => c[0]);
  expect(second).toEqual(first);
  expect(first).toMatchObject({ elligbleId: 'elg-abcd-efgh-jkmn', confirmed: true, expectedRosterRevision: 2, reason: 'Lupa kata sandi', inPersonVerified: true });
  expect(screen.queryByText('0012345678')).toBeNull();
  fireEvent.click(within(handoff).getByRole('button', { name: 'Selesai, Tutup Kode' }));
  await waitFor(() => expect(screen.queryByText('ABCD-EFGH-JKMN')).toBeNull());
  expect(await screen.findByText('Kode pemulihan sudah ditutup dari layar.')).toBeTruthy();
});

it('a bounded refusal shows one neutral message; editing the ID purges the comparison', async () => {
  vi.mocked(client.authorizeRecovery).mockRejectedValueOnce(new client.ClaimApiError('not_found_in_scope')).mockResolvedValue(preview);
  render(<AccountRecoveryView />);
  fireEvent.change(screen.getByLabelText('ELLIGBLE ID siswa'), { target: { value: 'elg-zzzz-zzzz-zzzz' } });
  fireEvent.click(screen.getByRole('button', { name: 'Periksa' }));
  expect((await screen.findByRole('alert')).textContent).toContain('tidak ditemukan dalam cakupan Anda');
  await lookup();
  fireEvent.change(screen.getByLabelText('ELLIGBLE ID siswa'), { target: { value: 'elg-abcd-efgh-jkmx' } });
  expect(screen.queryByText('Rina Putri')).toBeNull();
});

it('a late preview after unmount cannot repopulate the screen', async () => {
  const late = deferred<client.RecoveryPreview>();
  vi.mocked(client.authorizeRecovery).mockReturnValue(late.promise as never);
  const view = render(<AccountRecoveryView />);
  fireEvent.change(screen.getByLabelText('ELLIGBLE ID siswa'), { target: { value: 'elg-abcd-efgh-jkmn' } });
  fireEvent.click(screen.getByRole('button', { name: 'Periksa' }));
  view.unmount();
  await act(async () => { late.resolve(preview); await late.promise; });
  render(<AccountRecoveryView />);
  expect(screen.queryByText('Rina Putri')).toBeNull();
});
