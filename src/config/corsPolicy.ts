import { parseCorsOrigins } from "./env";

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export type CorsPolicyReport = {
  ok: boolean;
  origins: string[];
  errors: string[];
};

/** Parse et valide la whitelist CORS (aucun wildcard). */
export function buildStrictCorsOrigins(raw: string): CorsPolicyReport {
  const origins = parseCorsOrigins(raw);
  const errors: string[] = [];

  if (origins.some((o) => o.includes("*"))) {
    errors.push("CORS_ORIGIN ne doit pas contenir de wildcard (*).");
  }

  for (const origin of origins) {
    if (!/^https?:\/\//i.test(origin)) {
      errors.push(`Origine CORS invalide : « ${origin} » (schéma http/https requis).`);
    }
  }

  return { ok: errors.length === 0, origins, errors };
}

/** En production : au moins une origine HTTPS publique (hors localhost). */
export function assertProductionCorsPolicy(report: CorsPolicyReport, isProduction: boolean): CorsPolicyReport {
  if (!isProduction) return report;

  const errors = [...report.errors];
  if (report.origins.length === 0) {
    errors.push("CORS_ORIGIN doit lister au moins une origine en production.");
  }

  const hasPublicHttps = report.origins.some(
    (o) => o.startsWith("https://") && !LOCALHOST_RE.test(o)
  );
  if (!hasPublicHttps) {
    errors.push(
      "CORS_ORIGIN doit inclure au moins une origine HTTPS publique en production (ex. https://www.infinitecore.net)."
    );
  }

  return { ok: errors.length === 0, origins: report.origins, errors };
}

export function formatCorsPolicyErrors(report: CorsPolicyReport): string {
  return report.errors.map((e) => `- ${e}`).join("\n");
}
