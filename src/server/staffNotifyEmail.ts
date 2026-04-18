import { appEnv } from "@/config/env";
import { prisma } from "../../prismaClient";
import { getSmtpTransport } from "@/server/smtpTransport";

function parseExtraStaffEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of raw.split(/[,;\n\r]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    for (const part of chunk.split(/\s+/).map((s) => s.trim()).filter(Boolean)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) continue;
      if (seen.has(part)) continue;
      seen.add(part);
      out.push(part);
    }
  }
  return out;
}

/** Destinataires = comptes `user_accounts` admin/commando + liste optionnelle `STAFF_NOTIFY_EMAILS`. */
export async function resolveStaffNotifyEmails(): Promise<string[]> {
  const extra = parseExtraStaffEmails(appEnv.notifications.staffNotifyEmails);
  const accounts = await prisma.userAccount.findMany({
    where: { role: { in: ["admin", "commando"] } },
    select: { email: true },
  });
  const fromDb = accounts
    .map((a) => String(a.email || "").trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const e of [...fromDb, ...extra]) {
    if (seen.has(e)) continue;
    seen.add(e);
    merged.push(e);
  }
  return merged;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Envoie un e-mail transactionnel à l’équipe (admin + commando + `STAFF_NOTIFY_EMAILS`).
 * Sans effet si SMTP ou aucun destinataire (log `console.warn`).
 */
export async function sendStaffNotifyEmail(input: {
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; recipientCount: number }> {
  const recipients = await resolveStaffNotifyEmails();
  if (recipients.length === 0) {
    console.warn("[staff-notify-email] aucun destinataire (pas d’admin/commando en base ni STAFF_NOTIFY_EMAILS).");
    return { sent: false, recipientCount: 0 };
  }
  const transporter = getSmtpTransport();
  if (!transporter) {
    console.warn("[staff-notify-email] SMTP non configuré — e-mail non envoyé.");
    return { sent: false, recipientCount: recipients.length };
  }

  const [primary, ...bccRest] = recipients;
  const html =
    input.html ??
    `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(input.text)}</pre>`;

  await transporter.sendMail({
    from: appEnv.smtp.fromOrUser,
    to: primary,
    ...(bccRest.length > 0 ? { bcc: bccRest } : {}),
    subject: input.subject,
    text: input.text,
    html,
  });
  return { sent: true, recipientCount: recipients.length };
}
