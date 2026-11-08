import { dbRows, expect, open, test } from './fixtures';

const main = (page: import('@playwright/test').Page) => page.getByRole('main');

test('home shows the main blocks', async ({ page }) => {
  await open(page, '/');
  await expect(main(page)).toContainText('ارزش کل دارایی');
  for (const name of ['سود و زیان', 'این ماه', 'تغییر ارزش این ماه', '۷ روز آینده', 'ترکیب سبد', 'جریان نقدی امسال']) {
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  }
});

test('privacy mode hides amounts and is remembered', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'پنهان کردن مبالغ' }).click();
  await expect(main(page).getByLabel('مبلغ پنهان').first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'نمایش مبالغ' })).toBeVisible();
  await page.getByRole('button', { name: 'نمایش مبالغ' }).click();
});

test('tap the currency pill to switch to dollars', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'تغییر واحد' }).click();
  await expect(page.getByRole('button', { name: 'تغییر واحد' })).toHaveText('دلار');
  await page.getByRole('button', { name: 'تغییر واحد' }).click();
});

test('customize: hide a block and it stays hidden (saved per user)', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'ویرایش خانه' }).click();
  await page.getByRole('dialog').getByRole('switch', { name: 'جریان نقدی امسال' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'جریان نقدی امسال', exact: true })).toHaveCount(0);
  await expect.poll(async () => JSON.stringify(await dbRows('user_preferences'))).toContain('cashflow');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('region', { name: 'جریان نقدی امسال', exact: true })).toHaveCount(0);
});

test('pay an upcoming item from home', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'پرداخت چک آقای رضایی' }).click();
  await expect.poll(async () => (await dbRows<{ status: string }>('checks'))[0]?.status).toBe('cleared');
});
