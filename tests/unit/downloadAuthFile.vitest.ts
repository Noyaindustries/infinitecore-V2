import { describe, expect, it } from 'vitest';
import { isInternalDownloadUrl } from '../../src/lib/downloadAuthFile';

describe('downloadAuthFile', () => {
  it('détecte les URLs internes de téléchargement', () => {
    expect(isInternalDownloadUrl('/api/files/download?publicId=app-packages%2Fx.zip')).toBe(true);
    expect(isInternalDownloadUrl('https://cdn.example.com/app.zip')).toBe(false);
  });
});
