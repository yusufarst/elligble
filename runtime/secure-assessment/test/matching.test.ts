import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyFrozenContent, PRODUCTION_QUESTION_REGISTRY } from '../src/question-contract.ts';
import { checkAnswerForContent } from '../src/answer.ts';
import { MATCHING_DESCRIPTOR, MATCHING_KEY, MATCHING_RULE } from '../src/question-types/matching.ts';
import { COMPOSITE_SCORING_RULE, scoreAttempt } from '../src/scoring.ts';
import { buildImportedFrozenContent } from '../src/exam-provisioning.ts';
import { QUESTIONS_HEADER_V2_EXTENDED, describeQuestionProblem, parseQuestionFile } from '../src/question-import.ts';

// ASSESS-QUESTION-004 units (record §4/§4A/§5, C01/C02): descriptor vectors M1–M8 with Owner
// decision D1 (an incomplete answer is UNANSWERED), the mixed vector, the MJ import vectors and
// the frozen problem shapes and wording.

const items = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, content: `${prefix === 'L' ? 'Kiri' : 'Kanan'} ${i + 1}` }));
const mj = (extra: Record<string, unknown> = {}) => ({
    schemaVersion: 2, questionType: 'MATCHING', prompt: 'Pasangkan', leftItems: items('L', 3), rightItems: items('R', 4),
    correctPairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L2', rightId: 'R3' }, { leftId: 'L3', rightId: 'R1' }], maxScore: 3, ...extra,
});
const pair = (leftId: string, rightId: string) => ({ leftId, rightId });
const SUPPORTED = new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', MATCHING_KEY]);
const score = (payload: unknown) => MATCHING_DESCRIPTOR.score(mj(), payload);
const outcome = (payload: unknown) => { const s = score(payload); return [s.outcome, s.earnedMicro]; };

test('C01 registration, rule and classification', () => {
    assert.deepEqual(PRODUCTION_QUESTION_REGISTRY.keys(), ['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', MATCHING_KEY, '2:ORDERING', '2:NUMERIC_ANSWER', '2:ESSAY']);
    assert.equal(classifyFrozenContent(mj()).kind, 'registered');
    assert.equal(MATCHING_DESCRIPTOR.scoringRuleId, MATCHING_RULE);
    assert.equal(MATCHING_RULE, 'MATCHING_EXACT_PAIRS_V1');
    assert.equal(MATCHING_DESCRIPTOR.allowsEmpty, true);
});

