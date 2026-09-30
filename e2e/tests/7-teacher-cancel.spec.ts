import { expect, test, type Page } from '@playwright/test';
import { login, shotName, wib, withDatabase } from './helpers.ts';

// The teacher cancels an exam before it opens (ASSESS-TEACHER-003; D04.2-47, Owner decision
// 2026-09-30): schedule an exam for tomorrow, see a student find it, cancel it with a reason,
// and then: the student no longer finds it, the teacher keeps it as "Dibatalkan" with the
// reason, and the same class can be scheduled again at the same time. The database keeps the
// exam, its participants and questions, and a cancellation named by the lifecycle history.
// Runs after the teacher import journey.

test.describe.configure({ mode: 'serial' });

const PASSWORD = 'bintang-kejora-2026';
const QUESTIONS = [
    'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',
    '1;Hasil dari 7 x 8 adalah;54;56;58;64;72;B;1',
    '2;Akar kuadrat dari 81 adalah;7;8;9;10;11;C;1',
].join('\r\n') + '\r\n';
const TOMORROW_START = 24 * 60 + 60;
const TOMORROW_END = TOMORROW_START + 120;

async function scheduleTomorrow(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Buat Ujian' }).first().click();
    await expect(page.getByRole('heading', { name: 'Buat Ujian dari Berkas Soal' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Matematika Wajib · X-E2E/ })).toBeChecked();
    await page.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await page.getByLabel('Mulai (WIB)').fill(wib(TOMORROW_START));
    await page.getByLabel('Selesai (WIB)').fill(wib(TOMORROW_END));
    await page.getByLabel('Durasi pengerjaan (menit)').fill('45');
    await page.getByRole('radio', { name: /Durasi penuh/ }).check();
    await page.getByLabel('Berkas CSV').setInputFiles({ name: 'kuis-besok.csv', mimeType: 'text/csv', buffer: Buffer.from(QUESTIONS, 'utf8') });
    await page.getByRole('button', { name: 'Periksa Soal dan Jadwal' }).click();
    await expect(page.getByText('Soal dan jadwal siap dijadwalkan')).toBeVisible();
    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'dijadwalkan dengan 2 soal' })).toBeVisible();
}

test('a teacher cancels an exam before it opens; students no longer see it and its time is free again', async ({ page, browser }) => {
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await scheduleTomorrow(page);
    const card = page.locator('.teacher-exam-card').filter({ hasText: 'Terjadwal' });
    await expect(card).toHaveCount(1);

    // A student finds tomorrow's exam before it is cancelled.
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC' });
    const student = await studentContext.newPage();
    await login(student, 'siswa.e2e.02', PASSWORD);
    const tomorrowCards = student.locator('.discovery-card').filter({ hasText: /Ujian dibuka .+ setelah guru atau pengawas membukanya\./ });
    await expect(tomorrowCards).toHaveCount(1);

    // The teacher cancels it with a reason; nothing can be opened afterwards.
    await card.getByRole('button', { name: 'Batalkan Ujian' }).click();
    const dialog = page.getByRole('dialog', { name: 'Batalkan Ujian Ini?' });
    await expect(dialog).toContainText('tidak lagi tampil di daftar ujian siswa');
    await expect(dialog.getByRole('button', { name: 'Batalkan Ujian' })).toBeDisabled();
    await dialog.getByLabel('Alasan pembatalan').fill('Bentrok dengan kegiatan sekolah');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('cancel-exam')), fullPage: true });
    await dialog.getByRole('button', { name: 'Batalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Ujian Matematika Wajib dibatalkan dan tidak lagi tampil untuk siswa.' })).toBeVisible();

    const history = page.getByRole('region', { name: 'Ujian Dibatalkan' });
    await expect(history.locator('.teacher-exam-card')).toHaveCount(1);
    await expect(history).toContainText('Dibatalkan');
    await expect(history).toContainText('oleh Anda. Alasan: Bentrok dengan kegiatan sekolah');
    await expect(history.getByRole('button')).toHaveCount(0);
    await expect(page.locator('.teacher-exam-card').filter({ hasText: 'Terjadwal' })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('ARCHIVED');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('cancelled-history')), fullPage: true });

    // The student no longer finds it.
    await student.reload();
    await expect(student.getByRole('heading', { name: 'Daftar Ujian Siswa' })).toBeVisible();
    await expect(tomorrowCards).toHaveCount(0);
    await expect(student.locator('body')).not.toContainText('ARCHIVED');
    await studentContext.close();

    // The same class at the same time is free again.
    await scheduleTomorrow(page);
    await expect(page.locator('.teacher-exam-card').filter({ hasText: 'Terjadwal' })).toHaveCount(1);

    const kept = await withDatabase(async client => (await client.query(
        `SELECT i.lifecycle_state, c.reason, c.previous_lifecycle_state, cr.username AS teacher,
                e.from_state || '>' || e.to_state AS transition, e.cancellation_id = c.id AS named,
                (SELECT count(*)::int FROM secure_assessment_exam_participants p WHERE p.exam_instance_id = i.id) AS participants,
                (SELECT count(*)::int FROM secure_assessment_exam_question_snapshots s WHERE s.exam_instance_id = i.id) AS questions
         FROM secure_assessment_exam_cancellations c
         JOIN secure_assessment_exam_instances i ON i.id = c.exam_instance_id
         JOIN secure_assessment_exam_lifecycle_events e ON e.exam_instance_id = i.id AND e.to_state = 'ARCHIVED'
         JOIN identity_user_accounts ua ON ua.person_id = c.cancelled_by_person_id
         JOIN identity_account_credentials cr ON cr.user_account_id = ua.id`
    )).rows);
    expect(kept).toEqual([{
        lifecycle_state: 'ARCHIVED', reason: 'Bentrok dengan kegiatan sekolah', previous_lifecycle_state: 'SCHEDULED', teacher: 'guru.e2e',
        transition: 'SCHEDULED>ARCHIVED', named: true, participants: 6, questions: 2,
    }]);
});
