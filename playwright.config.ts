import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests run against a built server with the seeded demo database.
 * Run `pnpm db:seed && pnpm build` first, then `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3111',
    trace: 'off',
    // Set PLAYWRIGHT_CHROMIUM_PATH when the environment ships a Chromium build that does not
    // match this Playwright version's expected revision.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
})
