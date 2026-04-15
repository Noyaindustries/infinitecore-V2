import { prisma } from "../prismaClient";

type GenericDoc = Record<string, unknown>;

type DataRow = {
  docId: string;
  data: GenericDoc;
};

function asRecord(value: unknown): GenericDoc {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GenericDoc;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function toLower(value: unknown): string {
  return str(value).toLowerCase();
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value: unknown): string {
  return str(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildCommissionDocId(orderId: string): string {
  return `PCOM-${orderId}`;
}

async function updateCollectionDoc(
  collectionPath: string,
  docId: string,
  patch: GenericDoc
) {
  const existing = await prisma.dataDocument.findUnique({
    where: {
      collectionPath_docId: {
        collectionPath,
        docId,
      },
    },
  });
  if (!existing) return false;
  const data = asRecord(existing.data);
  await prisma.dataDocument.update({
    where: {
      collectionPath_docId: {
        collectionPath,
        docId,
      },
    },
    data: {
      data: {
        ...data,
        ...patch,
      } as any,
    },
  });
  return true;
}

async function upsertCollectionDoc(
  collectionPath: string,
  docId: string,
  data: GenericDoc
) {
  await prisma.dataDocument.upsert({
    where: {
      collectionPath_docId: {
        collectionPath,
        docId,
      },
    },
    create: {
      collectionPath,
      docId,
      data: data as any,
    },
    update: {
      data: data as any,
    },
  });
}

async function run() {
  const dryRun = String(process.env.BACKFILL_PARTNER_COMMISSIONS_DRY_RUN || "") === "1";
  const rows = await prisma.dataDocument.findMany({
    where: {
      collectionPath: { in: ["orders", "users", "leads", "partner_commissions", "notifications"] },
    },
  });

  const orders: DataRow[] = [];
  const usersByDocId = new Map<string, DataRow>();
  const leadsByPartnerEmail = new Map<string, DataRow[]>();
  const commissionByOrderId = new Map<string, DataRow>();

  for (const row of rows) {
    const data = asRecord(row.data);
    if (row.collectionPath === "orders") {
      orders.push({ docId: row.docId, data });
      continue;
    }
    if (row.collectionPath === "users") {
      usersByDocId.set(row.docId, { docId: row.docId, data });
      continue;
    }
    if (row.collectionPath === "leads") {
      const partnerId = str(data.partnerId);
      const email = toLower(data.email);
      if (!partnerId || !email) continue;
      const key = `${partnerId}::${email}`;
      const arr = leadsByPartnerEmail.get(key) || [];
      arr.push({ docId: row.docId, data });
      leadsByPartnerEmail.set(key, arr);
      continue;
    }
    if (row.collectionPath === "partner_commissions") {
      const orderId = str(data.orderId);
      if (!orderId) continue;
      commissionByOrderId.set(orderId, { docId: row.docId, data });
      continue;
    }
  }

  let scannedValidatedOrders = 0;
  let skippedNoUser = 0;
  let skippedNoPartner = 0;
  let skippedNoEmail = 0;
  let skippedNoLead = 0;
  let skippedNoCommissionAmount = 0;
  let skippedAlreadyPaid = 0;
  let skippedExistingCommission = 0;
  let patched = 0;

  for (const order of orders) {
    const normalizedStatus = normalizeText(order.data.status);
    const isValidatedStatus =
      normalizedStatus === "valide" ||
      normalizedStatus === "validee" ||
      normalizedStatus === "succeeded" ||
      normalizedStatus === "paid";
    if (!isValidatedStatus) continue;
    scannedValidatedOrders += 1;

    const orderId = order.docId;
    const userId = str(order.data.userId);
    if (!userId) {
      skippedNoUser += 1;
      continue;
    }

    const user = usersByDocId.get(userId);
    if (!user) {
      skippedNoUser += 1;
      continue;
    }

    const userData = user.data;
    const partnerId = str(userData.referredByPartnerId);
    if (!partnerId) {
      skippedNoPartner += 1;
      continue;
    }

    if (String(order.data.partnerCommissionPaid) === "true") {
      skippedAlreadyPaid += 1;
      continue;
    }

    if (commissionByOrderId.has(orderId)) {
      skippedExistingCommission += 1;
      continue;
    }

    const email = toLower(userData.email || order.data.clientEmail);
    if (!email) {
      skippedNoEmail += 1;
      continue;
    }

    const leadCandidates = leadsByPartnerEmail.get(`${partnerId}::${email}`) || [];
    if (!leadCandidates.length) {
      skippedNoLead += 1;
      continue;
    }

    const lead =
      leadCandidates.find((l) => !Boolean(l.data.commissionPaid)) ||
      leadCandidates[0];

    if (Boolean(lead.data.commissionPaid)) {
      skippedAlreadyPaid += 1;
      continue;
    }

    const commissionAmount = toNumber(lead.data.commissionAmount);
    if (!(commissionAmount > 0)) {
      skippedNoCommissionAmount += 1;
      continue;
    }

    const ts = nowIso();
    const leadPatch: GenericDoc = {
      commissionPaid: true,
      status: "gagne",
      updatedAt: ts,
      closedAt: str(lead.data.closedAt) || ts,
      commissionPaidAt: ts,
      commissionPaidOrderId: orderId,
    };

    const orderPatch: GenericDoc = {
      partnerCommissionPaid: true,
      partnerCommissionPaidAt: ts,
      partnerCommissionLeadId: lead.docId,
      partnerCommissionPartnerId: partnerId,
      partnerCommissionAmount: commissionAmount,
    };

    const commissionDoc: GenericDoc = {
      id: buildCommissionDocId(orderId),
      partnerId,
      leadId: lead.docId,
      orderId,
      userId,
      serviceName: str(order.data.serviceName),
      amount: commissionAmount,
      status: "paid",
      createdAt: ts,
    };

    const notifDocId = `NOTIF-PCOM-${orderId}`;
    const notifDoc: GenericDoc = {
      id: notifDocId,
      userId: partnerId,
      title: "Commission versée",
      message: `Une commission de ${commissionAmount.toLocaleString("fr-FR")} FCFA a été versée suite à la souscription de ${email}.`,
      type: "billing",
      read: false,
      createdAt: ts,
      metadata: {
        orderId,
        leadId: lead.docId,
        amount: commissionAmount,
      },
    };

    if (!dryRun) {
      await updateCollectionDoc("leads", lead.docId, leadPatch);
      await updateCollectionDoc("orders", orderId, orderPatch);
      await upsertCollectionDoc("partner_commissions", buildCommissionDocId(orderId), commissionDoc);
      await upsertCollectionDoc("notifications", notifDocId, notifDoc);
    }

    patched += 1;
  }

  console.log("Backfill commissions partenaires terminé");
  console.log(`- mode dry-run: ${dryRun ? "oui" : "non"}`);
  console.log(`- commandes validées scannées: ${scannedValidatedOrders}`);
  console.log(`- commissions rétro-versées: ${patched}`);
  console.log(`- ignorées (pas d'utilisateur): ${skippedNoUser}`);
  console.log(`- ignorées (pas de partenaire): ${skippedNoPartner}`);
  console.log(`- ignorées (pas d'email): ${skippedNoEmail}`);
  console.log(`- ignorées (pas de lead lié): ${skippedNoLead}`);
  console.log(`- ignorées (commission non définie): ${skippedNoCommissionAmount}`);
  console.log(`- ignorées (déjà versée): ${skippedAlreadyPaid}`);
  console.log(`- ignorées (journal commission déjà présent): ${skippedExistingCommission}`);
}

void run()
  .catch((error) => {
    console.error("Echec backfill commissions partenaires:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
