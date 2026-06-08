import type { PrismaClient } from "@prisma/client";
import type { AppCatalogEntry } from "@/data/appCatalog";
import { licenseDocId, isLicenseActive, type AppLicense } from "@/lib/licenses";
import { LICENSES_COLLECTION_PATH } from "@/server/licenseActivation";
import { prisma as defaultPrisma } from "../../prismaClient";

export const FILE_REGISTRY_COLLECTION = "__file_registry";

export type FileAccessAuth = {
  uid: string;
  role: string;
};

const STAFF_ROLES = new Set(["admin", "commando"]);

export function isStaffFileRole(role: string): boolean {
  return STAFF_ROLES.has(String(role || "").toLowerCase());
}

export function findCatalogAppByPackagePublicId(
  catalog: AppCatalogEntry[],
  publicId: string
): AppCatalogEntry | undefined {
  const normalized = publicId.trim();
  if (!normalized) return undefined;
  return catalog.find((app) => app.licensePackagePublicId?.trim() === normalized);
}

export async function registerUploadedFile(
  publicId: string,
  ownerUid: string,
  folder: string,
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const docId = publicId.trim();
  if (!docId || !ownerUid) return;
  await db.dataDocument.upsert({
    where: {
      collectionPath_docId: { collectionPath: FILE_REGISTRY_COLLECTION, docId },
    },
    create: {
      collectionPath: FILE_REGISTRY_COLLECTION,
      docId,
      data: {
        publicId: docId,
        ownerUid,
        folder: folder.trim() || "misc",
        createdAt: new Date().toISOString(),
      } as never,
    },
    update: {
      data: {
        publicId: docId,
        ownerUid,
        folder: folder.trim() || "misc",
        updatedAt: new Date().toISOString(),
      } as never,
    },
  });
}

export async function removeFileRegistryEntry(
  publicId: string,
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const docId = publicId.trim();
  if (!docId) return;
  await db.dataDocument.deleteMany({
    where: { collectionPath: FILE_REGISTRY_COLLECTION, docId },
  });
}

async function userHasActiveLicenseForApp(
  uid: string,
  appId: string,
  db: PrismaClient
): Promise<boolean> {
  const row = await db.dataDocument.findUnique({
    where: {
      collectionPath_docId: {
        collectionPath: LICENSES_COLLECTION_PATH,
        docId: licenseDocId(uid, appId),
      },
    },
  });
  if (!row) return false;
  const license = (row.data || {}) as unknown as AppLicense;
  return isLicenseActive(license);
}

export async function assertFileAccess(
  auth: FileAccessAuth,
  publicId: string,
  options: {
    catalog: AppCatalogEntry[];
    db?: PrismaClient;
  }
): Promise<{ ok: true } | { ok: false; error: string; status: 403 | 404 }> {
  const normalized = publicId.trim();
  if (!normalized) {
    return { ok: false, error: "publicId invalide.", status: 404 };
  }

  if (isStaffFileRole(auth.role)) {
    return { ok: true };
  }

  const licensedApp = findCatalogAppByPackagePublicId(options.catalog, normalized);
  if (licensedApp) {
    const db = options.db ?? defaultPrisma;
    if (await userHasActiveLicenseForApp(auth.uid, licensedApp.id, db)) {
      return { ok: true };
    }
  }

  const db = options.db ?? defaultPrisma;
  const row = await db.dataDocument.findUnique({
    where: {
      collectionPath_docId: { collectionPath: FILE_REGISTRY_COLLECTION, docId: normalized },
    },
  });

  if (!row) {
    return { ok: false, error: "Fichier introuvable ou accès refusé.", status: 404 };
  }

  const data = (row.data && typeof row.data === "object" ? row.data : {}) as Record<string, unknown>;
  const ownerUid = String(data.ownerUid || "").trim();
  if (ownerUid && ownerUid === auth.uid) {
    return { ok: true };
  }

  return { ok: false, error: "Accès refusé.", status: 403 };
}
