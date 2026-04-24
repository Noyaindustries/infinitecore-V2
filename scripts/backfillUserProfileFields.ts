import { prisma } from "../prismaClient";

type GenericDoc = Record<string, unknown>;

function asRecord(value: unknown): GenericDoc {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GenericDoc;
}

function asTrimmedString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

async function run() {
  const accounts = await prisma.userAccount.findMany();

  let scanned = 0;
  let patched = 0;
  let created = 0;
  let unchanged = 0;

  for (const account of accounts) {
    scanned += 1;
    const profile = asRecord(account.profile);
    const existingRow = await prisma.dataDocument.findUnique({
      where: {
        collectionPath_docId: {
          collectionPath: "users",
          docId: account.uid,
        },
      },
    });

    const existing = asRecord(existingRow?.data);
    const next: GenericDoc = {
      ...existing,
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
      companyName: asTrimmedString(profile.companyName),
      companyDescription: asTrimmedString(profile.companyDescription),
      industry: asTrimmedString(profile.industry),
      size: asTrimmedString(profile.size),
    };

    const before = JSON.stringify(existing);
    const after = JSON.stringify(next);
    if (before === after) {
      unchanged += 1;
      continue;
    }

    await prisma.dataDocument.upsert({
      where: {
        collectionPath_docId: {
          collectionPath: "users",
          docId: account.uid,
        },
      },
      create: {
        collectionPath: "users",
        docId: account.uid,
        data: next as any,
      },
      update: {
        data: next as any,
      },
    });

    patched += 1;
    if (!existingRow) created += 1;
  }

  console.log("Backfill profils utilisateurs terminé");
  console.log(`- comptes scannés: ${scanned}`);
  console.log(`- profils patchés: ${patched}`);
  console.log(`- profils créés: ${created}`);
  console.log(`- profils inchangés: ${unchanged}`);
}

void run()
  .catch((error) => {
    console.error("Echec backfill profils utilisateurs:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
