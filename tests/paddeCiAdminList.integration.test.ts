/**
 * Vérifie que le modèle de données utilisé par l’admin « Audits PADDE-CI » est cohérent :
 * même `id` dans `padde_ci_audits` et `orders` (docId), comme après `persistPaddeAuditToStores`
 * et comme lu par `GET /api/webhooks/padde-ci`.
 *
 * Sans `DATABASE_URL` : sortie immédiate 0 (CI / postes sans Mongo).
 */
import assert from "node:assert/strict";
import { prisma } from "../prismaClient";

const ORDERS_COLLECTION_PATH = "orders";
const auditId = `PADDE-integration-${Date.now()}`;

async function cleanup() {
  await prisma.paddeCiAudit.deleteMany({ where: { id: { startsWith: "PADDE-integration-" } } });
  await prisma.dataDocument.deleteMany({
    where: {
      collectionPath: ORDERS_COLLECTION_PATH,
      docId: { startsWith: "PADDE-integration-" },
    },
  });
}

const dbUrl = String(process.env.DATABASE_URL || "").trim();
if (!dbUrl) {
  console.log("[tests/paddeCiAdminList] SKIP : pas de DATABASE_URL (jointure admin non exécutée en CI).");
  process.exit(0);
}

await cleanup().catch(() => {});

try {
  await prisma.paddeCiAudit.create({
    data: {
      id: auditId,
      payload: { type: "audit-rapide", entreprise: "Société Test Intégration" },
      processed: false,
    },
  });

  await prisma.dataDocument.create({
    data: {
      collectionPath: ORDERS_COLLECTION_PATH,
      docId: auditId,
      data: {
        id: auditId,
        source: "padde-ci",
        status: "En attente",
        createdAt: new Date().toISOString(),
        clientName: "Société Test Intégration",
        serviceName: "Audit PADDE-CI: audit-rapide",
        details: {},
      } as object,
    },
  });

  const rows = await prisma.paddeCiAudit.findMany({
    where: { id: auditId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  assert.equal(rows.length, 1);

  const ids = rows.map((r) => r.id);
  const orderRows = await prisma.dataDocument.findMany({
    where: { collectionPath: ORDERS_COLLECTION_PATH, docId: { in: ids } },
  });
  assert.equal(
    orderRows.length,
    1,
    "L’admin GET joint padde_ci_audits.id à orders.docId : une commande doit exister pour le même id."
  );

  const orderData = orderRows[0].data as Record<string, unknown>;
  assert.equal(orderData.clientName, "Société Test Intégration");
  assert.equal(orderData.source, "padde-ci");
} finally {
  await cleanup().catch(() => {});
}

console.log("[tests/paddeCiAdminList] OK : même id audit + commande, comme webhook + liste admin.");
