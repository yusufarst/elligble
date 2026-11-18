import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { login, open, state, wib, withDatabase } from './helpers.ts';
import { setSchoolOperator } from '../../runtime/tenant-access/src/school-operator.ts';

// ASSESS-INSTITUTION-002 five-browser journey and rendered evidence (record §7 C06/C07). The file sorts after
// 99h (Playwright orders files with localeCompare); its sessions are on later days than every earlier spec, so no
// earlier exam conflicts with them. pengawas.e2e is given the School Operator assignment here and has it revoked
// at the end, as 99h does; it is also the Proctor of "Ruang A" (an Operator may be a Proctor, P03). guru.e2e is
// the subject Teacher and the Proctor of "Ruang B". The scenario set is bounded (record R7): nine captures.
// Navigation only through the shared helpers (no direct page.reload or page.goto).

test.describe.configure({ mode: 'serial' });

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const frontendTree = git('rev-parse', 'HEAD:frontend/web/src');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('ASSESS-INSTITUTION-002 capture SHA mismatch');
const BASELINE = { run: 229, commit: '30a74562b4946a08311de369a96d50eaaa5d6b46', frontendTree: '2f2318bc79799f9515e9d1c469b179b6bf978ed2', manifestSha256: 'da598b6e79c9f4a6f1f841d809387a14817e68e12d5922af0af65983bc2fc66e' };
const fixtureSha256 = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const OPERATOR = ['pengawas.e2e', 'ruang-ujian-tenang'] as const;
const TEACHER = ['guru.e2e', 'papan-tulis-hijau'] as const;
const STUDENT = ['siswa.e2e.06', 'bintang-kejora-2026'] as const;
const SUBJECT_OPTION = 'Matematika Wajib · X-E2E · guru.e2e';
const EXAM_LABEL = 'Matematika Wajib · X-E2E';
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
                const name = ['workspace-institution-rooms', scenario, `${v.width}x${v.height}`, `text${v.text}`, test.info().project.name].join('-');
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
                const textIntegrityAfterCapture = await readCalibration();
                assertCalibration(textIntegrityAfterCapture);
                metadataPath = test.info().outputPath(`${name}.json`);
                metadataPaths.push(metadataPath);
                writeFileSync(metadataPath, JSON.stringify({
                    textCalibration, textIntegrityAfterCapture, captureEnvironment, textPreparation: preparation,
                    task: 'ASSESS-INSTITUTION-002', phase: 'after', commit, frontendTree, baseline: BASELINE,
                    fixture: { synthetic: true, globalSetupSha256: fixtureSha256 },
                    browser: { project: test.info().project.name, engine: browser.browserType().name(), version: browser.version() },
                    viewport: page.viewportSize(), fullPage, textScale: v.text, scenario, screenshot,
                    screenshotSha256: createHash('sha256').update(readFileSync(test.info().outputPath(screenshot))).digest('hex'),
                    accessibilitySnapshot: await root().ariaSnapshot(), metrics, environment: { ci: !!process.env['CI'], physicalDevice: false },
                }, null, 2));
                expect.soft(metrics.scrollWidth, `${scenario} ${v.width}x${v.height} text${v.text}: overflow ${JSON.stringify(metrics.overflowing)}`).toBeLessThanOrEqual(metrics.clientWidth);
                expect.soft(metrics.targets.filter(t => t.width < 43.5 || t.height < 43.5), `${scenario} ${v.width}x${v.height} text${v.text}: targets below 44 px`).toEqual([]);
                expect.soft(metrics.metricWraps, `${scenario} ${v.width}x${v.height} text${v.text}: mid-word metric labels`).toEqual([]);
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
            await setSchoolOperator(c, { tenantId: state.tenantId, personId: person, action, operator: 'Synthetic CI operator', caseReference: 'ASSESS-INSTITUTION-002', reason: 'Synthetic institution rooms' });
            await c.query('COMMIT');
        } catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
    });
}

/** The exam placed in a period (one Matematika x X-E2E per period). */
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

