/**
 * Variables **uniquement** `NEXT_PUBLIC_*` — importable côté **client** (navigateur)
 * sans exposer les secrets serveur.
 *
 * Voir aussi `src/config/env.ts` (serveur / scripts / API Express).
 */
export function publicApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
}
