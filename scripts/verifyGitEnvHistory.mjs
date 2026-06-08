#!/usr/bin/env node
/**
 * Vérifie qu’aucun fichier `.env` contenant des secrets n’est suivi ou présent dans l’historique Git.
 *
 * Usage : node scripts/verifyGitEnvHistory.mjs
 */
import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const FORBIDDEN_TRACKED = [
  /^\.env$/,
  /^\.env\.local$/,
  /^\.env\.production(\.local)?$/,
  /^\.env\.development(\.local)?$/,
  /^\.env\.test(\.local)?$/,
];

const ALLOWED_TRACKED = new Set([".env.example", ".env.vercel.example", ".env.netlify.example"]);

const errors = [];

let tracked = [];
try {
  tracked = run("git ls-files").split(/\r?\n/).filter(Boolean);
} catch {
  console.error("Échec : pas un dépôt Git ou git indisponible.");
  process.exit(1);
}

for (const file of tracked) {
  if (ALLOWED_TRACKED.has(file)) continue;
  if (FORBIDDEN_TRACKED.some((re) => re.test(file))) {
    errors.push(`Fichier secret suivi par Git : ${file}`);
  }
}

const historyTargets = [".env", ".env.local", ".env.production", ".env.development", ".env.production.local"];
for (const target of historyTargets) {
  try {
    const log = run(`git log --all --oneline -- "${target}"`);
    if (log) {
      errors.push(`Historique Git non vide pour ${target} (${log.split("\n").length} commit(s)).`);
    }
  } catch {
    /* pas d’historique */
  }
}

if (errors.length) {
  console.error("verify:git-env — ÉCHEC\n");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log("verify:git-env — OK (aucun .env secret suivi ni historisé).");
console.log(`Fichiers d’exemple autorisés : ${[...ALLOWED_TRACKED].join(", ")}`);
