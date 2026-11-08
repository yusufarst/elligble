import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyFrozenContent, PRODUCTION_QUESTION_REGISTRY } from '../src/question-contract.ts';
import { checkAnswerForContent } from '../src/answer.ts';
import { SHORT_ANSWER_DESCRIPTOR, SHORT_ANSWER_KEY, SHORT_ANSWER_RULE, isManualShortAnswer, isShortText, normalizeShortText } from '../src/question-types/short-answer.ts';
import { COMPOSITE_SCORING_RULE, isCompositeScore, scoreAttempt } from '../src/scoring.ts';
import { buildBaselineFrozenContent, buildEssayFrozenContent, buildImportedFrozenContent, buildShortAnswerFrozenContent } from '../src/exam-provisioning.ts';
import { QUESTIONS_HEADER_V2_EXTENDED, QUESTIONS_HEADER_V2_RUBRIC, describeQuestionProblem, parseQuestionFile } from '../src/question-import.ts';
import { isTeacherGradedQuestion, teacherGradedContentOf, teacherGradedTextOf } from '../src/essay-grading.ts';

// ASSESS-QUESTION-006 units (record §4/§5, C01/C02): the one-line predicate, the normalization
// (E3), the descriptor vectors S-1..S-4 and S-6..S-8, manual mode through the grade argument, the
// mixed vector, the teacher-graded helpers, the IS import with accepted forms in left_1..left_10,
// the frozen problem shapes and wording, and the builder.

const auto = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt: 'Ibu kota Indonesia adalah', acceptedForms: ['Jakarta', 'DKI Jakarta'], rubric: '', maxScore: 2, ...extra });
const manual = (extra: Record<string, unknown> = {}) => auto({ acceptedForms: [], rubric: 'Sebutkan ibu kota', ...extra });
const SUPPORTED = new Set(['1:MULTIPLE_CHOICE_SINGLE', SHORT_ANSWER_KEY]);
const M = 1_000_000n;
const outcome = (text: string, content = auto()) => SHORT_ANSWER_DESCRIPTOR.score(content, { shortText: text }).outcome;

test('C01 registration, rule, classification and Student view', () => {
    assert.equal(PRODUCTION_QUESTION_REGISTRY.keys().length, 8);
    assert.equal(PRODUCTION_QUESTION_REGISTRY.get(SHORT_ANSWER_KEY), SHORT_ANSWER_DESCRIPTOR);
    assert.equal(SHORT_ANSWER_DESCRIPTOR.scoringRuleId, SHORT_ANSWER_RULE);
    assert.equal(SHORT_ANSWER_RULE, 'SHORT_ANSWER_ACCEPTED_FORMS_V1');
    assert.equal(classifyFrozenContent(auto()).kind, 'registered');
    assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.studentView(auto()), { schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt: 'Ibu kota Indonesia adalah' });
    assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.studentView(manual()), { schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt: 'Ibu kota Indonesia adalah' });
});

test('C01 the one-line predicate (E1, E2) and the normalization (E3)', () => {
    for (const ok of ['', 'Jakarta', 'a'.repeat(200), '😀'.repeat(200), 'Dki\tJakarta', ' é', 'a b']) assert.equal(isShortText(ok), true, JSON.stringify(ok));
    for (const bad of ['a'.repeat(201), '😀'.repeat(201), 'a\nb', 'a\rb', '\u0001', '\u007f', '\u0085', 'a\ud800', '\udc00']) assert.equal(isShortText(bad), false, JSON.stringify(bad));
    assert.equal(normalizeShortText('  DKI \t  Jakarta '), 'dki jakarta');
    assert.equal(normalizeShortText('Café'), normalizeShortText('Café'));
    assert.equal(normalizeShortText('a b'), 'a b');
    assert.notEqual(normalizeShortText('ß'), normalizeShortText('SS'), 'simple lowercasing, not case folding');
});

