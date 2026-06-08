import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";

export const WEBHOOK_SIGNATURE_HEADER = "x-webhook-signature";

export function secureSecretEquals(expected: string, provided: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function computeWebhookHmacSha256(secret: string, rawBody: Buffer | string): string {
  const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function formatWebhookSignature(hexDigest: string): string {
  return `sha256=${hexDigest}`;
}

/** Accepte `sha256=…`, `v1=…`, ou hex nu (64 caractères). */
export function parseWebhookSignatureHeader(value: string | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const prefixed =
    trimmed.match(/^sha256=([a-f0-9]+)$/i) ?? trimmed.match(/^v1=([a-f0-9]+)$/i);
  if (prefixed) return prefixed[1].toLowerCase();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export function verifyWebhookHmac(
  secret: string,
  rawBody: Buffer | string,
  signatureHeader: string | undefined
): boolean {
  const expected = computeWebhookHmacSha256(secret, rawBody);
  const provided = parseWebhookSignatureHeader(signatureHeader);
  if (!provided) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type WebhookAuthMode = "none" | "hmac" | "plain";

export type WebhookAuthResult =
  | { ok: true; mode: WebhookAuthMode }
  | { ok: false; reason: string };

export function readWebhookPlainSecret(req: Request): string {
  const headerSecret = String(req.headers["x-webhook-secret"] ?? "").trim();
  if (headerSecret) return headerSecret;
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    const b = req.body as Record<string, unknown>;
    const bodySecret = String(b.webhookSecret ?? b.secret ?? "").trim();
    if (bodySecret) return bodySecret;
  }
  const qRaw = req.query?.secret;
  return (Array.isArray(qRaw) ? String(qRaw[0] ?? "") : String(qRaw ?? "")).trim();
}

export function verifyInboundWebhookAuth(input: {
  secretExpected: string;
  req: Request;
  rawBody?: Buffer;
  isProduction: boolean;
  allowPlainSecret: boolean;
}): WebhookAuthResult {
  const secretExpected = input.secretExpected.trim();
  if (!secretExpected) return { ok: true, mode: "none" };

  const signatureHeader = String(
    input.req.headers[WEBHOOK_SIGNATURE_HEADER] ?? input.req.headers["X-Webhook-Signature"] ?? ""
  );

  const rawBody =
    input.rawBody ??
    (typeof input.req.body === "string"
      ? Buffer.from(input.req.body, "utf8")
      : input.req.body !== undefined
        ? Buffer.from(JSON.stringify(input.req.body), "utf8")
        : undefined);

  if (rawBody && verifyWebhookHmac(secretExpected, rawBody, signatureHeader)) {
    return { ok: true, mode: "hmac" };
  }

  const plainAllowed = !input.isProduction || input.allowPlainSecret;
  const plainSecret = readWebhookPlainSecret(input.req);
  if (plainAllowed && plainSecret && secureSecretEquals(secretExpected, plainSecret)) {
    return { ok: true, mode: "plain" };
  }

  if (input.isProduction && !input.allowPlainSecret) {
    return {
      ok: false,
      reason:
        "Signature HMAC requise (header X-Webhook-Signature: sha256=… du corps brut JSON).",
    };
  }

  return { ok: false, reason: "Webhook non autorisé." };
}

export function bodyWithoutWebhookSecrets(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const o = { ...(body as Record<string, unknown>) };
  delete o.webhookSecret;
  delete o.secret;
  delete o.webhook_secret;
  return o;
}
