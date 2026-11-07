import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import type * as http from 'node:http';
import type * as pg from 'pg';
import {
    classifyFrozenContent, createQuestionRegistry, effectiveSupport, parseDeclaredQuestionTypes, PRODUCTION_QUESTION_REGISTRY,
    V1_SINGLE_CHOICE_DESCRIPTOR, V1_SINGLE_CHOICE_KEY, V1_SINGLE_CHOICE_RULE, type QuestionDescriptor,
} from '../src/question-contract.ts';
import { checkAnswerForContent, handleSaveAnswer, isAnswerForQuestion } from '../src/answer.ts';
import { handleQuestionDelivery } from '../src/question-delivery.ts';
import { BASELINE_SCORING_RULE, COMPOSITE_SCORING_RULE, scoreAttempt, scoreBaselineAttempt, type ScorableQuestion } from '../src/scoring.ts';

// ASSESS-QUESTION-001 units (record §5/§5A, C01–C03, C06): classification, v1 golden
// equivalence, the client-declared types header, handler-level ordering and composite scoring
// through a test-only registry. Nothing here registers a type in production.

const v1 = (index: number, correct = 'B', maxScore = 1) => ({
    schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: `Soal ${index}`,
    options: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, content: `Pilihan ${id}${index}` })), correctOptionId: correct, maxScore,
});

/** A test-only boolean type: {value: true|false}, "" is the empty (cleared) value. */
const TEST_KEY = '2:TEST_BOOLEAN';
const TEST_RULE = 'TEST_BOOLEAN_V1';
const testBoolean = (correct: boolean, maxScore = 2) => ({ schemaVersion: 2, questionType: 'TEST_BOOLEAN', prompt: 'Benar atau salah?', correct, maxScore });
const TEST_DESCRIPTOR: QuestionDescriptor = {
    key: TEST_KEY, scoringRuleId: TEST_RULE, allowsEmpty: true,
    validateContent: c => (typeof c.correct === 'boolean' && typeof c.maxScore === 'number' && c.maxScore > 0 ? { ok: true } : { ok: false }),
    studentView: c => ({ schemaVersion: 2, questionType: 'TEST_BOOLEAN', prompt: c.prompt }),
    validateAnswer: (_c, p) => {
        if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).join() !== 'value') return { ok: false };
        const value = (p as { value: unknown }).value;
        if (value === '') return { ok: true, empty: true };
        return typeof value === 'boolean' ? { ok: true, empty: false } : { ok: false };
    },
    score: (c, p) => {
        const maxMicro = BigInt(Math.round((c.maxScore as number) * 1_000_000));
        const value = p && typeof p === 'object' ? (p as { value?: unknown }).value : undefined;
        if (typeof value !== 'boolean') return { outcome: 'UNANSWERED', earnedMicro: 0n, maxMicro };
        return value === c.correct ? { outcome: 'CORRECT', earnedMicro: maxMicro, maxMicro } : { outcome: 'INCORRECT', earnedMicro: 0n, maxMicro };
    },
};
const TEST_REGISTRY = createQuestionRegistry([V1_SINGLE_CHOICE_DESCRIPTOR, TEST_DESCRIPTOR]);

