// Server-side start eligibility for an Exam Attempt (D04.2-70..72, D04.4-17, D04.2-34/35).
// Evaluated with database time when an attempt is created and again when its timer
// actually starts, because a student may wait between the two.

export type LatestStartPolicy = 'FULL_DURATION_BEYOND_WINDOW' | 'REMAINING_WINDOW_ONLY' | 'LATE_START_BLOCKED';

export type StartIneligibility =
    | 'exam_not_active'
    | 'exam_paused'
    | 'exam_ended'
    | 'exam_not_ready'
    | 'exam_not_open'
    | 'exam_window_closed'
    | 'late_start_blocked';

export interface ExamTimingRow {
    lifecycle_state: string;
    window_starts_at: Date | string | null;
    window_ends_at: Date | string | null;
    configured_attempt_duration_seconds: number | string | null;
    latest_start_policy: string | null;
}

export type StartEligibility =
    | { eligible: true; effectiveDurationSeconds: number; policy: LatestStartPolicy }
    | { eligible: false; reason: StartIneligibility };

const POLICIES: readonly string[] = ['FULL_DURATION_BEYOND_WINDOW', 'REMAINING_WINDOW_ONLY', 'LATE_START_BLOCKED'];

function toDate(value: Date | string | null): Date | null {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function evaluateStartEligibility(row: ExamTimingRow, now: Date): StartEligibility {
    if (row.lifecycle_state !== 'ACTIVE') {
        // PAUSED and ENDED both stop every new start (Owner decision 2026-09-30); the
        // student is told which one applies.
        if (row.lifecycle_state === 'PAUSED') return { eligible: false, reason: 'exam_paused' };
        if (row.lifecycle_state === 'ENDED') return { eligible: false, reason: 'exam_ended' };
        return { eligible: false, reason: 'exam_not_active' };
    }
    const startsAt = toDate(row.window_starts_at);
    const endsAt = toDate(row.window_ends_at);
    const duration = row.configured_attempt_duration_seconds === null ? NaN : Number(row.configured_attempt_duration_seconds);
    const policy = row.latest_start_policy;
    if (!startsAt || !endsAt || !Number.isInteger(duration) || duration <= 0 || !policy || !POLICIES.includes(policy)) {
        return { eligible: false, reason: 'exam_not_ready' };
    }
    const nowMs = now.getTime();
    if (nowMs < startsAt.getTime()) {
        return { eligible: false, reason: 'exam_not_open' };
    }
    if (nowMs >= endsAt.getTime()) {
        return { eligible: false, reason: 'exam_window_closed' };
    }
    const remainingWindowSeconds = Math.floor((endsAt.getTime() - nowMs) / 1000);
    switch (policy as LatestStartPolicy) {
        case 'FULL_DURATION_BEYOND_WINDOW':
            return { eligible: true, effectiveDurationSeconds: duration, policy: 'FULL_DURATION_BEYOND_WINDOW' };
        case 'REMAINING_WINDOW_ONLY':
            if (remainingWindowSeconds <= 0) return { eligible: false, reason: 'exam_window_closed' };
            return { eligible: true, effectiveDurationSeconds: Math.min(duration, remainingWindowSeconds), policy: 'REMAINING_WINDOW_ONLY' };
        case 'LATE_START_BLOCKED':
            if (duration > remainingWindowSeconds) return { eligible: false, reason: 'late_start_blocked' };
            return { eligible: true, effectiveDurationSeconds: duration, policy: 'LATE_START_BLOCKED' };
    }
}
