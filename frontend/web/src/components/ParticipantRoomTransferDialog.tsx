import React, { useEffect, useId, useState } from 'react';
import { ApiError } from '../api/assessment-client.ts';
import type { MonitoredParticipant, ParticipantRoomTransferInput, ParticipantRoomTransferResult } from '../types/assessment.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { IconInfo } from '@/components/icons';
import { ActionReasonField, permissionDialogClass, validActionReason } from './ActionReasonField.tsx';
import { useActionKey, useRetryFocus } from '../hooks/useDialogAction.ts';

// "Pindahkan Ruang" (ASSESS-ROOM-001 §4.5; §5A, O05-4, O05-5, Owner OR-1..OR-3): the School Operator moves one
// participant of a running institution exam to another room of the same exam that has a Proctor. The participant keeps
// the same exam, device, answers and session; the time keeps running while ACTIVE and stays frozen while PAUSED (F6).
// The old room's Proctor no longer sees the participant; nothing is sent to the Student (OR-3). A reason and the
// confirmation go with the move, which carries the room version read with the list, and one action key is kept for
// every retry of one opening, so a lost answer never moves twice. Shared primitives only (plan §10.1).

/** Where the Operator's screen sends a transfer, and the frozen copy of the refusals it does not name itself. */
export interface RoomTransferSource {
  move(input: ParticipantRoomTransferInput): Promise<ParticipantRoomTransferResult>;
  /** The ASSESS-INSTITUTION-003 and ASSESS-INSTITUTION-001 copy of any other refusal or failure. */
  failureMessages(err: unknown): string[];
}

/** The rooms a participant may move to: the other rooms of the exam with an active Proctor, by label (OR-2). */
export function transferTargets(rooms: ReadonlyArray<{ roomId: string; label: string; supervised?: boolean }>, currentRoomId: string | null | undefined) {
  return rooms.filter(r => r.supervised === true && r.roomId !== currentRoomId)
    .sort((a, b) => a.label.localeCompare(b.label, 'id', { numeric: true, sensitivity: 'base' }) || a.roomId.localeCompare(b.roomId));
}

const TRANSFER_STATES = new Set(['ACTIVE', 'PAUSED']);

/** §4.5: the row action shows for a participant not started or working, with a room, while another room is covered. */
export function canTransfer(
  p: MonitoredParticipant, exam: { lifecycleState: string; roomBased: boolean },
  rooms: ReadonlyArray<{ roomId: string; label: string; supervised?: boolean }>
): boolean {
  if (!TRANSFER_STATES.has(exam.lifecycleState) || !exam.roomBased) return false;
  if (p.status !== 'NOT_STARTED' && p.status !== 'ACTIVE') return false;
  if (!p.roomId || p.assignmentVersion === null || p.assignmentVersion === undefined) return false;
  return transferTargets(rooms, p.roomId).length > 0;
}

/** The words of a transfer refusal (§4.5), or null for the codes whose copy is shared. */
export function transferRefusalCopy(code: string): string | null {
  switch (code) {
    case 'stale_assignment': return 'Ruang peserta ini baru saja diubah. Pilih Perbarui untuk melihat ruang terbaru.';
    case 'already_in_room': return 'Peserta sudah berada di ruang ini.';
    case 'target_room_unsupervised': return 'Ruang tujuan belum punya pengawas, jadi peserta tidak dapat dipindahkan ke sana.';
    case 'participant_without_room': return 'Peserta ini belum punya ruang, jadi tidak dapat dipindahkan.';
    case 'attempt_already_submitted': return 'Peserta sudah mengumpulkan jawaban, jadi tidak dapat dipindahkan.';
    case 'time_up': return 'Waktu peserta sudah habis, jadi tidak dapat dipindahkan.';
  }
  return null;
}

