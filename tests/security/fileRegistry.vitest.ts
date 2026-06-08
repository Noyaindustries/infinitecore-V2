import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import {
  findCatalogAppByPackagePublicId,
  isStaffFileRole,
} from "../../src/server/fileRegistry";
import type { AppCatalogEntry } from "../../src/data/appCatalog";
import { verifySaasBridgeAuth } from "../../src/server/saasAppBridge";

describe("fileRegistry helpers", () => {
  it("identifie les rôles staff", () => {
    expect(isStaffFileRole("admin")).toBe(true);
    expect(isStaffFileRole("commando")).toBe(true);
    expect(isStaffFileRole("client")).toBe(false);
  });

  it("retrouve une app par publicId package", () => {
    const catalog: AppCatalogEntry[] = [
      {
        id: "app-a",
        moduleKey: "app-a",
        title: "App A",
        desc: "",
        deliveryLabel: "",
        onlineCheckout: true,
        pricing: [],
        licensePackagePublicId: "app-packages/app-a/pkg.zip",
      },
    ];
    expect(findCatalogAppByPackagePublicId(catalog, "app-packages/app-a/pkg.zip")?.id).toBe("app-a");
  });
});

describe("verifySaasBridgeAuth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuse en production sans clé configurée", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.SAAS_BRIDGE_API_KEY;
    expect(verifySaasBridgeAuth("anything")).toBe(false);
  });

  it("accepte en dev sans clé (compatibilité locale)", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.SAAS_BRIDGE_API_KEY;
    expect(verifySaasBridgeAuth(undefined)).toBe(true);
  });
});
