import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeQuestionList, login, openQuestionList, reloadPage, saveStatus, state, wib, withDatabase } from './helpers.ts';

// ASSESS-QUESTION-008 five-browser journey and rendered evidence (record §7 C06/C07). Sorts after
// 99e-numeric-answer (Playwright orders files with localeCompare), whose exam is finalized by then,
// so siswa.e2e.06 is free; if that spec fails, this one meets a schedule conflict, as expected. The
// before-state is the exact-main CI #209 artifacts (record §10). Navigation only through the shared
// helpers (no direct page.reload or page.goto). A browser textarea normalizes line breaks to LF,
// so CRLF fidelity is proved at the API level (C03), not here.

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-QUESTION-008 capture SHA mismatch');
const BASELINE = { run: 209, commit: '7e5141c3676733db34c9320592486d49d33d12b2', frontendTree: 'f4f6eb58943f318b4288474e84771999fa94404a', manifestSha256: '5f3c3c6b42f8c95efc9e83b2bfe352442e53f41d9a45c866cee5075af986418d' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const FILE_NAME = 'esai-e2e.csv';
const PROMPT = 'Jelaskan proses fotosintesis pada tumbuhan hijau dengan kata-katamu sendiri.';
const RUBRIC = 'Sebutkan bahan (air, karbon dioksida), tempat (daun, klorofil) dan hasilnya (gula, oksigen).';
const HEADER = ['no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',
    ...Array.from({ length: 10 }, (_, i) => `left_${i + 1}`), ...'abcdefghijkl'.split('').map(l => `right_${l}`), 'tolerance', 'rubric'].join(';');
const row = (head: string, rubric = '') => [head, ...Array(23).fill(''), rubric].join(';');
const FILE = [HEADER,
    row('1;PG;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1'),
    row(`2;ES;${PROMPT};;;;;;;5`, RUBRIC)].join('\r\n') + '\r\n';
const FIRST = 'Tumbuhan memakai cahaya matahari.\nHasilnya gula dan oksigen.';
const FINAL = [
    'Fotosintesis terjadi di daun, tepatnya di klorofil, dengan bantuan cahaya matahari.',
    'Bahannya adalah air yang diserap akar dan karbon dioksida dari udara.',
    '\tHasilnya gula sebagai makanan tumbuhan dan oksigen yang dilepaskan ke udara.',
    'Kata panjang tanpa spasi: fotosintesisfotosintesisfotosintesisfotosintesisfotosintesis.',
].join('\n');
const TOO_LONG = 'Jawaban melebihi 5.000 karakter, sehingga belum tersimpan.';
const REFUSED = 'Masih ada 1 jawaban esai yang belum dinilai. Nilai semua esai sebelum finalisasi hasil.';

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
                    node.dataset.aq8OriginalStyle = JSON.stringify(node.getAttribute('style'));
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
                const name = ['workspace-question-es', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                const fullPage = (await page.evaluate(() => document.documentElement.scrollHeight * window.devicePixelRatio)) <= 30000;
                await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
                    task: 'ASSESS-QUESTION-008', phase: 'after', commit, frontendTree, baseline: BASELINE,
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
                    for (const node of document.querySelectorAll<HTMLElement>('[data-aq8-original-style]')) {
                        const original: string | null = JSON.parse(node.dataset.aq8OriginalStyle ?? 'null');
                        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
                        delete node.dataset.aq8OriginalStyle;
                    }
                });
            }
        }
    } finally { await page.setViewportSize(original); }
}

