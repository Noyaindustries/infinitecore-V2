import { expect, type Page } from "@playwright/test";

export async function waitForHydratedBody(page: Page) {
  const waitOnce = async () => {
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              document.readyState === "complete" &&
              (document.body?.innerText?.trim().length ?? 0) > 0,
          ),
        {
          timeout: 30_000,
          message: "Le body n'est pas encore hydraté.",
        },
      )
      .toBeTruthy();
  };

  try {
    await waitOnce();
  } catch {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitOnce();
  }
}

export async function expectBodyContains(page: Page, text: RegExp | string) {
  await waitForHydratedBody(page);
  await expect(page.locator("body")).toContainText(text, { timeout: 20_000 });
}
