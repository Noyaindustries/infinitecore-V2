import type { PrismaClient } from "@prisma/client";
import { appEnv } from "@/config/env";
import { agentSessionLog } from "@/debug/agentSessionLog";

export type DatabaseHealthBody = Record<string, unknown>;

/**
 * Vérifie la connectivité Prisma → MongoDB (compte `user_accounts`).
 * Logique partagée par `pages/api/health-check` et `src/pages/api/health-check`.
 */
export async function runDatabaseHealthCheck(prisma: PrismaClient): Promise<{
  statusCode: number;
  body: DatabaseHealthBody;
}> {
  const start = Date.now();

  try {
    const userCount = await Promise.race([
      prisma.userAccount.count(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout Prisma (10s)")), 10_000)),
    ]);

    const duration = Date.now() - start;
    const payload: DatabaseHealthBody = {
      status: "DATABASE_CONNECTED",
      durationMs: duration,
      message: "La connexion à MongoDB est opérationnelle.",
    };

    if (appEnv.node.isProduction) {
      return { statusCode: 200, body: payload };
    }

    return {
      statusCode: 200,
      body: {
        ...payload,
        userCount,
        env: {
          DATABASE_URL_PRESENT: !!appEnv.database.url,
          NODE_ENV: process.env.NODE_ENV,
          VERCEL_ENV: process.env.VERCEL_ENV || "local",
        },
      },
    };
  } catch (error: unknown) {
    const duration = Date.now() - start;
    console.error("[health-check] Erreur:", error);
    agentSessionLog({
      runId: "initial",
      hypothesisId: "H7",
      location: "src/lib/runDatabaseHealthCheck.ts",
      message: "health_check_db_failed",
      data: {
        durationMs: duration,
        errMessage: error instanceof Error ? error.message : String(error),
        databaseUrlPresent: !!appEnv.database.url,
      },
    });

    const payload: DatabaseHealthBody = {
      status: "DATABASE_ERROR",
      durationMs: duration,
      message: "Échec de la connexion à MongoDB. Vérifiez DATABASE_URL et l'IP Whitelist d'Atlas.",
    };

    if (appEnv.node.isProduction) {
      return { statusCode: 503, body: payload };
    }

    return {
      statusCode: 503,
      body: {
        ...payload,
        error: error instanceof Error ? error.message : String(error),
        env: {
          DATABASE_URL_PRESENT: !!appEnv.database.url,
        },
      },
    };
  }
}
