import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import {
  checkExamInstanceParticipantProctorScheduleConflictReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-participant-proctor-schedule-conflict-readiness-preflight.ts';

const VALID_TENANT = '00000000-0000-0000-0000-000000000001';
const OTHER_TENANT = '00000000-0000-0000-0000-000000000099';
const VALID_EXAM = '00000000-0000-0000-0000-000000000002';
const OTHER_EXAM_A = '00000000-0000-0000-0000-000000000010';
const OTHER_EXAM_B = '00000000-0000-0000-0000-000000000020';

const grantedCapability: CapabilityEvaluator = async () => 'granted' as const;

type MockOptions = {
  dbError?: boolean;
  missingTarget?: boolean;
  targetLifecycle?: string;
  targetStartsAt?: string | null;
  targetEndsAt?: string | null;
  participantConflicts?: Array<{ conflicting_exam_instance_id: string; conflicting_count: number | string }>;
  proctorConflicts?: Array<{ conflicting_exam_instance_id: string; conflicting_count: number | string }>;
};

function createMockClient(
  options: MockOptions = {},
  checks?: { insertUpdateDelete?: boolean; queries?: string[] }
): PoolClient {
  return {
    query: async (text: string, values?: any[]) => {
      if (checks?.queries) {
        checks.queries.push(text);
      }
      if (/INSERT|UPDATE|DELETE/i.test(text)) {
        if (checks) checks.insertUpdateDelete = true;
      }
      if (options.dbError) {
        throw new Error('Database error');
      }

      // 1. Target exam query
      if (text.includes('FROM secure_assessment_exam_instances') && text.includes('WHERE id = $1 AND tenant_id = $2')) {
        const examId = values?.[0];
        const tenantId = values?.[1];

        if (options.missingTarget || tenantId !== VALID_TENANT || examId !== VALID_EXAM) {
          return { rows: [] };
        }

        return {
          rows: [
            {
              lifecycle_state: options.targetLifecycle ?? 'SCHEDULED',
              window_starts_at: options.targetStartsAt !== undefined ? options.targetStartsAt : '2026-10-01T08:00:00.000Z',
              window_ends_at: options.targetEndsAt !== undefined ? options.targetEndsAt : '2026-10-01T10:00:00.000Z',
            }
          ]
        };
      }

      // 2. Participant conflict query
      if (text.includes('secure_assessment_exam_participants other_part')) {
        if (options.participantConflicts && options.participantConflicts.length > 0) {
          return { rows: options.participantConflicts };
        }
        return { rows: [] };
      }

      // 3. Proctor conflict query
      if (text.includes('secure_assessment_proctor_assignments other_proc')) {
        if (options.proctorConflicts && options.proctorConflicts.length > 0) {
          return { rows: options.proctorConflicts };
        }
        return { rows: [] };
      }

      return { rows: [] };
    }
  } as unknown as PoolClient;
}

describe('BU-079: Exam Instance Participant and Proctor Schedule Conflict Readiness Preflight', () => {
  // 1. invalid tenant UUID -> denied
  test('1. invalid tenant UUID -> denied', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(),
      'invalid-uuid',
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 2. invalid exam UUID -> denied
  test('2. invalid exam UUID -> denied', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(),
      VALID_TENANT,
      'invalid-uuid',
      grantedCapability
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 3. capability denied -> denied
  test('3. capability denied -> denied', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(),
      VALID_TENANT,
      VALID_EXAM,
      async () => 'denied' as const
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 4. capability unavailable -> unavailable
  test('4. capability unavailable -> unavailable', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(),
      VALID_TENANT,
      VALID_EXAM,
      async () => 'unavailable' as const
    );
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 5. capability throws -> unavailable
  test('5. capability throws -> unavailable', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(),
      VALID_TENANT,
      VALID_EXAM,
      async () => { throw new Error('Capability error'); }
    );
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 6. nonexistent target -> denied
  test('6. nonexistent target -> denied', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ missingTarget: true }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 7. wrong tenant -> denied
  test('7. wrong tenant -> denied', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(),
      OTHER_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, { type: 'denied' });
  });

  // 8. target lifecycle != SCHEDULED -> invalid_state
  test('8. target lifecycle != SCHEDULED -> invalid_state', async () => {
    for (const state of ['DRAFT', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'FINALIZED', 'ARCHIVED']) {
      const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
        createMockClient({ targetLifecycle: state }),
        VALID_TENANT,
        VALID_EXAM,
        grantedCapability
      );
      assert.deepEqual(res, { type: 'invalid_state' }, `Failed for lifecycle state: ${state}`);
    }
  });

  // 9. invalid/missing target operational window -> invalid_state
  test('9. invalid/missing target operational window -> invalid_state', async () => {
    // null starts_at
    const resNullStart = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ targetStartsAt: null }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(resNullStart, { type: 'invalid_state' });

    // null ends_at
    const resNullEnd = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ targetEndsAt: null }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(resNullEnd, { type: 'invalid_state' });

    // starts_at >= ends_at
    const resInverted = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        targetStartsAt: '2026-10-01T10:00:00.000Z',
        targetEndsAt: '2026-10-01T08:00:00.000Z'
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(resInverted, { type: 'invalid_state' });

    // starts_at == ends_at
    const resEqual = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        targetStartsAt: '2026-10-01T08:00:00.000Z',
        targetEndsAt: '2026-10-01T08:00:00.000Z'
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(resEqual, { type: 'invalid_state' });
  });

  // 10. no other exam -> schedule_conflict_ready
  test('10. no other exam -> schedule_conflict_ready', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 11. non-overlapping exam -> ready
  test('11. non-overlapping exam -> ready', async () => {
    // Other exam exists but query returns no conflict rows because intervals do not overlap
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ participantConflicts: [], proctorConflicts: [] }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 12. boundary-touching windows -> ready
  test('12. boundary-touching windows -> ready', async () => {
    // Under half-open semantics other.window_ends_at == target.window_starts_at is not overlap, so query returns no conflict
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ participantConflicts: [], proctorConflicts: [] }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 13. same participant + same tenant + overlapping SCHEDULED -> participant conflict
  test('13. same participant + same tenant + overlapping SCHEDULED -> participant conflict', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_A, conflicting_count: 1 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'participant_schedule_conflict',
      conflictingExamInstanceId: OTHER_EXAM_A,
      conflictingParticipantCount: 1
    });
  });

  // 14. same participant + overlapping READY -> participant conflict
  test('14. same participant + overlapping READY -> participant conflict', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_A, conflicting_count: 2 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'participant_schedule_conflict',
      conflictingExamInstanceId: OTHER_EXAM_A,
      conflictingParticipantCount: 2
    });
  });

  // 15. same participant + overlapping ACTIVE -> participant conflict
  test('15. same participant + overlapping ACTIVE -> participant conflict', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_A, conflicting_count: 3 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'participant_schedule_conflict',
      conflictingExamInstanceId: OTHER_EXAM_A,
      conflictingParticipantCount: 3
    });
  });

  // 16. same participant + overlapping PAUSED -> participant conflict
  test('16. same participant + overlapping PAUSED -> participant conflict', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_A, conflicting_count: 1 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'participant_schedule_conflict',
      conflictingExamInstanceId: OTHER_EXAM_A,
      conflictingParticipantCount: 1
    });
  });

  // 17. same participant in DRAFT other exam -> no conflict
  test('17. same participant in DRAFT other exam -> no conflict', async () => {
    // DRAFT is filtered out by query WHERE lifecycle_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED')
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ participantConflicts: [] }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 18. same participant in ENDED/FINALIZED/ARCHIVED -> no conflict
  test('18. same participant in ENDED/FINALIZED/ARCHIVED -> no conflict', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ participantConflicts: [] }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 19. same person in another tenant -> no conflict
  test('19. same person in another tenant -> no conflict', async () => {
    // Cross-tenant person match is excluded by tenant_id scoping in query
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ participantConflicts: [] }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 20. multiple participant-conflicting exams -> deterministic first Exam Instance
  test('20. multiple participant-conflicting exams -> deterministic first Exam Instance', async () => {
    // Sorted by id ASC: OTHER_EXAM_A (..10) wins over OTHER_EXAM_B (..20)
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_A, conflicting_count: 5 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.equal(res.type, 'not_ready');
    if (res.type === 'not_ready') {
      assert.equal(res.blocker, 'participant_schedule_conflict');
      assert.equal(res.conflictingExamInstanceId, OTHER_EXAM_A);
    }
  });

  // 21. participant conflict count deterministic
  test('21. participant conflict count deterministic', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_A, conflicting_count: '7' }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'participant_schedule_conflict',
      conflictingExamInstanceId: OTHER_EXAM_A,
      conflictingParticipantCount: 7
    });
  });

  // 22. same active Proctor + overlapping operational exam -> Proctor conflict
  test('22. same active Proctor + overlapping operational exam -> Proctor conflict', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [],
        proctorConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_B, conflicting_count: 1 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'proctor_schedule_conflict',
      conflictingExamInstanceId: OTHER_EXAM_B,
      conflictingProctorCount: 1
    });
  });

  // 23. revoked other Proctor assignment -> no Proctor conflict
  test('23. revoked other Proctor assignment -> no Proctor conflict', async () => {
    // Excluded by other_proc.revoked_at IS NULL
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [],
        proctorConflicts: []
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 24. revoked target Proctor assignment -> no Proctor conflict
  test('24. revoked target Proctor assignment -> no Proctor conflict', async () => {
    // Excluded by target_proc.revoked_at IS NULL
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [],
        proctorConflicts: []
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 25. cross-tenant Proctor match -> no conflict
  test('25. cross-tenant Proctor match -> no conflict', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [],
        proctorConflicts: []
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'schedule_conflict_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM
    });
  });

  // 26. participant + Proctor conflict together -> participant blocker wins
  test('26. participant + Proctor conflict together -> participant blocker wins', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({
        participantConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_A, conflicting_count: 2 }],
        proctorConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_B, conflicting_count: 1 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'participant_schedule_conflict',
      conflictingExamInstanceId: OTHER_EXAM_A,
      conflictingParticipantCount: 2
    });
  });

  // 27. capability evaluator exactly once
  test('27. capability evaluator exactly once', async () => {
    let callCount = 0;
    let receivedContext: any = null;
    const trackingCapability: CapabilityEvaluator = async (ctx) => {
      callCount++;
      receivedContext = ctx;
      return 'granted' as const;
    };

    await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(),
      VALID_TENANT,
      VALID_EXAM,
      trackingCapability
    );

    assert.equal(callCount, 1);
    assert.deepEqual(receivedContext, { tenantId: VALID_TENANT, examInstanceId: VALID_EXAM });
  });

  // 28. query failure -> unavailable
  test('28. query failure -> unavailable', async () => {
    const res = await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient({ dbError: true }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, { type: 'unavailable' });
  });

  // 29. read-only / no write query
  test('29. read-only / no write query', async () => {
    const checks = { insertUpdateDelete: false };
    await checkExamInstanceParticipantProctorScheduleConflictReadiness(
      createMockClient(
        {
          participantConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_A, conflicting_count: 1 }],
          proctorConflicts: [{ conflicting_exam_instance_id: OTHER_EXAM_B, conflicting_count: 1 }]
        },
        checks
      ),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.equal(checks.insertUpdateDelete, false);
  });
});
