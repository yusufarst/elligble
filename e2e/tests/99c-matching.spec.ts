import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, reloadPage, saveStatus, state, wib, withDatabase } from './helpers.ts';

// ASSESS-QUESTION-004 five-browser journey and rendered evidence (record §4A/§7 C06/C07).
// Sorts after 99b-true-false (Playwright orders files with localeCompare), whose exam is
// finalized by then, so siswa.e2e.06 is free; if that spec fails, this one meets a schedule
// conflict, as expected. The before-state is the exact-main CI #191 artifacts (record §10).
// Navigation only through the shared helpers (no direct page.reload or page.goto, §4A.6).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-QUESTION-004 capture SHA mismatch');
const BASELINE = { run: 191, commit: 'e5d0b3f6aaa47ef4a36704f1526d26a02a28b216', frontendTree: '2042eeb3f48c6f6e40944307083fc74975727a74', manifestSha256: '304af80bd6a1990a52e32690fecbe3884570ea1aed2b17241175b0116d88394b' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const FILE_NAME = 'menjodohkan-e2e.csv';
const PROMPT = 'Pasangkan setiap hewan dengan makanan utamanya';
const LEFT = ['Sapi perah yang dipelihara peternak di dataran tinggi untuk diambil susunya setiap pagi dan sore', 'Kucing', 'Kelinci'];
const RIGHT = ['Wortel', 'Rumput gajah segar yang dipotong dari ladang di sekitar kandang setiap pagi', 'Ikan', 'Biji jagung'];
const ITEM_HEADER = [...Array.from({ length: 10 }, (_, i) => `left_${i + 1}`), ...'abcdefghijkl'.split('').map(l => `right_${l}`)];
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
const FILE = [['no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score', ...ITEM_HEADER].join(';'),
    ['1;PG;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1', ...pad([], 22)].join(';'),
    [`2;MJ;${PROMPT};;;;;;B,C,A;3`, ...pad(LEFT, 10), ...pad(RIGHT, 12)].join(';')].join('\r\n') + '\r\n';

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
                    node.dataset.aq4OriginalStyle = JSON.stringify(node.getAttribute('style'));
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
                const name = ['workspace-question-mj', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                const fullPage = (await page.evaluate(() => document.documentElement.scrollHeight * window.devicePixelRatio)) <= 30000;
                await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
                    task: 'ASSESS-QUESTION-004', phase: 'after', commit, frontendTree, baseline: BASELINE,
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
                    for (const node of document.querySelectorAll<HTMLElement>('[data-aq4-original-style]')) {
                        const original: string | null = JSON.parse(node.dataset.aq4OriginalStyle ?? 'null');
                        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
                        delete node.dataset.aq4OriginalStyle;
                    }
                });
            }
        }
    } finally { await page.setViewportSize(original); }
}

