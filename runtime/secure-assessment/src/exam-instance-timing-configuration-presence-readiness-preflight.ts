import type { PoolClient } from 'pg';

export type CapabilityEvaluator = (context: {
  tenantId: string;
  examInstanceId: string;
}) => Promise<'granted' | 'denied' | 'unavailable'>;

export type LatestStartPolicy =
  | 'FULL_DURATION_BEYOND_WINDOW'
  | 'REMAINING_WINDOW_ONLY'
  | 'LATE_START_BLOCKED';

export type TimingConfigurationPresencePreflightResult =
  | {
      type: 'timing_configuration_presence_ready';
      examInstanceId: string;
      tenantId: string;
      configuredAttemptDurationSeconds: number;
      latestStartPolicy: LatestStartPolicy;
    }
  | {
      type: 'not_ready';
      blocker: 'attempt_duration_missing';
    }
  | {
      type: 'not_ready';
      blocker: 'latest_start_policy_missing';
    }
  | { type: 'invalid_state' }
  | { type: 'denied' }
  | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function checkExamInstanceTimingConfigurationPresenceReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<TimingConfigurationPresencePreflightResult> {
  if (!UUID_REGEX.test(tenantId) || !UUID_REGEX.test(examInstanceId)) {
    return { type: 'denied' };
  }

  let capability: 'granted' | 'denied' | 'unavailable';
  try {
    capability = await evaluateCapability({ tenantId, examInstanceId });
  } catch (error) {
    return { type: 'unavailable' };
  }

  if (capability === 'unavailable') {
    return { type: 'unavailable' };
  }

  if (capability !== 'granted') {
    return { type: 'denied' };
  }

  try {
    const instanceResult = await client.query(
      `
      SELECT
        lifecycle_state,
        configured_attempt_duration_seconds,
        latest_start_policy
      FROM secure_assessment_exam_instances
      WHERE id = $1 AND tenant_id = $2
      `,
      [examInstanceId, tenantId]
    );

    if (instanceResult.rows.length === 0) {
      return { type: 'denied' };
    }

    const { lifecycle_state, configured_attempt_duration_seconds, latest_start_policy } =
      instanceResult.rows[0];

    if (lifecycle_state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    if (
      configured_attempt_duration_seconds === null ||
      configured_attempt_duration_seconds === undefined
    ) {
      return {
        type: 'not_ready',
        blocker: 'attempt_duration_missing',
      };
    }

    if (latest_start_policy === null || latest_start_policy === undefined) {
      return {
        type: 'not_ready',
        blocker: 'latest_start_policy_missing',
      };
    }

    const durationSeconds =
      typeof configured_attempt_duration_seconds === 'number'
        ? configured_attempt_duration_seconds
        : parseInt(configured_attempt_duration_seconds, 10);

    return {
      type: 'timing_configuration_presence_ready',
      examInstanceId,
      tenantId,
      configuredAttemptDurationSeconds: durationSeconds,
      latestStartPolicy: latest_start_policy as LatestStartPolicy,
    };
  } catch (error) {
    return { type: 'unavailable' };
  }
}
