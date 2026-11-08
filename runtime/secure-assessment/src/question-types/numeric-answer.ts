import { isMeaningfulJson } from '../question-snapshot-baseline-frozen-content-contract.ts';
import type { DescriptorScore, QuestionDescriptor } from '../question-contract.ts';

// Numeric answer, "Isian angka" (ASSESS-QUESTION-007 §4.1; Owner O02-8/O02-1/O02-2 and D1). The
// Student types a number: an optional minus, ASCII digits, one optional comma or dot with digits
// after it, at most 30 characters, stored exactly as typed. It is compared as an exact decimal
// (BigInt, never floating point) with the hidden expected value; |answer - expected| <= tolerance
// (inclusive) earns maxScore, anything else 0. "" is an accepted empty write (UNANSWERED).

export const NUMERIC_ANSWER_KEY = '2:NUMERIC_ANSWER';
export const NUMERIC_ANSWER_TYPE = 'NUMERIC_ANSWER';
export const NUMERIC_ANSWER_RULE = 'NUMERIC_EXACT_DECIMAL_TOLERANCE_V1';
export const NUMERIC_TEXT_MAX = 30;

const MICRO = 1_000_000;
const NUMBER_TEXT = /^-?[0-9]+([.,][0-9]+)?$/;
const CANONICAL = /^-?(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/;
const CANONICAL_NON_NEGATIVE = /^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/;

/** E1 (§3): a number as a Student or a teacher may type it, within 30 characters. */
export function isNumberText(value: string): boolean {
    return value.length <= NUMERIC_TEXT_MAX && NUMBER_TEXT.test(value);
}

/** The canonical form (§4.2): "." separator, no leading or trailing zeros, zero without a sign. */
export function canonicalNumber(text: string): string {
    const negative = text.startsWith('-');
    const [intRaw, fracRaw = ''] = (negative ? text.slice(1) : text).replace(',', '.').split('.');
    const int = intRaw.replace(/^0+(?=[0-9])/, '');
    const frac = fracRaw.replace(/0+$/, '');
    const body = frac ? `${int}.${frac}` : int;
    return negative && body !== '0' ? `-${body}` : body;
}

/** A decimal as {units, scale}: value = units / 10^scale. Only for texts that pass isNumberText. */
function decimalOf(text: string): { units: bigint; scale: number } {
    const negative = text.startsWith('-');
    const [int, frac = ''] = (negative ? text.slice(1) : text).replace(',', '.').split('.');
    const units = BigInt(int + frac);
    return { units: negative ? -units : units, scale: frac.length };
}

function scaled(d: { units: bigint; scale: number }, scale: number): bigint {
    return d.units * 10n ** BigInt(scale - d.scale);
}

function validContent(content: Record<string, unknown>): { expected: string; tolerance: string; maxMicro: bigint } | null {
    if (content['schemaVersion'] !== 2 || content['questionType'] !== NUMERIC_ANSWER_TYPE) return null;
    if (!isMeaningfulJson(content['prompt'])) return null;
    const expected = content['expected'];
    const tolerance = content['tolerance'];
    if (typeof expected !== 'string' || expected.length > NUMERIC_TEXT_MAX || !CANONICAL.test(expected) || expected === '-0') return null;
    if (typeof tolerance !== 'string' || tolerance.length > NUMERIC_TEXT_MAX || !CANONICAL_NON_NEGATIVE.test(tolerance)) return null;
    const maxScore = content['maxScore'];
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { expected, tolerance, maxMicro: BigInt(Math.round(maxScore * MICRO)) };
}

/** Whether |answer - expected| <= tolerance, exactly. */
export function withinTolerance(answer: string, expected: string, tolerance: string): boolean {
    const a = decimalOf(answer), e = decimalOf(expected), t = decimalOf(tolerance);
    const scale = Math.max(a.scale, e.scale, t.scale);
    const diff = scaled(a, scale) - scaled(e, scale);
    return (diff < 0n ? -diff : diff) <= scaled(t, scale);
}

export const NUMERIC_ANSWER_DESCRIPTOR: QuestionDescriptor = Object.freeze({
    key: NUMERIC_ANSWER_KEY,
    scoringRuleId: NUMERIC_ANSWER_RULE,
    allowsEmpty: true,
    validateContent(content: Record<string, unknown>) {
        return validContent(content) ? { ok: true as const } : { ok: false as const };
    },
    studentView(content: Record<string, unknown>) {
        return { schemaVersion: 2, questionType: NUMERIC_ANSWER_TYPE, prompt: content['prompt'] };
    },
    validateAnswer(_content: Record<string, unknown>, payload: unknown) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false as const };
        const keys = Object.keys(payload);
        if (keys.length !== 1 || keys[0] !== 'numericText') return { ok: false as const };
        const text = (payload as Record<string, unknown>)['numericText'];
        if (typeof text !== 'string') return { ok: false as const };
        if (text === '') return { ok: true as const, empty: true };
        return isNumberText(text) ? { ok: true as const, empty: false } : { ok: false as const };
    },
    score(content: Record<string, unknown>, payload: unknown): DescriptorScore {
        const valid = validContent(content);
        if (!valid) throw new Error('invalid numeric-answer content');
        const text = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>)['numericText'] : undefined;
        // "", no answer, or a stored value that is not a valid number scores like no answer.
        if (typeof text !== 'string' || text === '' || !isNumberText(text)) return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: valid.maxMicro };
        return withinTolerance(text, valid.expected, valid.tolerance)
            ? { outcome: 'CORRECT', earnedMicro: valid.maxMicro, maxMicro: valid.maxMicro }
            : { outcome: 'INCORRECT', earnedMicro: 0n, maxMicro: valid.maxMicro };
    },
});
