/**
 * Affiche un exemple d’appel `fetch` à coller sur le site Noya (après soumission du formulaire).
 * Le secret ne doit jamais être exposé côté navigateur : utilisez un proxy serveur (même domaine
 * ou fonction serverless) qui ajoute X-Webhook-Secret, ou un relais signé.
 *
 * Usage :
 *   node scripts/noyaRecrutementSiteExample.mjs
 *   node scripts/noyaRecrutementSiteExample.mjs --api https://www.infinitecore.net
 */

const apiBase = stripSlash(
  parseArg(process.argv, "--api") ||
    process.env.API_PUBLIC_URL ||
    process.env.NEXTAUTH_URL ||
    "https://www.infinitecore.net"
);

function stripSlash(u) {
  return String(u || "").trim().replace(/\/$/, "");
}

function parseArg(argv, flag) {
  const i = argv.indexOf(flag);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  return "";
}

const url = `${apiBase}/api/webhooks/noya-recrutement`;

const snippet = `
// Exemple côté navigateur — sans secret (à n'utiliser qu'en dev si l'API accepte webhook sans secret).
// En production : appelez votre propre endpoint qui relaie vers Infinite Core avec le header secret.

async function envoyerVersInfiniteCore(payload) {
  const res = await fetch("${url}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prenom: payload.prenom,
      nom: payload.nom,
      email_professionnel: payload.email,
      telephone: payload.telephone || "",
      parcours: payload.parcours || "partenaire",
      entreprise: payload.entreprise || "",
      proposition: payload.message || "",
    }),
  });
  return res.json();
}
`.trim();

console.log("URL API :", url);
console.log("\n--- Copier sous le site Noya (adapter les noms de champs) ---\n");
console.log(snippet);
