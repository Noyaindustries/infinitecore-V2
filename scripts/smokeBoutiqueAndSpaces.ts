/**
 * Smoke manuel : helpers boutique + APIs + pages publiques.
 * Usage: npx tsx scripts/smokeBoutiqueAndSpaces.ts
 */
import { authHeaders } from "../tests/helpers/authToken";
import {
  buildClientShopPath,
  resolveBoutiqueCta,
  safeReturnToPath,
} from "../src/lib/boutiqueCheckout";
import { INFINITE_APP_CATALOG } from "../src/data/appCatalog";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

type Row = { test: string; ok: boolean; [k: string]: unknown };

async function main() {
  const results: Row[] = [];

  results.push({
    test: "deep-link-shop",
    ok: buildClientShopPath({
      appId: "x",
      pricing: "subscription",
      billing: "month",
      trial: true,
    }).includes("trial=1"),
  });
  results.push({
    test: "cta-guest",
    ok: resolveBoutiqueCta(false, { appId: "x" }).startsWith("/signup"),
  });
  results.push({
    test: "cta-client",
    ok: resolveBoutiqueCta(true, { appId: "x" }).startsWith("/dashboard/boutique"),
  });
  results.push({
    test: "safe-return",
    ok: safeReturnToPath("https://evil.com") === null && !!safeReturnToPath("/dashboard"),
  });
  results.push({
    test: "catalog-code-has-year",
    ok: INFINITE_APP_CATALOG.every((a) =>
      a.pricing.some((p) => p.type === "subscription" && p.billingCycle === "year")
    ),
  });

  for (const role of ["client", "admin", "commando", "developer", "partner"] as const) {
    const res = await fetch(`${base}/api/auth/me`, { headers: authHeaders(role) });
    const j = (await res.json()) as { success?: boolean };
    results.push({
      test: `auth-me-${role}`,
      ok: res.ok && j.success === true,
      status: res.status,
    });
  }

  const catalog = (await (await fetch(`${base}/api/apps/catalog`)).json()) as {
    apps?: Array<{ id: string; pricing?: Array<{ type: string; billingCycle?: string }> }>;
  };
  const withSub =
    catalog.apps?.filter((a) => a.pricing?.some((p) => p.type === "subscription")).length ?? 0;
  const withLic =
    catalog.apps?.filter((a) => a.pricing?.some((p) => p.type === "license")).length ?? 0;
  results.push({
    test: "catalog-count",
    ok: (catalog.apps?.length ?? 0) >= 9,
    count: catalog.apps?.length,
  });
  results.push({
    test: "catalog-db-subscriptions",
    ok: withSub > 0,
    withSub,
    withLic,
    note:
      withSub === 0
        ? "DB: apps en licence seule — essai SaaS indisponible jusqu'à réinjection des abos"
        : "ok",
  });

  const trialUnauth = await fetch(`${base}/api/licenses/start-trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId: "caisse-enregistreuse" }),
  });
  results.push({
    test: "start-trial-unauth",
    ok: trialUnauth.status === 401,
    status: trialUnauth.status,
  });

  const trialAuth = await fetch(`${base}/api/licenses/start-trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders("client") },
    body: JSON.stringify({ appId: "caisse-enregistreuse" }),
  });
  const trialBody = (await trialAuth.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };
  results.push({
    test: "start-trial-client",
    ok: trialAuth.status !== 404,
    status: trialAuth.status,
    success: trialBody.success,
    error: trialBody.error,
  });

  for (const path of [
    "/",
    "/boutique",
    "/tarifs",
    "/login",
    "/signup",
    "/applications/erp-multi-ecole",
    "/solutions",
    "/faq",
  ]) {
    const res = await fetch(`${base}${path}`);
    const html = await res.text();
    results.push({
      test: `page${path}`,
      ok: res.ok && html.length > 500 && !html.includes("Rendered more hooks"),
      status: res.status,
    });
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(
    "SUMMARY",
    JSON.stringify({
      passed: results.filter((r) => r.ok).length,
      failed: failed.length,
      failures: failed,
    })
  );
  process.exit(failed.length ? 1 : 0);
}

void main();
