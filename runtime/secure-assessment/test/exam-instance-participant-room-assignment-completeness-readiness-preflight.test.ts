import { test } from 'node:test';
import * as assert from 'node:assert';
import type { PoolClient } from 'pg';
import { checkExamInstanceParticipantRoomAssignmentCompletenessReadiness } from '../src/exam-instance-participant-room-assignment-completeness-readiness-preflight.ts';
import type { CapabilityEvaluator } from '../src/exam-instance-participant-presence-readiness-preflight.ts';

const VALID_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VALID_EXAM_INSTANCE_ID = '22222222-2222-2222-2222-222222222222';

test('BU-075 - 1. invalid tenant UUID -> denied', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, 'invalid', VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false);
});

test('BU-075 - 2. invalid exam UUID -> denied', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, 'invalid', mockEvaluator);
  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false);
});

test('BU-075 - 3. capability denied -> denied', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'denied';
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false);
});

test('BU-075 - 4. explicit capability unavailable -> unavailable', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'unavailable';
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queried, false);
});

test('BU-075 - 5. capability evaluator throws -> unavailable', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => { throw new Error('eval error'); };
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queried, false);
});

test('BU-075 - 6. nonexistent Exam Instance -> preserve BU-062 fail-closed behavior', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => { return { rows: [] }; } // BU-062 first query returns empty
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'denied' });
});

test('BU-075 - 7. wrong tenant -> preserve BU-062 behavior', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => { return { rows: [] }; } // BU-062 first query returns empty due to WHERE tenant_id mismatch
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'denied' });
});

test('BU-075 - 8. non-SCHEDULED Exam Instance -> invalid_state', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const mockClient = {
    query: async () => { return { rows: [{ lifecycle_state: 'DRAFT' }] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'invalid_state' });
});

test('BU-075 - 9. zero participants -> not_ready / participant_empty', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '0' }] }; // BU-062 detects zero participants
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'not_ready', blocker: 'participant_empty' });
});

test('BU-075 - 10. participant presence ready + zero persisted Exam Rooms -> no_exam_rooms', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '5' }] }; // ParticipantCount = 5 from BU-062
      if (queryCallCount === 3) return { rows: [{ room_count: '0', assigned_count: '0' }] }; // BU-075 room query
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, {
    type: 'no_exam_rooms',
    tenantId: VALID_TENANT_ID,
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    participantCount: 5,
    assignedParticipantCount: 0,
    unassignedParticipantCount: 5
  });
});

test('BU-075 - 11. one room + one participant + no Participant-to-Room assignment', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '1' }] };
      if (queryCallCount === 3) return { rows: [{ room_count: '1', assigned_count: '0' }] };
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'participant_room_assignment_incomplete',
    participantCount: 1,
    assignedParticipantCount: 0,
    unassignedParticipantCount: 1
  });
});

test('BU-075 - 12. multiple participants + partial assignments', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '10' }] };
      if (queryCallCount === 3) return { rows: [{ room_count: '2', assigned_count: '4' }] };
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'participant_room_assignment_incomplete',
    participantCount: 10,
    assignedParticipantCount: 4,
    unassignedParticipantCount: 6
  });
});

test('BU-075 - 13. all participants assigned -> completeness_ready', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '3' }] };
      if (queryCallCount === 3) return { rows: [{ room_count: '1', assigned_count: '3' }] };
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, {
    type: 'participant_room_assignment_completeness_ready',
    tenantId: VALID_TENANT_ID,
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    participantCount: 3,
    assignedParticipantCount: 3,
    unassignedParticipantCount: 0
  });
});

test('BU-075 - 14. multiple participants assigned to the SAME Exam Room counts independently by rows', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '50' }] };
      if (queryCallCount === 3) return { rows: [{ room_count: '1', assigned_count: '50' }] }; // 50 assignments in 1 room
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, {
    type: 'participant_room_assignment_completeness_ready',
    tenantId: VALID_TENANT_ID,
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    participantCount: 50,
    assignedParticipantCount: 50,
    unassignedParticipantCount: 0
  });
});

