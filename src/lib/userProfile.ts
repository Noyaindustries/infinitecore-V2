/** Champs profil issus de Firestore/API (souvent `Record<string, unknown>`). */

export function userFieldString(data: Record<string, unknown> | null | undefined, key: string): string {
  const v = data?.[key];
  return typeof v === "string" ? v : "";
}

/** Première lettre pour avatar / badge. */
export function userInitialLetter(
  data: Record<string, unknown> | null | undefined,
  fallbackLetter: string,
  email?: string | null
): string {
  const fn = userFieldString(data, "firstName");
  if (fn.length > 0) return fn[0]!.toUpperCase();
  const em = email?.trim();
  if (em && em.length > 0) return em[0]!.toUpperCase();
  return fallbackLetter;
}
