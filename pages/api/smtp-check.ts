import type { NextApiRequest, NextApiResponse } from "next";
import { getSmtpEnvDiagnostic, verifySmtpConnection } from "../../src/server/smtpTransport";
import { assertDiagnosticAccess } from "../../src/server/diagnosticAccess";

/**
 * Diagnostic SMTP prod (sans secrets). Protégé en production via DIAGNOSTIC_ACCESS_SECRET.
 */
export default async function smtpCheck(req: NextApiRequest, res: NextApiResponse) {
  const access = assertDiagnosticAccess(req);
  if (!access.ok) {
    return res.status(access.status).json({ ok: false, error: access.error });
  }

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
