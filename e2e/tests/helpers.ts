import { randomUUID } from 'node:crypto';
import { errors, expect, test, type Locator, type Page } from '@playwright/test';
import pg from 'pg';
import { readState } from '../state.ts';

export const state = readState();

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
