import { expect, test } from "@playwright/test";
import jwt from "jsonwebtoken";
import { authHeaders, buildAuthToken, E2E_TEST_PASSWORD, testAccountEmail } from "../helpers/authToken";
import { loginAsRole } from "./auth";

test.describe("contournement auth — API", () => {
  test("GET /api/auth/me sans jeton → 401", async ({ request }) => {
    const response = await request.get("/api/auth/me");
    expect(response.status()).toBe(401);
  });

  test("GET /api/auth/me avec JWT falsifié → 401", async ({ request }) => {
    const forged = jwt.sign(
      { uid: "usr_admin_test", email: "admin.test@infinitecore.local", role: "admin" },
      "wrong-secret-for-test",
      { algorithm: "HS256", expiresIn: "1h" }
    );
    const response = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${forged}` },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/auth/login mot de passe incorrect → 401", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: {
        email: testAccountEmail("client"),
        password: "WrongPass1!",
      },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test("POST /api/auth/admin-role en tant que client → 403", async ({ request }) => {
    const response = await request.post("/api/auth/admin-role", {
      headers: authHeaders("client"),
      data: { email: testAccountEmail("client"), role: "admin" },
    });
    expect(response.status()).toBe(403);
  });

  test("POST /api/auth/admin-update-email en tant que client → 403", async ({ request }) => {
    const response = await request.post("/api/auth/admin-update-email", {
      headers: authHeaders("client"),
      data: { uid: "usr_client_test", email: "hacked@example.com" },
    });
    expect(response.status()).toBe(403);
  });

  test("PATCH /api/data/doc sans auth → 401", async ({ request }) => {
    const response = await request.patch("/api/data/doc", {
      data: {
        collectionPath: "users",
        docId: "usr_client_test",
        data: { displayName: "intrus" },
      },
    });
    expect(response.status()).toBe(401);
  });

  test("token client sur route admin catalogue → 403", async ({ request }) => {
    const response = await request.put("/api/apps/catalog", {
      headers: authHeaders("client"),
      data: { apps: [] },
    });
    expect(response.status()).toBe(403);
  });
});

test.describe("contournement auth — UI", () => {
  test("sans session, /superadmin redirige vers /login", async ({ page }) => {
    await page.goto("/superadmin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("client connecté ne peut pas rester sur /superadmin", async ({ page }) => {
    await loginAsRole(page, "client");
    await page.goto("/superadmin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("commando connecté ne peut pas rester sur /superadmin", async ({ page }) => {
    await loginAsRole(page, "commando");
    await page.goto("/superadmin", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/superadmin/, { timeout: 15_000 });
  });
});

test.describe("contournement auth — jetons locaux", () => {
  test("JWT signé localement sans compte réel → /api/auth/me 401", async ({ request }) => {
    const token = buildAuthToken("admin").slice(0, -4) + "xxxx";
    const response = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(401);
  });

  test("mot de passe seed connu ne suffit pas sans e-mail seed valide", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: { email: "intrus@example.com", password: E2E_TEST_PASSWORD },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
