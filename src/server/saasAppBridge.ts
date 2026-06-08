import { timingSafeEqual } from "crypto";
import type { AppCatalogEntry } from "@/data/appCatalog";
import type { AppLicense } from "@/lib/licenses";
import { resolveSaasTenantId } from "@/lib/saasAccess";

export type SaasBridgeEvent =
  | "tenant.provision"
  | "subscription.suspended"
  | "subscription.resumed"
  | "tenant.ready";

function bridgeApiKey(): string {
  return String(process.env.SAAS_BRIDGE_API_KEY || "").trim();
}

function secureEquals(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifySaasBridgeAuth(headerValue: string | undefined): boolean {
  const expected = bridgeApiKey();
  const isProduction = (process.env.NODE_ENV || "development") === "production";
  if (!expected) return !isProduction;
  const provided = String(headerValue || "").trim();
  if (!provided) return false;
  return secureEquals(expected, provided);
}

export function saasBridgeHeaders(): Record<string, string> {
  const key = bridgeApiKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["X-InfiniteCore-SaaS-Key"] = key;
  return headers;
}

async function postSaasWebhook(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: saasBridgeHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    console.error("[saasAppBridge] webhook failed:", url, error);
    return { ok: false };
  }
}

function webhookUrl(app: AppCatalogEntry | undefined, kind: "provision" | "events"): string | null {
  if (!app) return null;
  if (kind === "provision") {
    return app.saasProvisionWebhookUrl?.trim() || app.saasWebhookUrl?.trim() || null;
  }
  return app.saasWebhookUrl?.trim() || app.saasProvisionWebhookUrl?.trim() || null;
}

export async function notifySaasTenantProvision(input: {
  app?: AppCatalogEntry;
  userId: string;
  appId: string;
  moduleKey: string;
  tenantId: string;
  email?: string | null;
  appName?: string;
}): Promise<void> {
  const url = webhookUrl(input.app, "provision");
  if (!url) return;
  await postSaasWebhook(url, {
    event: "tenant.provision" satisfies SaasBridgeEvent,
    userId: input.userId,
    appId: input.appId,
    moduleKey: input.moduleKey,
    tenantId: input.tenantId,
    email: input.email ?? null,
    appName: input.appName ?? input.app?.title ?? null,
    saasBaseUrl: input.app?.saasBaseUrl ?? null,
  });
}

export async function notifySaasSubscriptionEvent(input: {
  app?: AppCatalogEntry;
  license: AppLicense;
  event: "subscription.suspended" | "subscription.resumed";
}): Promise<void> {
  const url = webhookUrl(input.app, "events");
  if (!url) return;
  await postSaasWebhook(url, {
    event: input.event,
    userId: input.license.userId,
    appId: input.license.appId,
    moduleKey: input.license.moduleKey,
    tenantId: resolveSaasTenantId(input.license),
    stripeSubscriptionId: input.license.stripeSubscriptionId ?? null,
  });
}
