import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import {
  checkExamInstanceActiveProctorRoomCoverageReadiness,
  type CapabilityEvaluator
} from '../src/exam-instance-active-proctor-room-coverage-readiness-preflight.ts';

const VALID_TENANT = '00000000-0000-0000-0000-000000000001';
const VALID_EXAM = '00000000-0000-0000-0000-000000000002';
const ROOM_1 = '00000000-0000-0000-0000-000000000011';
const ROOM_2 = '00000000-0000-0000-0000-000000000012';
const PROCTOR_1 = '00000000-0000-0000-0000-000000000021';
const PROCTOR_2 = '00000000-0000-0000-0000-000000000022';
const PROCTOR_REVOKED = '00000000-0000-0000-0000-000000000023';

const grantedCapability: CapabilityEvaluator = async () => 'granted' as const;
const deniedCapability: CapabilityEvaluator = async () => 'denied' as const;
const unavailableCapability: CapabilityEvaluator = async () => 'unavailable' as const;

interface MockOptions {
  missingExam?: boolean;
  wrongTenant?: boolean;
  lifecycle_state?: string;
  dbError?: boolean;
  coverageDbError?: boolean;
  activeAssignments?: number;
  rooms?: Array<{ id: string; tenant_id: string; exam_instance_id: string }>;
  proctorAssignments?: Array<{ id: string; tenant_id: string; exam_instance_id: string; revoked_at: string | null }>;
  proctorRoomAssignments?: Array<{ tenant_id: string; exam_instance_id: string; proctor_assignment_id: string; exam_room_id: string }>;
}

function createClient(options: MockOptions = {}, checks?: { insertUpdateDelete?: boolean; queryText?: string[] }): PoolClient {
  return {
    query: async (text: string, params: any[]) => {
      if (checks) {
        if (/INSERT|UPDATE|DELETE/i.test(text)) checks.insertUpdateDelete = true;
        checks.queryText = checks.queryText || [];
        checks.queryText.push(text);
      }

      if (options.dbError) throw new Error('DB Error');

      if (text.includes('secure_assessment_exam_instances')) {
        if (options.missingExam || (options.wrongTenant && params[1] !== VALID_TENANT)) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [{ lifecycle_state: options.lifecycle_state || 'SCHEDULED' }] };
      }

      if (text.includes('secure_assessment_proctor_assignments') && !text.includes('secure_assessment_exam_rooms')) {
        let count = 1;
        if (options.activeAssignments !== undefined) {
          count = options.activeAssignments;
        } else if (options.proctorAssignments) {
          count = options.proctorAssignments.filter(
            (p) => p.tenant_id === params[1] && p.exam_instance_id === params[0] && p.revoked_at === null
          ).length;
        }
        return { rowCount: 1, rows: [{ count: count.toString() }] };
      }

      if (text.includes('secure_assessment_exam_rooms')) {
        if (options.coverageDbError) throw new Error('Coverage DB Error');

        const tenantId = params[0];
        const examInstanceId = params[1];

        const allRooms = options.rooms || [];
        const matchingRooms = allRooms.filter(
          (r) => r.tenant_id === tenantId && r.exam_instance_id === examInstanceId
        );

        const allProctorAssignments = options.proctorAssignments || [];
        const allMappings = options.proctorRoomAssignments || [];

        let coveredCount = 0;
        for (const room of matchingRooms) {
          const hasActiveProctor = allMappings.some((m) => {
            if (m.exam_room_id !== room.id || m.tenant_id !== tenantId || m.exam_instance_id !== examInstanceId) {
              return false;
            }
            const pa = allProctorAssignments.find(
              (p) => p.id === m.proctor_assignment_id && p.tenant_id === tenantId && p.exam_instance_id === examInstanceId
            );
            return pa && pa.revoked_at === null;
          });
          if (hasActiveProctor) {
            coveredCount++;
          }
        }

        return {
          rowCount: 1,
          rows: [
            {
              exam_room_count: matchingRooms.length.toString(),
              covered_exam_room_count: coveredCount.toString()
            }
          ]
        };
      }

      return { rowCount: 1, rows: [{}] };
    }
  } as unknown as PoolClient;
}

