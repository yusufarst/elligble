import type pg from 'pg';
import {
    createActivationRequiredAccount, createUnusableVerifier, findAccountByElligbleId, isValidElligbleId,
    issueActivationInTransaction,
} from '../../../../identity-access/src/provisioning.ts';
import { ensureMembership, ensureTeacherAssignment, findMembership, findTenant } from '../../../../tenant-access/src/provisioning.ts';
import { parseCsv, requireHeader } from './csv.ts';
import { recordProvisioningEvent, sha256, type OperatorContext } from './audit.ts';

// People import (template elligble-people-v1): one row per person with their ELLIGBLE ID,
// a name used only to label the printed activation card (never stored), and their kind.
// Flow per D02.7-01: validate every row, resolve the account, ensure the membership, then
// issue a single-use activation code (D02.7-37..41). An ELLIGBLE ID that already exists
// outside this school is linked only with explicit operator consent (never auto-merged,
// D02.3-20, D02.7-16..21). Any invalid or conflicting row stops the whole import.

export const PEOPLE_TEMPLATE = 'elligble-people-v1';
export const PEOPLE_HEADER = ['elligble_id', 'full_name', 'kind'] as const;
export type PersonKind = 'student' | 'teacher' | 'staff';
const KINDS: readonly PersonKind[] = ['student', 'teacher', 'staff'];

export interface PeopleRow {
    line: number;
    elligbleId: string;
    fullName: string;
    kind: PersonKind;
}

export interface RowProblem {
    line: number;
    elligbleId: string | null;
    problem: string;
}

export function parsePeopleCsv(text: string): { rows: PeopleRow[]; problems: RowProblem[] } {
    const rows: PeopleRow[] = [];
    const problems: RowProblem[] = [];
    const seen = new Map<string, number>();
    for (const row of requireHeader(parseCsv(text), PEOPLE_HEADER, PEOPLE_TEMPLATE)) {
        const [rawId = '', rawName = '', rawKind = ''] = row.cells;
        const elligbleId = rawId.trim().toLowerCase();
        const fullName = rawName.trim();
        const kind = rawKind.trim().toLowerCase() as PersonKind;
        const problem =
            row.cells.length !== PEOPLE_HEADER.length ? `expected ${PEOPLE_HEADER.length} columns` :
            !isValidElligbleId(elligbleId) ? 'ELLIGBLE ID must be 3 to 64 lower-case letters, digits, dot, dash or underscore, starting and ending with a letter or digit' :
            fullName.length === 0 || fullName.length > 200 ? 'full_name must be 1 to 200 characters' :
            !KINDS.includes(kind) ? `kind must be one of ${KINDS.join(', ')}` :
            seen.has(elligbleId) ? `duplicate ELLIGBLE ID (also on line ${seen.get(elligbleId)})` :
            null;
        if (problem) {
            problems.push({ line: row.line, elligbleId: elligbleId || null, problem });
            continue;
        }
        seen.set(elligbleId, row.line);
        rows.push({ line: row.line, elligbleId, fullName, kind });
    }
    if (rows.length === 0 && problems.length === 0) problems.push({ line: 1, elligbleId: null, problem: 'no people in the file' });
    return { rows, problems };
}

export type PersonOutcome = 'created' | 'exists' | 'linked';

export interface PeopleImportResult {
    ok: boolean;
    dryRun: boolean;
    outcomes: Array<{ line: number; elligbleId: string; outcome: PersonOutcome }>;
    problems: RowProblem[];
    /** Activation cards to print (created or linked accounts only). */
    activations: Array<{ elligbleId: string; fullName: string; code: string; expiresAt: Date }>;
    summary: Record<string, number>;
}

