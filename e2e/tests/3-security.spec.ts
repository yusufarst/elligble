import { expect, test } from '@playwright/test';
import { activate, option, saveStatus, serverAnswers, startExam, state, withDatabase } from './helpers.ts';

// Isolation and session expiry in the browser: another school's data, another student's
// attempt, and a session that ends in the middle of an exam without losing answers
// (DEC-041: authentication timeout must not lose active exam answers).

test('another school and another student’s attempt are refused', async ({ page, browser }) => {
    await activate(page, 'siswa.e2e.05', 'bintang-kejora-2026');
    const attemptId = await startExam(page);

    const status = await page.evaluate(async ({ other }) => {
        const res = await fetch('/api/v1/assessment/assigned-exams', { headers: { 'X-Tenant-ID': other } });
        return res.status;
    }, { other: state.otherTenantId });
    expect(status).toBe(403);

    const intruderContext = await browser.newContext();
    const intruder = await intruderContext.newPage();
    await activate(intruder, 'siswa.e2e.06', 'bintang-kejora-2026');
    await expect(intruder.getByText('Daftar Ujian Siswa')).toBeVisible();
    await intruder.goto(`/?attemptId=${attemptId}`);
    await expect(intruder.getByRole('heading', { name: 'Akses Ditolak' })).toBeVisible();
    await intruderContext.close();
});

test('a session that ends mid-exam asks the same student to sign in again and loses no answer', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('ELLIGBLE ID', { exact: true }).fill('siswa.e2e.05');
    await page.getByLabel('Kata Sandi', { exact: true }).fill('bintang-kejora-2026');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    // The attempt started in the previous test continues from the exam list.
    await page.getByRole('button', { name: 'Mulai Pengerjaan' }).click();
    const launch = page.getByRole('button', { name: 'Mulai Ujian Sekarang' });
    const takeover = page.getByRole('button', { name: 'Ya, Pindahkan Sesi' });
    await expect(launch.or(takeover).or(page.getByText('Hasil dari 2 + 3 adalah'))).toBeVisible();
    if (await takeover.isVisible()) await takeover.click();
    await expect(page.getByText('Hasil dari 2 + 3 adalah')).toBeVisible();
    const attemptId = new URL(page.url()).searchParams.get('attemptId')!;

    await withDatabase(client => client.query(
        `UPDATE identity_sessions SET is_revoked = TRUE
         WHERE user_account_id = (SELECT user_account_id FROM identity_account_credentials WHERE username = 'siswa.e2e.05')`
    ));
    await option(page, 2).click();
    await expect(page.getByRole('heading', { name: 'Sesi Anda Telah Berakhir' })).toBeVisible();
    await expect(page.getByText('Hasil dari 2 + 3 adalah')).toBeAttached();
    await page.getByLabel('Kata Sandi', { exact: true }).fill('bintang-kejora-2026');
    await page.getByRole('button', { name: 'Masuk Kembali' }).click();
    await expect(saveStatus(page)).toHaveText('Tersimpan', { timeout: 30_000 });
    expect(await serverAnswers(page, attemptId)).toHaveLength(1);
});