/** Synthetic questions stored before the deadline (the content route is 99h's subject, not this spec's). */
async function addQuestions(examId: string): Promise<void> {
    await withDatabase(async c => {
        for (let i = 1; i <= 2; i++) {
            await c.query(
                'INSERT INTO secure_assessment_exam_question_snapshots (tenant_id, exam_instance_id, frozen_content, display_order) VALUES ($1, $2, $3, $4)',
                [state.tenantId, examId, JSON.stringify({
                    schemaVersion: 1, questionType: 'MULTIPLE_CHOICE_SINGLE', prompt: `Hasil dari ${i} + ${i} adalah`,
                    options: ['A', 'B', 'C', 'D', 'E'].map((id, k) => ({ id, content: String(i * 2 + k - 1) })), correctOptionId: 'B', maxScore: 1,
                }), i]);
        }
    });
}

async function setLifecycle(examId: string, lifecycleState: string): Promise<void> {
    await withDatabase(async c => { await c.query('UPDATE secure_assessment_exam_instances SET lifecycle_state = $2 WHERE id = $1', [examId, lifecycleState]); });
}

const notice = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function openInstitution(page: Page): Promise<void> {
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
}

const periodCard = (page: Page, label: string) => page.locator('[data-testid^="institution-period-"]').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
const examCard = (page: Page, examId: string) => page.getByTestId(`institution-exam-${examId}`);
const roomCard = (page: Page, label: string) => page.getByTestId(`institution-room-${label}`);
const roomExamCard = (page: Page, examId: string) => page.getByTestId(`institution-room-exam-${examId}`);

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

/** "Ruang dan Pengawas" of the period's only session; the title takes focus. */
async function openRooms(page: Page, label: string): Promise<void> {
    await openPeriod(page, label);
    await periodCard(page, label).getByRole('button', { name: 'Ruang dan Pengawas', exact: true }).click();
    const title = page.getByRole('heading', { level: 1, name: 'Ruang dan Pengawas' });
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Daftar Ruang' })).toBeVisible();
}

async function backToPeriods(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Kembali ke Ujian Sekolah' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ujian Sekolah' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ruang dan Pengawas', exact: true }).first()).toBeFocused();
}

