import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import {
  checkExamInstanceBaselineScoringReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-baseline-scoring-readiness-preflight.ts';

const VALID_TENANT = '00000000-0000-0000-0000-000000000001';
const VALID_EXAM = '00000000-0000-0000-0000-000000000002';

const grantedCapability: CapabilityEvaluator = async () => 'granted' as const;
const deniedCapability: CapabilityEvaluator = async () => 'denied' as const;
const unavailableCapability: CapabilityEvaluator = async () => 'unavailable' as const;

const validContent = {
  schemaVersion: 1,
  questionType: 'MULTIPLE_CHOICE_SINGLE',
  prompt: { text: 'Q1' },
  options: [
    { id: '1', content: { text: 'A' } },
    { id: '2', content: { text: 'B' } },
    { id: '3', content: { text: 'C' } },
    { id: '4', content: { text: 'D' } },
    { id: '5', content: { text: 'E' } }
  ],
  correctOptionId: '1',
  maxScore: 5
};

function createClient(options: any = {}, checks?: { insertUpdateDelete?: boolean; queriedContent?: boolean; queryCount?: number; queryText?: string[] }): PoolClient {
  return {
    query: async (text: string, params: any[]) => {
      if (checks) {
        if (/INSERT|UPDATE|DELETE/i.test(text)) checks.insertUpdateDelete = true;
        checks.queryCount = (checks.queryCount || 0) + 1;
        checks.queryText = checks.queryText || [];
        checks.queryText.push(text);
      }

      if (options.dbError) throw new Error('DB Error');
      if (text.includes('secure_assessment_exam_instances')) {
        if (options.missingExam || (options.wrongTenant && params[0] !== VALID_TENANT)) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [{ lifecycle_state: options.lifecycle_state || 'SCHEDULED' }] };
      }

      if (text.includes('secure_assessment_exam_question_snapshots')) {
        if (checks) checks.queriedContent = true;
        if (options.question_snapshot_empty) {
          return { rowCount: 0, rows: [] };
        }
        if (options.multipleValid) {
          return {
            rowCount: 2,
            rows: [
              { id: 'snapshot-1', frozen_content: validContent },
              { id: 'snapshot-2', frozen_content: { ...validContent, maxScore: 10 } }
            ]
          };
        }
        if (options.multipleInvalidOrder) {
          return {
            rowCount: 2,
            rows: [
              { id: 'snapshot-1', frozen_content: { ...validContent, schemaVersion: 2 } },
              { id: 'snapshot-2', frozen_content: { ...validContent, maxScore: -1 } }
            ]
          };
        }

        let content = validContent;
        if (options.invalidSchemaVersion) content = { ...validContent, schemaVersion: 2 };
        if (options.invalidQuestionType) content = { ...validContent, questionType: 'INVALID' };
        if (options.invalidCorrectOption) content = { ...validContent, correctOptionId: '99' };
        if (options.invalidMaxScore) content = { ...validContent, maxScore: -5 };
        if (options.promptMissing) content = { ...validContent, prompt: '' as any };
        if (options.extraMetadata) content = { ...validContent, extra: 'permitted' } as any;

        return { rowCount: 1, rows: [{ id: 'snapshot-id-123', frozen_content: content }] };
      }

      return { rowCount: 1, rows: [{}] };
    }
  } as unknown as PoolClient;
}

