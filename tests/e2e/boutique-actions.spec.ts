import { expect, test } from '@playwright/test';
import { loginAsRole } from './auth';
import { expectBodyContains, waitForHydratedBody } from './page-ready';

test.describe.configure({ timeout: 90_000 });

test('boutique marketing : filtres, accordéon, CTA essai et fiche produit', async ({ page }) => {
  await page.goto('/boutique', { waitUntil: 'domcontentloaded' });
  await waitForHydratedBody(page);

  await expectBodyContains(page, /Trouvez le logiciel|Boutique|logiciel/i);
  // Attendre une vraie carte produit (pas le skeleton de chargement)
  await expect(page.locator('.pc a[href*="/applications/"]').first()).toBeVisible({ timeout: 20_000 });

  // Filtre secteur
  const commerceFilter = page.getByRole('button', { name: /^Commerce$/i }).first();
  if (await commerceFilter.isVisible().catch(() => false)) {
    await commerceFilter.click();
  }

  // Ouvrir une carte via le chevron / zone produit
  const firstCard = page.locator('.pc').filter({ has: page.locator('a[href*="/applications/"]') }).first();
  await firstCard.click();
  await expect(page.locator('.detail').first()).toBeVisible({ timeout: 10_000 });

  // Onglet tarifs
  await page.getByRole('button', { name: /Tarifs/i }).first().click();
  await expectBodyContains(page, /Abonnement|Licence|FCFA/i);

  // Toggle annuel si présent
  const annualBtn = page.getByRole('button', { name: /^Annuel$/i }).first();
  if (await annualBtn.isVisible().catch(() => false)) {
    await annualBtn.click();
    await expectBodyContains(page, /−20%|annuel/i);
  }

  // CTA essai → signup avec returnTo
  const trialLink = page.getByRole('link', { name: /essai.*gratuit|Commencer l'essai/i }).first();
  await expect(trialLink).toBeVisible();
  const href = await trialLink.getAttribute('href');
  expect(href).toMatch(/\/signup\?returnTo=/);
  expect(decodeURIComponent(href || '')).toContain('/dashboard/boutique');
  expect(decodeURIComponent(href || '')).toMatch(/trial=1|pricing=/);

  // Fiche produit
  const fiche = page.getByRole('link', { name: /Fiche produit/i }).first();
  if (await fiche.isVisible().catch(() => false)) {
    await fiche.click();
    await expect(page).toHaveURL(/\/applications\//);
    await waitForHydratedBody(page);
  }
});

test('boutique marketing : CTA abonnement et licence pointent vers signup', async ({ page }) => {
  await page.goto('/boutique', { waitUntil: 'domcontentloaded' });
  await waitForHydratedBody(page);

  await expect(page.locator('.pc a[href*="/applications/"]').first()).toBeVisible({ timeout: 20_000 });
  const card = page.locator('.pc').filter({ has: page.locator('a[href*="/applications/"]') }).first();
  await card.click();
  await expect(page.locator('.detail').first()).toBeVisible({ timeout: 10_000 });
  await page.locator('.tab', { hasText: /Tarifs/i }).first().click();

  const subLink = page.locator('a.plan-btn, a.lb-btn').filter({ hasText: /S'abonner|licence/i }).first();
  if (await subLink.isVisible().catch(() => false)) {
    const href = await subLink.getAttribute('href');
    expect(href).toMatch(/\/(signup|dashboard\/boutique)/);
  }
});

test('client connecté : deep link boutique Shop préselectionne l’app', async ({ page }) => {
  await loginAsRole(page, 'client');
  await page.goto('/dashboard/boutique?app=erp-multi-ecole&pricing=subscription&billing=month', {
    waitUntil: 'domcontentloaded',
  });
  await waitForHydratedBody(page);
  await expect(page).toHaveURL(/\/dashboard\/boutique/);
  await expectBodyContains(page, /Boutique|ERP|Abonnement|Commander|Confirmer|School Manager/i);
});

test('client connecté : CTAs boutique marketing pointent vers Shop', async ({ page }) => {
  await loginAsRole(page, 'client');
  await page.goto('/boutique', { waitUntil: 'domcontentloaded' });
  await waitForHydratedBody(page);

  await expect(page.locator('.pc a[href*="/applications/"]').first()).toBeVisible({ timeout: 20_000 });
  const card = page.locator('.pc').filter({ has: page.locator('a[href*="/applications/"]') }).first();
  await card.click();
  await expect(page.locator('.detail').first()).toBeVisible({ timeout: 10_000 });
  await page.locator('.tab', { hasText: /Tarifs/i }).first().click();

  const trialLink = page.locator('a').filter({ hasText: /essai|S'abonner|Acheter la licence/i }).first();
  await expect(trialLink).toBeVisible({ timeout: 10_000 });
  const href = await trialLink.getAttribute('href');
  expect(href).toMatch(/^\/dashboard\/boutique\?/);
});

test('API start-trial refuse sans auth', async ({ request }) => {
  const res = await request.post('/api/licenses/start-trial', {
    data: { appId: 'erp-multi-ecole' },
  });
  expect([401, 403]).toContain(res.status());
});

test('catalogue API expose au moins une formule (licence ou abonnement)', async ({ request }) => {
  const res = await request.get('/api/apps/catalog');
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    success: boolean;
    apps: Array<{
      id: string;
      pricing: Array<{ type: string; billingCycle?: string; price: number }>;
    }>;
  };
  expect(body.success).toBe(true);
  expect(body.apps.length).toBeGreaterThanOrEqual(9);
  const erp = body.apps.find((a) => a.id === 'erp-multi-ecole');
  expect(erp).toBeTruthy();
  expect(erp!.pricing.length).toBeGreaterThan(0);
  expect(erp!.pricing.some((p) => p.type === 'license' || p.type === 'subscription')).toBe(true);
});
