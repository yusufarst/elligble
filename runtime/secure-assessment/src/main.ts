import { env } from 'node:process';
import type * as http from 'node:http';
import type * as pg from 'pg';
import { parseConfig, type AppConfig } from './config.ts';
import { logInfo, logError, writeLog } from './log.ts';
import { createDatabasePool, checkDatabaseReadiness } from './db.ts';
import { createServer } from './server.ts';
import { createAttemptAuthorizer } from './http/attempt-authorization.ts';
import { loadStaticSite, type StaticSite } from './http/static-site.ts';
import { runStartupPreflight } from './ops/preflight.ts';

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

    logInfo('runtime_starting', {
        host: config.SA_HOST,
        port: config.SA_PORT,
        poolMax: config.SA_DB_POOL_MAX,
        env: config.ELLIGBLE_ENV,
        cookieSecure: config.SA_COOKIE_SECURE,
        migrationsOnStart: config.SA_MIGRATIONS_ON_START,
        servesWebClient: config.SA_STATIC_DIR !== null,
    });

    let staticSite: StaticSite | undefined;
    if (config.SA_STATIC_DIR) {
        try {
            staticSite = loadStaticSite(config.SA_STATIC_DIR);
        } catch (err: unknown) {
            logError('fatal_startup_error', { message: err instanceof Error ? err.message : 'Static site cannot be loaded' });
            process.exitCode = 1;
            return;
        }
        logInfo('static_site_loaded', { files: staticSite.fileCount, bytes: staticSite.totalBytes });
    }

    activePool = createDatabasePool(config);

    const preflight = await runStartupPreflight({
        pool: activePool,
        migrations: config.SA_MIGRATIONS_ON_START,
        databaseWaitSeconds: config.SA_STARTUP_DB_WAIT_SECONDS,
        log: writeLog,
        isCancelled: () => isShuttingDown,
    });
    if (isShuttingDown) return;
    if (!preflight.ok) {
        // The operator action is in the reason: start the database, or run `npm run migrate`.
        logError('preflight_failed', { ...preflight });
        await shutdown(1);
        return;
    }
    logInfo('database_ready');

    const cookie = { secure: config.SA_COOKIE_SECURE };
    activeServer = createServer({
        checkReadiness: () => activePool ? checkDatabaseReadiness(activePool) : Promise.resolve(false),
        pool: activePool,
        security: {
            cookie,
            allowedOrigins: config.SA_ALLOWED_ORIGINS,
            hsts: config.SA_COOKIE_SECURE,
        },
        authorizeAttempt: createAttemptAuthorizer(activePool, cookie),
        staticSite,
        log: writeLog,
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
