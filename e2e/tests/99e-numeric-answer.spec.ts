import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeQuestionList, login, openQuestionList, reloadPage, saveStatus, state, wib, withDatabase } from './helpers.ts';

// ASSESS-QUESTION-007 five-browser journey and rendered evidence (record §7 C06/C07). Sorts after
// 99d-ordering (Playwright orders files with localeCompare), whose exam is finalized by then, so
// siswa.e2e.06 is free; if that spec fails, this one meets a schedule conflict, as expected. The
// before-state is the exact-main CI #205 artifacts (record §10). Navigation only through the shared
// helpers (no direct page.reload or page.goto). Playwright typing bypasses the virtual keyboard.

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-QUESTION-007 capture SHA mismatch');
const BASELINE = { run: 205, commit: '42a281c52c04f5e54af37893fb7a2c56e521545c', frontendTree: '7bb15d77c23ce63bfd6611320214129b98a046f8', manifestSha256: '3aec13b32832318ad45bf5ed916c581a4003b7b387e6f00eaa4429837b0b93b4' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const FILE_NAME = 'isian-angka-e2e.csv';
const PROMPT = 'Sebuah tali sepanjang 5 meter dipotong menjadi dua bagian yang sama panjang. Berapa meter panjang setiap bagian tali itu?';
const NEGATIVE = 'Hasil dari 7 dikurangi 10 adalah';
const HEADER = ['no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',
    ...Array.from({ length: 10 }, (_, i) => `left_${i + 1}`), ...'abcdefghijkl'.split('').map(l => `right_${l}`), 'tolerance'].join(';');
const row = (head: string, tolerance = '') => [head, ...Array(22).fill(''), tolerance].join(';');
const FILE = [HEADER,
    row('1;PG;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1'),
    row(`2;IA;${PROMPT};;;;;;2,5;2`, '0,1'),
    row(`3;IA;${NEGATIVE};;;;;;-3;1`)].join('\r\n') + '\r\n';
const HINT = 'Tulis angka saja, pakai koma atau titik untuk desimal.';

const FULL = [360, 390, 430, 768, 1024, 1280, 1440].map(width => ({ width, height: 800, text: 1 })).concat([{ width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }, { width: 1280, height: 800, text: 2 }]);
const STATES = [{ width: 360, height: 800, text: 1 }, { width: 768, height: 800, text: 1 }, { width: 1280, height: 800, text: 1 }, { width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }];

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
                    node.dataset.aq7OriginalStyle = JSON.stringify(node.getAttribute('style'));
                    node.style.fontSize = String(font * 2) + 'px';
                    if (Number.isFinite(line)) node.style.lineHeight = String(line * 2) + 'px';
                }
            });
            try {
                await expect(root()).toBeVisible();
                await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); });
                const metrics = await root().evaluate(element => {
                    const targets = [...element.querySelectorAll<HTMLElement>('button, input, textarea, select')].filter(n => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0; })
                        .map(n => { const t = n instanceof HTMLInputElement && ['checkbox', 'radio'].includes(n.type) ? n.closest('label') ?? n : n; const b = t.getBoundingClientRect(); return { name: n.getAttribute('aria-label') ?? t.textContent?.trim().slice(0, 60) ?? n.tagName, width: b.width, height: b.height }; });
                    const active = document.activeElement as HTMLElement | null;
                    return {
                        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets,
                        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        focus: active ? { tag: active.tagName, type: (active as HTMLInputElement).type ?? null, label: active.getAttribute('aria-label') } : null,
                        overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(n => n.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).slice(0, 8).map(n => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 50)}`),
                    };
                });
                const name = ['workspace-question-ia', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                const fullPage = (await page.evaluate(() => document.documentElement.scrollHeight * window.devicePixelRatio)) <= 30000;
                await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
                    task: 'ASSESS-QUESTION-007', phase: 'after', commit, frontendTree, baseline: BASELINE,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256, questionsSha256: createHash('sha256').update(FILE).digest('hex') },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow`).toBeLessThanOrEqual(metrics.clientWidth);
                expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
            } finally {
                if (v.text === 2) await page.evaluate(() => {
                    for (const node of document.querySelectorAll<HTMLElement>('[data-aq7-original-style]')) {
                        const original: string | null = JSON.parse(node.dataset.aq7OriginalStyle ?? 'null');
                        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
                        delete node.dataset.aq7OriginalStyle;
                    }
                });
            }
        }
    } finally { await page.setViewportSize(original); }
}

