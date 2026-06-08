import type { AppCatalogEntry } from '../data/appCatalog';
import type { AppLicense, SaasProvisioningStatus } from './licenses';

export type SaasTenantRoute = 'query' | 'path';

/** Tenant stable par client — utilisé pour isoler les données dans l'app multi-tenant. */
export function defaultSaasTenantId(userId: string, appId: string): string {
  return `${userId}__${appId}`;
}

export function resolveSaasTenantId(license: AppLicense): string {
  return license.saasTenantId?.trim() || defaultSaasTenantId(license.userId, license.appId);
}

export function appendTenantToSaasUrl(
  baseUrl: string,
  tenantId: string,
  app?: AppCatalogEntry
): string {
  const route = app?.saasTenantRoute ?? 'query';
  const queryKey = app?.saasTenantQueryKey?.trim() || 'tenant';
  try {
    const u = new URL(baseUrl);
    if (route === 'path') {
      const basePath = u.pathname.replace(/\/$/, '');
      u.pathname = `${basePath}/t/${encodeURIComponent(tenantId)}`;
    } else {
      u.searchParams.set(queryKey, tenantId);
    }
    return u.toString();
  } catch {
    if (route === 'path') {
      return `${baseUrl.replace(/\/$/, '')}/t/${encodeURIComponent(tenantId)}`;
    }
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}${queryKey}=${encodeURIComponent(tenantId)}`;
  }
}

/**
 * URL d'accès SaaS :
 * - instance dédiée (`saasInstanceUrl`) → URL complète telle quelle ;
 * - app multi-tenant (`saasBaseUrl`) → URL partagée + paramètre / chemin tenant.
 */
export function resolveSaasUrl(license: AppLicense, app?: AppCatalogEntry): string | null {
  const dedicated = license.saasInstanceUrl?.trim();
  if (dedicated) return dedicated;

  if (license.type !== 'subscription') return null;
  const base = app?.saasBaseUrl?.trim();
  if (!base) return null;

  return appendTenantToSaasUrl(base, resolveSaasTenantId(license), app);
}

export function resolveSaasProvisioningStatus(
  license: AppLicense,
  app?: AppCatalogEntry
): SaasProvisioningStatus {
  if (license.type !== 'subscription') return 'pending';
  if (license.status === 'suspended' || license.status === 'expired') return 'suspended';
  const explicit = license.saasProvisioningStatus;
  if (explicit === 'ready' || explicit === 'suspended' || explicit === 'pending') {
    if (explicit === 'ready' && !resolveSaasUrl(license, app)) return 'pending';
    return explicit;
  }
  return resolveSaasUrl(license, app) ? 'ready' : 'pending';
}

export function isSaasSubscriptionReady(license: AppLicense, app?: AppCatalogEntry): boolean {
  return (
    license.type === 'subscription' &&
    license.status === 'active' &&
    resolveSaasProvisioningStatus(license, app) === 'ready' &&
    Boolean(resolveSaasUrl(license, app))
  );
}

export function initialSaasStateForSubscription(
  catalogApp: AppCatalogEntry | undefined,
  userId: string,
  appId: string
): {
  saasInstanceUrl: string | null;
  saasTenantId: string;
  saasProvisioningStatus: SaasProvisioningStatus;
} {
  const saasTenantId = defaultSaasTenantId(userId, appId);
  const hasSharedBase = Boolean(catalogApp?.saasBaseUrl?.trim());
  return {
    saasInstanceUrl: null,
    saasTenantId,
    saasProvisioningStatus: hasSharedBase ? 'ready' : 'pending',
  };
}
