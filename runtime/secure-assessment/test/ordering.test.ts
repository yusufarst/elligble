import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyFrozenContent, PRODUCTION_QUESTION_REGISTRY } from '../src/question-contract.ts';
import { checkAnswerForContent } from '../src/answer.ts';
import { ORDERING_DESCRIPTOR, ORDERING_KEY, ORDERING_RULE } from '../src/question-types/ordering.ts';
import { COMPOSITE_SCORING_RULE, scoreAttempt } from '../src/scoring.ts';
import { buildImportedFrozenContent } from '../src/exam-provisioning.ts';
import { QUESTIONS_HEADER_V2_EXTENDED, describeQuestionProblem, parseQuestionFile } from '../src/question-import.ts';

// ASSESS-QUESTION-005 units (record §4/§4A/§5, C01/C02): descriptor vectors O1–O6, the mixed
// vector, the UR import vectors, the frozen problem shapes and wording, and the builder.

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `I${i + 1}`, content: `Langkah ${i + 1}` }));
const ur = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 2, questionType: 'ORDERING', prompt: 'Urutkan', items: items(3), correctOrder: ['I3', 'I1', 'I2'], maxScore: 2, ...extra });
const SUPPORTED = new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', '2:MATCHING', ORDERING_KEY]);
const outcome = (payload: unknown) => { const s = ORDERING_DESCRIPTOR.score(ur(), payload); return [s.outcome, s.earnedMicro]; };

test('C01 registration, rule and classification', () => {
    assert.deepEqual(PRODUCTION_QUESTION_REGISTRY.keys(), ['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', '2:MATCHING', ORDERING_KEY, '2:NUMERIC_ANSWER']);
    assert.equal(classifyFrozenContent(ur()).kind, 'registered');
    assert.equal(ORDERING_DESCRIPTOR.scoringRuleId, ORDERING_RULE);
    assert.equal(ORDERING_RULE, 'ORDERING_EXACT_SEQUENCE_V1');
    assert.equal(ORDERING_DESCRIPTOR.allowsEmpty, true);
});

test('C01 vectors O1–O4: exact sequence, swapped, empty, none', () => {
    assert.equal(checkAnswerForContent(ur(), { orderedItemIds: ['I3', 'I1', 'I2'] }, SUPPORTED), 'valid');
    assert.deepEqual(outcome({ orderedItemIds: ['I3', 'I1', 'I2'] }), ['CORRECT', 2_000_000n], 'O1');
    assert.equal(checkAnswerForContent(ur(), { orderedItemIds: ['I1', 'I3', 'I2'] }, SUPPORTED), 'valid');
    assert.deepEqual(outcome({ orderedItemIds: ['I1', 'I3', 'I2'] }), ['INCORRECT', 0n], 'O2');
    assert.deepEqual(ORDERING_DESCRIPTOR.validateAnswer(ur(), { orderedItemIds: [] }), { ok: true, empty: true }, 'O3 empty');
    assert.deepEqual(ORDERING_DESCRIPTOR.validateAnswer(ur(), { orderedItemIds: ['I1', 'I3', 'I2'] }), { ok: true, empty: false });
    assert.deepEqual(outcome({ orderedItemIds: [] }), ['UNANSWERED', 0n], 'O3');
    assert.deepEqual(outcome(undefined), ['UNANSWERED', 0n], 'O4');
    assert.equal(checkAnswerForContent(ur(), { orderedItemIds: ['I3', 'I1', 'I2'] }, new Set(['1:MULTIPLE_CHOICE_SINGLE', '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE', '2:MATCHING'])), 'unsupported', 'a client that does not declare ordering');
});

test('C01 vector O5: refusals', () => {
    const bad: unknown[] = [
        { orderedItemIds: ['I3', 'I1'] },
        { orderedItemIds: ['I3', 'I3', 'I1'] },
        { orderedItemIds: ['I3', 'I1', 'I9'] },
        { orderedItemIds: ['I3', 'I1', 'I2', 'I2'] },
        { orderedItemIds: ['I3', 1, 'I2'] },
        { orderedItemIds: ['I3', 'I1', 'I2'], extra: 1 },
        { orderedItemIds: 'I3,I1,I2' },
        { orderedItemIds: null },
        { selectedOptionIds: [] },
        [],
        {},
        null,
    ];
    for (const payload of bad) assert.equal(checkAnswerForContent(ur(), payload, SUPPORTED), 'invalid', JSON.stringify(payload));
    for (const stored of [{ orderedItemIds: ['I3', 'I1'] }, { orderedItemIds: 'x' }, 'x', {}]) assert.equal(ORDERING_DESCRIPTOR.score(ur(), stored).outcome, 'UNANSWERED');
});

