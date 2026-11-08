import type { Page } from '@playwright/test';
import { dbRows, expect, open, test } from './fixtures';

type Tx = Record<string, unknown> & { id: string; type: string };

const newRows = async (before: Tx[]) => {
  const ids = new Set(before.map((t) => t.id));
  return (await dbRows<Tx>('transactions')).filter((t) => !ids.has(t.id));
};

const amount = (page: Page, label: string) => page.getByLabel(label, { exact: true });

test('expense: amount → category → save (wallet defaults from the category)', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, '/transactions/new?type=EXPENSE');
  await amount(page, 'مبلغ هزینه').fill('850000');
  await page.getByRole('radio', { name: 'کافه' }).click();
  // Seed: cafe expenses were paid from "نقد" → default wallet.
  await expect(page.getByRole('button', { name: 'نقد', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'ثبت هزینه' }).click();
  await expect(page).not.toHaveURL(/\/transactions\/new/);
  const [row] = await newRows(before);
  expect(row).toMatchObject({
    type: 'EXPENSE', source_wallet_id: 'w-cash', source_amount: 850000, category_id: 'c-cafe', amount_toman_at_time: 850000,
  });
});

test('save & next keeps the form open and the wallet', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, '/transactions/new?type=EXPENSE');
  await amount(page, 'مبلغ هزینه').fill('100000');
  await page.getByRole('radio', { name: 'خوراک' }).click();
  await page.getByRole('button', { name: 'ثبت و بعدی' }).click();
  await expect(amount(page, 'مبلغ هزینه')).toHaveValue('');
  await amount(page, 'مبلغ هزینه').fill('200000');
  await page.getByRole('button', { name: 'ثبت و بعدی' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(2);
  const rows = await newRows(before);
  expect(rows.map((r) => r.source_amount).sort()).toEqual([100000, 200000]);
  expect(new Set(rows.map((r) => r.source_wallet_id)).size).toBe(1);
});

test('undo removes the saved transaction', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  // In-app navigation (like a real user): Home → + button.
  await open(page, '/');
  await page.getByRole('button', { name: /ثبت هزینه/ }).click();
  await amount(page, 'مبلغ هزینه').fill('5000');
  await page.getByRole('radio', { name: 'خوراک' }).click();
  await page.getByRole('button', { name: 'ثبت هزینه' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  await page.getByRole('button', { name: 'برگردان' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(0);
});

test('income to the most used income wallet', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, '/transactions/new?type=INCOME');
  await amount(page, 'مبلغ درآمد').fill('45000000');
  await page.getByRole('radio', { name: 'حقوق' }).click();
  await page.getByRole('button', { name: 'ثبت درآمد' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  expect((await newRows(before))[0]).toMatchObject({ type: 'INCOME', target_wallet_id: 'w-irt', target_amount: 45000000, category_id: 'c-salary' });
});

test('transfer between two wallets', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, '/transactions/new?type=TRANSFER');
  const from = page.getByRole('group', { name: 'از' });
  const to = page.getByRole('group', { name: 'به' });
  await from.getByRole('button', { name: 'ملت', exact: true }).click();
  await to.getByRole('button', { name: 'نقد', exact: true }).click();
  await amount(page, 'مبلغ انتقال').fill('1000000');
  await page.getByRole('button', { name: 'ثبت انتقال' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  expect((await newRows(before))[0]).toMatchObject({
    type: 'TRANSFER', source_wallet_id: 'w-irt', target_wallet_id: 'w-cash', source_amount: 1000000, target_amount: 1000000,
  });
});

test('buy by total amount computes the quantity', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, '/transactions/new?type=BUY');
  await page.getByRole('group', { name: 'دارایی' }).getByRole('button', { name: 'صندوق', exact: true }).click();
  await page.getByRole('group', { name: 'پرداخت از' }).getByRole('button', { name: 'ملت', exact: true }).click();
  await page.getByLabel('قیمت', { exact: false }).first().fill('30000');
  await page.getByRole('button', { name: 'بر اساس مبلغ کل' }).click();
  await page.getByLabel('مبلغ کل خرید').fill('3000000');
  await page.getByRole('button', { name: 'ثبت خرید' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  expect((await newRows(before))[0]).toMatchObject({
    type: 'BUY', target_asset_id: 'fund', target_amount: 100, source_wallet_id: 'w-irt', source_amount: 3000000, price_toman: 30000,
  });
});

test('sell half with the percent chip', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, '/transactions/new?type=SELL');
  await page.getByRole('group', { name: 'دارایی' }).getByRole('button', { name: 'طلا', exact: true }).click();
  await page.getByRole('button', { name: '۵۰٪' }).click();
  await page.getByLabel('قیمت', { exact: false }).first().fill('9000000');
  await page.getByRole('group', { name: 'واریز به' }).getByRole('button', { name: 'ملت', exact: true }).click();
  await page.getByRole('button', { name: 'ثبت فروش' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  expect((await newRows(before))[0]).toMatchObject({
    type: 'SELL', source_asset_id: 'gold', source_amount: 3, target_wallet_id: 'w-irt', target_amount: 27000000,
  });
});

test('edit an expense amount', async ({ page }) => {
  await open(page, '/transactions/t017/edit');
  const field = amount(page, 'مبلغ هزینه');
  await expect(field).not.toHaveValue('');
  await field.fill('13000000');
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click();
  await expect.poll(async () => (await dbRows<Tx>('transactions')).find((t) => t.id === 't017')?.source_amount).toBe(13000000);
});

test('shared text fills the form', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, `/transactions/new?text=${encodeURIComponent('۸۵ هزار کافه نقد')}`);
  await expect(amount(page, 'مبلغ هزینه')).toHaveValue('۸۵,۰۰۰');
  await page.getByRole('button', { name: 'ثبت هزینه' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  expect((await newRows(before))[0]).toMatchObject({ type: 'EXPENSE', source_amount: 85000, category_id: 'c-cafe', source_wallet_id: 'w-cash' });
});

test('deep link: closing goes to the ledger, not out of the app', async ({ page }) => {
  await open(page, '/transactions/new?type=EXPENSE');
  await page.getByRole('main').getByRole('button', { name: 'بستن' }).click();
  await expect(page).toHaveURL(/\/transactions$/);
});

test('no multi-row form any more; «ثبت و بعدی» is visible instead', async ({ page }) => {
  await open(page, '/transactions/new?type=EXPENSE');
  await expect(page.getByText('چندتایی', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ثبت و بعدی' })).toBeVisible();
});

test('convert opens with its form', async ({ page }) => {
  await open(page, '/transactions/new?type=CONVERT');
  await expect(page.getByRole('button', { name: 'ثبت تبدیل' })).toBeVisible();
});

test('create a category inline and use it', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, '/transactions/new?type=EXPENSE');
  await page.getByRole('button', { name: '+ جدید' }).click();
  await page.getByPlaceholder('مثلاً باشگاه').fill('باشگاه');
  await page.getByRole('button', { name: 'ساخت و انتخاب' }).click();
  await expect(page.getByRole('radio', { name: 'باشگاه' })).toHaveAttribute('aria-checked', 'true');
  await amount(page, 'مبلغ هزینه').fill('900000');
  await page.getByRole('button', { name: 'ثبت هزینه' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  const cat = (await dbRows<{ id: string; name: string }>('categories')).find((c) => c.name === 'باشگاه');
  expect((await newRows(before))[0]).toMatchObject({ category_id: cat?.id, source_amount: 900000 });
});
