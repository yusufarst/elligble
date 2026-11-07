import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionReasonField, permissionDialogClass, validActionReason } from './ActionReasonField.tsx';
import { newActionKey } from '../lib/action-key.ts';
import { formatDateTime } from '../lib/format.ts';
import {
  ClaimApiError, decideClaim, getClaimReview,
  type ClaimAdjudication, type ClaimDecisionResult, type ClaimReview, type ClaimReviewItem,
} from '../api/identity-client.ts';

// AUTH-002 scoped verifier queue (record §7, D1/D2). Only the verifier's own scope is listed.
// Approval needs an in-person check and one explicit adjudication; the activation code of an
// approval is shown once, held only in memory and cleared on close, navigation or unmount.

type Decision = 'APPROVE' | 'REJECT' | 'CANCEL';
interface Draft { claim: ClaimReviewItem; decision: Decision }
interface Handoff { elligbleId: string; activationCode: string | null; activationExpiresAt: string | null; claimExpiresAt: string | null }

const STATE_LABEL: Record<ClaimReviewItem['state'], string> = {
  PENDING_REVIEW: 'Menunggu verifikasi',
  REVIEW_REQUIRED: 'Perlu ditinjau',
  APPROVED_PENDING_ACTIVATION: 'Disetujui, menunggu aktivasi',
};
const DECISION_TITLE: Record<Decision, string> = {
  APPROVE: 'Setujui Pengajuan?',
  REJECT: 'Tolak Pengajuan?',
  CANCEL: 'Batalkan Pengajuan?',
};
const DECISION_ACTION: Record<Decision, string> = { APPROVE: 'Setujui', REJECT: 'Tolak', CANCEL: 'Batalkan Pengajuan' };

function failureCopy(error: unknown): string {
  const code = error instanceof ClaimApiError ? error.code : '';
  if (code === 'forbidden' || code === 'unauthorized') return 'Akses verifikasi tidak tersedia. Periksa akun dan sekolah yang dipilih.';
  if (code === 'review_required') return 'Pengajuan belum dapat disetujui dengan pilihan ini. Data perlu ditinjau oleh operator sekolah.';
  if (code === 'stale_conflict' || code === 'not_found') return 'Data pengajuan atau daftar siswa berubah. Muat ulang daftar sebelum memutuskan.';
  if (code === 'claim_closed') return 'Pengajuan sudah ditutup atau kedaluwarsa. Muat ulang daftar.';
  if (code === 'action_key_reused') return 'Tindakan ini sudah tercatat dengan isi berbeda. Tutup lalu buka ulang pengajuan.';
  if (code === 'school_time_zone_missing') return 'Zona waktu sekolah belum diatur. Hubungi pengelola platform sebelum menyetujui.';
  if (code === 'invalid_request') return 'Isian keputusan belum lengkap. Periksa kembali.';
  return 'Konfirmasi belum diterima server. Anda dapat mengirim ulang tindakan yang sama.';
}

export interface ClaimReviewViewProps { tenantId: string }

