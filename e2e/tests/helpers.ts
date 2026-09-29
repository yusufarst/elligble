import { expect, type Page } from '@playwright/test';
import pg from 'pg';
import { readState } from '../state.ts';

export const state = readState();

/** First sign-in with the activation card printed by the operator CLI. */
export async function activate(page: Page, elligbleId: string, password: string): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: 'Belum pernah masuk? Aktifkan akun dengan kode aktivasi' }).click();
    await page.getByLabel('ELLIGBLE ID', { exact: true }).fill(elligbleId);
    await page.getByLabel('Kode Aktivasi').fill(state.cards[elligbleId]);
    await page.getByLabel('Kata Sandi Baru', { exact: true }).fill(password);
    await page.getByLabel('Ulangi Kata Sandi Baru').fill(password);
    await page.getByRole('button', { name: 'Aktifkan dan Masuk' }).click();
}

export async function login(page: Page, elligbleId: string, password: string): Promise<void> {
    await page.goto('/');
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

export const option = (page: Page, index: number) => page.locator('.options-list label').nth(index);
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
