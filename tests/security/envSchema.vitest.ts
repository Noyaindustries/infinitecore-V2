import { describe, expect, it } from "vitest";
import { validateProcessEnv } from "../../src/config/envSchema";

describe("validateProcessEnv", () => {
  it("accepte une config dev minimale", () => {
    const report = validateProcessEnv(
      {
        NODE_ENV: "development",
        CORS_ORIGIN: "http://localhost:3000",
      },
      { isProduction: false }
    );
    expect(report.ok).toBe(true);
  });

  it("rejette un PORT invalide", () => {
    const report = validateProcessEnv({ PORT: "not-a-number" }, { isProduction: false });
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("PORT"))).toBe(true);
  });

  it("exige NEXTAUTH_SECRET en production", () => {
    const report = validateProcessEnv(
      {
        NODE_ENV: "production",
        DATABASE_URL: "mongodb://localhost:27017/test",
        CORS_ORIGIN: "https://www.example.com",
        PADDE_WEBHOOK_SECRET: "a".repeat(32),
        SAAS_BRIDGE_API_KEY: "c".repeat(32),
      },
      { isProduction: true }
    );
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("NEXTAUTH_SECRET"))).toBe(true);
  });

  it("avertit si SAAS_BRIDGE absent en production sans invalider la config", () => {
    const report = validateProcessEnv(
      {
        NODE_ENV: "production",
        DATABASE_URL: "mongodb+srv://user:password@cluster.mongodb.net/infinitecore?retryWrites=true",
        NEXTAUTH_SECRET: "a".repeat(32),
        CORS_ORIGIN: "https://www.example.com",
        PADDE_WEBHOOK_SECRET: "b".repeat(32),
      },
      { isProduction: true }
    );
    expect(report.ok).toBe(true);
    expect(report.warnings.some((w) => w.includes("SAAS_BRIDGE_API_KEY"))).toBe(true);
  });

  it("rejette CORS wildcard en production", () => {
    const report = validateProcessEnv(
      {
        NODE_ENV: "production",
        DATABASE_URL: "mongodb://localhost:27017/test",
        NEXTAUTH_SECRET: "a".repeat(32),
        PADDE_WEBHOOK_SECRET: "b".repeat(32),
        CORS_ORIGIN: "https://*.example.com",
      },
      { isProduction: true }
    );
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("wildcard"))).toBe(true);
  });
});
