import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer, { type Transporter } from "nodemailer";
import { createHash, randomBytes, randomUUID } from "crypto";
import { prisma } from "./prismaClient";

export type AuthPayload = {
  uid: string;
  email: string;
  role: string;
};

export type QueryFilter = {
  field: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  value: unknown;
};

type QueryOrder = {
  field: string;
  direction?: "asc" | "desc";
};

type DataOperation = "read" | "write";

const AUTH_HEADER_PREFIX = "Bearer ";
const JWT_ISSUER = process.env.JWT_ISSUER || "infinitecore-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "infinitecore-web";
const SAFE_COLLECTION_SEGMENT = /^[A-Za-z0-9_-]{1,120}$/;
const SAFE_DOC_ID = /^[A-Za-z0-9._:-]{1,180}$/;
const SAFE_FIELD_NAME = /^[A-Za-z0-9_.-]{1,120}$/;
const MAX_FILTERS = 12;
const MAX_ORDERS = 6;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_MAX_FAILURES = 8;
const AUTH_RATE_BLOCK_MS = 20 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const USER_FIELDS = [
  "uid",
  "email",
  "firstName",
  "lastName",
  "phone",
  "role",
  "companyId",
  "referredBy",
  "photoURL",
  "createdAt",
] as const;
const authFailureBuckets = new Map<string, { failures: number; windowEndsAt: number; blockedUntil: number }>();
let smtpTransport: Transporter | null = null;

function getResetAppBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
}

function getSmtpTransport(): Transporter | null {
  if (smtpTransport) return smtpTransport;
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !Number.isFinite(port) || !user || !pass) return null;
  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: { user, pass },
  });
  return smtpTransport;
}

async function sendResetPasswordEmail(input: { to: string; token: string }) {
  const transporter = getSmtpTransport();
  const resetLink = `${getResetAppBaseUrl()}/reset-password?email=${encodeURIComponent(input.to)}&token=${encodeURIComponent(input.token)}`;
  if (!transporter) {
    return { delivered: false as const, previewLink: resetLink };
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@infinitecore.local",
    to: input.to,
    subject: "Reinitialisation de votre mot de passe",
    text: `Bonjour,\n\nUtilisez ce lien pour reinitialiser votre mot de passe:\n${resetLink}\n\nCe lien expire dans 30 minutes.\nSi vous n'etes pas a l'origine de cette demande, ignorez cet email.\n`,
    html: `<p>Bonjour,</p><p>Utilisez ce lien pour reinitialiser votre mot de passe :</p><p><a href="${resetLink}">${resetLink}</a></p><p>Ce lien expire dans 30 minutes.</p><p>Si vous n'etes pas a l'origine de cette demande, ignorez cet email.</p>`,
  });
  return { delivered: true as const };
}

function getJwtSecret() {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret) return envSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET est requis en production.");
  }
  return "dev-secret-change-me";
}

