import type * as pg from 'pg';
import { checkDatabaseReadiness } from '../db.ts';
import type { LogWriter } from '../log.ts';
import { DEFAULT_MIGRATIONS_DIR, applyMigrations, getMigrationStatus, type MigrationStatus } from './migrations.ts';

// Startup preflight: the server only starts serving once the database is reachable and its
// schema matches this release. "check" refuses to start with pending or unknown migrations
// (run `npm run migrate` as a release step); "apply" applies pending migrations under the
// advisory lock (single-node deployments); "off" skips the schema check (development only).

export type MigrationMode = 'check' | 'apply' | 'off';

export type PreflightResult =
    | { ok: true; migrations: { applied: number } | 'skipped' }
    | { ok: false; reason: 'database_unreachable' }
    | { ok: false; reason: 'pending_migrations'; pending: string[] }
    | { ok: false; reason: 'unknown_migrations'; unknown: string[] }
    | { ok: false; reason: 'migration_failed'; errorName: string };

export interface PreflightOptions {
    pool: pg.Pool;
    migrations: MigrationMode;
    databaseWaitSeconds: number;
    log: LogWriter;
    migrationsDir?: string;
    retryDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
    /** Stops waiting when the process is shutting down. */
    isCancelled?: () => boolean;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function runStartupPreflight(options: PreflightOptions): Promise<PreflightResult> {
    const sleep = options.sleep ?? defaultSleep;
    const now = options.now ?? Date.now;
    const retryDelayMs = options.retryDelayMs ?? 2000;
    const deadline = now() + options.databaseWaitSeconds * 1000;

    for (let attempt = 1; ; attempt++) {
        if (await checkDatabaseReadiness(options.pool)) break;
        if (now() >= deadline || options.isCancelled?.()) return { ok: false, reason: 'database_unreachable' };
        options.log('WARN', 'preflight_waiting_for_database', { attempt });
        await sleep(retryDelayMs);
    }

    if (options.migrations === 'off') return { ok: true, migrations: 'skipped' };

    const dir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
    let client: pg.PoolClient;
    try {
        client = await options.pool.connect();
    } catch {
        return { ok: false, reason: 'database_unreachable' };
    }
    try {
        let status: MigrationStatus;
        if (options.migrations === 'apply') {
            const before = await getMigrationStatus(client, dir);
            if (before.unknown.length > 0) return { ok: false, reason: 'unknown_migrations', unknown: before.unknown };
            try {
                status = await applyMigrations(client, {
                    dir,
                    onApplied: id => options.log('INFO', 'migration_applied', { id }),
                });
            } catch (err) {
                return { ok: false, reason: 'migration_failed', errorName: err instanceof Error ? err.name : 'Error' };
            }
        } else {
            status = await getMigrationStatus(client, dir);
        }
        if (status.unknown.length > 0) return { ok: false, reason: 'unknown_migrations', unknown: status.unknown };
        if (status.pending.length > 0) return { ok: false, reason: 'pending_migrations', pending: status.pending };
        options.log('INFO', 'migrations_verified', { applied: status.applied.length, mode: options.migrations });
        return { ok: true, migrations: { applied: status.applied.length } };
    } finally {
        client.release();
    }
}
