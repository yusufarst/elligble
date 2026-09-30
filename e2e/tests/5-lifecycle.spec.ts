import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { continueExam, expireAttemptOf, login, option, saveStatus, state, withDatabase } from './helpers.ts';

// Pause, resume and end on the real production process (Owner decision 2026-09-30). Runs
// last: it ends the shared exam. A paused exam hides the questions and freezes the time;
// an answer chosen before the pause is saved even when it reaches the server during the
// pause; a choice made during the pause on a device that did not know about it is not
// saved and the student is told; resume continues from the frozen time; end lets a running
// attempt finish and stops new starts.

const PASSWORD = 'bintang-kejora-2026';

async function answersOf(elligbleId: string): Promise<Record<number, string>> {
    return withDatabase(async client => Object.fromEntries((await client.query(
        `SELECT q.display_order AS n, x.answer_payload->>'selectedOptionId' AS option
         FROM secure_assessment_exam_answers x
         JOIN secure_assessment_exam_question_snapshots q ON q.id = x.exam_question_snapshot_id
         JOIN secure_assessment_exam_attempts a ON a.id = x.exam_attempt_id
         JOIN secure_assessment_exam_participants p ON p.id = a.exam_participant_id
         JOIN identity_user_accounts ua ON ua.person_id = p.person_id
         JOIN identity_account_credentials c ON c.user_account_id = ua.id
         WHERE c.username = $1`,
        [elligbleId]
    )).rows.map(r => [Number(r.n), r.option as string])));
}

/** The id of the option shown at position index (0 = A) of question no. */
async function optionId(no: number, index: number): Promise<string> {
    return withDatabase(async client => (await client.query(
        `SELECT frozen_content->'options'->$3::int->>'id' AS id FROM secure_assessment_exam_question_snapshots
         WHERE exam_instance_id = $1 AND display_order = $2`,
        [state.examInstanceId, no, index]
    )).rows[0].id as string);
}

function seconds(clock: string): number {
    return clock.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
}

async function teacherAction(page: Page, button: string, confirm: string): Promise<void> {
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByRole('heading', { name: confirm })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: button }).click();
}

