import { dbRows, expect, open, setRows, test } from './fixtures';

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

const now = '2026-11-01T00:00:00Z';
const holding = (id: string, place_id: string, quantity: number) => ({ id, user_id: 'u1', asset_id: 'usd', place_id, quantity, updated_at: now });

test('asset went down and has one place: the place updates by itself', async ({ page }) => {
  // دلار: 300 held, but the place says 350 (as after a sell or a payment).
  await setRows('asset_place_holdings', [holding('aph-1', 'pl-ex', 350)]);
  await open(page, '/');
  await expect.poll(async () => (await dbRows<H>('asset_place_holdings')).find((h) => h.place_id === 'pl-ex')?.quantity).toBe(300);
  await expect(page.getByText('محل دلار به‌روز شد')).toBeVisible();
});

test('asset went down and has several places: asks which places, more than one allowed', async ({ page }) => {
  await setRows('asset_places', [
    { id: 'pl-ex', user_id: 'u1', name: 'نوبیتکس', kind: 'exchange', note: null, order_index: 0, archived_at: null, created_at: now, updated_at: now },
    { id: 'pl-tw', user_id: 'u1', name: 'تراست', kind: 'wallet', note: null, order_index: 1, archived_at: null, created_at: now, updated_at: now },
  ]);
  // 300 held; places say 250 + 100 = 350 → 50 came out of somewhere.
  await setRows('asset_place_holdings', [holding('aph-1', 'pl-ex', 250), holding('aph-2', 'pl-tw', 100)]);
  await open(page, '/');
  const sheet = page.getByRole('dialog', { name: 'دلار از کدام محل کم شد؟' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('برداشت از نوبیتکس').fill('20');
  await expect(sheet.getByRole('button', { name: 'ثبت' })).toBeDisabled();
  await sheet.getByRole('button', { name: 'باقی از اینجا' }).nth(1).click();
  await sheet.getByRole('button', { name: 'ثبت' }).click();
  await expect.poll(async () => {
    const rows = await dbRows<H>('asset_place_holdings');
    return rows.map((h) => `${h.place_id}:${h.quantity}`).sort().join(' ');
  }).toBe('pl-ex:230 pl-tw:70');
  await expect(sheet).toBeHidden();
});
