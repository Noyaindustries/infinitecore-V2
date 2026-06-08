import { describe, expect, it } from "vitest";
import { LicenseCheckoutSchema, OrderSchema } from "../../src/lib/schemas";

describe("LicenseCheckoutSchema", () => {
  it("accepte note null et amount string (compat client)", () => {
    const result = LicenseCheckoutSchema.safeParse({
      appId: "erp-multi-ecole",
      amount: "350000",
      licenseDurationDays: 0,
      note: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejette appId vide", () => {
    expect(LicenseCheckoutSchema.safeParse({ appId: "" }).success).toBe(false);
  });
});

describe("OrderSchema", () => {
  it("accepte note null pour abonnement", () => {
    const result = OrderSchema.safeParse({
      serviceId: "erp-multi-ecole",
      billingCycle: "month",
      note: null,
    });
    expect(result.success).toBe(true);
  });
});
