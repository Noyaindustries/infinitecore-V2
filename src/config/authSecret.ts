/** Valeurs placeholder interdites en production pour NEXTAUTH_SECRET / JWT_SECRET. */
const WEAK_SECRETS = new Set([
  "",
  "change-me",
  "change-me-in-production",
  "dev-secret-change-me",
  "remplace-par-une-cle-longue-et-aleatoire",
  "génère-une-chaîne-longue-et-aléatoire",
  "genere-une-chaine-longue-et-aleatoire",
]);

export const NEXTAUTH_SECRET_MIN_LENGTH = 32;

export type AuthSecretValidation = {
  ok: boolean;
  secret: string;
  errors: string[];
};

export function validateAuthSecret(raw: string | undefined | null): AuthSecretValidation {
  const secret = String(raw ?? "").trim();
  const errors: string[] = [];

  if (!secret) {
    errors.push("NEXTAUTH_SECRET (ou JWT_SECRET) est vide.");
  } else if (secret.length < NEXTAUTH_SECRET_MIN_LENGTH) {
    errors.push(
      `Le secret doit contenir au moins ${NEXTAUTH_SECRET_MIN_LENGTH} caractères (actuel : ${secret.length}).`
    );
  }

  const normalized = secret.toLowerCase();
  if (WEAK_SECRETS.has(normalized)) {
    errors.push("Le secret est une valeur d’exemple — générez une clé aléatoire unique.");
  }

  return { ok: errors.length === 0, secret, errors };
}
