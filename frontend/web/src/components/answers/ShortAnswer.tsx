import { useEffect, useRef, useState } from 'react';
import { Input } from '../ui/input.tsx';
import { Label } from '../ui/label.tsx';
import { SHORT_TEXT_MAX, codePointCount, shortTextProblem, type StudentSafeQuestion } from '../../types/assessment.ts';

// Short answer, "Isian singkat" (ASSESS-QUESTION-006 §4.4; Owner O02-7 and D2). The shared Input in
// its exam size, one line, kept exactly as typed. Only "" or text the server accepts (at most 200
// code points, no line break or unsupported character) is captured, and so saved. Other text is a
// draft (D2): never sent, the hint says why and the exam screen shows "Belum tersimpan" while it
// keeps the draft. The counter is not a live region; the hint region is always mounted and polite.

export const SHORT_HINT_TOO_LONG = 'Jawaban melebihi 200 karakter, sehingga belum tersimpan.';
export const SHORT_HINT_INVALID = 'Jawaban memuat karakter yang tidak didukung, sehingga belum tersimpan.';

export interface ShortAnswerProps {
  question: StudentSafeQuestion;
  /** The captured text ("" when cleared), or absent. */
  value: string | undefined;
  /** Text kept from an earlier visit to this question that was not captured. */
  draft?: string;
  onChange: (value: string) => void;
  /** Reports the text that is shown but not captured, or undefined when there is none. */
  onDraft?: (draft: string | undefined) => void;
}

export function ShortAnswer({ question, value, draft, onChange, onDraft }: ShortAnswerProps) {
  const [text, setText] = useState(draft ?? value ?? '');
  const lastCaptured = useRef(value);
  const problem = shortTextProblem(text);

  // A change to the stored value that this field did not capture (pause discard, reconciliation,
  // adoption) replaces whatever the field shows, as for numeric answers and essays.
  useEffect(() => {
    if (value !== lastCaptured.current) {
      lastCaptured.current = value;
      setText(value ?? '');
    }
  }, [value]);

  useEffect(() => { onDraft?.(problem ? text : undefined); }, [problem, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next: string) => {
    setText(next);
    if (shortTextProblem(next) === null) {
      lastCaptured.current = next;
      onChange(next);
    }
  };
  const id = `short-${question.snapshotId}`;

  return (
    <div className="short-answer">
      <Label htmlFor={id}>Jawaban singkat</Label>
      <p id={`${id}-instruction`} className="options-instruction">Tulis jawaban singkat dalam satu baris, paling banyak 200 karakter.</p>
      <Input
        id={id}
        inputSize="exam"
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        aria-invalid={problem ? true : undefined}
        aria-describedby={`${id}-instruction ${id}-count ${id}-hint`}
        onChange={event => change(event.target.value)}
      />
      <p id={`${id}-count`} className="essay-count" data-over={problem === 'too_long' || undefined}>
        {codePointCount(text)}/{SHORT_TEXT_MAX} karakter
      </p>
      <p id={`${id}-hint`} className="essay-hint" role="status" aria-live="polite">
        {problem === 'too_long' ? SHORT_HINT_TOO_LONG : problem === 'invalid_character' ? SHORT_HINT_INVALID : ''}
      </p>
    </div>
  );
}
