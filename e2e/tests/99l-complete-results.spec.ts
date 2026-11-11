import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, option, saveStatus, state, wib, withDatabase } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

// RESULT-004 five-browser journey and rendered evidence (record §7 C07/C08). The file sorts after 99k (Playwright orders
// files with localeCompare). pengawas.e2e is the School Operator here (assigned and revoked as 99h to 99k do) and the
// Proctor of the one room; guru.e2e is the subject Teacher. The Operator places Matematika x X-E2E in a later-day session;
// guru.e2e stores the golden content G through "Siapkan Soal Ujian Sekolah" before the deadline; the Operator sets the room
// and its Proctor, marks the exam ready after the deadline and opens it through "Pelaksanaan Sesi". Fixture SQL does only
// what the product refuses for a session in the past (E14, as 99k): it opens the exam window at the current time and frees
// the class of any exam of an earlier spec still running at this time. siswa.e2e.06 answers all nine items through the exam
// screen; siswa.e2e.01 saves through its own signed-in page; the other five stay absent (seven X-E2E students: the six of
// global-setup and the one the AUTH-002 claim journey enrolls). While the exam runs the Teacher sees neither results nor
// grading (E6, E7); after the end it grades, finalizes and exports the per-question columns (E9). Navigation only through the
// shared helpers and the in-app refresh (never a browser reload). guru.e2e, a Proctor of earlier specs, may land on "Ruang
// Ujian" first, so "Pelaksanaan Ujian" is opened from the "Ruang kerja" navigation. At most five capture scenarios (R8); the
// capture step is the final 99k one, copied (E14; helpers.ts stays forbidden, ASSESS-INSTITUTION-003 R17).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('RESULT-004 capture SHA mismatch');
// The post-merge main of ASSESS-ROOM-001 (PR #39); its CI run and the workspace-visual-* artifact manifest are recorded in the Task record.
const BASELINE = { run: 258, commit: '0d5d4f997a62be1e1e67b1ebaa40e102c9d416ba', frontendTree: '572923ca5dc42ed4a9c713cdb61eedb7f8e774f0', manifestSha256: '1f7b4598df8c46e2ec23d76291ac317f4a462808ff5f9a0e0c7146a0b635d22c', record: 'RESULT-004 §10' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const OPERATOR = ['pengawas.e2e', 'ruang-ujian-tenang'] as const;
const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT_A = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const STUDENT_B = ['siswa.e2e.01', 'bintang-kejora-2026'] as const;
const SUBJECT_OPTION = 'Matematika Wajib · X-E2E · guru.e2e';
const EXAM_LABEL = 'Matematika Wajib · X-E2E';
const LABEL = 'PTS Hasil Lengkap E2E';
const ROOM = 'Ruang Hasil';
const RUNNING_LINE = 'Ujian ini sedang dilaksanakan. Pemantauan dilakukan operator sekolah dan pengawas ruang. Kemajuan peserta tampil setelah ujian berakhir.';
const REFUSED = 'Masih ada 4 jawaban yang belum dinilai guru. Nilai semua jawaban di Penilaian Esai sebelum finalisasi hasil.';
const FULL = [360, 390, 430, 768, 1024, 1280, 1440].map(width => ({ width, height: 800, text: 1 })).concat([{ width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }, { width: 1280, height: 800, text: 2 }]);
const TYPES = '1:MULTIPLE_CHOICE_SINGLE,2:MULTIPLE_RESPONSE,2:TRUE_FALSE,2:MATCHING,2:ORDERING,2:NUMERIC_ANSWER,2:ESSAY,2:SHORT_ANSWER';

// The golden content G (§5) as a 34-column v2 file: head (10), left_1..left_10, right_a..right_l, tolerance, rubric.
const HEADER = ['no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score',
    ...Array.from({ length: 10 }, (_, i) => `left_${i + 1}`), ...'abcdefghijkl'.split('').map(l => `right_${l}`), 'tolerance', 'rubric'].join(';');
const pad = (cells: string[], n: number) => [...cells, ...Array(n - cells.length).fill('')];
const row = (head: string, left: string[] = [], right: string[] = [], tolerance = '', rubric = '') => [head, ...pad(left, 10), ...pad(right, 12), tolerance, rubric].join(';');
const PROMPTS = ['Ibu kota Indonesia adalah', 'Bilangan prima adalah', 'Matahari terbit di timur', 'Pasangkan hewan dengan makanannya', 'Urutkan langkah menanam biji',
    'Hasil dari 5 dibagi 2 adalah', 'Sebutkan ibu kota Indonesia', 'Sebutkan satu monumen di Jakarta', 'Mengapa hutan penting?'];
const FILE = [HEADER,
    row(`1;PG;${PROMPTS[0]};Bandung;Jakarta;Surabaya;Medan;Makassar;B;2`),
    row(`2;PGK;${PROMPTS[1]};2;4;5;8;9;A,C;3`),
    row(`3;BS;${PROMPTS[2]};;;;;;B;1`),
    row(`4;MJ;${PROMPTS[3]};;;;;;B,A,D;4`, ['Sapi', 'Kucing', 'Kelinci'], ['Ikan', 'Rumput', 'Biji jagung', 'Wortel']),
    row(`5;UR;${PROMPTS[4]};;;;;;2,3,1;2`, ['Siram tanah', 'Siapkan pot', 'Tanam biji']),
    row(`6;IA;${PROMPTS[5]};;;;;;2,5;2`, [], [], '0,1'),
    row(`7;IS;${PROMPTS[6]};;;;;;;1`, ['Jakarta']),
    row(`8;IS;${PROMPTS[7]};;;;;;;2`, [], [], '', 'Nilai sesuai jawaban.'),
    row(`9;ES;${PROMPTS[8]};;;;;;;5`, [], [], '', 'Sebutkan dua alasan.'),
].join('\r\n') + '\r\n';
const ESSAY_A = 'Hutan menyimpan air dan menghasilkan oksigen.';
const ESSAY_B = 'Hutan menahan banjir.';
/** X-1 (E9): the per-question cells of the two Students once graded and finalized. */
const CELLS_A = '2;3;1;4;2;2;1;2;5';
const CELLS_B = '2;0 (salah);0 (salah);0 (salah);0 (salah);2;1;0 (dinilai guru);2,5';
const QUESTION_HEADERS = ['Soal 1 (PG, maks 2)', 'Soal 2 (PGK, maks 3)', 'Soal 3 (BS, maks 1)', 'Soal 4 (MJ, maks 4)', 'Soal 5 (UR, maks 2)',
    'Soal 6 (IA, maks 2)', 'Soal 7 (IS, maks 1)', 'Soal 8 (IS, maks 2)', 'Soal 9 (ES, maks 5)'];

/**
 * The config sets no action timeout, so a click on a control that never appears waited for the whole 45-minute test
 * (CI #260, the removed "Kembali" click). Every page of this journey bounds each action and wait to two minutes instead;
 * assertions keep their own timeouts.
 */
const STEP_TIMEOUT = 120_000;

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
            const name = ['workspace-complete-results', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
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
                    task: 'RESULT-004', phase: 'after', commit, frontendTree, baseline: BASELINE,
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
            await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action, operator: 'Synthetic CI operator', caseReference: 'RESULT-004', reason: 'Synthetic complete results' });
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

