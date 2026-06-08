import { describe, expect, it } from "vitest";
import {
  assertProductionCorsPolicy,
  buildStrictCorsOrigins,
} from "../../src/config/corsPolicy";
import {
  validateProductionSecrets,
  validateSharedSecret,
} from "../../src/config/secretPolicy";
import {
  computeWebhookHmacSha256,
  formatWebhookSignature,
  verifyInboundWebhookAuth,
  verifyWebhookHmac,
} from "../../src/server/webhookHmac";

describe("validateSharedSecret", () => {
  it("rejette les secrets trop courts", () => {
    expect(validateSharedSecret("PADDE_WEBHOOK_SECRET", "abc", { required: true }).ok).toBe(false);
  });
});

describe("validateProductionSecrets", () => {
  it("ignore la validation hors production", () => {
    expect(
      validateProductionSecrets({
        isProduction: false,
        databaseUrl: "",
        jwtSecret: "",
        paddeWebhookSecret: "",
        noyaWebhookSecret: "",
        saasBridgeApiKey: "",
        stripeSecretKey: "",
        stripeWebhookSecret: "",
      }).ok
    ).toBe(true);
  });

  it("exige DATABASE_URL et NEXTAUTH_SECRET en production", () => {
    const report = validateProductionSecrets({
      isProduction: true,
      databaseUrl: "",
      jwtSecret: "change-me-in-production",
      paddeWebhookSecret: "",
      noyaWebhookSecret: "",
      saasBridgeApiKey: "",
      stripeSecretKey: "",
      stripeWebhookSecret: "",
    });
    expect(report.ok).toBe(false);
    expect(report.checks.some((c) => c.name === "DATABASE_URL" && !c.ok)).toBe(true);
    expect(report.checks.some((c) => c.name === "SAAS_BRIDGE_API_KEY" && !c.ok)).toBe(true);
  });
});

describe("buildStrictCorsOrigins", () => {
  it("rejette les wildcards", () => {
    const report = buildStrictCorsOrigins("https://a.com,https://*.b.com");
    expect(report.ok).toBe(false);
  });

  it("exige une origine HTTPS publique en production", () => {
    const report = assertProductionCorsPolicy(
      buildStrictCorsOrigins("http://localhost:3000"),
      true
    );
    expect(report.ok).toBe(false);
  });
});

describe("verifyWebhookHmac", () => {
  const secret = "a".repeat(32);
  const body = JSON.stringify({ type: "audit-rapide", ok: true });

  it("valide sha256=…", () => {
    const digest = computeWebhookHmacSha256(secret, body);
    expect(verifyWebhookHmac(secret, body, formatWebhookSignature(digest))).toBe(true);
    expect(verifyWebhookHmac(secret, body, "sha256=deadbeef")).toBe(false);
  });

  it("accepte le secret legacy en dev", () => {
    const req = {
      headers: { "x-webhook-secret": secret },
      body: { type: "audit" },
      query: {},
    } as never;
    const result = verifyInboundWebhookAuth({
      secretExpected: secret,
      req,
      rawBody: Buffer.from(body),
      isProduction: false,
      allowPlainSecret: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("plain");
  });

  it("exige HMAC en production sans WEBHOOK_ALLOW_PLAIN_SECRET", () => {
    const req = {
      headers: { "x-webhook-secret": secret },
      body: { type: "audit" },
      query: {},
    } as never;
    const result = verifyInboundWebhookAuth({
      secretExpected: secret,
      req,
      rawBody: Buffer.from(body),
      isProduction: true,
      allowPlainSecret: false,
    });
    expect(result.ok).toBe(false);
  });
});
