import nodemailer, { type Transporter } from "nodemailer";
import { appEnv } from "@/config/env";

let smtpTransport: Transporter | null = null;

/** Transport SMTP réutilisé (auth, alertes staff) — null si SMTP non configuré. */
export function getSmtpTransport(): Transporter | null {
  if (smtpTransport) return smtpTransport;
  const host = appEnv.smtp.host;
  const port = appEnv.smtp.port;
  const user = appEnv.smtp.user;
  const pass = appEnv.smtp.pass;
  if (!host || !Number.isFinite(port) || !user || !pass) return null;
  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure: appEnv.smtp.secure,
    auth: { user, pass },
  });
  return smtpTransport;
}
