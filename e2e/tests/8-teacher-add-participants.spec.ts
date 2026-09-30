import { expect, test } from '@playwright/test';
import { login, shotName, wib, withDatabase } from './helpers.ts';

// The teacher adds a student after scheduling (ASSESS-TEACHER-004; D04.2-64): schedule an exam
// for the day after tomorrow leaving one student out, mark it ready, then add that student
// from "Tambah Peserta". The ready exam is scheduled again and marked ready anew; the added
// student now finds the exam; the database keeps who added whom, when and from which
// enrollment. Runs after the cancellation journey.

test.describe.configure({ mode: 'serial' });

const PASSWORD = 'bintang-kejora-2026';
const QUESTIONS = [
    'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',
    '1;Hasil dari 9 x 6 adalah;45;54;56;63;64;B;1',
    '2;Hasil dari 100 : 4 adalah;20;24;25;30;40;C;1',
].join('\r\n') + '\r\n';
const START = 2 * 24 * 60 + 60;
const END = START + 120;

const noOverflow = (page: import('@playwright/test').Page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Every action of an exam card stays inside the card: a row of actions wraps, never overflows it. */
const actionsInside = (card: import('@playwright/test').Locator) => card.evaluate(el => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll('button')].every(b => {
        const r = b.getBoundingClientRect();
        return r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
    });
});

test('a teacher adds a student left out of a scheduled exam, who then finds it', async ({ page, browser }) => {
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await page.getByRole('button', { name: 'Buat Ujian' }).first().click();
    await expect(page.getByRole('heading', { name: 'Buat Ujian dari Berkas Soal' })).toBeVisible();
    await page.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await page.getByLabel('Mulai (WIB)').fill(wib(START));
    await page.getByLabel('Selesai (WIB)').fill(wib(END));
    await page.getByLabel('Durasi pengerjaan (menit)').fill('45');
    await page.getByRole('radio', { name: /Durasi penuh/ }).check();
    await page.getByLabel('Berkas CSV').setInputFiles({ name: 'kuis-lusa.csv', mimeType: 'text/csv', buffer: Buffer.from(QUESTIONS, 'utf8') });
    await page.getByRole('button', { name: 'Periksa Soal dan Jadwal' }).click();
    await expect(page.getByText('Soal dan jadwal siap dijadwalkan')).toBeVisible();
    await page.getByRole('checkbox', { name: 'siswa.e2e.06' }).uncheck();
    await page.getByRole('button', { name: 'Periksa Lagi' }).click();
    await expect(page.getByText('Peserta (5 dari 6)')).toBeVisible();
    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'dijadwalkan dengan 2 soal dan 5 peserta' })).toBeVisible();

    const examId: string = await withDatabase(async client => (await client.query(
        `SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name = 'kuis-lusa.csv'`
    )).rows[0].exam_instance_id);
    const card = page.getByTestId(`teacher-exam-${examId}`);
    await expect(card).toContainText('5 peserta');
    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(card).toContainText('Siap Dibuka');
    // Five actions on a ready exam card: at every width they stay inside the card.
    expect(await actionsInside(card)).toBe(true);

    // The student left out does not find the exam.
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC' });
    const student = await studentContext.newPage();
    await login(student, 'siswa.e2e.06', PASSWORD);
    await expect(student.getByRole('heading', { name: 'Daftar Ujian Siswa' })).toBeVisible();
    await expect(student.getByTestId(`assignment-${examId}`)).toHaveCount(0);

    // The teacher adds the student; the ready exam has to be marked ready again.
    await card.getByRole('button', { name: 'Tambah Peserta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Peserta' });
    await expect(dialog).toContainText('perlu ditandai siap lagi');
    await expect(dialog).toContainText('tidak dapat dihapus di aplikasi');
    await expect(dialog).toContainText('Peserta saat ini: 5');
    await expect(dialog.getByRole('checkbox')).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Tambahkan Peserta' })).toBeDisabled();
    await dialog.getByRole('checkbox', { name: 'siswa.e2e.06' }).check();
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('add-participants')), fullPage: true });
    await dialog.getByRole('button', { name: 'Tambahkan 1 Peserta' }).click();
    await expect(page.getByRole('status').filter({ hasText: '1 peserta ditambahkan ke ujian Matematika Wajib. Tandai siap lagi sebelum membuka ujian.' })).toBeVisible();
    await expect(card).toContainText('Terjadwal');
    await expect(card).toContainText('6 peserta');
    await expect(card).toContainText('Peserta ditambahkan');
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(shotName('participants-added')), fullPage: true });

    // Nobody is left to add.
    await card.getByRole('button', { name: 'Tambah Peserta' }).click();
    await expect(dialog).toContainText('Semua siswa yang terdaftar di kelas ini pada hari ujian sudah menjadi peserta.');
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toHaveCount(0);

    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(card).toContainText('Siap Dibuka');

    // The added student now finds it.
    await student.reload();
    await expect(student.getByTestId(`assignment-${examId}`)).toBeVisible();
    await studentContext.close();

    const kept = await withDatabase(async client => (await client.query(
        `SELECT a.previous_lifecycle_state, c.username AS teacher,
                (SELECT array_agg(sc.username) FROM secure_assessment_exam_participant_addition_entries e
                 JOIN secure_assessment_exam_participants p ON p.id = e.exam_participant_id AND p.academic_enrollment_id = e.academic_enrollment_id
                 JOIN identity_user_accounts su ON su.person_id = p.person_id
                 JOIN identity_account_credentials sc ON sc.user_account_id = su.id
                 WHERE e.participant_addition_id = a.id) AS added,
                (SELECT count(*)::int FROM secure_assessment_exam_participants p WHERE p.exam_instance_id = a.exam_instance_id) AS participants,
                (SELECT array_agg(l.from_state || '>' || l.to_state ORDER BY l.occurred_at) FROM secure_assessment_exam_lifecycle_events l
                 WHERE l.exam_instance_id = a.exam_instance_id) AS transitions
         FROM secure_assessment_exam_participant_additions a
         JOIN identity_user_accounts ua ON ua.person_id = a.added_by_person_id
         JOIN identity_account_credentials c ON c.user_account_id = ua.id
         WHERE a.exam_instance_id = $1`,
        [examId]
    )).rows);
    expect(kept).toEqual([{
        previous_lifecycle_state: 'READY', teacher: 'guru.e2e', added: ['siswa.e2e.06'], participants: 6,
        transitions: ['DRAFT>SCHEDULED', 'SCHEDULED>READY', 'READY>SCHEDULED', 'SCHEDULED>READY'],
    }]);
});
