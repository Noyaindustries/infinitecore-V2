/**
 * Production : Next (`next start` équivalent) + Express sur le même port.
 * Les requêtes `/api/*` et `/health` vont à Express ; le reste à Next.
 */
import { parse } from "node:url";
import next from "next";
import express from "express";
import { appEnv } from "../src/config/env";

async function main() {
  const { createExpressApplication } = await import("../server");

  const port = appEnv.http.port;
  const hostname = appEnv.http.host;

  const nextApp = next({ dev: false, dir: process.cwd() });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();
  const { app: apiApp } = await createExpressApplication();

  const mainApp = express();
  mainApp.disable("x-powered-by");

  mainApp.use((req, res, next) => {
    const pathOnly = req.path || (req.url?.split("?")[0] ?? "/");
    if (pathOnly.startsWith("/api") || pathOnly === "/health") {
      return apiApp(req, res, next);
    }
    next();
  });

  mainApp.use((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    void handle(req, res, parsedUrl);
  });

  mainApp.listen(port, hostname, () => {
    console.log(`[infinitecore] Next + API → http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