async function sessionOf(examId: string): Promise<string> {
    return withDatabase(async c => (await c.query('SELECT institution_session_id FROM secure_assessment_exam_instances WHERE id = $1', [examId])).rows[0].institution_session_id as string);
}

async function deadlinePassed(examId: string): Promise<boolean> {
    return withDatabase(async c => (await c.query(
        `SELECT max(deadline_at) <= statement_timestamp() AS passed FROM secure_assessment_institution_preparation_deadlines WHERE exam_instance_id = $1`, [examId])).rows[0].passed === true);
}

/** The stored snapshots in display order, with their frozen content. */
async function snapshotsOf(examId: string): Promise<Array<{ id: string; content: Record<string, any> }>> {
    return withDatabase(async c => (await c.query(
        'SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 ORDER BY display_order', [examId])).rows
        .map((r: { id: string; frozen_content: Record<string, any> }) => ({ id: r.id, content: r.frozen_content })));
}

/** A Student's stored answers by snapshot id. */
async function storedAnswers(attemptId: string): Promise<Record<string, unknown>> {
    return withDatabase(async c => Object.fromEntries((await c.query(
        'SELECT exam_question_snapshot_id, answer_payload FROM secure_assessment_exam_answers WHERE exam_attempt_id = $1', [attemptId])).rows
        .map((r: { exam_question_snapshot_id: string; answer_payload: unknown }) => [r.exam_question_snapshot_id, r.answer_payload])));
}

