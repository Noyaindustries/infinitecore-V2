/**
 * Vercel (et `next start` sans dev unifié) : monte l’app Express sous `/api/*` et `/health`
 * via serverless-http. En dev unifié (`npm run dev`), Express est servi avant Next — ce handler n’est pas utilisé.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { Express } from "express";
import { agentSessionLog } from "@/debug/agentSessionLog";

let cachedExpressApp: Express | null = null;

async function getExpressApp(): Promise<Express> {
  if (cachedExpressApp) return cachedExpressApp;
  const { createExpressApplication } = await import("../../../server");
  const { app } = await createExpressApplication();
  cachedExpressApp = app as Express;
  return cachedExpressApp;
}

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: false,
    externalResolver: true,
    responseLimit: false,
  },
};

/** Voir `pages/api/[[...path]].ts` (même logique). */
function rewriteReqUrlForExpress(req: NextApiRequest): void {
  const q = req.query.path;
  const segments = q === undefined ? [] : Array.isArray(q) ? q : [q];
  const clean = segments.map(String).filter(Boolean);
  if (clean.length === 0) return;

  const pathname = `/api/${clean.join("/")}`;
  const raw = String(req.url || "");
  const cut = raw.indexOf("?");
  let search = "";
  if (cut >= 0) {
    const sp = new URLSearchParams(raw.slice(cut + 1));
    sp.delete("path");
    const rest = sp.toString();
    if (rest) search = `?${rest}`;
  }
  const nextUrl = pathname + search;
  const incoming = req as NextApiRequest & { originalUrl?: string };
  incoming.url = nextUrl;
  incoming.originalUrl = nextUrl;
}

export default async function apiGateway(req: NextApiRequest, res: NextApiResponse) {
  rewriteReqUrlForExpress(req);
  const coldStartT0 = Date.now();
  // #region agent log
  agentSessionLog({
    runId: "initial",
    hypothesisId: "H4",
    location: "src/pages/api/[[...path]].ts:apiGateway:before_getHandler",
    message: "vercel_api_gateway_entry",
    data: { url: String(req.url || "").slice(0, 200) },
  });
  // #endregion
  let expressApp: Awaited<ReturnType<typeof getExpressApp>>;
  try {
    expressApp = await getExpressApp();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api] createExpressApplication failed:", message);
    agentSessionLog({
      runId: "initial",
      hypothesisId: "H4",
      location: "src/pages/api/[[...path]].ts:getHandler",
      message: "vercel_getHandler_failed",
      data: {
        elapsedMs: Date.now() - coldStartT0,
        err: message,
      },
    });
    if (!res.headersSent) {
      return res.status(503).json({
        success: false,
        error: "Configuration serveur invalide ou API indisponible.",
        hint: "Vérifiez DATABASE_URL, NEXTAUTH_SECRET, PADDE_WEBHOOK_SECRET et CORS_ORIGIN sur Vercel.",
        detail: process.env.VERCEL ? message.split("\n").slice(0, 8) : undefined,
      });
    }
    return;
  }
  // #region agent log
  agentSessionLog({
    runId: "initial",
    hypothesisId: "H4",
    location: "src/pages/api/[[...path]].ts:apiGateway:after_getHandler",
    message: "vercel_getHandler_ready",
    data: { getHandlerMs: Date.now() - coldStartT0 },
  });
  // #endregion
  return expressApp(req as unknown as Parameters<Express>[0], res as unknown as Parameters<Express>[1], () => {
    if (!res.writableEnded) {
      res.status(404).json({ success: false, error: "Route API introuvable." });
    }
  });
}
