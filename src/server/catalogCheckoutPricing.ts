import type { AppCatalogEntry, AppSubscriptionPricing, BillingInterval } from "@/data/appCatalog";
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
  const exact = app.pricing.find(
    (p): p is AppSubscriptionPricing => p.type === "subscription" && p.billingCycle === billingCycle
  );
  if (exact) return exact;
  /** Fallback : annuel dérivé du mensuel (−20 % sur 12 mois) si non configuré en base. */
  if (billingCycle === "year") {
    const monthly = app.pricing.find(
      (p): p is AppSubscriptionPricing => p.type === "subscription" && p.billingCycle === "month"
    );
    if (monthly && monthly.price > 0) {
      return {
        type: "subscription",
        price: Math.round(monthly.price * 0.8 * 12),
        billingCycle: "year",
        label: monthly.label,
      };
    }
  }
  return undefined;
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

/** Prix licence issu du catalogue — checkout public désactivé (licence = sur devis). */
export function resolveCatalogLicenseCheckout(
  _catalog: AppCatalogEntry[],
  _appId: string,
  _requestedDurationDays?: number
): LicenseCheckoutResolved | CatalogCheckoutError {
  return {
    ok: false,
    error: "La licence à vie est sur devis. Contactez l'équipe pour un tarif personnalisé.",
  };
}
