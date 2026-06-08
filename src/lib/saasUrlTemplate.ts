import type { AppCatalogEntry } from '../data/appCatalog';

const DEFAULT_TEMPLATE = 'https://{moduleKey}.saas.infinitecore.net';

export function saasUrlTemplateFromEnv(): string {
  if (typeof process === 'undefined') return DEFAULT_TEMPLATE;
  return (
    process.env.NEXT_PUBLIC_SAAS_URL_TEMPLATE?.trim() ||
    process.env.SAAS_URL_TEMPLATE?.trim() ||
    DEFAULT_TEMPLATE
  );
}

export function resolveSaasUrlTemplate(
  template: string,
  app: Pick<AppCatalogEntry, 'id' | 'moduleKey'>
): string {
  return template.replace(/\{moduleKey\}/g, app.moduleKey).replace(/\{appId\}/g, app.id);
}

/** Applique l'URL SaaS par défaut (multi-tenant) si l'app a un abonnement et pas d'URL explicite. */
export function enrichAppSaasDefaults(
  entry: AppCatalogEntry,
  template = saasUrlTemplateFromEnv()
): AppCatalogEntry {
  if (entry.saasBaseUrl?.trim()) return entry;
  const hasSubscription = entry.pricing.some((p) => p.type === 'subscription');
  if (!hasSubscription || !template.trim()) return entry;
  return {
    ...entry,
    saasBaseUrl: resolveSaasUrlTemplate(template, entry),
  };
}

export function enrichCatalogSaasDefaults(
  apps: AppCatalogEntry[],
  template = saasUrlTemplateFromEnv()
): AppCatalogEntry[] {
  return apps.map((a) => enrichAppSaasDefaults(a, template));
}
