import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, open, reloadPage, state, wib, withDatabase } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

// ASSESS-INSTITUTION-002 five-browser journey and rendered evidence (record §7 C06/C07). The file sorts after
// 99h (Playwright orders files with localeCompare); its sessions are on later days than every earlier spec, so no
// earlier exam conflicts with them. pengawas.e2e is given the School Operator assignment here and has it revoked
// at the end, as 99h does; it is also the Proctor of "Ruang A" (an Operator may be a Proctor, P03). guru.e2e is
// the subject Teacher and the Proctor of "Ruang B". The scenario set is bounded (record R7): nine captures.
// Navigation only through the shared helpers (no direct page.reload or page.goto).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-INSTITUTION-002 capture SHA mismatch');
const BASELINE = { run: 229, commit: '30a74562b4946a08311de369a96d50eaaa5d6b46', frontendTree: '2f2318bc79799f9515e9d1c469b179b6bf978ed2', manifestSha256: 'da598b6e79c9f4a6f1f841d809387a14817e68e12d5922af0af65983bc2fc66e' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const OPERATOR = ['pengawas.e2e', 'ruang-ujian-tenang'] as const;
const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const SUBJECT_OPTION = 'Matematika Wajib · X-E2E · guru.e2e';
const EXAM_LABEL = 'Matematika Wajib · X-E2E';
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
                    node.dataset.ai2OriginalStyle = JSON.stringify(node.getAttribute('style'));
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
                    // Metric labels wrap at spaces only (F7): no metric uses overflow-wrap: anywhere.
                    const metricWraps = [...document.querySelectorAll<HTMLElement>('[data-slot="metric"] dt')].map(n => getComputedStyle(n).overflowWrap).filter(w => w === 'anywhere');
                    return {
                        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets, metricWraps,
                        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        focus: active ? { tag: active.tagName, type: (active as HTMLInputElement).type ?? null, label: active.getAttribute('aria-label') } : null,
                        overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(n => n.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).slice(0, 8).map(n => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 50)}`),
                    };
                });
                const name = ['workspace-institution-rooms', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                // The larger of the document and body heights: with a dialog open, WebKit sizes the full page by
                // the body. A screenshot WebKit still refuses as too large falls back to the viewport, recorded
                // as fullPage false (as 99h, CI #223).
                let fullPage = (await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) * window.devicePixelRatio)) <= 30000;
                try {
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                } catch (error) {
                    if (!fullPage || !String(error).includes('larger than')) throw error;
                    fullPage = false;
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                }
                writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
                    task: 'ASSESS-INSTITUTION-002', phase: 'after', commit, frontendTree, baseline: BASELINE,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256 },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow`).toBeLessThanOrEqual(metrics.clientWidth);
                expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
                expect.soft(metrics.metricWraps, `${scenario} ${v.width}x${v.height} text${v.text}: mid-word metric labels`).toEqual([]);
            } finally {
                if (v.text === 2) await page.evaluate(() => {
                    for (const node of document.querySelectorAll<HTMLElement>('[data-ai2-original-style]')) {
                        const original: string | null = JSON.parse(node.dataset.ai2OriginalStyle ?? 'null');
                        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
                        delete node.dataset.ai2OriginalStyle;
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
            await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-002', reason: 'Synthetic institution rooms' });
            await c.query('COMMIT');
        } catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
    });
}

/** The exam placed in a period (one Matematika x X-E2E per period). */
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

/** Synthetic questions stored before the deadline (the content route is 99h's subject, not this spec's). */
async function addQuestions(examId: string): Promise<void> {
    await withDatabase(async c => {
        for (let i = 1; i <= 2; i++) {
            await c.query(
                'INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, $4)',
                [state.tenantId, examId, JSON.stringify({
                    schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: `Hasil dari ${i} + ${i} adalah`,
                    options: ['A', 'B', 'C', 'D', 'E'].map((id, k) => ({ id, content: String(i * 2 + k - 1) })), correctOptionId: 'B', maxScore: 1,
                }), i]);
        }
    });
}

async function setLifecycle(examId: string, lifecycleState: string): Promise<void> {
    await withDatabase(async c => { await c.query('UPDATE secure_assessment_exam_instances SET lifecycle_state = $2 WHERE id = $1', [examId, lifecycleState]); });
}

