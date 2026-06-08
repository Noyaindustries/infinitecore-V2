import { describe, expect, it } from 'vitest';
import type { AppCatalogEntry } from '../../src/data/appCatalog';
import { buildAppGallery } from '../../src/lib/appGallery';

const baseApp = (overrides: Partial<AppCatalogEntry> = {}): AppCatalogEntry => ({
  id: 'erp-multi-ecole',
  moduleKey: 'erp-multi-ecole',
  title: 'ERP Multi-École',
  desc: 'Test',
  deliveryLabel: '5 jours',
  imageUrl: '/apps/erp-multi-ecole.svg',
  onlineCheckout: true,
  pricing: [{ type: 'license', price: 100_000, durationDays: 0 }],
  ...overrides,
});

describe('buildAppGallery', () => {
  it('retourne l’image principale seule', () => {
    expect(buildAppGallery(baseApp())).toEqual(['/apps/erp-multi-ecole.svg']);
  });

  it('déduplique image principale et galerie', () => {
    const gallery = buildAppGallery(
      baseApp({
        galleryImages: ['/apps/erp-multi-ecole.svg', '/uploads/extra.jpg'],
      })
    );
    expect(gallery).toEqual(['/apps/erp-multi-ecole.svg', '/uploads/extra.jpg']);
  });

  it('ignore les URLs vides', () => {
    const gallery = buildAppGallery(
      baseApp({
        imageUrl: '',
        galleryImages: ['  ', '/uploads/only.jpg'],
      })
    );
    expect(gallery).toEqual(['/apps/erp-multi-ecole.svg', '/uploads/only.jpg']);
  });
});
