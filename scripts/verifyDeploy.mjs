/**
 * Vérifie le front (Vercel / Next) et, en option, l’API Express sur n’importe quel hôte.
 * Aucune hypothèse sur Render : l’URL de l’API vient de VERIFY_API_URL, de --api, ou de deux arguments positionnels.
 *
 * Usage :
 *   npm run verify:deploy
 *      → teste surtout le front (défaut https://infinitecore.net) et `/api` sur la même origine (401 attendu si tout va bien).
 *
 *   VERIFY_API_URL=https://api.tondomaine.com npm run verify:deploy
 *   node scripts/verifyDeploy.mjs --api https://api.tondomaine.com
 *   node scripts/verifyDeploy.mjs --api https://api.example.com --front https://ton-front.vercel.app
 *
 *   node scripts/verifyDeploy.mjs https://api.example.com https://ton-front.vercel.app
 *      → forme historique : [base API] [base front]
 */

function stripSlash(u) {
  return String(u || "").trim().replace(/\/$/, "");
}

function parseArgs(argv) {
  let apiBase = stripSlash(process.env.VERIFY_API_URL);
  let frontBase = stripSlash(process.env.VERIFY_FRONT_URL) || "https://infinitecore.net";

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api" && args[i + 1]) {
      apiBase = stripSlash(args[++i]);
    } else if (args[i] === "--front" && args[i + 1]) {
      frontBase = stripSlash(args[++i]);
    }
  }

  const httpOnly = args.filter((a) => a.startsWith("http"));
  if (httpOnly.length === 2 && !process.env.VERIFY_API_URL && !args.includes("--api")) {
    apiBase = stripSlash(httpOnly[0]);
    frontBase = stripSlash(httpOnly[1]);
  } else if (httpOnly.length === 1 && !args.includes("--api") && !args.includes("--front")) {
    frontBase = stripSlash(httpOnly[0]);
  }

  return { apiBase: apiBase || null, frontBase };
}

const { apiBase, frontBase } = parseArgs(process.argv);

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

let exitCode = 0;

if (apiBase) {
  console.log("--- API Express (URL directe : VERIFY_API_URL, --api, ou 1er argument positionnel) ---\n");
  const h = await probe("GET /health", `${apiBase}/health`, { okStatuses: [200] });
  const meDirect = await probe(
    "GET /api/auth/me (sans cookie → 401 JSON si l’API tourne)",
    `${apiBase}/api/auth/me`,
    { okStatuses: [401] }
  );
  if (!h || !meDirect) {
    console.log(
      "\n→ L’API directe ne répond pas comme prévu : vérifie l’hébergeur (processus `node dist/server.cjs`, `DATABASE_URL`, logs)."
    );
    exitCode = 1;
  }
  console.log("");
} else {
  console.log(
    "--- API Express (test direct ignoré : définis VERIFY_API_URL ou `node scripts/verifyDeploy.mjs --api https://…`) ---\n(skippé)\n"
  );
}

console.log("--- Front Next.js + /api (Vercel : variables Prisma/JWT sur le projet ; local : npm run dev) ---\n");
const home = await probe("GET / (page d’accueil)", `${frontBase}/`, { okStatuses: [200] });
const meProxy = await probe(
  "GET /api/auth/me sur le front (sans cookie → 401 JSON si l’API est joignable)",
  `${frontBase}/api/auth/me`,
  { okStatuses: [401] }
);

if (!home) {
  console.log("\n→ Le front ne répond pas en 200 sur /. Vérifie Vercel / le domaine.");
  exitCode = 1;
} else if (!meProxy) {
  console.log(
    "\n→ Le front répond mais `/api` échoue. **Vercel** : vérifiez **DATABASE_URL**, **NEXTAUTH_SECRET**, **NEXTAUTH_URL**, **CORS_ORIGIN** (Production **et** Preview), consultez les logs de la fonction `pages/api`, puis redeploy. **Local** : `npm run dev` (Next + API unifiés)."
  );
  exitCode = 1;
} else if (exitCode === 0) {
  console.log("\n→ Vérifications OK pour le front (et pour l’API directe si tu l’as configurée).");
}

process.exitCode = exitCode;
