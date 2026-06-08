/**
 * Génère ou valide NEXTAUTH_SECRET (32+ caractères aléatoires).
 *
 * Usage :
 *   npm run generate:nextauth-secret
 *   npm run validate:nextauth-secret
 *   node --env-file=.env.local scripts/generateNextAuthSecret.mjs --validate
 *   node scripts/generateNextAuthSecret.mjs --write .env.local
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

function validateSecret(raw) {
  const secret = String(raw ?? "").trim();
  const errors = [];
  if (!secret) errors.push("NEXTAUTH_SECRET (ou JWT_SECRET) est vide.");
  else if (secret.length < MIN_LENGTH) {
    errors.push(`Le secret doit contenir au moins ${MIN_LENGTH} caractères (actuel : ${secret.length}).`);
  }
  if (WEAK.has(secret.toLowerCase())) {
    errors.push("Le secret est une valeur d’exemple — générez une clé aléatoire unique.");
  }
  return { ok: errors.length === 0, secret, errors };
}

function generateSecret() {
  return randomBytes(32).toString("base64url");
}

function readEnvSecretFromFile(filePath) {
  if (!existsSync(filePath)) return "";
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^(?:export\s+)?(?:NEXTAUTH_SECRET|JWT_SECRET)\s*=\s*(.+)$/);
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
  return "";
}

function writeSecretToEnvFile(filePath, secret) {
  const abs = resolve(filePath);
  const line = `NEXTAUTH_SECRET="${secret}"`;
  if (!existsSync(abs)) {
    writeFileSync(abs, `${line}\n`, "utf8");
    return "created";
  }
  const text = readFileSync(abs, "utf8");
  const re = /^(export\s+)?NEXTAUTH_SECRET\s*=.*/m;
  if (re.test(text)) {
    writeFileSync(abs, text.replace(re, line), "utf8");
    return "updated";
  }
  const suffix = text.endsWith("\n") || text.length === 0 ? "" : "\n";
  writeFileSync(abs, `${text}${suffix}${line}\n`, "utf8");
  return "appended";
}

const args = process.argv.slice(2);
const validateOnly = args.includes("--validate");
const writeIdx = args.indexOf("--write");
const writeTarget = writeIdx >= 0 ? args[writeIdx + 1] : null;

if (validateOnly) {
  const fromEnv = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "";
  const fromFile =
    writeTarget && !fromEnv ? readEnvSecretFromFile(writeTarget) : fromEnv || readEnvSecretFromFile(".env.local") || readEnvSecretFromFile(".env");
  const check = validateSecret(fromFile);
  if (check.ok) {
    console.log(`OK — NEXTAUTH_SECRET valide (${check.secret.length} caractères).`);
    process.exit(0);
  }
  console.error("NEXTAUTH_SECRET invalide :");
  for (const err of check.errors) console.error(`  - ${err}`);
  process.exit(1);
}

const secret = generateSecret();
const check = validateSecret(secret);
console.log("Secret généré (32 octets aléatoires, encodage base64url) :\n");
console.log(secret);
console.log(`\nLongueur : ${secret.length} caractères — validation : ${check.ok ? "OK" : "ÉCHEC"}`);

if (writeTarget) {
  const action = writeSecretToEnvFile(writeTarget, secret);
  console.log(`\n→ ${action === "created" ? "Créé" : action === "updated" ? "Mis à jour" : "Ajouté dans"} ${resolve(writeTarget)}`);
  console.log("Ne commitez pas ce fichier (.env / .env.local restent hors git).");
} else {
  console.log("\nCopiez dans .env.local :");
  console.log(`NEXTAUTH_SECRET="${secret}"`);
  console.log("\nOu : npm run generate:nextauth-secret -- --write .env.local");
}
