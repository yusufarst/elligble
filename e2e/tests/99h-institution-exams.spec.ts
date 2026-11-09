import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { login, navigatePage, reloadPage, state, wib, withDatabase } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

// ASSESS-INSTITUTION-001 five-browser journey and rendered evidence (record §7 C06/C07). The file sorts
// after every spec (Playwright orders files with localeCompare), so its institution exams never hold the
// X-E2E students against an earlier spec; its sessions are on later days, so no earlier exam conflicts.
// pengawas.e2e is given the School Operator assignment here and has it revoked at the end, as
// 9-identity.spec.ts does. The timed deadline journey sets its own timeout; the multi-width captures run
// in separate tests outside it. The before-state is the exact-main CI #219 artifacts (record §10).
// Navigation only through the shared helpers (no direct page.reload or page.goto).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-INSTITUTION-001 capture SHA mismatch');
const BASELINE = { run: 219, commit: 'e031d31949972fd501946dd231f2bd1a45e247b5', frontendTree: '96c7189bac3d2e20f73e76d5acf2247a706c10f6', manifestSha256: '56b1a1babe2fb8b6a7077627168b34f2a1a9b66f797ca379d306f9dd59a1698a' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const OPERATOR = ['pengawas.e2e', 'ruang-ujian-tenang'] as const;
const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const SUBJECT_OPTION = 'Matematika Wajib · X-E2E · guru.e2e';
const HEADER = 'no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score';
const FILE_1 = [HEADER, '1,Hasil dari 12 dibagi 4 adalah,2,3,4,5,6,B,1', '2,Bilangan genap terkecil yang lebih dari 7 adalah,6,8,9,10,12,B,1'].join('\n') + '\n';
const FILE_2 = [HEADER, '1,Hasil dari 9 dikali 3 adalah,18,21,24,27,30,D,1', '2,Akar kuadrat dari 64 adalah,6,7,8,9,10,C,1', '3,Hasil dari 100 dikurangi 37 adalah,53,63,73,67,57,B,1'].join('\n') + '\n';
const REASON = 'Guru mata pelajaran mengikuti pelatihan';
const ALREADY_PLACED = 'Mata pelajaran dan rombel ini sudah ditempatkan di periode ini.';
const CLOSED_COPY = 'Tenggat penyiapan soal sudah lewat, jadi soal tidak dapat diubah. Hubungi operator sekolah bila perlu perpanjangan.';

const FULL = [360, 390, 430, 768, 1024, 1280, 1440].map(width => ({ width, height: 800, text: 1 })).concat([{ width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }, { width: 1280, height: 800, text: 2 }]);

/** The school-zone (WIB) date `days` from today. */
const wibDay = (days: number) => wib(days * 24 * 60).slice(0, 10);

async function capture(page: Page, scenario: string, root: () => Locator, variants = FULL): Promise<void> {
    const original = page.viewportSize();
    const browser = page.context().browser();
    if (!original || !browser) throw new Error('A real browser and viewport are required');
    try {
        for (const v of variants) {
            await page.setViewportSize({ width: v.width, height: v.height });
            // 200 % text: computed font size and line height doubled per element (spec 6 method).
            if (v.text === 2) await page.evaluate(() => {
                for (const node of [document.documentElement, ...document.querySelectorAll<HTMLElement>('body *')]) {
                    if (!(node instanceof HTMLElement)) continue;
                    const style = getComputedStyle(node), font = parseFloat(style.fontSize), line = parseFloat(style.lineHeight);
                    node.dataset.ai1OriginalStyle = JSON.stringify(node.getAttribute('style'));
                    node.style.fontSize = String(font * 2) + 'px';
                    if (Number.isFinite(line)) node.style.lineHeight = String(line * 2) + 'px';
                }
            });
            try {
                await expect(root()).toBeVisible();
                await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); });
                const metrics = await root().evaluate(element => {
                    const targets = [...element.querySelectorAll<HTMLElement>('button, input, textarea, select, summary')].filter(n => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0; })
                        .map(n => { const t = n instanceof HTMLInputElement && ['checkbox', 'radio'].includes(n.type) ? n.closest('label') ?? n : n; const b = t.getBoundingClientRect(); return { name: n.getAttribute('aria-label') ?? t.textContent?.trim().slice(0, 60) ?? n.tagName, width: b.width, height: b.height }; });
                    const active = document.activeElement as HTMLElement | null;
                    return {
                        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets,
                        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        focus: active ? { tag: active.tagName, type: (active as HTMLInputElement).type ?? null, label: active.getAttribute('aria-label') } : null,
                        overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(n => n.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).slice(0, 8).map(n => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 50)}`),
                    };
                });
                const name = ['workspace-institution', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                // The larger of the document and body heights: with a dialog open, WebKit sizes the full page by
                // the body. A screenshot WebKit still refuses as too large falls back to the viewport, recorded
                // as fullPage false (CI #223).
                let fullPage = (await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) * window.devicePixelRatio)) <= 30000;
                try {
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                } catch (error) {
                    if (!fullPage || !String(error).includes('larger than')) throw error;
                    fullPage = false;
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                }
                writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
                    task: 'ASSESS-INSTITUTION-001', phase: 'after', commit, frontendTree, baseline: BASELINE,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256, questionsSha256: createHash('sha256').update(FILE_1).digest('hex') },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow`).toBeLessThanOrEqual(metrics.clientWidth);
                expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
            } finally {
                if (v.text === 2) await page.evaluate(() => {
                    for (const node of document.querySelectorAll<HTMLElement>('[data-ai1-original-style]')) {
                        const original: string | null = JSON.parse(node.dataset.ai1OriginalStyle ?? 'null');
                        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
                        delete node.dataset.ai1OriginalStyle;
                    }
                });
            }
        }
    } finally { await page.setViewportSize(original); }
}

