import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, saveStatus, state, wib, withDatabase } from './helpers.ts';

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
/** After phase: the same two questions as PG rows of a v2 file, plus a PGK question with long options. */
const V2_HEADER = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
const MR_PROMPT = 'Pilih semua bilangan prima';
const V2_FILE = [V2_HEADER, '1;PG;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1', `2;PG;Pilih pernyataan yang benar;${LONG} A;${LONG} B;${LONG} C;${LONG} D;${LONG} E;C;2`,
    `3;PGK;${MR_PROMPT};2 adalah bilangan prima genap satu-satunya yang ada;4;5 adalah bilangan prima ganjil terkecil setelah tiga;8;9;A,C;2`].join('\r\n') + '\r\n';
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
                        // Elements reaching past the viewport, for diagnosis of an overflow.
                        overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(node => node.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
                            .slice(0, 8).map(node => `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}.${String(node.className).slice(0, 60)}:${Math.round(node.getBoundingClientRect().width)}`),
                    };
                });
                const name = ['workspace-question', phase, scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                // Engines refuse images above 32767 device pixels: a taller page is captured at the viewport.
                const fullPage = (await page.evaluate(() => document.documentElement.scrollHeight * window.devicePixelRatio)) <= 30000;
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
                    // Soft: every scenario runs and every violation is reported; the test still fails.
                    expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow`).toBeLessThanOrEqual(metrics.clientWidth);
                    expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
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
    // Many rendered variants per surface, plus the after-phase journey.
    test.setTimeout(10 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const file = phase === 'after' ? V2_FILE : V1_FILE;
    const questionCount = phase === 'after' ? 3 : 2;
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
    await expect(page.getByRole('status').filter({ hasText: `dijadwalkan dengan ${questionCount} soal dan 1 peserta` })).toBeVisible();
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
    if (phase === 'after') {
        // Multiple response in the preview: the instruction, checkboxes and every key option.
        await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
        await expect(page.getByText(MR_PROMPT)).toBeVisible();
        await expect(page.getByText('Pilih semua jawaban yang benar.')).toBeVisible();
        await expect(page.locator('main').getByRole('checkbox')).toHaveCount(6);
        await expect(page.getByText('Kunci jawaban', { exact: true })).toHaveCount(2);
        await captureQuestionSurface(page, 'teacher-preview-mr-key', () => page.locator('main').first(), file);
    }
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
    if (phase === 'after') await multipleResponseJourney(page, student, examId, file);
    await studentContext.close();
});

/** C07: the five-browser multiple-response journey on the after phase. */
async function multipleResponseJourney(teacher: Page, student: Page, examId: string, file: string) {
    const api = (path: string, body?: Record<string, unknown>) => teacher.evaluate(async ({ path, body, tenant }) => {
        const r = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin',
            headers: { 'X-Tenant-ID': tenant, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
        return { status: r.status, body: await r.json() };
    }, { path, body, tenant: state.tenantId });
    const transition = (action: string) => api('/api/v1/assessment/teacher-exams/transition', { examInstanceId: examId, action, reason: 'Uji tipe soal', actionKey: crypto.randomUUID(), confirmed: true });
    const snapshot = await withDatabase(async client => (await client.query(
        "SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 AND frozen_content->>'questionType' = 'MULTIPLE_RESPONSE'", [examId])).rows[0]);
    const ids: string[] = snapshot.frozen_content.options.map((o: { id: string }) => o.id);
    const stored = async () => (await withDatabase(async client => (await client.query(
        'SELECT answer_payload FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshot.id])).rows[0]?.answer_payload ?? null));
    const option = (text: RegExp | string) => student.getByRole('checkbox', { name: text });
    const A = option(/^2 adalah/), B = student.getByRole('checkbox', { name: '4', exact: true }), C = option(/^5 adalah/), E = student.getByRole('checkbox', { name: '9', exact: true });
    // The native checkbox is visually hidden inside its option card: pointer input goes to the card.
    const tap = (box: Locator) => student.locator('.options-list label').filter({ has: box }).click();
    const saved = async () => { await expect(saveStatus(student)).toHaveText('Tersimpan'); };
    const progress = student.getByRole('heading', { name: /^Soal d dari 3$/ });
    // After a reload the screen may open on any question: wait for it, then step to the PGK one.
    const toMr = async () => {
        await expect(progress).toBeVisible({ timeout: 30_000 });
        for (let i = 0; i < 3 && !(await student.getByText(MR_PROMPT).isVisible()); i++) {
            const at = await progress.innerText();
            await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
            await expect(progress).not.toHaveText(at);
        }
        await expect(student.getByText(MR_PROMPT)).toBeVisible();
    };

    await toMr();
    await expect(student.getByText('Pilih semua jawaban yang benar.')).toBeVisible();
    await expect(student.locator('.options-list input[type=checkbox]')).toHaveCount(5);
    await expect(student.locator('.options-list input[type=checkbox]:checked')).toHaveCount(0);
    await captureQuestionSurface(student, 'exam-mr-empty', () => student.locator('body'), file);
    // Keyboard: Tab reaches the option, Space toggles it; then a pointer click adds another.
    await A.focus();
    await student.keyboard.press('Space');
    await expect(A).toBeChecked();
    await captureQuestionSurface(student, 'exam-mr-keyboard-focus', () => student.locator('body'), file);
    await tap(C);
    await saved();
    expect(await stored()).toEqual({ selectedOptionIds: [ids[0], ids[2]].sort() });
    await captureQuestionSurface(student, 'exam-mr-selected', () => student.locator('body'), file);

    // Offline: several toggles, then reconnect; only the final set reaches the server.
    await student.context().setOffline(true);
    await tap(B); await tap(B); await tap(E); await tap(A); await tap(A);
    await student.context().setOffline(false);
    await saved();
    expect(await stored()).toEqual({ selectedOptionIds: [ids[0], ids[2], ids[4]].sort() });

    // Reload: the set is restored from the server.
    await student.reload();
    await toMr();
    for (const box of [A, C, E]) await expect(box).toBeChecked();
    await expect(B).not.toBeChecked();

    // Clearing every option is a saved empty answer that reads "Belum dijawab" (O02-2).
    await tap(A); await tap(C); await tap(E);
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await expect.poll(stored).toEqual({ selectedOptionIds: [] });
    await captureQuestionSurface(student, 'exam-mr-cleared', () => student.locator('body'), file);
    await tap(A);
    await saved();

    // Content this version cannot show: an explicit reload state, no endless loading.
    await student.route('**/api/v1/assessment/questions**', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'question_type_unsupported' }) }));
    await student.reload();
    await expect(student.getByRole('heading', { name: 'Perlu Memuat Ulang' })).toBeVisible();
    await expect(student.getByRole('button', { name: 'Muat Ulang' })).toBeVisible();
    await captureQuestionSurface(student, 'exam-unsupported', () => student.locator('body'), file);
    await student.unroute('**/api/v1/assessment/questions**');
    await student.getByRole('button', { name: 'Muat Ulang' }).click();
    await toMr();
    await expect(A).toBeChecked();

    // Read-only while paused: no question content at all, then the exam continues.
    expect((await transition('pause')).status).toBe(200);
    await expect(student.getByText('Ujian Dijeda')).toBeVisible({ timeout: 30_000 });
    await expect(student.locator('.options-list')).toHaveCount(0);
    expect((await transition('resume')).status).toBe(200);
    await expect(student.getByText(/Soal \d dari 3/).first()).toBeVisible({ timeout: 30_000 });
    await toMr();

    // V06: submit with a save still pending; the pending choice is sent before submission.
    // The save is held at the network until the submission has started.
    let releaseSave!: () => void;
    const held = new Promise<void>(resolve => { releaseSave = resolve; });
    await student.route('**/api/v1/assessment/answer/save', async route => { await held; await route.continue(); });
    await tap(C);
    await expect(saveStatus(student)).toHaveText('Menyimpan...');
    const submitting = (async () => {
        await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
        await student.getByRole('dialog').getByRole('checkbox').check();
        await student.getByRole('button', { name: 'Kirim Jawaban Sekarang' }).click();
    })();
    await student.waitForTimeout(500);
    releaseSave();
    await submitting;
    await student.unroute('**/api/v1/assessment/answer/save');
    await expect(student.getByText('Ujian Berhasil Dikumpulkan')).toBeVisible();
    expect(await stored()).toEqual({ selectedOptionIds: [ids[0], ids[2]].sort() });

    // The teacher ends and finalizes; the exact set earns its full score under the composite rule.
    const provisional = await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    expect(provisional.body.scoring.rule).toBe('COMPOSITE_PER_ITEM_V1');
    expect((await transition('end')).status).toBe(200);
    expect((await transition('finalize')).status).toBe(200);
    const final = await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    expect(final.body.resultState).toBe('FINAL');
    const mine = final.body.participants.find((r: { elligbleId: string }) => r.elligbleId === STUDENT[0]);
    expect([mine.score.rawScore, mine.score.maxScore, mine.score.scaledScore, mine.score.correct]).toEqual([2, 5, 40, 1]);
}