test('C01 vector O6: invalid content; the Student view carries no key', () => {
    const cases = [
        ur({ items: items(1), correctOrder: ['I1'] }),
        ur({ items: items(11), correctOrder: items(11).map(i => i.id) }),
        ur({ items: [{ id: 'I1', content: 'a' }, { id: 'I1', content: 'b' }, { id: 'I3', content: 'c' }] }),
        ur({ items: [{ id: ' ', content: 'a' }, ...items(3).slice(1)] }),
        ur({ items: [{ id: 'I1', content: '' }, ...items(3).slice(1)] }),
        ur({ correctOrder: undefined }),
        ur({ correctOrder: ['I3', 'I1'] }),
        ur({ correctOrder: ['I3', 'I3', 'I1'] }),
        ur({ correctOrder: ['I3', 'I1', 'I9'] }),
        ur({ correctOrder: 'I3,I1,I2' }),
        ur({ correctOrder: [] }),
        ur({ maxScore: 0 }), ur({ maxScore: -1 }), ur({ maxScore: Number.NaN }), ur({ maxScore: Number.POSITIVE_INFINITY }),
        ur({ prompt: '' }),
        ur({ questionType: 'MATCHING' }),
    ];
    for (const bad of cases) assert.deepEqual(ORDERING_DESCRIPTOR.validateContent(bad), { ok: false }, JSON.stringify(bad).slice(0, 120));
    assert.deepEqual(ORDERING_DESCRIPTOR.validateContent(ur({ items: items(10), correctOrder: items(10).map(i => i.id).reverse() })), { ok: true }, '10 items');
    const view = ORDERING_DESCRIPTOR.studentView(ur({ items: items(3).map(i => ({ ...i, extra: 'x' })) }));
    assert.deepEqual(view, { schemaVersion: 2, questionType: 'ORDERING', prompt: 'Urutkan', items: items(3) }, 'items projected to exactly {id, content}');
    assert.doesNotMatch(JSON.stringify(view), /correct|maxScore/);
});

test('C01 mixed vector: v1 + multiple response + true/false wrong + matching exact + ordering exact gives 8/10 = 80', () => {
    const v1 = { schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Soal', options: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, content: id })), correctOptionId: 'B', maxScore: 1 };
    const mr = { schemaVersion: 2, questionType: 'MULTIPLE_RESPONSE', prompt: 'Pilih', options: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, content: id })), correctOptionIds: ['a', 'c'], maxScore: 2 };
    const tf = { schemaVersion: 2, questionType: 'TRUE_FALSE', prompt: 'Pernyataan', correctValue: true, maxScore: 2 };
    const mj = { schemaVersion: 2, questionType: 'MATCHING', prompt: 'Pasangkan', leftItems: [{ id: 'L1', content: 'a' }, { id: 'L2', content: 'b' }], rightItems: [{ id: 'R1', content: 'x' }, { id: 'R2', content: 'y' }],
        correctPairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L2', rightId: 'R1' }], maxScore: 3 };
    const r = scoreAttempt([{ id: 'v', frozenContent: v1 }, { id: 'm', frozenContent: mr }, { id: 't', frozenContent: tf }, { id: 'j', frozenContent: mj }, { id: 'o', frozenContent: ur() }],
        new Map<string, unknown>([['v', { selectedOptionId: 'B' }], ['m', { selectedOptionIds: ['c', 'a'] }], ['t', { value: false }],
            ['j', { pairs: [{ leftId: 'L1', rightId: 'R2' }, { leftId: 'L2', rightId: 'R1' }] }], ['o', { orderedItemIds: ['I3', 'I1', 'I2'] }]]));
    assert.ok(r.type === 'scored' && r.score.rule === COMPOSITE_SCORING_RULE);
    assert.deepEqual([r.score.rawScore, r.score.maxScore, r.score.scaledScore], [8, 10, 80]);
});

const HEADER = QUESTIONS_HEADER_V2_EXTENDED.join(';');
function row(head: string, left: string[], right: string[] = []): string {
    const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
    return [head, ...pad(left, 10), ...pad(right, 12)].join(';');
}
const urRow = (n: number, correct: string, left = ['Siram', 'Siapkan pot', 'Tanam biji'], right: string[] = [], type = 'UR', opts = ';;;;') =>
    row(`${n};${type};Urutkan ${n};${opts};${correct};2`, left, right);

