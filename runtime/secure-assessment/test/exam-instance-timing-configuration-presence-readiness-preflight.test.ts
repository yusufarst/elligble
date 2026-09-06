import { test } from 'node:test';
import * as assert from 'node:assert';
import type { PoolClient } from 'pg';
import {
  checkExamInstanceTimingConfigurationPresenceReadiness,
  type CapabilityEvaluator,
  type LatestStartPolicy,
} from '../src/exam-instance-timing-configuration-presence-readiness-preflight.ts';

const VALID_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VALID_EXAM_INSTANCE_ID = '22222222-2222-2222-2222-222222222222';

test('BU-063 Timing Configuration Presence Preflight - 1. SCHEDULED + granted + duration + latest policy present -> timing_configuration_presence_ready', async () => {
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
            configured_attempt_duration_seconds: 3600,
            latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
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
    type: 'timing_configuration_presence_ready',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
    configuredAttemptDurationSeconds: 3600,
    latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW',
  });
});

test('BU-063 Timing Configuration Presence Preflight - 2. Return configuredAttemptDurationSeconds exactly (string parsing test)', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            configured_attempt_duration_seconds: '5400',
            latest_start_policy: 'REMAINING_WINDOW_ONLY',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.strictEqual(result.type, 'timing_configuration_presence_ready');
  if (result.type === 'timing_configuration_presence_ready') {
    assert.strictEqual(result.configuredAttemptDurationSeconds, 5400);
    assert.strictEqual(typeof result.configuredAttemptDurationSeconds, 'number');
  }
});

test('BU-063 Timing Configuration Presence Preflight - 3. Return latestStartPolicy exactly across all canonical values', async () => {
  const policies: LatestStartPolicy[] = [
    'FULL_DURATION_BEYOND_WINDOW',
    'REMAINING_WINDOW_ONLY',
    'LATE_START_BLOCKED',
  ];

  for (const policy of policies) {
    const mockEvaluator: CapabilityEvaluator = async () => 'granted';
    const mockClient = {
      query: async () => {
        return {
          rows: [
            {
              lifecycle_state: 'SCHEDULED',
              configured_attempt_duration_seconds: 1800,
              latest_start_policy: policy,
            },
          ],
        };
      },
    } as unknown as PoolClient;

    const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
      mockClient,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      mockEvaluator
    );

    assert.strictEqual(result.type, 'timing_configuration_presence_ready');
    if (result.type === 'timing_configuration_presence_ready') {
      assert.strictEqual(result.latestStartPolicy, policy);
    }
  }
});

test('BU-063 Timing Configuration Presence Preflight - 4. duration NULL -> not_ready / attempt_duration_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            configured_attempt_duration_seconds: null,
            latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
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

test('BU-063 Timing Configuration Presence Preflight - 5. latest_start_policy NULL -> not_ready / latest_start_policy_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            configured_attempt_duration_seconds: 3600,
            latest_start_policy: null,
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
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

test('BU-063 Timing Configuration Presence Preflight - 6. both NULL -> deterministic first blocker: attempt_duration_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            configured_attempt_duration_seconds: null,
            latest_start_policy: null,
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
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

test('BU-063 Timing Configuration Presence Preflight - 7. non-SCHEDULED states yield invalid_state', async () => {
  const nonScheduledStates = ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED'];

  for (const state of nonScheduledStates) {
    const mockEvaluator: CapabilityEvaluator = async () => 'granted';
    const mockClient = {
      query: async () => {
        return {
          rows: [
            {
              lifecycle_state: state,
              configured_attempt_duration_seconds: 3600,
              latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
            },
          ],
        };
      },
    } as unknown as PoolClient;

    const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
      mockClient,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      mockEvaluator
    );

    assert.deepStrictEqual(result, { type: 'invalid_state' }, `Expected invalid_state for lifecycle state ${state}`);
  }
});

test('BU-063 Timing Configuration Presence Preflight - 8. denied evaluator yields denied and zero DB query', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'denied';
  let queried = false;
  const mockClient = {
    query: async () => {
      queried = true;
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false, 'Expected zero DB query on denied capability');
});

test('BU-063 Timing Configuration Presence Preflight - 9. unavailable evaluator yields unavailable and zero DB query', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'unavailable';
  let queried = false;
  const mockClient = {
    query: async () => {
      queried = true;
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queried, false, 'Expected zero DB query on unavailable capability');
});

test('BU-063 Timing Configuration Presence Preflight - 10. throwing/rejecting evaluator yields unavailable and zero DB query', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => {
    throw new Error('Network timeout during capability check');
  };
  let queried = false;
  const mockClient = {
    query: async () => {
      queried = true;
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queried, false, 'Expected zero DB query on throwing evaluator');
});

test('BU-063 Timing Configuration Presence Preflight - 11. invalid UUID yields denied, zero evaluator call, zero DB query', async () => {
  let evaluatorCalled = false;
  const mockEvaluator: CapabilityEvaluator = async () => {
    evaluatorCalled = true;
    return 'granted';
  };
  let queried = false;
  const mockClient = {
    query: async () => {
      queried = true;
      return { rows: [] };
    },
  } as unknown as PoolClient;

  // Invalid tenantId
  const res1 = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    'invalid-uuid',
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );
  assert.deepStrictEqual(res1, { type: 'denied' });
  assert.strictEqual(evaluatorCalled, false);
  assert.strictEqual(queried, false);

  // Invalid examInstanceId
  const res2 = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    VALID_TENANT_ID,
    'not-a-uuid',
    mockEvaluator
  );
  assert.deepStrictEqual(res2, { type: 'denied' });
  assert.strictEqual(evaluatorCalled, false);
  assert.strictEqual(queried, false);
});

test('BU-063 Timing Configuration Presence Preflight - 12. wrong tenant / inaccessible Exam Instance yields denied without disclosure', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'denied' });
});

test('BU-063 Timing Configuration Presence Preflight - 13. DB query failure yields unavailable with no raw error leak', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      throw new Error('connection terminated unexpectedly');
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'unavailable' });
});

test('BU-063 Timing Configuration Presence Preflight - 14. runtime performs SELECT-only query behavior with no mutation', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let executedSql = '';
  const mockClient = {
    query: async (sql: string) => {
      executedSql = sql;
      return {
        rows: [
          {
            lifecycle_state: 'SCHEDULED',
            configured_attempt_duration_seconds: 3600,
            latest_start_policy: 'FULL_DURATION_BEYOND_WINDOW',
          },
        ],
      };
    },
  } as unknown as PoolClient;

  const result = await checkExamInstanceTimingConfigurationPresenceReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.strictEqual(result.type, 'timing_configuration_presence_ready');
  assert.ok(executedSql.trim().toUpperCase().startsWith('SELECT'), 'SQL should start with SELECT');
  assert.ok(!executedSql.toUpperCase().includes('INSERT'), 'SQL should not contain INSERT');
  assert.ok(!executedSql.toUpperCase().includes('UPDATE'), 'SQL should not contain UPDATE');
  assert.ok(!executedSql.toUpperCase().includes('DELETE'), 'SQL should not contain DELETE');
});
