import { PrismaClient } from "@prisma/client";
import { appEnv, databaseUrlForPrisma } from "@/config/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: databaseUrlForPrisma() },
    },
    log: appEnv.node.isDevelopment ? ["warn", "error"] : ["error"],
  });

/** Réutilisation en serverless (Vercel) et en dev (hot reload). */
globalForPrisma.prisma = prismaClient;

export const prisma = prismaClient;