/**
 * Fixture SQL (E14, as 99k), after the product marked the exam ready: its window opens now (the product refuses a session
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

const notice = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });
const main = (page: Page) => () => page.locator('main').first();
const periodCard = (page: Page, label: string) => page.locator('[data-testid^="institution-period-"]').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
const roomCard = (page: Page, label: string) => page.getByTestId(`institution-room-${label}`);
const roomExamCard = (page: Page, examId: string) => page.getByTestId(`institution-room-exam-${examId}`);
const examCard = (page: Page, examId: string) => page.getByTestId(`institution-exam-${examId}`);
const supervisedCard = (page: Page, examId: string) => page.getByTestId(`supervision-exam-${examId}`);
const focusIsOnBody = (page: Page) => page.evaluate(() => document.activeElement === document.body || document.activeElement === null);

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

/** "Tambah Ruang" with every participant without a room. */
async function saveRoom(page: Page, label: string): Promise<void> {
    await page.getByRole('button', { name: 'Tambah Ruang', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Ruang' });
    await dialog.getByLabel('Nama ruang').fill(label);
    await dialog.getByRole('button', { name: /^Pilih semua / }).click();
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

/** An API call made by the signed-in page itself (same origin, session cookie). */
async function inPage(page: Page, path: string, body?: Record<string, unknown>, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
    return page.evaluate(async ({ path, body, tenant, headers }) => {
        const r = await fetch(path, {
            method: body ? 'POST' : 'GET', credentials: 'same-origin',
            headers: { 'X-Tenant-ID': tenant, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await r.text();
        return { status: r.status, body: text ? JSON.parse(text) : null };
    }, { path, body, tenant: state.tenantId, headers });
}

/** guru.e2e in its own browser: "Pelaksanaan Ujian" from the "Ruang kerja" navigation (it may land on "Ruang Ujian"). */
async function openTeacher(page: Page): Promise<Page> {
    const context = await page.context().browser()!.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const teacher = await context.newPage();
    teacher.setDefaultTimeout(STEP_TIMEOUT);
    await login(teacher, ...TEACHER);
    await teacher.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Pelaksanaan Ujian', exact: true }).click();
    await expect(teacher.getByRole('heading', { level: 1, name: 'Pelaksanaan Ujian' })).toBeVisible();
    return teacher;
}

/** The in-app refresh of the Teacher's list ("Perbarui Data", as 99j), never a browser reload. */
async function refreshTeacher(teacher: Page): Promise<void> {
    const button = teacher.getByRole('button', { name: 'Perbarui Data' });
    await button.click();
    await expect(button).toBeEnabled();
}

test.beforeAll(async () => operatorAssignment('ASSIGN'));
test.afterAll(async () => operatorAssignment('REVOKE'));

test('RESULT-004 journey and captures: the golden content in a school exam, no results or grading while it runs, grading, finalization and the per-question CSV', async ({ page, browser }) => {
    test.setTimeout(45 * 60_000);
    page.setDefaultTimeout(STEP_TIMEOUT);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);

    // The Operator places Matematika x X-E2E in a later-day session, the deadline about three minutes ahead.
    await createPeriod(page, LABEL);
    await addSession(page, LABEL, wibDay(33));
    const examId = await placeExam(page, LABEL, wib(3));
    const sessionId = await sessionOf(examId);

    // guru.e2e stores G through "Siapkan Soal Ujian Sekolah" before the deadline.
    const teacher = await openTeacher(page);
    const teacherCard = teacher.getByTestId(`teacher-exam-${examId}`);
    await teacherCard.getByRole('button', { name: 'Siapkan Soal' }).click();
    await expect(teacher.getByRole('heading', { level: 1, name: 'Siapkan Soal Ujian Sekolah' })).toBeVisible();
    await teacher.getByLabel('Berkas CSV').setInputFiles({ name: 'hasil-lengkap-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(FILE, 'utf8') });
    await teacher.getByRole('button', { name: 'Periksa Soal' }).click();
    await expect(teacher.getByText('Soal siap disimpan')).toBeVisible();
    await teacher.getByRole('button', { name: 'Simpan Soal' }).click();
    await teacher.getByRole('dialog', { name: 'Simpan Soal Ujian Sekolah?' }).getByRole('button', { name: 'Simpan Soal' }).click();
    // Saving returns the Teacher to the exam list with the notice (as in 99h).
    await expect(notice(teacher, 'Soal ujian sekolah tersimpan:')).toBeVisible();
    const snapshots = await snapshotsOf(examId);
    expect(snapshots.map(s => s.content.prompt)).toEqual(PROMPTS);

    // The room with every participant and pengawas.e2e as its Proctor.
    await openRooms(page, LABEL);
    await saveRoom(page, ROOM);
    await saveProctor(page, ROOM, OPERATOR[0]);
    await expect(roomExamCard(page, examId)).toContainText('Ruang dan pengawas lengkap.');

    // After the deadline the Operator marks it ready ("Muat Ulang" reads the period again), the window opens now, then "Buka Ujian".
    await expect.poll(() => deadlinePassed(examId), { timeout: 240_000, intervals: [2_000] }).toBe(true);
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
    // Six seeded students plus the Student enrolled by the earlier AUTH-002 journey make seven.
    await expect(card).toContainText(`${ROOM}: 7 peserta, 0 mengerjakan, 0 dikunci. Pengawas: ${OPERATOR[0]}`);
    await card.getByRole('button', { name: 'Buka Ujian', exact: true }).click();
    await confirmControl(page, page.getByRole('dialog', { name: `Buka Ujian ${EXAM_LABEL}?` }), 'Buka Ujian', 'Sesi dimulai sesuai jadwal', `Ujian ${EXAM_LABEL} dibuka.`);

    // siswa.e2e.06 answers all nine items through the exam screen (x1 of §5).
    const content = snapshots.map(s => s.content);
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await studentContext.newPage();
    student.setDefaultTimeout(STEP_TIMEOUT);
    await login(student, ...STUDENT_A);
    await student.getByTestId(`assignment-${examId}`).getByRole('button', { name: 'Mulai Ujian' }).click();
    await student.getByRole('button', { name: 'Mulai Ujian Sekarang' }).click();
    await expect(student.getByText(PROMPTS[0])).toBeVisible();
    const attemptA = new URL(student.url()).searchParams.get('attemptId')!;
    const progress = student.getByRole('heading', { name: /^Soal \d dari 9$/ });
    const saved = async (no: number, expected: unknown) => {
        await expect.poll(async () => (await storedAnswers(attemptA))[snapshots[no - 1].id], { timeout: 30_000, message: `item ${no}` }).toEqual(expected);
        await expect(saveStatus(student)).toHaveText('Tersimpan');
    };
    const next = async (no: number) => {
        await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
        await expect(progress).toHaveText(`Soal ${no} dari 9`);
        await expect(student.getByText(PROMPTS[no - 1])).toBeVisible();
    };
    const optionIds = (q: number) => (content[q].options as Array<{ id: string }>).map(o => o.id);
    await option(student, 1).click();
    await saved(1, { selectedOptionId: optionIds(0)[1] });
    await next(2);
    await option(student, 0).click();
    await option(student, 2).click();
    // The client sends a selection in canonical form, its ids sorted (types/assessment.ts canonicalSelection), not in option order.
    await saved(2, { selectedOptionIds: [optionIds(1)[0], optionIds(1)[2]].sort() });
    await next(3);
    await student.locator('.options-list label').filter({ has: student.getByRole('radio', { name: 'Benar', exact: true }) }).click();
    await saved(3, { value: true });
    await next(4);
    const right = (content[3].rightItems as Array<{ id: string }>).map(r => r.id);
    const left = (content[3].leftItems as Array<{ id: string }>).map(l => l.id);
    for (const [n, target] of [[1, right[1]], [2, right[0]], [3, right[3]]] as Array<[number, string]>) {
        await student.getByRole('combobox', { name: `Pasangan untuk pernyataan ${n}` }).selectOption(target);
    }
    await expect.poll(async () => {
        const stored = (await storedAnswers(attemptA))[snapshots[3].id] as { pairs?: Array<{ leftId: string; rightId: string }> } | undefined;
        return (stored?.pairs ?? []).map(p => [left.indexOf(p.leftId), right.indexOf(p.rightId)]).sort();
    }, { timeout: 30_000, message: 'item 4' }).toEqual([[0, 1], [1, 0], [2, 3]]);
    await next(5);
    const items = (content[4].items as Array<{ id: string }>).map(i => i.id);
    await student.getByRole('button', { name: 'Turunkan item 1', exact: true }).click();
    await student.getByRole('button', { name: 'Turunkan item 2', exact: true }).click();
    await saved(5, { orderedItemIds: [items[1], items[2], items[0]] });
    await next(6);
    await student.getByLabel('Jawaban angka').fill('2,5');
    await saved(6, { numericText: '2,5' });
    await next(7);
    await student.getByLabel('Jawaban singkat').fill('Jakarta');
    await saved(7, { shortText: 'Jakarta' });
    await next(8);
    await student.getByLabel('Jawaban singkat').fill('Monas');
    await saved(8, { shortText: 'Monas' });
    await next(9);
    await student.getByLabel('Jawaban esai').fill(ESSAY_A);
    await saved(9, { essayText: ESSAY_A });
    await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
    await student.getByRole('dialog').getByRole('checkbox').check();
    await student.getByRole('button', { name: 'Kirim Jawaban Sekarang' }).click();
    await expect(student.getByText('Ujian Berhasil Dikumpulkan')).toBeVisible();
    await studentContext.close();

    // siswa.e2e.01 saves through its own signed-in page (x2 of §5), then submits.
    const otherContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const other = await otherContext.newPage();
    other.setDefaultTimeout(STEP_TIMEOUT);
    await login(other, ...STUDENT_B);
    await expect(other.getByTestId(`assignment-${examId}`)).toBeVisible();
    const started = await inPage(other, '/api/v1/assessment/attempts/start', { examInstanceId: examId });
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    const attemptB: string = started.body.attemptId;
    const examSession = crypto.randomUUID();
    expect((await inPage(other, '/api/v1/assessment/session/activate', { attemptId: attemptB, sessionId: examSession })).status).toBe(200);
    expect((await inPage(other, '/api/v1/assessment/timer/start', { attemptId: attemptB })).status).toBe(200);
    const planB: Array<[number, unknown]> = [
        [1, { selectedOptionId: optionIds(0)[1] }], [2, { selectedOptionIds: [optionIds(1)[0]] }], [3, { value: false }],
        [4, { pairs: [{ leftId: left[0], rightId: right[1] }, { leftId: left[1], rightId: right[2] }, { leftId: left[2], rightId: right[3] }] }],
        [5, { orderedItemIds: [items[2], items[1], items[0]] }], [6, { numericText: '2,6' }], [7, { shortText: '  jakarta ' }],
        [8, { shortText: 'Monas' }], [9, { essayText: ESSAY_B }],
    ];
    for (const [no, answerPayload] of planB) {
        const r = await inPage(other, '/api/v1/assessment/answer/save', {
            attemptId: attemptB, sessionId: examSession, snapshotId: snapshots[no - 1].id, answerPayload, clientWriteIdentity: crypto.randomUUID(), expectedWriteVersion: null,
        }, { 'X-Question-Types': TYPES });
        expect(r.status, `item ${no}: ${JSON.stringify(r.body)}`).toBe(200);
    }
    expect((await inPage(other, '/api/v1/assessment/submit', { attemptId: attemptB })).status).toBe(200);
    await otherContext.close();

    // While the exam runs, the subject Teacher sees the running line and no "Lihat Hasil" or "Nilai Esai" (E6, E7).
    await teacher.bringToFront();
    await refreshTeacher(teacher);
    await expect(teacherCard).toContainText(RUNNING_LINE);
    await expect(teacherCard.getByRole('button', { name: 'Lihat Hasil' })).toHaveCount(0);
    await expect(teacherCard.getByRole('button', { name: 'Nilai Esai' })).toHaveCount(0);
    for (const path of [`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`, `/api/v1/assessment/teacher-exams/essays?examInstanceId=${examId}`]) {
        const refused = await inPage(teacher, path);
        expect([refused.status, refused.body]).toEqual([409, { error: 'institution_exam_running', currentState: 'ACTIVE' }]);
    }

    // The Operator ends the exam.
    await page.bringToFront();
    await card.getByRole('button', { name: 'Akhiri Ujian', exact: true }).click();
    await confirmControl(page, page.getByRole('dialog', { name: `Akhiri Ujian ${EXAM_LABEL}?` }), 'Akhiri Ujian', 'Waktu sesi selesai', `Ujian ${EXAM_LABEL} diakhiri.`);

    // "Lihat Hasil": provisional, scores shown, "Belum dinilai: 2" on both Students; the refresh keeps focus off BODY.
    await teacher.bringToFront();
    await refreshTeacher(teacher);
    await teacherCard.getByRole('button', { name: 'Lihat Hasil' }).click();
    await expect(teacher.getByText('Hasil sementara', { exact: true })).toBeVisible();
    await teacher.getByRole('button', { name: 'Tampilkan Nilai' }).click();
    const resultRow = (id: string) => teacher.getByRole('row').filter({ has: teacher.getByText(id, { exact: true }) });
    for (const id of [STUDENT_A[0], STUDENT_B[0]]) await expect(resultRow(id)).toContainText('Belum dinilai: 2');
    const refreshResults = teacher.getByRole('button', { name: 'Perbarui Data' });
    await refreshResults.focus();
    await teacher.keyboard.press('Enter');
    await expect(refreshResults).toBeEnabled();
    await expect(refreshResults).toBeFocused();
    await capture(teacher, 'results-provisional', main(teacher));
    await teacher.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    // "Finalisasi Hasil" is refused while four answers are ungraded.
    const finalize = async (reason: string) => {
        await teacherCard.getByRole('button', { name: 'Finalisasi Hasil' }).click();
        const dialog = teacher.getByRole('dialog', { name: 'Finalisasi Hasil Ujian?' });
        await dialog.getByLabel('Alasan tindakan', { exact: true }).fill(reason);
        await dialog.getByRole('button', { name: 'Finalisasi Hasil' }).click();
    };
    await finalize('Pelaksanaan ujian selesai');
    await expect(teacherCard.getByText(REFUSED)).toBeVisible();
    await capture(teacher, 'finalize-refused', () => teacherCard);

    // "Nilai Esai": the essay and the manual short answer of both Students; "Simpan Nilai" gets its focus back (E12).
    await teacherCard.getByRole('button', { name: 'Nilai Esai' }).click();
    await expect(teacher.getByRole('heading', { level: 1, name: 'Penilaian Esai' })).toBeVisible();
    await expect(teacher.getByText('Belum dinilai: 4 dari 4 jawaban')).toBeVisible();
    await capture(teacher, 'grading', main(teacher));
    for (const [no, id, max, value] of [[8, STUDENT_A[0], '2', '2'], [9, STUDENT_A[0], '5', '5'], [8, STUDENT_B[0], '2', '0'], [9, STUDENT_B[0], '5', '2,5']] as Array<[number, string, string, string]>) {
        const group = teacher.getByRole('group', { name: `Soal ${no} · ${id}` });
        await group.getByLabel(`Skor (0 sampai ${max})`).fill(value);
        // From the keyboard: the focused control disables itself while saving; its focus comes back when it settles.
        const save = group.getByRole('button', { name: 'Simpan Nilai' });
        await save.focus();
        await teacher.keyboard.press('Enter');
        await expect(group.getByText('Nilai tersimpan.')).toBeVisible();
        await expect(save).toBeFocused();
    }
    await expect(teacher.getByText('Belum dinilai: 0 dari 4 jawaban')).toBeVisible();
    await teacher.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    // Finalization with a reason, then the FINAL results with scores shown.
    await finalize('Semua jawaban sudah dinilai');
    await expect(teacherCard).toContainText('Hasil Final', { timeout: 30_000 });
    await teacherCard.getByRole('button', { name: 'Lihat Hasil' }).click();
    await expect(teacher.getByText('Hasil final', { exact: true })).toBeVisible();
    await teacher.getByRole('button', { name: 'Tampilkan Nilai' }).click();
    await expect(resultRow(STUDENT_A[0])).toContainText('100');
    await expect(resultRow(STUDENT_B[0])).toContainText('34,09');
    await capture(teacher, 'results-final', main(teacher));

    // "Unduh CSV": the 19 fixed columns, the nine E9 headers and cells; empty per-question cells for the five absent Students.
    const [download] = await Promise.all([teacher.waitForEvent('download'), teacher.getByRole('button', { name: 'Unduh CSV' }).click()]);
    const csv = readFileSync(await download.path(), 'utf8');
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(lines).toHaveLength(8);
    const header = lines[0].split(';');
    expect(header).toHaveLength(28);
    expect(header.slice(0, 6)).toEqual(['Mata pelajaran', 'Kelas', 'Jenis penilaian', 'Status hasil', 'Waktu finalisasi (WIB)', 'ELLIGBLE ID']);
    expect(header.slice(17, 19)).toEqual(['Dinilai guru', 'Belum dinilai']);
    expect(header.slice(19)).toEqual(QUESTION_HEADERS);
    const lineOf = (id: string) => lines.find(line => line.split(';')[5] === id)!;
    expect(lineOf(STUDENT_A[0]).split(';').slice(19).join(';')).toBe(CELLS_A);
    expect(lineOf(STUDENT_B[0]).split(';').slice(19).join(';')).toBe(CELLS_B);
    expect(lineOf(STUDENT_B[0])).toContain(';7,5;22;34,09;COMPOSITE_PER_ITEM_V1;2;0;');
    const present: string[] = [STUDENT_A[0], STUDENT_B[0]];
    const absent = lines.slice(1).filter(line => !present.includes(line.split(';')[5]));
    expect(absent).toHaveLength(5);
    for (const line of absent) expect(line).toMatch(/;Tidak mengerjakan(;){21}$/);
    expect(csv).not.toContain('—');
    await expect.poll(() => focusIsOnBody(teacher), { message: 'focus after "Unduh CSV"' }).toBe(false);

    // "Cetak": the print intent is audited ISSUED (the browser's print dialog is not opened in CI).
    await teacher.evaluate(() => { window.print = () => {}; });
    await teacher.getByRole('button', { name: 'Cetak' }).click();
    await expect.poll(() => withDatabase(async c => (await c.query(
        `SELECT count(*)::int AS n FROM secure_assessment_permission_action_events WHERE exam_instance_id = $1 AND action_kind = 'RESULT_EXPORT' AND action = 'print' AND outcome = 'ISSUED'`,
        [examId])).rows[0].n as number)).toBe(1);
    await expect.poll(() => focusIsOnBody(teacher), { message: 'focus after "Cetak"' }).toBe(false);
    await teacher.context().close();

    // The Operator: the session view shows "Hasil Final" and no score; its own request for the results is refused.
    // The Operator is still on "Pelaksanaan Sesi" (the navigation item is already active there), so its own "Perbarui" reads the new state.
    await page.bringToFront();
    const refreshSession = page.getByRole('button', { name: 'Perbarui', exact: true });
    await refreshSession.click();
    await expect(refreshSession).toBeEnabled();
    await expect(card).toContainText('Hasil Final');
    const view = await inPage(page, `/api/v1/assessment/institution-exams/supervision?sessionId=${sessionId}`);
    expect(view.status).toBe(200);
    expect(JSON.stringify(view.body)).not.toMatch(/"(score|rawScore|scaledScore|items|questions)"/);
    const operatorResults = await inPage(page, `/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    expect([operatorResults.status, operatorResults.body]).toEqual([403, { error: 'forbidden' }]);
});
