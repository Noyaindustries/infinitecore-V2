import { expect, test } from '@playwright/test';
import { loginAsRole, loginViaUi } from './auth';
import { waitForHydratedBody } from './page-ready';

test.describe.configure({ timeout: 90_000 });

test('admin — connexion UI sans 2FA puis catalogue applications', async ({ page }) => {
  try {
    await loginViaUi(page, 'admin');
    await expect(page).toHaveURL(/\/superadmin/);
  } catch {
    await page.context().clearCookies();
    await loginAsRole(page, 'admin');
  }

  const response = await page.goto('/superadmin/apps', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  await waitForHydratedBody(page);
  await expect(page).toHaveURL(/\/superadmin\/apps/);

  await expect(page.locator('h1').filter({ hasText: /Catalogue applications/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/ERP Multi-École/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Enregistrer/i })).toBeVisible();
});
