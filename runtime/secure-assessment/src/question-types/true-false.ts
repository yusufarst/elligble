import { isMeaningfulJson } from '../question-snapshot-baseline-frozen-content-contract.ts';
import type { DescriptorScore, QuestionDescriptor } from '../question-contract.ts';

// True/false, "Benar/Salah" (ASSESS-QUESTION-003 §4.1/§4A; Owner O02-4/O02-1). A statement with
// a hidden boolean key. The answer is a strict boolean, never coerced; the exact value earns
// maxScore, the other 0. An answer can be changed but not cleared (§3, §4A.6), as v1.

export const TRUE_FALSE_KEY = '2:TRUE_FALSE';
export const TRUE_FALSE_TYPE = 'TRUE_FALSE';
export const TRUE_FALSE_RULE = 'TRUE_FALSE_EXACT_V1';

const MICRO = 1_000_000;

function validContent(content: Record<string, unknown>): { correct: boolean; maxMicro: bigint } | null {
    if (content['schemaVersion'] !== 2 || content['questionType'] !== TRUE_FALSE_TYPE) return null;
    if (!isMeaningfulJson(content['prompt'])) return null;
    const correct = content['correctValue'];
    if (typeof correct !== 'boolean') return null;
    const maxScore = content['maxScore'];
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { correct, maxMicro: BigInt(Math.round(maxScore * MICRO)) };
}

export const TRUE_FALSE_DESCRIPTOR: QuestionDescriptor = Object.freeze({
    key: TRUE_FALSE_KEY,
    scoringRuleId: TRUE_FALSE_RULE,
    allowsEmpty: false,
    validateContent(content: Record<string, unknown>) {
        return validContent(content) ? { ok: true as const } : { ok: false as const };
    },
    studentView(content: Record<string, unknown>) {
        return { schemaVersion: 2, questionType: TRUE_FALSE_TYPE, prompt: content['prompt'] };
    },
    validateAnswer(_content: Record<string, unknown>, payload: unknown) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false as const };
        const keys = Object.keys(payload);
        if (keys.length !== 1 || keys[0] !== 'value') return { ok: false as const };
        return typeof (payload as Record<string, unknown>)['value'] === 'boolean' ? { ok: true as const, empty: false } : { ok: false as const };
    },
    score(content: Record<string, unknown>, payload: unknown): DescriptorScore {
        const valid = validContent(content);
        if (!valid) throw new Error('invalid true/false content');
        const value = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>)['value'] : undefined;
        if (typeof value !== 'boolean') return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: valid.maxMicro };
        return value === valid.correct
            ? { outcome: 'CORRECT', earnedMicro: valid.maxMicro, maxMicro: valid.maxMicro }
            : { outcome: 'INCORRECT', earnedMicro: 0n, maxMicro: valid.maxMicro };
    },
});