test('C01 vectors M1–M6: exact pairs, order-free, swapped, incomplete (D1), empty, none', () => {
    const exact = [pair('L1', 'R2'), pair('L2', 'R3'), pair('L3', 'R1')];
    assert.equal(checkAnswerForContent(mj(), { pairs: exact }, SUPPORTED), 'valid');
    assert.deepEqual(outcome({ pairs: exact }), ['CORRECT', 3_000_000n], 'M1');
    assert.deepEqual(outcome({ pairs: [...exact].reverse() }), ['CORRECT', 3_000_000n], 'M2 order carries no meaning');
    const swapped = [pair('L1', 'R3'), pair('L2', 'R2'), pair('L3', 'R1')];
    assert.equal(checkAnswerForContent(mj(), { pairs: swapped }, SUPPORTED), 'valid');
    assert.deepEqual(outcome({ pairs: swapped }), ['INCORRECT', 0n], 'M3');
    const partial = [pair('L1', 'R2'), pair('L2', 'R3')];
    assert.equal(checkAnswerForContent(mj(), { pairs: partial }, SUPPORTED), 'valid', 'M4 is saved');
    assert.deepEqual(outcome({ pairs: partial }), ['UNANSWERED', 0n], 'M4 incomplete is not an answer yet (D1)');
    assert.equal(MATCHING_DESCRIPTOR.validateAnswer(mj(), { pairs: [] }).ok, true);
    assert.deepEqual(MATCHING_DESCRIPTOR.validateAnswer(mj(), { pairs: [] }), { ok: true, empty: true }, 'M5 empty');
    assert.deepEqual(MATCHING_DESCRIPTOR.validateAnswer(mj(), { pairs: partial }), { ok: true, empty: false });
    assert.deepEqual(outcome({ pairs: [] }), ['UNANSWERED', 0n], 'M5');
    assert.deepEqual(outcome(undefined), ['UNANSWERED', 0n], 'M6');
    assert.equal(checkAnswerForContent(mj(), { pairs: exact }, new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE'])), 'unsupported', 'a client that does not declare matching');
});

test('C01 vector M7: refusals', () => {
    const bad: unknown[] = [
        { pairs: [pair('L1', 'R2'), pair('L1', 'R3')] },
        { pairs: [pair('L1', 'R2'), pair('L2', 'R2')] },
        { pairs: [pair('L9', 'R2')] },
        { pairs: [pair('L1', 'R9')] },
        { pairs: [pair('L1', 'L2')] },
        { pairs: [{ leftId: 'L1', rightId: 'R2', extra: 1 }] },
        { pairs: [{ leftId: 'L1' }] },
        { pairs: [], extra: 1 },
        { pairs: 'L1:R2' },
        { pairs: [{ leftId: 1, rightId: 'R2' }] },
        { pairs: [pair('L1', 'R2'), pair('L2', 'R3'), pair('L3', 'R1'), pair('L3', 'R4')] },
        { selectedOptionIds: [] },
        [],
        {},
        null,
    ];
    for (const payload of bad) assert.equal(checkAnswerForContent(mj(), payload, SUPPORTED), 'invalid', JSON.stringify(payload));
    for (const stored of [{ pairs: 'x' }, { pairs: [pair('L1', 'R2'), pair('L2', 'R2'), pair('L3', 'R1')] }, 'x', {}]) assert.equal(score(stored).outcome, 'UNANSWERED');
});

test('C01 vector M8: invalid content; the Student view carries no key', () => {
    const cases = [
        mj({ leftItems: items('L', 1), rightItems: items('R', 1), correctPairs: [pair('L1', 'R1')] }),
        mj({ leftItems: items('L', 11), rightItems: items('R', 11), correctPairs: items('L', 11).map((l, i) => pair(l.id, `R${i + 1}`)) }),
        mj({ rightItems: items('R', 2) }),
        mj({ rightItems: items('R', 6) }),
        mj({ leftItems: [{ id: 'L1', content: 'a' }, { id: 'L1', content: 'b' }, { id: 'L3', content: 'c' }] }),
        mj({ leftItems: [{ id: ' ', content: 'a' }, ...items('L', 3).slice(1)] }),
        mj({ rightItems: [{ id: 'L1', content: 'x' }, ...items('R', 4).slice(1)] }),
        mj({ leftItems: [{ id: 'L1', content: '' }, ...items('L', 3).slice(1)] }),
        mj({ correctPairs: [pair('L1', 'R2'), pair('L2', 'R3')] }),
        mj({ correctPairs: [pair('L1', 'R2'), pair('L2', 'R2'), pair('L3', 'R1')] }),
        mj({ correctPairs: [pair('L1', 'R2'), pair('L2', 'R3'), pair('L9', 'R1')] }),
        mj({ maxScore: 0 }), mj({ maxScore: -1 }), mj({ maxScore: Number.NaN }), mj({ maxScore: Number.POSITIVE_INFINITY }),
        mj({ prompt: '' }),
        mj({ questionType: 'MULTIPLE_RESPONSE' }),
    ];
    for (const bad of cases) assert.deepEqual(MATCHING_DESCRIPTOR.validateContent(bad), { ok: false }, JSON.stringify(bad).slice(0, 120));
    assert.deepEqual(MATCHING_DESCRIPTOR.validateContent(mj({ leftItems: items('L', 10), rightItems: items('R', 12), correctPairs: items('L', 10).map((l, i) => pair(l.id, `R${i + 1}`)) })), { ok: true }, '10 left and 2 distractors');
    const view = MATCHING_DESCRIPTOR.studentView(mj());
    assert.deepEqual(view, { schemaVersion: 2, questionType: 'MATCHING', prompt: 'Pasangkan', leftItems: items('L', 3), rightItems: items('R', 4) });
    assert.doesNotMatch(JSON.stringify(view), /correct|maxScore/);
});

test('C01 mixed vector: v1 + multiple response + true/false wrong + matching exact gives 6/8 = 75', () => {
    const v1 = { schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal', options: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, content: id })), correctOptionId: 'B', maxScore: 1 };
    const mr = { schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt: 'Pilih', options: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, content: id })), correctOptionIds: ['a', 'c'], maxScore: 2 };
    const tf = { schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Pernyataan', correctValue: true, maxScore: 2 };
    const r = scoreAttempt([{ id: 'v', frozenContent: v1 }, { id: 'm', frozenContent: mr }, { id: 't', frozenContent: tf }, { id: 'j', frozenContent: mj() }],
        new Map<string, unknown>([['v', { selectedOptionId: 'B' }], ['m', { selectedOptionIds: ['c', 'a'] }], ['t', { value: false }],
            ['j', { pairs: [pair('L3', 'R1'), pair('L1', 'R2'), pair('L2', 'R3')] }]]));
    assert.ok(r.type === 'scored' && r.score.rule === COMPOSITE_SCORING_RULE);
    assert.deepEqual([r.score.rawScore, r.score.maxScore, r.score.scaledScore], [6, 8, 75]);
});

const HEADER = QUESTIONS_HEADER_V2_EXTENDED.join(';');
/** One extended-header row: the ten v2 cells, then left_1..left_10 and right_a..right_l. */
function row(head: string, left: string[], right: string[]): string {
    const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
    return [head, ...pad(left, 10), ...pad(right, 12)].join(';');
}
const mjRow = (n: number, correct: string, left = ['Sapi', 'Kucing', 'Kelinci'], right = ['Wortel', 'Rumput', 'Ikan', 'Biji'], type = 'MJ', opts = ';;;;') =>
    row(`${n};${type};Pasangkan ${n};${opts};${correct};3`, left, right);

test('C02 MJ import vectors, frozen problem shapes and the builder', () => {
    assert.equal(QUESTIONS_HEADER_V2_EXTENDED.length, 32);
    const file = parseQuestionFile([HEADER, mjRow(1, 'B,C,A'), mjRow(2, 'b c a', undefined, undefined, 'mj'), row('3;PG;Soal;a;b;c;d;e;C;1', [], []), row('4;BS;Pernyataan;;;;;;S;1', [], [])].join('\n'));
    assert.deepEqual(file.problems, []);
    assert.deepEqual(file.questions.map(q => [q.type, q.correctPairIndexes, q.leftItems, q.rightItems?.length, q.options]),
        [['MJ', [1, 2, 0], ['Sapi', 'Kucing', 'Kelinci'], 4, []], ['MJ', [1, 2, 0], ['Sapi', 'Kucing', 'Kelinci'], 4, []],
            ['PG', undefined, undefined, undefined, ['a', 'b', 'c', 'd', 'e']], ['BS', undefined, undefined, undefined, []]]);
    const problems = (r: string) => parseQuestionFile([HEADER, r].join('\n')).problems;
    assert.deepEqual(problems(mjRow(1, 'B,C')), [{ code: 'correct_invalid', line: 2, type: 'MJ' }]);
    assert.deepEqual(problems(mjRow(1, 'B,C,E')), [{ code: 'correct_invalid', line: 2, type: 'MJ' }], 'E is not a filled right item');
    assert.deepEqual(problems(mjRow(1, 'B;C;A'.replace(/;/g, '/'))), [{ code: 'correct_invalid', line: 2, type: 'MJ' }]);
    assert.deepEqual(problems(mjRow(1, 'B,B,A')), [{ code: 'correct_duplicate', line: 2, type: 'MJ' }]);
    assert.deepEqual(problems(mjRow(1, 'A,B', ['Sapi', '', 'Kelinci'])), [{ code: 'matching_items_invalid', line: 2, side: 'left' }], 'a gap');
    assert.deepEqual(problems(mjRow(1, 'A', ['Sapi'])), [{ code: 'matching_items_invalid', line: 2, side: 'left' }], 'one left item');
    assert.deepEqual(problems(mjRow(1, 'A,B,C', undefined, ['Wortel', 'Rumput'])), [{ code: 'matching_items_invalid', line: 2, side: 'right' }], 'fewer right than left');
    assert.deepEqual(problems(mjRow(1, 'A,B,C', undefined, ['a', 'b', 'c', 'd', 'e', 'f'])), [{ code: 'matching_items_invalid', line: 2, side: 'right' }], 'more than 2 distractors');
    assert.deepEqual(problems(mjRow(1, 'A,B,C', undefined, ['a', 'b', '', 'd'])), [{ code: 'matching_items_invalid', line: 2, side: 'right' }], 'a right gap');
    assert.deepEqual(problems(mjRow(1, 'A,B,C', ['Sapi', 'sapi', 'Kelinci'], ['Rumput', 'rumput', 'Ikan'])), [{ code: 'items_duplicate', line: 2, side: 'left' }], 'left first');
    assert.deepEqual(problems(mjRow(1, 'A,B,C', undefined, ['Rumput', 'rumput  ', 'Ikan'])), [{ code: 'items_duplicate', line: 2, side: 'right' }]);
    assert.deepEqual(problems(mjRow(1, 'B,C,A', undefined, undefined, 'MJ', 'x;;;;')), [{ code: 'options_not_allowed', line: 2, type: 'MJ' }]);
    assert.deepEqual(problems(row('1;PG;Soal;a;b;c;d;e;C;1', ['x'], [])), [{ code: 'items_not_allowed', line: 2 }]);
    assert.deepEqual(problems(row('1;BS;Pernyataan;;;;;;B;1', [], ['x'])), [{ code: 'items_not_allowed', line: 2 }]);
    assert.deepEqual(problems(`${mjRow(1, 'B,C,A')};x`), [{ code: 'column_count', line: 2, found: 33, expected: 32 }], 'a 33-cell row');
    assert.deepEqual(problems('1;PG;Soal;a;b;c;d;e;C;1'), [{ code: 'column_count', line: 2, found: 10, expected: 32 }], 'a ten-cell row in an extended file (§4A.5)');
    assert.deepEqual(problems(row('1;MJ;Pasangkan;;;;;;B,C,A;0', ['a', 'b', 'c'], ['d', 'e', 'f'])), [{ code: 'score_invalid', line: 2 }]);
    const V2 = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
    assert.deepEqual(parseQuestionFile([V2, '1;MJ;Pasangkan;;;;;;B,C,A;3'].join('\n')).problems, [{ code: 'columns_missing', line: 2 }], 'MJ in a ten-column file');
    assert.deepEqual(parseQuestionFile([V2, '1;MJ;Pasangkan;x;;;;;B,C,A;3'].join('\n')).problems, [{ code: 'options_not_allowed', line: 2, type: 'MJ' }], 'options before columns');
    assert.deepEqual(parseQuestionFile([V2, '1;PG;Soal;a;b;c;d;e;C;1'].join('\n')).problems, [], 'ten-column v2 unchanged');

    assert.equal(describeQuestionProblem({ code: 'type_invalid', line: 2 }), 'line 2: "type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric), ES (essay) or PGK (multiple answers)');
    assert.match(describeQuestionProblem({ code: 'type_invalid', line: 2 }), /PG .* or PGK/, 'multiple-response.test.ts:96 still matches');
    assert.equal(describeQuestionProblem({ code: 'options_not_allowed', line: 2, type: 'MJ' }), 'line 2: options must be empty for MJ');
    assert.equal(describeQuestionProblem({ code: 'options_not_allowed', line: 2 }), 'line 2: options must be empty for BS');
    assert.equal(describeQuestionProblem({ code: 'columns_missing', line: 2 }), 'line 2: MJ needs the v2 header with left_1..left_10 and right_a..right_l');
    assert.equal(describeQuestionProblem({ code: 'matching_items_invalid', line: 2, side: 'left' }), 'line 2: MJ needs 2 to 10 left items, filled in order from left_1');
    assert.equal(describeQuestionProblem({ code: 'matching_items_invalid', line: 2, side: 'right' }), 'line 2: MJ needs as many right items as left items, plus at most 2, filled in order from right_a');
    assert.equal(describeQuestionProblem({ code: 'items_duplicate', line: 2, side: 'left' }), 'line 2: left items must differ from each other');
    assert.equal(describeQuestionProblem({ code: 'items_duplicate', line: 2, side: 'right' }), 'line 2: right items must differ from each other');
    assert.equal(describeQuestionProblem({ code: 'correct_invalid', line: 2, type: 'MJ' }), 'line 2: "correct" for MJ must list one right letter per left item, in order (for example B,C,A)');
    assert.equal(describeQuestionProblem({ code: 'correct_duplicate', line: 2, type: 'MJ' }), 'line 2: "correct" for MJ uses a right letter more than once');
    assert.equal(describeQuestionProblem({ code: 'correct_duplicate', line: 2 }), 'line 2: "correct" lists a letter more than once');
    assert.equal(describeQuestionProblem({ code: 'items_not_allowed', line: 2 }), 'line 2: left and right item columns are only for MJ and UR');
    assert.match(describeQuestionProblem({ code: 'header_invalid', line: 1 }), /or no,type,prompt,.*,score,left_1,.*,right_l,tolerance,rubric \(elligble-questions-v2\)$/);

    const built = buildImportedFrozenContent(file.questions[0]);
    assert.equal(MATCHING_DESCRIPTOR.validateContent(built).ok, true);
    const content = built as { leftItems: Array<{ id: string; content: string }>; rightItems: Array<{ id: string; content: string }>; correctPairs: Array<{ leftId: string; rightId: string }> };
    assert.deepEqual(content.leftItems.map(i => i.content), ['Sapi', 'Kucing', 'Kelinci']);
    assert.deepEqual(content.correctPairs.map(p => content.rightItems.find(r => r.id === p.rightId)?.content), ['Rumput', 'Ikan', 'Wortel']);
    assert.equal(new Set([...content.leftItems, ...content.rightItems].map(i => i.id)).size, 7, 'ids unique across both lists');
});
