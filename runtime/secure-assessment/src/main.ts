import { env } from 'node:process';
import type * as http from 'node:http';
import type * as pg from 'pg';
import { parseConfig, type AppConfig } from './config.ts';
import { logInfo, logError } from './log.ts';
import { createDatabasePool, checkDatabaseReadiness } from './db.ts';
import { createServer } from './server.ts';

let activeServer: http.Server | undefined;
let activePool: pg.Pool | undefined;
let isShuttingDown = false;

async function start() {
    let config: AppConfig;
    try {
        config = parseConfig(env);
    } catch (err: unknown) {
        logError('fatal_startup_error', { message: err instanceof Error ? err.message : 'Unknown config error' });
        process.exitCode = 1;
        return;
    }

    logInfo('runtime_starting', { host: config.SA_HOST, port: config.SA_PORT, poolMax: config.SA_DB_POOL_MAX });

    activePool = createDatabasePool(config);

    const isReady = await checkDatabaseReadiness(activePool);
    if (isReady) {
        logInfo('database_ready');
    } else {
        logInfo('database_not_ready');
    }

    activeServer = createServer({
        checkReadiness: () => activePool ? checkDatabaseReadiness(activePool) : Promise.resolve(false)
    });

    activeServer.listen(config.SA_PORT, config.SA_HOST, () => {
        logInfo('runtime_started');
    });

    activeServer.on('error', (err: Error) => {
        logError('fatal_startup_error', { message: err.message });
        shutdown(1);
    });
}

async function shutdown(exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logInfo('shutdown_requested');

    if (activeServer) {
        try {
            await new Promise<void>((resolve) => {
                activeServer!.close(() => resolve());
            });
        } catch {
            // Ignored
        }
    }

    if (activePool) {
        try {
            await activePool.end();
        } catch {
            // Ignored
        }
    }

    logInfo('shutdown_complete');

    if (exitCode !== 0) {
        process.exitCode = exitCode;
    }
}

process.on('SIGINT', () => { shutdown(0); });
process.on('SIGTERM', () => { shutdown(0); });

start().catch(err => {
    logError('fatal_startup_error', { message: err instanceof Error ? err.message : 'Unknown startup error' });
    shutdown(1);
});
