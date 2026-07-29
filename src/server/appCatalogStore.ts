import { prisma } from "../../prismaClient";
import {
  INFINITE_APP_CATALOG,
  mergeCatalogWithDefaults,
  parseAppCatalogEntries,
  type AppCatalogEntry,
} from "@/data/appCatalog";

const COLLECTION = "admin_config";
const DOC_ID = "app_catalog";

function readDataRowAsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const LEGACY_CATALOG_IDS = new Set([
  "crm",
  "finance",
  "rh",
  "projects",
  "academy",
  "comms",
  "store",
  "pack-croissance",
  "pack-elite",
]);

function isStoredCatalogLegacy(rawApps: unknown): boolean {
  if (!Array.isArray(rawApps)) return false;
  return rawApps.some((item) => {
    if (!item || typeof item !== "object") return false;
    const id = String((item as Record<string, unknown>).id || "").trim();
    return LEGACY_CATALOG_IDS.has(id);
  });
}

/** Retire les entrées legacy (crm, finance, …) sans écraser le catalogue courant. */
function stripLegacyCatalogEntries(rawApps: unknown): unknown[] {
  if (!Array.isArray(rawApps)) return [];
  return rawApps.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const id = String((item as Record<string, unknown>).id || "").trim();
    return !LEGACY_CATALOG_IDS.has(id);
  });
}

async function persistCatalog(apps: AppCatalogEntry[]): Promise<AppCatalogEntry[]> {
  /** Liste admin = source de vérité (autorise renommage / retrait d’IDs intégrés). */
  const merged = mergeCatalogWithDefaults(apps, { preserveRemoteSet: true });
  const now = new Date().toISOString();
  await prisma.dataDocument.upsert({
    where: {
      collectionPath_docId: { collectionPath: COLLECTION, docId: DOC_ID },
    },
    create: {
      collectionPath: COLLECTION,
      docId: DOC_ID,
      data: { apps: merged, updatedAt: now, catalogVersion: 2 } as never,
    },
    update: {
      data: { apps: merged, updatedAt: now, catalogVersion: 2 } as never,
    },
  });
  return merged;
}

export async function loadAppCatalog(): Promise<AppCatalogEntry[]> {
  const row = await prisma.dataDocument.findUnique({
    where: {
      collectionPath_docId: { collectionPath: COLLECTION, docId: DOC_ID },
    },
  });
  if (!row) return mergeCatalogWithDefaults(INFINITE_APP_CATALOG);
  const data = readDataRowAsRecord(row.data);

  const rawApps = isStoredCatalogLegacy(data.apps)
    ? stripLegacyCatalogEntries(data.apps)
    : data.apps;

  const parsed = parseAppCatalogEntries(rawApps);
  if (!parsed.length) return mergeCatalogWithDefaults(INFINITE_APP_CATALOG);

  /** Catalogue déjà enregistré : ne pas réinjecter les apps intégrées renommées/retirées. */
  return mergeCatalogWithDefaults(parsed, { preserveRemoteSet: true });
}

export async function saveAppCatalog(apps: AppCatalogEntry[]): Promise<AppCatalogEntry[]> {
  return persistCatalog(apps);
}
