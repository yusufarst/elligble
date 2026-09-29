import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { E2E_PORT } from './playwright.config.ts';
import { STATE_FILE, type E2eState } from './state.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = path.join(ROOT, 'runtime/secure-assessment/src/main.ts');
const CLI = path.join(ROOT, 'runtime/secure-assessment/src/ops/provision-cli.ts');
const WEB_DIST = path.join(ROOT, 'frontend/web/dist');
export const STUDENTS = ['siswa.e2e.01', 'siswa.e2e.02', 'siswa.e2e.03', 'siswa.e2e.04', 'siswa.e2e.05', 'siswa.e2e.06'];

function wib(offsetMinutes: number): string {
    return new Date(Date.now() + offsetMinutes * 60000 + 7 * 3600000).toISOString().slice(0, 19) + '+07:00';
}

function isoDate(offsetDays: number): string {
    return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

export default async function globalSetup(): Promise<void> {
    const adminUrl = process.env['E2E_DATABASE_URL'] ?? process.env['ELLIGBLE_TEST_DATABASE_URL'];
    if (!adminUrl) throw new Error('Set ELLIGBLE_TEST_DATABASE_URL (a PostgreSQL role that may create databases).');
    if (!existsSync(path.join(WEB_DIST, 'index.html'))) throw new Error('Build the web client first: (cd frontend/web && npm run build).');

    const databaseName = `elligble_e2e_${randomBytes(5).toString('hex')}`;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    await admin.end();
    const target = new URL(adminUrl);
    target.pathname = `/${databaseName}`;
    const databaseUrl = target.toString();

    const workDir = mkdtempSync(path.join(tmpdir(), 'elligble-e2e-'));
    const baseUrl = `http://127.0.0.1:${E2E_PORT}`;
    // Recorded before anything can fail so the global teardown (which Playwright runs even
    // when this setup throws) drops the database and stops the server.
    const state: E2eState = { baseUrl, tenantId: '', otherTenantId: '', examInstanceId: '', databaseName, adminUrl, serverPid: 0, workDir, cards: {} };
    const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    save();

    const env = { PATH: process.env['PATH'] ?? '', DATABASE_URL: databaseUrl, PGPASSWORD: process.env['PGPASSWORD'] ?? '' };
    const logFile = process.env['E2E_SERVER_LOG'] ?? path.join(workDir, 'server.log');
    const log = openSync(logFile, 'a');
    const server = spawn(process.execPath, [MAIN], {
        env: { ...env, ELLIGBLE_ENV: 'production', SA_HOST: '127.0.0.1', SA_PORT: String(E2E_PORT), SA_STATIC_DIR: WEB_DIST, SA_MIGRATIONS_ON_START: 'apply', SA_STARTUP_DB_WAIT_SECONDS: '30', SA_EXPIRY_SWEEP_SECONDS: '1' },
        stdio: ['ignore', log, log],
        detached: false,
    });
    state.serverPid = server.pid ?? 0;
    save();
    for (let i = 0; ; i++) {
        try {
            if ((await fetch(`${baseUrl}/readyz`)).ok) break;
        } catch {
            // not listening yet
        }
        if (i > 150 || server.exitCode !== null) {
            const tail = readFileSync(logFile, 'utf8').trimEnd().split('\n').slice(-30).join('\n');
            throw new Error(`The server did not become ready. Last server log lines:\n${tail}`);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    const cli = (...args: string[]) => {
        const res = spawnSync(process.execPath, [CLI, ...args, '--operator', 'E2E', '--case', 'E2E-SUITE'], { env, cwd: workDir, encoding: 'utf8' });
        if (res.status !== 0) throw new Error(`provision ${args.slice(0, 2).join(' ')} failed:\n${res.stdout}${res.stderr}`);
        return res.stdout;
    };
    const file = (name: string, content: string) => {
        writeFileSync(path.join(workDir, name), content);
        return name;
    };

    const tenantId = /Tenant id: ([0-9a-f-]{36})/.exec(cli('school', 'create', '--label', 'SMA Negeri E2E'))![1];
    state.tenantId = tenantId;
    state.otherTenantId = /Tenant id: ([0-9a-f-]{36})/.exec(cli('school', 'create', '--label', 'SMA Negeri E2E Lain'))![1];
    const people = ['elligble_id,full_name,kind', 'guru.e2e,Guru E2E,teacher', 'pengawas.e2e,Pengawas E2E,staff', ...STUDENTS.map((id, i) => `${id},Siswa E2E ${i + 1},student`)].join('\n');
    cli('people', 'import', '--tenant', tenantId, '--file', file('people.csv', people), '--sheet', 'kartu.html');
    cli('academic', 'import', '--tenant', tenantId, '--file', file('academic.json', JSON.stringify({
        template: 'elligble-academic-v1',
        year: { label: 'TA E2E', startDate: isoDate(-60), endDate: isoDate(300) },
        periods: [{ label: 'Semester E2E', type: 'SEMESTER', startDate: isoDate(-60), endDate: isoDate(120) }],
        grades: ['Kelas 10'], groups: [{ label: 'X-E2E', grade: 'Kelas 10' }], subjects: ['Matematika Wajib'],
        offerings: [{ subject: 'Matematika Wajib', period: 'Semester E2E', grade: 'Kelas 10' }],
        teaching: [{ teacher: 'guru.e2e', subject: 'Matematika Wajib', period: 'Semester E2E', group: 'X-E2E' }],
        enrollments: [{ group: 'X-E2E', period: 'Semester E2E', startDate: isoDate(-30), students: STUDENTS }],
    })));
    const examOut = cli('exam', 'import', '--tenant', tenantId, '--file', file('exam.json', JSON.stringify({
        template: 'elligble-exam-v1', teacher: 'guru.e2e', subject: 'Matematika Wajib', period: 'Semester E2E', group: 'X-E2E',
        assessmentType: 'Ulangan Harian', window: { startsAt: wib(-5), endsAt: wib(180) }, durationMinutes: 90,
        latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', participants: 'group', proctors: ['pengawas.e2e'],
    })), '--questions', file('questions.csv', [
        'no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score',
        '1,Hasil dari 2 + 3 adalah,4,5,6,7,8,B,1',
        '2,Bilangan prima terkecil adalah,0,1,2,3,4,C,1',
        '3,Akar kuadrat dari 81 adalah,7,8,9,10,11,C,1',
    ].join('\n')));
    state.examInstanceId = /"examInstanceId":"([0-9a-f-]{36})"/.exec(examOut)![1];

    const sheet = readFileSync(path.join(workDir, 'kartu.html'), 'utf8');
    state.cards = Object.fromEntries([...sheet.matchAll(/<dd class="mono">([a-z0-9._-]+)<\/dd>\s*<dt>Kode Aktivasi<\/dt><dd class="mono code">([A-Z0-9-]+)<\/dd>/g)].map(m => [m[1], m[2]]));
    if (Object.keys(state.cards).length !== STUDENTS.length + 2) throw new Error('The activation card sheet did not list every imported person.');
    save();
    server.unref();
}
