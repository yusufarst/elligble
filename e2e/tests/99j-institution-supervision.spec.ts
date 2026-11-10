import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { login, open, startExam, state, wib, withDatabase } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

// ASSESS-INSTITUTION-003 five-browser journey and rendered evidence (record §7 C06/C07). The file sorts after 99i
// (Playwright orders files with localeCompare). Its session is placed through the product on a later day than every
// earlier spec; rooms and Proctors are set through the product; the exam is marked ready through the product after
// its deadline. Fixture SQL then does what the product refuses for a session in the past (E16): it stores the
// synthetic questions before the deadline, opens the exam window at the current time, frees the class of any exam
// of an earlier spec still running at this time, and adds a second, scheduled exam to the session so a session-wide
// control has an exam it does not affect. pengawas.e2e is given the School Operator assignment here and has it
// revoked at the end, as 99h and 99i do; it is also the Proctor of "Ruang A" (P03). guru.e2e is the subject Teacher
// and the Proctor of "Ruang B", where siswa.e2e.06 sits. The scenario set is bounded (record R7): ten captures.
// Navigation only through the shared helpers and the in-app refresh (no browser reload, CI #234).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-INSTITUTION-003 capture SHA mismatch');
// The post-merge main of ASSESS-INSTITUTION-002 (PR #36); its CI run and artifact manifest are recorded in the Task record.
const BASELINE = { run: 237, commit: 'e1f2ec46826930862bc69ce76a55c2b251a9cd25', frontendTree: '4fe5237b74d383e53f6459d037d3cd3f34e2f520', manifestSha256: 'f9aa59d5435d795e648ee0e334d2614e81fae070f880d82f9143fb2c1d16445e', record: 'ASSESS-INSTITUTION-003 §10' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const OPERATOR = ['pengawas.e2e', 'ruang-ujian-tenang'] as const;
const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const SUBJECT_OPTION = 'Matematika Wajib · X-E2E · guru.e2e';
const EXAM_LABEL = 'Matematika Wajib · X-E2E';
const LABEL = 'PTS Pelaksanaan E2E';
const RUNNING_LINE = 'Ujian ini sedang dilaksanakan. Pemantauan dilakukan operator sekolah dan pengawas ruang. Kemajuan peserta tampil setelah ujian berakhir.';
const FULL = [360, 390, 430, 768, 1024, 1280, 1440].map(width => ({ width, height: 800, text: 1 })).concat([{ width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }, { width: 1280, height: 800, text: 2 }]);

/** The school-zone (WIB) date `days` from today. */
const wibDay = (days: number) => wib(days * 24 * 60).slice(0, 10);

async function capture(page: Page, scenario: string, root: () => Locator, variants = FULL): Promise<void> {
    const original = page.viewportSize();
    const browser = page.context().browser();
    if (!original || !browser) throw new Error('A real browser and viewport are required');
    try {
        for (const v of variants) {
            await page.setViewportSize({ width: v.width, height: v.height });
            const name = ['workspace-institution-supervision', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
            const metadataPath = test.info().outputPath(`${name}.json`);
            let captureWritten = false;
            await expect(root()).toBeVisible();
            await page.evaluate(async () => { await document.fonts.ready; });
            // Snapshot every baseline BEFORE any mutation. Leave the root font unchanged so
            // rem-based geometry is not zoomed along with the text, and inheritance cannot compound.
            const calibration = v.text === 2 ? await page.evaluateHandle(() => ({
                rootStyle: document.documentElement.getAttribute('style'),
                rootFont: getComputedStyle(document.documentElement).fontSize,
                nodes: [document.body, ...document.body.querySelectorAll<HTMLElement>('*')]
                    .filter((node): node is HTMLElement => node instanceof HTMLElement)
                    .map(node => {
                        const style = getComputedStyle(node);
                        return { node, originalStyle: node.getAttribute('style'), font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
                    }),
            })) : null;
            try {
                if (calibration) await calibration.evaluate(snapshot => {
                    for (const { node, font, line } of snapshot.nodes) {
                        node.style.fontSize = String(font * 2) + 'px';
                        if (Number.isFinite(line)) node.style.lineHeight = String(line * 2) + 'px';
                    }
                });
                await page.evaluate(async () => { await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); });
                const textCalibration = calibration ? await calibration.evaluate(snapshot => {
                    const calibrated = new Set(snapshot.nodes.map(({ node }) => node));
                    const current = [document.body, ...document.body.querySelectorAll<HTMLElement>('*')].filter((node): node is HTMLElement => node instanceof HTMLElement);
                    const measured = snapshot.nodes.map(({ node, font, line }) => {
                        const style = getComputedStyle(node);
                        return { font, line, actualFont: parseFloat(style.fontSize), actualLine: parseFloat(style.lineHeight) };
                    });
                    const ratios = measured.filter(n => Number.isFinite(n.font) && Number.isFinite(n.actualFont) && n.font > 0).map(n => n.actualFont / n.font);
                    return {
                        method: 'two-pass-computed-text-only', elements: measured.length,
                        detachedElements: snapshot.nodes.filter(({ node }) => !node.isConnected).length,
                        unscaledElements: current.filter(node => !calibrated.has(node)).length,
                        minFontRatio: Math.min(...ratios), maxFontRatio: Math.max(...ratios),
                        fontMismatches: measured.filter(n => !Number.isFinite(n.font) || !Number.isFinite(n.actualFont) || Math.abs(n.actualFont - n.font * 2) > 0.02).length,
                        lineMismatches: measured.filter(n => Number.isFinite(n.line) && (!Number.isFinite(n.actualLine) || Math.abs(n.actualLine - n.line * 2) > 0.02)).length,
                        rootUnchanged: document.documentElement.getAttribute('style') === snapshot.rootStyle && getComputedStyle(document.documentElement).fontSize === snapshot.rootFont,
                    };
                }) : undefined;
                if (textCalibration) {
                    expect(textCalibration.elements).toBeGreaterThan(0);
                    expect(textCalibration.detachedElements, 'No calibrated element was replaced before capture').toBe(0);
                    expect(textCalibration.unscaledElements, 'Every current HTML element belongs to the calibrated snapshot').toBe(0);
                    expect(textCalibration.fontMismatches, 'Every captured element has 200% of its original computed text size').toBe(0);
                    expect(textCalibration.lineMismatches, 'Every numeric line height is doubled once').toBe(0);
                    expect(textCalibration.rootUnchanged, 'Text resize must not zoom rem geometry').toBe(true);
                }
                const metrics = await root().evaluate(element => {
                    const targets = [...element.querySelectorAll<HTMLElement>('button, input, textarea, select, summary')].filter(n => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0; })
                        .map(n => { const t = n instanceof HTMLInputElement && ['checkbox', 'radio'].includes(n.type) ? n.closest('label') ?? n : n; const b = t.getBoundingClientRect(); return { name: n.getAttribute('aria-label') ?? t.textContent?.trim().slice(0, 60) ?? n.tagName, width: b.width, height: b.height }; });
                    const active = document.activeElement as HTMLElement | null;
                    // Metric labels wrap at spaces only (F7): no metric uses overflow-wrap: anywhere.
                    const metricWraps = [...document.querySelectorAll<HTMLElement>('[data-slot="metric"] dt')].map(n => getComputedStyle(n).overflowWrap).filter(w => w === 'anywhere');
                    return {
                        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets, metricWraps,
                        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        focus: active ? { tag: active.tagName, type: (active as HTMLInputElement).type ?? null, label: active.getAttribute('aria-label') } : null,
                        // The outermost elements past the right edge that no scrolling or clipping ancestor contains, with their right edge and text.
                        overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(n => {
                            if (n.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5) return false;
                            for (let up = n.parentElement; up && up !== document.body; up = up.parentElement) {
                                if (getComputedStyle(up).overflowX !== 'visible') return false;
                                if (up.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5) return false;
                            }
                            return true;
                        }).slice(0, 8).map(n => `${n.tagName.toLowerCase()}.${String(n.getAttribute('class') ?? '').slice(0, 80)} right=${Math.round(n.getBoundingClientRect().right)} ${(n.textContent ?? '').trim().slice(0, 40)}`),
                    };
                });
                const screenshot = `${name}.png`;
                // The larger of the document and body heights: with a dialog open, WebKit sizes the full page by
                // the body. A screenshot WebKit still refuses as too large falls back to the viewport, recorded
                // as fullPage false (as 99h, CI #223).
                let fullPage = (await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) * window.devicePixelRatio)) <= 30000;
                try {
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                } catch (error) {
                    if (!fullPage || !String(error).includes('larger than')) throw error;
                    fullPage = false;
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                }
                writeFileSync(metadataPath, JSON.stringify({
                    task: 'ASSESS-INSTITUTION-003', phase: 'after', commit, frontendTree, baseline: BASELINE,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256 },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, textCalibration, scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                captureWritten = true;
                expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow ${JSON.stringify(metrics.overflowing)}`).toBeLessThanOrEqual(metrics.clientWidth);
                expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
                expect.soft(metrics.metricWraps, `${scenario} ${v.width}x${v.height} text${v.text}: mid-word metric labels`).toEqual([]);
            } finally {
                if (calibration) {
                    try {
                        const restoration = await calibration.evaluate(snapshot => {
                            for (const { node, originalStyle } of snapshot.nodes) {
                                if (originalStyle === null) node.removeAttribute('style'); else node.setAttribute('style', originalStyle);
                            }
                            return {
                                elements: snapshot.nodes.length,
                                inlineStyleMismatches: snapshot.nodes.filter(({ node, originalStyle }) => node.getAttribute('style') !== originalStyle).length,
                                rootUnchanged: document.documentElement.getAttribute('style') === snapshot.rootStyle && getComputedStyle(document.documentElement).fontSize === snapshot.rootFont,
                            };
                        });
                        if (captureWritten) {
                            const metadata: Record<string, unknown> = JSON.parse(readFileSync(metadataPath, 'utf8'));
                            writeFileSync(metadataPath, JSON.stringify({ ...metadata, textRestoration: restoration }, null, 2));
                        }
                        expect(restoration.inlineStyleMismatches, 'Restore every exact original inline style before the next capture').toBe(0);
                        expect(restoration.rootUnchanged, 'Root font and inline style remain at their original values').toBe(true);
                    } finally { await calibration.dispose(); }
                }
            }
        }
    } finally { await page.setViewportSize(original); }
}

async function operatorAssignment(action: 'ASSIGN' | 'REVOKE'): Promise<void> {
    await withDatabase(async c => {
        const person = (await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id = a.id WHERE cr.username = $1', [OPERATOR[0]])).rows[0].person_id as string;
        await c.query('BEGIN');
        try {
            await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-003', reason: 'Synthetic institution supervision' });
            await c.query('COMMIT');
        } catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
    });
}

/** The exam placed in the period (one Matematika x X-E2E per period). */
async function examOf(periodLabel: string): Promise<string> {
    return withDatabase(async c => (await c.query(
        `SELECT i.id FROM secure_assessment_exam_instances i
         JOIN secure_assessment_institution_exam_sessions s ON s.id = i.institution_session_id
         JOIN secure_assessment_institution_exam_periods p ON p.id = s.period_id
         WHERE p.tenant_id = $1 AND p.label = $2 ORDER BY i.id LIMIT 1`, [state.tenantId, periodLabel])).rows[0].id as string);
}

async function deadlinePassed(examId: string): Promise<boolean> {
    return withDatabase(async c => (await c.query(
        `SELECT max(deadline_at) <= statement_timestamp() AS passed FROM secure_assessment_institution_preparation_deadlines WHERE exam_instance_id = $1`, [examId])).rows[0].passed === true);
}

/** Fixture SQL (E16): synthetic questions stored before the deadline; the first is the one startExam waits for. */
async function addQuestions(examId: string): Promise<void> {
    await withDatabase(async c => {
        const prompts = [['Hasil dari 2 + 3 adalah', ['4', '5', '6', '7', '8'], 'B'], ['Bilangan prima terkecil adalah', ['0', '1', '2', '3', '4'], 'C']] as const;
        for (const [index, [prompt, options, correct]] of prompts.entries()) {
            await c.query(
                'INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, $4)',
                [state.tenantId, examId, JSON.stringify({
                    schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt,
                    options: ['A', 'B', 'C', 'D', 'E'].map((id, k) => ({ id, content: options[k] })), correctOptionId: correct, maxScore: 1,
                }), index + 1]);
        }
    });
}

/**
 * Fixture SQL (E16), after the product marked the exam ready: its window opens now (the product refuses a session in
 * the past), any exam of an earlier spec still scheduled or running at this time with the same students or Proctors is
 * ended so the class is free (the readiness re-check at opening refuses an overlap), and a second exam, scheduled and
 * without participants, joins the session so a session-wide control has an exam it does not affect.
 */
async function openWindowNow(examId: string): Promise<string> {
    return withDatabase(async c => {
        await c.query(
            `UPDATE secure_assessment_exam_instances
             SET window_starts_at = statement_timestamp() - interval '2 minutes', window_ends_at = statement_timestamp() + interval '120 minutes'
             WHERE id = $1`, [examId]);
        await c.query(
            `UPDATE secure_assessment_exam_instances i SET lifecycle_state = 'ENDED'
             FROM secure_assessment_exam_instances mine
             WHERE mine.id = $2 AND i.tenant_id = $1 AND i.id <> mine.id
               AND i.institution_session_id IS DISTINCT FROM mine.institution_session_id
               AND i.lifecycle_state IN ('SCHEDULED', 'READY', 'ACTIVE', 'PAUSED')
               AND i.window_starts_at < mine.window_ends_at AND i.window_ends_at > mine.window_starts_at
               AND (EXISTS (SELECT 1 FROM secure_assessment_exam_participants p
                            JOIN secure_assessment_exam_participants own ON own.person_id = p.person_id AND own.tenant_id = p.tenant_id AND own.exam_instance_id = mine.id
                            WHERE p.tenant_id = i.tenant_id AND p.exam_instance_id = i.id)
                    OR EXISTS (SELECT 1 FROM secure_assessment_proctor_assignments pa
                               JOIN secure_assessment_proctor_assignments own ON own.person_id = pa.person_id AND own.tenant_id = pa.tenant_id
                                AND own.exam_instance_id = mine.id AND own.revoked_at IS NULL
                               WHERE pa.tenant_id = i.tenant_id AND pa.exam_instance_id = i.id AND pa.revoked_at IS NULL))`,
            [state.tenantId, examId]);
        return (await c.query(
            `INSERT INTO secure_assessment_exam_instances (
                 tenant_id, teaching_assignment_id, assessment_type_id, lifecycle_state, window_starts_at, window_ends_at,
                 configured_attempt_duration_seconds, latest_start_policy, room_based_operations_enabled, proctor_per_room_required, institution_session_id)
             SELECT tenant_id, teaching_assignment_id, assessment_type_id, 'SCHEDULED', window_starts_at, window_ends_at,
                    configured_attempt_duration_seconds, latest_start_policy, TRUE, TRUE, institution_session_id
             FROM secure_assessment_exam_instances WHERE id = $1 RETURNING id`, [examId])).rows[0].id as string;
    });
}

const notice = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });
const main = (page: Page) => () => page.locator('main').first();
const periodCard = (page: Page, label: string) => page.locator('[data-testid^="institution-period-"]').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
const roomCard = (page: Page, label: string) => page.getByTestId(`institution-room-${label}`);
const roomExamCard = (page: Page, examId: string) => page.getByTestId(`institution-room-exam-${examId}`);
const examCard = (page: Page, examId: string) => page.getByTestId(`institution-exam-${examId}`);
const supervisedCard = (page: Page, examId: string) => page.getByTestId(`supervision-exam-${examId}`);

async function openInstitution(page: Page): Promise<void> {
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
}

async function openPeriod(page: Page, label: string): Promise<void> {
    const card = periodCard(page, label);
    // Wait for the overview to render the card first (isVisible() does not wait; CI #222).
    await expect(card).toBeVisible();
    const button = card.getByRole('button', { name: 'Buka Periode' });
    if (await button.isVisible()) await button.click();
    await expect(card.getByRole('button', { name: 'Tambah Sesi' })).toBeVisible();
}

async function createPeriod(page: Page, label: string): Promise<void> {
    await page.getByRole('button', { name: 'Buat Periode' }).click();
    const dialog = page.getByRole('dialog', { name: 'Buat Periode Ujian' });
    await dialog.getByLabel('Nama periode').fill(label);
    await dialog.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await dialog.getByLabel('Periode Akademik').selectOption({ label: 'Semester E2E' });
    await dialog.getByRole('button', { name: 'Simpan Periode' }).click();
    await expect(notice(page, 'Periode ujian tersimpan.')).toBeVisible();
    await expect(periodCard(page, label).getByRole('button', { name: 'Tambah Sesi' })).toBeVisible();
}

async function addSession(page: Page, label: string, date: string): Promise<void> {
    await periodCard(page, label).getByRole('button', { name: 'Tambah Sesi' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Sesi' });
    await dialog.getByLabel('Tanggal').fill(date);
    await dialog.getByLabel('Jam mulai').fill('08:00');
    await dialog.getByLabel('Jam selesai').fill('10:00');
    await dialog.getByRole('button', { name: 'Simpan Sesi' }).click();
    await expect(notice(page, 'Sesi tersimpan.')).toBeVisible();
    await expect(periodCard(page, label).getByRole('heading', { level: 3, name: /^Jadwal Sesi: / })).toBeVisible();
}

async function placeExam(page: Page, label: string, deadline: string): Promise<string> {
    await periodCard(page, label).getByRole('button', { name: 'Tempatkan Ujian' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tempatkan Ujian di Sesi' });
    await dialog.getByLabel('Mata pelajaran dan rombel').selectOption({ label: SUBJECT_OPTION });
    await dialog.getByLabel('Durasi pengerjaan (menit)').fill('60');
    await dialog.getByRole('radio', { name: /Durasi penuh/ }).check();
    await dialog.getByLabel('Tenggat penyiapan soal').fill(deadline);
    await dialog.getByRole('button', { name: 'Tempatkan Ujian', exact: true }).click();
    await expect(notice(page, /Matematika Wajib · X-E2E ditempatkan dengan \d+ peserta\./)).toBeVisible();
    return examOf(label);
}

async function openRooms(page: Page, label: string): Promise<void> {
    await openPeriod(page, label);
    await periodCard(page, label).getByRole('button', { name: 'Ruang dan Pengawas', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ruang dan Pengawas' })).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Daftar Ruang' })).toBeVisible();
}

async function backToPeriods(page: Page, trigger: string): Promise<void> {
    await page.getByRole('button', { name: 'Kembali ke Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
    await expect(page.getByRole('button', { name: trigger, exact: true }).first()).toBeFocused();
}

/** "Tambah Ruang": every participant without a room, or one student from any room. */
async function saveRoom(page: Page, label: string, student?: string): Promise<void> {
    await page.getByRole('button', { name: 'Tambah Ruang', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Ruang' });
    await dialog.getByLabel('Nama ruang').fill(label);
    if (student) {
        await dialog.getByLabel('Tampilkan').selectOption({ label: 'Semua peserta' });
        await dialog.getByRole('checkbox', { name: new RegExp(`^${student.replace(/\./g, '\\.')}\\b`) }).check();
    } else {
        await dialog.getByRole('button', { name: /^Pilih semua / }).click();
    }
    await dialog.getByRole('button', { name: 'Simpan Ruang', exact: true }).click();
    await expect(notice(page, new RegExp(`^Peserta ditempatkan di ${label}: \\d+ peserta\\.`))).toBeFocused();
}

async function saveProctor(page: Page, room: string, id: string): Promise<void> {
    await roomCard(page, room).getByRole('button', { name: 'Atur Pengawas', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Atur Pengawas ${room}` });
    await dialog.getByLabel('ELLIGBLE ID pengawas').fill(id);
    await dialog.getByRole('button', { name: 'Tambahkan', exact: true }).click();
    await expect(dialog.getByRole('button', { name: `Hapus ${id}`, exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    await expect(notice(page, `Pengawas ${room} tersimpan.`)).toBeFocused();
}

/** "Pelaksanaan Sesi" of the period's only session: the title takes focus. */
async function openSupervision(page: Page): Promise<void> {
    await openPeriod(page, LABEL);
    await periodCard(page, LABEL).getByRole('button', { name: 'Pelaksanaan Sesi', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pelaksanaan Sesi' })).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Ujian di Sesi Ini' })).toBeVisible();
}

/** A control dialog: the reason, the confirmation, then the notice of the outcome takes focus. */
async function confirmControl(page: Page, dialog: Locator, confirm: string, reason: string, done: string | RegExp): Promise<void> {
    await dialog.getByLabel('Alasan tindakan', { exact: true }).fill(reason);
    await dialog.getByRole('button', { name: confirm, exact: true }).click();
    const shown = notice(page, done);
    await expect(shown).toBeVisible();
    await expect(shown).toBeFocused();
}

/** The in-app refresh of "Pelaksanaan Sesi" (never a browser reload: CI #234). */
async function refreshSupervision(page: Page): Promise<void> {
    const button = page.getByRole('button', { name: 'Perbarui', exact: true });
    await button.click();
    await expect(button).toBeEnabled();
}

const focusIsOnBody = (page: Page) => page.evaluate(() => document.activeElement === document.body || document.activeElement === null);

/** The student's screen checks its state now, as on a reconnect (5-lifecycle). */
const nudge = (student: Page) => student.evaluate(() => window.dispatchEvent(new Event('online')));

async function teacherContext(browser: Browser, page: Page): Promise<Page> {
    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const teacher = await context.newPage();
    await login(teacher, ...TEACHER);
    // guru.e2e is also the Proctor of "Ruang B" in a running exam here, so it may land on its first workspace,
    // "Ruang Ujian" (AppShell order: proctor before teacher; CI #245). Open "Pelaksanaan Ujian" from the navigation.
    await teacher.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Pelaksanaan Ujian', exact: true }).click();
    await expect(teacher.getByRole('heading', { level: 1, name: 'Pelaksanaan Ujian' })).toBeVisible();
    return teacher;
}

test.beforeAll(async () => operatorAssignment('ASSIGN'));
test.afterAll(async () => operatorAssignment('REVOKE'));

test('ASSESS-INSTITUTION-003 journey and captures: open, the Student, lock, time, message, the session paused and resumed, the Teacher card, the Proctor, a stale tab, end', async ({ page, browser }) => {
    test.setTimeout(45 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);

    // Setup through the product: a later-day session, the exam (deadline about two minutes ahead), its questions by
    // fixture SQL before the deadline, "Ruang A" with every participant and pengawas.e2e, "Ruang B" with the Student and guru.e2e.
    await createPeriod(page, LABEL);
    await addSession(page, LABEL, wibDay(29));
    const examId = await placeExam(page, LABEL, wib(2));
    await addQuestions(examId);
    await openRooms(page, LABEL);
    await saveRoom(page, 'Ruang A');
    await saveProctor(page, 'Ruang A', OPERATOR[0]);
    await saveRoom(page, 'Ruang B', STUDENT[0]);
    await saveProctor(page, 'Ruang B', TEACHER[0]);
    await expect(roomExamCard(page, examId)).toContainText('Ruang dan pengawas lengkap.');

    // After the deadline the Operator marks it ready ("Muat Ulang" reads the period again, no browser reload).
    await expect.poll(() => deadlinePassed(examId), { timeout: 150_000, intervals: [2_000] }).toBe(true);
    await backToPeriods(page, 'Ruang dan Pengawas');
    const reload = page.getByRole('button', { name: 'Muat Ulang', exact: true });
    await reload.click();
    await expect(reload).toBeEnabled();
    await openPeriod(page, LABEL);
    await examCard(page, examId).getByRole('button', { name: 'Tandai Siap', exact: true }).click();
    await page.getByRole('dialog', { name: 'Tandai Siap?' }).getByRole('button', { name: 'Tandai Siap', exact: true }).click();
    await expect(notice(page, 'ditandai siap.')).toBeVisible();
    const skippedExam = await openWindowNow(examId);
    await reload.click();
    await expect(reload).toBeEnabled();

    // "Pelaksanaan Sesi": the READY exam with its rooms and Proctors.
    // Six seeded students plus the Student enrolled by the earlier AUTH-002 journey make seven;
    // moving the named Student to Ruang B leaves six in Ruang A. These are fixture-based oracles.
    await openSupervision(page);
    const card = supervisedCard(page, examId);
    await expect(card).toContainText('Siap dibuka.');
    await expect(card).toContainText(`Ruang A: 6 peserta, 0 mengerjakan, 0 dikunci. Pengawas: ${OPERATOR[0]}`);
    await expect(card).toContainText(`Ruang B: 1 peserta, 0 mengerjakan, 0 dikunci. Pengawas: ${TEACHER[0]}`);
    await expect(supervisedCard(page, skippedExam)).toContainText('Terjadwal');
    await capture(page, 'session-ready', main(page));

    // A second tab of the same Operator holds its "Buka Ujian" dialog open while the first tab opens the exam.
    const tab = await page.context().newPage();
    await tab.bringToFront();
    await open(tab);
    await openInstitution(tab);
    await openSupervision(tab);
    await supervisedCard(tab, examId).getByRole('button', { name: 'Buka Ujian', exact: true }).click();
    const stale = tab.getByRole('dialog', { name: `Buka Ujian ${EXAM_LABEL}?` });
    await stale.getByLabel('Alasan tindakan', { exact: true }).fill('Dibuka dari tab kedua');
    await page.bringToFront();

    await card.getByRole('button', { name: 'Buka Ujian', exact: true }).click();
    const openDialog = page.getByRole('dialog', { name: `Buka Ujian ${EXAM_LABEL}?` });
    await expect(openDialog).toContainText('Kesiapan diperiksa ulang saat ujian dibuka.');
    await openDialog.getByLabel('Alasan tindakan', { exact: true }).fill('Sesi dimulai sesuai jadwal');
    await capture(page, 'dialog-open', () => page.getByRole('dialog'));
    await confirmControl(page, openDialog, 'Buka Ujian', 'Sesi dimulai sesuai jadwal', `Ujian ${EXAM_LABEL} dibuka.`);
    await expect(card.getByRole('button', { name: 'Pantau Peserta', exact: true })).toBeVisible();

    // The stale tab: "Buka Ujian" again is refused with "Perbarui"; the retry action keeps the focus.
    await tab.bringToFront();
    await stale.getByRole('button', { name: 'Buka Ujian', exact: true }).click();
    await expect(stale.getByText('Status ujian sudah berubah. Pilih Perbarui untuk melihat status terbaru.')).toBeVisible();
    await expect(stale.getByRole('button', { name: 'Buka Ujian', exact: true })).toBeFocused();
    await capture(tab, 'dialog-refusal', () => tab.getByRole('dialog'));
    await stale.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(stale).toHaveCount(0);
    await tab.close();
    await page.bringToFront();

    // The Student starts; after the in-app refresh the Operator sees one participant working.
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await studentContext.newPage();
    await login(student, ...STUDENT);
    await startExam(student);
    await refreshSupervision(page);
    await expect(card).toContainText(`${EXAM_LABEL.split(' · ')[1]} · 7 peserta · 1 mengerjakan · 0 dikumpulkan`);
    await capture(page, 'session-running', main(page));

    // The participant level as Operator: the whole exam, with "Mengerjakan".
    await card.getByRole('button', { name: 'Pantau Peserta', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pemantauan Peserta' })).toBeFocused();
    const row = page.getByRole('row').filter({ has: page.getByText(STUDENT[0], { exact: true }) });
    await expect(row).toContainText('Mengerjakan');
    await expect(page.getByRole('row').filter({ has: page.getByText('siswa.e2e.01', { exact: true }) })).toContainText('Belum mulai');
    await capture(page, 'participant-operator', main(page));

    // Lock with a reason: the Student's work stops; unlock: it returns.
    await page.getByRole('button', { name: `Kunci pengerjaan ${STUDENT[0]}`, exact: true }).click();
    const lock = page.getByRole('dialog', { name: 'Kunci Pengerjaan Peserta?' });
    await lock.getByLabel('Alasan tindakan', { exact: true }).fill('Perangkat peserta bermasalah');
    await lock.getByRole('button', { name: 'Kunci Pengerjaan', exact: true }).click();
    await expect(page.getByText(new RegExp(`^Pengerjaan ${STUDENT[0].replace(/\./g, '\\.')} dikunci sejak \\d{2}\\.\\d{2} WIB\\.$`))).toBeVisible();
    await expect(page.getByRole('button', { name: `Buka Kunci pengerjaan ${STUDENT[0]}`, exact: true })).toBeFocused();
    await nudge(student);
    await expect(student.getByRole('heading', { name: 'Pengerjaan Dikunci' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: `Buka Kunci pengerjaan ${STUDENT[0]}`, exact: true }).click();
    const unlock = page.getByRole('dialog', { name: 'Buka Kunci Pengerjaan?' });
    await unlock.getByLabel('Alasan tindakan', { exact: true }).fill('Perangkat peserta sudah pulih');
    await unlock.getByRole('button', { name: 'Buka Kunci', exact: true }).click();
    await expect(page.getByText(`Kunci pengerjaan ${STUDENT[0]} dibuka.`, { exact: true })).toBeVisible();
    await nudge(student);
    await expect(student.getByText('Hasil dari 2 + 3 adalah')).toBeVisible({ timeout: 30_000 });

    // Ten minutes more for the Student, with a reason.
    await page.getByRole('button', { name: `Tambah waktu ${STUDENT[0]}`, exact: true }).click();
    const time = page.getByRole('dialog', { name: 'Tambah Waktu Peserta' });
    await time.getByLabel('Tambahan waktu (menit)').fill('10');
    await time.getByLabel('Alasan', { exact: true }).fill('Gangguan listrik di ruang ujian');
    await time.getByRole('button', { name: 'Tambah 10 Menit', exact: true }).click();
    await expect(page.getByText(new RegExp(`^Waktu ${STUDENT[0].replace(/\./g, '\\.')} ditambah 10 menit\\.`))).toBeVisible();
    await expect(row).toContainText('Waktu ditambah 10 menit');
    expect(await focusIsOnBody(page), 'focus after adding time').toBe(false);
    await nudge(student);
    await expect(student.getByText('Waktu pengerjaan Anda ditambah 10 menit.')).toBeVisible({ timeout: 30_000 });

    // A message to the whole exam, with a reason (OC-4).
    await page.getByRole('button', { name: 'Kirim Pesan', exact: true }).click();
    const composer = page.getByRole('dialog', { name: 'Kirim Pesan ke Peserta' });
    await expect(composer.getByRole('radio', { name: 'Semua peserta' })).toBeChecked();
    await composer.getByLabel('Pesan', { exact: true }).fill('Harap tetap di tempat duduk.');
    await composer.getByLabel('Alasan tindakan', { exact: true }).fill('Ruang ujian ramai');
    await capture(page, 'dialog-message', () => page.getByRole('dialog'));
    await composer.getByRole('button', { name: 'Kirim Pesan', exact: true }).click();
    await expect(page.getByText(/^Pesan terkirim ke \d+ peserta\.$/)).toBeVisible();
    expect(await focusIsOnBody(page), 'focus after sending a message').toBe(false);
    await nudge(student);
    await expect(student.locator('.broadcast-banner')).toContainText('Harap tetap di tempat duduk.', { timeout: 30_000 });

    // Back to the session: "Pantau Peserta" takes the focus again.
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Sesi', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Pantau Peserta', exact: true })).toBeFocused();

    // The whole session paused: the scheduled exam is listed as not affected; the Student sees the pause.
    await page.getByRole('button', { name: 'Jeda Semua Ujian', exact: true }).click();
    const pause = page.getByRole('dialog', { name: 'Jeda Semua Ujian di Sesi Ini?' });
    await expect(pause).toContainText(`Tidak terkena:${EXAM_LABEL}: status ujian tidak sesuai (Terjadwal).`);
    await pause.getByLabel('Alasan tindakan', { exact: true }).fill('Listrik padam di sekolah');
    await capture(page, 'dialog-session-pause', () => page.getByRole('dialog'));
    await confirmControl(page, pause, 'Jeda Semua Ujian', 'Listrik padam di sekolah', '1 ujian dijeda.');
    await expect(notice(page, '1 ujian dijeda.')).toContainText('1 ujian tidak terkena.');
    await expect(card).toContainText('Dijeda sejak');
    await nudge(student);
    await expect(student.getByRole('heading', { name: 'Ujian Dijeda' })).toBeVisible({ timeout: 30_000 });
    await expect(student.getByText('Tetap di halaman ini. Soal tampil kembali setelah ujian dilanjutkan.')).toBeVisible();
    await capture(page, 'session-paused', main(page));

    // The subject Teacher: the running line, no counts and no "Pantau Peserta" (D04.4-26D).
    const teacher = await teacherContext(browser, page);
    const teacherCard = teacher.getByTestId(`teacher-exam-${examId}`);
    await expect(teacherCard).toContainText(RUNNING_LINE);
    await expect(teacherCard).toContainText('Dijeda');
    await expect(teacherCard.getByRole('button', { name: 'Pantau Peserta' })).toHaveCount(0);
    await expect(teacherCard.getByLabel('Kemajuan pelaksanaan ujian')).toHaveCount(0);
    await capture(teacher, 'teacher-card-running', () => teacherCard);

    // The session resumed: the Student's questions return.
    await page.getByRole('button', { name: 'Lanjutkan Semua Ujian', exact: true }).click();
    const resume = page.getByRole('dialog', { name: 'Lanjutkan Semua Ujian di Sesi Ini?' });
    await confirmControl(page, resume, 'Lanjutkan Semua Ujian', 'Listrik sudah menyala', '1 ujian dilanjutkan.');
    await nudge(student);
    await expect(student.getByText('Hasil dari 2 + 3 adalah')).toBeVisible({ timeout: 30_000 });

    // pengawas.e2e as Proctor sees "Ruang A" and never "Ruang B" (A05 unchanged).
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ruang Ujian' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Ruang A', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Ruang B', exact: true })).toHaveCount(0);

    // The Operator ends the exam; the Teacher card shows the counts and "Finalisasi Hasil".
    await openInstitution(page);
    await openSupervision(page);
    await card.getByRole('button', { name: 'Akhiri Ujian', exact: true }).click();
    const end = page.getByRole('dialog', { name: `Akhiri Ujian ${EXAM_LABEL}?` });
    await expect(end).toContainText('Tidak ada hasil yang ditampilkan.');
    await confirmControl(page, end, 'Akhiri Ujian', 'Waktu sesi selesai', `Ujian ${EXAM_LABEL} diakhiri.`);
    await expect(card).toContainText('Diakhiri');
    await capture(page, 'session-ended', main(page));
    await teacher.getByRole('button', { name: 'Perbarui Data' }).click();
    await expect(teacher.getByRole('button', { name: 'Perbarui Data' })).toBeEnabled();
    await expect(teacherCard.getByLabel('Kemajuan pelaksanaan ujian')).toBeVisible();
    await expect(teacherCard.getByRole('button', { name: 'Finalisasi Hasil' })).toBeVisible();
    await expect(teacherCard).not.toContainText(RUNNING_LINE);
    await expect(teacherCard.getByRole('button', { name: 'Pantau Peserta' })).toHaveCount(0);
    await teacher.context().close();
    await studentContext.close();
});
