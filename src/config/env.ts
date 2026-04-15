/**
 * Point d’entrée unique pour la configuration lue depuis `process.env`
 * (après chargement de `.env` / `.env.local` via {@link ensureEnvFilesLoaded}).
 *
 * Les noms de variables restent alignés sur **`.env.example`** et **`.env.vercel.example`**.
 * Ne pas importer ce module depuis du code **client** (bundle) : utiliser `publicEnv.ts`.
 */
import { ensureEnvFilesLoaded } from "./loadEnvFiles";

ensureEnvFilesLoaded();

/** Chaîne d’environnement : `undefined` / `null` / vide après trim → `fallback`. */
function str(key: string, fallback = ""): string {
  const v = process.env[key];
  if (v === undefined || v === null) return fallback;
  const t = String(v).trim();
  return t || fallback;
}

function int(key: string, fallback: number): number {
  const n = Number.parseInt(process.env[key] || "", 10);
  return Number.isFinite(n) ? n : fallback;
}

const NODE_ENV = process.env.NODE_ENV || "development";

/** URL MongoDB avec timeouts driver (même logique qu’historiquement dans prismaClient). */
export function databaseUrlForPrisma(): string {
  const trimmed = str("DATABASE_URL");
  if (!trimmed || /serverSelectionTimeoutMS=/i.test(trimmed)) return trimmed;
  const ms =
    str("MONGODB_SERVER_SELECTION_TIMEOUT_MS") ||
    (NODE_ENV === "development" ? "10000" : "8000");
  const sep = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${sep}serverSelectionTimeoutMS=${encodeURIComponent(ms)}&connectTimeoutMS=${encodeURIComponent(ms)}`;
}

export function getJwtSecret(): string {
  const envSecret = str("NEXTAUTH_SECRET") || str("JWT_SECRET");
  if (envSecret) return envSecret;
  if (NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET ou JWT_SECRET est requis en production.");
  }
  return "dev-secret-change-me";
}

export function resetAppBaseUrl(): string {
  const raw = str("NEXTAUTH_URL") || str("APP_BASE_URL") || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/**
 * Parse `CORS_ORIGIN` : virgules, point-virgules, retours ligne, ou espaces entre URLs (tolérance Vercel / copier-coller).
 */
export function parseCorsOrigins(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of String(raw || "")
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    for (const part of chunk.split(/\s+/).map((s) => s.trim()).filter(Boolean)) {
      if (!/^https?:\/\//i.test(part)) continue;
      const normalized = part.replace(/\/$/, "");
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

export const appEnv = {
  node: {
    env: NODE_ENV,
    get isProduction() {
      return NODE_ENV === "production";
    },
    get isDevelopment() {
      return NODE_ENV === "development";
    },
  },
  database: {
    get url() {
      return str("DATABASE_URL");
    },
  },
  auth: {
    nextAuthUrl: str("NEXTAUTH_URL", "http://localhost:3000"),
    appBaseUrl: str("APP_BASE_URL"),
    jwtIssuer: str("JWT_ISSUER", "infinitecore-api"),
    jwtAudience: str("JWT_AUDIENCE", "infinitecore-web"),
    getJwtSecret,
    resetAppBaseUrl,
  },
  http: {
    /** Liste brute pour parser côté Express (CORS). */
    corsOriginRaw: str(
      "CORS_ORIGIN",
      "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://www.infinitecore.net,https://infinitecore.net,https://infinitecore-v2.vercel.app"
    ),
    apiPublicUrl: str("API_PUBLIC_URL"),
    port: int("PORT", 3000),
    host: str("HOST", "0.0.0.0") || "0.0.0.0",
  },
  smtp: {
    host: str("SMTP_HOST"),
    port: int("SMTP_PORT", 587),
    user: str("SMTP_USER"),
    pass: str("SMTP_PASS"),
    from: str("SMTP_FROM"),
    get secure() {
      return str("SMTP_SECURE").toLowerCase() === "true";
    },
    get fromOrUser() {
      return str("SMTP_FROM") || str("SMTP_USER") || "no-reply@infinitecore.local";
    },
  },
  r2: {
    accountId: str("R2_ACCOUNT_ID"),
    accessKeyId: str("R2_ACCESS_KEY_ID"),
    secretAccessKey: str("R2_SECRET_ACCESS_KEY"),
    bucket: str("R2_BUCKET_NAME"),
    publicBaseUrl: str("R2_PUBLIC_BASE_URL"),
    endpointRaw: str("R2_ENDPOINT"),
  },
  webhooks: {
    paddeWebhookSecret: str("PADDE_WEBHOOK_SECRET"),
  },
  integrations: {
    infiniteCoreApiUrl: str("INFINITE_CORE_API_URL"),
  },
  seed: {
    testPassword: str("SEED_TEST_PASSWORD", "Test1234!"),
  },
};
