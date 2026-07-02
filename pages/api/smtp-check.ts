import type { NextApiRequest, NextApiResponse } from "next";
import { getSmtpEnvDiagnostic, verifySmtpConnection } from "../../src/server/smtpTransport";

/**
 * Diagnostic SMTP prod (sans secrets) : variables présentes + test connexion Gmail/SMTP.
 * GET https://www.infinitecore.net/api/smtp-check
 */
export default async function smtpCheck(_req: NextApiRequest, res: NextApiResponse) {
  const env = getSmtpEnvDiagnostic();
  const verify = await verifySmtpConnection();
  return res.status(verify.ok ? 200 : 503).json({
    ok: verify.ok,
    code: verify.ok ? "SMTP_OK" : verify.code === "not_configured" ? "SMTP_NOT_CONFIGURED" : "SMTP_VERIFY_FAILED",
    env,
    verify: verify.ok
      ? { ok: true }
      : {
          ok: false,
          message: verify.message,
          smtpCode: verify.smtpCode,
          smtpResponseCode: verify.smtpResponseCode,
        },
  });
}
