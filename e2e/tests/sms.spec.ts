import { dbRows, expect, open, test } from './fixtures';

type Sms = { id: string; status: string; transaction_id: string | null; wallet_id: string | null };
const DUP = 'بانک ملت\nخرید\nمبلغ:1,000,000\nمانده:5,000,000\n0805-14:23';
const MELLAT = 'بانک ملت\nخرید\nمبلغ:1,234,000\nمانده:5,000,000\n0805-14:23\nکافه لمیز';

async function setup(page: import('@playwright/test').Page) {
  await open(page, '/settings');
  await page.getByRole('button', { name: 'روشن کردن' }).click();
  const url = await page.getByLabel('آدرس ارسال پیامک').inputValue();
  expect(url).toContain('/api/sms/ingest?token=');
  return url;
}

test('SMS: forwarder posts, OTP dropped, duplicate ignored, bad token refused', async ({ page, request }) => {
  const url = await setup(page);
  expect(await (await request.post(url, { data: { from: 'Mellat', text: MELLAT } })).json()).toMatchObject({ status: 'saved' });
  expect(await (await request.post(url, { data: { from: 'Mellat', text: MELLAT } })).json()).toMatchObject({ status: 'duplicate' });
  expect(await (await request.post(url, { data: { text: 'بانک ملت\nرمز پویا: 123456\nمبلغ:1,000,000' } })).json()).toMatchObject({ status: 'ignored', reason: 'otp' });
  expect(await (await request.post(url, { data: { text: 'سلام خوبی؟' } })).json()).toMatchObject({ status: 'ignored' });
  expect((await request.post(url.replace(/token=.*/, 'token=wrong-token-wrong-token-123'), { data: { text: MELLAT } })).status()).toBe(401);
  // Plain text body with sender in the query also works.
  expect(await (await request.post(`${url}&from=Melli`, { data: 'بانک ملی ایران\nواریز:20,000,000+\nمانده:23,000,000', headers: { 'content-type': 'text/plain' } })).json()).toMatchObject({ status: 'saved' });
  const rows = await dbRows<{ body: string }>('sms_inbox');
  expect(rows).toHaveLength(2);
  expect(rows.some((r) => r.body.includes('رمز'))).toBe(false);
});

test('SMS: review from the ledger → filled expense → linked', async ({ page, request }) => {
  const url = await setup(page);
  await request.post(url, { data: { from: 'Mellat', text: MELLAT } });
  await open(page, '/transactions');
  await page.getByRole('link', { name: /۱ پیامک بانکی تازه/ }).click();
  await expect(page).toHaveURL(/\/transactions\/sms/);
  await page.getByRole('button', { name: 'هزینه', exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\/new\?.*sms=/);
  await expect(page.getByLabel('مبلغ هزینه', { exact: true })).toHaveValue('۱۲۳,۴۰۰');
  await expect(page.getByRole('button', { name: 'ملت', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('radio', { name: 'کافه' }).click();
  await page.getByRole('button', { name: 'ثبت هزینه' }).click();
  await expect.poll(async () => (await dbRows<Sms>('sms_inbox'))[0]?.status).toBe('done');
  const [sms] = await dbRows<Sms>('sms_inbox');
  const tx = (await dbRows<{ id: string; source_amount: number; date_string: string; source_wallet_id: string }>('transactions')).find((t) => t.id === sms!.transaction_id);
  expect(tx).toMatchObject({ source_amount: 123400, date_string: '1405/08/05', source_wallet_id: 'w-irt' });
  expect(sms!.wallet_id).toBe('w-irt');
});

test('SMS: income gives sell / convert / person; ignore has undo', async ({ page, request }) => {
  const url = await setup(page);
  await request.post(url, { data: { text: 'بانک ملت\nواریز\nمبلغ:20,000,000\nمانده:30,000,000' } });
  await open(page, '/transactions/sms');
  await page.getByRole('button', { name: 'گزینه‌های دیگر' }).click();
  for (const label of ['انتقال از حساب دیگرم', 'فروش دارایی (طلا، ارز، سهام…)', 'تبدیل ارز به تومان', 'دریافت از شخص (طلب یا قرض)'])
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'نادیده گرفتن' }).click();
  await expect.poll(async () => (await dbRows<Sms>('sms_inbox'))[0]?.status).toBe('ignored');
  await page.getByRole('button', { name: 'برگردان' }).click();
  await expect.poll(async () => (await dbRows<Sms>('sms_inbox'))[0]?.status).toBe('new');
});

test('SMS: an already recorded transaction is offered first and links', async ({ page, request }) => {
  const url = await setup(page);
  await request.post(url, { data: { text: DUP } });
  await open(page, '/transactions/sms');
  await page.getByRole('button', { name: 'قبلاً ثبت شده؛ همین است' }).click();
  await expect.poll(async () => (await dbRows<Sms>('sms_inbox'))[0]?.transaction_id).not.toBeNull();
  expect((await dbRows<Sms>('sms_inbox'))[0]?.status).toBe('done');
});
