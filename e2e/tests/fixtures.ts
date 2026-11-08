import { test as base, expect, type Page } from '@playwright/test';

export const MOCK = 'http://127.0.0.1:54329';
export const STORAGE = 'e2e/.auth/state.json';

export async function resetDb() {
  const res = await fetch(`${MOCK}/__reset`, { method: 'POST' });
  expect(res.ok).toBeTruthy();
}

export async function dbRows<T = Record<string, unknown>>(table: string): Promise<T[]> {
  const res = await fetch(`${MOCK}/__db/${table}`);
  return (await res.json()) as T[];
}

/** Offline-safe: stub the external price API, block third-party hosts. */
export async function stubNetwork(page: Page) {
  await page.route('**/api/prices/quotes**', (r) => r.fulfill({ json: { quotes: [] } }));
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
}

export async function loginViaUi(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('test@kharjook.dev');
  await page.locator('input[type="password"]').fill('password123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000, waitUntil: 'commit' });
}

const IGNORED = /Failed to load resource|net::ERR|webpack-hmr|price|quotes|favicon|sw\.js|ServiceWorker|Download the React DevTools/i;

/**
 * `test` with: fresh DB per test, stubbed network, and an `errors` check
 * that fails the test on any uncaught error or console error.
 */
export const test = base.extend<{ autoSetup: void }>({
  autoSetup: [
    async ({ page }, use) => {
      await resetDb();
      await stubNetwork(page);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
      page.on('console', (m) => {
        if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`console: ${m.text().split('\n')[0]}`);
      });
      await use();
      expect(errors, errors.join('\n')).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
