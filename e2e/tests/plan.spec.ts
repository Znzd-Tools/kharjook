import { dbRows, expect, open, test } from './fixtures';

type Row = Record<string, unknown> & { id: string };

test('one-tap pay a check, then undo restores everything', async ({ page }) => {
  const before = await dbRows<Row>('transactions');
  await open(page, '/deadlines');
  await page.getByRole('button', { name: 'پرداخت چک آقای رضایی' }).click();
  await expect.poll(async () => (await dbRows<Row>('checks'))[0]?.status).toBe('cleared');
  const created = (await dbRows<Row>('transactions')).filter((t) => !before.some((b) => b.id === t.id));
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ type: 'EXPENSE', source_wallet_id: 'w-irt', source_amount: 12000000, date_string: '1405/08/19' });

  await page.getByRole('button', { name: 'برگردان' }).click();
  await expect.poll(async () => (await dbRows<Row>('checks'))[0]?.status).toBe('pending');
  expect((await dbRows<Row>('checks'))[0]).toMatchObject({ cleared_at: null, paid_transaction_id: null });
  await expect.poll(async () => (await dbRows<Row>('transactions')).length).toBe(before.length);
});

test('one-tap pay an installment', async ({ page }) => {
  await open(page, '/deadlines');
  await page.getByRole('button', { name: 'پرداخت وام مسکن' }).first().click();
  await expect.poll(async () => (await dbRows<Row>('loan_installments')).find((i) => i.id === 'inst7')?.is_paid).toBe(true);
});

test('pay a subscription advances its next due date; undo moves it back', async ({ page }) => {
  await open(page, '/deadlines');
  await page.getByRole('button', { name: 'پرداخت اینترنت' }).click();
  await expect.poll(async () => (await dbRows<Row>('subscriptions'))[0]?.next_due_date_string).toBe('1405/09/20');
  await page.getByRole('button', { name: 'برگردان' }).click();
  await expect.poll(async () => (await dbRows<Row>('subscriptions'))[0]?.next_due_date_string).toBe('1405/08/20');
  expect(await dbRows('subscription_payments')).toHaveLength(0);
});

test('partial payment of an installment', async ({ page }) => {
  await open(page, '/deadlines');
  await page.getByRole('button', { name: 'گزینه‌های وام مسکن' }).first().click();
  await page.getByRole('button', { name: 'پرداخت جزئی…' }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('2000000');
  await page.getByRole('button', { name: 'ثبت پرداخت' }).click();
  await expect.poll(async () => (await dbRows<Row>('loan_installments')).find((i) => i.id === 'inst7')).toMatchObject({ paid_amount: 2000000, is_paid: false });
});

test('person settle opens a pre-filled transfer', async ({ page }) => {
  await open(page, '/deadlines');
  await page.getByRole('button', { name: 'تسویه' }).click();
  await expect(page).toHaveURL(/type=TRANSFER.*personId=p-ali/);
});

test('every hub stays reachable', async ({ page }) => {
  await open(page, '/deadlines');
  for (const name of ['اقساط و وام‌ها', 'چک‌ها', 'اشتراک‌ها', 'اشخاص']) {
    await expect(page.getByRole('link', { name: new RegExp(name) }).last()).toBeVisible();
  }
});
