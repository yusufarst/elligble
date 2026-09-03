import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import type { Pool, PoolClient, QueryResult } from 'pg';
import {
  transitionExamInstanceDraftToScheduled,
  type ExamInstanceSchedulingCapabilityDecision,
  type ExamInstanceSchedulingCapabilityEvaluator,
  type TransitionExamInstanceDraftToScheduledInput,
} from '../src/exam-instance-draft-to-scheduled-transition.ts';

describe('transitionExamInstanceDraftToScheduled', () => {
  const validTenantId = '11111111-1111-1111-1111-111111111111';
  const validExamInstanceId = '22222222-2222-2222-2222-222222222222';
  const validTeachingAssignmentId = '33333333-3333-3333-3333-333333333333';

  const windowStarts = new Date('2026-09-10T08:00:00.000Z');
  const windowEnds = new Date('2026-09-10T10:00:00.000Z');

  const defaultMockRow = {
    id: validExamInstanceId,
    tenant_id: validTenantId,
    teaching_assignment_id: validTeachingAssignmentId,
    lifecycle_state: 'DRAFT',
    window_starts_at: windowStarts.toISOString(),
    window_ends_at: windowEnds.toISOString(),
  };

  function createMockPool(
    clientQueryHandler: (queryText: string, values?: any[]) => Promise<QueryResult<any>>
  ): { pool: Pool; state: { clientReleased: boolean; queries: string[] } } {
    const state = { clientReleased: false, queries: [] as string[] };

    const mockClient = {
      query: async (q: string, v?: any[]) => {
        state.queries.push(q);
        return clientQueryHandler(q, v);
      },
      release: () => {
        state.clientReleased = true;
      },
    } as unknown as PoolClient;

    const pool = {
      connect: async () => mockClient,
      query: async (q: string, v?: any[]) => {
        state.queries.push(q);
        return clientQueryHandler(q, v);
      },
    } as unknown as Pool;

    return { pool, state };
  }

  const grantEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
    async (): Promise<ExamInstanceSchedulingCapabilityDecision> => 'granted';
  const denyEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
    async (): Promise<ExamInstanceSchedulingCapabilityDecision> => 'denied';
  const unavailableEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
    async (): Promise<ExamInstanceSchedulingCapabilityDecision> => 'unavailable';
  const throwingEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
    async (): Promise<ExamInstanceSchedulingCapabilityDecision> => {
      throw new Error('Capability service unreachable');
    };

  it('1. DRAFT + valid window + granted authorization -> scheduled', async () => {
    let updateExecuted = false;
    const { pool, state } = createMockPool(async (q, v) => {
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
        return { rows: [], rowCount: 0 } as any;
      }
      if (q.includes('FOR UPDATE')) {
        return { rows: [{ ...defaultMockRow }], rowCount: 1 } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        updateExecuted = true;
        assert.deepStrictEqual(v, [validExamInstanceId, validTenantId]);
        return {
          rows: [
            {
              ...defaultMockRow,
              lifecycle_state: 'SCHEDULED',
            },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const input: TransitionExamInstanceDraftToScheduledInput = {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    };

    const result = await transitionExamInstanceDraftToScheduled(pool, input, grantEvaluator);

    assert.strictEqual(result.type, 'scheduled');
    if (result.type === 'scheduled') {
      assert.strictEqual(result.examInstanceId, validExamInstanceId);
      assert.strictEqual(result.tenantId, validTenantId);
      assert.strictEqual(result.lifecycleState, 'SCHEDULED');
      assert.strictEqual(result.windowStartsAt.getTime(), windowStarts.getTime());
      assert.strictEqual(result.windowEndsAt.getTime(), windowEnds.getTime());
      assert.strictEqual(result.teachingAssignmentId, validTeachingAssignmentId);
    }
    assert.strictEqual(updateExecuted, true);
    assert.strictEqual(state.clientReleased, true);
    assert.ok(state.queries.includes('BEGIN'));
    assert.ok(state.queries.includes('COMMIT'));
    assert.ok(!state.queries.includes('ROLLBACK'));
  });

  it('2. resulting lifecycle_state is exactly SCHEDULED', async () => {
    let capturedUpdateQuery = '';
    const { pool } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'COMMIT') return { rows: [], rowCount: 0 } as any;
      if (q.includes('FOR UPDATE')) {
        return { rows: [{ ...defaultMockRow }], rowCount: 1 } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        capturedUpdateQuery = q;
        return {
          rows: [{ ...defaultMockRow, lifecycle_state: 'SCHEDULED' }],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, grantEvaluator);

    assert.strictEqual(result.type, 'scheduled');
    if (result.type === 'scheduled') {
      assert.strictEqual(result.lifecycleState, 'SCHEDULED');
    }
    assert.ok(capturedUpdateQuery.includes("SET lifecycle_state = 'SCHEDULED'"));
  });

  it('3. operational-window values remain unchanged', async () => {
    const { pool } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'COMMIT') return { rows: [], rowCount: 0 } as any;
      if (q.includes('FOR UPDATE')) {
        return { rows: [{ ...defaultMockRow }], rowCount: 1 } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        return {
          rows: [{ ...defaultMockRow, lifecycle_state: 'SCHEDULED' }],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, grantEvaluator);

    assert.strictEqual(result.type, 'scheduled');
    if (result.type === 'scheduled') {
      assert.strictEqual(result.windowStartsAt.toISOString(), windowStarts.toISOString());
      assert.strictEqual(result.windowEndsAt.toISOString(), windowEnds.toISOString());
    }
  });

  it('4. tenant / Teaching Assignment context remains unchanged', async () => {
    const { pool } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'COMMIT') return { rows: [], rowCount: 0 } as any;
      if (q.includes('FOR UPDATE')) {
        return { rows: [{ ...defaultMockRow }], rowCount: 1 } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        return {
          rows: [{ ...defaultMockRow, lifecycle_state: 'SCHEDULED' }],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, grantEvaluator);

    assert.strictEqual(result.type, 'scheduled');
    if (result.type === 'scheduled') {
      assert.strictEqual(result.tenantId, validTenantId);
      assert.strictEqual(result.teachingAssignmentId, validTeachingAssignmentId);
    }
  });

  it('5. DRAFT + NULL/NULL window -> invalid_window and remains DRAFT', async () => {
    let updateAttempted = false;
    const { pool, state } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'ROLLBACK') return { rows: [], rowCount: 0 } as any;
      if (q.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              ...defaultMockRow,
              window_starts_at: null,
              window_ends_at: null,
            },
          ],
          rowCount: 1,
        } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        updateAttempted = true;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, grantEvaluator);

    assert.strictEqual(result.type, 'invalid_window');
    assert.strictEqual(updateAttempted, false);
    assert.ok(state.queries.includes('ROLLBACK'));
    assert.ok(!state.queries.includes('COMMIT'));
    assert.strictEqual(state.clientReleased, true);
  });

  it('5b. DRAFT + invalid window order (start >= end) -> invalid_window and remains DRAFT', async () => {
    let updateAttempted = false;
    const { pool, state } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'ROLLBACK') return { rows: [], rowCount: 0 } as any;
      if (q.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              ...defaultMockRow,
              window_starts_at: windowEnds.toISOString(),
              window_ends_at: windowStarts.toISOString(),
            },
          ],
          rowCount: 1,
        } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        updateAttempted = true;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, grantEvaluator);

    assert.strictEqual(result.type, 'invalid_window');
    assert.strictEqual(updateAttempted, false);
    assert.ok(state.queries.includes('ROLLBACK'));
  });

  it('6. non-DRAFT -> invalid_state and no mutation', async () => {
    const nonDraftStates = ['SCHEDULED', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED'];

    for (const stateName of nonDraftStates) {
      let updateAttempted = false;
      const { pool, state } = createMockPool(async (q) => {
        if (q === 'BEGIN' || q === 'ROLLBACK') return { rows: [], rowCount: 0 } as any;
        if (q.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                ...defaultMockRow,
                lifecycle_state: stateName,
              },
            ],
            rowCount: 1,
          } as any;
        }
        if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
          updateAttempted = true;
        }
        return { rows: [], rowCount: 0 } as any;
      });

      const result = await transitionExamInstanceDraftToScheduled(pool, {
        tenantId: validTenantId,
        examInstanceId: validExamInstanceId,
      }, grantEvaluator);

      assert.strictEqual(result.type, 'invalid_state');
      if (result.type === 'invalid_state') {
        assert.strictEqual(result.currentState, stateName);
      }
      assert.strictEqual(updateAttempted, false);
      assert.ok(state.queries.includes('ROLLBACK'));
      assert.strictEqual(state.clientReleased, true);
    }
  });

  it('7. denied authorization -> denied and no mutation', async () => {
    let updateAttempted = false;
    const { pool, state } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'ROLLBACK') return { rows: [], rowCount: 0 } as any;
      if (q.includes('FOR UPDATE')) {
        return { rows: [{ ...defaultMockRow }], rowCount: 1 } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        updateAttempted = true;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, denyEvaluator);

    assert.strictEqual(result.type, 'denied');
    assert.strictEqual(updateAttempted, false);
    assert.ok(state.queries.includes('ROLLBACK'));
    assert.ok(!state.queries.includes('COMMIT'));
    assert.strictEqual(state.clientReleased, true);
  });

  it('8. unavailable authorization/dependency -> unavailable and no mutation', async () => {
    let updateAttempted = false;
    const { pool, state } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'ROLLBACK') return { rows: [], rowCount: 0 } as any;
      if (q.includes('FOR UPDATE')) {
        return { rows: [{ ...defaultMockRow }], rowCount: 1 } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        updateAttempted = true;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const resultUnavailable = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, unavailableEvaluator);

    assert.strictEqual(resultUnavailable.type, 'unavailable');
    assert.strictEqual(updateAttempted, false);
    assert.ok(state.queries.includes('ROLLBACK'));

    const resultThrowing = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, throwingEvaluator);

    assert.strictEqual(resultThrowing.type, 'unavailable');
    assert.strictEqual(updateAttempted, false);
  });

  it('9. wrong tenant/inaccessible target -> no cross-tenant mutation', async () => {
    let updateAttempted = false;
    const { pool, state } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'ROLLBACK') return { rows: [], rowCount: 0 } as any;
      if (q.includes('FOR UPDATE')) {
        // Row not found for given tenant/id
        return { rows: [], rowCount: 0 } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        updateAttempted = true;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: '99999999-9999-9999-9999-999999999999',
      examInstanceId: validExamInstanceId,
    }, grantEvaluator);

    assert.strictEqual(result.type, 'denied');
    assert.strictEqual(updateAttempted, false);
    assert.ok(state.queries.includes('ROLLBACK'));
    assert.strictEqual(state.clientReleased, true);
  });

  it('10. repeated transition after success does not create a second success', async () => {
    let currentLifecycleState = 'DRAFT';
    let updateCount = 0;

    const { pool } = createMockPool(async (q) => {
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
        return { rows: [], rowCount: 0 } as any;
      }
      if (q.includes('FOR UPDATE')) {
        return {
          rows: [{ ...defaultMockRow, lifecycle_state: currentLifecycleState }],
          rowCount: 1,
        } as any;
      }
      if (q.includes('UPDATE public.secure_assessment_exam_instances')) {
        updateCount++;
        currentLifecycleState = 'SCHEDULED';
        return {
          rows: [{ ...defaultMockRow, lifecycle_state: 'SCHEDULED' }],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const input = {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    };

    // First attempt succeeds
    const firstResult = await transitionExamInstanceDraftToScheduled(pool, input, grantEvaluator);
    assert.strictEqual(firstResult.type, 'scheduled');
    assert.strictEqual(updateCount, 1);

    // Second (repeated/retry) attempt fails safely without mutating again
    const secondResult = await transitionExamInstanceDraftToScheduled(pool, input, grantEvaluator);
    assert.strictEqual(secondResult.type, 'invalid_state');
    if (secondResult.type === 'invalid_state') {
      assert.strictEqual(secondResult.currentState, 'SCHEDULED');
    }
    assert.strictEqual(updateCount, 1);
  });

  it('11. raw DB errors do not leak as successful state', async () => {
    const { pool, state } = createMockPool(async (q) => {
      if (q.includes('FOR UPDATE')) {
        throw new Error('Database disk full / connection terminated');
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const result = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: validExamInstanceId,
    }, grantEvaluator);

    assert.strictEqual(result.type, 'unavailable');
    assert.strictEqual(state.clientReleased, true);
  });

  it('12. invalid UUID format rejects as denied before DB connect', async () => {
    let connectCalled = false;
    const pool = {
      connect: async () => {
        connectCalled = true;
        throw new Error('Should not connect');
      },
      query: async () => {
        throw new Error('Should not query');
      },
    } as unknown as Pool;

    const result1 = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: 'invalid-tenant-uuid',
      examInstanceId: validExamInstanceId,
    });
    assert.strictEqual(result1.type, 'denied');
    assert.strictEqual(connectCalled, false);

    const result2 = await transitionExamInstanceDraftToScheduled(pool, {
      tenantId: validTenantId,
      examInstanceId: 'invalid-exam-uuid',
    });
    assert.strictEqual(result2.type, 'denied');
    assert.strictEqual(connectCalled, false);
  });
});
