import { MongoClient } from "mongodb";
import { appEnv } from "../src/config/env";
import { upsertSplitDoc } from "../src/server/dataStores";
import { prisma } from "../prismaClient";
import bcrypt from "bcryptjs";

type SeedUser = {
  uid: string;
  email: string;
  role: "admin" | "commando" | "developer" | "partner" | "client";
  firstName: string;
  lastName: string;
  companyId?: string;
};

const nowIso = () => new Date().toISOString();

async function upsertDataDocument(collectionPath: string, docId: string, data: Record<string, unknown>) {
  await prisma.dataDocument.upsert({
    where: { collectionPath_docId: { collectionPath, docId } },
    create: { collectionPath, docId, data: data as any },
    update: { data: data as any },
  });
}

async function seedUsers(password: string) {
  const hash = await bcrypt.hash(password, 10);
  const users: SeedUser[] = [
    {
      uid: "usr_admin_test",
      email: "admin.test@infinitecore.local",
      role: "admin",
      firstName: "Alice",
      lastName: "Admin",
    },
    {
      uid: "usr_commando_test",
      email: "commando.test@infinitecore.local",
      role: "commando",
      firstName: "Cyril",
      lastName: "Commando",
    },
    {
      uid: "usr_dev_test",
      email: "dev.test@infinitecore.local",
      role: "developer",
      firstName: "Diane",
      lastName: "Dev",
    },
    {
      uid: "usr_partner_test",
      email: "partner.test@infinitecore.local",
      role: "partner",
      firstName: "Patrick",
      lastName: "Partner",
    },
    {
      uid: "usr_client_test",
      email: "client.test@infinitecore.local",
      role: "client",
      firstName: "Chloe",
      lastName: "Client",
      companyId: "comp_test_001",
    },
  ];

  for (const user of users) {
    await prisma.userAccount.upsert({
      where: { uid: user.uid },
      create: {
        uid: user.uid,
        email: user.email,
        passwordHash: hash,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId || null,
        provider: "seed",
        profile: { source: "seed-test-data" } as any,
      },
      update: {
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId || null,
      },
    });

    await upsertDataDocument("users", user.uid, {
      uid: user.uid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyId: user.companyId || null,
      createdAt: nowIso(),
    });
  }
}

/** Supprime les étapes dossier du client test (collections scindées + legacy `data_documents`). */
async function resetClientDossierStepsForE2e() {
  const uri = appEnv.database.url;
  if (uri) {
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const col = client.db().collection("data_dossier_steps");
      await col.deleteMany({ "data.clientId": "usr_client_test" });
    } finally {
      await client.close();
    }
  }

  const existingDossierSteps = await prisma.dataDocument.findMany({
    where: { collectionPath: "dossier_steps" },
    select: { id: true, data: true },
  });
  for (const row of existingDossierSteps) {
    const clientId = (row.data as { clientId?: string } | null)?.clientId;
    if (clientId === "usr_client_test") {
      await prisma.dataDocument.delete({ where: { id: row.id } });
    }
  }
}

async function seedBusinessData() {
  await upsertDataDocument("companies", "comp_test_001", {
    id: "comp_test_001",
    name: "Acme Test Company",
    industry: "Services",
    size: "6-20",
    pack: "starter",
    createdAt: nowIso(),
  });

  await upsertDataDocument("missions", "mission_test_001", {
    id: "mission_test_001",
    clientId: "usr_client_test",
    clientName: "Chloe Client",
    assignedTo: "usr_dev_test",
    assignedToName: "Diane Dev",
    title: "Audit UX landing",
    description: "Audit complet de la page marketing et recommandations",
    status: "en_cours",
    priority: "moyenne",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await upsertDataDocument("payments", "payment_test_001", {
    id: "payment_test_001",
    userId: "usr_client_test",
    clientId: "usr_client_test",
    clientEmail: "client.test@infinitecore.local",
    amount: 250000,
    currency: "XOF",
    status: "pending",
    description: "Audit UX landing",
    factureEtape: "generation",
    createdAt: nowIso(),
  });

  await upsertDataDocument("orders", "order_test_001", {
    id: "order_test_001",
    userId: "usr_client_test",
    clientId: "usr_client_test",
    clientName: "Chloe Client",
    clientEmail: "client.test@infinitecore.local",
    serviceName: "Audit UX landing",
    amount: 250000,
    status: "Nouveau",
    createdAt: nowIso(),
  });

  await resetClientDossierStepsForE2e();

  const dossierStepAudit = {
    id: "dossier_step_test_audit",
    clientId: "usr_client_test",
    stepType: "audit",
    title: "Audit",
    fileUrl: "https://example.com/audit-test.pdf",
    fileName: "audit-test.pdf",
    fileSize: 102400,
    storagePath: "tests/dossier/audit-test.pdf",
    uploadedAt: nowIso(),
    uploadedBy: "usr_commando_test",
    uploadedByName: "Cyril Commando",
    status: "soumis",
    note: "Document de test pour validation client",
  };

  await upsertSplitDoc("dossier_steps", "dossier_step_test_audit", dossierStepAudit, false);
  await upsertDataDocument("dossier_steps", "dossier_step_test_audit", dossierStepAudit);

  await upsertDataDocument("leads", "lead_test_001", {
    id: "lead_test_001",
    partnerId: "usr_partner_test",
    partnerName: "Patrick Partner",
    firstName: "Nadia",
    lastName: "Prospect",
    email: "prospect@example.com",
    companyName: "Prospect Corp",
    whatsapp: "+22501020304",
    status: "soumis",
    createdAt: nowIso(),
  });

  await upsertDataDocument("notifications", "notif_test_001", {
    id: "notif_test_001",
    userId: "usr_client_test",
    title: "Bienvenue sur Infinite Core",
    message: "Vos données de test ont bien ete initialisees.",
    type: "system",
    read: false,
    createdAt: nowIso(),
  });

  await upsertDataDocument("chats", "usr_client_test", {
    clientId: "usr_client_test",
    clientName: "Chloe Client",
    clientEmail: "client.test@infinitecore.local",
    lastMessage: "Bonjour, je voudrais suivre ma mission.",
    lastMessageAt: nowIso(),
    unreadCommando: true,
    unreadClient: false,
  });

  await upsertDataDocument("chats/usr_client_test/messages", "msg_test_001", {
    id: "msg_test_001",
    senderId: "usr_client_test",
    senderName: "Chloe Client",
    senderRole: "client",
    text: "Bonjour, je voudrais suivre ma mission.",
    type: "text",
    readByCommando: false,
    createdAt: nowIso(),
  });
}

async function run() {
  const seedPassword = appEnv.seed.testPassword;
  await seedUsers(seedPassword);
  await seedBusinessData();
  console.log("Seed test data termine.");
  console.log("Mot de passe test commun:", seedPassword);
  console.log("Comptes tests:");
  console.log("- admin.test@infinitecore.local (admin)");
  console.log("- commando.test@infinitecore.local (commando)");
  console.log("- dev.test@infinitecore.local (developer)");
  console.log("- partner.test@infinitecore.local (partner)");
  console.log("- client.test@infinitecore.local (client)");
}

void run()
  .catch((error) => {
    console.error("Erreur seed test data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(process.exitCode ?? 0);
    }
  });
