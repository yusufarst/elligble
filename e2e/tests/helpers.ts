import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { errors, expect, test, type Locator, type Page } from '@playwright/test';
import pg from 'pg';
import { readState } from '../state.ts';

export const state = readState();

// UI-SYSTEM-004 part 2: evidence from the production client and real isolated CI server.
// The same fixture and capture code is used before and after the presentation change.
const WORKSPACE_BASE = 'b5c2ae7bf35b04e6610cd2c0f6c51ced8ad5191f';
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const workspaceCommit = git('rev-parse', 'HEAD');
const workspaceBaselineTree = git('rev-parse', `${WORKSPACE_BASE}:frontend/web/src`);
const workspaceApplicationTree = git('rev-parse', 'HEAD:frontend/web/src');
const workspacePhase = workspaceApplicationTree === workspaceBaselineTree ? 'before' : 'after';
const workspaceFixture = readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8')
    .split('\n').find(line => line.trimStart().startsWith("'3,"));
if (!workspaceFixture) throw new Error('The third workspace fixture is missing.');
const workspaceFixtureHash = createHash('sha256').update(workspaceFixture.trim()).digest('hex');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== workspaceCommit) {
    throw new Error('Workspace capture SHA differs from the checked-out candidate.');
}

function workspaceMetadata(page: Page, scenario: string) {
    const browser = page.context().browser();
    if (!browser) throw new Error('A real browser is required for workspace evidence.');
    return {
        task: 'UI-SYSTEM-004 part 2', phase: workspacePhase, commit: workspaceCommit,
        applicationBaseline: { ref: WORKSPACE_BASE, sourceTree: workspaceBaselineTree },
        applicationSourceTree: workspaceApplicationTree,
        fixture: { id: 'operator-math-three-questions-long-third-v1', sha256: workspaceFixtureHash, synthetic: true },
        browser: { engine: browser.browserType().name(), version: browser.version(), project: test.info().project.name },
        viewport: page.viewportSize(), scenario, masking: [],
        variableFields: ['server-authoritative countdown', 'server timestamps'],
        environment: { platform: process.platform, ci: !!process.env['CI'], physicalDevice: false },
    };
}

/** Records baseline defects without blessing them. After remediation, enforces the new gates. */
export async function captureWorkspace(page: Page, scenario: string, fullPage = false): Promise<void> {
    await expect(page.locator('.timer-value')).toHaveCount(1);
    await expect(page.locator('.options-list input[type=radio]')).toHaveCount(5);
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    const metrics = await page.evaluate(() => {
        const visible = (el: Element) => {
            const box = el.getBoundingClientRect();
            return box.width > 0 && box.height > 0;
        };
        const targets = [...document.querySelectorAll<HTMLElement>(
            '.workstation-actions button, .option-item-label, .review-flag-toggle, .navigator-grid button, .sheet-dialog button, .broadcast-banner button'
        )].filter(visible).map(el => {
            const box = el.getBoundingClientRect();
            return { name: el.getAttribute('aria-label') ?? el.innerText, width: box.width, height: box.height };
        });
        const textOverflow = [...document.querySelectorAll('.question-prompt, .option-text, .exam-context-subtitle, .broadcast-banner-text')]
            .filter(visible).filter(el => {
                const range = document.createRange();
                range.selectNodeContents(el);
                return [...range.getClientRects()].some(box => box.left < -1 || box.right > document.documentElement.clientWidth + 1);
            }).map(el => el.className);
        const textStyles = [...document.querySelectorAll('.question-prompt, .option-text, .timer-display, .save-status-text, .exam-context-subtitle')]
            .filter(visible).map(el => {
                const style = getComputedStyle(el);
                return { role: el.className, color: style.color, fontSize: style.fontSize, lineHeight: style.lineHeight };
            });
        const focusedOption = document.querySelector('.option-item-label:focus-within');
        return {
            scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
            textOverflow, targets, textStyles,
            timer: document.querySelector('.timer-value')?.textContent,
            saveStatus: document.querySelector('.save-status-text')?.textContent,
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            focusedOption: focusedOption ? {
                outlineStyle: getComputedStyle(focusedOption).outlineStyle,
                outlineWidth: getComputedStyle(focusedOption).outlineWidth,
            } : null,
        };
    });
    const viewport = page.viewportSize();
    const name = `workspace-${scenario}-${viewport?.width}x${viewport?.height}-${test.info().project.name}`;
    const screenshot = `${name}.png`;
    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
    writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
        ...workspaceMetadata(page, scenario), screenshot, fullPage, metrics,
        accessibilitySnapshot: await page.locator('.options-list').ariaSnapshot(),
    }, null, 2));
    // Baseline captures describe known defects; these thresholds become mandatory for the UI candidate.
    if (workspacePhase === 'after') {
        expect(metrics.scrollWidth, `${scenario}: document overflow`).toBeLessThanOrEqual(metrics.clientWidth);
        expect(metrics.textOverflow, `${scenario}: clipped/wide text`).toEqual([]);
        expect(metrics.targets.filter(t => t.width < 43.99 || t.height < 43.99), `${scenario}: targets below 44px`).toEqual([]);
        if (scenario.includes('keyboard')) {
            expect(metrics.focusedOption?.outlineStyle).toBe('solid');
            expect(parseFloat(metrics.focusedOption?.outlineWidth ?? '0')).toBeGreaterThanOrEqual(2);
        }
    }
}

