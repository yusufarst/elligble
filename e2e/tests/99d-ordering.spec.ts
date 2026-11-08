import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeQuestionList, login, openQuestionList, reloadPage, saveStatus, state, wib, withDatabase } from './helpers.ts';

// ASSESS-QUESTION-005 five-browser journey and rendered evidence (record §4A/§7 C06/C07).
// Sorts after 99c-matching (Playwright orders files with localeCompare), whose exam is
// finalized by then, so siswa.e2e.06 is free; if that spec fails, this one meets a schedule
// conflict, as expected. The before-state is the exact-main CI #199 artifacts (record §10).
// Navigation only through the shared helpers (no direct page.reload or page.goto).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-QUESTION-005 capture SHA mismatch');
const BASELINE = { run: 199, commit: '01d58bb86a7575cbd83880a883ab324333ef4491', frontendTree: '6019c22ba7eba9d7911ac029def08f8a07116bad', manifestSha256: 'bdfa14b149e6e3a2ac4ea6f76ea39fc0d8ecdacc0f8b6359350b1874030963e5' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const FILE_NAME = 'mengurutkan-e2e.csv';
const PROMPT = 'Urutkan langkah menanam biji di dalam pot';
const ITEMS = ['Siram tanah di dalam pot setiap pagi dan sore sampai tanahnya lembap, tetapi jangan sampai airnya menggenang di dasar pot',
    'Siapkan pot berisi tanah gembur', 'Tanam biji di tengah pot', 'Tunggu sampai tunas muncul'];
const ITEM_HEADER = [...Array.from({ length: 10 }, (_, i) => `left_${i + 1}`), ...'abcdefghijkl'.split('').map(l => `right_${l}`)];
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
const FILE = [['no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score', ...ITEM_HEADER].join(';'),
    ['1;PG;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1', ...pad([], 22)].join(';'),
    [`2;UR;${PROMPT};;;;;;2,3,1,4;2`, ...pad(ITEMS, 10), ...pad([], 12)].join(';'),
    ['3;UR;Urutkan bilangan dari yang terkecil;;;;;;1,2;1', ...pad(['Dua', 'Lima'], 10), ...pad([], 12)].join(';')].join('\r\n') + '\r\n';

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
                    node.dataset.aq5OriginalStyle = JSON.stringify(node.getAttribute('style'));
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
                const name = ['workspace-question-ur', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                const fullPage = (await page.evaluate(() => document.documentElement.scrollHeight * window.devicePixelRatio)) <= 30000;
                await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
                    task: 'ASSESS-QUESTION-005', phase: 'after', commit, frontendTree, baseline: BASELINE,
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
                    for (const node of document.querySelectorAll<HTMLElement>('[data-aq5-original-style]')) {
                        const original: string | null = JSON.parse(node.dataset.aq5OriginalStyle ?? 'null');
                        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
                        delete node.dataset.aq5OriginalStyle;
                    }
                });
            }
        }
    } finally { await page.setViewportSize(original); }
}

