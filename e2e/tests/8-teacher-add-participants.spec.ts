import { execFileSync as permissionExec } from 'node:child_process';
import { createHash as permissionHash } from 'node:crypto';
import { readFileSync as permissionRead, writeFileSync as permissionWrite } from 'node:fs';
import { expect, test, type Page, type Locator } from '@playwright/test';
import { login, reloadPage, shotName, wib, withDatabase } from './helpers.ts';


// SEC-001 C14: real keyboard traversal; never programmatically repair product focus.
async function keyboardReach(page: Page, target: Locator): Promise<void> {
    await expect(target).toBeVisible();
    for (let step = 0; step < 80; step++) {
        if (await target.evaluate(element => element === document.activeElement)) break;
        await page.keyboard.press('Tab');
    }
    await expect(target, 'C14: control must be reachable using actual Tab keys').toBeFocused();
}

async function keyboardActivate(page: Page, target: Locator): Promise<void> {
    await expect(target).toBeEnabled();
    await keyboardReach(page, target);
    await page.keyboard.press('Enter');
}

async function keyboardDialogScope(page: Page, dialog: Locator): Promise<void> {
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement)),
        { message: 'C14: opening moves focus inside the dialog' }).toBe(true);
    const controls = await dialog.locator('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])').count();
    expect(controls).toBeGreaterThan(0);
    for (const direction of ['Tab', 'Shift+Tab']) {
        for (let step = 0; step < controls + 1; step++) {
            await page.keyboard.press(direction);
            await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement)),
                { message: 'C14: ' + direction + ' remains scoped, including wraparound' }).toBe(true);
        }
    }
    await expect(dialog.getByRole('textbox', { name: 'Alasan tindakan', exact: true })).toHaveAccessibleName('Alasan tindakan');
}

async function keyboardReason(page: Page, dialog: Locator): Promise<void> {
    const reason = dialog.getByRole('textbox', { name: 'Alasan tindakan', exact: true });
    await keyboardReach(page, reason);
    await page.keyboard.type('Pelaksanaan ujian terjadwal');
    await expect(reason).toHaveValue('Pelaksanaan ujian terjadwal');
}

async function permissionControlState(examId: string): Promise<unknown> {
    const result = await withDatabase(async client => (await client.query(
        `SELECT i.lifecycle_state,
            (SELECT count(*)::int FROM secure_assessment_permission_action_events e WHERE e.exam_instance_id = i.id) AS audits,
            (SELECT count(*)::int FROM secure_assessment_exam_lifecycle_events e WHERE e.exam_instance_id = i.id) AS lifecycle_events,
            (SELECT count(*)::int FROM secure_assessment_exam_participants p WHERE p.exam_instance_id = i.id) AS participants,
            (SELECT count(*)::int FROM secure_assessment_exam_participant_additions a WHERE a.exam_instance_id = i.id) AS additions,
            (SELECT count(*)::int FROM secure_assessment_attempt_locks l
             JOIN secure_assessment_exam_attempts a ON a.id = l.exam_attempt_id
             JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id WHERE p.exam_instance_id = i.id) AS locks
         FROM secure_assessment_exam_instances i WHERE i.id = $1`, [examId]
    )).rows[0]);
    expect(result).toBeDefined();
    return result;
}

async function recordKeyboardEvidence(page: Page, scenario: string, checks: string[]): Promise<void> {
    const browser = page.context().browser();
    if (!browser) throw new Error('C14 requires a real browser');
    permissionWrite(test.info().outputPath('workspace-sec001-c14-' + scenario + '-' + test.info().project.name + '.json'), JSON.stringify({
        task: 'SEC-001-C14', parentTask: 'SEC-001', kind: 'keyboard-focus', commit: permissionCommit,
        frontendTree: permissionFrontend, runtimeTree: permissionRuntime, project: test.info().project.name,
        browser: { engine: browser.browserType().name(), version: browser.version() }, viewport: page.viewportSize(), scenario,
        fixtureSha256: permissionHash('sha256').update(permissionRead(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex'),
        interaction: 'actual Tab/Shift+Tab/Enter/Space/Escape through page.keyboard; no locator.focus or DOM focus repair',
        checks, focusedElement: await page.evaluate(() => {
            const active = document.activeElement;
            return active ? { tag: active.tagName, role: active.getAttribute('role'), name: active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 160) } : null;
        }), ci: !!process.env['CI'], physicalDevice: false,
    }, null, 2));
}

// SEC-001: identical capture protocol on the immutable baseline and implementation.
const permissionGit = (...args: string[]) => permissionExec('git', args, { encoding: 'utf8' }).trim();
const permissionCommit = permissionGit('rev-parse', 'HEAD');
const permissionFrontend = permissionGit('rev-parse', 'HEAD:frontend/web/src');
const permissionRuntime = permissionGit('rev-parse', 'HEAD:runtime');
const permissionPhase = permissionFrontend === 'a39d5a05aab6a81755b899cd0fd9dd007d383dad'
    && permissionRuntime === '6879523c9c915cdd84f18de5c10b22f2bdb14d7a' ? 'before' : 'after';
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== permissionCommit) throw new Error('SEC-001 capture SHA mismatch');

