import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { RuntimeMetrics, componentOf, createMetricsServer } from '../src/metrics.ts';
import { createServer } from '../src/server.ts';

// Operator metrics (OPS-002, D04.9-03): every API route belongs to a named exam-day
// component, the exposition follows the Prometheus text format with fixed label
// vocabularies only, the listener serves nothing but GET /metrics, and the alert rules
// shipped in deploy/monitoring only use metrics the runtime exports.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SOURCE = path.resolve(HERE, '../src/server.ts');
const ALERT_RULES = path.resolve(HERE, '../../../deploy/monitoring/elligble-alerts.yml');

test('every API route of the server belongs to a named component', () => {
    const routes = new Set([...readFileSync(SERVER_SOURCE, 'utf8').matchAll(/'(\/api\/v1\/[a-z0-9/_-]+)'/g)].map(m => m[1]));
    assert.ok(routes.size > 20);
    const unnamed = [...routes].filter(route => componentOf(route) === 'other');
    assert.deepEqual(unnamed, [], 'add new routes to COMPONENT_BY_PATH in src/metrics.ts');
    assert.equal(componentOf('/api/v1/assessment/answer/save'), 'response_persistence');
    assert.equal(componentOf('/api/v1/assessment/broadcasts/inbox'), 'broadcast');
    assert.equal(componentOf('/api/v1/nothing'), 'other');
    assert.equal(componentOf('/readyz'), 'health');
    assert.equal(componentOf('/assets/index.js'), 'static');
});

