import { test } from 'node:test';
import * as assert from 'node:assert';
import type { PoolClient } from 'pg';
import {
  checkExamInstanceExistingReadinessChecksCompositionPreflight,
  type CapabilityEvaluator,
} from '../src/exam-instance-existing-readiness-checks-composition-preflight.ts';

const VALID_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VALID_EXAM_INSTANCE_ID = '22222222-2222-2222-2222-222222222222';

type MockOverrides = {
  assessment_type_id?: string | null;
  assessment_type_display_label?: string | null;
  snapshot_count?: number;
  participant_count?: number;
  configured_attempt_duration_seconds?: number | null;
  latest_start_policy?: string | null;
  lifecycle_state?: string;
  queryThrows?: Error;
};

function createMockClient(overrides: MockOverrides = {}, queryTracker?: string[]) {
  return {
    query: async (queryText: string) => {
      if (queryTracker) queryTracker.push(queryText);
      if (overrides.queryThrows) throw overrides.queryThrows;

      const state = overrides.lifecycle_state || 'SCHEDULED';

      if (queryText.includes('assessment_type_display_label')) {
        return {
          rows: [
            {
              lifecycle_state: state,
              assessment_type_id: overrides.assessment_type_id !== undefined ? overrides.assessment_type_id : '33333333-3333-3333-3333-333333333333',
              assessment_type_display_label: overrides.assessment_type_display_label !== undefined ? overrides.assessment_type_display_label : 'Test Type',
            },
          ],
        };
      }

      if (queryText.includes('snapshot_count')) {
        return {
          rows: [
            {
              lifecycle_state: state,
              snapshot_count: overrides.snapshot_count !== undefined ? overrides.snapshot_count : 1,
            },
          ],
        };
      }

      if (queryText.includes('COUNT(*) as participant_count')) {
        return {
          rows: [
            {
              participant_count: overrides.participant_count !== undefined ? overrides.participant_count.toString() : '1',
            },
          ],
        };
      }

      if (queryText.includes('SELECT lifecycle_state') && !queryText.includes('COUNT') && !queryText.includes('window_starts_at') && !queryText.includes('latest_start_policy')) {
        return {
          rows: [
            {
              lifecycle_state: state,
            },
          ],
        };
      }

      if (queryText.includes('window_starts_at')) {
        return {
          rows: [
            {
              lifecycle_state: state,
              window_starts_at: '2026-10-01T08:00:00Z',
              window_ends_at: '2026-10-01T10:00:00Z',
              configured_attempt_duration_seconds: overrides.configured_attempt_duration_seconds !== undefined ? overrides.configured_attempt_duration_seconds : 3600,
              latest_start_policy: overrides.latest_start_policy !== undefined ? overrides.latest_start_policy : 'FULL_DURATION_BEYOND_WINDOW',
            },
          ],
        };
      }

      if (queryText.includes('latest_start_policy') && !queryText.includes('window_starts_at')) {
        return {
          rows: [
            {
              lifecycle_state: state,
              configured_attempt_duration_seconds: overrides.configured_attempt_duration_seconds !== undefined ? overrides.configured_attempt_duration_seconds : 3600,
              latest_start_policy: overrides.latest_start_policy !== undefined ? overrides.latest_start_policy : 'FULL_DURATION_BEYOND_WINDOW',
            },
          ],
        };
      }

      return { rows: [] };
    },
  } as unknown as PoolClient;
}

test('BU-065 Composition - 1. all five predecessor checks pass => existing_readiness_checks_pass', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const mockClient = createMockClient();

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'existing_readiness_checks_pass',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
  });
});

test('BU-065 Composition - 2. assessment type missing => not_ready / assessment_type_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const mockClient = createMockClient({ assessment_type_id: null, assessment_type_display_label: null });

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    category: 'assessment_type',
    blocker: 'assessment_type_missing',
  });
});

test('BU-065 Composition - 3. question snapshot empty, with prior category passing => question_snapshot_empty', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const mockClient = createMockClient({ snapshot_count: 0 });

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    category: 'question_snapshot_presence',
    blocker: 'question_snapshot_empty',
  });
});

test('BU-065 Composition - 4. participant count zero, with prior categories passing => participant_empty', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const mockClient = createMockClient({ participant_count: 0 });

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    category: 'participant_presence',
    blocker: 'participant_empty',
  });
});

