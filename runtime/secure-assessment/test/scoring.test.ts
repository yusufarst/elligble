import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BASELINE_SCORING_RULE, scaleToHundred, scoreBaselineAttempt, selectedOptionOf, type ScorableQuestion } from '../src/scoring.ts';

function question(id: string, correct: string, maxScore = 1): ScorableQuestion {
    return {
        id,
        frozenContent: {
            schemaVersion: 1,
            questionType: 'MULTIPLE_CHOICE_SINGLE',
            prompt: `Soal ${id}`,
            options: ['opt_a', 'opt_b', 'opt_c', 'opt_d', 'opt_e'].map(optionId => ({ id: optionId, content: optionId })),
            correctOptionId: correct,
            maxScore,
        },
    };
}

const answer = (optionId: string) => ({ selectedOptionId: optionId });

test('correct, incorrect and unanswered questions under equal weight (D04.8-04/05/07)', () => {
    const questions = [question('q1', 'opt_b'), question('q2', 'opt_c'), question('q3', 'opt_a')];
    const result = scoreBaselineAttempt(questions, new Map<string, unknown>([['q1', answer('opt_b')], ['q2', answer('opt_a')]]));
    assert.equal(result.type, 'scored');
    if (result.type !== 'scored') return;
    assert.equal(result.score.rule, BASELINE_SCORING_RULE);
    assert.deepEqual(result.score.items.map(i => [i.questionSnapshotId, i.outcome, i.score, i.maxScore]), [
        ['q1', 'CORRECT', 1, 1],
        ['q2', 'INCORRECT', 0, 1],
        ['q3', 'UNANSWERED', 0, 1],
    ]);
    assert.equal(result.score.correct, 1);
    assert.equal(result.score.incorrect, 1);
    assert.equal(result.score.unanswered, 1);
    assert.equal(result.score.rawScore, 1);
    assert.equal(result.score.maxScore, 3);
    assert.equal(result.score.scaledScore, 33.33);
});

test('the decision examples scale exactly: 34/40 is 85, 37/45 is 82.22 (D04.8-06, D04.3-58/59)', () => {
    const questionsOf = (n: number) => Array.from({ length: n }, (_, i) => question(`q${i}`, 'opt_a'));
    const answered = (n: number, correct: number) => new Map<string, unknown>(Array.from({ length: n }, (_, i) => [`q${i}`, answer(i < correct ? 'opt_a' : 'opt_b')]));
    const scaled = (n: number, correct: number) => {
        const result = scoreBaselineAttempt(questionsOf(n), answered(n, correct));
        assert.equal(result.type, 'scored');
        return result.type === 'scored' ? result.score.scaledScore : NaN;
    };
    assert.equal(scaled(40, 34), 85);
    assert.equal(scaled(45, 37), 82.22);
    assert.equal(scaled(3, 2), 66.67, 'half up at the third decimal');
    assert.equal(scaled(3, 3), 100);
    assert.equal(scaled(3, 0), 0);
});

test('rounding to two decimals is half up and exact', () => {
    assert.equal(scaleToHundred(1n, 8n), 12.5);
    assert.equal(scaleToHundred(1n, 16n), 6.25);
    assert.equal(scaleToHundred(1n, 32n), 3.13, '3.125 is exactly half: up');
    assert.equal(scaleToHundred(1n, 160n), 0.63, '0.625 is exactly half: up');
    assert.equal(scaleToHundred(1n, 1600n), 0.06, '0.0625 is below half: down');
    assert.equal(scaleToHundred(1n, 40000n), 0, '0.0025 is below half: down');
    assert.equal(scaleToHundred(2n, 3n), 66.67);
    assert.equal(scaleToHundred(0n, 3n), 0);
    assert.equal(scaleToHundred(3n, 3n), 100);
});

test('configured weights and fractional scores are summed exactly (D04.3-47/57)', () => {
    const questions = [question('q1', 'opt_a', 0.1), question('q2', 'opt_a', 0.2), question('q3', 'opt_a', 2.5)];
    const all = new Map<string, unknown>([['q1', answer('opt_a')], ['q2', answer('opt_a')], ['q3', answer('opt_b')]]);
    const result = scoreBaselineAttempt(questions, all);
    assert.equal(result.type, 'scored');
    if (result.type !== 'scored') return;
    assert.equal(result.score.rawScore, 0.3, 'not 0.30000000000000004');
    assert.equal(result.score.maxScore, 2.8);
    assert.equal(result.score.scaledScore, 10.71);
});

test('anything but a chosen option id counts as unanswered; no negative marking (D04.3-49)', () => {
    assert.equal(selectedOptionOf({ selectedOptionId: 'opt_a' }), 'opt_a');
    for (const payload of [null, undefined, {}, [], 'opt_a', { selectedOptionId: '' }, { selectedOptionId: 3 }]) {
        assert.equal(selectedOptionOf(payload), null, JSON.stringify(payload));
    }
    const result = scoreBaselineAttempt([question('q1', 'opt_a')], new Map<string, unknown>([['q1', { selectedOptionId: 7 }]]));
    assert.equal(result.type === 'scored' && result.score.items[0].outcome, 'UNANSWERED');
    const wrong = scoreBaselineAttempt([question('q1', 'opt_a')], new Map<string, unknown>([['q1', answer('opt_e')]]));
    assert.equal(wrong.type === 'scored' && wrong.score.rawScore, 0);
});

test('an exam without questions or with an invalid question is unscorable, never a zero', () => {
    assert.deepEqual(scoreBaselineAttempt([], new Map()), { type: 'unscorable', reason: 'no_questions' });
    const broken: ScorableQuestion = { id: 'q2', frozenContent: { schemaVersion: 1, questionType: 'ESSAY' } };
    assert.deepEqual(scoreBaselineAttempt([question('q1', 'opt_a'), broken], new Map()), { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: 'q2' });
    assert.deepEqual(
        scoreBaselineAttempt([question('q1', 'opt_a', 1e-9)], new Map()),
        { type: 'unscorable', reason: 'invalid_question', questionSnapshotId: 'q1' },
        'a maximum below a millionth of a point cannot be scored'
    );
});

test('scoring is deterministic for the same snapshots and answers (D04.8-56)', () => {
    const questions = [question('q1', 'opt_b', 2), question('q2', 'opt_c', 3)];
    const answers = new Map<string, unknown>([['q2', answer('opt_c')], ['q1', answer('opt_a')]]);
    assert.deepEqual(scoreBaselineAttempt(questions, answers), scoreBaselineAttempt(questions, new Map(answers)));
});
