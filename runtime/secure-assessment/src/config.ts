export type DeploymentEnvironment = 'production' | 'development' | 'test';
export type MigrationStartupMode = 'check' | 'apply' | 'off';

export interface AppConfig {
    readonly DATABASE_URL: string;
    readonly SA_HOST: string;
    readonly SA_PORT: number;
    readonly SA_DB_POOL_MAX: number;
    readonly SA_DB_CONNECT_TIMEOUT_MS: number;
    readonly ELLIGBLE_ENV: DeploymentEnvironment;
    /** Session cookie carries the Secure attribute (and the __Host- prefix). */
    readonly SA_COOKIE_SECURE: boolean;
    /** Extra origins allowed to send state-changing requests (same-origin is always allowed). */
    readonly SA_ALLOWED_ORIGINS: readonly string[];
    /** Directory of the built web client to serve; null when the API runs alone. */
    readonly SA_STATIC_DIR: string | null;
    /** Schema check at startup: refuse (check), apply pending (apply) or skip (off, not in production). */
    readonly SA_MIGRATIONS_ON_START: MigrationStartupMode;
    /** How long startup waits for the database before giving up. */
    readonly SA_STARTUP_DB_WAIT_SECONDS: number;
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

function parseEnvironment(value: string | undefined): DeploymentEnvironment {
    const env = value ?? 'production';
    if (env !== 'production' && env !== 'development' && env !== 'test') {
        throw new Error('Malformed configuration: ELLIGBLE_ENV must be production, development or test.');
    }
    return env;
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
    if (value === undefined || value === '') return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Malformed configuration: ${name} must be true or false.`);
}

function parseOrigins(value: string | undefined): string[] {
    if (!value) return [];
    return value.split(',').map(v => v.trim()).filter(Boolean).map(origin => {
        let parsed: URL;
        try {
            parsed = new URL(origin);
        } catch {
            throw new Error('Malformed configuration: SA_ALLOWED_ORIGINS must be a comma-separated list of origins.');
        }
        if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.origin !== origin) {
            throw new Error('Malformed configuration: SA_ALLOWED_ORIGINS entries must be bare http(s) origins.');
        }
        return parsed.origin;
    });
}

function parseMigrationMode(value: string | undefined): MigrationStartupMode {
    const mode = value || 'check';
    if (mode !== 'check' && mode !== 'apply' && mode !== 'off') {
        throw new Error('Malformed configuration: SA_MIGRATIONS_ON_START must be check, apply or off.');
    }
    return mode;
}

function isPostgresUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'postgres:' || url.protocol === 'postgresql:';
    } catch {
        return false;
    }
}

export function parseConfig(environment: Record<string, string | undefined>): AppConfig {
    const databaseUrl = environment['DATABASE_URL'];
    if (!databaseUrl) {
        throw new Error("Missing REQUIRED configuration: DATABASE_URL is not set.");
    }
    if (!isPostgresUrl(databaseUrl)) {
        // Never echo the value: it may contain a password.
        throw new Error('Malformed configuration: DATABASE_URL must be a postgres:// or postgresql:// URL.');
    }

    const host = environment['SA_HOST'] || '127.0.0.1';

    const port = parseStrictInteger(environment['SA_PORT'] ?? '3000', 1, 65535, 'SA_PORT');
    const poolMax = parseStrictInteger(environment['SA_DB_POOL_MAX'] ?? '10', 1, 100, 'SA_DB_POOL_MAX');
    const connectTimeout = parseStrictInteger(environment['SA_DB_CONNECT_TIMEOUT_MS'] ?? '5000', 1, 60000, 'SA_DB_CONNECT_TIMEOUT_MS');

    const deploymentEnv = parseEnvironment(environment['ELLIGBLE_ENV']);
    const cookieSecure = parseBoolean(environment['SA_COOKIE_SECURE'], deploymentEnv === 'production', 'SA_COOKIE_SECURE');
    if (deploymentEnv === 'production' && !cookieSecure) {
        throw new Error('Unsafe configuration: SA_COOKIE_SECURE cannot be false when ELLIGBLE_ENV is production.');
    }
    const migrationMode = parseMigrationMode(environment['SA_MIGRATIONS_ON_START']);
    if (deploymentEnv === 'production' && migrationMode === 'off') {
        throw new Error('Unsafe configuration: SA_MIGRATIONS_ON_START cannot be off when ELLIGBLE_ENV is production.');
    }
    const dbWaitSeconds = parseStrictInteger(environment['SA_STARTUP_DB_WAIT_SECONDS'] ?? '60', 0, 600, 'SA_STARTUP_DB_WAIT_SECONDS');

    return Object.freeze({
        DATABASE_URL: databaseUrl,
        SA_HOST: host,
        SA_PORT: port,
        SA_DB_POOL_MAX: poolMax,
        SA_DB_CONNECT_TIMEOUT_MS: connectTimeout,
        ELLIGBLE_ENV: deploymentEnv,
        SA_COOKIE_SECURE: cookieSecure,
        SA_ALLOWED_ORIGINS: Object.freeze(parseOrigins(environment['SA_ALLOWED_ORIGINS'])),
        SA_STATIC_DIR: environment['SA_STATIC_DIR'] || null,
        SA_MIGRATIONS_ON_START: migrationMode,
        SA_STARTUP_DB_WAIT_SECONDS: dbWaitSeconds,
    });
}