/** Opens "Tambah Ruang" and fills it: every participant without a room, or one student from any room. */
async function fillRoom(page: Page, label: string, student?: string): Promise<Locator> {
    await page.getByRole('button', { name: 'Tambah Ruang', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tambah Ruang' });
    await dialog.getByLabel('Nama ruang').fill(label);
    if (student) {
        await dialog.getByLabel('Tampilkan').selectOption({ label: 'Semua peserta' });
        await dialog.getByRole('checkbox', { name: new RegExp(`^${student.replace(/\./g, '\\.')}\\b`) }).check();
    } else {
        await dialog.getByRole('button', { name: /^Pilih semua / }).click();
    }
    return dialog;
}

async function saveRoom(page: Page, dialog: Locator, label: string): Promise<void> {
    await dialog.getByRole('button', { name: 'Simpan Ruang', exact: true }).click();
    const done = notice(page, new RegExp(`^Peserta ditempatkan di ${label}: \\d+ peserta\\.`));
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
}

async function fillProctors(page: Page, room: string, ids: string[]): Promise<Locator> {
    await roomCard(page, room).getByRole('button', { name: 'Atur Pengawas', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `Atur Pengawas ${room}` });
    for (const id of ids) {
        await dialog.getByLabel('ELLIGBLE ID pengawas').fill(id);
        await dialog.getByRole('button', { name: 'Tambahkan', exact: true }).click();
        await expect(dialog.getByRole('button', { name: `Hapus ${id}`, exact: true })).toBeVisible();
    }
    return dialog;
}

async function saveProctors(page: Page, dialog: Locator, room: string): Promise<void> {
    await dialog.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    const done = notice(page, `Pengawas ${room} tersimpan.`);
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
}

test.beforeAll(async () => operatorAssignment('ASSIGN'));
test.afterAll(async () => operatorAssignment('REVOKE'));

const LABEL_A = 'PTS Ruang E2E';
let examA = '';

test('ASSESS-INSTITUTION-002 journey: Ruang A with its Proctor, a move to Ruang B, the Student and the Proctor, a stale second tab', async ({ page, browser }) => {
    test.setTimeout(6 * 60_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);
    await createPeriod(page, LABEL_A);
    await addSession(page, LABEL_A, wibDay(26));
    examA = await placeExam(page, LABEL_A, `${wibDay(5)}T15:00`);

    // "Ruang A" with every participant, and pengawas.e2e typed as its Proctor.
    await openRooms(page, LABEL_A);
    await expect(page.getByText('Belum ada ruang di sesi ini. Tambahkan ruang, lalu tempatkan peserta.')).toBeVisible();
    await saveRoom(page, await fillRoom(page, 'Ruang A'), 'Ruang A');
    await expect(roomCard(page, 'Ruang A')).toContainText('Belum ada pengawas');
    await saveProctors(page, await fillProctors(page, 'Ruang A', [OPERATOR[0]]), 'Ruang A');
    await expect(roomCard(page, 'Ruang A')).toContainText(`Pengawas: ${OPERATOR[0]}`);
    await expect(roomExamCard(page, examA)).toContainText('Ruang dan pengawas lengkap.');

    // A second tab of the same Operator reads the session now; its later write is stale.
    const tab = await page.context().newPage();
    await tab.bringToFront();
    await open(tab);
    await openInstitution(tab);
    await openRooms(tab, LABEL_A);

    // One student moves to "Ruang B": its coverage blocker shows; guru.e2e is typed as its Proctor.
    await saveRoom(page, await fillRoom(page, 'Ruang B', STUDENT[0]), 'Ruang B');
    await expect(roomExamCard(page, examA)).toContainText('Cakupan pengawas untuk ruangan belum lengkap.');
    await saveProctors(page, await fillProctors(page, 'Ruang B', [TEACHER[0]]), 'Ruang B');
    await expect(roomExamCard(page, examA)).toContainText('Ruang dan pengawas lengkap.');

    const stale = await fillProctors(tab, 'Ruang A', [TEACHER[0]]);
    await stale.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    await expect(stale.getByText('Penempatan ruang baru saja diubah. Muat ulang untuk melihat penempatan terbaru.')).toBeVisible();
    await expect(stale.getByRole('button', { name: 'Simpan Pengawas', exact: true })).toBeFocused();
    await stale.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(stale).toHaveCount(0);
    await tab.close();
    await page.bringToFront();

    // The Student sees "Ruang: Ruang B"; pengawas.e2e as Proctor sees the exam with "Ruang A".
    const studentContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined, locale: 'id-ID', timezoneId: 'UTC', reducedMotion: 'reduce' });
    const student = await studentContext.newPage();
    await login(student, ...STUDENT);
    await expect(student.getByText('Ruang: Ruang B', { exact: true })).toBeVisible();
    await studentContext.close();
    await page.getByRole('navigation', { name: 'Ruang kerja' }).getByRole('button', { name: 'Ruang Ujian' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Ruang A', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Ruang B', exact: true })).toHaveCount(0);
});

