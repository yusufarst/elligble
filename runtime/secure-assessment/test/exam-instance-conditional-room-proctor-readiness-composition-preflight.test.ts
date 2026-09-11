import { test } from 'node:test';
import * as assert from 'node:assert';
import type { PoolClient } from 'pg';
import {
  checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight,
  checkExamInstanceConditionalRoomProctorReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-conditional-room-proctor-readiness-composition-preflight.ts';

const VALID_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const VALID_EXAM_INSTANCE_ID = '22222222-2222-2222-2222-222222222222';

const grantedEvaluator: CapabilityEvaluator = async () => 'granted' as const;
const deniedEvaluator: CapabilityEvaluator = async () => 'denied' as const;
const unavailableEvaluator: CapabilityEvaluator = async () => 'unavailable' as const;
const throwingEvaluator: CapabilityEvaluator = async () => { throw new Error('eval error'); };

test('BU-077 - 1. invalid tenant UUID -> denied', async () => {
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    'not-a-uuid',
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false);
});

test('BU-077 - 2. invalid exam UUID -> denied', async () => {
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    'not-a-uuid',
    grantedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false);
});

test('BU-077 - 3. capability denied -> denied', async () => {
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    deniedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'denied' });
  assert.strictEqual(queried, false);
});

test('BU-077 - 4. explicit capability unavailable -> unavailable', async () => {
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    unavailableEvaluator
  );
  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queried, false);
});

test('BU-077 - 5. capability evaluator throws -> unavailable', async () => {
  let queried = false;
  const mockClient = {
    query: async () => { queried = true; return { rows: [] }; }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    throwingEvaluator
  );
  assert.deepStrictEqual(result, { type: 'unavailable' });
  assert.strictEqual(queried, false);
});

test('BU-077 - 6. nonexistent Exam Instance -> denied', async () => {
  const mockClient = {
    query: async () => ({ rows: [] })
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'denied' });
});

test('BU-077 - 7. wrong tenant -> denied', async () => {
  const mockClient = {
    query: async (_sql: string, params: any[]) => {
      // Mock filtering by tenant_id: mismatch returns empty rows
      if (params[1] !== VALID_TENANT_ID) return { rows: [] };
      return {
        rows: [{
          lifecycle_state: 'SCHEDULED',
          room_based_operations_enabled: false,
          proctor_per_room_required: false
        }]
      };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    '33333333-3333-3333-3333-333333333333',
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'denied' });
});

test('BU-077 - 8. non-SCHEDULED Exam Instance -> invalid_state', async () => {
  for (const nonScheduledState of ['DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'CANCELLED']) {
    const mockClient = {
      query: async () => ({
        rows: [{
          lifecycle_state: nonScheduledState,
          room_based_operations_enabled: true,
          proctor_per_room_required: true
        }]
      })
    } as unknown as PoolClient;

    const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      mockClient,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      grantedEvaluator
    );
    assert.deepStrictEqual(result, { type: 'invalid_state' }, `Failed for state: ${nonScheduledState}`);
  }
});

test('BU-077 - 9. policy NULL / NULL -> not_ready / room_proctor_requirement_policy_unconfigured', async () => {
  const mockClient = {
    query: async () => ({
      rows: [{
        lifecycle_state: 'SCHEDULED',
        room_based_operations_enabled: null,
        proctor_per_room_required: null
      }]
    })
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'room_proctor_requirement_policy_unconfigured'
  });
});

test('BU-077 - 10. partial policy (NULL/FALSE, NULL/TRUE, FALSE/NULL, TRUE/NULL) -> not_ready / room_proctor_requirement_policy_unconfigured', async () => {
  const partialPolicies = [
    { room_based_operations_enabled: null, proctor_per_room_required: false },
    { room_based_operations_enabled: null, proctor_per_room_required: true },
    { room_based_operations_enabled: false, proctor_per_room_required: null },
    { room_based_operations_enabled: true, proctor_per_room_required: null }
  ];

  for (const pol of partialPolicies) {
    const mockClient = {
      query: async () => ({
        rows: [{
          lifecycle_state: 'SCHEDULED',
          ...pol
        }]
      })
    } as unknown as PoolClient;

    const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
      mockClient,
      VALID_TENANT_ID,
      VALID_EXAM_INSTANCE_ID,
      grantedEvaluator
    );
    assert.deepStrictEqual(result, {
      type: 'not_ready',
      blocker: 'room_proctor_requirement_policy_unconfigured'
    });
  }
});

