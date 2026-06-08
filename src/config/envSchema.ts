import { z } from "zod";

const WEAK_SECRETS = new Set([
  "",
  "change-me",
  "change-me-in-production",
  "dev-secret-change-me",
  "remplace-par-une-cle-longue-et-aleatoire",
  "génère-une-chaîne-longue-et-aleatoire",
  "genere-une-chaine-longue-et-aleatoire",
]);

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined)
  .refine((v) => v === undefined || /^https?:\/\//i.test(v), { message: "URL HTTP(S) invalide." });

const optionalBool = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === "boolean") return v;
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1") return true;
    if (t === "false" || t === "0") return false;
    return undefined;
  });

const optionalPositiveInt = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
      if (!Number.isFinite(n)) return NaN;
      return n;
    })
    .refine((n) => n === undefined || (n >= min && n <= max), {
      message: `Entier requis entre ${min} et ${max}.`,
    });

export const processEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    DATABASE_URL: z.string().trim().optional(),
    NEXTAUTH_SECRET: z.string().trim().optional(),
    JWT_SECRET: z.string().trim().optional(),
    NEXTAUTH_URL: optionalUrl,
    APP_BASE_URL: optionalUrl,
    API_PUBLIC_URL: optionalUrl,
    CORS_ORIGIN: z.string().optional(),
    PORT: optionalPositiveInt(1, 65_535),
    HOST: z.string().trim().optional(),
    DATA_QUERY_FETCH_CAP: optionalPositiveInt(100, 20_000),
    SMTP_PORT: optionalPositiveInt(1, 65_535),
    SMTP_SECURE: optionalBool,
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: optionalPositiveInt(1000, 120_000),
    WEBHOOK_ALLOW_PLAIN_SECRET: optionalBool,
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).optional(),
    RATE_LIMIT_AUTH_MAX: optionalPositiveInt(1, 10_000),
    RATE_LIMIT_AUTH_WINDOW_MS: optionalPositiveInt(1000, 3_600_000),
    RATE_LIMIT_UPLOAD_MAX: optionalPositiveInt(1, 10_000),
    RATE_LIMIT_UPLOAD_WINDOW_MS: optionalPositiveInt(1000, 3_600_000),
    RATE_LIMIT_WEBHOOK_MAX: optionalPositiveInt(1, 10_000),
    RATE_LIMIT_WEBHOOK_WINDOW_MS: optionalPositiveInt(1000, 3_600_000),
    RATE_LIMIT_PUBLIC_FORM_MAX: optionalPositiveInt(1, 10_000),
    RATE_LIMIT_PUBLIC_FORM_WINDOW_MS: optionalPositiveInt(1000, 3_600_000),
    RATE_LIMIT_CHECKOUT_MAX: optionalPositiveInt(1, 10_000),
    RATE_LIMIT_CHECKOUT_WINDOW_MS: optionalPositiveInt(1000, 3_600_000),
    RATE_LIMIT_DATA_MAX: optionalPositiveInt(1, 10_000),
    RATE_LIMIT_DATA_WINDOW_MS: optionalPositiveInt(1000, 3_600_000),
  })
  .passthrough();

export type ValidatedProcessEnv = z.infer<typeof processEnvSchema>;

export type EnvValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function secretErrors(name: string, value: string | undefined, required: boolean): string[] {
  const errors: string[] = [];
  if (!value) {
    if (required) errors.push(`${name} est requis.`);
    return errors;
  }
  if (value.length < 32) {
    errors.push(`${name} : minimum 32 caractères (actuel ${value.length}).`);
  }
  if (WEAK_SECRETS.has(value.toLowerCase())) {
    errors.push(`${name} : valeur d'exemple interdite.`);
  }
  return errors;
}

function corsErrors(raw: string | undefined, isProduction: boolean): string[] {
  const errors: string[] = [];
  const origins = String(raw || "")
    .split(/[,;\n\r]+/)
    .flatMap((chunk) => chunk.trim().split(/\s+/).map((s) => s.trim()).filter(Boolean))
    .filter((part) => /^https?:\/\//i.test(part))
    .map((part) => part.replace(/\/$/, ""));
  if (origins.some((o) => o.includes("*"))) {
    errors.push("CORS_ORIGIN ne doit pas contenir de wildcard (*).");
  }
  if (isProduction) {
    if (origins.length === 0) errors.push("CORS_ORIGIN : au moins une origine en production.");
    const hasPublicHttps = origins.some(
      (o) => o.startsWith("https://") && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(o)
    );
    if (!hasPublicHttps) {
      errors.push("CORS_ORIGIN : au moins une origine HTTPS publique en production.");
    }
  }
  return errors;
}

export function validateProcessEnv(
  env: Record<string, string | undefined>,
  options?: { isProduction?: boolean }
): EnvValidationReport {
  const isProduction = options?.isProduction ?? (env.NODE_ENV || "development") === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = processEnvSchema.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "env";
      errors.push(`${path} : ${issue.message}`);
    }
    return { ok: false, errors, warnings };
  }

  const jwtSecret = parsed.data.NEXTAUTH_SECRET || parsed.data.JWT_SECRET;
  errors.push(...secretErrors("NEXTAUTH_SECRET", jwtSecret, isProduction));
  errors.push(...secretErrors("DATABASE_URL", parsed.data.DATABASE_URL, isProduction));

  if (isProduction) {
    errors.push(...secretErrors("PADDE_WEBHOOK_SECRET", env.PADDE_WEBHOOK_SECRET?.trim(), true));
    errors.push(...secretErrors("SAAS_BRIDGE_API_KEY", env.SAAS_BRIDGE_API_KEY?.trim(), true));
  } else if (!jwtSecret) {
    warnings.push("NEXTAUTH_SECRET absent — secret de développement utilisé.");
  }

  const stripeKey = env.STRIPE_SECRET_KEY?.trim();
  if (stripeKey && isProduction) {
    errors.push(...secretErrors("STRIPE_WEBHOOK_SECRET", env.STRIPE_WEBHOOK_SECRET?.trim(), true));
  }

  const noyaSecret = env.NOYA_RECRUTEMENT_WEBHOOK_SECRET?.trim();
  if (noyaSecret) {
    errors.push(...secretErrors("NOYA_RECRUTEMENT_WEBHOOK_SECRET", noyaSecret, false));
  }

  errors.push(...corsErrors(parsed.data.CORS_ORIGIN, isProduction));

  return { ok: errors.length === 0, errors, warnings };
}

export function formatEnvValidationReport(report: EnvValidationReport): string {
  const lines: string[] = [];
  if (report.errors.length) {
    lines.push("Erreurs :");
    for (const err of report.errors) lines.push(`  - ${err}`);
  }
  if (report.warnings.length) {
    lines.push("Avertissements :");
    for (const warn of report.warnings) lines.push(`  - ${warn}`);
  }
  return lines.join("\n");
}
