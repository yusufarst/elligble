export interface AppConfig {
    readonly DATABASE_URL: string;
    readonly SA_HOST: string;
    readonly SA_PORT: number;
    readonly SA_DB_POOL_MAX: number;
    readonly SA_DB_CONNECT_TIMEOUT_MS: number;
}

function parseStrictInteger(value: string | undefined, min: number, max: number, name: string): number {
    if (!value || !/^\d+$/.test(value)) {
        throw new Error(`Malformed configuration: ${name} must be a positive bounded integer.`);
    }
    const parsed = Number.parseInt(value, 10);
    if (parsed < min || parsed > max) {
        throw new Error(`Malformed configuration: ${name} must be between ${min} and ${max}.`);
    }
    return parsed;
}

export function parseConfig(environment: Record<string, string | undefined>): AppConfig {
    const databaseUrl = environment['DATABASE_URL'];
    if (!databaseUrl) {
        throw new Error("Missing REQUIRED configuration: DATABASE_URL is not set.");
    }

    const host = environment['SA_HOST'] || '127.0.0.1';

    const port = parseStrictInteger(environment['SA_PORT'] ?? '3000', 1, 65535, 'SA_PORT');
    const poolMax = parseStrictInteger(environment['SA_DB_POOL_MAX'] ?? '10', 1, 100, 'SA_DB_POOL_MAX');
    const connectTimeout = parseStrictInteger(environment['SA_DB_CONNECT_TIMEOUT_MS'] ?? '5000', 1, 60000, 'SA_DB_CONNECT_TIMEOUT_MS');

    return Object.freeze({
        DATABASE_URL: databaseUrl,
        SA_HOST: host,
        SA_PORT: port,
        SA_DB_POOL_MAX: poolMax,
        SA_DB_CONNECT_TIMEOUT_MS: connectTimeout
    });
}
