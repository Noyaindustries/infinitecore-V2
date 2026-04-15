"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  createExpressApplication: () => createExpressApplication
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs = require("fs");

// src/debug/agentSessionLog.ts
var AGENT_DEBUG_ENABLED = process.env.ENABLE_AGENT_DEBUG_LOGS === "1";
var AGENT_DEBUG_ENDPOINT = "http://127.0.0.1:27772/ingest/9581a084-44fc-4752-b649-5a3388314469";
var AGENT_DEBUG_SESSION_ID = "73b87a";
var AGENT_DEBUG_TIMEOUT_MS = 250;
function agentSessionLog(payload) {
  if (!AGENT_DEBUG_ENABLED) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AGENT_DEBUG_TIMEOUT_MS);
  void fetch(AGENT_DEBUG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": AGENT_DEBUG_SESSION_ID
    },
    body: JSON.stringify({
      sessionId: AGENT_DEBUG_SESSION_ID,
      timestamp: Date.now(),
      ...payload
    }),
    signal: controller.signal
  }).catch(() => {
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

// server.ts
var import_multer = __toESM(require("multer"), 1);
var import_crypto3 = require("crypto");
var import_client_s32 = require("@aws-sdk/client-s3");
var import_s3_request_presigner2 = require("@aws-sdk/s3-request-presigner");

// src/config/loadEnvFiles.ts
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"), 1);
function parseDotEnvFile(raw, overrideExisting) {
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (overrideExisting || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
var loaded = false;
function ensureEnvFilesLoaded() {
  if (loaded) return;
  loaded = true;
  const root = process.cwd();
  const envPath = import_node_path.default.join(root, ".env");
  const localPath = import_node_path.default.join(root, ".env.local");
  if ((0, import_node_fs.existsSync)(envPath)) {
    parseDotEnvFile((0, import_node_fs.readFileSync)(envPath, "utf8"), false);
  }
  if ((0, import_node_fs.existsSync)(localPath)) {
    parseDotEnvFile((0, import_node_fs.readFileSync)(localPath, "utf8"), true);
  }
}

// src/config/env.ts
ensureEnvFilesLoaded();
function str(key, fallback = "") {
  const v = process.env[key];
  if (v === void 0 || v === null) return fallback;
  const t = String(v).trim();
  return t || fallback;
}
function int(key, fallback) {
  const n = Number.parseInt(process.env[key] || "", 10);
  return Number.isFinite(n) ? n : fallback;
}
var NODE_ENV = process.env.NODE_ENV || "development";
function databaseUrlForPrisma() {
  const trimmed = str("DATABASE_URL");
  if (!trimmed || /serverSelectionTimeoutMS=/i.test(trimmed)) return trimmed;
  const ms = str("MONGODB_SERVER_SELECTION_TIMEOUT_MS") || (NODE_ENV === "development" ? "10000" : "8000");
  const sep = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${sep}serverSelectionTimeoutMS=${encodeURIComponent(ms)}&connectTimeoutMS=${encodeURIComponent(ms)}`;
}
function getJwtSecret() {
  const envSecret = str("NEXTAUTH_SECRET") || str("JWT_SECRET");
  if (envSecret) return envSecret;
  if (NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET ou JWT_SECRET est requis en production.");
  }
  return "dev-secret-change-me";
}
function resetAppBaseUrl() {
  const raw = str("NEXTAUTH_URL") || str("APP_BASE_URL") || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
function parseCorsOrigins(raw) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const chunk of String(raw || "").split(/[,;\n\r]+/).map((s) => s.trim()).filter(Boolean)) {
    for (const part of chunk.split(/\s+/).map((s) => s.trim()).filter(Boolean)) {
      if (!/^https?:\/\//i.test(part)) continue;
      const normalized = part.replace(/\/$/, "");
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}
var appEnv = {
  node: {
    env: NODE_ENV,
    get isProduction() {
      return NODE_ENV === "production";
    },
    get isDevelopment() {
      return NODE_ENV === "development";
    }
  },
  database: {
    get url() {
      return str("DATABASE_URL");
    }
  },
  auth: {
    nextAuthUrl: str("NEXTAUTH_URL", "http://localhost:3000"),
    appBaseUrl: str("APP_BASE_URL"),
    jwtIssuer: str("JWT_ISSUER", "infinitecore-api"),
    jwtAudience: str("JWT_AUDIENCE", "infinitecore-web"),
    getJwtSecret,
    resetAppBaseUrl
  },
  http: {
    /** Liste brute pour parser côté Express (CORS). */
    corsOriginRaw: str(
      "CORS_ORIGIN",
      "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://www.infinitecore.net,https://infinitecore.net,https://infinitecore-v2.vercel.app"
    ),
    apiPublicUrl: str("API_PUBLIC_URL"),
    port: int("PORT", 3e3),
    host: str("HOST", "0.0.0.0") || "0.0.0.0"
  },
  smtp: {
    host: str("SMTP_HOST"),
    port: int("SMTP_PORT", 587),
    user: str("SMTP_USER"),
    pass: str("SMTP_PASS"),
    from: str("SMTP_FROM"),
    get secure() {
      return str("SMTP_SECURE").toLowerCase() === "true";
    },
    get fromOrUser() {
      return str("SMTP_FROM") || str("SMTP_USER") || "no-reply@infinitecore.local";
    }
  },
  r2: {
    accountId: str("R2_ACCOUNT_ID"),
    accessKeyId: str("R2_ACCESS_KEY_ID"),
    secretAccessKey: str("R2_SECRET_ACCESS_KEY"),
    bucket: str("R2_BUCKET_NAME"),
    publicBaseUrl: str("R2_PUBLIC_BASE_URL"),
    endpointRaw: str("R2_ENDPOINT")
  },
  webhooks: {
    paddeWebhookSecret: str("PADDE_WEBHOOK_SECRET")
  },
  integrations: {
    infiniteCoreApiUrl: str("INFINITE_CORE_API_URL")
  },
  seed: {
    testPassword: str("SEED_TEST_PASSWORD", "Test1234!")
  }
};

// prismaClient.ts
var import_client = require("@prisma/client");
var globalForPrisma = globalThis;
var prismaClient = globalForPrisma.prisma ?? new import_client.PrismaClient({
  datasources: {
    db: { url: databaseUrlForPrisma() }
  },
  log: appEnv.node.isDevelopment ? ["warn", "error"] : ["error"]
});
globalForPrisma.prisma = prismaClient;
var prisma = prismaClient;

// _r2.ts
var import_client_s3 = require("@aws-sdk/client-s3");
var import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");
var cleanEnv = (value) => (value || "").trim().replace(/^['"]+|['"]+$/g, "");
var normalizeUrl = (value) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
};
var accountId = cleanEnv(appEnv.r2.accountId);
var accessKeyId = cleanEnv(appEnv.r2.accessKeyId);
var secretAccessKey = cleanEnv(appEnv.r2.secretAccessKey);
var bucket = cleanEnv(appEnv.r2.bucket);
var publicBaseUrl = normalizeUrl(cleanEnv(appEnv.r2.publicBaseUrl));
var apiPublicBase = normalizeUrl(cleanEnv(appEnv.http.apiPublicUrl)).replace(/\/$/, "");
var endpoint = normalizeUrl(
  cleanEnv(appEnv.r2.endpointRaw) || (accountId ? `${accountId}.r2.cloudflarestorage.com` : "")
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
function buildFileUrl(publicId) {
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}/${publicId}`;
  }
  const q = `?publicId=${encodeURIComponent(publicId)}`;
  if (apiPublicBase) {
    return `${apiPublicBase}/api/files/download${q}`;
  }
  return `/api/files/download${q}`;
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

// mongoApi.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_crypto2 = require("crypto");

// src/api/dataRoutes.ts
var import_crypto = require("crypto");
function parseDataQueryInput(body) {
  const raw = body ?? {};
  const max = Number(raw.limit);
  const offsetRaw = Number(raw.offset);
  const limit = Number.isFinite(max) && max > 0 ? Math.min(max, 1e3) : 100;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.min(offsetRaw, 1e5) : 0;
  return {
    collectionPathRaw: String(raw.collectionPath || ""),
    filtersRaw: raw.filters,
    ordersRaw: raw.orders,
    limit,
    offset
  };
}
function buildDbFiltersFromQueryFilters(filters) {
  const dbFilters = [];
  for (const filter of filters) {
    const path4 = [filter.field];
    switch (filter.operator) {
      case "==":
        dbFilters.push({ data: { path: path4, equals: filter.value } });
        break;
      case "!=":
        dbFilters.push({ NOT: { data: { path: path4, equals: filter.value } } });
        break;
      case ">":
        dbFilters.push({ data: { path: path4, gt: filter.value } });
        break;
      case ">=":
        dbFilters.push({ data: { path: path4, gte: filter.value } });
        break;
      case "<":
        dbFilters.push({ data: { path: path4, lt: filter.value } });
        break;
      case "<=":
        dbFilters.push({ data: { path: path4, lte: filter.value } });
        break;
      default:
        return null;
    }
  }
  return dbFilters;
}
function registerDataRoutes(app, deps) {
  app.post("/api/data/query", async (req, res) => {
    try {
      const auth = await deps.requireAuth(req, res);
      if (!auth) return;
      const parsed = parseDataQueryInput(req.body);
      const collectionPath = deps.normalizeCollectionPath(parsed.collectionPathRaw);
      const filters = deps.sanitizeFilters(parsed.filtersRaw);
      const orders = deps.sanitizeOrders(parsed.ordersRaw);
      if (!collectionPath || !deps.isSafeCollectionPath(collectionPath) || filters === null || orders === null) {
        return res.status(400).json({ success: false, error: "Param\xE8tres de requ\xEAte invalides." });
      }
      const authz = deps.assertDataQueryAuthorized(auth, collectionPath, filters);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      const dbFilters = buildDbFiltersFromQueryFilters(filters);
      let rows;
      if (dbFilters) {
        try {
          const dbWhere = { AND: [{ collectionPath }, ...dbFilters] };
          rows = await deps.prisma.dataDocument.findMany({
            where: dbWhere,
            take: 5e3
          });
        } catch (error) {
          console.warn("[data/query] fallback to in-memory filters", {
            collectionPath,
            filtersCount: filters.length,
            error: error instanceof Error ? error.message : String(error)
          });
          rows = await deps.prisma.dataDocument.findMany({
            where: { collectionPath },
            take: 5e3
          });
        }
      } else {
        rows = await deps.prisma.dataDocument.findMany({
          where: { collectionPath },
          take: 5e3
        });
      }
      const normalized = rows.map((row) => ({
        docId: row.docId,
        data: deps.coerceRecord(row.data)
      }));
      const filtered = dbFilters ? normalized : deps.applyFilters(normalized, filters);
      const ordered = deps.applyOrder(filtered, orders);
      const paged = ordered.slice(parsed.offset, parsed.offset + parsed.limit);
      return res.status(200).json({
        success: true,
        docs: paged.map((row) => ({ id: row.docId, data: row.data }))
      });
    } catch (error) {
      console.error("[data/query]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.get("/api/data/doc", async (req, res) => {
    try {
      const auth = await deps.requireAuth(req, res);
      if (!auth) return;
      const collectionPath = deps.normalizeCollectionPath(String(req.query.collectionPath || ""));
      const docId = String(req.query.docId || "").trim();
      if (!collectionPath || !docId || !deps.isSafeCollectionPath(collectionPath) || !deps.isSafeDocId(docId)) {
        return res.status(400).json({ success: false, error: "collectionPath et docId invalides." });
      }
      const authz = deps.assertDataDocAuthorized(auth, "read", collectionPath, docId);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      const row = await deps.prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath, docId } }
      });
      return res.status(200).json({
        success: true,
        exists: Boolean(row),
        doc: row ? { id: row.docId, data: deps.coerceRecord(row.data) } : null
      });
    } catch (error) {
      console.error("[data/doc:get]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.post("/api/data/doc", async (req, res) => {
    try {
      const auth = await deps.requireAuth(req, res);
      if (!auth) return;
      const collectionPath = deps.normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const merge = Boolean(req.body?.merge);
      const incoming = deps.coerceRecord(req.body?.data);
      const docId = String(req.body?.docId || "").trim() || (0, import_crypto.randomUUID)().replace(/-/g, "");
      if (!collectionPath || !deps.isSafeCollectionPath(collectionPath) || !deps.isSafeDocId(docId)) {
        return res.status(400).json({ success: false, error: "collectionPath ou docId invalides." });
      }
      const authz = deps.assertDataDocAuthorized(auth, "write", collectionPath, docId, incoming);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      await deps.upsertDataDocument(collectionPath, docId, incoming, merge);
      return res.status(200).json({ success: true, docId });
    } catch (error) {
      console.error("[data/doc:post]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.patch("/api/data/doc", async (req, res) => {
    try {
      const auth = await deps.requireAuth(req, res);
      if (!auth) return;
      const collectionPath = deps.normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const docId = String(req.body?.docId || "").trim();
      const updates = deps.coerceRecord(req.body?.data);
      const deleteKeys = Array.isArray(req.body?.deleteKeys) ? req.body.deleteKeys : [];
      if (!collectionPath || !docId || !deps.isSafeCollectionPath(collectionPath) || !deps.isSafeDocId(docId) || !deleteKeys.every((key) => deps.isSafeFieldName(String(key)))) {
        return res.status(400).json({ success: false, error: "collectionPath et docId invalides." });
      }
      const authz = deps.assertDataDocAuthorized(auth, "write", collectionPath, docId, updates);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      const existing = await deps.prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath, docId } }
      });
      if (!existing) return res.status(404).json({ success: false, error: "Document introuvable." });
      const next = { ...deps.coerceRecord(existing.data), ...updates };
      for (const key of deleteKeys) delete next[key];
      await deps.prisma.dataDocument.update({
        where: { collectionPath_docId: { collectionPath, docId } },
        data: { data: next }
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[data/doc:patch]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.delete("/api/data/doc", async (req, res) => {
    try {
      const auth = await deps.requireAuth(req, res);
      if (!auth) return;
      const collectionPath = deps.normalizeCollectionPath(String(req.query.collectionPath || ""));
      const docId = String(req.query.docId || "").trim();
      if (!collectionPath || !docId || !deps.isSafeCollectionPath(collectionPath) || !deps.isSafeDocId(docId)) {
        return res.status(400).json({ success: false, error: "collectionPath et docId invalides." });
      }
      const authz = deps.assertDataDocAuthorized(auth, "write", collectionPath, docId);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      await deps.prisma.dataDocument.deleteMany({
        where: { collectionPath, docId }
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[data/doc:delete]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
}

// mongoApi.ts
var AUTH_HEADER_PREFIX = "Bearer ";
var AUTH_COOKIE_NAME = "ic_auth_token";
var AUTH_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var SAFE_COLLECTION_SEGMENT = /^[A-Za-z0-9_-]{1,120}$/;
var SAFE_DOC_ID = /^[A-Za-z0-9._:-]{1,180}$/;
var SAFE_FIELD_NAME = /^[A-Za-z0-9_.-]{1,120}$/;
var MAX_FILTERS = 12;
var MAX_ORDERS = 6;
var AUTH_RATE_WINDOW_MS = 15 * 60 * 1e3;
var AUTH_RATE_MAX_FAILURES = 8;
var AUTH_RATE_BLOCK_MS = 20 * 60 * 1e3;
var RESET_TOKEN_TTL_MS = 30 * 60 * 1e3;
var LOGIN_VERIFICATION_TTL_MS = 10 * 60 * 1e3;
var LOGIN_VERIFICATION_MAX_ATTEMPTS = 5;
var USER_FIELDS = [
  "uid",
  "email",
  "firstName",
  "lastName",
  "phone",
  "role",
  "companyId",
  "referredBy",
  "photoURL",
  "createdAt"
];
var authFailureBuckets = /* @__PURE__ */ new Map();
var smtpTransport = null;
function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
  const host = appEnv.smtp.host;
  const port = appEnv.smtp.port;
  const user = appEnv.smtp.user;
  const pass = appEnv.smtp.pass;
  if (!host || !Number.isFinite(port) || !user || !pass) return null;
  smtpTransport = import_nodemailer.default.createTransport({
    host,
    port,
    secure: appEnv.smtp.secure,
    auth: { user, pass }
  });
  return smtpTransport;
}
async function sendResetPasswordEmail(input) {
  const transporter = getSmtpTransport();
  const resetLink = `${resetAppBaseUrl()}/reset-password?email=${encodeURIComponent(input.to)}&token=${encodeURIComponent(input.token)}`;
  if (!transporter) {
    return { delivered: false, previewLink: resetLink };
  }
  await transporter.sendMail({
    from: appEnv.smtp.fromOrUser,
    to: input.to,
    subject: "Reinitialisation de votre mot de passe",
    text: `Bonjour,

Utilisez ce lien pour reinitialiser votre mot de passe:
${resetLink}

Ce lien expire dans 30 minutes.
Si vous n'etes pas a l'origine de cette demande, ignorez cet email.
`,
    html: `<p>Bonjour,</p><p>Utilisez ce lien pour reinitialiser votre mot de passe :</p><p><a href="${resetLink}">${resetLink}</a></p><p>Ce lien expire dans 30 minutes.</p><p>Si vous n'etes pas a l'origine de cette demande, ignorez cet email.</p>`
  });
  return { delivered: true };
}
function generateNumericCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}
async function sendLoginVerificationEmail(input) {
  const transporter = getSmtpTransport();
  if (!transporter) {
    return { delivered: false, previewCode: input.code };
  }
  await transporter.sendMail({
    from: appEnv.smtp.fromOrUser,
    to: input.to,
    subject: "Code de verification de connexion",
    text: `Bonjour,

Voici votre code de verification Infinite Core : ${input.code}

Il expire dans 10 minutes.
Si vous n'\xEAtes pas a l'origine de cette tentative de connexion, ignorez cet email.
`,
    html: `<p>Bonjour,</p><p>Voici votre code de verification Infinite Core :</p><p style="font-size: 24px; font-weight: 700; letter-spacing: 0.12em;">${input.code}</p><p>Il expire dans <strong>10 minutes</strong>.</p><p>Si vous n'\xEAtes pas a l'origine de cette tentative de connexion, ignorez cet email.</p>`
  });
  return { delivered: true };
}
async function googleUserProfileFromAccessToken(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error("GOOGLE_USERINFO_FAILED");
  }
  const u = await res.json();
  if (!u.email || u.email_verified !== true) {
    throw new Error("GOOGLE_EMAIL_UNVERIFIED");
  }
  const email = u.email.trim().toLowerCase();
  return {
    email,
    displayNameHint: String(u.name || "").trim() || email.split("@")[0] || email,
    picture: u.picture ? String(u.picture).trim() : null
  };
}
function signAuthToken(payload) {
  return import_jsonwebtoken.default.sign(payload, getJwtSecret(), {
    expiresIn: "7d",
    algorithm: "HS256",
    issuer: appEnv.auth.jwtIssuer,
    audience: appEnv.auth.jwtAudience
  });
}
function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: appEnv.node.isProduction,
    path: "/",
    maxAge: AUTH_COOKIE_TTL_MS
  };
}
function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}
function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: appEnv.node.isProduction,
    path: "/"
  });
}
function parseCookieValue(header, key) {
  if (!header) return null;
  const cookies = header.split(";");
  for (const cookie of cookies) {
    const [namePart, ...valueParts] = cookie.split("=");
    const name = String(namePart || "").trim();
    if (name !== key) continue;
    const rawValue = valueParts.join("=").trim();
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}
function readAuthToken(req) {
  const raw = req.headers.authorization;
  if (raw && raw.startsWith(AUTH_HEADER_PREFIX)) {
    return raw.slice(AUTH_HEADER_PREFIX.length).trim();
  }
  const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : void 0;
  return parseCookieValue(cookieHeader, AUTH_COOKIE_NAME);
}
function parseAuth(req) {
  const token = readAuthToken(req);
  if (!token) return null;
  try {
    const decoded = import_jsonwebtoken.default.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: appEnv.auth.jwtIssuer,
      audience: appEnv.auth.jwtAudience
    });
    if (!decoded || typeof decoded.uid !== "string" || typeof decoded.email !== "string" || typeof decoded.role !== "string") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
function parseAuthFromRequest(req) {
  return parseAuth(req);
}
var VALID_ROLES = /* @__PURE__ */ new Set(["admin", "commando", "developer", "partner", "client"]);
var VALID_OPERATORS = /* @__PURE__ */ new Set(["==", "!=", ">", ">=", "<", "<="]);
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
function isStrongPassword(password) {
  if (password.length < 12 || password.length > 128) return false;
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}
function prismaAndDriverErrorText(error) {
  const parts = [];
  if (error instanceof Error) parts.push(error.message);
  else parts.push(String(error));
  const rec = error;
  if (rec.code) parts.push(String(rec.code));
  if (rec.meta !== void 0) {
    try {
      parts.push(typeof rec.meta === "string" ? rec.meta : JSON.stringify(rec.meta));
    } catch {
      parts.push(String(rec.meta));
    }
  }
  if (rec.cause instanceof Error) parts.push(rec.cause.message);
  else if (rec.cause !== void 0 && rec.cause !== null) parts.push(String(rec.cause));
  return parts.join("\n");
}
function sendAuthPrismaError(res, logLabel, error) {
  console.error(logLabel, error);
  const msg = prismaAndDriverErrorText(error);
  const dbUnreachable = /Server selection timeout|Can't reach database server|ReplicaSetNoPrimary|P1001|P1017|P2010|MongoNetwork|ECONNREFUSED|fatal alert: InternalError|TLS handshake|certificate|timed out/i.test(
    msg
  );
  if (dbUnreachable) {
    return res.status(503).json({
      success: false,
      error: "Connexion \xE0 MongoDB impossible. V\xE9rifiez DATABASE_URL, le r\xE9seau \xAB Network Access \xBB sur Atlas (IP autoris\xE9es), et tout proxy ou antivirus qui intercepte TLS."
    });
  }
  return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
}
function sha256Hex(input) {
  return (0, import_crypto2.createHash)("sha256").update(input).digest("hex");
}
function normalizeIp(raw) {
  return raw.trim().replace(/^::ffff:/, "") || "unknown";
}
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return normalizeIp(xff.split(",")[0] || "");
  }
  if (Array.isArray(xff) && xff[0]) {
    return normalizeIp(String(xff[0]));
  }
  return normalizeIp(req.socket.remoteAddress || "");
}
function authBucketKey(req, email) {
  return `${getClientIp(req)}|${email || "unknown"}`;
}
function authRateLimitDocId(key) {
  return sha256Hex(`auth_rate_limit:${key}`);
}
function fallbackIsBlocked(key) {
  const now = Date.now();
  const bucket2 = authFailureBuckets.get(key);
  if (!bucket2) return false;
  if (bucket2.blockedUntil > now) return true;
  if (bucket2.windowEndsAt < now) authFailureBuckets.delete(key);
  return false;
}
function fallbackRegisterFailure(key) {
  const now = Date.now();
  const bucket2 = authFailureBuckets.get(key);
  if (!bucket2 || bucket2.windowEndsAt < now) {
    authFailureBuckets.set(key, { failures: 1, windowEndsAt: now + AUTH_RATE_WINDOW_MS, blockedUntil: 0 });
    return;
  }
  bucket2.failures += 1;
  if (bucket2.failures >= AUTH_RATE_MAX_FAILURES) bucket2.blockedUntil = now + AUTH_RATE_BLOCK_MS;
}
async function isAuthTemporarilyBlocked(key) {
  try {
    const now = Date.now();
    const row = await prisma.dataDocument.findUnique({
      where: { collectionPath_docId: { collectionPath: "auth_rate_limits", docId: authRateLimitDocId(key) } },
      select: { data: true }
    });
    const data = coerceRecord(row?.data);
    const blockedUntil = Number(data.blockedUntil || 0);
    const windowEndsAt = Number(data.windowEndsAt || 0);
    if (Number.isFinite(blockedUntil) && blockedUntil > now) return true;
    if (Number.isFinite(windowEndsAt) && windowEndsAt > 0 && windowEndsAt < now) {
      await prisma.dataDocument.deleteMany({
        where: { collectionPath: "auth_rate_limits", docId: authRateLimitDocId(key) }
      });
    }
    return false;
  } catch {
    return fallbackIsBlocked(key);
  }
}
async function registerAuthFailure(key) {
  try {
    const now = Date.now();
    const docId = authRateLimitDocId(key);
    const row = await prisma.dataDocument.findUnique({
      where: { collectionPath_docId: { collectionPath: "auth_rate_limits", docId } },
      select: { data: true }
    });
    const current = coerceRecord(row?.data);
    const currentWindowEnds = Number(current.windowEndsAt || 0);
    const inWindow = Number.isFinite(currentWindowEnds) && currentWindowEnds >= now;
    const failures = inWindow ? Number(current.failures || 0) + 1 : 1;
    const windowEndsAt = inWindow ? currentWindowEnds : now + AUTH_RATE_WINDOW_MS;
    const blockedUntil = failures >= AUTH_RATE_MAX_FAILURES ? now + AUTH_RATE_BLOCK_MS : 0;
    await upsertDataDocument(
      "auth_rate_limits",
      docId,
      {
        keyHash: docId,
        failures,
        windowEndsAt,
        blockedUntil,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      false
    );
  } catch {
    fallbackRegisterFailure(key);
  }
}
async function clearAuthFailures(key) {
  authFailureBuckets.delete(key);
  try {
    await prisma.dataDocument.deleteMany({
      where: { collectionPath: "auth_rate_limits", docId: authRateLimitDocId(key) }
    });
  } catch {
  }
}
function isPrimitiveQueryValue(value) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function isSafeCollectionPath(path4) {
  const parts = path4.split("/");
  return parts.length > 0 && parts.every((segment) => SAFE_COLLECTION_SEGMENT.test(segment));
}
function isSafeDocId(docId) {
  return SAFE_DOC_ID.test(docId);
}
function normalizePartnerCode(raw) {
  return String(raw || "").trim().toUpperCase().replace("PART-USR", "PART-INF");
}
function sanitizeFilters(raw) {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_FILTERS) return null;
  const filters = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const field = String(item.field || "").trim();
    const operator = item.operator;
    const value = item.value;
    if (!SAFE_FIELD_NAME.test(field) || !VALID_OPERATORS.has(operator) || !isPrimitiveQueryValue(value)) {
      return null;
    }
    filters.push({ field, operator, value });
  }
  return filters;
}
function sanitizeOrders(raw) {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_ORDERS) return null;
  const orders = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const field = String(item.field || "").trim();
    const directionRaw = String(item.direction || "asc").toLowerCase();
    if (!SAFE_FIELD_NAME.test(field)) return null;
    if (directionRaw !== "asc" && directionRaw !== "desc") return null;
    orders.push({ field, direction: directionRaw });
  }
  return orders;
}
async function resolveAuthPayload(raw) {
  const account = await prisma.userAccount.findUnique({
    where: { uid: raw.uid },
    select: { uid: true, email: true, role: true }
  });
  if (!account) return null;
  let effectiveRole = account.role;
  if (effectiveRole === "client") {
    const profileDoc = await prisma.dataDocument.findUnique({
      where: { collectionPath_docId: { collectionPath: "users", docId: raw.uid } },
      select: { data: true }
    });
    const profile = coerceRecord(profileDoc?.data);
    const profileRole = typeof profile.role === "string" ? profile.role : "";
    if (VALID_ROLES.has(profileRole) && profileRole !== effectiveRole) {
      effectiveRole = profileRole;
      await prisma.userAccount.update({
        where: { uid: raw.uid },
        data: { role: effectiveRole }
      });
    }
  }
  return {
    uid: account.uid,
    email: account.email,
    role: effectiveRole
  };
}
async function requireAuth(req, res) {
  const auth = parseAuth(req);
  if (!auth) {
    res.status(401).json({ success: false, error: "Non authentifi\xE9." });
    return null;
  }
  const resolved = await resolveAuthPayload(auth);
  if (!resolved) {
    res.status(401).json({ success: false, error: "Session invalide." });
    return null;
  }
  return resolved;
}
function isPath(path4, expected) {
  return path4 === expected;
}
function isPathPrefix(path4, prefix) {
  const cleanPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return path4 === cleanPrefix || path4.startsWith(`${cleanPrefix}/`);
}
function getAllowedPrefixes(role, op) {
  if (role === "admin") return ["*"];
  if (role === "commando") {
    return [
      "users",
      "companies",
      "notifications",
      "missions",
      "dossier_steps",
      "payments",
      "orders",
      "logs",
      "chats",
      "documents",
      "resources",
      "admin_config",
      "instances",
      "leads",
      "service_types",
      "padde_ci_audits",
      "tasks"
    ];
  }
  if (role === "developer") {
    return ["users", "notifications", "missions", "chats", "livrables"];
  }
  if (role === "partner") {
    return ["users", "notifications", "leads", "missions", "payments", "orders", "chats", "resources"];
  }
  if (role === "client") {
    if (op === "read") return ["users", "notifications", "missions", "dossier_steps", "payments", "orders", "chats"];
    return ["users", "notifications", "chats"];
  }
  return [];
}
function hasCollectionAccess(role, op, collectionPath) {
  const allow = getAllowedPrefixes(role, op);
  if (allow.includes("*")) return true;
  return allow.some((prefix) => isPathPrefix(collectionPath, prefix));
}
function hasClientScopedFilters(auth, collectionPath, filters) {
  const eq = (field, value) => filters.some((f) => f.field === field && f.operator === "==" && String(f.value) === value);
  if (isPath(collectionPath, "users")) return eq("uid", auth.uid);
  if (isPath(collectionPath, "notifications")) return eq("userId", auth.uid);
  if (isPath(collectionPath, "missions")) return eq("clientId", auth.uid);
  if (isPath(collectionPath, "dossier_steps")) return eq("clientId", auth.uid);
  if (isPath(collectionPath, "payments")) return eq("userId", auth.uid) || eq("clientId", auth.uid);
  if (isPath(collectionPath, "orders")) return eq("userId", auth.uid) || eq("clientId", auth.uid);
  if (isPath(collectionPath, "chats")) return eq("clientId", auth.uid);
  if (isPathPrefix(collectionPath, "chats/")) {
    const parts = collectionPath.split("/");
    return parts[0] === "chats" && parts[1] === auth.uid;
  }
  return false;
}
function hasClientScopedDocumentAccess(auth, collectionPath, docId) {
  if (isPath(collectionPath, "users")) return docId === auth.uid;
  if (isPath(collectionPath, "chats")) return docId === auth.uid;
  if (isPathPrefix(collectionPath, "chats/")) {
    const parts = collectionPath.split("/");
    return parts[0] === "chats" && parts[1] === auth.uid;
  }
  return true;
}
function hasClientWritablePayload(auth, collectionPath, data) {
  if (isPath(collectionPath, "users")) {
    const uid = typeof data.uid === "string" ? data.uid : auth.uid;
    const role = typeof data.role === "string" ? data.role : "client";
    return uid === auth.uid && role === "client";
  }
  if (isPath(collectionPath, "notifications")) {
    const userId = typeof data.userId === "string" ? data.userId : auth.uid;
    return userId === auth.uid;
  }
  if (isPath(collectionPath, "chats")) {
    const clientId = typeof data.clientId === "string" ? data.clientId : auth.uid;
    return clientId === auth.uid;
  }
  if (isPathPrefix(collectionPath, "chats/")) {
    const parts = collectionPath.split("/");
    return parts[0] === "chats" && parts[1] === auth.uid;
  }
  return false;
}
function assertDataQueryAuthorized(auth, collectionPath, filters) {
  if (!hasCollectionAccess(auth.role, "read", collectionPath)) {
    return { ok: false, error: "Acc\xE8s interdit \xE0 cette collection." };
  }
  if (auth.role === "client" && !hasClientScopedFilters(auth, collectionPath, filters)) {
    return { ok: false, error: "Requ\xEAte client non scop\xE9e sur votre propre compte." };
  }
  return { ok: true };
}
function assertDataDocAuthorized(auth, op, collectionPath, docId, payload) {
  if (!hasCollectionAccess(auth.role, op, collectionPath)) {
    return { ok: false, error: "Acc\xE8s interdit \xE0 cette collection." };
  }
  if (auth.role === "client") {
    if (!hasClientScopedDocumentAccess(auth, collectionPath, docId)) {
      return { ok: false, error: "Acc\xE8s interdit \xE0 ce document." };
    }
    if (op === "write" && payload && !hasClientWritablePayload(auth, collectionPath, payload)) {
      return { ok: false, error: "\xC9criture non autoris\xE9e sur ce document." };
    }
  }
  return { ok: true };
}
function coerceRecord(value) {
  return value && typeof value === "object" ? value : {};
}
function pickUserPublicData(input) {
  const out = {};
  for (const field of USER_FIELDS) {
    if (field in input && input[field] !== void 0) out[field] = input[field];
  }
  return out;
}
function normalizeCollectionPath(path4) {
  return path4.split("/").map((segment) => segment.trim()).filter(Boolean).join("/");
}
function compareValues(left, operator, right) {
  switch (operator) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    default:
      return false;
  }
}
function applyFilters(rows, filters) {
  return rows.filter(
    (row) => filters.every((filter) => compareValues(row.data[filter.field], filter.operator, filter.value))
  );
}
function applyOrder(rows, orders) {
  if (!orders.length) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const direction = order.direction === "desc" ? -1 : 1;
      const av = a.data[order.field];
      const bv = b.data[order.field];
      if (av === bv) continue;
      if (av === void 0) return 1;
      if (bv === void 0) return -1;
      return av > bv ? direction : -direction;
    }
    return 0;
  });
}
async function upsertDataDocument(collectionPath, docId, data, merge) {
  const existing = await prisma.dataDocument.findUnique({
    where: { collectionPath_docId: { collectionPath, docId } }
  });
  const nextData = merge ? { ...coerceRecord(existing?.data), ...data } : data;
  await prisma.dataDocument.upsert({
    where: { collectionPath_docId: { collectionPath, docId } },
    create: { collectionPath, docId, data: nextData },
    update: { data: nextData }
  });
}
async function ensureUserDocumentFromAccount(account) {
  await upsertDataDocument(
    "users",
    account.uid,
    {
      uid: account.uid,
      email: account.email,
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      phone: account.phone || "",
      role: account.role,
      companyId: account.companyId || null,
      referredBy: account.referredBy || null,
      photoURL: account.photoURL || null,
      createdAt: account.createdAt.toISOString()
    },
    true
  );
}
function registerMongoApi(app) {
  const dbUrl = appEnv.database.url;
  const dbMasked = dbUrl ? `${dbUrl.slice(0, 15)}...${dbUrl.slice(-10)}` : "NON_DEFINIE";
  console.log(`[mongoApi] Initialisation. DB: ${dbMasked}. CORS: ${appEnv.http.corsOriginRaw}`);
  app.get("/api/auth/me", async (req, res) => {
    try {
      const auth = parseAuth(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifi\xE9." });
      const account = await prisma.userAccount.findUnique({ where: { uid: auth.uid } });
      if (!account) return res.status(401).json({ success: false, error: "Session invalide." });
      const profileDoc = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "users", docId: account.uid } }
      });
      const profile = coerceRecord(profileDoc?.data);
      return res.status(200).json({
        success: true,
        user: {
          uid: account.uid,
          email: account.email,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
          photoURL: account.photoURL || null
        },
        userData: {
          ...pickUserPublicData({
            uid: account.uid,
            email: account.email,
            firstName: account.firstName || "",
            lastName: account.lastName || "",
            phone: account.phone || "",
            role: account.role,
            companyId: account.companyId || null,
            referredBy: account.referredBy || null,
            photoURL: account.photoURL || null,
            createdAt: account.createdAt.toISOString()
          }),
          ...profile,
          /** Toujours aligné sur le compte Prisma (évite qu’un doc `users` partiel écrase le rôle). */
          role: account.role
        }
      });
    } catch (error) {
      console.error("[auth/me]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.patch("/api/auth/profile", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const rawDisplayName = req.body?.displayName;
      const rawPhotoURL = req.body?.photoURL;
      const displayName = typeof rawDisplayName === "string" ? rawDisplayName.trim().slice(0, 120) : void 0;
      const photoURL = typeof rawPhotoURL === "string" ? rawPhotoURL.trim().slice(0, 500) : void 0;
      const [firstName = "", ...last] = (displayName || "").split(/\s+/).filter(Boolean);
      const lastName = last.join(" ");
      const account = await prisma.userAccount.update({
        where: { uid: auth.uid },
        data: {
          ...displayName !== void 0 ? { firstName, lastName } : {},
          ...photoURL !== void 0 ? { photoURL: photoURL || null } : {}
        }
      });
      await ensureUserDocumentFromAccount(account);
      return res.status(200).json({
        success: true,
        user: {
          uid: account.uid,
          email: account.email,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
          photoURL: account.photoURL || null
        }
      });
    } catch (error) {
      console.error("[auth/profile:update]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.post("/api/auth/register", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      if (await isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. R\xE9essayez plus tard." });
      }
      const password = String(req.body?.password || "");
      const firstName = String(req.body?.firstName || "").trim();
      const lastName = String(req.body?.lastName || "").trim();
      const companyId = req.body?.companyId ? String(req.body.companyId) : null;
      const referredBy = req.body?.referredBy ? String(req.body.referredBy) : null;
      const phone = req.body?.phone ? String(req.body.phone) : null;
      if (!email || !password || !isValidEmail(email)) {
        await registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      }
      if (!isStrongPassword(password)) {
        await registerAuthFailure(authKey);
        return res.status(400).json({
          success: false,
          error: "Mot de passe insuffisant (12+ caract\xE8res, majuscule, minuscule, chiffre et symbole)."
        });
      }
      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) {
        await registerAuthFailure(authKey);
        return res.status(409).json({ success: false, error: "Cet email existe d\xE9j\xE0." });
      }
      const challengeId = (0, import_crypto2.randomUUID)().replace(/-/g, "");
      const verificationCode = generateNumericCode(6);
      const expiresAtIso = new Date(Date.now() + LOGIN_VERIFICATION_TTL_MS).toISOString();
      const passwordHash = await import_bcryptjs.default.hash(password, 10);
      await upsertDataDocument(
        "auth_register_verifications",
        challengeId,
        {
          email,
          passwordHash,
          codeHash: sha256Hex(verificationCode),
          firstName,
          lastName,
          companyId,
          referredBy,
          phone,
          attempts: 0,
          used: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          expiresAt: expiresAtIso
        },
        false
      );
      const mailResult = await sendLoginVerificationEmail({
        to: email,
        code: verificationCode
      });
      if (!mailResult.delivered) {
        await prisma.dataDocument.delete({
          where: { collectionPath_docId: { collectionPath: "auth_register_verifications", docId: challengeId } }
        });
        return res.status(503).json({
          success: false,
          error: "Service email indisponible. Configurez SMTP avant la v\xE9rification par code."
        });
      }
      await clearAuthFailures(authKey);
      return res.status(201).json({
        success: true,
        verificationRequired: true,
        challengeId
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/register]", error);
    }
  });
  app.post("/api/auth/register/verify", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const challengeId = String(req.body?.challengeId || "").trim();
      const code = String(req.body?.code || "").trim();
      if (!email || !isValidEmail(email) || !challengeId || !isSafeDocId(challengeId) || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, error: "Param\xE8tres de v\xE9rification invalides." });
      }
      const challengeRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "auth_register_verifications", docId: challengeId } }
      });
      const challenge = coerceRecord(challengeRow?.data);
      if (!challengeRow) {
        return res.status(400).json({ success: false, error: "Code invalide ou expir\xE9." });
      }
      const challengeEmail = String(challenge.email || "").trim().toLowerCase();
      const passwordHash = String(challenge.passwordHash || "");
      const firstName = String(challenge.firstName || "").trim();
      const lastName = String(challenge.lastName || "").trim();
      const companyId = challenge.companyId ? String(challenge.companyId) : null;
      const referredBy = challenge.referredBy ? String(challenge.referredBy) : null;
      const phone = challenge.phone ? String(challenge.phone) : null;
      const codeHash = String(challenge.codeHash || "");
      const used = Boolean(challenge.used);
      const attempts = Number(challenge.attempts || 0);
      const expiresAt = String(challenge.expiresAt || "");
      const expiresAtMs = Date.parse(expiresAt);
      if (!passwordHash || !codeHash || used || !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now() || challengeEmail !== email) {
        return res.status(400).json({ success: false, error: "Code invalide ou expir\xE9." });
      }
      if (attempts >= LOGIN_VERIFICATION_MAX_ATTEMPTS) {
        return res.status(429).json({ success: false, error: "Trop de tentatives sur ce code. R\xE9inscrivez-vous." });
      }
      if (sha256Hex(code) !== codeHash) {
        await prisma.dataDocument.update({
          where: { collectionPath_docId: { collectionPath: "auth_register_verifications", docId: challengeId } },
          data: {
            data: {
              ...challenge,
              attempts: attempts + 1,
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        });
        return res.status(400).json({ success: false, error: "Code invalide ou expir\xE9." });
      }
      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ success: false, error: "Cet email existe d\xE9j\xE0." });
      }
      const uid = `usr_${(0, import_crypto2.randomUUID)().replace(/-/g, "").slice(0, 20)}`;
      const account = await prisma.userAccount.create({
        data: {
          uid,
          email,
          passwordHash,
          firstName,
          lastName,
          role: "client",
          companyId,
          referredBy,
          phone,
          provider: "password",
          profile: {}
        }
      });
      await ensureUserDocumentFromAccount(account);
      await prisma.dataDocument.update({
        where: { collectionPath_docId: { collectionPath: "auth_register_verifications", docId: challengeId } },
        data: {
          data: {
            ...challenge,
            used: true,
            usedAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      });
      const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });
      setAuthCookie(res, token);
      return res.status(200).json({
        success: true,
        user: {
          uid: account.uid,
          email: account.email,
          role: account.role,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email
        }
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/register/verify]", error);
    }
  });
  app.get("/api/auth/referral", async (req, res) => {
    try {
      const refRaw = String(req.query.ref || "").trim();
      if (!refRaw) {
        return res.status(400).json({ success: false, error: "Param\xE8tre ref requis." });
      }
      const ref = normalizePartnerCode(refRaw);
      const byUid = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "users", docId: refRaw } }
      });
      if (byUid) {
        const data = coerceRecord(byUid.data);
        const role = String(data.role || "").toLowerCase();
        if (role === "partner") {
          return res.status(200).json({
            success: true,
            partner: {
              id: byUid.docId,
              firstName: typeof data.firstName === "string" ? data.firstName : "",
              lastName: typeof data.lastName === "string" ? data.lastName : "",
              email: typeof data.email === "string" ? data.email : ""
            }
          });
        }
      }
      const rows = await prisma.dataDocument.findMany({
        where: { collectionPath: "users" }
      });
      for (const row of rows) {
        const data = coerceRecord(row.data);
        const role = String(data.role || "").toLowerCase();
        if (role !== "partner") continue;
        const referralCode = normalizePartnerCode(String(data.referralCode || ""));
        const partnerCode = normalizePartnerCode(String(data.partnerCode || ""));
        const uid = String(data.uid || row.docId || "");
        const derivedCode5 = normalizePartnerCode(`PART-${uid.substring(0, 5).toUpperCase().replace("USR", "INF")}`);
        const derivedCode6 = normalizePartnerCode(`PART-${uid.substring(0, 6).toUpperCase().replace("USR", "INF")}`);
        if (referralCode === ref || partnerCode === ref || derivedCode5 === ref || derivedCode6 === ref || uid === refRaw) {
          return res.status(200).json({
            success: true,
            partner: {
              id: row.docId,
              firstName: typeof data.firstName === "string" ? data.firstName : "",
              lastName: typeof data.lastName === "string" ? data.lastName : "",
              email: typeof data.email === "string" ? data.email : ""
            }
          });
        }
      }
      return res.status(404).json({ success: false, error: "R\xE9f\xE9rence de parrainage introuvable." });
    } catch (error) {
      console.error("[auth/referral]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.post("/api/auth/referral-signup-notify", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const referralCodeRaw = String(req.body?.referralCode || "").trim();
      if (!referralCodeRaw) {
        return res.status(200).json({ success: true, skipped: true });
      }
      const referralCode = normalizePartnerCode(referralCodeRaw);
      const referredByPartnerIdRaw = String(req.body?.referredByPartnerId || "").trim();
      let referredByPartnerId = referredByPartnerIdRaw || null;
      let partnerLabel = String(req.body?.referredByPartnerName || "").trim() || "Partenaire Infinite";
      const signupUserId = String(req.body?.signupUserId || auth.uid).trim() || auth.uid;
      const firstName = String(req.body?.firstName || "").trim();
      const lastName = String(req.body?.lastName || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase();
      const phone = String(req.body?.phone || "").trim();
      const companyName = String(req.body?.companyName || "").trim() || "Prospect parrain\xE9";
      const industry = String(req.body?.industry || "").trim() || "Non sp\xE9cifi\xE9";
      if (!referredByPartnerId) {
        const partnerRows = await prisma.dataDocument.findMany({
          where: { collectionPath: "users" }
        });
        const resolvedPartner = partnerRows.find((row) => {
          const data = coerceRecord(row.data);
          const role = String(data.role || "").toLowerCase();
          if (role !== "partner") return false;
          const referral = normalizePartnerCode(String(data.referralCode || ""));
          const partnerCode = normalizePartnerCode(String(data.partnerCode || ""));
          const uid = String(data.uid || row.docId || "");
          const derivedCode5 = normalizePartnerCode(`PART-${uid.substring(0, 5).toUpperCase().replace("USR", "INF")}`);
          const derivedCode6 = normalizePartnerCode(`PART-${uid.substring(0, 6).toUpperCase().replace("USR", "INF")}`);
          return referral === referralCode || partnerCode === referralCode || derivedCode5 === referralCode || derivedCode6 === referralCode || uid === referralCodeRaw;
        });
        if (resolvedPartner) {
          const partnerData = coerceRecord(resolvedPartner.data);
          referredByPartnerId = resolvedPartner.docId;
          const resolvedName = `${String(partnerData.firstName || "")} ${String(partnerData.lastName || "")}`.trim();
          partnerLabel = resolvedName || String(partnerData.email || "") || partnerLabel;
        }
      }
      if (signupUserId) {
        const userPatch = {
          referredBy: referralCode,
          referredByPartnerName: partnerLabel
        };
        if (referredByPartnerId) userPatch.referredByPartnerId = referredByPartnerId;
        await upsertDataDocument("users", signupUserId, userPatch, true);
      }
      const message = `Inscription via le lien de ${partnerLabel}: ${firstName} ${lastName} (${companyName}) - ${industry} - ${phone} - ref: ${referralCode}`;
      const metadata = {
        referralCode,
        referredByPartnerId,
        referredByPartnerName: partnerLabel,
        source: "referral_signup",
        signupUserId,
        firstName,
        lastName,
        email,
        phone,
        companyName,
        industry,
        leadCreated: false
      };
      const recipients = await prisma.userAccount.findMany({
        where: { role: { in: ["commando", "admin"] } },
        select: { uid: true }
      });
      const recipientIds = recipients.map((r) => r.uid).filter(Boolean);
      const finalRecipients = recipientIds.length > 0 ? recipientIds : ["admin_general"];
      await Promise.all(
        finalRecipients.map(
          (recipientId) => upsertDataDocument(
            "notifications",
            (0, import_crypto2.randomUUID)().replace(/-/g, ""),
            {
              userId: recipientId,
              title: "Nouveau formulaire parrainage",
              message,
              type: "order",
              read: false,
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              metadata
            },
            false
          )
        )
      );
      let leadCreated = false;
      if (referredByPartnerId && email) {
        const allLeads = await prisma.dataDocument.findMany({
          where: { collectionPath: "leads" }
        });
        const alreadyExists = allLeads.some((row) => {
          const data = coerceRecord(row.data);
          return String(data.partnerId || "") === referredByPartnerId && String(data.email || "").trim().toLowerCase() === email;
        });
        if (!alreadyExists) {
          const leadId = (0, import_crypto2.randomUUID)().replace(/-/g, "");
          await upsertDataDocument(
            "leads",
            leadId,
            {
              id: leadId,
              partnerId: referredByPartnerId,
              partnerName: partnerLabel,
              firstName,
              lastName,
              email,
              companyName,
              sector: industry,
              city: "Non sp\xE9cifi\xE9e",
              employeesRange: "1-5",
              urgency: "moyenne",
              whatsapp: phone || "Non renseign\xE9",
              phone: phone || "Non renseign\xE9",
              note: `Inscription via lien de parrainage (${referralCode}).`,
              status: "soumis",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            false
          );
          leadCreated = true;
        }
      }
      return res.status(200).json({
        success: true,
        notified: finalRecipients.length,
        leadCreated
      });
    } catch (error) {
      console.error("[auth/referral-signup-notify]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    const loginT0 = Date.now();
    try {
      if (!appEnv.database.url) {
        return res.status(503).json({
          success: false,
          error: "Base de donn\xE9es non configur\xE9e (DATABASE_URL). L\u2019authentification est indisponible."
        });
      }
      const email = String(req.body?.email || "").trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      agentSessionLog({
        runId: "initial",
        hypothesisId: "H5",
        location: "mongoApi.ts:/api/auth/login:entry",
        message: "auth_login_entry",
        data: {
          hasDatabaseUrl: !!appEnv.database.url,
          emailDomain: email.includes("@") ? email.split("@")[1] : "invalid"
        }
      });
      if (await isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. R\xE9essayez plus tard." });
      }
      const password = String(req.body?.password || "");
      if (!email || !password || !isValidEmail(email)) {
        await registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      }
      const dbLookupT0 = Date.now();
      const account = await prisma.userAccount.findUnique({ where: { email } });
      agentSessionLog({
        runId: "initial",
        hypothesisId: "H5",
        location: "mongoApi.ts:/api/auth/login:after_findUnique",
        message: "auth_login_db_lookup_done",
        data: {
          dbLookupMs: Date.now() - dbLookupT0,
          totalElapsedMs: Date.now() - loginT0,
          foundAccount: !!account,
          hasPasswordHash: !!account?.passwordHash
        }
      });
      if (!account || !account.passwordHash) {
        await registerAuthFailure(authKey);
        return res.status(401).json({ success: false, error: "Identifiants invalides." });
      }
      const bcryptT0 = Date.now();
      const valid = await import_bcryptjs.default.compare(password, account.passwordHash);
      agentSessionLog({
        runId: "initial",
        hypothesisId: "H6",
        location: "mongoApi.ts:/api/auth/login:after_bcrypt_compare",
        message: "auth_login_bcrypt_done",
        data: {
          bcryptMs: Date.now() - bcryptT0,
          totalElapsedMs: Date.now() - loginT0,
          passwordValid: valid
        }
      });
      if (!valid) {
        await registerAuthFailure(authKey);
        return res.status(401).json({ success: false, error: "Identifiants invalides." });
      }
      const challengeId = (0, import_crypto2.randomUUID)().replace(/-/g, "");
      const verificationCode = generateNumericCode(6);
      const expiresAtIso = new Date(Date.now() + LOGIN_VERIFICATION_TTL_MS).toISOString();
      await upsertDataDocument(
        "auth_login_verifications",
        challengeId,
        {
          uid: account.uid,
          email: account.email,
          codeHash: sha256Hex(verificationCode),
          attempts: 0,
          used: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          expiresAt: expiresAtIso
        },
        false
      );
      const mailResult = await sendLoginVerificationEmail({
        to: account.email,
        code: verificationCode
      });
      if (!mailResult.delivered) {
        await prisma.dataDocument.delete({
          where: { collectionPath_docId: { collectionPath: "auth_login_verifications", docId: challengeId } }
        });
        return res.status(503).json({
          success: false,
          error: "Service email indisponible. Configurez SMTP avant la v\xE9rification par code."
        });
      }
      await clearAuthFailures(authKey);
      return res.status(200).json({
        success: true,
        verificationRequired: true,
        challengeId
      });
    } catch (error) {
      agentSessionLog({
        runId: "initial",
        hypothesisId: "H5",
        location: "mongoApi.ts:/api/auth/login:catch",
        message: "auth_login_exception",
        data: {
          totalElapsedMs: Date.now() - loginT0,
          errMessage: error instanceof Error ? error.message : String(error)
        }
      });
      return sendAuthPrismaError(res, "[auth/login]", error);
    }
  });
  app.post("/api/auth/logout", async (_req, res) => {
    clearAuthCookie(res);
    return res.status(200).json({ success: true });
  });
  app.post("/api/auth/login/verify", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const challengeId = String(req.body?.challengeId || "").trim();
      const code = String(req.body?.code || "").trim();
      if (!email || !isValidEmail(email) || !challengeId || !isSafeDocId(challengeId) || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, error: "Param\xE8tres de v\xE9rification invalides." });
      }
      const challengeRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "auth_login_verifications", docId: challengeId } }
      });
      const challenge = coerceRecord(challengeRow?.data);
      if (!challengeRow) {
        return res.status(400).json({ success: false, error: "Code invalide ou expir\xE9." });
      }
      const challengeEmail = String(challenge.email || "").trim().toLowerCase();
      const challengeUid = String(challenge.uid || "").trim();
      const codeHash = String(challenge.codeHash || "");
      const used = Boolean(challenge.used);
      const attempts = Number(challenge.attempts || 0);
      const expiresAt = String(challenge.expiresAt || "");
      const expiresAtMs = Date.parse(expiresAt);
      if (!challengeUid || !codeHash || used || !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now() || challengeEmail !== email) {
        return res.status(400).json({ success: false, error: "Code invalide ou expir\xE9." });
      }
      if (attempts >= LOGIN_VERIFICATION_MAX_ATTEMPTS) {
        return res.status(429).json({ success: false, error: "Trop de tentatives sur ce code. Reconnectez-vous." });
      }
      if (sha256Hex(code) !== codeHash) {
        await prisma.dataDocument.update({
          where: { collectionPath_docId: { collectionPath: "auth_login_verifications", docId: challengeId } },
          data: {
            data: {
              ...challenge,
              attempts: attempts + 1,
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          }
        });
        return res.status(400).json({ success: false, error: "Code invalide ou expir\xE9." });
      }
      const account = await prisma.userAccount.findUnique({ where: { uid: challengeUid } });
      if (!account || account.email.toLowerCase() !== email) {
        return res.status(401).json({ success: false, error: "Compte introuvable." });
      }
      await ensureUserDocumentFromAccount(account);
      await prisma.dataDocument.update({
        where: { collectionPath_docId: { collectionPath: "auth_login_verifications", docId: challengeId } },
        data: {
          data: {
            ...challenge,
            used: true,
            usedAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      });
      const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });
      setAuthCookie(res, token);
      return res.status(200).json({
        success: true,
        user: {
          uid: account.uid,
          email: account.email,
          role: account.role,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email
        }
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/login/verify]", error);
    }
  });
  app.post("/api/auth/google", async (req, res) => {
    try {
      const staffOnly = Boolean(req.body?.staffOnly);
      const accessToken = String(req.body?.accessToken || "").trim();
      const displayNameBody = String(req.body?.displayName || "").trim();
      const companyName = String(req.body?.companyName || "").trim();
      const industry = String(req.body?.industry || "").trim();
      const size = String(req.body?.size || "").trim();
      const referredBy = req.body?.referredBy ? String(req.body.referredBy) : null;
      const referredByPartnerId = req.body?.referredByPartnerId ? String(req.body.referredByPartnerId) : null;
      const referredByPartnerName = req.body?.referredByPartnerName ? String(req.body.referredByPartnerName) : null;
      let email = "";
      let googlePicture = null;
      let googleDisplayHint = "";
      if (accessToken) {
        try {
          const prof = await googleUserProfileFromAccessToken(accessToken);
          email = prof.email;
          googlePicture = prof.picture;
          googleDisplayHint = prof.displayNameHint;
        } catch {
          return res.status(401).json({
            success: false,
            error: "Impossible de v\xE9rifier le compte Google (jeton invalide ou email non v\xE9rifi\xE9)."
          });
        }
      } else {
        email = String(req.body?.email || "").trim().toLowerCase();
      }
      const authKey = authBucketKey(req, email);
      if (await isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. R\xE9essayez plus tard." });
      }
      if (!email || !isValidEmail(email)) {
        if (accessToken) {
          return res.status(401).json({ success: false, error: "Profil Google invalide." });
        }
        await registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email requis." });
      }
      if (staffOnly) {
        const existingForStaff = await prisma.userAccount.findUnique({ where: { email } });
        if (!existingForStaff) {
          await registerAuthFailure(authKey);
          return res.status(403).json({
            success: false,
            error: "Aucun compte \xE9quipe associ\xE9 \xE0 cet identifiant Google."
          });
        }
        if (existingForStaff.role !== "admin" && existingForStaff.role !== "commando") {
          await registerAuthFailure(authKey);
          return res.status(403).json({
            success: false,
            error: "Ce compte n'a pas acc\xE8s \xE0 l'espace \xE9quipe (commando ou admin uniquement)."
          });
        }
      }
      const displayName = (displayNameBody || googleDisplayHint || email.split("@")[0] || email).trim() || email;
      let account = await prisma.userAccount.findUnique({ where: { email } });
      const isNew = !account;
      if (!account) {
        const [firstName = "", ...last] = displayName.split(" ");
        const uid = `usr_${(0, import_crypto2.randomUUID)().replace(/-/g, "").slice(0, 20)}`;
        let companyId = null;
        if (companyName) {
          companyId = `comp_${Date.now()}`;
          await upsertDataDocument(
            "companies",
            companyId,
            {
              id: companyId,
              name: companyName,
              industry: industry || "Non sp\xE9cifi\xE9",
              size: size || "1-5",
              pack: "starter",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            false
          );
        }
        account = await prisma.userAccount.create({
          data: {
            uid,
            email,
            firstName,
            lastName: last.join(" "),
            role: "client",
            provider: "google",
            companyId,
            referredBy,
            profile: {}
          }
        });
      }
      const profileData = {
        uid: account.uid,
        email: account.email,
        firstName: account.firstName || "",
        lastName: account.lastName || "",
        role: account.role,
        createdAt: account.createdAt.toISOString()
      };
      if (isNew) {
        if (account.companyId) profileData.companyId = account.companyId;
        if (referredBy) profileData.referredBy = referredBy;
        if (referredByPartnerId) profileData.referredByPartnerId = referredByPartnerId;
        if (referredByPartnerName) profileData.referredByPartnerName = referredByPartnerName;
      }
      if (googlePicture) {
        profileData.photoURL = googlePicture;
      }
      await upsertDataDocument("users", account.uid, profileData, true);
      if (accessToken) {
        await clearAuthFailures(authKey);
        const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });
        setAuthCookie(res, token);
        const displayNameOut = [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email;
        return res.status(200).json({
          success: true,
          user: {
            uid: account.uid,
            email: account.email,
            role: account.role,
            displayName: displayNameOut,
            photoURL: googlePicture || null
          },
          isNew
        });
      }
      const challengeId = (0, import_crypto2.randomUUID)().replace(/-/g, "");
      const verificationCode = generateNumericCode(6);
      const expiresAtIso = new Date(Date.now() + LOGIN_VERIFICATION_TTL_MS).toISOString();
      await upsertDataDocument(
        "auth_login_verifications",
        challengeId,
        {
          uid: account.uid,
          email: account.email,
          codeHash: sha256Hex(verificationCode),
          attempts: 0,
          used: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          expiresAt: expiresAtIso
        },
        false
      );
      const mailResult = await sendLoginVerificationEmail({
        to: account.email,
        code: verificationCode
      });
      if (!mailResult.delivered) {
        await prisma.dataDocument.delete({
          where: { collectionPath_docId: { collectionPath: "auth_login_verifications", docId: challengeId } }
        });
        return res.status(503).json({
          success: false,
          error: "Service email indisponible. Configurez SMTP avant la v\xE9rification par code."
        });
      }
      await clearAuthFailures(authKey);
      return res.status(200).json({
        success: true,
        verificationRequired: true,
        challengeId,
        isNew,
        email: account.email,
        role: account.role
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/google]", error);
    }
  });
  app.post("/api/auth/admin-create", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (!auth || auth.role !== "admin") {
        return res.status(403).json({ success: false, error: "Acc\xE8s refus\xE9." });
      }
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const requestedRole = String(req.body?.role || "client").trim().toLowerCase();
      const role = VALID_ROLES.has(requestedRole) ? requestedRole : "client";
      if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, error: "Email requis." });
      const generatedPassword = password || (0, import_crypto2.randomUUID)().replace(/-/g, "").slice(0, 16);
      if (password && !isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          error: "Mot de passe insuffisant (12+ caract\xE8res, majuscule, minuscule, chiffre et symbole)."
        });
      }
      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ success: false, error: "Cet email est d\xE9j\xE0 utilis\xE9." });
      }
      const uid = `usr_${(0, import_crypto2.randomUUID)().replace(/-/g, "").slice(0, 20)}`;
      const passwordHash = await import_bcryptjs.default.hash(generatedPassword, 10);
      const account = await prisma.userAccount.create({
        data: {
          uid,
          email,
          passwordHash,
          role,
          provider: "password",
          profile: {}
        }
      });
      await ensureUserDocumentFromAccount(account);
      const resetToken = (0, import_crypto2.randomBytes)(32).toString("hex");
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const expiresAtIso = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
      await upsertDataDocument(
        "auth_password_resets",
        account.uid,
        {
          uid: account.uid,
          email: account.email,
          tokenHash: sha256Hex(resetToken),
          requestedAt: nowIso,
          expiresAt: expiresAtIso,
          used: false,
          requestedByAdminUid: auth.uid
        },
        false
      );
      const mailResult = await sendResetPasswordEmail({ to: account.email, token: resetToken });
      if (!mailResult.delivered) {
        await prisma.userAccount.delete({ where: { uid: account.uid } });
        await prisma.dataDocument.deleteMany({
          where: {
            collectionPath: { in: ["users", "auth_password_resets"] },
            docId: account.uid
          }
        });
        return res.status(503).json({
          success: false,
          error: "Le compte n'a pas \xE9t\xE9 cr\xE9\xE9: SMTP est requis pour envoyer l'email d'initialisation."
        });
      }
      return res.status(201).json({
        success: true,
        uid: account.uid,
        invitationSent: true,
        ...!appEnv.node.isProduction ? { resetTokenPreview: resetToken } : {}
      });
    } catch (error) {
      console.error("[auth/admin-create]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.post("/api/auth/password-reset/request", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email || !isValidEmail(email)) {
        return res.status(200).json({
          success: true,
          message: "Si ce compte existe, les instructions de r\xE9initialisation ont \xE9t\xE9 enregistr\xE9es."
        });
      }
      const account = await prisma.userAccount.findUnique({
        where: { email },
        select: { uid: true, email: true, provider: true }
      });
      if (!account || account.provider === "google") {
        return res.status(200).json({
          success: true,
          message: "Si ce compte existe, les instructions de r\xE9initialisation ont \xE9t\xE9 enregistr\xE9es."
        });
      }
      const resetToken = (0, import_crypto2.randomBytes)(32).toString("hex");
      const resetDocId = account.uid;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const expiresAtIso = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
      await upsertDataDocument(
        "auth_password_resets",
        resetDocId,
        {
          uid: account.uid,
          email: account.email,
          tokenHash: sha256Hex(resetToken),
          requestedAt: nowIso,
          expiresAt: expiresAtIso,
          used: false
        },
        false
      );
      const mailResult = await sendResetPasswordEmail({ to: account.email, token: resetToken });
      return res.status(200).json({
        success: true,
        message: "Si ce compte existe, les instructions de r\xE9initialisation ont \xE9t\xE9 enregistr\xE9es.",
        ...!appEnv.node.isProduction ? { resetTokenPreview: resetToken } : {},
        ...!appEnv.node.isProduction && !mailResult.delivered ? { resetLinkPreview: mailResult.previewLink } : {}
      });
    } catch (error) {
      console.error("[auth/password-reset/request]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.post("/api/auth/password-reset/confirm", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const token = String(req.body?.token || "").trim();
      const newPassword = String(req.body?.newPassword || "");
      if (!email || !token || !newPassword || !isValidEmail(email) || !isStrongPassword(newPassword)) {
        return res.status(400).json({ success: false, error: "Param\xE8tres de r\xE9initialisation invalides." });
      }
      const account = await prisma.userAccount.findUnique({
        where: { email },
        select: { uid: true, email: true, provider: true }
      });
      if (!account || account.provider === "google") {
        return res.status(400).json({ success: false, error: "Token invalide ou expir\xE9." });
      }
      const resetRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "auth_password_resets", docId: account.uid } }
      });
      const resetData = coerceRecord(resetRow?.data);
      const tokenHash = typeof resetData.tokenHash === "string" ? resetData.tokenHash : "";
      const expiresAt = typeof resetData.expiresAt === "string" ? resetData.expiresAt : "";
      const used = Boolean(resetData.used);
      if (!tokenHash || !expiresAt || used) {
        return res.status(400).json({ success: false, error: "Token invalide ou expir\xE9." });
      }
      const expiresAtMs = Date.parse(expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
        return res.status(400).json({ success: false, error: "Token invalide ou expir\xE9." });
      }
      if (sha256Hex(token) !== tokenHash) {
        return res.status(400).json({ success: false, error: "Token invalide ou expir\xE9." });
      }
      const passwordHash = await import_bcryptjs.default.hash(newPassword, 12);
      await prisma.userAccount.update({
        where: { uid: account.uid },
        data: { passwordHash }
      });
      await upsertDataDocument(
        "auth_password_resets",
        account.uid,
        {
          ...resetData,
          used: true,
          usedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        false
      );
      return res.status(200).json({ success: true, message: "Mot de passe r\xE9initialis\xE9 avec succ\xE8s." });
    } catch (error) {
      console.error("[auth/password-reset/confirm]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  registerDataRoutes(app, {
    prisma,
    requireAuth,
    normalizeCollectionPath,
    isSafeCollectionPath,
    isSafeDocId,
    isSafeFieldName: (fieldName) => SAFE_FIELD_NAME.test(fieldName),
    sanitizeFilters,
    sanitizeOrders,
    assertDataQueryAuthorized,
    assertDataDocAuthorized,
    coerceRecord,
    applyFilters,
    applyOrder,
    upsertDataDocument
  });
}

