import { describe, expect, it } from 'vitest';
import {
  formatLicenseValidityLabel,
  INFINITE_APP_CATALOG,
  mergeCatalogWithDefaults,
  parseAppCatalogEntries,
  slugifyAppId,
} from '../../src/data/appCatalog';

describe('slugifyAppId', () => {
  it('normalise accents et espaces', () => {
    expect(slugifyAppId('ERP Multi-École')).toBe('erp-multi-ecole');
    expect(slugifyAppId('  Caisse   enregistreuse  ')).toBe('caisse-enregistreuse');
  });

  it('retourne application si le titre est vide', () => {
    expect(slugifyAppId('')).toBe('application');
    expect(slugifyAppId('---')).toBe('application');
  });
});

describe('mergeCatalogWithDefaults', () => {
  it('conserve les 9 apps par défaut', () => {
    const merged = mergeCatalogWithDefaults([]);
    expect(merged).toHaveLength(INFINITE_APP_CATALOG.length);
    expect(merged.map((a) => a.id)).toEqual(INFINITE_APP_CATALOG.map((a) => a.id));
  });

  it('écrase le prix sans écraser les features explicites vides', () => {
    const merged = mergeCatalogWithDefaults([
      {
        id: 'erp-multi-ecole',
        moduleKey: 'erp-multi-ecole',
        title: 'ERP Multi-École',
        desc: 'Desc custom',
        deliveryLabel: 'Sur devis',
        pricing: [{ type: 'license', price: 999_000, durationDays: 0 }],
        onlineCheckout: true,
        features: [],
      },
    ]);
    const app = merged.find((a) => a.id === 'erp-multi-ecole');
    expect(app?.desc).toBe('Desc custom');
    expect(app?.pricing[0]?.price).toBe(999_000);
    expect(app?.features).toEqual([]);
  });

  it('ajoute les apps personnalisées après les apps par défaut', () => {
    const merged = mergeCatalogWithDefaults([
      {
        id: 'app-sur-mesure',
        moduleKey: 'app-sur-mesure',
        title: 'App sur mesure',
        desc: 'Test',
        deliveryLabel: 'Sur devis',
        pricing: [{ type: 'subscription', price: 50_000, billingCycle: 'month' }],
        onlineCheckout: false,
      },
    ]);
    expect(merged.some((a) => a.id === 'app-sur-mesure')).toBe(true);
    expect(merged.at(-1)?.id).toBe('app-sur-mesure');
  });
});

describe('parseAppCatalogEntries', () => {
  it('rejette les entrées invalides', () => {
    expect(parseAppCatalogEntries(null)).toEqual([]);
    expect(parseAppCatalogEntries([{ id: '', title: 'Sans id' }])).toHaveLength(INFINITE_APP_CATALOG.length);
  });

  it('parse features et tarifs', () => {
    const parsed = parseAppCatalogEntries([
      {
        id: 'test-app',
        moduleKey: 'test-app',
        title: 'Test App',
        desc: 'Description',
        deliveryLabel: '5 jours',
        pricing: [
          { type: 'license', price: 100_000, durationDays: 0 },
          { type: 'subscription', price: 10_000, billingCycle: 'month' },
        ],
        features: [{ title: 'Fonction A', description: 'Détail A' }],
      },
    ]);
    const custom = parsed.find((a) => a.id === 'test-app');
    expect(custom?.features).toEqual([{ title: 'Fonction A', description: 'Détail A' }]);
    expect(custom?.pricing).toHaveLength(2);
  });

  it('ignore les prix non positifs', () => {
    const parsed = parseAppCatalogEntries([
      {
        id: 'bad-pricing',
        moduleKey: 'bad-pricing',
        title: 'Bad Pricing',
        desc: '',
        deliveryLabel: 'Sur devis',
        pricing: [{ type: 'license', price: -1, durationDays: 0 }],
        onlineCheckout: false,
      },
    ]);
    const custom = parsed.find((a) => a.id === 'bad-pricing');
    expect(custom?.pricing).toEqual([]);
  });
});

describe('licence à vie', () => {
  it('catalogue par défaut : durationDays 0 et label à vie', () => {
    for (const entry of INFINITE_APP_CATALOG) {
      const license = entry.pricing.find((p) => p.type === 'license');
      expect(license).toBeDefined();
      if (license?.type === 'license') {
        expect(license.durationDays).toBe(0);
        expect(license.label).toBe('Licence à vie (auto-hébergée)');
        expect(formatLicenseValidityLabel(license)).toBe('À vie — hébergement client');
      }
    }
  });

  it('parse durationDays 0 sans expiration', () => {
    const parsed = parseAppCatalogEntries([
      {
        id: 'lifetime-app',
        moduleKey: 'lifetime-app',
        title: 'Lifetime App',
        desc: '',
        deliveryLabel: '5 jours',
        pricing: [{ type: 'license', price: 50_000, durationDays: 0 }],
      },
    ]);
    const license = parsed.find((a) => a.id === 'lifetime-app')?.pricing[0];
    expect(license?.type).toBe('license');
    if (license?.type === 'license') {
      expect(license.durationDays).toBe(0);
      expect(formatLicenseValidityLabel(license)).toBe('À vie — hébergement client');
    }
  });
});