test('BU-077 - 11. invalid policy FALSE / TRUE -> invalid_state', async () => {
  const mockClient = {
    query: async () => ({
      rows: [{
        lifecycle_state: 'SCHEDULED',
        room_based_operations_enabled: false,
        proctor_per_room_required: true
      }]
    })
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'invalid_state' });
});

test('BU-077 - 12. policy FALSE / FALSE -> room_proctor_readiness_not_applicable', async () => {
  let queryCount = 0;
  const mockClient = {
    query: async () => {
      queryCount++;
      return {
        rows: [{
          lifecycle_state: 'SCHEDULED',
          room_based_operations_enabled: false,
          proctor_per_room_required: false
        }]
      };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'room_proctor_readiness_not_applicable',
    tenantId: VALID_TENANT_ID,
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    roomBasedOperationsEnabled: false,
    proctorPerRoomRequired: false
  });
  // Must NOT inspect rooms or participants (only 1 query executed)
  assert.strictEqual(queryCount, 1);
});

test('BU-077 - 13. policy TRUE / FALSE with zero participants -> not_ready / participant_empty', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: false
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        // BU-062 subquery
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        // participant count = 0
        return { rows: [{ participant_count: '0' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'participant_empty'
  });
});

test('BU-077 - 14. policy TRUE / FALSE with zero rooms -> not_ready / exam_room_empty', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: false
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '5' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms')) {
        // room count = 0
        return { rows: [{ room_count: '0', assigned_count: '0' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'exam_room_empty'
  });
});

test('BU-077 - 15. policy TRUE / FALSE with incomplete participant room assignment -> not_ready / participant_room_assignment_incomplete', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: false
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '5' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms')) {
        // 2 rooms, 3 of 5 assigned
        return { rows: [{ room_count: '2', assigned_count: '3' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'participant_room_assignment_incomplete',
    participantCount: 5,
    assignedParticipantCount: 3,
    unassignedParticipantCount: 2
  });
});

test('BU-077 - 16. policy TRUE / FALSE with complete participant room assignment -> room_proctor_readiness_ready (no proctor check)', async () => {
  let proctorQueried = false;
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('secure_assessment_proctor_assignments') || sql.includes('covered_exam_room_count')) {
        proctorQueried = true;
      }
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: false
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '5' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms')) {
        // 2 rooms, all 5 assigned
        return { rows: [{ room_count: '2', assigned_count: '5' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'room_proctor_readiness_ready',
    tenantId: VALID_TENANT_ID,
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    roomBasedOperationsEnabled: true,
    proctorPerRoomRequired: false,
    participantCount: 5,
    assignedParticipantCount: 5
  });
  // BU-074 proctor check must NOT be invoked when proctor_per_room_required is false
  assert.strictEqual(proctorQueried, false);
});

test('BU-077 - 17. policy TRUE / TRUE with zero participants -> not_ready / participant_empty', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: true
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '0' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'participant_empty'
  });
});

test('BU-077 - 18. policy TRUE / TRUE with zero rooms -> not_ready / exam_room_empty', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: true
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '5' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms')) {
        return { rows: [{ room_count: '0', assigned_count: '0' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'exam_room_empty'
  });
});

test('BU-077 - 19. policy TRUE / TRUE with incomplete participant room assignment -> not_ready / participant_room_assignment_incomplete', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: true
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '4' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms')) {
        return { rows: [{ room_count: '2', assigned_count: '2' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'participant_room_assignment_incomplete',
    participantCount: 4,
    assignedParticipantCount: 2,
    unassignedParticipantCount: 2
  });
});

test('BU-077 - 20. policy TRUE / TRUE with complete participants but zero active proctors -> not_ready / active_proctor_assignment_empty', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: true
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '3' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms') && sql.includes('assigned_count')) {
        return { rows: [{ room_count: '1', assigned_count: '3' }] };
      }
      if (sql.includes('secure_assessment_proctor_assignments')) {
        // Zero active proctors
        return { rows: [{ count: '0' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'active_proctor_assignment_empty'
  });
});

test('BU-077 - 21. policy TRUE / TRUE with complete participants but incomplete active proctor room coverage -> not_ready / active_proctor_room_coverage_incomplete', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('covered_exam_room_count')) {
        // 2 rooms, only 1 covered
        return { rows: [{ exam_room_count: '2', covered_exam_room_count: '1' }] };
      }
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: true
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '3' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms') && sql.includes('assigned_count')) {
        return { rows: [{ room_count: '2', assigned_count: '3' }] };
      }
      if (sql.includes('secure_assessment_proctor_assignments')) {
        return { rows: [{ count: '1' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'not_ready',
    blocker: 'active_proctor_room_coverage_incomplete',
    examRoomCount: 2,
    coveredExamRoomCount: 1,
    uncoveredExamRoomCount: 1
  });
});

