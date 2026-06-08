import { describe, expect, it } from 'vitest';
import {
  buildLicenseWelcomeMessage,
  buildSubscriptionWelcomeMessage,
  buildWelcomeMessage,
  isLifetimeLicense,
} from '../../src/lib/appDeliveryGuide';
import type { AppCatalogEntry } from '../../src/data/appCatalog';
import type { AppLicense } from '../../src/lib/licenses';

const baseLicense = (overrides: Partial<AppLicense>): AppLicense => ({
  id: 'u1__erp',
  userId: 'u1',
  appId: 'erp-multi-ecole',
  moduleKey: 'erp-multi-ecole',
  appName: 'ERP Multi-École',
  type: 'license',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('appDeliveryGuide', () => {
  it('message licence mentionne auto-hébergement et liens', () => {
    const text = buildLicenseWelcomeMessage({
      appName: 'ERP Test',
      moduleKey: 'erp-test',
      deliveryLabel: '5-7 jours',
      licensePackageUrl: 'https://example.com/app.zip',
      installGuideUrl: 'https://example.com/guide.pdf',
    });
    expect(text).toContain('licence à vie');
    expect(text).toContain('Auto-hébergement');
    expect(text).toContain('https://example.com/app.zip');
    expect(text).toContain('5-7 jours');
  });

  it('message abonnement avec URL SaaS immédiate', () => {
    const text = buildSubscriptionWelcomeMessage({
      appName: 'CRM Test',
      moduleKey: 'crm-test',
      deliveryLabel: 'immédiat',
      saasBaseUrl: 'https://crm.vercel.app',
    });
    expect(text).toContain('https://crm.vercel.app');
    expect(text).toContain('Applications SaaS');
    expect(text).toContain('/module/crm-test/dashboard');
  });

  it('message abonnement sans URL mentionne déploiement en cours', () => {
    const text = buildSubscriptionWelcomeMessage({
      appName: 'CRM Test',
      moduleKey: 'crm-test',
      deliveryLabel: 'immédiat',
    });
    expect(text).toContain('finalise le déploiement');
    expect(text).toContain('/module/crm-test/dashboard');
  });

  it('buildWelcomeMessage route selon le type', () => {
    const ctx = { appName: 'App', moduleKey: 'app', deliveryLabel: '3 jours' };
    expect(buildWelcomeMessage('license', ctx)).toContain('licence');
    expect(buildWelcomeMessage('subscription', ctx)).toContain('abonnement');
  });

  it('isLifetimeLicense détecte licence sans expiration', () => {
    const app = {
      pricing: [{ type: 'license', price: 100_000, durationDays: 0 }],
    } as AppCatalogEntry;
    expect(isLifetimeLicense(baseLicense({ expiresAt: null }), app)).toBe(true);
    expect(
      isLifetimeLicense(
        baseLicense({ type: 'subscription', expiresAt: new Date().toISOString() }),
        app
      )
    ).toBe(false);
  });
});
