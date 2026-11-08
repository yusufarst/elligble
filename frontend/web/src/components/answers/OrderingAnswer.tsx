import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button.tsx';
import { orderOf, type StudentSafeQuestion } from '../../types/assessment.ts';

// Ordering, "Mengurutkan" (ASSESS-QUESTION-005 §4.4/§4A, Owner O02-6/O02-2). The items are the exam
// screen's option cards in the current arrangement: the answer's order when answered, otherwise the
// authored order, which is not an answer until the Student acts (E2). Each row has "Naikkan" and
// "Turunkan"; a move saves the full new order and focus follows the moved item, to its other button
// at an end of the list (§4A.1). "Gunakan urutan ini" saves the arrangement as shown; "Kosongkan
// jawaban" saves "[]" (E3). An answered list takes the selected card state with the check badge.

export interface OrderingAnswerProps {
  question: StudentSafeQuestion;
  /** A canonical id list, "[]" or absent. */
  value: string | undefined;
  onChange: (value: string) => void;
}

type FocusTarget = { id: string; direction: 'up' | 'down' } | 'use' | 'clear' | null;

const Chevron = ({ up }: { up: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points={up ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
  </svg>
);

export function OrderingAnswer({ question, value, onChange }: OrderingAnswerProps) {
  const items = question.items ?? [];
  const ids = items.map(item => item.id);
  const chosen = value ? orderOf(value) : null;
  // A value that is not an order of exactly these items is shown as the authored order (§4A.4 item 7).
  const valid = chosen && chosen.length === ids.length && chosen.every(id => ids.includes(id)) ? chosen : null;
  const answered = valid !== null;
  const arrangement = valid ?? ids;
  const byId = new Map(items.map(item => [item.id, item]));
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [status, setStatus] = useState('');
  const moveButtons = useRef(new Map<string, HTMLButtonElement | null>());
  const rows = useRef(new Map<string, HTMLLIElement | null>());
  const keepButton = useRef<HTMLButtonElement | null>(null);
  const clearButton = useRef<HTMLButtonElement | null>(null);

  // A keyed reorder relocates DOM nodes: restore focus explicitly after render.
  useEffect(() => {
    if (focusTarget === null) return;
    if (focusTarget === 'use') keepButton.current?.focus();
    else if (focusTarget === 'clear') clearButton.current?.focus();
    else {
      moveButtons.current.get(`${focusTarget.id}:${focusTarget.direction}`)?.focus();
      rows.current.get(focusTarget.id)?.scrollIntoView?.({ block: 'nearest' });
    }
    setFocusTarget(null);
  }, [focusTarget, value]);

  const textOf = (id: string) => String(byId.get(id)?.content ?? '');
  const move = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= arrangement.length) return;
    const next = [...arrangement];
    [next[index], next[target]] = [next[target], next[index]];
    const id = arrangement[index];
    onChange(JSON.stringify(next));
    // At an end of the list the pressed button is disabled: focus its other button instead.
    const focusDirection = target === 0 ? 'down' : target === next.length - 1 ? 'up' : direction;
    setFocusTarget({ id, direction: focusDirection });
    setStatus(`${textOf(id)} dipindah ke urutan ${target + 1}.`);
  };
  const keepShown = () => {
    onChange(JSON.stringify(arrangement));
    setFocusTarget('clear');
    setStatus('Urutan ini disimpan sebagai jawaban.');
  };
  const clear = () => {
    onChange('[]');
    setFocusTarget('use');
    setStatus('Jawaban dikosongkan.');
  };
  const hintId = `ordering-${question.snapshotId}-hint`;

  return (
    <div className="ordering-answer">
      <p id={hintId} className="options-instruction">Urutkan item dengan tombol Naikkan dan Turunkan.</p>
      <ol className="ordering-list" aria-describedby={hintId}>
        {arrangement.map((id, index) => {
          const textId = `ordering-${question.snapshotId}-${id}-text`;
          return (
            <li key={id} ref={node => { rows.current.set(id, node); }} className={`option-item-label ordering-row ${answered ? 'selected' : ''}`}>
              <div className="ordering-row-main">
                <span className="option-marker" aria-hidden="true">{index + 1}</span>
                <span id={textId} className="option-text">{textOf(id)}</span>
                {answered && (
                  <span className="option-check-badge" aria-hidden="true">
                    <svg className="check-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="ordering-row-actions">
                <Button type="button" variant="secondary" size="icon" aria-label={`Naikkan item ${index + 1}`} aria-describedby={textId}
                  disabled={index === 0} ref={node => { moveButtons.current.set(`${id}:up`, node); }} onClick={() => move(index, 'up')}>
                  <Chevron up />
                </Button>
                <Button type="button" variant="secondary" size="icon" aria-label={`Turunkan item ${index + 1}`} aria-describedby={textId}
                  disabled={index === arrangement.length - 1} ref={node => { moveButtons.current.set(`${id}:down`, node); }} onClick={() => move(index, 'down')}>
                  <Chevron up={false} />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="ordering-actions">
        {answered
          ? <Button type="button" variant="secondary" ref={clearButton} onClick={clear}>Kosongkan jawaban</Button>
          : <Button type="button" variant="secondary" ref={keepButton} onClick={keepShown}>Gunakan urutan ini</Button>}
      </div>
      <p className="ordering-status" role="status" aria-live="polite">{status}</p>
    </div>
  );
}
