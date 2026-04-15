import type { Express, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

export type QueryFilter = {
  field: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  value: unknown;
};

type QueryOrder = {
  field: string;
  direction?: "asc" | "desc";
};

type AuthPayload = {
  uid: string;
  email: string;
  role: string;
};

type RegisterDataRoutesDeps = {
  prisma: PrismaClient;
  requireAuth: (req: Request, res: Response) => Promise<AuthPayload | null>;
  normalizeCollectionPath: (path: string) => string;
  isSafeCollectionPath: (path: string) => boolean;
  isSafeDocId: (docId: string) => boolean;
  isSafeFieldName: (fieldName: string) => boolean;
  sanitizeFilters: (raw: unknown) => QueryFilter[] | null;
  sanitizeOrders: (raw: unknown) => QueryOrder[] | null;
  assertDataQueryAuthorized: (
    auth: AuthPayload,
    collectionPath: string,
    filters: QueryFilter[]
  ) => { ok: true } | { ok: false; error: string };
  assertDataDocAuthorized: (
    auth: AuthPayload,
    op: "read" | "write",
    collectionPath: string,
    docId: string,
    payload?: Record<string, unknown>
  ) => { ok: true } | { ok: false; error: string };
  coerceRecord: (value: unknown) => Record<string, unknown>;
  applyFilters: (
    rows: Array<{ docId: string; data: Record<string, unknown> }>,
    filters: QueryFilter[]
  ) => Array<{ docId: string; data: Record<string, unknown> }>;
  applyOrder: (
    rows: Array<{ docId: string; data: Record<string, unknown> }>,
    orders: QueryOrder[]
  ) => Array<{ docId: string; data: Record<string, unknown> }>;
  upsertDataDocument: (
    collectionPath: string,
    docId: string,
    data: Record<string, unknown>,
    merge: boolean
  ) => Promise<void>;
};

export function parseDataQueryInput(body: unknown) {
  const raw = (body ?? {}) as Record<string, unknown>;
  const max = Number(raw.limit);
  const offsetRaw = Number(raw.offset);
  const limit = Number.isFinite(max) && max > 0 ? Math.min(max, 1000) : 100;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.min(offsetRaw, 100_000) : 0;
  return {
    collectionPathRaw: String(raw.collectionPath || ""),
    filtersRaw: raw.filters,
    ordersRaw: raw.orders,
    limit,
    offset,
  };
}

export function buildDbFiltersFromQueryFilters(filters: QueryFilter[]) {
  const dbFilters: unknown[] = [];
  for (const filter of filters) {
    const path = [filter.field];
    switch (filter.operator) {
      case "==":
        dbFilters.push({ data: { path, equals: filter.value } });
        break;
      case "!=":
        dbFilters.push({ NOT: { data: { path, equals: filter.value } } });
        break;
      case ">":
        dbFilters.push({ data: { path, gt: filter.value } });
        break;
      case ">=":
        dbFilters.push({ data: { path, gte: filter.value } });
        break;
      case "<":
        dbFilters.push({ data: { path, lt: filter.value } });
        break;
      case "<=":
        dbFilters.push({ data: { path, lte: filter.value } });
        break;
      default:
        return null;
    }
  }
  return dbFilters;
}

export function registerDataRoutes(app: Express, deps: RegisterDataRoutesDeps) {
  app.post("/api/data/query", async (req: Request, res: Response) => {
    try {
      const auth = await deps.requireAuth(req, res);
      if (!auth) return;

      const parsed = parseDataQueryInput(req.body);
      const collectionPath = deps.normalizeCollectionPath(parsed.collectionPathRaw);
      const filters = deps.sanitizeFilters(parsed.filtersRaw);
      const orders = deps.sanitizeOrders(parsed.ordersRaw);

      if (!collectionPath || !deps.isSafeCollectionPath(collectionPath) || filters === null || orders === null) {
        return res.status(400).json({ success: false, error: "Paramètres de requête invalides." });
      }

      const authz = deps.assertDataQueryAuthorized(auth, collectionPath, filters);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });

      const dbFilters = buildDbFiltersFromQueryFilters(filters);
      let rows: Awaited<ReturnType<typeof deps.prisma.dataDocument.findMany>>;

      if (dbFilters) {
        try {
          const dbWhere = { AND: [{ collectionPath }, ...dbFilters] } as unknown;
          rows = await deps.prisma.dataDocument.findMany({
            where: dbWhere as never,
            take: 5000,
          });
        } catch (error) {
          // Certains connecteurs Prisma ne supportent pas les filtres JSON avancés
          // de la même manière en runtime. On retombe en filtrage applicatif pour
          // éviter un 500 côté client.
          console.warn("[data/query] fallback to in-memory filters", {
            collectionPath,
            filtersCount: filters.length,
            error: error instanceof Error ? error.message : String(error),
          });
          rows = await deps.prisma.dataDocument.findMany({
            where: { collectionPath } as never,
            take: 5000,
          });
        }
      } else {
        rows = await deps.prisma.dataDocument.findMany({
          where: { collectionPath } as never,
          take: 5000,
        });
      }

      const normalized = rows.map((row) => ({
        docId: row.docId,
        data: deps.coerceRecord(row.data),
      }));
      const filtered = dbFilters ? normalized : deps.applyFilters(normalized, filters);
      const ordered = deps.applyOrder(filtered, orders);
      const paged = ordered.slice(parsed.offset, parsed.offset + parsed.limit);

      return res.status(200).json({
        success: true,
        docs: paged.map((row) => ({ id: row.docId, data: row.data })),
      });
    } catch (error) {
      console.error("[data/query]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.get("/api/data/doc", async (req: Request, res: Response) => {
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
        where: { collectionPath_docId: { collectionPath, docId } },
      });
      return res.status(200).json({
        success: true,
        exists: Boolean(row),
        doc: row ? { id: row.docId, data: deps.coerceRecord(row.data) } : null,
      });
    } catch (error) {
      console.error("[data/doc:get]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.post("/api/data/doc", async (req: Request, res: Response) => {
    try {
      const auth = await deps.requireAuth(req, res);
      if (!auth) return;
      const collectionPath = deps.normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const merge = Boolean(req.body?.merge);
      const incoming = deps.coerceRecord(req.body?.data);
      const docId = String(req.body?.docId || "").trim() || randomUUID().replace(/-/g, "");
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

  app.patch("/api/data/doc", async (req: Request, res: Response) => {
    try {
      const auth = await deps.requireAuth(req, res);
      if (!auth) return;
      const collectionPath = deps.normalizeCollectionPath(String(req.body?.collectionPath || ""));
      const docId = String(req.body?.docId || "").trim();
      const updates = deps.coerceRecord(req.body?.data);
      const deleteKeys = Array.isArray(req.body?.deleteKeys) ? (req.body.deleteKeys as string[]) : [];
      if (
        !collectionPath ||
        !docId ||
        !deps.isSafeCollectionPath(collectionPath) ||
        !deps.isSafeDocId(docId) ||
        !deleteKeys.every((key) => deps.isSafeFieldName(String(key)))
      ) {
        return res.status(400).json({ success: false, error: "collectionPath et docId invalides." });
      }
      const authz = deps.assertDataDocAuthorized(auth, "write", collectionPath, docId, updates);
      if (authz.ok === false) return res.status(403).json({ success: false, error: authz.error });

      const existing = await deps.prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath, docId } },
      });
      if (!existing) return res.status(404).json({ success: false, error: "Document introuvable." });

      const next = { ...deps.coerceRecord(existing.data), ...updates };
      for (const key of deleteKeys) delete next[key];

      await deps.prisma.dataDocument.update({
        where: { collectionPath_docId: { collectionPath, docId } },
        data: { data: next as never },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[data/doc:patch]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });

  app.delete("/api/data/doc", async (req: Request, res: Response) => {
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
        where: { collectionPath, docId },
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[data/doc:delete]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
}