// server.ts
var ALLOWED_UPLOAD_MIME_TYPES = /* @__PURE__ */ new Set([
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
  "application/octet-stream"
]);
var ALLOWED_UPLOAD_EXTENSIONS = /* @__PURE__ */ new Set([
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
  ".csv"
]);
function isAllowedUpload(file) {
  const ext = import_path2.default.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype || "")) return false;
  return true;
}
function secureSecretEquals(expected, provided) {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return (0, import_crypto3.timingSafeEqual)(expectedBuf, providedBuf);
}
async function readAuthenticatedUser(req) {
  const auth = parseAuthFromRequest(req);
  if (!auth) return null;
  return resolveAuthPayload(auth);
}
async function requireAuthenticatedUser(req, res, next) {
  try {
    const auth = await readAuthenticatedUser(req);
    if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
    return next();
  } catch (error) {
    console.error("[auth] middleware user:", error);
    return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
  }
}
async function requireAdminUser(req, res, next) {
  try {
    const auth = await readAuthenticatedUser(req);
    if (!auth) return res.status(401).json({ success: false, error: "Non authentifie." });
    if (auth.role !== "admin") return res.status(403).json({ success: false, error: "Acces refuse." });
    return next();
  } catch (error) {
    console.error("[auth] middleware admin:", error);
    return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
  }
}
async function createExpressApplication() {
  const app = (0, import_express.default)();
  const port = appEnv.http.port;
  const corsOrigins = parseCorsOrigins(appEnv.http.corsOriginRaw);
  const paddeWebhookSecret = appEnv.webhooks.paddeWebhookSecret;
  const r2AccountId = appEnv.r2.accountId;
  const r2AccessKeyId = appEnv.r2.accessKeyId;
  const r2SecretAccessKey = appEnv.r2.secretAccessKey;
  const r2Bucket = appEnv.r2.bucket;
  const r2PublicBaseUrl = appEnv.r2.publicBaseUrl;
  const r2Endpoint = appEnv.r2.endpointRaw || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : "");
  const canUseR2 = Boolean(r2Endpoint && r2AccessKeyId && r2SecretAccessKey && r2Bucket);
  if (!canUseR2) {
    console.warn(
      "[upload] Variables R2 absentes \u2014 mode d\xE9veloppement : fichiers dans .local-uploads/ (non utilis\xE9 en prod sans R2)."
    );
  }
  app.use(
    (0, import_cors.default)({
      origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        agentSessionLog({
          hypothesisId: "H6",
          location: "server.ts:cors",
          message: "cors_origin_rejected",
          data: { origin, allowedOriginsCount: corsOrigins.length }
        });
        return callback(null, false);
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS", "PUT", "HEAD"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true
    })
  );
  app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(import_express.default.json({ limit: "1mb", strict: true }));
  app.use((req, res, next) => {
    const requestId = (0, import_crypto3.randomUUID)();
    req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  });
  app.use((req, res, next) => {
    const start = Date.now();
    const routePath = (req.path || req.url?.split("?")[0] || "").slice(0, 160);
    const requestId = String(req.headers["x-request-id"] || "unknown");
    res.on("finish", () => {
      agentSessionLog({
        hypothesisId: "H5",
        location: "server.ts:request_timing",
        message: "express_request_finish",
        data: {
          method: req.method,
          path: routePath,
          status: res.statusCode,
          durationMs: Date.now() - start,
          requestId
        }
      });
    });
    next();
  });
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  registerMongoApi(app);
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
  const uploadSingleWithHandling = (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (!error) return next();
      if (error instanceof import_multer.default.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            error: "Fichier trop volumineux (max 50MB)."
          });
        }
        return res.status(400).json({
          success: false,
          error: `Upload invalide: ${error.message}`
        });
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[upload] middleware:", msg);
      return res.status(400).json({ success: false, error: "Requ\xEAte d'upload invalide." });
    });
  };
  app.post("/api/files/upload", requireAuthenticatedUser, uploadSingleWithHandling, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Aucun fichier re\xE7u." });
      }
      if (!isAllowedUpload(req.file)) {
        return res.status(415).json({
          success: false,
          error: "Type de fichier non autoris\xE9. Formats accept\xE9s: PDF, Office, JPG/PNG/WEBP, TXT/CSV."
        });
      }
      const folderRaw = typeof req.body?.folder === "string" ? req.body.folder : "misc";
      const folder = sanitizeFolder(folderRaw);
      const safeOriginal = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${folder}/${Date.now()}-${(0, import_crypto3.randomUUID)()}-${safeOriginal}`;
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
        const fileUrl2 = r2PublicBaseUrl ? `${r2PublicBaseUrl.replace(/\/$/, "")}/${objectKey}` : buildFileUrl(objectKey);
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
      const fileUrl = buildFileUrl(objectKey);
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
      const msg = error instanceof Error && !appEnv.node.isProduction ? `Erreur interne du serveur. ${error.message}` : "Erreur interne du serveur.";
      return res.status(500).json({ success: false, error: msg });
    }
  });
  app.delete("/api/files", requireAuthenticatedUser, async (req, res) => {
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
  app.get("/api/files/download", requireAuthenticatedUser, async (req, res) => {
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
  app.post("/api/webhooks/padde-ci", async (req, res) => {
    try {
      if (paddeWebhookSecret) {
        const provided = String(req.headers["x-webhook-secret"] || "");
        if (!provided || !secureSecretEquals(paddeWebhookSecret, provided)) {
          return res.status(401).json({ success: false, error: "Webhook non autoris\xE9." });
        }
      }
      if (!appEnv.database.url) {
        return res.status(503).json({
          success: false,
          error: "Base de donn\xE9es non configur\xE9e : d\xE9finissez DATABASE_URL (MongoDB) pour Prisma."
        });
      }
      const data = req.body;
      const auditId = `PADDE-${Math.floor(1e3 + Math.random() * 9e3)}`;
      await prisma.paddeCiAudit.create({
        data: {
          id: auditId,
          payload: data ?? {},
          processed: false
        }
      });
      res.status(200).json({ success: true, message: "Demande d'audit re\xE7ue et trait\xE9e avec succ\xE8s." });
    } catch (error) {
      console.error("Erreur Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.get("/api/webhooks/padde-ci", requireAdminUser, async (req, res) => {
    try {
      if (!appEnv.database.url) {
        return res.status(503).json({ success: false, error: "Base de donn\xE9es non configur\xE9e (DATABASE_URL)." });
      }
      const rows = await prisma.paddeCiAudit.findMany({
        orderBy: { createdAt: "desc" },
        take: 500
      });
      const audits = rows.map((row) => {
        const payload = row.payload;
        const typeFromPayload = typeof payload?.type === "string" ? payload.type : typeof payload?.type_audit === "string" ? payload.type_audit : "audit-inconnu";
        return {
          id: row.id,
          type_audit: typeFromPayload,
          date: row.createdAt.toISOString(),
          donnees_completes: payload ?? {}
        };
      });
      res.status(200).json(audits);
    } catch (error) {
      console.error("Erreur GET Webhook PADDE-CI:", error);
      res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  return { app, port };
}
async function startServer() {
  const { app, port } = await createExpressApplication();
  app.listen(port, "0.0.0.0", () => {
    console.log(`[infinitecore-api] http://0.0.0.0:${port}`);
  });
}
if (process.env.START_LISTEN === "1") {
  void startServer();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createExpressApplication
});
