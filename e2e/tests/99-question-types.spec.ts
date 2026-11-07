import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, wib, withDatabase } from './helpers.ts';

// ASSESS-QUESTION-002 rendered evidence and journey (record §4A.7/§7 C07/C08). The same
// capture routine runs on the capture-only baseline (phase "before": v1 content on the
// unchanged application) and on the implementation (phase "after"). Named 99- so that it
// runs after every other spec (Playwright orders files with localeCompare): the earlier
// specs count exams, batches and attempts globally. Only siswa.e2e.06 takes part, because
// the other students are expected in an earlier spec's exam at an overlapping time.

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const BASE_COMMIT = '8ade3ae4316a2839d91311be2037e8bfbb8c745f';
const BASE_FRONTEND_TREE = '95c0845383daa6b10a753c1aa7201504486ce507';
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
const phase: 'before' | 'after' = frontendTree === BASE_FRONTEND_TREE ? 'before' : 'after';
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-QUESTION-002 capture SHA mismatch');
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const V1_HEADER = 'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
const LONG = 'Pernyataan panjang tentang sifat bilangan yang membutuhkan beberapa baris di layar sempit agar terbaca utuh tanpa terpotong';
/** Baseline file: v1 single choice only, one question with long option text. */
const V1_FILE = [V1_HEADER, '1;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1', `2;Pilih pernyataan yang benar;${LONG} A;${LONG} B;${LONG} C;${LONG} D;${LONG} E;C;2`].join('\r\n') + '\r\n';
const FILE_NAME = 'tipe-soal-e2e.csv';

const WIDTHS = [360, 390, 430, 768, 1024, 1280, 1440];

async function settle(page: Page) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
}

/** One screenshot/JSON pair per variant; layout gates are enforced in the after phase only. */
async function captureQuestionSurface(page: Page, scenario: string, root: () => Locator, fixture: string): Promise<void> {
    const original = page.viewportSize();
    const browser = page.context().browser();
    if (!original || !browser) throw new Error('A real browser and viewport are required');
    const variants = [
        ...WIDTHS.map(width => ({ width, height: 800, text: 1 })),
        { width: 640, height: 360, text: 1 },
        { width: 390, height: 844, text: 2 },
        { width: 1280, height: 800, text: 2 },
    ];
    try {
        for (const v of variants) {
            await page.setViewportSize({ width: v.width, height: v.height });
            // 200 % text: every element's computed font size and line height doubled (as spec 6), so
            // px-sized text scales too; restored afterwards.
            if (v.text === 2) await page.evaluate(() => {
                for (const node of [document.documentElement, ...document.querySelectorAll<HTMLElement>('body *')]) {
                    if (!(node instanceof HTMLElement)) continue;
                    const style = getComputedStyle(node), font = parseFloat(style.fontSize), line = parseFloat(style.lineHeight);
                    node.dataset.aq2OriginalStyle = JSON.stringify(node.getAttribute('style'));
                    node.style.fontSize = String(font * 2) + 'px';
                    if (Number.isFinite(line)) node.style.lineHeight = String(line * 2) + 'px';
                }
            });
            try {
                await expect(root()).toBeVisible();
                await settle(page);
                const metrics = await root().evaluate(element => {
                    const targets = [...element.querySelectorAll<HTMLElement>('button, input, textarea, select')].filter(node => {
                        const b = node.getBoundingClientRect(); return b.width > 0 && b.height > 0;
                    }).map(node => {
                        const target = node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type) ? node.closest('label') ?? node : node;
                        const box = target.getBoundingClientRect();
                        return { name: node.getAttribute('aria-label') ?? target.textContent?.trim().slice(0, 60) ?? node.tagName, width: box.width, height: box.height };
                    });
                    const active = document.activeElement as HTMLElement | null;
                    return {
                        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets,
                        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        focus: active ? { tag: active.tagName, type: (active as HTMLInputElement).type ?? null, outline: getComputedStyle(active).outlineStyle } : null,
                        checkboxes: element.querySelectorAll('input[type=checkbox]').length, radios: element.querySelectorAll('input[type=radio]').length,
                    };
                });
                const name = ['workspace-question', phase, scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                // Engines refuse images above 32767 px: a taller page is captured at the viewport.
                const fullPage = (await page.evaluate(() => document.documentElement.scrollHeight)) <= 30000;
                await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
                    task: 'ASSESS-QUESTION-002', phase, commit, baseline: { commit: BASE_COMMIT, frontendTree: BASE_FRONTEND_TREE }, frontendTree,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256, questionsSha256: createHash('sha256').update(fixture).digest('hex') },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, textScaleMethod: 'computed font-size and line-height doubled per element', scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                if (phase === 'after') {
                    expect(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow`).toBeLessThanOrEqual(metrics.clientWidth);
                    expect(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario}: targets below 44 px`).toEqual([]);
                }
            } finally {
                if (v.text === 2) await page.evaluate(() => {
                    for (const node of document.querySelectorAll<HTMLElement>('[data-aq2-original-style]')) {
                        const original: string | null = JSON.parse(node.dataset.aq2OriginalStyle ?? 'null');
                        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
                        delete node.dataset.aq2OriginalStyle;
                    }
                });
            }
        }
    } finally {
        await page.setViewportSize(original);
    }
}

