import { EMPTY_SELECTION, canonicalSelection, selectionOf, type StudentSafeQuestion } from '../../types/assessment.ts';

// Multiple response, "pilihan ganda kompleks" (ASSESS-QUESTION-002 §4.6, Owner O02-3): the
// Student chooses every correct option. It is the existing option card with a checkbox marker
// (a documented variant, FDS §21): green as soon as it is chosen and also shown by the check
// badge, never by color alone. The number of correct options is never shown. Unchecking the
// last option clears the answer, which then reads "Belum dijawab" (O02-2).

export interface MultipleResponseAnswerProps {
  question: StudentSafeQuestion;
  /** The canonical value of the current answer ("[]" or absent: nothing chosen). */
  value: string | undefined;
  onChange: (value: string) => void;
}

export function MultipleResponseAnswer({ question, value, onChange }: MultipleResponseAnswerProps) {
  const chosen = new Set(value ? selectionOf(value) ?? [] : []);
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next.size === 0 ? EMPTY_SELECTION : canonicalSelection([...next]));
  };
  const hintId = `multiple-response-hint-${question.snapshotId}`;

  return (
    <div className="options-list options-list-multiple" role="group" aria-label="Pilihan Jawaban" aria-describedby={hintId}>
      <p id={hintId} className="options-instruction">Pilih semua jawaban yang benar.</p>
      {question.options.map((opt, optIdx) => {
        const isSelected = chosen.has(opt.id);
        const optionLabel = String.fromCharCode(65 + optIdx);
        const inputId = `option-${question.snapshotId}-${opt.id}`;
        return (
          <label key={opt.id} className={`option-item-label option-item-checkbox ${isSelected ? 'selected' : ''}`} htmlFor={inputId}>
            <input
              type="checkbox"
              id={inputId}
              value={opt.id}
              checked={isSelected}
              onChange={() => toggle(opt.id)}
              className="option-radio-input"
            />
            <span className="option-marker option-marker-square" aria-hidden="true">{optionLabel}</span>
            <span className="option-text">{opt.content}</span>
            {isSelected && (
              <span className="option-check-badge" aria-hidden="true">
                <svg className="check-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
