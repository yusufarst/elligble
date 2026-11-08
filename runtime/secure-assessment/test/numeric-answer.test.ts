import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyFrozenContent, PRODUCTION_QUESTION_REGISTRY } from '../src/question-contract.ts';
import { checkAnswerForContent } from '../src/answer.ts';
import { NUMERIC_ANSWER_DESCRIPTOR, NUMERIC_ANSWER_KEY, NUMERIC_ANSWER_RULE, canonicalNumber } from '../src/question-types/numeric-answer.ts';
import { COMPOSITE_SCORING_RULE, scoreAttempt } from '../src/scoring.ts';
import { buildImportedFrozenContent } from '../src/exam-provisioning.ts';
import { QUESTIONS_HEADER_V2_EXTENDED, QUESTIONS_HEADER_V2_TOLERANCE, describeQuestionProblem, parseQuestionFile } from '../src/question-import.ts';

// ASSESS-QUESTION-007 units (record §4/§5, C01/C02): descriptor vectors N1–N7 with exact decimal
// arithmetic, precision extremes, negatives and large values, the mixed vector, the IA import
// vectors with the tolerance column, the frozen problem shapes and wording, and the builder.

const ia = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt: 'Hasil 5 dibagi 2', expected: '2.5', tolerance: '0.1', maxScore: 2, ...extra });
const SUPPORTED = new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', '2:MATCHING', '2:ORDERING', NUMERIC_ANSWER_KEY]);
const outcome = (text: string, content = ia()) => NUMERIC_ANSWER_DESCRIPTOR.score(content, { numericText: text }).outcome;

test('C01 registration, rule and classification', () => {
    assert.deepEqual(PRODUCTION_QUESTION_REGISTRY.keys(), ['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', '2:MATCHING', '2:ORDERING', NUMERIC_ANSWER_KEY]);
    assert.equal(classifyFrozenContent(ia()).kind, 'registered');
    assert.equal(NUMERIC_ANSWER_DESCRIPTOR.scoringRuleId, NUMERIC_ANSWER_RULE);
    assert.equal(NUMERIC_ANSWER_RULE, 'NUMERIC_EXACT_DECIMAL_TOLERANCE_V1');
    assert.equal(NUMERIC_ANSWER_DESCRIPTOR.allowsEmpty, true);
});

