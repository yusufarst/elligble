import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { checkExamInstanceBaselineQuestionSnapshotContentReadiness } from '../src/exam-instance-baseline-question-snapshot-content-readiness-preflight.ts';

const VALID_TENANT = '00000000-0000-0000-0000-000000000001';
const VALID_EXAM = '00000000-0000-0000-0000-000000000002';

const validContent = {
  schemaVersion: 1,
  questionType: 'MULTIPLE_CHOICE_SINGLE',
  prompt: { text: 'A meaningful prompt' },
  options: [
    { id: '1', content: { text: 'opt1' } },
    { id: '2', content: { text: 'opt2' } },
    { id: '3', content: { text: 'opt3' } },
    { id: '4', content: { text: 'opt4' } },
    { id: '5', content: { text: 'opt5' } }
  ],
  correctOptionId: '1',
  maxScore: 10
};

function createClient(rows: any[], shouldThrow = false): PoolClient {
  return {
    query: async () => {
      if (shouldThrow) throw new Error('DB Error');
      return { rows };
    }
  } as unknown as PoolClient;
}

describe('BU-067: Baseline Question Snapshot Content Readiness Preflight', () => {
  // 1 invalid tenant UUID
  test('1 invalid tenant UUID', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([]), 'invalid', VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 2 invalid exam UUID
  test('2 invalid exam UUID', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([]), VALID_TENANT, 'invalid', () => 'granted'
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 3 capability denied
  test('3 capability denied', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([]), VALID_TENANT, VALID_EXAM, () => 'denied'
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 4 capability unavailable
  test('4 capability unavailable', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([]), VALID_TENANT, VALID_EXAM, () => 'unavailable'
    );
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 5 capability throws
  test('5 capability throws', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([]), VALID_TENANT, VALID_EXAM, () => { throw new Error('Auth error'); }
    );
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 6 missing exam
  test('6 missing exam', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 7 cross-tenant
  test('7 cross-tenant', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([]), VALID_TENANT, VALID_EXAM, (ctx) => {
        if (ctx.tenantId !== VALID_TENANT) return 'denied';
        return 'granted';
      }
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 8 non-SCHEDULED lifecycle
  test('8 non-SCHEDULED lifecycle', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'DRAFT', snapshot_id: null }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'invalid_state' });
  });

  // 9 zero snapshots
  test('9 zero snapshots', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: null }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'not_ready', blocker: 'question_snapshot_empty' });
  });

  // 10 one valid snapshot
  test('10 one valid snapshot', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: validContent }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'baseline_question_snapshot_content_ready', examInstanceId: VALID_EXAM, tenantId: VALID_TENANT, questionSnapshotCount: 1 });
  });

  // 11 multiple valid snapshots + correct count
  test('11 multiple valid snapshots + correct count', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([
        { lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: validContent },
        { lifecycle_state: 'SCHEDULED', snapshot_id: 's2', frozen_content: validContent }
      ]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'baseline_question_snapshot_content_ready', examInstanceId: VALID_EXAM, tenantId: VALID_TENANT, questionSnapshotCount: 2 });
  });

  // 12 tenant/exam scoped query
  test('12 tenant/exam scoped query', async () => {
    let lastQuery = '';
    const spyClient = {
      query: async (text: string, params: any[]) => {
        lastQuery = text;
        return { rows: [{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: validContent }] };
      }
    } as unknown as PoolClient;
    await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      spyClient, VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.ok(lastQuery.includes('ei.id = $1'));
    assert.ok(lastQuery.includes('ei.tenant_id = $2'));
  });

  // 13 deterministic snapshot ordering
  test('13 deterministic snapshot ordering', async () => {
    let lastQuery = '';
    const spyClient = {
      query: async (text: string) => {
        lastQuery = text;
        return { rows: [{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: validContent }] };
      }
    } as unknown as PoolClient;
    await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      spyClient, VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.ok(lastQuery.includes('ORDER BY s.id ASC'));
  });

  // 14 first invalid snapshot wins
  test('14 first invalid snapshot wins', async () => {
    const invalid1 = { ...validContent, questionType: 'INVALID' };
    const invalid2 = { ...validContent, schemaVersion: 99 };
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([
        { lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: invalid1 },
        { lifecycle_state: 'SCHEDULED', snapshot_id: 's2', frozen_content: invalid2 }
      ]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'not_ready', blocker: 'question_snapshot_content_invalid', snapshotId: 's1', contentBlocker: 'question_type_invalid' });
  });

  // 15 later invalid snapshot does not replace first
  test('15 later invalid snapshot does not replace first', async () => {
    const invalid1 = { ...validContent, questionType: 'INVALID' };
    const invalid2 = { ...validContent, schemaVersion: 99 };
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([
        { lifecycle_state: 'SCHEDULED', snapshot_id: 's-first', frozen_content: invalid1 },
        { lifecycle_state: 'SCHEDULED', snapshot_id: 's-second', frozen_content: invalid2 }
      ]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).snapshotId, 's-first');
  });

  // 16 frozen_content_invalid propagation
  test('16 frozen_content_invalid propagation', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: null }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'not_ready', blocker: 'question_snapshot_content_invalid', snapshotId: 's1', contentBlocker: 'frozen_content_invalid' });
  });

  // 17 schema_version_invalid
  test('17 schema_version_invalid', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, schemaVersion: 2 } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'schema_version_invalid');
  });

  // 18 question_type_invalid
  test('18 question_type_invalid', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, questionType: 'OTHER' } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'question_type_invalid');
  });

  // 19 prompt_missing_or_empty
  test('19 prompt_missing_or_empty', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, prompt: null } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'prompt_missing_or_empty');
  });

  // 20 option_count_invalid
  test('20 option_count_invalid', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, options: [] } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'option_count_invalid');
  });

  // 21 option_identity_invalid
  test('21 option_identity_invalid', async () => {
    const badOpts = [...validContent.options];
    badOpts[0] = { id: '' } as any;
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, options: badOpts } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'option_identity_invalid');
  });

  // 22 option_identity_duplicate
  test('22 option_identity_duplicate', async () => {
    const badOpts = [...validContent.options];
    badOpts[1] = { ...badOpts[1], id: '1' };
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, options: badOpts } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'option_identity_duplicate');
  });

  // 23 option_content_missing_or_empty
  test('23 option_content_missing_or_empty', async () => {
    const badOpts = [...validContent.options];
    badOpts[0] = { ...badOpts[0], content: null } as any;
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, options: badOpts } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'option_content_missing_or_empty');
  });

  // 24 correct_option_invalid
  test('24 correct_option_invalid', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, correctOptionId: 'missing' } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'correct_option_invalid');
  });

  // 25 max_score_invalid
  test('25 max_score_invalid', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, maxScore: -5 } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal((res as any).contentBlocker, 'max_score_invalid');
  });

  // 26 compatible unknown metadata remains valid
  test('26 compatible unknown metadata remains valid', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: { ...validContent, extraField: 'test' } }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.equal(res.type, 'baseline_question_snapshot_content_ready');
  });

  // 27 frozen content is not mutated
  test('27 frozen content is not mutated', async () => {
    const cloned = JSON.parse(JSON.stringify(validContent));
    await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([{ lifecycle_state: 'SCHEDULED', snapshot_id: 's1', frozen_content: cloned }]), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(cloned, validContent);
  });

  // 28 database/query exception -> unavailable
  test('28 database/query exception -> unavailable', async () => {
    const res = await checkExamInstanceBaselineQuestionSnapshotContentReadiness(
      createClient([], true), VALID_TENANT, VALID_EXAM, () => 'granted'
    );
    assert.deepEqual(res, { type: 'unavailable' });
  });
});
