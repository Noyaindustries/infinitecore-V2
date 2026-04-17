import { expect, test, type Page } from "@playwright/test";
import { loginAsRole } from "./auth";
import { expectBodyContains, waitForHydratedBody } from "./page-ready";

test.describe.configure({ timeout: 60_000 });

async function expectBodyToMatchOneOf(page: Page, patterns: RegExp[]) {
  await waitForHydratedBody(page);
  await expect
    .poll(
      async () => {
        const bodyText = await page.locator("body").innerText();
        return patterns.some((pattern) => pattern.test(bodyText));
      },
      { timeout: 20_000, message: "Aucun texte attendu trouvé dans la page." },
    )
    .toBeTruthy();
}

test("validation dossier client conserve le succès même si notification échoue", async ({ page }) => {
  await loginAsRole(page, "client");
  await page.goto("/dashboard/suivi", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/suivi$/);
  await expectBodyContains(page, "Mon dossier");

  const validateButton = page.getByRole("button", { name: /Valider le dossier/i }).first();
  await expect(validateButton).toBeVisible();
  await validateButton.click();

  await expectBodyContains(page, /validé !/i);
  await expect(page.locator("body")).not.toContainText("Erreur lors de la validation.");
});

type TestRole = "admin" | "commando" | "developer" | "partner" | "client";
type Scenario = {
  name: string;
  role: TestRole;
  path: string;
  run: (page: Page) => Promise<void>;
};

const scenarios: Scenario[] = [
  {
    name: "commando",
    role: "commando",
    path: "/admin/clients",
    run: async (page) => {
      await expectBodyContains(page, "Carnet clients");
      await page.getByRole("main").getByRole("link", { name: "Tableau de bord" }).click();
      await expect(page).toHaveURL(/\/admin$/);

      await page.goto("/admin/clients", { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: "Dossier" }).first().click();
      await expect(page).toHaveURL(/\/admin\/dossiers$/);
      await expectBodyContains(page, "Archives Dossiers");
      await expectBodyContains(page, "Station de commandement des flux documentaires clients");
    },
  },
  {
    name: "superadmin",
    role: "admin",
    path: "/superadmin/users",
    run: async (page) => {
      await expectBodyContains(page, "Utilisateurs Indexés");
      await page.getByRole("link", { name: "Commandes & Paiements" }).click();
      await expect(page).toHaveURL(/\/superadmin\/orders$/);
      await expectBodyContains(page, "Poste de Facturation");

      const searchInput = page.getByRole("textbox", {
        name: /Indexer par ID, Client ou Service/i,
      });
      await searchInput.fill("PADDE-");
      await expectBodyContains(page, "PADDE-");
      await expect(searchInput).toHaveValue("PADDE-");
    },
  },
  {
    name: "développeur",
    role: "developer",
    path: "/developer/livrables",
    run: async (page) => {
      await expectBodyContains(page, "Soumettre un livrable");
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Missions", exact: true })
        .click();
      await expect(page).toHaveURL(/\/developer\/missions$/);
      await expectBodyContains(page, "Liste des missions assignées.");
      await expectBodyContains(page, "Missions");

      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Soumettre un livrable", exact: true })
        .click();
      await expect(page).toHaveURL(/\/developer\/livrables$/);
      await expectBodyContains(page, "Protocole de livraison");
    },
  },
  {
    name: "partenaire",
    role: "partner",
    path: "/partenaire/clients",
    run: async (page) => {
      await expectBodyContains(page, "Mes Contacts soumis");
      await page.getByRole("button", { name: /Nouveau contact/i }).click();
      await expectBodyContains(page, "Nouveau contact PME");
      await page.getByRole("button", { name: "Annuler" }).click();

      await page.goto("/partenaire/commissions", { waitUntil: "domcontentloaded" });
      await page.getByRole("main").getByRole("link", { name: "Mes contacts" }).click();
      await expect(page).toHaveURL(/\/partenaire\/clients$/);

      await page.goto("/partenaire/filleuls", { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: "Voir mes leads partenaires" }).click();
      await expect(page).toHaveURL(/\/partenaire\/clients$/);
    },
  },
  {
    name: "client",
    role: "client",
    path: "/dashboard/suivi",
    run: async (page) => {
      await expectBodyContains(page, "Mon dossier");
      await page.getByRole("main").getByRole("button", { name: /^Archive/ }).click();
      await expectBodyToMatchOneOf(page, [/Documents validés/i, /Aucun document validé/i]);

      await page.getByRole("main").getByRole("link", { name: "Messagerie" }).click();
      await expect(page).toHaveURL(/\/dashboard\/messagerie$/);
      await expectBodyContains(page, "Équipe Infinite Core");

      await page.getByRole("main").getByRole("link", { name: "Mon profil" }).click();
      await expect(page).toHaveURL(/\/dashboard\/profil$/);
      await expectBodyContains(page, "Mon profil");
      await expectBodyContains(page, "Enregistrer les modifications");

      await page.goto("/dashboard/boutique", { waitUntil: "domcontentloaded" });
      await expectBodyContains(page, "Boutique & Services");
      await page.getByRole("button", { name: "Commander" }).first().click();
      await expectBodyContains(page, "Confirmer la demande");
      await expectBodyContains(page, "Service sélectionné");
      await page.getByRole("button", { name: "Fermer la fenêtre" }).click();
      await expect(page.getByRole("heading", { name: "Confirmer la demande" })).toBeHidden();
    },
  },
];

for (const scenario of scenarios) {
  test(`actions et liens ${scenario.name}`, async ({ page }) => {
    await loginAsRole(page, scenario.role);
    await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(scenario.path.replace(/\//g, "\\/")));
    await scenario.run(page);
  });
}
