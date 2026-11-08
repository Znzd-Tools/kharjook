import { dbRows, expect, MOCK, open, test } from './fixtures';

type Tx = Record<string, unknown> & { id: string };

test('global search: find a category and open its transactions', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'جستجو' }).first().click();
  await page.getByRole('searchbox', { name: 'جستجو' }).fill('کافه');
  await page.getByRole('group', { name: 'دسته‌بندی‌ها' }).getByRole('button', { name: /کافه/ }).click();
  await expect(page).toHaveURL(/\/transactions\?category=c-cafe/);
  await expect(page.getByText('دسته: کافه')).toBeVisible();
});

test('global search: quick entry opens a filled form', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'جستجو' }).first().click();
  await page.getByRole('searchbox', { name: 'جستجو' }).fill('۸۵ هزار کافه نقد');
  await page.getByRole('group', { name: 'ثبت سریع' }).getByRole('button').first().click();
  await expect(page).toHaveURL(/\/transactions\/new/);
  await expect(page.getByLabel('مبلغ هزینه', { exact: true })).toHaveValue('۸۵,۰۰۰');
});

test('report: a category row opens the ledger for that period', async ({ page }) => {
  await open(page, '/reports/cashflow');
  await page.getByRole('link', { name: 'تراکنش‌های اجاره' }).click();
  await expect(page).toHaveURL(/category=c-rent.*type=EXPENSE/);
  await expect(page.getByText('دسته: اجاره')).toBeVisible();
});

test('home: change a monthly cap in place', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'سقف خوراک' }).click();
  const field = page.getByRole('dialog').getByLabel('حداکثر هزینه در ماه');
  await field.fill('7000000');
  await page.getByRole('dialog').getByRole('button', { name: 'ذخیره' }).click();
  await expect
    .poll(async () => (await dbRows<{ category_id: string; monthly_limit_toman: number }>('category_spending_caps')).find((c) => c.category_id === 'c-food')?.monthly_limit_toman)
    .toBe(7_000_000);
});

test('offline: a new expense waits in the queue and is sent once online', async ({ page }) => {
  const before = new Set((await dbRows<Tx>('transactions')).map((t) => t.id));
  await open(page, '/transactions/new?type=EXPENSE');
  // Only the database is unreachable; the app itself still loads.
  await page.route(`${MOCK}/rest/v1/transactions**`, (r) =>
    r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.fallback()
  );
  await page.getByLabel('مبلغ هزینه', { exact: true }).fill('123000');
  await page.getByRole('radio', { name: 'کافه' }).click();
  await page.getByRole('button', { name: 'ثبت هزینه' }).click();
  await expect(page.getByText('اینترنت نیست؛ تراکنش در صف ماند')).toBeVisible();
  expect((await dbRows<Tx>('transactions')).filter((t) => !before.has(t.id))).toHaveLength(0);

  await page.unroute(`${MOCK}/rest/v1/transactions**`);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect
    .poll(async () => (await dbRows<Tx>('transactions')).filter((t) => !before.has(t.id)).map((t) => t.source_amount))
    .toEqual([123000]);
  // A second flush must not create a copy.
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(500);
  expect((await dbRows<Tx>('transactions')).filter((t) => !before.has(t.id))).toHaveLength(1);
});

test('notifications page: tap a row, flip a channel, it is saved', async ({ page }) => {
  await open(page, '/settings');
  await page.getByRole('link', { name: /اعلان‌ها و یادآوری‌ها/ }).click();
  await expect(page).toHaveURL(/\/settings\/notifications/);
  // Defaults: due-today on for both, expense reminder off.
  await expect(page.getByRole('button', { name: /چک امروز.*تلگرام و اپ/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /یادآور ثبت هزینه‌ها.*خاموش/ })).toBeVisible();
  await page.getByRole('button', { name: /اشتراک امروز/ }).click();
  await page.getByRole('dialog').getByRole('switch', { name: 'اپ' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /اشتراک امروز.*تلگرام/ })).toBeVisible();
  await page.getByRole('button', { name: /گزارش دوره‌ای/ }).click();
  await page.getByRole('dialog').getByRole('switch', { name: 'تلگرام' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'هفتگی' }).click();
  await expect
    .poll(async () => (await dbRows<{ channels: Record<string, Record<string, boolean>>; report_interval: string }>('notification_settings'))[0])
    .toMatchObject({ channels: { 'due_today.subscription': { push: false }, report: { telegram: true } }, report_interval: 'weekly' });
});
