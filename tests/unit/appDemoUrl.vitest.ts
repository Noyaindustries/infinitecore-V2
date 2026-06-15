import { describe, expect, it } from 'vitest';
import { demoUrlLabel, normalizeExternalUrl, resolveAppDemoUrl } from '../../src/lib/appDemoUrl';

describe('appDemoUrl', () => {
  it('normalise les URLs sans schéma', () => {
    expect(normalizeExternalUrl('demo.example.com/app')).toBe('https://demo.example.com/app');
    expect(normalizeExternalUrl('https://demo.example.com')).toBe('https://demo.example.com');
    expect(normalizeExternalUrl('  ')).toBeNull();
  });

  it('préfère demoUrl puis saasBaseUrl', () => {
    expect(
      resolveAppDemoUrl({
        demoUrl: 'https://custom.demo.test',
        saasBaseUrl: 'https://erp.saas.test',
      })
    ).toBe('https://custom.demo.test');
    expect(
      resolveAppDemoUrl({
        demoUrl: '',
        saasBaseUrl: 'https://erp.saas.test',
      })
    ).toBe('https://erp.saas.test');
  });

  it('formate le libellé affiché', () => {
    expect(demoUrlLabel('https://erp-multi-ecole.saas.infinitecore.net/')).toBe(
      'erp-multi-ecole.saas.infinitecore.net'
    );
  });
});
