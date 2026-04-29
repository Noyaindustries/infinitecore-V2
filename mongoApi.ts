import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "crypto";
import { prisma } from "./prismaClient";
import { appEnv, getJwtSecret, resetAppBaseUrl } from "@/config/env";
import { getSmtpTransport } from "@/server/smtpTransport";
import { sendStaffNotifyEmail } from "@/server/staffNotifyEmail";
import { agentSessionLog } from "./src/debug/agentSessionLog";
import { registerDataRoutes } from "./src/api/dataRoutes";
import type { QueryFilter, QueryOrder } from "./src/api/mongo/dataQueryTypes";
import { sanitizeFilters, sanitizeOrders } from "./src/api/mongo/sanitizeDataQuery";
import { AuthRegisterSchema, UserProfileSchema } from "./src/lib/schemas";

export type AuthPayload = {
  uid: string;
  email: string;
  role: string;
};

export type { QueryFilter } from "./src/api/mongo/dataQueryTypes";

type DataOperation = "read" | "write";

const AUTH_HEADER_PREFIX = "Bearer ";
const AUTH_COOKIE_NAME = "ic_auth_token";
const AUTH_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SAFE_COLLECTION_SEGMENT = /^[A-Za-z0-9_-]{1,120}$/;
const SAFE_DOC_ID = /^[A-Za-z0-9._:-]{1,180}$/;
const SAFE_FIELD_NAME = /^[A-Za-z0-9_.-]{1,120}$/;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_MAX_FAILURES = 8;
const AUTH_RATE_BLOCK_MS = 20 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const LOGIN_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const LOGIN_VERIFICATION_MAX_ATTEMPTS = 5;
const USER_FIELDS = [
  "uid",
  "email",
  "firstName",
  "lastName",
  "phone",
  "role",
  "companyId",
  "companyName",
  "companyDescription",
  "industry",
  "size",
  "referredBy",
  "referredByPartnerId",
  "referredByPartnerName",
  "photoURL",
  "createdAt",
] as const;
const authFailureBuckets = new Map<string, { failures: number; windowEndsAt: number; blockedUntil: number }>();

async function sendResetPasswordEmail(input: { to: string; token: string }) {
  const transporter = getSmtpTransport();
  const resetLink = `${resetAppBaseUrl()}/reset-password?email=${encodeURIComponent(input.to)}&token=${encodeURIComponent(input.token)}`;
  if (!transporter) {
    return { delivered: false as const, previewLink: resetLink };
  }
  await transporter.sendMail({
    from: appEnv.smtp.fromOrUser,
    to: input.to,
    subject: "Reinitialisation de votre mot de passe",
    text: `Bonjour,\n\nUtilisez ce lien pour reinitialiser votre mot de passe:\n${resetLink}\n\nCe lien expire dans 30 minutes.\nSi vous n'etes pas a l'origine de cette demande, ignorez cet email.\n`,
    html: `<p>Bonjour,</p><p>Utilisez ce lien pour reinitialiser votre mot de passe :</p><p><a href="${resetLink}">${resetLink}</a></p><p>Ce lien expire dans 30 minutes.</p><p>Si vous n'etes pas a l'origine de cette demande, ignorez cet email.</p>`,
  });
  return { delivered: true as const };
}

function generateNumericCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

async function sendLoginVerificationEmail(input: { to: string; code: string }) {
  const transporter = getSmtpTransport();
  if (!transporter) {
    return { delivered: false as const, previewCode: input.code };
  }
  await transporter.sendMail({
    from: appEnv.smtp.fromOrUser,
    to: input.to,
    subject: "Code de verification de connexion",
    text:
      `Bonjour,\n\n` +
      `Voici votre code de verification Infinite Core : ${input.code}\n\n` +
      `Il expire dans 10 minutes.\n` +
      `Si vous n'êtes pas a l'origine de cette tentative de connexion, ignorez cet email.\n`,
    html:
      `<p>Bonjour,</p>` +
      `<p>Voici votre code de verification Infinite Core :</p>` +
      `<p style="font-size: 24px; font-weight: 700; letter-spacing: 0.12em;">${input.code}</p>` +
      `<p>Il expire dans <strong>10 minutes</strong>.</p>` +
      `<p>Si vous n'êtes pas a l'origine de cette tentative de connexion, ignorez cet email.</p>`,
  });
  return { delivered: true as const };
}

const CLIENT_CHAT_EMAIL_THROTTLE_MS = 10 * 60 * 1000;

async function sendClientChatMessageEmail(input: {
  to: string;
  clientName: string;
  senderName: string;
  messagePreview: string;
}) {
  const transporter = getSmtpTransport();
  if (!transporter) return { delivered: false as const };
  const portalUrl = `${resetAppBaseUrl()}/dashboard/chat`;
  await transporter.sendMail({
    from: appEnv.smtp.fromOrUser,
    to: input.to,
    subject: "Nouveau message dans votre espace client",
    text:
      `Bonjour ${input.clientName || "Client"},\n\n` +
      `${input.senderName} vous a envoyé un message dans votre espace client Infinite Core.\n\n` +
      `Aperçu : ${input.messagePreview}\n\n` +
      `Répondre : ${portalUrl}\n\n` +
      `— Équipe Infinite Core`,
    html:
      `<p>Bonjour ${input.clientName || "Client"},</p>` +
      `<p><strong>${input.senderName}</strong> vous a envoyé un message dans votre espace client Infinite Core.</p>` +
      `<p><strong>Aperçu :</strong> ${input.messagePreview}</p>` +
      `<p><a href="${portalUrl}">Ouvrir la messagerie client</a></p>` +
      `<p>— Équipe Infinite Core</p>`,
  });
  return { delivered: true as const };
}

