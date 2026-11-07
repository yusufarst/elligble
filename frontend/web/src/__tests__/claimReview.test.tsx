import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ClaimReviewView } from '../components/ClaimReviewView.tsx';
import { availableWorkspaces } from '../session/AppShell.tsx';
import * as client from '../api/identity-client.ts';

// AUTH-002 scoped verifier UI: explicit adjudication, in-person confirmation, reason, replay
// with the same key, one-time code handoff, and focus kept after the trigger disappears.
vi.mock('../api/identity-client.ts', async () => ({ ...await vi.importActual<typeof import('../api/identity-client.ts')>('../api/identity-client.ts'), getClaimReview: vi.fn(), decideClaim: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const TENANT = '99999999-9999-4999-8999-999999999999';
const item = (over: Partial<client.ClaimReviewItem> = {}): client.ClaimReviewItem => ({
  claimId: 'c1', revision: 1, state: 'PENDING_REVIEW', expired: false, createdAt: '2026-11-07T01:00:00Z', expiresAt: '2026-11-14T01:00:00Z',
  submitted: { fullName: 'Dewi Lestari', nisn: '0011112222', birthDate: '2010-03-04' },
  roster: { revision: 1, fullName: 'Dewi Lestari', groupLabel: 'X-1', bound: false, nameMatches: true }, ...over,
});
const queue = (claims: client.ClaimReviewItem[]): client.ClaimReview => ({ authority: 'homeroom', claims, truncated: false });

it('only the server-derived verifier capability adds the verification workspace', () => {
  const me = { tenantId: TENANT, tenantDisplayLabel: 'S', capabilities: { examParticipant: false, teacher: true, proctor: false } };
  expect(availableWorkspaces(me)).toEqual(['teacher']);
  expect(availableWorkspaces({ ...me, capabilities: { ...me.capabilities, claimVerifier: true } })).toEqual(['teacher', 'verifier']);
});

it('approval needs an adjudication, in-person confirmation and a reason; the code is shown once', async () => {
  vi.mocked(client.getClaimReview).mockResolvedValueOnce(queue([item()])).mockResolvedValue(queue([]));
  vi.mocked(client.decideClaim).mockRejectedValueOnce(new client.ClaimApiError('unavailable')).mockResolvedValue({
    outcome: 'APPROVED', claimId: 'c1', revision: 2, elligbleId: 'elg-abcd-efgh-jkmn', activationCode: 'ABCD-EFGH-JKMN',
    activationExpiresAt: '2026-11-14T02:00:00Z', claimExpiresAt: '2026-11-14T01:00:00Z', replayed: false,
  });
  render(<ClaimReviewView tenantId={TENANT} />);
  expect(screen.getByText(TENANT)).toBeTruthy();
  fireEvent.click(await screen.findByRole('button', { name: 'Setujui pengajuan Dewi Lestari' }));
  const dialog = await screen.findByRole('dialog', { name: 'Setujui Pengajuan?' });
  const send = within(dialog).getByRole('button', { name: 'Setujui' }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  fireEvent.click(within(dialog).getByLabelText('Siswa belum punya akun ELLIGBLE'));
  fireEvent.click(within(dialog).getByLabelText('Saya sudah menanyakan langsung dan siswa tidak memiliki kartu atau ELLIGBLE ID lama.'));
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }), { target: { value: 'Diverifikasi langsung' } });
  expect(send.disabled).toBe(true);
  fireEvent.click(within(dialog).getByLabelText('Saya sudah memverifikasi siswa ini secara langsung.'));
  expect(send.disabled).toBe(false);
  fireEvent.click(send);
  const retry = await within(dialog).findByRole('button', { name: 'Kirim Ulang Tindakan' });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  fireEvent.click(retry);
  const handoff = await screen.findByRole('dialog', { name: 'Serahkan Kode Aktivasi' });
  expect(handoff.textContent).toContain('ABCD-EFGH-JKMN');
  expect(handoff.textContent).toContain('elg-abcd-efgh-jkmn');
  const [a, b] = vi.mocked(client.decideClaim).mock.calls.map(c => c[0]);
  expect(b.requestKey).toBe(a.requestKey);
  expect(a).toMatchObject({ claimId: 'c1', expectedRevision: 1, expectedRosterRevision: 1, decision: 'APPROVE', adjudication: 'NEW_IDENTITY_REVIEWED', noExistingAccountConfirmed: true, confirmed: true });
  expect(a.elligbleId).toBeUndefined();
  fireEvent.click(within(handoff).getByRole('button', { name: 'Selesai, Tutup Kode' }));
  await waitFor(() => expect(screen.queryByText('ABCD-EFGH-JKMN')).toBeNull());
  expect(await screen.findByText('Keputusan tersimpan. Kode aktivasi sudah ditutup dari layar.')).toBeTruthy();
  expect(document.activeElement?.textContent).toBe('Daftar pengajuan');
});

it('continuity sends the entered ELLIGBLE ID; a bound roster uses its binding', async () => {
  vi.mocked(client.getClaimReview).mockResolvedValue(queue([item(), item({ claimId: 'c2', submitted: { fullName: 'Andi', nisn: '1', birthDate: '2010-01-01' }, roster: { revision: 3, fullName: 'Andi', groupLabel: 'X-1', bound: true, nameMatches: true } })]));
  vi.mocked(client.decideClaim).mockResolvedValue({ outcome: 'APPROVED_EXISTING_ACCOUNT', claimId: 'c1', revision: 2, elligbleId: 'andi', replayed: false });
  render(<ClaimReviewView tenantId={TENANT} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Setujui pengajuan Dewi Lestari' }));
  let dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByLabelText('Siswa sudah punya akun ELLIGBLE dan menunjukkan ELLIGBLE ID-nya'));
  fireEvent.change(within(dialog).getByLabelText('ELLIGBLE ID siswa'), { target: { value: ' elg-wxyz-wxyz-wxyz ' } });
  fireEvent.click(within(dialog).getByLabelText('Saya sudah memverifikasi siswa ini secara langsung.'));
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }), { target: { value: 'Kartu lama ditunjukkan' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Setujui' }));
  expect(await screen.findByRole('dialog', { name: 'Siswa Sudah Memiliki Akun' })).toBeTruthy();
  expect(vi.mocked(client.decideClaim).mock.calls[0][0]).toMatchObject({ adjudication: 'EXISTING_ACCOUNT_CONTINUITY', elligbleId: 'elg-wxyz-wxyz-wxyz' });
  fireEvent.click(screen.getByRole('button', { name: 'Selesai, Tutup Kode' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Setujui pengajuan Andi' }));
  dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByLabelText('ELLIGBLE ID siswa')).toBeNull();
  expect(dialog.textContent).toContain('sudah terhubung');
  fireEvent.click(within(dialog).getByLabelText('Saya sudah memverifikasi siswa ini secara langsung.'));
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }), { target: { value: 'Identitas terhubung' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Setujui' }));
  await waitFor(() => expect(client.decideClaim).toHaveBeenCalledTimes(2));
  expect(vi.mocked(client.decideClaim).mock.calls[1][0]).toMatchObject({ claimId: 'c2', expectedRosterRevision: 3, adjudication: 'EXISTING_BINDING' });
});

it('review-required claims cannot be approved, cancellation purges the draft, refusals are bounded', async () => {
  vi.mocked(client.getClaimReview).mockResolvedValue(queue([item({ state: 'REVIEW_REQUIRED', roster: null })]));
  vi.mocked(client.decideClaim).mockRejectedValue(new client.ClaimApiError('stale_conflict'));
  render(<ClaimReviewView tenantId={TENANT} />);
  expect(await screen.findByText('Tidak cocok dengan daftar resmi')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Setujui pengajuan Dewi Lestari' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tolak pengajuan Dewi Lestari' }));
  let dialog = await screen.findByRole('dialog', { name: 'Tolak Pengajuan?' });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }), { target: { value: 'Data rahasia sementara' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Tolak pengajuan Dewi Lestari' }));
  dialog = await screen.findByRole('dialog', { name: 'Tolak Pengajuan?' });
  expect((within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }) as HTMLTextAreaElement).value).toBe('');
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Alasan tindakan' }), { target: { value: 'Data tidak cocok' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tolak' }));
  expect((await within(dialog).findByRole('alert')).textContent).toContain('Muat ulang daftar');
  expect(vi.mocked(client.decideClaim).mock.calls[0][0]).toMatchObject({ decision: 'REJECT', reason: 'Data tidak cocok' });
  expect(vi.mocked(client.decideClaim).mock.calls[0][0].adjudication).toBeUndefined();
});
