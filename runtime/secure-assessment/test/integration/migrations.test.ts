import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import pg from 'pg';
import { applyMigrations, getMigrationStatus, listMigrationFiles, DEFAULT_MIGRATIONS_DIR } from '../../src/ops/migrations.ts';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';

test('migration runner against real PostgreSQL', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const client = new pg.Client({ connectionString: db.url });
    await client.connect();
    t.after(async () => {
        await client.end();
        await db.close();
    });

    await t.test('fresh database is fully migrated and recorded', async () => {
        const status = await getMigrationStatus(client);
        assert.equal(status.pending.length, 0);
        assert.equal(status.unknown.length, 0);
        assert.equal(status.applied.length, listMigrationFiles().length);
    });

    await t.test('re-running is a no-op', async () => {
        const applied: string[] = [];
        await applyMigrations(client, { onApplied: id => applied.push(id) });
        assert.deepEqual(applied, []);
    });

    await t.test('a database ahead of the code base is refused', async () => {
        await client.query(`INSERT INTO elligble_migration_history (migration_id) VALUES ('9999_future_release')`);
        try {
            await assert.rejects(() => applyMigrations(client), /unknown to this release: 9999_future_release/);
            const status = await getMigrationStatus(client);
            assert.deepEqual(status.unknown, ['9999_future_release']);
        } finally {
            await client.query(`DELETE FROM elligble_migration_history WHERE migration_id = '9999_future_release'`);
        }
    });

    await t.test('a failing migration releases the lock and leaves no partial state', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elligble-mig-'));
        for (const f of fs.readdirSync(DEFAULT_MIGRATIONS_DIR)) {
            fs.copyFileSync(path.join(DEFAULT_MIGRATIONS_DIR, f), path.join(dir, f));
        }
        fs.writeFileSync(path.join(dir, '9998_broken.sql'), 'BEGIN; CREATE TABLE broken_probe (id int); SELECT 1/0; COMMIT;');
        await assert.rejects(() => applyMigrations(client, { dir }), /division by zero/);
        const probe = await client.query(`SELECT to_regclass('public.broken_probe') IS NULL AS absent`);
        assert.equal(probe.rows[0].absent, true);
        // Lock is free again: a second runner can proceed.
        const status = await applyMigrations(client);
        assert.equal(status.pending.length, 0);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
