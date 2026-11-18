import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser, type Locator, type Page, type Route } from '@playwright/test';
import { login, navigatePage, reloadPage, state, wib, withDatabase } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

// ASSESS-INSTITUTION-001 five-browser journey and rendered evidence (record §7 C06/C07). The file sorts
// after every spec (Playwright orders files with localeCompare), so its institution exams never hold the
// X-E2E students against an earlier spec; its sessions are on later days, so no earlier exam conflicts.
// pengawas.e2e is given the School Operator assignment here and has it revoked at the end, as
// 9-identity.spec.ts does. The timed deadline journey sets its own timeout; the multi-width captures run
// in separate tests outside it. The before-state is the exact-main CI #219 artifacts (record §10).
// Navigation only through the shared helpers (no direct page.reload or page.goto).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-INSTITUTION-001 capture SHA mismatch');
const BASELINE = { run: 219, commit: 'e031d31949972fd501946dd231f2bd1a45e247b5', frontendTree: '96c7189bac3d2e20f73e76d5acf2247a706c10f6', manifestSha256: '56b1a1babe2fb8b6a7077627168b34f2a1a9b66f797ca379d306f9dd59a1698a' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const OPERATOR = ['pengawas.e2e', 'ruang-ujian-tenang'] as const;
const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const SUBJECT_OPTION = 'Matematika Wajib · X-E2E · guru.e2e';
const HEADER = 'no,prompt,option_a,option_b,option_c,option_d,option_e,correct,score';
const FILE_1 = [HEADER, '1,Hasil dari 12 dibagi 4 adalah,2,3,4,5,6,B,1', '2,Bilangan genap terkecil yang lebih dari 7 adalah,6,8,9,10,12,B,1'].join('\n') + '\n';
const FILE_2 = [HEADER, '1,Hasil dari 9 dikali 3 adalah,18,21,24,27,30,D,1', '2,Akar kuadrat dari 64 adalah,6,7,8,9,10,C,1', '3,Hasil dari 100 dikurangi 37 adalah,53,63,73,67,57,B,1'].join('\n') + '\n';
const REASON = 'Guru mata pelajaran mengikuti pelatihan';
const ALREADY_PLACED = 'Mata pelajaran dan rombel ini sudah ditempatkan di periode ini.';
const CLOSED_COPY = 'Tenggat penyiapan soal sudah lewat, jadi soal tidak dapat diubah. Hubungi operator sekolah bila perlu perpanjangan.';

const FULL = [360, 390, 430, 768, 1024, 1280, 1440].map(width => ({ width, height: 800, text: 1 })).concat([{ width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }, { width: 1280, height: 800, text: 2 }]);

/** The school-zone (WIB) date `days` from today. */
const wibDay = (days: number) => wib(days * 24 * 60).slice(0, 10);

async function capture(page: Page, scenario: string, root: () => Locator, variants = FULL): Promise<void> {
    // Compare the companion and CI font/library environment, not just the Ubuntu label.
    const captureEnvironment: Record<string, unknown> = { platform: process.platform, node: process.version };
    if (process.platform === 'linux') {
        const families = await page.evaluate(() => [...new Set(
            [document.body, ...document.body.querySelectorAll<HTMLElement>('*')]
                .filter((node): node is HTMLElement => node instanceof HTMLElement)
                .map(node => getComputedStyle(node).fontFamily),
        )]);
        captureEnvironment.osRelease = readFileSync('/etc/os-release', 'utf8');
        captureEnvironment.libraries = execFileSync('dpkg-query', ['-W', '-f=${Package}=${Version}\n'], { encoding: 'utf8' })
            .split('\n').filter(line => /^(fontconfig|libfontconfig|libfreetype|libharfbuzz|libglib|libpango|libcairo|libgbm|libgtk|libstdc\+\+|libc6[=:])/.test(line)).sort();
        captureEnvironment.fonts = families.map(family => {
            const file = execFileSync('fc-match', ['-f', '%{file}', '--', family.replace(/["']/g, '')], { encoding: 'utf8' }).trim();
            return { family, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
        });
    }
    const original = page.viewportSize();
    const browser = page.context().browser();
    if (!original || !browser) throw new Error('A real browser and viewport are required');
    // Owner-approved C08 boundary: untouched entry and prepared variants are independent references.
    const takeBoundary = () => page.evaluateHandle(async () => {
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const elements = [document.documentElement, document.body, ...document.body.querySelectorAll('*')];
        const rect = (element: Element) => {
            const box = element.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
        };
        const control = (element: Element) => {
            if (element instanceof HTMLInputElement) return { kind: 'input', value: element.value, checked: element.checked, indeterminate: element.indeterminate, disabled: element.disabled, selectionStart: element.selectionStart, selectionEnd: element.selectionEnd, selectionDirection: element.selectionDirection };
            if (element instanceof HTMLTextAreaElement) return { kind: 'textarea', value: element.value, disabled: element.disabled, selectionStart: element.selectionStart, selectionEnd: element.selectionEnd, selectionDirection: element.selectionDirection };
            if (element instanceof HTMLSelectElement) return { kind: 'select', value: element.value, disabled: element.disabled, selected: [...element.options].map(option => option.selected) };
            return null;
        };
        const read = () => {
            const nodes = elements.map((node, index) => {
                const style = getComputedStyle(node);
                return { index, tag: node.tagName, id: node.id, connected: node.isConnected,
                    attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value]).sort((a, b) => a[0].localeCompare(b[0])),
                    text: [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent),
                    control: control(node), font: style.fontSize, line: style.lineHeight,
                    scroll: { x: node.scrollLeft, y: node.scrollTop }, geometry: rect(node) };
            });
            const root = document.documentElement;
            return { nodes, root: { style: root.getAttribute('style'), font: getComputedStyle(root).fontSize, line: getComputedStyle(root).lineHeight, ...rect(root) },
                viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
                focus: elements.indexOf(document.activeElement as Element), scroll: { x: window.scrollX, y: window.scrollY } };
        };
        const active = document.activeElement;
        const expected = read();
        const candidates = elements.flatMap((node, index) => {
            if (!(node instanceof HTMLFieldSetElement) || !node.parentElement) return [];
            const parent = node.parentElement;
            const legend = [...node.children].find(child => child instanceof HTMLLegendElement);
            const display = getComputedStyle(node).display;
            const parentStyle = getComputedStyle(parent);
            if (!legend || getComputedStyle(legend).display === 'none'
                || !['flex', 'inline-flex'].includes(display)
                || !['flex', 'inline-flex'].includes(parentStyle.display)
                || parentStyle.flexDirection !== 'column') return [];
            return [{ node, index, parent, legend, display, parentDisplay: parentStyle.display, parentDirection: parentStyle.flexDirection, originalStyle: node.getAttribute('style') }];
        });
        const recovery = { attempted: false, count: 0, focusUnchanged: true, scrollUnchanged: true, textUnchanged: true };
        const observe = () => {
            const actual = read();
            const current = [document.documentElement, document.body, ...document.body.querySelectorAll('*')];
            const differences = actual.nodes.map((node, index) => {
                const original = expected.nodes[index];
                return { index, identity: !node.connected || current[index] !== elements[index],
                    attributes: JSON.stringify(node.attributes) !== JSON.stringify(original.attributes),
                    text: JSON.stringify(node.text) !== JSON.stringify(original.text),
                    controls: JSON.stringify(node.control) !== JSON.stringify(original.control),
                    fonts: node.font !== original.font, lines: node.line !== original.line,
                    scroll: node.scroll.x !== original.scroll.x || node.scroll.y !== original.scroll.y,
                    geometry: Object.keys(node.geometry).some(key => Math.abs(node.geometry[key as keyof typeof node.geometry] - original.geometry[key as keyof typeof original.geometry]) > 0.02) };
            });
            const nonGeometric = {
                identity: differences.filter(item => item.identity).length + Math.abs(current.length - elements.length),
                attributes: differences.filter(item => item.attributes).length,
                controls: differences.filter(item => item.controls).length, fonts: differences.filter(item => item.fonts).length,
                lines: differences.filter(item => item.lines).length,
                focus: document.activeElement !== active ? 1 : 0,
                scroll: differences.filter(item => item.scroll).length + (actual.scroll.x !== expected.scroll.x || actual.scroll.y !== expected.scroll.y ? 1 : 0),
            };
            return { expected, actual, nonGeometric, candidateIndices: candidates.map(item => item.index), recovery: { ...recovery },
                // Live timer text may change between asynchronous capture boundaries; retain every difference.
                textDifferences: differences.filter(item => item.text).map(item => ({ index: item.index, before: expected.nodes[item.index].text, after: actual.nodes[item.index].text })),
                geometryDifferences: differences.filter(item => item.geometry).map(item => ({ index: item.index, before: expected.nodes[item.index].geometry, after: actual.nodes[item.index].geometry })),
                rootUnchanged: actual.root.style === expected.root.style && actual.root.font === expected.root.font && actual.root.line === expected.root.line
                    && Math.abs(actual.root.width - expected.root.width) <= 0.02 && Math.abs(actual.root.height - expected.root.height) <= 0.02 };
        };
        const reconstruct = () => {
            if (recovery.attempted) throw new Error('Native renderer recovery is single-pass only');
            recovery.attempted = true;
            if (Object.values(observe().nonGeometric).some(value => value !== 0)) throw new Error('Non-geometric boundary invariants must pass before renderer reconstruction');
            const beforeReconstruction = read();
            for (const { node, parent, legend, display, parentDisplay, parentDirection, originalStyle } of candidates) {
                if (!node.isConnected || node.parentElement !== parent || legend.parentElement !== node
                    || [...node.children].find(child => child instanceof HTMLLegendElement) !== legend
                    || getComputedStyle(node).display !== display || getComputedStyle(parent).display !== parentDisplay
                    || getComputedStyle(parent).flexDirection !== parentDirection || node.getAttribute('style') !== originalStyle) {
                    throw new Error('Original fieldset/flex topology changed before renderer reconstruction');
                }
            }
            try {
                for (const { node } of candidates) node.style.setProperty('display', 'block', 'important');
                if (candidates.length) document.documentElement.getBoundingClientRect();
            } finally {
                for (const { node, originalStyle } of candidates) {
                    node.getAttribute('style');
                    if (originalStyle === null) node.removeAttribute('style');
                    else node.setAttribute('style', originalStyle);
                }
            }
            if (candidates.length) document.documentElement.getBoundingClientRect();
            recovery.count = candidates.length;
            const restored = observe();
            recovery.focusUnchanged = restored.nonGeometric.focus === 0;
            recovery.scrollUnchanged = restored.nonGeometric.scroll === 0;
            // This synchronous operation must never change text; it must not freeze application timers.
            recovery.textUnchanged = JSON.stringify(restored.actual.nodes.map(node => node.text)) === JSON.stringify(beforeReconstruction.nodes.map(node => node.text));
            if (!recovery.textUnchanged || Object.values(restored.nonGeometric).some(value => value !== 0)) throw new Error('Renderer reconstruction changed a non-geometric boundary invariant');
        };
        const restoreScroll = () => {
            for (const [index, node] of elements.entries()) {
                const scroll = expected.nodes[index].scroll;
                if (node.scrollLeft !== scroll.x) node.scrollLeft = scroll.x;
                if (node.scrollTop !== scroll.y) node.scrollTop = scroll.y;
            }
            if (window.scrollX !== expected.scroll.x || window.scrollY !== expected.scroll.y) window.scrollTo(expected.scroll.x, expected.scroll.y);
        };
        return { observe, reconstruct, restoreScroll };
    });
    const boundaries: Array<Awaited<ReturnType<typeof takeBoundary>>> = [];
    const rememberBoundary = async () => {
        const boundary = await takeBoundary();
        boundaries.push(boundary);
        return boundary;
    };
    const unchangedBoundary = { identity: 0, attributes: 0, controls: 0, fonts: 0, lines: 0, focus: 0, scroll: 0 };
    const entryBoundary = await rememberBoundary();
    const metadataPaths: string[] = [];
    let captureError: unknown;
    try {
        for (const v of variants) {
            await page.setViewportSize({ width: v.width, height: v.height });
            // 200 % text: computed font size and line height doubled per element (spec 6 method).
            // C08: read every original value before changing any element; do not scale HTML/rem geometry.
            if (v.text === 2) await page.evaluate(async () => {
                await document.fonts.ready;
                await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            });
            let preparation: unknown;
            if (v.text === 2 && browser.browserType().name() === 'webkit') {
                const untouchedVariant = await rememberBoundary();
                await untouchedVariant.evaluate(boundary => boundary.reconstruct());
                const observed = await untouchedVariant.evaluate(boundary => boundary.observe());
                expect(observed.nonGeometric, 'Preparation preserves original DOM, attributes, controls, computed text, focus and scroll').toEqual(unchangedBoundary);
                preparation = observed;
            }
            const preparedBoundary = v.text === 2 ? await rememberBoundary() : null;
            const overlayToken = v.text === 2 ? randomUUID() : '';
            const calibration = v.text === 2 ? await page.evaluateHandle(overlayToken => {
                // Root geometry and restored geometry use the same read boundary: computed text first, rect last.
                // Both readings are before any calibration write; preserve the earlier rect as evidence.
                const root = document.documentElement;
                const beforeNodeStyleRead = root.getBoundingClientRect();
                const nodes = [document.body, ...document.body.querySelectorAll<HTMLElement>('*')]
                    .filter((node): node is HTMLElement => node instanceof HTMLElement)
                    .map((node, index) => {
                        const style = getComputedStyle(node);
                        return { node, index, originalStyle: node.getAttribute('style'), originalMarker: node.getAttribute('data-elligble-c08-text'), font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight) };
                    });
                const rootStyle = root.getAttribute('style');
                const rootFont = getComputedStyle(root).fontSize;
                const rootLine = getComputedStyle(root).lineHeight;
                const box = root.getBoundingClientRect();
                return {
                    rootStyle, rootFont, rootLine, rootWidth: box.width, rootHeight: box.height,
                    measurementBoundary: {
                        method: 'original-computed-text-first-root-rect-last-before-calibration',
                        beforeNodeStyleRead: { width: beforeNodeStyleRead.width, height: beforeNodeStyleRead.height },
                        afterNodeStyleRead: { width: box.width, height: box.height },
                    },
                    rendererRecovery: { attempted: false, count: 0, focusUnchanged: true, scrollUnchanged: true },
                    applications: 0, nodes, overlayToken, overlayLink: null as HTMLLinkElement | null,
                    overlayLoaded: false, overlayUrl: '', overlayCssSha256: '',
                };
            }, overlayToken) : null;
            let overlayUrl: string | undefined;
            let overlayRoute: ((route: Route) => Promise<void>) | undefined;
            let metadataPath: string | undefined;
            const readCalibration = async () => calibration ? calibration.evaluate(snapshot => {
                const current = [document.body, ...document.body.querySelectorAll<HTMLElement>('*')]
                    .filter((node): node is HTMLElement => node instanceof HTMLElement);
                const originals = new Set(snapshot.nodes.map(entry => entry.node));
                const samples = snapshot.nodes.map(({ node, index, font, line }) => {
                    const style = getComputedStyle(node);
                    return {
                        index, tag: node.tagName, connected: node.isConnected,
                        originalFont: font, expectedFont: font * 2, actualFont: parseFloat(style.fontSize),
                        originalLine: Number.isFinite(line) ? line : null,
                        expectedLine: Number.isFinite(line) ? line * 2 : null,
                        actualLine: Number.isFinite(parseFloat(style.lineHeight)) ? parseFloat(style.lineHeight) : null,
                    };
                });
                return {
                    method: 'two-pass-same-origin-stylesheet-overlay', applications: snapshot.applications, samples,
                    measurementBoundary: snapshot.measurementBoundary,
                    overlay: { url: snapshot.overlayUrl, cssSha256: snapshot.overlayCssSha256, loaded: snapshot.overlayLoaded, attached: snapshot.overlayLink?.isConnected ?? false },
                    markerMismatches: snapshot.nodes.filter(({ node, index }) => node.getAttribute('data-elligble-c08-text') !== `${snapshot.overlayToken}-${index}`).length,
                    detachedElements: samples.filter(sample => !sample.connected).length,
                    unscaledElements: current.filter(node => !originals.has(node)).length,
                    fontMismatches: samples.filter(sample => !Number.isFinite(sample.originalFont) || !Number.isFinite(sample.actualFont) || Math.abs(sample.actualFont - sample.expectedFont) > 0.02).length,
                    lineMismatches: samples.filter(sample => sample.expectedLine !== null && (sample.actualLine === null || Math.abs(sample.actualLine - sample.expectedLine) > 0.02)).length,
                    rootUnchanged: document.documentElement.getAttribute('style') === snapshot.rootStyle
                        && getComputedStyle(document.documentElement).fontSize === snapshot.rootFont
                        && getComputedStyle(document.documentElement).lineHeight === snapshot.rootLine,
                };
            }) : undefined;
            const assertCalibration = (measurement: Awaited<ReturnType<typeof readCalibration>>) => {
                if (!measurement) return;
                expect(measurement.samples.length, 'The calibrated snapshot contains the actual elements').toBeGreaterThan(0);
                expect(measurement.applications, 'Apply factor two exactly once').toBe(1);
                expect(measurement.detachedElements, 'No original element was replaced').toBe(0);
                expect(measurement.unscaledElements, 'No current element escaped the original snapshot').toBe(0);
                expect(measurement.fontMismatches, 'Every font is twice its original computed value').toBe(0);
                expect(measurement.lineMismatches, 'Every numeric line height is twice its original computed value').toBe(0);
                expect(measurement.rootUnchanged, 'Text resizing does not change root/rem geometry').toBe(true);
                expect(measurement.markerMismatches, 'Every original node has its unique overlay marker').toBe(0);
                expect(measurement.overlay.loaded, 'The same-origin calibration stylesheet loaded').toBe(true);
                expect(measurement.overlay.attached, 'The calibration stylesheet remains attached during capture').toBe(true);
            };
            try {
                if (calibration) {
                    const css = await calibration.evaluate(snapshot => snapshot.nodes.map(({ index, font, line }) => {
                        if (!Number.isFinite(font)) throw new Error('Original font size is not numeric');
                        const selector = `[data-elligble-c08-text="${snapshot.overlayToken}-${index}"]`;
                        return `${selector}{font-size:${font * 2}px!important;${Number.isFinite(line) ? `line-height:${line * 2}px!important;` : ''}}`;
                    }).join('\n'));
                    const location = new URL(page.url());
                    if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Text overlay requires an HTTP origin');
                    overlayUrl = new URL(`/__elligble_e2e__/c08-text-${overlayToken}.css`, location.origin).href;
                    overlayRoute = route => route.fulfill({
                        status: 200, contentType: 'text/css; charset=utf-8', headers: { 'Cache-Control': 'no-store' }, body: css,
                    });
                    await page.route(overlayUrl, overlayRoute);
                    await calibration.evaluate((snapshot, overlay) => new Promise<void>((resolve, reject) => {
                        if (snapshot.applications !== 0) throw new Error('Calibration already applied');
                        for (const { node, index } of snapshot.nodes) node.setAttribute('data-elligble-c08-text', `${snapshot.overlayToken}-${index}`);
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = overlay.url;
                        link.setAttribute('data-elligble-c08-overlay', snapshot.overlayToken);
                        snapshot.overlayLink = link;
                        snapshot.overlayUrl = overlay.url;
                        snapshot.overlayCssSha256 = overlay.sha256;
                        let completed = false;
                        const finish = (error?: Error) => {
                            if (completed) return;
                            completed = true;
                            window.clearTimeout(timer);
                            link.onload = null;
                            link.onerror = null;
                            if (error) reject(error);
                            else { snapshot.overlayLoaded = true; snapshot.applications++; resolve(); }
                        };
                        const timer = window.setTimeout(() => finish(new Error('Same-origin text stylesheet did not load within 5 seconds')), 5_000);
                        link.onload = () => finish();
                        link.onerror = () => finish(new Error('Same-origin text stylesheet was refused or failed to load'));
                        try { document.head.appendChild(link); }
                        catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
                    }), { url: overlayUrl, sha256: createHash('sha256').update(css).digest('hex') });
                }
                await expect(root()).toBeVisible();
                await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); });
                const textCalibration = await readCalibration();
                assertCalibration(textCalibration);
                const metrics = await root().evaluate(element => {
                    const targets = [...element.querySelectorAll<HTMLElement>('button, input, textarea, select, summary')].filter(n => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0; })
                        .map(n => { const t = n instanceof HTMLInputElement && ['checkbox', 'radio'].includes(n.type) ? n.closest('label') ?? n : n; const b = t.getBoundingClientRect(); return { name: n.getAttribute('aria-label') ?? t.textContent?.trim().slice(0, 60) ?? n.tagName, width: b.width, height: b.height }; });
                    const active = document.activeElement as HTMLElement | null;
                    return {
                        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets,
                        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        focus: active ? { tag: active.tagName, type: (active as HTMLInputElement).type ?? null, label: active.getAttribute('aria-label') } : null,
                        overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(n => n.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).slice(0, 8).map(n => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 50)}`),
                    };
                });
                const name = ['workspace-institution', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                // The larger of the document and body heights: with a dialog open, WebKit sizes the full page by
                // the body. A screenshot WebKit still refuses as too large falls back to the viewport, recorded
                // as fullPage false (CI #223).
                let fullPage = (await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) * window.devicePixelRatio)) <= 30000;
                try {
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                } catch (error) {
                    if (!fullPage || !String(error).includes('larger than')) throw error;
                    fullPage = false;
                    await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                }
                const textIntegrityAfterCapture = await readCalibration();
                assertCalibration(textIntegrityAfterCapture);
                metadataPath = test.info().outputPath(`${name}.json`);
                metadataPaths.push(metadataPath);
                writeFileSync(metadataPath, JSON.stringify({
                    textCalibration, textIntegrityAfterCapture, captureEnvironment, textPreparation: preparation,
                    task: 'ASSESS-INSTITUTION-001', phase: 'after', commit, frontendTree, baseline: BASELINE,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256, questionsSha256: createHash('sha256').update(FILE_1).digest('hex') },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow`).toBeLessThanOrEqual(metrics.clientWidth);
                expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
            } finally {
                if (calibration) {
                    try {
                        await calibration.evaluate(async snapshot => {
                            snapshot.overlayLink?.remove();
                            for (const { node, originalStyle, originalMarker } of snapshot.nodes) {
                                if (node.getAttribute('data-elligble-c08-text') !== originalMarker) {
                                    if (originalMarker === null) node.removeAttribute('data-elligble-c08-text');
                                    else node.setAttribute('data-elligble-c08-text', originalMarker);
                                }
                                // Restore screenshot side effects, while leaving untouched inline styles untouched.
                                if (node.getAttribute('style') !== originalStyle) {
                                    if (originalStyle === null) node.removeAttribute('style');
                                    else node.setAttribute('style', originalStyle);
                                }
                            }
                            await document.fonts.ready;
                            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                        });
                        const readRestoration = () => calibration.evaluate(snapshot => {
                            const samples = snapshot.nodes.map(({ node, index, originalStyle, originalMarker, font, line }) => {
                                const style = getComputedStyle(node);
                                return {
                                    index, connected: node.isConnected,
                                    originalStyle, actualStyle: node.getAttribute('style'),
                                    originalMarker, actualMarker: node.getAttribute('data-elligble-c08-text'),
                                    originalFont: font, actualFont: parseFloat(style.fontSize),
                                    originalLine: Number.isFinite(line) ? line : null,
                                    actualLine: Number.isFinite(parseFloat(style.lineHeight)) ? parseFloat(style.lineHeight) : null,
                                };
                            });
                            const box = document.documentElement.getBoundingClientRect();
                            return {
                                samples,
                                rendererRecovery: snapshot.rendererRecovery,
                                rootState: {
                                    expected: { style: snapshot.rootStyle, font: snapshot.rootFont, line: snapshot.rootLine, width: snapshot.rootWidth, height: snapshot.rootHeight },
                                    actual: { style: document.documentElement.getAttribute('style'), font: getComputedStyle(document.documentElement).fontSize, line: getComputedStyle(document.documentElement).lineHeight, width: box.width, height: box.height },
                                },
                                detachedElements: samples.filter(sample => !sample.connected).length,
                                inlineStyleMismatches: samples.filter(sample => sample.originalStyle !== sample.actualStyle).length,
                                markerMismatches: samples.filter(sample => sample.originalMarker !== sample.actualMarker).length,
                                overlayAttached: snapshot.overlayLink?.isConnected ?? false,
                                overlayRemaining: document.querySelectorAll(`link[data-elligble-c08-overlay="${snapshot.overlayToken}"]`).length,
                                fontMismatches: samples.filter(sample => !Number.isFinite(sample.actualFont) || Math.abs(sample.actualFont - sample.originalFont) > 0.02).length,
                                lineMismatches: samples.filter(sample => sample.originalLine !== null && (sample.actualLine === null || Math.abs(sample.actualLine - sample.originalLine) > 0.02)).length,
                                rootUnchanged: document.documentElement.getAttribute('style') === snapshot.rootStyle
                                    && getComputedStyle(document.documentElement).fontSize === snapshot.rootFont
                                    && getComputedStyle(document.documentElement).lineHeight === snapshot.rootLine
                                    && Math.abs(box.width - snapshot.rootWidth) <= 0.02
                                    && Math.abs(box.height - snapshot.rootHeight) <= 0.02,
                            };
                        });
                        try {
                            const originalText = await readRestoration();
                            expect({
                                detached: originalText.detachedElements, styles: originalText.inlineStyleMismatches,
                                fonts: originalText.fontMismatches, lines: originalText.lineMismatches,
                                markers: originalText.markerMismatches, overlayAttached: originalText.overlayAttached,
                                overlayRemaining: originalText.overlayRemaining,
                                rootStyle: originalText.rootState.actual.style === originalText.rootState.expected.style,
                                rootFont: originalText.rootState.actual.font === originalText.rootState.expected.font,
                                rootLine: originalText.rootState.actual.line === originalText.rootState.expected.line,
                            }, 'Restore all non-geometric invariants before native renderer recovery').toEqual({
                                detached: 0, styles: 0, fonts: 0, lines: 0, markers: 0, overlayAttached: false,
                                overlayRemaining: 0, rootStyle: true, rootFont: true, rootLine: true,
                            });
                            if (preparedBoundary) {
                                const restoredBoundary = await preparedBoundary.evaluate(boundary => boundary.observe());
                                expect(restoredBoundary.nonGeometric, 'Restore the prepared variant non-geometric state').toEqual(unchangedBoundary);
                                if (browser.browserType().name() === 'webkit' && !originalText.rootUnchanged) {
                                    await preparedBoundary.evaluate(boundary => boundary.reconstruct());
                                    const recovery = await preparedBoundary.evaluate(boundary => boundary.observe().recovery);
                                    await calibration.evaluate((snapshot, recovery) => { snapshot.rendererRecovery = recovery; }, recovery);
                                }
                            }
                            await expect.poll(async () => {
                                const restored = await readRestoration();
                                return { detached: restored.detachedElements, styles: restored.inlineStyleMismatches, fonts: restored.fontMismatches, lines: restored.lineMismatches, root: restored.rootUnchanged };
                            }, { timeout: 5_000, message: 'Restore original styles, computed text and root geometry before another variant' })
                                .toEqual({ detached: 0, styles: 0, fonts: 0, lines: 0, root: true });
                            if (preparedBoundary) {
                                const restored = await preparedBoundary.evaluate(boundary => boundary.observe());
                                expect(restored.nonGeometric, 'Prepared variant state remains restored after layout settlement').toEqual(unchangedBoundary);
                                expect(restored.rootUnchanged, 'Prepared variant root remains restored').toBe(true);
                            }
                            const overlayRestored = await readRestoration();
                            expect(overlayRestored.markerMismatches, 'Restore exact original marker attributes').toBe(0);
                            expect(overlayRestored.overlayAttached, 'Detach the temporary calibration link').toBe(false);
                            expect(overlayRestored.overlayRemaining, 'No temporary calibration link remains').toBe(0);
                        } finally {
                            if (metadataPath) {
                                const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
                                writeFileSync(metadataPath, JSON.stringify({ ...metadata, textRestoration: await readRestoration(), preparedVariantRestoration: preparedBoundary ? await preparedBoundary.evaluate(boundary => boundary.observe()) : undefined }, null, 2));
                            }
                        }
                    } finally {
                        try { if (overlayUrl && overlayRoute) await page.unroute(overlayUrl, overlayRoute); }
                        finally { await calibration.dispose(); }
                    }
                }
            }
        }
    } catch (error) {
        captureError = error;
        throw error;
    } finally {
        try {
            await page.setViewportSize(original);
            await page.evaluate(async () => {
                await document.fonts.ready;
                await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            });
            await entryBoundary.evaluate(boundary => boundary.restoreScroll());
            const beforeRecovery = await entryBoundary.evaluate(boundary => boundary.observe());
            expect(beforeRecovery.nonGeometric, 'Restore untouched collector-entry state before native recovery').toEqual(unchangedBoundary);
            if (browser.browserType().name() === 'webkit' && !beforeRecovery.rootUnchanged) {
                await entryBoundary.evaluate(boundary => boundary.reconstruct());
            }
            await expect.poll(async () => {
                const restored = await entryBoundary.evaluate(boundary => boundary.observe());
                return { ...restored.nonGeometric, root: restored.rootUnchanged };
            }, { timeout: 5_000, message: 'Restore the untouched entry root and state after returning to the original viewport' })
                .toEqual({ ...unchangedBoundary, root: true });
            expect(page.viewportSize(), 'Restore original collector-entry viewport').toEqual(original);
        } catch (entryError) {
            if (captureError) throw new AggregateError([captureError, entryError], 'Capture and untouched collector-entry restoration failed');
            throw entryError;
        } finally {
            try {
                const collectorEntryRestoration = await entryBoundary.evaluate(boundary => boundary.observe());
                for (const metadataPath of metadataPaths) {
                    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
                    writeFileSync(metadataPath, JSON.stringify({ ...metadata, collectorEntryRestoration }, null, 2));
                }
            } finally {
                for (const boundary of boundaries) await boundary.dispose();
            }
        }
    }
}

