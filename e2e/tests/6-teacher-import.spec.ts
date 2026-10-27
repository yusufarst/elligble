import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { login, shotName, wib, withDatabase } from './helpers.ts';

// The teacher prepares an exam without platform staff (ASSESS-TEACHER-001; D04.4-26A,
// D04.3-61..66): upload the question file, see every problem with its line, fix it, check
// the questions, key and participants, leave one student out, schedule, preview it as
// students will see it (ASSESS-TEACHER-002, D04.3-38/39), mark ready, move it (ASSESS-TEACHER-003,
// D04.2-45: ready again only after a new "Tandai Siap") and open it; an
// included student then answers the imported questions, and the teacher adds time for that
// student alone (ASSESS-PROCTOR-004, D04.6-41), which the student's screen shows at once.
// Runs after the lifecycle suite, when the operator-imported exam of the same class is
// finalized.

test.describe.configure({ mode: 'serial' });

const PASSWORD = 'bintang-kejora-2026';
const HEADER = 'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
const BROKEN = [HEADER, '1;Lambang unsur oksigen adalah;O;Os;Ok;Og;Ox;A;1', '2;Rumus air adalah;H2O;HO2;H2O2;OH;H3O;A dan B;1'].join('\r\n');
const FIXED = [HEADER, '1;Lambang unsur oksigen adalah;O;Os;Ok;Og;Ox;A;1', '2;Rumus air adalah;HO2;H2O;H2O2;OH;H3O;B;1,5'].join('\r\n') + '\r\n';

// UI-SYSTEM-004 Part 3: actual Teacher Preview evidence, independent of the Student helper.
// An immutable tree works in the existing shallow CI checkout; the candidate is always HEAD.
const PREVIEW_BASE = '5f7a018e9e5f95ff14af7b11413ad07b29b1f405';
const PREVIEW_BASE_TREE = 'bd628231c9f5a00a6a103a89dd3a40cb8bdbba6f';
const previewGit = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const previewCommit = previewGit('rev-parse', 'HEAD');
const previewSourceTree = previewGit('rev-parse', 'HEAD:frontend/web/src');
const previewPhase = previewSourceTree === PREVIEW_BASE_TREE ? 'before' : 'after';
if (process.env['GITHUB_SHA']) expect(previewCommit).toBe(process.env['GITHUB_SHA']);

