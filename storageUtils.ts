/**
 * Chemins disque `.local-uploads`, MIME et `publicId` — partagé entre Express, Netlify et `_localUploads`.
 */
import path from "path";
import { sanitizeObjectKey } from "./_r2";

export const LOCAL_UPLOADS_DIR = ".local-uploads";

export function getLocalUploadsBase(): string {
  return path.resolve(process.cwd(), LOCAL_UPLOADS_DIR);
}

/** Résout une clé objet (ex. dossiers/uid/audit/fichier.pdf) vers un chemin absolu sûr sous `.local-uploads`. */
export function resolveLocalUploadFile(safeRelPath: string): string | null {
  const normalized = sanitizeObjectKey(String(safeRelPath).replace(/\\/g, "/"));
  const base = getLocalUploadsBase();
  const full = path.resolve(base, normalized);
  const baseSep = base.endsWith(path.sep) ? base : base + path.sep;
  const inside =
    full.toLowerCase() === base.toLowerCase() || full.toLowerCase().startsWith(baseSep.toLowerCase());
  if (!inside) return null;
  return full;
}

/** Valeur de query `publicId` (GET download / DELETE fichier). */
export function normalizePublicIdQuery(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    s = decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    /* laisser brut */
  }
  return sanitizeObjectKey(s.replace(/\\/g, "/"));
}

export function mimeFromStorageKey(keyOrPath: string): string {
  const ext = path.extname(keyOrPath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}
