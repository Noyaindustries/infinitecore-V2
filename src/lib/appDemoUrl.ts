import type { AppCatalogEntry } from '@/data/appCatalog';

/** Normalise une URL saisie admin (ajoute https:// si absent). */
export function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/**
 * URL de démo affichée sur la page détail :
 * 1. `demoUrl` explicite (admin)
 * 2. sinon `saasBaseUrl` (portail multi-tenant par défaut)
 */
export function resolveAppDemoUrl(
  app: Pick<AppCatalogEntry, 'demoUrl' | 'saasBaseUrl'>
): string | null {
  return normalizeExternalUrl(app.demoUrl || '') ?? normalizeExternalUrl(app.saasBaseUrl || '');
}

export function demoUrlLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}
