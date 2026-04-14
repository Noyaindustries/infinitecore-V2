/**
 * Vérifie que l’API Render et le proxy Vercel répondent comme attendu.
 * Usage :
 *   node scripts/verifyDeploy.mjs
 *   node scripts/verifyDeploy.mjs https://autre-api.onrender.com https://autre-front.vercel.app
 */

const renderBase = (process.argv[2] || "https://infinitecore-api.onrender.com").replace(/\/$/, "");
const vercelBase = (process.argv[3] || "https://infinitecore.net").replace(/\/$/, "");

async function probe(label, url, { okStatuses } = { okStatuses: [200] }) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    const text = await res.text();
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    const ok = okStatuses.includes(res.status);
    console.log(`${ok ? "OK " : "ERR"} [${res.status}] ${label}`);
    console.log(`     ${url}`);
    if (snippet) console.log(`     ${snippet}`);
    const xr = res.headers.get("x-render-routing");
    if (xr) console.log(`     x-render-routing: ${xr}`);
    return ok;
  } catch (e) {
    console.log(`ERR [fetch] ${label}`);
    console.log(`     ${url}`);
    console.log(`     ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

console.log("--- API Render (doit être joignable en premier) ---\n");
const h = await probe("GET /health", `${renderBase}/health`, { okStatuses: [200] });

const meDirect = await probe(
  "GET /api/auth/me (sans cookie → 401 JSON si l’API tourne)",
  `${renderBase}/api/auth/me`,
  { okStatuses: [401] }
);

console.log("\n--- Front Vercel (proxy /api → Render via API_UPSTREAM) ---\n");
const meProxy = await probe(
  "GET /api/auth/me via Vercel (sans cookie → 401 JSON si proxy + API OK)",
  `${vercelBase}/api/auth/me`,
  { okStatuses: [401] }
);

if (!h || !meDirect) {
  console.log(
    "\n→ Corrige d’abord **Render** : service Live, build `npm ci && npm run build:api`, start `node dist/server.cjs`, `DATABASE_URL`, logs sans crash."
  );
  process.exitCode = 1;
} else if (!meProxy) {
  console.log(
    "\n→ Render est OK. Sur **Vercel**, définis `API_UPSTREAM` = URL Render (sans slash final), redéploie. Si 503 JSON : variable absente ; si Not Found : upstream encore faux ou cache."
  );
  process.exitCode = 1;
} else {
  console.log("\n→ Déploiement cohérent : API joignable et proxy Vercel fonctionnel.");
}