test('C01 S-1..S-4 automatic scoring, all-or-nothing, no fuzzy matching', () => {
    for (const text of ['Jakarta', '  jakarta ', 'JAKARTA', 'dki   jakarta', 'Dki\tJakarta']) assert.equal(outcome(text), 'CORRECT', text);
    assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.score(auto(), { shortText: 'Jakarta' }), { outcome: 'CORRECT', earnedMicro: 2n * M, maxMicro: 2n * M });
    for (const text of ['Jakarta.', 'Jakart', 'Bandung']) assert.equal(outcome(text), 'INCORRECT', text);
    assert.equal(outcome('café', auto({ acceptedForms: ['Café'] })), 'CORRECT', 'S-3 NFC');
    assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.score(auto(), { shortText: '' }), { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: 2n * M });
    assert.equal(SHORT_ANSWER_DESCRIPTOR.score(auto(), undefined).outcome, 'UNANSWERED');
    assert.equal(outcome('a\nb'), 'UNANSWERED', 'an invalid stored value scores like no answer');
    // A grade never applies to an auto-scored item.
    assert.equal(SHORT_ANSWER_DESCRIPTOR.score(auto(), { shortText: 'Bandung' }, { scoreMicro: 2n * M }).outcome, 'INCORRECT');
});

test('C01 S-5 answer refusals and the empty value', () => {
    assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.validateAnswer(auto(), { shortText: '' }), { ok: true, empty: true });
    assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.validateAnswer(auto(), { shortText: 'Jakarta' }), { ok: true, empty: false });
    for (const bad of [{ shortText: 'a'.repeat(201) }, { shortText: 'a\nb' }, { shortText: 'a\rb' }, { shortText: '\u0001' }, { shortText: '\u007f' }, { shortText: '\u0085' },
        { shortText: '\ud800' }, { shortText: 5 }, { shortText: 'x', extra: 1 }, {}, null, 'Jakarta']) {
        assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.validateAnswer(auto(), bad), { ok: false }, JSON.stringify(bad));
    }
    assert.equal(checkAnswerForContent(auto(), { shortText: 'Jakarta' }, SUPPORTED), 'valid');
    assert.equal(checkAnswerForContent(auto(), { shortText: 'Jakarta' }, new Set(['1:MULTIPLE_CHOICE_SINGLE'])), 'unsupported');
});

test('C01 S-6 manual mode through the grade argument; S-7 helpers; S-8 invalid content', () => {
    assert.equal(isManualShortAnswer(manual()), true);
    assert.equal(isManualShortAnswer(auto()), false);
    assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.score(manual(), { shortText: 'Jakarta' }), { outcome: 'UNGRADED', earnedMicro: 0n, maxMicro: 2n * M });
    assert.deepEqual(SHORT_ANSWER_DESCRIPTOR.score(manual(), { shortText: 'Jakarta' }, { scoreMicro: 1_500_000n }), { outcome: 'GRADED', earnedMicro: 1_500_000n, maxMicro: 2n * M });
    assert.equal(SHORT_ANSWER_DESCRIPTOR.score(manual(), { shortText: 'Jakarta' }, { scoreMicro: 3n * M }).outcome, 'UNGRADED', 'a grade above max is invalid');
    assert.equal(SHORT_ANSWER_DESCRIPTOR.score(manual(), { shortText: '' }, { scoreMicro: M }).outcome, 'UNANSWERED');
    assert.deepEqual(teacherGradedContentOf(manual())?.questionType, 'SHORT_ANSWER');
    assert.equal(teacherGradedContentOf(auto()), null, 'an auto-scored short answer is not graded by the teacher');
    assert.equal(isTeacherGradedQuestion(buildEssayFrozenContent({ prompt: 'Jelaskan', rubric: '', maxScore: 5 })), true);
    assert.equal(teacherGradedTextOf('SHORT_ANSWER', { shortText: 'Jakarta' }), 'Jakarta');
    assert.equal(teacherGradedTextOf('SHORT_ANSWER', { essayText: 'Jakarta' }), null);
    assert.equal(teacherGradedTextOf('ESSAY', { essayText: 'Baris\nkedua' }), 'Baris\nkedua');
    for (const bad of [auto({ acceptedForms: Array.from({ length: 11 }, (_, i) => `f${i}`) }), auto({ acceptedForms: ['Jakarta', ' jakarta '] }), auto({ acceptedForms: ['  '] }),
        auto({ acceptedForms: ['a\nb'] }), auto({ acceptedForms: [5] }), auto({ rubric: 'x' }), auto({ rubric: 5 }), auto({ maxScore: 0 }), auto({ prompt: '' }), auto({ acceptedForms: 'Jakarta' })]) {
        assert.equal(SHORT_ANSWER_DESCRIPTOR.validateContent(bad).ok, false, JSON.stringify(bad));
    }
});

