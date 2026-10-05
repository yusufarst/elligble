import React from 'react';

// Students of a class to choose from, by ELLIGBLE ID, one tickable row each: shared by the
// question import (who takes part) and "Tambah Peserta" (who joins later), so both look and
// behave alike (§10.1). A student expected in another exam at the same time is marked
// "Bentrok jadwal"; where such a student cannot be chosen at all the row is disabled.

export interface ParticipantChoice {
  enrollmentId: string;
  elligbleId: string;
  conflict: boolean;
}

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
      return (
        <li key={p.enrollmentId}>
          <label className={`flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm ${disabled ? 'text-muted-foreground' : ''}`}>
            <input
              type="checkbox"
              checked={!disabled && isChosen(p.enrollmentId)}
              disabled={disabled}
              onChange={() => { if (!disabled) onToggle(p.enrollmentId); }}
              className="size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0 font-mono text-[13px] [overflow-wrap:anywhere]">{p.elligbleId}</span>
            {p.conflict && <span className="ml-auto shrink-0 text-xs font-medium text-warning-ink">Bentrok jadwal</span>}
          </label>
        </li>
      );
    })}
  </ul>
);
