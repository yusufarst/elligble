import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyFrozenContent, PRODUCTION_QUESTION_REGISTRY } from '../src/question-contract.ts';
import { checkAnswerForContent } from '../src/answer.ts';
import { ESSAY_DESCRIPTOR, ESSAY_KEY, ESSAY_RULE, isEssayText } from '../src/question-types/essay.ts';
import { COMPOSITE_SCORING_RULE, isCompositeScore, scoreAttempt, scoreBaselineAttempt } from '../src/scoring.ts';
import { buildBaselineFrozenContent, buildEssayFrozenContent, buildImportedFrozenContent, buildTrueFalseFrozenContent } from '../src/exam-provisioning.ts';
import { QUESTIONS_HEADER_V2_EXTENDED, QUESTIONS_HEADER_V2_RUBRIC, QUESTIONS_HEADER_V2_TOLERANCE, describeQuestionProblem, parseQuestionFile } from '../src/question-import.ts';
import { microToDecimal, parseGradeRequest, parseGradeScore } from '../src/essay-grading.ts';

// ASSESS-QUESTION-008 units (record §4/§5, C01/C02): the text predicate, the descriptor vectors
// E-1..E-4 and E-7, the grade argument, the D1 counts, the mixed vector, the ES import with the
// rubric column, the frozen problem shapes and wording, the builder and the grade request.

const es = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 2, questionType: 'ESSAY', prompt: 'Jelaskan fotosintesis', rubric: 'Sebutkan dua alasan', maxScore: 5, ...extra });
const SUPPORTED = new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', '2:MATCHING', '2:ORDERING', '2:NUMERIC_ANSWER', ESSAY_KEY]);
const M = 1_000_000n;

test('C01 registration, rule, classification and Student view', () => {
    assert.equal(PRODUCTION_QUESTION_REGISTRY.keys().length, 7);
    assert.equal(PRODUCTION_QUESTION_REGISTRY.get(ESSAY_KEY), ESSAY_DESCRIPTOR);
    assert.equal(ESSAY_DESCRIPTOR.scoringRuleId, ESSAY_RULE);
    assert.equal(ESSAY_RULE, 'ESSAY_HUMAN_GRADED_V1');
    assert.equal(ESSAY_DESCRIPTOR.allowsEmpty, true);
    assert.equal(classifyFrozenContent(es()).kind, 'registered');
    // No rubric and no score reach the Student.
    assert.deepEqual(ESSAY_DESCRIPTOR.studentView(es()), { schemaVersion: 2, questionType: 'ESSAY', prompt: 'Jelaskan fotosintesis' });
});

test('C01 the text predicate (§4.1): code points, allowed controls, surrogates', () => {
    assert.equal(isEssayText(''), true);
    assert.equal(isEssayText('a'.repeat(5000)), true);
    assert.equal(isEssayText('a'.repeat(5001)), false);
    assert.equal(isEssayText('😀'.repeat(5000)), true, 'astral characters count once each');
    assert.equal(isEssayText('😀'.repeat(5000) + 'a'), false);
    assert.equal(isEssayText('baris satu\nbaris dua\r\nbaris\ttiga'), true, 'LF, CRLF and tab');
    for (const bad of ['\u0001', '\u0000', '\u001f', '\u007f', '\u0080', '\u0085', '\u009f', 'a\ud800', '\ud800b', '\udc00', 'x\udfffy']) {
        assert.equal(isEssayText(bad), false, JSON.stringify(bad));
    }
    assert.equal(isEssayText(' é'), true, 'U+00A0 and above are allowed');
});

test('C01 E-4 answer refusals and the empty value', () => {
    const check = (payload: unknown) => checkAnswerForContent(es(), payload, SUPPORTED);
    assert.deepEqual(ESSAY_DESCRIPTOR.validateAnswer(es(), { essayText: '' }), { ok: true, empty: true });
    assert.deepEqual(ESSAY_DESCRIPTOR.validateAnswer(es(), { essayText: 'Jawaban saya.' }), { ok: true, empty: false });
    for (const bad of [{ essayText: 'a'.repeat(5001) }, { essayText: '\u0001' }, { essayText: '\u007f' }, { essayText: '\u0085' }, { essayText: '\ud800' },
        { essayText: 5 }, { essayText: 'x', extra: 1 }, {}, null, [], 'teks']) {
        assert.deepEqual(ESSAY_DESCRIPTOR.validateAnswer(es(), bad), { ok: false }, JSON.stringify(bad));
    }
    assert.equal(check({ essayText: 'Baris\nkedua' }), 'valid');
    assert.equal(check({ essayText: '' }), 'valid');
    assert.equal(check({ essayText: 'a'.repeat(5001) }), 'invalid');
    assert.equal(checkAnswerForContent(es(), { essayText: 'x' }, new Set(['1:MULTIPLE_CHOICE_SINGLE'])), 'unsupported', 'a client without 2:ESSAY');
});

