import assert from "node:assert/strict";
import { hasModuleAccess, isLicenseActive, licenseDocId, type AppLicense } from "../src/lib/licenses";

const baseLicense = (overrides: Partial<AppLicense>): AppLicense => ({
  id: "u1__crm",
  userId: "u1",
  appId: "crm",
  moduleKey: "crm",
  appName: "Infinite CRM",
  type: "subscription",
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

assert.equal(licenseDocId("user-1", "crm"), "user-1__crm");

assert.equal(
  isLicenseActive(
    baseLicense({
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    })
  ),
  false
);

assert.equal(hasModuleAccess([], "crm", { bypass: true }), true);

const licenses = [baseLicense({ moduleKey: "crm" })];
assert.equal(hasModuleAccess(licenses, "crm"), true);
assert.equal(hasModuleAccess(licenses, "finance"), false);

console.log("licenses.unit.test.ts: OK");
