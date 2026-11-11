import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { COMPOSITE_SCORING_RULE, isCompositeScore, scoreAttempt, scoreBaselineAttempt, selectedOptionOf, type ScorableQuestion } from '../src/scoring.ts';
import { V1_SINGLE_CHOICE_RULE } from '../src/question-contract.ts';
import {
    buildBaselineFrozenContent, buildEssayFrozenContent, buildMatchingFrozenContent, buildMultipleResponseFrozenContent, buildNumericFrozenContent,
    buildOrderingFrozenContent, buildShortAnswerFrozenContent, buildTrueFalseFrozenContent,
} from '../src/exam-provisioning.ts';
import { isRunningInstitutionExam } from '../src/essay-grading.ts';
import { finalItems, finalQuestions, provisionalItems, provisionalQuestions, typeCodeOfContent, typeCodeOfRule } from '../src/teacher-results.ts';
import { baselineQuestion } from './support/fixtures.ts';

// RESULT-004 units (record §5, C01): the content-key and frozen-rule type code maps, the item projection
// from a provisional baseline score, a provisional composite score and frozen outcomes matched by
// questionSnapshotId with the §4.3 micro-point invariants, and the E6/E7 predicate over every lifecycle
// state and both exam kinds. The golden content G and the participants x1..x8 of §5 are scored here by
// the production scoring, so the hand-computed vectors are checked before they reach PostgreSQL.

const M = 1_000_000;
let n = 0;
const ids = () => `opt_${String(++n).padStart(4, '0')}`;

/** Golden content G (§5), in display order, with its snapshot ids. */
function golden() {
    const contents = [
        buildBaselineFrozenContent({ prompt: 'Ibu kota Indonesia adalah', options: ['Bandung', 'Jakarta', 'Surabaya', 'Medan', 'Makassar'], correctIndex: 1, maxScore: 2 }, ids),
        buildMultipleResponseFrozenContent({ prompt: 'Bilangan prima adalah', options: ['2', '4', '5', '8', '9'], correctIndexes: [0, 2], maxScore: 3 }, ids),
        buildTrueFalseFrozenContent({ prompt: 'Matahari terbit di timur', correctValue: true, maxScore: 1 }),
        buildMatchingFrozenContent({ prompt: 'Pasangkan', leftItems: ['L1', 'L2', 'L3'], rightItems: ['R1', 'R2', 'R3', 'R4'], correctPairIndexes: [1, 0, 3], maxScore: 4 }, ids),
        buildOrderingFrozenContent({ prompt: 'Urutkan', items: ['I1', 'I2', 'I3'], correctSequence: [1, 2, 0], maxScore: 2 }, ids),
        buildNumericFrozenContent({ prompt: 'Hasil dari 5 dibagi 2 adalah', key: '2,5', tolerance: '0,1', maxScore: 2 }),
        buildShortAnswerFrozenContent({ prompt: 'Sebutkan ibu kota Indonesia', acceptedForms: ['Jakarta'], rubric: '', maxScore: 1 }),
        buildShortAnswerFrozenContent({ prompt: 'Sebutkan satu monumen', acceptedForms: [], rubric: 'Nilai sesuai jawaban.', maxScore: 2 }),
        buildEssayFrozenContent({ prompt: 'Mengapa hutan penting?', rubric: 'Sebutkan dua alasan.', maxScore: 5 }),
    ];
    const questions: ScorableQuestion[] = contents.map((frozenContent, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, frozenContent }));
    const c = contents as Array<Record<string, any>>;
    const opt = (q: number, letter: string) => c[q].options['ABCDE'.indexOf(letter)].id as string;
    const left = (i: number) => c[3].leftItems[i].id as string;
    const right = (i: number) => c[3].rightItems[i].id as string;
    const item = (i: number) => c[4].items[i].id as string;
    return { questions, opt, left, right, item, id: (no: number) => questions[no - 1].id };
}

