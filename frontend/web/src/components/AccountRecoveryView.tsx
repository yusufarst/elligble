import { useEffect, useId, useRef, useState } from 'react';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionReasonField, permissionDialogClass, validActionReason } from './ActionReasonField.tsx';
import { newActionKey } from '../lib/action-key.ts';
import { formatDateTime } from '../lib/format.ts';
import { authorizeRecovery, ClaimApiError, type RecoveryIssue, type RecoveryPreview } from '../api/identity-client.ts';

// AUTH-003 scoped verifier recovery (record §7, R1–R4). The verifier checks the Student in
// person against the roster record bound to the Account, then issues a fifteen-minute
// single-use code shown once. Comparison data and the code live only in component memory and
// are cleared on close, a new lookup, navigation and unmount; a late response is ignored.

function failureCopy(error: unknown): string {
  const code = error instanceof ClaimApiError ? error.code : '';
  if (code === 'not_found_in_scope') return 'Akun siswa tidak ditemukan dalam cakupan Anda, belum pernah diaktifkan, atau bukan akun siswa. Akun yang belum aktif memakai pendaftaran atau kode aktivasi.';
  if (code === 'forbidden' || code === 'unauthorized') return 'Akses pemulihan tidak tersedia. Periksa akun dan sekolah yang dipilih.';
  if (code === 'stale_conflict') return 'Data siswa berubah. Periksa ulang sebelum menerbitkan kode.';
  if (code === 'action_key_reused') return 'Tindakan ini sudah tercatat dengan isi berbeda. Periksa ulang siswa.';
  if (code === 'invalid_request') return 'Isian belum lengkap. Periksa kembali.';
  return 'Konfirmasi belum diterima server. Anda dapat mengirim ulang tindakan yang sama.';
}

interface Handoff { elligbleId: string; recoveryCode: string; expiresAt: string }

