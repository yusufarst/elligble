export type LogEvent =
    | 'runtime_starting'
    | 'runtime_started'
    | 'database_ready'
    | 'database_not_ready'
    | 'shutdown_requested'
    | 'shutdown_complete'
    | 'fatal_startup_error';

export type LogLevel = 'INFO' | 'ERROR';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    event: LogEvent;
    metadata?: Record<string, unknown>;
}

export function logInfo(event: LogEvent, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        event,
        ...(metadata && { metadata })
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
}

export function logError(event: LogEvent, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        event,
        ...(metadata && { metadata })
    };
    process.stderr.write(JSON.stringify(entry) + '\n');
}
