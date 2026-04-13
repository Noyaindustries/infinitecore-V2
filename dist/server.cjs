var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_vite = require("vite");
var import_path2 = __toESM(require("path"), 1);
var import_fs = require("fs");
var import_multer = __toESM(require("multer"), 1);
var import_crypto = require("crypto");
var import_client_s32 = require("@aws-sdk/client-s3");
var import_s3_request_presigner2 = require("@aws-sdk/s3-request-presigner");

// src/firebase.ts
var import_app = require("firebase/app");
var import_auth = require("firebase/auth");
var import_firestore = require("firebase/firestore");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "noya-industries-platform",
  appId: "1:994757523169:web:307dab266ab318dedae9a0",
  apiKey: "AIzaSyBmSQsOxI4IJ7kSDn8z23gl6wZCgfzmGRU",
  authDomain: "noya-industries-platform.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-42406826-d231-4e61-bda4-7369948f2694",
  storageBucket: "noya-industries-platform.firebasestorage.app",
  messagingSenderId: "994757523169",
  measurementId: ""
};

// src/firebase.ts
var app = (0, import_app.initializeApp)(firebase_applet_config_default);
var db = (0, import_firestore.initializeFirestore)(app, {
  experimentalForceLongPolling: true
}, firebase_applet_config_default.firestoreDatabaseId);
var auth = (0, import_auth.getAuth)(app);

// server.ts
var import_firestore2 = require("firebase/firestore");

// _r2.ts
var import_client_s3 = require("@aws-sdk/client-s3");
var import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");
var cleanEnv = (value) => (value || "").trim().replace(/^['"]+|['"]+$/g, "");
var normalizeUrl = (value) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
};
var accountId = cleanEnv(process.env.R2_ACCOUNT_ID);
var accessKeyId = cleanEnv(process.env.R2_ACCESS_KEY_ID);
var secretAccessKey = cleanEnv(process.env.R2_SECRET_ACCESS_KEY);
var bucket = cleanEnv(process.env.R2_BUCKET_NAME);
var publicBaseUrl = normalizeUrl(cleanEnv(process.env.R2_PUBLIC_BASE_URL));
var endpoint = normalizeUrl(
  cleanEnv(process.env.R2_ENDPOINT) || (accountId ? `${accountId}.r2.cloudflarestorage.com` : "")
);
var hasR2Config = Boolean(endpoint && accessKeyId && secretAccessKey && bucket);
var r2Client = hasR2Config ? new import_client_s3.S3Client({
  region: "auto",
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey }
}) : null;
function sanitizeFolder(input) {
  return input.replace(/\.\./g, "").replace(/[^a-zA-Z0-9/_-]/g, "").replace(/\/+/g, "/").replace(/^\/|\/$/g, "") || "misc";
}
function sanitizeObjectKey(input) {
  return input.replace(/\.\./g, "").replace(/^\/+/, "");
}

