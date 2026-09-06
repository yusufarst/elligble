import { test } from 'node:test';
import * as assert from 'node:assert';
import type { PoolClient } from 'pg';
import {
  checkExamInstanceDurationWindowPolicyCompatibilityReadiness,
  type CapabilityEvaluator,
} from '../src/exam-instance-duration-window-policy-compatibility-readiness-preflight.ts';

const VALID_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VALID_EXAM_INSTANCE_ID = '22222222-2222-2222-2222-222222222222';

// 2-hour window: 7200 seconds
const WINDOW_START = '2026-10-01T08:00:00Z';
const WINDOW_END = '2026-10-01T10:00:00Z';

test('BU-064 Duration-Window Compatibility - 1. FULL_DURATION_BEYOND_WINDOW, duration shorter than window => ready', async () => {
  let contextPassed: any = null;
  const mockEvaluator: CapabilityEvaluator = async (ctx) => {
    contextPassed = ctx;
    return 'granted';
  };

  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 5400, // 90 mins < 120 mins
            latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(contextPassed, {
    tenantId: VALID_TENANT_ID,
    examInstanceId: VALID_EXAM_INSTANCE_ID,
  });
  assert.deepStrictEqual(result, {
    type: 'duration_window_compatibility_ready',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
    configuredAttemptDurationSeconds: 5400,
    latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
  });
});

test('BU-064 Duration-Window Compatibility - 2. FULL_DURATION_BEYOND_WINDOW, duration greater than window => ready', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 10800, // 3 hours > 2 hours
            latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'duration_window_compatibility_ready',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
    configuredAttemptDurationSeconds: 10800,
    latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
  });
});

test('BU-064 Duration-Window Compatibility - 3. REMAINING_WINDOW_ONLY, duration shorter than window => ready', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 5400, // 90 mins < 120 mins
            latest_start_policy: 'REMAINING_WINDOW_ONLY',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'duration_window_compatibility_ready',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
    configuredAttemptDurationSeconds: 5400,
    latestStartPolicy: 'REMAINING_WINDOW_ONLY',
  });
});

test('BU-064 Duration-Window Compatibility - 4. REMAINING_WINDOW_ONLY, duration greater than window => ready', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 10800, // 3 hours > 2 hours
            latest_start_policy: 'REMAINING_WINDOW_ONLY',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'duration_window_compatibility_ready',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
    configuredAttemptDurationSeconds: 10800,
    latestStartPolicy: 'REMAINING_WINDOW_ONLY',
  });
});

test('BU-064 Duration-Window Compatibility - 5. LATE_START_BLOCKED, duration shorter than window => ready', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 5400, // 90 mins < 120 mins
            latest_start_policy: 'LATE_START_BLOCKED',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'duration_window_compatibility_ready',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
    configuredAttemptDurationSeconds: 5400,
    latestStartPolicy: 'LATE_START_BLOCKED',
  });
});

test('BU-064 Duration-Window Compatibility - 6. LATE_START_BLOCKED, duration exactly equal to window => ready', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 7200, // 2 hours === 2 hours
            latest_start_policy: 'LATE_START_BLOCKED',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'duration_window_compatibility_ready',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
    configuredAttemptDurationSeconds: 7200,
    latestStartPolicy: 'LATE_START_BLOCKED',
  });
});

test('BU-064 Duration-Window Compatibility - 7. LATE_START_BLOCKED, duration greater than window => not_ready / attempt_duration_exceeds_window', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 10800, // 3 hours > 2 hours
            latest_start_policy: 'LATE_START_BLOCKED',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'attempt_duration_exceeds_window',
  });
});

test('BU-064 Duration-Window Compatibility - 8. duration NULL => not_ready / attempt_duration_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: null,
            latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'attempt_duration_missing',
  });
});

test('BU-064 Duration-Window Compatibility - 9. latest_start_policy NULL => not_ready / latest_start_policy_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 3600,
            latest_start_policy: null,
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'latest_start_policy_missing',
  });
});

test('BU-064 Duration-Window Compatibility - 10. both duration and policy NULL => deterministic attempt_duration_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: null,
            latest_start_policy: null,
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'attempt_duration_missing',
  });
});

test('BU-064 Duration-Window Compatibility - 11. non-SCHEDULED => invalid_state', async () => {
  const nonScheduledStates = ['DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
  for (const state of nonScheduledStates) {
    const mockEvaluator: CapabilityEvaluator = async () => 'granted';
    const mockClient = {
      query: async () => {
        return {
          rows: [
            {
              lifecycle_state: state,
              window_starts_at: WINDOW_START,
              window_ends_at: WINDOW_END,
              configured_attempt_duration_seconds: 3600,
              latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
            },
          ],
        };
      },
    } as unknown as PoolClient;

    const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      mockClient,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      mockEvaluator
    );

    assert.deepStrictEqual(result, { type: 'invalid_state' });
  }
});

