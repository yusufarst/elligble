import { isMeaningfulJson } from '../question-snapshot-baseline-frozen-content-contract.ts';
import type { DescriptorScore, QuestionDescriptor } from '../question-contract.ts';

// Ordering, "Mengurutkan" (ASSESS-QUESTION-005 §4.1/§4A; Owner O02-6/O02-1/O02-2). Two to ten
// items shown in authored order, with a hidden correct order. The answer is either empty (an
// accepted versioned write that scores UNANSWERED) or a full permutation of every item; the exact
// sequence earns maxScore, any other permutation 0.

export const ORDERING_KEY = '2:ORDERING';
export const ORDERING_TYPE = 'ORDERING';
export const ORDERING_RULE = 'ORDERING_EXACT_SEQUENCE_V1';
export const ORDERING_MIN_ITEMS = 2;
export const ORDERING_MAX_ITEMS = 10;

const MICRO = 1_000_000;

interface Item { id: string; content: unknown }

function itemsOf(content: Record<string, unknown>): Item[] | null {
    const items = content['items'];
    if (!Array.isArray(items) || items.length < ORDERING_MIN_ITEMS || items.length > ORDERING_MAX_ITEMS) return null;
    const ids = new Set<string>();
    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const id = (item as Record<string, unknown>)['id'];
        if (typeof id !== 'string' || id.trim().length === 0 || ids.has(id)) return null;
        if (!isMeaningfulJson((item as Record<string, unknown>)['content'])) return null;
        ids.add(id);
    }
    return items as Item[];
}

/** A permutation of the known ids (every id exactly once), [] when empty is allowed, or null. */
function orderOf(value: unknown, known: readonly string[], allowEmpty: boolean): string[] | null {
    if (!Array.isArray(value)) return null;
    if (value.length === 0) return allowEmpty ? [] : null;
    if (value.length !== known.length) return null;
    const seen = new Set<string>();
    for (const id of value) {
        if (typeof id !== 'string' || !known.includes(id) || seen.has(id)) return null;
        seen.add(id);
    }
    return value as string[];
}

function validContent(content: Record<string, unknown>): { ids: string[]; correct: string[]; maxMicro: bigint } | null {
    if (content['schemaVersion'] !== 2 || content['questionType'] !== ORDERING_TYPE) return null;
    if (!isMeaningfulJson(content['prompt'])) return null;
    const items = itemsOf(content);
    if (!items) return null;
    const ids = items.map(i => i.id);
    const correct = orderOf(content['correctOrder'], ids, false);
    if (!correct) return null;
    const maxScore = content['maxScore'];
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { ids, correct, maxMicro: BigInt(Math.round(maxScore * MICRO)) };
}

export const ORDERING_DESCRIPTOR: QuestionDescriptor = Object.freeze({
    key: ORDERING_KEY,
    scoringRuleId: ORDERING_RULE,
    allowsEmpty: true,
    validateContent(content: Record<string, unknown>) {
        return validContent(content) ? { ok: true as const } : { ok: false as const };
    },
    studentView(content: Record<string, unknown>) {
        const items = Array.isArray(content['items']) ? content['items'] as Array<Record<string, unknown>> : [];
        return { schemaVersion: 2, questionType: ORDERING_TYPE, prompt: content['prompt'], items: items.map(i => ({ id: i['id'], content: i['content'] })) };
    },
    validateAnswer(content: Record<string, unknown>, payload: unknown) {
        const items = itemsOf(content);
        if (!items || !payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false as const };
        const keys = Object.keys(payload);
        if (keys.length !== 1 || keys[0] !== 'orderedItemIds') return { ok: false as const };
        const order = orderOf((payload as Record<string, unknown>)['orderedItemIds'], items.map(i => i.id), true);
        return order ? { ok: true as const, empty: order.length === 0 } : { ok: false as const };
    },
    score(content: Record<string, unknown>, payload: unknown): DescriptorScore {
        const valid = validContent(content);
        if (!valid) throw new Error('invalid ordering content');
        const raw = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>)['orderedItemIds'] : undefined;
        // A stored value that is not a valid order scores like no answer.
        const order = orderOf(raw, valid.ids, true);
        if (!order || order.length === 0) return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: valid.maxMicro };
        return order.every((id, i) => id === valid.correct[i])
            ? { outcome: 'CORRECT', earnedMicro: valid.maxMicro, maxMicro: valid.maxMicro }
            : { outcome: 'INCORRECT', earnedMicro: 0n, maxMicro: valid.maxMicro };
    },
});