test('C01 classification is total, deterministic and never reinterprets v1', () => {
    const cases: Array<[unknown, string]> = [
        [null, 'malformed'], ['x', 'malformed'], [[], 'malformed'], [{}, 'malformed'],
        [{ schemaVersion: '1' }, 'malformed'], [{ schemaVersion: 1.5 }, 'malformed'], [{ schemaVersion: 0 }, 'malformed'], [{ schemaVersion: 100 }, 'malformed'],
        [v1(1), 'v1'], [{ schemaVersion: 1, questionType: 'INVALID' }, 'v1'], [{ schemaVersion: 1 }, 'v1'],
        [{ schemaVersion: 2 }, 'malformed'], [{ schemaVersion: 2, questionType: 'lower' }, 'malformed'], [{ schemaVersion: 2, questionType: 'X'.repeat(41) }, 'malformed'],
        [{ schemaVersion: 2, questionType: 'UNREGISTERED_EXAMPLE' }, 'unsupported'], [{ ...v1(1), schemaVersion: 2 }, 'unsupported'], [{ schemaVersion: 99, questionType: 'A' }, 'unsupported'],
    ];
    for (const [content, kind] of cases) {
        assert.equal(classifyFrozenContent(content).kind, kind, JSON.stringify(content));
        assert.deepEqual(classifyFrozenContent(content), classifyFrozenContent(content));
    }
    const unsupported = classifyFrozenContent({ schemaVersion: 2, questionType: 'UNREGISTERED_EXAMPLE' });
    assert.deepEqual(unsupported, { kind: 'unsupported', key: '2:UNREGISTERED_EXAMPLE' });
    const registered = classifyFrozenContent(testBoolean(true), TEST_REGISTRY);
    assert.equal(registered.kind, 'registered');
    assert.equal(classifyFrozenContent(testBoolean(true)).kind, 'unsupported', 'the production registry holds only v1');
    assert.deepEqual(PRODUCTION_QUESTION_REGISTRY.keys(), [V1_SINGLE_CHOICE_KEY, '2:MULTIPLE_RESPONSE', '2:TRUE_FALSE'], 'ASSESS-QUESTION-002/003 register multiple response and true/false');
    assert.equal(V1_SINGLE_CHOICE_RULE, BASELINE_SCORING_RULE);
    assert.throws(() => createQuestionRegistry([V1_SINGLE_CHOICE_DESCRIPTOR, V1_SINGLE_CHOICE_DESCRIPTOR]), /duplicate/);
    assert.throws(() => createQuestionRegistry([{ ...TEST_DESCRIPTOR, key: 'bad' }]), /invalid descriptor key/);
});

