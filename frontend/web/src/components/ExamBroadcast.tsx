import React, { useEffect, useMemo, useState } from 'react';
import { ApiError, postBroadcast } from '../api/assessment-client.ts';
import type { BroadcastRecord, BroadcastSendResponse, BroadcastTarget, MonitoredParticipant } from '../types/assessment.ts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatTime } from '../lib/format.ts';

// Supervisor messages to participants (D04.1-77A..F, D04.6-49..55): the composer asks only
// for the target and the message (D04.6-50), offers the quick messages of D04.6-51, and
// never offers a target outside the supervisor's scope (a room proctor sees only their
// rooms, D04.1-77B). The history shows who sent what to whom and when, and how many
// devices confirmed receiving it: never that it was read (D04.6-53/54).

export const QUICK_MESSAGES = [
  'Ujian tersisa 15 menit.',
  'Silakan lanjutkan ke soal berikutnya.',
  'Jaringan sedang bermasalah. Tetap lanjutkan ujian.',
  'Harap tetap di tempat duduk.',
];

export const BROADCAST_MAX_LENGTH = 200;

const STATUS_LABEL: Record<MonitoredParticipant['status'], string> = {
  NOT_STARTED: 'Belum mulai',
  ACTIVE: 'Mengerjakan',
  TIME_UP: 'Waktu habis',
  SUBMITTED: 'Dikumpulkan',
};

function sendFailureMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'rate_limited': {
        const seconds = Number(err.data?.retryAfterSeconds);
        return Number.isFinite(seconds) && seconds > 0
          ? `Pesan terlalu sering. Tunggu ${seconds} detik sebelum mengirim pesan berikutnya.`
          : 'Pesan terlalu sering. Tunggu sebentar sebelum mengirim pesan berikutnya.';
      }
      case 'no_recipients': return 'Tidak ada peserta yang belum mengumpulkan pada tujuan ini.';
      case 'invalid_state': return 'Status ujian telah berubah, pesan tidak dikirim. Data ditampilkan ulang.';
      case 'forbidden': return 'Anda tidak berwenang mengirim pesan ke tujuan ini.';
      case 'invalid_request': return 'Pesan tidak dapat dikirim. Tulis 1 sampai 200 karakter.';
    }
  }
  return 'Gagal mengirim pesan. Periksa koneksi internet Anda dan coba lagi.';
}

