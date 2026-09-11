import type { PoolClient } from 'pg';
import {
  checkExamInstanceActiveProctorAssignmentPresenceReadiness,
  type CapabilityEvaluator
} from './exam-instance-active-proctor-assignment-presence-readiness-preflight.ts';

export type {
  CapabilityContext,
  CapabilityDecision,
  CapabilityEvaluator
} from './exam-instance-active-proctor-assignment-presence-readiness-preflight.ts';

export type ActiveProctorRoomCoverageReadinessResult =
  | { type: 'denied' }
  | { type: 'unavailable' }
  | { type: 'invalid_state' }
  | { type: 'not_ready'; blocker: 'active_proctor_assignment_empty' }
  | {
      type: 'no_exam_rooms';
      tenantId: string;
      examInstanceId: string;
      examRoomCount: 0;
    }
  | {
      type: 'not_ready';
      blocker: 'active_proctor_room_coverage_incomplete';
      examRoomCount: number;
      coveredExamRoomCount: number;
      uncoveredExamRoomCount: number;
    }
  | {
      type: 'active_proctor_room_coverage_ready';
      tenantId: string;
      examInstanceId: string;
      examRoomCount: number;
      coveredExamRoomCount: number;
      uncoveredExamRoomCount: 0;
    };

export async function checkExamInstanceActiveProctorRoomCoverageReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<ActiveProctorRoomCoverageReadinessResult> {
  const presenceResult = await checkExamInstanceActiveProctorAssignmentPresenceReadiness(
    client,
    tenantId,
    examInstanceId,
    evaluateCapability
  );

  if (presenceResult.type === 'denied') {
    return { type: 'denied' };
  }
  if (presenceResult.type === 'unavailable') {
    return { type: 'unavailable' };
  }
  if (presenceResult.type === 'invalid_state') {
    return { type: 'invalid_state' };
  }
  if (presenceResult.type === 'not_ready') {
    return presenceResult;
  }

  try {
    const coverageResult = await client.query(
      `SELECT
         COUNT(r.id) AS exam_room_count,
         COUNT(r.id) FILTER (
           WHERE EXISTS (
             SELECT 1
             FROM public.secure_assessment_exam_proctor_room_assignments pra
             JOIN public.secure_assessment_proctor_assignments pa
               ON pa.id = pra.proctor_assignment_id
              AND pa.tenant_id = pra.tenant_id
              AND pa.exam_instance_id = pra.exam_instance_id
             WHERE pra.exam_room_id = r.id
               AND pra.tenant_id = $1
               AND pra.exam_instance_id = $2
               AND pa.revoked_at IS NULL
           )
         ) AS covered_exam_room_count
       FROM public.secure_assessment_exam_rooms r
       WHERE r.tenant_id = $1 AND r.exam_instance_id = $2`,
      [tenantId, examInstanceId]
    );

    const row = coverageResult.rows[0];
    const examRoomCount = parseInt(row.exam_room_count, 10);
    const coveredExamRoomCount = parseInt(row.covered_exam_room_count, 10);
    const uncoveredExamRoomCount = examRoomCount - coveredExamRoomCount;

    if (examRoomCount === 0) {
      return {
        type: 'no_exam_rooms',
        tenantId,
        examInstanceId,
        examRoomCount: 0
      };
    }

    if (uncoveredExamRoomCount > 0) {
      return {
        type: 'not_ready',
        blocker: 'active_proctor_room_coverage_incomplete',
        examRoomCount,
        coveredExamRoomCount,
        uncoveredExamRoomCount
      };
    }

    return {
      type: 'active_proctor_room_coverage_ready',
      tenantId,
      examInstanceId,
      examRoomCount,
      coveredExamRoomCount,
      uncoveredExamRoomCount: 0
    };
  } catch {
    return { type: 'unavailable' };
  }
}