const G = golden();
/** Answers of x1..x8 (§5) by display number; grades in micro-points by display number. */
function answersOf(who: string): { answers: Map<string, unknown>; grades: Map<string, bigint> } {
    const a = new Map<number, unknown>();
    const g = new Map<number, number>();
    const correctPairs = [{ leftId: G.left(0), rightId: G.right(1) }, { leftId: G.left(1), rightId: G.right(0) }, { leftId: G.left(2), rightId: G.right(3) }];
    switch (who) {
        case 'x1':
            a.set(1, { selectedOptionId: G.opt(0, 'B') }).set(2, { selectedOptionIds: [G.opt(1, 'A'), G.opt(1, 'C')] }).set(3, { value: true })
                .set(4, { pairs: correctPairs }).set(5, { orderedItemIds: [G.item(1), G.item(2), G.item(0)] }).set(6, { numericText: '2,5' })
                .set(7, { shortText: 'Jakarta' }).set(8, { shortText: 'Monas' }).set(9, { essayText: 'Udara bersih dan air.' });
            g.set(8, 2 * M).set(9, 5 * M);
            break;
        case 'x2':
            a.set(1, { selectedOptionId: G.opt(0, 'B') }).set(2, { selectedOptionIds: [G.opt(1, 'A')] }).set(3, { value: false })
                .set(4, { pairs: [correctPairs[0], { leftId: G.left(1), rightId: G.right(2) }, correctPairs[2]] })
                .set(5, { orderedItemIds: [G.item(2), G.item(1), G.item(0)] }).set(6, { numericText: '2,6' }).set(7, { shortText: '  jakarta ' })
                .set(8, { shortText: 'Monas' }).set(9, { essayText: 'Udara.' });
            g.set(8, 0).set(9, 2.5 * M);
            break;
        case 'x3':
            a.set(2, { selectedOptionIds: [] }).set(3, { value: 'true' }).set(4, { pairs: [] }).set(5, { orderedItemIds: [] }).set(6, { numericText: '' })
                .set(7, { shortText: '' }).set(8, { shortText: '' }).set(9, { essayText: '' });
            break;
        case 'x4':
            a.set(2, { selectedOptionIds: [G.opt(1, 'A'), G.opt(1, 'C')] }).set(6, { numericText: '2,61' }).set(7, { shortText: '   ' }).set(9, { essayText: 'Hutan menyimpan air.' });
            g.set(9, 4 * M);
            break;
        case 'x6':
            a.set(1, { selectedOptionId: G.opt(0, 'B') });
            break;
        case 'x7':
            a.set(3, { value: true });
            break;
        case 'x8':
            a.set(1, { selectedOptionId: G.opt(0, 'A') }).set(4, { pairs: correctPairs.slice(0, 2) }).set(7, { shortText: 'Bandung' })
                .set(8, { shortText: '   ' }).set(9, { essayText: '   ' });
            g.set(8, 0).set(9, 0);
            break;
    }
    return {
        answers: new Map([...a].map(([no, payload]) => [G.id(no), payload])),
        grades: new Map([...g].map(([no, micro]) => [G.id(no), BigInt(micro)])),
    };
}

