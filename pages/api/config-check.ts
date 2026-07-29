import type { NextApiRequest, NextApiResponse } from "next";
import { runProductionConfigCheck } from "../../src/lib/runProductionConfigCheck";
import { assertDiagnosticAccess } from "../../src/server/diagnosticAccess";

/** Diagnostic prod : variables présentes + validation démarrage (sans secrets). Protégé en production. */
export default async function configCheck(req: NextApiRequest, res: NextApiResponse) {
  const access = assertDiagnosticAccess(req);
  if (!access.ok) {
    return res.status(access.status).json({ ok: false, error: access.error });
  }

  const result = runProductionConfigCheck();
  return res.status(result.startupOk ? 200 : 503).json({
    ok: result.startupOk,
    code: result.startupOk ? "CONFIG_OK" : "CONFIG_INVALID",
    config: result.config,
    errors: result.errors.length ? result.errors : undefined,
    warnings: result.warnings.length ? result.warnings : undefined,
  });
}