async function captureTeacherPreview(page: Page, info: TestInfo, keysShown: boolean) {
    const originalViewport = page.viewportSize();
    if (!originalViewport) throw new Error('Teacher Preview requires a recorded viewport');
    const viewports = [originalViewport, { width: 360, height: 640 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]
        .filter((size, i, all) => all.findIndex(other => other.width === size.width && other.height === size.height) === i);
    const selected = page.getByRole('radio', { name: 'H2O2', exact: true });
    const keyToggle = page.getByLabel('Tampilkan kunci jawaban dan skor');
    const failures: unknown[] = [];
    let crashed = false;
    const onCrash = () => { crashed = true; };
    page.on('crash', onCrash);
    try {
        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            for (const textScale of [1, 2]) {
                // Actual per-element text-size emulation, not a root-rem-only or native zoom claim.
                const styles = await page.evaluateHandle(scale => {
                    const saved = Array.from(document.querySelectorAll<HTMLElement>('main, main *')).map(element => ({
                        element, style: element.getAttribute('style'), size: parseFloat(getComputedStyle(element).fontSize),
                    }));
                    if (scale === 2) for (const item of saved) item.element.style.fontSize = `${item.size * 2}px`;
                    return saved;
                }, textScale);
                try {
                    await expect(selected).toBeChecked();
                    await expect(keyToggle).toBeChecked({ checked: keysShown });
                    await expect(page.getByText('Kunci jawaban', { exact: true })).toHaveCount(keysShown ? 1 : 0);
                    let correctKeyFocus = null;
                    if (keysShown) {
                        const correct = page.getByRole('radio', { name: 'H2O Kunci jawaban', exact: true });
                        await correct.focus();
                        await expect(correct).toBeFocused();
                        correctKeyFocus = await correct.evaluate(input => {
                            const label = input.closest('label');
                            if (!label) throw new Error('Missing correct-answer label');
                            const style = getComputedStyle(label);
                            return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset };
                        });
                    }
                    await selected.focus();
                    await expect(selected).toBeFocused();
                    const metrics = await page.evaluate(() => {
                        const main = document.querySelector('main');
                        if (!main) throw new Error('Missing Teacher Preview main landmark');
                        const targets = Array.from(main.querySelectorAll<HTMLElement>('button, .option-item-label, label:has(input[type="checkbox"])')).map(element => {
                            const box = element.getBoundingClientRect();
                            return { name: element.getAttribute('aria-label') ?? element.innerText.trim(), x: box.x, y: box.y, width: box.width, height: box.height };
                        });
                        const overlaps: string[] = [];
                        for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
                            const a = targets[i], b = targets[j];
                            if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1
                                && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1) overlaps.push(`${a.name} / ${b.name}`);
                        }
                        const clippedText: string[] = [];
                        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
                        while (walker.nextNode()) {
                            const node = walker.currentNode;
                            if (!node.textContent?.trim()) continue;
                            const range = document.createRange(); range.selectNodeContents(node);
                            for (const box of Array.from(range.getClientRects())) {
                                if (box.width && (box.left < -1 || box.right > document.documentElement.clientWidth + 1)) {
                                    clippedText.push(node.textContent.trim()); break;
                                }
                            }
                        }
                        const focusedLabel = document.activeElement?.closest('label');
                        if (!focusedLabel) throw new Error('Expected native answer radio focus');
                        const focus = getComputedStyle(focusedLabel);
                        return {
                            clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
                            targets, overlaps, clippedText,
                            focusedOption: { outlineStyle: focus.outlineStyle, outlineWidth: focus.outlineWidth, outlineOffset: focus.outlineOffset },
                        };
                    });
                    if (previewPhase === 'after') {
                        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
                        expect(metrics.clippedText).toEqual([]);
                        expect(metrics.overlaps).toEqual([]);
                        for (const target of metrics.targets) {
                            expect(target.width, target.name).toBeGreaterThanOrEqual(44);
                            expect(target.height, target.name).toBeGreaterThanOrEqual(44);
                        }
                        expect(metrics.focusedOption.outlineStyle).toBe('solid');
                        expect(parseFloat(metrics.focusedOption.outlineWidth)).toBeGreaterThanOrEqual(2);
                        if (correctKeyFocus) {
                            expect(correctKeyFocus.outlineStyle).toBe('solid');
                            expect(parseFloat(correctKeyFocus.outlineWidth)).toBeGreaterThanOrEqual(2);
                            expect(parseFloat(correctKeyFocus.outlineOffset)).toBeGreaterThanOrEqual(2);
                        }
                    }
                    const scenario = `keys-${keysShown ? 'shown' : 'hidden'}-keyboard-text-${textScale * 100}`;
                    const stem = `workspace-teacher-preview-${scenario}-${viewport.width}x${viewport.height}-${info.project.name}`;
                    await page.screenshot({ path: info.outputPath(`${stem}.png`), fullPage: true });
                    await writeFile(info.outputPath(`${stem}.json`), JSON.stringify({
                        task: 'UI-SYSTEM-004 Part 3', phase: previewPhase, commit: previewCommit,
                        applicationBaseline: { ref: PREVIEW_BASE, sourceTree: PREVIEW_BASE_TREE }, applicationSourceTree: previewSourceTree,
                        fixture: { id: 'teacher-import-chemistry-two-questions-v1', sha256: createHash('sha256').update(FIXED).digest('hex'), synthetic: true },
                        browser: { engine: page.context().browser()?.browserType().name(), version: page.context().browser()?.version(), project: info.project.name },
                        viewport, deviceScaleFactor: await page.evaluate(() => devicePixelRatio), scenario, textScale,
                        screenshot: `${stem}.png`, fullPage: true, masking: [], variableFields: ['school window timestamps'],
                        environment: { platform: process.platform, ci: !!process.env['CI'], physicalDevice: false, textResizeEmulation: true },
                        metrics, correctKeyFocus, accessibilitySnapshot: await page.getByRole('radiogroup', { name: 'Pilihan Jawaban' }).ariaSnapshot(),
                    }, null, 2));
                } catch (error) { failures.push(error); }
                finally {
                    if (!crashed && !page.isClosed()) {
                        try { await styles.evaluate(saved => { for (const item of saved) {
                            if (item.style === null) item.element.removeAttribute('style'); else item.element.setAttribute('style', item.style);
                        } }); } catch (error) { failures.push(error); }
                    }
                    try { await styles.dispose(); } catch (error) { failures.push(error); }
                }
                if (failures.length) throw failures[0];
            }
        }
    } catch (error) { if (!failures.includes(error)) failures.push(error); }
    finally {
        if (!crashed && !page.isClosed()) {
            try { await page.setViewportSize(originalViewport); } catch (error) { failures.push(error); }
        }
        page.off('crash', onCrash);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'Teacher Preview capture and restoration failed', { cause: failures[0] });
}

