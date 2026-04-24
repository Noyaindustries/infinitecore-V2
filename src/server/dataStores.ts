import { MongoClient } from "mongodb";
import { appEnv } from "@/config/env";

type DataDoc = {
  docId: string;
  data: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

type SplitDataDocument = {
  _id: string;
  docId: string;
  collectionPath: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const COLLECTION_PREFIX = "data_";

let cachedClient: MongoClient | null = null;

function getMongoClient() {
  if (!cachedClient) {
    const uri = appEnv.database.url;
    if (!uri) throw new Error("DATABASE_URL manquant.");
    cachedClient = new MongoClient(uri);
  }
  return cachedClient;
}

function splitCollectionName(collectionPath: string) {
  const safe = collectionPath
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "_")
    .replace(/\//g, "__");
  return `${COLLECTION_PREFIX}${safe || "unknown"}`;
}

async function getCollection(collectionPath: string) {
  const client = getMongoClient();
  await client.connect();
  const db = client.db();
  const name = splitCollectionName(collectionPath);
  return db.collection<SplitDataDocument>(name);
}

export async function listSplitDocs(collectionPath: string, take: number, skip = 0): Promise<DataDoc[]> {
  const col = await getCollection(collectionPath);
  const rows = await col.find({}).sort({ updatedAt: -1, _id: 1 }).skip(skip).limit(take).toArray();
  return rows.map((row) => ({
    docId: row.docId || row._id,
    data: row.data || {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function getSplitDoc(collectionPath: string, docId: string): Promise<DataDoc | null> {
  const col = await getCollection(collectionPath);
  const row = await col.findOne({ _id: docId });
  if (!row) return null;
  return {
    docId: row.docId || row._id,
    data: row.data || {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function upsertSplitDoc(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>,
  merge: boolean,
  fallbackCurrent?: Record<string, unknown>
) {
  const col = await getCollection(collectionPath);
  const now = new Date();
  const existing = await col.findOne({ _id: docId });
  const base = existing?.data || fallbackCurrent || {};
  const next = merge ? { ...base, ...data } : data;
  await col.updateOne(
    { _id: docId },
    {
      $set: {
        docId,
        collectionPath,
        data: next,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
}

export async function deleteSplitDoc(collectionPath: string, docId: string) {
  const col = await getCollection(collectionPath);
  await col.deleteOne({ _id: docId });
}
