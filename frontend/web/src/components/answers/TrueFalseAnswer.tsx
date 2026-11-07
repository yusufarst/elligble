import type { StudentSafeQuestion } from '../../types/assessment.ts';

// True/false, "Benar/Salah" (ASSESS-QUESTION-003 §4.4, Owner O02-4): the statement's two fixed
// choices as the exam screen's own radio option cards (FDS §21), markers B and S. The answer is
// the canonical "true" or "false"; it can be changed but not cleared, as single choice.

export interface TrueFalseAnswerProps {
  question: StudentSafeQuestion;
  /** "true", "false" or absent. */
  value: string | undefined;
  onChange: (value: 'true' | 'false') => void;
}

const CHOICES = [
  { value: 'true', marker: 'B', label: 'Benar' },
  { value: 'false', marker: 'S', label: 'Salah' },
] as const;

export function TrueFalseAnswer({ question, value, onChange }: TrueFalseAnswerProps) {
  return (
    <div className="options-list" role="radiogroup" aria-label="Pilihan Jawaban">
      {CHOICES.map(choice => {
        const isSelected = value === choice.value;
        const inputId = `option-${question.snapshotId}-${choice.value}`;
        return (
          <label key={choice.value} className={`option-item-label ${isSelected ? 'selected' : ''}`} htmlFor={inputId}>
            <input
              type="radio"
              id={inputId}
              name={`question-${question.snapshotId}`}
              value={choice.value}
              checked={isSelected}
              onChange={() => onChange(choice.value)}
              className="option-radio-input"
            />
            <span className="option-marker" aria-hidden="true">{choice.marker}</span>
            <span className="option-text">{choice.label}</span>
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