test('a pause freezes the student screen, keeps the answer chosen before it, drops a choice made during it, and resume continues exactly', async ({ page, context, browser }) => {
    await login(page, 'siswa.e2e.03', PASSWORD);
    const attemptId = await continueExam(page);
    const before = await answersOf('siswa.e2e.03');
    expect(before[3]).toBeUndefined();

    // Chosen before the pause, but this device is offline so it waits on the device.
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Bilangan prima terkecil adalah')).toBeVisible();
    await context.setOffline(true);
    await option(page, 1).click();
    await expect(saveStatus(page)).toHaveText('Gagal menyimpan');

    const teacherContext = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'id-ID', timezoneId: 'UTC' });
    const teacher = await teacherContext.newPage();
    await login(teacher, 'guru.e2e', 'papan-tulis-hijau');
    await teacherAction(teacher, 'Jeda Ujian', 'Jeda Ujian untuk Semua Peserta?');
    await expect(teacher.getByText(/^Ujian dijeda sejak \d{2}\.\d{2} WIB$/)).toBeVisible();

    // Still offline and unaware of the pause, the student changes another answer.
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Akar kuadrat dari 81 adalah')).toBeVisible();
    await option(page, 3).click();

    await context.setOffline(false);
    await expect(page.getByRole('heading', { name: 'Ujian Dijeda' })).toBeVisible();
    await expect(page.getByText('Akar kuadrat dari 81 adalah')).toHaveCount(0);
    await expect(page.getByText('Pilihan jawaban pada soal 3 dibuat setelah ujian dijeda sehingga tidak disimpan. Periksa kembali soal tersebut.')).toBeVisible();
    await expect(page.getByText('Semua jawaban yang Anda pilih sebelum ujian dijeda sudah tersimpan.')).toBeVisible({ timeout: 30_000 });
    const during = await answersOf('siswa.e2e.03');
    expect(during[2]).toBe(await optionId(2, 1));
    expect(during[3]).toBeUndefined();
    expect(during[1]).toBe(before[1]);

    // Frozen time, also after a reload.
    const frozen = seconds(await page.locator('.paused-remaining-value').innerText());
    await page.waitForTimeout(2100);
    expect(seconds(await page.locator('.paused-remaining-value').innerText())).toBe(frozen);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('paused-360.png'), fullPage: true });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ujian Dijeda' })).toBeVisible();
    expect(seconds(await page.locator('.paused-remaining-value').innerText())).toBe(frozen);

    // Resume: the questions return with the same remaining time.
    await teacherAction(teacher, 'Lanjutkan Ujian', 'Lanjutkan Ujian?');
    await expect(teacher.getByText('Berlangsung')).toBeVisible();
    await expect(page.getByText('Hasil dari 2 + 3 adalah')).toBeVisible({ timeout: 15_000 });
    const resumed = seconds(await page.locator('.timer-value').innerText());
    expect(frozen - resumed).toBeGreaterThanOrEqual(0);
    expect(frozen - resumed).toBeLessThanOrEqual(10);
    const exact = await withDatabase(async client => (await client.query(
        `SELECT secure_assessment_attempt_remaining_seconds(ps.tenant_id, $1, ps.paused_at) AS at_pause,
                secure_assessment_attempt_remaining_seconds(ps.tenant_id, $1, ps.resumed_at) AS at_resume
         FROM secure_assessment_exam_pauses ps WHERE ps.exam_instance_id = $2`,
        [attemptId, state.examInstanceId]
    )).rows[0]);
    expect(exact.at_resume).toBe(exact.at_pause);

    // Working again: a new choice on question 3 saves normally.
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Akar kuadrat dari 81 adalah')).toBeVisible();
    await expect(page.locator('.options-list input[type=radio]:checked')).toHaveCount(0);
    await option(page, 2).click();
    await expect(saveStatus(page)).toHaveText('Tersimpan');
    expect((await answersOf('siswa.e2e.03'))[3]).toBe(await optionId(3, 2));
    await teacherContext.close();
});

test('ending the exam stops new starts only: a running attempt keeps working and submits', async ({ page, browser }) => {
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await teacherAction(page, 'Akhiri Ujian', 'Akhiri Ujian?');
    await expect(page.getByText('Diakhiri', { exact: true })).toBeVisible();

    const waitingContext = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'id-ID', timezoneId: 'UTC' });
    const waiting = await waitingContext.newPage();
    await login(waiting, 'siswa.e2e.06', PASSWORD);
    await expect(waiting.getByText('Waktu pelaksanaan ujian telah berakhir.')).toBeVisible();
    await expect(waiting.getByRole('button', { name: 'Mulai Ujian' })).toHaveCount(0);
    await waitingContext.close();

    const studentContext = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'id-ID', timezoneId: 'UTC' });
    const student = await studentContext.newPage();
    await login(student, 'siswa.e2e.03', PASSWORD);
    await continueExam(student);
    await expect(student.getByText('Guru telah mengakhiri ujian. Anda tetap dapat menyelesaikan sampai waktu Anda habis.')).toBeVisible();
    await option(student, 1).click();
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
    await student.getByRole('dialog').getByRole('checkbox').check();
    await student.getByRole('button', { name: 'Kirim Jawaban Sekarang' }).click();
    await expect(student.getByText('Ujian Berhasil Dikumpulkan')).toBeVisible();
    await studentContext.close();

    await page.getByRole('button', { name: 'Perbarui Data' }).click();
    await expect(page.getByText(/^Ujian telah diakhiri\./)).toBeVisible();
});

