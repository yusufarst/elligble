import React from 'react';

// Students of a class to choose from, by ELLIGBLE ID, one tickable row each: shared by the
// question import (who takes part), "Tambah Peserta" (who joins later) and the School Operator's
// room placement (who goes into a room), so all look and behave alike (§10.1). A student expected
// in another exam at the same time is marked "Bentrok jadwal"; where such a student cannot be
// chosen at all the row is disabled. A row may carry a short muted note in the same place (the
// participant's current room, ASSESS-INSTITUTION-002).

export interface ParticipantChoice {
  /** The choice key; falls back to `enrollmentId`. */
  id?: string;
  enrollmentId?: string;
  elligbleId: string;
  conflict: boolean;
  /** Muted text where "Bentrok jadwal" sits, for a row without a conflict. */
  note?: string;
}

const choiceKey = (p: ParticipantChoice): string => p.id ?? p.enrollmentId ?? p.elligbleId;

export const ParticipantChoiceList: React.FC<{
  participants: ParticipantChoice[];
  isChosen(enrollmentId: string): boolean;
  onToggle(enrollmentId: string): void;
  /** Conflicting students cannot be chosen. */
  conflictsDisabled?: boolean;
  /** Labels the list for assistive technology. */
  label?: string;
}> = ({ participants, isChosen, onToggle, conflictsDisabled = false, label }) => (
  <ul className="m-0 grid list-none gap-1 p-0 sm:grid-cols-2" aria-label={label}>
    {participants.map(p => {
      const disabled = conflictsDisabled && p.conflict;
      const key = choiceKey(p);
      return (
        <li key={key}>
          <label className={`flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm ${disabled ? 'text-muted-foreground' : ''}`}>
            <input
              type="checkbox"
              checked={!disabled && isChosen(key)}
              disabled={disabled}
              onChange={() => { if (!disabled) onToggle(key); }}
              className="size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0 font-mono text-[13px] [overflow-wrap:anywhere]">{p.elligbleId}</span>
            {p.conflict && <span className="ml-auto shrink-0 text-xs font-medium text-warning-ink">Bentrok jadwal</span>}
            {!p.conflict && p.note && <span className="ml-auto min-w-0 text-right text-xs text-muted-foreground break-words">{p.note}</span>}
          </label>
        </li>
      );
    })}
  </ul>
);
