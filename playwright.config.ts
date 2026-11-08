import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real Next.js app against the mock Supabase
 * (e2e/mock-supabase). No real backend or secrets needed.
 *
 *   pnpm e2e            → run all
 *   pnpm e2e --ui       → debug
 */
const MOCK_PORT = 54329;
const APP_PORT = 3100;

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  workers: 1, // one shared in-memory DB
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'app',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/state.json' },
    },
  ],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'off',
  },
  webServer: [
    {
      command: `node e2e/mock-supabase/server.ts`,
      env: { PORT: String(MOCK_PORT) },
      url: `http://127.0.0.1:${MOCK_PORT}/__health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: process.env.E2E_PROD ? `pnpm build && pnpm start -p ${APP_PORT}` : `pnpm dev -p ${APP_PORT}`,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'mock-service-key',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      url: `http://localhost:${APP_PORT}/login`,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
