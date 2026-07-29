import type { IncomingMessage } from "http";
import { secureSecretEquals } from "@/server/webhookHmac";
import { appEnv } from "@/config/env";

export type DiagnosticAccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 404; error: string };

/**
 * Endpoints de diagnostic (config-check, smtp-check) :
 * - hors prod : ouverts
 * - en prod : exigent DIAGNOSTIC_ACCESS_SECRET (header X-Diagnostic-Secret ou ?key=)
 *   Si le secret n’est pas configuré → 404 (ne pas annoncer l’endpoint).
 */
export function assertDiagnosticAccess(
  req: IncomingMessage & { query?: Record<string, unknown> }
): DiagnosticAccessResult {
  if (!appEnv.node.isProduction) return { ok: true };

  const expected = String(process.env.DIAGNOSTIC_ACCESS_SECRET || "").trim();
  if (!expected) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const headerRaw = req.headers["x-diagnostic-secret"];
  const header = Array.isArray(headerRaw) ? String(headerRaw[0] || "") : String(headerRaw || "");
  const queryKey = req.query && "key" in req.query ? String(req.query.key ?? "") : "";
  const provided = header.trim() || queryKey.trim();

  if (!provided || !secureSecretEquals(expected, provided)) {
    return { ok: false, status: 401, error: "Non autorisé." };
  }
  return { ok: true };
}
