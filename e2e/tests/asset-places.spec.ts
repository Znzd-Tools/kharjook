import { dbRows, expect, open, test } from './fixtures';

type H = { asset_id: string; place_id: string; quantity: number };

test('home shows the unplaced part; assigning it puts it in the place (no transaction)', async ({ page }) => {
  const txBefore = (await dbRows<{ id: string }>('transactions')).length;
  await open(page, '/');
  // Mock: 300 دلار, 200 in نوبیتکس → 100 unplaced (other assets have no place at all).
  const row = page.getByRole('button', { name: /^(100|۱۰۰) دلار دلار محلش مشخص نیست/ });
  await expect(row).toBeVisible();
  await row.click();
  const sheet = page.getByRole('dialog', { name: /محل نگهداری دلار/ });
  await sheet.getByRole('button', { name: 'به', exact: true }).click();
  await page.getByRole('dialog', { name: 'به' }).getByRole('option', { name: 'نوبیتکس' }).or(page.getByRole('dialog', { name: 'به' }).getByRole('button', { name: 'نوبیتکس' })).first().click();
  await sheet.getByRole('button', { name: 'ثبت' }).click();
  await expect.poll(async () => (await dbRows<H>('asset_place_holdings')).find((h) => h.asset_id === 'usd')?.quantity).toBe(300);
  expect((await dbRows<{ id: string }>('transactions')).length).toBe(txBefore);
});

test('asset page lists places and the unplaced part; places page shows what is in each place', async ({ page }) => {
  await open(page, '/assets/usd');
  const section = page.getByRole('region', { name: 'محل نگهداری' }).or(page.locator('section', { hasText: 'محل نگهداری' })).first();
  await expect(section).toContainText('نوبیتکس');
  await expect(section).toContainText('بدون محل');

  await open(page, '/manage/places');
  await page.getByPlaceholder(/نوبیتکس، تراست‌والت/).fill('تراست‌والت');
  await page.getByRole('group', { name: 'نوع محل' }).getByRole('button', { name: 'کیف پول', exact: true }).click();
  await page.getByRole('button', { name: 'افزودن محل' }).click();
  await expect.poll(async () => (await dbRows<{ name: string; kind: string }>('asset_places')).find((p) => p.name === 'تراست‌والت')?.kind).toBe('wallet');
  await expect(page.getByText('تراست‌والت').first()).toBeVisible();
});
