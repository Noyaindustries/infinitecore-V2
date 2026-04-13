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
var import_path = __toESM(require("path"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_crypto = require("crypto");
var import_client_s3 = require("@aws-sdk/client-s3");
var import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");

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
  app2.use((0, import_cors.default)());
  app2.use(import_express.default.json());
  const s3 = canUseR2 ? new import_client_s3.S3Client({
    region: "auto",
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey
    }
  }) : null;
  const sanitizeFolder = (input) => input.replace(/\.\./g, "").replace(/[^a-zA-Z0-9/_-]/g, "").replace(/\/+/g, "/").replace(/^\/|\/$/g, "") || "misc";
  const upload = (0, import_multer.default)({
    storage: import_multer.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
    // 50MB
  });
  app2.post("/api/files/upload", upload.single("file"), async (req, res) => {
    try {
      if (!canUseR2 || !s3) {
        return res.status(500).json({
          success: false,
          error: "R2 non configur\xE9. Ajoutez R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY et R2_BUCKET_NAME."
        });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Aucun fichier re\xE7u." });
      }
      const folderRaw = typeof req.body?.folder === "string" ? req.body.folder : "misc";
      const folder = sanitizeFolder(folderRaw);
      const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${folder}/${Date.now()}-${(0, import_crypto.randomUUID)()}-${safeOriginal}`;
      await s3.send(
        new import_client_s3.PutObjectCommand({
          Bucket: r2Bucket,
          Key: objectKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype || "application/octet-stream",
          ContentDisposition: `inline; filename="${safeOriginal}"`
        })
      );
      const fileUrl = r2PublicBaseUrl ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}` : `/api/files/download?publicId=${encodeURIComponent(objectKey)}`;
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
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app2.delete("/api/files", (req, res) => {
    try {
      if (!canUseR2 || !s3) {
        return res.status(500).json({
          success: false,
          error: "R2 non configur\xE9."
        });
      }
      const publicId = String(req.query.publicId || "");
      if (!publicId) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
      }
      const safePath = publicId.replace(/\.\./g, "").replace(/^\/+/, "");
      s3.send(
        new import_client_s3.DeleteObjectCommand({
          Bucket: r2Bucket,
          Key: safePath
        })
      ).then(() => res.status(200).json({ success: true })).catch((error) => {
        console.error("Erreur suppression API:", error);
        res.status(500).json({ success: false, error: "Erreur interne du serveur." });
      });
    } catch (error) {
      console.error("Erreur suppression API:", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app2.get("/api/files/download", async (req, res) => {
    try {
      if (!canUseR2 || !s3) {
        return res.status(500).json({
          success: false,
          error: "R2 non configur\xE9."
        });
      }
      const publicId = String(req.query.publicId || "");
      if (!publicId) {
        return res.status(400).json({ success: false, error: "publicId manquant." });
      }
      const safePath = publicId.replace(/\.\./g, "").replace(/^\/+/, "");
      const command = new import_client_s3.GetObjectCommand({
        Bucket: r2Bucket,
        Key: safePath
      });
      const signedUrl = await (0, import_s3_request_presigner.getSignedUrl)(s3, command, { expiresIn: 60 * 10 });
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
    const distPath = import_path.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
