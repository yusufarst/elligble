import * as http from 'node:http';
import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';
import type * as pg from 'pg';

// Operator metrics (OPS-002; D04.9-03 componentized platform health, D04.9-25 response
// persistence failure is critical, D04.9-32 monitoring never competes with answer writes).
// Counters, gauges and histograms live in memory and are rendered in the Prometheus text
// exposition format, an open format any collector reads: no vendor, no dependency. Labels
// come from fixed vocabularies (component, status class, outcome), never ids, paths,
// query strings or personal data. The metrics are served by a separate listener meant for
// the internal network only; the public port never serves them.

/** Exam-day components (D04.9-03) plus the non-exam traffic of the same process. */
export type Component =
    | 'authentication'
    | 'attempt_runtime'
    | 'response_persistence'
    | 'timer'
    | 'monitoring'
    | 'broadcast'
    | 'reporting'
    | 'exam_setup'
    | 'administration'
    | 'static'
    | 'health'
    | 'other';

const COMPONENT_BY_PATH: Record<string, Component> = {
    '/api/v1/auth/login': 'authentication',
    '/api/v1/auth/logout': 'authentication',
    '/api/v1/auth/session': 'authentication',
    '/api/v1/auth/activate': 'authentication',
    '/api/v1/me/context': 'authentication',
    '/api/v1/assessment/assigned-exams': 'attempt_runtime',
    '/api/v1/assessment/attempts/start': 'attempt_runtime',
    '/api/v1/assessment/session/activate': 'attempt_runtime',
    '/api/v1/assessment/resume': 'attempt_runtime',
    '/api/v1/assessment/questions': 'attempt_runtime',
    '/api/v1/assessment/review-flag': 'attempt_runtime',
    '/api/v1/assessment/answer/save': 'response_persistence',
    '/api/v1/assessment/submit': 'response_persistence',
    '/api/v1/assessment/expiry-finalize': 'response_persistence',
    '/api/v1/assessment/submission': 'response_persistence',
    '/api/v1/assessment/timer': 'timer',
    '/api/v1/assessment/timer/start': 'timer',
    '/api/v1/assessment/proctor-monitoring': 'monitoring',
    '/api/v1/assessment/exam-monitoring': 'monitoring',
    '/api/v1/assessment/exam-monitoring/participant-lock': 'monitoring',
    '/api/v1/assessment/teacher-readiness': 'monitoring',
    '/api/v1/assessment/teacher-exams/transition': 'monitoring',
    '/api/v1/assessment/exam-monitoring/broadcast': 'broadcast',
    '/api/v1/assessment/broadcasts/inbox': 'broadcast',
    '/api/v1/assessment/teacher-exams/results': 'reporting',
    '/api/v1/assessment/teacher-exams/setup': 'exam_setup',
    '/api/v1/assessment/teacher-exams/import/preview': 'exam_setup',
    '/api/v1/assessment/teacher-exams/import': 'exam_setup',
};

export function componentOf(pathname: string): Component {
    const known = COMPONENT_BY_PATH[pathname];
    if (known) return known;
    if (pathname === '/healthz' || pathname === '/readyz') return 'health';
    if (pathname.startsWith('/api/')) return pathname.startsWith('/api/v1/admin/') ? 'administration' : 'other';
    return 'static';
}

type Labels = Record<string, string>;

const DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function labelKey(labels: Labels): string {
    return Object.keys(labels).sort().map(k => `${k}=${labels[k]}`).join(',');
}

function escapeLabelValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function renderLabels(labels: Labels, extra: Labels = {}): string {
    const all = { ...labels, ...extra };
    const keys = Object.keys(all);
    if (keys.length === 0) return '';
    return `{${keys.map(k => `${k}="${escapeLabelValue(all[k])}"`).join(',')}}`;
}

function formatNumber(value: number): string {
    if (value === Number.POSITIVE_INFINITY) return '+Inf';
    if (value === Number.NEGATIVE_INFINITY) return '-Inf';
    if (Number.isNaN(value)) return 'NaN';
    return String(value);
}

interface Family {
    name: string;
    help: string;
    type: 'counter' | 'gauge' | 'histogram';
}

class Counter {
    readonly values = new Map<string, { labels: Labels; value: number }>();
    readonly family: Family;
    constructor(family: Family) {
        this.family = family;
    }
    inc(labels: Labels = {}, by = 1): void {
        const key = labelKey(labels);
        const entry = this.values.get(key);
        if (entry) entry.value += by;
        else this.values.set(key, { labels, value: by });
    }
    get(labels: Labels = {}): number {
        return this.values.get(labelKey(labels))?.value ?? 0;
    }
    render(): string[] {
        return [...this.values.values()].map(e => `${this.family.name}${renderLabels(e.labels)} ${formatNumber(e.value)}`);
    }
}

