import type { PoolClient } from 'pg';

export type CapabilityContext = {
  tenantId: string;
  examInstanceId: string;
};

export type CapabilityDecision = 'granted' | 'denied' | 'unavailable';

export type CapabilityEvaluator = (ctx: CapabilityContext) => Promise<CapabilityDecision> | CapabilityDecision;

export type ScheduleConflictBlocker =
  | 'participant_schedule_conflict'
  | 'proctor_schedule_conflict';

export type ScheduleConflictReadinessResult =
  | {
      type: 'schedule_conflict_ready';
      tenantId: string;
      examInstanceId: string;
    }
  | {
      type: 'not_ready';
      blocker: 'participant_schedule_conflict';
      conflictingExamInstanceId: string;
      conflictingParticipantCount: number;
    }
  | {
      type: 'not_ready';
      blocker: 'proctor_schedule_conflict';
      conflictingExamInstanceId: string;
      conflictingProctorCount: number;
    }
  | { type: 'invalid_state' }
  | { type: 'denied' }
  | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkExamInstanceParticipantProctorScheduleConflictReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<ScheduleConflictReadinessResult> {
  if (!UUID_REGEX.test(tenantId) || !UUID_REGEX.test(examInstanceId)) {
    return { type: 'denied' };
  }

  let capability: CapabilityDecision;
  try {
    capability = await evaluateCapability({ tenantId, examInstanceId });
  } catch {
    return { type: 'unavailable' };
  }

  if (capability === 'unavailable') return { type: 'unavailable' };
  if (capability !== 'granted') return { type: 'denied' };

  try {
    // 1. Query target exam instance
    const targetRes = await client.query(
      `
      SELECT
        lifecycle_state,
        window_starts_at,
        window_ends_at
      FROM secure_assessment_exam_instances
      WHERE id = $1 AND tenant_id = $2
      `,
      [examInstanceId, tenantId]
    );

    if (targetRes.rows.length === 0) {
      return { type: 'denied' };
    }

    const { lifecycle_state, window_starts_at, window_ends_at } = targetRes.rows[0];

    if (lifecycle_state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    if (
      window_starts_at === null ||
      window_ends_at === null ||
      window_starts_at === undefined ||
      window_ends_at === undefined
    ) {
      return { type: 'invalid_state' };
    }

    const startTime = new Date(window_starts_at).getTime();
    const endTime = new Date(window_ends_at).getTime();

    if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
      return { type: 'invalid_state' };
    }

    // 2. Query participant conflicts (first blocker priority)
    const participantConflictRes = await client.query(
      `
      SELECT
        other_instance.id AS conflicting_exam_instance_id,
        COUNT(DISTINCT other_part.person_id) AS conflicting_count
      FROM secure_assessment_exam_instances other_instance
      JOIN secure_assessment_exam_participants other_part
        ON other_part.exam_instance_id = other_instance.id
        AND other_part.tenant_id = other_instance.tenant_id
      JOIN secure_assessment_exam_participants target_part
        ON target_part.person_id = other_part.person_id
        AND target_part.tenant_id = other_instance.tenant_id
        AND target_part.exam_instance_id = $1
      WHERE other_instance.tenant_id = $2
        AND other_instance.id != $1
        AND other_instance.lifecycle_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED')
        AND other_instance.window_starts_at < $3
        AND other_instance.window_ends_at > $4
      GROUP BY other_instance.id
      ORDER BY other_instance.id ASC
      LIMIT 1
      `,
      [examInstanceId, tenantId, window_ends_at, window_starts_at]
    );

    if (participantConflictRes.rows.length > 0) {
      return {
        type: 'not_ready',
        blocker: 'participant_schedule_conflict',
        conflictingExamInstanceId: String(participantConflictRes.rows[0].conflicting_exam_instance_id),
        conflictingParticipantCount: parseInt(participantConflictRes.rows[0].conflicting_count, 10),
      };
    }

    // 3. Query proctor conflicts (only active assignments with revoked_at IS NULL on both)
    const proctorConflictRes = await client.query(
      `
      SELECT
        other_instance.id AS conflicting_exam_instance_id,
        COUNT(DISTINCT other_proc.person_id) AS conflicting_count
      FROM secure_assessment_exam_instances other_instance
      JOIN secure_assessment_proctor_assignments other_proc
        ON other_proc.exam_instance_id = other_instance.id
        AND other_proc.tenant_id = other_instance.tenant_id
        AND other_proc.revoked_at IS NULL
      JOIN secure_assessment_proctor_assignments target_proc
        ON target_proc.person_id = other_proc.person_id
        AND target_proc.tenant_id = other_instance.tenant_id
        AND target_proc.exam_instance_id = $1
        AND target_proc.revoked_at IS NULL
      WHERE other_instance.tenant_id = $2
        AND other_instance.id != $1
        AND other_instance.lifecycle_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED')
        AND other_instance.window_starts_at < $3
        AND other_instance.window_ends_at > $4
      GROUP BY other_instance.id
      ORDER BY other_instance.id ASC
      LIMIT 1
      `,
      [examInstanceId, tenantId, window_ends_at, window_starts_at]
    );

    if (proctorConflictRes.rows.length > 0) {
      return {
        type: 'not_ready',
        blocker: 'proctor_schedule_conflict',
        conflictingExamInstanceId: String(proctorConflictRes.rows[0].conflicting_exam_instance_id),
        conflictingProctorCount: parseInt(proctorConflictRes.rows[0].conflicting_count, 10),
      };
    }

    return {
      type: 'schedule_conflict_ready',
      tenantId,
      examInstanceId,
    };
  } catch (error) {
    return { type: 'unavailable' };
  }
}
