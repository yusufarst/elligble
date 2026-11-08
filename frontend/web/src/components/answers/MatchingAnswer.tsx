import { NativeSelect } from '../ui/native-select.tsx';
import { canonicalPairs, pairsOf, type StudentSafeQuestion } from '../../types/assessment.ts';

// Matching, "Menjodohkan" (ASSESS-QUESTION-004 §4.4/§4A, Owner O02-5 and D1). The right items are
// listed once with their letters, so long items stay readable; each left item has a native select
// of the right items. A right item used by another left item is disabled there ("sudah dipakai"):
// one to one, and nothing moves unexpectedly. "Pilih pasangan" unpairs. A paired row takes the
// selected state (FDS §21) and shows the chosen letter, a cue that is not colour alone. The value
// is the canonical pair list; "[]" when nothing is paired.

export const MATCHING_LETTERS = 'ABCDEFGHIJKL';

export interface MatchingAnswerProps {
  question: StudentSafeQuestion;
  /** A canonical pair list, "[]" or absent. */
  value: string | undefined;
  onChange: (value: string) => void;
}

/** The control status (§4A.1): nothing when nothing is paired; "Belum lengkap" while incomplete. */
export function matchingStatus(paired: number, total: number): string {
  if (paired === 0 || total === 0) return '';
  return paired < total ? `Belum lengkap: ${paired} dari ${total} pernyataan dipasangkan.` : 'Semua pernyataan sudah dipasangkan.';
}

export function MatchingAnswer({ question, value, onChange }: MatchingAnswerProps) {
  const left = question.leftItems ?? [];
  const right = question.rightItems ?? [];
  const pairs = new Map((value ? pairsOf(value) : null) ?? []);
  const usedBy = new Map([...pairs].map(([leftId, rightId]) => [rightId, leftId]));
  const letterOf = new Map(right.map((item, i) => [item.id, MATCHING_LETTERS[i]]));
  const choose = (leftId: string, rightId: string) => {
    const next = new Map(pairs);
    if (rightId) next.set(leftId, rightId);
    else next.delete(leftId);
    onChange(canonicalPairs([...next]));
  };
  const listId = `matching-${question.snapshotId}-right`;

  return (
    <div className="matching-answer">
      <section className="matching-right" aria-labelledby={listId}>
        <h3 id={listId} className="matching-heading">Pasangan kanan</h3>
        <ol className="matching-right-items">
          {right.map((item, i) => (
            <li key={item.id} className="matching-right-item">
              <span className="option-marker" aria-hidden="true">{MATCHING_LETTERS[i]}</span>
              <span className="option-text">
                <span className="sr-only">{MATCHING_LETTERS[i]}. </span>
                {item.content}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <ol className="matching-rows">
        {left.map((item, i) => {
          const chosen = pairs.get(item.id);
          const selectId = `matching-${question.snapshotId}-${item.id}`;
          const textId = `${selectId}-text`;
          return (
            <li key={item.id} className={`matching-row ${chosen ? 'paired' : ''}`}>
              <div className="matching-row-head">
                <span className="matching-number" aria-hidden="true">{i + 1}.</span>
                <span id={textId} className="option-text">{item.content}</span>
                {chosen && <span className="option-marker matching-chosen" aria-hidden="true">{letterOf.get(chosen)}</span>}
              </div>
              <NativeSelect
                size="exam"
                id={selectId}
                aria-label={`Pasangan untuk pernyataan ${i + 1}`}
                aria-describedby={textId}
                value={chosen ?? ''}
                onChange={event => choose(item.id, event.target.value)}
              >
                <option value="">Pilih pasangan</option>
                {right.map((option, j) => {
                  const owner = usedBy.get(option.id);
                  const used = owner !== undefined && owner !== item.id;
                  return (
                    <option key={option.id} value={option.id} disabled={used}>
                      {`${MATCHING_LETTERS[j]}. ${option.content}${used ? ' (sudah dipakai)' : ''}`}
                    </option>
                  );
                })}
              </NativeSelect>
            </li>
          );
        })}
      </ol>
      <p className="matching-status" role="status" aria-live="polite">{matchingStatus(pairs.size, left.length)}</p>
    </div>
  );
}
