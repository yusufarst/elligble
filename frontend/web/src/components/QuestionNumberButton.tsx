import React from 'react';
import { cn } from '@/lib/utils';
import type { SaveState } from '../types/assessment.ts';

// One question number button for the exam's question list, the side panel from 1024 px and the
// "Daftar Soal" sheet below it (UI-SYSTEM-002 part 2): before, each drew its own button with
// its own markers. A state never relies on color alone (plan §10.1.7): the current question has
// a heavier border and a dot, an answer a check mark, an answer still on its way or refused an
// exclamation mark, a "Ragu-ragu" mark the corner; the name read aloud says all of it.

export interface QuestionNumberState {
  current: boolean;
  answered: boolean;
  /** The answer is still being sent or could not be sent. */
  unresolved: boolean;
  flagged: boolean;
}

export function questionNumberState(
  snapshotId: string,
  index: number,
  currentIndex: number,
  selectedOptions: Record<string, string>,
  saveStates: Record<string, SaveState>,
  flags: Record<string, boolean>,
): QuestionNumberState {
  const status = saveStates[snapshotId]?.status;
  return {
    current: index === currentIndex,
    answered: !!selectedOptions[snapshotId],
    unresolved: status === 'saving' || status === 'failed',
    flagged: !!flags[snapshotId],
  };
}

function statusText({ answered, unresolved, flagged }: QuestionNumberState): string {
  let text = unresolved ? 'sedang disinkronisasi atau gagal' : answered ? 'sudah dijawab' : 'belum dijawab';
  if (flagged) text += ', ditandai ragu-ragu';
  return text;
}

export const QuestionNumberButton: React.FC<{ number: number; state: QuestionNumberState; onSelect(): void }> = ({ number, state, onSelect }) => {
  const { current, answered, unresolved, flagged } = state;
  return (
    <button
      type="button"
      data-slot="question-number"
      data-current={current || undefined}
      data-answered={answered || undefined}
      data-unresolved={unresolved || undefined}
      data-flagged={flagged || undefined}
      onClick={onSelect}
      aria-label={`Pindah ke soal nomor ${number}, status ${statusText(state)}`}
      aria-current={current ? 'true' : undefined}
      className={cn(
        'relative flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-background text-[15px] font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        answered && !unresolved && 'border-success-line bg-success-surface text-success-ink hover:bg-success-surface',
        unresolved && 'border-danger-line bg-danger-surface text-danger-ink hover:bg-danger-surface',
        current && 'border-2 border-primary font-bold',
      )}
    >
      <span>{number}</span>
      {flagged && <span className="flag-corner" aria-hidden="true" />}
      {current && <span aria-hidden="true" className="absolute bottom-0.5 left-1 text-[11px] font-bold leading-none">•</span>}
      {(answered || unresolved) && (
        <span aria-hidden="true" className={cn('absolute bottom-0.5 right-1 text-[11px] font-bold leading-none', unresolved ? 'text-danger-ink' : 'text-success-ink')}>
          {unresolved ? '!' : '✓'}
        </span>
      )}
    </button>
  );
};
