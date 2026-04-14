"use strict";
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
var import_path3 = __toESM(require("path"), 1);
var import_fs2 = require("fs");
var import_multer = __toESM(require("multer"), 1);
var import_crypto2 = require("crypto");
var import_client_s32 = require("@aws-sdk/client-s3");
var import_s3_request_presigner2 = require("@aws-sdk/s3-request-presigner");

// prismaClient.ts
var import_fs = require("fs");
var import_path = __toESM(require("path"), 1);
var import_client = require("@prisma/client");
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
function loadEnvFromDotEnv() {
  const root = process.cwd();
  const envPath = import_path.default.join(root, ".env");
  const localPath = import_path.default.join(root, ".env.local");
  if ((0, import_fs.existsSync)(envPath)) {
    parseDotEnvFile((0, import_fs.readFileSync)(envPath, "utf8"), false);
  }
  if ((0, import_fs.existsSync)(localPath)) {
    parseDotEnvFile((0, import_fs.readFileSync)(localPath, "utf8"), true);
  }
}
loadEnvFromDotEnv();
function withMongoDriverTimeouts(databaseUrl) {
  const trimmed = databaseUrl.trim();
  if (!trimmed || /serverSelectionTimeoutMS=/i.test(trimmed)) return trimmed;
  const ms = process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS?.trim() || (process.env.NODE_ENV === "development" ? "10000" : "20000");
  const sep = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${sep}serverSelectionTimeoutMS=${encodeURIComponent(ms)}&connectTimeoutMS=${encodeURIComponent(ms)}`;
}
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new import_client.PrismaClient({
  datasources: {
    db: { url: withMongoDriverTimeouts(process.env.DATABASE_URL ?? "") }
  },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

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
var apiPublicBase = normalizeUrl(cleanEnv(process.env.API_PUBLIC_URL)).replace(/\/$/, "");
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
var import_path2 = __toESM(require("path"), 1);
var LOCAL_UPLOADS_DIR = ".local-uploads";
function getLocalUploadsBase() {
  return import_path2.default.resolve(process.cwd(), LOCAL_UPLOADS_DIR);
}
function resolveLocalUploadFile(safeRelPath) {
  const normalized = sanitizeObjectKey(String(safeRelPath).replace(/\\/g, "/"));
  const base = getLocalUploadsBase();
  const full = import_path2.default.resolve(base, normalized);
  const baseSep = base.endsWith(import_path2.default.sep) ? base : base + import_path2.default.sep;
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
  const ext = import_path2.default.extname(keyOrPath).toLowerCase();
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
var import_crypto = require("crypto");
var AUTH_HEADER_PREFIX = "Bearer ";
var JWT_ISSUER = process.env.JWT_ISSUER || "infinitecore-api";
var JWT_AUDIENCE = process.env.JWT_AUDIENCE || "infinitecore-web";
var SAFE_COLLECTION_SEGMENT = /^[A-Za-z0-9_-]{1,120}$/;
var SAFE_DOC_ID = /^[A-Za-z0-9._:-]{1,180}$/;
var SAFE_FIELD_NAME = /^[A-Za-z0-9_.-]{1,120}$/;
var MAX_FILTERS = 12;
var MAX_ORDERS = 6;
var AUTH_RATE_WINDOW_MS = 15 * 60 * 1e3;
var AUTH_RATE_MAX_FAILURES = 8;
var AUTH_RATE_BLOCK_MS = 20 * 60 * 1e3;
var RESET_TOKEN_TTL_MS = 30 * 60 * 1e3;
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
function getResetAppBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
}
function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !Number.isFinite(port) || !user || !pass) return null;
  smtpTransport = import_nodemailer.default.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: { user, pass }
  });
  return smtpTransport;
}
async function sendResetPasswordEmail(input) {
  const transporter = getSmtpTransport();
  const resetLink = `${getResetAppBaseUrl()}/reset-password?email=${encodeURIComponent(input.to)}&token=${encodeURIComponent(input.token)}`;
  if (!transporter) {
    return { delivered: false, previewLink: resetLink };
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@infinitecore.local",
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
function getJwtSecret() {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret) return envSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET est requis en production.");
  }
  return "dev-secret-change-me";
}
function signAuthToken(payload) {
  return import_jsonwebtoken.default.sign(payload, getJwtSecret(), {
    expiresIn: "7d",
    algorithm: "HS256",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}
function readAuthToken(req) {
  const raw = req.headers.authorization;
  if (!raw || !raw.startsWith(AUTH_HEADER_PREFIX)) return null;
  return raw.slice(AUTH_HEADER_PREFIX.length).trim();
}
function parseAuth(req) {
  const token = readAuthToken(req);
  if (!token) return null;
  try {
    const decoded = import_jsonwebtoken.default.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    if (!decoded || typeof decoded.uid !== "string" || typeof decoded.email !== "string" || typeof decoded.role !== "string") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
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
  return (0, import_crypto.createHash)("sha256").update(input).digest("hex");
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
function isAuthTemporarilyBlocked(key) {
  const now = Date.now();
  const bucket2 = authFailureBuckets.get(key);
  if (!bucket2) return false;
  if (bucket2.blockedUntil > now) return true;
  if (bucket2.windowEndsAt < now) {
    authFailureBuckets.delete(key);
  }
  return false;
}
function registerAuthFailure(key) {
  const now = Date.now();
  const bucket2 = authFailureBuckets.get(key);
  if (!bucket2 || bucket2.windowEndsAt < now) {
    authFailureBuckets.set(key, {
      failures: 1,
      windowEndsAt: now + AUTH_RATE_WINDOW_MS,
      blockedUntil: 0
    });
    return;
  }
  bucket2.failures += 1;
  if (bucket2.failures >= AUTH_RATE_MAX_FAILURES) {
    bucket2.blockedUntil = now + AUTH_RATE_BLOCK_MS;
  }
}
function clearAuthFailures(key) {
  authFailureBuckets.delete(key);
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
      "admin_config",
      "instances",
      "leads",
      "service_types",
      "padde_ci_audits",
      "tasks"
    ];
  }
  if (role === "developer") {
    return ["users", "notifications", "missions", "chats"];
  }
  if (role === "partner") {
    return ["users", "notifications", "leads", "missions", "payments", "orders", "chats"];
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
          ...profile
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
      if (isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. R\xE9essayez plus tard." });
      }
      const password = String(req.body?.password || "");
      const firstName = String(req.body?.firstName || "").trim();
      const lastName = String(req.body?.lastName || "").trim();
      const companyId = req.body?.companyId ? String(req.body.companyId) : null;
      const referredBy = req.body?.referredBy ? String(req.body.referredBy) : null;
      const phone = req.body?.phone ? String(req.body.phone) : null;
      if (!email || !password || !isValidEmail(email)) {
        registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      }
      if (!isStrongPassword(password)) {
        registerAuthFailure(authKey);
        return res.status(400).json({
          success: false,
          error: "Mot de passe insuffisant (12+ caract\xE8res, majuscule, minuscule, chiffre et symbole)."
        });
      }
      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) {
        registerAuthFailure(authKey);
        return res.status(409).json({ success: false, error: "Cet email existe d\xE9j\xE0." });
      }
      const uid = `usr_${(0, import_crypto.randomUUID)().replace(/-/g, "").slice(0, 20)}`;
      const passwordHash = await import_bcryptjs.default.hash(password, 10);
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
      const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });
      clearAuthFailures(authKey);
      return res.status(201).json({
        success: true,
        token,
        user: {
          uid: account.uid,
          email: account.email,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email
        }
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/register]", error);
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      if (isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. R\xE9essayez plus tard." });
      }
      const password = String(req.body?.password || "");
      if (!email || !password || !isValidEmail(email)) {
        registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      }
      const account = await prisma.userAccount.findUnique({ where: { email } });
      if (!account || !account.passwordHash) {
        registerAuthFailure(authKey);
        return res.status(401).json({ success: false, error: "Identifiants invalides." });
      }
      const valid = await import_bcryptjs.default.compare(password, account.passwordHash);
      if (!valid) {
        registerAuthFailure(authKey);
        return res.status(401).json({ success: false, error: "Identifiants invalides." });
      }
      await ensureUserDocumentFromAccount(account);
      const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });
      clearAuthFailures(authKey);
      return res.status(200).json({
        success: true,
        token,
        user: {
          uid: account.uid,
          email: account.email,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email
        }
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/login]", error);
    }
  });
  app.post("/api/auth/logout", async (_req, res) => {
    return res.status(200).json({ success: true });
  });
  app.post("/api/auth/google", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      if (isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. R\xE9essayez plus tard." });
      }
      const displayName = String(req.body?.displayName || "").trim();
      if (!email || !isValidEmail(email)) {
        registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email requis." });
      }
      let account = await prisma.userAccount.findUnique({ where: { email } });
      if (!account) {
        const [firstName = "", ...last] = displayName.split(" ");
        const uid = `usr_${(0, import_crypto.randomUUID)().replace(/-/g, "").slice(0, 20)}`;
        account = await prisma.userAccount.create({
          data: {
            uid,
            email,
            firstName,
            lastName: last.join(" "),
            role: "client",
            provider: "google",
            profile: {}
          }
        });
      }
      await ensureUserDocumentFromAccount(account);
      const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });
      clearAuthFailures(authKey);
      return res.status(200).json({
        success: true,
        token,
        user: {
          uid: account.uid,
          email: account.email,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email
        }
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
      const generatedPassword = password || (0, import_crypto.randomUUID)().replace(/-/g, "").slice(0, 16);
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
      const uid = `usr_${(0, import_crypto.randomUUID)().replace(/-/g, "").slice(0, 20)}`;
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
      return res.status(201).json({ success: true, uid: account.uid, password: generatedPassword });
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
      const resetToken = (0, import_crypto.randomBytes)(32).toString("hex");
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
        ...process.env.NODE_ENV !== "production" ? { resetTokenPreview: resetToken } : {},
        ...process.env.NODE_ENV !== "production" && !mailResult.delivered ? { resetLinkPreview: mailResult.previewLink } : {}
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
  app.post("/api/data/query", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const filters = sanitizeFilters(req.body?.filters);
      const orders = sanitizeOrders(req.body?.orders);
      const max = Number(req.body?.limit);
      const take = Number.isFinite(max) && max > 0 ? Math.min(max, 5e3) : void 0;
      if (!collectionPath || !isSafeCollectionPath(collectionPath) || filters === null || orders === null) {
        return res.status(400).json({ success: false, error: "Param\xE8tres de requ\xEAte invalides." });
      }
      const authz = assertDataQueryAuthorized(auth, collectionPath, filters);
      if (authz.ok === false) {
        return res.status(403).json({ success: false, error: authz.error });
      }
      const rows = await prisma.dataDocument.findMany({
        where: { collectionPath }
      });
      const normalized = rows.map((row) => ({
        docId: row.docId,
        data: coerceRecord(row.data)
      }));
      const filtered = applyFilters(normalized, filters);
      const ordered = applyOrder(filtered, orders);
      const limited = take ? ordered.slice(0, take) : ordered;
      return res.status(200).json({
        success: true,
        docs: limited.map((row) => ({ id: row.docId, data: row.data }))
      });
    } catch (error) {
      console.error("[data/query]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.get("/api/data/doc", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.query.collectionPath || ""));
      const docId = String(req.query.docId || "").trim();
      if (!collectionPath || !docId || !isSafeCollectionPath(collectionPath) || !isSafeDocId(docId)) {
        return res.status(400).json({ success: false, error: "collectionPath et docId invalides." });
      }
      const authz = assertDataDocAuthorized(auth, "read", collectionPath, docId);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      const row = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath, docId } }
      });
      return res.status(200).json({
        success: true,
        exists: Boolean(row),
        doc: row ? { id: row.docId, data: coerceRecord(row.data) } : null
      });
    } catch (error) {
      console.error("[data/doc:get]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.post("/api/data/doc", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const merge = Boolean(req.body?.merge);
      const incoming = coerceRecord(req.body?.data);
      const docId = String(req.body?.docId || "").trim() || (0, import_crypto.randomUUID)().replace(/-/g, "");
      if (!collectionPath || !isSafeCollectionPath(collectionPath) || !isSafeDocId(docId)) {
        return res.status(400).json({ success: false, error: "collectionPath ou docId invalides." });
      }
      const authz = assertDataDocAuthorized(auth, "write", collectionPath, docId, incoming);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      await upsertDataDocument(collectionPath, docId, incoming, merge);
      return res.status(200).json({ success: true, docId });
    } catch (error) {
      console.error("[data/doc:post]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
  app.patch("/api/data/doc", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const docId = String(req.body?.docId || "").trim();
      const updates = coerceRecord(req.body?.data);
      const deleteKeys = Array.isArray(req.body?.deleteKeys) ? req.body.deleteKeys : [];
      if (!collectionPath || !docId || !isSafeCollectionPath(collectionPath) || !isSafeDocId(docId) || !deleteKeys.every((key) => SAFE_FIELD_NAME.test(String(key)))) {
        return res.status(400).json({ success: false, error: "collectionPath et docId invalides." });
      }
      const authz = assertDataDocAuthorized(auth, "write", collectionPath, docId, updates);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      const existing = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath, docId } }
      });
      if (!existing) return res.status(404).json({ success: false, error: "Document introuvable." });
      const next = { ...coerceRecord(existing.data), ...updates };
      for (const key of deleteKeys) {
        delete next[key];
      }
      await prisma.dataDocument.update({
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
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.query.collectionPath || ""));
      const docId = String(req.query.docId || "").trim();
      if (!collectionPath || !docId || !isSafeCollectionPath(collectionPath) || !isSafeDocId(docId)) {
        return res.status(400).json({ success: false, error: "collectionPath et docId invalides." });
      }
      const authz = assertDataDocAuthorized(auth, "write", collectionPath, docId);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });
      await prisma.dataDocument.deleteMany({
        where: { collectionPath, docId }
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[data/doc:delete]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
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
  const ext = import_path3.default.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype || "")) return false;
  return true;
}
function secureSecretEquals(expected, provided) {
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return (0, import_crypto2.timingSafeEqual)(expectedBuf, providedBuf);
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number.parseInt(process.env.PORT || "", 10) || 3e3;
  const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173").split(",").map((v) => v.trim()).filter(Boolean);
  const paddeWebhookSecret = process.env.PADDE_WEBHOOK_SECRET || "";
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
  app.use(
    (0, import_cors.default)({
      origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Origine CORS non autoris\xE9e."));
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    })
  );
  app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(import_express.default.json({ limit: "1mb", strict: true }));
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
  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
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
      const objectKey = `${folder}/${Date.now()}-${(0, import_crypto2.randomUUID)()}-${safeOriginal}`;
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
      await import_fs2.promises.mkdir(import_path3.default.dirname(absPath), { recursive: true });
      await import_fs2.promises.writeFile(absPath, req.file.buffer);
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
      const msg = error instanceof Error && process.env.NODE_ENV !== "production" ? `Erreur interne du serveur. ${error.message}` : "Erreur interne du serveur.";
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
        await import_fs2.promises.unlink(absPath);
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
          const stat = await import_fs2.promises.stat(absPath);
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
        const filename = import_path3.default.basename(safePath).replace(/"/g, "");
        res.setHeader("Content-Type", mimeFromStorageKey(safePath));
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        const stream = (0, import_fs2.createReadStream)(absPath);
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
      if (!process.env.DATABASE_URL) {
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
  app.get("/api/webhooks/padde-ci", async (req, res) => {
    try {
      if (!process.env.DATABASE_URL) {
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[infinitecore-api] http://0.0.0.0:${PORT}`);
  });
}
startServer();
