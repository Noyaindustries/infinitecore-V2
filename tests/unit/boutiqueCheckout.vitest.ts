import { describe, expect, it } from 'vitest';
import {
  buildClientShopPath,
  buildLoginWithReturn,
  buildSignupWithReturn,
  resolveBoutiqueCta,
  safeReturnToPath,
} from '../../src/lib/boutiqueCheckout';
import {
  buildBoutiqueProducts,
  resolveCatalogPrices,
} from '../../src/data/boutiqueProducts';
import { INFINITE_APP_CATALOG } from '../../src/data/appCatalog';

describe('boutiqueCheckout deep links', () => {
  it('buildClientShopPath encode app + pricing + billing + trial', () => {
    expect(
      buildClientShopPath({
        appId: 'erp-multi-ecole',
        pricing: 'subscription',
        billing: 'year',
        trial: true,
      })
    ).toBe(
      '/dashboard/boutique?app=erp-multi-ecole&pricing=subscription&billing=year&trial=1'
    );
  });

  it('buildSignupWithReturn / buildLoginWithReturn conservent returnTo', () => {
    const params = { appId: 'caisse-enregistreuse', pricing: 'license' as const };
    const shop = buildClientShopPath(params);
    expect(buildSignupWithReturn(params)).toBe(
      `/signup?returnTo=${encodeURIComponent(shop)}`
    );
    expect(buildLoginWithReturn(params)).toBe(
      `/login?returnTo=${encodeURIComponent(shop)}`
    );
  });

  it('resolveBoutiqueCta branche client vs invité', () => {
    const params = { appId: 'crm-boutique', pricing: 'subscription' as const, billing: 'month' as const };
    expect(resolveBoutiqueCta(true, params)).toContain('/dashboard/boutique?');
    expect(resolveBoutiqueCta(false, params)).toMatch(/^\/signup\?returnTo=/);
  });

  it('safeReturnToPath refuse les URLs externes', () => {
    expect(safeReturnToPath('/dashboard/boutique?app=x')).toBe('/dashboard/boutique?app=x');
    expect(safeReturnToPath('https://evil.com')).toBeNull();
    expect(safeReturnToPath('//evil.com')).toBeNull();
    expect(safeReturnToPath(null)).toBeNull();
  });
});

describe('boutiqueProducts prix catalogue', () => {
  it('dérive mensuel, annuel (−20 %) et licence', () => {
    const app = INFINITE_APP_CATALOG.find((a) => a.id === 'erp-multi-ecole');
    expect(app).toBeTruthy();
    const prices = resolveCatalogPrices(app!);
    expect(prices.monthlyPrice).toBeGreaterThan(0);
    expect(prices.licPrice).toBeGreaterThan(0);
    expect(prices.annualTotalPrice).toBe(Math.round(prices.monthlyPrice! * 0.8 * 12));
    expect(prices.annualMonthlyPrice).toBe(Math.round(prices.annualTotalPrice! / 12));
  });

  it('buildBoutiqueProducts ne garde que les apps onlineCheckout', () => {
    const products = buildBoutiqueProducts(INFINITE_APP_CATALOG);
    expect(products.length).toBeGreaterThanOrEqual(9);
    expect(products.every((p) => p.id && p.n)).toBe(true);
    expect(products.some((p) => p.id === 'erp-multi-ecole')).toBe(true);
  });
});
