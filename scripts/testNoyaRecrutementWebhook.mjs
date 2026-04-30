/**
 * Test du webhook Noya recrutement → Infinite Core (leads + notifications admin/commando).
 *
 * Prérequis :
 *   1) API qui tourne (ex. `npm run dev`).
 *   2) `DATABASE_URL` + `NOYA_RECRUTEMENT_WEBHOOK_SECRET` identiques à l’API cible.
 *
 * Usage (Node 20+) :
 *   npm run dev
 *   node --env-file=.env.local scripts/testNoyaRecrutementWebhook.mjs
 *
 * URL distante :
 *   node --env-file=.env.local scripts/testNoyaRecrutementWebhook.mjs --url https://www.infinitecore.net/api/webhooks/noya-recrutement
 */

function stripSlash(u) {
  return String(u || "").trim().replace(/\/$/, "");
}

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
  let url = stripSlash(process.env.NOYA_RECRUTEMENT_WEBHOOK_TEST_URL || "");
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      url = stripSlash(args[++i]);
    }
  }
  if (!url) {
    const port = String(process.env.PORT || "3000").trim() || "3000";
    url = `http://localhost:${port}/api/webhooks/noya-recrutement`;
  }
  return url;
}

const target = parseArgs(process.argv);
const secret = String(process.env.NOYA_RECRUTEMENT_WEBHOOK_SECRET || "").trim();

const payload = {
  prenom: "Test",
  nom: `Script ${Date.now()}`,
  email_professionnel: `noya-script-${Date.now()}@example.com`,
  telephone: "+22501000000",
  parcours: "partenaire",
  entreprise: "Société test webhook",
  proposition: "Envoi automatique scripts/testNoyaRecrutementWebhook.mjs",
};

const headers = { "Content-Type": "application/json" };
if (secret) headers["X-Webhook-Secret"] = secret;

console.log("POST", target);
if (secret) console.log("(header X-Webhook-Secret présent)");

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
    "Lance `npm run dev` dans un autre terminal, puis relance ce script (sans fermer le dev)."
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
    "\n401 : NOYA_RECRUTEMENT_WEBHOOK_SECRET doit être identique sur l’API et dans le fichier passé à --env-file (ou Vercel).\n"
  );
}

if (!res.ok) {
  process.exitCode = 1;
} else if (json && json.success !== true) {
  process.exitCode = 1;
}
