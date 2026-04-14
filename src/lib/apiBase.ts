/**
 * Origine du backend Express (sans slash final).
 * Vide = requêtes relatives (proxy `/api` via Next en dev, ou même origine en prod).
 * Sinon : `NEXT_PUBLIC_API_BASE_URL` si le front appelle l’API sans rewrite.
 */
export function getApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
