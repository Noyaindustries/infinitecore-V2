import { prisma } from "../prismaClient";

type LegacyUser = {
  uid?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  companyId?: string;
  referredBy?: string | null;
  photoURL?: string | null;
  createdAt?: string;
};

function asLegacyUser(data: unknown): LegacyUser {
  if (!data || typeof data !== "object") return {};
  return data as LegacyUser;
}

async function run() {
  const legacyDocs = await prisma.dataDocument.findMany({
    where: { collectionPath: "users" },
    orderBy: { updatedAt: "desc" },
  });

  let scanned = 0;
  let created = 0;
  let updated = 0;
  let skippedNoEmail = 0;
  let skippedConflicts = 0;
  const conflictRows: string[] = [];

  for (const row of legacyDocs) {
    scanned += 1;
    const legacy = asLegacyUser(row.data);
    const uid = String(legacy.uid || row.docId || "").trim();
    const email = String(legacy.email || "").trim().toLowerCase();
    if (!uid || !email) {
      skippedNoEmail += 1;
      continue;
    }

    const byUid = await prisma.userAccount.findUnique({ where: { uid } });
    const byEmail = await prisma.userAccount.findUnique({ where: { email } });

    if (byUid && byEmail && byUid.id !== byEmail.id) {
      skippedConflicts += 1;
      conflictRows.push(`${uid} <-> ${email}`);
      continue;
    }

    const target = byUid ?? byEmail;
    const payload = {
      uid,
      email,
      firstName: legacy.firstName || null,
      lastName: legacy.lastName || null,
      phone: legacy.phone || null,
      role: legacy.role || "client",
      companyId: legacy.companyId || null,
      referredBy: legacy.referredBy || null,
      photoURL: legacy.photoURL || null,
      provider: "legacy-migration",
      profile: {
        source: "users-collection",
        migratedAt: new Date().toISOString(),
      } as any,
    };

    if (target) {
      await prisma.userAccount.update({
        where: { id: target.id },
        data: payload,
      });
      updated += 1;
    } else {
      await prisma.userAccount.create({
        data: payload,
      });
      created += 1;
    }
  }

  console.log("Migration terminée");
  console.log(`- scannés: ${scanned}`);
  console.log(`- créés: ${created}`);
  console.log(`- mis à jour: ${updated}`);
  console.log(`- ignorés (sans email/uid): ${skippedNoEmail}`);
  console.log(`- conflits: ${skippedConflicts}`);
  if (conflictRows.length) {
    console.log("Conflits détectés:");
    for (const item of conflictRows) console.log(`  - ${item}`);
  }
}

void run()
  .catch((error) => {
    console.error("Echec migration users -> user_accounts:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
