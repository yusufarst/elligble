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
