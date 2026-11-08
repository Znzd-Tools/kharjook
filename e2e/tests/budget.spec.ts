import { dbRows, expect, open, test } from './fixtures';

type Alloc = { category_id: string; month: string; amount_toman: number };

test('budget: caps are envelopes; create one and move money', async ({ page }) => {
  await open(page, '/budget');
  // Seed cap on خوراک (5M) is an envelope already.
  await expect(page.getByRole('button', { name: 'پاکت خوراک' })).toBeVisible();

  // New envelope for اجاره, every month 20M.
  await page.getByRole('button', { name: '+ پاکت جدید' }).click();
  await page.getByRole('option', { name: 'اجاره' }).click();
  await page.getByLabel('مبلغ هر ماه').fill('20000000');
  await page.getByRole('button', { name: 'ذخیره' }).click();
  await expect(page.getByRole('button', { name: 'پاکت اجاره' })).toBeVisible();
  await expect
    .poll(async () => (await dbRows<{ category_id: string; monthly_limit_toman: number }>('category_spending_caps')).find((c) => c.category_id === 'c-rent')?.monthly_limit_toman)
    .toBe(20_000_000);
  expect((await dbRows<{ category_id: string; rollover: boolean }>('budget_envelopes')).find((e) => e.category_id === 'c-rent')?.rollover).toBe(true);

  // Move 1M from اجاره to خوراک this month.
  await page.getByRole('button', { name: 'جابه‌جایی پول' }).click();
  await page.getByLabel('از پاکت').click();
  await page.getByRole('option', { name: /اجاره/ }).click();
  await page.getByLabel('به پاکت').click();
  await page.getByRole('option', { name: /خوراک/ }).click();
  await page.getByLabel('مبلغ', { exact: true }).fill('1000000');
  await page.getByRole('button', { name: 'انتقال', exact: true }).click();
  await expect.poll(async () => (await dbRows<Alloc>('budget_allocations')).map((a) => `${a.category_id}:${a.amount_toman}`).sort())
    .toEqual(['c-food:6000000', 'c-rent:19000000']);
});

test('budget: remove an envelope keeps transactions', async ({ page }) => {
  const before = (await dbRows('transactions')).length;
  await open(page, '/budget');
  await page.getByRole('button', { name: 'پاکت خوراک' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'برداشتن پاکت' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'برداشتن' }).click();
  await expect(page.getByText('هنوز پاکتی نداری')).toBeVisible();
  expect(await dbRows('category_spending_caps')).toHaveLength(0);
  expect((await dbRows('transactions')).length).toBe(before);
});