test('requests, answer saves and sweeps render in the Prometheus text format', () => {
    const metrics = new RuntimeMetrics({ eventLoop: false });
    metrics.observeRequest('/api/v1/assessment/answer/save', 200, 0.02);
    metrics.observeRequest('/api/v1/assessment/answer/save', 409, 0.3);
    metrics.observeRequest('/api/v1/assessment/answer/save', 400, 0.01);
    metrics.observeRequest('/api/v1/assessment/answer/save', 503, 12);
    metrics.observeRequest('/api/v1/auth/login', 401, 0.2);
    metrics.observeSweep({ ok: true, finalized: 3, pending: 2 });
    metrics.observeSweep({ ok: false });
    const text = metrics.render();

    assert.match(text, /^# HELP elligble_http_requests_total /m);
    assert.match(text, /^# TYPE elligble_http_requests_total counter$/m);
    assert.match(text, /^elligble_http_requests_total\{component="response_persistence",status_class="2xx"\} 1$/m);
    assert.match(text, /^elligble_http_requests_total\{component="response_persistence",status_class="4xx"\} 2$/m);
    assert.match(text, /^elligble_http_requests_total\{component="response_persistence",status_class="5xx"\} 1$/m);
    assert.match(text, /^elligble_http_requests_total\{component="authentication",status_class="4xx"\} 1$/m);
    for (const [outcome, n] of [['acknowledged', 1], ['refused', 1], ['rejected', 1], ['failed', 1]] as const) {
        assert.match(text, new RegExp(`^elligble_answer_saves_total\\{outcome="${outcome}"\\} ${n}$`, 'm'));
    }
    // Cumulative buckets, +Inf, sum and count.
    assert.match(text, /^elligble_http_request_duration_seconds_bucket\{component="response_persistence",le="0.025"\} 2$/m);
    assert.match(text, /^elligble_http_request_duration_seconds_bucket\{component="response_persistence",le="0.5"\} 3$/m);
    assert.match(text, /^elligble_http_request_duration_seconds_bucket\{component="response_persistence",le="10"\} 3$/m);
    assert.match(text, /^elligble_http_request_duration_seconds_bucket\{component="response_persistence",le="\+Inf"\} 4$/m);
    assert.match(text, /^elligble_http_request_duration_seconds_count\{component="response_persistence"\} 4$/m);
    assert.match(text, /^elligble_http_request_duration_seconds_sum\{component="response_persistence"\} 12.33$/m);
    assert.match(text, /^elligble_expiry_sweeps_total\{result="ok"\} 1$/m);
    assert.match(text, /^elligble_expiry_sweeps_total\{result="failed"\} 1$/m);
    assert.match(text, /^elligble_expiry_attempts_finalized_total 3$/m);
    assert.match(text, /^elligble_expiry_pending_attempts 2$/m);
    assert.match(text, /^elligble_expiry_last_success_timestamp_seconds \d{10}$/m);
    assert.match(text, /^elligble_process_resident_memory_bytes \d+$/m);
    // Only fixed vocabularies: no paths, ids or query strings in labels.
    assert.doesNotMatch(text, /\/api\/|attemptId|[0-9a-f]{8}-[0-9a-f]{4}-/);
    assert.ok(text.endsWith('\n'));
});

test('the listener serves only GET /metrics, with live pool and readiness values', async () => {
    const metrics = new RuntimeMetrics();
    const pool = { totalCount: 4, idleCount: 1, waitingCount: 2 } as unknown as pg.Pool;
    let ready: boolean | 'throw' = true;
    const server = createMetricsServer({
        metrics,
        pool,
        checkReadiness: async () => {
            if (ready === 'throw') throw new Error('down');
            return ready;
        },
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
        const res = await fetch(`${base}/metrics`);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('content-type'), 'text/plain; version=0.0.4; charset=utf-8');
        const text = await res.text();
        assert.match(text, /^elligble_db_pool_connections\{state="waiting"\} 2$/m);
        assert.match(text, /^elligble_database_ready 1$/m);
        assert.match(text, /^elligble_event_loop_delay_seconds\{quantile="0.99"\} [0-9.]+$/m);
        ready = 'throw';
        assert.match(await (await fetch(`${base}/metrics`)).text(), /^elligble_database_ready 0$/m);
        assert.equal((await fetch(`${base}/`)).status, 404);
        assert.equal((await fetch(`${base}/metrics/other`)).status, 404);
        assert.equal((await fetch(`${base}/metrics`, { method: 'POST' })).status, 405);
    } finally {
        metrics.stop();
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});

test('the public server counts its requests but never serves the metrics', async () => {
    const metrics = new RuntimeMetrics({ eventLoop: false });
    const server = createServer({ checkReadiness: async () => true, pool: {} as pg.Pool, metrics });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
        assert.equal((await fetch(`${base}/healthz`)).status, 200);
        const exposed = await fetch(`${base}/metrics`);
        assert.equal(exposed.status, 404);
        assert.doesNotMatch(await exposed.text(), /elligble_/);
        await new Promise(resolve => setTimeout(resolve, 20));
        const text = metrics.render();
        assert.match(text, /^elligble_http_requests_total\{component="health",status_class="2xx"\} 1$/m);
        assert.match(text, /^elligble_http_requests_total\{component="static",status_class="4xx"\} 1$/m);
    } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});

test('the shipped alert rules only use metrics the runtime exports', () => {
    const metrics = new RuntimeMetrics();
    metrics.observeRequest('/api/v1/assessment/answer/save', 200, 0.1);
    metrics.observeSweep({ ok: true, finalized: 0, pending: 0 });
    const exported = new Set([...metrics.render({ pool: { totalCount: 0, idleCount: 0, waitingCount: 0 } as unknown as pg.Pool, ready: true })
        .matchAll(/^# TYPE (\S+) /gm)].map(m => m[1]));
    metrics.stop();
    const rules = readFileSync(ALERT_RULES, 'utf8');
    const used = new Set([...rules.matchAll(/\b(elligble_[a-z_]+)/g)].map(m => m[1].replace(/_(bucket|sum|count)$/, '')));
    assert.ok(used.size >= 7);
    const unknown = [...used].filter(name => !exported.has(name));
    assert.deepEqual(unknown, [], 'alert rules reference metrics the runtime does not export');
    assert.match(rules, /alert: ElligbleAnswerSavesFailing[\s\S]*?severity: critical/);
});
