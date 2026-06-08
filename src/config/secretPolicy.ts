import { validateAuthSecret } from "./authSecret";

export const SHARED_SECRET_MIN_LENGTH = 32;

const WEAK_SHARED_SECRETS = new Set([
  "",
  "change-me",
  "change-me-in-production",
  "dev-secret-change-me",
  "remplace-par-une-cle-longue-et-aleatoire",
  "génère-une-chaîne-longue-et-aléatoire",
  "genere-une-chaine-longue-et-aleatoire",
]);

export type SecretCheck = {
  name: string;
  ok: boolean;
  errors: string[];
};

export function validateSharedSecret(
  name: string,
  raw: string | undefined | null,
  options: { required?: boolean } = {}
): SecretCheck {
  const secret = String(raw ?? "").trim();
  const errors: string[] = [];

  if (!secret) {
    if (options.required) errors.push(`${name} est requis.`);
    return { name, ok: errors.length === 0, errors };
  }

  if (secret.length < SHARED_SECRET_MIN_LENGTH) {
    errors.push(
      `${name} doit contenir au moins ${SHARED_SECRET_MIN_LENGTH} caractères (actuel : ${secret.length}).`
    );
  }

  if (WEAK_SHARED_SECRETS.has(secret.toLowerCase())) {
    errors.push(`${name} est une valeur d’exemple — générez une clé aléatoire unique.`);
  }

  return { name, ok: errors.length === 0, errors };
}

export type ProductionSecretsReport = {
  ok: boolean;
  checks: SecretCheck[];
};

/** Validation stricte au démarrage de l’API en production. */
export function validateProductionSecrets(input: {
  isProduction: boolean;
  databaseUrl: string;
  jwtSecret: string;
  paddeWebhookSecret: string;
  noyaWebhookSecret: string;
  saasBridgeApiKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}): ProductionSecretsReport {
  if (!input.isProduction) {
    return { ok: true, checks: [] };
  }

  const checks: SecretCheck[] = [];

  if (!input.databaseUrl.trim()) {
    checks.push({ name: "DATABASE_URL", ok: false, errors: ["DATABASE_URL est requis en production."] });
  } else {
    checks.push({ name: "DATABASE_URL", ok: true, errors: [] });
  }

  const auth = validateAuthSecret(input.jwtSecret);
  checks.push({
    name: "NEXTAUTH_SECRET",
    ok: auth.ok,
    errors: auth.errors.map((e) => `NEXTAUTH_SECRET : ${e}`),
  });

  checks.push(validateSharedSecret("PADDE_WEBHOOK_SECRET", input.paddeWebhookSecret, { required: true }));

  if (input.noyaWebhookSecret.trim()) {
    checks.push(validateSharedSecret("NOYA_RECRUTEMENT_WEBHOOK_SECRET", input.noyaWebhookSecret));
  }

  if (input.saasBridgeApiKey.trim()) {
    checks.push(validateSharedSecret("SAAS_BRIDGE_API_KEY", input.saasBridgeApiKey));
  }

  if (input.stripeSecretKey.trim()) {
    checks.push(validateSharedSecret("STRIPE_WEBHOOK_SECRET", input.stripeWebhookSecret, { required: true }));
  }

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}

export function formatProductionSecretsErrors(report: ProductionSecretsReport): string {
  const lines = report.checks.flatMap((c) => c.errors.map((e) => `- ${e}`));
  return lines.join("\n");
}