test('BU-064 Duration-Window Compatibility - 12. denied evaluator => denied => zero DB query', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'denied';
  let queryCalled = false;
  const mockClient = {
    query: async () => {
      queryCalled = true;
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queryCalled, false);
});

test('BU-064 Duration-Window Compatibility - 13. unavailable evaluator => unavailable => zero DB query', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'unavailable';
  let queryCalled = false;
  const mockClient = {
    query: async () => {
      queryCalled = true;
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queryCalled, false);
});

test('BU-064 Duration-Window Compatibility - 14. throwing/rejecting evaluator => unavailable => zero DB query', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => {
    throw new Error('PDP connection failure');
  };
  let queryCalled = false;
  const mockClient = {
    query: async () => {
      queryCalled = true;
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queryCalled, false);
});

test('BU-064 Duration-Window Compatibility - 15. invalid UUID => denied => zero evaluator call => zero DB query', async () => {
  let evaluatorCalled = false;
  const mockEvaluator: CapabilityEvaluator = async () => {
    evaluatorCalled = true;
    return 'granted';
  };
  let queryCalled = false;
  const mockClient = {
    query: async () => {
      queryCalled = true;
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result1 = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    'not-a-uuid',
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );
  assert.deepStrictEqual(result1, { type: 'denied' });
  assert.strictEqual(evaluatorCalled, false);
  assert.strictEqual(queryCalled, false);

  const result2 = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    'invalid-uuid',
    mockEvaluator
  );
  assert.deepStrictEqual(result2, { type: 'denied' });
  assert.strictEqual(evaluatorCalled, false);
  assert.strictEqual(queryCalled, false);
});

test('BU-064 Duration-Window Compatibility - 16. wrong tenant / inaccessible target => denied without disclosure', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return { rows: [] }; // No row found for (examInstanceId, tenantId)
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'denied' });
});

test('BU-064 Duration-Window Compatibility - 17. DB failure => unavailable with no raw error leak', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      throw new Error('FATAL: database disk failure');
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'unavailable' });
});

test('BU-064 Duration-Window Compatibility - 18. missing/invalid SCHEDULED window invariant => unavailable', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';

  // Case 18a: window_starts_at is NULL
  const mockClientA = {
    query: async () => ({
      rows: [
        {
          lifecycle_state: 'SCHEDULED',
          window_starts_at: null,
          window_ends_at: WINDOW_END,
          configured_attempt_duration_seconds: 3600,
          latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
        },
      ],
    }),
  } as unknown as PoolClient;
  assert.deepStrictEqual(
    await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      mockClientA,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      mockEvaluator
    ),
    { type: 'unavailable' }
  );

  // Case 18b: window_ends_at is NULL
  const mockClientB = {
    query: async () => ({
      rows: [
        {
          lifecycle_state: 'SCHEDULED',
          window_starts_at: WINDOW_START,
          window_ends_at: null,
          configured_attempt_duration_seconds: 3600,
          latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
        },
      ],
    }),
  } as unknown as PoolClient;
  assert.deepStrictEqual(
    await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      mockClientB,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      mockEvaluator
    ),
    { type: 'unavailable' }
  );

  // Case 18c: window_starts_at >= window_ends_at
  const mockClientC = {
    query: async () => ({
      rows: [
        {
          lifecycle_state: 'SCHEDULED',
          window_starts_at: '2026-10-01T10:00:00Z',
          window_ends_at: '2026-10-01T08:00:00Z',
          configured_attempt_duration_seconds: 3600,
          latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
        },
      ],
    }),
  } as unknown as PoolClient;
  assert.deepStrictEqual(
    await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
      mockClientC,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      mockEvaluator
    ),
    { type: 'unavailable' }
  );
});

test('BU-064 Duration-Window Compatibility - 19. runtime performs SELECT-only behavior and no INSERT/UPDATE/DELETE', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const executedQueries: string[] = [];

  const mockClient = {
    query: async (queryText: string) => {
      executedQueries.push(queryText);
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            window_starts_at: WINDOW_START,
            window_ends_at: WINDOW_END,
            configured_attempt_duration_seconds: 5400,
            latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  await checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.strictEqual(executedQueries.length, 1);
  const sql = executedQueries[0].toUpperCase().trim();
  assert.ok(sql.startsWith('SELECT'), 'Query must start with SELECT');
  assert.ok(!sql.includes('INSERT'), 'Query must not contain INSERT');
  assert.ok(!sql.includes('UPDATE'), 'Query must not contain UPDATE');
  assert.ok(!sql.includes('DELETE'), 'Query must not contain DELETE');
});
