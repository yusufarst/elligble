import { isMeaningfulJson } from '../question-snapshot-baseline-frozen-content-contract.ts';
import type { DescriptorScore, QuestionDescriptor } from '../question-contract.ts';

// Essay, "Esai" (ASSESS-QUESTION-008 §4.1; Owner O02-9/O02-10/O02-2 and D1-D4). The Student
// writes plain text, at most 5,000 Unicode code points, kept exactly as written. The essay is
// graded by the managing Teacher (essay-grading.ts): until a valid grade exists a non-empty
// answer is UNGRADED (0 earned, pending, blocks finalization); a grade earns its score. The
// optional plain-text rubric is pinned in the snapshot and never sent to the Student. "" is an
// accepted empty write (UNANSWERED).

export const ESSAY_KEY = '2:ESSAY';
export const ESSAY_TYPE = 'ESSAY';
export const ESSAY_RULE = 'ESSAY_HUMAN_GRADED_V1';
export const ESSAY_TEXT_MAX = 5000;

const MICRO = 1_000_000;

/**
 * §4.1: a well-formed string (no lone surrogate) of at most 5,000 code points with no C0
 * control other than tab, LF and CR, no DEL and no C1 control.
 */
export function isEssayText(value: string): boolean {
    let count = 0;
    for (let i = 0; i < value.length; i++) {
        const unit = value.charCodeAt(i);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
            if (next < 0xdc00 || next > 0xdfff) return false;
            i++;
        } else if (unit >= 0xdc00 && unit <= 0xdfff) {
            return false;
        } else if ((unit < 0x20 && unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) || (unit >= 0x7f && unit <= 0x9f)) {
            return false;
        }
        count++;
        if (count > ESSAY_TEXT_MAX) return false;
    }
    return true;
}

function validContent(content: Record<string, unknown>): { maxMicro: bigint } | null {
    if (content['schemaVersion'] !== 2 || content['questionType'] !== ESSAY_TYPE) return null;
    if (!isMeaningfulJson(content['prompt'])) return null;
    if (typeof content['rubric'] !== 'string') return null;
    const maxScore = content['maxScore'];
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { maxMicro: BigInt(Math.round(maxScore * MICRO)) };
}

/** The essay text of a stored answer when it is valid and non-empty, otherwise null. */
export function essayTextOf(payload: unknown): string | null {
    const text = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>)['essayText'] : undefined;
    return typeof text === 'string' && text !== '' && isEssayText(text) ? text : null;
}

export const ESSAY_DESCRIPTOR: QuestionDescriptor = Object.freeze({
    key: ESSAY_KEY,
    scoringRuleId: ESSAY_RULE,
    allowsEmpty: true,
    validateContent(content: Record<string, unknown>) {
        return validContent(content) ? { ok: true as const } : { ok: false as const };
    },
    studentView(content: Record<string, unknown>) {
        return { schemaVersion: 2, questionType: ESSAY_TYPE, prompt: content['prompt'] };
    },
    validateAnswer(_content: Record<string, unknown>, payload: unknown) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false as const };
        const keys = Object.keys(payload);
        if (keys.length !== 1 || keys[0] !== 'essayText') return { ok: false as const };
        const text = (payload as Record<string, unknown>)['essayText'];
        if (typeof text !== 'string') return { ok: false as const };
        if (text === '') return { ok: true as const, empty: true };
        return isEssayText(text) ? { ok: true as const, empty: false } : { ok: false as const };
    },
    score(content: Record<string, unknown>, payload: unknown, grade?: { scoreMicro: bigint }): DescriptorScore {
        const valid = validContent(content);
        if (!valid) throw new Error('invalid essay content');
        // "", no answer, or a stored value that is not valid text scores like no answer.
        if (essayTextOf(payload) === null) return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: valid.maxMicro };
        // A missing grade, or one outside 0..max, leaves the item pending.
        if (!grade || grade.scoreMicro < 0n || grade.scoreMicro > valid.maxMicro) return { outcome: 'UNGRADED', earnedMicro: 0n, maxMicro: valid.maxMicro };
        return { outcome: 'GRADED', earnedMicro: grade.scoreMicro, maxMicro: valid.maxMicro };
    },
});
