import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as pg from 'pg';

// Migrations are versioned SQL files. Each file records its own stem in
// elligble_migration_history and is safe to re-run; the runner still skips
// recorded files so old DO-blocks are not re-evaluated on every deploy.

const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_KEY = 74520011;

export const DEFAULT_MIGRATIONS_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../database/migrations'
);

export interface MigrationFile {
    id: string;
    file: string;
}

export interface MigrationStatus {
    applied: string[];
    pending: string[];
    unknown: string[];
}

export function listMigrationFiles(dir: string = DEFAULT_MIGRATIONS_DIR): MigrationFile[] {
    const files = fs.readdirSync(dir).filter(f => MIGRATION_FILE.test(f)).sort();
    const seenPrefixes = new Set<string>();
    for (const f of files) {
        const prefix = f.slice(0, 4);
        if (seenPrefixes.has(prefix)) {
            throw new Error(`Duplicate migration number ${prefix}`);
        }
        seenPrefixes.add(prefix);
    }
    return files.map(f => ({ id: f.slice(0, -'.sql'.length), file: path.join(dir, f) }));
}

async function readAppliedIds(client: pg.ClientBase): Promise<Set<string>> {
    const exists = await client.query(
        `SELECT to_regclass('public.elligble_migration_history') IS NOT NULL AS present`
    );
    if (!exists.rows[0].present) {
        return new Set();
    }
    const res = await client.query('SELECT migration_id FROM elligble_migration_history');
    return new Set(res.rows.map(r => r.migration_id as string));
}

export async function getMigrationStatus(
    client: pg.ClientBase,
    dir: string = DEFAULT_MIGRATIONS_DIR
): Promise<MigrationStatus> {
    const files = listMigrationFiles(dir);
    const applied = await readAppliedIds(client);
    const known = new Set(files.map(f => f.id));
    return {
        applied: files.filter(f => applied.has(f.id)).map(f => f.id),
        pending: files.filter(f => !applied.has(f.id)).map(f => f.id),
        unknown: [...applied].filter(id => !known.has(id)).sort(),
    };
}

export async function applyMigrations(
    client: pg.ClientBase,
    options: { dir?: string; onApplied?: (id: string) => void } = {}
): Promise<MigrationStatus> {
    const dir = options.dir ?? DEFAULT_MIGRATIONS_DIR;
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    let failed = false;
    try {
        const before = await getMigrationStatus(client, dir);
        if (before.unknown.length > 0) {
            // The database is ahead of this code base; applying older code on top is unsafe.
            throw new Error(`Database has migrations unknown to this release: ${before.unknown.join(', ')}`);
        }
        for (const migration of listMigrationFiles(dir)) {
            if (!before.pending.includes(migration.id)) continue;
            await client.query(fs.readFileSync(migration.file, 'utf8'));
            options.onApplied?.(migration.id);
        }
        const after = await getMigrationStatus(client, dir);
        if (after.pending.length > 0) {
            throw new Error(`Migrations did not record themselves: ${after.pending.join(', ')}`);
        }
        return after;
    } catch (err) {
        failed = true;
        throw err;
    } finally {
        if (failed) {
            // A failing file leaves its own transaction aborted; clear it before unlocking.
            await client.query('ROLLBACK').catch(() => {});
        }
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
}