export async function importPeople(
    pool: pg.Pool,
    input: {
        tenantId: string;
        text: string;
        context: OperatorContext;
        validForMs: number;
        dryRun: boolean;
        linkExisting: boolean;
        now?: Date;
    }
): Promise<PeopleImportResult> {
    const parsed = parsePeopleCsv(input.text);
    const result: PeopleImportResult = { ok: false, dryRun: input.dryRun, outcomes: [], problems: [...parsed.problems], activations: [], summary: {} };
    if (result.problems.length > 0) return result;

    const now = input.now ?? new Date();
    const unusableVerifier = input.dryRun ? '' : createUnusableVerifier();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (!(await findTenant(client, input.tenantId))) {
            result.problems.push({ line: 0, elligbleId: null, problem: 'school (tenant) not found' });
            await client.query('ROLLBACK');
            return result;
        }
        let teacherAssignments = 0;
        for (const row of parsed.rows) {
            const existing = await findAccountByElligbleId(client, row.elligbleId);
            let personId: string;
            let userAccountId: string;
            let outcome: PersonOutcome;
            if (!existing) {
                if (input.dryRun) {
                    result.outcomes.push({ line: row.line, elligbleId: row.elligbleId, outcome: 'created' });
                    continue;
                }
                ({ personId, userAccountId } = await createActivationRequiredAccount(client, row.elligbleId, unusableVerifier));
                outcome = 'created';
            } else {
                ({ personId, userAccountId } = existing);
                if (await findMembership(client, input.tenantId, personId)) {
                    outcome = 'exists';
                } else if (input.linkExisting) {
                    outcome = 'linked';
                } else {
                    result.problems.push({
                        line: row.line,
                        elligbleId: row.elligbleId,
                        problem: 'this ELLIGBLE ID already belongs to a person outside this school; confirm it is the same person and re-run with --link-existing',
                    });
                    continue;
                }
            }
            if (input.dryRun) {
                result.outcomes.push({ line: row.line, elligbleId: row.elligbleId, outcome });
                continue;
            }
            const { membershipId } = await ensureMembership(client, input.tenantId, personId);
            if (row.kind === 'teacher' && (await ensureTeacherAssignment(client, input.tenantId, membershipId)).created) teacherAssignments++;
            if (outcome === 'created') {
                const issued = await issueActivationInTransaction(client, userAccountId, { now, validForMs: input.validForMs, unusableVerifier: null });
                result.activations.push({ elligbleId: row.elligbleId, fullName: row.fullName, code: issued.code, expiresAt: issued.expiresAt });
            }
            result.outcomes.push({ line: row.line, elligbleId: row.elligbleId, outcome });
        }

        const count = (o: PersonOutcome) => result.outcomes.filter(x => x.outcome === o).length;
        result.summary = { rows: parsed.rows.length, created: count('created'), exists: count('exists'), linked: count('linked'), teacherAssignments };
        if (result.problems.length > 0 || input.dryRun) {
            await client.query('ROLLBACK');
            result.activations = [];
            result.ok = result.problems.length === 0;
            return result;
        }
        await recordProvisioningEvent(client, {
            tenantId: input.tenantId, action: 'people_imported', context: input.context,
            inputSha256: sha256(input.text), summary: result.summary,
        });
        await client.query('COMMIT');
        result.ok = true;
        return result;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

/** Administrative reset (D02.3-12/17, D02.5-04): new single-use code, old password and sessions end. */
export async function reissueActivation(
    pool: pg.Pool,
    input: { tenantId: string; elligbleId: string; context: OperatorContext; validForMs: number; now?: Date }
): Promise<{ ok: true; code: string; expiresAt: Date } | { ok: false; problem: string }> {
    const elligbleId = input.elligbleId.trim().toLowerCase();
    const now = input.now ?? new Date();
    const unusableVerifier = createUnusableVerifier();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const account = await findAccountByElligbleId(client, elligbleId);
        if (!account || !(await findMembership(client, input.tenantId, account.personId))) {
            await client.query('ROLLBACK');
            return { ok: false, problem: 'no account with this ELLIGBLE ID in this school' };
        }
        await client.query('SELECT user_account_id FROM identity_account_credentials WHERE user_account_id = $1 FOR UPDATE', [account.userAccountId]);
        const issued = await issueActivationInTransaction(client, account.userAccountId, { now, validForMs: input.validForMs, unusableVerifier });
        await recordProvisioningEvent(client, {
            tenantId: input.tenantId, action: 'activation_reissued', context: input.context, inputSha256: null, summary: { accounts: 1 },
        });
        await client.query('COMMIT');
        return { ok: true, code: issued.code, expiresAt: issued.expiresAt };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}
