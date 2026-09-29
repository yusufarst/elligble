import { defineConfig, devices } from '@playwright/test';

// Browser end-to-end suite against the real production process (built client served by
// the runtime, production cookies) on a disposable PostgreSQL database provisioned through
// the operator CLI. See global-setup.ts. Requirements: ELLIGBLE_TEST_DATABASE_URL (a role
// that may create databases; password in PGPASSWORD) and a built web client.

export const E2E_PORT = Number(process.env['E2E_PORT'] ?? 3400);

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
    projects: [
        { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
    ],
});
