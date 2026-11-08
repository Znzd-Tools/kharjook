import { expect, test } from './fixtures';

/** Every screen of the app must open without a crash or console error. */
const ROUTES = [
  '/', '/assets', '/assets/gold', '/wallets', '/wallets/w-irt', '/transactions', '/transactions/new',
  '/deadlines', '/deadlines/loans', '/deadlines/checks', '/deadlines/subscriptions', '/deadlines/persons',
  '/deadlines/persons/p-ali', '/budget', '/prices', '/reports', '/reports/cashflow', '/reports/assets',
  '/settings', '/manage/assets', '/manage/wallets', '/manage/categories', '/manage/goals',
  '/manage/rates', '/manage/price-sources',
];

for (const route of ROUTES) {
  test(`opens ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/مشکلی پیش آمد|Application error|Unhandled Runtime Error|This page could not be found/)).toHaveCount(0);
  });
}
