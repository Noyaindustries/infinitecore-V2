import type { Express, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import type { QueryFilter, QueryOrder } from "./mongo/dataQueryTypes";
import { deleteSplitDoc, getSplitDoc, listSplitDocs, upsertSplitDoc } from "@/server/dataStores";

export type { QueryFilter, QueryOrder } from "./mongo/dataQueryTypes";

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
  /** Limite Prisma `take` sur `data_documents` pour une requête (voir `DATA_QUERY_FETCH_CAP`). */
  queryFetchCap: number;
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

/**
 * Construit des clauses de filtre JSON style Prisma (`path` + `equals`, etc.).
 * Utile pour tests / référence — **non supporté** par le connecteur Prisma MongoDB
 * sur les champs `Json` (cf. doc Prisma : filtrage avancé JSON = PostgreSQL / MySQL uniquement).
 */
/** Requête typique « Audits PADDE-CI » : sans parcours élargi, le filtre `source` est appliqué après un `take` trop petit et peut masquer toutes les lignes. */
export function isOrdersPaddeCiSourceOnlyQuery(collectionPath: string, filters: QueryFilter[]): boolean {
  if (collectionPath !== "orders") return false;
  if (filters.length !== 1) return false;
  const f = filters[0];
  return f.field === "source" && f.operator === "==" && String(f.value) === "padde-ci";
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

      // MongoDB + Prisma : pas de filtre `Json.path` fiable — on charge par `collectionPath`
      // puis on applique les filtres en mémoire (déjà implémentés et testés côté `mongoApi`).
      const fetchCap = Math.max(1, Math.floor(deps.queryFetchCap));
      const paddeOrdersWide = isOrdersPaddeCiSourceOnlyQuery(collectionPath, filters);

      let totalScanned = 0;
      let filtered: Array<{ docId: string; data: Record<string, unknown> }>;

      if (paddeOrdersWide) {
        // Parcourt la collection par pages jusqu'à épuisement (plafond sécurité) : les commandes
        // PADDE sont rares par rapport au volume total `orders` après migration Prisma.
        const PAGE_SIZE = 2500;
        const MAX_RAW_DOCS = Math.min(50_000, Math.max(fetchCap * 20, 10_000));
        const MAX_SCAN_MS = 8_000;
        const startedAt = Date.now();
        const matches: Array<{ docId: string; data: Record<string, unknown> }> = [];
        let skip = 0;
        while (totalScanned < MAX_RAW_DOCS) {
          if (Date.now() - startedAt >= MAX_SCAN_MS) break;
          const page = await deps.prisma.dataDocument.findMany({
            where: { collectionPath } as never,
            orderBy: { updatedAt: "desc" },
            take: PAGE_SIZE,
            skip,
          });
          if (page.length === 0) break;
          totalScanned += page.length;
          const normalizedPage = page.map((row) => ({
            docId: row.docId,
            data: deps.coerceRecord(row.data),
          }));
          matches.push(...deps.applyFilters(normalizedPage, filters));
          skip += page.length;
          if (page.length < PAGE_SIZE) break;
        }
        filtered = matches;
      } else {
        const splitRows = await listSplitDocs(collectionPath, fetchCap);
        const splitById = new Map(splitRows.map((row) => [row.docId, row]));
        const rows = await deps.prisma.dataDocument.findMany({
          where: { collectionPath } as never,
          orderBy: { updatedAt: "desc" },
          take: fetchCap,
        });
        const mergedLegacy = rows
          .map((row) => ({
            docId: row.docId,
            data: deps.coerceRecord(row.data),
          }))
          .filter((row) => !splitById.has(row.docId));
        const normalized = [...splitRows, ...mergedLegacy].slice(0, fetchCap);
        totalScanned = normalized.length;
        filtered = deps.applyFilters(normalized, filters);
      }

      const ordered = deps.applyOrder(filtered, orders);
      const paged = ordered.slice(parsed.offset, parsed.offset + parsed.limit);

      return res.status(200).json({
        success: true,
        docs: paged.map((row) => ({ id: row.docId, data: row.data })),
        queryMeta: {
          scannedDocuments: totalScanned,
          fetchCap,
          matchedAfterFilter: filtered.length,
          returned: paged.length,
          offset: parsed.offset,
          limit: parsed.limit,
          /** `true` si on a atteint le plafond : d'autres documents peuvent exister en base non chargés. */
          mayHaveMoreInDatabase: paddeOrdersWide
            ? totalScanned >= Math.min(50_000, Math.max(fetchCap * 20, 10_000))
            : totalScanned >= fetchCap,
          ...(paddeOrdersWide ? { wideScanPaddeOrders: true as const } : {}),
        },
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
      const splitRow = await getSplitDoc(collectionPath, docId);
      return res.status(200).json({
        success: true,
        exists: Boolean(splitRow || row),
        doc: splitRow
          ? { id: splitRow.docId, data: deps.coerceRecord(splitRow.data) }
          : row
            ? { id: row.docId, data: deps.coerceRecord(row.data) }
            : null,
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

      const splitCurrent = await getSplitDoc(collectionPath, docId);
      const legacyCurrent = await deps.prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath, docId } },
        select: { data: true },
      });
      const fallbackCurrent = splitCurrent
        ? deps.coerceRecord(splitCurrent.data)
        : deps.coerceRecord(legacyCurrent?.data);
      await deps.upsertDataDocument(collectionPath, docId, incoming, merge);
      await upsertSplitDoc(collectionPath, docId, incoming, merge, fallbackCurrent);
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

      const splitExisting = await getSplitDoc(collectionPath, docId);
      const existing = await deps.prisma.dataDocument.findUnique({
        where: { collectionPath_docId: { collectionPath, docId } },
      });
      const current = splitExisting ? deps.coerceRecord(splitExisting.data) : deps.coerceRecord(existing?.data);
      if (!Object.keys(current).length && !existing && !splitExisting) {
        return res.status(404).json({ success: false, error: "Document introuvable." });
      }

      const next = { ...current, ...updates };
      for (const key of deleteKeys) delete next[key];

      await deps.prisma.dataDocument.upsert({
        where: { collectionPath_docId: { collectionPath, docId } },
        create: { collectionPath, docId, data: next as never },
        update: { data: next as never },
      });
      await upsertSplitDoc(collectionPath, docId, next, false);

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
      await deleteSplitDoc(collectionPath, docId);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[data/doc:delete]", error);
      return res.status(500).json({ success: false, error: "Erreur interne du serveur." });
    }
  });
}