/** Primary matrix plus short/landscape/reflow stress. Other engines keep their existing project viewport. */
export async function captureWorkspaceReading(page: Page): Promise<void> {
    const original = page.viewportSize();
    if (!original) throw new Error('Workspace captures require a viewport.');
    const sizes = test.info().project.name === 'desktop-1280' ? [
        { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 },
        { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 },
        { width: 1440, height: 900 }, { width: 320, height: 568 }, { width: 568, height: 320 },
        { width: 360, height: 480 }, { width: 1280, height: 360 },
    ] : [original];
    for (const size of sizes) {
        await page.setViewportSize(size);
        await page.evaluate(() => window.scrollTo(0, 0));
        await captureWorkspace(page, 'long-reading');
        await page.locator('.option-item-label').last().scrollIntoViewIfNeeded();
        await captureWorkspace(page, 'long-options');
        if (size.width === 360 || size.width === 1280) await captureWorkspace(page, 'long-full', true);
    }
    await page.setViewportSize(original);
    // Explicit 200% text-resize emulation, not a claim of native browser zoom or a physical device.
    // Compute all sizes first to avoid multiplying inherited sizes more than once. Restore every style.
    await page.evaluate(() => {
        const entries = [...document.querySelectorAll<HTMLElement>('.workstation-container, .workstation-container *')]
            .map(el => ({ el, style: el.getAttribute('style'), size: parseFloat(getComputedStyle(el).fontSize) * 2 }));
        for (const { el, style, size } of entries) {
            el.dataset['workspaceOriginalStyle'] = JSON.stringify(style);
            el.style.setProperty('font-size', `${size}px`, 'important');
        }
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await captureWorkspace(page, 'text-resize-200-percent');
    await page.evaluate(() => {
        for (const el of document.querySelectorAll<HTMLElement>('[data-workspace-original-style]')) {
            const style: string | null = JSON.parse(el.dataset['workspaceOriginalStyle']!);
            if (style === null) el.removeAttribute('style'); else el.setAttribute('style', style);
            delete el.dataset['workspaceOriginalStyle'];
        }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('Tab');
    await page.locator('.options-list input[type=radio]').first().focus();
    await captureWorkspace(page, 'keyboard-reduced-motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => window.scrollTo(0, 0));
}

// Preserve existing pause/lock/message/Teacher-preview captures as supplementary evidence.
// Their existing assertions and capture sites remain untouched; no new screenshot is fabricated.
test.afterEach(async ({ page }, info) => {
    if (!existsSync(info.outputDir)) return;
    for (const file of readdirSync(info.outputDir).filter(name => /^(paused|locked|broadcast-student|teacher-exam-preview)-.*\.png$/.test(name))) {
        const screenshot = `workspace-existing-${file}`;
        copyFileSync(path.join(info.outputDir, file), info.outputPath(screenshot));
        writeFileSync(info.outputPath(screenshot.replace(/\.png$/, '.json')), JSON.stringify({
            ...workspaceMetadata(page, file.replace(/\.png$/, '')), screenshot,
            capture: 'existing E2E screenshot; project viewport; no new layout measurements',
            test: info.title,
        }, null, 2));
    }
});

/**
 * Opens the client in a page that has not shown it yet. Every page of the client sends
 * Cross-Origin-Opener-Policy: same-origin, so this first navigation moves the page from
 * about:blank into a new browsing context group. After that switch Playwright's Firefox
 * driver sometimes never reports the load event although every file was served (CI runs 28
 * and 29). The tests need the rendered client, not the load event: wait for the navigation
 * to commit, then for the client to render. A navigation that really fails still fails.
 */
export async function open(page: Page, url = '/'): Promise<void> {
    try {
        await page.goto(url, { waitUntil: 'commit', timeout: 20_000 });
    } catch (err) {
        if (!(err instanceof errors.TimeoutError)) throw err;
    }
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\//);
    await expect(page.locator('#root > *').first()).toBeAttached();
}

/** A value stored in the page's current document, so that its replacement can be proven (E2E-002). */
const DOCUMENT_MARKER = '__elligbleE2eDocument';
const NAVIGATION_TIMEOUT = 20_000;

/**
 * The page's document as it is now, read inside the page in one step. A read that fails, or that
 * does not complete within a second because a navigation is still under way, is reported, not thrown.
 */
async function readDocument(page: Page) {
    const read = page.evaluate(key => ({
        marker: (window as unknown as Record<string, unknown>)[key] ?? null,
        href: location.href,
        navigation: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? null,
        readyState: document.readyState,
        rendered: document.querySelector('#root > *') !== null,
    }), DOCUMENT_MARKER).catch((err: unknown) => ({ unreadable: String(err).split('\n')[0] }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Promise<{ pending: true }>(resolve => { timer = setTimeout(() => resolve({ pending: true }), 1_000); });
    try {
        return await Promise.race([read, pending]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Replaces the document of a page that already shows the client and proves the replacement: a
 * value stored in the old document for this call is gone, the new document has the expected
 * address and kind of navigation, the client rendered in it and the page itself finished
 * loading. Like open(), it never waits for Playwright's load event, which the Firefox driver
 * sometimes never reports, also for a reload (CI runs 52 and 53). A navigation that really
 * fails, or a page that never renders or never finishes loading, still fails.
 */
async function replaceDocument(page: Page, navigation: 'reload' | 'navigate', target: (current: string) => string,
    go: () => Promise<{ status(): number } | null>): Promise<void> {
    const current = await page.evaluate(([key, value]) => {
        (window as unknown as Record<string, unknown>)[key] = value;
        return location.href;
    }, [DOCUMENT_MARKER, randomUUID()] as const);
    const expected = target(current);
    let status: number | undefined;
    try {
        status = (await go())?.status();
    } catch (err) {
        if (!(err instanceof errors.TimeoutError)) throw err;
    }
    if (status !== undefined) expect(status, `${navigation} of ${expected}: status of the document`).toBeLessThan(400);
    // Playwright's Firefox driver performs a reload as a navigation whose timing entry says 'navigate' (CI run
    // 40195497143, contract v0.5); Chromium and WebKit say 'reload'. In Firefox the reload is proven by the call in
    // reloadPage, the replaced document, the address, the rendered client and the finished load.
    const kinds: string[] = navigation === 'reload' && page.context().browser()?.browserType().name() === 'firefox' ? ['reload', 'navigate'] : [navigation];
    await expect.poll(async () => {
        const read = await readDocument(page);
        return 'navigation' in read && kinds.includes(String(read.navigation)) ? { ...read, navigation } : read;
    }, {
        message: `${navigation} of ${expected}: the old document is gone, and the client rendered and loaded in the new one`,
        timeout: NAVIGATION_TIMEOUT,
    }).toEqual({ marker: null, href: expected, navigation, readyState: 'complete', rendered: true });
    await expect(page).toHaveURL(expected);
}

/** Reloads a page that already shows the client: a real browser reload, proven as above. */
export async function reloadPage(page: Page): Promise<void> {
    await replaceDocument(page, 'reload', current => current, () => page.reload({ waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT }));
}

/** Moves a page that already shows the client to another address of the client, proven as above. */
export async function navigatePage(page: Page, url: string): Promise<void> {
    await replaceDocument(page, 'navigate', () => new URL(url, state.baseUrl).href, () => page.goto(url, { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT }));
}

/** First sign-in with the activation card printed by the operator CLI. */
export async function activate(page: Page, elligbleId: string, password: string): Promise<void> {
    await open(page);
    await page.getByRole('button', { name: 'Belum pernah masuk? Aktifkan akun dengan kode aktivasi' }).click();
    await page.getByLabel('ELLIGBLE ID', { exact: true }).fill(elligbleId);
    await page.getByLabel('Kode Aktivasi').fill(state.cards[elligbleId]);
    await page.getByLabel('Kata Sandi Baru', { exact: true }).fill(password);
    await page.getByLabel('Ulangi Kata Sandi Baru').fill(password);
    await page.getByRole('button', { name: 'Aktifkan dan Masuk' }).click();
}

export async function login(page: Page, elligbleId: string, password: string): Promise<void> {
    await open(page);
    await page.getByLabel('ELLIGBLE ID', { exact: true }).fill(elligbleId);
    await page.getByLabel('Kata Sandi', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}

export async function startExam(page: Page): Promise<string> {
    await page.getByRole('button', { name: 'Mulai Ujian' }).click();
    await page.getByRole('button', { name: 'Mulai Ujian Sekarang' }).click();
    await expect(page.getByText('Hasil dari 2 + 3 adalah')).toBeVisible();
    return new URL(page.url()).searchParams.get('attemptId')!;
}

/** Continues an attempt started earlier (from the exam list), taking the session over if needed. */
export async function continueExam(page: Page): Promise<string> {
    await page.getByRole('button', { name: 'Mulai Pengerjaan' }).click();
    const launch = page.getByRole('button', { name: 'Mulai Ujian Sekarang' });
    const takeover = page.getByRole('button', { name: 'Ya, Pindahkan Sesi' });
    const workstation = page.getByText('Hasil dari 2 + 3 adalah');
    await expect(launch.or(takeover).or(workstation)).toBeVisible();
    if (await takeover.isVisible()) await takeover.click();
    if (await launch.isVisible()) await launch.click();
    await expect(workstation).toBeVisible();
    return new URL(page.url()).searchParams.get('attemptId')!;
}

/** The paths of every file the page requests from now on (WEB-001: what each role downloads). */
export function requestedPaths(page: Page): string[] {
    const paths: string[] = [];
    page.on('request', request => paths.push(new URL(request.url()).pathname));
    return paths;
}

/** The built file of the teacher and proctor screens, which a student never downloads (WEB-001). */
export const STAFF_SCREEN_FILE = /^\/assets\/staff-screens-[\w-]+\.js$/;

export const option = (page: Page, index: number) => page.locator('.options-list label').nth(index);

/** Wide screens (1024 px and more) show the question list beside the question; narrow ones open it as a sheet. */
export const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

/** The question list: the side panel on wide screens, the "Daftar Soal" sheet (opened here) otherwise. */
export async function openQuestionList(page: Page): Promise<Locator> {
    if (isWide(page)) return page.getByRole('navigation', { name: 'Daftar Soal Ujian' });
    await page.getByRole('button', { name: 'Daftar Soal' }).click();
    return page.getByRole('dialog', { name: 'Daftar Soal' });
}

export async function closeQuestionList(page: Page): Promise<void> {
    if (!isWide(page)) await page.getByRole('dialog', { name: 'Daftar Soal' }).getByRole('button', { name: 'Tutup daftar soal' }).click();
}

/** Wall-clock date and time in WIB, the school's zone, `minutes` from now, as a datetime-local field takes it. */
export function wib(minutes: number): string {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + minutes * 60_000)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Screenshot name with the project (browser and width) it was taken in. */
export const shotName = (name: string) => `${name}-${test.info().project.name}.png`;
export const saveStatus = (page: Page) => page.locator('.save-status-text');

/** Server answers as the signed-in student sees them (same origin, session cookie). */
export async function serverAnswers(page: Page, attemptId: string): Promise<string[]> {
    return page.evaluate(async ({ id, tenant }) => {
        const res = await fetch(`/api/v1/assessment/resume?attemptId=${id}`, { headers: { 'X-Tenant-ID': tenant } });
        const body = await res.json();
        return body.answers.map((a: { answerPayload: { selectedOptionId: string } }) => a.answerPayload.selectedOptionId);
    }, { id: attemptId, tenant: state.tenantId });
}

export async function withDatabase<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
    const url = new URL(state.adminUrl);
    url.pathname = `/${state.databaseName}`;
    const client = new pg.Client({ connectionString: url.toString() });
    await client.connect();
    try {
        return await run(client);
    } finally {
        await client.end();
    }
}

/** Moves a student's attempt start back so that its server time has run out. */
export async function expireAttemptOf(elligbleId: string): Promise<void> {
    await withDatabase(client => client.query(
        `UPDATE secure_assessment_timer_state t
         SET started_at = statement_timestamp() - (t.configured_duration_seconds + 1) * interval '1 second'
         FROM secure_assessment_exam_attempts a
         JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id
         JOIN identity_user_accounts ua ON ua.person_id = p.person_id
         JOIN identity_account_credentials c ON c.user_account_id = ua.id
         WHERE t.exam_attempt_id = a.id AND c.username = $1`,
        [elligbleId]
    ));
}

/** Timer presentation fixtures on the disposable CI database, using the actual server calculation.
 * Like expireAttemptOf, this changes fixture time only, never the application clock or response.
 * The original start is restored before any later lifecycle/scoring test runs.
 */
export async function captureWorkspaceTimer(page: Page, attemptId: string): Promise<void> {
    const original = await withDatabase(async client => (await client.query<{ started_at: string }>(
        'SELECT started_at::text FROM secure_assessment_timer_state WHERE exam_attempt_id = $1 AND tenant_id = $2',
        [attemptId, state.tenantId]
    )).rows[0]);
    if (!original) throw new Error('Timer fixture does not belong to the isolated student attempt.');
    try {
        for (const [seconds, scenario, status] of [[240, 'timer-warning', 'warning'], [45, 'timer-urgent', 'urgent']] as const) {
            await withDatabase(client => client.query(
                `UPDATE secure_assessment_timer_state
                 SET started_at = statement_timestamp() - (configured_duration_seconds - $3) * interval '1 second'
                 WHERE exam_attempt_id = $1 AND tenant_id = $2`, [attemptId, state.tenantId, seconds]
            ));
            await reloadPage(page);
            await expect(page.locator('.timer-display')).toHaveClass(new RegExp(status));
            await captureWorkspace(page, scenario);
        }
    } finally {
        await withDatabase(client => client.query(
            'UPDATE secure_assessment_timer_state SET started_at = $3::timestamptz WHERE exam_attempt_id = $1 AND tenant_id = $2',
            [attemptId, state.tenantId, original.started_at]
        ));
        await reloadPage(page);
    }
}
