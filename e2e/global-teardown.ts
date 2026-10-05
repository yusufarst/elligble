import { existsSync, rmSync } from 'node:fs';
import pg from 'pg';
import { STATE_FILE, readState } from './state.ts';

function isRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

// Also runs when the global setup failed half-way, so every field may still be empty.
export default async function globalTeardown(): Promise<void> {
    if (!existsSync(STATE_FILE)) return;
    const state = readState();
    // pid 0 would signal the whole process group, never send it.
    if (state.serverPid > 0 && isRunning(state.serverPid)) {
        process.kill(state.serverPid, 'SIGTERM');
        for (let i = 0; i < 50 && isRunning(state.serverPid); i++) await new Promise(resolve => setTimeout(resolve, 100));
    }
    const admin = new pg.Client({ connectionString: state.adminUrl });
    await admin.connect();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [state.databaseName]);
    await admin.query(`DROP DATABASE IF EXISTS "${state.databaseName}"`);
    await admin.end();
    if (!process.env['E2E_KEEP_WORKDIR']) rmSync(state.workDir, { recursive: true, force: true });
    rmSync(STATE_FILE, { force: true });
}
