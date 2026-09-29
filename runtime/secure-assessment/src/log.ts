// Structured JSON-lines logging. Entries never contain credentials, cookies, request
// bodies, query strings or personal data: callers pass identifiers and outcomes only.

export type LogEvent =
    | 'runtime_starting'
    | 'runtime_started'
    | 'database_ready'
    | 'database_not_ready'
    | 'shutdown_requested'
    | 'shutdown_complete'
    | 'fatal_startup_error'
    | 'preflight_waiting_for_database'
    | 'preflight_failed'
    | 'migration_applied'
    | 'migrations_verified'
    | 'static_site_loaded'
    | 'http_request'
    | 'request_failed';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    event: LogEvent;
    metadata?: Record<string, unknown>;
}

export type LogWriter = (level: LogLevel, event: LogEvent, metadata?: Record<string, unknown>) => void;

export const writeLog: LogWriter = (level, event, metadata) => {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...(metadata && { metadata }),
    };
    const line = JSON.stringify(entry) + '\n';
    if (level === 'ERROR') process.stderr.write(line);
    else process.stdout.write(line);
};

export function logInfo(event: LogEvent, metadata?: Record<string, unknown>): void {
    writeLog('INFO', event, metadata);
}

export function logError(event: LogEvent, metadata?: Record<string, unknown>): void {
    writeLog('ERROR', event, metadata);
}
