import { MongoClient } from "mongodb";
import { appEnv } from "@/config/env";

type LegacyRow = {
  _id: unknown;
  collectionPath?: string;
  docId?: string;
  data?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

const COLLECTION_PREFIX = "data_";

function splitCollectionName(collectionPath: string) {
  const safe = collectionPath
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "_")
    .replace(/\//g, "__");
  return `${COLLECTION_PREFIX}${safe || "unknown"}`;
}

async function run() {
  const uri = appEnv.database.url;
  if (!uri) throw new Error("DATABASE_URL manquant.");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const source = db.collection<LegacyRow>("data_documents");
  const total = await source.countDocuments();
  console.log(`[split-migration] data_documents: ${total}`);

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  const perCollection = new Map<string, number>();

  const cursor = source.find({}, { projection: { collectionPath: 1, docId: 1, data: 1, createdAt: 1, updatedAt: 1 } });
  for await (const row of cursor) {
    scanned += 1;
    const collectionPath = String(row.collectionPath || "").trim();
    const docId = String(row.docId || "").trim();
    if (!collectionPath || !docId) {
      skipped += 1;
      continue;
    }
    const targetName = splitCollectionName(collectionPath);
    const target = db.collection<{ _id: string }>(targetName);
    const now = new Date();
    await target.updateOne(
      { _id: docId },
      {
        $set: {
          docId,
          collectionPath,
          data: row.data || {},
          createdAt: row.createdAt || now,
          updatedAt: row.updatedAt || now,
        },
      },
      { upsert: true }
    );
    migrated += 1;
    perCollection.set(targetName, (perCollection.get(targetName) || 0) + 1);
    if (scanned % 500 === 0) {
      console.log(`[split-migration] progress ${scanned}/${total}`);
    }
  }

  console.log("[split-migration] terminé");
  console.log(`- scannés: ${scanned}`);
  console.log(`- migrés: ${migrated}`);
  console.log(`- ignorés: ${skipped}`);
  for (const [name, count] of [...perCollection.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${name}: ${count}`);
  }

  await client.close();
}

void run().catch((error) => {
  console.error("[split-migration] échec", error);
  process.exitCode = 1;
});
