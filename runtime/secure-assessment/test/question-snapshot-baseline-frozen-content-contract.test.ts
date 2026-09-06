import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBaselineQuestionSnapshotFrozenContent,
  isMeaningfulJson,
} from '../src/question-snapshot-baseline-frozen-content-contract.ts';

function createValidBaselinePayload(): {
  schemaVersion: number;
  questionType: string;
  prompt: unknown;
  options: Array<{ id: string; content?: unknown }>;
  correctOptionId: string;
  maxScore: number;
  [key: string]: unknown;
} {
  return {
    schemaVersion: 1,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    prompt: { text: 'What is the capital of Indonesia?' },
    options: [
      { id: 'opt-1', content: { text: 'Jakarta' } },
      { id: 'opt-2', content: { text: 'Nusantara' } },
      { id: 'opt-3', content: { text: 'Bandung' } },
      { id: 'opt-4', content: { text: 'Surabaya' } },
      { id: 'opt-5', content: { text: 'Yogyakarta' } },
    ],
    correctOptionId: 'opt-2',
    maxScore: 10,
  };
}

describe('BU-066: Baseline Question Snapshot Frozen Content Contract', () => {
  describe('isMeaningfulJson helper', () => {
    it('evaluates meaningful values as true', () => {
      assert.equal(isMeaningfulJson('hello'), true);
      assert.equal(isMeaningfulJson(0), true);
      assert.equal(isMeaningfulJson(42), true);
      assert.equal(isMeaningfulJson(true), true);
      assert.equal(isMeaningfulJson(false), true);
      assert.equal(isMeaningfulJson([1]), true);
      assert.equal(isMeaningfulJson({ a: 1 }), true);
    });

    it('evaluates non-meaningful values as false', () => {
      assert.equal(isMeaningfulJson(null), false);
      assert.equal(isMeaningfulJson(undefined), false);
      assert.equal(isMeaningfulJson(''), false);
      assert.equal(isMeaningfulJson('   '), false);
      assert.equal(isMeaningfulJson([]), false);
      assert.equal(isMeaningfulJson({}), false);
      assert.equal(isMeaningfulJson(Number.NaN), false);
      assert.equal(isMeaningfulJson(Number.POSITIVE_INFINITY), false);
    });
  });

  describe('Contract validation rules', () => {
    it('1. canonical valid MULTIPLE_CHOICE_SINGLE payload => baseline_question_snapshot_content_valid', () => {
      const payload = createValidBaselinePayload();
      const result = validateBaselineQuestionSnapshotFrozenContent(payload);
      assert.equal(result.type, 'baseline_question_snapshot_content_valid');
    });

    it('2. valid result returns schemaVersion 1', () => {
      const payload = createValidBaselinePayload();
      const result = validateBaselineQuestionSnapshotFrozenContent(payload);
      assert.equal(result.type, 'baseline_question_snapshot_content_valid');
      if (result.type === 'baseline_question_snapshot_content_valid') {
        assert.equal(result.schemaVersion, 1);
      }
    });

    it('3. valid result returns optionCount 5', () => {
      const payload = createValidBaselinePayload();
      const result = validateBaselineQuestionSnapshotFrozenContent(payload);
      assert.equal(result.type, 'baseline_question_snapshot_content_valid');
      if (result.type === 'baseline_question_snapshot_content_valid') {
        assert.equal(result.optionCount, 5);
        assert.equal(result.correctOptionId, 'opt-2');
        assert.equal(result.maxScore, 10);
      }
    });

    it('4. missing/non-object frozen content => frozen_content_invalid', () => {
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(null), {
        type: 'invalid_content',
        blocker: 'frozen_content_invalid',
      });
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(undefined), {
        type: 'invalid_content',
        blocker: 'frozen_content_invalid',
      });
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent('string'), {
        type: 'invalid_content',
        blocker: 'frozen_content_invalid',
      });
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(123), {
        type: 'invalid_content',
        blocker: 'frozen_content_invalid',
      });
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent([]), {
        type: 'invalid_content',
        blocker: 'frozen_content_invalid',
      });
    });

    it('5. schemaVersion missing/wrong => schema_version_invalid', () => {
      const payloadMissing = { ...createValidBaselinePayload() };
      delete (payloadMissing as Record<string, unknown>).schemaVersion;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payloadMissing), {
        type: 'invalid_content',
        blocker: 'schema_version_invalid',
      });

      const payloadWrong = { ...createValidBaselinePayload(), schemaVersion: 2 };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payloadWrong), {
        type: 'invalid_content',
        blocker: 'schema_version_invalid',
      });
    });

    it('6. unsupported question type => question_type_invalid', () => {
      const payload = { ...createValidBaselinePayload(), questionType: 'ESSAY' };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payload), {
        type: 'invalid_content',
        blocker: 'question_type_invalid',
      });

      const payloadMissing = { ...createValidBaselinePayload() };
      delete (payloadMissing as Record<string, unknown>).questionType;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payloadMissing), {
        type: 'invalid_content',
        blocker: 'question_type_invalid',
      });
    });

    it('7. empty prompt => prompt_missing_or_empty', () => {
      const p1 = { ...createValidBaselinePayload(), prompt: '' };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p1), {
        type: 'invalid_content',
        blocker: 'prompt_missing_or_empty',
      });

      const p2 = { ...createValidBaselinePayload(), prompt: '   ' };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p2), {
        type: 'invalid_content',
        blocker: 'prompt_missing_or_empty',
      });

      const p3 = { ...createValidBaselinePayload(), prompt: {} };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p3), {
        type: 'invalid_content',
        blocker: 'prompt_missing_or_empty',
      });

      const p4 = { ...createValidBaselinePayload(), prompt: [] };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p4), {
        type: 'invalid_content',
        blocker: 'prompt_missing_or_empty',
      });

      const p5 = { ...createValidBaselinePayload() };
      delete (p5 as Record<string, unknown>).prompt;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p5), {
        type: 'invalid_content',
        blocker: 'prompt_missing_or_empty',
      });
    });

    it('8. 4 options => option_count_invalid', () => {
      const payload = createValidBaselinePayload();
      payload.options.pop();
      assert.equal(payload.options.length, 4);
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payload), {
        type: 'invalid_content',
        blocker: 'option_count_invalid',
      });
    });

    it('9. 6 options => option_count_invalid', () => {
      const payload = createValidBaselinePayload();
      payload.options.push({ id: 'opt-6', content: { text: 'Semarang' } });
      assert.equal(payload.options.length, 6);
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payload), {
        type: 'invalid_content',
        blocker: 'option_count_invalid',
      });
    });

    it('10. missing/blank option ID => option_identity_invalid', () => {
      const p1 = createValidBaselinePayload();
      p1.options[0] = { id: '', content: { text: 'A' } };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p1), {
        type: 'invalid_content',
        blocker: 'option_identity_invalid',
      });

      const p2 = createValidBaselinePayload();
      p2.options[1] = { id: '   ', content: { text: 'B' } };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p2), {
        type: 'invalid_content',
        blocker: 'option_identity_invalid',
      });

      const p3 = createValidBaselinePayload();
      (p3.options[2] as Record<string, unknown>).id = null;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p3), {
        type: 'invalid_content',
        blocker: 'option_identity_invalid',
      });

      const p4 = createValidBaselinePayload();
      (p4.options[3] as unknown) = null;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p4), {
        type: 'invalid_content',
        blocker: 'option_identity_invalid',
      });
    });

    it('11. duplicate option IDs => option_identity_duplicate', () => {
      const payload = createValidBaselinePayload();
      payload.options[1].id = 'opt-1'; // Duplicate with option 0
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payload), {
        type: 'invalid_content',
        blocker: 'option_identity_duplicate',
      });
    });

    it('12. empty option content => option_content_missing_or_empty', () => {
      const p1 = createValidBaselinePayload();
      p1.options[0].content = '';
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p1), {
        type: 'invalid_content',
        blocker: 'option_content_missing_or_empty',
      });

      const p2 = createValidBaselinePayload();
      p2.options[1].content = {};
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p2), {
        type: 'invalid_content',
        blocker: 'option_content_missing_or_empty',
      });

      const p3 = createValidBaselinePayload();
      delete (p3.options[2] as Record<string, unknown>).content;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p3), {
        type: 'invalid_content',
        blocker: 'option_content_missing_or_empty',
      });
    });

    it('13. correctOptionId missing => correct_option_invalid', () => {
      const p1 = createValidBaselinePayload();
      delete (p1 as Record<string, unknown>).correctOptionId;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p1), {
        type: 'invalid_content',
        blocker: 'correct_option_invalid',
      });

      const p2 = createValidBaselinePayload();
      p2.correctOptionId = '';
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p2), {
        type: 'invalid_content',
        blocker: 'correct_option_invalid',
      });
    });

    it('14. correctOptionId not present in options => correct_option_invalid', () => {
      const payload = createValidBaselinePayload();
      payload.correctOptionId = 'opt-nonexistent';
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payload), {
        type: 'invalid_content',
        blocker: 'correct_option_invalid',
      });
    });

    it('15. maxScore zero => max_score_invalid', () => {
      const payload = createValidBaselinePayload();
      payload.maxScore = 0;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payload), {
        type: 'invalid_content',
        blocker: 'max_score_invalid',
      });
    });

    it('16. maxScore negative => max_score_invalid', () => {
      const payload = createValidBaselinePayload();
      payload.maxScore = -5;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(payload), {
        type: 'invalid_content',
        blocker: 'max_score_invalid',
      });
    });

    it('17. maxScore NaN/infinite/non-number => max_score_invalid', () => {
      const p1 = createValidBaselinePayload();
      p1.maxScore = Number.NaN;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p1), {
        type: 'invalid_content',
        blocker: 'max_score_invalid',
      });

      const p2 = createValidBaselinePayload();
      p2.maxScore = Number.POSITIVE_INFINITY;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p2), {
        type: 'invalid_content',
        blocker: 'max_score_invalid',
      });

      const p3 = createValidBaselinePayload();
      (p3 as Record<string, unknown>).maxScore = '10';
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p3), {
        type: 'invalid_content',
        blocker: 'max_score_invalid',
      });
    });

    it('18. option order changes but stable IDs preserve correctOptionId validity', () => {
      const payload = createValidBaselinePayload();
      // Reverse options order
      payload.options.reverse();
      const result = validateBaselineQuestionSnapshotFrozenContent(payload);
      assert.equal(result.type, 'baseline_question_snapshot_content_valid');
      if (result.type === 'baseline_question_snapshot_content_valid') {
        assert.equal(result.correctOptionId, 'opt-2');
      }
    });

    it('19. unknown additional metadata does not invalidate an otherwise valid payload', () => {
      const payload = {
        ...createValidBaselinePayload(),
        extraMetadata: { subject: 'Geography', difficulty: 'easy' },
        tags: ['indonesia', 'capitals'],
      };
      const result = validateBaselineQuestionSnapshotFrozenContent(payload);
      assert.equal(result.type, 'baseline_question_snapshot_content_valid');
    });

    it('20. validator performs no mutation to input object', () => {
      const payload = createValidBaselinePayload();
      const snapshotBefore = JSON.stringify(payload);
      validateBaselineQuestionSnapshotFrozenContent(payload);
      const snapshotAfter = JSON.stringify(payload);
      assert.equal(snapshotBefore, snapshotAfter);
    });

    it('21. deterministic first-blocker precedence', () => {
      // Both schemaVersion and questionType invalid => schema_version_invalid wins
      const p1 = {
        ...createValidBaselinePayload(),
        schemaVersion: 99,
        questionType: 'INVALID',
      };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p1), {
        type: 'invalid_content',
        blocker: 'schema_version_invalid',
      });

      // Both questionType and prompt invalid => question_type_invalid wins
      const p2 = {
        ...createValidBaselinePayload(),
        questionType: 'INVALID',
        prompt: '',
      };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p2), {
        type: 'invalid_content',
        blocker: 'question_type_invalid',
      });

      // Both prompt and optionCount invalid => prompt_missing_or_empty wins
      const p3 = {
        ...createValidBaselinePayload(),
        prompt: '',
        options: [],
      };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p3), {
        type: 'invalid_content',
        blocker: 'prompt_missing_or_empty',
      });

      // Both optionCount and optionIdentity invalid => option_count_invalid wins
      const p4 = {
        ...createValidBaselinePayload(),
        options: [{ id: '', content: 'A' }],
      };
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p4), {
        type: 'invalid_content',
        blocker: 'option_count_invalid',
      });

      // Both optionIdentity and optionIdentityDuplicate invalid => option_identity_invalid wins
      const p5 = createValidBaselinePayload();
      p5.options[0].id = '';
      p5.options[1].id = 'opt-1';
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p5), {
        type: 'invalid_content',
        blocker: 'option_identity_invalid',
      });

      // Both correctOption and maxScore invalid => correct_option_invalid wins
      const p6 = createValidBaselinePayload();
      p6.correctOptionId = 'invalid';
      p6.maxScore = -1;
      assert.deepEqual(validateBaselineQuestionSnapshotFrozenContent(p6), {
        type: 'invalid_content',
        blocker: 'correct_option_invalid',
      });
    });
  });
});
