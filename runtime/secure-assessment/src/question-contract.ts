import { isAnswerForQuestion } from './answer.ts';
import { validateBaselineQuestionSnapshotFrozenContent } from './question-snapshot-baseline-frozen-content-contract.ts';
import { MULTIPLE_RESPONSE_DESCRIPTOR } from './question-types/multiple-response.ts';
import { MATCHING_DESCRIPTOR } from './question-types/matching.ts';
import { NUMERIC_ANSWER_DESCRIPTOR } from './question-types/numeric-answer.ts';
import { ORDERING_DESCRIPTOR } from './question-types/ordering.ts';
import { TRUE_FALSE_DESCRIPTOR } from './question-types/true-false.ts';

// Versioned question/answer/scoring contract (ASSESS-QUESTION-001, A01-1/A01-2/A01-4, O02-2).
//
// A frozen question is identified by its content key "<schemaVersion>:<questionType>".
// Version 1 is the baseline single choice and is decided only by the unchanged v1 functions;
// it is never reinterpreted. New types are written as schemaVersion 2 or higher and are handled
// only through a registered descriptor. A well-formed key that the registry in use does not
// hold, or that the client did not declare, is "unsupported": never delivered, saved or scored.

export const V1_SINGLE_CHOICE_KEY = '1:MULTIPLE_CHOICE_SINGLE';
/** Same value as scoring.ts BASELINE_SCORING_RULE (kept literal to avoid an import cycle). */
export const V1_SINGLE_CHOICE_RULE = 'BASELINE_SINGLE_CHOICE_V1';
export const QUESTION_TYPES_HEADER = 'x-question-types';

export const MAX_DECLARED_TYPES = 16;
/** Readiness blocker for invalid content of a registered version 2+ type (§5A.2). */
export const QUESTION_CONTENT_INVALID = 'question_content_invalid';
const KEY_PATTERN = /^[1-9][0-9]?:[A-Z_]{1,40}$/;
const TYPE_PATTERN = /^[A-Z_]{1,40}$/;

export type ItemOutcome = 'CORRECT' | 'INCORRECT' | 'UNANSWERED';

export interface DescriptorScore {
    outcome: ItemOutcome;
    earnedMicro: bigint;
    maxMicro: bigint;
}

export interface QuestionDescriptor {
    readonly key: string;
    readonly scoringRuleId: string;
    /** O02-2: an empty value is an accepted, versioned write that scores UNANSWERED. */
    readonly allowsEmpty: boolean;
    validateContent(content: Record<string, unknown>): { ok: true } | { ok: false };
    /** Key-free Student view; always carries schemaVersion and questionType first. */
    studentView(content: Record<string, unknown>): Record<string, unknown>;
    validateAnswer(content: Record<string, unknown>, payload: unknown): { ok: false } | { ok: true; empty: boolean };
    /** `payload` is undefined when there is no answer. Content is already valid. */
    score(content: Record<string, unknown>, payload: unknown): DescriptorScore;
}

export interface QuestionRegistry {
    get(key: string): QuestionDescriptor | undefined;
    has(key: string): boolean;
    keys(): readonly string[];
}

export function createQuestionRegistry(descriptors: readonly QuestionDescriptor[]): QuestionRegistry {
    const map = new Map<string, QuestionDescriptor>();
    for (const d of descriptors) {
        if (!KEY_PATTERN.test(d.key)) throw new Error(`invalid descriptor key ${d.key}`);
        if (map.has(d.key)) throw new Error(`duplicate descriptor key ${d.key}`);
        map.set(d.key, d);
    }
    const keys = Object.freeze([...map.keys()]);
    return { get: key => map.get(key), has: key => map.has(key), keys: () => keys };
}

const MICRO = 1_000_000;
const toMicro = (value: number): bigint => BigInt(Math.round(value * MICRO));

