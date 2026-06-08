import type { AppCatalogEntry } from '../data/appCatalog';

export type SaasBillingMode = 'infinitecore' | 'external';

/** Abonnement facturé par Infinite Core (Stripe + jeton SaaS). */
export function isInfiniteCoreSaasBilling(app?: AppCatalogEntry): boolean {
  return app?.saasBillingMode !== 'external';
}

/** Abonnement facturé sur le site de l'application (redirection checkout externe). */
export function isExternalSaasBilling(app?: AppCatalogEntry): boolean {
  return app?.saasBillingMode === 'external';
}

export function resolveSaasBillingMode(app?: AppCatalogEntry): SaasBillingMode {
  return isExternalSaasBilling(app) ? 'external' : 'infinitecore';
}

export type ExternalCheckoutContext = {
  userId?: string;
  email?: string;
  appId?: string;
  moduleKey?: string;
  tenantId?: string;
};

/** Remplace {userId}, {email}, {appId}, {moduleKey} dans l'URL de paiement externe. */
export function buildExternalCheckoutUrl(template: string, ctx: ExternalCheckoutContext): string {
  let url = template.trim();
  for (const [key, val] of Object.entries(ctx)) {
    if (!val) continue;
    url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(val));
  }
  return url;
}

export function appendSaasTokenToUrl(baseUrl: string, token: string): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set('ic_token', token);
    return u.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}ic_token=${encodeURIComponent(token)}`;
  }
}