test('C01 E-1/E-2/E-3 scoring with and without a grade', () => {
    const score = (payload: unknown, grade?: bigint) => ESSAY_DESCRIPTOR.score(es(), payload, grade === undefined ? undefined : { scoreMicro: grade });
    assert.deepEqual(score({ essayText: 'Jawaban saya.' }), { outcome: 'UNGRADED', earnedMicro: 0n, maxMicro: 5n * M });
    assert.deepEqual(score({ essayText: 'Jawaban saya.' }, 3_500_000n), { outcome: 'GRADED', earnedMicro: 3_500_000n, maxMicro: 5n * M });
    assert.deepEqual(score({ essayText: 'Jawaban saya.' }, 0n), { outcome: 'GRADED', earnedMicro: 0n, maxMicro: 5n * M }, 'a grade of 0 is graded, not ungraded');
    assert.deepEqual(score({ essayText: 'Jawaban saya.' }, 5_000_001n).outcome, 'UNGRADED', 'a grade above max is treated as invalid');
    assert.deepEqual(score({ essayText: 'Jawaban saya.' }, -1n).outcome, 'UNGRADED');
    assert.deepEqual(score({ essayText: '' }, 3n * M), { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: 5n * M });
    assert.deepEqual(score(undefined), { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro: 5n * M });
    assert.deepEqual(score({ essayText: '\u0001' }).outcome, 'UNANSWERED', 'an invalid stored value scores like no answer');
});

test('C01 E-7 invalid content', () => {
    for (const bad of [es({ rubric: 5 }), es({ rubric: undefined }), es({ maxScore: 0 }), es({ maxScore: -1 }), es({ maxScore: Infinity }), es({ prompt: '' }), es({ prompt: '   ' }), es({ schemaVersion: 3 })]) {
        assert.equal(ESSAY_DESCRIPTOR.validateContent(bad).ok, false, JSON.stringify(bad));
    }
    assert.equal(ESSAY_DESCRIPTOR.validateContent(es({ rubric: '' })).ok, true, 'an empty rubric is valid');
});

test('C01 mixed vector, D1 counts and the unchanged all-v1 hand-off', () => {
    const v1 = buildBaselineFrozenContent({ prompt: 'Ibu kota?', options: ['A', 'B', 'C', 'D', 'E'], correctIndex: 0, maxScore: 1 });
    const correctId = (v1 as { correctOptionId: string }).correctOptionId;
    const tf = buildTrueFalseFrozenContent({ prompt: 'Air mendidih pada 100 C', correctValue: true, maxScore: 2 });
    const questions = [{ id: 'q1', frozenContent: v1 }, { id: 'q2', frozenContent: tf }, { id: 'q3', frozenContent: es() }];
    const answers = new Map<string, unknown>([['q1', { selectedOptionId: correctId }], ['q2', { value: false }], ['q3', { essayText: 'Jawaban saya.' }]]);
    const graded = scoreAttempt(questions, answers, undefined, new Map([['q3', 3_500_000n]]));
    assert.equal(graded.type, 'scored');
    if (graded.type !== 'scored' || !isCompositeScore(graded.score)) throw new Error('composite expected');
    assert.equal(graded.score.rule, COMPOSITE_SCORING_RULE);
    assert.deepEqual([graded.score.correct, graded.score.incorrect, graded.score.unanswered, graded.score.gradedCount, graded.score.ungradedCount], [1, 1, 0, 1, 0]);
    assert.deepEqual([graded.score.rawScore, graded.score.maxScore, graded.score.scaledScore], [4.5, 8, 56.25]);
    assert.deepEqual(graded.score.items.map(i => [i.outcome, i.ruleId]), [['CORRECT', 'BASELINE_SINGLE_CHOICE_V1'], ['INCORRECT', 'TRUE_FALSE_EXACT_V1'], ['GRADED', ESSAY_RULE]]);
    const pending = scoreAttempt(questions, answers);
    if (pending.type !== 'scored' || !isCompositeScore(pending.score)) throw new Error('composite expected');
    assert.deepEqual([pending.score.correct, pending.score.incorrect, pending.score.gradedCount, pending.score.ungradedCount, pending.score.rawScore], [1, 1, 0, 1, 1]);
    // All-v1: identical to the baseline result, without the new fields.
    const onlyV1 = [{ id: 'q1', frozenContent: v1 }];
    assert.deepEqual(scoreAttempt(onlyV1, answers, undefined, new Map([['q1', 1n]])), scoreBaselineAttempt(onlyV1, answers));
});

