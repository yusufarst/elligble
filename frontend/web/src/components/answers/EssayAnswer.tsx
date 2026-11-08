import { useEffect, useRef, useState } from 'react';
import { Label } from '../ui/label.tsx';
import { Textarea } from '../ui/textarea.tsx';
import { ESSAY_TEXT_MAX, codePointCount, essayTextProblem, type StudentSafeQuestion } from '../../types/assessment.ts';

// Essay, "Esai" (ASSESS-QUESTION-008 §4.6; Owner O02-9 and D2). The shared Textarea, plain text
// only. Only "" or text the server accepts (at most 5,000 code points, no unsupported control
// character) is captured, and so saved, exactly as written. Other text is a draft (D2): it is never
// sent, the hint says why and the exam screen shows "Belum tersimpan" while it keeps the draft.
// The counter is not a live region; the hint region is always mounted and polite.

export const ESSAY_HINT_TOO_LONG = 'Jawaban melebihi 5.000 karakter, sehingga belum tersimpan.';
export const ESSAY_HINT_INVALID = 'Jawaban memuat karakter yang tidak didukung, sehingga belum tersimpan.';

/** "5.000" as the copy style writes thousands (UI_CONTENT_AND_COPY_STYLE.md). */
export function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface EssayAnswerProps {
  question: StudentSafeQuestion;
  /** The captured text ("" when cleared), or absent. */
  value: string | undefined;
  /** Text kept from an earlier visit to this question that was not captured. */
  draft?: string;
  onChange: (value: string) => void;
  /** Reports the text that is shown but not captured, or undefined when there is none. */
  onDraft?: (draft: string | undefined) => void;
}

export function EssayAnswer({ question, value, draft, onChange, onDraft }: EssayAnswerProps) {
  const [text, setText] = useState(draft ?? value ?? '');
  const lastCaptured = useRef(value);
  const problem = essayTextProblem(text);

  // A change to the stored value that this field did not capture (pause discard, reconciliation,
  // adoption) replaces whatever the field shows, as for numeric answers.
  useEffect(() => {
    if (value !== lastCaptured.current) {
      lastCaptured.current = value;
      setText(value ?? '');
    }
  }, [value]);

  useEffect(() => { onDraft?.(problem ? text : undefined); }, [problem, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next: string) => {
    setText(next);
    if (essayTextProblem(next) === null) {
      lastCaptured.current = next;
      onChange(next);
    }
  };
  const id = `essay-${question.snapshotId}`;

  return (
    <div className="essay-answer">
      <Label htmlFor={id}>Jawaban esai</Label>
      <p id={`${id}-instruction`} className="options-instruction">Tulis jawaban dengan teks biasa, paling banyak 5.000 karakter.</p>
      <Textarea
        id={id}
        className="essay-field"
        rows={8}
        value={text}
        aria-invalid={problem ? true : undefined}
        aria-describedby={`${id}-instruction ${id}-count ${id}-hint`}
        onChange={event => change(event.target.value)}
      />
      <p id={`${id}-count`} className="essay-count" data-over={problem === 'too_long' || undefined}>
        {formatCount(codePointCount(text))}/{formatCount(ESSAY_TEXT_MAX)} karakter
      </p>
      <p id={`${id}-hint`} className="essay-hint" role="status" aria-live="polite">
        {problem === 'too_long' ? ESSAY_HINT_TOO_LONG : problem === 'invalid_character' ? ESSAY_HINT_INVALID : ''}
      </p>
    </div>
  );
}
