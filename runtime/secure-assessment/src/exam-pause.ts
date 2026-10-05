import type * as pg from 'pg';

// Exam pause state as the attempt write paths need it (Owner decision 2026-09-30, D04.2-77).
// While the exam is PAUSED no new answer, review mark or submission is accepted; an answer
// the student chose before the authoritative pause boundary is still accepted, so it is
// not lost because it had not reached the server yet. After a resume, an answer chosen
// during a pause is refused. The capture time is the server-anchored time the client
// declares (ASSESS-LIFE-002); an intent without one is treated as chosen when it arrives.

export interface AttemptExamState {
    examInstanceId: string;
    lifecycleState: string;
    /** Start of the open pause while the exam is PAUSED; null otherwise. */
    pausedAt: Date | null;
}

export interface PauseInterval {
    pausedAt: Date;
    resumedAt: Date | null;
}

/**
 * Reads the exam state of an attempt. With lock, the exam row is share-locked, which waits
 * for a pause or resume in progress and keeps one from starting until this transaction
 * ends: whatever this transaction then accepts lies entirely before or after the boundary.
 * The open pause is read in a separate statement so it is seen after that wait.
 */
export async function readAttemptExamState(
    client: pg.PoolClient,
    tenantId: string,
    attemptId: string,
    options: { lock: boolean }
): Promise<AttemptExamState | null> {
    const exam = await client.query(
        `SELECT i.id AS exam_instance_id, i.lifecycle_state
         FROM secure_assessment_exam_attempts a
         JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id AND p.tenant_id = a.tenant_id
         JOIN secure_assessment_exam_instances i ON i.id = p.exam_instance_id AND i.tenant_id = p.tenant_id
         WHERE a.id = $1 AND a.tenant_id = $2
         ${options.lock ? 'FOR KEY SHARE OF i' : ''}`,
        [attemptId, tenantId]
    );
    if (exam.rows.length !== 1) return null;
    const { exam_instance_id: examInstanceId, lifecycle_state: lifecycleState } = exam.rows[0];
    let pausedAt: Date | null = null;
    if (lifecycleState === 'PAUSED') {
        const open = await client.query(
            `SELECT paused_at FROM secure_assessment_exam_pauses
             WHERE tenant_id = $1 AND exam_instance_id = $2 AND resumed_at IS NULL`,
            [tenantId, examInstanceId]
        );
        pausedAt = open.rows.length === 1 ? new Date(open.rows[0].paused_at) : null;
    }
    return { examInstanceId, lifecycleState, pausedAt };
}

/** The pause of the exam that covers the instant, if any (an open pause covers everything after its start). */
export async function findPauseCovering(
    client: pg.PoolClient,
    tenantId: string,
    examInstanceId: string,
    at: Date
): Promise<PauseInterval | null> {
    const res = await client.query(
        `SELECT paused_at, resumed_at FROM secure_assessment_exam_pauses
         WHERE tenant_id = $1 AND exam_instance_id = $2
           AND paused_at <= $3 AND (resumed_at IS NULL OR resumed_at > $3)
         ORDER BY paused_at DESC LIMIT 1`,
        [tenantId, examInstanceId, at]
    );
    if (res.rows.length === 0) return null;
    return {
        pausedAt: new Date(res.rows[0].paused_at),
        resumedAt: res.rows[0].resumed_at ? new Date(res.rows[0].resumed_at) : null,
    };
}

/**
 * Parses the optional client-declared capture time of an answer intent. Undefined or null
 * means "not declared"; anything else must be an ISO-8601 instant.
 */
export function parseCapturedAt(value: unknown): Date | null | 'invalid' {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'invalid';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'invalid' : date;
}

// Participant lock (D04.6-38/39, migration 0046): the same boundary rule for one attempt.
// While its lock is open no new answer, review mark, submission or question content is
// accepted, except an answer chosen before the lock; after the unlock an answer chosen
// during the lock is refused. The lock does not stop the time (D04.6-40).

export interface LockInterval {
    lockedAt: Date;
    unlockedAt: Date | null;
}

/** Start of the attempt's open lock, or null. Read after the attempt row is locked by writers. */
export async function readOpenLock(client: pg.PoolClient, tenantId: string, attemptId: string): Promise<Date | null> {
    const res = await client.query(
        `SELECT locked_at FROM secure_assessment_attempt_locks
         WHERE tenant_id = $1 AND exam_attempt_id = $2 AND unlocked_at IS NULL`,
        [tenantId, attemptId]
    );
    return res.rows.length === 1 ? new Date(res.rows[0].locked_at) : null;
}

/** The lock of the attempt that covers the instant, if any. */
export async function findLockCovering(client: pg.PoolClient, tenantId: string, attemptId: string, at: Date): Promise<LockInterval | null> {
    const res = await client.query(
        `SELECT locked_at, unlocked_at FROM secure_assessment_attempt_locks
         WHERE tenant_id = $1 AND exam_attempt_id = $2
           AND locked_at <= $3 AND (unlocked_at IS NULL OR unlocked_at > $3)
         ORDER BY locked_at DESC LIMIT 1`,
        [tenantId, attemptId, at]
    );
    if (res.rows.length === 0) return null;
    return {
        lockedAt: new Date(res.rows[0].locked_at),
        unlockedAt: res.rows[0].unlocked_at ? new Date(res.rows[0].unlocked_at) : null,
    };
}