test('BU-075 - 15. assignment belonging to another Exam Instance -> excluded from count', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  let roomQueryText = '';
  let roomQueryParams: any[] = [];
  const mockClient = {
    query: async (queryText: string, values: any[]) => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '5' }] };
      if (queryCallCount === 3) {
        roomQueryText = queryText;
        roomQueryParams = values;
        // The query filters by exam_instance_id = $2, assignments for other instances are ignored in the COUNT.
        return { rows: [{ room_count: '1', assigned_count: '0' }] };
      }
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.ok(roomQueryText.includes('WHERE tenant_id = $1 AND exam_instance_id = $2'));
  assert.deepStrictEqual(roomQueryParams, [VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID]);
});

test('BU-075 - 16. assignment belonging to another tenant -> excluded from count', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  let roomQueryText = '';
  let roomQueryParams: any[] = [];
  const mockClient = {
    query: async (queryText: string, values: any[]) => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '5' }] };
      if (queryCallCount === 3) {
        roomQueryText = queryText;
        roomQueryParams = values;
        return { rows: [{ room_count: '1', assigned_count: '0' }] };
      }
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.ok(roomQueryText.includes('WHERE tenant_id = $1 AND exam_instance_id = $2'));
  assert.deepStrictEqual(roomQueryParams, [VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID]);
});

test('BU-075 - 17. BU-075-owned room/assignment query failure -> unavailable', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '5' }] };
      if (queryCallCount === 3) {
        throw new Error('DB connection closed unexpectedly');
      }
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(result, { type: 'unavailable' });
});

test('BU-075 - 18. capability evaluator called exactly once', async () => {
  let evalCount = 0;
  const mockEvaluator: CapabilityEvaluator = async () => {
    evalCount++;
    return 'granted';
  };
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '5' }] };
      if (queryCallCount === 3) return { rows: [{ room_count: '1', assigned_count: '5' }] };
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.strictEqual(evalCount, 1);
});

test('BU-075 - 19. capability evaluator receives exact tenantId and examInstanceId context', async () => {
  let contextPassed: any = null;
  const mockEvaluator: CapabilityEvaluator = async (ctx) => {
    contextPassed = ctx;
    return 'granted';
  };
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '5' }] };
      if (queryCallCount === 3) return { rows: [{ room_count: '1', assigned_count: '5' }] };
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);
  assert.deepStrictEqual(contextPassed, { tenantId: VALID_TENANT_ID, examInstanceId: VALID_EXAM_INSTANCE_ID });
});

test('BU-075 - 20. participantCount used in final computation comes from BU-062 result', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  let queryCallCount = 0;
  const mockClient = {
    query: async () => {
      queryCallCount++;
      if (queryCallCount === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queryCallCount === 2) return { rows: [{ participant_count: '42' }] }; // BU-062
      if (queryCallCount === 3) return { rows: [{ room_count: '2', assigned_count: '40' }] };
      throw new Error('Unexpected query');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);

  if (result.type === 'not_ready' && result.blocker === 'participant_room_assignment_incomplete') {
    assert.strictEqual(result.participantCount, 42); // asserts that 42 from BU-062 is used
    assert.strictEqual(result.unassignedParticipantCount, 2);
  } else {
    assert.fail('Expected not_ready result');
  }
  assert.strictEqual(queryCallCount, 3);
});

test('BU-075 - 21. runtime performs no mutation query', async () => {
  const mockEvaluator: CapabilityEvaluator = async () => 'granted';
  const queries: string[] = [];
  const mockClient = {
    query: async (queryText: string) => {
      queries.push(queryText);
      if (queries.length === 1) return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      if (queries.length === 2) return { rows: [{ participant_count: '5' }] };
      if (queries.length === 3) return { rows: [{ room_count: '1', assigned_count: '5' }] };
      return { rows: [] };
    }
  } as unknown as PoolClient;

  await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(mockClient, VALID_TENANT_ID, VALID_EXAM_INSTANCE_ID, mockEvaluator);

  for (const q of queries) {
    const qUpper = q.toUpperCase();
    assert.strictEqual(qUpper.includes('INSERT'), false);
    assert.strictEqual(qUpper.includes('UPDATE'), false);
    assert.strictEqual(qUpper.includes('DELETE'), false);
  }
});
