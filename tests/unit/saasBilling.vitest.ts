import { describe, expect, it } from 'vitest';
import {
  appendSaasTokenToUrl,
  buildExternalCheckoutUrl,
  isExternalSaasBilling,
  isInfiniteCoreSaasBilling,
} from '../../src/lib/saasBilling';
import type { AppCatalogEntry } from '../../src/data/appCatalog';

describe('saasBilling', () => {
  it('détecte le mode externe', () => {
    const external = { saasBillingMode: 'external' } as AppCatalogEntry;
    expect(isExternalSaasBilling(external)).toBe(true);
    expect(isInfiniteCoreSaasBilling(external)).toBe(false);
  });

  it('mode par défaut = infinitecore', () => {
    expect(isExternalSaasBilling({} as AppCatalogEntry)).toBe(false);
    expect(isInfiniteCoreSaasBilling({} as AppCatalogEntry)).toBe(true);
  });

  it('buildExternalCheckoutUrl remplace les placeholders', () => {
    const url = buildExternalCheckoutUrl('https://app.test/sub?u={userId}&e={email}', {
      userId: 'u42',
      email: 'a@b.c',
    });
    expect(url).toContain('u=u42');
    expect(url).toContain('e=a%40b.c');
  });

  it('appendSaasTokenToUrl ajoute ic_token', () => {
    const out = appendSaasTokenToUrl('https://saas.test/app', 'tok123');
    expect(out).toContain('ic_token=tok123');
  });
});
