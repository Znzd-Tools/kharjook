import { expect, open, test } from './fixtures';

test('PnL card switches between the three views', async ({ page }) => {
  await open(page, '/pnl');
  const card = page.getByRole('region', { name: 'سود و زیان', exact: true });
  await expect(card).toContainText('از آخرین باری که موجودی‌شان صفر شد');
  await card.getByRole('radio', { name: 'امسال' }).click();
  await expect(card).toContainText('از ۱ فروردین');
  await expect(card).toContainText('محقق‌شده');
  await card.getByRole('radio', { name: 'از ابتدا' }).click();
  await expect(card).toContainText('از اولین تراکنش');
  await expect(card).toContainText('به دلار');
});

test('PnL card is on the assets tab and links to the screen', async ({ page }) => {
  await open(page, '/assets');
  await page.getByRole('region', { name: 'سود و زیان', exact: true }).getByRole('link', { name: 'جزئیات' }).click();
  await expect(page).toHaveURL(/\/pnl\?view=active/);
});

test('asset page shows its holding periods', async ({ page }) => {
  await open(page, '/assets/gold');
  const section = page.getByRole('region', { name: 'دوره‌های نگهداری' });
  await expect(section.getByRole('listitem')).toHaveCount(2);
  await expect(section).toContainText('دوره فعلی');
  await expect(section).toContainText('بسته شده');
});
