import type { Express, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { appEnv } from "@/config/env";

export const CSRF_COOKIE_NAME = "ic_csrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const SKIP_PATH_PREFIXES = ["/api/stripe/webhook", "/api/webhooks/", "/health"];

/** Connexion / inscription : ne pas exiger CSRF (cookie auth obsolète encore envoyé par le navigateur). */
const CSRF_SKIP_AUTH_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/login/verify",
  "/api/auth/google",
  "/api/auth/register",
  "/api/auth/register/verify",
  "/api/auth/password-reset/request",
  "/api/auth/password-reset/confirm",
  "/api/auth/referral-signup-notify",
]);

function authUsesSecureCookies(): boolean {
  return appEnv.node.isProduction || appEnv.auth.nextAuthUrl.startsWith("https://");
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function requestPath(req: Request): string {
  return (req.path || req.url?.split("?")[0] || "").split("?")[0] || "";
}

function shouldSkipCsrfPath(path: string): boolean {
  if (SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (CSRF_SKIP_AUTH_PATHS.has(path)) return true;
  return false;
}

export function isCsrfProtectionEnabled(): boolean {
  if (process.env.CSRF_PROTECTION === "0") return false;
  return appEnv.node.isProduction;
}

function hasBearerAuthorization(req: Request): boolean {
  const raw = req.headers.authorization;
  return typeof raw === "string" && raw.startsWith("Bearer ");
}

function hasAuthCookie(req: Request): boolean {
  const cookie = typeof req.headers.cookie === "string" ? req.headers.cookie : "";
  return cookie.includes("ic_auth_token=");
}

function parseCookieValue(header: string | undefined, key: string): string | null {
  if (!header) return null;
  for (const chunk of header.split(";")) {
    const [namePart, ...valueParts] = chunk.split("=");
    if (String(namePart || "").trim() !== key) continue;
    const rawValue = valueParts.join("=").trim();
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

function secureTokenEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Origine autorisée pour les requêtes cookie (aligné sur CORS + APP_BASE_URL). */
export function resolveTrustedOrigins(corsOrigins: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = [
    ...corsOrigins,
    appEnv.auth.nextAuthUrl,
    appEnv.auth.appBaseUrl || "",
  ];
  for (const raw of candidates) {
    const normalized = normalizeOrigin(raw);
    if (!normalized || !/^https?:\/\//i.test(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function originAllowedForRequest(req: Request, trustedOrigins: string[]): boolean {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.trim()) {
    return trustedOrigins.includes(normalizeOrigin(origin));
  }
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.trim()) {
    try {
      const url = new URL(referer);
      return trustedOrigins.includes(normalizeOrigin(`${url.protocol}//${url.host}`));
    } catch {
      return false;
    }
  }
  return false;
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function csrfCookieOptions() {
  const domain = appEnv.node.isDevelopment ? undefined : appEnv.auth.cookieDomain;
  return {
    httpOnly: false as const,
    sameSite: "lax" as const,
    secure: authUsesSecureCookies(),
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(domain ? { domain } : {}),
  };
}

export function setCsrfCookie(res: Response, token?: string): string {
  const value = token || generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, value, csrfCookieOptions());
  return value;
}

/** Sessions créées avant le déploiement CSRF : émet le cookie au prochain GET authentifié. */
export function ensureCsrfCookieForSession(req: Request, res: Response): void {
  if (!isCsrfProtectionEnabled()) return;
  if (!hasAuthCookie(req)) return;
  const existing = parseCookieValue(
    typeof req.headers.cookie === "string" ? req.headers.cookie : undefined,
    CSRF_COOKIE_NAME
  );
  if (existing) return;
  setCsrfCookie(res);
}

export function clearCsrfCookie(res: Response) {
  const domain = appEnv.node.isDevelopment ? undefined : appEnv.auth.cookieDomain;
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    sameSite: "lax",
    secure: authUsesSecureCookies(),
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

function csrfTokenValid(req: Request): boolean {
  const header = req.headers[CSRF_HEADER_NAME.toLowerCase()];
  const headerToken = typeof header === "string" ? header.trim() : "";
  const cookieToken = parseCookieValue(
    typeof req.headers.cookie === "string" ? req.headers.cookie : undefined,
    CSRF_COOKIE_NAME
  );
  if (!headerToken || !cookieToken) return false;
  return secureTokenEquals(headerToken, cookieToken);
}

export function applyCsrfProtection(app: Express, corsOrigins: string[]) {
  const trustedOrigins = resolveTrustedOrigins(corsOrigins);

  app.use((req, res, next) => {
    if (!isCsrfProtectionEnabled()) return next();
    if (!MUTATING_METHODS.has(String(req.method || "GET").toUpperCase())) return next();

    const path = requestPath(req);
    if (shouldSkipCsrfPath(path)) return next();
    if (hasBearerAuthorization(req)) return next();
    if (!hasAuthCookie(req)) return next();

    if (!originAllowedForRequest(req, trustedOrigins)) {
      return res.status(403).json({
        success: false,
        error: "Requête refusée (origine non autorisée).",
      });
    }
    if (!csrfTokenValid(req)) {
      return res.status(403).json({
        success: false,
        error: "Jeton CSRF manquant ou invalide.",
      });
    }
    return next();
  });
}

export const __csrfTestUtils = {
  originAllowedForRequest,
  resolveTrustedOrigins,
  isCsrfProtectionEnabled,
  shouldSkipCsrfPath,
};
