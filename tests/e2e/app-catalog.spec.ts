import { expect, test } from '@playwright/test';
import { expectBodyContains, waitForHydratedBody } from './page-ready';

test('GET /api/apps/catalog expose les apps avec image et tarifs', async ({ request }) => {
  const response = await request.get('/api/apps/catalog');
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as {
    success: boolean;
    apps: Array<{ id: string; title: string; imageUrl?: string; pricing: unknown[] }>;
  };
  expect(body.success).toBe(true);
  expect(body.apps.length).toBeGreaterThanOrEqual(9);

  const erp = body.apps.find((a) => a.id === 'erp-multi-ecole');
  expect(erp).toBeTruthy();
  expect(erp?.title).toMatch(/ERP Multi-École/i);
  expect(erp?.imageUrl).toMatch(/\/apps\/erp-multi-ecole\.svg/);
  expect(erp?.pricing.length).toBeGreaterThan(0);
});

test('la page détail ERP Multi-École affiche titre, galerie et formulaire RDV', async ({ page }) => {
  await page.goto('/applications/erp-multi-ecole', { waitUntil: 'domcontentloaded' });
  await waitForHydratedBody(page);

  await expect(page.locator('h1')).toContainText(/ERP Multi-École/i);
  await expect(page.getByRole('heading', { name: /Fonctionnalités clés/i })).toBeVisible();
  await expect(page.locator('#rdv-fn-erp-multi-ecole')).toBeVisible();
  await expect(page.locator('#rdv-phone-erp-multi-ecole')).toBeVisible();
});

test('l’accueil boutique liste les applications avec liens détail', async ({ page }) => {
  await page.goto('/#boutique', { waitUntil: 'domcontentloaded' });
  await waitForHydratedBody(page);

  const detailLink = page.locator('a[href="/applications/erp-multi-ecole"]').first();
  await expect(detailLink).toBeVisible();
  await detailLink.click();
  await expect(page).toHaveURL(/\/applications\/erp-multi-ecole/);
  await expectBodyContains(page, /ERP Multi-École/i);
});