export const BroadcastComposer: React.FC<{
  open: boolean;
  onClose(): void;
  examInstanceId: string;
  /** Whether the supervisor may address the entire exam (not a proctor limited to rooms). */
  wholeExam: boolean;
  rooms: Array<{ roomId: string; label: string }>;
  participants: MonitoredParticipant[];
  onSent(result: BroadcastSendResponse): void;
  /** The exam changed under the composer: the list is read again. */
  onStale(): void;
}> = ({ open, onClose, examInstanceId, wholeExam, rooms, participants, onSent, onStale }) => {
  const reachable = useMemo(() => participants.filter(p => p.status !== 'SUBMITTED'), [participants]);
  const defaultTarget = wholeExam ? 'EXAM' : rooms.length > 0 ? `ROOM:${rooms[0].roomId}` : 'PARTICIPANTS';
  const [target, setTarget] = useState<string>(defaultTarget);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every opening starts empty.
  useEffect(() => {
    if (!open) return;
    setTarget(defaultTarget);
    setSelected(new Set());
    setMessage('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const text = message.trim();
  const ready = text.length > 0 && text.length <= BROADCAST_MAX_LENGTH && (target !== 'PARTICIPANTS' || selected.size > 0);

  const send = async () => {
    if (!ready || sending) return;
    const chosen: BroadcastTarget = target === 'EXAM' ? { scope: 'EXAM' }
      : target === 'PARTICIPANTS' ? { scope: 'PARTICIPANTS', participantIds: [...selected] }
      : { scope: 'ROOM', roomId: target.slice('ROOM:'.length) };
    setSending(true);
    setError(null);
    try {
      onSent(await postBroadcast(examInstanceId, chosen, text));
    } catch (err) {
      setError(sendFailureMessage(err));
      if (err instanceof ApiError && err.code === 'invalid_state') onStale();
    } finally {
      setSending(false);
    }
  };

  const toggle = (participantId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  };

  const radio = (value: string, label: string) => (
    <label key={value} className="flex min-h-9 items-center gap-2 text-sm">
      <input type="radio" name="broadcast-target" value={value} checked={target === value} onChange={() => setTarget(value)} className="size-4 accent-primary" />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !sending) onClose(); }}>
      {open && (
        <DialogContent aria-describedby="broadcast-description" className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kirim Pesan ke Peserta</DialogTitle>
            <DialogDescription id="broadcast-description">
              Pesan tampil di layar ujian peserta tanpa menghentikan pengerjaan atau waktu. Pesan yang terkirim tidak dapat ditarik kembali.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">Tujuan</legend>
            {wholeExam && radio('EXAM', 'Semua peserta')}
            {rooms.map(room => radio(`ROOM:${room.roomId}`, room.label))}
            {radio('PARTICIPANTS', 'Peserta tertentu')}
          </fieldset>

          {target === 'PARTICIPANTS' && (
            <div role="group" aria-label="Pilih peserta" className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border px-3 py-2">
              {reachable.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">Semua peserta sudah mengumpulkan.</p>
              ) : reachable.map(p => (
                <label key={p.participantId} className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.has(p.participantId)} onChange={() => toggle(p.participantId)} className="size-4 accent-primary" />
                  <span className="font-mono text-[13px] [overflow-wrap:anywhere]">{p.elligbleId ?? 'Tanpa ELLIGBLE ID'}</span>
                  <span className="text-xs text-muted-foreground">{STATUS_LABEL[p.status]}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="broadcast-message" className="text-sm font-medium">Pesan</label>
            <Textarea
              id="broadcast-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={BROADCAST_MAX_LENGTH}
              rows={3}
              aria-describedby="broadcast-message-count"
            />
            <span id="broadcast-message-count" className="self-end text-xs text-muted-foreground tabular-nums">{message.length}/{BROADCAST_MAX_LENGTH}</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id="broadcast-quick">Pesan cepat</span>
            <div role="group" aria-labelledby="broadcast-quick" className="flex flex-wrap gap-2">
              {QUICK_MESSAGES.map(quick => (
                <Button key={quick} type="button" variant="secondary" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-left" onClick={() => setMessage(quick)}>
                  {quick}
                </Button>
              ))}
            </div>
          </div>

          {error && <p role="alert" className="m-0 text-sm text-danger-ink">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={sending}>Batal</Button>
            <Button onClick={send} disabled={!ready || sending}>{sending ? 'Mengirim...' : 'Kirim Pesan'}</Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
};

function targetLabel(b: BroadcastRecord): string {
  switch (b.target.scope) {
    case 'EXAM': return 'Semua peserta';
    case 'ROOM': return b.target.roomLabel ?? 'Satu ruang';
    case 'PARTICIPANTS': return 'Peserta tertentu';
  }
}

export const BroadcastHistory: React.FC<{ broadcasts: BroadcastRecord[] }> = ({ broadcasts }) => (
  <section aria-labelledby="broadcast-history-title" className="flex flex-col gap-3">
    <h2 id="broadcast-history-title" className="m-0 text-lg font-semibold">Pesan Terkirim</h2>
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {broadcasts.map(b => (
        <li key={b.broadcastId} className="rounded-md border border-border bg-background px-3 py-2">
          <p className="m-0 text-xs text-muted-foreground">
            {formatTime(b.sentAt)} · {targetLabel(b)} · {b.sender.you ? 'Anda' : (b.sender.elligbleId ?? 'Pengawas lain')}
          </p>
          <p className="m-0 mt-1 text-sm [overflow-wrap:anywhere]">{b.message}</p>
          <p className="m-0 mt-1 text-xs text-muted-foreground tabular-nums">Sampai di perangkat {b.delivered} dari {b.recipients} peserta</p>
        </li>
      ))}
    </ul>
    <p className="m-0 text-xs text-muted-foreground">
      "Sampai di perangkat" berarti perangkat peserta sudah menerima pesan; belum tentu sudah dibaca.
    </p>
  </section>
);
