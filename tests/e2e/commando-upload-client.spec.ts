import { expect, test } from "@playwright/test";
import { loginAsRole } from "./auth";
import { expectBodyContains } from "./page-ready";

test.describe.configure({ timeout: 90_000 });

test("commando peut deposer un fichier visible par le client", async ({ page }) => {
  const uploadedFileName = "commando-upload-e2e.pdf";

  await loginAsRole(page, "commando");
  await page.goto("/admin/dossiers", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/dossiers$/);
  await expectBodyContains(page, "Archives Dossiers");

  await page.getByRole("button", { name: /client\.test@infinitecore\.local/i }).click();
  await expect(page.locator("body")).not.toContainText("Sélectionner une unité client pour interroger la base.");
  await page.getByRole("button", { name: "Injecter" }).first().click();

  await page.locator("#dossier-file-audit").setInputFiles({
    name: uploadedFileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF"),
  });
  await page.getByRole("button", { name: "Déployer" }).click();
  await expectBodyContains(page, "le client peut le valider dans Mon dossier");
  await expect(page.getByText("Injection :")).toHaveCount(0);

  await expectBodyContains(page, uploadedFileName);

  const clientPage = await page.context().newPage();
  await loginAsRole(clientPage, "client");
  await clientPage.goto("/dashboard/suivi", { waitUntil: "domcontentloaded" });
  await expect(clientPage).toHaveURL(/\/dashboard\/suivi$/);
  await expectBodyContains(clientPage, "Mon dossier");
  await expectBodyContains(clientPage, uploadedFileName);
});
