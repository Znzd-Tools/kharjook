import { test as setup } from '@playwright/test';
import { STORAGE, loginViaUi, resetDb, stubNetwork } from './fixtures';

setup('log in once', async ({ page }) => {
  await resetDb();
  await stubNetwork(page);
  await loginViaUi(page);
  await page.context().storageState({ path: STORAGE });
});
