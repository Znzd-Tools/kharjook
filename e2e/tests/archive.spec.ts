import { dbRows, expect, open, test } from './fixtures';

type Row = { id: string; archived_at: string | null };

test('archive an asset with a balance: warns, hides it, archive page restores it', async ({ page }) => {
  await open(page, '/manage/assets');
  await page.getByRole('button', { name: 'بایگانی دلار' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('هنوز موجودی دارد');
  await dialog.getByRole('button', { name: 'بایگانی' }).click();
  await expect.poll(async () => (await dbRows<Row>('assets')).find((a) => a.id === 'usd')?.archived_at).not.toBeNull();
  await expect(page.getByRole('button', { name: 'بایگانی دلار' })).toHaveCount(0);

  await page.getByRole('link', { name: /^بایگانی( \(.+\))?$/ }).or(page.getByRole('button', { name: /^بایگانی( \(.+\))?$/ })).first().click();
  await expect(page).toHaveURL(/\/manage\/archive/);
  await page.getByRole('button', { name: 'بازگردانی دلار' }).click();
  await expect.poll(async () => (await dbRows<Row>('assets')).find((a) => a.id === 'usd')?.archived_at ?? null).toBeNull();
  await expect(page.getByText('بایگانی خالی است')).toBeVisible();
});

test('archive a wallet with no balance: simple confirm, out of the wallets list', async ({ page }) => {
  await open(page, '/manage/wallets');
  await page.getByRole('button', { name: 'بایگانی دلاری' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'بایگانی' }).click();
  await expect.poll(async () => (await dbRows<Row>('wallets')).find((w) => w.id === 'w-usd')?.archived_at).not.toBeNull();
  await open(page, '/manage/archive');
  await expect(page.getByRole('button', { name: 'بازگردانی دلاری' })).toBeVisible();
});
