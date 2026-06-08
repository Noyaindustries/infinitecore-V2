import type { RequestHandler } from "express";
import multer from "multer";
import { logServerError } from "./logger";

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
]);

/** octet-stream accepté uniquement si l’extension correspond à un type autorisé. */
const FALLBACK_MIME_FOR_EXTENSION = "application/octet-stream";

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".txt",
  ".csv",
  ".zip",
]);

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 8,
    parts: 12,
    fieldNameSize: 120,
    fieldSize: 4 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!isAllowedUploadMeta(file.originalname, file.mimetype)) {
      return callback(new Error("UPLOAD_TYPE_NOT_ALLOWED"));
    }
    callback(null, true);
  },
});

export function isAllowedUploadMeta(originalName: string, mimetype: string) {
  const ext = pathExtname(originalName);
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return false;
  const mime = (mimetype || "").toLowerCase();
  if (ALLOWED_UPLOAD_MIME_TYPES.has(mime)) return true;
  return mime === FALLBACK_MIME_FOR_EXTENSION;
}

export function isAllowedUpload(file: Express.Multer.File) {
  return isAllowedUploadMeta(file.originalname || "", file.mimetype || "");
}

function pathExtname(name: string) {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot).toLowerCase();
}

/** Middleware `upload.single("file")` avec réponses JSON cohérentes. */
export const uploadSingleWithHandling: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          error: "Fichier trop volumineux (max 50 Mo).",
        });
      }
      if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          error: "Un seul fichier est autorisé par requête.",
        });
      }
      return res.status(400).json({
        success: false,
        error: "Requête d'upload invalide.",
      });
    }
    if (error instanceof Error && error.message === "UPLOAD_TYPE_NOT_ALLOWED") {
      return res.status(415).json({
        success: false,
        error:
          "Type de fichier non autorisé. Formats acceptés : PDF, Office, JPG/PNG/WEBP, TXT/CSV, ZIP.",
      });
    }
    logServerError("upload_middleware_error", error);
    return res.status(400).json({ success: false, error: "Requête d'upload invalide." });
  });
};
