import { expect, test } from '@playwright/test';
import { activate, option, saveStatus, serverAnswers, startExam } from './helpers.ts';

// Answer preservation (D04.5-17..24, PB07): offline answering, reload with unsynced
// choices, and one active exam session per attempt across tabs (D04.4-32/35/37).

test('answers given offline are kept honestly and delivered when the connection returns', async ({ page, context }) => {
    await activate(page, 'siswa.e2e.02', 'bintang-kejora-2026');
    const attemptId = await startExam(page);
    await context.setOffline(true);
    await option(page, 3).click();
    await expect(saveStatus(page)).toHaveText('Gagal menyimpan');
    await expect(page.locator('.connection-banner')).toContainText('Koneksi terputus. Jawaban disimpan sementara di perangkat ini');
    await expect(page.getByRole('button', { name: 'Selesaikan Ujian' })).toBeDisabled();
    await context.setOffline(false);
    await expect(saveStatus(page)).toHaveText('Tersimpan', { timeout: 30_000 });
    await expect(page.locator('.connection-banner')).toHaveCount(0);
    expect(await serverAnswers(page, attemptId)).toHaveLength(1);
});

test('a reload while saves fail restores the unsynced choice from this device and syncs it later', async ({ page }) => {
    await activate(page, 'siswa.e2e.03', 'bintang-kejora-2026');
    const attemptId = await startExam(page);
    await page.route('**/api/v1/assessment/answer/save', route => route.abort('failed'));
    await option(page, 4).click();
    await expect(saveStatus(page)).toHaveText('Gagal menyimpan');
    await page.reload();
    await expect(page.locator('.options-list input[type=radio]').nth(4)).toBeChecked();
    await expect(saveStatus(page)).toHaveText('Gagal menyimpan');
    expect(await serverAnswers(page, attemptId)).toHaveLength(0);
    await page.unroute('**/api/v1/assessment/answer/save');
    await expect(saveStatus(page)).toHaveText('Tersimpan', { timeout: 30_000 });
    expect(await serverAnswers(page, attemptId)).toHaveLength(1);
});

test('a second tab needs explicit takeover; the first tab stops writing; a duplicated tab cannot reuse the session', async ({ page, context }) => {
    await activate(page, 'siswa.e2e.04', 'bintang-kejora-2026');
    await startExam(page);
    const url = page.url();

    const second = await context.newPage();
    await second.goto(url);
    await expect(second.getByRole('heading', { name: 'Sesi Aktif Ditemukan' })).toBeVisible();
    await second.getByRole('button', { name: 'Ya, Pindahkan Sesi' }).click();
    await expect(second.getByText('Hasil dari 2 + 3 adalah')).toBeVisible();

    await option(page, 0).click();
    await expect(page.getByRole('heading', { name: 'Sesi Dipindahkan' })).toBeVisible();

    // "Duplicate tab" copies sessionStorage; the Web Lock held by the second tab refuses it.
    const copied = await second.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(sessionStorage))));
    const duplicate = await context.newPage();
    await duplicate.addInitScript(data => {
        if (!sessionStorage.getItem('__copied')) {
            for (const [key, value] of Object.entries(JSON.parse(data) as Record<string, string>)) sessionStorage.setItem(key, value);
            sessionStorage.setItem('__copied', '1');
        }
    }, copied);
    await duplicate.goto(url);
    await expect(duplicate.getByRole('heading', { name: 'Sesi Aktif Ditemukan' })).toBeVisible();

    await second.bringToFront();
    await option(second, 1).click();
    await expect(saveStatus(second)).toHaveText('Tersimpan');
});
