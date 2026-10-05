import React, { useEffect, useRef, useState } from 'react';
import { ApiError, postTeacherExamCancel } from '../api/assessment-client.ts';
import type { TeacherExamReadinessProjection } from '../types/assessment.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatWindow } from '../lib/format.ts';
import { newActionKey } from '../lib/action-key.ts';

// The teacher cancels an exam before it opens (ASSESS-TEACHER-003; D04.2-47, Owner decision
// 2026-09-30): a destructive action with an explicit confirmation and a required reason
// (D04.6-64). The exam leaves the students' lists and frees its time; nothing is deleted and
// the list keeps it as "Dibatalkan". One action key per dialog, so trying again after a lost
// connection never cancels twice. The dismiss button reads "Kembali": "Batal" beside
// "Batalkan Ujian" would be ambiguous.

export const CANCELLATION_REASON_MAX_LENGTH = 200;

function failureMessage(err: unknown): { final: boolean; text: string } {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'invalid_state': return { final: true, text: 'Ujian sudah dibuka, sehingga tidak dapat dibatalkan. Gunakan "Akhiri Ujian" untuk menghentikannya.' };
      case 'forbidden': return { final: true, text: 'Hanya guru yang mengelola ujian ini yang dapat membatalkannya.' };
      case 'action_key_reused': return { final: true, text: 'Permintaan tadi mungkin sudah tercatat. Periksa daftar ujian sebelum mencoba lagi.' };
      case 'invalid_request': return { final: false, text: `Tulis alasan pembatalan, 1 sampai ${CANCELLATION_REASON_MAX_LENGTH} karakter.` };
    }
  }
  // The same key goes with the next try: if this one arrived, nothing is cancelled twice.
  return { final: false, text: 'Gagal membatalkan ujian. Periksa koneksi internet Anda, lalu coba lagi.' };
}

export const CancelExamDialog: React.FC<{
  exam: TeacherExamReadinessProjection | null;
  onClose(): void;
  /** The attempt ended with an outcome to show above the list; the list is read again. */
  onDone(notice: { failed: boolean; text: string }): void;
}> = ({ exam, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionKey = useRef<string | null>(null);
  const open = exam !== null;

  // Every opening starts empty, with a new action key.
  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
    actionKey.current = newActionKey();
  }, [open, exam?.examInstanceId]);

  if (!exam) return null;

  const text = reason.replace(/\s+/g, ' ').trim();
  const ready = text.length > 0 && text.length <= CANCELLATION_REASON_MAX_LENGTH;
  const subject = exam.subjectLabel ?? 'Ujian';

  const confirm = async () => {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await postTeacherExamCancel({ examInstanceId: exam.examInstanceId, reason: text, actionKey: actionKey.current ?? newActionKey() });
      onDone({
        failed: false,
        text: result.changed
          ? `Ujian ${subject} dibatalkan dan tidak lagi tampil untuk siswa.`
          : `Ujian ${subject} sudah dibatalkan sebelumnya.`,
      });
    } catch (err) {
      const failure = failureMessage(err);
      if (failure.final) onDone({ failed: true, text: failure.text });
      else setError(failure.text);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !sending) onClose(); }}>
      <DialogContent aria-describedby="cancel-exam-description" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batalkan Ujian Ini?</DialogTitle>
          <DialogDescription id="cancel-exam-description">
            Ujian tidak dapat dibuka lagi dan tidak lagi tampil di daftar ujian siswa, sehingga waktunya dapat dipakai untuk ujian lain. Soal, peserta, dan riwayatnya tetap tersimpan sebagai catatan. Pembatalan tidak dapat diurungkan.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-0.5">
          <p className="m-0 font-medium">{[subject, exam.groupLabel, exam.assessmentTypeLabel].filter(Boolean).join(' · ')}</p>
          {exam.windowStartsAt && exam.windowEndsAt && (
            <p className="m-0 text-sm text-muted-foreground">{formatWindow(exam.windowStartsAt, exam.windowEndsAt)}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cancel-exam-reason" className="text-sm font-medium">Alasan pembatalan</label>
          <Textarea
            id="cancel-exam-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            maxLength={CANCELLATION_REASON_MAX_LENGTH}
            rows={2}
            placeholder="Contoh: bentrok dengan kegiatan sekolah"
            aria-describedby="cancel-exam-reason-hint"
          />
          <span id="cancel-exam-reason-hint" className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>Wajib diisi. Alasan tercatat bersama nama Anda dan waktunya.</span>
            <span className="shrink-0 tabular-nums">{reason.length}/{CANCELLATION_REASON_MAX_LENGTH}</span>
          </span>
        </div>

        {error && <p role="alert" className="m-0 text-sm text-danger-ink">{error}</p>}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Kembali</Button>
          <Button variant="destructive" onClick={confirm} disabled={!ready || sending}>{sending ? 'Membatalkan...' : 'Batalkan Ujian'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