test('ASSESS-QUESTION-008 essay: import, preview, Student journey, grading, finalization and rendered evidence', async ({ page, browser }) => {
    test.setTimeout(12 * 60_000);
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
    await expect(items.getByText('Soal 2 · Esai')).toBeVisible();
    await expect(items.getByText('Dinilai guru')).toBeVisible();
    await expect(items.getByText(`Rubrik: ${RUBRIC}`)).toBeVisible();
    await capture(page, 'import-preview', () => page.locator('main').first());

    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'dijadwalkan dengan 2 soal dan 1 peserta' })).toBeVisible();
    const examId: string = await withDatabase(async c => (await c.query('SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name = $1', [FILE_NAME])).rows[0].exam_instance_id);
    const card = page.getByTestId(`teacher-exam-${examId}`);

    await card.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText(PROMPT)).toBeVisible();
    await expect(page.getByText(/· Esai/)).toBeVisible();
    await expect(page.getByText(RUBRIC)).toHaveCount(0);
    await page.getByLabel('Tampilkan kunci jawaban dan skor').check();
    await expect(page.getByRole('heading', { name: 'Rubrik' })).toBeVisible();
    await expect(page.getByText(RUBRIC)).toBeVisible();
    await capture(page, 'teacher-preview-rubric', () => page.locator('main').first());
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
    const transition = (action: string) => api('/api/v1/assessment/teacher-exams/transition', { examInstanceId: examId, action, reason: 'Uji esai', actionKey: crypto.randomUUID(), confirmed: true });
    const snapshotIds: string[] = await withDatabase(async c => (await c.query('SELECT id FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 ORDER BY display_order', [examId])).rows.map((r: { id: string }) => r.id));
    const stored = async () => (await withDatabase(async c => (await c.query('SELECT answer_payload FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotIds[1]])).rows[0]?.answer_payload ?? null));
    const progress = student.getByRole('heading', { name: /^Soal \d dari 2$/ });
    const field = () => student.getByLabel('Jawaban esai');
    const hint = () => student.locator('.essay-hint');
    const toQuestion = async (text: string) => {
        await expect(progress).toBeVisible({ timeout: 30_000 });
        for (let i = 0; i < 2 && !(await student.getByText(text).isVisible()); i++) {
            const at = await progress.innerText();
            await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
            await expect(progress).not.toHaveText(at);
        }
        await expect(student.getByText(text)).toBeVisible();
    };
    await toQuestion(PROMPT);
    await expect(field()).toHaveValue('');
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await expect(student.getByText(RUBRIC)).toHaveCount(0);
    await capture(student, 'exam-es-empty', () => student.locator('body'));

    // Keyboard: the field takes focus; two lines typed with Enter are saved exactly as written.
    await field().focus();
    await student.keyboard.type(FIRST);
    await expect.poll(() => stored()).toEqual({ essayText: FIRST });
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await expect(student.locator('.essay-count')).toHaveText(`${FIRST.length}/5.000 karakter`);
    await capture(student, 'exam-es-keyboard-focus', () => student.locator('body'), STATES);

    // D2: text over 5,000 characters is a draft: never sent, the hint shows, "Belum tersimpan".
    const before = saveRequests;
    await field().fill('a'.repeat(5001));
    await expect(hint()).toHaveText(TOO_LONG);
    await expect(saveStatus(student)).toHaveText('Belum tersimpan');
    await expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(saveRequests).toBe(before);
    expect(await stored()).toEqual({ essayText: FIRST });
    await capture(student, 'exam-es-over-limit', () => student.locator('body'), STATES);

    // Back within the limit; the question list and the submit dialog count it as answered.
    await field().fill(FIRST);
    await expect(hint()).toHaveText('');
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    const list = await openQuestionList(student);
    await expect(list.getByRole('button', { name: 'Pindah ke soal nomor 2, status sudah dijawab' })).toBeVisible();
    await closeQuestionList(student);
    await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
    const confirm = student.getByRole('dialog');
    await expect(confirm.locator('[data-slot=metric]').filter({ hasText: 'Belum Dijawab' }).locator('dd')).toHaveText('1');
    await confirm.getByRole('button', { name: 'Batal' }).click();
    await expect(confirm).toHaveCount(0);

    // Offline: several edits, then reconnect; only the final text reaches the server.
    await context.setOffline(true);
    await field().fill('Draf sementara');
    await field().fill(FINAL);
    await context.setOffline(false);
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await expect.poll(() => stored()).toEqual({ essayText: FINAL });

    // Reload through the shared helper: the text is restored exactly as written.
    await reloadPage(student);
    await toQuestion(PROMPT);
    await expect(field()).toHaveValue(FINAL);

    // Read-only while paused: no question content, then the exam continues.
    expect((await transition('pause')).status).toBe(200);
    await expect(student.getByRole('heading', { name: 'Ujian Dijeda' })).toBeVisible({ timeout: 30_000 });
    await expect(student.locator('.essay-answer')).toHaveCount(0);
    expect((await transition('resume')).status).toBe(200);
    await toQuestion(PROMPT);

    // V06: the answer is held at the network; submission waits for it.
    let releaseSave!: () => void;
    const held = new Promise<void>(resolve => { releaseSave = resolve; });
    await student.route('**/api/v1/assessment/answer/save', async route => { await held; await route.continue(); });
    await field().fill(`${FINAL}\nSelesai.`);
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
    expect(await stored()).toEqual({ essayText: `${FINAL}\nSelesai.` });
    await context.close();

    // The teacher ends; finalization is refused while the essay is ungraded.
    expect((await transition('end')).status).toBe(200);
    await reloadPage(page);
    await expect(card).toContainText('Diakhiri');
    await card.getByRole('button', { name: 'Finalisasi Hasil' }).click();
    await page.getByLabel('Alasan tindakan', { exact: true }).fill('Pelaksanaan ujian terjadwal');
    await page.getByRole('dialog').getByRole('button', { name: 'Finalisasi Hasil' }).click();
    await expect(card.getByText(REFUSED)).toBeVisible();
    await capture(page, 'finalize-refused', () => page.locator('main').first(), STATES);

    // Grading: the answer as written, the rubric, a grade, a stale form and the history.
    await card.getByRole('button', { name: 'Nilai Esai' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Penilaian Esai' })).toBeVisible();
    await expect(page.getByText('Belum dinilai: 1 dari 1 jawaban')).toBeVisible();
    const answer = page.getByRole('group', { name: `Soal 2 · ${STUDENT[0]}` });
    await expect(answer.locator('.essay-text')).toHaveText(`${FINAL}\nSelesai.`, { useInnerText: false });
    await expect(page.getByText(RUBRIC)).toBeVisible();
    await capture(page, 'grading-ungraded', () => page.locator('main').first());
    const score = answer.getByLabel('Skor (0 sampai 5)');
    await expect(score).toHaveAttribute('inputmode', 'decimal');
    await score.fill('3,5');
    await answer.getByRole('button', { name: 'Simpan Nilai' }).click();
    await expect(answer.getByText('Nilai tersimpan.')).toBeVisible();
    await expect(page.getByText('Belum dinilai: 0 dari 1 jawaban')).toBeVisible();
    const attemptId: string = await withDatabase(async c => (await c.query('SELECT exam_attempt_id FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshotIds[1]])).rows[0].exam_attempt_id);
    const elsewhere = await api('/api/v1/assessment/teacher-exams/essays/grade', { examInstanceId: examId, attemptId, snapshotId: snapshotIds[1], score: '4', expectedRevision: 1 });
    expect([elsewhere.status, elsewhere.body.revision]).toEqual([200, 2]);
    await score.fill('4,5');
    await answer.getByRole('button', { name: 'Simpan Nilai' }).click();
    await expect(answer.getByText('Nilai ini baru saja diubah. Muat ulang untuk melihat nilai terbaru.')).toBeVisible();
    await capture(page, 'grading-stale', () => page.locator('main').first(), STATES);
    await page.getByRole('button', { name: 'Muat Ulang' }).click();
    await expect(answer.getByLabel('Skor (0 sampai 5)')).toHaveValue('4');
    await answer.getByText('Riwayat').click();
    await expect(answer.locator('.essay-history li')).toHaveCount(2);
    await capture(page, 'grading-history', () => page.locator('main').first());

    // Finalization now succeeds; the screen is read-only and the results show "Dinilai guru".
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();
    await card.getByRole('button', { name: 'Finalisasi Hasil' }).click();
    await page.getByLabel('Alasan tindakan', { exact: true }).fill('Semua esai sudah dinilai');
    await page.getByRole('dialog').getByRole('button', { name: 'Finalisasi Hasil' }).click();
    await expect(card).toContainText('Hasil Final', { timeout: 30_000 });
    await card.getByRole('button', { name: 'Nilai Esai' }).click();
    await expect(page.getByText('Hasil ujian sudah difinalisasi. Nilai esai dibekukan dan tidak dapat diubah.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simpan Nilai' })).toHaveCount(0);
    await expect(page.getByText('Nilai: 4', { exact: true })).toBeVisible();
    await capture(page, 'grading-finalized', () => page.locator('main').first(), STATES);
    const frozen = await withDatabase(async c => (await c.query(
        `SELECT r.item_outcomes FROM secure_assessment_attempt_results r JOIN secure_assessment_exam_result_finalizations f ON f.id = r.finalization_id
         WHERE f.exam_instance_id = $1 AND r.exam_attempt_id = $2`, [examId, attemptId])).rows[0].item_outcomes);
    expect(frozen.find((i: { questionSnapshotId: string }) => i.questionSnapshotId === snapshotIds[1])).toMatchObject({ outcome: 'GRADED', scoreMicro: 4_000_000, gradeRevision: 2 });

    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();
    await card.getByRole('button', { name: 'Lihat Hasil' }).click();
    await expect(page.getByRole('columnheader', { name: 'Dinilai guru' })).toBeVisible();
    await page.getByRole('button', { name: 'Tampilkan Nilai' }).click();
    await expect(page.getByText(/Esai dinilai guru; poinnya masuk ke Nilai\./)).toBeVisible();
    await capture(page, 'results-graded', () => page.locator('main').first());
    const final = await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    const mine = final.body.participants.find((r: { elligbleId: string }) => r.elligbleId === STUDENT[0]);
    expect([mine.score.rawScore, mine.score.maxScore, mine.score.scaledScore, mine.score.correct, mine.score.unanswered, mine.score.graded]).toEqual([4, 6, 66.67, 0, 1, 1]);
});
