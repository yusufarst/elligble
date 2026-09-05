import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { checkExamInstanceQuestionSnapshotPresenceReadiness } from '../src/exam-instance-question-snapshot-presence-readiness-preflight.ts';

describe('BU-061: Exam Instance Question Snapshot Presence Readiness', () => {
  const validTenantId = '11111111-1111-1111-1111-111111111111';
  const validExamId = '22222222-2222-2222-2222-222222222222';

  const createMockClient = (
    resultRows: any[] = [],
    shouldThrow = false
  ): any => {
    return {
      queryCount: 0,
      lastQuery: '',
      async query(text: string, params: any[]) {
        this.queryCount++;
        this.lastQuery = text;

        if (shouldThrow) {
          throw new Error('DB Error');
        }

        if (text.toUpperCase().includes('INSERT') || text.toUpperCase().includes('UPDATE') || text.toUpperCase().includes('DELETE')) {
          throw new Error('MUTATION DETECTED');
        }

        return { rows: resultRows };
      },
    };
  };

  it('1. SCHEDULED + granted + exactly one same-tenant snapshot -> ready (count 1)', async () => {
    let capturedCtx: any = null;
    const client = createMockClient([{ lifecycle_state: 'SCHEDULED', snapshot_count: 1 }]);

    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(
      client,
      validTenantId,
      validExamId,
      (ctx) => {
        capturedCtx = ctx;
        return 'granted';
      }
    );

    assert.deepStrictEqual(result, {
      type: 'question_snapshot_presence_ready',
      examInstanceId: validExamId,
      tenantId: validTenantId,
      questionSnapshotCount: 1,
    });
    assert.deepStrictEqual(capturedCtx, { tenantId: validTenantId, examInstanceId: validExamId });
    assert.strictEqual(client.queryCount, 1);
  });

  it('2. SCHEDULED + granted + two same-tenant snapshots -> ready (count 2)', async () => {
    const client = createMockClient([{ lifecycle_state: 'SCHEDULED', snapshot_count: 2 }]);
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => 'granted');
    assert.deepStrictEqual(result, {
      type: 'question_snapshot_presence_ready',
      examInstanceId: validExamId,
      tenantId: validTenantId,
      questionSnapshotCount: 2,
    });
  });

  it('3. SCHEDULED + zero snapshots -> not_ready / question_snapshot_empty', async () => {
    const client = createMockClient([{ lifecycle_state: 'SCHEDULED', snapshot_count: 0 }]);
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => 'granted');
    assert.deepStrictEqual(result, {
      type: 'not_ready',
      blocker: 'question_snapshot_empty',
    });
  });

  it('4. non-SCHEDULED Exam Instance -> invalid_state', async () => {
    const client = createMockClient([{ lifecycle_state: 'DRAFT', snapshot_count: 0 }]);
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => 'granted');
    assert.deepStrictEqual(result, { type: 'invalid_state' });
  });

  it('5. denied evaluator -> denied and zero database queries', async () => {
    const client = createMockClient([{ lifecycle_state: 'SCHEDULED', snapshot_count: 1 }]);
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => 'denied');
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(client.queryCount, 0);
  });

  it('6. unavailable evaluator -> unavailable and zero database queries', async () => {
    const client = createMockClient([{ lifecycle_state: 'SCHEDULED', snapshot_count: 1 }]);
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => 'unavailable');
    assert.deepStrictEqual(result, { type: 'unavailable' });
    assert.strictEqual(client.queryCount, 0);
  });

  it('7. throwing/rejecting evaluator -> unavailable and zero database queries', async () => {
    const client = createMockClient([{ lifecycle_state: 'SCHEDULED', snapshot_count: 1 }]);
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => {
      throw new Error('Eval Error');
    });
    assert.deepStrictEqual(result, { type: 'unavailable' });
    assert.strictEqual(client.queryCount, 0);
  });

  it('8. invalid UUID -> denied before database query', async () => {
    const client = createMockClient([{ lifecycle_state: 'SCHEDULED', snapshot_count: 1 }]);
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, 'invalid', validExamId, () => 'granted');
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(client.queryCount, 0);
  });

  it('9. wrong tenant / inaccessible Exam Instance -> denied with no data leak', async () => {
    const client = createMockClient([]); // 0 rows returned
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => 'granted');
    assert.deepStrictEqual(result, { type: 'denied' });
    assert.strictEqual(client.queryCount, 1);
  });

  it('10. database query failure -> unavailable', async () => {
    const client = createMockClient([], true);
    const result = await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => 'granted');
    assert.deepStrictEqual(result, { type: 'unavailable' });
  });

  it('11. runtime performs read-only SELECT behavior: no INSERT, no UPDATE, no DELETE', async () => {
    const client = createMockClient([{ lifecycle_state: 'SCHEDULED', snapshot_count: 1 }]);
    await checkExamInstanceQuestionSnapshotPresenceReadiness(client, validTenantId, validExamId, () => 'granted');
    assert.ok(client.lastQuery.toUpperCase().includes('SELECT'));
    assert.ok(!client.lastQuery.toUpperCase().includes('INSERT'));
    assert.ok(!client.lastQuery.toUpperCase().includes('UPDATE'));
    assert.ok(!client.lastQuery.toUpperCase().includes('DELETE'));
  });
});
