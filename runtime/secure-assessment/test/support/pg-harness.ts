import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { applyMigrations } from '../../src/ops/migrations.ts';

// Disposable real-PostgreSQL databases for integration tests.
// ELLIGBLE_TEST_DATABASE_URL points at a server where the role may CREATE DATABASE
// (password via PGPASSWORD). Each database is migrated with the production runner
// and dropped afterwards.

const PREFIX = 'elligble_it_';

export function integrationDatabaseUrl(): string | null {
    const url = process.env['ELLIGBLE_TEST_DATABASE_URL'];
    if (url) return url;
    if (process.env['ELLIGBLE_REQUIRE_INTEGRATION'] === '1') {
        throw new Error('ELLIGBLE_TEST_DATABASE_URL must be set for the integration suite.');
    }
    return null;
}

export const skipWithoutDatabase: string | false =
    integrationDatabaseUrl() ? false : 'ELLIGBLE_TEST_DATABASE_URL not set';

export interface DisposableDatabase {
    name: string;
    url: string;
    pool: pg.Pool;
    close(): Promise<void>;
}

/** A fresh database, migrated with the production runner unless `migrate: false`. */
export async function createDisposableDatabase(options: { migrate?: boolean } = {}): Promise<DisposableDatabase> {
    const baseUrl = integrationDatabaseUrl();
    if (!baseUrl) throw new Error('ELLIGBLE_TEST_DATABASE_URL not set');

    const name = PREFIX + randomBytes(6).toString('hex');
    const admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);

    const target = new URL(baseUrl);
    target.pathname = `/${name}`;
    const url = target.toString();

    if (options.migrate !== false) {
        const migrator = new pg.Client({ connectionString: url });
        try {
            await migrator.connect();
            await applyMigrations(migrator);
        } catch (err) {
            await migrator.end().catch(() => {});
            await dropDatabase(admin, name);
            await admin.end();
            throw err;
        }
        await migrator.end();
    }

    const pool = new pg.Pool({ connectionString: url, max: 10 });
    return {
        name,
        url,
        pool,
        async close() {
            await pool.end().catch(() => {});
            await dropDatabase(admin, name);
            await admin.end();
        },
    };
}

async function dropDatabase(admin: pg.Client, name: string): Promise<void> {
    // Let closing pool sockets finish first; terminating a backend while its client is
    // mid-shutdown surfaces as an unhandled client error.
    for (let i = 0; i < 50; i++) {
        const res = await admin.query('SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE datname = $1', [name]);
        if (res.rows[0].n === 0) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [name]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
}