const C = 'CORRECT', I = 'INCORRECT', U = 'UNANSWERED', GR = 'GRADED', P = 'UNGRADED';
/** §5: FINAL per-item outcomes, points and totals. */
const FINAL: Record<string, { outcomes: string[]; points: number[]; raw: number; scaled: number; counts: [number, number, number, number] }> = {
    x1: { outcomes: [C, C, C, C, C, C, C, GR, GR], points: [2, 3, 1, 4, 2, 2, 1, 2, 5], raw: 22, scaled: 100, counts: [7, 0, 0, 2] },
    x2: { outcomes: [C, I, I, I, I, C, C, GR, GR], points: [2, 0, 0, 0, 0, 2, 1, 0, 2.5], raw: 7.5, scaled: 34.09, counts: [3, 4, 0, 2] },
    x3: { outcomes: [U, U, U, U, U, U, U, U, U], points: [0, 0, 0, 0, 0, 0, 0, 0, 0], raw: 0, scaled: 0, counts: [0, 0, 9, 0] },
    x4: { outcomes: [U, C, U, U, U, I, I, U, GR], points: [0, 3, 0, 0, 0, 0, 0, 0, 4], raw: 7, scaled: 31.82, counts: [1, 2, 5, 1] },
    x6: { outcomes: [C, U, U, U, U, U, U, U, U], points: [2, 0, 0, 0, 0, 0, 0, 0, 0], raw: 2, scaled: 9.09, counts: [1, 0, 8, 0] },
    x7: { outcomes: [U, U, C, U, U, U, U, U, U], points: [0, 0, 1, 0, 0, 0, 0, 0, 0], raw: 1, scaled: 4.55, counts: [1, 0, 8, 0] },
    x8: { outcomes: [I, U, U, U, U, U, I, GR, GR], points: [0, 0, 0, 0, 0, 0, 0, 0, 0], raw: 0, scaled: 0, counts: [0, 2, 5, 2] },
};

const noBySnapshot = new Map(G.questions.map((q, i) => [q.id, i + 1]));

/** The §4.3 invariants of one scored row, in micro-points. */
function assertInvariants(items: Array<{ outcome: string; score: number }>, raw: number, counts: { correct: number; incorrect: number; unanswered: number; graded: number; ungraded: number }) {
    assert.equal(items.reduce((sum, i) => sum + Math.round(i.score * M), 0), Math.round(raw * M), 'the items sum to the raw score');
    const count = (o: string) => items.filter(i => i.outcome === o).length;
    assert.deepEqual([count(C), count(I), count(U), count(GR), count(P)], [counts.correct, counts.incorrect, counts.unanswered, counts.graded, counts.ungraded]);
}

test('C01 the content key to type code map: all eight keys and the manual short answer', () => {
    assert.deepEqual(G.questions.map(q => typeCodeOfContent(q.frozenContent)), ['PG', 'PGK', 'BS', 'MJ', 'UR', 'IA', 'IS', 'IS', 'ES']);
    assert.equal(typeCodeOfContent(baselineQuestion(1)), 'PG', 'a v1 snapshot is PG');
    assert.throws(() => typeCodeOfContent({ schemaVersion: 2, questionType: 'DRAWING', prompt: 'x', maxScore: 1 }), /no type code/);
    assert.throws(() => typeCodeOfContent(null), /no type code/);
});

test('C01 the frozen ruleId to type code map, including an entry without ruleId', () => {
    assert.deepEqual([
        undefined, V1_SINGLE_CHOICE_RULE, 'MULTIPLE_RESPONSE_EXACT_SET_V1', 'TRUE_FALSE_EXACT_V1', 'MATCHING_EXACT_PAIRS_V1', 'ORDERING_EXACT_SEQUENCE_V1',
        'NUMERIC_EXACT_DECIMAL_TOLERANCE_V1', 'SHORT_ANSWER_ACCEPTED_FORMS_V1', 'ESSAY_HUMAN_GRADED_V1',
    ].map(typeCodeOfRule), ['PG', 'PG', 'PGK', 'BS', 'MJ', 'UR', 'IA', 'IS', 'ES']);
    assert.throws(() => typeCodeOfRule('UNKNOWN_RULE_V9'), /unknown rule/);
});

test('C01 the projection from a provisional baseline score (all-v1 exam)', () => {
    const questions: ScorableQuestion[] = [1, 2].map(i => ({ id: `00000000-0000-4000-8000-0000000001${i}0`, frozenContent: baselineQuestion(i) }));
    const scored = scoreBaselineAttempt(questions, new Map([[questions[0].id, { selectedOptionId: 'B' }]]));
    assert.equal(scored.type, 'scored');
    if (scored.type !== 'scored') return;
    assert.deepEqual(provisionalQuestions(questions, scored.score), [{ no: 1, typeCode: 'PG', maxScore: 1 }, { no: 2, typeCode: 'PG', maxScore: 1 }]);
    const items = provisionalItems(scored.score, new Map(questions.map((q, i) => [q.id, i + 1])));
    assert.deepEqual(items, [{ no: 1, outcome: C, score: 1 }, { no: 2, outcome: U, score: 0 }]);
    assertInvariants(items, scored.score.rawScore, { ...scored.score, graded: 0, ungraded: 0 });
});

