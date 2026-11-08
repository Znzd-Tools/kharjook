import type { Locator, Page } from '@playwright/test';
import { dbRows, expect, open, test } from './fixtures';

type Tx = Record<string, unknown> & { id: string; type: string };

const row = (page: Page, title: string) => page.getByRole('main').getByRole('button', { name: new RegExp(title) }).first();

async function swipeOpen(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 40 + i * 24, y);
  await page.mouse.up();
}

test('shows readable rows with amount and category', async ({ page }) => {
  await open(page, '/transactions');
  await page.getByRole('radio', { name: 'همه' }).first(); // chips render
  await expect(row(page, 'کافه')).toContainText('نقد');
  await expect(row(page, 'کافه')).toContainText('۴۵۰٬۰۰۰');
});

test('type and period filters', async ({ page }) => {
  await open(page, '/transactions');
  await page.getByRole('group', { name: 'بازه' }).getByRole('button', { name: 'همه', exact: true }).click();
  await page.getByRole('group', { name: 'نوع' }).getByRole('button', { name: 'خرید', exact: true }).click();
  await expect(row(page, 'خرید طلا')).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: /کافه/ })).toHaveCount(0);
});

test('search narrows the list', async ({ page }) => {
  await open(page, '/transactions');
  await page.getByRole('searchbox').fill('اجاره');
  await expect(row(page, 'اجاره')).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: /کافه/ })).toHaveCount(0);
});

test('swipe delete, then undo restores the exact row', async ({ page }) => {
  await open(page, '/transactions');
  const before = await dbRows<Tx>('transactions');
  const target = before.find((t) => t.type === 'EXPENSE' && t.amount_toman_at_time === 450000)!;
  await swipeOpen(page, row(page, 'کافه'));
  await page.getByRole('button', { name: 'حذف', exact: true }).click();
  await expect.poll(async () => (await dbRows<Tx>('transactions')).some((t) => t.id === target.id)).toBe(false);
  await page.getByRole('button', { name: 'برگردان' }).click();
  await expect.poll(async () => (await dbRows<Tx>('transactions')).find((t) => t.id === target.id)).toMatchObject({
    id: target.id, created_at: target.created_at, source_amount: 450000,
  });
});

test('swipe duplicate creates a copy dated today', async ({ page }) => {
  await open(page, '/transactions');
  const before = await dbRows<Tx>('transactions');
  await swipeOpen(page, row(page, 'کافه'));
  await page.getByRole('button', { name: 'تکرار', exact: true }).click();
  await expect.poll(async () => (await dbRows<Tx>('transactions')).length).toBe(before.length + 1);
  const copy = (await dbRows<Tx>('transactions')).find((t) => !before.some((b) => b.id === t.id))!;
  expect(copy).toMatchObject({ type: 'EXPENSE', source_amount: 450000, category_id: 'c-cafe', source_wallet_id: 'w-cash' });
});

test('long press selects rows; bulk category change', async ({ page }) => {
  await open(page, '/transactions');
  const target = row(page, 'کافه');
  await target.hover();
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.getByRole('toolbar', { name: 'کارهای گروهی' })).toBeVisible();
  await row(page, 'خوراک').click();
  await page.getByRole('toolbar').getByRole('button', { name: 'دسته‌بندی' }).click();
  await page.getByRole('dialog').getByText('اجاره', { exact: true }).click();
  await expect.poll(async () => (await dbRows<Tx>('transactions')).filter((t) => t.category_id === 'c-rent').length).toBeGreaterThanOrEqual(4);
});

test('wallet filter', async ({ page }) => {
  await open(page, '/transactions');
  await page.getByRole('button', { name: 'همه کیف پول‌ها' }).click();
  await page.getByRole('option', { name: /نقد/ }).click();
  await expect(row(page, 'کافه')).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: /اجاره/ })).toHaveCount(0);
});

test('tap opens edit', async ({ page }) => {
  await open(page, '/transactions');
  await row(page, 'کافه').click();
  await expect(page).toHaveURL(/\/transactions\/.+\/edit/);
});

test('delete from the edit screen (no swipe needed)', async ({ page }) => {
  await open(page, '/transactions');
  await row(page, 'کافه').click();
  await expect(page).toHaveURL(/\/edit/);
  const id = page.url().split('/').at(-2)!;
  await page.getByRole('button', { name: 'حذف تراکنش' }).click();
  await expect.poll(async () => (await dbRows<Tx>('transactions')).some((t) => t.id === id)).toBe(false);
  await expect(page).not.toHaveURL(/\/edit/);
});