function seconds(clock: string): number {
    return clock.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
}

test('a teacher schedules an exam from a question file, and an included student takes it', async ({ page, browser }) => {
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await page.getByRole('button', { name: 'Buat Ujian' }).click();
    await expect(page.getByRole('heading', { name: 'Buat Ujian dari Berkas Soal' })).toBeVisible();

    // The only class is chosen already; the rest is entered in school time (WIB).
    await expect(page.getByRole('radio', { name: /Matematika Wajib · X-E2E/ })).toBeChecked();
    await page.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await page.getByLabel('Mulai (WIB)').fill(wib(-2));
    await page.getByLabel('Selesai (WIB)').fill(wib(120));
    await page.getByLabel('Durasi pengerjaan (menit)').fill('30');
    await page.getByRole('radio', { name: /Durasi penuh/ }).check();
    await page.getByLabel('Berkas CSV').setInputFiles({ name: 'ulangan-kimia.csv', mimeType: 'text/csv', buffer: Buffer.from(BROKEN, 'utf8') });
    await page.getByRole('button', { name: 'Periksa Soal dan Jadwal' }).click();
    await expect(page.getByText('Perbaiki 1 hal berikut, lalu periksa lagi')).toBeVisible();
    await expect(page.getByText('Baris 3: kunci jawaban harus satu huruf. Setiap soal hanya punya satu jawaban benar.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jadwalkan Ujian' })).toHaveCount(0);

    await page.getByLabel('Berkas CSV').setInputFiles({ name: 'ulangan-kimia.csv', mimeType: 'text/csv', buffer: Buffer.from(FIXED, 'utf8') });
    await page.getByRole('button', { name: 'Periksa Soal dan Jadwal' }).click();
    await expect(page.getByText('Soal dan jadwal siap dijadwalkan')).toBeVisible();
    const second = page.getByRole('listitem').filter({ hasText: 'Rumus air adalah' });
    await expect(second.getByText('Kunci jawaban')).toBeVisible();
    await expect(second.locator('li').filter({ hasText: 'Kunci jawaban' })).toContainText('H2O');
    await expect(second.getByText('Skor 1,5')).toBeVisible();
    await expect(page.getByText('Peserta (6 dari 6)')).toBeVisible();

    // One student is left out; the change needs a new check before scheduling.
    await page.getByRole('checkbox', { name: 'siswa.e2e.06' }).uncheck();
    await expect(page.getByRole('button', { name: 'Jadwalkan Ujian' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Periksa Lagi' }).click();
    await expect(page.getByText('Peserta (5 dari 6)')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('teacher-import-preview')), fullPage: true });

    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    const dialog = page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' });
    await expect(dialog).toContainText('2 soal, 5 peserta');
    await dialog.getByRole('button', { name: 'Jadwalkan Ujian' }).click();

    // Back in the list: the new exam is scheduled for the class and ready by the checks.
    await expect(page.getByRole('status').filter({ hasText: 'Matematika Wajib · X-E2E dijadwalkan dengan 2 soal dan 5 peserta.' })).toBeVisible();
    const card = page.locator('.teacher-exam-card').filter({ hasNotText: 'Hasil Final' });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Terjadwal');
    await expect(card).toContainText('X-E2E · Ulangan Harian');

    // Preview before it opens (D04.3-38/39): the questions as students get them, the key on
    // request; trying an option writes nothing.
    await card.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await expect(page.getByRole('heading', { name: 'Pratinjau Soal' })).toBeVisible();
    await expect(page.getByText('Soal 1 dari 2')).toBeVisible();
    await expect(page.getByText('Lambang unsur oksigen adalah')).toBeVisible();
    await page.getByText('Os', { exact: true }).click();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Rumus air adalah')).toBeVisible();
    await expect(page.getByText('Kunci jawaban', { exact: true })).toHaveCount(0);
    // Reach the native radio group by Tab, then use its browser-provided arrow behavior.
    const previewNumbers = page.getByRole('navigation', { name: 'Daftar soal pratinjau' });
    await previewNumbers.getByRole('button', { name: 'Soal 2', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Tampilkan kunci jawaban dan skor')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'HO2', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'H2O', exact: true })).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'H2O2', exact: true })).toBeChecked();
    await captureTeacherPreview(page, test.info(), false);
    await page.getByLabel('Tampilkan kunci jawaban dan skor').check();
    await expect(page.locator('label').filter({ has: page.getByText('Kunci jawaban', { exact: true }) })).toContainText('H2O');
    await expect(page.getByText('Skor 1,5')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'H2O2', exact: true })).toBeFocused();
    await captureTeacherPreview(page, test.info(), true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('teacher-exam-preview')), fullPage: true });
    // No attempt exists for the new exam (answers need one): the preview created nothing.
    const attempts = await withDatabase(async client => (await client.query(
        `SELECT count(*)::int AS n FROM secure_assessment_exam_attempts t
         JOIN secure_assessment_exam_participants p ON p.id = t.exam_participant_id
         JOIN secure_assessment_exam_instances i ON i.id = p.exam_instance_id
         WHERE i.lifecycle_state <> 'FINALIZED'`
    )).rows[0].n);
    expect(attempts).toBe(0);
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(card).toContainText('Siap Dibuka');

    // Moved before it opens (D04.2-45): a longer window and duration; the ready exam is
    // scheduled again and has to be marked ready anew (D04.2-25).
    await card.getByRole('button', { name: 'Ubah Jadwal' }).click();
    const move = page.getByRole('dialog', { name: 'Ubah Jadwal Ujian' });
    await expect(move).toContainText('perlu ditandai siap lagi');
    await move.getByLabel('Selesai (WIB)').fill(wib(150));
    await move.getByLabel('Durasi pengerjaan (menit)').fill('40');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('reschedule')), fullPage: true });
    await move.getByRole('button', { name: 'Simpan Jadwal' }).click();
    await expect(page.getByRole('status').filter({ hasText: /durasi 40 menit\. Ujian kembali terjadwal; tandai siap lagi sebelum dibuka\.$/ })).toBeVisible();
    await expect(card).toContainText('Terjadwal');
    await expect(card).toContainText('Jadwal diubah');
    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await card.getByRole('button', { name: 'Buka Ujian' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Buka Ujian' }).click();
    await expect(card).toContainText('Berlangsung');

    const kept = await withDatabase(async client => (await client.query(
        `SELECT b.source_file_name, b.question_count, b.source_sha256 ~ '^[0-9a-f]{64}$' AS hashed,
                array_agg(s.import_source_line ORDER BY s.display_order) AS lines,
                (SELECT array_agg(c.username ORDER BY c.username) FROM secure_assessment_exam_participants p
                 JOIN identity_user_accounts a ON a.person_id = p.person_id
                 JOIN identity_account_credentials c ON c.user_account_id = a.id
                 WHERE p.exam_instance_id = b.exam_instance_id) AS participants
         FROM secure_assessment_question_import_batches b
         JOIN secure_assessment_exam_question_snapshots s ON s.import_batch_id = b.id
         GROUP BY b.id`
    )).rows);
    expect(kept).toEqual([{
        source_file_name: 'ulangan-kimia.csv', question_count: 2, hashed: true, lines: [2, 3],
        participants: ['siswa.e2e.01', 'siswa.e2e.02', 'siswa.e2e.03', 'siswa.e2e.04', 'siswa.e2e.05'],
    }]);
    const moves = await withDatabase(async client => (await client.query(
        `SELECT sc.previous_lifecycle_state, sc.previous_duration_seconds, sc.new_duration_seconds, c.username AS teacher,
                (SELECT array_agg(e.from_state || '>' || e.to_state ORDER BY e.occurred_at) FROM secure_assessment_exam_lifecycle_events e
                 WHERE e.exam_instance_id = sc.exam_instance_id) AS transitions
         FROM secure_assessment_exam_schedule_changes sc
         JOIN identity_user_accounts ua ON ua.person_id = sc.changed_by_person_id
         JOIN identity_account_credentials c ON c.user_account_id = ua.id`
    )).rows);
    expect(moves).toEqual([{
        previous_lifecycle_state: 'READY', previous_duration_seconds: 1800, new_duration_seconds: 2400, teacher: 'guru.e2e',
        transitions: ['DRAFT>SCHEDULED', 'SCHEDULED>READY', 'READY>SCHEDULED', 'SCHEDULED>READY', 'READY>ACTIVE'],
    }]);

    // An included student starts it and sees the imported questions.
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC' });
    const student = await studentContext.newPage();
    await login(student, 'siswa.e2e.01', PASSWORD);
    // The student's card says the schedule was moved, and when it was before.
    await expect(student.getByText(/^Jadwal diubah oleh guru pada .+\. Jadwal sebelumnya: .+\.$/)).toBeVisible();
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await student.screenshot({ path: test.info().outputPath(shotName('student-schedule-changed')), fullPage: true });
    await student.getByRole('button', { name: 'Mulai Ujian' }).click();
    await student.getByRole('button', { name: 'Mulai Ujian Sekarang' }).click();
    await expect(student.getByText('Lambang unsur oksigen adalah')).toBeVisible();

    // The teacher adds 5 minutes for this student only, with a reason (D04.6-41, D04.2-78).
    const before = seconds(await student.locator('.timer-value').innerText());
    await card.getByRole('button', { name: 'Pantau Peserta' }).click();
    await expect(page.getByRole('heading', { name: 'Pemantauan Peserta' })).toBeVisible();
    const row = page.getByRole('row').filter({ has: page.getByText('siswa.e2e.01', { exact: true }) });
    const addTimeFor01 = row.getByRole('button', { name: 'Tambah waktu siswa.e2e.01' });
    await expect(addTimeFor01).toBeVisible();
    // Checked once the participants are on screen: the heading shows before them.
    const notStarted = page.getByRole('row').filter({ has: page.getByText('siswa.e2e.02', { exact: true }) });
    await expect(notStarted).toHaveCount(1);
    await expect(notStarted.getByRole('button', { name: /Tambah waktu/ })).toHaveCount(0);
    await addTimeFor01.click();
    const addTime = page.getByRole('dialog', { name: 'Tambah Waktu Peserta' });
    await addTime.getByLabel('Tambahan waktu (menit)').fill('5');
    await addTime.getByLabel('Alasan').fill('Listrik padam di ruang ujian');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('add-time')), fullPage: true });
    await addTime.getByRole('button', { name: 'Tambah 5 Menit' }).click();
    await expect(page.getByText(/^Waktu siswa\.e2e\.01 ditambah 5 menit\. Sisa waktunya sekarang \d+ menit\.$/)).toBeVisible();
    await expect(row).toContainText('Waktu ditambah 5 menit');
    await page.screenshot({ path: test.info().outputPath(shotName('monitoring-time-added')), fullPage: true });

    // The student's screen says so at its next check and the time grows; nobody else's does.
    await expect(student.getByText('Waktu pengerjaan Anda ditambah 5 menit.')).toBeVisible({ timeout: 30_000 });
    expect(seconds(await student.locator('.timer-value').innerText())).toBeGreaterThan(before + 4 * 60);
    await expect(student.getByText('Listrik padam di ruang ujian')).toHaveCount(0);
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await student.screenshot({ path: test.info().outputPath(shotName('student-time-added')) });
    const added = await withDatabase(async client => (await client.query(
        `SELECT adj.adjustment_seconds, adj.reason, c.username AS actor, adj.action_key IS NOT NULL AS keyed, p2.username AS participant
         FROM secure_assessment_timer_adjustments adj
         JOIN identity_user_accounts ua ON ua.person_id = adj.actor_person_id
         JOIN identity_account_credentials c ON c.user_account_id = ua.id
         JOIN secure_assessment_timer_state t ON t.id = adj.timer_state_id
         JOIN secure_assessment_exam_attempts a ON a.id = t.exam_attempt_id
         JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id
         JOIN identity_user_accounts ua2 ON ua2.person_id = p.person_id
         JOIN identity_account_credentials p2 ON p2.user_account_id = ua2.id`
    )).rows);
    expect(added).toEqual([{ adjustment_seconds: 300, reason: 'Listrik padam di ruang ujian', actor: 'guru.e2e', keyed: true, participant: 'siswa.e2e.01' }]);
    await studentContext.close();
});
