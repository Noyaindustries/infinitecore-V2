import { expect, test } from "@playwright/test";
import { loginAsRole } from "./auth";
import { waitForHydratedBody } from "./page-ready";

const protectedCases: Array<{
  role: "admin" | "commando" | "developer" | "partner" | "client";
  path: string;
}> = [
  { role: "admin", path: "/superadmin" },
  { role: "commando", path: "/admin" },
  { role: "developer", path: "/developer" },
  { role: "partner", path: "/partenaire" },
  { role: "client", path: "/dashboard" },
];

for (const testCase of protectedCases) {
  test(`la route protégée ${testCase.path} est accessible pour ${testCase.role}`, async ({ page }) => {
    await loginAsRole(page, testCase.role);
    const response = await page.goto(testCase.path, { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`${testCase.path.replace("/", "\\/")}`));
    await waitForHydratedBody(page);
  });
}
