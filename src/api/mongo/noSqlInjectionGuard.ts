const MONGO_OPERATOR_KEY = /^\$/;
const MAX_SCAN_DEPTH = 10;

/** Détecte des clés style opérateur MongoDB (`$gt`, `$where`, …) dans un objet JSON arbitraire. */
export function containsMongoOperatorKeys(value: unknown, depth = 0): boolean {
  if (depth > MAX_SCAN_DEPTH) return true;
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) => containsMongoOperatorKeys(item, depth + 1));
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (MONGO_OPERATOR_KEY.test(key)) return true;
    if (containsMongoOperatorKeys(nested, depth + 1)) return true;
  }
  return false;
}

/** Rejette les chemins de collection suspects avant normalisation. */
export function isSafeCollectionPathInput(path: string): boolean {
  const raw = String(path || "");
  if (!raw.trim() || raw.includes("\0") || raw.includes("$")) return false;
  const segments = raw.split("/");
  return segments.every((segment) => {
    const s = segment.trim();
    return s.length > 0 && !s.startsWith(".") && !s.includes("$");
  });
}

/** Rejette les payloads document contenant des opérateurs MongoDB. */
export function assertSafeDocumentPayload(value: unknown): { ok: true } | { ok: false; error: string } {
  if (containsMongoOperatorKeys(value)) {
    return { ok: false, error: "Payload document invalide (opérateurs interdits)." };
  }
  return { ok: true };
}