async function operatorAssignment(action: 'ASSIGN' | 'REVOKE'): Promise<void> {
    await withDatabase(async c => {
        const person = (await c.query('SELECT a.person_id FROM identity_user_accounts a JOIN identity_account_credentials cr ON cr.user_account_id = a.id WHERE cr.username = $1', [OPERATOR[0]])).rows[0].person_id as string;
        await c.query('BEGIN');
        try {
            await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-001', reason: 'Synthetic institution exams' });
            await c.query('COMMIT');
        } catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
    });
}

/** The exam placed in a period (one Matematika x X-E2E per period, E4). */
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

const notice = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function openInstitution(page: Page): Promise<void> {
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
}

const periodCard = (page: Page, label: string) => page.locator('[data-testid^="institution-period-"]').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
const examCard = (page: Page, examId: string) => page.getByTestId(`institution-exam-${examId}`);

async function openPeriod(page: Page, label: string): Promise<void> {
    const card = periodCard(page, label);
    // Wait for the overview to render the card first: isVisible() does not wait, so before the list
    // loads it would skip the click and leave the period closed (CI #222).
    await expect(card).toBeVisible();
    const open = card.getByRole('button', { name: 'Buka Periode' });
    if (await open.isVisible()) await open.click();
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

async function addSession(page: Page, label: string, date: string, start = '08:00', end = '10:00'): Promise<void> {
    await periodCard(page, label).getByRole('button', { name: 'Tambah Sesi' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Sesi' });
    await dialog.getByLabel('Tanggal').fill(date);
    await dialog.getByLabel('Jam mulai').fill(start);
    await dialog.getByLabel('Jam selesai').fill(end);
    await dialog.getByRole('button', { name: 'Simpan Sesi' }).click();
    await expect(notice(page, 'Sesi tersimpan.')).toBeVisible();
    await expect(periodCard(page, label).getByRole('heading', { level: 3, name: /^Jadwal Sesi: / })).toBeVisible();
}

async function fillPlacement(page: Page, label: string, deadline: string): Promise<Locator> {
    await periodCard(page, label).getByRole('button', { name: 'Tempatkan Ujian' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tempatkan Ujian di Sesi' });
    await dialog.getByLabel('Mata pelajaran dan rombel').selectOption({ label: SUBJECT_OPTION });
    await dialog.getByLabel('Durasi pengerjaan (menit)').fill('60');
    await dialog.getByRole('radio', { name: /Durasi penuh/ }).check();
    await dialog.getByLabel('Tenggat penyiapan soal').fill(deadline);
    return dialog;
}

async function placeExam(page: Page, label: string, deadline: string): Promise<string> {
    const dialog = await fillPlacement(page, label, deadline);
    await dialog.getByRole('button', { name: 'Tempatkan Ujian' }).click();
    await expect(notice(page, /Matematika Wajib · X-E2E ditempatkan dengan \d+ peserta\./)).toBeVisible();
    return examOf(label);
}

/**
 * ASSESS-INSTITUTION-002 RP-1: a placed exam needs a room and its Proctor before "Tandai Siap". The Operator
 * opens "Ruang dan Pengawas" of the period's session, adds "Ruang E2E" with every participant and sets
 * pengawas.e2e as its Proctor, then returns to the period.
 */
async function roomAndProctor(page: Page, label: string): Promise<void> {
    await openPeriod(page, label);
    await periodCard(page, label).getByRole('button', { name: 'Ruang dan Pengawas', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ruang dan Pengawas' })).toBeVisible();
    await page.getByRole('button', { name: 'Tambah Ruang', exact: true }).click();
    const room = page.getByRole('dialog', { name: 'Tambah Ruang' });
    await room.getByLabel('Nama ruang').fill('Ruang E2E');
    await room.getByRole('button', { name: /^Pilih semua / }).click();
    await room.getByRole('button', { name: 'Simpan Ruang', exact: true }).click();
    await expect(notice(page, /^Peserta ditempatkan di Ruang E2E: \d+ peserta\./)).toBeVisible();
    await page.getByTestId('institution-room-Ruang E2E').getByRole('button', { name: 'Atur Pengawas', exact: true }).click();
    const proctors = page.getByRole('dialog', { name: 'Atur Pengawas Ruang E2E' });
    await proctors.getByLabel('ELLIGBLE ID pengawas').fill(OPERATOR[0]);
    await proctors.getByRole('button', { name: 'Tambahkan', exact: true }).click();
    await proctors.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    await expect(notice(page, 'Pengawas Ruang E2E tersimpan.')).toBeVisible();
    await page.getByRole('button', { name: 'Kembali ke Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
}

async function teacherContext(browser: Browser, page: Page): Promise<Page> {
    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const teacher = await context.newPage();
    await login(teacher, ...TEACHER);
    await expect(teacher.getByRole('heading', { level: 1, name: 'Pelaksanaan Ujian' })).toBeVisible();
    return teacher;
}

async function refreshTeacher(teacher: Page): Promise<void> {
    await teacher.getByRole('button', { name: 'Perbarui Data' }).click();
    await expect(teacher.getByRole('button', { name: 'Perbarui Data' })).toBeEnabled();
}

async function openPreparation(teacher: Page, examId: string): Promise<void> {
    await teacher.getByTestId(`teacher-exam-${examId}`).getByRole('button', { name: 'Siapkan Soal' }).click();
    await expect(teacher.getByRole('heading', { level: 1, name: 'Siapkan Soal Ujian Sekolah' })).toBeVisible();
}

async function checkFile(teacher: Page, csv: string, name: string): Promise<void> {
    await teacher.getByLabel('Berkas CSV').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
    await teacher.getByRole('button', { name: 'Periksa Soal' }).click();
    await expect(teacher.getByText('Soal siap disimpan')).toBeVisible();
}

async function prepare(teacher: Page, examId: string, csv: string, name: string, replaces = 0): Promise<void> {
    await openPreparation(teacher, examId);
    await checkFile(teacher, csv, name);
    await teacher.getByRole('button', { name: 'Simpan Soal' }).click();
    const dialog = teacher.getByRole('dialog', { name: 'Simpan Soal Ujian Sekolah?' });
    if (replaces > 0) await expect(dialog.getByText(`Soal yang sudah tersimpan (${replaces} soal) akan diganti seluruhnya oleh berkas ini.`)).toBeVisible();
    else await expect(dialog.getByText(/akan diganti seluruhnya/)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Simpan Soal' }).click();
    await expect(notice(teacher, 'Soal ujian sekolah tersimpan:')).toBeVisible();
}

/** The content route as the Teacher's own page calls it (same origin, session cookie). */
const contentPreview = (teacher: Page, examInstanceId: string) => teacher.evaluate(async ({ examInstanceId, csv, tenant }) => {
    const r = await fetch('/api/v1/assessment/teacher-exams/content/preview', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant },
        body: JSON.stringify({ examInstanceId, questionsCsv: csv, sourceFileName: 'terlambat.csv' }),
    });
    return { status: r.status, body: await r.json() };
}, { examInstanceId, csv: FILE_1, tenant: state.tenantId });

test.beforeAll(async () => operatorAssignment('ASSIGN'));
test.afterAll(async () => operatorAssignment('REVOKE'));

// Shared by the journey and the captures after it.
const LABEL_A = 'PTS Ganjil E2E';
const LABEL_C = 'PAS Ganjil E2E';
let examA = '';
let examC = '';

test('ASSESS-INSTITUTION-001 captures: the empty Operator screen', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);
    await expect(page.getByRole('heading', { name: 'Belum ada periode ujian.' })).toBeVisible();
    await capture(page, 'operator-empty', () => page.locator('main').first());
});

test('ASSESS-INSTITUTION-001 deadline journey: compose, prepare, replace, extend, close at the deadline, mark ready, cancel', async ({ page, browser }) => {
    // The config allows 90 s with no retries; C's deadline is at most 120 s after its placement and
    // the wait below polls for at most 150 s, leaving 90 s for the steps (record §7 C06).
    // 300 s: the room and Proctor of C before "Tandai Siap" (ASSESS-INSTITUTION-002 RP-1) add steps.
    test.setTimeout(300_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const teacher = await teacherContext(browser, page);
    await login(page, ...OPERATOR);
    await openInstitution(page);

    // Period A with exam A (deadline days ahead); a second Matematika x X-E2E in A's period is refused.
    await createPeriod(page, LABEL_A);
    await addSession(page, LABEL_A, wibDay(20));
    examA = await placeExam(page, LABEL_A, `${wibDay(5)}T15:00`);
    const refused = await fillPlacement(page, LABEL_A, `${wibDay(5)}T16:00`);
    await refused.getByRole('button', { name: 'Tempatkan Ujian' }).click();
    await expect(refused.getByText(ALREADY_PLACED)).toBeVisible();
    await refused.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(refused).toHaveCount(0);
    // Period C with exam C, whose deadline is about a minute ahead.
    await createPeriod(page, LABEL_C);
    await addSession(page, LABEL_C, wibDay(21));
    examC = await placeExam(page, LABEL_C, wib(2));
    await expect(examCard(page, examC)).toContainText('Belum ada soal');

    // The subject Teacher prepares C at once, then prepares A, replaces A's questions and previews A.
    await refreshTeacher(teacher);
    await expect(teacher.getByTestId(`teacher-exam-${examC}`)).toContainText('Ujian sekolah · PAS Ganjil E2E');
    for (const action of ['Ubah Jadwal', 'Tambah Peserta', 'Tandai Siap', 'Batalkan Ujian']) {
        await expect(teacher.getByTestId(`teacher-exam-${examC}`).getByRole('button', { name: action })).toHaveCount(0);
    }
    await prepare(teacher, examC, FILE_1, 'soal-c.csv');
    await prepare(teacher, examA, FILE_1, 'soal-a.csv');
    await prepare(teacher, examA, FILE_2, 'soal-a-revisi.csv', 2);
    const cardA = teacher.getByTestId(`teacher-exam-${examA}`);
    await expect(cardA).toContainText('3 soal disiapkan.');
    await cardA.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await expect(teacher.getByText('Hasil dari 9 dikali 3 adalah')).toBeVisible();
    await teacher.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    // The Operator extends A's deadline with a reason.
    await openPeriod(page, LABEL_A);
    await examCard(page, examA).getByRole('button', { name: 'Perpanjang Tenggat' }).click();
    const extension = page.getByRole('dialog', { name: 'Perpanjang Tenggat Penyiapan Soal' });
    await extension.getByLabel('Tenggat baru').fill(`${wibDay(6)}T15:00`);
    await extension.getByLabel('Alasan tindakan', { exact: true }).fill(REASON);
    await extension.getByRole('button', { name: 'Perpanjang' }).click();
    await expect(notice(page, 'diperpanjang sampai')).toBeVisible();
    await expect(examCard(page, examA)).toContainText('(diperpanjang)');
    await expect(examCard(page, examA)).toContainText('Soal disiapkan: 3 soal');

    // A bounded wait for C's deadline; then the content is closed and the Operator marks C ready.
    await expect.poll(() => deadlinePassed(examC), { timeout: 150_000, intervals: [2_000] }).toBe(true);
    await refreshTeacher(teacher);
    const cardC = teacher.getByTestId(`teacher-exam-${examC}`);
    await expect(cardC).toContainText('Penyiapan soal ditutup');
    await expect(cardC.getByRole('button', { name: 'Siapkan Soal' })).toHaveCount(0);
    const late = await contentPreview(teacher, examC);
    expect([late.status, late.body.error]).toEqual([409, 'preparation_closed']);
    await reloadPage(page);
    await openPeriod(page, LABEL_C);
    await expect(examCard(page, examC)).toContainText('Penyiapan ditutup');
    await roomAndProctor(page, LABEL_C);
    await examCard(page, examC).getByRole('button', { name: 'Tandai Siap' }).click();
    const ready = page.getByRole('dialog', { name: 'Tandai Siap?' });
    await expect(ready.getByText(/akan ditandai siap\. Soal tidak dapat diubah lagi/)).toBeVisible();
    await ready.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(notice(page, 'ditandai siap.')).toBeVisible();
    await expect(examCard(page, examC)).toContainText('Siap Dibuka');

    // The Operator cancels A with a reason; the Teacher sees it under "Ujian Dibatalkan".
    await openPeriod(page, LABEL_A);
    await examCard(page, examA).getByRole('button', { name: 'Batalkan Ujian' }).click();
    const cancel = page.getByRole('dialog', { name: 'Batalkan Ujian Sekolah?' });
    await cancel.getByLabel('Alasan tindakan', { exact: true }).fill('Jadwal dipindahkan ke periode lain');
    await cancel.getByRole('button', { name: 'Batalkan Ujian' }).click();
    await expect(notice(page, 'dibatalkan dan diarsipkan.')).toBeVisible();
    await expect(examCard(page, examA)).toContainText('Dibatalkan');
    await refreshTeacher(teacher);
    const cancelled = teacher.getByRole('region', { name: 'Ujian Dibatalkan' });
    await expect(cancelled.getByTestId(`teacher-exam-${examA}`)).toContainText('Jadwal dipindahkan ke periode lain');
    await expect(teacher.getByTestId(`teacher-exam-${examC}`)).toContainText('Siap Dibuka');
    await teacher.context().close();
});

test('ASSESS-INSTITUTION-001 captures: the Operator screen, its dialogs and states, the Teacher card and the preparation screen', async ({ page, browser }) => {
    test.setTimeout(25 * 60_000);
    expect(examA && examC, 'the journey placed exams A and C').toBeTruthy();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const teacher = await teacherContext(browser, page);
    await login(page, ...OPERATOR);
    await openInstitution(page);
    const main = () => page.locator('main').first();
    const dialog = () => page.getByRole('dialog');

    // Exams D (content, ready to mark) and E (no content) with deadlines about a minute ahead,
    // placed first so their deadlines pass while the other captures run.
    await createPeriod(page, 'Ujian Tampilan D');
    await addSession(page, 'Ujian Tampilan D', wibDay(23));
    const examD = await placeExam(page, 'Ujian Tampilan D', wib(2));
    await createPeriod(page, 'Ujian Tampilan E');
    await addSession(page, 'Ujian Tampilan E', wibDay(24));
    const examE = await placeExam(page, 'Ujian Tampilan E', wib(2));
    await refreshTeacher(teacher);
    await prepare(teacher, examD, FILE_1, 'soal-d.csv');

    // Exam B, before its deadline: the open period, each form dialog and a refusal.
    await page.getByRole('button', { name: 'Buat Periode' }).click();
    await expect(dialog()).toBeVisible();
    await capture(page, 'dialog-create-period', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await createPeriod(page, 'Ujian Tampilan B');
    await periodCard(page, 'Ujian Tampilan B').getByRole('button', { name: 'Tambah Sesi' }).click();
    await expect(dialog()).toBeVisible();
    await capture(page, 'dialog-add-session', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await addSession(page, 'Ujian Tampilan B', wibDay(22));
    await fillPlacement(page, 'Ujian Tampilan B', `${wibDay(5)}T15:00`);
    await capture(page, 'dialog-place-exam', dialog);
    await dialog().getByRole('button', { name: 'Tempatkan Ujian' }).click();
    await expect(notice(page, /ditempatkan dengan \d+ peserta\./)).toBeVisible();
    const examB = await examOf('Ujian Tampilan B');
    await capture(page, 'operator-period-open', main);
    const again = await fillPlacement(page, 'Ujian Tampilan B', `${wibDay(5)}T16:00`);
    await again.getByRole('button', { name: 'Tempatkan Ujian' }).click();
    await expect(again.getByText(ALREADY_PLACED)).toBeVisible();
    await capture(page, 'dialog-place-refused', dialog);
    await again.getByRole('button', { name: 'Batal', exact: true }).click();
    await examCard(page, examB).getByRole('button', { name: 'Perpanjang Tenggat' }).click();
    await dialog().getByLabel('Alasan tindakan', { exact: true }).fill(REASON);
    await capture(page, 'dialog-extend-deadline', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await examCard(page, examB).getByRole('button', { name: 'Batalkan Ujian' }).click();
    await capture(page, 'dialog-cancel-exam', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(dialog()).toHaveCount(0);

    // The preparation screen of B: empty, checked preview, the replacement confirmation.
    await refreshTeacher(teacher);
    await openPreparation(teacher, examB);
    await capture(teacher, 'preparation-empty', () => teacher.locator('main').first());
    await checkFile(teacher, FILE_1, 'soal-b.csv');
    await capture(teacher, 'preparation-checked', () => teacher.locator('main').first());
    await teacher.getByRole('button', { name: 'Simpan Soal' }).click();
    await teacher.getByRole('dialog', { name: 'Simpan Soal Ujian Sekolah?' }).getByRole('button', { name: 'Simpan Soal' }).click();
    await expect(notice(teacher, 'Soal ujian sekolah tersimpan: 2 soal.')).toBeVisible();
    await openPreparation(teacher, examB);
    await checkFile(teacher, FILE_2, 'soal-b-revisi.csv');
    await teacher.getByRole('button', { name: 'Simpan Soal' }).click();
    const replace = teacher.getByRole('dialog', { name: 'Simpan Soal Ujian Sekolah?' });
    await expect(replace.getByText('Soal yang sudah tersimpan (2 soal) akan diganti seluruhnya oleh berkas ini.')).toBeVisible();
    await capture(teacher, 'preparation-replace-confirmation', () => replace);
    await replace.getByRole('button', { name: 'Batal', exact: true }).click();
    await teacher.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    // After D's and E's deadlines: the readiness blocker, mark ready, READY and cancelled, the Teacher
    // cards (before the deadline, closed, READY) and the preparation screen of a closed exam.
    await expect.poll(async () => (await deadlinePassed(examD)) && (await deadlinePassed(examE)), { timeout: 150_000, intervals: [2_000] }).toBe(true);
    await reloadPage(page);
    await openPeriod(page, 'Ujian Tampilan E');
    await expect(examCard(page, examE)).toContainText('Soal ujian belum ditambahkan');
    await capture(page, 'operator-readiness-blocker', main);
    await openPeriod(page, 'Ujian Tampilan D');
    await roomAndProctor(page, 'Ujian Tampilan D');
    await examCard(page, examD).getByRole('button', { name: 'Tandai Siap' }).click();
    await capture(page, 'dialog-mark-ready', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await openPeriod(page, LABEL_C);
    await expect(examCard(page, examC)).toContainText('Siap Dibuka');
    await capture(page, 'operator-ready', main);
    await openPeriod(page, LABEL_A);
    await expect(examCard(page, examA)).toContainText('Dibatalkan');
    await capture(page, 'operator-cancelled', main);

    await refreshTeacher(teacher);
    await expect(teacher.getByTestId(`teacher-exam-${examB}`)).toContainText('Tenggat penyiapan soal');
    await expect(teacher.getByTestId(`teacher-exam-${examE}`)).toContainText('Penyiapan soal ditutup');
    await expect(teacher.getByTestId(`teacher-exam-${examC}`)).toContainText('Siap Dibuka');
    await capture(teacher, 'teacher-card-open', () => teacher.getByTestId(`teacher-exam-${examB}`));
    await capture(teacher, 'teacher-card-closed', () => teacher.getByTestId(`teacher-exam-${examE}`));
    await capture(teacher, 'teacher-card-ready', () => teacher.getByTestId(`teacher-exam-${examC}`));
    await navigatePage(teacher, `/?view=teacher&prepareExam=${examE}`);
    await expect(teacher.getByText(CLOSED_COPY)).toBeVisible();
    await capture(teacher, 'preparation-closed', () => teacher.locator('main').first());
    await teacher.context().close();
});
