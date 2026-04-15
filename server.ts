import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { createReadStream, promises as fs } from "fs";
import multer from "multer";
import { randomUUID, timingSafeEqual } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { appEnv, parseCorsOrigins } from "@/config/env";
import { prisma } from "./prismaClient";
import { buildFileUrl, sanitizeFolder } from "./_r2";
import { resolveLocalUploadFile, normalizePublicIdQuery, mimeFromStorageKey } from "./storageUtils";
import { registerMongoApi } from "./mongoApi";

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
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
  "application/octet-stream",
]);

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
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
]);

function isAllowedUpload(file: Express.Multer.File) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype || "")) return false;
  return true;
}

function secureSecretEquals(expected: string, provided: string) {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/** Application Express (routes `/api/*`, `/health`) sans `listen` — utilisée par `startServer` et par le dev unifié Next+API. */
export async function createExpressApplication(): Promise<{ app: Express; port: number }> {
  const app = express();
  const port = appEnv.http.port;
  const corsOrigins = parseCorsOrigins(appEnv.http.corsOriginRaw);
  const paddeWebhookSecret = appEnv.webhooks.paddeWebhookSecret;
  const r2AccountId = appEnv.r2.accountId;
  const r2AccessKeyId = appEnv.r2.accessKeyId;
  const r2SecretAccessKey = appEnv.r2.secretAccessKey;
  const r2Bucket = appEnv.r2.bucket;
  const r2PublicBaseUrl = appEnv.r2.publicBaseUrl;
  const r2Endpoint =
    appEnv.r2.endpointRaw || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : "");
  const canUseR2 = Boolean(r2Endpoint && r2AccessKeyId && r2SecretAccessKey && r2Bucket);

  if (!canUseR2) {
    console.warn(
      "[upload] Variables R2 absentes — mode développement : fichiers dans .local-uploads/ (non utilisé en prod sans R2)."
    );
  }

  app.use(
    cors({
      origin(origin, callback) {
        // Autorise les appels serveur-serveur et les fronts explicitement listés.
        if (!origin || corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        /** `false` sans Error : évite des 500 / preflight bizarres côté navigateur. */
        return callback(null, false);
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS", "PUT", "HEAD"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );
  app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(express.json({ limit: "1mb", strict: true }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  registerMongoApi(app);

  const s3 = canUseR2
    ? new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    })
    : null;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  });

  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Aucun fichier reçu." });
      }
      if (!isAllowedUpload(req.file)) {
        return res.status(415).json({
          success: false,
          error: "Type de fichier non autorisé. Formats acceptés: PDF, Office, JPG/PNG/WEBP, TXT/CSV.",
        });
      }

      const folderRaw = typeof req.body?.folder === "string" ? req.body.folder : "misc";
      const folder = sanitizeFolder(folderRaw);
      const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${folder}/${Date.now()}-${randomUUID()}-${safeOriginal}`;

      if (canUseR2 && s3) {
        await s3.send(
          new PutObjectCommand({
            Bucket: r2Bucket,
            Key: objectKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype || "application/octet-stream",
            ContentDisposition: `inline; filename="${safeOriginal}"`,
          })
        );

        const fileUrl = r2PublicBaseUrl
          ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}`
          : buildFileUrl(objectKey);

        return res.status(200).json({
          success: true,
          url: fileUrl,
          publicId: objectKey,
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        });
      }

      // Sans R2 : stockage local (développement / secours)
      const absPath = resolveLocalUploadFile(objectKey);
      if (!absPath) {
        return res.status(400).json({ success: false, error: "Chemin de fichier invalide." });
      }
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, req.file.buffer);

      const fileUrl = buildFileUrl(objectKey);
      return res.status(200).json({
        success: true,
        url: fileUrl,
        publicId: objectKey,
        name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (error) {
      console.error("Erreur upload API:", error);
      const msg =
        error instanceof Error && !appEnv.node.isProduction
          ? `Erreur interne du serveur. ${error.message}`
          : "Erreur interne du serveur.";
      return res.status(500).json({ success: false, error: msg });
    }
  });

  app.delete("/api/files", async (req, res) => {
    try {
      const safePath = normalizePublicIdQuery(String(req.query.publicId || ""));
      if (!safePath) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
      }

      if (canUseR2 && s3) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: r2Bucket,
            Key: safePath,
          })
        );
        return res.status(200).json({ success: true });
      }

      const absPath = resolveLocalUploadFile(safePath);
      if (!absPath) {
        return res.status(400).json({ success: false, error: "Chemin invalide." });
      }
      try {
        await fs.unlink(absPath);
      } catch (e: unknown) {
        const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
        if (code !== "ENOENT") throw e;
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erreur suppression API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.get("/api/files/download", async (req, res) => {
    try {
      const safePath = normalizePublicIdQuery(String(req.query.publicId || ""));
      if (!safePath) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
      }

      if (!canUseR2 || !s3) {
        const absPath = resolveLocalUploadFile(safePath);
        if (!absPath) {
          return res.status(400).json({ success: false, error: "Chemin invalide." });
        }
        try {
          const stat = await fs.stat(absPath);
          if (!stat.isFile()) {
            return res.status(404).json({ success: false, error: "Fichier introuvable." });
          }
        } catch (e: unknown) {
          const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
          if (code === "ENOENT") {
            return res.status(404).json({ success: false, error: "Fichier introuvable." });
          }
          throw e;
        }
        const filename = path.basename(safePath).replace(/"/g, "");
        res.setHeader("Content-Type", mimeFromStorageKey(safePath));
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        // createReadStream évite les NotFoundError du module « send » avec certains chemins Windows / encodages.
        const stream = createReadStream(absPath);
        stream.on("error", (err) => {
          console.error("[api/files/download] lecture disque:", absPath, err?.message);
          if (!res.headersSent) {
            res.status(404).json({ success: false, error: "Fichier introuvable." });
          } else {
            res.destroy(err);
          }
        });
        stream.pipe(res);
        return;
      }

      const command = new GetObjectCommand({
        Bucket: r2Bucket,
        Key: safePath,
      });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 10 });
      return res.redirect(signedUrl);
    } catch (error) {
      console.error("Erreur download API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  // Webhook PADDE-CI — persistance MongoDB via Prisma (collection `padde_ci_audits`)
  app.post("/api/webhooks/padde-ci", async (req, res) => {
    try {
      if (paddeWebhookSecret) {
        const provided = String(req.headers["x-webhook-secret"] || "");
        if (!provided || !secureSecretEquals(paddeWebhookSecret, provided)) {
          return res.status(401).json({ success: false, error: "Webhook non autorisé." });
        }
      }

      if (!appEnv.database.url) {
        return res.status(503).json({
          success: false,
          error: "Base de données non configurée : définissez DATABASE_URL (MongoDB) pour Prisma.",
        });
      }

      const data = req.body;
      const auditId = `PADDE-${Math.floor(1000 + Math.random() * 9000)}`;

      await prisma.paddeCiAudit.create({
        data: {
          id: auditId,
          payload: data ?? {},
          processed: false,
        },
      });

      res.status(200).json({ success: true, message: "Demande d'audit reçue et traitée avec succès." });
    } catch (error) {
      console.error("Erreur Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  // GET audits PADDE-CI (ex. admin.html) — lecture MongoDB
  app.get("/api/webhooks/padde-ci", async (req, res) => {
    try {
      if (!appEnv.database.url) {
        return res.status(503).json({ success: false, error: "Base de données non configurée (DATABASE_URL)." });
      }

      const rows = await prisma.paddeCiAudit.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const audits = rows.map((row) => {
        const payload = row.payload as Record<string, unknown> | null | undefined;
        const typeFromPayload =
          typeof payload?.type === "string"
            ? payload.type
            : typeof payload?.type_audit === "string"
              ? (payload.type_audit as string)
              : "audit-inconnu";

        return {
          id: row.id,
          type_audit: typeFromPayload,
          date: row.createdAt.toISOString(),
          donnees_completes: payload ?? {},
        };
      });

      res.status(200).json(audits);
    } catch (error) {
      console.error("Erreur GET Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  // L’UI est servie par Next.js (`next dev` / `next start`) sauf en dev unifié (`scripts/devUnified.ts`).

  return { app, port };
}

async function startServer() {
  const { app, port } = await createExpressApplication();
  app.listen(port, "0.0.0.0", () => {
    console.log(`[infinitecore-api] http://0.0.0.0:${port}`);
  });
}

// Écoute uniquement pour `npm run start:api` (`START_LISTEN=1`). Jamais lors d’un import depuis Next (`pages/api`, dev unifié, etc.).
if (process.env.START_LISTEN === "1") {
  void startServer();
}
