import { describe, expect, it } from 'vitest';
import { hasModuleAccess, isLicenseActive, licenseDocId, type AppLicense } from '../../src/lib/licenses';

const baseLicense = (overrides: Partial<AppLicense>): AppLicense => ({
  id: 'u1__crm',
  userId: 'u1',
  appId: 'crm',
  moduleKey: 'crm',
  appName: 'Infinite CRM',
  type: 'subscription',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('licenses', () => {
  it('génère un identifiant de licence stable', () => {
    expect(licenseDocId('user-1', 'crm')).toBe('user-1__crm');
  });

  it('détecte une licence expirée', () => {
    expect(
      isLicenseActive(
        baseLicense({
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        })
      )
    ).toBe(false);
  });

  it('considère une licence sans expiration comme active (à vie)', () => {
    expect(
      isLicenseActive(
        baseLicense({
          type: 'license',
          expiresAt: null,
        })
      )
    ).toBe(true);
  });

  it('autorise le bypass admin', () => {
    expect(hasModuleAccess([], 'crm', { bypass: true })).toBe(true);
  });

  it('contrôle l’accès module', () => {
    const licenses = [baseLicense({ moduleKey: 'crm' })];
    expect(hasModuleAccess(licenses, 'crm')).toBe(true);
    expect(hasModuleAccess(licenses, 'finance')).toBe(false);
  });
});