describe('BU-074: Exam Instance Active Proctor Room Coverage Readiness Preflight', () => {
  test('1. invalid tenant UUID -> denied', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient(), 'invalid', VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('2. invalid exam UUID -> denied', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient(), VALID_TENANT, 'invalid', grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('3. capability denied -> denied', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient(), VALID_TENANT, VALID_EXAM, deniedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('4. explicit capability unavailable -> unavailable', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient(), VALID_TENANT, VALID_EXAM, unavailableCapability);
    assert.deepEqual(res, { type: 'unavailable' });
  });

  test('5. capability evaluator throws -> unavailable', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient(), VALID_TENANT, VALID_EXAM, async () => { throw new Error('fail'); });
    assert.deepEqual(res, { type: 'unavailable' });
  });

  test('6. unexpected capability decision fails closed -> denied', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient(), VALID_TENANT, VALID_EXAM, async () => 'unknown' as any);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('7. nonexistent exam -> denied', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient({ missingExam: true }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('8. wrong tenant -> denied', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient({ wrongTenant: true }), '00000000-0000-0000-0000-000000000003', VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'denied' });
  });

  test('9. non-SCHEDULED exam -> invalid_state', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient({ lifecycle_state: 'DRAFT' }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'invalid_state' });
  });

  test('10. zero active Proctor Assignment preserves active_proctor_assignment_empty', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(createClient({ activeAssignments: 0 }), VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.deepEqual(res, { type: 'not_ready', blocker: 'active_proctor_assignment_empty' });
  });

  test('11. active Proctor Assignment + zero rooms -> no_exam_rooms', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({ activeAssignments: 1, rooms: [] }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'no_exam_rooms',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM,
      examRoomCount: 0
    });
  });

  test('12. one room + no room mapping -> incomplete 1/0/1', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        activeAssignments: 1,
        rooms: [{ id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }],
        proctorRoomAssignments: []
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'active_proctor_room_coverage_incomplete',
      examRoomCount: 1,
      coveredExamRoomCount: 0,
      uncoveredExamRoomCount: 1
    });
  });

  test('13. one room + one active mapped Proctor -> ready 1/1/0', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [{ id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }],
        proctorAssignments: [{ id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null }],
        proctorRoomAssignments: [{ tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'active_proctor_room_coverage_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM,
      examRoomCount: 1,
      coveredExamRoomCount: 1,
      uncoveredExamRoomCount: 0
    });
  });

  test('14. room mapped only to revoked Proctor -> incomplete', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [{ id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }],
        // activeAssignments is 1 (for BU-070 presence), but the mapped one is revoked
        proctorAssignments: [
          { id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null },
          { id: PROCTOR_REVOKED, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: '2026-10-01T10:00:00Z' }
        ],
        proctorRoomAssignments: [{ tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_REVOKED, exam_room_id: ROOM_1 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'active_proctor_room_coverage_incomplete',
      examRoomCount: 1,
      coveredExamRoomCount: 0,
      uncoveredExamRoomCount: 1
    });
  });

  test('15. room mapped to active + revoked Proctors -> covered exactly once', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [{ id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }],
        proctorAssignments: [
          { id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null },
          { id: PROCTOR_REVOKED, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: '2026-10-01T10:00:00Z' }
        ],
        proctorRoomAssignments: [
          { tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_REVOKED, exam_room_id: ROOM_1 },
          { tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 }
        ]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'active_proctor_room_coverage_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM,
      examRoomCount: 1,
      coveredExamRoomCount: 1,
      uncoveredExamRoomCount: 0
    });
  });

  test('16. two rooms, one covered -> incomplete 2/1/1', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [
          { id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM },
          { id: ROOM_2, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }
        ],
        proctorAssignments: [{ id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null }],
        proctorRoomAssignments: [{ tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'not_ready',
      blocker: 'active_proctor_room_coverage_incomplete',
      examRoomCount: 2,
      coveredExamRoomCount: 1,
      uncoveredExamRoomCount: 1
    });
  });

  test('17. two rooms, same active Proctor mapped to both -> ready 2/2/0', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [
          { id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM },
          { id: ROOM_2, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }
        ],
        proctorAssignments: [{ id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null }],
        proctorRoomAssignments: [
          { tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 },
          { tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_2 }
        ]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'active_proctor_room_coverage_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM,
      examRoomCount: 2,
      coveredExamRoomCount: 2,
      uncoveredExamRoomCount: 0
    });
  });

  test('18. multiple active Proctors on one room do not inflate covered-room count', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [{ id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }],
        proctorAssignments: [
          { id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null },
          { id: PROCTOR_2, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null }
        ],
        proctorRoomAssignments: [
          { tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 },
          { tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_2, exam_room_id: ROOM_1 }
        ]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'active_proctor_room_coverage_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM,
      examRoomCount: 1,
      coveredExamRoomCount: 1,
      uncoveredExamRoomCount: 0
    });
  });

  test('19. other Exam Instance rooms/mappings excluded', async () => {
    const OTHER_EXAM = '00000000-0000-0000-0000-000000000099';
    const OTHER_ROOM = '00000000-0000-0000-0000-000000000098';
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [
          { id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM },
          { id: OTHER_ROOM, tenant_id: VALID_TENANT, exam_instance_id: OTHER_EXAM }
        ],
        proctorAssignments: [
          { id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null },
          { id: PROCTOR_2, tenant_id: VALID_TENANT, exam_instance_id: OTHER_EXAM, revoked_at: null }
        ],
        proctorRoomAssignments: [
          { tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 },
          { tenant_id: VALID_TENANT, exam_instance_id: OTHER_EXAM, proctor_assignment_id: PROCTOR_2, exam_room_id: OTHER_ROOM }
        ]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'active_proctor_room_coverage_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM,
      examRoomCount: 1,
      coveredExamRoomCount: 1,
      uncoveredExamRoomCount: 0
    });
  });

  test('20. other tenant rooms/mappings excluded', async () => {
    const OTHER_TENANT = '00000000-0000-0000-0000-000000000097';
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [
          { id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM },
          { id: ROOM_2, tenant_id: OTHER_TENANT, exam_instance_id: VALID_EXAM }
        ],
        proctorAssignments: [
          { id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null },
          { id: PROCTOR_2, tenant_id: OTHER_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null }
        ],
        proctorRoomAssignments: [
          { tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 },
          { tenant_id: OTHER_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_2, exam_room_id: ROOM_2 }
        ]
      }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, {
      type: 'active_proctor_room_coverage_ready',
      tenantId: VALID_TENANT,
      examInstanceId: VALID_EXAM,
      examRoomCount: 1,
      coveredExamRoomCount: 1,
      uncoveredExamRoomCount: 0
    });
  });

  test('21. coverage-query/database failure -> unavailable', async () => {
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({ activeAssignments: 1, coverageDbError: true }),
      VALID_TENANT,
      VALID_EXAM,
      grantedCapability
    );
    assert.deepEqual(res, { type: 'unavailable' });
  });

  test('22. capability evaluator called exactly once with exact tenant/exam context', async () => {
    let callCount = 0;
    let receivedContext: any = null;
    const trackingCapability: CapabilityEvaluator = async (ctx) => {
      callCount++;
      receivedContext = ctx;
      return 'granted' as const;
    };
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      createClient({
        rooms: [{ id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }],
        proctorAssignments: [{ id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null }],
        proctorRoomAssignments: [{ tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 }]
      }),
      VALID_TENANT,
      VALID_EXAM,
      trackingCapability
    );
    assert.equal(callCount, 1);
    assert.deepEqual(receivedContext, { tenantId: VALID_TENANT, examInstanceId: VALID_EXAM });
    assert.equal(res.type, 'active_proctor_room_coverage_ready');
  });

  test('23. runtime performs no INSERT / UPDATE / DELETE', async () => {
    const checks: { insertUpdateDelete?: boolean; queryText?: string[] } = {};
    const client = createClient(
      {
        rooms: [{ id: ROOM_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM }],
        proctorAssignments: [{ id: PROCTOR_1, tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, revoked_at: null }],
        proctorRoomAssignments: [{ tenant_id: VALID_TENANT, exam_instance_id: VALID_EXAM, proctor_assignment_id: PROCTOR_1, exam_room_id: ROOM_1 }]
      },
      checks
    );
    const res = await checkExamInstanceActiveProctorRoomCoverageReadiness(client, VALID_TENANT, VALID_EXAM, grantedCapability);
    assert.equal(res.type, 'active_proctor_room_coverage_ready');
    assert.equal(checks.insertUpdateDelete, undefined);
  });
});