test('ASSESS-QUESTION-002 question surfaces: import preview, teacher preview and the exam screen', async ({ page, browser }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const file = V1_FILE;
    await login(page, ...TEACHER);
    await page.getByRole('button', { name: 'Buat Ujian' }).first().click();
    await expect(page.getByRole('heading', { name: 'Buat Ujian dari Berkas Soal' })).toBeVisible();
    await page.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await page.getByLabel('Mulai (WIB)').fill(wib(-2));
    await page.getByLabel('Selesai (WIB)').fill(wib(90));
    await page.getByLabel('Durasi pengerjaan (menit)').fill('30');
    await page.getByRole('radio', { name: /Durasi penuh/ }).check();
    await page.getByLabel('Berkas CSV').setInputFiles({ name: FILE_NAME, mimeType: 'text/csv', buffer: Buffer.from(file, 'utf8') });
    await page.getByRole('button', { name: 'Periksa Soal dan Jadwal' }).click();
    // Earlier specs leave the other class members expected in an overlapping exam (and spec 9
    // adds a claimed student): keep siswa.e2e.06 only, then check again.
    const participants = page.getByRole('region', { name: /^Peserta \(/ });
    await expect(participants.getByRole('checkbox', { name: STUDENT[0], exact: true })).toBeVisible();
    for (const box of await participants.getByRole('checkbox').all()) {
        if ((await box.getAttribute('aria-label') ?? await box.evaluate(el => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).trim() !== STUDENT[0] && await box.isChecked()) await box.uncheck();
    }
    await expect(participants.getByRole('checkbox', { name: STUDENT[0], exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Periksa Lagi' }).click();
    await expect(page.getByText('Soal dan jadwal siap dijadwalkan')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Peserta \(1 dari \d+\)$/ })).toBeVisible();
    await captureQuestionSurface(page, 'import-preview', () => page.locator('main').first(), file);

    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'dijadwalkan dengan 2 soal dan 1 peserta' })).toBeVisible();
    const examId: string = await withDatabase(async client => (await client.query(
        'SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name = $1', [FILE_NAME])).rows[0].exam_instance_id);
    const card = page.getByTestId(`teacher-exam-${examId}`);

    await card.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await expect(page.getByRole('heading', { name: 'Pratinjau Soal' })).toBeVisible();
    await expect(page.getByText('Hasil dari 6 x 7 adalah')).toBeVisible();
    await captureQuestionSurface(page, 'teacher-preview-single', () => page.locator('main').first(), file);
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Pilih pernyataan yang benar')).toBeVisible();
    await page.getByLabel('Tampilkan kunci jawaban dan skor').check();
    await captureQuestionSurface(page, 'teacher-preview-second-key', () => page.locator('main').first(), file);
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(card).toContainText('Siap Dibuka');
    await card.getByRole('button', { name: 'Buka Ujian' }).click();
    await page.getByLabel('Alasan tindakan', { exact: true }).fill('Pelaksanaan ujian terjadwal');
    await page.getByRole('dialog').getByRole('button', { name: 'Buka Ujian' }).click();
    await expect(card).toContainText('Berlangsung');

    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await studentContext.newPage();
    await login(student, ...STUDENT);
    const assignment = student.getByTestId(`assignment-${examId}`);
    await assignment.getByRole('button', { name: 'Mulai Ujian' }).click();
    await student.getByRole('button', { name: 'Mulai Ujian Sekarang' }).click();
    await expect(student.getByText('Hasil dari 6 x 7 adalah')).toBeVisible();
    await captureQuestionSurface(student, 'exam-single', () => student.locator('body'), file);
    await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(student.getByText('Pilih pernyataan yang benar')).toBeVisible();
    await captureQuestionSurface(student, 'exam-second', () => student.locator('body'), file);
    await studentContext.close();
});
