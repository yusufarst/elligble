import { useEffect, useRef, useState } from 'react';
import { Input } from '../ui/input.tsx';
import { Label } from '../ui/label.tsx';
import { isNumericText, type StudentSafeQuestion } from '../../types/assessment.ts';

// Numeric answer, "Isian angka" (ASSESS-QUESTION-007 §4.4; Owner O02-8 and D1). The shared Input
// in its exam size with the text keyboard (a minus must be typeable on iOS). Only a valid number
// or "" is captured, and so saved, exactly as typed. Other text is never sent (D1): the field is
// marked invalid and the D1 hint shows. An incomplete prefix ("-", "5,") stays silent while the
// field has focus and counts as invalid after blur. Text that is shown but not captured is a draft,
// reported to the exam screen so it can say "Belum tersimpan" and keep it while the screen is open.

export const NUMERIC_HINT = 'Tulis angka saja, pakai koma atau titik untuk desimal.';
const INCOMPLETE = /^-$|^-?[0-9]+[.,]$/;

/** capture: valid or empty, saved as typed; incomplete: silent while typing; invalid: never sent. */
export function classifyNumericText(text: string): 'capture' | 'incomplete' | 'invalid' {
  if (text === '' || isNumericText(text)) return 'capture';
  return INCOMPLETE.test(text) ? 'incomplete' : 'invalid';
}

export interface NumericAnswerProps {
  question: StudentSafeQuestion;
  /** The captured text ("" when cleared), or absent. */
  value: string | undefined;
  /** Text kept from an earlier visit to this question that was not captured. */
  draft?: string;
  onChange: (value: string) => void;
  /** Reports the text that is shown but not captured, or undefined when there is none. */
  onDraft?: (draft: string | undefined) => void;
}

export function NumericAnswer({ question, value, draft, onChange, onDraft }: NumericAnswerProps) {
  const [text, setText] = useState(draft ?? value ?? '');
  const [focused, setFocused] = useState(false);
  const lastCaptured = useRef(value);
  const kind = classifyNumericText(text);
  const invalid = kind === 'invalid' || (kind === 'incomplete' && !focused);

  // A change to the stored value that this field did not capture (pause discard, reconciliation,
  // adoption) replaces whatever the field shows (§4.4).
  useEffect(() => {
    if (value !== lastCaptured.current) {
      lastCaptured.current = value;
      setText(value ?? '');
    }
  }, [value]);

  useEffect(() => { onDraft?.(invalid ? text : undefined); }, [invalid, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next: string) => {
    setText(next);
    if (classifyNumericText(next) === 'capture') {
      lastCaptured.current = next;
      onChange(next);
    }
  };
  const id = `numeric-${question.snapshotId}`;

  return (
    <div className="numeric-answer">
      <Label htmlFor={id}>Jawaban angka</Label>
      <p id={`${id}-instruction`} className="options-instruction">Tulis jawaban berupa angka.</p>
      <Input
        id={id}
        inputSize="exam"
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-instruction ${id}-hint`}
        onChange={event => change(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <p id={`${id}-hint`} className="numeric-hint" role="status" aria-live="polite">{invalid ? NUMERIC_HINT : ''}</p>
    </div>
  );
}
