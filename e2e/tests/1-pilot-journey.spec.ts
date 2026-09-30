import { expect, test } from '@playwright/test';
import { STAFF_SCREEN_FILE, activate, option, requestedPaths, saveStatus, startExam, state } from './helpers.ts';

// The pilot journey: provisioning CLI -> activation cards -> teacher opens the exam ->
// proctor monitors -> a student answers, reloads, submits once.

test.describe.configure({ mode: 'serial' });

test('the teacher activates their account and opens the imported exam', async ({ page }) => {
    const requested = requestedPaths(page);
    await activate(page, 'guru.e2e', 'papan-tulis-hijau');
    await expect(page.getByRole('heading', { name: 'Pelaksanaan Ujian' })).toBeVisible();
    // The teacher's screen is downloaded when it is first shown (WEB-001). Its heading shows
    // while the file downloads, so wait for the request itself rather than for the heading.
    await expect.poll(() => requested.some(path => STAFF_SCREEN_FILE.test(path) && path.startsWith('/assets/TeacherReadinessView-'))).toBe(true);
    await expect(page.getByText('Terjadwal')).toBeVisible();
    await page.getByRole('button', { name: 'Tandai Siap' }).click();
    await page.getByRole('button', { name: 'Buka Ujian' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Buka Ujian' }).click();
    await expect(page.getByText('Berlangsung').first()).toBeVisible();
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

    await option(page, 1).click();
    await expect(saveStatus(page)).toHaveText('Tersimpan');
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Bilangan prima terkecil adalah')).toBeVisible();
    await option(page, 2).click();
    await expect(saveStatus(page)).toHaveText('Tersimpan');

    await page.reload();
    await expect(page.getByText('Hasil dari 2 + 3 adalah')).toBeVisible();
    await expect(page.locator('.options-list input[type=radio]').nth(1)).toBeChecked();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.locator('.options-list input[type=radio]').nth(2)).toBeChecked();

    await page.getByRole('button', { name: 'Selesaikan Ujian' }).click();
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
