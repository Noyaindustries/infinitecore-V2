import { describe, expect, it } from 'vitest';
import { parseAppCatalogEntries } from '../../src/data/appCatalog';

describe('sécurité — validation catalogue', () => {
  it('rejette un tableau non-tableau', () => {
    const result = parseAppCatalogEntries({ apps: '<script>alert(1)</script>' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('n’accepte pas un id ou titre vide (injection de ligne fantôme)', () => {
    const result = parseAppCatalogEntries([
      { id: '  ', title: 'Titre seul' },
      { id: 'valid-id', title: '  ' },
    ]);
    expect(result.some((a) => a.id === 'valid-id')).toBe(false);
    expect(result.some((a) => a.id === 'Titre seul')).toBe(false);
  });

  it('tronque les champs texte sans planter sur payload volumineux', () => {
    const huge = 'A'.repeat(50_000);
    const result = parseAppCatalogEntries([
      {
        id: 'payload-test',
        moduleKey: 'payload-test',
        title: 'Payload',
        desc: huge,
        deliveryLabel: 'Sur devis',
        pricing: [{ type: 'license', price: 100_000, durationDays: 0 }],
        onlineCheckout: false,
        features: [{ title: huge, description: huge }],
      },
    ]);
    const app = result.find((a) => a.id === 'payload-test');
    expect(app?.desc).toHaveLength(50_000);
    expect(app?.features?.[0]?.title).toHaveLength(50_000);
  });

  it('ignore les URLs de galerie vides ou non-string', () => {
    const result = parseAppCatalogEntries([
      {
        id: 'gallery-test',
        moduleKey: 'gallery-test',
        title: 'Galerie',
        desc: '',
        deliveryLabel: 'Sur devis',
        pricing: [],
        onlineCheckout: false,
        galleryImages: ['', 'javascript:alert(1)', null, '/safe.jpg'],
      },
    ]);
    const app = result.find((a) => a.id === 'gallery-test');
    expect(app?.galleryImages).toEqual(['javascript:alert(1)', '/safe.jpg']);
  });
});