const V2 = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
const H32 = QUESTIONS_HEADER_V2_EXTENDED.join(';');
const H33 = QUESTIONS_HEADER_V2_TOLERANCE.join(';');
const H34 = QUESTIONS_HEADER_V2_RUBRIC.join(';');
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
/** A row of the 34-column file: the ten v2 cells, 22 item cells, the tolerance and the rubric. */
const row34 = (head: string, rubric = '', tolerance = '', items: string[] = []) => [head, ...pad(items, 22), tolerance, rubric].join(';');

test('C02 ES import in 10-, 32-, 33- and 34-column files, with the rubric', () => {
    assert.equal(QUESTIONS_HEADER_V2_RUBRIC.length, 34);
    assert.equal(QUESTIONS_HEADER_V2_RUBRIC[33], 'rubric');
    const file = parseQuestionFile([H34, row34('1;ES;Jelaskan fotosintesis;;;;;;;5', '  Sebutkan dua alasan  '), row34('2;es;Tulis pendapatmu;;;;;;;2,5'),
        row34('3;PG;Soal;a;b;c;d;e;C;1')].join('\n'));
    assert.deepEqual(file.problems, []);
    assert.deepEqual(file.questions.map(q => [q.type, q.essayRubric, q.maxScore]), [['ES', 'Sebutkan dua alasan', 5], ['ES', '', 2.5], ['PG', undefined, 1]]);
    assert.deepEqual(file.questions[0], { line: 2, no: 1, prompt: 'Jelaskan fotosintesis', options: [], correctIndex: -1, maxScore: 5, type: 'ES', correctIndexes: [], essayRubric: 'Sebutkan dua alasan' });
    assert.deepEqual(buildImportedFrozenContent(file.questions[0]), es());
    assert.deepEqual(buildImportedFrozenContent(file.questions[1]), { schemaVersion: 2, questionType: 'ESSAY', prompt: 'Tulis pendapatmu', rubric: '', maxScore: 2.5 });
    assert.deepEqual(parseQuestionFile([V2, '1;ES;Soal;;;;;;;1'].join('\n')).questions[0].essayRubric, '', 'a ten-column file');
    assert.deepEqual(parseQuestionFile([H32, ['1;ES;Soal;;;;;;;1', ...pad([], 22)].join(';')].join('\n')).problems, [], 'a 32-column file');
    assert.deepEqual(parseQuestionFile([H33, ['1;ES;Soal;;;;;;;1', ...pad([], 23)].join(';')].join('\n')).problems, [], 'a 33-column file');
    // A long rubric has no limit of its own (D3).
    assert.equal(parseQuestionFile([H34, row34('1;ES;Soal;;;;;;;1', 'r'.repeat(10000))].join('\n')).questions[0].essayRubric?.length, 10000);
});

