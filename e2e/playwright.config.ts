import { defineConfig, devices } from '@playwright/test';

// Browser end-to-end suite against the real production process (built client served by
// the runtime, production cookies) on a disposable PostgreSQL database provisioned through
// the operator CLI. See global-setup.ts. Requirements: ELLIGBLE_TEST_DATABASE_URL (a role
// that may create databases; password in PGPASSWORD) and a built web client.

export const E2E_PORT = Number(process.env['E2E_PORT'] ?? 3400);

// One project per run (E2E_PROJECT, default mobile-360): the suite walks one exam through its
// whole life, so every browser and width gets its own fresh database and server (CI runs
// them as a matrix). Firefox and WebKit need their browsers installed
// (`npx playwright install --with-deps firefox webkit`).
const PROJECTS = [
    { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'firefox-1280', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
    { name: 'webkit-390', use: { ...devices['iPhone 13'] } },
];
const selected = process.env['E2E_PROJECT'] ?? 'mobile-360';
const project = PROJECTS.find(p => p.name === selected);
if (!project) throw new Error(`Unknown E2E_PROJECT ${selected}; one of ${PROJECTS.map(p => p.name).join(', ')}`);

export default defineConfig({
    testDir: './tests',
    timeout: 90_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: !!process.env['CI'],
    reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
    globalSetup: './global-setup.ts',
    globalTeardown: './global-teardown.ts',
    use: {
        baseURL: `http://127.0.0.1:${E2E_PORT}`,
        locale: 'id-ID',
        // A device clock zone unlike the school's: every time must still show in WIB (D04.2-36).
        timezoneId: 'UTC',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [project],
});
