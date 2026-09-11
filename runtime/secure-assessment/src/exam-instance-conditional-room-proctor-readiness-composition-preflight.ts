import type { PoolClient } from 'pg';
import {
  checkExamInstanceParticipantRoomAssignmentCompletenessReadiness
} from './exam-instance-participant-room-assignment-completeness-readiness-preflight.ts';
import {
  checkExamInstanceActiveProctorRoomCoverageReadiness
} from './exam-instance-active-proctor-room-coverage-readiness-preflight.ts';

export type CapabilityContext = {
  tenantId: string;
  examInstanceId: string;
};

export type CapabilityDecision = 'granted' | 'denied' | 'unavailable';

export type CapabilityEvaluator = (ctx: CapabilityContext) => Promise<CapabilityDecision> | CapabilityDecision;

export type RoomProctorReadinessBlocker =
  | 'room_proctor_requirement_policy_unconfigured'
  | 'participant_empty'
  | 'exam_room_empty'
  | 'participant_room_assignment_incomplete'
  | 'active_proctor_assignment_empty'
  | 'active_proctor_room_coverage_incomplete';

export type ConditionalRoomProctorReadinessCompositionResult =
  | { type: 'denied' }
  | { type: 'unavailable' }
  | { type: 'invalid_state' }
  | {
      type: 'not_ready';
      blocker: 'room_proctor_requirement_policy_unconfigured';
    }
  | {
      type: 'not_ready';
      blocker: 'participant_empty';
    }
  | {
      type: 'not_ready';
      blocker: 'exam_room_empty';
    }
  | {
      type: 'not_ready';
      blocker: 'participant_room_assignment_incomplete';
      participantCount: number;
      assignedParticipantCount: number;
      unassignedParticipantCount: number;
    }
  | {
      type: 'not_ready';
      blocker: 'active_proctor_assignment_empty';
    }
  | {
      type: 'not_ready';
      blocker: 'active_proctor_room_coverage_incomplete';
      examRoomCount: number;
      coveredExamRoomCount: number;
      uncoveredExamRoomCount: number;
    }
  | {
      type: 'room_proctor_readiness_not_applicable';
      tenantId: string;
      examInstanceId: string;
      roomBasedOperationsEnabled: false;
      proctorPerRoomRequired: false;
    }
  | {
      type: 'room_proctor_readiness_ready';
      tenantId: string;
      examInstanceId: string;
      roomBasedOperationsEnabled: true;
      proctorPerRoomRequired: boolean;
      examRoomCount?: number;
      coveredExamRoomCount?: number;
      participantCount?: number;
      assignedParticipantCount?: number;
    };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<ConditionalRoomProctorReadinessCompositionResult> {
  // 1. Valid UUID
  if (!UUID_REGEX.test(tenantId) || !UUID_REGEX.test(examInstanceId)) {
    return { type: 'denied' };
  }

  // Capability evaluator: called EXACTLY ONCE
  let capability: CapabilityDecision;
  try {
    capability = await evaluateCapability({ tenantId, examInstanceId });
  } catch {
    return { type: 'unavailable' };
  }

  if (capability === 'unavailable') {
    return { type: 'unavailable' };
  }

  if (capability !== 'granted') {
    return { type: 'denied' };
  }

  try {
    // 2. Same-tenant Exam Instance lookup
    const instanceResult = await client.query(
      `SELECT lifecycle_state, room_based_operations_enabled, proctor_per_room_required
       FROM public.secure_assessment_exam_instances
       WHERE id = $1 AND tenant_id = $2`,
      [examInstanceId, tenantId]
    );

    if (instanceResult.rows.length === 0) {
      return { type: 'denied' };
    }

    const row = instanceResult.rows[0];

    // 3. Lifecycle must be SCHEDULED
    if (row.lifecycle_state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    // 4. Requirement-policy configuration/applicability
    const roomBasedEnabled = row.room_based_operations_enabled;
    const proctorPerRoomRequired = row.proctor_per_room_required;

    if (roomBasedEnabled === null || proctorPerRoomRequired === null) {
      return {
        type: 'not_ready',
        blocker: 'room_proctor_requirement_policy_unconfigured'
      };
    }

    if (roomBasedEnabled === false && proctorPerRoomRequired === false) {
      return {
        type: 'room_proctor_readiness_not_applicable',
        tenantId,
        examInstanceId,
        roomBasedOperationsEnabled: false,
        proctorPerRoomRequired: false
      };
    }

    if (roomBasedEnabled !== true) {
      // Reject invalid combinations such as false/true
      return { type: 'invalid_state' };
    }

    // 5. BU-075 participant-room completeness when room mode enabled
    const participantRoomResult = await checkExamInstanceParticipantRoomAssignmentCompletenessReadiness(
      client,
      tenantId,
      examInstanceId,
      async () => 'granted' as const
    );

    if (participantRoomResult.type === 'denied') return { type: 'denied' };
    if (participantRoomResult.type === 'unavailable') return { type: 'unavailable' };
    if (participantRoomResult.type === 'invalid_state') return { type: 'invalid_state' };

    if (participantRoomResult.type === 'not_ready') {
      if (participantRoomResult.blocker === 'participant_empty') {
        return {
          type: 'not_ready',
          blocker: 'participant_empty'
        };
      }
      return {
        type: 'not_ready',
        blocker: 'participant_room_assignment_incomplete',
        participantCount: participantRoomResult.participantCount,
        assignedParticipantCount: participantRoomResult.assignedParticipantCount,
        unassignedParticipantCount: participantRoomResult.unassignedParticipantCount
      };
    }

    if (participantRoomResult.type === 'no_exam_rooms') {
      return {
        type: 'not_ready',
        blocker: 'exam_room_empty'
      };
    }

    // 6. BU-074 active Proctor room coverage only when proctor_per_room_required=true
    if (proctorPerRoomRequired === false) {
      return {
        type: 'room_proctor_readiness_ready',
        tenantId,
        examInstanceId,
        roomBasedOperationsEnabled: true,
        proctorPerRoomRequired: false,
        participantCount: participantRoomResult.participantCount,
        assignedParticipantCount: participantRoomResult.assignedParticipantCount
      };
    }

    // proctorPerRoomRequired is true
    const proctorRoomResult = await checkExamInstanceActiveProctorRoomCoverageReadiness(
      client,
      tenantId,
      examInstanceId,
      async () => 'granted' as const
    );

    if (proctorRoomResult.type === 'denied') return { type: 'denied' };
    if (proctorRoomResult.type === 'unavailable') return { type: 'unavailable' };
    if (proctorRoomResult.type === 'invalid_state') return { type: 'invalid_state' };

    if (proctorRoomResult.type === 'not_ready') {
      if (proctorRoomResult.blocker === 'active_proctor_assignment_empty') {
        return {
          type: 'not_ready',
          blocker: 'active_proctor_assignment_empty'
        };
      }
      return {
        type: 'not_ready',
        blocker: 'active_proctor_room_coverage_incomplete',
        examRoomCount: proctorRoomResult.examRoomCount,
        coveredExamRoomCount: proctorRoomResult.coveredExamRoomCount,
        uncoveredExamRoomCount: proctorRoomResult.uncoveredExamRoomCount
      };
    }

    if (proctorRoomResult.type === 'no_exam_rooms') {
      return {
        type: 'not_ready',
        blocker: 'exam_room_empty'
      };
    }

    return {
      type: 'room_proctor_readiness_ready',
      tenantId,
      examInstanceId,
      roomBasedOperationsEnabled: true,
      proctorPerRoomRequired: true,
      examRoomCount: proctorRoomResult.examRoomCount,
      coveredExamRoomCount: proctorRoomResult.coveredExamRoomCount,
      participantCount: participantRoomResult.participantCount,
      assignedParticipantCount: participantRoomResult.assignedParticipantCount
    };
  } catch {
    return { type: 'unavailable' };
  }
}

export const checkExamInstanceConditionalRoomProctorReadiness = checkExamInstanceConditionalRoomProctorReadinessCompositionPreflight;
