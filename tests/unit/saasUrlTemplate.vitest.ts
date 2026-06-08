import { describe, expect, it } from 'vitest';
import {
  enrichAppSaasDefaults,
  enrichCatalogSaasDefaults,
  resolveSaasUrlTemplate,
} from '../../src/lib/saasUrlTemplate';
import type { AppCatalogEntry } from '../../src/data/appCatalog';

const baseApp = (): AppCatalogEntry => ({
  id: 'erp-test',
  moduleKey: 'erp-test',
  title: 'ERP Test',
  desc: 'Test',
  deliveryLabel: '5 jours',
  onlineCheckout: true,
  pricing: [
    { type: 'license', price: 100_000, durationDays: 0 },
    { type: 'subscription', price: 10_000, billingCycle: 'month' },
  ],
});

describe('saasUrlTemplate', () => {
  it('resolveSaasUrlTemplate remplace moduleKey et appId', () => {
    expect(resolveSaasUrlTemplate('https://{moduleKey}.saas.test/{appId}', baseApp())).toBe(
      'https://erp-test.saas.test/erp-test'
    );
  });

  it('enrichAppSaasDefaults ajoute URL si abonnement', () => {
    const enriched = enrichAppSaasDefaults(baseApp(), 'https://{moduleKey}.apps.test');
    expect(enriched.saasBaseUrl).toBe('https://erp-test.apps.test');
  });

  it('enrichAppSaasDefaults ne modifie pas si URL déjà définie', () => {
    const app = { ...baseApp(), saasBaseUrl: 'https://custom.test' };
    expect(enrichAppSaasDefaults(app).saasBaseUrl).toBe('https://custom.test');
  });

  it('enrichCatalogSaasDefaults traite toutes les apps', () => {
    const out = enrichCatalogSaasDefaults([baseApp()], 'https://{moduleKey}.x');
    expect(out[0]?.saasBaseUrl).toBe('https://erp-test.x');
  });
});