async function capturePermissionSurface(page: Page, scenario: string, fixture = 'operator-math-three-questions-long-third-v1'): Promise<void> {
    const original = page.viewportSize();
    const browser = page.context().browser();
    if (!browser || !original) throw new Error('Real browser/viewport required for SEC-001 evidence');
    const variants = [
        { width: 360, height: 780, textScale: 1 }, { width: 768, height: 1024, textScale: 1 },
        { width: 1280, height: 800, textScale: 1 }, { width: 360, height: 780, textScale: 2 },
        { width: 640, height: 360, textScale: 1 },
    ];
    try {
        for (const variant of variants) {
            await page.setViewportSize({ width: variant.width, height: variant.height });
            const dialog = page.getByRole('dialog');
            const root = await dialog.count() ? dialog : page.locator('main').first();
            await expect(root).toBeVisible();
            if (variant.textScale === 2) await root.evaluate(element => {
                const elements = [element, ...element.querySelectorAll<HTMLElement>('*')];
                const styles = elements.map(node => ({ node, font: parseFloat(getComputedStyle(node).fontSize), line: parseFloat(getComputedStyle(node).lineHeight) }));
                for (const { node, font, line } of styles) {
                    if (!(node instanceof HTMLElement)) continue;
                    node.dataset.sec001OriginalStyle = JSON.stringify(node.getAttribute('style'));
                    node.style.fontSize = String(font * 2) + 'px';
                    if (Number.isFinite(line)) node.style.lineHeight = String(line * 2) + 'px';
                }
            });
            try {
                await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
                const metrics = await root.evaluate(element => {
                    const targets = [...element.querySelectorAll<HTMLElement>('button, input, textarea, select')].filter(node => {
                        const b = node.getBoundingClientRect(); return b.width > 0 && b.height > 0;
                    }).map(node => {
                        const target = node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type) ? node.closest('label') ?? node : node;
                        const box = target.getBoundingClientRect();
                        return { name: node.getAttribute('aria-label') ?? node.textContent?.trim() ?? node.tagName, width: box.width, height: box.height };
                    });
                    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
                });
                const name = ['workspace-sec001', permissionPhase, scenario, variant.width + 'x' + variant.height, 'text' + variant.textScale, test.info().project.name].join('-');
                const screenshot = name + '.png';
                await page.screenshot({ path: test.info().outputPath(screenshot), fullPage: !(await dialog.count()), animations: 'disabled', caret: 'hide' });
                permissionWrite(test.info().outputPath(name + '.json'), JSON.stringify({
                    task: 'SEC-001', phase: permissionPhase, commit: permissionCommit,
                    baseline: { commit: '1653fc5d63be5e6e62c34f2099eb82d66af03919', frontendTree: 'a39d5a05aab6a81755b899cd0fd9dd007d383dad', runtimeTree: '6879523c9c915cdd84f18de5c10b22f2bdb14d7a' },
                    frontendTree: permissionFrontend, runtimeTree: permissionRuntime,
                    fixture: { globalSetupSha256: permissionHash('sha256').update(permissionRead(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex'), scenarioSha256: permissionHash('sha256').update(fixture).digest('hex'), synthetic: true },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), textScale: variant.textScale, resizeMethod: 'computed font-size and line-height only', scenario,
                    screenshot, screenshotSha256: permissionHash('sha256').update(permissionRead(test.info().outputPath(screenshot))).digest('hex'),
                    masking: [], variableFields: ['server timestamps/countdown', 'synthetic runtime dates/IDs'], accessibilitySnapshot: await root.ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                if (permissionPhase === 'after') {
                    expect(metrics.scrollWidth, scenario + ': document overflow').toBeLessThanOrEqual(metrics.clientWidth);
                    for (const target of metrics.targets) {
                        expect(target.width, scenario + ': target width').toBeGreaterThanOrEqual(43.5);
                        expect(target.height, scenario + ': target height').toBeGreaterThanOrEqual(43.5);
                    }
                }
            } finally {
                if (variant.textScale === 2) await page.evaluate(() => {
                    for (const node of document.querySelectorAll<HTMLElement>('[data-sec001-original-style]')) {
                        const original: string | null = JSON.parse(node.dataset.sec001OriginalStyle ?? 'null');
                        if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original);
                        delete node.dataset.sec001OriginalStyle;
                    }
                });
            }
        }
    } finally { await page.setViewportSize(original); }
}

// The teacher adds a student after scheduling (ASSESS-TEACHER-004; D04.2-64): schedule an exam
// for the day after tomorrow leaving one student out, mark it ready, then add that student
// from "Tambah Peserta". The ready exam is scheduled again and marked ready anew; the added
// student now finds the exam; the database keeps who added whom, when and from which
// enrollment. Runs after the cancellation journey.

test.describe.configure({ mode: 'serial' });

const PASSWORD = 'bintang-kejora-2026';
const QUESTIONS = [
    'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',
    '1;Hasil dari 9 x 6 adalah;45;54;56;63;64;B;1',
    '2;Hasil dari 100 : 4 adalah;20;24;25;30;40;C;1',
].join('\r\n') + '\r\n';
const START = 2 * 24 * 60 + 60;
const END = START + 120;

const noOverflow = (page: import('@playwright/test').Page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Every action of an exam card stays inside the card: a row of actions wraps, never overflows it. */
const actionsInside = (card: import('@playwright/test').Locator) => card.evaluate(el => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll('button')].every(b => {
        const r = b.getBoundingClientRect();
        return r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
    });
});

test('a teacher adds a student left out of a scheduled exam, who then finds it', async ({ page, browser }) => {
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await page.getByRole('button', { name: 'Buat Ujian' }).first().click();
    await expect(page.getByRole('heading', { name: 'Buat Ujian dari Berkas Soal' })).toBeVisible();
    await page.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await page.getByLabel('Mulai (WIB)').fill(wib(START));
    await page.getByLabel('Selesai (WIB)').fill(wib(END));
    await page.getByLabel('Durasi pengerjaan (menit)').fill('45');
    await page.getByRole('radio', { name: /Durasi penuh/ }).check();
    await page.getByLabel('Berkas CSV').setInputFiles({ name: 'kuis-lusa.csv', mimeType: 'text/csv', buffer: Buffer.from(QUESTIONS, 'utf8') });
    await page.getByRole('button', { name: 'Periksa Soal dan Jadwal' }).click();
    await expect(page.getByText('Soal dan jadwal siap dijadwalkan')).toBeVisible();
    await page.getByRole('checkbox', { name: 'siswa.e2e.06' }).uncheck();
    await page.getByRole('button', { name: 'Periksa Lagi' }).click();
    await expect(page.getByText('Peserta (5 dari 6)')).toBeVisible();
    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'dijadwalkan dengan 2 soal dan 5 peserta' })).toBeVisible();

    const examId: string = await withDatabase(async client => (await client.query(
        `SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name = 'kuis-lusa.csv'`
    )).rows[0].exam_instance_id);
    const card = page.getByTestId(`teacher-exam-${examId}`);
    await expect(card).toContainText('5 peserta');
    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(card).toContainText('Siap Dibuka');
    // Five actions on a ready exam card: at every width they stay inside the card.
    expect(await actionsInside(card)).toBe(true);

    // The student left out does not find the exam.
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC' });
    const student = await studentContext.newPage();
    await login(student, 'siswa.e2e.06', PASSWORD);
    await expect(student.getByRole('heading', { name: 'Daftar Ujian Siswa' })).toBeVisible();
    await expect(student.getByTestId(`assignment-${examId}`)).toHaveCount(0);

    // The teacher adds the student; the ready exam has to be marked ready again.
    const additionTrigger = card.getByRole('button', { name: 'Tambah Peserta', exact: true });
    const beforeAdditionCancel = await permissionControlState(examId);
    await keyboardActivate(page, additionTrigger);
    const dialog = page.getByRole('dialog', { name: 'Tambah Peserta' });
    await expect(dialog.getByRole('checkbox')).toHaveCount(1);
    await keyboardDialogScope(page, dialog);
    await keyboardActivate(page, dialog.getByRole('button', { name: 'Batal', exact: true }));
    await expect(dialog).toHaveCount(0);
    expect(await permissionControlState(examId)).toEqual(beforeAdditionCancel);
    await test.step('C14 participants: keyboard Cancel restores the same exam-card trigger', async () => {
        await expect(additionTrigger).toBeFocused();
    });
    await keyboardActivate(page, additionTrigger);
    await expect(dialog.getByRole('checkbox')).toHaveCount(1);
    await keyboardDialogScope(page, dialog);
    await expect(dialog).toContainText('perlu ditandai siap lagi');
    await expect(dialog).toContainText('tidak dapat dihapus di aplikasi');
    await expect(dialog).toContainText('Peserta saat ini: 5');
    await expect(dialog.getByRole('checkbox')).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Tambahkan Peserta' })).toBeDisabled();
    const addedStudent = dialog.getByRole('checkbox', { name: 'siswa.e2e.06', exact: true });
    await keyboardReach(page, addedStudent);
    await page.keyboard.press('Space');
    await expect(addedStudent).toBeChecked();
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('add-participants')), fullPage: true });
    await keyboardReason(page, dialog);

    await capturePermissionSurface(page, 'add-participants-confirm', QUESTIONS);
    const addConfirmation = dialog.getByRole('button', { name: 'Tambahkan 1 Peserta', exact: true });
    const beforeTransportFailure = await permissionControlState(examId);
    // Transport fault only: the real mutation never reaches the server; no response is fabricated.
    const additionRoute = '**/api/v1/assessment/teacher-exams/participants/add';
    await page.route(additionRoute, route => route.abort('failed'), { times: 1 });
    try {
        await keyboardActivate(page, addConfirmation);
        const failure = dialog.getByRole('alert');
        await expect(failure).toHaveText('Gagal menambahkan peserta. Periksa koneksi internet Anda, lalu coba lagi.');
        await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement)),
            { message: 'C14: failure feedback retains focus in the open dialog' }).toBe(true);
        expect(await permissionControlState(examId)).toEqual(beforeTransportFailure);
    } finally { await page.unroute(additionRoute); }
    await keyboardActivate(page, addConfirmation);
    await expect(page.getByRole('status').filter({ hasText: '1 peserta ditambahkan ke ujian Matematika Wajib. Tandai siap lagi sebelum membuka ujian.' })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(additionTrigger).toBeFocused();
    await recordKeyboardEvidence(page, 'participant-addition', ['keyboard trigger/checkbox Space/confirmation','initial focus','Tab/Shift+Tab containment','named reason','Cancel zero business/audit mutation and trigger focus','real transport failure accessible alert and zero mutation','successful status announcement and initiating-control focus']);
    await expect(card).toContainText('Terjadwal');
    await expect(card).toContainText('6 peserta');
    await expect(card).toContainText('Peserta ditambahkan');
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('participants-added')), fullPage: true });

    // Nobody is left to add.
    await card.getByRole('button', { name: 'Tambah Peserta' }).click();
    await expect(dialog).toContainText('Semua siswa yang terdaftar di kelas ini pada hari ujian sudah menjadi peserta.');
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toHaveCount(0);

    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(card).toContainText('Siap Dibuka');

    // The added student now finds it.
    await reloadPage(student);
    await expect(student.getByTestId(`assignment-${examId}`)).toBeVisible();
    await studentContext.close();

    const kept = await withDatabase(async client => (await client.query(
        `SELECT a.previous_lifecycle_state, c.username AS teacher,
                (SELECT array_agg(sc.username) FROM secure_assessment_exam_participant_addition_entries e
                 JOIN secure_assessment_exam_participants p ON p.id = e.exam_participant_id AND p.academic_enrollment_id = e.academic_enrollment_id
                 JOIN identity_user_accounts su ON su.person_id = p.person_id
                 JOIN identity_account_credentials sc ON sc.user_account_id = su.id
                 WHERE e.participant_addition_id = a.id) AS added,
                (SELECT count(*)::int FROM secure_assessment_exam_participants p WHERE p.exam_instance_id = a.exam_instance_id) AS participants,
                (SELECT array_agg(l.from_state || '>' || l.to_state ORDER BY l.occurred_at) FROM secure_assessment_exam_lifecycle_events l
                 WHERE l.exam_instance_id = a.exam_instance_id) AS transitions
         FROM secure_assessment_exam_participant_additions a
         JOIN identity_user_accounts ua ON ua.person_id = a.added_by_person_id
         JOIN identity_account_credentials c ON c.user_account_id = ua.id
         WHERE a.exam_instance_id = $1`,
        [examId]
    )).rows);
    expect(kept).toEqual([{
        previous_lifecycle_state: 'READY', teacher: 'guru.e2e', added: ['siswa.e2e.06'], participants: 6,
        transitions: ['DRAFT>SCHEDULED', 'SCHEDULED>READY', 'READY>SCHEDULED', 'SCHEDULED>READY'],
    }]);
});
