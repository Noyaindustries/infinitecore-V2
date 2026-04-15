/**
 * Vercel (et `next start` sans dev unifié) : monte l’app Express sous `/api/*` et `/health`
 * via serverless-http. En dev unifié (`npm run dev`), Express est servi avant Next — ce handler n’est pas utilisé.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { Handler } from "serverless-http";
import type { Express } from "express";
import serverless from "serverless-http";
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
  const handler = await getHandler();
  return handler(req, res);
}