test('C01 G-1 provisional composite projection over the golden content: questions, items and the §4.3 invariants', () => {
    const probe = scoreAttempt(G.questions, new Map());
    assert.equal(probe.type, 'scored');
    if (probe.type !== 'scored' || !isCompositeScore(probe.score)) throw new Error('composite expected');
    const questions = provisionalQuestions(G.questions, probe.score);
    assert.deepEqual(questions.map(q => [q.no, q.typeCode, q.maxScore]),
        [[1, 'PG', 2], [2, 'PGK', 3], [3, 'BS', 1], [4, 'MJ', 4], [5, 'UR', 2], [6, 'IA', 2], [7, 'IS', 1], [8, 'IS', 2], [9, 'ES', 5]]);
    assert.equal(questions.reduce((s, q) => s + Math.round(q.maxScore * M), 0), Number(probe.score.maxScoreMicro), 'the maxima sum to the exam maximum');
    assert.equal(probe.score.maxScore, 22);

    // Provisional with x4 and x8 ungraded (G-1): their teacher-graded items are UNGRADED with 0.
    const provisional: Record<string, { outcomes: string[]; raw: number; scaled: number; ungraded: number }> = {
        x4: { outcomes: [U, C, U, U, U, I, I, U, P], raw: 3, scaled: 13.64, ungraded: 1 },
        x8: { outcomes: [I, U, U, U, U, U, I, P, P], raw: 0, scaled: 0, ungraded: 2 },
    };
    for (const [who, expected] of Object.entries(provisional)) {
        const { answers } = answersOf(who);
        const scored = scoreAttempt(G.questions, answers);
        if (scored.type !== 'scored' || !isCompositeScore(scored.score)) throw new Error('composite expected');
        const items = provisionalItems(scored.score, noBySnapshot);
        assert.deepEqual(items.map(i => i.outcome), expected.outcomes, who);
        assert.deepEqual([scored.score.rawScore, scored.score.scaledScore, scored.score.ungradedCount], [expected.raw, expected.scaled, expected.ungraded], who);
        assert.ok(items.filter(i => i.outcome === P).every(i => i.score === 0), 'UNGRADED earns 0');
        assertInvariants(items, scored.score.rawScore, { ...scored.score, graded: scored.score.gradedCount, ungraded: scored.score.ungradedCount });
    }

    // With every grade (G-3), each participant's per-item outcomes, points and totals are the §5 table.
    for (const [who, expected] of Object.entries(FINAL)) {
        const { answers, grades } = answersOf(who);
        const scored = scoreAttempt(G.questions, answers, undefined, grades);
        if (scored.type !== 'scored' || !isCompositeScore(scored.score)) throw new Error('composite expected');
        assert.equal(scored.score.rule, COMPOSITE_SCORING_RULE);
        const items = provisionalItems(scored.score, noBySnapshot);
        assert.deepEqual(items.map(i => i.outcome), expected.outcomes, `${who} outcomes`);
        assert.deepEqual(items.map(i => i.score), expected.points, `${who} points`);
        assert.deepEqual(items.map(i => i.no), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
        assert.deepEqual([scored.score.rawScore, scored.score.maxScore, scored.score.scaledScore], [expected.raw, 22, expected.scaled], `${who} totals`);
        assert.deepEqual([scored.score.correct, scored.score.incorrect, scored.score.unanswered, scored.score.gradedCount, scored.score.ungradedCount], [...expected.counts, 0], `${who} counts`);
        assertInvariants(items, scored.score.rawScore, { correct: scored.score.correct, incorrect: scored.score.incorrect, unanswered: scored.score.unanswered, graded: scored.score.gradedCount, ungraded: 0 });
    }
});

test('C01 the FINAL projection from frozen outcomes, matched by questionSnapshotId, never recomputed', () => {
    // Frozen exactly as result-finalization.ts writes composite item outcomes.
    const freeze = (who: string) => {
        const { answers, grades } = answersOf(who);
        const scored = scoreAttempt(G.questions, answers, undefined, grades);
        if (scored.type !== 'scored' || !isCompositeScore(scored.score)) throw new Error('composite expected');
        return scored.score.items.map(item => ({
            questionSnapshotId: item.questionSnapshotId,
            ruleId: item.ruleId,
            ...(item.ruleId === V1_SINGLE_CHOICE_RULE ? { selectedOptionId: selectedOptionOf(answers.get(item.questionSnapshotId)) } : {}),
            outcome: item.outcome as string,
            scoreMicro: Number(item.scoreMicro),
            maxScoreMicro: Number(item.maxScoreMicro),
            ...(item.outcome === 'GRADED' ? { gradeRevision: 1 } : {}),
        }));
    };
    const x2 = freeze('x2');
    const questions = finalQuestions(x2);
    assert.deepEqual(questions.map(q => [q.no, q.typeCode, q.maxScore]),
        [[1, 'PG', 2], [2, 'PGK', 3], [3, 'BS', 1], [4, 'MJ', 4], [5, 'UR', 2], [6, 'IA', 2], [7, 'IS', 1], [8, 'IS', 2], [9, 'ES', 5]]);
    assert.equal(questions.reduce((s, q) => s + Math.round(q.maxScore * M), 0), 22 * M);
    const frozenNo = new Map(x2.map((item, i) => [item.questionSnapshotId, i + 1]));
    for (const who of Object.keys(FINAL)) {
        const frozen = freeze(who);
        // Another row in a different stored order still matches by snapshot id.
        const items = finalItems([...frozen].reverse(), frozenNo);
        assert.deepEqual(items.map(i => [i.no, i.outcome, i.score]), FINAL[who].outcomes.map((o, k) => [k + 1, o, FINAL[who].points[k]]), who);
        const [correct, incorrect, unanswered, graded] = FINAL[who].counts;
        assertInvariants(items, FINAL[who].raw, { correct, incorrect, unanswered, graded, ungraded: 0 });
    }
    // The frozen maxima and order win over the current snapshots (T-2): a changed maxScore is not read.
    const tampered = x2.map((item, i) => (i === 0 ? { ...item, maxScoreMicro: 2 * M } : item));
    assert.equal(finalQuestions(tampered)[0].maxScore, 2);
    // A v1-only finalization has no ruleId and gives PG.
    assert.deepEqual(finalQuestions([{ questionSnapshotId: 'a', selectedOptionId: 'B', outcome: C, scoreMicro: M, maxScoreMicro: M }]), [{ no: 1, typeCode: 'PG', maxScore: 1 }]);
    assert.throws(() => finalItems([{ questionSnapshotId: 'elsewhere', outcome: C, scoreMicro: 0, maxScoreMicro: M }], frozenNo), /no question/);
});

test('C01 the E6/E7 predicate over every lifecycle state and both exam kinds', () => {
    const states = ['DRAFT', 'SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'CANCELLED', 'ARCHIVED'];
    const session = '7a1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
    for (const state of states) {
        assert.equal(isRunningInstitutionExam(session, state), state === 'ACTIVE' || state === 'PAUSED', `institution ${state}`);
        assert.equal(isRunningInstitutionExam(null, state), false, `teacher-managed ${state}`);
        assert.equal(isRunningInstitutionExam(undefined, state), false, `teacher-managed (no column) ${state}`);
    }
    assert.equal(isRunningInstitutionExam('', 'ACTIVE'), false);
});