test('the teacher finalizes once every attempt is finished; the results are final and still hidden from students', async ({ page, browser }) => {
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await expect(page.getByText('Diakhiri', { exact: true })).toBeVisible();
    // Two students are still working on their own time.
    await expect(page.getByRole('button', { name: 'Finalisasi Hasil' })).toBeDisabled();
    await expect(page.getByText('Finalisasi dapat dilakukan setelah semua peserta selesai.')).toBeVisible();

    await expireAttemptOf('siswa.e2e.04');
    await expireAttemptOf('siswa.e2e.05');
    await expect(async () => {
        await page.getByRole('button', { name: 'Perbarui Data' }).click();
        await expect(page.getByRole('button', { name: 'Finalisasi Hasil' })).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    await teacherAction(page, 'Finalisasi Hasil', 'Finalisasi Hasil Ujian?');
    await expect(page.getByText('Hasil Final', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Hasil difinalisasi .* WIB\. Nilai tidak ditampilkan kepada siswa\.$/)).toBeVisible();

    await page.getByRole('button', { name: 'Lihat Hasil' }).click();
    await expect(page.getByText('Hasil final', { exact: true })).toBeVisible();
    const row = (id: string) => page.getByRole('row').filter({ has: page.getByText(id, { exact: true }) });
    await expect(row('siswa.e2e.06')).toContainText('Tidak mengerjakan');
    await expect(row('siswa.e2e.06')).toContainText('Tidak ada nilai');
    await expect(row('siswa.e2e.04')).toContainText('Dikumpulkan otomatis');
    await page.getByRole('button', { name: 'Tampilkan Nilai' }).click();
    await expect(row('siswa.e2e.01')).toContainText('66,67');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('final-results-360.png'), fullPage: true });

    // Export (D04.8-52/53): one self-describing row per participant, Indonesian spreadsheet form.
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^hasil-ujian_matematika-wajib_x-e2e_\d{4}-\d{2}-\d{2}_final\.csv$/);
    const csv = readFileSync(await download.path(), 'utf8');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
    expect(lines).toHaveLength(7);
    expect(lines[0].split(';').slice(0, 6)).toEqual(['Mata pelajaran', 'Kelas', 'Jenis penilaian', 'Status hasil', 'Waktu finalisasi (WIB)', 'ELLIGBLE ID']);
    expect(lines.find(line => line.includes(';siswa.e2e.01;'))).toContain(';Dikumpulkan;Oleh siswa;');
    expect(lines.find(line => line.includes(';siswa.e2e.01;'))).toContain(';66,67;BASELINE_SINGLE_CHOICE_V1');
    expect(lines.find(line => line.includes(';siswa.e2e.06;'))).toMatch(/;Tidak mengerjakan(;){10}$/);

    // Printing keeps the table and drops the controls.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: 'Unduh CSV' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Keluar' })).toBeHidden();
    await expect(row('siswa.e2e.01')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('final-results-print-360.png'), fullPage: true });
    await page.emulateMedia({ media: 'screen' });

    const frozen = await withDatabase(async client => (await client.query(
        `SELECT f.scoring_rule, count(r.*)::int AS rows, count(*) FILTER (WHERE r.standing = 'ABSENT')::int AS absent
         FROM secure_assessment_exam_result_finalizations f JOIN secure_assessment_attempt_results r ON r.finalization_id = f.id
         WHERE f.exam_instance_id = $1 GROUP BY f.scoring_rule`,
        [state.examInstanceId]
    )).rows[0]);
    expect(frozen).toEqual({ scoring_rule: 'BASELINE_SINGLE_CHOICE_V1', rows: 6, absent: 1 });

    // Finalized is not published: the student still sees no score.
    const studentContext = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'id-ID', timezoneId: 'UTC' });
    const student = await studentContext.newPage();
    await login(student, 'siswa.e2e.01', PASSWORD);
    await expect(student.getByText('Sudah dikumpulkan')).toBeVisible();
    await expect(student.getByText(/Nilai|66,67/)).toHaveCount(0);
    await studentContext.close();
});
