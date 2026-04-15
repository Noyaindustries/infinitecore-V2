/**
 * Vercel (et `next start` sans dev unifié) : monte l’app Express sous `/api/*` et `/health`
 * via serverless-http. En dev unifié (`npm run dev`), Express est servi avant Next — ce handler n’est pas utilisé.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { Handler } from "serverless-http";
import type { Express } from "express";
import serverless from "serverless-http";
import { agentSessionLog } from "../../src/debug/agentSessionLog";
import { createExpressApplication } from "../../server";

let cachedHandler: Handler | null = null;

async function getHandler(): Promise<Handler> {
  if (cachedHandler) return cachedHandler;
  const { app } = await createExpressApplication();
  cachedHandler = serverless(app as Express, {
    binary: ["application/octet-stream", "multipart/form-data", "application/pdf"],
  });
  return cachedHandler;
}

export const config = {
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
    location: "pages/api/[[...path]].ts:apiGateway:before_getHandler",
    message: "vercel_api_gateway_entry",
    data: { url: String(req.url || "").slice(0, 200) },
  });
  // #endregion
  let handler: Awaited<ReturnType<typeof getHandler>>;
  try {
    handler = await getHandler();
  } catch (e) {
    agentSessionLog({
      runId: "initial",
      hypothesisId: "H4",
      location: "pages/api/[[...path]].ts:getHandler",
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
    location: "pages/api/[[...path]].ts:apiGateway:after_getHandler",
    message: "vercel_getHandler_ready",
    data: { getHandlerMs: Date.now() - coldStartT0 },
  });
  // #endregion
  return handler(req, res);
}