const notice = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function openInstitution(page: Page): Promise<void> {
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
}

const periodCard = (page: Page, label: string) => page.locator('[data-testid^="institution-period-"]').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
const examCard = (page: Page, examId: string) => page.getByTestId(`institution-exam-${examId}`);
const roomCard = (page: Page, label: string) => page.getByTestId(`institution-room-${label}`);
const roomExamCard = (page: Page, examId: string) => page.getByTestId(`institution-room-exam-${examId}`);

async function openPeriod(page: Page, label: string): Promise<void> {
    const card = periodCard(page, label);
    // Wait for the overview to render the card first (isVisible() does not wait; CI #222).
    await expect(card).toBeVisible();
    const button = card.getByRole('button', { name: 'Buka Periode' });
    if (await button.isVisible()) await button.click();
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

async function addSession(page: Page, label: string, date: string): Promise<void> {
    await periodCard(page, label).getByRole('button', { name: 'Tambah Sesi' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Sesi' });
    await dialog.getByLabel('Tanggal').fill(date);
    await dialog.getByLabel('Jam mulai').fill('08:00');
    await dialog.getByLabel('Jam selesai').fill('10:00');
    await dialog.getByRole('button', { name: 'Simpan Sesi' }).click();
    await expect(notice(page, 'Sesi tersimpan.')).toBeVisible();
    await expect(periodCard(page, label).getByRole('heading', { level: 3, name: /^Jadwal Sesi: / })).toBeVisible();
}

async function placeExam(page: Page, label: string, deadline: string): Promise<string> {
    await periodCard(page, label).getByRole('button', { name: 'Tempatkan Ujian' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tempatkan Ujian di Sesi' });
    await dialog.getByLabel('Mata pelajaran dan rombel').selectOption({ label: SUBJECT_OPTION });
    await dialog.getByLabel('Durasi pengerjaan (menit)').fill('60');
    await dialog.getByRole('radio', { name: /Durasi penuh/ }).check();
    await dialog.getByLabel('Tenggat penyiapan soal').fill(deadline);
    await dialog.getByRole('button', { name: 'Tempatkan Ujian', exact: true }).click();
    await expect(notice(page, /Matematika Wajib · X-E2E ditempatkan dengan \d+ peserta\./)).toBeVisible();
    return examOf(label);
}

/** "Ruang dan Pengawas" of the period's only session; the title takes focus. */
async function openRooms(page: Page, label: string): Promise<void> {
    await openPeriod(page, label);
    await periodCard(page, label).getByRole('button', { name: 'Ruang dan Pengawas', exact: true }).click();
    const title = page.getByRole('heading', { level: 1, name: 'Ruang dan Pengawas' });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Daftar Ruang' })).toBeVisible();
}

async function backToPeriods(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Kembali ke Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ruang dan Pengawas', exact: true }).first()).toBeFocused();
}

/** Opens "Tambah Ruang" and fills it: every participant without a room, or one student from any room. */
async function fillRoom(page: Page, label: string, student?: string): Promise<Locator> {
    await page.getByRole('button', { name: 'Tambah Ruang', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Ruang' });
    await dialog.getByLabel('Nama ruang').fill(label);
    if (student) {
        await dialog.getByLabel('Tampilkan').selectOption({ label: 'Semua peserta' });
        await dialog.getByRole('checkbox', { name: new RegExp(`^${student.replace(/\./g, '\\.')}\\b`) }).check();
    } else {
        await dialog.getByRole('button', { name: /^Pilih semua / }).click();
    }
    return dialog;
}

async function saveRoom(page: Page, dialog: Locator, label: string): Promise<void> {
    await dialog.getByRole('button', { name: 'Simpan Ruang', exact: true }).click();
    const done = notice(page, new RegExp(`^Peserta ditempatkan di ${label}: \\d+ peserta\\.`));
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
}

async function fillProctors(page: Page, room: string, ids: string[]): Promise<Locator> {
    await roomCard(page, room).getByRole('button', { name: 'Atur Pengawas', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Atur Pengawas ${room}` });
    for (const id of ids) {
        await dialog.getByLabel('ELLIGBLE ID pengawas').fill(id);
        await dialog.getByRole('button', { name: 'Tambahkan', exact: true }).click();
        await expect(dialog.getByRole('button', { name: `Hapus ${id}`, exact: true })).toBeVisible();
    }
    return dialog;
}

async function saveProctors(page: Page, dialog: Locator, room: string): Promise<void> {
    await dialog.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    const done = notice(page, `Pengawas ${room} tersimpan.`);
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
}

test.beforeAll(async () => operatorAssignment('ASSIGN'));
test.afterAll(async () => operatorAssignment('REVOKE'));

const LABEL_A = 'PTS Ruang E2E';
let examA = '';

test('ASSESS-INSTITUTION-002 journey: Ruang A with its Proctor, a move to Ruang B, the Student and the Proctor, a stale second tab', async ({ page, browser }) => {
    test.setTimeout(6 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);
    await createPeriod(page, LABEL_A);
    await addSession(page, LABEL_A, wibDay(26));
    examA = await placeExam(page, LABEL_A, `${wibDay(5)}T15:00`);

    // "Ruang A" with every participant, and pengawas.e2e typed as its Proctor.
    await openRooms(page, LABEL_A);
    await expect(page.getByText('Belum ada ruang di sesi ini. Tambahkan ruang, lalu tempatkan peserta.')).toBeVisible();
    await saveRoom(page, await fillRoom(page, 'Ruang A'), 'Ruang A');
    await expect(roomCard(page, 'Ruang A')).toContainText('Belum ada pengawas');
    await saveProctors(page, await fillProctors(page, 'Ruang A', [OPERATOR[0]]), 'Ruang A');
    await expect(roomCard(page, 'Ruang A')).toContainText(`Pengawas: ${OPERATOR[0]}`);
    await expect(roomExamCard(page, examA)).toContainText('Ruang dan pengawas lengkap.');

    // A second tab of the same Operator reads the session now; its later write is stale.
    const tab = await page.context().newPage();
    await tab.bringToFront();
    await open(tab);
    await openInstitution(tab);
    await openRooms(tab, LABEL_A);

    // One student moves to "Ruang B": its coverage blocker shows; guru.e2e is typed as its Proctor.
    await saveRoom(page, await fillRoom(page, 'Ruang B', STUDENT[0]), 'Ruang B');
    await expect(roomExamCard(page, examA)).toContainText('Cakupan pengawas untuk ruangan belum lengkap.');
    await saveProctors(page, await fillProctors(page, 'Ruang B', [TEACHER[0]]), 'Ruang B');
    await expect(roomExamCard(page, examA)).toContainText('Ruang dan pengawas lengkap.');

    const stale = await fillProctors(tab, 'Ruang A', [TEACHER[0]]);
    await stale.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    await expect(stale.getByText('Penempatan ruang baru saja diubah. Muat ulang untuk melihat penempatan terbaru.')).toBeVisible();
    await expect(stale.getByRole('button', { name: 'Simpan Pengawas', exact: true })).toBeFocused();
    await stale.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(stale).toHaveCount(0);
    await tab.close();
    await page.bringToFront();

    // The Student sees "Ruang: Ruang B"; pengawas.e2e as Proctor sees the exam with "Ruang A".
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await studentContext.newPage();
    await login(student, ...STUDENT);
    await expect(student.getByText('Ruang: Ruang B', { exact: true })).toBeVisible();
    await studentContext.close();
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ruang Ujian' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Ruang A', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Ruang B', exact: true })).toHaveCount(0);
});

test('ASSESS-INSTITUTION-002 captures: the room screen, each dialog, a refusal, the READY and demotion notices, a non-editable exam', async ({ page }) => {
    test.setTimeout(25 * 60_000);
    expect(examA, 'the journey placed exam A').toBeTruthy();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);
    const main = () => page.locator('main').first();
    const dialog = () => page.getByRole('dialog');

    // Exam R with its questions and a deadline about a minute ahead, placed first so the deadline passes meanwhile.
    const LABEL_R = 'PAS Ruang E2E';
    await createPeriod(page, LABEL_R);
    await addSession(page, LABEL_R, wibDay(27));
    const examR = await placeExam(page, LABEL_R, wib(2));
    await addQuestions(examR);

    await openRooms(page, LABEL_R);
    await capture(page, 'rooms-empty', main);
    const room = await fillRoom(page, 'Ruang C');
    await capture(page, 'dialog-add-room', dialog);
    await saveRoom(page, room, 'Ruang C');
    const proctors = await fillProctors(page, 'Ruang C', [OPERATOR[0]]);
    await capture(page, 'dialog-proctors', dialog);
    await saveProctors(page, proctors, 'Ruang C');
    const refused = await fillProctors(page, 'Ruang C', ['tidak.ada.e2e']);
    await refused.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    await expect(refused.getByText('ELLIGBLE ID ini tidak ditemukan di sekolah ini: tidak.ada.e2e.')).toBeVisible();
    await capture(page, 'dialog-proctors-refused', dialog);
    // "Hapus" removes its own row: focus goes to the field.
    await refused.getByRole('button', { name: 'Hapus tidak.ada.e2e', exact: true }).click();
    await expect(refused.getByLabel('ELLIGBLE ID pengawas')).toBeFocused();
    await refused.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(refused).toHaveCount(0);
    await saveRoom(page, await fillRoom(page, 'Ruang D', STUDENT[0]), 'Ruang D');
    await expect(roomCard(page, 'Ruang D')).toContainText('Belum ada pengawas');
    await capture(page, 'rooms-mixed', main);
    await roomExamCard(page, examR).getByRole('button', { name: 'Tambah Peserta', exact: true }).click();
    await expect(dialog()).toBeVisible();
    await capture(page, 'dialog-addition', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(dialog()).toHaveCount(0);
    // Back into "Ruang C": "Ruang D" empties and disappears.
    await roomCard(page, 'Ruang C').getByRole('button', { name: 'Tempatkan Peserta', exact: true }).click();
    const back = page.getByRole('dialog', { name: 'Tempatkan Peserta di Ruang C' });
    await back.getByLabel('Tampilkan').selectOption({ label: 'Semua peserta' });
    await back.getByRole('checkbox', { name: new RegExp(`^${STUDENT[0].replace(/\./g, '\\.')}\\b`) }).check();
    await back.getByRole('button', { name: 'Tempatkan Peserta', exact: true }).click();
    await expect(notice(page, /^Peserta ditempatkan di Ruang C: 1 peserta\./)).toBeVisible();
    await expect(roomCard(page, 'Ruang D')).toHaveCount(0);

    // After R's deadline: mark ready, then a change that leaves "Ruang D" without a Proctor sends it back.
    await expect.poll(() => deadlinePassed(examR), { timeout: 150_000, intervals: [2_000] }).toBe(true);
    await backToPeriods(page);
    await reloadPage(page);
    await openPeriod(page, LABEL_R);
    await examCard(page, examR).getByRole('button', { name: 'Tandai Siap', exact: true }).click();
    await page.getByRole('dialog', { name: 'Tandai Siap?' }).getByRole('button', { name: 'Tandai Siap', exact: true }).click();
    await expect(notice(page, 'ditandai siap.')).toBeVisible();
    await openRooms(page, LABEL_R);
    const ready = await fillRoom(page, 'Ruang D', STUDENT[0]);
    await expect(ready.getByText('Ujian yang sudah ditandai siap akan diperiksa ulang. Bila belum lengkap, ujian kembali ke Terjadwal dan perlu ditandai siap lagi.')).toBeVisible();
    await capture(page, 'dialog-ready-notice', dialog);
    await saveRoom(page, ready, 'Ruang D');
    await expect(notice(page, `Ujian ${EXAM_LABEL} kembali ke Terjadwal dan perlu ditandai siap lagi.`)).toBeVisible();
    await capture(page, 'notice-demotion', main);
    await backToPeriods(page);
    await openPeriod(page, LABEL_R);
    await expect(examCard(page, examR).getByRole('button', { name: 'Perpanjang Tenggat' })).toHaveCount(0);

    // An opened exam (by fixture SQL) is shown without its room actions, then set back.
    await setLifecycle(examA, 'ACTIVE');
    try {
        await openRooms(page, LABEL_A);
        await expect(roomExamCard(page, examA)).toContainText('Ujian ini sudah dibuka, jadi ruang dan pengawasnya tidak dapat diubah di sini.');
        await expect(page.getByRole('button', { name: 'Tambah Ruang', exact: true })).toHaveCount(0);
        await capture(page, 'exam-not-editable', main);
    } finally {
        await setLifecycle(examA, 'SCHEDULED');
    }
});
