import { isMeaningfulJson } from '../question-snapshot-baseline-frozen-content-contract.ts';
import type { DescriptorScore, QuestionDescriptor } from '../question-contract.ts';

// Short answer, "Isian singkat" (ASSESS-QUESTION-006 §4.1; Owner O02-7/O02-1/O02-2/O02-9 and D1-D2).
// The Student types one line of at most 200 Unicode code points, kept exactly as typed. With
// accepted forms (1-10) the answer is scored automatically, all-or-nothing, after the approved
// normalization (E3); no fuzzy, synonym or AI matching. Without accepted forms (D1) the item is
// graded by the managing Teacher through the essay workflow: UNGRADED until a grade exists, then
// GRADED. The forms and the rubric are pinned in the snapshot and never sent to the Student.

export const SHORT_ANSWER_KEY = '2:SHORT_ANSWER';
export const SHORT_ANSWER_TYPE = 'SHORT_ANSWER';
export const SHORT_ANSWER_RULE = 'SHORT_ANSWER_ACCEPTED_FORMS_V1';
export const SHORT_TEXT_MAX = 200;
export const MAX_ACCEPTED_FORMS = 10;

const MICRO = 1_000_000;

/**
 * E1/E2: a well-formed string (no lone surrogate) of at most 200 code points on one line: no LF
 * or CR, no other C0 control than tab, no DEL and no C1 control.
 */
export function isShortText(value: string): boolean {
    let count = 0;
    for (let i = 0; i < value.length; i++) {
        const unit = value.charCodeAt(i);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
            if (next < 0xdc00 || next > 0xdfff) return false;
            i++;
        } else if (unit >= 0xdc00 && unit <= 0xdfff) {
            return false;
        } else if ((unit < 0x20 && unit !== 0x09) || (unit >= 0x7f && unit <= 0x9f)) {
            return false;
        }
        count++;
        if (count > SHORT_TEXT_MAX) return false;
    }
    return true;
}

/** E3: NFC, trim, collapse inner whitespace to one space, locale-independent lowercase, NFC. */
export function normalizeShortText(value: string): string {
    return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase().normalize('NFC');
}

function validContent(content: Record<string, unknown>): { forms: Set<string>; maxMicro: bigint } | null {
    if (content['schemaVersion'] !== 2 || content['questionType'] !== SHORT_ANSWER_TYPE) return null;
    if (!isMeaningfulJson(content['prompt'])) return null;
    const accepted = content['acceptedForms'];
    const rubric = content['rubric'];
    if (!Array.isArray(accepted) || accepted.length > MAX_ACCEPTED_FORMS || typeof rubric !== 'string') return null;
    const forms = new Set<string>();
    for (const form of accepted) {
        if (typeof form !== 'string' || !isShortText(form)) return null;
        const normalized = normalizeShortText(form);
        if (normalized === '' || forms.has(normalized)) return null;
        forms.add(normalized);
    }
    // An auto-scored item has no rubric; the rubric belongs to manual mode (D1).
    if (forms.size > 0 && rubric !== '') return null;
    const maxScore = content['maxScore'];
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { forms, maxMicro: BigInt(Math.round(maxScore * MICRO)) };
}

/** Whether valid short-answer content is graded by the teacher (no accepted forms, D1). */
export function isManualShortAnswer(content: Record<string, unknown>): boolean {
    const valid = validContent(content);
    return valid !== null && valid.forms.size === 0;
}

/** The short text of a stored answer when it is valid and non-empty, otherwise null. */
export function shortTextOf(payload: unknown): string | null {
    const text = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>)['shortText'] : undefined;
    return typeof text === 'string' && text !== '' && isShortText(text) ? text : null;
}

export const SHORT_ANSWER_DESCRIPTOR: QuestionDescriptor = Object.freeze({
    key: SHORT_ANSWER_KEY,
    scoringRuleId: SHORT_ANSWER_RULE,
    allowsEmpty: true,
    validateContent(content: Record<string, unknown>) {
        return validContent(content) ? { ok: true as const } : { ok: false as const };
    },
    studentView(content: Record<string, unknown>) {
        return { schemaVersion: 2, questionType: SHORT_ANSWER_TYPE, prompt: content['prompt'] };
    },
    validateAnswer(_content: Record<string, unknown>, payload: unknown) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false as const };
        const keys = Object.keys(payload);
        if (keys.length !== 1 || keys[0] !== 'shortText') return { ok: false as const };
        const text = (payload as Record<string, unknown>)['shortText'];
        if (typeof text !== 'string') return { ok: false as const };
        if (text === '') return { ok: true as const, empty: true };
        return isShortText(text) ? { ok: true as const, empty: false } : { ok: false as const };
    },
    score(content: Record<string, unknown>, payload: unknown, grade?: { scoreMicro: bigint }): DescriptorScore {
        const valid = validContent(content);
        if (!valid) throw new Error('invalid short-answer content');
        const text = shortTextOf(payload);
        // "", no answer, or a stored value that is not valid text scores like no answer.
        if (text === null) return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: valid.maxMicro };
        if (valid.forms.size === 0) {
            if (!grade || grade.scoreMicro < 0n || grade.scoreMicro > valid.maxMicro) return { outcome: 'UNGRADED', earnedMicro: 0n, maxMicro: valid.maxMicro };
            return { outcome: 'GRADED', earnedMicro: grade.scoreMicro, maxMicro: valid.maxMicro };
        }
        return valid.forms.has(normalizeShortText(text))
            ? { outcome: 'CORRECT', earnedMicro: valid.maxMicro, maxMicro: valid.maxMicro }
            : { outcome: 'INCORRECT', earnedMicro: 0n, maxMicro: valid.maxMicro };
    },
});
