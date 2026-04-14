import { existsSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

function parseDotEnvFile(raw: string, overrideExisting: boolean) {
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (overrideExisting || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/** Aligné sur Next : `.env` puis `.env.local` (priorité au local). */
function loadEnvFromDotEnv() {
  const root = process.cwd();
  const envPath = path.join(root, ".env");
  const localPath = path.join(root, ".env.local");
  if (existsSync(envPath)) {
    parseDotEnvFile(readFileSync(envPath, "utf8"), false);
  }
  if (existsSync(localPath)) {
    parseDotEnvFile(readFileSync(localPath, "utf8"), true);
  }
}

loadEnvFromDotEnv();

/**
 * Délais courts côté driver pour éviter que le proxy Next (/api → :3001)
 * coupe la requête (ECONNRESET) avant qu’Express n’ait pu envoyer le JSON d’erreur.
 * Surchargez dans DATABASE_URL avec serverSelectionTimeoutMS=… si besoin.
 */
function withMongoDriverTimeouts(databaseUrl: string): string {
  const trimmed = databaseUrl.trim();
  if (!trimmed || /serverSelectionTimeoutMS=/i.test(trimmed)) return trimmed;
  const ms =
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS?.trim() ||
    (process.env.NODE_ENV === "development" ? "10000" : "20000");
  const sep = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${sep}serverSelectionTimeoutMS=${encodeURIComponent(ms)}&connectTimeoutMS=${encodeURIComponent(ms)}`;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: withMongoDriverTimeouts(process.env.DATABASE_URL ?? "") },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
