import type { Express } from "express";
import helmet from "helmet";

function isProduction(): boolean {
  return (process.env.NODE_ENV || "development") === "production";
}

/** CSP stricte pour l’API Express (réponses JSON, pas de HTML). */
export function buildApiContentSecurityPolicyDirectives(): Record<string, string[]> {
  return {
    defaultSrc: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    frameAncestors: ["'none'"],
  };
}

/** CSP navigateur pour le front Next (Google OAuth, Stripe redirect, analytics). */
export function buildWebContentSecurityPolicyDirectives(prod = isProduction()): Record<string, string[]> {
  const directives: Record<string, string[]> = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'", "https://checkout.stripe.com", "https://billing.stripe.com"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      ...(prod ? [] : ["'unsafe-eval'"]),
      "https://accounts.google.com",
      "https://www.googletagmanager.com",
      "https://va.vercel-scripts.com",
    ],
    connectSrc: [
      "'self'",
      "https://accounts.google.com",
      "https://www.googleapis.com",
      "https://oauth2.googleapis.com",
      "https://vitals.vercel-insights.com",
      "https://www.google-analytics.com",
      "https://region1.google-analytics.com",
    ],
    frameSrc: ["'self'", "https://accounts.google.com", "https://checkout.stripe.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'", "data:"],
    workerSrc: ["'self'", "blob:"],
  };
  if (prod) {
    directives.upgradeInsecureRequests = [];
  }
  return directives;
}

export function formatCspHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      const name = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
      return values.length === 0 ? name : `${name} ${values.join(" ")}`;
    })
    .join("; ");
}

/** En-têtes HTTP de durcissement (Helmet + compléments API). */
export function applySecurityHeaders(app: Express) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: buildApiContentSecurityPolicyDirectives(),
      },
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
    ? [
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        {
          key: "Content-Security-Policy",
          value: formatCspHeader(buildWebContentSecurityPolicyDirectives(true)),
        },
      ]
    : []),
] as const;
