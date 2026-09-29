import { expect, test } from '@playwright/test';
import { activate, continueExam, login, option, saveStatus, serverAnswers, startExam, state } from './helpers.ts';

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

test('a "Ragu-ragu" mark survives a reload, follows the server and never changes the answer', async ({ page }) => {
    await login(page, 'siswa.e2e.03', 'bintang-kejora-2026');
    const attemptId = await continueExam(page);
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Bilangan prima terkecil adalah')).toBeVisible();
    await option(page, 2).click();
    await expect(saveStatus(page)).toHaveText('Tersimpan');
    const flag = page.getByRole('checkbox', { name: 'Ragu-ragu' });
    await flag.check();
    await page.getByRole('button', { name: 'Daftar Soal' }).click();
    const sheet = page.getByRole('dialog', { name: 'Daftar Soal' });
    await expect(sheet.getByRole('button', { name: 'Pindah ke soal nomor 2, status sudah dijawab, ditandai ragu-ragu' })).toBeVisible();
    await expect(sheet.getByText('Ragu-ragu:')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('ragu-ragu-sheet-360.png'), animations: 'disabled' });
    await sheet.getByRole('button', { name: 'Tutup daftar soal' }).click();

    const flagsOnServer = () => page.evaluate(async ({ id, tenant }) => {
        const res = await fetch(`/api/v1/assessment/resume?attemptId=${id}`, { headers: { 'X-Tenant-ID': tenant } });
        return (await res.json()).reviewFlags as string[];
    }, { id: attemptId, tenant: state.tenantId });
    await expect.poll(flagsOnServer).toHaveLength(1);

    await page.reload();
    await expect(page.getByText('Hasil dari 2 + 3 adalah')).toBeVisible();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByRole('checkbox', { name: 'Ragu-ragu' })).toBeChecked();
    await expect(page.locator('.options-list input[type=radio]').nth(2)).toBeChecked();
    await page.screenshot({ path: test.info().outputPath('ragu-ragu-360.png'), fullPage: true });

    await page.getByRole('checkbox', { name: 'Ragu-ragu' }).uncheck();
    await expect.poll(flagsOnServer).toHaveLength(0);
    expect(await serverAnswers(page, attemptId)).toHaveLength(2);
});
