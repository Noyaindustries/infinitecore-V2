import { expect, test } from "@playwright/test";
import { loginAsRole } from "./auth";
import { expectBodyContains } from "./page-ready";

test.describe.configure({ timeout: 60_000 });

test("parcours espace commando", async ({ page }) => {
  await loginAsRole(page, "commando");
  await page.goto("/admin/pipeline", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/pipeline$/);
  await expectBodyContains(page, "Pipeline Radar");
  await expectBodyContains(page, "Leads partenaires");
  await expectBodyContains(page, /Injecter Unité/i);

  await page.goto("/admin/clients", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/clients$/);
  await expectBodyContains(page, "Carnet clients");
  await expectBodyContains(page, "Portefeuille");
  await expectBodyContains(page, /Rechercher un client/i);

  await page.goto("/admin/messagerie", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/messagerie$/);
  await expectBodyContains(page, "Messagerie clients");
  await expectBodyContains(page, "Boîte de réception");
  await expectBodyContains(page, "Non lues");
});

test("parcours espace superadmin", async ({ page }) => {
  await loginAsRole(page, "admin");
  await page.goto("/superadmin/users", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/superadmin\/users$/);
  await expectBodyContains(page, "Registre Global des Paramètres");
  await expectBodyContains(page, "Utilisateurs Indexés");
  await expectBodyContains(page, "Politique RBAC Active");

  await page.goto("/superadmin/orders", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/superadmin\/orders$/);
  await expectBodyContains(page, "Poste de Facturation");
  await expectBodyContains(page, "Total ARR");
  await expectBodyContains(page, "Résultat(s)");
});

test("parcours espace développeur", async ({ page }) => {
  await loginAsRole(page, "developer");
  await page.goto("/developer/missions", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/developer\/missions$/);
  await expectBodyContains(page, "Missions");
  await expectBodyContains(page, "Liste des missions assignées.");

  await page.goto("/developer/livrables", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/developer\/livrables$/);
  await expectBodyContains(page, "Soumettre un livrable");
  await expectBodyContains(page, "Protocole de livraison");
  await expectBodyContains(page, "Soumettre au SuperAdmin");
});

test("parcours espace partenaire", async ({ page }) => {
  await loginAsRole(page, "partner");
  await page.goto("/partenaire/clients", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/partenaire\/clients$/);
  await expectBodyContains(page, "Mes Contacts soumis");
  await expectBodyContains(page, "Inscriptions via mon lien");
  await expectBodyContains(page, /Nouveau contact/i);

  await page.goto("/partenaire/commissions", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/partenaire\/commissions$/);
  await expectBodyContains(page, "Mes Commissions");
  await expectBodyContains(page, "Historique des commissions");
  await expectBodyContains(page, /Exporter CSV/i);

  await page.goto("/partenaire/filleuls", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/partenaire\/filleuls$/);
  await expectBodyContains(page, "Clients apportés par mon lien");
  await expectBodyContains(page, "Filleuls inscrits");
  await expectBodyContains(page, /Copier|Copié/i);
});

test("parcours espace client", async ({ page }) => {
  await loginAsRole(page, "client");
  await page.goto("/dashboard/suivi", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/suivi$/);
  await expectBodyContains(page, "Mon dossier");
  await expectBodyContains(page, "Progression globale");
  await expectBodyContains(page, /Mes étapes/i);

  await page.goto("/dashboard/messagerie", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/messagerie$/);
  await expectBodyContains(page, "Équipe Infinite Core");
  await expectBodyContains(page, "Messagerie privée");
  await expectBodyContains(page, /Message à envoyer à l'équipe Infinite/i);

  await page.goto("/dashboard/boutique", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/boutique$/);
  await expectBodyContains(page, "Boutique & Services — Catalogue Complet");
  await expectBodyContains(page, "Audits PADDE-CI — 100% Gratuits");
  await expectBodyContains(page, /Gérer mes abonnements/i);
});
