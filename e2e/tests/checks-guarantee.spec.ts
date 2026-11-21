import { dbRows, expect, open, test } from './fixtures';

test('guarantee cheque: not a payment in Plan; own tab in the cheques hub, no settle', async ({ page }) => {
  await open(page, '/deadlines');
  await expect(page.getByRole('button', { name: 'پرداخت چک آقای رضایی' })).toBeVisible();
  await expect(page.getByText('چک ضمانت اجاره')).toHaveCount(0);

  await open(page, '/deadlines/checks');
  await expect(page.getByLabel('چک چک آقای رضایی')).toBeVisible();
  await expect(page.getByLabel('چک چک ضمانت اجاره')).toHaveCount(0);
  await page.getByRole('radio', { name: /ضمانت/ }).click();
  const card = page.getByLabel('چک چک ضمانت اجاره');
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'تسویه' })).toHaveCount(0);
});

test('a new cheque from the guarantee tab is saved as a guarantee', async ({ page }) => {
  await open(page, '/deadlines/checks/new?guarantee=1');
  await expect(page.getByRole('switch', { name: 'چک ضمانت' })).toBeChecked();
});

test('a cancelled cheque leaves the first view and is behind «چک‌های بسته‌شده»', async ({ page }) => {
  await open(page, '/deadlines/checks');
  await expect(page.getByRole('button', { name: /چک‌های بسته‌شده/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'گزینه‌های چک آقای رضایی' }).click();
  await page.getByRole('menuitem', { name: 'عودت / لغو' }).or(page.getByRole('button', { name: 'عودت / لغو' })).first().click();
  await expect.poll(async () => (await dbRows<{ id: string; status: string }>('checks')).find((c) => c.id === 'chk1')?.status).toBe('cancelled');
  await expect(page.getByLabel('چک چک آقای رضایی')).toHaveCount(0);
  // The success toast covers the bottom button until it closes.
  await page.mouse.move(0, 0);
  await expect(page.getByText('چک عودت/لغو شد')).toBeHidden({ timeout: 10_000 });
  await page.getByRole('button', { name: /چک‌های بسته‌شده/ }).click();
  await expect(page.getByLabel('چک چک آقای رضایی')).toBeVisible();
});
