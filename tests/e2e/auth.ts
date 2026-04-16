import { Page } from "@playwright/test";
import jwt from "jsonwebtoken";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type TestRole = "admin" | "commando" | "developer" | "partner" | "client";

const AUTH_TOKEN_KEY = "ic_auth_token";

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, "utf-8");
  const parsed: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    const rawValue = trimmed.slice(equalIndex + 1).trim();
    const unquoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
    parsed[key] = unquoted;
  }

  return parsed;
}

function resolveServerEnv() {
  const root = process.cwd();
  const env = parseEnvFile(path.join(root, ".env"));
  const envLocal = parseEnvFile(path.join(root, ".env.local"));

  return {
    ...env,
    ...envLocal,
  };
}

const USERS_BY_ROLE: Record<TestRole, { uid: string; email: string }> = {
  admin: { uid: "usr_admin_test", email: "admin.test@infinitecore.local" },
  commando: { uid: "usr_commando_test", email: "commando.test@infinitecore.local" },
  developer: { uid: "usr_dev_test", email: "dev.test@infinitecore.local" },
  partner: { uid: "usr_partner_test", email: "partner.test@infinitecore.local" },
  client: { uid: "usr_client_test", email: "client.test@infinitecore.local" },
};

function buildAuthToken(role: TestRole): string {
  const user = USERS_BY_ROLE[role];
  const serverEnv = resolveServerEnv();
  const secret =
    process.env.NEXTAUTH_SECRET ??
    process.env.JWT_SECRET ??
    serverEnv.NEXTAUTH_SECRET ??
    serverEnv.JWT_SECRET ??
    "dev-secret-change-me";
  const issuer = process.env.JWT_ISSUER ?? serverEnv.JWT_ISSUER ?? "infinitecore-api";
  const audience = process.env.JWT_AUDIENCE ?? serverEnv.JWT_AUDIENCE ?? "infinitecore-web";

  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      role,
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: "7d",
      issuer,
      audience,
    }
  );
}

export async function loginAsRole(page: Page, role: TestRole) {
  const token = buildAuthToken(role);

  await page.addInitScript(
    ({ authTokenKey, authToken }) => {
      window.localStorage.setItem(authTokenKey, authToken);
      window.localStorage.setItem("ic_consent", "essential");
    },
    {
      authTokenKey: AUTH_TOKEN_KEY,
      authToken: token,
    }
  );
}

