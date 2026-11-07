import { validateBaselineQuestionSnapshotFrozenContent } from './question-snapshot-baseline-frozen-content-contract.ts';
import { classifyFrozenContent, PRODUCTION_QUESTION_REGISTRY, type QuestionRegistry } from './question-contract.ts';

// Baseline objective scoring (D04.8-01/03/04/06/07, D04.3-47/49/50/57/58/59).
//
// Rule BASELINE_SINGLE_CHOICE_V1, applied to the frozen question snapshots:
// - a question answered with its correct option earns its maximum score; a different
//   option or no answer earns 0 (no negative marking, D04.3-49; unanswered is 0 for the
//   attempt, D04.8-07);
// - raw score = sum of earned scores; maximum = sum of the questions' maximum scores;
// - display score = raw / maximum x 100, rounded half up to two decimals (82.222 -> 82.22).
// Scores are summed as integer micro-points, so the result is exact and reproducible from
// the snapshots and the accepted answers alone (D04.8-56). A participant who never started
// has no score at all: absent is not zero (D04.4-12).

export const BASELINE_SCORING_RULE = 'BASELINE_SINGLE_CHOICE_V1';

export type ItemOutcome = 'CORRECT' | 'INCORRECT' | 'UNANSWERED';

export interface ScoredItem {
    questionSnapshotId: string;
    outcome: ItemOutcome;
    score: number;
    maxScore: number;
}

export interface AttemptScore {
    rule: typeof BASELINE_SCORING_RULE;
    items: ScoredItem[];
    correct: number;
    incorrect: number;
    unanswered: number;
    rawScore: number;
    maxScore: number;
    /** 0 to 100, two decimals, half up. */
    scaledScore: number;
}

export type ScoringResult =
    | { type: 'scored'; score: AttemptScore }
    | { type: 'unscorable'; reason: 'no_questions' }
    | { type: 'unscorable'; reason: 'invalid_question'; questionSnapshotId: string };

export interface ScorableQuestion {
    id: string;
    frozenContent: unknown;
}

const MICRO = 1_000_000;

function toMicro(value: number): bigint {
    return BigInt(Math.round(value * MICRO));
}

function fromMicro(value: bigint): number {
    return Number(value) / MICRO;
}

/** The option a stored answer selected, or null when it selects none. */
export function selectedOptionOf(answerPayload: unknown): string | null {
    if (!answerPayload || typeof answerPayload !== 'object' || Array.isArray(answerPayload)) return null;
    const selected = (answerPayload as Record<string, unknown>)['selectedOptionId'];
    return typeof selected === 'string' && selected.length > 0 ? selected : null;
}

/** raw / max x 100 rounded half up to hundredths, computed exactly. */
export function scaleToHundred(rawMicro: bigint, maxMicro: bigint): number {
    const hundredths = (rawMicro * 20000n + maxMicro) / (2n * maxMicro);
    return Number(hundredths) / 100;
}

export function scoreBaselineAttempt(questions: readonly ScorableQuestion[], answers: ReadonlyMap<string, unknown>): ScoringResult {
    if (questions.length === 0) return { type: 'unscorable', reason: 'no_questions' };
    const items: ScoredItem[] = [];
    let rawMicro = 0n;
    let maxMicro = 0n;
    for (const question of questions) {
        const content = validateBaselineQuestionSnapshotFrozenContent(question.frozenContent);
        if (content.type !== 'baseline_question_snapshot_content_valid') {
            return { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: question.id };
        }
        const max = toMicro(content.maxScore);
        if (max <= 0n) return { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: question.id };
        const selected = selectedOptionOf(answers.get(question.id));
        const outcome: ItemOutcome = selected === null ? 'UNANSWERED' : selected === content.correctOptionId ? 'CORRECT' : 'INCORRECT';
        const earned = outcome === 'CORRECT' ? max : 0n;
        rawMicro += earned;
        maxMicro += max;
        items.push({ questionSnapshotId: question.id, outcome, score: fromMicro(earned), maxScore: fromMicro(max) });
    }
    const count = (outcome: ItemOutcome) => items.filter(item => item.outcome === outcome).length;
    return {
        type: 'scored',
        score: {
            rule: BASELINE_SCORING_RULE,
            items,
            correct: count('CORRECT'),
            incorrect: count('INCORRECT'),
            unanswered: count('UNANSWERED'),
            rawScore: fromMicro(rawMicro),
            maxScore: fromMicro(maxMicro),
            scaledScore: scaleToHundred(rawMicro, maxMicro),
        },
    };
}

