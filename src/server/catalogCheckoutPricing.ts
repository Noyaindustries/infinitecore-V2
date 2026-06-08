import type { AppCatalogEntry, AppLicensePricing, AppSubscriptionPricing, BillingInterval } from "@/data/appCatalog";
import { isExternalSaasBilling } from "@/lib/saasBilling";

export type CatalogCheckoutError = { ok: false; error: string };

export type SubscriptionCheckoutResolved = {
  ok: true;
  unitAmount: number;
  serviceName: string;
  moduleKey: string;
  billingCycle: BillingInterval;
  app: AppCatalogEntry;
};

export type LicenseCheckoutResolved = {
  ok: true;
  unitAmount: number;
  appName: string;
  moduleKey: string;
  licenseDurationDays: number;
  app: AppCatalogEntry;
};

function findSubscriptionPricing(
  app: AppCatalogEntry,
  billingCycle: BillingInterval
): AppSubscriptionPricing | undefined {
  return app.pricing.find(
    (p): p is AppSubscriptionPricing => p.type === "subscription" && p.billingCycle === billingCycle
  );
}

function findLicensePricing(
  app: AppCatalogEntry,
  durationDays: number
): AppLicensePricing | undefined {
  return app.pricing.find(
    (p): p is AppLicensePricing => p.type === "license" && p.durationDays === durationDays
  );
}

/** Prix abonnement issu du catalogue (ignore le montant client). */
export function resolveCatalogSubscriptionCheckout(
  catalog: AppCatalogEntry[],
  serviceId: string,
  billingCycle: BillingInterval
): SubscriptionCheckoutResolved | CatalogCheckoutError {
  const app = catalog.find((a) => a.id === serviceId);
  if (!app) return { ok: false, error: "Application introuvable." };
  if (!app.onlineCheckout) {
    return { ok: false, error: "Le checkout en ligne est désactivé pour cette application." };
  }
  if (isExternalSaasBilling(app)) {
    return { ok: false, error: "Cet abonnement est facturé sur le site de l'application." };
  }
  const pricing = findSubscriptionPricing(app, billingCycle);
  if (!pricing || pricing.price <= 0) {
    return { ok: false, error: "Tarif abonnement introuvable pour ce cycle de facturation." };
  }
  return {
    ok: true,
    unitAmount: Math.round(pricing.price),
    serviceName: app.title,
    moduleKey: app.moduleKey,
    billingCycle,
    app,
  };
}

/** Prix licence issu du catalogue (ignore le montant client). */
export function resolveCatalogLicenseCheckout(
  catalog: AppCatalogEntry[],
  appId: string,
  requestedDurationDays?: number
): LicenseCheckoutResolved | CatalogCheckoutError {
  const app = catalog.find((a) => a.id === appId);
  if (!app) return { ok: false, error: "Application introuvable." };
  if (!app.onlineCheckout) {
    return { ok: false, error: "Le checkout en ligne est désactivé pour cette application." };
  }
  const licenseEntries = app.pricing.filter((p): p is AppLicensePricing => p.type === "license");
  if (!licenseEntries.length) {
    return { ok: false, error: "Aucun tarif licence configuré pour cette application." };
  }
  const durationDays =
    requestedDurationDays !== undefined && requestedDurationDays >= 0
      ? requestedDurationDays
      : licenseEntries[0].durationDays;
  const pricing = findLicensePricing(app, durationDays) ?? licenseEntries[0];
  if (!pricing || pricing.price <= 0) {
    return { ok: false, error: "Tarif licence introuvable." };
  }
  return {
    ok: true,
    unitAmount: Math.round(pricing.price),
    appName: app.title,
    moduleKey: app.moduleKey,
    licenseDurationDays: pricing.durationDays,
    app,
  };
}
