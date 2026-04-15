import { prisma } from "../prismaClient";

type GenericDoc = Record<string, unknown>;

type PartnerInfo = {
  uid: string;
  name: string;
  email: string;
  keys: Set<string>;
};

function asRecord(value: unknown): GenericDoc {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GenericDoc;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePartnerCode(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "-")
    .replace("PART-USR", "PART-INF");
}

function buildPartnerCode(uid: string, length: number): string {
  return `PART-${uid.substring(0, length).toUpperCase().replace("USR", "INF")}`;
}

function normalizedName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function run() {
  const forceSinglePartner = String(process.env.BACKFILL_REFERRAL_ASSIGN_SINGLE_PARTNER || "") === "1";
  const userRows = await prisma.dataDocument.findMany({
    where: { collectionPath: "users" },
  });

  const partners: PartnerInfo[] = userRows
    .map((row) => {
      const data = asRecord(row.data);
      const role = str(data.role).toLowerCase();
      if (role !== "partner") return null;
      const uid = str(data.uid) || row.docId;
      if (!uid) return null;
      const fullName = `${str(data.firstName)} ${str(data.lastName)}`.trim();
      const partnerName = fullName || str(data.email) || uid;
      const keys = new Set<string>(
        [
          normalizePartnerCode(str(data.referralCode)),
          normalizePartnerCode(str(data.partnerCode)),
          normalizePartnerCode(buildPartnerCode(uid, 5)),
          normalizePartnerCode(buildPartnerCode(uid, 6)),
          uid.toUpperCase(),
        ].filter(Boolean)
      );
      return {
        uid,
        name: partnerName,
        email: str(data.email),
        keys,
      };
    })
    .filter((item): item is PartnerInfo => Boolean(item));

  const partnerByKey = new Map<string, PartnerInfo>();
  const partnerByName = new Map<string, PartnerInfo>();
  for (const partner of partners) {
    for (const key of partner.keys) {
      if (!partnerByKey.has(key)) partnerByKey.set(key, partner);
    }
    const nameKey = normalizedName(partner.name);
    if (nameKey && !partnerByName.has(nameKey)) partnerByName.set(nameKey, partner);
  }

  let scannedClients = 0;
  let patchedUsers = 0;
  let alreadyLinked = 0;
  let unresolved = 0;
  let forcedBySinglePartner = 0;

  for (const row of userRows) {
    const data = asRecord(row.data);
    const role = str(data.role).toLowerCase();
    if (role !== "client") continue;
    scannedClients += 1;

    const currentPartnerId = str(data.referredByPartnerId);
    if (currentPartnerId) {
      alreadyLinked += 1;
      continue;
    }

    const referredBy = str(data.referredBy);
    const referredByName = str(data.referredByPartnerName);
    const candidateByCode = referredBy ? partnerByKey.get(normalizePartnerCode(referredBy)) : undefined;
    const candidateByName = referredByName ? partnerByName.get(normalizedName(referredByName)) : undefined;
    const partner = candidateByCode || candidateByName;

    const fallbackSinglePartner = !partner && forceSinglePartner && partners.length === 1 ? partners[0] : null;
    const resolvedPartner = partner || fallbackSinglePartner;

    if (!resolvedPartner) {
      unresolved += 1;
      continue;
    }

    await prisma.dataDocument.update({
      where: {
        collectionPath_docId: {
          collectionPath: "users",
          docId: row.docId,
        },
      },
      data: {
        data: {
          ...data,
          referredByPartnerId: resolvedPartner.uid,
          referredByPartnerName: resolvedPartner.name,
        } as any,
      },
    });

    patchedUsers += 1;
    if (!partner && fallbackSinglePartner) forcedBySinglePartner += 1;
  }

  console.log("Backfill referral terminé");
  console.log(`- partenaires détectés: ${partners.length}`);
  console.log(`- clients scannés: ${scannedClients}`);
  console.log(`- déjà liés: ${alreadyLinked}`);
  console.log(`- clients patchés: ${patchedUsers}`);
  console.log(`- patchés en mode partenaire unique: ${forcedBySinglePartner}`);
  console.log(`- non résolus: ${unresolved}`);
  if (forceSinglePartner && partners.length === 1) {
    console.log(`- partenaire unique utilisé: ${partners[0].uid} (${partners[0].name})`);
  }
}

void run()
  .catch((error) => {
    console.error("Echec backfill referral:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

