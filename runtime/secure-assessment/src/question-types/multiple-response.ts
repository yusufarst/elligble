import { isMeaningfulJson } from '../question-snapshot-baseline-frozen-content-contract.ts';
import type { DescriptorScore, QuestionDescriptor } from '../question-contract.ts';

// Multiple response, "pilihan ganda kompleks" (ASSESS-QUESTION-002 §4.1; Owner O02-3/O02-1/
// O02-2; D04.8-08). Five options A-E, a hidden correct set of one to five options. The Student
// chooses any subset; the exact correct set earns maxScore, anything else 0, no partial or
// negative credit. An empty selection is an accepted versioned write that scores UNANSWERED.

export const MULTIPLE_RESPONSE_KEY = '2:MULTIPLE_RESPONSE';
export const MULTIPLE_RESPONSE_TYPE = 'MULTIPLE_RESPONSE';
export const MULTIPLE_RESPONSE_RULE = 'MULTIPLE_RESPONSE_EXACT_SET_V1';
export const MULTIPLE_RESPONSE_OPTION_COUNT = 5;

const MICRO = 1_000_000;

interface Option { id: string; content: unknown }

function optionsOf(content: Record<string, unknown>): Option[] | null {
    const options = content['options'];
    if (!Array.isArray(options) || options.length !== MULTIPLE_RESPONSE_OPTION_COUNT) return null;
    const ids = new Set<string>();
    for (const option of options) {
        if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
        const id = (option as Record<string, unknown>)['id'];
        if (typeof id !== 'string' || id.trim().length === 0 || ids.has(id)) return null;
        if (!isMeaningfulJson((option as Record<string, unknown>)['content'])) return null;
        ids.add(id);
    }
    return options as Option[];
}

/** A unique array of known option ids, or null. */
function idSet(value: unknown, known: ReadonlySet<string>, min: number): Set<string> | null {
    if (!Array.isArray(value) || value.length < min || value.length > MULTIPLE_RESPONSE_OPTION_COUNT) return null;
    const set = new Set<string>();
    for (const id of value) {
        if (typeof id !== 'string' || !known.has(id) || set.has(id)) return null;
        set.add(id);
    }
    return set;
}

function validContent(content: Record<string, unknown>): { options: Option[]; correct: Set<string>; maxMicro: bigint } | null {
    if (content['schemaVersion'] !== 2 || content['questionType'] !== MULTIPLE_RESPONSE_TYPE) return null;
    if (!isMeaningfulJson(content['prompt'])) return null;
    const options = optionsOf(content);
    if (!options) return null;
    const correct = idSet(content['correctOptionIds'], new Set(options.map(o => o.id)), 1);
    if (!correct) return null;
    const maxScore = content['maxScore'];
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { options, correct, maxMicro: BigInt(Math.round(maxScore * MICRO)) };
}

export const MULTIPLE_RESPONSE_DESCRIPTOR: QuestionDescriptor = Object.freeze({
    key: MULTIPLE_RESPONSE_KEY,
    scoringRuleId: MULTIPLE_RESPONSE_RULE,
    allowsEmpty: true,
    validateContent(content: Record<string, unknown>) {
        return validContent(content) ? { ok: true as const } : { ok: false as const };
    },
    studentView(content: Record<string, unknown>) {
        const options = Array.isArray(content['options']) ? content['options'] as Array<Record<string, unknown>> : [];
        return {
            schemaVersion: 2,
            questionType: MULTIPLE_RESPONSE_TYPE,
            prompt: content['prompt'],
            options: options.map(o => ({ id: o['id'], content: o['content'] })),
        };
    },
    validateAnswer(content: Record<string, unknown>, payload: unknown) {
        const options = optionsOf(content);
        if (!options || !payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false as const };
        const keys = Object.keys(payload);
        if (keys.length !== 1 || keys[0] !== 'selectedOptionIds') return { ok: false as const };
        const set = idSet((payload as Record<string, unknown>)['selectedOptionIds'], new Set(options.map(o => o.id)), 0);
        return set ? { ok: true as const, empty: set.size === 0 } : { ok: false as const };
    },
    score(content: Record<string, unknown>, payload: unknown): DescriptorScore {
        const valid = validContent(content);
        if (!valid) throw new Error('invalid multiple-response content');
        const raw = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>)['selectedOptionIds'] : undefined;
        // A stored value that is not a valid selection scores like no answer (§4A.6).
        const chosen = idSet(raw, new Set(valid.options.map(o => o.id)), 0);
        if (!chosen || chosen.size === 0) return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: valid.maxMicro };
        const exact = chosen.size === valid.correct.size && [...chosen].every(id => valid.correct.has(id));
        return exact
            ? { outcome: 'CORRECT', earnedMicro: valid.maxMicro, maxMicro: valid.maxMicro }
            : { outcome: 'INCORRECT', earnedMicro: 0n, maxMicro: valid.maxMicro };
    },
});
