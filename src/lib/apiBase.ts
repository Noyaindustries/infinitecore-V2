import { publicApiBaseUrl } from "@/config/publicEnv";

/**
 * Base API côté client (sans slash final). Vide = URLs relatives `/api/...`
 * (Vercel avec relais, ou `npm run dev` / `npm start` unifié).
 * Variable : **`NEXT_PUBLIC_API_BASE_URL`** — voir `src/config/publicEnv.ts`.
 */
function apiOrigin(): string {
  return publicApiBaseUrl();
}

/**
 * `"/api/foo"` → absolu si `NEXT_PUBLIC_API_BASE_URL` est défini, sinon relatif.
 */
export function apiUrl(path: string): string {
  const o = apiOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return o ? `${o}${p}` : p;
}

/** Chemins `/…` en URL absolue (iframe, nouvel onglet). Uniquement côté client. */
export function absoluteUrlOnClient(path: string): string {
  const p = path.trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (typeof window === "undefined") return p;
  if (p.startsWith("//")) return `${window.location.protocol}${p}`;
  if (!p.startsWith("/")) return p;
  const o = apiOrigin();
  return o ? `${o}${p}` : `${window.location.origin}${p}`;
}
