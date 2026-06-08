import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  __csrfTestUtils,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  ensureCsrfCookieForSession,
  generateCsrfToken,
  originAllowedForRequest,
} from "../../src/server/csrfProtection";

const { resolveTrustedOrigins, isCsrfProtectionEnabled, shouldSkipCsrfPath } = __csrfTestUtils;

function mockReq(partial: Partial<Request> & { headers?: Record<string, string> }): Request {
  return {
    method: "POST",
    path: "/api/data/doc",
    headers: partial.headers || {},
    ...partial,
  } as Request;
}

describe("csrfProtection", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.CSRF_PROTECTION;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.CSRF_PROTECTION;
  });

  it("active la protection en production par défaut", () => {
    expect(isCsrfProtectionEnabled()).toBe(true);
  });

  it("peut être désactivée via CSRF_PROTECTION=0", () => {
    process.env.CSRF_PROTECTION = "0";
    expect(isCsrfProtectionEnabled()).toBe(false);
  });

  it("accepte une origine CORS autorisée", () => {
    const trusted = resolveTrustedOrigins(["https://www.infinitecore.net"]);
    const req = mockReq({
      headers: { origin: "https://www.infinitecore.net" },
    });
    expect(originAllowedForRequest(req, trusted)).toBe(true);
  });

  it("rejette une origine externe", () => {
    const trusted = resolveTrustedOrigins(["https://www.infinitecore.net"]);
    const req = mockReq({
      headers: { origin: "https://evil.example" },
    });
    expect(originAllowedForRequest(req, trusted)).toBe(false);
  });

  it("génère des jetons CSRF uniques", () => {
    expect(generateCsrfToken()).not.toEqual(generateCsrfToken());
  });

  it("expose les noms cookie / header attendus par le front", () => {
    expect(CSRF_COOKIE_NAME).toBe("ic_csrf");
    expect(CSRF_HEADER_NAME).toBe("X-CSRF-Token");
  });

  it("émet un cookie CSRF pour une session auth sans ic_csrf", () => {
    const cookies: Array<{ name: string; value: string }> = [];
    const res = { cookie: (name: string, value: string) => cookies.push({ name, value }) };
    const req = mockReq({
      headers: { cookie: "ic_auth_token=abc123" },
    });
    ensureCsrfCookieForSession(req, res as never);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe("ic_csrf");
    expect(cookies[0]?.value.length).toBeGreaterThan(16);
  });

  it("ne remplace pas un cookie CSRF déjà présent", () => {
    const cookies: Array<{ name: string; value: string }> = [];
    const res = { cookie: (name: string, value: string) => cookies.push({ name, value }) };
    const req = mockReq({
      headers: { cookie: "ic_auth_token=abc123; ic_csrf=existing" },
    });
    ensureCsrfCookieForSession(req, res as never);
    expect(cookies).toHaveLength(0);
  });

  it("ignore le CSRF sur POST /api/auth/google (connexion)", () => {
    expect(shouldSkipCsrfPath("/api/auth/google")).toBe(true);
    expect(shouldSkipCsrfPath("/api/auth/login")).toBe(true);
    expect(shouldSkipCsrfPath("/api/auth/logout")).toBe(false);
  });
});
