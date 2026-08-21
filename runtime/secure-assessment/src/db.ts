import pg from 'pg';
import type { AppConfig } from './config.ts';

export function createDatabasePool(config: AppConfig): pg.Pool {
    return new pg.Pool({
        connectionString: config.DATABASE_URL,
        max: config.SA_DB_POOL_MAX,
        connectionTimeoutMillis: config.SA_DB_CONNECT_TIMEOUT_MS,
    });
}

export async function checkDatabaseReadiness(pool: pg.Pool): Promise<boolean> {
    try {
        const result = await pool.query('SELECT 1');
        return result.rowCount !== null && result.rowCount > 0;
    } catch {
        return false; // Suppress dependency error to prevent credential leaks
    }
}