function signAuthToken(payload: AuthPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "7d",
    algorithm: "HS256",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function readAuthToken(req: Request): string | null {
  const raw = req.headers.authorization;
  if (!raw || !raw.startsWith(AUTH_HEADER_PREFIX)) return null;
  return raw.slice(AUTH_HEADER_PREFIX.length).trim();
}

function parseAuth(req: Request): AuthPayload | null {
  const token = readAuthToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as AuthPayload;
    if (!decoded || typeof decoded.uid !== "string" || typeof decoded.email !== "string" || typeof decoded.role !== "string") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

const VALID_ROLES = new Set(["admin", "commando", "developer", "partner", "client"]);
const VALID_OPERATORS = new Set<QueryFilter["operator"]>(["==", "!=", ">", ">=", "<", "<="]);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isStrongPassword(password: string) {
  if (password.length < 12 || password.length > 128) return false;
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

/** Texte complet pour détecter les pannes réseau / TLS (Prisma met souvent le détail dans `meta`, pas dans `message`). */
function prismaAndDriverErrorText(error: unknown): string {
  const parts: string[] = [];
  if (error instanceof Error) parts.push(error.message);
  else parts.push(String(error));
  const rec = error as { code?: string; meta?: unknown; cause?: unknown };
  if (rec.code) parts.push(String(rec.code));
  if (rec.meta !== undefined) {
    try {
      parts.push(typeof rec.meta === "string" ? rec.meta : JSON.stringify(rec.meta));
    } catch {
      parts.push(String(rec.meta));
    }
  }
  if (rec.cause instanceof Error) parts.push(rec.cause.message);
  else if (rec.cause !== undefined && rec.cause !== null) parts.push(String(rec.cause));
  return parts.join("\n");
}

/** Erreurs Prisma / driver Mongo fréquentes quand Atlas ou le réseau est injoignable. */
function sendAuthPrismaError(res: Response, logLabel: string, error: unknown) {
  console.error(logLabel, error);
  const msg = prismaAndDriverErrorText(error);
  const dbUnreachable =
    /Server selection timeout|Can't reach database server|ReplicaSetNoPrimary|P1001|P1017|P2010|MongoNetwork|ECONNREFUSED|fatal alert: InternalError|TLS handshake|certificate|timed out/i.test(
      msg
    );
  if (dbUnreachable) {
    return res.status(503).json({
      success: false,
      error:
        "Connexion à MongoDB impossible. Vérifiez DATABASE_URL, le réseau « Network Access » sur Atlas (IP autorisées), et tout proxy ou antivirus qui intercepte TLS.",
    });
  }
  return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
}

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeIp(raw: string) {
  return raw.trim().replace(/^::ffff:/, "") || "unknown";
}

function getClientIp(req: Request) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return normalizeIp(xff.split(",")[0] || "");
  }
  if (Array.isArray(xff) && xff[0]) {
    return normalizeIp(String(xff[0]));
  }
  return normalizeIp(req.socket.remoteAddress || "");
}

function authBucketKey(req: Request, email: string) {
  return `${getClientIp(req)}|${email || "unknown"}`;
}

function isAuthTemporarilyBlocked(key: string) {
  const now = Date.now();
  const bucket = authFailureBuckets.get(key);
  if (!bucket) return false;
  if (bucket.blockedUntil > now) return true;
  if (bucket.windowEndsAt < now) {
    authFailureBuckets.delete(key);
  }
  return false;
}

function registerAuthFailure(key: string) {
  const now = Date.now();
  const bucket = authFailureBuckets.get(key);
  if (!bucket || bucket.windowEndsAt < now) {
    authFailureBuckets.set(key, {
      failures: 1,
      windowEndsAt: now + AUTH_RATE_WINDOW_MS,
      blockedUntil: 0,
    });
    return;
  }
  bucket.failures += 1;
  if (bucket.failures >= AUTH_RATE_MAX_FAILURES) {
    bucket.blockedUntil = now + AUTH_RATE_BLOCK_MS;
  }
}

function clearAuthFailures(key: string) {
  authFailureBuckets.delete(key);
}

function isPrimitiveQueryValue(value: unknown) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isSafeCollectionPath(path: string) {
  const parts = path.split("/");
  return parts.length > 0 && parts.every((segment) => SAFE_COLLECTION_SEGMENT.test(segment));
}

function isSafeDocId(docId: string) {
  return SAFE_DOC_ID.test(docId);
}

function sanitizeFilters(raw: unknown): QueryFilter[] | null {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_FILTERS) return null;
  const filters: QueryFilter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const field = String((item as QueryFilter).field || "").trim();
    const operator = (item as QueryFilter).operator;
    const value = (item as QueryFilter).value;
    if (!SAFE_FIELD_NAME.test(field) || !VALID_OPERATORS.has(operator) || !isPrimitiveQueryValue(value)) {
      return null;
    }
    filters.push({ field, operator, value });
  }
  return filters;
}

function sanitizeOrders(raw: unknown): QueryOrder[] | null {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_ORDERS) return null;
  const orders: QueryOrder[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const field = String((item as QueryOrder).field || "").trim();
    const directionRaw = String((item as QueryOrder).direction || "asc").toLowerCase();
    if (!SAFE_FIELD_NAME.test(field)) return null;
    if (directionRaw !== "asc" && directionRaw !== "desc") return null;
    orders.push({ field, direction: directionRaw });
  }
  return orders;
}

