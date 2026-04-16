import { expect, test } from "@playwright/test";
import { waitForHydratedBody } from "./page-ready";

const publicRoutes = ["/", "/tarifs", "/login", "/signup"];

for (const route of publicRoutes) {
  test(`la route publique ${route} se charge`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await waitForHydratedBody(page);
  });
}
