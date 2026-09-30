import { expect, test, type Page } from '@playwright/test';
import { expireAttemptOf, login, withDatabase } from './helpers.ts';

// Results after the exam (D04.5-47, D04.8): a student whose device was away when the time
// ran out is finalized by the server from the answers it accepted, and the teacher who
// manages the exam sees provisional results, scores hidden until shown, never ranked.

async function finalizationSourceOf(elligbleId: string): Promise<string | null> {
    return withDatabase(async client => (await client.query(
        `SELECT s.finalization_source FROM secure_assessment_exam_submissions s
         JOIN secure_assessment_exam_attempts a ON a.id = s.exam_attempt_id
         JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id
         JOIN identity_user_accounts ua ON ua.person_id = p.person_id
         JOIN identity_account_credentials c ON c.user_account_id = ua.id
         WHERE c.username = $1`,
        [elligbleId]
    )).rows[0]?.finalization_source ?? null);
}

const row = (page: Page, elligbleId: string) => page.getByRole('row').filter({ has: page.getByText(elligbleId, { exact: true }) });

test('a device away at time expiry is finalized by the server; the teacher sees provisional results', async ({ page }) => {
    // siswa.e2e.02 answered question 1 wrongly (offline test) and never submitted.
    await expireAttemptOf('siswa.e2e.02');
    await expect.poll(() => finalizationSourceOf('siswa.e2e.02'), { timeout: 20_000 }).toBe('EXPIRY_SERVER');

    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await expect(page.getByRole('heading', { name: 'Pelaksanaan Ujian' })).toBeVisible();
    await page.getByRole('button', { name: 'Lihat Hasil' }).click();
    await expect(page.getByRole('heading', { name: 'Hasil Ujian' })).toBeVisible();
    await expect(page).toHaveURL(/view=teacher&examResults=/);
    await expect(page.getByText('Hasil sementara')).toBeVisible();

    const ids = await page.locator('tbody th[scope=row] > span:first-child').allTextContents();
    expect(ids).toEqual(['siswa.e2e.01', 'siswa.e2e.02', 'siswa.e2e.03', 'siswa.e2e.04', 'siswa.e2e.05', 'siswa.e2e.06']);
    await expect(page.getByLabel('Disembunyikan')).toHaveCount(4);
    await expect(page.getByText('66,67')).toHaveCount(0);

    await page.getByRole('button', { name: 'Tampilkan Nilai' }).click();
    await expect(row(page, 'siswa.e2e.01')).toContainText('Dikumpulkan');
    await expect(row(page, 'siswa.e2e.01')).toContainText('2/3');
    await expect(row(page, 'siswa.e2e.01')).toContainText('66,67');
    await expect(row(page, 'siswa.e2e.02')).toContainText('Dikumpulkan otomatis');
    await expect(row(page, 'siswa.e2e.02')).toContainText('Waktu habis saat perangkat tidak terhubung');
    await expect(row(page, 'siswa.e2e.02')).toContainText('0/3');
    await expect(row(page, 'siswa.e2e.03')).toContainText('Sedang mengerjakan');
    await expect(row(page, 'siswa.e2e.06')).toContainText('Belum mulai');
    await expect(row(page, 'siswa.e2e.06')).toContainText('Belum ada nilai');

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('results-360.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: test.info().outputPath('results-1280.png'), fullPage: true });

    // Reload keeps the teacher on the results; back returns to Pelaksanaan Ujian.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hasil Ujian' })).toBeVisible();
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();
    await expect(page.getByRole('heading', { name: 'Pelaksanaan Ujian' })).toBeVisible();
});

test('the student whose time ran out away from the device sees the attempt as submitted, without a score', async ({ page }) => {
    await login(page, 'siswa.e2e.02', 'bintang-kejora-2026');
    await expect(page.getByText('Sudah dikumpulkan')).toBeVisible();
    await expect(page.getByText(/Nilai|66,67|\b0\/3\b/)).toHaveCount(0);
});

test('the proctor sees who is expected, working, finished or moved to another device', async ({ page }) => {
    await login(page, 'pengawas.e2e', 'ruang-ujian-tenang');
    await expect(page.getByRole('heading', { name: 'Monitoring Ujian' })).toBeVisible();
    await page.getByRole('button', { name: 'Lihat Peserta' }).click();
    await expect(page.getByRole('heading', { name: 'Pemantauan Peserta' })).toBeVisible();
    await expect(page).toHaveURL(/view=proctor&monitorExam=/);
    await expect(page.getByText(/^Diperbarui \d{2}\.\d{2}\.\d{2} WIB/)).toBeVisible();

    const ids = await page.locator('tbody th[scope=row] > span:first-child').allTextContents();
    expect(ids).toEqual(['siswa.e2e.01', 'siswa.e2e.02', 'siswa.e2e.03', 'siswa.e2e.04', 'siswa.e2e.05', 'siswa.e2e.06']);
    await expect(row(page, 'siswa.e2e.01')).toContainText('Dikumpulkan');
    await expect(row(page, 'siswa.e2e.02')).toContainText('Dikumpulkan otomatis');
    await expect(row(page, 'siswa.e2e.03')).toContainText('Mengerjakan');
    await expect(row(page, 'siswa.e2e.04')).toContainText('Pindah perangkat');
    await expect(row(page, 'siswa.e2e.06')).toContainText('Belum mulai');
    await expect(page.getByText(/66,67|Nilai/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Belum mulai', exact: true }).click();
    await expect(page.locator('tbody th[scope=row] > span:first-child')).toHaveText(['siswa.e2e.06']);
    await page.getByRole('button', { name: 'Semua', exact: true }).click();
    await page.getByLabel('Cari ELLIGBLE ID').fill('e2e.04');
    await expect(page.locator('tbody th[scope=row] > span:first-child')).toHaveText(['siswa.e2e.04']);
    await page.getByLabel('Cari ELLIGBLE ID').fill('');

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('monitoring-360.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: test.info().outputPath('monitoring-1280.png'), fullPage: true });
});
