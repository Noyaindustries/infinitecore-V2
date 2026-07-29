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

  it("dérive l’annuel (−20 %) depuis le mensuel si year absent du catalogue", () => {
    const result = resolveCatalogSubscriptionCheckout([sampleApp], "erp-multi-ecole", "year");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.unitAmount).toBe(Math.round(50_000 * 0.8 * 12));
    }
  });

  it("rejette si aucun abonnement mensuel ni annuel n’existe", () => {
    const licenseOnly: AppCatalogEntry = {
      ...sampleApp,
      pricing: [{ type: "license", price: 2_500_000, durationDays: 0 }],
    };
    const result = resolveCatalogSubscriptionCheckout([licenseOnly], "erp-multi-ecole", "year");
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

  it("rejette une durée absente du catalogue (pas de fallback)", () => {
    const multi: AppCatalogEntry = {
      ...sampleApp,
      pricing: [
        { type: "license", price: 100_000, durationDays: 30 },
        { type: "license", price: 2_500_000, durationDays: 0 },
      ],
    };
    const result = resolveCatalogLicenseCheckout([multi], "erp-multi-ecole", 90);
    expect(result.ok).toBe(false);
  });

  it("rejette une application inconnue", () => {
    expect(resolveCatalogLicenseCheckout([sampleApp], "unknown").ok).toBe(false);
  });
});