async function operatorAssignment(action: 'ASSIGN' | 'REVOKE'): Promise<void> {
    await withDatabase(async c => {
        const person = (await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id = a.id WHERE cr.username = $1', [OPERATOR[0]])).rows[0].person_id as string;
        await c.query('BEGIN');
        try {
            await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-001', reason: 'Synthetic institution exams' });
            await c.query('COMMIT');
        } catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
    });
}

/** The exam placed in a period (one Matematika x X-E2E per period, E4). */
async function examOf(periodLabel: string): Promise<string> {
    return withDatabase(async c => (await c.query(
        `SELECT i.id FROM secure_assessment_exam_instances i
         JOIN secure_assessment_institution_exam_sessions s ON s.id = i.institution_session_id
         JOIN secure_assessment_institution_exam_periods p ON p.id = s.period_id
         WHERE p.tenant_id = $1 AND p.label = $2 ORDER BY i.id LIMIT 1`, [state.tenantId, periodLabel])).rows[0].id as string);
}

async function deadlinePassed(examId: string): Promise<boolean> {
    return withDatabase(async c => (await c.query(
        `SELECT max(deadline_at) <= statement_timestamp() AS passed FROM secure_assessment_institution_preparation_deadlines WHERE exam_instance_id = $1`, [examId])).rows[0].passed === true);
}

const notice = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function openInstitution(page: Page): Promise<void> {
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
}

const periodCard = (page: Page, label: string) => page.locator('[data-testid^="institution-period-"]').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
const examCard = (page: Page, examId: string) => page.getByTestId(`institution-exam-${examId}`);

async function openPeriod(page: Page, label: string): Promise<void> {
    const card = periodCard(page, label);
    // Wait for the overview to render the card first: isVisible() does not wait, so before the list
    // loads it would skip the click and leave the period closed (CI #222).
    await expect(card).toBeVisible();
    const open = card.getByRole('button', { name: 'Buka Periode' });
    if (await open.isVisible()) await open.click();
    await expect(card.getByRole('button', { name: 'Tambah Sesi' })).toBeVisible();
}

async function createPeriod(page: Page, label: string): Promise<void> {
    await page.getByRole('button', { name: 'Buat Periode' }).click();
    const dialog = page.getByRole('dialog', { name: 'Buat Periode Ujian' });
    await dialog.getByLabel('Nama periode').fill(label);
    await dialog.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await dialog.getByLabel('Periode Akademik').selectOption({ label: 'Semester E2E' });
    await dialog.getByRole('button', { name: 'Simpan Periode' }).click();
    await expect(notice(page, 'Periode ujian tersimpan.')).toBeVisible();
    await expect(periodCard(page, label).getByRole('button', { name: 'Tambah Sesi' })).toBeVisible();
}

async function addSession(page: Page, label: string, date: string, start = '08:00', end = '10:00'): Promise<void> {
    await periodCard(page, label).getByRole('button', { name: 'Tambah Sesi' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Sesi' });
    await dialog.getByLabel('Tanggal').fill(date);
    await dialog.getByLabel('Jam mulai').fill(start);
    await dialog.getByLabel('Jam selesai').fill(end);
    await dialog.getByRole('button', { name: 'Simpan Sesi' }).click();
    await expect(notice(page, 'Sesi tersimpan.')).toBeVisible();
    await expect(periodCard(page, label).getByRole('heading', { level: 3, name: /^Jadwal Sesi: / })).toBeVisible();
}

async function fillPlacement(page: Page, label: string, deadline: string): Promise<Locator> {
    await periodCard(page, label).getByRole('button', { name: 'Tempatkan Ujian' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tempatkan Ujian di Sesi' });
    await dialog.getByLabel('Mata pelajaran dan rombel').selectOption({ label: SUBJECT_OPTION });
    await dialog.getByLabel('Durasi pengerjaan (menit)').fill('60');
    await dialog.getByRole('radio', { name: /Durasi penuh/ }).check();
    await dialog.getByLabel('Tenggat penyiapan soal').fill(deadline);
    return dialog;
}

async function placeExam(page: Page, label: string, deadline: string): Promise<string> {
    const dialog = await fillPlacement(page, label, deadline);
    await dialog.getByRole('button', { name: 'Tempatkan Ujian' }).click();
    await expect(notice(page, /Matematika Wajib · X-E2E ditempatkan dengan \d+ peserta\./)).toBeVisible();
    return examOf(label);
}

/**
 * ASSESS-INSTITUTION-002 RP-1: a placed exam needs a room and its Proctor before "Tandai Siap". The Operator
 * opens "Ruang dan Pengawas" of the period's session, adds "Ruang E2E" with every participant and sets
 * pengawas.e2e as its Proctor, then returns to the period.
 */
async function roomAndProctor(page: Page, label: string): Promise<void> {
    await openPeriod(page, label);
    await periodCard(page, label).getByRole('button', { name: 'Ruang dan Pengawas', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ruang dan Pengawas' })).toBeVisible();
    await page.getByRole('button', { name: 'Tambah Ruang', exact: true }).click();
    const room = page.getByRole('dialog', { name: 'Tambah Ruang' });
    await room.getByLabel('Nama ruang').fill('Ruang E2E');
    await room.getByRole('button', { name: /^Pilih semua / }).click();
    await room.getByRole('button', { name: 'Simpan Ruang', exact: true }).click();
    await expect(notice(page, /^Peserta ditempatkan di Ruang E2E: \d+ peserta\./)).toBeVisible();
    await page.getByTestId('institution-room-Ruang E2E').getByRole('button', { name: 'Atur Pengawas', exact: true }).click();
    const proctors = page.getByRole('dialog', { name: 'Atur Pengawas Ruang E2E' });
    await proctors.getByLabel('ELLIGBLE ID pengawas').fill(OPERATOR[0]);
    await proctors.getByRole('button', { name: 'Tambahkan', exact: true }).click();
    await proctors.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    await expect(notice(page, 'Pengawas Ruang E2E tersimpan.')).toBeVisible();
    await page.getByRole('button', { name: 'Kembali ke Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
}

async function teacherContext(browser: Browser, page: Page): Promise<Page> {
    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const teacher = await context.newPage();
    await login(teacher, ...TEACHER);
    await expect(teacher.getByRole('heading', { level: 1, name: 'Pelaksanaan Ujian' })).toBeVisible();
    return teacher;
}

async function refreshTeacher(teacher: Page): Promise<void> {
    await teacher.getByRole('button', { name: 'Perbarui Data' }).click();
    await expect(teacher.getByRole('button', { name: 'Perbarui Data' })).toBeEnabled();
}

async function openPreparation(teacher: Page, examId: string): Promise<void> {
    await teacher.getByTestId(`teacher-exam-${examId}`).getByRole('button', { name: 'Siapkan Soal' }).click();
    await expect(teacher.getByRole('heading', { level: 1, name: 'Siapkan Soal Ujian Sekolah' })).toBeVisible();
}

async function checkFile(teacher: Page, csv: string, name: string): Promise<void> {
    await teacher.getByLabel('Berkas CSV').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
    await teacher.getByRole('button', { name: 'Periksa Soal' }).click();
    await expect(teacher.getByText('Soal siap disimpan')).toBeVisible();
}

async function prepare(teacher: Page, examId: string, csv: string, name: string, replaces = 0): Promise<void> {
    await openPreparation(teacher, examId);
    await checkFile(teacher, csv, name);
    await teacher.getByRole('button', { name: 'Simpan Soal' }).click();
    const dialog = teacher.getByRole('dialog', { name: 'Simpan Soal Ujian Sekolah?' });
    if (replaces > 0) await expect(dialog.getByText(`Soal yang sudah tersimpan (${replaces} soal) akan diganti seluruhnya oleh berkas ini.`)).toBeVisible();
    else await expect(dialog.getByText(/akan diganti seluruhnya/)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Simpan Soal' }).click();
    await expect(notice(teacher, 'Soal ujian sekolah tersimpan:')).toBeVisible();
}

/** The content route as the Teacher's own page calls it (same origin, session cookie). */
const contentPreview = (teacher: Page, examInstanceId: string) => teacher.evaluate(async ({ examInstanceId, csv, tenant }) => {
    const r = await fetch('/api/v1/assessment/teacher-exams/content/preview', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant },
        body: JSON.stringify({ examInstanceId, questionsCsv: csv, sourceFileName: 'terlambat.csv' }),
    });
    return { status: r.status, body: await r.json() };
}, { examInstanceId, csv: FILE_1, tenant: state.tenantId });

test.beforeAll(async () => operatorAssignment('ASSIGN'));
test.afterAll(async () => operatorAssignment('REVOKE'));

// Shared by the journey and the captures after it.
const LABEL_A = 'PTS Ganjil E2E';
const LABEL_C = 'PAS Ganjil E2E';
let examA = '';
let examC = '';

test('ASSESS-INSTITUTION-001 captures: the empty Operator screen', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);
    await expect(page.getByRole('heading', { name: 'Belum ada periode ujian.' })).toBeVisible();
    await capture(page, 'operator-empty', () => page.locator('main').first());
});

test('ASSESS-INSTITUTION-001 deadline journey: compose, prepare, replace, extend, close at the deadline, mark ready, cancel', async ({ page, browser }) => {
    // The config allows 90 s with no retries; C's deadline is at most 120 s after its placement and
    // the wait below polls for at most 150 s, leaving 90 s for the steps (record §7 C06).
    // 300 s: the room and Proctor of C before "Tandai Siap" (ASSESS-INSTITUTION-002 RP-1) add steps.
    test.setTimeout(300_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const teacher = await teacherContext(browser, page);
    await login(page, ...OPERATOR);
    await openInstitution(page);

    // Period A with exam A (deadline days ahead); a second Matematika x X-E2E in A's period is refused.
    await createPeriod(page, LABEL_A);
    await addSession(page, LABEL_A, wibDay(20));
    examA = await placeExam(page, LABEL_A, `${wibDay(5)}T15:00`);
    const refused = await fillPlacement(page, LABEL_A, `${wibDay(5)}T16:00`);
    await refused.getByRole('button', { name: 'Tempatkan Ujian' }).click();
    await expect(refused.getByText(ALREADY_PLACED)).toBeVisible();
    await refused.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(refused).toHaveCount(0);
    // Period C with exam C, whose deadline is about a minute ahead.
    await createPeriod(page, LABEL_C);
    await addSession(page, LABEL_C, wibDay(21));
    examC = await placeExam(page, LABEL_C, wib(2));
    await expect(examCard(page, examC)).toContainText('Belum ada soal');

    // The subject Teacher prepares C at once, then prepares A, replaces A's questions and previews A.
    await refreshTeacher(teacher);
    await expect(teacher.getByTestId(`teacher-exam-${examC}`)).toContainText('Ujian sekolah · PAS Ganjil E2E');
    for (const action of ['Ubah Jadwal', 'Tambah Peserta', 'Tandai Siap', 'Batalkan Ujian']) {
        await expect(teacher.getByTestId(`teacher-exam-${examC}`).getByRole('button', { name: action })).toHaveCount(0);
    }
    await prepare(teacher, examC, FILE_1, 'soal-c.csv');
    await prepare(teacher, examA, FILE_1, 'soal-a.csv');
    await prepare(teacher, examA, FILE_2, 'soal-a-revisi.csv', 2);
    const cardA = teacher.getByTestId(`teacher-exam-${examA}`);
    await expect(cardA).toContainText('3 soal disiapkan.');
    await cardA.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await expect(teacher.getByText('Hasil dari 9 dikali 3 adalah')).toBeVisible();
    await teacher.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    // The Operator extends A's deadline with a reason.
    await openPeriod(page, LABEL_A);
    await examCard(page, examA).getByRole('button', { name: 'Perpanjang Tenggat' }).click();
    const extension = page.getByRole('dialog', { name: 'Perpanjang Tenggat Penyiapan Soal' });
    await extension.getByLabel('Tenggat baru').fill(`${wibDay(6)}T15:00`);
    await extension.getByLabel('Alasan tindakan', { exact: true }).fill(REASON);
    await extension.getByRole('button', { name: 'Perpanjang' }).click();
    await expect(notice(page, 'diperpanjang sampai')).toBeVisible();
    await expect(examCard(page, examA)).toContainText('(diperpanjang)');
    await expect(examCard(page, examA)).toContainText('Soal disiapkan: 3 soal');

    // A bounded wait for C's deadline; then the content is closed and the Operator marks C ready.
    await expect.poll(() => deadlinePassed(examC), { timeout: 150_000, intervals: [2_000] }).toBe(true);
    await refreshTeacher(teacher);
    const cardC = teacher.getByTestId(`teacher-exam-${examC}`);
    await expect(cardC).toContainText('Penyiapan soal ditutup');
    await expect(cardC.getByRole('button', { name: 'Siapkan Soal' })).toHaveCount(0);
    const late = await contentPreview(teacher, examC);
    expect([late.status, late.body.error]).toEqual([409, 'preparation_closed']);
    await reloadPage(page);
    await openPeriod(page, LABEL_C);
    await expect(examCard(page, examC)).toContainText('Penyiapan ditutup');
    await roomAndProctor(page, LABEL_C);
    await examCard(page, examC).getByRole('button', { name: 'Tandai Siap' }).click();
    const ready = page.getByRole('dialog', { name: 'Tandai Siap?' });
    await expect(ready.getByText(/akan ditandai siap\. Soal tidak dapat diubah lagi/)).toBeVisible();
    await ready.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(notice(page, 'ditandai siap.')).toBeVisible();
    await expect(examCard(page, examC)).toContainText('Siap Dibuka');

    // The Operator cancels A with a reason; the Teacher sees it under "Ujian Dibatalkan".
    await openPeriod(page, LABEL_A);
    await examCard(page, examA).getByRole('button', { name: 'Batalkan Ujian' }).click();
    const cancel = page.getByRole('dialog', { name: 'Batalkan Ujian Sekolah?' });
    await cancel.getByLabel('Alasan tindakan', { exact: true }).fill('Jadwal dipindahkan ke periode lain');
    await cancel.getByRole('button', { name: 'Batalkan Ujian' }).click();
    await expect(notice(page, 'dibatalkan dan diarsipkan.')).toBeVisible();
    await expect(examCard(page, examA)).toContainText('Dibatalkan');
    await refreshTeacher(teacher);
    const cancelled = teacher.getByRole('region', { name: 'Ujian Dibatalkan' });
    await expect(cancelled.getByTestId(`teacher-exam-${examA}`)).toContainText('Jadwal dipindahkan ke periode lain');
    await expect(teacher.getByTestId(`teacher-exam-${examC}`)).toContainText('Siap Dibuka');
    await teacher.context().close();
});

test('ASSESS-INSTITUTION-001 captures: the Operator screen, its dialogs and states, the Teacher card and the preparation screen', async ({ page, browser }) => {
    test.setTimeout(25 * 60_000);
    expect(examA && examC, 'the journey placed exams A and C').toBeTruthy();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const teacher = await teacherContext(browser, page);
    await login(page, ...OPERATOR);
    await openInstitution(page);
    const main = () => page.locator('main').first();
    const dialog = () => page.getByRole('dialog');

    // Exams D (content, ready to mark) and E (no content) with deadlines about a minute ahead,
    // placed first so their deadlines pass while the other captures run.
    await createPeriod(page, 'Ujian Tampilan D');
    await addSession(page, 'Ujian Tampilan D', wibDay(23));
    const examD = await placeExam(page, 'Ujian Tampilan D', wib(2));
    await createPeriod(page, 'Ujian Tampilan E');
    await addSession(page, 'Ujian Tampilan E', wibDay(24));
    const examE = await placeExam(page, 'Ujian Tampilan E', wib(2));
    await refreshTeacher(teacher);
    await prepare(teacher, examD, FILE_1, 'soal-d.csv');

    // Exam B, before its deadline: the open period, each form dialog and a refusal.
    await page.getByRole('button', { name: 'Buat Periode' }).click();
    await expect(dialog()).toBeVisible();
    await capture(page, 'dialog-create-period', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await createPeriod(page, 'Ujian Tampilan B');
    await periodCard(page, 'Ujian Tampilan B').getByRole('button', { name: 'Tambah Sesi' }).click();
    await expect(dialog()).toBeVisible();
    await capture(page, 'dialog-add-session', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await addSession(page, 'Ujian Tampilan B', wibDay(22));
    await fillPlacement(page, 'Ujian Tampilan B', `${wibDay(5)}T15:00`);
    await capture(page, 'dialog-place-exam', dialog);
    await dialog().getByRole('button', { name: 'Tempatkan Ujian' }).click();
    await expect(notice(page, /ditempatkan dengan \d+ peserta\./)).toBeVisible();
    const examB = await examOf('Ujian Tampilan B');
    await capture(page, 'operator-period-open', main);
    const again = await fillPlacement(page, 'Ujian Tampilan B', `${wibDay(5)}T16:00`);
    await again.getByRole('button', { name: 'Tempatkan Ujian' }).click();
    await expect(again.getByText(ALREADY_PLACED)).toBeVisible();
    await capture(page, 'dialog-place-refused', dialog);
    await again.getByRole('button', { name: 'Batal', exact: true }).click();
    await examCard(page, examB).getByRole('button', { name: 'Perpanjang Tenggat' }).click();
    await dialog().getByLabel('Alasan tindakan', { exact: true }).fill(REASON);
    await capture(page, 'dialog-extend-deadline', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await examCard(page, examB).getByRole('button', { name: 'Batalkan Ujian' }).click();
    await capture(page, 'dialog-cancel-exam', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(dialog()).toHaveCount(0);

    // The preparation screen of B: empty, checked preview, the replacement confirmation.
    await refreshTeacher(teacher);
    await openPreparation(teacher, examB);
    await capture(teacher, 'preparation-empty', () => teacher.locator('main').first());
    await checkFile(teacher, FILE_1, 'soal-b.csv');
    await capture(teacher, 'preparation-checked', () => teacher.locator('main').first());
    await teacher.getByRole('button', { name: 'Simpan Soal' }).click();
    await teacher.getByRole('dialog', { name: 'Simpan Soal Ujian Sekolah?' }).getByRole('button', { name: 'Simpan Soal' }).click();
    await expect(notice(teacher, 'Soal ujian sekolah tersimpan: 2 soal.')).toBeVisible();
    await openPreparation(teacher, examB);
    await checkFile(teacher, FILE_2, 'soal-b-revisi.csv');
    await teacher.getByRole('button', { name: 'Simpan Soal' }).click();
    const replace = teacher.getByRole('dialog', { name: 'Simpan Soal Ujian Sekolah?' });
    await expect(replace.getByText('Soal yang sudah tersimpan (2 soal) akan diganti seluruhnya oleh berkas ini.')).toBeVisible();
    await capture(teacher, 'preparation-replace-confirmation', () => replace);
    await replace.getByRole('button', { name: 'Batal', exact: true }).click();
    await teacher.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    // After D's and E's deadlines: the readiness blocker, mark ready, READY and cancelled, the Teacher
    // cards (before the deadline, closed, READY) and the preparation screen of a closed exam.
    await expect.poll(async () => (await deadlinePassed(examD)) && (await deadlinePassed(examE)), { timeout: 150_000, intervals: [2_000] }).toBe(true);
    await reloadPage(page);
    await openPeriod(page, 'Ujian Tampilan E');
    await expect(examCard(page, examE)).toContainText('Soal ujian belum ditambahkan');
    await capture(page, 'operator-readiness-blocker', main);
    await openPeriod(page, 'Ujian Tampilan D');
    await roomAndProctor(page, 'Ujian Tampilan D');
    await examCard(page, examD).getByRole('button', { name: 'Tandai Siap' }).click();
    await capture(page, 'dialog-mark-ready', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await openPeriod(page, LABEL_C);
    await expect(examCard(page, examC)).toContainText('Siap Dibuka');
    await capture(page, 'operator-ready', main);
    await openPeriod(page, LABEL_A);
    await expect(examCard(page, examA)).toContainText('Dibatalkan');
    await capture(page, 'operator-cancelled', main);

    await refreshTeacher(teacher);
    await expect(teacher.getByTestId(`teacher-exam-${examB}`)).toContainText('Tenggat penyiapan soal');
    await expect(teacher.getByTestId(`teacher-exam-${examE}`)).toContainText('Penyiapan soal ditutup');
    await expect(teacher.getByTestId(`teacher-exam-${examC}`)).toContainText('Siap Dibuka');
    await capture(teacher, 'teacher-card-open', () => teacher.getByTestId(`teacher-exam-${examB}`));
    await capture(teacher, 'teacher-card-closed', () => teacher.getByTestId(`teacher-exam-${examE}`));
    await capture(teacher, 'teacher-card-ready', () => teacher.getByTestId(`teacher-exam-${examC}`));
    await navigatePage(teacher, `/?view=teacher&prepareExam=${examE}`);
    await expect(teacher.getByText(CLOSED_COPY)).toBeVisible();
    await capture(teacher, 'preparation-closed', () => teacher.locator('main').first());
    await teacher.context().close();
});
