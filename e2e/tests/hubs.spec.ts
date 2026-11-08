import { dbRows, expect, open, test } from './fixtures';

test('checks hub: settle from the sheet', async ({ page }) => {
  await open(page, '/deadlines/checks');
  await page.getByRole('button', { name: 'تسویه', exact: true }).click();
  // The check's own wallet (ملت) is preselected.
  await expect(page.getByLabel('پرداخت از')).toContainText('ملت');
  await page.getByRole('button', { name: /ثبت تسویه از ملت/ }).click();
  await expect.poll(async () => (await dbRows<{ status: string }>('checks'))[0]?.status).toBe('cleared');
});

test('subscriptions hub: Lira shows ₺ and pay works', async ({ page }) => {
  await open(page, '/deadlines/subscriptions');
  await expect(page.getByRole('listitem', { name: 'اشتراک Spotify' })).toContainText('₺');
  await page.getByRole('listitem', { name: 'اشتراک اینترنت' }).getByRole('button', { name: 'پرداخت' }).click();
  await page.getByRole('button', { name: /ثبت پرداخت از ملت/ }).click();
  await expect.poll(async () => (await dbRows<{ id: string; next_due_date_string: string }>('subscriptions')).find((s) => s.id === 'sub1')?.next_due_date_string).not.toBe('1405/08/20');
});

test('loans hub: settle an installment (partial amount allowed)', async ({ page }) => {
  await open(page, '/deadlines/loans');
  await page.getByRole('radio', { name: 'اقساط' }).click();
  await page.getByRole('button', { name: 'تسویه', exact: true }).first().click();
  await page.getByLabel(/مبلغ پرداخت/).fill('2000000');
  await page.getByLabel('پرداخت از').click();
  await page.getByRole('option', { name: /ملت/ }).click();
  await page.getByRole('button', { name: /ثبت پرداخت از ملت/ }).click();
  await expect.poll(async () => (await dbRows<{ id: string; paid_amount: number }>('loan_installments')).find((i) => i.id === 'inst7')?.paid_amount).toBe(2000000);
});

test('persons: add a person in the new screen', async ({ page }) => {
  await open(page, '/deadlines/persons');
  await page.getByLabel('نام شخص').fill('مریم');
  await page.getByRole('button', { name: 'ذخیره شخص' }).click();
  await expect.poll(async () => (await dbRows<{ name: string }>('persons')).map((p) => p.name)).toContain('مریم');
  await page.getByText('علی', { exact: true }).click();
  await expect(page).toHaveURL(/\/deadlines\/persons\/p-ali/);
  await expect(page.getByRole('region', { name: 'مانده حساب' })).toBeVisible();
});