test('ASSESS-QUESTION-004 matching: import, preview, Student journey and rendered evidence', async ({ page, browser }) => {
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
    await expect(items.getByText('Soal 2 · Menjodohkan')).toBeVisible();
    await expect(items.getByText('Pasangan kanan')).toBeVisible();
    await expect(items.getByText('Kunci jawaban', { exact: true })).toHaveCount(4);
    await capture(page, 'import-preview', () => page.locator('main').first());

    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'dijadwalkan dengan 2 soal dan 1 peserta' })).toBeVisible();
    const examId: string = await withDatabase(async c => (await c.query('SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name = $1', [FILE_NAME])).rows[0].exam_instance_id);
    const card = page.getByTestId(`teacher-exam-${examId}`);

    await card.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText(PROMPT)).toBeVisible();
    await expect(page.getByText(/· Menjodohkan/)).toBeVisible();
    await page.getByLabel('Tampilkan kunci jawaban dan skor').check();
    const key = page.getByRole('region', { name: 'Kunci jawaban' });
    await expect(key.getByRole('listitem')).toHaveText([`1. ${LEFT[0]}B. ${RIGHT[1]}`, '2. KucingC. Ikan', '3. KelinciA. Wortel']);
    await capture(page, 'teacher-preview-key', () => page.locator('main').first());
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();
    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await card.getByRole('button', { name: 'Buka Ujian' }).click();
    await page.getByLabel('Alasan tindakan', { exact: true }).fill('Pelaksanaan ujian terjadwal');
    await page.getByRole('dialog').getByRole('button', { name: 'Buka Ujian' }).click();
    await expect(card).toContainText('Berlangsung');

    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await context.newPage();
    await login(student, ...STUDENT);
    await student.getByTestId(`assignment-${examId}`).getByRole('button', { name: 'Mulai Ujian' }).click();
    await student.getByRole('button', { name: 'Mulai Ujian Sekarang' }).click();
    await expect(student.getByText('Hasil dari 6 x 7 adalah')).toBeVisible();

    const api = (path: string, body?: Record<string, unknown>) => page.evaluate(async ({ path, body, tenant }) => {
        const r = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Tenant-ID': tenant, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
        return { status: r.status, body: await r.json() };
    }, { path, body, tenant: state.tenantId });
    const transition = (action: string) => api('/api/v1/assessment/teacher-exams/transition', { examInstanceId: examId, action, reason: 'Uji menjodohkan', actionKey: crypto.randomUUID(), confirmed: true });
    const snapshot = await withDatabase(async c => (await c.query('SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 AND display_order = 2', [examId])).rows[0]);
    const snapshotId: string = snapshot.id;
    const L: string[] = snapshot.frozen_content.leftItems.map((i: { id: string }) => i.id);
    const R: string[] = snapshot.frozen_content.rightItems.map((i: { id: string }) => i.id);
    // The stored pairs as [left index, right index], in left order: comparable whatever the ids.
    const stored = async () => {
        const payload = await withDatabase(async c => (await c.query('SELECT answer_payload FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotId])).rows[0]?.answer_payload ?? null);
        return payload && (payload.pairs as Array<{ leftId: string; rightId: string }>).map(p => [L.indexOf(p.leftId), R.indexOf(p.rightId)]).sort((a, b) => a[0] - b[0]);
    };
    const progress = student.getByRole('heading', { name: /^Soal \d dari 2$/ });
    const select = (n: number) => student.getByRole('combobox', { name: `Pasangan untuk pernyataan ${n}` });
    const status = () => student.locator('.matching-status');
    const toMatching = async () => {
        await expect(progress).toBeVisible({ timeout: 30_000 });
        for (let i = 0; i < 2 && !(await student.getByText(PROMPT).isVisible()); i++) {
            const at = await progress.innerText();
            await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
            await expect(progress).not.toHaveText(at);
        }
        await expect(student.getByText(PROMPT)).toBeVisible();
    };
    await toMatching();
    await expect(student.getByRole('combobox')).toHaveCount(3);
    for (const n of [1, 2, 3]) await expect(select(n)).toHaveValue('');
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await capture(student, 'exam-mj-empty', () => student.locator('body'));

    // Keyboard: the select takes focus and the arrow key chooses the first right item (A).
    await select(1).focus();
    await student.keyboard.press('ArrowDown');
    await expect(select(1)).toHaveValue(R[0]);
    await capture(student, 'exam-mj-keyboard-focus', () => student.locator('body'), STATES);
    await student.keyboard.press('Tab');
    await expect.poll(stored).toEqual([[0, 0]]);
    // Incomplete (Owner D1): saved, but not answered; the control says how far it is.
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await expect(status()).toHaveText('Belum lengkap: 1 dari 3 pernyataan dipasangkan.');
    await expect(student.getByRole('button', { name: 'Pindah ke soal nomor 2, status belum dijawab' }).first()).toBeAttached();
    await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
    const confirm = student.getByRole('dialog');
    await expect(confirm.locator('[data-slot=metric]').filter({ hasText: 'Belum Dijawab' }).locator('dd')).toHaveText('2');
    await confirm.getByRole('button', { name: 'Batal' }).click();
    await expect(confirm).toHaveCount(0);
    await capture(student, 'exam-mj-partial', () => student.locator('body'), STATES);

    // Pointer: one to one, so the used right item is disabled for the others; swapping means
    // unpairing first (§4A.6 N9). "Pointer" input on a native select is selectOption.
    await select(2).selectOption(R[2]);
    await expect(select(3).locator(`option[value="${R[0]}"]`)).toBeDisabled();
    await expect(select(3).locator(`option[value="${R[0]}"]`)).toHaveText('A. Wortel (sudah dipakai)');
    await select(1).selectOption({ label: 'Pilih pasangan' });
    await select(3).selectOption(R[0]);
    await select(1).selectOption(R[1]);
    await expect.poll(stored).toEqual([[0, 1], [1, 2], [2, 0]]);
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await expect(status()).toHaveText('Semua pernyataan sudah dipasangkan.');
    await capture(student, 'exam-mj-complete', () => student.locator('body'), STATES);

    // Offline: several changes, then reconnect; only the final pairs reach the server.
    await context.setOffline(true);
    await select(2).selectOption({ label: 'Pilih pasangan' });
    await select(2).selectOption(R[3]);
    await select(2).selectOption(R[2]);
    await context.setOffline(false);
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await expect.poll(stored).toEqual([[0, 1], [1, 2], [2, 0]]);

    // Reload through the shared helper: the pairs are restored from the server.
    await reloadPage(student);
    await toMatching();
    await expect(select(1)).toHaveValue(R[1]);
    await expect(select(2)).toHaveValue(R[2]);
    await expect(select(3)).toHaveValue(R[0]);

    // Unpairing every item is a saved empty answer that reads "Belum dijawab" (O02-2).
    for (const n of [1, 2, 3]) await select(n).selectOption({ label: 'Pilih pasangan' });
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await expect.poll(stored).toEqual([]);
    await expect(status()).toHaveText('');
    await select(1).selectOption(R[1]);
    await select(3).selectOption(R[0]);
    await expect.poll(stored).toEqual([[0, 1], [2, 0]]);

    // Read-only while paused: no question content, then the exam continues.
    expect((await transition('pause')).status).toBe(200);
    await expect(student.getByRole('heading', { name: 'Ujian Dijeda' })).toBeVisible({ timeout: 30_000 });
    await expect(student.locator('.matching-answer')).toHaveCount(0);
    expect((await transition('resume')).status).toBe(200);
    await toMatching();

    // V06: the completing pair is held at the network; submission waits for it.
    let releaseSave!: () => void;
    const held = new Promise<void>(resolve => { releaseSave = resolve; });
    await student.route('**/api/v1/assessment/answer/save', async route => { await held; await route.continue(); });
    await select(2).selectOption(R[2]);
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
    expect(await stored()).toEqual([[0, 1], [1, 2], [2, 0]]);

    // The teacher ends and finalizes: the exact pairs earn 3 of 4 (75) under the composite rule.
    expect((await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`)).body.scoring.rule).toBe('COMPOSITE_PER_ITEM_V1');
    expect((await transition('end')).status).toBe(200);
    expect((await transition('finalize')).status).toBe(200);
    const final = await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    expect(final.body.resultState).toBe('FINAL');
    const mine = final.body.participants.find((r: { elligbleId: string }) => r.elligbleId === STUDENT[0]);
    expect([mine.score.rawScore, mine.score.maxScore, mine.score.scaledScore, mine.score.correct, mine.score.unanswered]).toEqual([3, 4, 75, 1, 1]);
    await context.close();
});