test('BU-065 Composition - 5. attempt duration missing => timing_configuration_presence / attempt_duration_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const mockClient = createMockClient({ configured_attempt_duration_seconds: null });

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    category: 'timing_configuration_presence',
    blocker: 'attempt_duration_missing',
  });
});

test('BU-065 Composition - 6. latest-start policy missing => timing_configuration_presence / latest_start_policy_missing', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const mockClient = createMockClient({ latest_start_policy: null });

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    category: 'timing_configuration_presence',
    blocker: 'latest_start_policy_missing',
  });
});

test('BU-065 Composition - 7. LATE_START_BLOCKED with configured duration exceeding window => attempt_duration_exceeds_window', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  // Window is 2 hours (7200 sec). 10800 > 7200.
  const mockClient = createMockClient({ latest_start_policy: 'LATE_START_BLOCKED', configured_attempt_duration_seconds: 10800 });

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, {
    type: 'not_ready',
    category: 'duration_window_policy_compatibility',
    blocker: 'attempt_duration_exceeds_window',
  });
});

test('BU-065 Composition - 8. non-SCHEDULED => invalid_state', async () => {
  const nonScheduledStates = ['DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
  for (const state of nonScheduledStates) {
    const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
    const mockClient = createMockClient({ lifecycle_state: state });

    const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
      mockClient,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      mockEvaluator
    );

    assert.deepStrictEqual(result, { type: 'invalid_state' });
  }
});

test('BU-065 Composition - 9. wrong tenant / inaccessible => denied with no existence disclosure', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  // empty results simulate inaccessible
  const mockClient = {
    query: async () => ({ rows: [] }),
  } as unknown as PoolClient;

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'denied' });
});

test('BU-065 Composition - 10. capability denied => denied', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'denied' as const;
  let queryCalled = false;
  const mockClient = {
    query: async () => { queryCalled = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queryCalled, false);
});

test('BU-065 Composition - 11. capability unavailable / evaluator failure => unavailable', async () => {
  const mockEvaluator1: CapabilityEvaluator = async () => 'unavailable' as const;
  let queryCalled1 = false;
  const mockClient1 = {
    query: async () => { queryCalled1 = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result1 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient1,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator1
  );

  assert.deepStrictEqual(result1, { type: 'unavailable' });
  assert.strictEqual(queryCalled1, false);

  const mockEvaluator2: CapabilityEvaluator = async () => { throw new Error('eval error'); };
  const result2 = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient1,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator2
  );
  assert.deepStrictEqual(result2, { type: 'unavailable' });
});

test('BU-065 Composition - 12. database/dependency failure => unavailable with no raw error leak', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const mockClient = createMockClient({ queryThrows: new Error('FATAL: disk error') });

  const result = await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.deepStrictEqual(result, { type: 'unavailable' });
});

test('BU-065 Composition - 13. composition performs no INSERT / UPDATE / DELETE', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const queries: string[] = [];
  const mockClient = createMockClient({}, queries);

  await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.ok(queries.length > 0);
  for (const q of queries) {
    const sql = q.toUpperCase();
    assert.ok(sql.startsWith('SELECT') || sql.trim().startsWith('SELECT'), 'Query must be SELECT');
    assert.ok(!sql.includes('INSERT'), 'Query must not contain INSERT');
    assert.ok(!sql.includes('UPDATE'), 'Query must not contain UPDATE');
    assert.ok(!sql.includes('DELETE'), 'Query must not contain DELETE');
  }
});

test('BU-065 Composition - 14. composition does NOT mutate lifecycle_state to READY', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const queries: string[] = [];
  const mockClient = createMockClient({}, queries);

  await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  for (const q of queries) {
    const sql = q.toUpperCase();
    assert.ok(!sql.includes('UPDATE SECURE_ASSESSMENT_EXAM_INSTANCES SET LIFECYCLE_STATE = \'READY\''));
  }
});

test('BU-065 Composition - 15. composition creates no Exam Attempt and no Exam Session', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted' as const;
  const queries: string[] = [];
  const mockClient = createMockClient({}, queries);

  await checkExamInstanceExistingReadinessChecksCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  for (const q of queries) {
    const sql = q.toUpperCase();
    assert.ok(!sql.includes('INSERT INTO SECURE_ASSESSMENT_EXAM_ATTEMPTS'));
    assert.ok(!sql.includes('INSERT INTO SECURE_ASSESSMENT_EXAM_SESSIONS'));
  }
});
