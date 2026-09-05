import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import type { PoolClient, QueryResult } from 'pg';
import { checkExamInstanceAssessmentTypeReadiness } from '../src/exam-instance-assessment-type-readiness-preflight.ts';

describe('checkExamInstanceAssessmentTypeReadiness', () => {
  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockExamInstanceId = '00000000-0000-0000-0000-000000000002';
  const mockAssessmentTypeId = '00000000-0000-0000-0000-000000000003';

  function createMockClient(
    clientQueryHandler: (queryText: string, values?: any[]) => Promise<QueryResult<any>>
  ): { client: PoolClient; state: { queries: string[] } } {
    const state = { queries: [] as string[] };
    const client = {
      query: async (q: string, v?: any[]) => {
        state.queries.push(q);
        return clientQueryHandler(q, v);
      }
    } as unknown as PoolClient;
    return { client, state };
  }

  it('1-5. SCHEDULED + tenant-safe valid Assessment Type + granted capability -> assessment_type_ready', async () => {
    const { client } = createMockClient(async () => {
      return {
        rows: [{
          lifecycle_state: 'SCHEDULED',
          assessment_type_id: mockAssessmentTypeId,
          assessment_type_display_label: 'Math Final'
        }],
        rowCount: 1,
      } as any;
    });

    const result = await checkExamInstanceAssessmentTypeReadiness(
      client,
      mockTenantId,
      mockExamInstanceId,
      'granted'
    );

    assert.strictEqual(result.type, 'assessment_type_ready');
    if (result.type === 'assessment_type_ready') {
      assert.strictEqual(result.examInstanceId, mockExamInstanceId);
      assert.strictEqual(result.tenantId, mockTenantId);
      assert.strictEqual(result.assessmentTypeId, mockAssessmentTypeId);
      assert.strictEqual(result.assessmentTypeDisplayLabel, 'Math Final');
    }
  });

  it('6. SCHEDULED + assessment_type_id NULL -> not_ready / assessment_type_missing', async () => {
    const { client } = createMockClient(async () => {
      return {
        rows: [{
          lifecycle_state: 'SCHEDULED',
          assessment_type_id: null,
          assessment_type_display_label: null
        }],
        rowCount: 1,
      } as any;
    });

    const result = await checkExamInstanceAssessmentTypeReadiness(
      client,
      mockTenantId,
      mockExamInstanceId,
      'granted'
    );

    assert.strictEqual(result.type, 'not_ready');
    if (result.type === 'not_ready') {
      assert.strictEqual(result.blocker, 'assessment_type_missing');
    }
  });

  it('7. non-SCHEDULED lifecycle -> invalid_state', async () => {
    const { client } = createMockClient(async () => {
      return {
        rows: [{
          lifecycle_state: 'DRAFT',
          assessment_type_id: mockAssessmentTypeId,
          assessment_type_display_label: 'Math Final'
        }],
        rowCount: 1,
      } as any;
    });

    const result = await checkExamInstanceAssessmentTypeReadiness(
      client,
      mockTenantId,
      mockExamInstanceId,
      'granted'
    );

    assert.strictEqual(result.type, 'invalid_state');
  });

  it('8. denied capability -> denied', async () => {
    const { client, state } = createMockClient(async () => {
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await checkExamInstanceAssessmentTypeReadiness(
      client,
      mockTenantId,
      mockExamInstanceId,
      'denied'
    );

    assert.strictEqual(result.type, 'denied');
    assert.strictEqual(state.queries.length, 0);
  });

  it('9-10. unavailable capability -> unavailable', async () => {
    const { client, state } = createMockClient(async () => {
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await checkExamInstanceAssessmentTypeReadiness(
      client,
      mockTenantId,
      mockExamInstanceId,
      'unavailable'
    );

    assert.strictEqual(result.type, 'unavailable');
    assert.strictEqual(state.queries.length, 0);
  });

  it('11. wrong tenant / inaccessible Exam Instance -> denied and no data leakage', async () => {
    const { client } = createMockClient(async () => {
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await checkExamInstanceAssessmentTypeReadiness(
      client,
      mockTenantId,
      mockExamInstanceId,
      'granted'
    );

    assert.strictEqual(result.type, 'denied');
  });

  it('12. database failure -> unavailable', async () => {
    const { client } = createMockClient(async () => {
      throw new Error('DB connection failed');
    });

    const result = await checkExamInstanceAssessmentTypeReadiness(
      client,
      mockTenantId,
      mockExamInstanceId,
      'granted'
    );

    assert.strictEqual(result.type, 'unavailable');
  });

  it('13. runtime performs no UPDATE / INSERT / DELETE, no mutation', async () => {
    const { client, state } = createMockClient(async () => {
      return {
        rows: [{
          lifecycle_state: 'SCHEDULED',
          assessment_type_id: mockAssessmentTypeId,
          assessment_type_display_label: 'Math Final'
        }],
        rowCount: 1,
      } as any;
    });

    await checkExamInstanceAssessmentTypeReadiness(
      client,
      mockTenantId,
      mockExamInstanceId,
      'granted'
    );

    assert.strictEqual(state.queries.length, 1);
    const sql = state.queries[0].toUpperCase();
    assert.ok(!sql.includes('UPDATE'), 'Query should not contain UPDATE');
    assert.ok(!sql.includes('INSERT'), 'Query should not contain INSERT');
    assert.ok(!sql.includes('DELETE'), 'Query should not contain DELETE');
    assert.ok(sql.includes('SELECT'), 'Query should contain SELECT');
  });
});
