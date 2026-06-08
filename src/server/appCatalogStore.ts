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

async function persistCatalog(apps: AppCatalogEntry[]): Promise<AppCatalogEntry[]> {
  const merged = mergeCatalogWithDefaults(apps);
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

  if (isStoredCatalogLegacy(data.apps)) {
    return persistCatalog(INFINITE_APP_CATALOG);
  }

  const parsed = parseAppCatalogEntries(data.apps);
  if (!parsed.length) return mergeCatalogWithDefaults(INFINITE_APP_CATALOG);

  const missingDefault = INFINITE_APP_CATALOG.some((a) => !parsed.some((c) => c.id === a.id));
  if (missingDefault) {
    return persistCatalog(mergeCatalogWithDefaults(parsed));
  }

  return mergeCatalogWithDefaults(parsed);
}

export async function saveAppCatalog(apps: AppCatalogEntry[]): Promise<AppCatalogEntry[]> {
  return persistCatalog(apps);
}