/** Vérifie un jeton d’accès OAuth Google et renvoie l’email **vérifié** côté Google. */
async function googleUserProfileFromAccessToken(accessToken: string): Promise<{
  email: string;
  displayNameHint: string;
  picture: string | null;
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("GOOGLE_USERINFO_FAILED");
  }
  const u = (await res.json()) as { email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!u.email || u.email_verified !== true) {
    throw new Error("GOOGLE_EMAIL_UNVERIFIED");
  }
  const email = u.email.trim().toLowerCase();
  return {
    email,
    displayNameHint: String(u.name || "").trim() || email.split("@")[0] || email,
    picture: u.picture ? String(u.picture).trim() : null,
  };
}

function signAuthToken(payload: AuthPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "7d",
    algorithm: "HS256",
    issuer: appEnv.auth.jwtIssuer,
    audience: appEnv.auth.jwtAudience,
  });
}

function authCookieOptions() {
  const domain = appEnv.auth.cookieDomain;
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: appEnv.node.isProduction,
    path: "/",
    maxAge: AUTH_COOKIE_TTL_MS,
    ...(domain ? { domain } : {}),
  };
}

function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}

function clearAuthCookie(res: Response) {
  const domain = appEnv.auth.cookieDomain;
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: appEnv.node.isProduction,
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

function parseCookieValue(header: string | undefined, key: string): string | null {
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

function readAuthToken(req: Request): string | null {
  const raw = req.headers.authorization;
  if (raw && raw.startsWith(AUTH_HEADER_PREFIX)) {
    return raw.slice(AUTH_HEADER_PREFIX.length).trim();
  }
  const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
  return parseCookieValue(cookieHeader, AUTH_COOKIE_NAME);
}

function parseAuth(req: Request): AuthPayload | null {
  const token = readAuthToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: appEnv.auth.jwtIssuer,
      audience: appEnv.auth.jwtAudience,
    }) as AuthPayload;
    if (!decoded || typeof decoded.uid !== "string" || typeof decoded.email !== "string" || typeof decoded.role !== "string") {
      return null;
    }
    return decoded;
  } catch (err) {
    console.error("[auth] parseAuth error:", err);
    return null;
  }
}

export function parseAuthFromRequest(req: Request): AuthPayload | null {
  return parseAuth(req);
}

const VALID_ROLES = new Set(["admin", "commando", "developer", "partner", "client"]);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isStrongPassword(password: string) {
  if (password.length < 8 || password.length > 128) return false;
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

function authRateLimitDocId(key: string) {
  return sha256Hex(`auth_rate_limit:${key}`);
}

function fallbackIsBlocked(key: string) {
  const now = Date.now();
  const bucket = authFailureBuckets.get(key);
  if (!bucket) return false;
  if (bucket.blockedUntil > now) return true;
  if (bucket.windowEndsAt < now) authFailureBuckets.delete(key);
  return false;
}

function fallbackRegisterFailure(key: string) {
  const now = Date.now();
  const bucket = authFailureBuckets.get(key);
  if (!bucket || bucket.windowEndsAt < now) {
    authFailureBuckets.set(key, { failures: 1, windowEndsAt: now + AUTH_RATE_WINDOW_MS, blockedUntil: 0 });
    return;
  }
  bucket.failures += 1;
  if (bucket.failures >= AUTH_RATE_MAX_FAILURES) bucket.blockedUntil = now + AUTH_RATE_BLOCK_MS;
}

async function isAuthTemporarilyBlocked(key: string) {
  try {
    const now = Date.now();
    const row = await prisma.dataDocument.findUnique({
      where: { collectionPath_docId: { collectionPath: "auth_rate_limits", docId: authRateLimitDocId(key) } },
      select: { data: true },
    });
    const data = coerceRecord(row?.data);
    const blockedUntil = Number(data.blockedUntil || 0);
    const windowEndsAt = Number(data.windowEndsAt || 0);
    if (Number.isFinite(blockedUntil) && blockedUntil > now) return true;
    if (Number.isFinite(windowEndsAt) && windowEndsAt > 0 && windowEndsAt < now) {
      await prisma.dataDocument.deleteMany({
        where: { collectionPath: "auth_rate_limits", docId: authRateLimitDocId(key) },
      });
    }
    return false;
  } catch {
    return fallbackIsBlocked(key);
  }
}

async function registerAuthFailure(key: string) {
  try {
    const now = Date.now();
    const docId = authRateLimitDocId(key);
    const row = await prisma.dataDocument.findUnique({
      where: { collectionPath_docId: { collectionPath: "auth_rate_limits", docId } },
      select: { data: true },
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
        updatedAt: new Date().toISOString(),
      },
      false
    );
  } catch {
    fallbackRegisterFailure(key);
  }
}

async function clearAuthFailures(key: string) {
  authFailureBuckets.delete(key);
  try {
    await prisma.dataDocument.deleteMany({
      where: { collectionPath: "auth_rate_limits", docId: authRateLimitDocId(key) },
    });
  } catch {
    // no-op: l'auth reste fonctionnelle même si le nettoyage rate-limit échoue.
  }
}

function isSafeCollectionPath(path: string) {
  const parts = path.split("/");
  return parts.length > 0 && parts.every((segment) => SAFE_COLLECTION_SEGMENT.test(segment));
}

function isSafeDocId(docId: string) {
  return SAFE_DOC_ID.test(docId);
}

function normalizePartnerCode(raw: string) {
  return String(raw || "").trim().toUpperCase().replace("PART-USR", "PART-INF");
}

function leadDedupDocId(partnerId: string, email: string) {
  const p = String(partnerId || "").trim();
  const e = String(email || "").trim().toLowerCase();
  return sha256Hex(`lead_dedup:${p}|${e}`);
}

type PartnerLookupEntry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  referralCode: string;
  partnerCode: string;
};

