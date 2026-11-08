import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyFrozenContent, PRODUCTION_QUESTION_REGISTRY } from '../src/question-contract.ts';
import { checkAnswerForContent } from '../src/answer.ts';
import { TRUE_FALSE_DESCRIPTOR, TRUE_FALSE_KEY, TRUE_FALSE_RULE } from '../src/question-types/true-false.ts';
import { COMPOSITE_SCORING_RULE, scoreAttempt } from '../src/scoring.ts';
import { buildImportedFrozenContent } from '../src/exam-provisioning.ts';
import { describeQuestionProblem, parseQuestionFile } from '../src/question-import.ts';

// ASSESS-QUESTION-003 units (record §4/§4A/§5, C01/C02): descriptor vectors T1–T5, the mixed
// vector, the BS import vectors and the frozen problem shapes and wording.

const tf = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Matahari terbit dari timur', correctValue: true, maxScore: 2, ...extra });
const SUPPORTED = new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', TRUE_FALSE_KEY]);

test('C01 registration, rule and classification', () => {
    assert.deepEqual(PRODUCTION_QUESTION_REGISTRY.keys(), ['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', TRUE_FALSE_KEY, '2:MATCHING', '2:ORDERING', '2:NUMERIC_ANSWER', '2:ESSAY', '2:SHORT_ANSWER']);
    assert.equal(classifyFrozenContent(tf()).kind, 'registered');
    assert.equal(TRUE_FALSE_DESCRIPTOR.scoringRuleId, TRUE_FALSE_RULE);
    assert.equal(TRUE_FALSE_DESCRIPTOR.allowsEmpty, false, 'no clearing (§3, §4A.6)');
});