async function resolveAuthPayload(raw: AuthPayload): Promise<AuthPayload | null> {
  const account = await prisma.userAccount.findUnique({
    where: { uid: raw.uid },
    select: { uid: true, email: true, role: true },
  });
  if (!account) return null;

  let effectiveRole = account.role;

  // Auto-répare les comptes staff créés avec un rôle "client" côté user_accounts.
  if (effectiveRole === "client") {
    const profileDoc = await prisma.dataDocument.findUnique({
      where: { collectionPath_docId: { collectionPath: "users", docId: raw.uid } },
      select: { data: true },
    });
    const profile = coerceRecord(profileDoc?.data);
    const profileRole = typeof profile.role === "string" ? profile.role : "";
    if (VALID_ROLES.has(profileRole) && profileRole !== effectiveRole) {
      effectiveRole = profileRole;
      await prisma.userAccount.update({
        where: { uid: raw.uid },
        data: { role: effectiveRole },
      });
    }
  }

  return {
    uid: account.uid,
    email: account.email,
    role: effectiveRole,
  };
}

async function requireAuth(req: Request, res: Response): Promise<AuthPayload | null> {
  const auth = parseAuth(req);
  if (!auth) {
    res.status(401).json({ success: false, error: "Non authentifié." });
    return null;
  }

  const resolved = await resolveAuthPayload(auth);
  if (!resolved) {
    res.status(401).json({ success: false, error: "Session invalide." });
    return null;
  }
  return resolved;
}

function isPath(path: string, expected: string) {
  return path === expected;
}

function isPathPrefix(path: string, prefix: string) {
  const cleanPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return path === cleanPrefix || path.startsWith(`${cleanPrefix}/`);
}

function getAllowedPrefixes(role: string, op: DataOperation): string[] {
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
      "tasks",
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

function hasCollectionAccess(role: string, op: DataOperation, collectionPath: string) {
  const allow = getAllowedPrefixes(role, op);
  if (allow.includes("*")) return true;
  return allow.some((prefix) => isPathPrefix(collectionPath, prefix));
}

function hasClientScopedFilters(
  auth: AuthPayload,
  collectionPath: string,
  filters: QueryFilter[]
): boolean {
  const eq = (field: string, value: string) =>
    filters.some((f) => f.field === field && f.operator === "==" && String(f.value) === value);

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

function hasClientScopedDocumentAccess(auth: AuthPayload, collectionPath: string, docId: string): boolean {
  if (isPath(collectionPath, "users")) return docId === auth.uid;
  if (isPath(collectionPath, "chats")) return docId === auth.uid;
  if (isPathPrefix(collectionPath, "chats/")) {
    const parts = collectionPath.split("/");
    return parts[0] === "chats" && parts[1] === auth.uid;
  }
  return true;
}

function hasClientWritablePayload(auth: AuthPayload, collectionPath: string, data: Record<string, unknown>) {
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

function assertDataQueryAuthorized(
  auth: AuthPayload,
  collectionPath: string,
  filters: QueryFilter[]
): { ok: true } | { ok: false; error: string } {
  if (!hasCollectionAccess(auth.role, "read", collectionPath)) {
    return { ok: false, error: "Accès interdit à cette collection." };
  }
  if (auth.role === "client" && !hasClientScopedFilters(auth, collectionPath, filters)) {
    return { ok: false, error: "Requête client non scopée sur votre propre compte." };
  }
  return { ok: true };
}

function assertDataDocAuthorized(
  auth: AuthPayload,
  op: DataOperation,
  collectionPath: string,
  docId: string,
  payload?: Record<string, unknown>
): { ok: true } | { ok: false; error: string } {
  if (!hasCollectionAccess(auth.role, op, collectionPath)) {
    return { ok: false, error: "Accès interdit à cette collection." };
  }
  if (auth.role === "client") {
    if (!hasClientScopedDocumentAccess(auth, collectionPath, docId)) {
      return { ok: false, error: "Accès interdit à ce document." };
    }
    if (op === "write" && payload && !hasClientWritablePayload(auth, collectionPath, payload)) {
      return { ok: false, error: "Écriture non autorisée sur ce document." };
    }
  }
  return { ok: true };
}

export const __rbacTestUtils = {
  assertDataQueryAuthorized,
  assertDataDocAuthorized,
};

function coerceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickUserPublicData(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const field of USER_FIELDS) {
    if (field in input && input[field] !== undefined) out[field] = input[field];
  }
  return out;
}

function normalizeCollectionPath(path: string): string {
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function compareValues(left: unknown, operator: QueryFilter["operator"], right: unknown) {
  switch (operator) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
      return (left as string | number) > (right as string | number);
    case ">=":
      return (left as string | number) >= (right as string | number);
    case "<":
      return (left as string | number) < (right as string | number);
    case "<=":
      return (left as string | number) <= (right as string | number);
    default:
      return false;
  }
}

function applyFilters(
  rows: Array<{ docId: string; data: Record<string, unknown> }>,
  filters: QueryFilter[]
) {
  return rows.filter((row) =>
    filters.every((filter) => compareValues(row.data[filter.field], filter.operator, filter.value))
  );
}

function applyOrder(
  rows: Array<{ docId: string; data: Record<string, unknown> }>,
  orders: QueryOrder[]
) {
  if (!orders.length) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const direction = order.direction === "desc" ? -1 : 1;
      const av = a.data[order.field] as string | number | undefined;
      const bv = b.data[order.field] as string | number | undefined;
      if (av === bv) continue;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return av > bv ? direction : -direction;
    }
    return 0;
  });
}

