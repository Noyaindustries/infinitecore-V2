import { getAppImageUrl, type AppCatalogEntry } from '@/data/appCatalog';

/** Galerie complète : image principale + images additionnelles (sans doublon). */
export function buildAppGallery(app: AppCatalogEntry): string[] {
  const main = getAppImageUrl(app);
  const extra = (app.galleryImages ?? []).map((u) => u.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [main, ...extra]) {
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}
