import nodemailer, { type Transporter } from "nodemailer";
import { appEnv } from "@/config/env";

let smtpTransport: Transporter | null = null;

/** Retire guillemets copiés-collés et espaces (mots de passe d’application Gmail). */
export function normalizeSmtpPass(raw: string): string {
  let v = String(raw || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v.replace(/\s+/g, "");
}

export type SmtpEnvDiagnostic = {
  hostSet: boolean;
  port: number;
  secure: boolean;
  userSet: boolean;
  passSet: boolean;
  passLength: number;
  configured: boolean;
};

export function getSmtpEnvDiagnostic(): SmtpEnvDiagnostic {
  const host = appEnv.smtp.host;
  const port = appEnv.smtp.port;
  const user = appEnv.smtp.user;
  const pass = normalizeSmtpPass(appEnv.smtp.pass);
  return {
    hostSet: Boolean(host),
    port,
    secure: appEnv.smtp.secure,
    userSet: Boolean(user),
    passSet: Boolean(pass),
    passLength: pass.length,
    configured: Boolean(host && Number.isFinite(port) && user && pass),
  };
}

/** Transport SMTP réutilisé (auth, alertes staff) — null si SMTP non configuré. */
export function isSmtpConfigured(): boolean {
  return getSmtpEnvDiagnostic().configured;
}

export function getSmtpTransport(): Transporter | null {
  if (smtpTransport) return smtpTransport;
  const diag = getSmtpEnvDiagnostic();
  if (!diag.configured) return null;
  smtpTransport = nodemailer.createTransport({
    host: appEnv.smtp.host,
    port: diag.port,
    secure: diag.secure,
    auth: { user: appEnv.smtp.user, pass: normalizeSmtpPass(appEnv.smtp.pass) },
  });
  return smtpTransport;
}

export type SmtpVerifyResult =
  | { ok: true }
  | { ok: false; code: "not_configured" | "verify_failed"; message: string; smtpCode?: string; smtpResponseCode?: number };

/** Teste la connexion SMTP (sans envoyer d’e-mail). */
export async function verifySmtpConnection(): Promise<SmtpVerifyResult> {
  const transporter = getSmtpTransport();
  if (!transporter) {
    const d = getSmtpEnvDiagnostic();
    const missing: string[] = [];
    if (!d.hostSet) missing.push("SMTP_HOST");
    if (!d.userSet) missing.push("SMTP_USER");
    if (!d.passSet) missing.push("SMTP_PASS");
    return {
      ok: false,
      code: "not_configured",
      message:
        missing.length > 0
          ? `Variable(s) manquante(s) ou vide(s) : ${missing.join(", ")}.`
          : "Configuration SMTP incomplète.",
    };
  }
  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const responseCode = (error as { responseCode?: number }).responseCode;
    const code = (error as { code?: string }).code;
    const hint = /invalid login|535|authentication failed|EAUTH/i.test(`${raw} ${code}`)
      ? "Authentification refusée (Gmail 535) : SMTP_PASS invalide ou expiré. Régénérez un mot de passe d’application Google et mettez à jour Vercel + .env.local."
      : /timeout|ETIMEDOUT|ECONNECTION/i.test(raw)
        ? "Connexion impossible : vérifiez SMTP_HOST, SMTP_PORT et SMTP_SECURE (465 + true pour Gmail)."
        : raw;
    return {
      ok: false,
      code: "verify_failed",
      message: hint,
      smtpCode: code,
      smtpResponseCode: responseCode,
    };
  }
}

export function smtpDeliveryErrorMessage(reason: "not_configured" | "send_failed"): string {
  if (reason === "send_failed") {
    return (
      "L’envoi du code par email a échoué. Les variables SMTP sont présentes mais le serveur mail les refuse. " +
      "Vérifiez SMTP_PASS (mot de passe d’application Gmail, sans espaces ni guillemets), SMTP_USER, puis testez /api/smtp-check."
    );
  }
  return (
    "Service email indisponible : variables SMTP absentes ou vides sur ce déploiement. " +
    "Vérifiez SMTP_HOST, SMTP_USER et SMTP_PASS dans Vercel → Environment Variables → Production, puis redéployez."
  );
}