test('C02 v1 golden vectors: scoring, Student view and answer acceptance are unchanged', () => {
    const q = (id: string, content: unknown): ScorableQuestion => ({ id, frozenContent: content });
    const sets: ScorableQuestion[][] = [
        [], [q('a', v1(1)), q('b', v1(2, 'C', 2.5)), q('c', v1(3, 'A', 0.01))],
        [q('a', v1(1)), q('x', { schemaVersion: 2, questionType: 'TRUE_FALSE' })], [q('x', { ...v1(1), maxScore: 0 })], [q('m', { foo: 1 }), q('a', v1(1))],
        [q('a', v1(1)), q('tiny', { ...v1(2), maxScore: 1e-9 })], [q('a', v1(1, 'B', 1000)), q('b', v1(2, 'E', 0.01))],
        Array.from({ length: 40 }, (_, i) => q(`q${i}`, v1(i, 'B', 1))), Array.from({ length: 45 }, (_, i) => q(`q${i}`, v1(i, 'D', 1))),
    ];
    const answerSets: Array<Map<string, unknown>> = [
        new Map(), new Map<string, unknown>([['a', { selectedOptionId: 'B' }], ['b', { selectedOptionId: 'A' }], ['c', { selectedOptionId: 'A' }]]),
        new Map<string, unknown>([['a', { selectedOptionId: '' }], ['b', { selectedOptionId: 7 }], ['c', 'B']]),
        new Map<string, unknown>(Array.from({ length: 45 }, (_, i) => [`q${i}`, { selectedOptionId: i < 34 ? 'B' : 'D' }] as [string, unknown])),
    ];
    for (const questions of sets) for (const answers of answerSets) {
        assert.deepEqual(scoreAttempt(questions, answers), scoreBaselineAttempt(questions, answers));
        assert.deepEqual(scoreAttempt(questions, answers, TEST_REGISTRY), scoreBaselineAttempt(questions, answers), 'no registered v2 row: hand-off');
    }
    // The v1 descriptor scores each item exactly as the baseline rule.
    const qs = [q('a', v1(1)), q('b', v1(2, 'C', 2.5))];
    const answers = new Map<string, unknown>([['a', { selectedOptionId: 'B' }], ['b', { selectedOptionId: 'A' }]]);
    const baseline = scoreBaselineAttempt(qs, answers);
    assert.ok(baseline.type === 'scored');
    for (const item of baseline.score.items) {
        const content = qs.find(x => x.id === item.questionSnapshotId)!.frozenContent as Record<string, unknown>;
        const scored = V1_SINGLE_CHOICE_DESCRIPTOR.score(content, answers.get(item.questionSnapshotId));
        assert.equal(scored.outcome, item.outcome);
        assert.equal(Number(scored.earnedMicro) / 1e6, item.score);
        assert.equal(Number(scored.maxMicro) / 1e6, item.maxScore);
    }
    // Student view: exactly the object delivery produced before this Task.
    const content = v1(4);
    assert.deepEqual(JSON.stringify({ snapshotId: 's', ...V1_SINGLE_CHOICE_DESCRIPTOR.studentView(content) }), JSON.stringify({
        snapshotId: 's', schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: content.prompt,
        options: content.options.map(o => ({ id: o.id, content: o.content })),
    }));
    // Answer acceptance equals isAnswerForQuestion for every non-v2 row, minimal content included.
    const contents: unknown[] = [v1(1), { schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', options: [{ id: 'A' }, { id: 'B' }] },
        { schemaVersion: 1, questionType: 'OTHER', options: [{ id: 'A' }] }, { questionType: 'MULTIPLE_CHOICE_SINGLE', options: [{ id: 'A' }] }, null, { schemaVersion: 'x', questionType: 'MULTIPLE_CHOICE_SINGLE', options: [{ id: 'A' }] }];
    const payloads: unknown[] = [{ selectedOptionId: 'A' }, { selectedOptionId: 'B' }, { selectedOptionId: 'Z' }, { selectedOptionId: 'A', extra: 1 }, {}, [], null, 'A', { selectedOptionId: 3 }];
    const v1Only = new Set([V1_SINGLE_CHOICE_KEY]);
    for (const c of contents) for (const p of payloads) {
        assert.equal(checkAnswerForContent(c, p, v1Only), isAnswerForQuestion(c, p) ? 'valid' : 'invalid', `${JSON.stringify(c)} ${JSON.stringify(p)}`);
    }
    // A version 2 single choice row is refused, no longer accepted; a v1 row without declared v1 too.
    assert.equal(checkAnswerForContent({ ...v1(1), schemaVersion: 2 }, { selectedOptionId: 'B' }, v1Only), 'unsupported');
    assert.equal(isAnswerForQuestion({ ...v1(1), schemaVersion: 2 }, { selectedOptionId: 'B' }), true, 'this is what was accepted before');
    assert.equal(checkAnswerForContent(v1(1), { selectedOptionId: 'B' }, new Set()), 'unsupported');
    assert.equal(checkAnswerForContent({ schemaVersion: 2, questionType: 'TRUE_FALSE' }, { value: true }, v1Only), 'unsupported');
});

test('C03 declared types: absent means v1; lists are strict', () => {
    const absent = parseDeclaredQuestionTypes(undefined);
    assert.ok(absent.ok);
    assert.deepEqual([...absent.keys], [V1_SINGLE_CHOICE_KEY]);
    const ok = (v: string | string[]) => { const r = parseDeclaredQuestionTypes(v); assert.ok(r.ok, String(v)); return [...r.keys]; };
    assert.deepEqual(ok('1:MULTIPLE_CHOICE_SINGLE'), [V1_SINGLE_CHOICE_KEY]);
    assert.deepEqual(ok('1:MULTIPLE_CHOICE_SINGLE, 2:TEST_BOOLEAN'), [V1_SINGLE_CHOICE_KEY, TEST_KEY], 'Node joins repeats with ", "');
    assert.deepEqual(ok(' \t1:MULTIPLE_CHOICE_SINGLE\t'), [V1_SINGLE_CHOICE_KEY]);
    assert.deepEqual(ok(['1:MULTIPLE_CHOICE_SINGLE', '2:TEST_BOOLEAN']), [V1_SINGLE_CHOICE_KEY, TEST_KEY]);
    assert.equal(ok(Array.from({ length: 16 }, (_, i) => `${i + 1}:T`).join(',')).length, 16);
    for (const bad of ['', ' ', ',', '1:MULTIPLE_CHOICE_SINGLE,', 'bogus', '0:A', '100:A', '1:lower', '1:A B', '1:MULTIPLE_CHOICE_SINGLE,1:MULTIPLE_CHOICE_SINGLE',
        Array.from({ length: 17 }, (_, i) => `${i + 1}:T`).join(','), `1:${'A'.repeat(41)}`]) {
        assert.equal(parseDeclaredQuestionTypes(bad).ok, false, JSON.stringify(bad));
    }
    assert.deepEqual([...effectiveSupport(new Set([V1_SINGLE_CHOICE_KEY, TEST_KEY]))], [V1_SINGLE_CHOICE_KEY], 'the registry in use decides');
    assert.deepEqual([...effectiveSupport(new Set([V1_SINGLE_CHOICE_KEY, TEST_KEY]), TEST_REGISTRY)], [V1_SINGLE_CHOICE_KEY, TEST_KEY]);
});

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const TENANT = '22222222-2222-4222-8222-222222222222';
function capture(): { res: http.ServerResponse; done: Promise<{ status: number; body: unknown }> } {
    let resolve!: (v: { status: number; body: unknown }) => void;
    const done = new Promise<{ status: number; body: unknown }>(r => { resolve = r; });
    const res = { statusCode: 0, writeHead(status: number) { this.statusCode = status; return this; }, end(body?: string) { resolve({ status: this.statusCode, body: body ? JSON.parse(body) : null }); } };
    return { res: res as unknown as http.ServerResponse, done };
}
const untouchedPool = () => {
    let connects = 0;
    return { pool: { connect: async () => { connects++; throw new Error('no database work expected'); } } as unknown as pg.Pool, connects: () => connects };
};

test('C03 handler level: a malformed header is 400 after the context check and before any connection', async () => {
    for (const header of ['bogus', '', '1:MULTIPLE_CHOICE_SINGLE,1:MULTIPLE_CHOICE_SINGLE']) {
        const p = untouchedPool();
        const r = capture();
        await handleQuestionDelivery({ method: 'GET', url: `/api/v1/assessment/questions?attemptId=${ATTEMPT}`, headers: { 'x-question-types': header } } as unknown as http.IncomingMessage,
            r.res, { pool: p.pool, getAuthorizedContext: () => ({ tenantId: TENANT, authorizedAttemptId: ATTEMPT }) });
        assert.deepEqual(await r.done, { status: 400, body: { error: 'invalid_request' } });
        assert.equal(p.connects(), 0);

        const s = untouchedPool();
        const req = Object.assign(new PassThrough(), { method: 'POST', headers: { 'x-question-types': header } });
        const w = capture();
        await handleSaveAnswer(req as unknown as http.IncomingMessage, w.res, { pool: s.pool, getAuthorizedContext: () => ({ tenantId: TENANT, authorizedAttemptId: ATTEMPT }) });
        req.end(JSON.stringify({}));
        assert.deepEqual(await w.done, { status: 400, body: { error: 'invalid_request' } });
        assert.equal(s.connects(), 0);
    }
    // Authorization still comes first.
    const p = untouchedPool(), r = capture();
    await handleQuestionDelivery({ method: 'GET', url: `/api/v1/assessment/questions?attemptId=${ATTEMPT}`, headers: { 'x-question-types': 'bogus' } } as unknown as http.IncomingMessage,
        r.res, { pool: p.pool, getAuthorizedContext: () => null });
    assert.equal((await r.done).status, 403);
    const s = untouchedPool(), w = capture();
    await handleSaveAnswer(Object.assign(new PassThrough(), { method: 'POST', headers: { 'x-question-types': 'bogus' } }) as unknown as http.IncomingMessage, w.res, { pool: s.pool, getAuthorizedContext: () => null });
    assert.equal((await w.done).status, 403);
});

test('C06 composite scoring through a test-only registry: per-item rules, exact sums, empty is unanswered', () => {
    const qs: ScorableQuestion[] = [
        { id: 'a', frozenContent: v1(1) }, { id: 't1', frozenContent: testBoolean(true, 2) }, { id: 't2', frozenContent: testBoolean(false, 0.33) },
        { id: 'b', frozenContent: v1(2, 'C', 1.5) },
    ];
    const answers = new Map<string, unknown>([['a', { selectedOptionId: 'B' }], ['t1', { value: '' }], ['t2', { value: false }], ['b', { selectedOptionId: 'A' }]]);
    const r = scoreAttempt(qs, answers, TEST_REGISTRY);
    assert.ok(r.type === 'scored' && r.score.rule === COMPOSITE_SCORING_RULE);
    const s = r.score as Extract<typeof r.score, { rule: typeof COMPOSITE_SCORING_RULE }>;
    assert.deepEqual(s.items.map(i => [i.questionSnapshotId, i.ruleId, i.outcome, i.scoreMicro, i.maxScoreMicro]), [
        ['a', BASELINE_SCORING_RULE, 'CORRECT', 1_000_000n, 1_000_000n], ['t1', TEST_RULE, 'UNANSWERED', 0n, 2_000_000n],
        ['t2', TEST_RULE, 'CORRECT', 330_000n, 330_000n], ['b', BASELINE_SCORING_RULE, 'INCORRECT', 0n, 1_500_000n],
    ]);
    assert.equal(s.rawScoreMicro, 1_330_000n);
    assert.equal(s.maxScoreMicro, 4_830_000n);
    assert.equal(s.scaledScore, 27.54, '1.33 / 4.83 x 100 = 27.536 half up');
    assert.deepEqual([s.correct, s.incorrect, s.unanswered], [2, 1, 1]);
    // An exam of only the new type also uses the composite rule.
    const only = scoreAttempt([{ id: 't', frozenContent: testBoolean(true) }], new Map(), TEST_REGISTRY);
    assert.ok(only.type === 'scored' && only.score.rule === COMPOSITE_SCORING_RULE && only.score.unanswered === 1);
    // Any unsupported, malformed or invalid row makes the attempt unscorable: first in order.
    for (const [bad, id] of [[{ schemaVersion: 2, questionType: 'TRUE_FALSE' }, 'x'], [{ foo: 1 }, 'x'], [testBoolean(true, 0), 'x'], [{ ...v1(9), options: [] }, 'x']] as const) {
        assert.deepEqual(scoreAttempt([{ id: 't', frozenContent: testBoolean(true) }, { id, frozenContent: bad }, { id: 'y', frozenContent: { foo: 2 } }], new Map(), TEST_REGISTRY),
            { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: id });
    }
    // Empty values are accepted only when the type allows them.
    const supported = new Set([V1_SINGLE_CHOICE_KEY, TEST_KEY]);
    assert.equal(checkAnswerForContent(testBoolean(true), { value: '' }, supported, TEST_REGISTRY), 'valid');
    assert.equal(checkAnswerForContent(testBoolean(true), { value: '' }, supported, createQuestionRegistry([{ ...TEST_DESCRIPTOR, allowsEmpty: false }])), 'invalid');
    assert.equal(checkAnswerForContent(testBoolean(true), { value: 'ya' }, supported, TEST_REGISTRY), 'invalid');
    assert.equal(checkAnswerForContent(testBoolean(true), { value: true }, new Set([V1_SINGLE_CHOICE_KEY]), TEST_REGISTRY), 'unsupported');
    assert.equal(checkAnswerForContent(testBoolean(true, 0), { value: true }, supported, TEST_REGISTRY), 'invalid');
});
