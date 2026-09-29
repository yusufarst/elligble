import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface E2eState {
    baseUrl: string;
    tenantId: string;
    otherTenantId: string;
    examInstanceId: string;
    databaseName: string;
    adminUrl: string;
    serverPid: number;
    workDir: string;
    /** ELLIGBLE ID -> activation code from the printed card sheet. */
    cards: Record<string, string>;
}

export const STATE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.e2e-state.json');

export function readState(): E2eState {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2eState;
}
