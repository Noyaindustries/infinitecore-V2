import type { Express, Request, Response, NextFunction } from "express";
import { logServerError } from "./logger";
type HttpError = Error & { status?: number; exposeMessage?: boolean };

export function formatClientErrorMessage(err: unknown): string {
  const status = (err as HttpError)?.status;
  if (status === 413) return "Payload trop volumineux.";
  if (status === 429) return "Trop de requêtes. Réessayez plus tard.";
  if (status === 400) return "Requête invalide.";
  return "Erreur interne du serveur.";
}

export function resolveErrorStatus(err: unknown): number {
  const status = (err as HttpError)?.status;
  if (typeof status === "number" && status >= 400 && status < 600) return status;
  return 500;
}

export function registerErrorHandlers(app: Express) {
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: "Ressource introuvable." });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = resolveErrorStatus(err);
    logServerError("express_unhandled_error", err, { statusCode: status });

    res.status(status).json({
      success: false,
      error: formatClientErrorMessage(err),
    });
  });}
