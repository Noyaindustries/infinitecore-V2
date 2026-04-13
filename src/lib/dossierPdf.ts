/** Fichier PDF acceptable pour l’étape Audit (étape 1) — dépôt admin. */
export function isPdfDocument(file: File): boolean {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf")) return false;
  const t = (file.type || "").toLowerCase();
  if (!t || t === "application/octet-stream") return true;
  return t === "application/pdf" || t === "application/x-pdf";
}
