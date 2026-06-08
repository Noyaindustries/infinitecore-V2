import type { Express, Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  message?: string;
  /** Préfixe ajouté à la clé (ex. `auth`, `upload`). */
  scope?: string;
  keyFn?: (req: Request) => string;
};

const buckets = new Map<string, Bucket>();

export function resetRateLimitBucketsForTests() {
  buckets.clear();
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimitOptions) {
  const windowMs = Math.max(1_000, options.windowMs);
  const max = Math.max(1, options.max);
  const message = options.message || "Trop de requêtes. Réessayez plus tard.";
  const scope = options.scope || "default";

  return (req: Request, res: Response, next: NextFunction) => {
    const baseKey = options.keyFn ? options.keyFn(req) : clientIp(req);
    const key = `${scope}:${baseKey}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      return res.status(429).json({ success: false, error: message });
    }
    return next();
  };
}

const AUTH_WINDOW_MS = Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000;
const AUTH_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX) || 40;

const UPLOAD_WINDOW_MS = Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS) || 15 * 60 * 1000;
const UPLOAD_MAX = Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 30;

const WEBHOOK_WINDOW_MS = Number(process.env.RATE_LIMIT_WEBHOOK_WINDOW_MS) || 60 * 1000;
const WEBHOOK_MAX = Number(process.env.RATE_LIMIT_WEBHOOK_MAX) || 120;

const PUBLIC_FORM_WINDOW_MS = Number(process.env.RATE_LIMIT_PUBLIC_FORM_WINDOW_MS) || 15 * 60 * 1000;
const PUBLIC_FORM_MAX = Number(process.env.RATE_LIMIT_PUBLIC_FORM_MAX) || 20;

const CHECKOUT_WINDOW_MS = Number(process.env.RATE_LIMIT_CHECKOUT_WINDOW_MS) || 15 * 60 * 1000;
const CHECKOUT_MAX = Number(process.env.RATE_LIMIT_CHECKOUT_MAX) || 25;

const DATA_WINDOW_MS = Number(process.env.RATE_LIMIT_DATA_WINDOW_MS) || 60 * 1000;
const DATA_MAX = Number(process.env.RATE_LIMIT_DATA_MAX) || 180;

export const authRateLimiter = createRateLimiter({
  scope: "auth",
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX,
  message: "Trop de tentatives d'authentification. Réessayez plus tard.",
});

export const uploadRateLimiter = createRateLimiter({
  scope: "upload",
  windowMs: UPLOAD_WINDOW_MS,
  max: UPLOAD_MAX,
  message: "Trop d'uploads. Réessayez plus tard.",
});

export const webhookRateLimiter = createRateLimiter({
  scope: "webhook",
  windowMs: WEBHOOK_WINDOW_MS,
  max: WEBHOOK_MAX,
  message: "Limite de webhooks atteinte pour cette adresse.",
});

export const publicFormRateLimiter = createRateLimiter({
  scope: "public-form",
  windowMs: PUBLIC_FORM_WINDOW_MS,
  max: PUBLIC_FORM_MAX,
  message: "Trop de soumissions. Réessayez plus tard.",
});

export const checkoutRateLimiter = createRateLimiter({
  scope: "checkout",
  windowMs: CHECKOUT_WINDOW_MS,
  max: CHECKOUT_MAX,
  message: "Trop de demandes de paiement. Réessayez plus tard.",
});

export const dataApiRateLimiter = createRateLimiter({
  scope: "data",
  windowMs: DATA_WINDOW_MS,
  max: DATA_MAX,
  message: "Trop de requêtes de données. Réessayez plus tard.",
});

/** Applique des limites sur les préfixes d’API sensibles. */
export function applySensitiveRateLimits(app: Express) {
  app.use("/api/auth", authRateLimiter);
  app.use("/api/files/upload", uploadRateLimiter);
  app.use("/api/webhooks", webhookRateLimiter);
  app.use("/api/apps/appointment", publicFormRateLimiter);
  app.use("/api/stripe/checkout", checkoutRateLimiter);
  app.use("/api/data", dataApiRateLimiter);
}