test('C01 mixed vector under the composite rule and D1 counts', () => {
    const v1 = buildBaselineFrozenContent({ prompt: 'Ibu kota?', options: ['A', 'B', 'C', 'D', 'E'], correctIndex: 0, maxScore: 1 });
    const questions = [{ id: 'q1', frozenContent: v1 }, { id: 'q2', frozenContent: auto() }, { id: 'q3', frozenContent: manual() },
        { id: 'q4', frozenContent: buildEssayFrozenContent({ prompt: 'Jelaskan', rubric: '', maxScore: 5 }) }];
    const answers = new Map<string, unknown>([['q1', { selectedOptionId: (v1 as { correctOptionId: string }).correctOptionId }], ['q2', { shortText: ' dki jakarta ' }],
        ['q3', { shortText: 'Jakarta' }], ['q4', { essayText: 'Jawaban.' }]]);
    const scored = scoreAttempt(questions, answers, undefined, new Map([['q3', M], ['q4', 3_500_000n]]));
    if (scored.type !== 'scored' || !isCompositeScore(scored.score)) throw new Error('composite expected');
    assert.equal(scored.score.rule, COMPOSITE_SCORING_RULE);
    assert.deepEqual([scored.score.correct, scored.score.incorrect, scored.score.unanswered, scored.score.gradedCount, scored.score.ungradedCount], [2, 0, 0, 2, 0]);
    assert.deepEqual([scored.score.rawScore, scored.score.maxScore, scored.score.scaledScore], [7.5, 10, 75]);
});

const H32 = QUESTIONS_HEADER_V2_EXTENDED.join(';');
const H34 = QUESTIONS_HEADER_V2_RUBRIC.join(';');
const V2 = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
/** A 34-column row: the ten v2 cells, ten left (form) cells, twelve right cells, the tolerance and the rubric. */
const row34 = (head: string, forms: string[] = [], rubric = '', tolerance = '', right: string[] = []) => [head, ...pad(forms, 10), ...pad(right, 12), tolerance, rubric].join(';');

test('C02 IS import: auto and manual in 10-, 32- and 34-column files; the builder', () => {
    const file = parseQuestionFile([H34, row34('1;IS;Ibu kota Indonesia adalah;;;;;;;2', ['Jakarta', ' DKI Jakarta ']), row34('2;is;Sebutkan ibu kota;;;;;;;2', [], 'Sebutkan ibu kota'),
        row34('3;PG;Soal;a;b;c;d;e;C;1')].join('\n'));
    assert.deepEqual(file.problems, []);
    assert.deepEqual(file.questions[0], { line: 2, no: 1, prompt: 'Ibu kota Indonesia adalah', options: [], correctIndex: -1, maxScore: 2, type: 'IS', correctIndexes: [], acceptedForms: ['Jakarta', 'DKI Jakarta'], essayRubric: '' });
    assert.deepEqual(file.questions[1].acceptedForms, []);
    assert.equal(file.questions[1].essayRubric, 'Sebutkan ibu kota');
    assert.deepEqual(buildImportedFrozenContent(file.questions[0]), auto({ acceptedForms: ['Jakarta', 'DKI Jakarta'] }));
    assert.deepEqual(buildImportedFrozenContent(file.questions[1]), { schemaVersion: 2, questionType: 'SHORT_ANSWER', prompt: 'Sebutkan ibu kota', acceptedForms: [], rubric: 'Sebutkan ibu kota', maxScore: 2 });
    assert.deepEqual(parseQuestionFile([V2, '1;IS;Soal;;;;;;;1'].join('\n')).questions[0].acceptedForms, [], 'a ten-column IS row is manual (D1)');
    assert.deepEqual(parseQuestionFile([H32, ['1;IS;Soal;;;;;;;1', ...pad(['Jakarta'], 22)].join(';')].join('\n')).questions[0].acceptedForms, ['Jakarta'], 'a 32-column file');
    const ten = Array.from({ length: 10 }, (_, i) => `bentuk ${i + 1}`);
    assert.deepEqual(parseQuestionFile([H34, row34('1;IS;Soal;;;;;;;1', ten)].join('\n')).questions[0].acceptedForms, ten, 'ten forms');
    assert.throws(() => buildShortAnswerFrozenContent({ prompt: 'Soal', acceptedForms: ['a', 'A'], rubric: '', maxScore: 1 }));
});

