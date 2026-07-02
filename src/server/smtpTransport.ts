import nodemailer, { type Transporter } from "nodemailer";
import { appEnv } from "@/config/env";

let smtpTransport: Transporter | null = null;

/** Transport SMTP réutilisé (auth, alertes staff) — null si SMTP non configuré. */
export function isSmtpConfigured(): boolean {
  const host = appEnv.smtp.host;
  const port = appEnv.smtp.port;
  const user = appEnv.smtp.user;
  const pass = appEnv.smtp.pass;
  return Boolean(host && Number.isFinite(port) && user && pass);
}

export function getSmtpTransport(): Transporter | null {
  if (smtpTransport) return smtpTransport;
  if (!isSmtpConfigured()) return null;
  smtpTransport = nodemailer.createTransport({
    host: appEnv.smtp.host,
    port: appEnv.smtp.port,
    secure: appEnv.smtp.secure,
    auth: { user: appEnv.smtp.user, pass: appEnv.smtp.pass },
  });
  return smtpTransport;
}
