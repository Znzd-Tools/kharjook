import { dbRows, expect, open, test } from './fixtures';

type G = { scope: string; name: string | null; asset_ids: string[] | null; target_kind: string; target_percent: number | null };

test('a set of assets gets one goal together (e.g. dollar + fund = 30%)', async ({ page }) => {
  await open(page, '/manage/goals');
  await page.getByRole('button', { name: 'هدف جدید' }).click();
  const sheet = page.getByRole('dialog', { name: 'هدف جدید' });
  await sheet.getByRole('radio', { name: 'چند دارایی' }).or(sheet.getByRole('button', { name: 'چند دارایی' })).first().click();
  await sheet.getByPlaceholder('نام مجموعه').fill('ارز و سهام');
  const picks = sheet.getByRole('group', { name: 'دارایی‌های این مجموعه' });
  await picks.getByRole('checkbox', { name: 'دلار' }).click();
  await picks.getByRole('checkbox', { name: 'صندوق' }).click();

  // Gold is in the metals group, which has its own goal: it would count twice.
  await picks.getByRole('checkbox', { name: 'طلا' }).click();
  await sheet.getByRole('textbox').last().fill('30');
  await expect(sheet.getByText(/دو بار حساب می‌شود/)).toBeVisible();
  await picks.getByRole('checkbox', { name: 'طلا' }).click();
  await expect(sheet.getByText(/دو بار حساب می‌شود/)).toHaveCount(0);

  await sheet.getByRole('button', { name: 'ذخیره' }).click();
  await expect
    .poll(async () => (await dbRows<G>('goals')).find((g) => g.scope === 'basket'))
    .toMatchObject({ name: 'ارز و سهام', asset_ids: ['usd', 'fund'], target_kind: 'allocation_percent', target_percent: 30 });
  const list = page.getByRole('region', { name: 'مجموعه‌ها' }).or(page.locator('section[aria-label="مجموعه‌ها"]')).first();
  await expect(list).toContainText('ارز و سهام');
  await expect(list).toContainText('دلار، صندوق');
});