test('ASSESS-QUESTION-007 numeric answer: import, preview, Student journey and rendered evidence', async ({ page, browser }) => {
    test.setTimeout(10 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...TEACHER);
    await page.getByRole('button', { name: 'Buat Ujian' }).first().click();
    await expect(page.getByRole('heading', { name: 'Buat Ujian dari Berkas Soal' })).toBeVisible();
    await page.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await page.getByLabel('Mulai (WIB)').fill(wib(-2));
    await page.getByLabel('Selesai (WIB)').fill(wib(90));
    await page.getByLabel('Durasi pengerjaan (menit)').fill('30');
    await page.getByRole('radio', { name: /Durasi penuh/ }).check();
    await page.getByLabel('Berkas CSV').setInputFiles({ name: FILE_NAME, mimeType: 'text/csv', buffer: Buffer.from(FILE, 'utf8') });
    await page.getByRole('button', { name: 'Periksa Soal dan Jadwal' }).click();
    const participants = page.getByRole('region', { name: /^Peserta \(/ });
    await expect(participants.getByRole('checkbox', { name: STUDENT[0], exact: true })).toBeVisible();
    for (const box of await participants.getByRole('checkbox').all()) {
        const label = (await box.evaluate(el => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).trim();
        if (label !== STUDENT[0] && await box.isChecked()) await box.uncheck();
    }
    await page.getByRole('button', { name: 'Periksa Lagi' }).click();
    await expect(page.getByText('Soal dan jadwal siap dijadwalkan')).toBeVisible();
    const items = page.getByRole('region', { name: 'Soal' });
    await expect(items.getByText('Soal 2 · Isian angka')).toBeVisible();
    await expect(items.getByText('Toleransi 0,1')).toBeVisible();
    await expect(items.getByText('Toleransi 0', { exact: true })).toBeVisible();
    await capture(page, 'import-preview', () => page.locator('main').first());

    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'dijadwalkan dengan 3 soal dan 1 peserta' })).toBeVisible();
    const examId: string = await withDatabase(async c => (await c.query('SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name = $1', [FILE_NAME])).rows[0].exam_instance_id);
    const card = page.getByTestId(`teacher-exam-${examId}`);

    await card.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText(PROMPT)).toBeVisible();
    await expect(page.getByText(/· Isian angka/)).toBeVisible();
    await page.getByLabel('Tampilkan kunci jawaban dan skor').check();
    await expect(page.getByText('2,5', { exact: true })).toBeVisible();
    await expect(page.getByText('Toleransi 0,1')).toBeVisible();
    await capture(page, 'teacher-preview-key', () => page.locator('main').first());
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();
    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await card.getByRole('button', { name: 'Buka Ujian' }).click();
    await page.getByLabel('Alasan tindakan', { exact: true }).fill('Pelaksanaan ujian terjadwal');
    await page.getByRole('dialog').getByRole('button', { name: 'Buka Ujian' }).click();
    await expect(card).toContainText('Berlangsung');

    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await context.newPage();
    let saveRequests = 0;
    student.on('request', request => { if (request.url().includes('/api/v1/assessment/answer/save')) saveRequests++; });
    await login(student, ...STUDENT);
    await student.getByTestId(`assignment-${examId}`).getByRole('button', { name: 'Mulai Ujian' }).click();
    await student.getByRole('button', { name: 'Mulai Ujian Sekarang' }).click();
    await expect(student.getByText('Hasil dari 6 x 7 adalah')).toBeVisible();

    const api = (path: string, body?: Record<string, unknown>) => page.evaluate(async ({ path, body, tenant }) => {
        const r = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Tenant-ID': tenant, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
        return { status: r.status, body: await r.json() };
    }, { path, body, tenant: state.tenantId });
    const transition = (action: string) => api('/api/v1/assessment/teacher-exams/transition', { examInstanceId: examId, action, reason: 'Uji isian angka', actionKey: crypto.randomUUID(), confirmed: true });
    const snapshotIds: string[] = await withDatabase(async c => (await c.query('SELECT id FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 ORDER BY display_order', [examId])).rows.map((r: { id: string }) => r.id));
    const stored = async (index = 1) => (await withDatabase(async c => (await c.query('SELECT answer_payload FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotIds[index]])).rows[0]?.answer_payload ?? null));
    const progress = student.getByRole('heading', { name: /^Soal \d dari 3$/ });
    const field = () => student.getByLabel('Jawaban angka');
    const hint = () => student.locator('.numeric-hint');
    const toQuestion = async (text: string) => {
        await expect(progress).toBeVisible({ timeout: 30_000 });
        for (let i = 0; i < 3 && !(await student.getByText(text).isVisible()); i++) {
            const at = await progress.innerText();
            await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
            await expect(progress).not.toHaveText(at);
        }
        await expect(student.getByText(text)).toBeVisible();
    };
    await toQuestion(PROMPT);
    await expect(field()).toHaveValue('');
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await capture(student, 'exam-ia-empty', () => student.locator('body'));

    // Keyboard: the field takes focus; typing 2,5 key by key shows no hint and saves the text as typed.
    await field().focus();
    await student.keyboard.type('2,5');
    await expect(hint()).toHaveText('');
    await expect.poll(() => stored()).toEqual({ numericText: '2,5' });
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await capture(student, 'exam-ia-keyboard-focus', () => student.locator('body'), STATES);

    // D1: invalid text is never sent; the hint shows and the save state says it is not saved.
    const before = saveRequests;
    await student.keyboard.type(' cm');
    await expect(hint()).toHaveText(HINT);
    await expect(saveStatus(student)).toHaveText('Belum tersimpan');
    await expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(saveRequests).toBe(before);
    expect(await stored()).toEqual({ numericText: '2,5' });
    await capture(student, 'exam-ia-hint', () => student.locator('body'), STATES);

    // A dot also works, saved as typed.
    await field().fill('2.6');
    await expect.poll(() => stored()).toEqual({ numericText: '2.6' });
    await expect(hint()).toHaveText('');
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    let list = await openQuestionList(student);
    await expect(list.getByRole('button', { name: 'Pindah ke soal nomor 2, status sudah dijawab' })).toBeVisible();
    await closeQuestionList(student);
    await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
    const confirm = student.getByRole('dialog');
    await expect(confirm.locator('[data-slot=metric]').filter({ hasText: 'Belum Dijawab' }).locator('dd')).toHaveText('2');
    await confirm.getByRole('button', { name: 'Batal' }).click();
    await expect(confirm).toHaveCount(0);
    await capture(student, 'exam-ia-answered', () => student.locator('body'), STATES);

    // Offline: several edits, then reconnect; only the final text reaches the server.
    await context.setOffline(true);
    await field().fill('3');
    await field().fill('2,4');
    await context.setOffline(false);
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await expect.poll(() => stored()).toEqual({ numericText: '2,4' });

    // Reload through the shared helper: the text is restored exactly as typed.
    await reloadPage(student);
    await toQuestion(PROMPT);
    await expect(field()).toHaveValue('2,4');

    // A negative value on question 3; clearing question 2 is a saved empty answer.
    await toQuestion(NEGATIVE);
    await field().fill('-3');
    await expect.poll(() => stored(2)).toEqual({ numericText: '-3' });
    await student.getByRole('button', { name: 'Soal Sebelumnya' }).click();
    await expect(student.getByText(PROMPT)).toBeVisible();
    await field().fill('');
    await expect.poll(() => stored()).toEqual({ numericText: '' });
    await expect(saveStatus(student)).toHaveText('Belum dijawab');

    // Read-only while paused: no question content, then the exam continues.
    expect((await transition('pause')).status).toBe(200);
    await expect(student.getByRole('heading', { name: 'Ujian Dijeda' })).toBeVisible({ timeout: 30_000 });
    await expect(student.locator('.numeric-answer')).toHaveCount(0);
    expect((await transition('resume')).status).toBe(200);
    await toQuestion(PROMPT);

    // V06: the answer is held at the network; submission waits for it.
    let releaseSave!: () => void;
    const held = new Promise<void>(resolve => { releaseSave = resolve; });
    await student.route('**/api/v1/assessment/answer/save', async route => { await held; await route.continue(); });
    await field().fill('2,5');
    await expect(saveStatus(student)).toHaveText('Menyimpan...');
    const submitting = (async () => {
        await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
        await student.getByRole('dialog').getByRole('checkbox').check();
        await student.getByRole('button', { name: 'Kirim Jawaban Sekarang' }).click();
    })();
    await expect(student.getByRole('button', { name: 'Selesaikan Ujian' })).toBeDisabled();
    releaseSave();
    await submitting;
    await student.unroute('**/api/v1/assessment/answer/save');
    await expect(student.getByText('Ujian Berhasil Dikumpulkan')).toBeVisible();
    expect(await stored()).toEqual({ numericText: '2,5' });

    // The teacher ends and finalizes: 2,5 (2) and -3 (1) earn 3 of 4 (75) under the composite rule.
    expect((await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`)).body.scoring.rule).toBe('COMPOSITE_PER_ITEM_V1');
    expect((await transition('end')).status).toBe(200);
    expect((await transition('finalize')).status).toBe(200);
    const final = await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    expect(final.body.resultState).toBe('FINAL');
    const mine = final.body.participants.find((r: { elligbleId: string }) => r.elligbleId === STUDENT[0]);
    expect([mine.score.rawScore, mine.score.maxScore, mine.score.scaledScore, mine.score.correct, mine.score.unanswered]).toEqual([3, 4, 75, 2, 1]);
    await context.close();
});