/** The v1 descriptor wraps the unchanged v1 validator, view, answer check and rule. */
export const V1_SINGLE_CHOICE_DESCRIPTOR: QuestionDescriptor = Object.freeze({
    key: V1_SINGLE_CHOICE_KEY,
    scoringRuleId: V1_SINGLE_CHOICE_RULE,
    allowsEmpty: false,
    validateContent(content: Record<string, unknown>) {
        return validateBaselineQuestionSnapshotFrozenContent(content).type === 'baseline_question_snapshot_content_valid' ? { ok: true as const } : { ok: false as const };
    },
    studentView(content: Record<string, unknown>) {
        const options = Array.isArray(content.options) ? content.options : [];
        return {
            schemaVersion: 1,
            questionType: 'MULTIPLE_CHOICE_SINGLE',
            prompt: content.prompt,
            options: options.map((opt: Record<string, unknown>) => ({ id: opt.id, content: opt.content })),
        };
    },
    validateAnswer(content: Record<string, unknown>, payload: unknown) {
        return isAnswerForQuestion(content, payload) ? { ok: true as const, empty: false } : { ok: false as const };
    },
    score(content: Record<string, unknown>, payload: unknown): DescriptorScore {
        const valid = validateBaselineQuestionSnapshotFrozenContent(content);
        if (valid.type !== 'baseline_question_snapshot_content_valid') throw new Error('invalid v1 content');
        const maxMicro = toMicro(valid.maxScore);
        const selected = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>)['selectedOptionId'] : undefined;
        const chosen = typeof selected === 'string' && selected.length > 0 ? selected : null;
        const outcome: ItemOutcome = chosen === null ? 'UNANSWERED' : chosen === valid.correctOptionId ? 'CORRECT' : 'INCORRECT';
        return { outcome, earnedMicro: outcome === 'CORRECT' ? maxMicro : 0n, maxMicro };
    },
});

/** v1 single choice, multiple response (ASSESS-QUESTION-002) and true/false (ASSESS-QUESTION-003). */
export const PRODUCTION_QUESTION_REGISTRY: QuestionRegistry = createQuestionRegistry([V1_SINGLE_CHOICE_DESCRIPTOR, MULTIPLE_RESPONSE_DESCRIPTOR, TRUE_FALSE_DESCRIPTOR, MATCHING_DESCRIPTOR, ORDERING_DESCRIPTOR, NUMERIC_ANSWER_DESCRIPTOR]);

export type ContentClassification =
    /** schemaVersion 1: decided only by the unchanged v1 functions. */
    | { kind: 'v1'; key: string }
    /** schemaVersion >= 2 with a key the registry holds. */
    | { kind: 'registered'; key: string; descriptor: QuestionDescriptor; content: Record<string, unknown> }
    /** schemaVersion >= 2 with a well-formed key the registry does not hold. */
    | { kind: 'unsupported'; key: string }
    /** Not an object, no usable version, or a malformed version 2+ type. */
    | { kind: 'malformed' };

/** Total, pure and deterministic. It never validates v1 or unsupported content further. */
export function classifyFrozenContent(content: unknown, registry: QuestionRegistry = PRODUCTION_QUESTION_REGISTRY): ContentClassification {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return { kind: 'malformed' };
    const record = content as Record<string, unknown>;
    const version = record['schemaVersion'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 99) return { kind: 'malformed' };
    if (version === 1) return { kind: 'v1', key: V1_SINGLE_CHOICE_KEY };
    const type = record['questionType'];
    if (typeof type !== 'string' || !TYPE_PATTERN.test(type)) return { kind: 'malformed' };
    const key = `${version}:${type}`;
    const descriptor = registry.get(key);
    return descriptor ? { kind: 'registered', key, descriptor, content: record } : { kind: 'unsupported', key };
}

/**
 * The client's declared content keys (A01-4). Absent: exactly v1, so earlier clients keep
 * working. Present: 1-16 comma-separated keys, spaces and tabs around each trimmed (Node joins a
 * repeated header with ", "), no empty, malformed or duplicate key; otherwise malformed.
 */
export function parseDeclaredQuestionTypes(value: string | string[] | undefined): { ok: true; keys: ReadonlySet<string> } | { ok: false } {
    if (value === undefined) return { ok: true, keys: new Set([V1_SINGLE_CHOICE_KEY]) };
    const joined = Array.isArray(value) ? value.join(',') : value;
    const tokens = joined.split(',').map(t => t.replace(/^[ \t]+|[ \t]+$/g, ''));
    if (tokens.length < 1 || tokens.length > MAX_DECLARED_TYPES) return { ok: false };
    const keys = new Set<string>();
    for (const token of tokens) {
        if (!KEY_PATTERN.test(token) || keys.has(token)) return { ok: false };
        keys.add(token);
    }
    return { ok: true, keys };
}

/** Declared keys the registry in use can actually handle. */
export function effectiveSupport(declared: ReadonlySet<string>, registry: QuestionRegistry = PRODUCTION_QUESTION_REGISTRY): ReadonlySet<string> {
    return new Set([...declared].filter(key => registry.has(key)));
}