// storageUtils.ts
var import_path = __toESM(require("path"), 1);
var LOCAL_UPLOADS_DIR = ".local-uploads";
function getLocalUploadsBase() {
  return import_path.default.resolve(process.cwd(), LOCAL_UPLOADS_DIR);
}
function resolveLocalUploadFile(safeRelPath) {
  const normalized = sanitizeObjectKey(String(safeRelPath).replace(/\\/g, "/"));
  const base = getLocalUploadsBase();
  const full = import_path.default.resolve(base, normalized);
  const baseSep = base.endsWith(import_path.default.sep) ? base : base + import_path.default.sep;
  const inside = full.toLowerCase() === base.toLowerCase() || full.toLowerCase().startsWith(baseSep.toLowerCase());
  if (!inside) return null;
  return full;
}
function normalizePublicIdQuery(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    s = decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
  }
  return sanitizeObjectKey(s.replace(/\\/g, "/"));
}
function mimeFromStorageKey(keyOrPath) {
  const ext = import_path.default.extname(keyOrPath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

// server.ts
async function startServer() {
  const app2 = (0, import_express.default)();
  const PORT = 3e3;
  const r2AccountId = process.env.R2_ACCOUNT_ID || "";
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || "";
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
  const r2Bucket = process.env.R2_BUCKET_NAME || "";
  const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL || "";
  const r2Endpoint = process.env.R2_ENDPOINT || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : "");
  const canUseR2 = Boolean(r2Endpoint && r2AccessKeyId && r2SecretAccessKey && r2Bucket);
  if (!canUseR2) {
    console.warn(
      "[upload] Variables R2 absentes \u2014 mode d\xE9veloppement : fichiers dans .local-uploads/ (non utilis\xE9 en prod sans R2)."
    );
  }
  app2.use((0, import_cors.default)());
  app2.use(import_express.default.json());
  const s3 = canUseR2 ? new import_client_s32.S3Client({
    region: "auto",
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey
    }
  }) : null;
  const upload = (0, import_multer.default)({
    storage: import_multer.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
    // 50MB
  });
  app2.post("/api/files/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Aucun fichier re\xE7u." });
      }
      const folderRaw = typeof req.body?.folder === "string" ? req.body.folder : "misc";
      const folder = sanitizeFolder(folderRaw);
      const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${folder}/${Date.now()}-${(0, import_crypto.randomUUID)()}-${safeOriginal}`;
      if (canUseR2 && s3) {
        await s3.send(
          new import_client_s32.PutObjectCommand({
            Bucket: r2Bucket,
            Key: objectKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype || "application/octet-stream",
            ContentDisposition: `inline; filename="${safeOriginal}"`
          })
        );
        const fileUrl2 = r2PublicBaseUrl ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}` : `/api/files/download?publicId=${encodeURIComponent(objectKey)}`;
        return res.status(200).json({
          success: true,
          url: fileUrl2,
          publicId: objectKey,
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
      }
      const absPath = resolveLocalUploadFile(objectKey);
      if (!absPath) {
        return res.status(400).json({ success: false, error: "Chemin de fichier invalide." });
      }
      await import_fs.promises.mkdir(import_path2.default.dirname(absPath), { recursive: true });
      await import_fs.promises.writeFile(absPath, req.file.buffer);
      const fileUrl = `/api/files/download?publicId=${encodeURIComponent(objectKey)}`;
      return res.status(200).json({
        success: true,
        url: fileUrl,
        publicId: objectKey,
        name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Erreur upload API:", error);
      const msg = error instanceof Error && process.env.NODE_ENV !== "production" ? `Erreur interne du serveur. ${error.message}` : "Erreur interne du serveur.";
      return res.status(500).json({ success: false, error: msg });
    }
  });
  app2.delete("/api/files", async (req, res) => {
    try {
      const safePath = normalizePublicIdQuery(String(req.query.publicId || ""));
      if (!safePath) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
      }
      if (canUseR2 && s3) {
        await s3.send(
          new import_client_s32.DeleteObjectCommand({
            Bucket: r2Bucket,
            Key: safePath
          })
        );
        return res.status(200).json({ success: true });
      }
      const absPath = resolveLocalUploadFile(safePath);
      if (!absPath) {
        return res.status(400).json({ success: false, error: "Chemin invalide." });
      }
      try {
        await import_fs.promises.unlink(absPath);
      } catch (e) {
        const code = e && typeof e === "object" && "code" in e ? e.code : "";
        if (code !== "ENOENT") throw e;
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erreur suppression API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app2.get("/api/files/download", async (req, res) => {
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
          const stat = await import_fs.promises.stat(absPath);
          if (!stat.isFile()) {
            return res.status(404).json({ success: false, error: "Fichier introuvable." });
          }
        } catch (e) {
          const code = e && typeof e === "object" && "code" in e ? e.code : "";
          if (code === "ENOENT") {
            return res.status(404).json({ success: false, error: "Fichier introuvable." });
          }
          throw e;
        }
        const filename = import_path2.default.basename(safePath).replace(/"/g, "");
        res.setHeader("Content-Type", mimeFromStorageKey(safePath));
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        const stream = (0, import_fs.createReadStream)(absPath);
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
      const command = new import_client_s32.GetObjectCommand({
        Bucket: r2Bucket,
        Key: safePath
      });
      const signedUrl = await (0, import_s3_request_presigner2.getSignedUrl)(s3, command, { expiresIn: 60 * 10 });
      return res.redirect(signedUrl);
    } catch (error) {
      console.error("Erreur download API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app2.post("/api/webhooks/padde-ci", async (req, res) => {
    try {
      const data = req.body;
      const auditId = `PADDE-${Math.floor(1e3 + Math.random() * 9e3)}`;
      await (0, import_firestore2.setDoc)((0, import_firestore2.doc)(db, "padde_audits", auditId), {
        ...data,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        processed: false
      });
      res.status(200).json({ success: true, message: "Demande d'audit re\xE7ue et trait\xE9e avec succ\xE8s." });
    } catch (error) {
      console.error("Erreur Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app2.get("/api/webhooks/padde-ci", async (req, res) => {
    try {
      const { getDocs, query, collection: collection2, where } = await import("firebase/firestore");
      const q = query(
        collection2(db, "tasks"),
        where("title", ">=", "Audit PADDE-CI"),
        where("title", "<=", "Audit PADDE-CI\uF8FF")
      );
      const snapshot = await getDocs(q);
      const audits = snapshot.docs.map((doc2) => {
        const data = doc2.data();
        let originalData = {};
        try {
          const description = data.description || "";
          const detailsMatch = description.match(/Détails complets:\n([\s\S]*)$/);
          if (detailsMatch && detailsMatch[1]) {
            originalData = JSON.parse(detailsMatch[1]);
          }
        } catch (e) {
        }
        return {
          id: doc2.id,
          type_audit: originalData?.type || "audit-inconnu",
          date: data.createdAt,
          donnees_completes: originalData || {}
        };
      });
      res.status(200).json(audits);
    } catch (error) {
      console.error("Erreur GET Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*all", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
