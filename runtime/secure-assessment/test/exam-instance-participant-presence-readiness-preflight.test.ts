import { test } from 'node:test';
import * as assert from 'node:assert';
import type { PoolClient } from 'pg';
import { checkExamInstanceParticipantPresenceReadiness, type CapabilityEvaluator } from '../src/exam-instance-participant-presence-readiness-preflight.ts';

const VALID_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VALID_EXAM_INSTANCE_ID = '22222222-2222-2222-2222-222222222222';

test('BU-062 Participant Presence Preflight - 1. SCHEDULED + granted + exactly 1 same-tenant participant', async () => {
  let contextPassed: any = null;
  const mockEvaluator: CapabilityEvaluator = async (ctx) => {
    contextPassed = ctx;
    return 'granted';
  };

  let queryCallCount = 0;
  const mockClient = {
    query: async (queryText: string, values: any[]) => {
      queryCallCount++;
      if (queryCallCount === 1) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (queryCallCount === 2) {
        return { rows: [{ participant_count: '1' }] };
      }
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  
  assert.deepStrictEqual(contextPassed, { tenantId: VALID_TENANT_ID, examInstanceId: VALID_EXAM_INSTANCE_ID });
  assert.deepStrictEqual(result, {
    type: 'participant_presence_ready',
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    tenantId: VALID_TENANT_ID,
    participantCount: 1
  });
});

test('BU-062 Participant Presence Preflight - 2. SCHEDULED + granted + 2 same-tenant participants', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '2' }] };
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  
  assert.strictEqual(result.type, 'participant_presence_ready');
  if (result.type === 'participant_presence_ready') {
    assert.strictEqual(result.participantCount, 2);
  }
});

test('BU-062 Participant Presence Preflight - 3. SCHEDULED + zero participants', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '0' }] };
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'participant_empty'
  });
});

test('BU-062 Participant Presence Preflight - 4. non-SCHEDULED Exam Instance yields invalid_state', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return { rows: [{ lifecycle_state: 'DRAFT' }] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'invalid_state' });
});

test('BU-062 Participant Presence Preflight - 5. denied evaluator yields denied', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'denied';
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false);
});

test('BU-062 Participant Presence Preflight - 6. unavailable evaluator yields unavailable', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'unavailable';
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queried, false);
});

test('BU-062 Participant Presence Preflight - 7. throwing/rejecting evaluator yields unavailable', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => { throw new Error('Eval error'); };
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queried, false);
});

test('BU-062 Participant Presence Preflight - 8. invalid UUID yields denied and zero DB query', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, 'invalid', VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false);
});

test('BU-062 Participant Presence Preflight - 9. wrong tenant / inaccessible yields denied', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'denied' });
});

test('BU-062 Participant Presence Preflight - 10. DB query failure yields unavailable and no error leak', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => {
      throw new Error('DB CONNECTION DEAD');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'unavailable' });
});

test('BU-062 Participant Presence Preflight - 11. SELECT only - no mutation', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const queries: string[] = [];
  const mockClient = {
    query: async (queryText: string) => {
      queries.push(queryText);
      if (queries.length === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queries.length === 2) return { rows: [{ participant_count: '1' }] };
      return { rows: [] };
    }
  } as unknown as PoolClient;

  await checkExamInstanceParticipantPresenceReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  
  for (const q of queries) {
    const qUpper = q.toUpperCase();
    assert.strictEqual(qUpper.includes('INSERT'), false);
    assert.strictEqual(qUpper.includes('UPDATE'), false);
    assert.strictEqual(qUpper.includes('DELETE'), false);
  }
});
