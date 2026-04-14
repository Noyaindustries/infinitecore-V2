import path from "path";
import { readFileSync } from "fs";
import { prisma } from "../prismaClient";

type FirebaseConfig = {
  apiKey: string;
  projectId: string;
  firestoreDatabaseId?: string;
};

type FirestoreDoc = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { timestampValue: string };

function loadFirebaseConfig(): FirebaseConfig {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  return JSON.parse(readFileSync(configPath, "utf8")) as FirebaseConfig;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Variable manquante: ${name}`);
  }
  return value.trim();
}

function parseFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(parseFirestoreValue);
  if ("mapValue" in value) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      obj[k] = parseFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function parseFirestoreFields(fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields || {})) {
    out[k] = parseFirestoreValue(v);
  }
  return out;
}

async function signInWithPassword(apiKey: string, email: string, password: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Echec auth Firebase (${response.status}): ${txt}`);
  }
  const data = (await response.json()) as { idToken: string };
  return data.idToken;
}

async function fetchAllCollectionDocs(
  projectId: string,
  databaseId: string,
  collection: string,
  idToken: string
): Promise<FirestoreDoc[]> {
  const docs: FirestoreDoc[] = [];
  let pageToken = "";
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collection}`
    );
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Lecture collection ${collection} impossible (${response.status}): ${txt}`);
    }
    const payload = (await response.json()) as {
      documents?: FirestoreDoc[];
      nextPageToken?: string;
    };
    docs.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return docs;
}

function extractDocId(name: string): string {
  const parts = name.split("/");
  return parts[parts.length - 1] || "";
}

async function run() {
  const cfg = loadFirebaseConfig();
  const email = requireEnv("FIREBASE_ADMIN_EMAIL");
  const password = requireEnv("FIREBASE_ADMIN_PASSWORD");
  const databaseId = cfg.firestoreDatabaseId || "(default)";

  const idToken = await signInWithPassword(cfg.apiKey, email, password);
  console.log("Connexion Firebase OK");

  const [userDocs, companyDocs] = await Promise.all([
    fetchAllCollectionDocs(cfg.projectId, databaseId, "users", idToken),
    fetchAllCollectionDocs(cfg.projectId, databaseId, "companies", idToken),
  ]);

  let usersCreated = 0;
  let usersUpdated = 0;
  let usersSkipped = 0;
  let companiesUpserted = 0;

  for (const doc of companyDocs) {
    const docId = extractDocId(doc.name);
    const data = parseFirestoreFields(doc.fields);
    await prisma.dataDocument.upsert({
      where: { collectionPath_docId: { collectionPath: "companies", docId } },
      create: { collectionPath: "companies", docId, data: data as any },
      update: { data: data as any },
    });
    companiesUpserted += 1;
  }

  for (const doc of userDocs) {
    const docId = extractDocId(doc.name);
    const data = parseFirestoreFields(doc.fields);
    const uid = String(data.uid || docId || "").trim();
    const emailValue = String(data.email || "").trim().toLowerCase();
    if (!uid || !emailValue) {
      usersSkipped += 1;
      continue;
    }

    await prisma.dataDocument.upsert({
      where: { collectionPath_docId: { collectionPath: "users", docId: uid } },
      create: { collectionPath: "users", docId: uid, data: data as any },
      update: { data: data as any },
    });

    const existingByUid = await prisma.userAccount.findUnique({ where: { uid } });
    const existingByEmail = await prisma.userAccount.findUnique({ where: { email: emailValue } });
    const target = existingByUid ?? existingByEmail;
    const payload = {
      uid,
      email: emailValue,
      firstName: typeof data.firstName === "string" ? data.firstName : null,
      lastName: typeof data.lastName === "string" ? data.lastName : null,
      phone: typeof data.phone === "string" ? data.phone : null,
      role: typeof data.role === "string" ? data.role : "client",
      companyId: typeof data.companyId === "string" ? data.companyId : null,
      referredBy: typeof data.referredBy === "string" ? data.referredBy : null,
      photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
      provider: "firebase-migrated",
      profile: {
        source: "firebase-live",
        migratedAt: new Date().toISOString(),
      } as any,
    };

    if (target) {
      await prisma.userAccount.update({
        where: { id: target.id },
        data: payload,
      });
      usersUpdated += 1;
    } else {
      await prisma.userAccount.create({
        data: payload,
      });
      usersCreated += 1;
    }
  }

  console.log("Migration Firebase live terminée");
  console.log(`- users scannés: ${userDocs.length}`);
  console.log(`- users créés: ${usersCreated}`);
  console.log(`- users mis à jour: ${usersUpdated}`);
  console.log(`- users ignorés: ${usersSkipped}`);
  console.log(`- companies upserted: ${companiesUpserted}`);
}

void run()
  .catch((error) => {
    console.error("Echec migration Firebase live:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
