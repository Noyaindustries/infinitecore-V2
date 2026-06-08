import type { Express } from "express";
import helmet from "helmet";

function isProduction(): boolean {
  return (process.env.NODE_ENV || "development") === "production";
}

/** En-têtes HTTP de durcissement (Helmet + compléments API). */
export function applySecurityHeaders(app: Express) {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: isProduction()
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
        : false,
    })
  );

  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    if (!res.getHeader("X-Content-Type-Options")) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
    next();
  });
}

export const nextSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
] as const;
