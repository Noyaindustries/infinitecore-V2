/**
 * Sonde post-déploiement : config prod, SMTP, webhook PADDE-CI.
 * Usage :
 *   npm run verify:prod
 *   VERIFY_FRONT_URL=https://www.infinitecore.net npm run verify:prod
 */

function stripSlash(u) {
  return String(u || "").trim().replace(/\/$/, "");
}

const base = stripSlash(process.env.VERIFY_FRONT_URL || "https://www.infinitecore.net");

async function fetchJson(path) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    return { url, status: res.status, body, ok: res.ok };
  } catch (e) {
    return {
      url,
      status: 0,
      body: { error: e instanceof Error ? e.message : String(e) },
      ok: false,
    };
  }
}

function logResult(label, result) {
  const mark = result.ok ? "OK " : "ERR";
  console.log(`${mark} [${result.status}] ${label}`);
  console.log(`     ${result.url}`);
}

let exitCode = 0;

console.log(`--- Santé production (${base}) ---\n`);

const config = await fetchJson("/api/config-check");
logResult("config-check", config);
if (config.status !== 200 || config.body?.startupOk !== true) {
  console.log("     → startupOk doit être true (JWT, CORS, secrets).");
  exitCode = 1;
} else if (config.body?.config?.smtpConfigured !== true) {
  console.log("     → smtpConfigured: false — login par mot de passe / emails en échec.");
  exitCode = 1;
}

const smtp = await fetchJson("/api/smtp-check");
logResult("smtp-check", smtp);
if (smtp.status !== 200 || smtp.body?.ok !== true) {
  const msg = smtp.body?.verify?.message || smtp.body?.raw || "SMTP non opérationnel";
  console.log(`     → ${String(msg).slice(0, 200)}`);
  exitCode = 1;
}

const padde = await fetchJson("/api/webhooks/padde-ci/config-check");
logResult("padde-ci config-check", padde);
if (padde.status !== 200 || padde.body?.databaseConfigured !== true) {
  console.log("     → databaseConfigured doit être true pour enregistrer les formulaires PADDE.");
  exitCode = 1;
}
if (padde.body?.webhookSecretConfigured !== true) {
  console.log("     → webhookSecretConfigured: false — risque 401 sur les webhooks.");
  exitCode = 1;
}

const me = await fetchJson("/api/auth/me");
const meOk = me.status === 401;
console.log(`${meOk ? "OK " : "ERR"} [${me.status}] auth/me sans cookie (401 attendu)`);
console.log(`     ${me.url}`);
if (!meOk) exitCode = 1;

console.log(exitCode === 0 ? "\n→ Vérifications prod OK." : "\n→ Au moins une sonde prod a échoué.");
process.exitCode = exitCode;
