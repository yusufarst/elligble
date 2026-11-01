import { execFileSync as permissionExec } from 'node:child_process';
import { createHash as permissionHash } from 'node:crypto';
import { readFileSync as permissionRead, writeFileSync as permissionWrite } from 'node:fs';
import { expect, test, type Page, type Locator } from '@playwright/test';
import { STAFF_SCREEN_FILE, activate, captureWorkspace, captureWorkspaceReading, option, reloadPage, requestedPaths, saveStatus, startExam, state, withDatabase } from './helpers.ts';


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

// The pilot journey: provisioning CLI -> activation cards -> teacher opens the exam ->
// proctor monitors -> a student answers, reloads, submits once.

test.describe.configure({ mode: 'serial' });

test('the teacher activates their account and opens the imported exam', async ({ page }) => {
    const requested = requestedPaths(page);
    await activate(page, 'guru.e2e', 'papan-tulis-hijau');
    await expect(page.getByRole('heading', { name: 'Pelaksanaan Ujian' })).toBeVisible();
    // The teacher's screen is downloaded when it is first shown (WEB-001). Its heading shows
    // while the file downloads, so wait for the request itself rather than for the heading.
    await expect.poll(() => requested.some(path => STAFF_SCREEN_FILE.test(path))).toBe(true);
    await expect(page.getByText('Terjadwal')).toBeVisible();
    await page.getByRole('button', { name: 'Tandai Siap' }).click();
    const activationTrigger = page.getByRole('button', { name: 'Buka Ujian', exact: true }).first();
    const activationDialog = page.getByRole('dialog', { name: 'Buka Ujian untuk Peserta?' });
    const beforeCancel = await permissionControlState(state.examInstanceId);
    await keyboardActivate(page, activationTrigger);
    await keyboardDialogScope(page, activationDialog);
    await expect(activationDialog.getByRole('button', { name: 'Buka Ujian', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(activationDialog).toHaveCount(0);
    expect(await permissionControlState(state.examInstanceId)).toEqual(beforeCancel);
    await test.step('C14 activation: Escape returns focus to the initiating Buka Ujian button', async () => {
        await expect(activationTrigger).toBeFocused();
    });
    await keyboardActivate(page, activationTrigger);
    await keyboardDialogScope(page, activationDialog);
    const reason = activationDialog.getByRole('textbox', { name: 'Alasan tindakan', exact: true });
    await keyboardReach(page, reason);
    await page.keyboard.type('x'.repeat(201));
    await expect(reason).toHaveAttribute('aria-invalid', 'true');
    const descriptionId = await reason.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    await expect(activationDialog.locator('[id="' + descriptionId + '"]')).toContainText('maksimal 200 karakter');
    await expect(activationDialog.getByRole('button', { name: 'Buka Ujian', exact: true })).toBeDisabled();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await keyboardReason(page, activationDialog);
    await expect(reason).toHaveAttribute('aria-invalid', 'false');

    await capturePermissionSurface(page, 'activate-confirm');
    await keyboardActivate(page, activationDialog.getByRole('button', { name: 'Buka Ujian', exact: true }));
    await expect(page.getByText('Berlangsung').first()).toBeVisible();
    await expect(activationDialog).toHaveCount(0);
    await expect(activationTrigger).toHaveCount(0);
    await test.step('C14 activation: disappearing trigger restores an appropriate persistent Teacher control', async () => {
        const fallback = page.getByRole('button', { name: 'Perbarui Data', exact: true })
            .or(page.getByRole('heading', { name: 'Pelaksanaan Ujian', exact: true }))
            .or(page.getByRole('button', { name: 'Pantau Peserta', exact: true }))
            .or(page.getByRole('button', { name: 'Lihat Hasil', exact: true }));
        await expect.poll(() => fallback.evaluateAll(elements => elements.some(element => element === document.activeElement)),
            { message: 'C14: focus returns to a persistent Teacher heading or relevant control, never body' }).toBe(true);
    });
    await recordKeyboardEvidence(page, 'teacher-activation', ['keyboard trigger/confirmation','initial dialog focus','Tab and Shift+Tab containment/wrap','accessible reason and invalid-length feedback','Escape zero business/audit mutation','Escape trigger focus restored','successful transition and persistent fallback focus']);
});

test('the proctor sees the running exam', async ({ page }) => {
    await activate(page, 'pengawas.e2e', 'ruang-ujian-tenang');
    await expect(page.getByText('Matematika Wajib').first()).toBeVisible();
});

test('a student answers, the answers survive a reload, and the exam is submitted once', async ({ page }) => {
    const requested = requestedPaths(page);
    await activate(page, 'siswa.e2e.01', 'bintang-kejora-2026');
    await expect(page.getByText('Daftar Ujian Siswa')).toBeVisible();
    // The browser runs in UTC; the schedule is shown in the school's zone.
    await expect(page.getByText(/\d{2}\.\d{2} WIB/).first()).toBeVisible();
    await expect(page.getByText(/UTC/)).toHaveCount(0);
    const attemptId = await startExam(page);
    await captureWorkspace(page, 'unanswered');

    // Hold the real request, then deliver it unchanged: selected does not imply server ACK.
    const pending = Promise.withResolvers<void>();
    await page.route('**/api/v1/assessment/answer/save', async route => {
        await pending.promise;
        await route.continue();
    });
    try {
        await option(page, 1).click();
        await expect(saveStatus(page)).toHaveText('Menyimpan...');
        await expect(page.getByRole('button', { name: 'Selesaikan Ujian' })).toBeDisabled();
        await captureWorkspace(page, 'selected-pending-ack');
    } finally {
        pending.resolve();
    }
    await expect(saveStatus(page)).toHaveText('Tersimpan');
    await page.unroute('**/api/v1/assessment/answer/save');
    await captureWorkspace(page, 'selected-saved');
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Bilangan prima terkecil adalah')).toBeVisible();
    await option(page, 2).click();
    await expect(saveStatus(page)).toHaveText('Tersimpan');

    await reloadPage(page);
    await expect(page.getByText('Hasil dari 2 + 3 adalah')).toBeVisible();
    await expect(page.locator('.options-list input[type=radio]').nth(1)).toBeChecked();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.locator('.options-list input[type=radio]').nth(2)).toBeChecked();

    // Read the longer third question without answering it: the original 2/3 score is unchanged.
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Akar kuadrat dari 81 adalah')).toBeVisible();
    await captureWorkspaceReading(page);
    await expect(page.locator('.options-list input[type=radio]:checked')).toHaveCount(0);
    await page.getByRole('button', { name: 'Soal Sebelumnya' }).click();

    await page.getByRole('button', { name: 'Selesaikan Ujian' }).click();
    await captureWorkspace(page, 'submission-confirmation');
    await page.getByRole('dialog').getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Kirim Jawaban Sekarang' }).click();
    await expect(page.getByText('Ujian Berhasil Dikumpulkan')).toBeVisible();

    // A repeated submission (double click, retry after a lost response) returns the same receipt.
    const receipts = await page.evaluate(async ({ id, tenant }) => {
        const send = () => fetch('/api/v1/assessment/submit', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant }, body: JSON.stringify({ attemptId: id }),
        }).then(r => r.json());
        return Promise.all([send(), send()]);
    }, { id: attemptId, tenant: state.tenantId });
    expect(receipts[0].submissionId).toBeTruthy();
    expect(receipts[1].submissionId).toBe(receipts[0].submissionId);

    await page.getByRole('button', { name: 'Kembali ke Jadwal Ujian' }).click();
    await expect(page.getByText('Sudah dikumpulkan')).toBeVisible();

    // The whole student journey downloaded no teacher or proctor screen (WEB-001).
    expect(requested.some(path => /^\/assets\/index-[\w-]+\.js$/.test(path))).toBe(true);
    expect(requested.filter(path => STAFF_SCREEN_FILE.test(path))).toEqual([]);
});
