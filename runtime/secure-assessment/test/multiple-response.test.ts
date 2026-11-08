import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyFrozenContent, PRODUCTION_QUESTION_REGISTRY } from '../src/question-contract.ts';
import { checkAnswerForContent } from '../src/answer.ts';
import { MULTIPLE_RESPONSE_DESCRIPTOR, MULTIPLE_RESPONSE_KEY, MULTIPLE_RESPONSE_RULE } from '../src/question-types/multiple-response.ts';
import { COMPOSITE_SCORING_RULE, scoreAttempt } from '../src/scoring.ts';
import { buildImportedFrozenContent, buildMultipleResponseFrozenContent } from '../src/exam-provisioning.ts';
import { describeQuestionProblem, parseQuestionFile } from '../src/question-import.ts';

// ASSESS-QUESTION-002 units (record §4.1/§4.2/§5, C01/C02): descriptor vectors V1–V11, the
// mixed-exam vectors and the v2 import vectors.

const ids = ['oA', 'oB', 'oC', 'oD', 'oE'];
const mr = (extra: Record<string, unknown> = {}) => ({
    schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt: 'Pilih bilangan prima',
    options: ids.map(id => ({ id, content: `Pilihan ${id}` })), correctOptionIds: ['oA', 'oC'], maxScore: 2, ...extra,
});
const v1 = { schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal', options: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, content: id })), correctOptionId: 'B', maxScore: 1 };
const SUPPORTED = new Set(['1:MULTIPLE_CHOICE_SINGLE', MULTIPLE_RESPONSE_KEY]);
const score = (payload: unknown) => MULTIPLE_RESPONSE_DESCRIPTOR.score(mr(), payload);

test('C01 the production registry holds v1 and multiple response; content is classified as registered', () => {
    assert.deepEqual(PRODUCTION_QUESTION_REGISTRY.keys(), ['1:MULTIPLE_CHOICE_SINGLE', MULTIPLE_RESPONSE_KEY, '2:TRUE_FALSE', '2:MATCHING', '2:ORDERING']);
    assert.equal(classifyFrozenContent(mr()).kind, 'registered');
    assert.equal(MULTIPLE_RESPONSE_DESCRIPTOR.scoringRuleId, MULTIPLE_RESPONSE_RULE);
    assert.equal(MULTIPLE_RESPONSE_DESCRIPTOR.allowsEmpty, true);
});

test('C01 vectors V1–V10: acceptance and exact-set scoring', () => {
    const accepted: Array<[unknown, string, number]> = [
        [{ selectedOptionIds: ['oA', 'oC'] }, 'CORRECT', 2_000_000], [{ selectedOptionIds: ['oC', 'oA'] }, 'CORRECT', 2_000_000],
        [{ selectedOptionIds: ['oA'] }, 'INCORRECT', 0], [{ selectedOptionIds: ['oA', 'oC', 'oD'] }, 'INCORRECT', 0],
        [{ selectedOptionIds: ['oB', 'oD'] }, 'INCORRECT', 0], [{ selectedOptionIds: [] }, 'UNANSWERED', 0],
    ];
    for (const [payload, outcome, earned] of accepted) {
        assert.equal(checkAnswerForContent(mr(), payload, SUPPORTED), 'valid', JSON.stringify(payload));
        const s = score(payload);
        assert.deepEqual([s.outcome, s.earnedMicro, s.maxMicro], [outcome, BigInt(earned), 2_000_000n], JSON.stringify(payload));
    }
    assert.deepEqual(MULTIPLE_RESPONSE_DESCRIPTOR.validateAnswer(mr(), { selectedOptionIds: [] }), { ok: true, empty: true });
    assert.equal(score(undefined).outcome, 'UNANSWERED', 'V7 no answer');
    for (const bad of [{ selectedOptionIds: ['oA', 'oA'] }, { selectedOptionIds: ['oA', 'oZ'] }, { selectedOptionIds: 'oA' }, { selectedOptionId: 'oA' },
        { selectedOptionIds: ['oA'], extra: 1 }, { selectedOptionIds: [1] }, { selectedOptionIds: ['oA', 'oB', 'oC', 'oD', 'oE', 'oF'] }, null, [], 'oA']) {
        assert.equal(checkAnswerForContent(mr(), bad, SUPPORTED), 'invalid', JSON.stringify(bad));
    }
    // Stored values that are not a valid selection score like no answer (§4A.6).
    for (const stored of [{ selectedOptionIds: 'oA' }, { selectedOptionIds: ['oA', 'oA'] }, { foo: 1 }, 'x']) assert.equal(score(stored).outcome, 'UNANSWERED');
});

test('C01 vector V11: invalid content is refused by readiness and delivery', () => {
    for (const bad of [mr({ correctOptionIds: [] }), mr({ correctOptionIds: ['oA', 'oA'] }), mr({ correctOptionIds: ['oZ'] }), mr({ correctOptionIds: 'oA' }),
        mr({ options: ids.slice(0, 4).map(id => ({ id, content: id })) }), mr({ options: [...ids, 'oF'].map(id => ({ id, content: id })) }),
        mr({ options: ids.map(() => ({ id: 'same', content: 'x' })) }), mr({ maxScore: 0 }), mr({ maxScore: -1 }), mr({ prompt: '' }), mr({ questionType: 'MULTIPLE_CHOICE_SINGLE' })]) {
        assert.deepEqual(MULTIPLE_RESPONSE_DESCRIPTOR.validateContent(bad), { ok: false }, JSON.stringify(bad));
    }
    assert.deepEqual(MULTIPLE_RESPONSE_DESCRIPTOR.validateContent(mr()), { ok: true });
});

test('the Student view never carries the correct set, its size or the score', () => {
    const view = MULTIPLE_RESPONSE_DESCRIPTOR.studentView(mr());
    assert.deepEqual(view, { schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt: 'Pilih bilangan prima', options: ids.map(id => ({ id, content: `Pilihan ${id}` })) });
    assert.doesNotMatch(JSON.stringify(view), /correct|maxScore/);
});

test('C01 mixed-exam vectors: composite rule, exact totals', () => {
    const qs = [{ id: 'v1', frozenContent: v1 }, { id: 'mr', frozenContent: mr() }];
    const full = scoreAttempt(qs, new Map<string, unknown>([['v1', { selectedOptionId: 'B' }], ['mr', { selectedOptionIds: ['oC', 'oA'] }]]));
    assert.ok(full.type === 'scored' && full.score.rule === COMPOSITE_SCORING_RULE);
    assert.deepEqual([full.score.rawScore, full.score.maxScore, full.score.scaledScore], [3, 3, 100]);
    const partial = scoreAttempt(qs, new Map<string, unknown>([['v1', { selectedOptionId: 'B' }], ['mr', { selectedOptionIds: ['oA'] }]]));
    assert.ok(partial.type === 'scored');
    assert.deepEqual([partial.score.rawScore, partial.score.maxScore, partial.score.scaledScore], [1, 3, 33.33]);
});

test('C02 v2 import vectors; v1 files keep their result', () => {
    const V2 = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
    const row = (n: number, type: string, correct: string) => `${n};${type};Soal ${n};p;q;r;s;t;${correct};1`;
    const file = parseQuestionFile([V2, row(1, 'PGK', 'A,C'), row(2, 'pgk', 'a c'), row(3, 'PGK', 'A, C'), row(4, 'PG', 'B')].join('\n'));
    assert.deepEqual(file.problems, []);
    assert.equal(file.template, 'elligble-questions-v2');
    assert.deepEqual(file.questions.map(q => [q.type, q.correctIndexes, q.correctIndex]), [['PGK', [0, 2], -1], ['PGK', [0, 2], -1], ['PGK', [0, 2], -1], ['PG', [1], 1]]);
    const problem = (type: string, correct: string) => parseQuestionFile([V2, row(1, type, correct)].join('\n')).problems.map(p => p.code);
    assert.deepEqual(problem('PGK', 'A,A'), ['correct_duplicate']);
    for (const bad of ['A,F', '', 'semua', 'A;C']) assert.deepEqual(problem('PGK', bad).filter(c => c !== 'column_count'), bad === 'A;C' ? [] : ['correct_invalid'], bad);
    assert.deepEqual(problem('PG', 'A,C'), ['correct_multiple']);
    assert.deepEqual(problem('PGX', 'A'), ['type_invalid']);
    // A comma file needs a quoted multi-letter cell.
    const comma = parseQuestionFile(['no,type,prompt,option_a,option_b,option_c,option_d,option_e,correct,score', '1,PGK,Soal,p,q,r,s,t,"A,C",1'].join('\n'));
    assert.deepEqual([comma.problems, comma.questions[0].correctIndexes], [[], [0, 2]]);
    // column_count: v1 keeps its shape, v2 names its count.
    assert.deepEqual(parseQuestionFile('no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score\n1,x\n').problems, [{ code: 'column_count', line: 2, found: 2 }]);
    assert.deepEqual(parseQuestionFile(V2 + '\n1;PG;x\n').problems, [{ code: 'column_count', line: 2, found: 3, expected: 10 }]);
    const v1File = parseQuestionFile('no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score\n1,Soal,a,b,c,d,e,C,1\n');
    assert.deepEqual([v1File.template, v1File.questions[0].type, v1File.questions[0].correctIndex], ['elligble-questions-v1', 'PG', 2]);
    assert.match(describeQuestionProblem({ code: 'header_invalid', line: 1 }), /^line 1: header must be exactly: no,prompt,option_a.*or no,type,prompt/);
    assert.match(describeQuestionProblem({ code: 'type_invalid', line: 3 }), /PG .* or PGK/);
    assert.match(describeQuestionProblem({ code: 'correct_duplicate', line: 3 }), /more than once/);
});

test('imported questions: PG is v1 content, PGK is multiple response with the right set', () => {
    const parsed = parseQuestionFile('no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score\n1;PG;Satu;a;b;c;d;e;B;1\n2;PGK;Dua;a;b;c;d;e;E,A;2,5\n');
    const [pg, pgk] = parsed.questions.map(buildImportedFrozenContent) as Array<Record<string, any>>;
    assert.equal(pg.schemaVersion, 1);
    assert.equal(pg.questionType, 'MULTIPLE_CHOICE_SINGLE');
    assert.equal(pg.correctOptionId, pg.options[1].id);
    assert.equal(pgk.schemaVersion, 2);
    assert.deepEqual(pgk.correctOptionIds, [pgk.options[0].id, pgk.options[4].id]);
    assert.equal(pgk.maxScore, 2.5);
    assert.throws(() => buildMultipleResponseFrozenContent({ prompt: 'x', options: ['a', 'b', 'c', 'd', 'e'], correctIndexes: [], maxScore: 1 }), /not a valid multiple-response/);
});
