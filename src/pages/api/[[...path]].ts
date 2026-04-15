/**
 * Vercel (et `next start` sans dev unifié) : monte l’app Express sous `/api/*` et `/health`
 * via serverless-http. En dev unifié (`npm run dev`), Express est servi avant Next — ce handler n’est pas utilisé.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { Express } from "express";
import { agentSessionLog } from "@/debug/agentSessionLog";
import { createExpressApplication } from "../../../server";

let cachedExpressApp: Express | null = null;

async function getExpressApp(): Promise<Express> {
  if (cachedExpressApp) return cachedExpressApp;
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

export default async function apiGateway(req: NextApiRequest, res: NextApiResponse) {
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
    agentSessionLog({
      runId: "initial",
      hypothesisId: "H4",
      location: "src/pages/api/[[...path]].ts:getHandler",
      message: "vercel_getHandler_failed",
      data: {
        elapsedMs: Date.now() - coldStartT0,
        err: e instanceof Error ? e.message : String(e),
      },
    });
    throw e;
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
