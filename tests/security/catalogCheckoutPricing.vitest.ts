import { describe, expect, it } from "vitest";
import {
  resolveCatalogLicenseCheckout,
  resolveCatalogSubscriptionCheckout,
} from "../../src/server/catalogCheckoutPricing";
import type { AppCatalogEntry } from "../../src/data/appCatalog";

const sampleApp: AppCatalogEntry = {
  id: "erp-multi-ecole",
  moduleKey: "erp-multi-ecole",
  title: "ERP Multi-École",
  desc: "Test",
  deliveryLabel: "Sur devis",
  onlineCheckout: true,
  pricing: [
    { type: "license", price: 2_500_000, durationDays: 0 },
    { type: "subscription", price: 50_000, billingCycle: "month" },
  ],
};

describe("resolveCatalogSubscriptionCheckout", () => {
  it("utilise le prix catalogue et ignore le montant client", () => {
    const result = resolveCatalogSubscriptionCheckout([sampleApp], "erp-multi-ecole", "month");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.unitAmount).toBe(50_000);
      expect(result.serviceName).toBe("ERP Multi-École");
      expect(result.moduleKey).toBe("erp-multi-ecole");
    }
  });

  it("rejette un montant catalogue absent pour le cycle", () => {
    const result = resolveCatalogSubscriptionCheckout([sampleApp], "erp-multi-ecole", "year");
    expect(result.ok).toBe(false);
  });

  it("rejette le checkout externe SaaS", () => {
    const external: AppCatalogEntry = {
      ...sampleApp,
      saasBillingMode: "external",
    };
    const result = resolveCatalogSubscriptionCheckout([external], "erp-multi-ecole", "month");
    expect(result.ok).toBe(false);
  });
});

describe("resolveCatalogLicenseCheckout", () => {
  it("retourne le prix licence du catalogue", () => {
    const result = resolveCatalogLicenseCheckout([sampleApp], "erp-multi-ecole");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.unitAmount).toBe(2_500_000);
      expect(result.licenseDurationDays).toBe(0);
    }
  });

  it("rejette une application inconnue", () => {
    expect(resolveCatalogLicenseCheckout([sampleApp], "unknown").ok).toBe(false);
  });
});