class Gauge {
    readonly values = new Map<string, { labels: Labels; value: number }>();
    readonly family: Family;
    constructor(family: Family) {
        this.family = family;
    }
    set(value: number, labels: Labels = {}): void {
        this.values.set(labelKey(labels), { labels, value });
    }
    render(): string[] {
        return [...this.values.values()].map(e => `${this.family.name}${renderLabels(e.labels)} ${formatNumber(e.value)}`);
    }
}

class Histogram {
    readonly series = new Map<string, { labels: Labels; counts: number[]; sum: number; count: number }>();
    readonly family: Family;
    readonly buckets: number[];
    constructor(family: Family, buckets: number[]) {
        this.family = family;
        this.buckets = buckets;
    }
    observe(value: number, labels: Labels = {}): void {
        const key = labelKey(labels);
        let entry = this.series.get(key);
        if (!entry) {
            entry = { labels, counts: this.buckets.map(() => 0), sum: 0, count: 0 };
            this.series.set(key, entry);
        }
        for (let i = 0; i < this.buckets.length; i++) if (value <= this.buckets[i]) entry.counts[i]++;
        entry.sum += value;
        entry.count++;
    }
    render(): string[] {
        const lines: string[] = [];
        for (const e of this.series.values()) {
            this.buckets.forEach((le, i) => lines.push(`${this.family.name}_bucket${renderLabels(e.labels, { le: formatNumber(le) })} ${e.counts[i]}`));
            lines.push(`${this.family.name}_bucket${renderLabels(e.labels, { le: '+Inf' })} ${e.count}`);
            lines.push(`${this.family.name}_sum${renderLabels(e.labels)} ${formatNumber(Math.round(e.sum * 1e6) / 1e6)}`);
            lines.push(`${this.family.name}_count${renderLabels(e.labels)} ${e.count}`);
        }
        return lines;
    }
}

export type SaveOutcome = 'acknowledged' | 'refused' | 'rejected' | 'failed';

export class RuntimeMetrics {
    readonly requests = new Counter({ name: 'elligble_http_requests_total', help: 'HTTP requests by exam-day component and status class.', type: 'counter' });
    readonly duration = new Histogram({ name: 'elligble_http_request_duration_seconds', help: 'HTTP request duration by exam-day component.', type: 'histogram' }, DURATION_BUCKETS);
    readonly saves = new Counter({ name: 'elligble_answer_saves_total', help: 'Answer saves by outcome: acknowledged, refused (409 by the exam rules), rejected (other 4xx), failed (5xx).', type: 'counter' });
    readonly sweeps = new Counter({ name: 'elligble_expiry_sweeps_total', help: 'Server finalization sweeps at time expiry by result.', type: 'counter' });
    readonly finalized = new Counter({ name: 'elligble_expiry_attempts_finalized_total', help: 'Attempts finalized by the server at time expiry.', type: 'counter' });
    readonly lastSweep = new Gauge({ name: 'elligble_expiry_last_success_timestamp_seconds', help: 'When the last successful expiry sweep ended (Unix time).', type: 'gauge' });
    readonly pending = new Gauge({ name: 'elligble_expiry_pending_attempts', help: 'Started attempts past their deadline and not yet finalized, after the last sweep.', type: 'gauge' });
    private readonly startedAt = Date.now() / 1000;
    private loopDelay: IntervalHistogram | null = null;

    constructor(options: { eventLoop?: boolean } = {}) {
        if (options.eventLoop !== false) {
            this.loopDelay = monitorEventLoopDelay({ resolution: 20 });
            this.loopDelay.enable();
        }
    }

    /** Records one finished HTTP request. */
    observeRequest(pathname: string, status: number, durationSeconds: number): void {
        const component = componentOf(pathname);
        const statusClass = status >= 100 && status < 600 ? `${Math.floor(status / 100)}xx` : 'other';
        this.requests.inc({ component, status_class: statusClass });
        this.duration.observe(durationSeconds, { component });
        if (pathname === '/api/v1/assessment/answer/save') {
            const outcome: SaveOutcome = status === 200 ? 'acknowledged' : status === 409 ? 'refused' : status >= 500 ? 'failed' : 'rejected';
            this.saves.inc({ outcome });
        }
    }