async function upsertDataDocument(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>,
  merge: boolean
) {
  const existing = await prisma.dataDocument.findUnique({
    where: { collectionPath_docId: { collectionPath, docId } },
  });

  const nextData = merge ? { ...coerceRecord(existing?.data), ...data } : data;

  await prisma.dataDocument.upsert({
    where: { collectionPath_docId: { collectionPath, docId } },
    create: { collectionPath, docId, data: nextData as any },
    update: { data: nextData as any },
  });
}

async function ensureUserDocumentFromAccount(account: {
  uid: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  companyId: string | null;
  referredBy: string | null;
  photoURL: string | null;
  createdAt: Date;
}) {
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
      createdAt: account.createdAt.toISOString(),
    },
    true
  );
}

export function registerMongoApi(app: Express) {
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const auth = parseAuth(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifié." });

      const account = await prisma.userAccount.findUnique({ where: { uid: auth.uid } });
      if (!account) return res.status(401).json({ success: false, error: "Session invalide." });

      const profileDoc = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "users", docId: account.uid } },
      });
      const profile = coerceRecord(profileDoc?.data);

      return res.status(200).json({
        success: true,
        user: {
          uid: account.uid,
          email: account.email,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
          photoURL: account.photoURL || null,
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
            createdAt: account.createdAt.toISOString(),
          }),
          ...profile,
        },
      });
    } catch (error) {
      console.error("[auth/me]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.patch("/api/auth/profile", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const rawDisplayName = req.body?.displayName;
      const rawPhotoURL = req.body?.photoURL;
      const displayName = typeof rawDisplayName === "string" ? rawDisplayName.trim().slice(0, 120) : undefined;
      const photoURL = typeof rawPhotoURL === "string" ? rawPhotoURL.trim().slice(0, 500) : undefined;

      const [firstName = "", ...last] = (displayName || "").split(/\s+/).filter(Boolean);
      const lastName = last.join(" ");

      const account = await prisma.userAccount.update({
        where: { uid: auth.uid },
        data: {
          ...(displayName !== undefined ? { firstName, lastName } : {}),
          ...(photoURL !== undefined ? { photoURL: photoURL || null } : {}),
        },
      });

      await ensureUserDocumentFromAccount(account);

      return res.status(200).json({
        success: true,
        user: {
          uid: account.uid,
          email: account.email,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
          photoURL: account.photoURL || null,
        },
      });
    } catch (error) {
      console.error("[auth/profile:update]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      if (isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. Réessayez plus tard." });
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
          error: "Mot de passe insuffisant (12+ caractères, majuscule, minuscule, chiffre et symbole).",
        });
      }

      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) {
        registerAuthFailure(authKey);
        return res.status(409).json({ success: false, error: "Cet email existe déjà." });
      }

      const uid = `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
      const passwordHash = await bcrypt.hash(password, 10);
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
          profile: {} as any,
        },
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
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
        },
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/register]", error);
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      if (isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. Réessayez plus tard." });
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

      const valid = await bcrypt.compare(password, account.passwordHash);
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
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
        },
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/login]", error);
    }
  });

  app.post("/api/auth/logout", async (_req: Request, res: Response) => {
    return res.status(200).json({ success: true });
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      if (isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. Réessayez plus tard." });
      }
      const displayName = String(req.body?.displayName || "").trim();
      if (!email || !isValidEmail(email)) {
        registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email requis." });
      }

      let account = await prisma.userAccount.findUnique({ where: { email } });
      if (!account) {
        const [firstName = "", ...last] = displayName.split(" ");
        const uid = `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
        account = await prisma.userAccount.create({
          data: {
            uid,
            email,
            firstName,
            lastName: last.join(" "),
            role: "client",
            provider: "google",
            profile: {} as any,
          },
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
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
        },
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/google]", error);
    }
  });

  app.post("/api/auth/admin-create", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (!auth || auth.role !== "admin") {
        return res.status(403).json({ success: false, error: "Accès refusé." });
      }

      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const requestedRole = String(req.body?.role || "client").trim().toLowerCase();
      const role = VALID_ROLES.has(requestedRole) ? requestedRole : "client";
      if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, error: "Email requis." });
      const generatedPassword = password || randomUUID().replace(/-/g, "").slice(0, 16);
      if (password && !isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          error: "Mot de passe insuffisant (12+ caractères, majuscule, minuscule, chiffre et symbole).",
        });
      }

      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ success: false, error: "Cet email est déjà utilisé." });
      }

      const uid = `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
      const passwordHash = await bcrypt.hash(generatedPassword, 10);
      const account = await prisma.userAccount.create({
        data: {
          uid,
          email,
          passwordHash,
          role,
          provider: "password",
          profile: {} as any,
        },
      });

      await ensureUserDocumentFromAccount(account);
      return res.status(201).json({ success: true, uid: account.uid, password: generatedPassword });
    } catch (error) {
      console.error("[auth/admin-create]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/password-reset/request", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email || !isValidEmail(email)) {
        return res.status(200).json({
          success: true,
          message: "Si ce compte existe, les instructions de réinitialisation ont été enregistrées.",
        });
      }

      const account = await prisma.userAccount.findUnique({
        where: { email },
        select: { uid: true, email: true, provider: true },
      });

      // Réponse constante pour éviter l’énumération d’emails.
      if (!account || account.provider === "google") {
        return res.status(200).json({
          success: true,
          message: "Si ce compte existe, les instructions de réinitialisation ont été enregistrées.",
        });
      }

      const resetToken = randomBytes(32).toString("hex");
      const resetDocId = account.uid;
      const nowIso = new Date().toISOString();
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
          used: false,
        },
        false
      );

      const mailResult = await sendResetPasswordEmail({ to: account.email, token: resetToken });

      return res.status(200).json({
        success: true,
        message: "Si ce compte existe, les instructions de réinitialisation ont été enregistrées.",
        ...(process.env.NODE_ENV !== "production" ? { resetTokenPreview: resetToken } : {}),
        ...(process.env.NODE_ENV !== "production" && !mailResult.delivered ? { resetLinkPreview: mailResult.previewLink } : {}),
      });
    } catch (error) {
      console.error("[auth/password-reset/request]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/password-reset/confirm", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const token = String(req.body?.token || "").trim();
      const newPassword = String(req.body?.newPassword || "");
      if (!email || !token || !newPassword || !isValidEmail(email) || !isStrongPassword(newPassword)) {
        return res.status(400).json({ success: false, error: "Paramètres de réinitialisation invalides." });
      }

      const account = await prisma.userAccount.findUnique({
        where: { email },
        select: { uid: true, email: true, provider: true },
      });
      if (!account || account.provider === "google") {
        return res.status(400).json({ success: false, error: "Token invalide ou expiré." });
      }

      const resetRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "auth_password_resets", docId: account.uid } },
      });
      const resetData = coerceRecord(resetRow?.data);
      const tokenHash = typeof resetData.tokenHash === "string" ? resetData.tokenHash : "";
      const expiresAt = typeof resetData.expiresAt === "string" ? resetData.expiresAt : "";
      const used = Boolean(resetData.used);
      if (!tokenHash || !expiresAt || used) {
        return res.status(400).json({ success: false, error: "Token invalide ou expiré." });
      }
      const expiresAtMs = Date.parse(expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
        return res.status(400).json({ success: false, error: "Token invalide ou expiré." });
      }
      if (sha256Hex(token) !== tokenHash) {
        return res.status(400).json({ success: false, error: "Token invalide ou expiré." });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.userAccount.update({
        where: { uid: account.uid },
        data: { passwordHash },
      });
      await upsertDataDocument(
        "auth_password_resets",
        account.uid,
        {
          ...resetData,
          used: true,
          usedAt: new Date().toISOString(),
        },
        false
      );

      return res.status(200).json({ success: true, message: "Mot de passe réinitialisé avec succès." });
    } catch (error) {
      console.error("[auth/password-reset/confirm]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/data/query", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const filters = sanitizeFilters(req.body?.filters);
      const orders = sanitizeOrders(req.body?.orders);
      const max = Number(req.body?.limit);
      const take = Number.isFinite(max) && max > 0 ? Math.min(max, 5000) : undefined;

      if (!collectionPath || !isSafeCollectionPath(collectionPath) || filters === null || orders === null) {
        return res.status(400).json({ success: false, error: "Paramètres de requête invalides." });
      }
      const authz = assertDataQueryAuthorized(auth, collectionPath, filters);
      if (authz.ok === false) {
        return res.status(403).json({ success: false, error: authz.error });
      }

      const rows = await prisma.dataDocument.findMany({
        where: { collectionPath },
      });
      const normalized = rows.map((row) => ({
        docId: row.docId,
        data: coerceRecord(row.data),
      }));
      const filtered = applyFilters(normalized, filters);
      const ordered = applyOrder(filtered, orders);
      const limited = take ? ordered.slice(0, take) : ordered;

      return res.status(200).json({
        success: true,
        docs: limited.map((row) => ({ id: row.docId, data: row.data })),
      });
    } catch (error) {
      console.error("[data/query]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.get("/api/data/doc", async (req: Request, res: Response) => {
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
        where: { collectionPath_docId: { collectionPath, docId } },
      });
      return res.status(200).json({
        success: true,
        exists: Boolean(row),
        doc: row ? { id: row.docId, data: coerceRecord(row.data) } : null,
      });
    } catch (error) {
      console.error("[data/doc:get]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/data/doc", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const merge = Boolean(req.body?.merge);
      const incoming = coerceRecord(req.body?.data);
      const docId = String(req.body?.docId || "").trim() || randomUUID().replace(/-/g, "");
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

  app.patch("/api/data/doc", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const docId = String(req.body?.docId || "").trim();
      const updates = coerceRecord(req.body?.data);
      const deleteKeys = Array.isArray(req.body?.deleteKeys) ? (req.body.deleteKeys as string[]) : [];
      if (
        !collectionPath ||
        !docId ||
        !isSafeCollectionPath(collectionPath) ||
        !isSafeDocId(docId) ||
        !deleteKeys.every((key) => SAFE_FIELD_NAME.test(String(key)))
      ) {
        return res.status(400).json({ success: false, error: "collectionPath et docId invalides." });
      }
      const authz = assertDataDocAuthorized(auth, "write", collectionPath, docId, updates);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });

      const existing = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath, docId } },
      });
      if (!existing) return res.status(404).json({ success: false, error: "Document introuvable." });

      const next = { ...coerceRecord(existing.data), ...updates };
      for (const key of deleteKeys) {
        delete next[key];
      }

      await prisma.dataDocument.update({
        where: { collectionPath_docId: { collectionPath, docId } },
        data: { data: next as any },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[data/doc:patch]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.delete("/api/data/doc", async (req: Request, res: Response) => {
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
        where: { collectionPath, docId },
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[data/doc:delete]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
}
