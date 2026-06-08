export type LicenseType = 'license' | 'subscription';
export type LicenseStatus = 'pending' | 'active' | 'suspended' | 'expired';
export type SaasProvisioningStatus = 'pending' | 'ready' | 'suspended';

export interface AppLicense {
  id: string;
  userId: string;
  appId: string;
  moduleKey: string;
  appName: string;
  type: LicenseType;
  status: LicenseStatus;
  orderId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  expiresAt?: string | null;
  /** URL SaaS dédiée (instance mono-client) — prioritaire sur le catalogue partagé. */
  saasInstanceUrl?: string | null;
  /** Identifiant tenant dans l'app multi-tenant (un par client / abonnement). */
  saasTenantId?: string | null;
  /** État de déploiement SaaS (abonnements). */
  saasProvisioningStatus?: SaasProvisioningStatus | null;
  activatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function licenseDocId(userId: string, appId: string): string {
  return `${userId}__${appId}`;
}

export function isLicenseActive(license: AppLicense, now = Date.now()): boolean {
  if (license.status !== 'active') return false;
  if (!license.expiresAt) return true;
  const exp = Date.parse(license.expiresAt);
  return Number.isFinite(exp) && exp > now;
}

export function hasModuleAccess(
  licenses: AppLicense[],
  moduleKey: string,
  options?: { bypass?: boolean }
): boolean {
  if (options?.bypass) return true;
  return licenses.some((l) => l.moduleKey === moduleKey && isLicenseActive(l));
}
