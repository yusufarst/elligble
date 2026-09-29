import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { runStartupPreflight } from '../../src/ops/preflight.ts';
import { listMigrationFiles } from '../../src/ops/migrations.ts';
import type { LogEvent, LogLevel } from '../../src/log.ts';

// Production startup against real PostgreSQL: the schema preflight, and the real
// `node src/main.ts` process serving the built client, the API and health endpoints.

const MAIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/main.ts');

function collector() {
    const lines: Array<{ level: LogLevel; event: LogEvent; metadata?: Record<string, unknown> }> = [];
    return { lines, log: (level: LogLevel, event: LogEvent, metadata?: Record<string, unknown>) => { lines.push({ level, event, metadata }); } };
}

test('startup preflight (real PostgreSQL)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const total = listMigrationFiles().length;

    await t.test('check refuses an unmigrated database and names what is pending', async () => {
        const result = await runStartupPreflight({ pool: db.pool, migrations: 'check', databaseWaitSeconds: 0, log: collector().log });
        assert.equal(result.ok, false);
        assert.equal(result.ok === false && result.reason, 'pending_migrations');
        assert.equal(result.ok === false && result.reason === 'pending_migrations' && result.pending.length, total);
    });

    await t.test('apply migrates under the lock, then check passes', async () => {
        const { lines, log } = collector();
        const applied = await runStartupPreflight({ pool: db.pool, migrations: 'apply', databaseWaitSeconds: 0, log });
        assert.deepEqual(applied, { ok: true, migrations: { applied: total } });
        assert.equal(lines.filter(l => l.event === 'migration_applied').length, total);
        const checked = await runStartupPreflight({ pool: db.pool, migrations: 'check', databaseWaitSeconds: 0, log });
        assert.deepEqual(checked, { ok: true, migrations: { applied: total } });
    });

    await t.test('a database ahead of this release is refused in both modes', async () => {
        await db.pool.query(`INSERT INTO elligble_migration_history (migration_id) VALUES ('9999_from_a_newer_release')`);
        try {
            for (const migrations of ['check', 'apply'] as const) {
                const result = await runStartupPreflight({ pool: db.pool, migrations, databaseWaitSeconds: 0, log: collector().log });
                assert.deepEqual(result, { ok: false, reason: 'unknown_migrations', unknown: ['9999_from_a_newer_release'] });
            }
        } finally {
            await db.pool.query(`DELETE FROM elligble_migration_history WHERE migration_id = '9999_from_a_newer_release'`);
        }
    });

    await t.test('an unreachable database is reported after the bounded wait', async () => {
        const pool = new pg.Pool({ connectionString: 'postgres://nobody@127.0.0.1:1/none', connectionTimeoutMillis: 200 });
        const { lines, log } = collector();
        let clock = 0;
        const result = await runStartupPreflight({
            pool, migrations: 'check', databaseWaitSeconds: 3, log, retryDelayMs: 1000,
            now: () => clock, sleep: async ms => { clock += ms; },
        });
        await pool.end();
        assert.deepEqual(result, { ok: false, reason: 'database_unreachable' });
        assert.equal(lines.filter(l => l.event === 'preflight_waiting_for_database').length, 3);
    });
});

async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createNetServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as { port: number };
            server.close(() => resolve(port));
        });
    });
}

interface Running { child: ChildProcess; output: () => string; exited: Promise<number | null> }

function startMain(env: Record<string, string>): Running {
    const child = spawn(process.execPath, [MAIN], { env: { PATH: process.env['PATH'] ?? '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout!.on('data', chunk => { out += chunk; });
    child.stderr!.on('data', chunk => { out += chunk; });
    const exited = new Promise<number | null>(resolve => child.once('exit', code => resolve(code)));
    return { child, output: () => out, exited };
}

async function waitFor(check: () => boolean, timeoutMs = 15000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!check()) {
        if (Date.now() > deadline) throw new Error('timed out');
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

test('production process: preflight, client hosting, API, health and graceful stop', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const site = mkdtempSync(path.join(tmpdir(), 'elligble-site-'));
    mkdirSync(path.join(site, 'assets'));
    writeFileSync(path.join(site, 'index.html'), '<!doctype html><title>ELLIGBLE</title><div id="root"></div>');
    writeFileSync(path.join(site, 'assets', 'app-1.js'), 'export {};');
    t.after(async () => {
        rmSync(site, { recursive: true, force: true });
        await db.close();
    });

    const port = await freePort();
    const app = startMain({
        DATABASE_URL: db.url,
        PGPASSWORD: process.env['PGPASSWORD'] ?? '',
        ELLIGBLE_ENV: 'production',
        SA_HOST: '127.0.0.1',
        SA_PORT: String(port),
        SA_STATIC_DIR: site,
        SA_STARTUP_DB_WAIT_SECONDS: '5',
    });
    t.after(() => { app.child.kill('SIGKILL'); });
    await waitFor(() => app.output().includes('"runtime_started"'));
    const base = `http://127.0.0.1:${port}`;

    await t.test('serves the client with production headers', async () => {
        const res = await fetch(`${base}/?attemptId=11111111-1111-4111-8111-111111111111`);
        assert.equal(res.status, 200);
        assert.match(await res.text(), /<div id="root">/);
        assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=31536000/);
        assert.ok(res.headers.get('x-request-id'));
    });

    await t.test('API and health respond; a failed login sets no cookie', async () => {
        assert.deepEqual(await (await fetch(`${base}/readyz`)).json(), { status: 'ready' });
        const login = await fetch(`${base}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: base },
            body: JSON.stringify({ username: 'tidak.ada', password: 'kata-sandi-salah' }),
        });
        assert.equal(login.status, 401);
        assert.equal(login.headers.get('cache-control'), 'no-store');
        assert.equal(login.headers.get('set-cookie'), null);
    });

    await t.test('logs are JSON lines without credentials or query strings', async () => {
        await waitFor(() => app.output().includes('/api/v1/auth/login'));
        const lines = app.output().trim().split('\n').map(line => JSON.parse(line));
        assert.ok(lines.some(l => l.event === 'static_site_loaded'));
        assert.ok(lines.some(l => l.event === 'migrations_verified'));
        assert.ok(lines.some(l => l.event === 'http_request' && l.metadata.path === '/api/v1/auth/login' && l.metadata.status === 401));
        assert.doesNotMatch(app.output(), /kata-sandi-salah|attemptId|11111111-1111|postgres:\/\//);
    });

    await t.test('SIGTERM drains and exits cleanly', async () => {
        app.child.kill('SIGTERM');
        assert.equal(await app.exited, 0);
        assert.match(app.output(), /"shutdown_complete"/);
    });
});

test('production process refuses to start on an unmigrated database', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase({ migrate: false });
    t.after(() => db.close());
    const app = startMain({
        DATABASE_URL: db.url,
        PGPASSWORD: process.env['PGPASSWORD'] ?? '',
        ELLIGBLE_ENV: 'production',
        SA_PORT: String(await freePort()),
        SA_STARTUP_DB_WAIT_SECONDS: '0',
    });
    t.after(() => { app.child.kill('SIGKILL'); });
    assert.equal(await app.exited, 1);
    const failure = app.output().trim().split('\n').map(line => JSON.parse(line)).find(l => l.event === 'preflight_failed');
    assert.equal(failure?.metadata?.reason, 'pending_migrations');
    assert.doesNotMatch(app.output(), /"runtime_started"/);
});