test('ASSESS-INSTITUTION-002 captures: the room screen, each dialog, a refusal, the READY and demotion notices, a non-editable exam', async ({ page }) => {
    test.setTimeout(25 * 60_000);
    expect(examA, 'the journey placed exam A').toBeTruthy();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ...OPERATOR);
    await openInstitution(page);
    const main = () => page.locator('main').first();
    const dialog = () => page.getByRole('dialog');

    // Exam R with its questions and a deadline about a minute ahead, placed first so the deadline passes meanwhile.
    const LABEL_R = 'PAS Ruang E2E';
    await createPeriod(page, LABEL_R);
    await addSession(page, LABEL_R, wibDay(27));
    const examR = await placeExam(page, LABEL_R, wib(2));
    await addQuestions(examR);

    await openRooms(page, LABEL_R);
    await capture(page, 'rooms-empty', main);
    const room = await fillRoom(page, 'Ruang C');
    await capture(page, 'dialog-add-room', dialog);
    await saveRoom(page, room, 'Ruang C');
    const proctors = await fillProctors(page, 'Ruang C', [OPERATOR[0]]);
    await capture(page, 'dialog-proctors', dialog);
    await saveProctors(page, proctors, 'Ruang C');
    const refused = await fillProctors(page, 'Ruang C', ['tidak.ada.e2e']);
    await refused.getByRole('button', { name: 'Simpan Pengawas', exact: true }).click();
    await expect(refused.getByText('ELLIGBLE ID ini tidak ditemukan di sekolah ini: tidak.ada.e2e.')).toBeVisible();
    await capture(page, 'dialog-proctors-refused', dialog);
    // "Hapus" removes its own row: focus goes to the field.
    await refused.getByRole('button', { name: 'Hapus tidak.ada.e2e', exact: true }).click();
    await expect(refused.getByLabel('ELLIGBLE ID pengawas')).toBeFocused();
    await refused.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(refused).toHaveCount(0);
    await saveRoom(page, await fillRoom(page, 'Ruang D', STUDENT[0]), 'Ruang D');
    await expect(roomCard(page, 'Ruang D')).toContainText('Belum ada pengawas');
    await capture(page, 'rooms-mixed', main);
    await roomExamCard(page, examR).getByRole('button', { name: 'Tambah Peserta', exact: true }).click();
    await expect(dialog()).toBeVisible();
    await capture(page, 'dialog-addition', dialog);
    await dialog().getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(dialog()).toHaveCount(0);
    // Back into "Ruang C": "Ruang D" empties and disappears.
    await roomCard(page, 'Ruang C').getByRole('button', { name: 'Tempatkan Peserta', exact: true }).click();
    const back = page.getByRole('dialog', { name: 'Tempatkan Peserta di Ruang C' });
    await back.getByLabel('Tampilkan').selectOption({ label: 'Semua peserta' });
    await back.getByRole('checkbox', { name: new RegExp(`^${STUDENT[0].replace(/\./g, '\\.')}\\b`) }).check();
    await back.getByRole('button', { name: 'Tempatkan Peserta', exact: true }).click();
    await expect(notice(page, /^Peserta ditempatkan di Ruang C: 1 peserta\./)).toBeVisible();
    await expect(roomCard(page, 'Ruang D')).toHaveCount(0);

    // After R's deadline: mark ready, then a change that leaves "Ruang D" without a Proctor sends it back.
    await expect.poll(() => deadlinePassed(examR), { timeout: 150_000, intervals: [2_000] }).toBe(true);
    await backToPeriods(page);
    // "Kembali" already refreshes; "Muat Ulang" reads the period again after the deadline, without a browser reload
    // racing that refresh (a Firefox reload stayed pending here, CI #234).
    const reload = page.getByRole('button', { name: 'Muat Ulang', exact: true });
    await reload.click();
    await expect(reload).toBeEnabled();
    await openPeriod(page, LABEL_R);
    await examCard(page, examR).getByRole('button', { name: 'Tandai Siap', exact: true }).click();
    await page.getByRole('dialog', { name: 'Tandai Siap?' }).getByRole('button', { name: 'Tandai Siap', exact: true }).click();
    await expect(notice(page, 'ditandai siap.')).toBeVisible();
    await openRooms(page, LABEL_R);
    const ready = await fillRoom(page, 'Ruang D', STUDENT[0]);
    await expect(ready.getByText('Ujian yang sudah ditandai siap akan diperiksa ulang. Bila belum lengkap, ujian kembali ke Terjadwal dan perlu ditandai siap lagi.')).toBeVisible();
    await capture(page, 'dialog-ready-notice', dialog);
    await saveRoom(page, ready, 'Ruang D');
    await expect(notice(page, `Ujian ${EXAM_LABEL} kembali ke Terjadwal dan perlu ditandai siap lagi.`)).toBeVisible();
    await capture(page, 'notice-demotion', main);
    await backToPeriods(page);
    await openPeriod(page, LABEL_R);
    await expect(examCard(page, examR).getByRole('button', { name: 'Perpanjang Tenggat' })).toHaveCount(0);

    // An opened exam (by fixture SQL) is shown without its room actions, then set back.
    await setLifecycle(examA, 'ACTIVE');
    try {
        await openRooms(page, LABEL_A);
        await expect(roomExamCard(page, examA)).toContainText('Ujian ini sudah dibuka, jadi ruang dan pengawasnya tidak dapat diubah di sini.');
        await expect(page.getByRole('button', { name: 'Tambah Ruang', exact: true })).toHaveCount(0);
        await capture(page, 'exam-not-editable', main);
    } finally {
        await setLifecycle(examA, 'SCHEDULED');
    }
});
