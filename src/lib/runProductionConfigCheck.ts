import { appEnv } from "@/config/env";
import {
  assertProductionCorsPolicy,
  buildStrictCorsOrigins,
} from "@/config/corsPolicy";
import { formatProductionSecretsErrors, validateProductionSecrets } from "@/config/secretPolicy";
import { isRateLimitEnabled } from "@/server/rateLimit";
import { isSmtpConfigured } from "@/server/smtpTransport";

export type ProductionConfigFlags = {
  databaseUrl: boolean;
  nextAuthSecret: boolean;
  nextAuthUrl: boolean;
  corsOrigin: boolean;
  paddeWebhookSecret: boolean;
  googleClientId: boolean;
  saasBridgeApiKey: boolean;
  rateLimitEnabled: boolean;
  smtpConfigured: boolean;
};

export type ProductionConfigCheckResult = {
  startupOk: boolean;
  config: ProductionConfigFlags;
  errors: string[];
  warnings: string[];
};

/** Vérifie la config prod sans démarrer Express (diagnostic Vercel). */
export function runProductionConfigCheck(): ProductionConfigCheckResult {
  const config: ProductionConfigFlags = {
    databaseUrl: Boolean(appEnv.database.url),
    nextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim() || process.env.JWT_SECRET?.trim()),
    nextAuthUrl: Boolean(process.env.NEXTAUTH_URL?.trim()),
    corsOrigin: Boolean(appEnv.http.corsOriginRaw),
    paddeWebhookSecret: Boolean(appEnv.webhooks.paddeWebhookSecret),
    googleClientId: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()),
    saasBridgeApiKey: Boolean(process.env.SAAS_BRIDGE_API_KEY?.trim()),
    rateLimitEnabled: isRateLimitEnabled(),
    smtpConfigured: isSmtpConfigured(),
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  if (appEnv.node.isProduction && !config.smtpConfigured) {
    warnings.push(
      "SMTP non configuré : la connexion par mot de passe renverra 503 après validation du mot de passe (code email). Définissez SMTP_HOST, SMTP_USER, SMTP_PASS sur Vercel."
    );
  }

  try {
    appEnv.auth.getJwtSecret();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const corsReport = assertProductionCorsPolicy(
    buildStrictCorsOrigins(appEnv.http.corsOriginRaw),
    appEnv.node.isProduction
  );
  if (!corsReport.ok) {
    errors.push(...corsReport.errors);
  }

  const secretsReport = validateProductionSecrets({
    isProduction: appEnv.node.isProduction,
    databaseUrl: appEnv.database.url,
    jwtSecret: (() => {
      try {
        return appEnv.auth.getJwtSecret();
      } catch {
        return "";
      }
    })(),
    paddeWebhookSecret: appEnv.webhooks.paddeWebhookSecret,
    noyaWebhookSecret: appEnv.webhooks.noyaRecrutementWebhookSecret,
    saasBridgeApiKey: String(process.env.SAAS_BRIDGE_API_KEY || ""),
    stripeSecretKey: appEnv.stripe.secretKey,
    stripeWebhookSecret: appEnv.stripe.webhookSecret,
  });
  if (!secretsReport.ok) {
    errors.push(...formatProductionSecretsErrors(secretsReport).split("\n").filter(Boolean));
  }

  return { startupOk: errors.length === 0, config, errors, warnings };
}
