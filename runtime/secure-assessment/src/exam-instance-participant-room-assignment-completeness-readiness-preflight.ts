import type { PoolClient } from 'pg';
import {
  checkExamInstanceParticipantPresenceReadiness,
  type CapabilityEvaluator
} from './exam-instance-participant-presence-readiness-preflight.ts';

export type { CapabilityEvaluator } from './exam-instance-participant-presence-readiness-preflight.ts';

export type ParticipantRoomAssignmentCompletenessReadinessResult =
  | { type: 'denied' }
  | { type: 'unavailable' }
  | { type: 'invalid_state' }
  | { type: 'not_ready'; blocker: 'participant_empty' }
  | {
      type: 'no_exam_rooms';
      tenantId: string;
      examInstanceId: string;
      participantCount: number;
      assignedParticipantCount: 0;
      unassignedParticipantCount: number;
    }
  | {
      type: 'not_ready';
      blocker: 'participant_room_assignment_incomplete';
      participantCount: number;
      assignedParticipantCount: number;
      unassignedParticipantCount: number;
    }
  | {
      type: 'participant_room_assignment_completeness_ready';
      tenantId: string;
      examInstanceId: string;
      participantCount: number;
      assignedParticipantCount: number;
      unassignedParticipantCount: 0;
    };

export async function checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<ParticipantRoomAssignmentCompletenessReadinessResult> {
  const presenceResult = await checkExamInstanceParticipantPresenceReadiness(
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

  const participantCount = presenceResult.participantCount;

  try {
    const completenessResult = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM secure_assessment_exam_rooms WHERE tenant_id = $1 AND exam_instance_id = $2) AS room_count,
         (SELECT COUNT(*) FROM secure_assessment_exam_participant_room_assignments WHERE tenant_id = $1 AND exam_instance_id = $2) AS assigned_count`,
      [tenantId, examInstanceId]
    );

    const row = completenessResult.rows[0];
    const roomCount = parseInt(row.room_count, 10);
    const assignedParticipantCount = parseInt(row.assigned_count, 10);
    const unassignedParticipantCount = participantCount - assignedParticipantCount;

    if (roomCount === 0) {
      return {
        type: 'no_exam_rooms',
        tenantId,
        examInstanceId,
        participantCount,
        assignedParticipantCount: 0,
        unassignedParticipantCount: participantCount
      };
    }

    if (unassignedParticipantCount > 0) {
      return {
        type: 'not_ready',
        blocker: 'participant_room_assignment_incomplete',
        participantCount,
        assignedParticipantCount,
        unassignedParticipantCount
      };
    }

    return {
      type: 'participant_room_assignment_completeness_ready',
      tenantId,
      examInstanceId,
      participantCount,
      assignedParticipantCount,
      unassignedParticipantCount: 0
    };
  } catch {
    return { type: 'unavailable' };
  }
}