test('C01 vectors N1–N5: comma and dot, inclusive bounds, outside, empty, none', () => {
    for (const text of ['2,5', '2.5', '002,5']) assert.equal(outcome(text), 'CORRECT', text);
    assert.deepEqual(NUMERIC_ANSWER_DESCRIPTOR.score(ia(), { numericText: '2,5' }).earnedMicro, 2_000_000n);
    for (const text of ['2,6', '2,4']) assert.equal(outcome(text), 'CORRECT', `bound ${text}`);
    for (const text of ['2,61', '2,39']) assert.equal(outcome(text), 'INCORRECT', text);
    assert.deepEqual(NUMERIC_ANSWER_DESCRIPTOR.validateAnswer(ia(), { numericText: '' }), { ok: true, empty: true });
    assert.deepEqual(NUMERIC_ANSWER_DESCRIPTOR.validateAnswer(ia(), { numericText: '2,5' }), { ok: true, empty: false });
    assert.equal(outcome(''), 'UNANSWERED');
    assert.equal(NUMERIC_ANSWER_DESCRIPTOR.score(ia(), undefined).outcome, 'UNANSWERED');
    assert.equal(checkAnswerForContent(ia(), { numericText: '2,5' }, new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', '2:MATCHING', '2:ORDERING'])), 'unsupported');
});

test('C01 vector N6: refusals', () => {
    const texts = ['1.000,5', '2e3', '5 cm', 'abc', '+2,5', '2,', ',5', ' 2,5', '-', '--5', '2,5,1', 'NaN', 'Infinity', '-Infinity',
        '２,５', '٢,٥', '−2,5', '1'.repeat(31)];
    for (const text of texts) assert.equal(checkAnswerForContent(ia(), { numericText: text }, SUPPORTED), 'invalid', JSON.stringify(text));
    for (const payload of [{ numericText: 2.5 }, { numericText: '2,5', extra: 1 }, {}, [], null, '2,5']) {
        assert.equal(checkAnswerForContent(ia(), payload, SUPPORTED), 'invalid', JSON.stringify(payload));
    }
    assert.equal(checkAnswerForContent(ia(), { numericText: '1'.repeat(30) }, SUPPORTED), 'valid', '30 characters');
    for (const stored of [{ numericText: 'abc' }, { numericText: 3 }, 'x', {}]) assert.equal(NUMERIC_ANSWER_DESCRIPTOR.score(ia(), stored).outcome, 'UNANSWERED');
});

test('C01 vector N7: invalid content; the Student view carries no key or tolerance', () => {
    const cases = [
        ia({ expected: undefined }), ia({ expected: '2,5' }), ia({ expected: '02.5' }), ia({ expected: '2.50' }), ia({ expected: '-0' }), ia({ expected: 2.5 }),
        ia({ tolerance: '-0.1' }), ia({ tolerance: undefined }), ia({ tolerance: '0.10' }), ia({ tolerance: '0,1' }),
        ia({ expected: '1'.repeat(31) }),
        ia({ maxScore: 0 }), ia({ maxScore: -1 }), ia({ maxScore: Number.NaN }), ia({ maxScore: Number.POSITIVE_INFINITY }),
        ia({ prompt: '' }), ia({ questionType: 'ORDERING' }),
    ];
    for (const bad of cases) assert.deepEqual(NUMERIC_ANSWER_DESCRIPTOR.validateContent(bad), { ok: false }, JSON.stringify(bad));
    for (const good of [ia({ expected: '0', tolerance: '0' }), ia({ expected: '-3', tolerance: '0.5' }), ia({ expected: '123456789012345678.5' })]) {
        assert.deepEqual(NUMERIC_ANSWER_DESCRIPTOR.validateContent(good), { ok: true }, JSON.stringify(good));
    }
    const view = NUMERIC_ANSWER_DESCRIPTOR.studentView(ia());
    assert.deepEqual(view, { schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt: 'Hasil 5 dibagi 2' });
    assert.doesNotMatch(JSON.stringify(view), /expected|tolerance|maxScore/);
});

test('C01 exact decimals: tolerance 0, precision extremes, large values, negatives, zero', () => {
    const exact = ia({ tolerance: '0' });
    assert.equal(outcome('2,50', exact), 'CORRECT');
    assert.equal(outcome('2,5000000001', exact), 'INCORRECT');
    const tiny = ia({ expected: '0.0000000000000000000000000001', tolerance: '0' });
    assert.equal('0,0000000000000000000000000001'.length, 30);
    assert.equal(outcome('0,0000000000000000000000000001', tiny), 'CORRECT');
    assert.equal(outcome('0,0000000000000000000000000002', tiny), 'INCORRECT', 'differs only in the last decimal');
    const large = ia({ expected: '123456789012345678.5', tolerance: '0' });
    assert.equal(outcome('123456789012345678,5', large), 'CORRECT');
    assert.equal(outcome('123456789012345678,6', large), 'INCORRECT', 'floating point could not tell these apart');
    const negative = ia({ expected: '-3', tolerance: '0.5' });
    for (const text of ['-2,5', '-3,5']) assert.equal(outcome(text, negative), 'CORRECT', text);
    for (const text of ['-2,4', '-3,51']) assert.equal(outcome(text, negative), 'INCORRECT', text);
    assert.equal(outcome('-0', ia({ expected: '0', tolerance: '0' })), 'CORRECT');
    assert.deepEqual(['007', '-0', '2,50', '-0,0', '10', '0,050', '-12.340'].map(canonicalNumber), ['7', '0', '2.5', '0', '10', '0.05', '-12.34']);
});

test('C01 mixed vector: v1 + MR + TF wrong + MJ + UR + IA exact gives 10/12 = 83.33', () => {
    const v1 = { schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal', options: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, content: id })), correctOptionId: 'B', maxScore: 1 };
    const mr = { schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt: 'Pilih', options: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, content: id })), correctOptionIds: ['a', 'c'], maxScore: 2 };
    const tf = { schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Pernyataan', correctValue: true, maxScore: 2 };
    const mj = { schemaVersion: 2, questionType: 'MATCHING', prompt: 'Pasangkan', leftItems: [{ id: 'L1', content: 'a' }, { id: 'L2', content: 'b' }], rightItems: [{ id: 'R1', content: 'x' }, { id: 'R2', content: 'y' }],
        correctPairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L2', rightId: 'R1' }], maxScore: 3 };
    const ur = { schemaVersion: 2, questionType: 'ORDERING', prompt: 'Urutkan', items: [{ id: 'I1', content: 'a' }, { id: 'I2', content: 'b' }], correctOrder: ['I2', 'I1'], maxScore: 2 };
    const r = scoreAttempt([{ id: 'v', frozenContent: v1 }, { id: 'm', frozenContent: mr }, { id: 't', frozenContent: tf }, { id: 'j', frozenContent: mj }, { id: 'o', frozenContent: ur }, { id: 'n', frozenContent: ia() }],
        new Map<string, unknown>([['v', { selectedOptionId: 'B' }], ['m', { selectedOptionIds: ['c', 'a'] }], ['t', { value: false }],
            ['j', { pairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L2', rightId: 'R1' }] }], ['o', { orderedItemIds: ['I2', 'I1'] }], ['n', { numericText: '2,5' }]]));
    assert.ok(r.type === 'scored' && r.score.rule === COMPOSITE_SCORING_RULE);
    assert.deepEqual([r.score.rawScore, r.score.maxScore, r.score.scaledScore], [10, 12, 83.33]);
});

const V2 = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
const H32 = QUESTIONS_HEADER_V2_EXTENDED.join(';');
const H33 = QUESTIONS_HEADER_V2_TOLERANCE.join(';');
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
/** A row of the 33-column file: the ten v2 cells, 22 item cells and the tolerance. */
const row33 = (head: string, tolerance = '', items: string[] = []) => [head, ...pad(items, 22), tolerance].join(';');

test('C02 IA import vectors, the tolerance column, problem shapes, wording and the builder', () => {
    assert.equal(QUESTIONS_HEADER_V2_EXTENDED.length, 32);
    assert.equal(QUESTIONS_HEADER_V2_TOLERANCE.length, 33);
    const file = parseQuestionFile([H33, row33('1;IA;Hasil 5 dibagi 2;;;;;;2,5;2', '0,1'), row33('2;ia;Hasil 7 dikurangi 7;;;;;;-0;1'),
        row33('3;PG;Soal;a;b;c;d;e;C;1')].join('\n'));
    assert.deepEqual(file.problems, []);
    assert.deepEqual(file.questions.map(q => [q.type, q.numericKey, q.numericTolerance]), [['IA', '2,5', '0,1'], ['IA', '-0', '0'], ['PG', undefined, undefined]]);
    assert.deepEqual(buildImportedFrozenContent(file.questions[0]), { schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt: 'Hasil 5 dibagi 2', expected: '2.5', tolerance: '0.1', maxScore: 2 });
    assert.deepEqual(buildImportedFrozenContent(file.questions[1]), { schemaVersion: 2, questionType: 'NUMERIC_ANSWER', prompt: 'Hasil 7 dikurangi 7', expected: '0', tolerance: '0', maxScore: 1 });
    assert.deepEqual(parseQuestionFile([V2, '1;IA;Soal;;;;;;007;1'].join('\n')).problems, [], 'a ten-column file');
    assert.deepEqual((buildImportedFrozenContent(parseQuestionFile([V2, '1;IA;Soal;;;;;;007;1'].join('\n')).questions[0]) as { expected: string }).expected, '7');
    assert.deepEqual(parseQuestionFile([H32, ['1;IA;Soal;;;;;;2,5;1', ...pad([], 22)].join(';')].join('\n')).problems, [], 'a 32-column file');
    const problems = (r: string) => parseQuestionFile([H33, r].join('\n')).problems;
    for (const key of ['', '1.000,5', '2e3']) assert.deepEqual(problems(row33(`1;IA;Soal;;;;;;${key};1`)), [{ code: 'correct_invalid', line: 2, type: 'IA' }], key);
    for (const tol of ['abc', '-1', '-0']) assert.deepEqual(problems(row33('1;IA;Soal;;;;;;2,5;1', tol)), [{ code: 'tolerance_invalid', line: 2 }], tol);
    assert.deepEqual(problems(row33('1;IA;Soal;x;;;;;2,5;1')), [{ code: 'options_not_allowed', line: 2, type: 'IA' }]);
    assert.deepEqual(problems(row33('1;IA;Soal;;;;;;2,5;1', '', ['x'])), [{ code: 'items_not_allowed', line: 2, type: 'IA' }]);
    assert.deepEqual(problems(row33('1;IA;Soal;;;;;;2,5;1', '', [...Array(21).fill(''), 'x'])), [{ code: 'items_not_allowed', line: 2, type: 'IA' }], 'right_l');
    assert.deepEqual(problems(row33('1;IA;Soal;;;;;;2,5;0')), [{ code: 'score_invalid', line: 2 }]);
    assert.deepEqual(problems(row33('1;PG;Soal;a;b;c;d;e;C;1', '0,1')), [{ code: 'tolerance_not_allowed', line: 2 }]);
    assert.deepEqual(problems(row33('1;MJ;Pasangkan;;;;;;B,A;2', '1', ['Sapi', 'Kucing', ...Array(8).fill(''), 'Ikan', 'Rumput'])), [{ code: 'tolerance_not_allowed', line: 2 }]);
    assert.deepEqual(problems(row33('1;UR;Urutkan;;;;;;2,1;2', '1', ['a', 'b'])), [{ code: 'tolerance_not_allowed', line: 2 }]);
    assert.deepEqual(problems(['1;PG;Soal;a;b;c;d;e;C;1', ...pad([], 22)].join(';')), [{ code: 'column_count', line: 2, found: 32, expected: 33 }]);
    const mj = parseQuestionFile([H33, row33('1;MJ;Pasangkan;;;;;;B,A;2', '', ['Sapi', 'Kucing', ...Array(8).fill(''), 'Ikan', 'Rumput'])].join('\n'));
    assert.deepEqual([mj.problems, mj.questions[0]?.rightItems], [[], ['Ikan', 'Rumput']], 'MJ right cells are 20-31 in the 33-column file');

    assert.equal(describeQuestionProblem({ code: 'type_invalid', line: 2 }), 'line 2: "type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric) or PGK (multiple answers)');
    assert.match(describeQuestionProblem({ code: 'type_invalid', line: 2 }), /PG .* or PGK/);
    assert.equal(describeQuestionProblem({ code: 'options_not_allowed', line: 2, type: 'IA' }), 'line 2: options must be empty for IA');
    assert.equal(describeQuestionProblem({ code: 'items_not_allowed', line: 2, type: 'IA' }), 'line 2: item columns are not used for IA');
    assert.equal(describeQuestionProblem({ code: 'items_not_allowed', line: 2 }), 'line 2: left and right item columns are only for MJ and UR');
    assert.equal(describeQuestionProblem({ code: 'correct_invalid', line: 2, type: 'IA' }), 'line 2: "correct" for IA must be a number with a comma or dot decimal (for example 3,5)');
    assert.equal(describeQuestionProblem({ code: 'tolerance_invalid', line: 2 }), 'line 2: "tolerance" must be empty or a non-negative number');
    assert.equal(describeQuestionProblem({ code: 'tolerance_not_allowed', line: 2 }), 'line 2: "tolerance" is only for IA');
    assert.match(describeQuestionProblem({ code: 'header_invalid', line: 1 }), /right_l \(elligble-questions-v2\) or no,type,prompt,.*,right_l,tolerance \(elligble-questions-v2\)$/);
});
