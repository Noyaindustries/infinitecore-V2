import { describe, expect, it } from 'vitest';
import { bulkAppFeaturesToText, parseBulkAppFeatures } from '../../src/lib/appCatalogFeatures';

describe('parseBulkAppFeatures', () => {
  it('parse le format Titre | Description', () => {
    const text = 'Multi-établissements | Un seul tableau de bord\nNotes & bulletins';
    expect(parseBulkAppFeatures(text)).toEqual([
      { title: 'Multi-établissements', description: 'Un seul tableau de bord' },
      { title: 'Notes & bulletins', description: '' },
    ]);
  });

  it('ignore les lignes vides', () => {
    expect(parseBulkAppFeatures('\n\n  \n')).toEqual([]);
  });
});

describe('bulkAppFeaturesToText', () => {
  it('reconstruit le texte bulk', () => {
    const text = bulkAppFeaturesToText([
      { title: 'A', description: 'Desc A' },
      { title: 'B', description: '' },
    ]);
    expect(text).toBe('A | Desc A\nB');
  });
});