const PARTNER_LOOKUP_MAX = 5000;

async function listPartnerLookupEntries(): Promise<PartnerLookupEntry[]> {
  const partnerAccounts = await prisma.userAccount.findMany({
    where: { role: "partner" },
    select: { uid: true, firstName: true, lastName: true, email: true },
    take: PARTNER_LOOKUP_MAX,
  });
  if (!partnerAccounts.length) return [];

  const profileRows = await prisma.dataDocument.findMany({
    where: {
      collectionPath: "users",
      docId: { in: partnerAccounts.map((account) => account.uid) },
    },
    select: { docId: true, data: true },
  });
  const profileByUid = new Map(profileRows.map((row) => [row.docId, coerceRecord(row.data)]));

  return partnerAccounts.map((account) => {
    const profile = profileByUid.get(account.uid) || {};
    const firstName =
      (typeof profile.firstName === "string" && profile.firstName) || account.firstName || "";
    const lastName =
      (typeof profile.lastName === "string" && profile.lastName) || account.lastName || "";
    const email =
      (typeof profile.email === "string" && profile.email) || account.email || "";
    return {
      id: account.uid,
      firstName,
      lastName,
      email,
      referralCode: normalizePartnerCode(String(profile.referralCode || "")),
      partnerCode: normalizePartnerCode(String(profile.partnerCode || "")),
    };
  });
}

async function resolvePartnerFromReferralCode(refRaw: string): Promise<PartnerLookupEntry | null> {
  const trimmedRef = String(refRaw || "").trim();
  if (!trimmedRef) return null;
  const normalizedRef = normalizePartnerCode(trimmedRef);

  const directPartner = await prisma.userAccount.findUnique({
    where: { uid: trimmedRef },
    select: { uid: true, firstName: true, lastName: true, email: true, role: true },
  });
  if (directPartner?.role === "partner") {
    return {
      id: directPartner.uid,
      firstName: directPartner.firstName || "",
      lastName: directPartner.lastName || "",
      email: directPartner.email,
      referralCode: "",
      partnerCode: "",
    };
  }

  const entries = await listPartnerLookupEntries();
  for (const entry of entries) {
    const uid = entry.id;
    const derivedCode5 = normalizePartnerCode(`PART-${uid.substring(0, 5).toUpperCase().replace("USR", "INF")}`);
    const derivedCode6 = normalizePartnerCode(`PART-${uid.substring(0, 6).toUpperCase().replace("USR", "INF")}`);
    if (
      entry.referralCode === normalizedRef ||
      entry.partnerCode === normalizedRef ||
      derivedCode5 === normalizedRef ||
      derivedCode6 === normalizedRef ||
      uid === trimmedRef
    ) {
      return entry;
    }
  }
  return null;
}

export async function resolveAuthPayload(raw: AuthPayload): Promise<AuthPayload | null> {
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
    console.warn(
      `[auth] requireAuth: No token or invalid token found in request. route=${req.method} ${req.originalUrl || req.url}`
    );
    res.status(401).json({ success: false, error: "Non authentifié." });
    return null;
  }

  const resolved = await resolveAuthPayload(auth);
  if (!resolved) {
    console.warn("[auth] requireAuth: Token valid but user account not found for UID:", auth.uid);
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
      "resources",
      "admin_config",
      "instances",
      "leads",
      "service_types",
      "padde_ci_audits",
      "tasks",
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
    return ["users", "notifications", "chats", "dossier_steps", "orders"];
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
  if (isPath(collectionPath, "orders")) {
    const userId = typeof data.userId === "string" ? data.userId : "";
    if (userId !== auth.uid) return false;
    const status = typeof data.status === "string" ? data.status : "";
    if (status && status !== "En attente" && status !== "Paiement en cours") return false;
    return true;
  }
  if (isPath(collectionPath, "dossier_steps")) {
    const allowedKeys = new Set(["status", "validatedAt", "clientId"]);
    const keys = Object.keys(data);
    if (!keys.length) return false;
    if (keys.some((k) => !allowedKeys.has(k))) return false;
    const clientId = typeof data.clientId === "string" ? data.clientId : "";
    const status = typeof data.status === "string" ? data.status : "";
    return clientId === auth.uid && status === "valide";
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
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments[0] === "padde-ci-audits") segments[0] = "padde_ci_audits";
  return segments.join("/");
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
  profile: unknown;
  createdAt: Date;
}) {
  const profile = coerceRecord(account.profile);
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
      companyName: typeof profile.companyName === "string" ? profile.companyName : null,
      companyDescription: typeof profile.companyDescription === "string" ? profile.companyDescription : null,
      industry: typeof profile.industry === "string" ? profile.industry : null,
      size: typeof profile.size === "string" ? profile.size : null,
      referredBy: account.referredBy || null,
      referredByPartnerId: typeof profile.referredByPartnerId === "string" ? profile.referredByPartnerId : null,
      referredByPartnerName: typeof profile.referredByPartnerName === "string" ? profile.referredByPartnerName : null,
      photoURL: account.photoURL || null,
      createdAt: account.createdAt.toISOString(),
    },
    true
  );
}