describe('BU-069: Exam Instance Baseline Scoring Readiness Preflight', () => {
  // 1. invalid tenant UUID -> denied
  test('1. invalid tenant UUID -> denied', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient(), 'invalid', VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  // 2. invalid exam UUID -> denied
  test('2. invalid exam UUID -> denied', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient(), VALID_TENANT, 'invalid', grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  // 3. capability denied -> denied
  test('3. capability denied -> denied', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient(), VALID_TENANT, VALID_EXAM, deniedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  // 4. capability unavailable -> unavailable
  test('4. capability unavailable -> unavailable', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient(), VALID_TENANT, VALID_EXAM, unavailableCapability);
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 5. capability throws -> unavailable
  test('5. capability throws -> unavailable', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient(), VALID_TENANT, VALID_EXAM, async () => { throw new Error(); });
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 6. missing Exam Instance -> denied
  test('6. missing Exam Instance -> denied', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ missingExam: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  // 7. wrong tenant -> denied
  test('7. wrong tenant -> denied', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ wrongTenant: true }), '00000000-0000-0000-0000-000000000003', VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  // 8. non-SCHEDULED -> invalid_state
  test('8. non-SCHEDULED -> invalid_state', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ lifecycle_state: 'DRAFT' }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'invalid_state' });
  });

  // 9. zero snapshots -> question_snapshot_empty
  test('9. zero snapshots -> question_snapshot_empty', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ question_snapshot_empty: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'question_snapshot_empty' });
  });

  // 10. one valid baseline snapshot -> baseline_scoring_ready
  test('10. one valid baseline snapshot -> baseline_scoring_ready', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient(), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal(res.type, 'baseline_scoring_ready');
  });

  // 11. one valid snapshot returns exact count = 1
  test('11. one valid snapshot returns exact count = 1', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient(), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal((res as any).questionSnapshotCount, 1);
  });

  // 12. one valid snapshot returns exact totalMaxScore
  test('12. one valid snapshot returns exact totalMaxScore', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient(), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal((res as any).totalMaxScore, 5);
  });

  // 13. multiple valid snapshots aggregate exact count
  test('13. multiple valid snapshots aggregate exact count', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ multipleValid: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal((res as any).questionSnapshotCount, 2);
  });

  // 14. multiple valid snapshots aggregate exact totalMaxScore
  test('14. multiple valid snapshots aggregate exact totalMaxScore', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ multipleValid: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal((res as any).totalMaxScore, 15);
  });

  // 15. schema_version_invalid propagates through scoring_snapshot_invalid
  test('15. schema_version_invalid propagates through scoring_snapshot_invalid', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ invalidSchemaVersion: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'scoring_snapshot_invalid', snapshotId: 'snapshot-id-123', contentBlocker: 'schema_version_invalid' });
  });

  // 16. question_type_invalid propagates exactly
  test('16. question_type_invalid propagates exactly', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ invalidQuestionType: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'scoring_snapshot_invalid', snapshotId: 'snapshot-id-123', contentBlocker: 'question_type_invalid' });
  });

  // 17. correct_option_invalid propagates exactly
  test('17. correct_option_invalid propagates exactly', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ invalidCorrectOption: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'scoring_snapshot_invalid', snapshotId: 'snapshot-id-123', contentBlocker: 'correct_option_invalid' });
  });

  // 18. max_score_invalid propagates exactly
  test('18. max_score_invalid propagates exactly', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ invalidMaxScore: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'scoring_snapshot_invalid', snapshotId: 'snapshot-id-123', contentBlocker: 'max_score_invalid' });
  });

  // 19. non-scoring BU-066 blocker such as prompt_missing_or_empty is preserved exactly rather than reinterpreted
  test('19. non-scoring BU-066 blocker such as prompt_missing_or_empty is preserved exactly rather than reinterpreted', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ promptMissing: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'scoring_snapshot_invalid', snapshotId: 'snapshot-id-123', contentBlocker: 'prompt_missing_or_empty' });
  });

  // 20. stable snapshot-id ordering determines first invalid snapshot
  test('20. stable snapshot-id ordering determines first invalid snapshot', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ multipleInvalidOrder: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'scoring_snapshot_invalid', snapshotId: 'snapshot-1', contentBlocker: 'schema_version_invalid' });
  });

  // 21. no INSERT / UPDATE / DELETE
  test('21. no INSERT / UPDATE / DELETE', async () => {
    const checks = { insertUpdateDelete: false };
    await checkExamInstanceBaselineScoringReadiness(createClient({}, checks), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal(checks.insertUpdateDelete, false);
  });

  // 22. database error -> unavailable
  test('22. database error -> unavailable', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ dbError: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 23. capability evaluator called exactly once
  test('23. capability evaluator called exactly once', async () => {
    let callCount = 0;
    let receivedCtx: any = null;
    const evaluator: CapabilityEvaluator = async (ctx) => {
      callCount++;
      receivedCtx = ctx;
      return 'granted' as const;
    };
    await checkExamInstanceBaselineScoringReadiness(createClient(), VALID_TENANT, VALID_EXAM, evaluator);
    assert.equal(callCount, 1);
    assert.deepEqual(receivedCtx, { tenantId: VALID_TENANT, examInstanceId: VALID_EXAM });
  });

  // 24. query is tenant + Exam Instance scoped
  test('24. query is tenant + Exam Instance scoped', async () => {
    const checks = { queryText: [] as string[] };
    await checkExamInstanceBaselineScoringReadiness(createClient({}, checks), VALID_TENANT, VALID_EXAM, grantedCapability);
    const instanceQuery = checks.queryText.find(t => t.includes('secure_assessment_exam_instances'));
    assert.ok(instanceQuery?.includes('tenant_id = $1'));
    assert.ok(instanceQuery?.includes('id = $2'));
  });

  // 25. snapshot query uses stable ORDER BY id ASC
  test('25. snapshot query uses stable ORDER BY id ASC', async () => {
    const checks = { queryText: [] as string[] };
    await checkExamInstanceBaselineScoringReadiness(createClient({}, checks), VALID_TENANT, VALID_EXAM, grantedCapability);
    const snapshotQuery = checks.queryText.find(t => t.includes('secure_assessment_exam_question_snapshots'));
    assert.ok(snapshotQuery?.includes('ORDER BY id ASC'));
  });

  // 26. Question Bank Item content is not queried
  test('26. Question Bank Item content is not queried', async () => {
    const checks = { queryText: [] as string[] };
    await checkExamInstanceBaselineScoringReadiness(createClient({}, checks), VALID_TENANT, VALID_EXAM, grantedCapability);
    const hasBankItemQuery = checks.queryText.some(t => t.includes('secure_assessment_question_bank_items'));
    assert.equal(hasBankItemQuery, false);
  });

  // 27. unknown extra frozen-content metadata that BU-066 permits does not become a new blocker
  test('27. unknown extra frozen-content metadata that BU-066 permits does not become a new blocker', async () => {
    const res = await checkExamInstanceBaselineScoringReadiness(createClient({ extraMetadata: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal(res.type, 'baseline_scoring_ready');
  });
});