test('C02 ES problem order, shapes and the rubric on other types', () => {
    const problems = (r: string) => parseQuestionFile([H34, r].join('\n')).problems;
    assert.deepEqual(problems(row34('1;ES;Soal;x;;;;;;1')), [{ code: 'options_not_allowed', line: 2, type: 'ES' }]);
    assert.deepEqual(problems(row34('1;ES;Soal;x;;;;;A;0', '', '1', ['y'])), [{ code: 'options_not_allowed', line: 2, type: 'ES' }], 'options first');
    assert.deepEqual(problems(row34('1;ES;Soal;;;;;;;1', '', '', ['x'])), [{ code: 'items_not_allowed', line: 2, type: 'ES' }]);
    assert.deepEqual(problems(row34('1;ES;Soal;;;;;;A;0', '', '1', ['x'])), [{ code: 'items_not_allowed', line: 2, type: 'ES' }], 'items before tolerance');
    assert.deepEqual(problems(row34('1;ES;Soal;;;;;;A;0', '', '1')), [{ code: 'tolerance_not_allowed', line: 2 }], 'tolerance before the key');
    assert.deepEqual(problems(row34('1;ES;Soal;;;;;;A;0')), [{ code: 'correct_not_allowed', line: 2 }], 'the key before the score');
    assert.deepEqual(problems(row34('1;ES;Soal;;;;;;;0')), [{ code: 'score_invalid', line: 2 }]);
    assert.deepEqual(problems(row34('1;ES;;;;;;;;1')), [{ code: 'prompt_empty', line: 2 }]);
    assert.deepEqual(problems(row34('1;PG;Soal;a;b;c;d;e;C;1', 'rubrik')), [{ code: 'rubric_not_allowed', line: 2 }]);
    assert.deepEqual(problems(row34('1;IA;Soal;;;;;;2,5;1', 'rubrik', 'x')), [{ code: 'rubric_not_allowed', line: 2 }], 'IA too, before its branch');
    assert.deepEqual(problems(row34('1;XX;Soal;;;;;;;1', 'rubrik')), [{ code: 'type_invalid', line: 2 }], 'the type before the rubric');
    assert.deepEqual(problems(row34('1;BS;Soal;;;;;;B;1', '', '1')), [{ code: 'tolerance_not_allowed', line: 2 }]);
    // Earlier types are unchanged in a 34-column file.
    assert.deepEqual(parseQuestionFile([H34, row34('1;IA;Soal;;;;;;2,5;1', '', '0,1')].join('\n')).questions[0].numericTolerance, '0,1');
    assert.deepEqual(parseQuestionFile([H34, row34('1;UR;Urutkan;;;;;;2,1;2', '', '', ['a', 'b'])].join('\n')).problems, []);
});

test('C02 frozen operator wording', () => {
    assert.equal(describeQuestionProblem({ code: 'options_not_allowed', line: 2, type: 'ES' }), 'line 2: options must be empty for ES');
    assert.equal(describeQuestionProblem({ code: 'items_not_allowed', line: 2, type: 'ES' }), 'line 2: item columns are not used for ES');
    assert.equal(describeQuestionProblem({ code: 'correct_not_allowed', line: 2 }), 'line 2: "correct" must be empty for ES (graded by the teacher)');
    assert.equal(describeQuestionProblem({ code: 'rubric_not_allowed', line: 2 }), 'line 2: "rubric" is only for ES');
    assert.equal(describeQuestionProblem({ code: 'type_invalid', line: 2 }), 'line 2: "type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric), ES (essay) or PGK (multiple answers)');
    assert.ok(describeQuestionProblem({ code: 'header_invalid', line: 1 }).endsWith(` or ${QUESTIONS_HEADER_V2_RUBRIC.join(',')} (elligble-questions-v2)`));
});

test('C01 builder refuses invalid content', () => {
    assert.throws(() => buildEssayFrozenContent({ prompt: '', rubric: '', maxScore: 1 }));
    assert.throws(() => buildEssayFrozenContent({ prompt: 'Soal', rubric: '', maxScore: 0 }));
});

test('C01 grade request and score syntax (§4.3)', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const body = { examInstanceId: id, attemptId: id, snapshotId: id, score: '3,5', expectedRevision: null };
    assert.deepEqual(parseGradeRequest(body), body);
    assert.deepEqual(parseGradeRequest({ ...body, expectedRevision: 2 })?.expectedRevision, 2);
    for (const bad of [{ ...body, extra: 1 }, { examInstanceId: id, attemptId: id, snapshotId: id, score: '1' }, { ...body, score: 3 }, { ...body, attemptId: 'x' },
        { ...body, expectedRevision: 0 }, { ...body, expectedRevision: 1.5 }, { ...body, expectedRevision: '1' }]) {
        assert.equal(parseGradeRequest(bad as Record<string, unknown>), null, JSON.stringify(bad));
    }
    assert.equal(parseGradeScore('3,5'), 3_500_000n);
    assert.equal(parseGradeScore('3.5'), 3_500_000n);
    assert.equal(parseGradeScore('0'), 0n);
    assert.equal(parseGradeScore('5,01'), 5_010_000n);
    for (const bad of ['-1', '2,555', 'abc', '', ' 1', '1e2', '12345']) assert.equal(parseGradeScore(bad), null, bad);
    assert.equal(microToDecimal(3_500_000n), '3.5');
    assert.equal(microToDecimal(4_000_000n), '4');
    assert.equal(microToDecimal(10_000n), '0.01');
    assert.equal(microToDecimal(0n), '0');
});
