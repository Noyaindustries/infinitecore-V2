/**
 * Diagnostic PADDE-CI (prod ou local) : config API + test POST webhook.
 *
 * Usage (Node 20+) :
 *   node --env-file=.env scripts/diagnosePadde.mjs
 *   node --env-file=.env scripts/diagnosePadde.mjs --api https://www.infinitecore.net
 *   node scripts/diagnosePadde.mjs --api https://www.infinitecore.net --netlify https://xxx.netlify.app
 */

function stripSlash(u) {
  return String(u || "").trim().replace(/\/$/, "");
}

function parseArgs(argv) {
  let apiBase = stripSlash(process.env.PADDE_DIAG_API || "");
  let netlifyBase = stripSlash(process.env.PADDE_DIAG_NETLIFY || "");
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api" && args[i + 1]) apiBase = stripSlash(args[++i]);
    if (args[i] === "--netlify" && args[i + 1]) netlifyBase = stripSlash(args[++i]);
  }
  if (!apiBase) {
    const port = String(process.env.PORT || "3000").trim() || "3000";
    apiBase = `http://localhost:${port}`;
  }
  return { apiBase, netlifyBase };
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...init.headers } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text.slice(0, 400) };
  }
  return { res, json };
}

const { apiBase, netlifyBase } = parseArgs(process.argv);
const secret = String(process.env.PADDE_WEBHOOK_SECRET || "").trim();

console.log("=== PADDE-CI diagnostic ===\n");

// 1) Config check (API directe)
const checkUrl = `${apiBase}/api/webhooks/padde-ci/config-check`;
console.log("1) GET", checkUrl);
try {
  const { res, json } = await fetchJson(checkUrl);
  console.log("   HTTP", res.status, JSON.stringify(json, null, 2).replace(/\n/g, "\n   "));
  if (json.webhookSecretConfigured && !secret) {
    console.log(
      "\n   ⚠️  L’API attend un secret mais PADDE_WEBHOOK_SECRET est vide dans votre .env : tout POST de test sera 401.\n"
    );
  }
  if (!json.webhookSecretConfigured && secret) {
    console.log(
      "\n   ⚠️  Votre .env envoie un secret alors que l’API indique qu’aucun secret n’est configuré (ou déploiement différent).\n"
    );
  }
} catch (e) {
  console.error("   Échec :", e instanceof Error ? e.message : e);
}

// 2) POST webhook direct API
const postUrl = `${apiBase}/api/webhooks/padde-ci`;
const minimalPayload = {
  type: "audit-rapide",
  entreprise: `diag ${new Date().toISOString()}`,
  email: `diag-${Date.now()}@example.com`,
  date: new Date().toISOString(),
};
const headers = { "Content-Type": "application/json" };
if (secret) headers["X-Webhook-Secret"] = secret;

console.log("\n2) POST", postUrl, secret ? "(avec X-Webhook-Secret)" : "(sans secret)");
try {
  const { res, json } = await fetchJson(postUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(minimalPayload),
  });
  console.log("   HTTP", res.status, JSON.stringify(json, null, 2).replace(/\n/g, "\n   "));
  if (res.status === 401) {
    console.log(
      "\n   → 401 : alignez PADDE_WEBHOOK_SECRET (fichier .env) avec la variable **du même nom** sur Vercel (Production + Preview si besoin), puis redeploy.\n"
    );
  }
} catch (e) {
  console.error("   Échec :", e instanceof Error ? e.message : e);
}

// 3) Netlify (optionnel)
if (netlifyBase) {
  const relayUrl = `${netlifyBase}/api/webhooks/padde-ci`;
  console.log("\n3) POST relais Netlify", relayUrl, secret ? "(avec X-Webhook-Secret)" : "(sans secret)");
  try {
    const { res, json } = await fetchJson(relayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(minimalPayload),
    });
    console.log("   HTTP", res.status, JSON.stringify(json, null, 2).replace(/\n/g, "\n   "));
    if (res.status === 503 && json.error && String(json.error).includes("boucle")) {
      console.log("\n   → Corrigez INFINITE_CORE_API_URL sur Netlify : doit être l’URL **Vercel**, pas le site Netlify.\n");
    }
  } catch (e) {
    console.error("   Échec :", e instanceof Error ? e.message : e);
  }
} else {
  console.log("\n3) (skip) Passez --netlify https://votre-site.netlify.app pour tester le relais.\n");
}

console.log("\n=== Fin ===\n");