test('BU-077 - 22. policy TRUE / TRUE with complete participants AND complete active proctor room coverage -> room_proctor_readiness_ready', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('covered_exam_room_count')) {
        // 2 rooms, all 2 covered
        return { rows: [{ exam_room_count: '2', covered_exam_room_count: '2' }] };
      }
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: true
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '6' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms') && sql.includes('assigned_count')) {
        return { rows: [{ room_count: '2', assigned_count: '6' }] };
      }
      if (sql.includes('secure_assessment_proctor_assignments')) {
        return { rows: [{ count: '2' }] };
      }
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, {
    type: 'room_proctor_readiness_ready',
    tenantId: VALID_TENANT_ID,
    examInstanceId: VALID_EXAM_INSTANCE_ID,
    roomBasedOperationsEnabled: true,
    proctorPerRoomRequired: true,
    examRoomCount: 2,
    coveredExamRoomCount: 2,
    participantCount: 6,
    assignedParticipantCount: 6
  });
});

test('BU-077 - 23. external capability evaluator called exactly once with exact context', async () => {
  let callCount = 0;
  let receivedContext: any = null;
  const mockEvaluator: CapabilityEvaluator = async (ctx) => {
    callCount++;
    receivedContext = ctx;
    return 'granted' as const;
  };

  const mockClient = {
    query: async () => ({
      rows: [{
        lifecycle_state: 'SCHEDULED',
        room_based_operations_enabled: false,
        proctor_per_room_required: false
      }]
    })
  } as unknown as PoolClient;

  await checkExamInstanceConditionalRoomProctorReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    mockEvaluator
  );

  assert.strictEqual(callCount, 1, 'Capability evaluator must be called exactly once');
  assert.deepStrictEqual(receivedContext, {
    tenantId: VALID_TENANT_ID,
    examInstanceId: VALID_EXAM_INSTANCE_ID
  });
});

test('BU-077 - 24. query failure in BU-077 own query -> unavailable', async () => {
  const mockClient = {
    query: async () => { throw new Error('DB connection lost'); }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'unavailable' });
});

test('BU-077 - 25. sub-call failure in BU-075 -> unavailable', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: false
          }]
        };
      }
      throw new Error('BU-075 query explosion');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'unavailable' });
});

test('BU-077 - 26. sub-call failure in BU-074 -> unavailable', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('public.secure_assessment_exam_instances')) {
        return {
          rows: [{
            lifecycle_state: 'SCHEDULED',
            room_based_operations_enabled: true,
            proctor_per_room_required: true
          }]
        };
      }
      if (sql.includes('SELECT lifecycle_state')) {
        return { rows: [{ lifecycle_state: 'SCHEDULED' }] };
      }
      if (sql.includes('secure_assessment_exam_participants')) {
        return { rows: [{ participant_count: '2' }] };
      }
      if (sql.includes('secure_assessment_exam_rooms') && sql.includes('assigned_count')) {
        return { rows: [{ room_count: '1', assigned_count: '2' }] };
      }
      // BU-074 query fails
      throw new Error('BU-074 query explosion');
    }
  } as unknown as PoolClient;

  const result = await checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );
  assert.deepStrictEqual(result, { type: 'unavailable' });
});

test('BU-077 - 27. BU-077 performs zero write operations', async () => {
  const executedSqls: string[] = [];
  const mockClient = {
    query: async (sql: string) => {
      executedSqls.push(sql);
      return {
        rows: [{
          lifecycle_state: 'SCHEDULED',
          room_based_operations_enabled: false,
          proctor_per_room_required: false
        }]
      };
    }
  } as unknown as PoolClient;

  await checkExamInstanceConditionalRoomProctorReadiness(
    mockClient,
    VALID_TENANT_ID,
    VALID_EXAM_INSTANCE_ID,
    grantedEvaluator
  );

  for (const sql of executedSqls) {
    const upper = sql.toUpperCase();
    assert.strictEqual(upper.includes('INSERT'), false, 'Must not execute INSERT');
    assert.strictEqual(upper.includes('UPDATE'), false, 'Must not execute UPDATE');
    assert.strictEqual(upper.includes('DELETE'), false, 'Must not execute DELETE');
    assert.strictEqual(upper.includes('ALTER'), false, 'Must not execute ALTER');
    assert.strictEqual(upper.includes('DROP'), false, 'Must not execute DROP');
  }
});
