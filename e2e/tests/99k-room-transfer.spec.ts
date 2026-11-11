import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, open, option, saveStatus, serverAnswers, startExam, state, wib, withDatabase } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

// ASSESS-ROOM-001 five-browser journey and rendered evidence (record §7 C06/C07). The file sorts after 99j (Playwright
// orders files with localeCompare). Its session is placed through the product on a later day than every earlier spec;
// rooms and Proctors are set through the product; the exam is marked ready through the product after its deadline and
// opened through "Pelaksanaan Sesi". Fixture SQL then does only what the product refuses for a session in the past
// (E14, as 99j): it stores the synthetic questions before the deadline, opens the exam window at the current time and
// frees the class of any exam of an earlier spec still running at this time. pengawas.e2e is given the School Operator
// assignment here and has it revoked at the end, as 99h to 99j do; it is also the Proctor of the source room (P03).
// guru.e2e is the Proctor of the target room. The rooms are named "Ruang Timur" and "Ruang Barat" so the Proctors' exam
// cards of this spec are told apart from those of 99i and 99j, which use "Ruang A" and "Ruang B" for the same Proctors.
// The scenario set is bounded (record R7): five scenarios. Navigation only through the shared helpers and the in-app
// refresh (no browser reload, CI #234). The capture step is the 99j one, copied (E14; the shared extraction is R17).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-ROOM-001 capture SHA mismatch');
// The post-merge main of ASSESS-INSTITUTION-003 (PR #38); its CI run and artifact manifest are recorded in the Task record.
const BASELINE = { run: 252, commit: '89a23fa04f7f5f340adfc498ec6bf197c3d79b4e', frontendTree: '5775c18fd7de4f64796937466a92a5c38251631b', manifestSha256: 'a594c3a1b442631f319066c784795d4a050156f9c1b41a60274c01e42dff2cad', record: 'ASSESS-ROOM-001 §10' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const OPERATOR = ['pengawas.e2e', 'ruang-ujian-tenang'] as const;
const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const SUBJECT_OPTION = 'Matematika Wajib · X-E2E · guru.e2e';
const EXAM_LABEL = 'Matematika Wajib · X-E2E';
const LABEL = 'PTS Pindah Ruang E2E';
const FROM = 'Ruang Timur';
const TO = 'Ruang Barat';
const ACTIVE_COPY = 'Peserta tetap mengerjakan ujian yang sama di perangkat yang sama. Jawaban dan sesi ujiannya tidak berubah. Sisa waktunya tetap berjalan selama pindah.';
const FULL = [360, 390, 430, 768, 1024, 1280, 1440].map(width => ({ width, height: 800, text: 1 })).concat([{ width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }, { width: 1280, height: 800, text: 2 }]);

/** The school-zone (WIB) date `days` from today. */
const wibDay = (days: number) => wib(days * 24 * 60).slice(0, 10);

async function capture(page: Page, scenario: string, root: () => Locator, variants = FULL): Promise<void> {
    const original = page.viewportSize();
    const browser = page.context().browser();
    if (!original || !browser) throw new Error('A real browser and viewport are required');
    try {
        for (const v of variants) for (let attempt = 1; ; attempt++) {
            let retryVariant = false;
            await page.setViewportSize({ width: v.width, height: v.height });
            const name = ['workspace-room-transfer', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
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
                // The Operator screens refresh themselves every 20 s. A refresh that replaces elements during a
                // 200 % capture invalidates its snapshot (CI #248, webkit-390), so the variant starts again from a
                // fresh snapshot, at most three times; the exact assertions below then decide.
                if (textCalibration && (textCalibration.detachedElements > 0 || textCalibration.unscaledElements > 0) && attempt < 3) {
                    retryVariant = true;
                    continue;
                }
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
                    task: 'ASSESS-ROOM-001', phase: 'after', commit, frontendTree, baseline: BASELINE,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256 },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, textCalibration, scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                captureWritten = true;
                // The calibrated DOM must survive until the screenshot and metrics are taken: a self-refresh
                // between the calibration check and the screenshot left unscaled nodes in it (CI #249, webkit-390).
                if (calibration) {
                    const afterCapture = await calibration.evaluate(snapshot => {
                        const calibrated = new Set(snapshot.nodes.map(({ node }) => node));
                        const current = [document.body, ...document.body.querySelectorAll<HTMLElement>('*')].filter((node): node is HTMLElement => node instanceof HTMLElement);
                        return {
                            detachedElements: snapshot.nodes.filter(({ node }) => !node.isConnected).length,
                            unscaledElements: current.filter(node => !calibrated.has(node)).length,
                            fontMismatches: snapshot.nodes.filter(({ node, font }) => node.isConnected && Number.isFinite(font) && Math.abs(parseFloat(getComputedStyle(node).fontSize) - font * 2) > 0.02).length,
                        };
                    });
                    const metadata: Record<string, unknown> = JSON.parse(readFileSync(metadataPath, 'utf8'));
                    writeFileSync(metadataPath, JSON.stringify({ ...metadata, captureAttempt: attempt, textIntegrityAfterCapture: afterCapture }, null, 2));
                    if ((afterCapture.detachedElements > 0 || afterCapture.unscaledElements > 0 || afterCapture.fontMismatches > 0) && attempt < 3) {
                        retryVariant = true;
                        continue;
                    }
                    expect(afterCapture, 'The calibrated DOM stayed unchanged through the screenshot and metrics').toEqual({ detachedElements: 0, unscaledElements: 0, fontMismatches: 0 });
                }
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
            if (!retryVariant) break;
        }
    } finally { await page.setViewportSize(original); }
}

async function operatorAssignment(action: 'ASSIGN' | 'REVOKE'): Promise<void> {
    await withDatabase(async c => {
        const person = (await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id = a.id WHERE cr.username = $1', [OPERATOR[0]])).rows[0].person_id as string;
        await c.query('BEGIN');
        try {
            await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-ROOM-001', reason: 'Synthetic room transfer' });
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

/** Fixture SQL (E14, as 99j): synthetic questions stored before the deadline; the first is the one startExam waits for. */
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
 * Fixture SQL (E14, as 99j), after the product marked the exam ready: its window opens now (the product refuses a session
 * in the past), and any exam of an earlier spec still scheduled or running at this time with the same students or
 * Proctors is ended so the class is free (the readiness re-check at opening refuses an overlap).
 */
async function openWindowNow(examId: string): Promise<void> {
    await withDatabase(async c => {
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
    });
}

/** The attempt's server timer start and its exam sessions: a move changes neither (O05-5). */
async function attemptState(attemptId: string): Promise<{ startedAt: string; sessions: number }> {
    return withDatabase(async c => {
        const timer = (await c.query('SELECT started_at::text AS s FROM secure_assessment_timer_state WHERE exam_attempt_id = $1', [attemptId])).rows[0];
        const sessions = (await c.query('SELECT count(*)::int AS n FROM secure_assessment_exam_sessions WHERE exam_attempt_id = $1', [attemptId])).rows[0];
        return { startedAt: String(timer.s), sessions: Number(sessions.n) };
    });
}

const notice = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });
const main = (page: Page) => () => page.locator('main').first();
const periodCard = (page: Page, label: string) => page.locator('[data-testid^="institution-period-"]').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
const roomCard = (page: Page, label: string) => page.getByTestId(`institution-room-${label}`);
const roomExamCard = (page: Page, examId: string) => page.getByTestId(`institution-room-exam-${examId}`);
const examCard = (page: Page, examId: string) => page.getByTestId(`institution-exam-${examId}`);
const supervisedCard = (page: Page, examId: string) => page.getByTestId(`supervision-exam-${examId}`);
const studentRow = (page: Page) => page.getByRole('row').filter({ has: page.getByText(STUDENT[0], { exact: true }) });
const moveButton = (page: Page) => page.getByRole('button', { name: `Pindahkan ruang ${STUDENT[0]}`, exact: true });

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

/** The participant level of the exam ("Pantau Peserta"): the title takes focus. */
async function openParticipants(page: Page, examId: string): Promise<void> {
    await supervisedCard(page, examId).getByRole('button', { name: 'Pantau Peserta', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pemantauan Peserta' })).toBeFocused();
}

/** A control dialog: the reason, the confirmation, then the notice of the outcome takes focus. */
async function confirmControl(page: Page, dialog: Locator, confirm: string, reason: string, done: string | RegExp): Promise<void> {
    await dialog.getByLabel('Alasan tindakan', { exact: true }).fill(reason);
    await dialog.getByRole('button', { name: confirm, exact: true }).click();
    const shown = notice(page, done);
    await expect(shown).toBeVisible();
    await expect(shown).toBeFocused();
}

/** The in-app refresh of an Operator screen (never a browser reload: CI #234); focus stays on "Perbarui", never BODY. */
async function refreshOperator(page: Page): Promise<void> {
    const button = page.getByRole('button', { name: 'Perbarui', exact: true });
    await button.click();
    await expect(button).toBeEnabled();
    await expect(button).toBeFocused();
}

const focusIsOnBody = (page: Page) => page.evaluate(() => document.activeElement === document.body || document.activeElement === null);

/** The student's screen checks its state now, as on a reconnect (5-lifecycle). */
const nudge = (student: Page) => student.evaluate(() => window.dispatchEvent(new Event('online')));

/** A Proctor's participant list of this exam, from "Ruang Ujian": the card of the exam that has the Proctor's room. */
async function openProctorList(page: Page, room: string): Promise<void> {
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ruang Ujian', exact: true }).click();
    const card = page.locator('li').filter({ has: page.getByRole('heading', { level: 3, name: room, exact: true }) });
    await expect(card).toHaveCount(1);
    await card.getByRole('button', { name: 'Lihat Peserta', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pemantauan Peserta' })).toBeVisible();
    // The opener is gone after the navigation: the screen title takes focus, never BODY (CI #255).
    await expect(page.getByRole('heading', { level: 1, name: 'Pemantauan Peserta' })).toBeFocused();
}

/** "Pindahkan Ruang" of the Student: the dialog with its state text, the target, the reason; "Pindahkan Peserta". */
async function fillMove(page: Page, from: string, to: string, reason: string): Promise<Locator> {
    await moveButton(page).click();
    const dialog = page.getByRole('dialog', { name: `Pindahkan ${STUDENT[0]} ke Ruang Lain?` });
    await expect(dialog).toContainText(`Ruang saat ini: ${from}.`);
    await expect(dialog).toContainText(ACTIVE_COPY);
    await expect(dialog).toContainText(`Setelah dipindahkan, pengawas ${from} tidak lagi melihat peserta ini.`);
    await expect(dialog).toContainText('Siswa tidak menerima pemberitahuan otomatis. Sampaikan langsung atau kirim pesan.');
    await dialog.getByLabel('Ruang tujuan', { exact: true }).selectOption({ label: to });
    await dialog.getByLabel('Alasan tindakan', { exact: true }).fill(reason);
    return dialog;
}

test.beforeAll(async () => operatorAssignment('ASSIGN'));
test.afterAll(async () => operatorAssignment('REVOKE'));

test('ASSESS-ROOM-001 journey and captures: the Operator moves a working Student with a pending answer, the Proctors follow, a stale tab is refused, the move back, no move after submission', async ({ page, browser }) => {
    test.setTimeout(45 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);

    // Setup through the product: a later-day session, the exam (deadline about two minutes ahead), its questions by fixture
    // SQL before the deadline, "Ruang Timur" with every participant and pengawas.e2e, then "Ruang Barat" with siswa.e2e.01 and
    // guru.e2e. The Student stays in "Ruang Timur".
    await createPeriod(page, LABEL);
    await addSession(page, LABEL, wibDay(31));
    const examId = await placeExam(page, LABEL, wib(2));
    await addQuestions(examId);
    await openRooms(page, LABEL);
    await saveRoom(page, FROM);
    await saveProctor(page, FROM, OPERATOR[0]);
    await saveRoom(page, TO, 'siswa.e2e.01');
    await saveProctor(page, TO, TEACHER[0]);
    await expect(roomExamCard(page, examId)).toContainText('Ruang dan pengawas lengkap.');

    // After the deadline the Operator marks it ready ("Muat Ulang" reads the period again, no browser reload), then opens it.
    await expect.poll(() => deadlinePassed(examId), { timeout: 150_000, intervals: [2_000] }).toBe(true);
    await backToPeriods(page, 'Ruang dan Pengawas');
    const reload = page.getByRole('button', { name: 'Muat Ulang', exact: true });
    await reload.click();
    await expect(reload).toBeEnabled();
    await openPeriod(page, LABEL);
    await examCard(page, examId).getByRole('button', { name: 'Tandai Siap', exact: true }).click();
    await page.getByRole('dialog', { name: 'Tandai Siap?' }).getByRole('button', { name: 'Tandai Siap', exact: true }).click();
    await expect(notice(page, 'ditandai siap.')).toBeVisible();
    await openWindowNow(examId);
    await reload.click();
    await expect(reload).toBeEnabled();
    await openSupervision(page);
    const card = supervisedCard(page, examId);
    // Six seeded students plus the Student enrolled by the earlier AUTH-002 journey make seven; siswa.e2e.01 sits in "Ruang Barat".
    await expect(card).toContainText(`${FROM}: 6 peserta, 0 mengerjakan, 0 dikunci. Pengawas: ${OPERATOR[0]}`);
    await expect(card).toContainText(`${TO}: 1 peserta, 0 mengerjakan, 0 dikunci. Pengawas: ${TEACHER[0]}`);
    await card.getByRole('button', { name: 'Buka Ujian', exact: true }).click();
    await confirmControl(page, page.getByRole('dialog', { name: `Buka Ujian ${EXAM_LABEL}?` }), 'Buka Ujian', 'Sesi dimulai sesuai jadwal', `Ujian ${EXAM_LABEL} dibuka.`);

    // The Student starts and saves an answer, then answers the next question while offline: it waits on the device.
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await studentContext.newPage();
    await login(student, ...STUDENT);
    const attemptId = await startExam(student);
    await option(student, 1).click();
    await expect(saveStatus(student)).toHaveText('Tersimpan');
    await studentContext.setOffline(true);
    await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(student.getByText('Bilangan prima terkecil adalah')).toBeVisible();
    await option(student, 2).click();
    await expect(saveStatus(student)).toHaveText('Gagal menyimpan');
    const before = await attemptState(attemptId);

    // The participant level as Operator: "Pindahkan Ruang" on every participant still able to move.
    await refreshOperator(page);
    await openParticipants(page, examId);
    await expect(studentRow(page)).toContainText('Mengerjakan');
    await expect(studentRow(page)).toContainText(FROM);
    await expect(moveButton(page)).toBeVisible();
    await capture(page, 'participant-action', main(page));

    // A second Operator tab holds its move dialog open at the version it read.
    const tab = await page.context().newPage();
    await tab.bringToFront();
    await open(tab);
    await openInstitution(tab);
    await openSupervision(tab);
    await openParticipants(tab, examId);
    const stale = await fillMove(tab, FROM, TO, 'Dipindah dari tab kedua');
    // pengawas.e2e as Proctor of "Ruang Timur" lists the Student before the move.
    const proctorTab = await page.context().newPage();
    await proctorTab.bringToFront();
    await open(proctorTab);
    await openProctorList(proctorTab, FROM);
    await expect(studentRow(proctorTab)).toHaveCount(1);
    await page.bringToFront();

    // The move, with a reason: the notice, the focus back on the row action, the participant now in "Ruang Barat".
    const dialog = await fillMove(page, FROM, TO, 'Perangkat di ruang timur bermasalah');
    await capture(page, 'dialog-active', () => page.getByRole('dialog'));
    await dialog.getByRole('button', { name: 'Pindahkan Peserta', exact: true }).click();
    await expect(notice(page, `${STUDENT[0]} dipindahkan dari ${FROM} ke ${TO}.`)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(moveButton(page)).toBeFocused();
    await expect(studentRow(page)).toContainText(TO);
    await capture(page, 'success-notice', main(page));

    // The Student reconnects: no prompt, no takeover, the pending answer is accepted, the timer is not reset.
    await studentContext.setOffline(false);
    await nudge(student);
    await expect(saveStatus(student)).toHaveText('Tersimpan', { timeout: 30_000 });
    await expect(student.getByRole('button', { name: 'Ya, Pindahkan Sesi' })).toHaveCount(0);
    await expect(student.getByRole('dialog')).toHaveCount(0);
    await expect(student.getByText('Bilangan prima terkecil adalah')).toBeVisible();
    expect(await serverAnswers(student, attemptId)).toHaveLength(2);
    expect(await attemptState(attemptId)).toEqual(before);

    // The old room's Proctor no longer lists the Student after the in-app refresh.
    await proctorTab.bringToFront();
    const proctorRefresh = proctorTab.getByRole('button', { name: 'Perbarui', exact: true });
    await proctorRefresh.click();
    await expect(proctorRefresh).toBeEnabled();
    await expect(studentRow(proctorTab)).toHaveCount(0);
    await proctorTab.close();
    await page.bringToFront();

    // guru.e2e, the Proctor of "Ruang Barat", lists the Student from "Ruang Ujian" (it may land there first: AppShell order).
    const teacherContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const teacher = await teacherContext.newPage();
    await login(teacher, ...TEACHER);
    await openProctorList(teacher, TO);
    await expect(studentRow(teacher)).toContainText(TO);
    await expect(studentRow(teacher)).toContainText('Mengerjakan');
    await capture(teacher, 'proctor-new-room', main(teacher));
    await teacherContext.close();

    // The stale tab: its move is refused with "Perbarui"; the retry action keeps the focus.
    await tab.bringToFront();
    await stale.getByRole('button', { name: 'Pindahkan Peserta', exact: true }).click();
    await expect(stale.getByText('Ruang peserta ini baru saja diubah. Pilih Perbarui untuk melihat ruang terbaru.')).toBeVisible();
    await expect(stale.getByRole('button', { name: 'Pindahkan Peserta', exact: true })).toBeFocused();
    await capture(tab, 'refusal-stale', () => tab.getByRole('dialog'));
    await stale.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(stale).toHaveCount(0);
    await expect.poll(() => focusIsOnBody(tab), { message: 'focus after closing the refused dialog' }).toBe(false);
    await refreshOperator(tab);
    await expect(studentRow(tab)).toContainText(TO);
    await tab.close();
    await page.bringToFront();

    // The move back (D04.4-65).
    const back = await fillMove(page, TO, FROM, 'Perangkat di ruang timur sudah pulih');
    await back.getByRole('button', { name: 'Pindahkan Peserta', exact: true }).click();
    await expect(notice(page, `${STUDENT[0]} dipindahkan dari ${TO} ke ${FROM}.`)).toBeVisible();
    await expect(moveButton(page)).toBeFocused();
    await expect(studentRow(page)).toContainText(FROM);

    // After the Student submits, the row offers no move; the in-app refresh keeps the focus.
    await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
    await student.getByRole('dialog').getByRole('checkbox').check();
    await student.getByRole('button', { name: 'Kirim Jawaban Sekarang' }).click();
    await expect(student.getByText('Ujian Berhasil Dikumpulkan')).toBeVisible();
    await refreshOperator(page);
    await expect(studentRow(page)).toContainText('Dikumpulkan');
    await expect(moveButton(page)).toHaveCount(0);
    expect(await focusIsOnBody(page), 'focus after the refresh').toBe(false);
    await studentContext.close();
});
