/**
 * Contournement pour tester le webhook PADDE-CI sans padde-ci.com ni navigateur admin.
 *
 * Prérequis :
 *   1) API qui tourne (ex. `npm run dev` sur le port par défaut 3000).
 *   2) `DATABASE_URL` chargée (même base que l’API).
 *   3) Si `PADDE_WEBHOOK_SECRET` est défini sur l’API, le même secret doit être envoyé (variable d’env ci-dessous).
 *
 * Usage (Node 20+) :
 *   npm run dev
 *   node --env-file=.env scripts/testPaddeWebhook.mjs
 *
 * URL distante : remplace par **ton** hôte API réel (Vercel, Railway, etc.), pas un domaine fictif :
 *   node --env-file=.env scripts/testPaddeWebhook.mjs --url https://xxx.vercel.app/api/webhooks/padde-ci
 *
 * Secret optionnel pour ce script uniquement (identique à l’API) :
 *   set PADDE_WEBHOOK_SECRET=xxx   (PowerShell : $env:PADDE_WEBHOOK_SECRET="xxx")
 */

function stripSlash(u) {
  return String(u || "").trim().replace(/\/$/, "");
}

/** Détail cause TLS / DNS / refus de connexion (Node affiche souvent seulement « fetch failed »). */
function explainFetchError(err) {
  if (!(err instanceof Error)) return String(err);
  const bits = [err.message];
  const c = err.cause;
  if (c && typeof c === "object") {
    const o = /** @type {Record<string, unknown>} */ (c);
    if (typeof o.code === "string") bits.push(`code=${o.code}`);
    if (typeof o.hostname === "string") bits.push(`hostname=${o.hostname}`);
    if (typeof o.address === "string" && o.port != null) bits.push(`${o.address}:${String(o.port)}`);
  }
  return bits.join(" — ");
}

function parseArgs(argv) {
  let url = stripSlash(process.env.PADDE_WEBHOOK_TEST_URL || "");
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      url = stripSlash(args[++i]);
    }
  }
  if (!url) {
    // Aligné sur `devUnified.ts` : `main.listen(port, "localhost", …)` — utiliser `localhost`
    // évite des ECONNREFUSED IPv4 vs IPv6 selon la machine.
    const port = String(process.env.PORT || "3000").trim() || "3000";
    url = `http://localhost:${port}/api/webhooks/padde-ci`;
  }
  return url;
}

const target = parseArgs(process.argv);
const secret = String(process.env.PADDE_WEBHOOK_SECRET || "").trim();

const payload = {
  type: "audit-rapide",
  entreprise: `Test script ${new Date().toISOString()}`,
  descriptionEntreprise: "Envoi automatique scripts/testPaddeWebhook.mjs",
  secteur: "Commerce",
  localisation: "Local",
  reseau: "Facebook",
  lienReseau: "https://example.com/r",
  site: "Oui",
  lienSite: "https://example.com",
  googleMaps: "",
  email: `padde-script-${Date.now()}@example.com`,
  defi: "Vérification webhook",
  whatsapp: "+22501000000",
  responsable: "Script test",
  date: new Date().toISOString(),
};

const headers = { "Content-Type": "application/json" };
if (secret) headers["X-Webhook-Secret"] = secret;

console.log("POST", target);
if (secret) console.log("(header X-Webhook-Secret présent)");
if (/example\.(com|net|org)\b/i.test(target)) {
  console.warn(
    "Attention : l’URL contient « example.com » — domaine de démo. Utilise ton URL réelle ou `http://localhost:3000` sans --url."
  );
}

let res;
try {
  res = await fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
} catch (err) {
  console.error("Échec réseau :", explainFetchError(err));
  console.error(
    "Rien n’écoute sur cette URL : ouvre un **autre** terminal, lance `npm run dev`, attends le message « Next + API → http://localhost:… », puis relance ce script (sans fermer le dev)."
  );
  process.exit(1);
}

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text.slice(0, 500) };
}

console.log("HTTP", res.status);
console.log(JSON.stringify(json, null, 2));

if (res.status === 401) {
  console.error(
    "\n401 Webhook non autorisé : la valeur de PADDE_WEBHOOK_SECRET (fichier .env / --env-file) doit être **identique** à celle définie sur l’hôte cible (ex. Vercel). Si tu passes par Netlify, le même secret doit aussi figurer dans les variables Netlify.\n"
  );
}

if (!res.ok) {
  process.exitCode = 1;
} else if (json && json.success !== true) {
  process.exitCode = 1;
}
