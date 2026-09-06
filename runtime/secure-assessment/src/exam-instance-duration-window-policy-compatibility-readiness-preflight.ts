import type { PoolClient } from 'pg';

export type CapabilityEvaluator = (context: {
  tenantId: string;
  examInstanceId: string;
}) => Promise<'granted' | 'denied' | 'unavailable'>;

export type LatestStartPolicy =
  | 'FULL_DURATION_BEYOND_WINDOW'
  | 'REMAINING_WINDOW_ONLY'
  | 'LATE_START_BLOCKED';

export type DurationWindowPolicyCompatibilityReadinessResult =
  | {
      type: 'duration_window_compatibility_ready';
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
  | {
      type: 'not_ready';
      blocker: 'attempt_duration_exceeds_window';
    }
  | { type: 'invalid_state' }
  | { type: 'denied' }
  | { type: 'unavailable' };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CANONICAL_POLICIES: readonly string[] = [
  'FULL_DURATION_BEYOND_WINDOW',
  'REMAINING_WINDOW_ONLY',
  'LATE_START_BLOCKED',
];

export async function checkExamInstanceDurationWindowPolicyCompatibilityReadiness(
  client: PoolClient,
  tenantId: string,
  examInstanceId: string,
  evaluateCapability: CapabilityEvaluator
): Promise<DurationWindowPolicyCompatibilityReadinessResult> {
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
        window_starts_at,
        window_ends_at,
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

    const {
      lifecycle_state,
      window_starts_at,
      window_ends_at,
      configured_attempt_duration_seconds,
      latest_start_policy,
    } = instanceResult.rows[0];

    if (lifecycle_state !== 'SCHEDULED') {
      return { type: 'invalid_state' };
    }

    if (
      window_starts_at === null ||
      window_ends_at === null ||
      window_starts_at === undefined ||
      window_ends_at === undefined
    ) {
      return { type: 'unavailable' };
    }

    const startTime = new Date(window_starts_at).getTime();
    const endTime = new Date(window_ends_at).getTime();

    if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
      return { type: 'unavailable' };
    }

    const windowDurationSeconds = Math.floor((endTime - startTime) / 1000);
    if (windowDurationSeconds <= 0) {
      return { type: 'unavailable' };
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

    if (!CANONICAL_POLICIES.includes(latest_start_policy)) {
      return { type: 'unavailable' };
    }

    const durationSeconds =
      typeof configured_attempt_duration_seconds === 'number'
        ? configured_attempt_duration_seconds
        : parseInt(configured_attempt_duration_seconds, 10);

    if (isNaN(durationSeconds) || durationSeconds <= 0) {
      return { type: 'unavailable' };
    }

    if (
      latest_start_policy === 'FULL_DURATION_BEYOND_WINDOW' ||
      latest_start_policy === 'REMAINING_WINDOW_ONLY'
    ) {
      return {
        type: 'duration_window_compatibility_ready',
        examInstanceId,
        tenantId,
        configuredAttemptDurationSeconds: durationSeconds,
        latestStartPolicy: latest_start_policy as LatestStartPolicy,
      };
    }

    if (latest_start_policy === 'LATE_START_BLOCKED') {
      if (durationSeconds <= windowDurationSeconds) {
        return {
          type: 'duration_window_compatibility_ready',
          examInstanceId,
          tenantId,
          configuredAttemptDurationSeconds: durationSeconds,
          latestStartPolicy: 'LATE_START_BLOCKED',
        };
      } else {
        return {
          type: 'not_ready',
          blocker: 'attempt_duration_exceeds_window',
        };
      }
    }

    return { type: 'unavailable' };
  } catch (error) {
    return { type: 'unavailable' };
  }
}