test('C01 vectors T1–T4: strict boolean, exact match, no coercion', () => {
    const score = (p: unknown) => TRUE_FALSE_DESCRIPTOR.score(tf(), p);
    assert.equal(checkAnswerForContent(tf(), { value: true }, SUPPORTED), 'valid');
    assert.deepEqual([score({ value: true }).outcome, score({ value: true }).earnedMicro], ['CORRECT', 2_000_000n]);
    assert.equal(checkAnswerForContent(tf(), { value: false }, SUPPORTED), 'valid');
    assert.deepEqual([score({ value: false }).outcome, score({ value: false }).earnedMicro], ['INCORRECT', 0n]);
    assert.equal(score(undefined).outcome, 'UNANSWERED');
    for (const bad of [{ value: 'true' }, { value: 'false' }, { value: null }, { value: 1 }, { value: 0 }, { value: true, extra: 1 }, { selectedOptionId: 'x' }, true, [true], {}, null]) {
        assert.equal(checkAnswerForContent(tf(), bad, SUPPORTED), 'invalid', JSON.stringify(bad));
    }
    for (const stored of [{ value: 'true' }, { value: null }, 'x', {}]) assert.equal(score(stored).outcome, 'UNANSWERED');
    assert.equal(checkAnswerForContent(tf(), { value: true }, new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE'])), 'unsupported', 'a client that does not declare true/false');
});

test('C01 vector T5: invalid content', () => {
    for (const bad of [tf({ correctValue: 'true' }), tf({ correctValue: 1 }), tf({ correctValue: undefined }), tf({ prompt: '' }), tf({ maxScore: 0 }), tf({ maxScore: -1 }),
        tf({ maxScore: Number.NaN }), tf({ maxScore: Number.POSITIVE_INFINITY }), tf({ questionType: 'MULTIPLE_RESPONSE' })]) {
        assert.deepEqual(TRUE_FALSE_DESCRIPTOR.validateContent(bad), { ok: false }, JSON.stringify(bad));
    }
    const view = TRUE_FALSE_DESCRIPTOR.studentView(tf());
    assert.deepEqual(view, { schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Matahari terbit dari timur' });
    assert.doesNotMatch(JSON.stringify(view), /correct|maxScore/);
});

test('C01 mixed vector: v1 + multiple response + true/false wrong gives 3/5 = 60 under the composite rule', () => {
    const v1 = { schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal', options: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, content: id })), correctOptionId: 'B', maxScore: 1 };
    const mr = { schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt: 'Pilih', options: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, content: id })), correctOptionIds: ['a', 'c'], maxScore: 2 };
    const r = scoreAttempt([{ id: 'v', frozenContent: v1 }, { id: 'm', frozenContent: mr }, { id: 't', frozenContent: tf() }],
        new Map<string, unknown>([['v', { selectedOptionId: 'B' }], ['m', { selectedOptionIds: ['c', 'a'] }], ['t', { value: false }]]));
    assert.ok(r.type === 'scored' && r.score.rule === COMPOSITE_SCORING_RULE);
    assert.deepEqual([r.score.rawScore, r.score.maxScore, r.score.scaledScore], [3, 5, 60]);
});

test('C02 BS import vectors and frozen problem shapes; PG/PGK unchanged', () => {
    const V2 = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
    const bs = (n: number, type: string, correct: string, opts = ';;;;') => `${n};${type};Pernyataan ${n};${opts};${correct};1`;
    const file = parseQuestionFile([V2, bs(1, 'BS', 'B'), bs(2, 'bs', 's'), bs(3, 'BS', 'Benar'), bs(4, 'BS', ' salah '), '5;PG;Soal;a;b;c;d;e;C;1'].join('\n'));
    assert.deepEqual(file.problems, []);
    assert.deepEqual(file.questions.map(q => [q.type, q.correctValue, q.options, q.correctIndex, q.correctIndexes]),
        [['BS', true, [], -1, []], ['BS', false, [], -1, []], ['BS', true, [], -1, []], ['BS', false, [], -1, []], ['PG', undefined, ['a', 'b', 'c', 'd', 'e'], 2, [2]]]);
    const problems = (row: string) => parseQuestionFile([V2, row].join('\n')).problems;
    assert.deepEqual(problems(bs(1, 'BS', 'Ya')), [{ code: 'correct_invalid', line: 2, type: 'BS' }]);
    assert.deepEqual(problems(bs(1, 'BS', 'T')), [{ code: 'correct_invalid', line: 2, type: 'BS' }]);
    assert.deepEqual(problems(bs(1, 'BS', 'B', 'x;;;;')), [{ code: 'options_not_allowed', line: 2 }]);
    assert.deepEqual(problems(bs(1, 'BS', 'Ya', 'x;;;;')), [{ code: 'options_not_allowed', line: 2 }], 'options are checked before the key');
    assert.deepEqual(problems('1;BS;;;;;;;B;1'), [{ code: 'prompt_empty', line: 2 }]);
    assert.deepEqual(problems('1;BS;Pernyataan;;;;;;B;0'), [{ code: 'score_invalid', line: 2 }]);
    assert.deepEqual(problems('1;PG;Soal;a;b;c;d;e;F;1'), [{ code: 'correct_invalid', line: 2 }], 'PG problem shape unchanged');
    assert.deepEqual(problems('1;XX;Soal;a;b;c;d;e;A;1'), [{ code: 'type_invalid', line: 2 }]);
    assert.equal(describeQuestionProblem({ code: 'type_invalid', line: 2 }), 'line 2: "type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric), IS (short answer), ES (essay) or PGK (multiple answers)');
    assert.equal(describeQuestionProblem({ code: 'correct_invalid', line: 2, type: 'BS' }), 'line 2: "correct" must be B (true) or S (false) for BS');
    assert.equal(describeQuestionProblem({ code: 'correct_invalid', line: 2 }), 'line 2: "correct" must be one of A, B, C, D, E');
    assert.equal(describeQuestionProblem({ code: 'options_not_allowed', line: 2 }), 'line 2: options must be empty for BS');
    const built = buildImportedFrozenContent(file.questions[1]);
    assert.deepEqual(built, { schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Pernyataan 2', correctValue: false, maxScore: 1 });
});