test('C02 UR import vectors, frozen problem shapes and wording, the builder and the authored-order flag', () => {
    const file = parseQuestionFile([HEADER, urRow(1, '3,1,2'), urRow(2, '3 1 2', undefined, [], 'ur'), row('3;PG;Soal;a;b;c;d;e;C;1', []),
        row('4;MJ;Pasangkan;;;;;;B,A;2', ['Sapi', 'Kucing'], ['Ikan', 'Rumput'])].join('\n'));
    assert.deepEqual(file.problems, []);
    assert.deepEqual(file.questions.map(q => [q.type, q.correctSequence, q.leftItems]),
        [['UR', [2, 0, 1], ['Siram', 'Siapkan pot', 'Tanam biji']], ['UR', [2, 0, 1], ['Siram', 'Siapkan pot', 'Tanam biji']], ['PG', undefined, undefined], ['MJ', undefined, ['Sapi', 'Kucing']]]);
    const problems = (r: string) => parseQuestionFile([HEADER, r].join('\n')).problems;
    assert.deepEqual(problems(urRow(1, '3,1')), [{ code: 'correct_invalid', line: 2, type: 'UR' }]);
    assert.deepEqual(problems(urRow(1, '3,1,4')), [{ code: 'correct_invalid', line: 2, type: 'UR' }]);
    assert.deepEqual(problems(urRow(1, '03,1,2')), [{ code: 'correct_invalid', line: 2, type: 'UR' }], 'no leading zero');
    assert.deepEqual(problems(urRow(1, 'C,A,B')), [{ code: 'correct_invalid', line: 2, type: 'UR' }]);
    assert.deepEqual(problems(urRow(1, '3,3,1')), [{ code: 'correct_duplicate', line: 2, type: 'UR' }]);
    assert.deepEqual(problems(urRow(1, '1,2', ['Siram', '', 'Tanam biji'])), [{ code: 'ordering_items_invalid', line: 2 }], 'a gap');
    assert.deepEqual(problems(urRow(1, '1', ['Siram'])), [{ code: 'ordering_items_invalid', line: 2 }], 'one item');
    assert.deepEqual(problems(urRow(1, '3,1,2', undefined, ['x'])), [{ code: 'items_not_allowed', line: 2, type: 'UR' }]);
    assert.deepEqual(problems(urRow(1, '3,1,2', ['Siram', 'siram ', 'Tanam'])), [{ code: 'items_duplicate', line: 2, type: 'UR' }]);
    assert.deepEqual(problems(urRow(1, '3,1,2', undefined, [], 'UR', 'x;;;;')), [{ code: 'options_not_allowed', line: 2, type: 'UR' }]);
    assert.deepEqual(problems(row('1;UR;Urutkan;;;;;;3,1,2;0', ['a', 'b', 'c'])), [{ code: 'score_invalid', line: 2 }]);
    const V2 = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
    assert.deepEqual(parseQuestionFile([V2, '1;UR;Urutkan;;;;;;3,1,2;2'].join('\n')).problems, [{ code: 'columns_missing', line: 2, type: 'UR' }], 'UR in a ten-column file');
    assert.deepEqual(parseQuestionFile([V2, '1;MJ;Pasangkan;;;;;;B,C,A;3'].join('\n')).problems, [{ code: 'columns_missing', line: 2 }], 'MJ shape unchanged');

    assert.equal(describeQuestionProblem({ code: 'type_invalid', line: 2 }), 'line 2: "type" must be PG (single answer), BS (true/false), MJ (matching), UR (ordering), IA (numeric) or PGK (multiple answers)');
    assert.match(describeQuestionProblem({ code: 'type_invalid', line: 2 }), /PG .* or PGK/);
    assert.equal(describeQuestionProblem({ code: 'options_not_allowed', line: 2, type: 'UR' }), 'line 2: options must be empty for UR');
    assert.equal(describeQuestionProblem({ code: 'columns_missing', line: 2, type: 'UR' }), 'line 2: UR needs the v2 header with left_1..left_10');
    assert.equal(describeQuestionProblem({ code: 'columns_missing', line: 2 }), 'line 2: MJ needs the v2 header with left_1..left_10 and right_a..right_l');
    assert.equal(describeQuestionProblem({ code: 'ordering_items_invalid', line: 2 }), 'line 2: UR needs 2 to 10 items, filled in order from left_1');
    assert.equal(describeQuestionProblem({ code: 'items_not_allowed', line: 2, type: 'UR' }), 'line 2: right item columns are not used for UR');
    assert.equal(describeQuestionProblem({ code: 'items_not_allowed', line: 2 }), 'line 2: left and right item columns are only for MJ and UR');
    assert.equal(describeQuestionProblem({ code: 'items_duplicate', line: 2, type: 'UR' }), 'line 2: items must differ from each other');
    assert.equal(describeQuestionProblem({ code: 'items_duplicate', line: 2, side: 'left' }), 'line 2: left items must differ from each other');
    assert.equal(describeQuestionProblem({ code: 'correct_invalid', line: 2, type: 'UR' }), 'line 2: "correct" for UR must list every item number once, in the correct order (for example 3,1,2)');
    assert.equal(describeQuestionProblem({ code: 'correct_duplicate', line: 2, type: 'UR' }), 'line 2: "correct" for UR uses an item number more than once');

    const built = buildImportedFrozenContent(file.questions[0]) as { items: Array<{ id: string; content: string }>; correctOrder: string[] };
    assert.equal(ORDERING_DESCRIPTOR.validateContent(built as unknown as Record<string, unknown>).ok, true);
    assert.deepEqual(built.items.map(i => i.content), ['Siram', 'Siapkan pot', 'Tanam biji'], 'authored (display) order');
    assert.deepEqual(built.correctOrder.map(id => built.items.find(i => i.id === id)?.content), ['Tanam biji', 'Siram', 'Siapkan pot']);
});