export function registerMongoApi(app: Express) {
  const dbUrl = appEnv.database.url;
  const dbMasked = dbUrl ? `${dbUrl.slice(0, 15)}...${dbUrl.slice(-10)}` : "NON_DEFINIE";
  console.log(`[mongoApi] Initialisation. DB: ${dbMasked}. CORS: ${appEnv.http.corsOriginRaw}`);

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const auth = parseAuth(req);
      if (!auth) return res.status(401).json({ success: false, error: "Non authentifié." });

      const account = await prisma.userAccount.findUnique({ where: { uid: auth.uid } });
      if (!account) return res.status(401).json({ success: false, error: "Session invalide." });

      let profileDoc = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "users", docId: account.uid } },
      });
      if (!profileDoc) {
        // Auto-réparation: certains comptes historiques peuvent ne pas avoir de doc users/{uid}.
        await ensureUserDocumentFromAccount(account);
        profileDoc = await prisma.dataDocument.findUnique({
          where: { collectionPath_docId: { collectionPath: "users", docId: account.uid } },
        });
      }
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
          /** Toujours aligné sur le compte Prisma (évite qu’un doc `users` partiel écrase le rôle). */
          role: account.role,
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
      const validated = UserProfileSchema.partial().safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ success: false, error: "Donnees de profil invalides.", details: validated.error.format() });
      }
      const rawDisplayName = validated.data.displayName;
      const rawPhotoURL = validated.data.photoURL;
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
      const validated = AuthRegisterSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ success: false, error: "Donnees d'inscription invalides.", details: validated.error.format() });
      }
      const {
        email: rawEmail,
        password,
        firstName,
        lastName,
        companyId = null,
        companyName = "",
        companyDescription = "",
        industry = "",
        size = "",
        referredByPartnerId = "",
        referredByPartnerName = "",
      } = validated.data;
      const email = rawEmail.trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      if (await isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. Réessayez plus tard." });
      }
      const referredBy = req.body?.referredBy ? String(req.body.referredBy).trim() : null;
      const phone = req.body?.phone ? String(req.body.phone).trim() : null;
      const normalizedCompanyName = String(companyName || "").trim();
      const normalizedCompanyDescription = String(companyDescription || "").trim();
      const normalizedIndustry = String(industry || "").trim();
      const normalizedSize = String(size || "").trim();
      const normalizedReferredByPartnerId = String(referredByPartnerId || "").trim();
      const normalizedReferredByPartnerName = String(referredByPartnerName || "").trim();

      if (!email || !password || !isValidEmail(email)) {
        await registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      }
      if (!isStrongPassword(password)) {
        await registerAuthFailure(authKey);
        return res.status(400).json({
          success: false,
          error: "Mot de passe insuffisant (8+ caractères, majuscule, minuscule, chiffre et symbole).",
        });
      }

      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) {
        await registerAuthFailure(authKey);
        return res.status(409).json({ success: false, error: "Cet email existe déjà." });
      }

      const challengeId = randomUUID().replace(/-/g, "");
      const verificationCode = generateNumericCode(6);
      const expiresAtIso = new Date(Date.now() + LOGIN_VERIFICATION_TTL_MS).toISOString();
      const passwordHash = await bcrypt.hash(password, 10);
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
          companyName: normalizedCompanyName || null,
          companyDescription: normalizedCompanyDescription || null,
          industry: normalizedIndustry || null,
          size: normalizedSize || null,
          referredBy,
          referredByPartnerId: normalizedReferredByPartnerId || null,
          referredByPartnerName: normalizedReferredByPartnerName || null,
          phone,
          attempts: 0,
          used: false,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAtIso,
        },
        false
      );

      const mailResult = await sendLoginVerificationEmail({
        to: email,
        code: verificationCode,
      });
      if (!mailResult.delivered) {
        await prisma.dataDocument.delete({
          where: { collectionPath_docId: { collectionPath: "auth_register_verifications", docId: challengeId } },
        });
        return res.status(503).json({
          success: false,
          error: "Service email indisponible. Configurez SMTP avant la vérification par code.",
        });
      }

      await clearAuthFailures(authKey);

      return res.status(201).json({
        success: true,
        verificationRequired: true,
        challengeId,
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/register]", error);
    }
  });

  app.post("/api/auth/register/verify", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const challengeId = String(req.body?.challengeId || "").trim();
      const code = String(req.body?.code || "").trim();

      if (!email || !isValidEmail(email) || !challengeId || !isSafeDocId(challengeId) || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, error: "Paramètres de vérification invalides." });
      }

      const challengeRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "auth_register_verifications", docId: challengeId } },
      });
      const challenge = coerceRecord(challengeRow?.data);
      if (!challengeRow) {
        return res.status(400).json({ success: false, error: "Code invalide ou expiré." });
      }

      const challengeEmail = String(challenge.email || "").trim().toLowerCase();
      const passwordHash = String(challenge.passwordHash || "");
      const firstName = String(challenge.firstName || "").trim();
      const lastName = String(challenge.lastName || "").trim();
      const companyId = challenge.companyId ? String(challenge.companyId) : null;
      const companyName = challenge.companyName ? String(challenge.companyName) : null;
      const companyDescription = challenge.companyDescription ? String(challenge.companyDescription) : null;
      const industry = challenge.industry ? String(challenge.industry) : null;
      const size = challenge.size ? String(challenge.size) : null;
      const referredBy = challenge.referredBy ? String(challenge.referredBy) : null;
      const referredByPartnerId = challenge.referredByPartnerId ? String(challenge.referredByPartnerId) : null;
      const referredByPartnerName = challenge.referredByPartnerName ? String(challenge.referredByPartnerName) : null;
      const phone = challenge.phone ? String(challenge.phone) : null;
      const codeHash = String(challenge.codeHash || "");
      const used = Boolean(challenge.used);
      const attempts = Number(challenge.attempts || 0);
      const expiresAt = String(challenge.expiresAt || "");
      const expiresAtMs = Date.parse(expiresAt);

      if (
        !passwordHash ||
        !codeHash ||
        used ||
        !Number.isFinite(expiresAtMs) ||
        expiresAtMs < Date.now() ||
        challengeEmail !== email
      ) {
        return res.status(400).json({ success: false, error: "Code invalide ou expiré." });
      }

      if (attempts >= LOGIN_VERIFICATION_MAX_ATTEMPTS) {
        return res.status(429).json({ success: false, error: "Trop de tentatives sur ce code. Réinscrivez-vous." });
      }

      if (sha256Hex(code) !== codeHash) {
        await prisma.dataDocument.update({
          where: { collectionPath_docId: { collectionPath: "auth_register_verifications", docId: challengeId } },
          data: {
            data: {
              ...challenge,
              attempts: attempts + 1,
              updatedAt: new Date().toISOString(),
            } as any,
          },
        });
        return res.status(400).json({ success: false, error: "Code invalide ou expiré." });
      }

      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ success: false, error: "Cet email existe déjà." });
      }

      const uid = `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
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
          profile: {
            ...(companyName ? { companyName } : {}),
            ...(companyDescription ? { companyDescription } : {}),
            ...(industry ? { industry } : {}),
            ...(size ? { size } : {}),
            ...(referredByPartnerId ? { referredByPartnerId } : {}),
            ...(referredByPartnerName ? { referredByPartnerName } : {}),
          } as any,
        },
      });

      await ensureUserDocumentFromAccount(account);
      await prisma.dataDocument.update({
        where: { collectionPath_docId: { collectionPath: "auth_register_verifications", docId: challengeId } },
        data: {
          data: {
            ...challenge,
            used: true,
            usedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any,
        },
      });

      const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });
      setAuthCookie(res, token);

      return res.status(200).json({
        success: true,
        user: {
          uid: account.uid,
          email: account.email,
          role: account.role,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
        },
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/register/verify]", error);
    }
  });

  app.get("/api/auth/referral", async (req: Request, res: Response) => {
    try {
      const refRaw = String(req.query.ref || "").trim();
      if (!refRaw) {
        return res.status(400).json({ success: false, error: "Paramètre ref requis." });
      }

      const resolvedPartner = await resolvePartnerFromReferralCode(refRaw);
      if (resolvedPartner) {
        return res.status(200).json({
          success: true,
          partner: {
            id: resolvedPartner.id,
            firstName: resolvedPartner.firstName,
            lastName: resolvedPartner.lastName,
            email: resolvedPartner.email,
          },
        });
      }

      return res.status(404).json({ success: false, error: "Référence de parrainage introuvable." });
    } catch (error) {
      console.error("[auth/referral]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/referral-signup-notify", async (req: Request, res: Response) => {
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
      const companyName = String(req.body?.companyName || "").trim() || "Prospect parrainé";
      const industry = String(req.body?.industry || "").trim() || "Non spécifié";
      const employeesRangeRaw = String(req.body?.employees || "").trim();
      const employeesRange = employeesRangeRaw || "Non spécifié";
      const companyDescription = String(req.body?.companyDescription || "").trim();

      // Si l'ID partenaire n'est pas fourni côté client, on le résout côté serveur via le code de parrainage.
      if (!referredByPartnerId) {
        const resolvedPartner = await resolvePartnerFromReferralCode(referralCodeRaw);
        if (resolvedPartner) {
          referredByPartnerId = resolvedPartner.id;
          const resolvedName = `${resolvedPartner.firstName} ${resolvedPartner.lastName}`.trim();
          partnerLabel = resolvedName || resolvedPartner.email || partnerLabel;
        }
      }

      // Synchronise le document user pour garantir l'affichage côté admin/partenaire.
      if (signupUserId) {
        const userPatch: Record<string, unknown> = {
          referredBy: referralCode,
          referredByPartnerName: partnerLabel,
        };
        if (referredByPartnerId) userPatch.referredByPartnerId = referredByPartnerId;
        if (employeesRangeRaw) userPatch.employees = employeesRangeRaw;
        if (companyDescription) userPatch.companyDescription = companyDescription;
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
        leadCreated: false,
      };

      const recipients = await prisma.userAccount.findMany({
        where: { role: { in: ["commando", "admin"] } },
        select: { uid: true },
      });

      const recipientIds = recipients.map((r) => r.uid).filter(Boolean);
      const finalRecipients = recipientIds.length > 0 ? recipientIds : ["admin_general"];

      await Promise.all(
        finalRecipients.map((recipientId) =>
          upsertDataDocument(
            "notifications",
            randomUUID().replace(/-/g, ""),
            {
              userId: recipientId,
              title: "Nouveau formulaire parrainage",
              message,
              type: "order",
              read: false,
              createdAt: new Date().toISOString(),
              metadata,
            },
            false
          )
        )
      );

      void sendStaffNotifyEmail({
        subject: "[Infinite Core] Nouveau formulaire parrainage",
        text: `${message}\n\nE-mail prospect : ${email || "—"}\nTéléphone : ${phone || "—"}\nCode parrainage : ${referralCode}`,
      }).catch((err) => console.warn("[auth/referral-signup-notify] staff email:", err));

      let leadCreated = false;
      if (referredByPartnerId && email) {
        const dedupId = leadDedupDocId(referredByPartnerId, email);
        const existingDedup = await prisma.dataDocument.findUnique({
          where: {
            collectionPath_docId: {
              collectionPath: "lead_dedup",
              docId: dedupId,
            },
          },
          select: { docId: true },
        });
        const alreadyExists = Boolean(existingDedup);

        if (!alreadyExists) {
          const leadId = randomUUID().replace(/-/g, "");
          const leadNoteParts = [
            `Inscription via lien de parrainage (${referralCode}).`,
            companyDescription ? `Description: ${companyDescription}` : "",
          ].filter(Boolean);
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
              companyDescription: companyDescription || null,
              sector: industry,
              city: "Non spécifiée",
              employeesRange,
              urgency: "moyenne",
              whatsapp: phone || "Non renseigné",
              phone: phone || "Non renseigné",
              note: leadNoteParts.join(" "),
              status: "soumis",
              createdAt: new Date().toISOString(),
            },
            false
          );
          await upsertDataDocument(
            "lead_dedup",
            dedupId,
            {
              partnerId: referredByPartnerId,
              email,
              leadId,
              createdAt: new Date().toISOString(),
            },
            false
          );
          leadCreated = true;
        }
      }

      return res.status(200).json({
        success: true,
        notified: finalRecipients.length,
        leadCreated,
      });
    } catch (error) {
      console.error("[auth/referral-signup-notify]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const loginT0 = Date.now();
    try {
      if (!appEnv.database.url) {
        return res.status(503).json({
          success: false,
          error: "Base de données non configurée (DATABASE_URL). L’authentification est indisponible.",
        });
      }
      const email = String(req.body?.email || "").trim().toLowerCase();
      const authKey = authBucketKey(req, email);
      // #region agent log
      agentSessionLog({
        runId: "initial",
        hypothesisId: "H5",
        location: "mongoApi.ts:/api/auth/login:entry",
        message: "auth_login_entry",
        data: {
          hasDatabaseUrl: !!appEnv.database.url,
          emailDomain: email.includes("@") ? email.split("@")[1] : "invalid",
        },
      });
      // #endregion
      if (await isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. Réessayez plus tard." });
      }
      const password = String(req.body?.password || "");

      if (!email || !password || !isValidEmail(email)) {
        await registerAuthFailure(authKey);
        return res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      }

      const dbLookupT0 = Date.now();
      const account = await prisma.userAccount.findUnique({ where: { email } });
      // #region agent log
      agentSessionLog({
        runId: "initial",
        hypothesisId: "H5",
        location: "mongoApi.ts:/api/auth/login:after_findUnique",
        message: "auth_login_db_lookup_done",
        data: {
          dbLookupMs: Date.now() - dbLookupT0,
          totalElapsedMs: Date.now() - loginT0,
          foundAccount: !!account,
          hasPasswordHash: !!account?.passwordHash,
        },
      });
      // #endregion
      if (!account || !account.passwordHash) {
        await registerAuthFailure(authKey);
        return res.status(401).json({ success: false, error: "Identifiants invalides." });
      }

      const bcryptT0 = Date.now();
      const valid = await bcrypt.compare(password, account.passwordHash);
      // #region agent log
      agentSessionLog({
        runId: "initial",
        hypothesisId: "H6",
        location: "mongoApi.ts:/api/auth/login:after_bcrypt_compare",
        message: "auth_login_bcrypt_done",
        data: {
          bcryptMs: Date.now() - bcryptT0,
          totalElapsedMs: Date.now() - loginT0,
          passwordValid: valid,
        },
      });
      // #endregion
      if (!valid) {
        await registerAuthFailure(authKey);
        return res.status(401).json({ success: false, error: "Identifiants invalides." });
      }

      const challengeId = randomUUID().replace(/-/g, "");
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
          createdAt: new Date().toISOString(),
          expiresAt: expiresAtIso,
        },
        false
      );

      const mailResult = await sendLoginVerificationEmail({
        to: account.email,
        code: verificationCode,
      });
      if (!mailResult.delivered) {
        await prisma.dataDocument.delete({
          where: { collectionPath_docId: { collectionPath: "auth_login_verifications", docId: challengeId } },
        });
        return res.status(503).json({
          success: false,
          error: "Service email indisponible. Configurez SMTP avant la vérification par code.",
        });
      }

      await clearAuthFailures(authKey);

      return res.status(200).json({
        success: true,
        verificationRequired: true,
        challengeId,
      });
    } catch (error) {
      // #region agent log
      agentSessionLog({
        runId: "initial",
        hypothesisId: "H5",
        location: "mongoApi.ts:/api/auth/login:catch",
        message: "auth_login_exception",
        data: {
          totalElapsedMs: Date.now() - loginT0,
          errMessage: error instanceof Error ? error.message : String(error),
        },
      });
      // #endregion
      return sendAuthPrismaError(res, "[auth/login]", error);
    }
  });

  app.post("/api/auth/logout", async (_req: Request, res: Response) => {
    clearAuthCookie(res);
    return res.status(200).json({ success: true });
  });

  app.post("/api/chats/client-email-notify", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== "admin" && auth.role !== "commando") {
        return res.status(403).json({ success: false, error: "Accès refusé." });
      }

      const clientId = String(req.body?.clientId || "").trim();
      const senderName = String(req.body?.senderName || "").trim() || "L'équipe Infinite Core";
      const messagePreviewRaw = String(req.body?.messagePreview || "").trim();
      const fallbackEmail = String(req.body?.clientEmail || "").trim().toLowerCase();
      const fallbackClientName = String(req.body?.clientName || "").trim();
      if (!clientId || !isSafeDocId(clientId)) {
        return res.status(400).json({ success: false, error: "clientId invalide." });
      }
      if (!messagePreviewRaw) {
        return res.status(400).json({ success: false, error: "messagePreview requis." });
      }

      const now = Date.now();
      const throttleDocId = `chat_client_mail_${clientId}`;
      const throttleRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "chat_email_rate_limits", docId: throttleDocId } },
        select: { data: true },
      });
      const throttleData = coerceRecord(throttleRow?.data);
      const lastSentAt = Number(throttleData.lastSentAt || 0);
      if (Number.isFinite(lastSentAt) && lastSentAt > 0 && now - lastSentAt < CLIENT_CHAT_EMAIL_THROTTLE_MS) {
        return res.status(200).json({ success: true, skipped: true, reason: "throttled" });
      }

      const clientRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "users", docId: clientId } },
        select: { data: true },
      });
      const clientData = coerceRecord(clientRow?.data);
      const email = String(clientData.email || fallbackEmail || "").trim().toLowerCase();
      if (!email || !isValidEmail(email)) {
        return res.status(200).json({ success: true, skipped: true, reason: "missing_email" });
      }
      const clientName =
        `${String(clientData.firstName || "").trim()} ${String(clientData.lastName || "").trim()}`.trim() ||
        fallbackClientName ||
        "Client";

      const messagePreview = messagePreviewRaw.length > 180 ? `${messagePreviewRaw.slice(0, 180)}...` : messagePreviewRaw;
      const result = await sendClientChatMessageEmail({
        to: email,
        clientName,
        senderName,
        messagePreview,
      });
      if (!result.delivered) {
        return res.status(200).json({ success: true, skipped: true, reason: "smtp_unavailable" });
      }

      await upsertDataDocument(
        "chat_email_rate_limits",
        throttleDocId,
        {
          clientId,
          lastSentAt: now,
          lastSenderUid: auth.uid,
          lastPreview: messagePreview,
          updatedAt: new Date().toISOString(),
        },
        false
      );

      return res.status(200).json({ success: true, sent: true });
    } catch (error) {
      console.error("[chats/client-email-notify]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/login/verify", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const challengeId = String(req.body?.challengeId || "").trim();
      const code = String(req.body?.code || "").trim();

      if (!email || !isValidEmail(email) || !challengeId || !isSafeDocId(challengeId) || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, error: "Paramètres de vérification invalides." });
      }

      const challengeRow = await prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath: "auth_login_verifications", docId: challengeId } },
      });
      const challenge = coerceRecord(challengeRow?.data);

      if (!challengeRow) {
        return res.status(400).json({ success: false, error: "Code invalide ou expiré." });
      }

      const challengeEmail = String(challenge.email || "").trim().toLowerCase();
      const challengeUid = String(challenge.uid || "").trim();
      const codeHash = String(challenge.codeHash || "");
      const used = Boolean(challenge.used);
      const attempts = Number(challenge.attempts || 0);
      const expiresAt = String(challenge.expiresAt || "");
      const expiresAtMs = Date.parse(expiresAt);

      if (
        !challengeUid ||
        !codeHash ||
        used ||
        !Number.isFinite(expiresAtMs) ||
        expiresAtMs < Date.now() ||
        challengeEmail !== email
      ) {
        return res.status(400).json({ success: false, error: "Code invalide ou expiré." });
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
              updatedAt: new Date().toISOString(),
            } as any,
          },
        });
        return res.status(400).json({ success: false, error: "Code invalide ou expiré." });
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
            usedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any,
        },
      });

      const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });
      setAuthCookie(res, token);

      return res.status(200).json({
        success: true,
        user: {
          uid: account.uid,
          email: account.email,
          role: account.role,
          displayName: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email,
        },
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/login/verify]", error);
    }
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
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
      let googlePicture: string | null = null;
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
            error: "Impossible de vérifier le compte Google (jeton invalide ou email non vérifié).",
          });
        }
      } else {
        email = String(req.body?.email || "").trim().toLowerCase();
      }

      const authKey = authBucketKey(req, email);
      if (await isAuthTemporarilyBlocked(authKey)) {
        return res.status(429).json({ success: false, error: "Trop de tentatives. Réessayez plus tard." });
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
            error: "Aucun compte équipe associé à cet identifiant Google.",
          });
        }
        if (existingForStaff.role !== "admin" && existingForStaff.role !== "commando") {
          await registerAuthFailure(authKey);
          return res.status(403).json({
            success: false,
            error: "Ce compte n'a pas accès à l'espace équipe (commando ou admin uniquement).",
          });
        }
      }

      const displayName =
        (displayNameBody || googleDisplayHint || email.split("@")[0] || email).trim() || email;

      let account = await prisma.userAccount.findUnique({ where: { email } });
      const isNew = !account;

      if (!account) {
        const [firstName = "", ...last] = displayName.split(" ");
        const uid = `usr_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

        let companyId = null;
        if (companyName) {
          companyId = `comp_${Date.now()}`;
          await upsertDataDocument(
            "companies",
            companyId,
            {
              id: companyId,
              name: companyName,
              industry: industry || "Non spécifié",
              size: size || "1-5",
              pack: "starter",
              createdAt: new Date().toISOString(),
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
            profile: {} as any,
          },
        });
      }

      const profileData: Record<string, any> = {
        uid: account.uid,
        email: account.email,
        firstName: account.firstName || "",
        lastName: account.lastName || "",
        role: account.role,
        createdAt: account.createdAt.toISOString(),
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
        const displayNameOut =
          [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || account.email;
        return res.status(200).json({
          success: true,
          user: {
            uid: account.uid,
            email: account.email,
            role: account.role,
            displayName: displayNameOut,
            photoURL: googlePicture || null,
          },
          isNew,
        });
      }

      const challengeId = randomUUID().replace(/-/g, "");
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
          createdAt: new Date().toISOString(),
          expiresAt: expiresAtIso,
        },
        false
      );
      const mailResult = await sendLoginVerificationEmail({
        to: account.email,
        code: verificationCode,
      });
      if (!mailResult.delivered) {
        await prisma.dataDocument.delete({
          where: { collectionPath_docId: { collectionPath: "auth_login_verifications", docId: challengeId } },
        });
        return res.status(503).json({
          success: false,
          error: "Service email indisponible. Configurez SMTP avant la vérification par code.",
        });
      }

      await clearAuthFailures(authKey);

      return res.status(200).json({
        success: true,
        verificationRequired: true,
        challengeId,
        isNew,
        email: account.email,
        role: account.role,
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/google]", error);
    }
  });

  app.post("/api/auth/admin-role", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      if (auth.role !== "admin") {
        return res.status(403).json({ success: false, error: "Accès refusé." });
      }

      const uid = String(req.body?.uid || "").trim();
      const requestedRoleRaw = String(req.body?.role || "").trim().toLowerCase();
      if (!uid) return res.status(400).json({ success: false, error: "UID requis." });
      if (!isSafeDocId(uid)) {
        return res.status(400).json({ success: false, error: "UID invalide." });
      }
      if (!VALID_ROLES.has(requestedRoleRaw)) {
        return res.status(400).json({
          success: false,
          error: `Rôle invalide. Rôles autorisés : ${[...VALID_ROLES].join(", ")}.`,
        });
      }

      const target = await prisma.userAccount.findUnique({
        where: { uid },
        select: { uid: true, email: true, role: true },
      });
      if (!target) {
        return res.status(404).json({ success: false, error: "Utilisateur introuvable." });
      }

      // Garde-fou : un admin ne peut pas se rétrograder lui-même
      // (évite le scénario « dernier admin qui se clique client »).
      if (target.uid === auth.uid && requestedRoleRaw !== "admin") {
        return res.status(400).json({
          success: false,
          error: "Vous ne pouvez pas modifier votre propre rôle d'admin.",
        });
      }

      // Garde-fou : empêche la rétrogradation du dernier admin.
      if (target.role === "admin" && requestedRoleRaw !== "admin") {
        const adminsCount = await prisma.userAccount.count({ where: { role: "admin" } });
        if (adminsCount <= 1) {
          return res.status(400).json({
            success: false,
            error: "Impossible de rétrograder le dernier administrateur.",
          });
        }
      }

      if (target.role === requestedRoleRaw) {
        return res.status(200).json({
          success: true,
          unchanged: true,
          uid: target.uid,
          role: requestedRoleRaw,
        });
      }

      const updatedAccount = await prisma.userAccount.update({
        where: { uid },
        data: { role: requestedRoleRaw },
      });

      // Synchronise aussi le document miroir `users` (utilisé par l'UI temps réel).
      await upsertDataDocument(
        "users",
        uid,
        {
          uid,
          email: updatedAccount.email,
          role: requestedRoleRaw,
          updatedAt: new Date().toISOString(),
          updatedByAdminUid: auth.uid,
        },
        true
      );

      return res.status(200).json({
        success: true,
        uid: updatedAccount.uid,
        email: updatedAccount.email,
        role: updatedAccount.role,
      });
    } catch (error) {
      return sendAuthPrismaError(res, "[auth/admin-role]", error);
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
          error: "Mot de passe insuffisant (8+ caractères, majuscule, minuscule, chiffre et symbole).",
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
      const resetToken = randomBytes(32).toString("hex");
      const nowIso = new Date().toISOString();
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
          requestedByAdminUid: auth.uid,
        },
        false
      );

      const mailResult = await sendResetPasswordEmail({ to: account.email, token: resetToken });
      if (!mailResult.delivered) {
        await prisma.userAccount.delete({ where: { uid: account.uid } });
        await prisma.dataDocument.deleteMany({
          where: {
            collectionPath: { in: ["users", "auth_password_resets"] },
            docId: account.uid,
          },
        });
        return res.status(503).json({
          success: false,
          error: "Le compte n'a pas été créé: SMTP est requis pour envoyer l'email d'initialisation.",
        });
      }

      return res.status(201).json({
        success: true,
        uid: account.uid,
        invitationSent: true,
        ...(!appEnv.node.isProduction ? { resetTokenPreview: resetToken } : {}),
      });
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
        ...(!appEnv.node.isProduction ? { resetTokenPreview: resetToken } : {}),
        ...(!appEnv.node.isProduction && !mailResult.delivered ? { resetLinkPreview: mailResult.previewLink } : {}),
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
    upsertDataDocument,
    queryFetchCap: appEnv.data.queryFetchCap,
  });
}