test('ASSESS-QUESTION-005 ordering: import, preview, Student journey and rendered evidence', async ({ page, browser }) => {
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
    await expect(items.getByText('Soal 2 · Mengurutkan')).toBeVisible();
    await expect(items.getByText('Soal 3 · Mengurutkan')).toBeVisible();
    // Question 3's key equals the authored order: a notice, not a problem (§4A.2).
    await expect(items.getByText(/Kunci jawaban sama dengan urutan penulisan/)).toHaveCount(1);
    await capture(page, 'import-preview', () => page.locator('main').first());

    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'dijadwalkan dengan 3 soal dan 1 peserta' })).toBeVisible();
    const examId: string = await withDatabase(async c => (await c.query('SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name = $1', [FILE_NAME])).rows[0].exam_instance_id);
    const card = page.getByTestId(`teacher-exam-${examId}`);

    await card.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText(PROMPT)).toBeVisible();
    await expect(page.getByText(/· Mengurutkan/)).toBeVisible();
    await page.getByLabel('Tampilkan kunci jawaban dan skor').check();
    const key = page.getByRole('region', { name: 'Kunci jawaban' });
    await expect(key.getByRole('listitem')).toHaveText([`1.${ITEMS[1]}`, `2.${ITEMS[2]}`, `3.${ITEMS[0]}`, `4.${ITEMS[3]}`]);
    await capture(page, 'teacher-preview-key', () => page.locator('main').first());
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();
    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await card.getByRole('button', { name: 'Buka Ujian' }).click();
    await page.getByLabel('Alasan tindakan', { exact: true }).fill('Pelaksanaan ujian terjadwal');
    await page.getByRole('dialog').getByRole('button', { name: 'Buka Ujian' }).click();
    await expect(card).toContainText('Berlangsung');

    // "Touch" is pointer clicks in this context (§4A.4 item 10); no hasTouch context is added.
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
    const transition = (action: string) => api('/api/v1/assessment/teacher-exams/transition', { examInstanceId: examId, action, reason: 'Uji mengurutkan', actionKey: crypto.randomUUID(), confirmed: true });
    const snapshot = await withDatabase(async c => (await c.query('SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 AND display_order = 2', [examId])).rows[0]);
    const snapshotId: string = snapshot.id;
    const I: string[] = snapshot.frozen_content.items.map((i: { id: string }) => i.id);
    // The stored order as authored item indexes, comparable whatever the ids.
    const stored = async () => {
        const payload = await withDatabase(async c => (await c.query('SELECT answer_payload FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotId])).rows[0]?.answer_payload ?? null);
        return payload && (payload.orderedItemIds as string[]).map(id => I.indexOf(id));
    };
    const progress = student.getByRole('heading', { name: /^Soal \d dari 3$/ });
    const button = (name: string) => student.getByRole('button', { name, exact: true });
    const shown = () => student.locator('.ordering-row .option-text').allInnerTexts();
    const toOrdering = async () => {
        await expect(progress).toBeVisible({ timeout: 30_000 });
        for (let i = 0; i < 3 && !(await student.getByText(PROMPT).isVisible()); i++) {
            const at = await progress.innerText();
            await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
            await expect(progress).not.toHaveText(at);
        }
        await expect(student.getByText(PROMPT)).toBeVisible();
    };
    await toOrdering();
    // Untouched: the authored order is shown, and it is not an answer (E2).
    expect(await shown()).toEqual(ITEMS);
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await expect(button('Naikkan item 1')).toBeDisabled();
    await expect(button('Turunkan item 4')).toBeDisabled();
    let list = await openQuestionList(student);
    await expect(list.getByRole('button', { name: 'Pindah ke soal nomor 2, status belum dijawab' })).toBeVisible();
    await closeQuestionList(student);
    await capture(student, 'exam-ur-untouched', () => student.locator('body'));

    // Keyboard: the moved item keeps focus; at the end of the list focus goes to its other button.
    await button('Turunkan item 1').focus();
    await student.keyboard.press('Enter');
    await expect(button('Turunkan item 2')).toBeFocused();
    await capture(student, 'exam-ur-keyboard-focus', () => student.locator('body'), STATES);
    await student.keyboard.press('Enter');
    await expect(button('Turunkan item 3')).toBeFocused();
    await student.keyboard.press('Enter');
    await expect(button('Naikkan item 4')).toBeFocused();
    await expect.poll(stored).toEqual([1, 2, 3, 0]);
    await expect(student.locator('.ordering-status')).toHaveText(`${ITEMS[0]} dipindah ke urutan 4.`);
    // Pointer: the same item, two moves in a row through its button at the new position.
    await button('Naikkan item 4').click();
    await expect(button('Naikkan item 3')).toBeFocused();
    expect(await shown()).toEqual([ITEMS[1], ITEMS[2], ITEMS[0], ITEMS[3]]);
    await expect.poll(stored).toEqual([1, 2, 0, 3]);
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    list = await openQuestionList(student);
    await expect(list.getByRole('button', { name: 'Pindah ke soal nomor 2, status sudah dijawab' })).toBeVisible();
    await closeQuestionList(student);
    await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
    const confirm = student.getByRole('dialog');
    await expect(confirm.locator('[data-slot=metric]').filter({ hasText: 'Belum Dijawab' }).locator('dd')).toHaveText('2');
    await confirm.getByRole('button', { name: 'Batal' }).click();
    await expect(confirm).toHaveCount(0);
    await capture(student, 'exam-ur-answered', () => student.locator('body'), STATES);

    // Offline: several moves, then reconnect; only the final order reaches the server.
    await context.setOffline(true);
    await button('Naikkan item 2').click();
    await button('Turunkan item 1').click();
    await context.setOffline(false);
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await expect.poll(stored).toEqual([1, 2, 0, 3]);

    // Reload through the shared helper: the order is restored from the server.
    await reloadPage(student);
    await toOrdering();
    expect(await shown()).toEqual([ITEMS[1], ITEMS[2], ITEMS[0], ITEMS[3]]);

    // Clear: an empty answer, the authored order again, focus on "Gunakan urutan ini"; keeping it saves the shown order.
    await button('Kosongkan jawaban').click();
    await expect(button('Gunakan urutan ini')).toBeFocused();
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await expect.poll(stored).toEqual([]);
    expect(await shown()).toEqual(ITEMS);
    await button('Gunakan urutan ini').click();
    await expect(button('Kosongkan jawaban')).toBeFocused();
    await expect.poll(stored).toEqual([0, 1, 2, 3]);
    await button('Turunkan item 1').click();
    await expect.poll(stored).toEqual([1, 0, 2, 3]);

    // Read-only while paused: no question content, then the exam continues.
    expect((await transition('pause')).status).toBe(200);
    await expect(student.getByRole('heading', { name: 'Ujian Dijeda' })).toBeVisible({ timeout: 30_000 });
    await expect(student.locator('.ordering-answer')).toHaveCount(0);
    expect((await transition('resume')).status).toBe(200);
    await toOrdering();

    // V06: the completing move is held at the network; submission waits for it.
    let releaseSave!: () => void;
    const held = new Promise<void>(resolve => { releaseSave = resolve; });
    await student.route('**/api/v1/assessment/answer/save', async route => { await held; await route.continue(); });
    await button('Turunkan item 2').click();
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
    expect(await stored()).toEqual([1, 2, 0, 3]);

    // The teacher ends and finalizes: the exact order earns 2 of 4 (50) under the composite rule.
    expect((await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`)).body.scoring.rule).toBe('COMPOSITE_PER_ITEM_V1');
    expect((await transition('end')).status).toBe(200);
    expect((await transition('finalize')).status).toBe(200);
    const final = await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    expect(final.body.resultState).toBe('FINAL');
    const mine = final.body.participants.find((r: { elligbleId: string }) => r.elligbleId === STUDENT[0]);
    expect([mine.score.rawScore, mine.score.maxScore, mine.score.scaledScore, mine.score.correct, mine.score.unanswered]).toEqual([2, 4, 50, 1, 2]);
    await context.close();
});