export function AccountRecoveryView() {
  const [elligbleId, setElligbleId] = useState('');
  const [preview, setPreview] = useState<RecoveryPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [inPerson, setInPerson] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const intent = useRef<string | null>(null);
  const generation = useRef(0);
  const sending = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const ids = { id: useId(), inPerson: useId(), help: useId() };

  useEffect(() => () => { generation.current++; intent.current = null; }, []);
  useEffect(() => { if (open && error && !pending) retryRef.current?.focus(); }, [open, error, pending]);

  function resetDecision() { intent.current = null; setInPerson(false); setReason(''); setError(null); }
  function clearAll() { generation.current++; resetDecision(); setPreview(null); setOpen(false); setLookupError(null); }

  async function check() {
    if (sending.current || !elligbleId.trim()) return;
    clearAll(); setNotice(null);
    const current = generation.current;
    setChecking(true);
    try {
      const result = await authorizeRecovery<RecoveryPreview>({ elligbleId: elligbleId.trim(), confirmed: false });
      if (current === generation.current) setPreview(result);
    } catch (e) {
      if (current === generation.current) setLookupError(failureCopy(e));
    } finally {
      if (current === generation.current) setChecking(false);
    }
  }

  function close() {
    if (sending.current) return;
    resetDecision(); setOpen(false);
  }

  async function issue() {
    if (!preview || sending.current || !inPerson || !validActionReason(reason)) return;
    intent.current ??= newActionKey();
    sending.current = true;
    const current = generation.current;
    setPending(true); setError(null);
    try {
      const result = await authorizeRecovery<RecoveryIssue>({
        elligbleId: preview.elligbleId, confirmed: true, expectedRosterRevision: preview.roster.revision,
        reason, requestKey: intent.current, inPersonVerified: true,
      });
      if (current !== generation.current) return;
      clearAll(); setElligbleId('');
      if (!result.replayed) setHandoff({ elligbleId: result.elligbleId, recoveryCode: result.recoveryCode, expiresAt: result.expiresAt });
      else setNotice('Kode pemulihan sudah diterbitkan sebelumnya dan tidak ditampilkan ulang. Terbitkan kode baru bila perlu.');
    } catch (e) {
      if (current === generation.current) setError(failureCopy(e));
    } finally {
      sending.current = false;
      if (current === generation.current) setPending(false);
    }
  }

  function finishHandoff() {
    setHandoff(null);
    setNotice('Kode pemulihan sudah ditutup dari layar.');
  }

  return (
    <Page id="account-recovery" className="min-w-0 [overflow-wrap:anywhere]">
      <PageHeader title="Pemulihan Akun">
        <p className="m-0 text-muted-foreground">
          Untuk siswa yang lupa kata sandi. Verifikasi siswa secara langsung dengan kartu pelajar sebelum menerbitkan kode pemulihan.
        </p>
      </PageHeader>
      {notice && <p role="status" className="m-0 rounded-md border border-border p-4">{notice}</p>}
      <Card>
        <CardHeader><CardTitle>Cari Akun Siswa</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.id}>ELLIGBLE ID siswa</Label>
            <Input ref={inputRef} id={ids.id} value={elligbleId} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={checking || pending}
              aria-describedby={ids.help} onChange={e => { clearAll(); setElligbleId(e.target.value); }} />
            <p id={ids.help} className="m-0 text-sm text-muted-foreground">Minta siswa menyebutkan atau menunjukkan ELLIGBLE ID-nya. Jangan pernah meminta kata sandi.</p>
          </div>
          {lookupError && <p role="alert" className="m-0 text-danger-ink">{lookupError}</p>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void check()} disabled={checking || pending || !elligbleId.trim()}>{checking ? 'Memeriksa...' : 'Periksa'}</Button>
          </div>
        </CardContent>
      </Card>
      {preview && (
        <section aria-labelledby="recovery-compare-heading" className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-4">
          <h2 id="recovery-compare-heading" className="m-0 text-lg font-semibold">Cocokkan dengan Kartu Pelajar</h2>
          <dl className="m-0 grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt>ELLIGBLE ID</dt><dd className="m-0 font-mono [overflow-wrap:break-word]">{preview.elligbleId}</dd>
            <dt>Nama</dt><dd className="m-0">{preview.roster.fullName}</dd>
            <dt>Rombel</dt><dd className="m-0">{preview.roster.groupLabel ?? 'Tidak diketahui'}</dd>
            <dt>NISN</dt><dd className="m-0 break-all">{preview.roster.nisn}</dd>
            <dt>Tanggal lahir</dt><dd className="m-0">{preview.roster.birthDate}</dd>
          </dl>
          <Button className="self-start" onClick={() => { resetDecision(); setOpen(true); }} disabled={pending}>Terbitkan Kode Pemulihan</Button>
        </section>
      )}

      <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
        <DialogContent className={`max-h-[90dvh] overflow-y-auto ${permissionDialogClass}`}
          onCloseAutoFocus={e => { e.preventDefault(); inputRef.current?.focus(); }}
          onEscapeKeyDown={e => { if (sending.current) e.preventDefault(); }}
          onInteractOutside={e => { if (sending.current) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Terbitkan Kode Pemulihan?</DialogTitle>
            <DialogDescription>
              Kode berlaku 15 menit dan hanya sekali pakai. Kata sandi dan perangkat siswa tidak berubah sampai siswa sendiri menyelesaikan pemulihan.
            </DialogDescription>
          </DialogHeader>
          {preview && <p className="m-0 font-semibold">{preview.roster.fullName}</p>}
          <label htmlFor={ids.inPerson} className="flex min-h-11 items-start gap-3 text-sm">
            <input id={ids.inPerson} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={inPerson}
              disabled={pending || intent.current !== null} onChange={e => { intent.current = null; setError(null); setInPerson(e.target.checked); }} />
            <span>Saya sudah memverifikasi siswa ini secara langsung dengan kartu pelajar.</span>
          </label>
          <ActionReasonField value={reason} onChange={v => { intent.current = null; setError(null); setReason(v); }} disabled={pending || intent.current !== null} />
          {error && <p role="alert" className="m-0 text-danger-ink">{error}</p>}
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={close}>Batal</Button>
            <Button ref={retryRef} onClick={() => void issue()} disabled={pending || !inPerson || !validActionReason(reason)}>
              {pending ? 'Menerbitkan...' : error ? 'Kirim Ulang Tindakan' : 'Terbitkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={handoff !== null} onOpenChange={next => { if (!next) finishHandoff(); }}>
        <DialogContent className={permissionDialogClass} onCloseAutoFocus={e => { e.preventDefault(); inputRef.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Serahkan Kode Pemulihan</DialogTitle>
            <DialogDescription>Serahkan langsung kepada siswa. Kode hanya ditampilkan sekali dan berlaku 15 menit.</DialogDescription>
          </DialogHeader>
          {handoff && (
            <dl className="m-0 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-2">
              <dt className="text-sm">ELLIGBLE ID</dt><dd className="m-0 font-mono font-semibold [overflow-wrap:break-word]">{handoff.elligbleId}</dd>
              <dt className="text-sm">Kode pemulihan</dt><dd className="m-0 break-all font-mono text-lg font-semibold">{handoff.recoveryCode}</dd>
              <dt className="text-sm">Berlaku sampai</dt><dd className="m-0">{formatDateTime(handoff.expiresAt)}</dd>
            </dl>
          )}
          <DialogFooter><Button onClick={finishHandoff}>Selesai, Tutup Kode</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
