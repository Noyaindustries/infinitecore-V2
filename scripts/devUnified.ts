/**
 * Un seul processus Node : Next (dev) + Express sur le même port (défaut 3000).
 * Les requêtes `/api/*` et `/health` vont à Express ; le reste à Next.
 *
 * Lancé via `npm run dev` (voir package.json). Variable d’env : `PORT` (optionnel).
 * Turbopack : même effet que `next dev --turbo` (voir `TURBOPACK` dans le CLI Next).
 */
import { parse } from "node:url";
import next from "next";
import express from "express";
import { appEnv } from "../src/config/env";
import { createExpressApplication } from "../server";

process.env.TURBOPACK ||= "1";

const port = appEnv.http.port;
/** Même `HOST` que la prod (`src/config/env.ts`, défaut `0.0.0.0`) : évite les soucis d’accès sous Windows (localhost vs 127.0.0.1, autre interface). */
const listenHost = appEnv.http.host;

const nextApp = next({ dev: true, dir: process.cwd() });
const handle = nextApp.getRequestHandler();

await nextApp.prepare();
const { app: apiApp } = await createExpressApplication();

const main = express();
main.disable("x-powered-by");

main.use((req, res, next) => {
  const pathOnly = req.path || (req.url?.split("?")[0] ?? "/");
  if (pathOnly.startsWith("/api") || pathOnly === "/health") {
    return apiApp(req, res, next);
  }
  next();
});

main.use((req, res) => {
  const parsedUrl = parse(req.url || "/", true);
  void handle(req, res, parsedUrl);
});

main.listen(port, listenHost, () => {
  const openHost = listenHost === "0.0.0.0" ? "localhost" : listenHost;
  console.log(`[infinitecore] Next + API → http://${openHost}:${port} (écoute ${listenHost}:${port})`);
});
