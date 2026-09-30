import { env } from 'node:process';
import pg from 'pg';
import { applyMigrations, getMigrationStatus } from './migrations.ts';

// Usage: node src/ops/migrate-cli.ts [--check]
//   (no flag)  apply pending migrations under an advisory lock
//   --check    report status; exit 1 when migrations are pending or unknown

async function main(): Promise<number> {
    const databaseUrl = env['DATABASE_URL'];
    if (!databaseUrl) {
        process.stderr.write(JSON.stringify({ level: 'ERROR', event: 'migrate_config_error', message: 'DATABASE_URL is not set.' }) + '\n');
        return 2;
    }
    const checkOnly = process.argv.includes('--check');
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        const status = checkOnly
            ? await getMigrationStatus(client)
            : await applyMigrations(client, {
                onApplied: id => process.stdout.write(JSON.stringify({ level: 'INFO', event: 'migration_applied', id }) + '\n'),
            });
        const summary = { applied: status.applied.length, pending: status.pending, unknown: status.unknown };
        process.stdout.write(JSON.stringify({ level: 'INFO', event: checkOnly ? 'migration_status' : 'migrations_complete', ...summary }) + '\n');
        return status.pending.length === 0 && status.unknown.length === 0 ? 0 : 1;
    } finally {
        await client.end();
    }
}

main().then(code => { process.exitCode = code; }, err => {
    process.stderr.write(JSON.stringify({ level: 'ERROR', event: 'migrate_failed', message: err instanceof Error ? err.message : String(err) }) + '\n');
    process.exitCode = 1;
});
