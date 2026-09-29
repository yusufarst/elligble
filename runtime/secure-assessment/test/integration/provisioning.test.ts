import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createDisposableDatabase, skipWithoutDatabase } from '../support/pg-harness.ts';
import { BrowserLikeClient, startProductionWiredServer } from '../support/test-server.ts';

// The pilot onboarding path end to end with real PostgreSQL: the operator CLI (a real
// process) creates the school, imports people with printable activation cards, the academic
// setup and an exam; then teacher, proctor and students activate with their cards and run
// the exam through HTTP.

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/ops/provision-cli.ts');
const WIB = '+07:00';

function isoDate(offsetDays: number): string {
    return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

/** A local date-time in WIB, `offsetMinutes` from now. */
function wib(offsetMinutes: number): string {
    const shifted = new Date(Date.now() + offsetMinutes * 60000 + 7 * 3600000);
    return shifted.toISOString().slice(0, 19) + WIB;
}

test('pilot onboarding through the provisioning CLI (real PostgreSQL)', { skip: skipWithoutDatabase }, async (t) => {
    const db = await createDisposableDatabase();
    const app = await startProductionWiredServer(db.pool);
    const dir = mkdtempSync(path.join(tmpdir(), 'elligble-provision-'));
    t.after(async () => {
        rmSync(dir, { recursive: true, force: true });
        await app.close();
        await db.close();
    });
    const pool = db.pool;
    const file = (name: string, content: string) => {
        const target = path.join(dir, name);
        writeFileSync(target, content);
        return target;
    };
    const cli = (...args: string[]) => {
        const res = spawnSync(process.execPath, [CLI, ...args], {
            env: { PATH: process.env['PATH'] ?? '', DATABASE_URL: db.url, PGPASSWORD: process.env['PGPASSWORD'] ?? '' },
            encoding: 'utf8',
        });
        return { code: res.status, out: res.stdout + res.stderr };
    };
    const audit = ['--operator', 'Tim Platform', '--case', 'PILOT-001'];

    let tenantId = '';
    await t.test('school create is audited, needs an explicit time zone and refuses an accidental duplicate', async () => {
        assert.equal(cli('school', 'create', '--label', 'Tanpa Zona', ...audit).code, 2, 'the time zone is required (D04.2-36)');
        const badZone = cli('school', 'create', '--label', 'Zona Salah', '--time-zone', 'WIB', ...audit);
        assert.equal(badZone.code, 2);
        assert.match(badZone.out, /Asia\/Jakarta \(WIB\)/);
        assert.equal(cli('school', 'create', '--label', 'Uji Coba', '--time-zone', 'Asia/Jakarta', '--dry-run').code, 2, 'no dry run that would create a school');

        const created = cli('school', 'create', '--label', 'SMA Negeri 9 Contoh', '--time-zone', 'Asia/Makassar', ...audit);
        assert.equal(created.code, 0, created.out);
        tenantId = /Tenant id: ([0-9a-f-]{36})/.exec(created.out)![1];
        const again = cli('school', 'create', '--label', 'SMA Negeri 9 Contoh', '--time-zone', 'Asia/Makassar', ...audit);
        assert.equal(again.code, 1);
        assert.match(again.out, /already exists/);
        assert.equal(cli('school', 'create', '--label', 'Tanpa Audit', '--time-zone', 'Asia/Jakarta').code, 2, 'operator and case are required');
        const stored = await db.pool.query('SELECT time_zone FROM tenant_tenants WHERE id = $1', [tenantId]);
        assert.equal(stored.rows[0].time_zone, 'Asia/Makassar');
        const count = await db.pool.query(`SELECT count(*)::int AS n FROM tenant_tenants WHERE display_label IN ('Tanpa Zona', 'Zona Salah', 'Uji Coba')`);
        assert.equal(count.rows[0].n, 0, 'refused commands create nothing');
    });

    await t.test('the time zone can be corrected through the audited command only', async () => {
        assert.equal(cli('school', 'set-time-zone', '--tenant', tenantId, '--time-zone', 'Asia/Jakarta').code, 2, 'operator and case are required');
        assert.equal(cli('school', 'set-time-zone', '--tenant', 'bukan-uuid', '--time-zone', 'Asia/Jakarta', ...audit).code, 2);
        const missing = cli('school', 'set-time-zone', '--tenant', '00000000-0000-4000-8000-000000000000', '--time-zone', 'Asia/Jakarta', ...audit);
        assert.equal(missing.code, 1);
        const set = cli('school', 'set-time-zone', '--tenant', tenantId, '--time-zone', 'Asia/Jakarta', ...audit);
        assert.equal(set.code, 0, set.out);
        assert.match(set.out, /was Asia\/Makassar/);
        const events = await db.pool.query(
            `SELECT summary FROM platform_provisioning_events WHERE tenant_id = $1 AND action = 'tenant_time_zone_set'`, [tenantId]
        );
        assert.deepEqual(events.rows.map(r => r.summary), [{ timeZone: 'Asia/Jakarta', previous: 'Asia/Makassar' }]);
    });

    const people = file('people.csv', [
        'elligble_id,full_name,kind',
        'guru.mtk,"Budi Santoso, S.Pd.",teacher',
        'pengawas.satu,Sari Dewi,staff',
        'siswa.satu,Ani Lestari,student',
        'Siswa.Dua,Rudi Hartono,student',
    ].join('\r\n'));
    const cards = new Map<string, string>();

    await t.test('people import: dry run changes nothing; the import prints single-use cards', () => {
        const dry = cli('people', 'import', '--tenant', tenantId, '--file', people, '--dry-run');
        assert.equal(dry.code, 0, dry.out);
        assert.match(dry.out, /Dry run OK/);
        const sheet = path.join(dir, 'kartu.html');
        const run = cli('people', 'import', '--tenant', tenantId, '--file', people, '--sheet', sheet, '--app-url', 'https://ujian.contoh.sch.id', ...audit);
        assert.equal(run.code, 0, run.out);
        assert.equal(statSync(sheet).mode & 0o777, 0o600, 'the sheet is readable by its owner only');
        const html = readFileSync(sheet, 'utf8');
        for (const match of html.matchAll(/<dd class="mono">([a-z0-9._-]+)<\/dd>\s*<dt>Kode Aktivasi<\/dt><dd class="mono code">([A-Z0-9-]+)<\/dd>/g)) {
            cards.set(match[1], match[2]);
        }
        assert.deepEqual([...cards.keys()].sort(), ['guru.mtk', 'pengawas.satu', 'siswa.dua', 'siswa.satu']);
        assert.match(html, /Budi Santoso, S\.Pd\./);
        assert.match(html, /https:\/\/ujian\.contoh\.sch\.id/);
    });

    await t.test('people import is idempotent, refuses bad rows as a whole, and never stores names', async () => {
        const again = cli('people', 'import', '--tenant', tenantId, '--file', people, '--sheet', path.join(dir, 'kartu-2.html'), ...audit);
        assert.equal(again.code, 0, again.out);
        assert.match(again.out, /"created":0,"exists":4/);
        assert.equal(existsSync(path.join(dir, 'kartu-2.html')), false, 'no cards when nothing was created');
        const bad = file('bad.csv', 'elligble_id,full_name,kind\nsiswa.tiga,Tiga,student\nbukan email@x,Salah,student\nsiswa.tiga,Ganda,student\n');
        const refused = cli('people', 'import', '--tenant', tenantId, '--file', bad, '--sheet', path.join(dir, 'kartu-3.html'), ...audit);
        assert.equal(refused.code, 1);
        assert.match(refused.out, /REFUSED, nothing was changed/);
        const tiga = await pool.query(`SELECT 1 FROM identity_account_credentials WHERE username = 'siswa.tiga'`);
        assert.equal(tiga.rowCount, 0);
        const events = await pool.query('SELECT summary::text AS s FROM platform_provisioning_events');
        assert.doesNotMatch(events.rows.map(r => r.s).join(' '), /Budi|Ani|Rudi|Sari/);
    });

    const academic = file('academic.json', JSON.stringify({
        template: 'elligble-academic-v1',
        year: { label: 'TA Uji', startDate: isoDate(-60), endDate: isoDate(300) },
        periods: [{ label: 'Semester Uji', type: 'SEMESTER', startDate: isoDate(-60), endDate: isoDate(120) }],
        grades: ['Kelas 10'],
        groups: [{ label: 'X-1', grade: 'Kelas 10' }],
        subjects: ['Matematika Wajib'],
        offerings: [{ subject: 'Matematika Wajib', period: 'Semester Uji', grade: 'Kelas 10' }],
        teaching: [{ teacher: 'guru.mtk', subject: 'Matematika Wajib', period: 'Semester Uji', group: 'X-1' }],
        enrollments: [{ group: 'X-1', period: 'Semester Uji', startDate: isoDate(-30), students: ['siswa.satu', 'siswa.dua'] }],
    }));

    await t.test('academic import applies the setup once', () => {
        const run = cli('academic', 'import', '--tenant', tenantId, '--file', academic, ...audit);
        assert.equal(run.code, 0, run.out);
        assert.match(run.out, /"years":1,"periods":1,"grades":1,"groups":1,"subjects":1,"offerings":1,"teaching":1,"enrollments":2/);
        const again = cli('academic', 'import', '--tenant', tenantId, '--file', academic, ...audit);
        assert.equal(again.code, 0, again.out);
        assert.match(again.out, /"years":0,"periods":0,"grades":0,"groups":0,"subjects":0,"offerings":0,"teaching":0,"enrollments":0/);
    });

    const exam = file('exam.json', JSON.stringify({
        template: 'elligble-exam-v1', teacher: 'guru.mtk', subject: 'Matematika Wajib', period: 'Semester Uji', group: 'X-1',
        assessmentType: 'Ulangan Harian', window: { startsAt: wib(-5), endsAt: wib(120) }, durationMinutes: 60,
        latestStartPolicy: 'FULL_DURATION_BEYOND_WINDOW', participants: 'group', proctors: ['pengawas.satu'],
    }));
    const questions = file('soal.csv', [
        'no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score',
        '1,Hasil dari 2 + 3 adalah,4,5,6,7,8,B,1',
        '2,"Bilangan prima terkecil adalah",0,1,2,3,4,C,1',
        '3,Akar kuadrat dari 81 adalah,7,8,9,10,11,C,"1,5"',
    ].join('\n'));

    await t.test('exam import schedules the exam once, with questions in order', async () => {
        const bad = file('soal-salah.csv', 'no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score\n1,Soal,a,b,c,d,,A,1\n');
        assert.equal(cli('exam', 'import', '--tenant', tenantId, '--file', exam, '--questions', bad, ...audit).code, 1);
        const run = cli('exam', 'import', '--tenant', tenantId, '--file', exam, '--questions', questions, ...audit);
        assert.equal(run.code, 0, run.out);
        assert.match(run.out, /"questions":3,"participants":2,"proctors":1/);
        const again = cli('exam', 'import', '--tenant', tenantId, '--file', exam, '--questions', questions, ...audit);
        assert.equal(again.code, 1);
        assert.match(again.out, /already imported/);
        const actions = await pool.query('SELECT action FROM platform_provisioning_events WHERE tenant_id = $1 ORDER BY occurred_at', [tenantId]);
        // Every operator run is recorded, including idempotent re-runs that changed nothing.
        assert.deepEqual(actions.rows.map(r => r.action), ['tenant_created', 'tenant_time_zone_set', 'people_imported', 'people_imported', 'academic_imported', 'academic_imported', 'exam_imported']);
        await assert.rejects(pool.query('DELETE FROM platform_provisioning_events'), /append-only/);
    });

    const signIn = async (id: string, password: string) => {
        const client = new BrowserLikeClient(app.baseUrl);
        const res = await client.request('/api/v1/auth/activate', { method: 'POST', body: { username: id, activationCode: cards.get(id), newPassword: password } });
        assert.equal(res.status, 200, `${id}: ${JSON.stringify(res.body)}`);
        client.tenantId = tenantId;
        return client;
    };

    await t.test('teacher, proctor and students activate with their cards and run the exam', async () => {
        const teacher = await signIn('guru.mtk', 'papan-tulis-hijau');
        const readiness = await teacher.request('/api/v1/assessment/teacher-readiness');
        assert.equal(readiness.status, 200);
        const examId = readiness.body.exams[0].examInstanceId;
        assert.equal(readiness.body.exams[0].lifecycleState, 'SCHEDULED');
        for (const action of ['mark_ready', 'activate']) {
            const res = await teacher.request('/api/v1/assessment/teacher-exams/transition', { method: 'POST', body: { examInstanceId: examId, action } });
            assert.equal(res.status, 200, `${action}: ${JSON.stringify(res.body)}`);
        }

        const proctor = await signIn('pengawas.satu', 'ruang-ujian-tenang');
        const monitoring = await proctor.request('/api/v1/assessment/proctor-monitoring');
        assert.equal(monitoring.body.assignments[0].examInstanceId, examId);

        const student = await signIn('siswa.dua', 'bintang-kejora-2026');
        const list = await student.request('/api/v1/assessment/assigned-exams');
        assert.equal(list.body.assignments[0].examInstanceId, examId);
        const attemptId = (await student.request('/api/v1/assessment/attempts/start', { method: 'POST', body: { examInstanceId: examId } })).body.attemptId;
        const sessionId = randomUUID();
        assert.equal((await student.request('/api/v1/assessment/session/activate', { method: 'POST', body: { attemptId, sessionId } })).status, 200);
        assert.equal((await student.request('/api/v1/assessment/timer/start', { method: 'POST', body: { attemptId } })).status, 200);
        const delivered = await student.request(`/api/v1/assessment/questions?attemptId=${attemptId}`);
        assert.deepEqual(delivered.body.questions.map((q: any) => q.prompt), ['Hasil dari 2 + 3 adalah', 'Bilangan prima terkecil adalah', 'Akar kuadrat dari 81 adalah']);
        const first = delivered.body.questions[0];
        assert.ok(first.options.every((o: any) => /^opt_[0-9a-f]{12}$/.test(o.id)), 'option ids are not the display letters');
        const save = await student.request('/api/v1/assessment/answer/save', {
            method: 'POST',
            body: { attemptId, sessionId, snapshotId: first.snapshotId, answerPayload: { selectedOptionId: first.options[1].id }, clientWriteIdentity: randomUUID(), expectedWriteVersion: null },
        });
        assert.equal(save.status, 200);
        assert.equal((await student.request('/api/v1/assessment/submit', { method: 'POST', body: { attemptId } })).status, 200);
    });

    await t.test('activation reissue is an audited reset with a fresh card', async () => {
        const student = await signIn('siswa.satu', 'kupu-kupu-biru-2026');
        const sheet = path.join(dir, 'kartu-ulang.html');
        const run = cli('activation', 'reissue', '--tenant', tenantId, '--elligble-id', 'siswa.satu', '--full-name', 'Ani Lestari', '--sheet', sheet, ...audit);
        assert.equal(run.code, 0, run.out);
        assert.equal((await student.request('/api/v1/auth/session')).status, 401, 'sessions end');
        assert.equal((await new BrowserLikeClient(app.baseUrl).login('siswa.satu', 'kupu-kupu-biru-2026')).status, 401, 'old password ends');
        const code = /<dd class="mono code">([A-Z0-9-]+)<\/dd>/.exec(readFileSync(sheet, 'utf8'))![1];
        const fresh = new BrowserLikeClient(app.baseUrl);
        const res = await fresh.request('/api/v1/auth/activate', { method: 'POST', body: { username: 'siswa.satu', activationCode: code, newPassword: 'pelangi-senja-2027' } });
        assert.equal(res.status, 200);
        const reissues = await pool.query(`SELECT count(*)::int AS n FROM platform_provisioning_events WHERE action = 'activation_reissued' AND tenant_id = $1`, [tenantId]);
        assert.equal(reissues.rows[0].n, 1);
        assert.equal(cli('activation', 'reissue', '--tenant', tenantId, '--elligble-id', 'tidak.ada', '--sheet', path.join(dir, 'x.html'), ...audit).code, 1);
    });
});
