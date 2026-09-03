import type { Pool, PoolClient } from 'pg';

export type ExamInstanceSchedulingCapabilityDecision =
  | 'granted'
  | 'denied'
  | 'unavailable';

export interface ExamInstanceSchedulingAuthorizationContext {
  tenantId: string;
  examInstanceId: string;
  teachingAssignmentId: string | null;
}

export type ExamInstanceSchedulingCapabilityEvaluator = (
  context: ExamInstanceSchedulingAuthorizationContext
) => Promise<ExamInstanceSchedulingCapabilityDecision> | ExamInstanceSchedulingCapabilityDecision;

export interface TransitionExamInstanceDraftToScheduledInput {
  tenantId: string;
  examInstanceId: string;
}

export type ExamInstanceDraftToScheduledInput = TransitionExamInstanceDraftToScheduledInput;

export type TransitionExamInstanceDraftToScheduledResult =
  | {
      type: 'scheduled';
      examInstanceId: string;
      tenantId: string;
      lifecycleState: 'SCHEDULED';
      windowStartsAt: Date;
      windowEndsAt: Date;
      teachingAssignmentId: string | null;
    }
  | { type: 'denied' }
  | { type: 'invalid_state'; currentState?: string }
  | { type: 'invalid_window' }
  | { type: 'unavailable' };

export type ExamInstanceDraftToScheduledResult = TransitionExamInstanceDraftToScheduledResult;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

const defaultCapabilityEvaluator: ExamInstanceSchedulingCapabilityEvaluator =
  async (): Promise<ExamInstanceSchedulingCapabilityDecision> => 'granted';

export async function transitionExamInstanceDraftToScheduled(
  pool: Pool,
  input: TransitionExamInstanceDraftToScheduledInput,
  evaluateCapability: ExamInstanceSchedulingCapabilityEvaluator = defaultCapabilityEvaluator
): Promise<TransitionExamInstanceDraftToScheduledResult> {
  if (!isValidUUID(input?.tenantId) || !isValidUUID(input?.examInstanceId)) {
    return { type: 'denied' };
  }

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const selectQuery = `
      SELECT
        id,
        tenant_id,
        teaching_assignment_id,
        lifecycle_state,
        window_starts_at,
        window_ends_at
      FROM public.secure_assessment_exam_instances
      WHERE id = $1 AND tenant_id = $2
      FOR UPDATE
    `;

    const selectResult = await client.query(selectQuery, [
      input.examInstanceId,
      input.tenantId,
    ]);

    if (selectResult.rows.length !== 1) {
      await client.query('ROLLBACK');
      return { type: 'denied' };
    }

    const row = selectResult.rows[0];

    if (row.lifecycle_state !== 'DRAFT') {
      await client.query('ROLLBACK');
      return { type: 'invalid_state', currentState: row.lifecycle_state };
    }

    if (!row.window_starts_at || !row.window_ends_at) {
      await client.query('ROLLBACK');
      return { type: 'invalid_window' };
    }

    const windowStartsAt = new Date(row.window_starts_at);
    const windowEndsAt = new Date(row.window_ends_at);

    if (
      isNaN(windowStartsAt.getTime()) ||
      isNaN(windowEndsAt.getTime()) ||
      windowStartsAt.getTime() >= windowEndsAt.getTime()
    ) {
      await client.query('ROLLBACK');
      return { type: 'invalid_window' };
    }

    if (typeof evaluateCapability !== 'function') {
      await client.query('ROLLBACK');
      return { type: 'denied' };
    }

    const authContext: ExamInstanceSchedulingAuthorizationContext = {
      tenantId: row.tenant_id,
      examInstanceId: row.id,
      teachingAssignmentId: row.teaching_assignment_id ?? null,
    };

    let capabilityDecision: ExamInstanceSchedulingCapabilityDecision;
    try {
      capabilityDecision = await evaluateCapability(authContext);
    } catch {
      await client.query('ROLLBACK');
      return { type: 'unavailable' };
    }

    if (capabilityDecision === 'unavailable') {
      await client.query('ROLLBACK');
      return { type: 'unavailable' };
    }

    if (capabilityDecision !== 'granted') {
      await client.query('ROLLBACK');
      return { type: 'denied' };
    }

    const updateQuery = `
      UPDATE public.secure_assessment_exam_instances
      SET lifecycle_state = 'SCHEDULED'
      WHERE id = $1
        AND tenant_id = $2
        AND lifecycle_state = 'DRAFT'
      RETURNING
        id,
        tenant_id,
        teaching_assignment_id,
        lifecycle_state,
        window_starts_at,
        window_ends_at
    `;

    const updateResult = await client.query(updateQuery, [
      input.examInstanceId,
      input.tenantId,
    ]);

    if (updateResult.rows.length !== 1) {
      await client.query('ROLLBACK');
      return { type: 'invalid_state' };
    }

    await client.query('COMMIT');

    const updated = updateResult.rows[0];
    return {
      type: 'scheduled',
      examInstanceId: updated.id,
      tenantId: updated.tenant_id,
      lifecycleState: 'SCHEDULED',
      windowStartsAt: new Date(updated.window_starts_at),
      windowEndsAt: new Date(updated.window_ends_at),
      teachingAssignmentId: updated.teaching_assignment_id ?? null,
    };
  } catch {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback failure
      }
    }
    return { type: 'unavailable' };
  } finally {
    if (client) {
      client.release();
    }
  }
}
