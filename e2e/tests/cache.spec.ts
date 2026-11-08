import { expect, open, test } from './fixtures';

test('second open shows cached data before the server answers', async ({ page }) => {
  await open(page, '/transactions');
  await expect(page.getByRole('main').getByRole('button', { name: /کافه/ }).first()).toBeVisible();
  await page.waitForTimeout(1200); // snapshot is saved after a short delay

  // Make the server slow: data requests wait 4s.
  await page.route('**/rest/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.reload();
  // Cached rows appear well before the slow server responds.
  await expect(page.getByRole('main').getByRole('button', { name: /کافه/ }).first()).toBeVisible({ timeout: 2500 });
});

const idbCount = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('kharjook', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => {
          const r = req.result.transaction('kv').objectStore('kv').count();
          r.onsuccess = () => resolve(r.result);
        };
      })
  );

test('the snapshot is saved, and logout clears it', async ({ page }) => {
  await open(page, '/transactions');
  await expect.poll(() => idbCount(page), { timeout: 5000 }).toBeGreaterThan(0);
  await open(page, '/settings');
  await page.getByRole('button', { name: 'خروج از حساب' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'خروج' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await idbCount(page)).toBe(0);
});
