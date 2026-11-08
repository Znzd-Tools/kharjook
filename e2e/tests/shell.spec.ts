import { expect, open, test } from './fixtures';

const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'ناوبری اصلی' });

test('four tabs navigate to their roots', async ({ page }) => {
  await open(page, '/');
  for (const [label, url] of [
    ['تراکنش‌ها', /\/transactions$/],
    ['سبد', /\/assets$/],
    ['برنامه', /\/deadlines$/],
    ['خانه', /\/$/],
  ] as const) {
    await nav(page).getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(url);
  }
});

test('tap on + opens a new expense', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: /ثبت هزینه/ }).click();
  await expect(page).toHaveURL(/\/transactions\/new\?type=EXPENSE/);
});

test('long press on + opens all transaction types', async ({ page }) => {
  await open(page, '/');
  const fab = page.getByRole('button', { name: /ثبت هزینه/ });
  await fab.hover();
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const sheet = page.getByRole('dialog');
  for (const label of ['هزینه', 'درآمد', 'انتقال', 'خرید دارایی', 'فروش دارایی', 'تبدیل']) {
    await expect(sheet.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await sheet.getByRole('button', { name: 'تبدیل', exact: true }).click();
  await expect(page).toHaveURL(/type=CONVERT/);
});

test('sub navigation inside a tab', async ({ page }) => {
  await open(page, '/assets');
  await page.getByRole('link', { name: 'کیف پول‌ها' }).click();
  await expect(page).toHaveURL(/\/wallets$/);
  await page.getByRole('link', { name: 'قیمت‌ها' }).click();
  await expect(page).toHaveURL(/\/prices$/);
});

test('⋯ menu links work (categories)', async ({ page }) => {
  await open(page, '/transactions');
  await page.getByRole('button', { name: 'گزینه‌های بیشتر' }).click();
  await expect(page.getByRole('menuitem', { name: 'ورود از CSV' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'تراکنش‌های دوره‌ای' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'دسته‌بندی‌ها و سقف‌ها' }).click();
  await expect(page).toHaveURL(/\/manage\/categories/);
});

test('avatar opens settings; an old "off" cookie cannot bring the old shell back', async ({ page, context }) => {
  await context.addCookies([{ name: 'kj_flags', value: encodeURIComponent(JSON.stringify({ 'v2.shell': false })), url: 'http://localhost:3100' }]);
  await open(page, '/');
  await expect(nav(page)).toBeVisible();
  await page.getByRole('link', { name: 'تنظیمات' }).first().click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByText('آزمایشی')).toHaveCount(0);
});

test('display currency is remembered', async ({ page }) => {
  await open(page, '/settings');
  await page.getByRole('radio', { name: 'دلار' }).click();
  await expect(page.getByRole('radio', { name: 'دلار' })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'دلار' })).toBeChecked();
  await page.getByRole('radio', { name: 'تومان' }).click();
});
