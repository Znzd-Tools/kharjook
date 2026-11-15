import { dbRows, expect, open, test } from './fixtures';

type Tx = Record<string, unknown> & { id: string };
type P = { id: string; name: string; currency?: string };

const newRows = async (before: Tx[]) => {
  const ids = new Set(before.map((t) => t.id));
  return (await dbRows<Tx>('transactions')).filter((t) => !ids.has(t.id));
};

test('USD person: lend 50 USD, balance shows in USD, return mirrors the amount', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  // Lend: USD wallet → USD person. Same currency, so no second amount field.
  await open(page, '/transactions/new?type=TRANSFER');
  await page.getByRole('group', { name: 'از' }).getByRole('button', { name: 'دلاری', exact: true }).click();
  await page.getByRole('group', { name: 'به' }).getByRole('button', { name: 'بیشتر…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /سارا/ }).click();
  await page.getByLabel('مبلغ انتقال', { exact: true }).fill('50');
  await expect(page.getByText('مبلغ دریافتی مقصد')).toHaveCount(0);
  await expect(page.getByText('موجودی: $۰')).toBeVisible();
  await page.getByRole('button', { name: 'ثبت انتقال' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  expect((await newRows(before))[0]).toMatchObject({ source_wallet_id: 'w-usd', target_person_id: 'p-usd', source_amount: 50, target_amount: 50 });

  // Person page: balance in USD, and settle opens with the USD wallet.
  await open(page, '/deadlines/persons/p-usd');
  await expect(page.getByLabel('مانده حساب').getByText('به تو بدهکار است')).toBeVisible();
  await expect(page.getByLabel('مانده حساب').getByText('حساب به دلار آمریکا')).toBeVisible();
  await expect(page.getByLabel('مانده حساب').locator('[aria-label*="$"], [aria-label*="دلار"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'دریافت تسویه' }).click();
  await expect(page).toHaveURL(/walletId=w-usd.*amount=50/);
});

test('persons form: pick a currency for a new person; locked once it has transactions', async ({ page }) => {
  await open(page, '/deadlines/persons');
  await page.getByLabel('نام شخص').fill('رضا');
  await page.getByRole('radio', { name: 'دلار آمریکا' }).click();
  await page.getByRole('button', { name: 'ذخیره شخص' }).click();
  await expect.poll(async () => (await dbRows<P>('persons')).find((p) => p.name === 'رضا')?.currency).toBe('USD');

  // علی has transactions in Toman → currency cannot change.
  await page.getByRole('button', { name: 'ویرایش علی' }).click();
  await expect(page.getByText('ارز حسابش قابل تغییر نیست')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'دلار آمریکا' })).toBeDisabled();
});

test('opening balance: "I owe him 300 USD" is saved as -300 and shown on his page', async ({ page }) => {
  await open(page, '/deadlines/persons');
  await page.getByLabel('نام شخص').fill('بابا');
  await page.getByRole('radio', { name: 'دلار آمریکا' }).click();
  await page.getByLabel('مانده اولیه', { exact: true }).fill('300');
  await page.getByRole('radio', { name: 'من به او بدهکارم' }).click();
  await page.getByRole('button', { name: 'ذخیره شخص' }).click();
  await expect
    .poll(async () => (await dbRows<P & { initial_balance?: number }>('persons')).find((p) => p.name === 'بابا'))
    .toMatchObject({ currency: 'USD', initial_balance: -300 });

  const id = (await dbRows<P>('persons')).find((p) => p.name === 'بابا')!.id;
  await open(page, `/deadlines/persons/${id}`);
  await expect(page.getByLabel('مانده حساب').getByText('تو به او بدهکاری')).toBeVisible();
  await expect(page.getByText('مانده اولیه')).toBeVisible();
  await expect(page.getByRole('button', { name: 'پرداخت تسویه' })).toBeVisible();
});

test('person → asset: USD person gives 100 cash dollars into the «دلار» asset', async ({ page }) => {
  const before = await dbRows<Tx>('transactions');
  await open(page, '/transactions/new?type=TRANSFER');
  await page.getByRole('group', { name: 'از' }).getByRole('button', { name: 'بیشتر…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /سارا/ }).click();
  await page.getByRole('group', { name: 'به' }).getByRole('button', { name: 'بیشتر…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^دلار دلار/ }).click();
  await page.getByLabel('مبلغ انتقال', { exact: true }).fill('100');
  await expect(page.getByText('انتقال از شخص به دارایی مجاز نیست')).toHaveCount(0);
  // Mock: USD rate 60,000, «دلار» asset price 100,000 → 100 USD = 6M Toman = 60 units.
  // The line under the amount shows this before saving.
  await expect(page.getByText('به دلار اضافه می‌شود: ۶۰ دلار')).toBeVisible();
  await page.getByRole('button', { name: 'ثبت انتقال' }).click();
  await expect.poll(async () => (await newRows(before)).length).toBe(1);
  expect((await newRows(before))[0]).toMatchObject({
    source_person_id: 'p-usd', source_amount: 100, target_asset_id: 'usd', target_amount: 60, asset_id: 'usd', amount: 60, price_toman: 100000,
  });
});
