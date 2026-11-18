import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { login, open, reloadPage, saveStatus, state, wib, withDatabase } from './helpers.ts';

// ASSESS-QUESTION-002 rendered evidence and journey (record §4A.7/§7 C07/C08). The same
// capture routine runs on the capture-only baseline (phase "before": v1 content on the
// unchanged application) and on the implementation (phase "after"). Named 99- so that it
// runs after every other spec (Playwright orders files with localeCompare): the earlier
// specs count exams, batches and attempts globally. Only siswa.e2e.06 takes part, because
// the other students are expected in an earlier spec's exam at an overlapping time.

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const BASE_COMMIT = '8ade3ae4316a2839d91311be2037e8bfbb8c745f';
const BASE_FRONTEND_TREE = '95c0845383daa6b10a753c1aa7201504486ce507';
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
const phase: 'before' | 'after' = frontendTree === BASE_FRONTEND_TREE ? 'before' : 'after';
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-QUESTION-002 capture SHA mismatch');
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const V1_HEADER = 'no;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
const LONG = 'Pernyataan panjang tentang sifat bilangan yang membutuhkan beberapa baris di layar sempit agar terbaca utuh tanpa terpotong';
/** Baseline file: v1 single choice only, one question with long option text. */
const V1_FILE = [V1_HEADER, '1;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1', `2;Pilih pernyataan yang benar;${LONG} A;${LONG} B;${LONG} C;${LONG} D;${LONG} E;C;2`].join('\r\n') + '\r\n';
/** After phase: the same two questions as PG rows of a v2 file, plus a PGK question with long options. */
const V2_HEADER = 'no;type;prompt;option_a;option_b;option_c;option_d;option_e;correct;score';
const MR_PROMPT = 'Pilih semua bilangan prima';
const V2_FILE = [V2_HEADER, '1;PG;Hasil dari 6 x 7 adalah;40;42;44;46;48;B;1', `2;PG;Pilih pernyataan yang benar;${LONG} A;${LONG} B;${LONG} C;${LONG} D;${LONG} E;C;2`,
    `3;PGK;${MR_PROMPT};2 adalah bilangan prima genap satu-satunya yang ada;4;5 adalah bilangan prima ganjil terkecil setelah tiga;8;9;A,C;2`].join('\r\n') + '\r\n';
const FILE_NAME = 'tipe-soal-e2e.csv';

const WIDTHS = [360, 390, 430, 768, 1024, 1280, 1440];

async function settle(page: Page) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
}

/** One screenshot/JSON pair per variant; layout gates are enforced in the after phase only. */
/** Journey states after the full set: a reduced set of variants (narrow, tablet, wide, short landscape, 200 % text). */
const STATE_VARIANTS = [{ width: 360, height: 800, text: 1 }, { width: 768, height: 800, text: 1 }, { width: 1280, height: 800, text: 1 }, { width: 640, height: 360, text: 1 }, { width: 390, height: 844, text: 2 }];

