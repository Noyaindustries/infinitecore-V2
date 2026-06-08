import { describe, expect, it } from 'vitest';
import {
  appendTenantToSaasUrl,
  defaultSaasTenantId,
  initialSaasStateForSubscription,
  isSaasSubscriptionReady,
  resolveSaasProvisioningStatus,
  resolveSaasTenantId,
  resolveSaasUrl,
} from '../../src/lib/saasAccess';
import type { AppCatalogEntry } from '../../src/data/appCatalog';
import type { AppLicense } from '../../src/lib/licenses';

const baseLicense = (overrides: Partial<AppLicense>): AppLicense => ({
  id: 'u1__crm-pro',
  userId: 'u1',
  appId: 'crm-pro',
  moduleKey: 'crm-pro',
  appName: 'CRM Pro',
  type: 'subscription',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const catalogWithSaas = {
  id: 'crm-pro',
  moduleKey: 'crm-pro',
  saasBaseUrl: 'https://crm.infinite-core.vercel.app',
} as AppCatalogEntry;

describe('saasAccess multi-tenant', () => {
  it('defaultSaasTenantId combine userId et appId', () => {
    expect(defaultSaasTenantId('u1', 'crm-pro')).toBe('u1__crm-pro');
  });

  it('resolveSaasUrl priorise l’URL dédiée', () => {
    const license = baseLicense({ saasInstanceUrl: 'https://client.vercel.app' });
    expect(resolveSaasUrl(license, catalogWithSaas)).toBe('https://client.vercel.app');
  });

  it('resolveSaasUrl ajoute le tenant sur URL partagée', () => {
    const license = baseLicense({ saasProvisioningStatus: 'ready' });
    const url = resolveSaasUrl(license, catalogWithSaas);
    expect(url).toContain('tenant=u1__crm-pro');
    expect(url).toContain('https://crm.infinite-core.vercel.app');
  });

  it('appendTenantToSaasUrl supporte le chemin /t/', () => {
    const app = { ...catalogWithSaas, saasTenantRoute: 'path' as const };
    const url = appendTenantToSaasUrl('https://app.test', 't-42', app);
    expect(url).toBe('https://app.test/t/t-42');
  });

  it('initialSaasStateForSubscription crée un tenant sans copier la base URL', () => {
    expect(initialSaasStateForSubscription(catalogWithSaas, 'u1', 'crm-pro')).toEqual({
      saasInstanceUrl: null,
      saasTenantId: 'u1__crm-pro',
      saasProvisioningStatus: 'ready',
    });
  });

  it('initialSaasStateForSubscription pending sans URL catalogue', () => {
    expect(initialSaasStateForSubscription(undefined, 'u1', 'crm-pro')).toEqual({
      saasInstanceUrl: null,
      saasTenantId: 'u1__crm-pro',
      saasProvisioningStatus: 'pending',
    });
  });

  it('isSaasSubscriptionReady avec base multi-tenant', () => {
    const ready = baseLicense({ saasProvisioningStatus: 'ready' });
    expect(isSaasSubscriptionReady(ready, catalogWithSaas)).toBe(true);
  });

  it('resolveSaasTenantId utilise saasTenantId explicite', () => {
    expect(resolveSaasTenantId(baseLicense({ saasTenantId: 'custom-tenant' }))).toBe('custom-tenant');
  });

  it('resolveSaasProvisioningStatus suspended si expiré', () => {
    const license = baseLicense({ status: 'expired', saasProvisioningStatus: 'ready' });
    expect(resolveSaasProvisioningStatus(license, catalogWithSaas)).toBe('suspended');
  });
});
