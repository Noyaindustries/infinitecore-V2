/**
 * Variables **uniquement** `NEXT_PUBLIC_*` — importable côté **client** (navigateur)
 * sans exposer les secrets serveur.
 *
 * Voir aussi `src/config/env.ts` (serveur / scripts / API Express).
 */
export function publicApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
}

/** Client ID OAuth Google (console Google Cloud → identifiants → ID client Web). */
export function publicGoogleClientId(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();
}

/** URL publique du site (SEO, SEA, liens canoniques). */
export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.infinitecore.net").trim().replace(/\/$/, "");
}

/** Template URL SaaS par défaut ({moduleKey}, {appId}) — aligné sur SAAS_URL_TEMPLATE côté serveur. */
export function publicSaasUrlTemplate(): string {
  return (
    process.env.NEXT_PUBLIC_SAAS_URL_TEMPLATE?.trim() ||
    "https://{moduleKey}.saas.infinitecore.net"
  );
}
