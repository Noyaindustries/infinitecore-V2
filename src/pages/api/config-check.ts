import type { NextApiRequest, NextApiResponse } from "next";
import { runProductionConfigCheck } from "@/lib/runProductionConfigCheck";

/** Diagnostic prod : variables présentes + validation démarrage (sans secrets). */
export default async function configCheck(_req: NextApiRequest, res: NextApiResponse) {
  const result = runProductionConfigCheck();
  return res.status(result.startupOk ? 200 : 503).json({
    ok: result.startupOk,
    code: result.startupOk ? "CONFIG_OK" : "CONFIG_INVALID",
    config: result.config,
    errors: result.errors.length ? result.errors : undefined,
    warnings: result.warnings.length ? result.warnings : undefined,
  });
}
