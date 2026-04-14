import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
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

function getJwtSecret() {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret) return envSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET est requis en production.");
  }
  return "dev-secret-change-me";
}

function signAuthToken(payload: AuthPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
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
    return jwt.verify(token, getJwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

const VALID_ROLES = new Set(["admin", "commando", "developer", "partner", "client"]);

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

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const firstName = String(req.body?.firstName || "").trim();
      const lastName = String(req.body?.lastName || "").trim();
      const companyId = req.body?.companyId ? String(req.body.companyId) : null;
      const referredBy = req.body?.referredBy ? String(req.body.referredBy) : null;
      const phone = req.body?.phone ? String(req.body.phone) : null;

      if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      }
      if (password.length < 8) {
        return res.status(400).json({ success: false, error: "Mot de passe trop court (8 minimum)." });
      }

      const existing = await prisma.userAccount.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ success: false, error: "Cet email existe déjà." });

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
      console.error("[auth/register]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");

      if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email et mot de passe requis." });
      }

      const account = await prisma.userAccount.findUnique({ where: { email } });
      if (!account || !account.passwordHash) {
        return res.status(401).json({ success: false, error: "Identifiants invalides." });
      }

      const valid = await bcrypt.compare(password, account.passwordHash);
      if (!valid) return res.status(401).json({ success: false, error: "Identifiants invalides." });

      await ensureUserDocumentFromAccount(account);
      const token = signAuthToken({ uid: account.uid, email: account.email, role: account.role });

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
      console.error("[auth/login]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/auth/logout", async (_req: Request, res: Response) => {
    return res.status(200).json({ success: true });
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const displayName = String(req.body?.displayName || "").trim();
      if (!email) return res.status(400).json({ success: false, error: "Email requis." });

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
      console.error("[auth/google]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
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
      if (!email) return res.status(400).json({ success: false, error: "Email requis." });
      const generatedPassword = password || randomUUID().replace(/-/g, "").slice(0, 16);

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

  app.post("/api/data/query", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      const collectionPath = normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const filters = (Array.isArray(req.body?.filters) ? req.body.filters : []) as QueryFilter[];
      const orders = (Array.isArray(req.body?.orders) ? req.body.orders : []) as QueryOrder[];
      const max = Number(req.body?.limit);
      const take = Number.isFinite(max) && max > 0 ? Math.min(max, 5000) : undefined;

      if (!collectionPath) {
        return res.status(400).json({ success: false, error: "collectionPath requis." });
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
      if (!collectionPath || !docId) {
        return res.status(400).json({ success: false, error: "collectionPath et docId requis." });
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
      if (!collectionPath) return res.status(400).json({ success: false, error: "collectionPath requis." });
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
      if (!collectionPath || !docId) {
        return res.status(400).json({ success: false, error: "collectionPath et docId requis." });
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
      if (!collectionPath || !docId) {
        return res.status(400).json({ success: false, error: "collectionPath et docId requis." });
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
