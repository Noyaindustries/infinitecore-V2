/**
 * Valide les secrets et la politique CORS (aligné sur le démarrage API en production).
 *
 * Usage :
 *   npm run validate:secrets
 *   node --env-file=.env --env-file=.env.local scripts/validateSecrets.mjs
 */
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const MIN_LENGTH = 32;
const WEAK = new Set([
  "",
  "change-me",
  "change-me-in-production",
  "dev-secret-change-me",
  "remplace-par-une-cle-longue-et-aleatoire",
  "génère-une-chaîne-longue-et-aléatoire",
  "genere-une-chaine-longue-et-aleatoire",
]);

function readEnvKey(name) {
  if (process.env[name]) return String(process.env[name]).trim();
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(new RegExp(`^(?:export\\s+)?${name}\\s*=\\s*(.+)$`));
      if (!m) continue;
      let value = m[1].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  }
  return "";
}

function checkSecret(name, value, { required = false } = {}) {
  const errors = [];
  if (!value) {
    if (required) errors.push(`${name} est requis.`);
    return errors;
  }
  if (value.length < MIN_LENGTH) {
    errors.push(`${name} : minimum ${MIN_LENGTH} caractères (actuel ${value.length}).`);
  }
  if (WEAK.has(value.toLowerCase())) {
    errors.push(`${name} : valeur d’exemple interdite.`);
  }
  return errors;
}

function parseCorsOrigins(raw) {
  const seen = new Set();
  const out = [];
  for (const chunk of String(raw || "")
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    for (const part of chunk.split(/\s+/).map((s) => s.trim()).filter(Boolean)) {
      if (!/^https?:\/\//i.test(part)) continue;
      const normalized = part.replace(/\/$/, "");
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

function checkCors(raw, isProduction) {
  const errors = [];
  const origins = parseCorsOrigins(raw);
  if (origins.some((o) => o.includes("*"))) {
    errors.push("CORS_ORIGIN ne doit pas contenir de wildcard (*).");
  }
  if (isProduction) {
    if (origins.length === 0) errors.push("CORS_ORIGIN : au moins une origine en production.");
    const hasPublicHttps = origins.some(
      (o) => o.startsWith("https://") && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(o)
    );
    if (!hasPublicHttps) {
      errors.push("CORS_ORIGIN : au moins une origine HTTPS publique en production.");
    }
  }
  return errors;
}

function demoHmac(secret, payload) {
  const body = JSON.stringify(payload);
  const hex = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return { body, header: `sha256=${hex}` };
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const errors = [];

errors.push(...checkSecret("NEXTAUTH_SECRET", readEnvKey("NEXTAUTH_SECRET") || readEnvKey("JWT_SECRET"), { required: isProduction }));
errors.push(...checkSecret("DATABASE_URL", readEnvKey("DATABASE_URL"), { required: isProduction }));
errors.push(...checkSecret("PADDE_WEBHOOK_SECRET", readEnvKey("PADDE_WEBHOOK_SECRET"), { required: isProduction }));

const saasBridge = readEnvKey("SAAS_BRIDGE_API_KEY");
if (saasBridge) errors.push(...checkSecret("SAAS_BRIDGE_API_KEY", saasBridge));

const noya = readEnvKey("NOYA_RECRUTEMENT_WEBHOOK_SECRET");
if (noya) errors.push(...checkSecret("NOYA_RECRUTEMENT_WEBHOOK_SECRET", noya));

const stripeKey = readEnvKey("STRIPE_SECRET_KEY");
if (stripeKey) {
  errors.push(...checkSecret("STRIPE_WEBHOOK_SECRET", readEnvKey("STRIPE_WEBHOOK_SECRET"), { required: isProduction }));
}

errors.push(...checkCors(readEnvKey("CORS_ORIGIN"), isProduction));

if (errors.length) {
  console.error("Validation secrets / CORS : ÉCHEC\n");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`Validation secrets / CORS : OK (${nodeEnv})`);

const paddeSecret = readEnvKey("PADDE_WEBHOOK_SECRET");
if (paddeSecret) {
  const { body, header } = demoHmac(paddeSecret, { ping: true });
  console.log("\nExemple header webhook PADDE (HMAC-SHA256 du corps JSON) :");
  console.log(`  X-Webhook-Signature: ${header}`);
  console.log(`  Body: ${body}`);
}