async function captureQuestionSurface(page: Page, scenario: string, root: () => Locator, fixture: string, only?: typeof STATE_VARIANTS): Promise<void> {
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
    const variants = only ?? [
        ...WIDTHS.map(width => ({ width, height: 800, text: 1 })),
        { width: 640, height: 360, text: 1 },
        { width: 390, height: 844, text: 2 },
        { width: 1280, height: 800, text: 2 },
    ];
    try {
        for (const v of variants) {
            await page.setViewportSize({ width: v.width, height: v.height });
            // 200 % text: every element's computed font size and line height doubled (as spec 6), so
            // px-sized text scales too; restored afterwards.
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
                await settle(page);
                const textCalibration = await readCalibration();
                assertCalibration(textCalibration);
                const metrics = await root().evaluate(element => {
                    const targets = [...element.querySelectorAll<HTMLElement>('button, input, textarea, select')].filter(node => {
                        const b = node.getBoundingClientRect(); return b.width > 0 && b.height > 0;
                    }).map(node => {
                        const target = node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type) ? node.closest('label') ?? node : node;
                        const box = target.getBoundingClientRect();
                        return { name: node.getAttribute('aria-label') ?? target.textContent?.trim().slice(0, 60) ?? node.tagName, width: box.width, height: box.height };
                    });
                    const active = document.activeElement as HTMLElement | null;
                    return {
                        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, targets,
                        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        focus: active ? { tag: active.tagName, type: (active as HTMLInputElement).type ?? null, outline: getComputedStyle(active).outlineStyle } : null,
                        checkboxes: element.querySelectorAll('input[type=checkbox]').length, radios: element.querySelectorAll('input[type=radio]').length,
                        // Elements reaching past the viewport, for diagnosis of an overflow.
                        overflowing: [...document.querySelectorAll<HTMLElement>('body *')].filter(node => node.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
                            .slice(0, 8).map(node => `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}.${String(node.className).slice(0, 60)}:${Math.round(node.getBoundingClientRect().width)}`),
                    };
                });
                const name = ['workspace-question', phase, scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
                const screenshot = `${name}.png`;
                // Engines refuse images above 32767 device pixels: a taller page is captured at the viewport.
                const fullPage = (await page.evaluate(() => document.documentElement.scrollHeight * window.devicePixelRatio)) <= 30000;
                await page.screenshot({ path: test.info().outputPath(screenshot), fullPage, animations: 'disabled', caret: 'hide' });
                const textIntegrityAfterCapture = await readCalibration();
                assertCalibration(textIntegrityAfterCapture);
                metadataPath = test.info().outputPath(`${name}.json`);
                metadataPaths.push(metadataPath);
                writeFileSync(metadataPath, JSON.stringify({
                    textCalibration, textIntegrityAfterCapture, captureEnvironment, textPreparation: preparation,
                    task: 'ASSESS-QUESTION-002', phase, commit, baseline: { commit: BASE_COMMIT, frontendTree: BASE_FRONTEND_TREE }, frontendTree,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256, questionsSha256: createHash('sha256').update(fixture).digest('hex') },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, textScaleMethod: 'computed font-size and line-height doubled per element', scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                if (phase === 'after') {
                    // Soft: every scenario runs and every violation is reported; the test still fails.
                    expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow`).toBeLessThanOrEqual(metrics.clientWidth);
                    expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
                }
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

test('ASSESS-QUESTION-002 question surfaces: import preview, teacher preview and the exam screen', async ({ page, browser }) => {
    // Many rendered variants per surface, plus the after-phase journey.
    test.setTimeout(10 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const file = phase === 'after' ? V2_FILE : V1_FILE;
    const questionCount = phase === 'after' ? 3 : 2;
    await login(page, ...TEACHER);
    await page.getByRole('button', { name: 'Buat Ujian' }).first().click();
    await expect(page.getByRole('heading', { name: 'Buat Ujian dari Berkas Soal' })).toBeVisible();
    await page.getByLabel('Jenis penilaian').selectOption({ label: 'Ulangan Harian' });
    await page.getByLabel('Mulai (WIB)').fill(wib(-2));
    await page.getByLabel('Selesai (WIB)').fill(wib(90));
    await page.getByLabel('Durasi pengerjaan (menit)').fill('30');
    await page.getByRole('radio', { name: /Durasi penuh/ }).check();
    await page.getByLabel('Berkas CSV').setInputFiles({ name: FILE_NAME, mimeType: 'text/csv', buffer: Buffer.from(file, 'utf8') });
    await page.getByRole('button', { name: 'Periksa Soal dan Jadwal' }).click();
    // Earlier specs leave the other class members expected in an overlapping exam (and spec 9
    // adds a claimed student): keep siswa.e2e.06 only, then check again.
    const participants = page.getByRole('region', { name: /^Peserta \(/ });
    await expect(participants.getByRole('checkbox', { name: STUDENT[0], exact: true })).toBeVisible();
    for (const box of await participants.getByRole('checkbox').all()) {
        if ((await box.getAttribute('aria-label') ?? await box.evaluate(el => (el as HTMLInputElement).labels?.[0]?.textContent ?? '')).trim() !== STUDENT[0] && await box.isChecked()) await box.uncheck();
    }
    await expect(participants.getByRole('checkbox', { name: STUDENT[0], exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Periksa Lagi' }).click();
    await expect(page.getByText('Soal dan jadwal siap dijadwalkan')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Peserta \(1 dari \d+\)$/ })).toBeVisible();
    await captureQuestionSurface(page, 'import-preview', () => page.locator('main').first(), file);

    await page.getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await page.getByRole('dialog', { name: 'Jadwalkan Ujian Ini?' }).getByRole('button', { name: 'Jadwalkan Ujian' }).click();
    await expect(page.getByRole('status').filter({ hasText: `dijadwalkan dengan ${questionCount} soal dan 1 peserta` })).toBeVisible();
    const examId: string = await withDatabase(async client => (await client.query(
        'SELECT exam_instance_id FROM secure_assessment_question_import_batches WHERE source_file_name = $1', [FILE_NAME])).rows[0].exam_instance_id);
    const card = page.getByTestId(`teacher-exam-${examId}`);

    await card.getByRole('button', { name: 'Pratinjau Soal' }).click();
    await expect(page.getByRole('heading', { name: 'Pratinjau Soal' })).toBeVisible();
    await expect(page.getByText('Hasil dari 6 x 7 adalah')).toBeVisible();
    await captureQuestionSurface(page, 'teacher-preview-single', () => page.locator('main').first(), file);
    await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(page.getByText('Pilih pernyataan yang benar')).toBeVisible();
    await page.getByLabel('Tampilkan kunci jawaban dan skor').check();
    await captureQuestionSurface(page, 'teacher-preview-second-key', () => page.locator('main').first(), file);
    if (phase === 'after') {
        // Multiple response in the preview: the instruction, checkboxes and every key option.
        await page.getByRole('button', { name: 'Soal Berikutnya' }).click();
        await expect(page.getByText(MR_PROMPT)).toBeVisible();
        await expect(page.getByText('Pilih semua jawaban yang benar.')).toBeVisible();
        await expect(page.locator('main').getByRole('checkbox')).toHaveCount(6);
        await expect(page.getByText('Kunci jawaban', { exact: true })).toHaveCount(2);
        await captureQuestionSurface(page, 'teacher-preview-mr-key', () => page.locator('main').first(), file);
    }
    await page.getByRole('button', { name: 'Kembali ke Pelaksanaan Ujian' }).click();

    await card.getByRole('button', { name: 'Tandai Siap' }).click();
    await expect(card).toContainText('Siap Dibuka');
    await card.getByRole('button', { name: 'Buka Ujian' }).click();
    await page.getByLabel('Alasan tindakan', { exact: true }).fill('Pelaksanaan ujian terjadwal');
    await page.getByRole('dialog').getByRole('button', { name: 'Buka Ujian' }).click();
    await expect(card).toContainText('Berlangsung');

    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await studentContext.newPage();
    await login(student, ...STUDENT);
    const assignment = student.getByTestId(`assignment-${examId}`);
    await assignment.getByRole('button', { name: 'Mulai Ujian' }).click();
    await student.getByRole('button', { name: 'Mulai Ujian Sekarang' }).click();
    await expect(student.getByText('Hasil dari 6 x 7 adalah')).toBeVisible();
    await captureQuestionSurface(student, 'exam-single', () => student.locator('body'), file);
    await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
    await expect(student.getByText('Pilih pernyataan yang benar')).toBeVisible();
    await captureQuestionSurface(student, 'exam-second', () => student.locator('body'), file);
    if (phase === 'after') await multipleResponseJourney(page, student, examId, file);
    await studentContext.close();
});

/** C07: the five-browser multiple-response journey on the after phase. */
async function multipleResponseJourney(teacher: Page, firstPage: Page, examId: string, file: string) {
    let student = firstPage;
    const api = (path: string, body?: Record<string, unknown>) => teacher.evaluate(async ({ path, body, tenant }) => {
        const r = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin',
            headers: { 'X-Tenant-ID': tenant, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
        return { status: r.status, body: await r.json() };
    }, { path, body, tenant: state.tenantId });
    const transition = (action: string) => api('/api/v1/assessment/teacher-exams/transition', { examInstanceId: examId, action, reason: 'Uji tipe soal', actionKey: crypto.randomUUID(), confirmed: true });
    const snapshot = await withDatabase(async client => (await client.query(
        "SELECT id, frozen_content FROM secure_assessment_exam_question_snapshots WHERE exam_instance_id = $1 AND frozen_content->>'questionType' = 'MULTIPLE_RESPONSE'", [examId])).rows[0]);
    const ids: string[] = snapshot.frozen_content.options.map((o: { id: string }) => o.id);
    const stored = async () => (await withDatabase(async client => (await client.query(
        'SELECT answer_payload FROM secure_assessment_exam_answers WHERE exam_question_snapshot_id = $1', [snapshot.id])).rows[0]?.answer_payload ?? null));
    // Locators follow the current page: the journey moves to a fresh tab of the same context once.
    let A!: Locator, B!: Locator, C!: Locator, E!: Locator, progress!: Locator;
    const bind = () => {
        A = student.getByRole('checkbox', { name: /^2 adalah/ });
        B = student.getByRole('checkbox', { name: '4', exact: true });
        C = student.getByRole('checkbox', { name: /^5 adalah/ });
        E = student.getByRole('checkbox', { name: '9', exact: true });
        progress = student.getByRole('heading', { name: /^Soal \d dari 3$/ });
    };
    bind();
    // WebKit's renderer crashed reloading a page that had taken many large captures: continue in a
    // fresh tab of the same context, with this tab's exam session (sessionStorage) carried over.
    const freshTab = async () => {
        const entries = await student.evaluate(() => Object.entries(sessionStorage));
        const url = student.url();
        const next = await student.context().newPage();
        await next.addInitScript((pairs: Array<[string, string]>) => {
            for (const [key, value] of pairs) if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, value);
        }, entries);
        await student.close();
        student = next;
        bind();
        // The first navigation of a new page into the client: the shared helper does not wait for
        // the load event the Firefox driver sometimes never reports (helpers.ts open()).
        await open(student, url);
    };
    // The native checkbox is visually hidden inside its option card: pointer input goes to the card.
    const tap = (box: Locator) => student.locator('.options-list label').filter({ has: box }).click();
    const saved = async () => { await expect(saveStatus(student)).toHaveText('Tersimpan'); };
    // After a reload the screen may open on any question: wait for it, then step to the PGK one.
    const toMr = async () => {
        await expect(progress).toBeVisible({ timeout: 30_000 });
        for (let i = 0; i < 3 && !(await student.getByText(MR_PROMPT).isVisible()); i++) {
            const at = await progress.innerText();
            await student.getByRole('button', { name: 'Soal Berikutnya' }).click();
            await expect(progress).not.toHaveText(at);
        }
        await expect(student.getByText(MR_PROMPT)).toBeVisible();
    };

    await toMr();
    await expect(student.getByText('Pilih semua jawaban yang benar.')).toBeVisible();
    await expect(student.locator('.options-list input[type=checkbox]')).toHaveCount(5);
    await expect(student.locator('.options-list input[type=checkbox]:checked')).toHaveCount(0);
    await captureQuestionSurface(student, 'exam-mr-empty', () => student.locator('body'), file);
    // Keyboard: Tab reaches the option, Space toggles it; then a pointer click adds another.
    await A.focus();
    await student.keyboard.press('Space');
    await expect(A).toBeChecked();
    await captureQuestionSurface(student, 'exam-mr-keyboard-focus', () => student.locator('body'), file, STATE_VARIANTS);
    await tap(C);
    await saved();
    expect(await stored()).toEqual({ selectedOptionIds: [ids[0], ids[2]].sort() });
    await captureQuestionSurface(student, 'exam-mr-selected', () => student.locator('body'), file, STATE_VARIANTS);

    // Offline: several toggles, then reconnect; only the final set reaches the server.
    await student.context().setOffline(true);
    await tap(B); await tap(B); await tap(E); await tap(A); await tap(A);
    await student.context().setOffline(false);
    await saved();
    expect(await stored()).toEqual({ selectedOptionIds: [ids[0], ids[2], ids[4]].sort() });

    // Reload: the set is restored from the server, through the shared helper that does not wait
    // for the Firefox driver's load event (helpers.ts; main CI #187).
    await reloadPage(student);
    await toMr();
    for (const box of [A, C, E]) await expect(box).toBeChecked();
    await expect(B).not.toBeChecked();

    // Clearing every option is a saved empty answer that reads "Belum dijawab" (O02-2).
    await tap(A); await tap(C); await tap(E);
    await expect(saveStatus(student)).toHaveText('Belum dijawab');
    await expect.poll(stored).toEqual({ selectedOptionIds: [] });
    await captureQuestionSurface(student, 'exam-mr-cleared', () => student.locator('body'), file, STATE_VARIANTS);
    await tap(A);
    await saved();

    // Content this version cannot show: an explicit reload state, no endless loading.
    // The refusal is simulated inside the page (WebKit crashed when a Playwright route served a
    // navigation-time request): an init script answers question delivery with the 409 while a flag is set.
    await student.context().addInitScript(() => {
        if (localStorage.getItem('aq2-unsupported') !== '1') return;
        const real = window.fetch.bind(window);
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (url.includes('/api/v1/assessment/questions')) {
                return new Response(JSON.stringify({ error: 'question_type_unsupported' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
            }
            return real(input, init);
        };
    });
    await student.evaluate(() => localStorage.setItem('aq2-unsupported', '1'));
    await freshTab();
    await expect(student.getByRole('heading', { name: 'Perlu Memuat Ulang' })).toBeVisible();
    await expect(student.getByRole('button', { name: 'Muat Ulang' })).toBeVisible();
    await captureQuestionSurface(student, 'exam-unsupported', () => student.locator('body'), file, STATE_VARIANTS);
    await student.evaluate(() => localStorage.removeItem('aq2-unsupported'));
    await student.getByRole('button', { name: 'Muat Ulang' }).click();
    await toMr();
    await expect(A).toBeChecked();

    // Read-only while paused: no question content at all, then the exam continues.
    expect((await transition('pause')).status).toBe(200);
    await expect(student.getByRole('heading', { name: 'Ujian Dijeda' })).toBeVisible({ timeout: 30_000 });
    await expect(student.locator('.options-list')).toHaveCount(0);
    expect((await transition('resume')).status).toBe(200);
    await expect(student.getByText(/Soal \d dari 3/).first()).toBeVisible({ timeout: 30_000 });
    await toMr();

    // V06: submit with a save still pending; the pending choice is sent before submission.
    // The save is held at the network until the submission has started.
    let releaseSave!: () => void;
    const held = new Promise<void>(resolve => { releaseSave = resolve; });
    await student.route('**/api/v1/assessment/answer/save', async route => { await held; await route.continue(); });
    await tap(C);
    await expect(saveStatus(student)).toHaveText('Menyimpan...');
    const submitting = (async () => {
        await student.getByRole('button', { name: 'Selesaikan Ujian' }).click();
        await student.getByRole('dialog').getByRole('checkbox').check();
        await student.getByRole('button', { name: 'Kirim Jawaban Sekarang' }).click();
    })();
    await student.waitForTimeout(500);
    releaseSave();
    await submitting;
    await student.unroute('**/api/v1/assessment/answer/save');
    await expect(student.getByText('Ujian Berhasil Dikumpulkan')).toBeVisible();
    expect(await stored()).toEqual({ selectedOptionIds: [ids[0], ids[2]].sort() });

    // The teacher ends and finalizes; the exact set earns its full score under the composite rule.
    const provisional = await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    expect(provisional.body.scoring.rule).toBe('COMPOSITE_PER_ITEM_V1');
    expect((await transition('end')).status).toBe(200);
    expect((await transition('finalize')).status).toBe(200);
    const final = await api(`/api/v1/assessment/teacher-exams/results?examInstanceId=${examId}`);
    expect(final.body.resultState).toBe('FINAL');
    const mine = final.body.participants.find((r: { elligbleId: string }) => r.elligbleId === STUDENT[0]);
    expect([mine.score.rawScore, mine.score.maxScore, mine.score.scaledScore, mine.score.correct]).toEqual([2, 5, 40, 1]);
}