// ASSESS-QUESTION-001 (A01-2). An exam with no registered version 2+ question is scored
// exactly by scoreBaselineAttempt, so every exam that exists today keeps its result. Otherwise
// each item is scored by its own descriptor and rule, and the attempt carries the composite
// rule; totals stay bigint micro-points and are scaled with scaleToHundred.
export const COMPOSITE_SCORING_RULE = 'COMPOSITE_PER_ITEM_V1';

export interface CompositeScoredItem extends ScoredItem {
    ruleId: string;
    scoreMicro: bigint;
    maxScoreMicro: bigint;
}

export interface CompositeAttemptScore {
    rule: typeof COMPOSITE_SCORING_RULE;
    items: CompositeScoredItem[];
    correct: number;
    incorrect: number;
    unanswered: number;
    rawScore: number;
    maxScore: number;
    rawScoreMicro: bigint;
    maxScoreMicro: bigint;
    scaledScore: number;
}

export type VersionedScoringResult = ScoringResult | { type: 'scored'; score: CompositeAttemptScore };

export function isCompositeScore(score: AttemptScore | CompositeAttemptScore): score is CompositeAttemptScore {
    return score.rule === COMPOSITE_SCORING_RULE;
}

export function scoreAttempt(questions: readonly ScorableQuestion[], answers: ReadonlyMap<string, unknown>, registry: QuestionRegistry = PRODUCTION_QUESTION_REGISTRY): VersionedScoringResult {
    const kinds = questions.map(q => classifyFrozenContent(q.frozenContent, registry));
    if (!kinds.some(k => k.kind === 'registered')) return scoreBaselineAttempt(questions, answers);
    const items: CompositeScoredItem[] = [];
    let rawMicro = 0n;
    let maxMicro = 0n;
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i], kind = kinds[i];
        let descriptor;
        let content: Record<string, unknown>;
        if (kind.kind === 'registered') {
            descriptor = kind.descriptor; content = kind.content;
            if (!descriptor.validateContent(content).ok) return { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: question.id };
        } else if (kind.kind === 'v1') {
            descriptor = registry.get(kind.key);
            content = question.frozenContent as Record<string, unknown>;
            if (!descriptor || !descriptor.validateContent(content).ok) return { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: question.id };
        } else {
            return { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: question.id };
        }
        const scored = descriptor.score(content, answers.get(question.id));
        if (scored.maxMicro <= 0n) return { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: question.id };
        rawMicro += scored.earnedMicro;
        maxMicro += scored.maxMicro;
        items.push({
            questionSnapshotId: question.id, ruleId: descriptor.scoringRuleId, outcome: scored.outcome,
            score: fromMicro(scored.earnedMicro), maxScore: fromMicro(scored.maxMicro), scoreMicro: scored.earnedMicro, maxScoreMicro: scored.maxMicro,
        });
    }
    const count = (outcome: ItemOutcome) => items.filter(item => item.outcome === outcome).length;
    return {
        type: 'scored',
        score: {
            rule: COMPOSITE_SCORING_RULE, items,
            correct: count('CORRECT'), incorrect: count('INCORRECT'), unanswered: count('UNANSWERED'),
            rawScore: fromMicro(rawMicro), maxScore: fromMicro(maxMicro), rawScoreMicro: rawMicro, maxScoreMicro: maxMicro,
            scaledScore: scaleToHundred(rawMicro, maxMicro),
        },
    };
}
