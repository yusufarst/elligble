import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers.ts';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const BASE_TREE = 'aef3abfb4c233105026f11167c92da13d2664337';
const commit = git('rev-parse', 'HEAD');
const applicationTree = git('rev-parse', 'HEAD:frontend/web/src');
const fixtureHash = createHash('sha256').update(readFileSync(new URL('../global-setup.ts', import.meta.url))).digest('hex');
if (process.env['GITHUB_SHA'] && process.env['GITHUB_SHA'] !== commit) throw new Error('Roster evidence SHA mismatch');

async function capture(page: Page, scenario: string) {
    await page.evaluate(async () => { await document.fonts.ready; });
    const viewport = page.viewportSize();
    const name = `workspace-admin-${scenario}-${viewport?.width}x${viewport?.height}-${test.info().project.name}`;
    const browser = page.context().browser();
    const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
        heading: document.querySelector('h1')?.textContent,
    }));
    await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
    writeFileSync(test.info().outputPath(`${name}.json`), JSON.stringify({
        task: 'ADMIN-001', phase: applicationTree === BASE_TREE ? 'before' : 'after', commit,
        baseline: { ref: '1d3eff56ed4a796191a09503fd850454ab5f0d8d', sourceTree: BASE_TREE },
        applicationTree, fixture: { synthetic: true, sha256: fixtureHash },
        browser: { engine: browser?.browserType().name(), version: browser?.version(), project: test.info().project.name },
        viewport, scenario, screenshot: `${name}.png`, metrics, physicalDevice: false,
    }, null, 2));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

test('ADMIN-001 actual workspace baseline before Operator implementation', async ({ page }) => {
    await login(page, 'guru.e2e', 'papan-tulis-hijau');
    await expect(page.getByRole('heading', { name: 'Pelaksanaan Ujian', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Data Siswa', exact: true })).toHaveCount(0);
    const original = page.viewportSize();
    for (const width of [360, 390, 430, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await capture(page, 'missing-operator-entry');
    }
    await page.setViewportSize({ width: 768, height: 360 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await capture(page, 'missing-operator-entry-text-200');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    if (original) await page.setViewportSize(original);
});
