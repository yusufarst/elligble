import React, { useEffect, useRef, useState } from 'react';
import { ApiError, postParticipantTime } from '../api/assessment-client.ts';
import type { MonitoredParticipant, TimeAdditionResponse } from '../types/assessment.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatTime } from '../lib/format.ts';
import { newActionKey } from '../lib/action-key.ts';

// Add time for one participant (ASSESS-PROCTOR-004; D04.6-41, D04.2-78/79, D04.6-64): the
// teacher who manages the exam enters the minutes and a reason and confirms; the addition
// applies to this participant only, is recorded with the teacher, the reason and the time,
// and cannot be undone. The dialog keeps one action key while it is open, so trying again
// after a lost connection never adds the time twice.

export const ADD_TIME_MAX_MINUTES = 120;
export const TIME_REASON_MAX_LENGTH = 200;

/** Exam states in which time can be added (as on the server). */
export const TIME_STATES = new Set(['ACTIVE', 'PAUSED']);

function minutesOf(seconds: number): number {
  return Math.round(seconds / 60);
}

/** "Waktu ditambah 15 menit" for a participant with added time, else null. */
export function timeAddedLabel(p: MonitoredParticipant): string | null {
  const added = p.addedSeconds ?? 0;
  return added > 0 ? `Waktu ditambah ${minutesOf(added)} menit` : null;
}

function remainingText(seconds: number): string {
  return seconds < 60 ? 'kurang dari 1 menit' : `${Math.floor(seconds / 60)} menit`;
}

function successNotice(id: string, result: TimeAdditionResponse, paused: boolean): string {
  const minutes = minutesOf(result.addedSeconds);
  if (result.replayed) return `Tambahan ${minutes} menit untuk ${id} sudah tercatat sebelumnya; tidak ada tambahan baru.`;
  return `Waktu ${id} ditambah ${minutes} menit. Sisa waktunya sekarang ${remainingText(result.remainingSeconds)}${paused ? ' dan mulai berjalan lagi saat ujian dilanjutkan' : ''}.`;
}

/** A refusal that ends this attempt at adding time, or null when trying again may work. */
function finalRefusal(err: unknown, id: string): string | null {
  if (!(err instanceof ApiError)) return null;
  switch (err.code) {
    case 'time_up': return `Waktu ${id} sudah habis dan jawabannya dikumpulkan otomatis, sehingga waktunya tidak dapat ditambah.`;
    case 'no_active_attempt': return `${id} sudah tidak memiliki pengerjaan yang berjalan.`;
    case 'not_started': return `${id} belum mulai mengerjakan. Waktu dapat ditambah setelah peserta mulai.`;
    case 'invalid_state': return 'Status ujian telah berubah. Waktu hanya dapat ditambah saat ujian berlangsung atau dijeda.';
    case 'forbidden': return 'Hanya guru yang mengelola ujian ini yang dapat menambah waktu.';
    case 'action_key_reused': return 'Permintaan tadi mungkin sudah tercatat. Periksa tambahan waktu peserta ini sebelum mencoba lagi.';
  }
  return null;
}