    /** Records one expiry sweep: finalized attempts, or a failure; pending as counted after it. */
    observeSweep(result: { ok: true; finalized: number; pending: number | null } | { ok: false }): void {
        if (!result.ok) {
            this.sweeps.inc({ result: 'failed' });
            return;
        }
        this.sweeps.inc({ result: 'ok' });
        if (result.finalized > 0) this.finalized.inc({}, result.finalized);
        this.lastSweep.set(Math.round(Date.now() / 1000));
        if (result.pending !== null) this.pending.set(result.pending);
    }

    stop(): void {
        this.loopDelay?.disable();
        this.loopDelay = null;
    }

    /** The whole exposition; `live` values are read now (pool, readiness). */
    render(live: { pool?: pg.Pool; ready?: boolean } = {}): string {
        const out: string[] = [];
        const family = (f: Family, lines: string[]) => {
            out.push(`# HELP ${f.name} ${f.help}`, `# TYPE ${f.name} ${f.type}`, ...lines);
        };
        for (const metric of [this.requests, this.duration, this.saves, this.sweeps, this.finalized, this.lastSweep, this.pending]) {
            family(metric.family, metric.render());
        }
        if (live.pool) {
            family({ name: 'elligble_db_pool_connections', help: 'Database pool connections by state; waiting clients mean the pool is exhausted.', type: 'gauge' }, [
                `elligble_db_pool_connections{state="total"} ${live.pool.totalCount}`,
                `elligble_db_pool_connections{state="idle"} ${live.pool.idleCount}`,
                `elligble_db_pool_connections{state="waiting"} ${live.pool.waitingCount}`,
            ]);
        }
        if (live.ready !== undefined) {
            family({ name: 'elligble_database_ready', help: 'Whether the database answered a readiness query during this scrape.', type: 'gauge' }, [`elligble_database_ready ${live.ready ? 1 : 0}`]);
        }
        if (this.loopDelay) {
            const toSeconds = (ns: number) => formatNumber(Math.round(ns / 1e3) / 1e6);
            family({ name: 'elligble_event_loop_delay_seconds', help: 'Event loop delay since the previous scrape; high values mean the process is overloaded.', type: 'gauge' }, [
                `elligble_event_loop_delay_seconds{quantile="0.5"} ${toSeconds(this.loopDelay.percentile(50))}`,
                `elligble_event_loop_delay_seconds{quantile="0.99"} ${toSeconds(this.loopDelay.percentile(99))}`,
                `elligble_event_loop_delay_seconds{quantile="1"} ${toSeconds(this.loopDelay.max)}`,
            ]);
            this.loopDelay.reset();
        }
        family({ name: 'elligble_process_resident_memory_bytes', help: 'Resident memory of the runtime process.', type: 'gauge' }, [`elligble_process_resident_memory_bytes ${process.memoryUsage().rss}`]);
        family({ name: 'elligble_process_start_time_seconds', help: 'When the runtime process started (Unix time).', type: 'gauge' }, [`elligble_process_start_time_seconds ${Math.round(this.startedAt)}`]);
        return out.join('\n') + '\n';
    }
}

/**
 * The internal metrics listener: GET /metrics only. Never put it behind the public reverse
 * proxy; bind it to the loopback or an internal network (SA_METRICS_HOST).
 */
export function createMetricsServer(deps: { metrics: RuntimeMetrics; pool?: pg.Pool; checkReadiness?: () => Promise<boolean> }): http.Server {
    return http.createServer((req, res) => {
        const pathname = (req.url ?? '/').split('?')[0];
        if (pathname !== '/metrics') {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('not found\n');
            return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
            res.end('method not allowed\n');
            return;
        }
        const readiness = deps.checkReadiness ? deps.checkReadiness().catch(() => false) : Promise.resolve(undefined);
        readiness.then(ready => {
            const body = deps.metrics.render({ pool: deps.pool, ready });
            res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : body);
        }).catch(() => {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('metrics unavailable\n');
        });
    });
}

/** Attempts past their deadline without a submission: what the next sweep still has to finalize. */
export async function countPendingExpiredAttempts(pool: pg.Pool): Promise<number> {
    const res = await pool.query(
        `SELECT count(*)::int AS n
         FROM secure_assessment_timer_state t
         JOIN secure_assessment_exam_attempts a ON a.id = t.exam_attempt_id AND a.tenant_id = t.tenant_id
         WHERE t.started_at IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM secure_assessment_exam_submissions s
               WHERE s.tenant_id = a.tenant_id AND s.exam_attempt_id = a.id
           )
           AND secure_assessment_attempt_remaining_seconds(t.tenant_id, t.exam_attempt_id, statement_timestamp()) <= 0`
    );
    return Number(res.rows[0]?.n ?? 0);
}