export function ClaimReviewView({ tenantId }: ClaimReviewViewProps) {
  const [review, setReview] = useState<ClaimReview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adjudication, setAdjudication] = useState<ClaimAdjudication | null>(null);
  const [elligbleId, setElligbleId] = useState('');
  const [attested, setAttested] = useState(false);
  const [inPerson, setInPerson] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const intent = useRef<string | null>(null);
  const generation = useRef(0);
  const loads = useRef(0);
  const sending = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const ids = { elligble: useId(), attest: useId(), inPerson: useId(), adjudication: useId() };

  const load = useCallback(async (from: number) => {
    const current = ++loads.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getClaimReview(from);
      if (current === loads.current) setReview(result);
    } catch (e) {
      if (current === loads.current) { setReview(null); setLoadError(failureCopy(e)); }
    } finally {
      if (current === loads.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(offset); }, [load, offset]);
  useEffect(() => () => { generation.current++; loads.current++; intent.current = null; }, []);
  useEffect(() => { if (draft && error && !pending) retryRef.current?.focus(); }, [draft, error, pending]);

  function resetDraft() {
    intent.current = null;
    setDraft(null); setAdjudication(null); setElligbleId(''); setAttested(false); setInPerson(false); setReason(''); setError(null);
  }
  function openDraft(claim: ClaimReviewItem, decision: Decision) {
    resetDraft(); setNotice(null);
    setDraft({ claim, decision });
    if (decision === 'APPROVE' && claim.roster?.bound) setAdjudication('EXISTING_BINDING');
  }
  function close() {
    if (sending.current) return;
    resetDraft();
  }
  function edit<T>(setter: (value: T) => void) {
    return (value: T) => { intent.current = null; setError(null); setter(value); };
  }

  const approving = draft?.decision === 'APPROVE';
  const ready = draft !== null && validActionReason(reason) && (!approving || (
    inPerson && adjudication !== null
    && (adjudication !== 'EXISTING_ACCOUNT_CONTINUITY' || elligbleId.trim().length > 0)
    && (adjudication !== 'NEW_IDENTITY_REVIEWED' || attested)));

  async function send() {
    if (!draft || !ready || sending.current) return;
    intent.current ??= newActionKey();
    sending.current = true;
    const current = generation.current;
    setPending(true); setError(null);
    const { claim, decision } = draft;
    try {
      const result: ClaimDecisionResult = await decideClaim({
        claimId: claim.claimId, expectedRevision: claim.revision, decision, reason, confirmed: true, requestKey: intent.current,
        ...(decision === 'APPROVE' && claim.roster ? { expectedRosterRevision: claim.roster.revision, adjudication: adjudication! } : {}),
        ...(decision === 'APPROVE' && adjudication === 'EXISTING_ACCOUNT_CONTINUITY' ? { elligbleId: elligbleId.trim() } : {}),
        ...(decision === 'APPROVE' && adjudication === 'NEW_IDENTITY_REVIEWED' ? { noExistingAccountConfirmed: true as const } : {}),
      });
      if (current !== generation.current) return;
      resetDraft();
      if (result.outcome === 'APPROVED' && 'activationCode' in result) {
        // The code works only until the earlier of its own expiry and the claim's expiry.
        const deadline = Date.parse(result.claimExpiresAt) < Date.parse(result.activationExpiresAt) ? result.claimExpiresAt : result.activationExpiresAt;
        setHandoff({ elligbleId: result.elligbleId, activationCode: result.activationCode, activationExpiresAt: result.activationExpiresAt, claimExpiresAt: deadline });
      } else if (result.outcome === 'APPROVED_EXISTING_ACCOUNT' && 'elligbleId' in result) {
        setHandoff({ elligbleId: result.elligbleId, activationCode: null, activationExpiresAt: null, claimExpiresAt: null });
      } else {
        setNotice(result.replayed ? 'Tindakan ini sudah tercatat sebelumnya. Kode aktivasi tidak ditampilkan ulang.' : 'Keputusan tersimpan.');
      }
      void load(offset);
    } catch (e) {
      if (current === generation.current) setError(failureCopy(e));
    } finally {
      sending.current = false;
      if (current === generation.current) setPending(false);
    }
  }

  function finishHandoff() {
    setHandoff(null);
    setNotice('Keputusan tersimpan. Kode aktivasi sudah ditutup dari layar.');
  }

  return (
    <Page id="claim-review" className="min-w-0 [overflow-wrap:anywhere]">
      <PageHeader title="Verifikasi Pendaftaran">
        <p className="m-0 text-muted-foreground">
          Verifikasi siswa secara langsung di sekolah. Cocokkan nama, NISN, dan tanggal lahir dengan kartu pelajar sebelum memutuskan.
        </p>
      </PageHeader>
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">Daftar pengajuan</h2>
      <p className="m-0 text-sm text-muted-foreground">Kode sekolah untuk pengajuan siswa: <span className="break-all font-mono">{tenantId}</span></p>
      {notice && <p role="status" className="m-0 rounded-md border border-border p-4">{notice}</p>}
      {loadError && <p role="alert" className="m-0 text-danger-ink">{loadError}</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => void load(offset)} disabled={loading || pending}>{loading ? 'Memuat...' : 'Muat Ulang Daftar'}</Button>
      </div>
      {review && review.claims.length === 0 && <p className="m-0" role="status">Tidak ada pengajuan yang menunggu verifikasi Anda.</p>}
      {review && review.claims.length > 0 && (
        <ol className="m-0 grid min-w-0 list-none gap-3 p-0 lg:grid-cols-2" aria-label="Pengajuan menunggu keputusan">
          {review.claims.map(claim => (
            <li key={claim.claimId} className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-4">
              <p className="m-0 text-sm font-medium">{claim.expired ? 'Kedaluwarsa' : STATE_LABEL[claim.state]}</p>
              <p className="m-0 font-semibold">{claim.submitted.fullName}</p>
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt>NISN</dt><dd className="m-0 break-all">{claim.submitted.nisn}</dd>
                <dt>Tanggal lahir</dt><dd className="m-0">{claim.submitted.birthDate}</dd>
                <dt>Daftar resmi</dt><dd className="m-0">{claim.roster ? claim.roster.fullName : 'Tidak cocok dengan daftar resmi'}</dd>
                <dt>Rombel</dt><dd className="m-0">{claim.roster?.groupLabel ?? 'Tidak diketahui'}</dd>
                <dt>Berlaku sampai</dt><dd className="m-0">{formatDateTime(claim.expiresAt)}</dd>
              </dl>
              {claim.roster && !claim.roster.nameMatches && <p className="m-0 text-sm">Nama berbeda dengan daftar resmi. Pengajuan perlu ditinjau.</p>}
              <div className="flex flex-wrap gap-2">
                {claim.state === 'PENDING_REVIEW' && !claim.expired && (
                  <Button onClick={() => openDraft(claim, 'APPROVE')} aria-label={`Setujui pengajuan ${claim.submitted.fullName}`}>Setujui</Button>
                )}
                {claim.state !== 'APPROVED_PENDING_ACTIVATION' && (
                  <Button variant="secondary" onClick={() => openDraft(claim, 'REJECT')} aria-label={`Tolak pengajuan ${claim.submitted.fullName}`}>Tolak</Button>
                )}
                <Button variant="secondary" onClick={() => openDraft(claim, 'CANCEL')} aria-label={`Batalkan pengajuan ${claim.submitted.fullName}`}>Batalkan</Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {review && (review.truncated || offset > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-sm text-muted-foreground">Menampilkan pengajuan {offset + 1} sampai {offset + review.claims.length}. Pengajuan yang cocok dengan daftar resmi ditampilkan lebih dulu.</p>
          {offset > 0 && <Button variant="secondary" disabled={loading || pending} onClick={() => setOffset(0)}>Kembali ke Halaman Pertama</Button>}
          {review.truncated && <Button variant="secondary" disabled={loading || pending} onClick={() => setOffset(offset + 100)}>Tampilkan Berikutnya</Button>}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={next => { if (!next) close(); }}>
        <DialogContent className={`max-h-[90dvh] overflow-y-auto ${permissionDialogClass}`}
          onCloseAutoFocus={e => { e.preventDefault(); headingRef.current?.focus(); }}
          onEscapeKeyDown={e => { if (sending.current) e.preventDefault(); }}
          onInteractOutside={e => { if (sending.current) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>{draft ? DECISION_TITLE[draft.decision] : ''}</DialogTitle>
            <DialogDescription>
              {approving
                ? 'Setujui hanya setelah siswa diverifikasi langsung. Persetujuan tidak membuat kata sandi; siswa membuat kata sandinya sendiri saat aktivasi.'
                : 'Keputusan ini menutup pengajuan dan dicatat bersama alasan Anda.'}
            </DialogDescription>
          </DialogHeader>
          {draft && <p className="m-0 font-semibold">{draft.claim.submitted.fullName}</p>}
          {approving && draft && (
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" disabled={pending || intent.current !== null}>
              <legend className="mb-1 text-sm font-medium">Identitas siswa</legend>
              {draft.claim.roster?.bound ? (
                <p className="m-0 text-sm">Data siswa ini sudah terhubung dengan identitas ELLIGBLE. Persetujuan memakai identitas tersebut.</p>
              ) : (
                <>
                  <label className="flex min-h-11 items-start gap-3 text-sm">
                    <input type="radio" name={ids.adjudication} className="mt-0.5 size-4 shrink-0 accent-primary" checked={adjudication === 'EXISTING_ACCOUNT_CONTINUITY'}
                      onChange={() => edit(setAdjudication)('EXISTING_ACCOUNT_CONTINUITY')} />
                    <span>Siswa sudah punya akun ELLIGBLE dan menunjukkan ELLIGBLE ID-nya</span>
                  </label>
                  {adjudication === 'EXISTING_ACCOUNT_CONTINUITY' && (
                    <div className="flex flex-col gap-1.5 pl-8">
                      <Label htmlFor={ids.elligble}>ELLIGBLE ID siswa</Label>
                      <Input id={ids.elligble} value={elligbleId} autoComplete="off" spellCheck={false} onChange={e => edit(setElligbleId)(e.target.value)} />
                    </div>
                  )}
                  <label className="flex min-h-11 items-start gap-3 text-sm">
                    <input type="radio" name={ids.adjudication} className="mt-0.5 size-4 shrink-0 accent-primary" checked={adjudication === 'NEW_IDENTITY_REVIEWED'}
                      onChange={() => edit(setAdjudication)('NEW_IDENTITY_REVIEWED')} />
                    <span>Siswa belum punya akun ELLIGBLE</span>
                  </label>
                  {adjudication === 'NEW_IDENTITY_REVIEWED' && (
                    <label htmlFor={ids.attest} className="flex min-h-11 items-start gap-3 pl-8 text-sm">
                      <input id={ids.attest} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={attested} onChange={e => edit(setAttested)(e.target.checked)} />
                      <span>Saya sudah menanyakan langsung dan siswa tidak memiliki kartu atau ELLIGBLE ID lama.</span>
                    </label>
                  )}
                </>
              )}
              <label htmlFor={ids.inPerson} className="flex min-h-11 items-start gap-3 text-sm">
                <input id={ids.inPerson} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={inPerson} onChange={e => edit(setInPerson)(e.target.checked)} />
                <span>Saya sudah memverifikasi siswa ini secara langsung.</span>
              </label>
            </fieldset>
          )}
          <ActionReasonField value={reason} onChange={edit(setReason)} disabled={pending || intent.current !== null} />
          {error && <p role="alert" className="m-0 text-danger-ink">{error}</p>}
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={close}>Batal</Button>
            <Button ref={retryRef} onClick={() => void send()} disabled={pending || !ready}>
              {pending ? 'Menyimpan...' : error ? 'Kirim Ulang Tindakan' : draft ? DECISION_ACTION[draft.decision] : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={handoff !== null} onOpenChange={next => { if (!next) finishHandoff(); }}>
        <DialogContent className={permissionDialogClass} onCloseAutoFocus={e => { e.preventDefault(); headingRef.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{handoff?.activationCode ? 'Serahkan Kode Aktivasi' : 'Siswa Sudah Memiliki Akun'}</DialogTitle>
            <DialogDescription>
              {handoff?.activationCode
                ? 'Serahkan langsung kepada siswa. Kode hanya ditampilkan sekali dan tidak dapat dibuka lagi dari layar ini.'
                : 'Siswa masuk dengan kata sandinya sendiri. Jika lupa, gunakan proses pemulihan akun sekolah.'}
            </DialogDescription>
          </DialogHeader>
          {handoff && (
            <dl className="m-0 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-2">
              <dt className="text-sm">ELLIGBLE ID</dt><dd className="m-0 font-mono font-semibold [overflow-wrap:normal]">{handoff.elligbleId}</dd>
              {handoff.activationCode && <><dt className="text-sm">Kode aktivasi</dt><dd className="m-0 break-all font-mono text-lg font-semibold">{handoff.activationCode}</dd></>}
              {handoff.claimExpiresAt && <><dt className="text-sm">Aktivasi paling lambat</dt><dd className="m-0">{formatDateTime(handoff.claimExpiresAt)}</dd></>}
            </dl>
          )}
          <DialogFooter><Button onClick={finishHandoff}>Selesai, Tutup Kode</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
