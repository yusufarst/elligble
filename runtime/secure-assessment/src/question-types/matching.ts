import { isMeaningfulJson } from '../question-snapshot-baseline-frozen-content-contract.ts';
import type { DescriptorScore, QuestionDescriptor } from '../question-contract.ts';

// Matching, "Menjodohkan" (ASSESS-QUESTION-004 §4.1/§4A; Owner O02-5/O02-1/O02-2 and D1). Two to
// ten left items; as many right items plus at most two distractors; a hidden key pairs each left
// item with a different right item. The Student pairs left items with right items, each right
// item at most once. Every left item paired and every pair correct earns maxScore; every left
// item paired with a wrong pair earns 0 (INCORRECT); fewer pairs is not an answer yet (D1:
// UNANSWERED, 0). An empty set of pairs is an accepted versioned write that scores UNANSWERED.

export const MATCHING_KEY = '2:MATCHING';
export const MATCHING_TYPE = 'MATCHING';
export const MATCHING_RULE = 'MATCHING_EXACT_PAIRS_V1';
export const MATCHING_MIN_LEFT = 2;
export const MATCHING_MAX_LEFT = 10;
export const MATCHING_MAX_DISTRACTORS = 2;

const MICRO = 1_000_000;

interface Item { id: string; content: unknown }

function itemsOf(value: unknown, min: number, max: number, ids: Set<string>): Item[] | null {
    if (!Array.isArray(value) || value.length < min || value.length > max) return null;
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const id = (item as Record<string, unknown>)['id'];
        if (typeof id !== 'string' || id.trim().length === 0 || ids.has(id)) return null;
        if (!isMeaningfulJson((item as Record<string, unknown>)['content'])) return null;
        ids.add(id);
    }
    return value as Item[];
}

/** The left and right items of content, with ids unique across both lists, or null. */
function sidesOf(content: Record<string, unknown>): { left: Item[]; right: Item[] } | null {
    const ids = new Set<string>();
    const left = itemsOf(content['leftItems'], MATCHING_MIN_LEFT, MATCHING_MAX_LEFT, ids);
    if (!left) return null;
    const right = itemsOf(content['rightItems'], left.length, left.length + MATCHING_MAX_DISTRACTORS, ids);
    return right ? { left, right } : null;
}

/**
 * A pair list as a map from left id to right id: an array of at most `max` objects with exactly
 * the keys leftId and rightId, known ids, no left and no right id twice. Otherwise null.
 */
function pairsOf(value: unknown, left: ReadonlySet<string>, right: ReadonlySet<string>, max: number): Map<string, string> | null {
    if (!Array.isArray(value) || value.length > max) return null;
    const pairs = new Map<string, string>();
    const usedRight = new Set<string>();
    for (const pair of value) {
        if (!pair || typeof pair !== 'object' || Array.isArray(pair)) return null;
        const keys = Object.keys(pair);
        if (keys.length !== 2 || !keys.includes('leftId') || !keys.includes('rightId')) return null;
        const leftId = (pair as Record<string, unknown>)['leftId'];
        const rightId = (pair as Record<string, unknown>)['rightId'];
        if (typeof leftId !== 'string' || typeof rightId !== 'string') return null;
        if (!left.has(leftId) || !right.has(rightId) || pairs.has(leftId) || usedRight.has(rightId)) return null;
        pairs.set(leftId, rightId);
        usedRight.add(rightId);
    }
    return pairs;
}

function validContent(content: Record<string, unknown>): { left: Item[]; right: Item[]; correct: Map<string, string>; maxMicro: bigint } | null {
    if (content['schemaVersion'] !== 2 || content['questionType'] !== MATCHING_TYPE) return null;
    if (!isMeaningfulJson(content['prompt'])) return null;
    const sides = sidesOf(content);
    if (!sides) return null;
    const leftIds = new Set(sides.left.map(i => i.id));
    const correct = pairsOf(content['correctPairs'], leftIds, new Set(sides.right.map(i => i.id)), sides.left.length);
    if (!correct || correct.size !== sides.left.length) return null;
    const maxScore = content['maxScore'];
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { ...sides, correct, maxMicro: BigInt(Math.round(maxScore * MICRO)) };
}

const view = (items: unknown) => (Array.isArray(items) ? items as Array<Record<string, unknown>> : []).map(i => ({ id: i['id'], content: i['content'] }));

export const MATCHING_DESCRIPTOR: QuestionDescriptor = Object.freeze({
    key: MATCHING_KEY,
    scoringRuleId: MATCHING_RULE,
    allowsEmpty: true,
    validateContent(content: Record<string, unknown>) {
        return validContent(content) ? { ok: true as const } : { ok: false as const };
    },
    studentView(content: Record<string, unknown>) {
        return {
            schemaVersion: 2,
            questionType: MATCHING_TYPE,
            prompt: content['prompt'],
            leftItems: view(content['leftItems']),
            rightItems: view(content['rightItems']),
        };
    },
    validateAnswer(content: Record<string, unknown>, payload: unknown) {
        const sides = sidesOf(content);
        if (!sides || !payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false as const };
        const keys = Object.keys(payload);
        if (keys.length !== 1 || keys[0] !== 'pairs') return { ok: false as const };
        const pairs = pairsOf((payload as Record<string, unknown>)['pairs'], new Set(sides.left.map(i => i.id)), new Set(sides.right.map(i => i.id)), sides.left.length);
        return pairs ? { ok: true as const, empty: pairs.size === 0 } : { ok: false as const };
    },
    score(content: Record<string, unknown>, payload: unknown): DescriptorScore {
        const valid = validContent(content);
        if (!valid) throw new Error('invalid matching content');
        const raw = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>)['pairs'] : undefined;
        // A stored value that is not a valid answer scores like no answer; so does an incomplete one (D1).
        const pairs = pairsOf(raw, new Set(valid.left.map(i => i.id)), new Set(valid.right.map(i => i.id)), valid.left.length);
        if (!pairs || pairs.size < valid.left.length) return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: valid.maxMicro };
        const exact = [...pairs].every(([leftId, rightId]) => valid.correct.get(leftId) === rightId);
        return exact
            ? { outcome: 'CORRECT', earnedMicro: valid.maxMicro, maxMicro: valid.maxMicro }
            : { outcome: 'INCORRECT', earnedMicro: 0n, maxMicro: valid.maxMicro };
    },
});
