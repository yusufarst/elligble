import { readFileSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { importAcademic } from './provisioning/academic.ts';
import { isValidOperatorContext, type OperatorContext } from './provisioning/audit.ts';
import { importExam } from './provisioning/exam.ts';
import { importPeople, reissueActivation } from './provisioning/people.ts';
import { createSchool } from './provisioning/school.ts';
import { renderActivationSheetHtml, type ActivationCard } from './provisioning/sheet.ts';

// Operator provisioning for the pilot (platform staff, D02.2-28): every change is validated
// first, applied in one transaction, and recorded in platform_provisioning_events with the
// operator and case reference. Activation codes only ever go to the printable sheet.

const USAGE = `ELLIGBLE provisioning (platform operators)

Usage: node runtime/secure-assessment/src/ops/provision-cli.ts <command> [options]

  school create      --label <school name> [--allow-duplicate-label]
  people import      --tenant <id> --file <people.csv> --sheet <cards.html>
                     [--dry-run] [--link-existing] [--valid-days 1-30] [--app-url <url>] [--time-zone <IANA>]
  activation reissue --tenant <id> --elligble-id <id> --sheet <card.html> [--full-name <name>]
                     [--valid-days 1-30] [--app-url <url>] [--time-zone <IANA>]
  academic import    --tenant <id> --file <academic.json> [--dry-run]
  exam import        --tenant <id> --file <exam.json> --questions <questions.csv> [--dry-run]

Every change needs --operator <name> --case <reference> (recorded in the audit trail).
Templates: people.csv header "elligble_id,full_name,kind" (kind: student, teacher, staff);
academic.json "template": "elligble-academic-v1"; exam.json "template": "elligble-exam-v1";
questions.csv header "no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score".
Environment: DATABASE_URL (use PGPASSWORD for the password).
`;

const DAY_MS = 24 * 60 * 60 * 1000;

class UsageError extends Error {}

function out(line: string): void {
    process.stdout.write(line + '\n');
}

function required(value: string | undefined, name: string): string {
    if (!value || value.trim().length === 0) throw new UsageError(`--${name} is required`);
    return value;
}

function operatorContext(values: Record<string, unknown>, dryRun: boolean): OperatorContext {
    const context = { operator: values['operator'] as string | undefined, caseReference: values['case'] as string | undefined };
    if (dryRun) return { operator: context.operator ?? 'dry-run', caseReference: context.caseReference ?? 'dry-run' };
    if (!isValidOperatorContext(context)) throw new UsageError('--operator and --case are required (1 to 200 characters each)');
    return context;
}

function validDays(value: string | undefined): number {
    const days = value === undefined ? 7 : Number(value);
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new UsageError('--valid-days must be a whole number from 1 to 30');
    return days * DAY_MS;
}

function timeZone(value: string | undefined): string {
    const zone = value ?? 'Asia/Jakarta';
    try {
        new Intl.DateTimeFormat('id-ID', { timeZone: zone });
    } catch {
        throw new UsageError('--time-zone must be an IANA time zone such as Asia/Jakarta, Asia/Makassar or Asia/Jayapura');
    }
    return zone;
}

function writeSheet(path: string, cards: ActivationCard[], schoolLabel: string, values: Record<string, unknown>): void {
    const html = renderActivationSheetHtml(cards, {
        schoolLabel,
        appUrl: (values['app-url'] as string | undefined) ?? null,
        timeZone: timeZone(values['time-zone'] as string | undefined),
    });
    // Owner-only, and never overwrite an existing file.
    writeFileSync(path, html, { mode: 0o600, flag: 'wx' });
    out(`Activation cards written to ${path} (${cards.length}). Print them, hand them out, then delete the file.`);
}

async function schoolLabel(pool: pg.Pool, tenantId: string): Promise<string> {
    const res = await pool.query('SELECT display_label FROM tenant_tenants WHERE id = $1', [tenantId]);
    return res.rows[0]?.display_label ?? 'Sekolah';
}

async function run(argv: string[]): Promise<number> {
    const [group, action, ...rest] = argv;
    if (!group || group === '--help' || group === 'help') {
        out(USAGE);
        return group ? 0 : 2;
    }
    const { values } = parseArgs({
        args: rest,
        options: {
            label: { type: 'string' }, tenant: { type: 'string' }, file: { type: 'string' }, sheet: { type: 'string' },
            questions: { type: 'string' }, 'elligble-id': { type: 'string' }, 'full-name': { type: 'string' },
            operator: { type: 'string' }, case: { type: 'string' }, 'valid-days': { type: 'string' },
            'app-url': { type: 'string' }, 'time-zone': { type: 'string' },
            'dry-run': { type: 'boolean', default: false }, 'link-existing': { type: 'boolean', default: false },
            'allow-duplicate-label': { type: 'boolean', default: false },
        },
        strict: true,
        allowPositionals: false,
    });
    const dryRun = values['dry-run'] === true;
    const command = `${group} ${action ?? ''}`.trim();
    const knownCommands = ['school create', 'people import', 'activation reissue', 'academic import', 'exam import'];
    if (!knownCommands.includes(command)) throw new UsageError(`unknown command "${command}"`);
    const context = operatorContext(values, dryRun);
    // Validate options that do not need the database before connecting.
    const validForMs = command === 'people import' || command === 'activation reissue' ? validDays(values['valid-days']) : 0;
    if (command === 'people import' || command === 'activation reissue') {
        timeZone(values['time-zone']);
        if (!dryRun) required(values.sheet, 'sheet');
    }

    const databaseUrl = env['DATABASE_URL'];
    if (!databaseUrl) throw new UsageError('DATABASE_URL is not set');
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
    try {
        switch (command) {
            case 'school create': {
                const result = await createSchool(pool, { label: required(values.label, 'label'), context, allowDuplicateLabel: values['allow-duplicate-label'] === true });
                if (!result.ok) {
                    out(`Refused: ${result.problem}`);
                    return 1;
                }
                out(`School created. Tenant id: ${result.tenantId}`);
                return 0;
            }
            case 'people import': {
                const tenantId = required(values.tenant, 'tenant');
                const result = await importPeople(pool, {
                    tenantId, text: readFileSync(required(values.file, 'file'), 'utf8'), context, validForMs, dryRun,
                    linkExisting: values['link-existing'] === true,
                });
                for (const problem of result.problems) out(`line ${problem.line}${problem.elligbleId ? ` ${problem.elligbleId}` : ''}: ${problem.problem}`);
                for (const row of result.outcomes) out(`line ${row.line} ${row.elligbleId}: ${row.outcome}`);
                out(`${dryRun ? 'Dry run' : 'Import'} ${result.ok ? 'OK' : 'REFUSED, nothing was changed'}: ${JSON.stringify(result.summary)}`);
                if (result.ok && !dryRun && result.activations.length > 0) {
                    writeSheet(required(values.sheet, 'sheet'), result.activations, await schoolLabel(pool, tenantId), values);
                }
                return result.ok ? 0 : 1;
            }
            case 'activation reissue': {
                if (dryRun) throw new UsageError('activation reissue has no dry run');
                const tenantId = required(values.tenant, 'tenant');
                const elligbleId = required(values['elligble-id'], 'elligble-id');
                const result = await reissueActivation(pool, { tenantId, elligbleId, context, validForMs });
                if (!result.ok) {
                    out(`Refused: ${result.problem}`);
                    return 1;
                }
                out('New activation code issued; the previous password, code and sessions no longer work.');
                writeSheet(required(values.sheet, 'sheet'), [{
                    elligbleId: elligbleId.trim().toLowerCase(), fullName: (values['full-name'] as string | undefined) ?? elligbleId,
                    code: result.code, expiresAt: result.expiresAt,
                }], await schoolLabel(pool, tenantId), values);
                return 0;
            }
            case 'academic import': {
                const result = await importAcademic(pool, { tenantId: required(values.tenant, 'tenant'), text: readFileSync(required(values.file, 'file'), 'utf8'), context, dryRun });
                for (const problem of result.problems) out(`problem: ${problem}`);
                out(`${dryRun ? 'Dry run' : 'Import'} ${result.ok ? 'OK' : 'REFUSED, nothing was changed'}: created ${JSON.stringify(result.summary)}`);
                return result.ok ? 0 : 1;
            }
            case 'exam import': {
                const result = await importExam(pool, {
                    tenantId: required(values.tenant, 'tenant'),
                    examText: readFileSync(required(values.file, 'file'), 'utf8'),
                    questionsText: readFileSync(required(values.questions, 'questions'), 'utf8'),
                    context, dryRun,
                });
                for (const problem of result.problems) out(`problem: ${problem}`);
                out(`${dryRun ? 'Dry run' : 'Import'} ${result.ok ? 'OK' : 'REFUSED, nothing was changed'}: ${JSON.stringify(result.summary)}`);
                if (result.ok && !dryRun) out('The exam is SCHEDULED. The teacher marks it ready and opens it in "Pelaksanaan Ujian".');
                return result.ok ? 0 : 1;
            }
        }
        return 2;
    } finally {
        await pool.end();
    }
}

run(process.argv.slice(2)).then(code => { process.exitCode = code; }, err => {
    if (err instanceof UsageError || (err instanceof Error && 'code' in err && String((err as { code: unknown }).code).startsWith('ERR_PARSE_ARGS'))) {
        process.stderr.write(`Usage error: ${err.message}\n\n${USAGE}`);
        process.exitCode = 2;
        return;
    }
    if (err instanceof Error && 'code' in err && (err as { code: unknown }).code === 'EEXIST') {
        process.stderr.write('The sheet file already exists; choose a new path (existing files are never overwritten).\n');
        process.exitCode = 1;
        return;
    }
    process.stderr.write(`Provisioning failed: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}\n`);
    process.exitCode = 3;
});
