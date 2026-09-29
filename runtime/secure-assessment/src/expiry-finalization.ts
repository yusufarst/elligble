import type * as pg from 'pg';
import type { LogWriter } from './log.ts';
import { describeError } from './http/request-log.ts';

// Server-side finalization at time expiry (D04.5-45, D04.5-47, D04.5-49). When a started
// attempt's server deadline (start + configured duration + adjustments, the same rule the
// answer save and the client expiry finalization use) has passed without a submission, the
// server finalizes it from the last accepted answers, so an unreachable device never leaves
// an attempt open. Saves are already refused after the deadline, so nothing the server
// accepted is lost; answers still waiting on the device are the D04.5-48 exception case,
// which the recorded source (EXPIRY_SERVER) keeps visible.
//
// Convergence with the student submit and the client expiry finalization: every path
// inserts the one submission row with ON CONFLICT DO NOTHING, and attempts locked by an
// in-flight save or submit are skipped and picked up by the next sweep.

export interface ExpiryFinalizationResult {
    finalized: number;
}

export async function finalizeExpiredAttempts(pool: pg.Pool, limit = 200): Promise<ExpiryFinalizationResult> {
    const res = await pool.query(
        `WITH due AS (
             SELECT a.id, a.tenant_id
             FROM secure_assessment_timer_state t
             JOIN secure_assessment_exam_attempts a
               ON a.id = t.exam_attempt_id AND a.tenant_id = t.tenant_id
             WHERE t.started_at IS NOT NULL
               AND NOT EXISTS (
                   SELECT 1 FROM secure_assessment_exam_submissions s
                   WHERE s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id
               )
               AND t.started_at + (t.configured_duration_seconds + COALESCE((
                   SELECT SUM(adj.adjustment_seconds) FROM secure_assessment_timer_adjustments adj
                   WHERE adj.tenant_id = t.tenant_id AND adj.timer_state_id = t.id
               ), 0)) * interval '1 second' <= statement_timestamp()
             ORDER BY t.started_at ASC
             LIMIT $1
             FOR UPDATE OF a SKIP LOCKED
         )
         INSERT INTO secure_assessment_exam_submissions (tenant_id, exam_attempt_id, finalization_source)
         SELECT tenant_id, id, 'EXPIRY_SERVER' FROM due
         ON CONFLICT (tenant_id, exam_attempt_id) DO NOTHING
         RETURNING id`,
        [limit]
    );
    return { finalized: res.rowCount ?? 0 };
}

export interface ExpiryFinalizationSweeper {
    stop(): Promise<void>;
}

/**
 * Runs finalizeExpiredAttempts every intervalMs (and again at once while a full batch was
 * finalized). A failed sweep is logged and retried on the next tick; it never stops the
 * process. stop() waits for a sweep in progress.
 */
export function startExpiryFinalizationSweeper(
    pool: pg.Pool,
    options: { intervalMs: number; batchSize?: number; log?: LogWriter }
): ExpiryFinalizationSweeper {
    const batchSize = options.batchSize ?? 200;
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;
    let running: Promise<void> = Promise.resolve();

    const sweep = async (): Promise<void> => {
        try {
            for (let round = 0; round < 50 && !stopped; round++) {
                const { finalized } = await finalizeExpiredAttempts(pool, batchSize);
                if (finalized > 0) options.log?.('INFO', 'expired_attempts_finalized', { count: finalized });
                if (finalized < batchSize) break;
            }
        } catch (err) {
            options.log?.('WARN', 'expiry_finalization_failed', describeError(err));
        }
    };

    const schedule = () => {
        if (stopped) return;
        timer = setTimeout(() => {
            running = sweep().finally(schedule);
        }, options.intervalMs);
        timer.unref();
    };
    schedule();

    return {
        async stop() {
            stopped = true;
            if (timer) clearTimeout(timer);
            await running;
        },
    };
}