/** The state text (F6): the time keeps running while ACTIVE and stays frozen while PAUSED. */
export function transferStateCopy(examState: string): string {
  const same = 'Peserta tetap mengerjakan ujian yang sama di perangkat yang sama. Jawaban dan sesi ujiannya tidak berubah.';
  return examState === 'PAUSED'
    ? `${same} Ujian sedang dijeda, jadi sisa waktunya tetap berhenti sampai ujian dilanjutkan.`
    : `${same} Sisa waktunya tetap berjalan selama pindah.`;
}

/** The success notice (§4.5). */
export function transferNotice(id: string, result: ParticipantRoomTransferResult): string {
  return `${id} dipindahkan dari ${result.fromRoomLabel} ke ${result.roomLabel}.`;
}

export const ParticipantRoomTransferDialog: React.FC<{
  participant: MonitoredParticipant | null;
  examInstanceId: string;
  examState: string;
  rooms: ReadonlyArray<{ roomId: string; label: string; supervised?: boolean }>;
  source: RoomTransferSource;
  onClose(): void;
  /** The move was applied (or replayed); the list is read again. */
  onDone(result: ParticipantRoomTransferResult): void;
  /** Return focus to the row action, or its surviving list control; true when it could. */
  restoreFocus(): boolean;
}> = ({ participant, examInstanceId, examState, rooms, source, onClose, onDone, restoreFocus }) => {
  const open = participant !== null;
  const [targetRoomId, setTargetRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const key = useActionKey(open);
  const retry = useRetryFocus(open, errors, saving);
  const selectId = useId();
  const descriptionId = useId();

  // Every opening starts empty; its action key is kept for every retry of it.
  useEffect(() => {
    if (!open) return;
    setTargetRoomId('');
    setReason('');
    setErrors([]);
  }, [open, participant?.participantId]);

  if (!participant) return <Dialog open={false} />;

  const id = participant.elligbleId ?? 'Tanpa ELLIGBLE ID';
  const currentLabel = participant.roomLabel ?? '-';
  const targets = transferTargets(rooms, participant.roomId);

  const submit = async () => {
    if (saving || !targetRoomId || !validActionReason(reason)) return;
    setSaving(true);
    setErrors([]);
    try {
      const result = await source.move({
        examInstanceId, participantId: participant.participantId, targetRoomId,
        expectedAssignmentVersion: participant.assignmentVersion ?? 1, reason, confirmed: true, actionKey: key.current,
      });
      onDone(result);
    } catch (err) {
      const own = err instanceof ApiError ? transferRefusalCopy(err.code) : null;
      setErrors(own ? [own] : source.failureMessages(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] overflow-y-auto ${permissionDialogClass}`} aria-describedby={descriptionId}
        onCloseAutoFocus={event => { if (restoreFocus()) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Pindahkan {id} ke Ruang Lain?</DialogTitle>
          <DialogDescription id={descriptionId}>Ruang saat ini: {currentLabel}.</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={selectId} className="text-sm font-medium">Ruang tujuan</label>
            <NativeSelect id={selectId} value={targetRoomId} disabled={saving} required onChange={e => setTargetRoomId(e.target.value)}>
              <option value="">Pilih ruang</option>
              {targets.map(r => <option key={r.roomId} value={r.roomId}>{r.label}</option>)}
            </NativeSelect>
          </div>
          <Alert variant="info" role="note" className="min-w-0">
            <IconInfo aria-hidden="true" />
            <AlertDescription className="min-w-0 break-words">
              <p className="m-0">{transferStateCopy(examState)}</p>
              <p className="m-0 mt-2">Setelah dipindahkan, pengawas {currentLabel} tidak lagi melihat peserta ini.</p>
              <p className="m-0 mt-2">Siswa tidak menerima pemberitahuan otomatis. Sampaikan langsung atau kirim pesan.</p>
            </AlertDescription>
          </Alert>
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
          <Button ref={retry} onClick={submit} disabled={saving || !targetRoomId || !validActionReason(reason)}>
            {saving ? 'Memproses...' : 'Pindahkan Peserta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
