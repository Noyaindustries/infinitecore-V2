import { appEnv } from "@/config/env";
import { getSmtpTransport } from "@/server/smtpTransport";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendLeadEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const to = String(input.to || "").trim().toLowerCase();
  if (!isValidEmail(to)) return { sent: false, reason: "Email destinataire invalide." };

  const subject = String(input.subject || "Message de l’équipe Infinite Core").trim().slice(0, 140);
  const text = String(input.text || "").trim();
  if (!text) return { sent: false, reason: "Message vide." };

  const transporter = getSmtpTransport();
  if (!transporter) return { sent: false, reason: "SMTP non configuré." };

  const html =
    input.html ??
    `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`;

  await transporter.sendMail({
    from: appEnv.smtp.fromOrUser,
    to,
    subject,
    text,
    html,
  });

  return { sent: true };
}

