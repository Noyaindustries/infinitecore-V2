import type { AppCatalogFeature } from '@/data/appCatalog';

/** Parse une saisie rapide « Titre | Description » (une ligne par fonctionnalité). */
export function parseBulkAppFeatures(text: string): AppCatalogFeature[] {
  const out: AppCatalogFeature[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pipe = trimmed.indexOf('|');
    if (pipe >= 0) {
      const title = trimmed.slice(0, pipe).trim();
      const description = trimmed.slice(pipe + 1).trim();
      if (title) out.push({ title, description });
    } else {
      out.push({ title: trimmed, description: '' });
    }
  }
  return out;
}

export function bulkAppFeaturesToText(features: AppCatalogFeature[]): string {
  return features.map((f) => `${f.title}${f.description ? ` | ${f.description}` : ''}`).join('\n');
}
