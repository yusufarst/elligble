import React, { useEffect, useId, useState } from 'react';
import { ApiError, postResultPublication } from '../api/assessment-client.ts';
import type { ResultPublicationReceipt } from '../types/assessment.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IconInfo } from '@/components/icons';
import { ActionReasonField, permissionDialogClass, validActionReason } from './ActionReasonField.tsx';
import { useActionKey, useRetryFocus } from '../hooks/useDialogAction.ts';

// "Publikasikan Hasil" and "Tarik Publikasi" (RESULT-003 §4.5; Owner OD-09, O05-6, A11 P02): the Teacher who holds the
// exam's teaching assignment publishes the finalized result to the exam's Students, or withdraws the publication, with a
// reason and this confirmation. One action key is kept for every retry of one opening, so a lost answer never acts
// twice; the revision the screen shows guards against a stale screen. Nothing changes on the screen before the server
// answers (U04). The shared reason-dialog parts only (plan §10.1).

export type PublicationDialogAction = 'publish' | 'withdraw';

const COPY: Record<PublicationDialogAction, { title: string; text: string; confirm: string }> = {
  publish: {
    title: 'Publikasikan Hasil Ujian?',
    text: 'Setiap siswa peserta ujian ini dapat melihat nilainya sendiri. Siswa tidak melihat nilai siswa lain, peringkat, atau kunci jawaban. Publikasi dapat ditarik kembali.',
    confirm: 'Publikasikan Hasil',
  },
  withdraw: {
    title: 'Tarik Publikasi Hasil?',
    text: 'Nilai disembunyikan kembali dari siswa, dan siswa melihat "Hasil belum tersedia". Hasil yang difinalisasi tidak berubah dan dapat dipublikasikan lagi.',
    confirm: 'Tarik Publikasi',
  },
};

export const PUBLICATION_CHANGED_TEXT = 'Status publikasi telah berubah. Data diperbarui; periksa lalu ulangi bila perlu.';

/** The words of a refusal or failure (§4.5). */
export function publicationRefusalCopy(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'publication_changed') return PUBLICATION_CHANGED_TEXT;
    if (err.code === 'invalid_state') return 'Hasil harus difinalisasi sebelum dipublikasikan.';
    if (err.status === 403) return 'Hanya guru mata pelajaran ujian ini yang dapat mempublikasikan hasil.';
    if (err.code === 'action_key_reused' || err.code === 'state_changed') return 'Permintaan bertabrakan dengan perubahan lain. Tutup lalu coba lagi.';
  }
  return 'Gagal terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.';
}

export const ResultPublicationDialog: React.FC<{
  /** The action of this opening; null while closed. */
  action: PublicationDialogAction | null;
  examInstanceId: string;
  /** The revision the screen shows. */
  expectedRevision: number;
  onClose(): void;
  /** The server recorded the action (or replayed it). */
  onDone(receipt: ResultPublicationReceipt): void;
  /** publication_changed: the screen reads the results again. */
  onStale(): void;
  /** Return focus to the action on the screen; true when it could. */
  restoreFocus(): boolean;
}> = ({ action, examInstanceId, expectedRevision, onClose, onDone, onStale, restoreFocus }) => {
  const open = action !== null;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const key = useActionKey(open);
  const retry = useRetryFocus(open, errors, saving);
  const descriptionId = useId();

  // Every opening starts empty; its action key is kept for every retry of it.
  useEffect(() => {
    if (!open) return;
    setReason('');
    setErrors([]);
  }, [open, action]);

  if (!action) return <Dialog open={false} />;
  const copy = COPY[action];

  const submit = async () => {
    if (saving || !validActionReason(reason)) return;
    setSaving(true);
    setErrors([]);
    try {
      const receipt = await postResultPublication({ examInstanceId, action, expectedRevision, reason, confirmed: true, actionKey: key.current });
      onDone(receipt);
    } catch (err) {
      setErrors([publicationRefusalCopy(err)]);
      if (err instanceof ApiError && err.code === 'publication_changed') onStale();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] overflow-y-auto ${permissionDialogClass}`} aria-describedby={descriptionId}
        onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription id={descriptionId}>{copy.text}</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <ActionReasonField value={reason} onChange={setReason} disabled={saving} />
          {errors.length > 0 && (
            <Alert variant="destructive" className="min-w-0">
              <IconInfo aria-hidden="true" />
              <AlertDescription className="min-w-0 break-words">
                {errors.map(message => <p key={message} className="m-0">{message}</p>)}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
          <Button ref={retry} onClick={submit} disabled={saving || !validActionReason(reason)}>
            {saving ? 'Memproses...' : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
