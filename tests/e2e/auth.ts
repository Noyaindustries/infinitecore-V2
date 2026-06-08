import { expect, Page } from "@playwright/test";
import {
  buildAuthToken,
  E2E_FIXED_LOGIN_CODE,
  E2E_TEST_PASSWORD,
  isStaffTestRole,
  testAccountEmail,
  type TestRole,
} from "../helpers/authToken";
import { waitForHydratedBody } from "./page-ready";

const AUTH_TOKEN_KEY = "ic_auth_token";

async function dismissCookieBannerIfPresent(page: Page) {
  const essentialOnly = page.getByRole("button", { name: "Essentiels uniquement" });
  if (await essentialOnly.isVisible().catch(() => false)) {
    await essentialOnly.click();
  }
}

function homePathForRole(role: TestRole): string {
  switch (role) {
    case "admin":
      return "/superadmin";
    case "commando":
      return "/admin";
    case "developer":
      return "/developer";
    case "partner":
      return "/partenaire";
    default:
      return "/dashboard";
  }
}

async function resetClientAuthState(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("ic_auth_token");
    localStorage.removeItem("ic_has_session_hint");
  });
}

/** Session API (cookie httpOnly + token legacy) — repli si l’UI reste bloquée sur /login. */
export async function establishTestSession(page: Page, role: TestRole) {
  const email = testAccountEmail(role);
  const loginRes = await page.request.post("/api/auth/login", {
    data: { email, password: E2E_TEST_PASSWORD },
  });
  const loginBody = (await loginRes.json()) as {
    success?: boolean;
    verificationRequired?: boolean;
    challengeId?: string;
    token?: string;
    user?: { uid: string };
  };

  if (loginBody.verificationRequired && loginBody.challengeId) {
    const verifyRes = await page.request.post("/api/auth/login/verify", {
      data: { email, challengeId: loginBody.challengeId, code: E2E_FIXED_LOGIN_CODE },
    });
    if (!verifyRes.ok()) {
      await resetClientAuthState(page);
      await loginAsRole(page, role);
    }
  } else if (loginBody.token) {
    await page.evaluate(
      ({ authTokenKey, authToken }) => {
        window.localStorage.setItem(authTokenKey, authToken);
        window.localStorage.setItem("ic_has_session_hint", "1");
        window.localStorage.setItem("ic_consent", "essential");
      },
      { authTokenKey: AUTH_TOKEN_KEY, authToken: loginBody.token }
    );
  } else {
    await resetClientAuthState(page);
    await loginAsRole(page, role);
  }

  await page.goto(homePathForRole(role), { waitUntil: "domcontentloaded" });
  await waitForHydratedBody(page);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/** Connexion UI (email + mot de passe) avec contournement 2FA pour `*@infinitecore.local`. */
export async function loginViaUi(page: Page, role: TestRole) {
  const email = testAccountEmail(role);
  const staff = isStaffTestRole(role);
  await page.goto(staff ? "/login/staff" : "/login", { waitUntil: "domcontentloaded" });
  await waitForHydratedBody(page);
  await dismissCookieBannerIfPresent(page);

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page.locator("#password")).toBeVisible({ timeout: 15_000 });
  await page.locator("#password").fill(E2E_TEST_PASSWORD);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();

  const leftLogin = await page
    .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 12_000 })
    .then(() => true)
    .catch(() => false);

  if (!leftLogin && (await page.locator("#verificationCode").isVisible().catch(() => false))) {
    await page.locator("#verificationCode").fill(E2E_FIXED_LOGIN_CODE);
    await page.getByRole("button", { name: "Valider le code" }).click();
  }

  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await waitForHydratedBody(page);
}

export async function loginAsRole(page: Page, role: TestRole) {
  const token = buildAuthToken(role);

  await page.addInitScript(
    ({ authTokenKey, authToken }) => {
      window.localStorage.setItem(authTokenKey, authToken);
      window.localStorage.setItem("ic_has_session_hint", "1");
      window.localStorage.setItem("ic_consent", "essential");
    },
    {
      authTokenKey: AUTH_TOKEN_KEY,
      authToken: token,
    }
  );
}