export const AddTimeDialog: React.FC<{
  participant: MonitoredParticipant | null;
  examInstanceId: string;
  examState: string;
  onClose(): void;
  /** The attempt ended with an outcome to show on the list; the list is read again. */
  onDone(notice: { failed: boolean; text: string }): void;
}> = ({ participant, examInstanceId, examState, onClose, onDone }) => {
  const [minutes, setMinutes] = useState('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionKey = useRef<string | null>(null);
  const open = participant !== null;

  // Every opening starts empty, with a new action key.
  useEffect(() => {
    if (!open) return;
    setMinutes('');
    setReason('');
    setError(null);
    actionKey.current = newActionKey();
  }, [open, participant?.participantId]);

  if (!participant) return null;

  const id = participant.elligbleId ?? 'peserta';
  const amount = /^\d{1,3}$/.test(minutes.trim()) ? Number(minutes.trim()) : NaN;
  const amountValid = Number.isInteger(amount) && amount >= 1 && amount <= ADD_TIME_MAX_MINUTES;
  const text = reason.replace(/\s+/g, ' ').trim();
  const ready = amountValid && text.length > 0 && text.length <= TIME_REASON_MAX_LENGTH;
  const paused = examState === 'PAUSED';
  const earlier = participant.timeAdditions ?? [];

  const confirm = async () => {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await postParticipantTime({
        examInstanceId, participantId: participant.participantId, minutes: amount, reason: text, actionKey: actionKey.current ?? newActionKey(),
      });
      onDone({ failed: false, text: successNotice(id, result, paused) });
    } catch (err) {
      const refusal = finalRefusal(err, id);
      if (refusal) {
        onDone({ failed: true, text: refusal });
      } else if (err instanceof ApiError && err.status === 400) {
        setError(`Isi tambahan waktu 1 sampai ${ADD_TIME_MAX_MINUTES} menit dan alasan 1 sampai ${TIME_REASON_MAX_LENGTH} karakter.`);
      } else {
        // The same key goes with the next try: if this one arrived, nothing is added twice.
        setError('Gagal menambah waktu. Periksa koneksi internet Anda, lalu coba lagi. Jika permintaan tadi sudah sampai, mencoba lagi tidak menambah waktu dua kali.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !sending) onClose(); }}>
      <DialogContent aria-describedby="add-time-description" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Waktu Peserta</DialogTitle>
          <DialogDescription id="add-time-description">
            Tambahan waktu hanya berlaku untuk peserta ini dan terlihat di layar ujiannya. Tambahan tercatat bersama nama Anda, alasan, dan waktunya, dan tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          <p className="m-0 font-mono text-sm font-medium [overflow-wrap:anywhere]">{participant.elligbleId ?? 'Tanpa ELLIGBLE ID'}</p>
          {participant.remainingSeconds !== null && (
            <p className="m-0 text-sm text-muted-foreground">
              Sisa waktu saat ini sekitar {remainingText(participant.remainingSeconds)}{paused ? ', berhenti selama ujian dijeda' : ''}.
            </p>
          )}
        </div>

        {earlier.length > 0 && (
          <section aria-labelledby="add-time-earlier" className="flex flex-col gap-1">
            <h3 id="add-time-earlier" className="m-0 text-sm font-medium">Tambahan sebelumnya</h3>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {earlier.map((a, i) => (
                <li key={`${a.addedAt}-${i}`} className="[overflow-wrap:anywhere]">
                  <span className="tabular-nums">{formatTime(a.addedAt)}</span> · {minutesOf(a.seconds)} menit · {a.by.you ? 'Anda' : (a.by.elligbleId ?? 'Guru lain')}: {a.reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="add-time-minutes" className="text-sm font-medium">Tambahan waktu (menit)</label>
          <Input
            id="add-time-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={ADD_TIME_MAX_MINUTES}
            step={1}
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            aria-describedby="add-time-minutes-hint"
            className="w-32"
          />
          <span id="add-time-minutes-hint" className="text-xs text-muted-foreground">1 sampai {ADD_TIME_MAX_MINUTES} menit.</span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="add-time-reason" className="text-sm font-medium">Alasan</label>
          <Textarea
            id="add-time-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            maxLength={TIME_REASON_MAX_LENGTH}
            rows={2}
            placeholder="Contoh: listrik padam di ruang ujian"
            aria-describedby="add-time-reason-hint"
          />
          <span id="add-time-reason-hint" className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>Wajib diisi. Tulis singkat, tanpa data pribadi yang tidak perlu.</span>
            <span className="shrink-0 tabular-nums">{reason.length}/{TIME_REASON_MAX_LENGTH}</span>
          </span>
        </div>

        {error && <p role="alert" className="m-0 text-sm text-danger-ink">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={sending}>Batal</Button>
          <Button onClick={confirm} disabled={!ready || sending}>
            {sending ? 'Memproses...' : amountValid ? `Tambah ${amount} Menit` : 'Tambah Waktu'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