test('C02 IS problem order, shapes and wording', () => {
    const problems = (r: string) => parseQuestionFile([H34, r].join('\n')).problems;
    assert.deepEqual(problems(row34('1;IS;Soal;x;;;;;A;0', ['a'], 'r', '1', ['y'])), [{ code: 'options_not_allowed', line: 2, type: 'IS' }], 'options first');
    assert.deepEqual(problems(row34('1;IS;Soal;;;;;;A;0', ['a'], 'r', '1', ['y'])), [{ code: 'items_not_allowed', line: 2, type: 'IS' }], 'right cells next');
    assert.deepEqual(problems(row34('1;IS;Soal;;;;;;;1', ['a', '', 'c'])), [{ code: 'short_answer_forms_invalid', line: 2 }], 'a gap');
    assert.deepEqual(problems(row34('1;IS;Soal;;;;;;;1', ['a'.repeat(201)])), [{ code: 'short_answer_forms_invalid', line: 2 }], 'over 200');
    assert.deepEqual(problems(row34('1;IS;Soal;;;;;;A;0', ['Jakarta', ' jakarta '], 'r', '1')), [{ code: 'items_duplicate', line: 2, type: 'IS' }], 'duplicates before tolerance');
    assert.deepEqual(problems(row34('1;IS;Soal;;;;;;A;0', ['Jakarta'], 'r', '1')), [{ code: 'tolerance_not_allowed', line: 2 }]);
    assert.deepEqual(problems(row34('1;IS;Soal;;;;;;A;0', ['Jakarta'], 'r')), [{ code: 'correct_not_allowed', line: 2, type: 'IS' }]);
    assert.deepEqual(problems(row34('1;IS;Soal;;;;;;;0', ['Jakarta'], 'r')), [{ code: 'rubric_not_allowed', line: 2 }], 'a rubric on an auto row');
    assert.deepEqual(problems(row34('1;IS;Soal;;;;;;;0')), [{ code: 'score_invalid', line: 2 }]);
    assert.deepEqual(problems(row34('1;PG;Soal;a;b;c;d;e;C;1', [], 'r')), [{ code: 'rubric_not_allowed', line: 2 }], 'earlier types unchanged');
    assert.deepEqual(problems(row34('1;ES;Soal;;;;;;A;1')), [{ code: 'correct_not_allowed', line: 2 }], 'the ES shape is unchanged');
    assert.equal(describeQuestionProblem({ code: 'options_not_allowed', line: 2, type: 'IS' }), 'line 2: options must be empty for IS');
    assert.equal(describeQuestionProblem({ code: 'items_not_allowed', line: 2, type: 'IS' }), 'line 2: right item columns are not used for IS');
    assert.equal(describeQuestionProblem({ code: 'items_duplicate', line: 2, type: 'IS' }), 'line 2: IS accepted forms must differ after normalization');
    assert.equal(describeQuestionProblem({ code: 'correct_not_allowed', line: 2, type: 'IS' }), 'line 2: "correct" must be empty for IS (accepted forms go in left_1..left_10)');
    assert.equal(describeQuestionProblem({ code: 'correct_not_allowed', line: 2 }), 'line 2: "correct" must be empty for ES (graded by the teacher)');
    assert.equal(describeQuestionProblem({ code: 'short_answer_forms_invalid', line: 2 }), 'line 2: IS accepted forms must be filled in order from left_1, at most 10, each one line of at most 200 characters without unsupported characters');
    assert.equal(describeQuestionProblem({ code: 'rubric_not_allowed', line: 2 }), 'line 2: "rubric" is only for ES and teacher-graded IS');
});
